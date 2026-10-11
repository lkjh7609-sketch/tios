import { afterEach, describe, expect, it } from 'vitest';
import { apiUrl, publicOrigin } from './apiUrl';

// 앱 판별은 실제 isNativeApp이 읽는 window.Capacitor로 흉내 낸다(vitest.setup이 i18n을 통해 이 모듈을 먼저 불러 vi.mock이 안 먹는다)
function setNative(on: boolean) {
  (window as unknown as { Capacitor?: unknown }).Capacitor = on ? { isNativePlatform: () => true } : undefined;
}

afterEach(() => setNative(false));

describe('apiUrl / publicOrigin', () => {
  it('웹: /api는 상대 경로, 공유 링크 기준 주소는 현재 오리진', () => {
    expect(apiUrl('/api/geo')).toBe('/api/geo');
    expect(publicOrigin()).toBe(window.location.origin);
  });

  it('앱: /api와 공유 링크 모두 운영 도메인(capacitor://localhost는 남이 열 수 없다)', () => {
    setNative(true);
    expect(apiUrl('/api/geo')).toBe('https://triptic.my/api/geo');
    expect(publicOrigin()).toBe('https://triptic.my');
  });
});
