import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const state = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue(undefined),
  mutate: vi.fn(),
  admin: false,
  profile: { id: 'u1', display_name: '관리자', handle: 'dfxrj', plan: 'pro', locale: 'ko', temp_unit: 'c', distance_unit: 'km', base_currency: 'KRW', notification_prefs: { trip: true, community: true, companion: true, collab: true }, avatar_url: null } as Record<string, unknown>,
}));

vi.mock('@/shared/hooks/useSession', () => ({ useSession: () => ({ user: { id: 'u1', email: 'a@b.c', user_metadata: {} }, loading: false }) }));
vi.mock('@/shared/hooks/useProfile', () => ({ useProfile: () => ({ data: state.profile }), useUpdateProfile: () => ({ mutate: state.mutate, mutateAsync: vi.fn(), isPending: false }) }));
vi.mock('@/shared/hooks/useMediaQuery', () => ({ useMediaQuery: () => false }));
vi.mock('@/features/plan/hooks/useTrips', () => ({ useTrips: () => ({ data: [], refetch: vi.fn() }) }));
vi.mock('@/features/plan/BackupModal', () => ({ BackupModal: () => null }));
vi.mock('@/features/community/hooks/usePostMeta', () => ({ useIsAdminViewer: () => ({ data: state.admin }) }));
vi.mock('./EditProfileModal', () => ({ EditProfileModal: () => <p>내 정보 변경 창</p> }));
vi.mock('./BlockedUsersList', () => ({ BlockedUsersList: () => <p>차단한 사용자가 없어요.</p> }));
vi.mock('@/features/notices/useAppVersion', () => ({ useAppVersion: () => '1.1.0' }));
vi.mock('@/shared/push/registerPush', () => ({ registerPushNotifications: vi.fn().mockResolvedValue(true) }));
vi.mock('@/shared/api/authService', () => ({ signOut: state.signOut, signInProviderOf: () => 'kakao' }));

import { SettingsScreen } from './SettingsScreen';

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings/:section?" element={<SettingsScreen />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  state.signOut.mockClear();
  state.mutate.mockClear();
  state.admin = false;
});

describe('SettingsScreen (모바일)', () => {
  it('처음엔 상위 메뉴만 보이고 세부 설정은 펼쳐 놓지 않는다', () => {
    renderAt('/settings');
    expect(screen.getByRole('link', { name: '알림 설정' })).toHaveAttribute('href', '/settings/notifications');
    expect(screen.getByRole('link', { name: '데이터 및 저장공간' })).toHaveAttribute('href', '/settings/data');
    expect(screen.getByRole('link', { name: '앱 정보' })).toHaveAttribute('href', '/settings/about');
    expect(screen.queryByText('출발 전 리마인더')).not.toBeInTheDocument();
    expect(screen.queryByText('오프라인 캐시')).not.toBeInTheDocument();
  });

  it('상위 메뉴를 누르면(경로 /settings/알림) 그 메뉴의 세부 설정만 보이고 뒤로 링크가 있다', () => {
    renderAt('/settings/notifications');
    expect(screen.getByRole('heading', { name: '알림 설정' })).toBeInTheDocument();
    expect(screen.getByText('내 여행 알림')).toBeInTheDocument();
    expect(screen.queryByText('오프라인 캐시')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '뒤로' })).toHaveAttribute('href', '/settings');
  });

  it('모르는 경로 조각이면 상위 메뉴로 돌아온다', () => {
    renderAt('/settings/nope');
    expect(screen.getByRole('link', { name: '앱 정보' })).toBeInTheDocument();
  });

  it('프로필 영역을 누르면 내 정보 변경 창이 뜬다', () => {
    renderAt('/settings');
    expect(screen.getByText('@dfxrj')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '내 정보 변경' }));
    expect(screen.getByText('내 정보 변경 창')).toBeInTheDocument();
  });

  it('알림 설정 맨 위에 "알림 허용" 토글이 있고, 끄면 전체 허용만 꺼지고 묶음 설정은 그대로다', () => {
    renderAt('/settings/notifications');
    const master = screen.getByRole('checkbox', { name: '알림 허용' });
    expect(master).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '내 여행 알림' })).toBeEnabled();
    fireEvent.click(master);
    expect(state.mutate).toHaveBeenCalledWith({
      notification_prefs: expect.objectContaining({ enabled: false, trip: true, community: true }),
    });
  });

  it('알림 허용이 꺼져 있으면 세부 알림은 눌러지지 않는다', () => {
    const original = state.profile;
    state.profile = { ...state.profile, notification_prefs: { trip: false, community: false, companion: false, collab: false, enabled: false } };
    renderAt('/settings/notifications');
    state.profile = original;
    expect(screen.getByRole('checkbox', { name: '알림 허용' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '내 여행 알림' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '커뮤니티 알림' })).toBeDisabled();
  });

  it('운영 콘솔 줄은 운영자에게만 보이고 /admin으로 간다(앱에는 주소창이 없어서)', () => {
    renderAt('/settings');
    expect(screen.queryByRole('link', { name: '운영 콘솔' })).not.toBeInTheDocument();
  });

  it('운영자 계정이면 앱 정보 아래·로그아웃 위에 운영 콘솔 줄이 있다', () => {
    state.admin = true;
    renderAt('/settings');
    expect(screen.getByRole('link', { name: '운영 콘솔' })).toHaveAttribute('href', '/admin');
  });

  it('로그아웃과 계정 삭제는 앱 정보 아래에 메뉴와 같은 줄로 있다', () => {
    renderAt('/settings');
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(state.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '계정 삭제' })).toBeInTheDocument();
  });
});
