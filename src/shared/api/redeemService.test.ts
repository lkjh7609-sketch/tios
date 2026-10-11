import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({ rpc }) }));

import { formatRedeemInput, isCompleteRedeemInput, redeemCode } from './redeemService';

beforeEach(() => rpc.mockReset());

describe('formatRedeemInput', () => {
  it('영문·숫자만 남겨 대문자로, 4자마다 하이픈, 12자까지', () => {
    expect(formatRedeemInput('trip')).toBe('TRIP');
    expect(formatRedeemInput('tripab12')).toBe('TRIP-AB12');
    expect(formatRedeemInput(' trip-ab12 cd34 xx ')).toBe('TRIP-AB12-CD34');
    expect(formatRedeemInput('')).toBe('');
  });

  it('12자를 채워야 완성', () => {
    expect(isCompleteRedeemInput('TRIP-AB12-CD3')).toBe(false);
    expect(isCompleteRedeemInput('TRIP-AB12-CD34')).toBe(true);
  });
});

describe('redeemCode', () => {
  it('성공: 추가된 수량과 새 한도', async () => {
    rpc.mockResolvedValue({ data: { ok: true, kind: 'trips', amount: 3, trip_limit: 5 }, error: null });
    await expect(redeemCode('TRIP-AB12-CD34')).resolves.toEqual({ ok: true, kind: 'trips', amount: 3, tripLimit: 5 });
    expect(rpc).toHaveBeenCalledWith('redeem_code', { p_code: 'TRIP-AB12-CD34' });
  });

  it('실패는 예외가 아니라 이유 값', async () => {
    rpc.mockResolvedValue({ data: { ok: false, reason: 'pro_active' }, error: null });
    await expect(redeemCode('x')).resolves.toEqual({ ok: false, reason: 'pro_active' });
  });

  it('서버 오류는 던진다', async () => {
    rpc.mockResolvedValue({ data: null, error: new Error('boom') });
    await expect(redeemCode('x')).rejects.toThrow('boom');
  });
});
