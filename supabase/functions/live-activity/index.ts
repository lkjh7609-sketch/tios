/**
 * Supabase Edge Function: live-activity — iOS 라이브 액티비티(잠금 화면·다이내믹 아일랜드·워치 스마트 스택)를 서버 푸시로 켜고·바꾸고·끈다.
 *
 * 앱(ios/App/App/TripSync.swift LiveActivityManager)이 부르는 것 — 기기마다 만든 임의 키(device_key, 64자)로만 구분한다.
 * 웹 화면 없이 백그라운드에서 깨어나 토큰을 올릴 수 있어야 해서 로그인 토큰을 쓰지 않는다. 한 기기 키는 그 기기 줄만 바꿀 수 있다.
 *  - { kind: 'schedule', device_key, env, events }     하루하루 '몇 시에 무엇을'(payload.ts LiveEvent) — 아직 안 보낸 것을 통째로 바꾼다
 *  - { kind: 'activity_token', device_key, token, trip_id, day }   켜진 라이브 액티비티의 갱신 토큰
 *  - { kind: 'start_token', device_key, token, env }   서버가 켤 때 쓰는 push-to-start 토큰(iOS 17.2+)
 *  - { kind: 'unregister', device_key }                 로그아웃 — 이 기기 기록을 지운다
 * DB 정기 실행(0116, 1분마다)이 부르는 것 — x-purge-secret(= PURGE_SECRET)이 맞아야 한다.
 *  - { kind: 'tick' }   시각이 된 것을 보낸다: start(있던 것 끄고 push-to-start) · update · depart(진동 알림) · end
 *
 * 배포: `supabase functions deploy live-activity` (호출은 공개 키로 — 인증은 코드 안에서 한다).
 * 비밀값: send-push와 같은 APNS_KEY·APNS_KEY_ID·APNS_TEAM_ID·APNS_TOPIC(앱 번들 ID)·PURGE_SECRET.
 * 토큰은 push_tokens(일반 알림)와 섞지 않는다 — 라이브 액티비티 토큰으로 일반 알림을 보내면 안 된다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { secretMatches } from '../purge-archive/paths.ts';
import { apnsHost, classifyApnsResponse, importApnsKey, signProviderToken } from '../send-push/apns.ts';
import { apnsBody, apnsEnvOf, isDeviceKey, isPushToken, LATE_LIMIT_SEC, liveActivityTopic, parseEvents, type LiveEvent } from './payload.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const MAX_BODY_BYTES = 400_000;

interface Apns {
  /** 한 토큰에 보낸다. 'remove-token'이면 그 토큰은 더 쓸 수 없다 */
  send(token: string, env: string, ev: Pick<LiveEvent, 'type' | 'state' | 'attributes' | 'alert'>): Promise<ReturnType<typeof classifyApnsResponse>>;
}

async function makeApns(): Promise<Apns | null> {
  const pem = Deno.env.get('APNS_KEY');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  if (!pem || !keyId || !teamId) return null;
  const topic = liveActivityTopic(Deno.env.get('APNS_TOPIC') || 'com.triptic.travel');
  const key = await importApnsKey(pem.replace(/\\n/g, '\n'));
  const jwt = await signProviderToken(key, keyId, teamId, Math.floor(Date.now() / 1000));
  return {
    async send(token, env, ev) {
      const { body, priority } = apnsBody(ev, Math.floor(Date.now() / 1000));
      try {
        const res = await fetch(`${apnsHost(env)}/3/device/${token}`, {
          method: 'POST',
          headers: { authorization: `bearer ${jwt}`, 'apns-topic': topic, 'apns-push-type': 'liveactivity', 'apns-priority': priority, 'content-type': 'application/json' },
          body,
        });
        let reason: string | undefined;
        if (!res.ok) reason = ((await res.json().catch(() => null)) as { reason?: string } | null)?.reason;
        const outcome = classifyApnsResponse(res.status, reason);
        if (outcome !== 'sent') console.warn('[live-activity] apns', ev.type, res.status, reason);
        return outcome;
      } catch (e) {
        console.warn('[live-activity] apns request error', e instanceof Error ? e.message : e);
        return 'retry-later';
      }
    },
  };
}

async function touchDevice(admin: SupabaseClient, deviceKey: string, fields: Record<string, unknown> = {}) {
  const { error } = await admin.from('live_activity_devices').upsert({ device_key: deviceKey, updated_at: new Date().toISOString(), ...fields }, { onConflict: 'device_key' });
  if (error) throw new Error(error.message);
}

interface DueRow {
  id: number;
  device_key: string;
  at: string;
  type: LiveEvent['type'];
  trip_id: string;
  day: number;
  payload: Pick<LiveEvent, 'state' | 'attributes' | 'alert'>;
  live_activity_devices: { start_token: string | null; apns_env: string } | null;
}

/** 시각이 된 순간들을 보낸다 */
async function tick(admin: SupabaseClient, apns: Apns) {
  const nowSec = Math.floor(Date.now() / 1000);
  const { data, error } = await admin
    .from('live_activity_events')
    .select('id, device_key, at, type, trip_id, day, payload, live_activity_devices(start_token, apns_env)')
    .is('sent_at', null)
    .lte('at', new Date(nowSec * 1000).toISOString())
    .order('at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  const done = async (id: number, result: string) => {
    counts[result] = (counts[result] ?? 0) + 1;
    await admin.from('live_activity_events').update({ sent_at: new Date().toISOString(), result }).eq('id', id);
  };

  for (const row of (data ?? []) as unknown as DueRow[]) {
    const device = row.live_activity_devices;
    if (!device) {
      await done(row.id, 'no_device');
      continue;
    }
    const late = nowSec - Math.floor(new Date(row.at).getTime() / 1000);
    if (late > LATE_LIMIT_SEC && row.type !== 'end') {
      await done(row.id, 'too_late');
      continue;
    }
    const ev = { type: row.type, ...row.payload };
    const { data: tokenRow } = await admin
      .from('live_activity_tokens')
      .select('token')
      .eq('device_key', row.device_key)
      .eq('trip_id', row.trip_id)
      .eq('day', row.day)
      .maybeSingle();
    const token = (tokenRow?.token as string | undefined) ?? null;
    const dropToken = () => admin.from('live_activity_tokens').delete().eq('device_key', row.device_key).eq('trip_id', row.trip_id).eq('day', row.day);

    if (row.type === 'start') {
      if (!device.start_token) {
        await done(row.id, 'no_start_token');
        continue;
      }
      // 8시간 제한 전에 다시 켜는 경우 — 켜져 있던 것을 먼저 끈다(새 것의 토큰은 앱이 깨어나 다시 올린다)
      if (token) {
        await apns.send(token, device.apns_env, { type: 'end', state: row.payload.state });
        await dropToken();
      }
      const outcome = await apns.send(device.start_token, device.apns_env, ev);
      if (outcome === 'remove-token') await admin.from('live_activity_devices').update({ start_token: null }).eq('device_key', row.device_key);
      await done(row.id, outcome);
      continue;
    }

    if (!token) {
      await done(row.id, 'no_token');
      continue;
    }
    const outcome = await apns.send(token, device.apns_env, ev);
    if (outcome === 'remove-token' || row.type === 'end') await dropToken();
    await done(row.id, outcome);
  }

  // 정리: 이틀 지난 순간, 60일 동안 소식 없는 기기
  await admin.from('live_activity_events').delete().lt('at', new Date((nowSec - 2 * 86400) * 1000).toISOString());
  await admin.from('live_activity_devices').delete().lt('updated_at', new Date((nowSec - 60 * 86400) * 1000).toISOString());
  return counts;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'server_misconfigured' });
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'too_large' });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // ── DB 정기 실행: 시각이 된 것 보내기 ──
    if (body.kind === 'tick') {
      if (!secretMatches(req.headers.get('x-purge-secret'), Deno.env.get('PURGE_SECRET'))) return json(401, { error: 'unauthorized' });
      const apns = await makeApns().catch(() => null);
      if (!apns) return json(503, { error: 'not_configured' });
      return json(200, await tick(admin, apns));
    }

    // ── 앱(기기 키) ──
    const deviceKey = body.device_key;
    if (!isDeviceKey(deviceKey)) return json(400, { error: 'invalid_device' });

    if (body.kind === 'schedule') {
      const nowSec = Math.floor(Date.now() / 1000);
      const events = parseEvents(body.events, nowSec);
      if (!events) return json(400, { error: 'invalid_events' });
      await touchDevice(admin, deviceKey, { apns_env: apnsEnvOf(body.env) });
      const { error: delError } = await admin.from('live_activity_events').delete().eq('device_key', deviceKey).is('sent_at', null);
      if (delError) throw new Error(delError.message);
      if (events.length > 0) {
        const rows = events.map((e) => ({
          device_key: deviceKey,
          at: new Date(e.at * 1000).toISOString(),
          type: e.type,
          trip_id: e.trip_id,
          day: e.day,
          payload: { state: e.state, ...(e.attributes ? { attributes: e.attributes } : {}), ...(e.alert ? { alert: e.alert } : {}) },
        }));
        const { error } = await admin.from('live_activity_events').insert(rows);
        if (error) throw new Error(error.message);
      }
      return json(200, { saved: events.length });
    }

    if (body.kind === 'activity_token') {
      const tripId = body.trip_id;
      const day = body.day;
      if (!isPushToken(body.token) || typeof tripId !== 'string' || tripId.length > 100 || typeof day !== 'number' || !Number.isInteger(day)) {
        return json(400, { error: 'invalid_request' });
      }
      await touchDevice(admin, deviceKey);
      const { error } = await admin
        .from('live_activity_tokens')
        .upsert({ device_key: deviceKey, trip_id: tripId, day, token: body.token, updated_at: new Date().toISOString() }, { onConflict: 'device_key,trip_id,day' });
      if (error) throw new Error(error.message);
      return json(200, { ok: true });
    }

    if (body.kind === 'start_token') {
      if (!isPushToken(body.token)) return json(400, { error: 'invalid_request' });
      await touchDevice(admin, deviceKey, { start_token: body.token, apns_env: apnsEnvOf(body.env) });
      return json(200, { ok: true });
    }

    if (body.kind === 'unregister') {
      await admin.from('live_activity_devices').delete().eq('device_key', deviceKey);
      return json(200, { ok: true });
    }

    return json(400, { error: 'unknown_kind' });
  } catch (e) {
    console.error('[live-activity]', e instanceof Error ? e.message : e);
    return json(500, { error: 'server_error' });
  }
});
