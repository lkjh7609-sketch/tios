/**
 * 라이브 액티비티 — 순수 계산(검사·APNs 본문)만 둔다. 실제 호출은 index.ts.
 * 앱(ios/App/App/TripSync.swift LiveActivityManager)이 하루 일정을 '몇 시에 무엇을 보낼지' 목록으로 계산해 올리고,
 * 서버는 그 시각에 그대로 보낸다 — 시간대·출발 시각 계산은 기기가 정답이라 여기서 다시 계산하지 않는다.
 * content-state·attributes의 키는 Swift TripActivityAttributes(ios/App/Shared/TripModels.swift)와 같아야 한다.
 */

export type LiveEventType = 'start' | 'update' | 'depart' | 'end';

export interface LiveAlert {
  title: string;
  body: string;
}

export interface LiveAttributes {
  tripId: string;
  title: string;
  day: number;
  lang: string;
}

export interface LiveEvent {
  at: number; // Unix 초
  type: LiveEventType;
  trip_id: string;
  day: number;
  state: Record<string, unknown>;
  attributes?: LiveAttributes;
  alert?: LiveAlert;
}

/** 한 번에 받는 순간 수(여행 4개 × 14일 × 하루 약 10번 정도) */
export const MAX_EVENTS = 500;
/** content-state JSON 한도 — APNs 라이브 액티비티 본문은 4KB */
const MAX_STATE_BYTES = 1500;
/** 이만큼 지난 순간은 보내지 않는다(서버가 잠시 멈췄다가 다시 돌 때 옛 내용을 몰아 보내지 않게). 끄기는 늦어도 보낸다 */
export const LATE_LIMIT_SEC = 10 * 60;

const TYPES: readonly LiveEventType[] = ['start', 'update', 'depart', 'end'];

export function isDeviceKey(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
}

export function isPushToken(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{16,400}$/.test(v);
}

export function apnsEnvOf(v: unknown): 'production' | 'sandbox' {
  return v === 'sandbox' ? 'sandbox' : 'production';
}

function text(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.slice(0, max) : null;
}

function isTripId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 100;
}

function isDay(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 366;
}

/** 앱이 올린 목록을 검사해 쓸 수 있는 것만 남긴다. 목록 모양이 아니면 null. 이미 지난(2분 넘게) 순간은 뺀다 */
export function parseEvents(raw: unknown, nowSec: number): LiveEvent[] | null {
  if (!Array.isArray(raw)) return null;
  const out: LiveEvent[] = [];
  for (const item of raw.slice(0, MAX_EVENTS)) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    if (typeof e.at !== 'number' || !Number.isFinite(e.at) || e.at < nowSec - 120) continue;
    if (!TYPES.includes(e.type as LiveEventType)) continue;
    if (!isTripId(e.trip_id) || !isDay(e.day)) continue;
    if (!e.state || typeof e.state !== 'object' || Array.isArray(e.state)) continue;
    if (JSON.stringify(e.state).length > MAX_STATE_BYTES) continue;
    const ev: LiveEvent = { at: Math.floor(e.at), type: e.type as LiveEventType, trip_id: e.trip_id, day: e.day, state: e.state as Record<string, unknown> };
    if (e.alert && typeof e.alert === 'object') {
      const a = e.alert as Record<string, unknown>;
      const title = text(a.title, 80);
      const body = text(a.body, 160);
      if (title && body) ev.alert = { title, body };
    }
    if (e.attributes && typeof e.attributes === 'object') {
      const a = e.attributes as Record<string, unknown>;
      const title = text(a.title, 80);
      if (isTripId(a.tripId) && title && isDay(a.day) && typeof a.lang === 'string') {
        ev.attributes = { tripId: a.tripId, title, day: a.day, lang: a.lang.slice(0, 8) };
      }
    }
    // 켜기는 attributes가 있어야 한다(서버가 push-to-start로 새로 만든다)
    if (ev.type === 'start' && !ev.attributes) continue;
    out.push(ev);
  }
  return out;
}

/**
 * APNs 라이브 액티비티 본문 + 우선순위.
 * 조용한 내용 바꾸기는 5(우선순위 10은 Apple이 횟수를 제한한다), 켜기·출발 알림(진동)·끄기는 10.
 */
export function apnsBody(ev: Pick<LiveEvent, 'type' | 'state' | 'attributes' | 'alert'>, nowSec: number): { body: string; priority: '5' | '10' } {
  const aps: Record<string, unknown> = { timestamp: nowSec, 'content-state': ev.state };
  if (ev.type === 'start') {
    aps.event = 'start';
    aps['attributes-type'] = 'TripActivityAttributes';
    aps.attributes = ev.attributes;
    if (ev.alert) aps.alert = { title: ev.alert.title, body: ev.alert.body };
    return { body: JSON.stringify({ aps }), priority: '10' };
  }
  if (ev.type === 'end') {
    aps.event = 'end';
    aps['dismissal-date'] = nowSec;
    return { body: JSON.stringify({ aps }), priority: '10' };
  }
  aps.event = 'update';
  if (ev.type === 'depart' && ev.alert) {
    aps.alert = { title: ev.alert.title, body: ev.alert.body, sound: 'default' };
    return { body: JSON.stringify({ aps }), priority: '10' };
  }
  return { body: JSON.stringify({ aps }), priority: '5' };
}

/** 라이브 액티비티 푸시의 APNs topic — 앱 번들 ID 뒤에 붙인다 */
export function liveActivityTopic(bundleId: string): string {
  return `${bundleId}.push-type.liveactivity`;
}
