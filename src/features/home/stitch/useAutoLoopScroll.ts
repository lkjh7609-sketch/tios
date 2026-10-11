import { useEffect, type RefObject } from 'react';

/** 자동으로 흐르는 속도(px/초) — 천천히 */
const SPEED_PX_PER_SEC = 26;
/** 손을 뗀 뒤 다시 흐르기까지 기다리는 시간 */
const RESUME_DELAY_MS = 2000;

/** 한 바퀴 길이 — 이어 붙인 뒤쪽 복사본의 첫 칸이 처음 칸에서 떨어진 거리(칸 사이 간격·바깥 여백까지 정확히 맞는다) */
function loopWidth(el: HTMLElement): number {
  const count = el.children.length;
  if (count < 2 || count % 2 !== 0) return 0;
  return (el.children[count / 2] as HTMLElement).offsetLeft - (el.children[0] as HTMLElement).offsetLeft;
}

/**
 * 가로 목록이 왼쪽으로 조금씩 저절로 흐르고, 끝에 닿으면 처음으로 이어진다(무한 반복).
 * 목록 내용을 같은 순서로 두 번 이어 붙여 둔 가로 스크롤 칸에 건다 — 한 바퀴(앞쪽 목록 길이)만큼 흐르면 처음과 똑같은 모양이라 끊김이 안 보인다.
 * 손으로 만지는 동안은 멈추고 놓은 뒤 잠깐 있다가 다시 흐른다. 화면 밖이거나 '동작 줄이기' 설정이면 흐르지 않는다.
 */
export function useAutoLoopScroll(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let frame = 0;
    let last = 0;
    let touching = false;
    let visible = true;
    let resumeAt = 0;
    let pos = el.scrollLeft;

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      const period = loopWidth(el);
      if (!touching && visible && now >= resumeAt && period > 0 && el.scrollWidth > el.clientWidth) {
        pos += SPEED_PX_PER_SEC * dt;
        if (pos >= period) pos -= period;
        el.scrollLeft = pos;
      } else {
        pos = el.scrollLeft; // 손으로 옮긴 자리에서 이어서 흐른다
      }
      frame = window.requestAnimationFrame(tick);
    };

    const hold = () => {
      touching = true;
    };
    const release = () => {
      touching = false;
      resumeAt = performance.now() + RESUME_DELAY_MS;
    };
    el.addEventListener('touchstart', hold, { passive: true });
    el.addEventListener('touchend', release, { passive: true });
    el.addEventListener('touchcancel', release, { passive: true });
    el.addEventListener('pointerdown', hold, { passive: true });
    el.addEventListener('pointerup', release, { passive: true });
    el.addEventListener('pointercancel', release, { passive: true });

    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true; }) : null;
    observer?.observe(el);

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      el.removeEventListener('touchstart', hold);
      el.removeEventListener('touchend', release);
      el.removeEventListener('touchcancel', release);
      el.removeEventListener('pointerdown', hold);
      el.removeEventListener('pointerup', release);
      el.removeEventListener('pointercancel', release);
    };
  }, [ref, enabled]);
}
