import { describe, expect, it } from 'vitest';
import { isOperatingHours, kstHour, refreshAfterMs } from './refreshPolicy';

// 한국 시각 → UTC로 만든 Date (한국은 UTC+9)
const kst = (h: number, m = 0) => new Date(Date.UTC(2026, 9, 12, h - 9, m));

describe('인천 전광판 갱신 정책', () => {
  it('운영 시간은 한국 06:00~24:00', () => {
    expect(kstHour(kst(6))).toBe(6);
    expect(isOperatingHours(kst(5, 59))).toBe(false);
    expect(isOperatingHours(kst(6, 0))).toBe(true);
    expect(isOperatingHours(kst(12))).toBe(true);
    expect(isOperatingHours(kst(23, 59))).toBe(true);
    expect(isOperatingHours(kst(0, 0))).toBe(false); // 한국 자정(UTC 15시)
    expect(isOperatingHours(kst(3))).toBe(false);
  });

  it('정기 실행은 3분, 사람은 운영 시간 7분·새벽 3분', () => {
    expect(refreshAfterMs(kst(12), true)).toBe(3 * 60_000);
    expect(refreshAfterMs(kst(12), false)).toBe(7 * 60_000);
    expect(refreshAfterMs(kst(3), false)).toBe(3 * 60_000);
  });

  it('사람이 부르는 기준(7분)은 정기 실행 간격(5분)보다 길다 — 정기 실행이 살아 있으면 사람은 기다리지 않는다', () => {
    expect(refreshAfterMs(kst(12), false)).toBeGreaterThan(5 * 60_000);
  });
});
