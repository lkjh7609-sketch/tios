import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({ redeem: vi.fn(), toast: vi.fn() }));
vi.mock('@/shared/api/redeemService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/redeemService')>()),
  redeemCode: (c: string) => state.redeem(c),
}));
vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/shared/ui/toast', () => ({ showToast: (...a: unknown[]) => state.toast(...a) }));
vi.mock('@/shared/a11y/useFocusTrap', () => ({ useFocusTrap: () => ({ current: null }) }));

import { RedeemCodeDialog } from './RedeemCodeDialog';

function renderDialog(onClose = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RedeemCodeDialog onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

beforeEach(() => {
  state.redeem.mockReset();
  state.toast.mockReset();
});

describe('RedeemCodeDialog', () => {
  it('12자를 다 채워야 적용할 수 있고, 입력은 대문자·하이픈으로 정리된다', () => {
    renderDialog();
    const input = screen.getByRole('textbox', { name: '리딤 코드 입력' });
    expect(screen.getByRole('button', { name: '적용' })).toBeDisabled();
    fireEvent.change(input, { target: { value: 'tripab12cd34' } });
    expect(input).toHaveValue('TRIP-AB12-CD34');
    expect(screen.getByRole('button', { name: '적용' })).toBeEnabled();
  });

  it('성공하면 추가된 횟수를 알리고 닫는다', async () => {
    state.redeem.mockResolvedValue({ ok: true, kind: 'trips', amount: 3, tripLimit: 5 });
    const onClose = renderDialog();
    fireEvent.change(screen.getByRole('textbox', { name: '리딤 코드 입력' }), { target: { value: 'TRIPAB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(state.redeem).toHaveBeenCalledWith('TRIP-AB12-CD34');
    expect(state.toast).toHaveBeenCalledWith('여행 3회가 추가됐어요.', { tone: 'success' });
  });

  it('프로 이용 중이면 사용할 수 없다고 안내하고 창은 그대로', async () => {
    state.redeem.mockResolvedValue({ ok: false, reason: 'pro_active' });
    const onClose = renderDialog();
    fireEvent.change(screen.getByRole('textbox', { name: '리딤 코드 입력' }), { target: { value: 'TRIPAB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('프로 이용 중에는 사용할 수 없어요');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('이미 쓴 코드·틀린 코드 안내', async () => {
    state.redeem.mockResolvedValueOnce({ ok: false, reason: 'used' }).mockResolvedValueOnce({ ok: false, reason: 'invalid' });
    renderDialog();
    fireEvent.change(screen.getByRole('textbox', { name: '리딤 코드 입력' }), { target: { value: 'TRIPAB12CD34' } });
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 사용된 코드예요.');
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('올바르지 않은 코드예요'));
  });
});
