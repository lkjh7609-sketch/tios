import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const push = vi.hoisted(() => ({
  permission: 'prompt' as 'prompt' | 'granted' | 'denied' | null,
  register: vi.fn().mockResolvedValue(true),
  mutate: vi.fn(),
  openSettings: vi.fn(),
}));
vi.mock('@/shared/platform', () => ({ isNativeApp: () => true }));
vi.mock('./registerPush', () => ({
  readPushPermission: () => Promise.resolve(push.permission),
  registerPushNotifications: (...args: unknown[]) => push.register(...args),
  openPushSettings: () => push.openSettings(),
}));
vi.mock('@/shared/hooks/useProfile', () => ({
  useProfile: () => ({ data: { notification_prefs: { trip: false, community: false, companion: false, collab: false, enabled: false } } }),
  useUpdateProfile: () => ({ mutate: push.mutate }),
}));

import { PushConsent } from './PushConsent';

beforeEach(() => {
  localStorage.clear();
  push.register.mockClear();
  push.register.mockResolvedValue(true);
  push.mutate.mockClear();
  push.openSettings.mockClear();
  push.permission = 'prompt';
});

describe('PushConsent', () => {
  it('처음 로그인한 계정이면 알림 동의 창(줄바꿈 문구 포함)을 띄운다', async () => {
    render(<PushConsent userId="u1" />);
    expect(await screen.findByRole('dialog', { name: '알림을 받을까요?' })).toBeInTheDocument();
    expect(screen.getByText(/여행 출발 전 알림을 받아볼 수 있어요\./)).toBeInTheDocument();
    expect(screen.getByText(/설정 > 알림 설정에서/)).toBeInTheDocument();
  });

  it('"받을게요": 이 계정의 알림 설정을 켜고 iOS 권한 요청(등록)으로 이어진다', async () => {
    render(<PushConsent userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: '받을게요' }));
    expect(push.mutate).toHaveBeenCalledWith({
      notification_prefs: expect.objectContaining({ enabled: true }),
    });
    expect(push.register).toHaveBeenCalledWith('u1');
    expect(localStorage.getItem('triptic-push-asked-u1')).toBe('1');
  });

  it('"받을게요"인데 iOS에서 이미 거부된 기기면 iPhone 설정으로 안내하는 창이 뜬다', async () => {
    push.permission = 'denied';
    push.register.mockResolvedValue(false);
    render(<PushConsent userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: '받을게요' }));
    expect(await screen.findByRole('dialog', { name: 'iPhone 설정에서 켜 주세요' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '설정 열기' }));
    expect(push.openSettings).toHaveBeenCalledTimes(1);
  });

  it('iOS 권한이 이미 정해진 기기(허용·거부)라도 새 계정에는 묻는다', async () => {
    push.permission = 'denied';
    render(<PushConsent userId="u9" />);
    expect(await screen.findByRole('dialog', { name: '알림을 받을까요?' })).toBeInTheDocument();
  });

  it('"나중에": 설정도 iOS 권한도 건드리지 않고, 같은 계정에는 다시 묻지 않는다', async () => {
    const { unmount } = render(<PushConsent userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: '나중에' }));
    expect(push.register).not.toHaveBeenCalled();
    expect(push.mutate).not.toHaveBeenCalled();
    unmount();
    render(<PushConsent userId="u1" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('이미 물어본 계정에서 허용된 기기는 묻지 않고 조용히 다시 등록한다', async () => {
    localStorage.setItem('triptic-push-asked-u2', '1');
    push.permission = 'granted';
    render(<PushConsent userId="u2" />);
    await waitFor(() => expect(push.register).toHaveBeenCalledWith('u2', { prompt: false }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('로그인 전에는 창을 띄우지 않는다', () => {
    render(<PushConsent userId={undefined} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
