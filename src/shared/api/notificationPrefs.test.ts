import { describe, expect, it } from 'vitest';
import { normalizeNotificationPrefs, notificationsEnabled, withNotificationsEnabled } from './profileService';

describe('알림 설정 묶음', () => {
  it('비어 있으면 모두 켜진 것으로 본다', () => {
    expect(normalizeNotificationPrefs(null)).toEqual({ trip: true, community: true, companion: true, collab: true });
  });

  it('예전 키(출발 전·커뮤니티 답글)는 새 묶음으로 옮기고 나머지 예전 키는 버린다', () => {
    expect(normalizeNotificationPrefs({ preDeparture: false, flightChanges: true, communityReplies: false, marketing: true })).toEqual({
      trip: false,
      community: false,
      companion: true,
      collab: true,
    });
  });

  it('새 키가 있으면 예전 키보다 우선한다', () => {
    expect(normalizeNotificationPrefs({ trip: true, preDeparture: false, companion: false })).toMatchObject({ trip: true, companion: false });
  });

  it('전체 허용은 묶음 설정을 건드리지 않고 enabled만 바꾼다', () => {
    const base = normalizeNotificationPrefs({ companion: false });
    expect(notificationsEnabled(base)).toBe(true);
    const off = withNotificationsEnabled(base, false);
    expect(notificationsEnabled(off)).toBe(false);
    expect(off.companion).toBe(false);
    expect(withNotificationsEnabled(off, true)).toMatchObject({ enabled: true, companion: false });
  });
});
