import { getSupabaseClient } from './supabaseClient';

/** 리딤 코드를 쓴 결과 — 서버(redeem_code, 0110)가 실패도 값으로 돌려준다 */
export type RedeemFailureReason = 'not_signed_in' | 'pro_active' | 'too_many_attempts' | 'invalid' | 'used' | 'expired';
export type RedeemResult =
  | { ok: true; kind: 'trips'; amount: number; tripLimit: number }
  | { ok: false; reason: RedeemFailureReason };

/** 입력한 글을 코드 모양(TRIP-XXXX-XXXX, 대문자)으로 — 영문·숫자만 남기고 12자까지, 4자마다 하이픈 */
export function formatRedeemInput(text: string): string {
  const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return clean.replace(/(.{4})(?=.)/g, '$1-');
}

/** 12자(TRIP+8자)를 다 채웠는지 */
export function isCompleteRedeemInput(text: string): boolean {
  return text.replace(/[^A-Za-z0-9]/g, '').length === 12;
}

export async function redeemCode(code: string): Promise<RedeemResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('redeem_code', { p_code: code });
  if (error) throw error;
  const res = data as { ok: boolean; kind?: 'trips'; amount?: number; trip_limit?: number; reason?: RedeemFailureReason };
  if (res.ok) return { ok: true, kind: res.kind ?? 'trips', amount: res.amount ?? 0, tripLimit: res.trip_limit ?? 0 };
  return { ok: false, reason: res.reason ?? 'invalid' };
}
