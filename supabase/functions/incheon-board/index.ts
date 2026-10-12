/**
 * Supabase Edge Function: incheon-board — 인천공항 출·도착 전광판 데이터
 *
 * 호출: 홈 화면이 3분마다(src/features/home/airport/useAirportBoard.ts). 응답은 항상 airport_board 표의 마지막 값이다.
 * 표가 3분보다 오래됐을 때만 외부(인천국제공항공사 '여객기 운항 현황 조회 서비스(다국어)', data.go.kr)를 부르는데,
 * 그 권한은 DB 함수 claim_airport_refresh가 한 번에 한 요청에게만 준다(0078) — 보는 사람이 많아도 3분에 출발·도착 각 1회,
 * 하루 상한(900회)을 넘으면 더 부르지 않는다(개발 계정 1,000회/일).
 *
 * 정기 실행(0115): 한국 06:00~24:00에는 DB(pg_cron)가 5분마다 이 함수를 x-purge-secret과 함께 불러 값을 미리 갱신해 둔다.
 * 그 시간대에 사람이 부르면 7분이 넘었을 때만 직접 갱신한다(정기 실행이 멈췄을 때의 안전망) — 평소엔 저장된 값을 바로 받는다.
 * 새벽(00~06시)은 예전 방식 그대로(요청이 있을 때 3분이 지났으면 그 요청이 갱신). 정책 계산: refreshPolicy.ts.
 *
 * 설정(한 번만): supabase secrets set INCHEON_API_KEY=<data.go.kr 일반 인증키>
 * 외부 호출이 실패하면 이전 값을 그대로 둔다(그 방향만) — 응답의 stale=true로 알린다.
 */
import { createClient } from '@supabase/supabase-js';
import { refreshAfterMs } from '../../../src/features/home/airport/refreshPolicy.ts';
import { secretMatches } from '../purge-archive/paths.ts';
import {
  boardWindow,
  extractItems,
  isNormalResponse,
  normalizeBoard,
  type BoardDirection,
  type BoardFlight,
} from '../../../src/features/home/airport/boardParse.ts';

const BASE = 'https://apis.data.go.kr/B551177/StatusOfPassengerFlightsOdp';
const OPERATION: Record<BoardDirection, string> = {
  departures: 'getPassengerDeparturesOdp',
  arrivals: 'getPassengerArrivalsOdp',
};
const FETCH_TIMEOUT_MS = 8000;

function corsHeaders(origin: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return headers;
}

async function fetchDirection(direction: BoardDirection, apiKey: string, window: { from: string; to: string }): Promise<BoardFlight[]> {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    type: 'json',
    lang: 'K',
    numOfRows: '1000',
    pageNo: '1',
    from_time: window.from,
    to_time: window.to,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/${OPERATION[direction]}?${params.toString()}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!isNormalResponse(json)) throw new Error('abnormal response');
    return normalizeBoard(extractItems(json));
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const read = () =>
    admin.from('airport_board').select('departures, arrivals, fetched_at').eq('id', 'incheon').maybeSingle();

  const { data: board, error: readError } = await read();
  if (readError || !board) {
    console.error('[incheon-board] read failed:', readError?.message);
    return new Response(JSON.stringify({ error: 'board_unavailable' }), { status: 500, headers });
  }

  const apiKey = Deno.env.get('INCHEON_API_KEY');
  const now = new Date();
  // 정기 실행(pg_cron)이 부른 것인가 — 서버 안에서만 아는 비밀값이 맞을 때만
  const fromCron = secretMatches(req.headers.get('x-purge-secret'), Deno.env.get('PURGE_SECRET'));
  const refreshAfter = refreshAfterMs(now, fromCron);
  const age = board.fetched_at ? now.getTime() - new Date(board.fetched_at).getTime() : Infinity;
  let current = board;
  let stale = age >= refreshAfter;

  if (stale && apiKey) {
    // 갱신 권한(마지막 시도로부터 refreshAfter가 지났고 하루 상한 안일 때만) — 못 받으면 마지막 값을 그대로 돌려준다
    const { data: claimed } = await admin.rpc('claim_airport_refresh', { p_min_age: `${Math.round(refreshAfter / 60_000)} minutes` });
    if (claimed === true) {
      const window = boardWindow();
      const [dep, arr] = await Promise.allSettled([
        fetchDirection('departures', apiKey, window),
        fetchDirection('arrivals', apiKey, window),
      ]);
      const next = {
        departures: dep.status === 'fulfilled' ? dep.value : (board.departures as BoardFlight[]),
        arrivals: arr.status === 'fulfilled' ? arr.value : (board.arrivals as BoardFlight[]),
      };
      for (const r of [dep, arr]) {
        if (r.status === 'rejected') console.warn('[incheon-board] fetch failed:', r.reason instanceof Error ? r.reason.message : r.reason);
      }
      // 한 방향이라도 새로 받았으면 값을 쓴다. 둘 다 실패하면 아무것도 덮어쓰지 않는다(fetched_at도 그대로)
      if (dep.status === 'fulfilled' || arr.status === 'fulfilled') {
        const fetchedAt = new Date().toISOString();
        const { error } = await admin.from('airport_board').update({ ...next, fetched_at: fetchedAt }).eq('id', 'incheon');
        if (error) console.error('[incheon-board] write failed:', error.message);
        else {
          current = { ...next, fetched_at: fetchedAt };
          stale = dep.status !== 'fulfilled' || arr.status !== 'fulfilled';
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ departures: current.departures, arrivals: current.arrivals, fetchedAt: current.fetched_at, stale }),
    { status: 200, headers },
  );
});
