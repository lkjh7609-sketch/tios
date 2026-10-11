import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { showToast } from '@/shared/ui/toast';
import { isNativeApp } from '@/shared/platform';
import { useProfile, useUpdateProfile } from '@/shared/hooks/useProfile';
import { withNotificationsEnabled } from '@/shared/api/profileService';
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
 * 앱(iOS)에서 계정마다 처음 한 번(가입·첫 로그인), 알림을 받을지 우리 창으로 먼저 묻는다 — iOS 권한이 이미 정해진 기기라도
 * (예전 빌드에서 허용/거부했어도) 새 계정에는 묻는다. "받을게요"를 누르면 이 계정의 알림 설정을 켜고 iOS 권한 창으로 이어진다
 * (iOS에서 막혀 있으면 설정에서 허용하라고 안내). "나중에"는 아무것도 바꾸지 않는다.
 * 이미 물어본 계정에서 허용된 기기는 조용히 다시 등록한다(토큰이 바뀔 수 있어서). 웹에서는 아무것도 하지 않는다.
 * 언제든 설정 → 알림 설정 맨 위 "알림 허용"에서 바꿀 수 있다.
 */
export function PushConsent({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation('common');
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId || !isNativeApp()) return;
    if (!wasAsked(userId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 로그인 직후 한 번 띄우는 창
      setOpen(true);
      return;
    }
    let cancelled = false;
    void readPushPermission().then((permission) => {
      if (!cancelled && permission === 'granted') void registerPushNotifications(userId, { prompt: false });
    });
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
      onConfirm={() => {
        if (profile) updateProfile.mutate({ notification_prefs: withNotificationsEnabled(profile.notification_prefs, true) });
        void registerPushNotifications(userId).then((ok) => {
          if (!ok) showToast(t('push.consent.osDenied'));
        });
      }}
    />
  );
}
