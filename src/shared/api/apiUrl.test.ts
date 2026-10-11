import { afterEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ value: false }));
vi.mock('@/shared/platform', () => ({ isNativeApp: () => native.value }));

import { apiUrl, publicOrigin } from './apiUrl';

afterEach(() => {
  native.value = false;
});

describe('apiUrl / publicOrigin', () => {
  it('웹: /api는 상대 경로, 공유 링크 기준 주소는 현재 오리진', () => {
    expect(apiUrl('/api/geo')).toBe('/api/geo');
    expect(publicOrigin()).toBe(window.location.origin);
  });

  it('앱: /api와 공유 링크 모두 운영 도메인(capacitor://localhost는 남이 열 수 없다)', () => {
    native.value = true;
    expect(apiUrl('/api/geo')).toBe('https://triptic.my/api/geo');
    expect(publicOrigin()).toBe('https://triptic.my');
  });
});
