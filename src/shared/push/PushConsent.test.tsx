import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/shared/i18n';

const push = vi.hoisted(() => ({ permission: 'prompt' as 'prompt' | 'granted' | 'denied' | null, register: vi.fn().mockResolvedValue(true) }));
vi.mock('@/shared/platform', () => ({ isNativeApp: () => true }));
vi.mock('./registerPush', () => ({
  readPushPermission: () => Promise.resolve(push.permission),
  registerPushNotifications: (...args: unknown[]) => push.register(...args),
}));

import { PushConsent } from './PushConsent';

beforeEach(() => {
  localStorage.clear();
  push.register.mockClear();
  push.permission = 'prompt';
});

describe('PushConsent', () => {
  it('아직 안 물어본 계정이면 알림 동의 창을 띄우고, "받을게요"를 누르면 iOS 권한 요청(등록)으로 이어진다', async () => {
    render(<PushConsent userId="u1" />);
    expect(await screen.findByRole('dialog', { name: '알림을 받을까요?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '받을게요' }));
    expect(push.register).toHaveBeenCalledWith('u1');
    expect(localStorage.getItem('triptic-push-asked-u1')).toBe('1');
  });

  it('"나중에"를 누르면 iOS 권한을 요청하지 않고, 같은 계정에는 다시 묻지 않는다', async () => {
    const { unmount } = render(<PushConsent userId="u1" />);
    fireEvent.click(await screen.findByRole('button', { name: '나중에' }));
    expect(push.register).not.toHaveBeenCalled();
    unmount();
    render(<PushConsent userId="u1" />);
    await waitFor(() => expect(push.register).not.toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('이미 허용된 기기는 묻지 않고 조용히 다시 등록한다', async () => {
    push.permission = 'granted';
    render(<PushConsent userId="u2" />);
    await waitFor(() => expect(push.register).toHaveBeenCalledWith('u2', { prompt: false }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('로그인 전이거나 거부된 기기에서는 창을 띄우지 않는다', async () => {
    const { rerender } = render(<PushConsent userId={undefined} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    push.permission = 'denied';
    rerender(<PushConsent userId="u3" />);
    await waitFor(() => expect(localStorage.getItem('triptic-push-asked-u3')).toBe('1'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
