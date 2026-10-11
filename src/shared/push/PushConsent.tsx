import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { isNativeApp } from '@/shared/platform';
import { readPushPermission, registerPushNotifications } from './registerPush';

function askedKey(userId: string) {
  return `triptic-push-asked-${userId}`;
}

function wasAsked(userId: string): boolean {
  try {
    return localStorage.getItem(askedKey(userId)) === '1';
  } catch {
    return false;
  }
}

function markAsked(userId: string) {
  try {
    localStorage.setItem(askedKey(userId), '1');
  } catch {
    // 저장소를 못 쓰면 다음 실행에 다시 묻는다
  }
}

/**
 * 앱(iOS)에서 로그인한 계정에 처음 한 번, 알림을 받을지 우리 창으로 먼저 묻는다. "받을게요"를 누르면 iOS 권한 창이 이어서 뜬다.
 * 이미 허용/거부한 기기·이미 물어본 계정은 묻지 않고, 허용된 기기는 조용히 다시 등록한다(토큰이 바뀔 수 있어서). 웹에서는 아무것도 하지 않는다.
 * 설정 → 알림 설정에서 언제든 다시 켤 수 있다.
 */
export function PushConsent({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation('common');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId || !isNativeApp()) return;
    let cancelled = false;
    void (async () => {
      const permission = await readPushPermission();
      if (cancelled || permission === null) return;
      if (permission === 'granted') {
        markAsked(userId);
        void registerPushNotifications(userId, { prompt: false });
      } else if (permission === 'denied') {
        markAsked(userId); // iOS 설정에서만 바꿀 수 있어 우리 창으로 다시 묻지 않는다
      } else if (!wasAsked(userId)) {
        setOpen(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!open || !userId) return null;
  return (
    <ConfirmDialog
      title={t('push.consent.title')}
      message={t('push.consent.message')}
      cancelLabel={t('push.consent.later')}
      confirmLabel={t('push.consent.allow')}
      onClose={() => {
        markAsked(userId);
        setOpen(false);
      }}
      onConfirm={() => void registerPushNotifications(userId)}
    />
  );
}
