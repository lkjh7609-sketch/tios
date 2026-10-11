import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({
  user: { id: 'u1' } as { id: string } | null,
  profile: { gender: null, age_band: null } as unknown,
  mutateAsync: vi.fn(),
}));

vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: state.user }) }));
vi.mock('@/shared/hooks/useProfile', () => ({
  useProfile: () => ({ data: state.profile }),
  useUpdateProfile: () => ({ mutateAsync: state.mutateAsync, isPending: false }),
  profileQueryKey: (id: string) => ['profile', id],
}));
vi.mock('@/shared/a11y/useFocusTrap', () => ({ useFocusTrap: () => ({ current: null }) }));

import { DemographicsPrompt, shouldAskDemographics } from './DemographicsPrompt';

function renderPrompt() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DemographicsPrompt />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.user = { id: 'u1' };
  state.profile = { gender: null, age_band: null };
  state.mutateAsync.mockReset().mockResolvedValue(undefined);
});

describe('shouldAskDemographics', () => {
  it('둘 중 하나라도 비어 있으면 묻는다(필수 — 예전에 "나중에"를 눌렀어도 묻는다)', () => {
    expect(shouldAskDemographics({ gender: null, age_band: null })).toBe(true);
    expect(shouldAskDemographics({ gender: 'male', age_band: null })).toBe(true);
    expect(shouldAskDemographics({ gender: null, age_band: '40s' })).toBe(true);
    expect(shouldAskDemographics({ gender: 'male', age_band: '40s' })).toBe(false);
    expect(shouldAskDemographics(undefined)).toBe(false);
  });
});

describe('DemographicsPrompt', () => {
  it('이유를 밝히고, 고른 값을 저장한다', async () => {
    renderPrompt();
    expect(screen.getByText(/동행 모집글과 지원 화면/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: '20대 후반' }));
    fireEvent.click(screen.getByRole('radio', { name: '여성' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(state.mutateAsync).toHaveBeenCalledWith({ gender: 'female', age_band: '20s_late' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('필수라 "나중에"도 닫기 버튼도 없고, 둘 중 하나만 골라서는 저장할 수 없다', () => {
    renderPrompt();
    expect(screen.queryByRole('button', { name: '나중에' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '여성' }));
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: '30대 초반' }));
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('고른 칩을 다시 눌러도 선택이 풀리지 않는다(바꾸기만 가능)', () => {
    renderPrompt();
    const female = screen.getByRole('radio', { name: '여성' });
    fireEvent.click(female);
    fireEvent.click(female);
    expect(female).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByRole('radio', { name: '남성' }));
    expect(screen.getByRole('radio', { name: '남성' })).toHaveAttribute('aria-checked', 'true');
    expect(female).toHaveAttribute('aria-checked', 'false');
  });

  it('이미 입력했으면 뜨지 않는다', () => {
    state.profile = { gender: 'male', age_band: '30s_early' };
    renderPrompt();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
