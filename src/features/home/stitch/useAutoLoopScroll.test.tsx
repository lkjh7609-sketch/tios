import { render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoLoopScroll } from './useAutoLoopScroll';

function List({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useAutoLoopScroll(ref, enabled);
  return (
    <div ref={ref} data-testid="list">
      {['a', 'b', 'a2', 'b2'].map((k, i) => (
        <span key={k} data-i={i} />
      ))}
    </div>
  );
}

/** jsdom은 레이아웃이 없다 — 한 칸 100px, 앞쪽 2칸 = 한 바퀴 200px, 화면 폭 150px로 흉내 낸다 */
function fakeLayout(el: HTMLElement) {
  Object.defineProperty(el, 'scrollWidth', { value: 400, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: 150, configurable: true });
  [...el.children].forEach((child, i) => Object.defineProperty(child, 'offsetLeft', { value: i * 100, configurable: true }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useAutoLoopScroll', () => {
  it('왼쪽으로 조금씩 흐르다가 한 바퀴(200px)에 닿으면 처음으로 이어진다', () => {
    const { getByTestId } = render(<List />);
    const el = getByTestId('list');
    fakeLayout(el);
    vi.advanceTimersByTime(2000);
    expect(el.scrollLeft).toBeGreaterThan(0);
    vi.advanceTimersByTime(20000); // 26px/초 × 22초 ≈ 570px — 여러 바퀴를 돌아도 한 바퀴 안에 머문다
    expect(el.scrollLeft).toBeGreaterThanOrEqual(0);
    expect(el.scrollLeft).toBeLessThan(200);
  });

  it('손으로 만지는 동안은 멈춘다', () => {
    const { getByTestId } = render(<List />);
    const el = getByTestId('list');
    fakeLayout(el);
    vi.advanceTimersByTime(500);
    el.dispatchEvent(new Event('touchstart'));
    const held = el.scrollLeft;
    vi.advanceTimersByTime(3000);
    expect(el.scrollLeft).toBe(held);
  });

  it('끄면(enabled=false) 흐르지 않는다', () => {
    const { getByTestId } = render(<List enabled={false} />);
    const el = getByTestId('list');
    fakeLayout(el);
    vi.advanceTimersByTime(3000);
    expect(el.scrollLeft).toBe(0);
  });
});
