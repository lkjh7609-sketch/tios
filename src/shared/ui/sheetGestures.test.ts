import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installSheetGestures, isBottomSheet } from './sheetGestures';

function rectOf(el: HTMLElement, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...rect }) as DOMRect;
}

function touch(type: string, y: number, target: Element, timeStamp = 0) {
  const e = new Event(type, { bubbles: true, cancelable: true }) as Event & { touches: unknown[]; timeStamp: number };
  Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [{ clientY: y }] });
  Object.defineProperty(e, 'timeStamp', { value: timeStamp });
  target.dispatchEvent(e);
}

let uninstall: () => void;
beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
  uninstall = installSheetGestures();
});
afterEach(() => {
  uninstall();
  document.body.innerHTML = '';
});

describe('isBottomSheet', () => {
  it('화면 맨 아래에 폭이 가득 붙은 창만 하단 시트로 본다(가운데 팝업은 아니다)', () => {
    const sheet = document.createElement('div');
    rectOf(sheet, { top: 500, bottom: 800, width: 400, height: 300 });
    expect(isBottomSheet(sheet)).toBe(true);
    const popup = document.createElement('div');
    rectOf(popup, { top: 250, bottom: 550, width: 320, height: 300 });
    expect(isBottomSheet(popup)).toBe(false);
  });
});

describe('installSheetGestures', () => {
  async function openDialog(rect: Partial<DOMRect>) {
    const overlay = document.createElement('div');
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    rectOf(dialog, rect);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    await Promise.resolve(); // MutationObserver는 마이크로태스크로 불린다
    return dialog;
  }

  it('하단 시트로 열린 창에만 data-sheet를 단다', async () => {
    const sheet = await openDialog({ top: 500, bottom: 800, width: 400, height: 300 });
    expect(sheet.dataset.sheet).toBeDefined();
    const popup = await openDialog({ top: 250, bottom: 550, width: 320, height: 300 });
    expect(popup.dataset.sheet).toBeUndefined();
  });

  it('위쪽(손잡이)을 잡고 충분히 내리면 sheet-dismiss를 보내고, 받는 쪽이 없으면 제자리로 돌아온다', async () => {
    vi.useFakeTimers();
    const dialog = await openDialog({ top: 500, bottom: 800, width: 400, height: 300 });
    const handler = vi.fn((e: Event) => e.preventDefault());
    dialog.addEventListener('sheet-dismiss', handler);
    touch('touchstart', 520, dialog, 0);
    touch('touchmove', 560, dialog, 50);
    touch('touchmove', 660, dialog, 100);
    expect(dialog.style.translate).toBe('0 140px');
    touch('touchend', 660, dialog, 120);
    expect(handler).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('조금만 내리고 놓으면 닫지 않고 제자리로', async () => {
    const dialog = await openDialog({ top: 500, bottom: 800, width: 400, height: 300 });
    const handler = vi.fn();
    dialog.addEventListener('sheet-dismiss', handler);
    touch('touchstart', 520, dialog, 0);
    touch('touchmove', 540, dialog, 400);
    touch('touchend', 540, dialog, 800);
    expect(handler).not.toHaveBeenCalled();
    expect(dialog.style.translate).toBe('');
  });

  it('손잡이 쪽(위 56px)이 아니라 본문을 잡으면 끌리지 않는다', async () => {
    const dialog = await openDialog({ top: 500, bottom: 800, width: 400, height: 300 });
    touch('touchstart', 700, dialog, 0);
    touch('touchmove', 780, dialog, 50);
    expect(dialog.style.translate).toBe('');
  });
});
