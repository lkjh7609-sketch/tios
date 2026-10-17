/**
 * 앱(iOS)에서만: 오늘·곧 시작하는 여행 일정을 홈 화면 위젯과 애플워치로 내보낸다.
 * 네이티브 플러그인 TripShare(ios/App/App/TripSharePlugin.swift)가 앱 그룹과 워치 연결(WatchConnectivity)에 저장한다.
 * 위젯·워치는 네트워크·로그인이 없어서, 여기서 만든 이 JSON이 그 둘이 아는 전부다 — 모양은 ios/App/Shared/TripModels.swift와 같아야 한다.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { tripService, type TripRow } from '@/shared/api/tripService';
import { normalizeLocale } from '@/shared/i18n';
import { captureError } from '@/shared/monitoring';
import { isNativeApp } from '@/shared/platform';

export interface SharedPlace {
  n: string;
  lat: number;
  lng: number;
  t?: string;
}
export interface SharedTrip {
  id: string;
  title: string;
  start: string;
  end: string;
  days: Record<string, SharedPlace[]>;
}
export interface SharedPayload {
  v: 1;
  lang: string;
  updated: number;
  trips: SharedTrip[];
}

/** 오늘로부터 이 일수 안에 시작하는 여행까지만 보낸다(워치로 보내는 데이터 크기를 작게) */
export const LOOKAHEAD_DAYS = 14;
const MAX_TRIPS = 4;

interface TripSharePlugin {
  /** liveEndpoint·liveKey: 라이브 액티비티 토큰을 앱이 백그라운드에서도 서버(live-activity 함수)로 올리도록 Supabase 주소·공개 키를 넘긴다 */
  setTrips(options: { json: string; liveEndpoint?: string; liveKey?: string }): Promise<void>;
  /** 일정은 그대로지만 앱을 다시 열었을 때 — 여행 당일이면 라이브 액티비티를 켠다 */
  refreshLive?(): Promise<void>;
  clear(): Promise<void>;
}
let plugin: TripSharePlugin | null = null;
function getPlugin(): TripSharePlugin | null {
  if (!isNativeApp() || !Capacitor.isPluginAvailable('TripShare')) return null;
  plugin ??= registerPlugin<TripSharePlugin>('TripShare');
  return plugin;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return x;
}

/** "09:00:00" / "09:00" → "09:00". 형식이 다르면 없는 걸로 */
export function toHm(time: string | undefined | null): string | undefined {
  if (!time) return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** 위젯·워치에 보낼 대상 여행 — 끝나지 않았고, 오늘부터 LOOKAHEAD_DAYS일 안에 시작하는 것 */
export function isRelevantTrip(trip: Pick<TripRow, 'start_date' | 'end_date'>, now: Date): boolean {
  if (!trip.start_date || !trip.end_date) return false;
  const today = ymd(now);
  return trip.end_date >= today && trip.start_date <= ymd(addDays(now, LOOKAHEAD_DAYS));
}

/** 여행(내용 포함)을 위젯·워치용으로 줄인다 — 좌표가 없는(0,0) 장소는 가까운 곳 계산에 쓸 수 없어 뺀다 */
export function toSharedTrip(trip: TripRow): SharedTrip | null {
  if (!trip.start_date || !trip.end_date) return null;
  const data = (trip.content?.data ?? {}) as Record<string, { name?: string; lat?: number; lng?: number; time?: string }[]>;
  const days: Record<string, SharedPlace[]> = {};
  for (const [day, items] of Object.entries(data)) {
    const places: SharedPlace[] = [];
    for (const it of items ?? []) {
      if (!it?.name || typeof it.lat !== 'number' || typeof it.lng !== 'number' || (it.lat === 0 && it.lng === 0)) continue;
      const t = toHm(it.time);
      places.push(t ? { n: it.name, lat: it.lat, lng: it.lng, t } : { n: it.name, lat: it.lat, lng: it.lng });
    }
    if (places.length > 0) days[day] = places;
  }
  return { id: trip.id, title: trip.title, start: trip.start_date, end: trip.end_date, days };
}

export function buildPayload(trips: TripRow[], lang: string, now: Date = new Date()): SharedPayload {
  const shared = trips
    .filter((t) => isRelevantTrip(t, now))
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
    .slice(0, MAX_TRIPS)
    .map(toSharedTrip)
    .filter((t): t is SharedTrip => t !== null);
  return { v: 1, lang: normalizeLocale(lang), updated: Math.round(now.getTime() / 1000), trips: shared };
}

let lastJson = '';

/** 일정을 읽어 네이티브로 보낸다. 앱이 아니면 아무것도 하지 않는다. 같은 내용이면 다시 보내지 않는다(updated 시각은 비교에서 뺀다) */
export async function syncTripsToNative(lang: string): Promise<void> {
  const p = getPlugin();
  if (!p) return;
  try {
    const now = new Date();
    const list = (await tripService.listTrips()).filter((t) => isRelevantTrip(t, now));
    const withContent = await Promise.all(list.map((t) => tripService.getTrip(t.id)));
    const payload = buildPayload(withContent.filter((t): t is TripRow => t !== null), lang, now);
    const key = JSON.stringify({ ...payload, updated: 0 });
    if (key === lastJson) {
      await p.refreshLive?.();
      return;
    }
    await p.setTrips({
      json: JSON.stringify(payload),
      liveEndpoint: import.meta.env.VITE_SUPABASE_URL as string | undefined,
      liveKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
    });
    lastJson = key;
  } catch (err) {
    captureError(err, { where: 'widgetSync' });
  }
}

/** 로그아웃 — 위젯·워치에 남은 일정을 지운다 */
export async function clearNativeTrips(): Promise<void> {
  const p = getPlugin();
  if (!p) return;
  lastJson = '';
  try {
    await p.clear();
  } catch (err) {
    captureError(err, { where: 'widgetSync.clear' });
  }
}
