import { describe, expect, it } from 'vitest';
import { apnsBody, isDeviceKey, isPushToken, liveActivityTopic, parseEvents } from './payload';

const now = 1_800_000_000;
const state = { here: '신주쿠 교엔', hereTime: '14:00', next: '시부야 스카이', nextTime: '14:45', travel: 25, departAt: now + 1080, urgent: true, go: false };
const attributes = { tripId: 't1', title: '도쿄 3박 4일', day: 1, lang: 'ko' };

describe('라이브 액티비티 — 앱이 올린 일정 검사', () => {
  it('모양이 맞는 순간만 남기고, 지난 것·켜기인데 attributes 없는 것·이상한 값은 뺀다', () => {
    const events = parseEvents(
      [
        { at: now + 60, type: 'start', trip_id: 't1', day: 1, state, attributes, alert: { title: '도쿄 · 1일차', body: '오늘 일정을 잠금 화면에 띄웠어요' } },
        { at: now + 120, type: 'update', trip_id: 't1', day: 1, state },
        { at: now + 180, type: 'depart', trip_id: 't1', day: 1, state, alert: { title: '지금 출발할 시간이에요', body: '시부야 스카이 · 이동 약 25분' } },
        { at: now - 3600, type: 'update', trip_id: 't1', day: 1, state },
        { at: now + 60, type: 'start', trip_id: 't1', day: 1, state },
        { at: now + 60, type: 'boom', trip_id: 't1', day: 1, state },
        { at: now + 60, type: 'update', trip_id: 't1', day: 0, state },
        { at: now + 60, type: 'update', trip_id: 't1', day: 1, state: { big: 'x'.repeat(2000) } },
      ],
      now,
    );
    expect(events?.map((e) => e.type)).toEqual(['start', 'update', 'depart']);
    expect(events?.[0].attributes).toEqual(attributes);
    expect(parseEvents('nope', now)).toBeNull();
  });

  it('기기 키는 64자 16진수, 푸시 토큰은 16진수만', () => {
    expect(isDeviceKey('a'.repeat(64))).toBe(true);
    expect(isDeviceKey('a'.repeat(63))).toBe(false);
    expect(isDeviceKey('G'.repeat(64))).toBe(false);
    expect(isPushToken('0123abcd'.repeat(8))).toBe(true);
    expect(isPushToken('not-a-token')).toBe(false);
  });
});

describe('라이브 액티비티 — APNs 본문', () => {
  it('켜기: event start + attributes-type(Swift 이름) + attributes + 알림, 우선순위 10', () => {
    const { body, priority } = apnsBody({ type: 'start', state, attributes, alert: { title: 'a', body: 'b' } }, now);
    const aps = JSON.parse(body).aps;
    expect(aps.event).toBe('start');
    expect(aps['attributes-type']).toBe('TripActivityAttributes');
    expect(aps.attributes).toEqual(attributes);
    expect(aps['content-state']).toEqual(state);
    expect(aps.timestamp).toBe(now);
    expect(priority).toBe('10');
  });

  it('조용한 갱신은 우선순위 5·알림 없음, 출발은 알림(소리·진동) + 10', () => {
    const quiet = apnsBody({ type: 'update', state }, now);
    expect(JSON.parse(quiet.body).aps.alert).toBeUndefined();
    expect(quiet.priority).toBe('5');
    const depart = apnsBody({ type: 'depart', state, alert: { title: '지금 출발할 시간이에요', body: '시부야 스카이' } }, now);
    const aps = JSON.parse(depart.body).aps;
    expect(aps.event).toBe('update');
    expect(aps.alert).toEqual({ title: '지금 출발할 시간이에요', body: '시부야 스카이', sound: 'default' });
    expect(depart.priority).toBe('10');
  });

  it('끄기는 바로 사라지게(dismissal-date = 지금)', () => {
    const aps = JSON.parse(apnsBody({ type: 'end', state }, now).body).aps;
    expect(aps.event).toBe('end');
    expect(aps['dismissal-date']).toBe(now);
  });

  it('topic은 번들 ID + .push-type.liveactivity', () => {
    expect(liveActivityTopic('com.triptic.travel')).toBe('com.triptic.travel.push-type.liveactivity');
  });
});
