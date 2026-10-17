import { describe, expect, it } from 'vitest';
import type { TripRow } from '@/shared/api/tripService';
import { buildPayload, isRelevantTrip, toHm, toSharedTrip } from './widgetSync';

const NOW = new Date(2026, 10, 15, 9, 30); // 2026-11-15(월 아님 상관없음) 09:30 로컬
const row = (o: Partial<TripRow>): TripRow =>
  ({ id: 't1', owner_id: 'u', title: '오사카 여행', city: null, city_lat: null, city_lng: null, start_date: '2026-11-13', end_date: '2026-11-16', total_days: 4, base_currency: 'KRW', status: 'planning', created_at: '', updated_at: '', ...o }) as TripRow;

describe('widgetSync', () => {
  it('시각을 HH:mm으로 맞춘다', () => {
    expect(toHm('09:00:00')).toBe('09:00');
    expect(toHm('9:05')).toBe('09:05');
    expect(toHm('25:00')).toBeUndefined();
    expect(toHm(undefined)).toBeUndefined();
    expect(toHm('아침')).toBeUndefined();
  });

  it('끝나지 않았고 14일 안에 시작하는 여행만 대상', () => {
    expect(isRelevantTrip(row({}), NOW)).toBe(true); // 진행 중
    expect(isRelevantTrip(row({ start_date: '2026-11-25', end_date: '2026-11-28' }), NOW)).toBe(true); // 10일 뒤
    expect(isRelevantTrip(row({ start_date: '2026-12-10', end_date: '2026-12-12' }), NOW)).toBe(false); // 25일 뒤
    expect(isRelevantTrip(row({ start_date: '2026-11-01', end_date: '2026-11-04' }), NOW)).toBe(false); // 끝남
    expect(isRelevantTrip(row({ start_date: null }), NOW)).toBe(false);
  });

  it('일정 내용을 줄이고 좌표 없는 장소는 뺀다', () => {
    const trip = row({
      content: {
        data: {
          3: [
            { name: '구로몬 시장', lat: 34.66, lng: 135.5, time: '09:00:00' },
            { name: '좌표 없음', lat: 0, lng: 0, time: '10:00' },
            { name: '시각 없음', lat: 34.7, lng: 135.4 },
          ],
          2: [],
        },
      },
    });
    const s = toSharedTrip(trip)!;
    expect(s.days).toEqual({
      '3': [
        { n: '구로몬 시장', lat: 34.66, lng: 135.5, t: '09:00' },
        { n: '시각 없음', lat: 34.7, lng: 135.4 },
      ],
    });
    expect(s.title).toBe('오사카 여행');
  });

  it('전체 데이터: 언어 정규화·시작일 순·최대 4개', () => {
    const many = [5, 4, 3, 2, 1].map((n) => row({ id: `t${n}`, start_date: `2026-11-${15 + n}`, end_date: `2026-11-${16 + n}`, content: { data: { 1: [{ name: 'a', lat: 1, lng: 1 }] } } }));
    const p = buildPayload(many, 'en-AU', NOW);
    expect(p.lang).toBe('en');
    expect(p.v).toBe(1);
    expect(p.trips.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4']);
    expect(p.updated).toBe(Math.round(NOW.getTime() / 1000));
  });
});
