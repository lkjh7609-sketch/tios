import { isNativeApp } from '@/shared/platform';

/**
 * 하단 시트 공통 동작 — 화면 아래에 붙은 창(role="dialog")을 찾아 iOS 시트처럼 만든다(2026-10-11, 앱 전용 UI 전환).
 *  · 열릴 때 data-sheet를 달아(global.css가 그걸 보고 아래에서 쭉 올라오는 움직임을 준다) 가볍게 진동한다.
 *  · 머리 쪽(손잡이·제목, 위에서 56px)을 잡고 아래로 끌면 창이 따라 내려가고, 충분히 내리거나 빠르게 튕기면 닫는다.
 *    닫기는 창의 useFocusTrap이 듣는 'sheet-dismiss' 이벤트로 알린다(창마다 따로 고치지 않아도 되게). 듣는 쪽이 없으면 제자리로 돌아온다.
 * 화면 아래에 붙지 않은 가운데 팝업(확인창 등)은 건드리지 않는다. 한 번만 설치한다(웹에서도 폰 크기면 같이 동작).
 */
const GRAB_ZONE_PX = 56;
const DISMISS_DISTANCE_PX = 96;
const DISMISS_VELOCITY_PX_PER_MS = 0.6;

let installed = false;

/** 창이 화면 맨 아래에 붙어 있고 폭이 화면 가득이면 하단 시트 */
export function isBottomSheet(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  // 열리는 움직임(scale 0.985)이 시작된 순간과 세로 스크롤바 폭(innerWidth에는 들어간다)을 감안해 폭은 여유를 둔다
  const viewWidth = Math.min(window.innerWidth, document.documentElement.clientWidth || window.innerWidth);
  return rect.height > 0 && rect.bottom >= window.innerHeight - 2 && rect.width >= viewWidth * 0.9;
}

function lightHaptic() {
  if (!isNativeApp()) return;
  void import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light })).catch(() => {});
}

function markSheets(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("[role='dialog']:not([data-sheet-checked])").forEach((el) => {
    el.dataset.sheetChecked = '';
    if (isBottomSheet(el)) {
      el.dataset.sheet = '';
      el.style.overscrollBehavior = 'contain';
      lightHaptic();
    }
  });
}

export function installSheetGestures(): () => void {
  if (installed || typeof document === 'undefined') return () => {};
  installed = true;

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches("[role='dialog']")) markSheets(node.parentElement ?? document);
        else if (node.querySelector("[role='dialog']")) markSheets(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  let sheet: HTMLElement | null = null;
  let startY = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let dragging = false;

  function reset(el: HTMLElement, animate: boolean) {
    el.style.transition = animate ? 'translate 0.25s cubic-bezier(0.32, 0.72, 0, 1)' : '';
    el.style.translate = '';
    if (animate) window.setTimeout(() => (el.style.transition = ''), 280);
  }

  function onTouchStart(e: TouchEvent) {
    const target = e.target as HTMLElement | null;
    const el = target?.closest<HTMLElement>("[role='dialog'][data-sheet]") ?? null;
    if (!el || e.touches.length !== 1) return;
    const touch = e.touches[0]!;
    if (touch.clientY - el.getBoundingClientRect().top > GRAB_ZONE_PX) return;
    // 입력칸·선택칸을 잡은 건 끌기가 아니다
    if (target?.closest('input, textarea, select')) return;
    sheet = el;
    startY = lastY = touch.clientY;
    lastT = e.timeStamp;
    velocity = 0;
    dragging = false;
  }

  function onTouchMove(e: TouchEvent) {
    if (!sheet) return;
    const y = e.touches[0]!.clientY;
    const dy = y - startY;
    if (!dragging) {
      if (dy < 6) return; // 위로 밀거나 살짝 움직인 건 무시(스크롤·탭)
      dragging = true;
      sheet.style.transition = 'none';
    }
    if (e.cancelable) e.preventDefault();
    const dt = Math.max(e.timeStamp - lastT, 1);
    velocity = (y - lastY) / dt;
    lastY = y;
    lastT = e.timeStamp;
    sheet.style.translate = `0 ${Math.max(dy, 0)}px`;
  }

  function onTouchEnd() {
    const el = sheet;
    sheet = null;
    if (!el || !dragging) return;
    dragging = false;
    const dy = lastY - startY;
    if (dy > DISMISS_DISTANCE_PX || velocity > DISMISS_VELOCITY_PX_PER_MS) {
      const event = new CustomEvent('sheet-dismiss', { cancelable: true });
      el.dispatchEvent(event);
      if (event.defaultPrevented) {
        // 닫는 쪽이 받았다 — 화면 밖으로 마저 내려 보내고(그 사이 React가 창을 지운다)
        el.style.transition = 'translate 0.2s ease-out';
        el.style.translate = '0 100%';
        // 닫지 않고 남아 있으면(저장 안 한 내용 확인 등) 제자리로 되돌린다
        window.setTimeout(() => {
          if (el.isConnected) reset(el, true);
        }, 400);
        return;
      }
    }
    reset(el, true);
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return () => {
    installed = false;
    observer.disconnect();
    document.removeEventListener('touchstart', onTouchStart);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);
    document.removeEventListener('touchcancel', onTouchEnd);
  };
}
