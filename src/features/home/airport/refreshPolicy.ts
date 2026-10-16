/**
 * 인천 전광판 갱신 정책 — Edge Function incheon-board와 시험이 함께 쓴다(Deno에서도 그대로 import 가능한 순수 계산).
 *
 * · 운영 시간(한국 06:00~24:00)에는 DB 정기 실행(pg_cron, 0115)이 5분마다 외부에서 받아 둔다 → 보는 사람은 항상 저장된 값을 바로 받는다.
 *   사람이 부를 때의 '오래됨' 기준을 정기 실행 간격(5분)보다 길게(7분) 잡아, 정기 실행이 살아 있는 동안은 사람이 외부 응답을 기다리지 않는다.
 *   정기 실행이 멈추면(7분 넘게 못 받으면) 사람이 부른 요청이 대신 갱신한다(예전 방식 = 안전망).
 * · 그 밖 시간(00:00~06:00)은 예전 방침 그대로: 요청이 있을 때 3분이 지났으면 그 요청이 갱신한다.
 * 하루 외부 호출: 정기 실행 216회 × 2(출발·도착) = 432회 + 새벽 요청 갱신 — 일일 상한 900회 안.
 */
export const CRON_INTERVAL_MIN = 5;
/** 정기 실행 시작·끝(한국 시각, 끝은 포함하지 않음) */
export const OPERATING_FROM_HOUR_KST = 6;
export const OPERATING_TO_HOUR_KST = 24;

const MIN = 60_000;

/** 한국 시각의 시(0~23) */
export function kstHour(now: Date): number {
  return (now.getUTCHours() + 9) % 24;
}

export function isOperatingHours(now: Date): boolean {
  const h = kstHour(now);
  return h >= OPERATING_FROM_HOUR_KST && h < OPERATING_TO_HOUR_KST;
}

/** 저장된 값이 이보다 오래되면 갱신이 필요하다(ms). 정기 실행은 3분, 사람은 운영 시간에 7분·그 밖에 3분 */
export function refreshAfterMs(now: Date, fromCron: boolean): number {
  if (fromCron) return 3 * MIN;
  return isOperatingHours(now) ? (CRON_INTERVAL_MIN + 2) * MIN : 3 * MIN;
}
