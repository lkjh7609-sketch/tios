import { isNativeApp } from './platform';
import { SITE_ORIGIN } from './config';

/** 인앱 브라우저를 못 쓸 때 window.open으로 돌아가는 동안엔, 아래 window.open 패치가 다시 가로채 무한히 돌지 않게 건너뛴다 */
let bypassPatch = false;

/**
 * 호텔·항공·액티비티 같은 바깥 사이트로 나가는 링크 — 앱(iOS 셸)에서는 앱 안에서 뜨는 인앱 브라우저(SFSafariViewController)로
 * 열어 사용자가 앱을 떠나지 않게 한다. 웹에서는 평소처럼 새 탭.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isNativeApp()) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    } catch {
      // 플러그인이 없는 셸이면 아래 새 창으로
    }
  }
  bypassPatch = true;
  try {
    window.open(url, '_blank', 'noopener');
  } finally {
    bypassPatch = false;
  }
}

/** 우리 사이트가 아닌 http(s) 주소인지 */
export function isOutboundHttp(href: string, origin = window.location.origin): boolean {
  try {
    const u = new URL(href, origin);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin !== origin;
  } catch {
    return false;
  }
}

/** 우리 사이트의 정적 페이지(`/something.html`)면 운영 사이트의 같은 주소, 아니면 null */
export function staticPageUrl(href: string, origin = window.location.origin): string | null {
  try {
    const u = new URL(href, origin);
    if (u.origin !== origin || !/^\/[\w-]+\.html$/.test(u.pathname)) return null;
    return `${SITE_ORIGIN}${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

/**
 * 앱(iOS 셸) 안에서 우리 사이트가 아닌 http(s) 주소로 나가는 모든 이동을 인앱 브라우저로 돌린다 — 마이리얼트립·Agoda·Trip.com·Klook 등 제휴 링크가
 * 앱을 떠나 사파리나 그 회사 앱(유니버설 링크)으로 튀지 않게(2026-10-11, "마이리얼트립 이동은 모두 인앱 브라우저"):
 *  · 링크 클릭: 새 탭(target=_blank)이든 같은 창이든(다운로드 링크 제외) 바깥 http(s) 주소면 가로챈다 — 링크마다 고치지 않아도 된다
 *  · window.open: 같은 주소 규칙으로 인앱 브라우저로 연다(앱이 아니면 원래 동작)
 * 웹(앱 아님)에서는 아무것도 하지 않는다.
 */
export function installExternalLinkHandler(): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || !isNativeApp()) return;
    const anchor = (e.target as Element | null)?.closest?.('a');
    if (!anchor || anchor.hasAttribute('download')) return;
    const href = anchor.href;
    if (!href) return;
    if (!isOutboundHttp(href)) {
      // 약관·개인정보처리방침 같은 정적 .html 페이지(`/terms.html`)는 앱 화면 경로가 아니다 — WKWebView는 target=_blank를 무시해 눌러도 반응이 없었다
      // (2026-10-12, 심사 중 발견). 운영 사이트의 같은 페이지를 인앱 브라우저로 연다.
      const staticPage = staticPageUrl(href);
      if (!staticPage) return;
      e.preventDefault();
      void openExternalUrl(staticPage);
      return;
    }
    e.preventDefault();
    void openExternalUrl(href);
  };
  document.addEventListener('click', onClick);

  const originalOpen = window.open;
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    const href = url == null ? '' : String(url);
    if (!bypassPatch && isNativeApp() && href && isOutboundHttp(href)) {
      void openExternalUrl(href);
      return null;
    }
    return originalOpen.call(window, url, target, features);
  }) as typeof window.open;

  return () => {
    document.removeEventListener('click', onClick);
    window.open = originalOpen;
  };
}
