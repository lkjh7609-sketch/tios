import '@testing-library/jest-dom/vitest';
import i18n from '@/shared/i18n';

/**
 * i18next 네임스페이스는 lazy(backend.ts의 동적 import)로 로드되고, react-i18next는
 * useSuspense:true라 로드 전 t()를 쓰면 컴포넌트가 suspend한다. 테스트는 Suspense
 * 경계 없이 render()를 바로 호출하므로, 실행 전에 필요한 네임스페이스를 전부
 * 로드해두고 로케일도 'ko'로 고정한다(jsdom navigator.language 감지에 기대지 않음 —
 * 기존 테스트 assertion이 한국어 문자열을 기대한다).
 */
await i18n.changeLanguage('ko');
await i18n.loadNamespaces(['common', 'home', 'plan', 'documents', 'community', 'settings', 'weather']);

/**
 * jsdom에는 matchMedia가 없다 — 폰/PC로 갈리는 화면(useMediaQuery)이 테스트에서 터지지 않게 "아무 조건도 안 맞는" 기본값을 둔다
 * (= PC 모양). 폰 모양을 시험하려면 그 테스트에서 window.matchMedia를 직접 덮어쓴다.
 */
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
