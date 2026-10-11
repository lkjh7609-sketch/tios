import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const svc = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  disable: vi.fn(),
}));
vi.mock('./adminService', () => ({
  ADMIN_REDEEM_CODES_KEY: ['admin', 'redeemCodes'],
  adminCreateRedeemCodes: (i: unknown) => svc.create(i),
  adminListRedeemCodes: () => svc.list(),
  adminDisableRedeemCode: (id: string) => svc.disable(id),
}));
vi.mock('@/shared/ui/toast', () => ({ showToast: vi.fn() }));
vi.mock('@/shared/a11y/useFocusTrap', () => ({ useFocusTrap: () => ({ current: null }) }));

import { AdminRedeemTab } from './AdminRedeemTab';

const rows = [
  { id: 'a', code: 'TRIP-AAAA-1111', kind: 'trips', amount: 3, note: '김OO', expires_at: null, created_at: '2026-10-11T00:00:00Z', redeemed_at: null, redeemed_by_name: null, disabled_at: null },
  { id: 'b', code: 'TRIP-BBBB-2222', kind: 'trips', amount: 3, note: null, expires_at: null, created_at: '2026-10-10T00:00:00Z', redeemed_at: '2026-10-10T05:00:00Z', redeemed_by_name: '홍길동', disabled_at: null },
];

function renderTab() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AdminRedeemTab />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  svc.create.mockReset().mockResolvedValue(['TRIP-NEW1-CODE']);
  svc.list.mockReset().mockResolvedValue(rows);
  svc.disable.mockReset().mockResolvedValue(undefined);
});

describe('AdminRedeemTab', () => {
  it('발급한 코드 목록에 상태·사용자가 보이고, 쓴 코드에는 취소 버튼이 없다', async () => {
    renderTab();
    expect(await screen.findByText('TRIP-AAAA-1111')).toBeInTheDocument();
    expect(screen.getByText('미사용')).toBeInTheDocument();
    expect(screen.getByText('사용됨')).toBeInTheDocument();
    expect(screen.getByText('홍길동님이 사용')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '취소' })).toHaveLength(1);
  });

  it('수량·개수를 정해 코드를 만들고 만든 코드를 보여 준다', async () => {
    renderTab();
    await screen.findByText('TRIP-AAAA-1111');
    fireEvent.change(screen.getByLabelText('추가 횟수'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/메모/), { target: { value: '테스트' } });
    fireEvent.click(screen.getByRole('button', { name: '만들기' }));
    await waitFor(() => expect(svc.create).toHaveBeenCalledWith({ amount: 5, count: 1, expiresAt: null, note: '테스트' }));
    expect(await screen.findByText('TRIP-NEW1-CODE')).toBeInTheDocument();
  });

  it('범위를 벗어난 수량이면 만들 수 없다', async () => {
    renderTab();
    await screen.findByText('TRIP-AAAA-1111');
    fireEvent.change(screen.getByLabelText('추가 횟수'), { target: { value: '0' } });
    expect(screen.getByRole('button', { name: '만들기' })).toBeDisabled();
  });

  it('안 쓴 코드를 취소하면 확인 뒤 서버에 알린다', async () => {
    renderTab();
    await screen.findByText('TRIP-AAAA-1111');
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(svc.disable).toHaveBeenCalledWith('a'));
  });
});
