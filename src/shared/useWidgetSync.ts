import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/shared/hooks/useSession';
import { isNativeApp } from '@/shared/platform';
import { clearNativeTrips, syncTripsToNative } from './widgetSync';

const DEBOUNCE_MS = 2000;

/**
 * 앱(iOS)에서만: 로그인한 동안 일정이 바뀔 때마다(여행 목록·여행 상세 쿼리가 갱신될 때) · 앱을 다시 열 때 · 언어를 바꿀 때
 * 위젯·애플워치로 오늘 일정을 다시 보낸다. 로그아웃하면 지운다. 웹에서는 아무것도 하지 않는다.
 */
export function useWidgetSync(): void {
  const { user, loading } = useSession();
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;
  const lang = i18n.language;

  useEffect(() => {
    if (!isNativeApp()) return;
    if (!userId) {
      // 로그인 상태를 아직 확인하는 중에는 지우지 않는다(위젯이 잠깐 비는 것을 막는다)
      if (!loading) void clearNativeTrips();
      return;
    }
    let timer: number | undefined;
    const run = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void syncTripsToNative(lang), DEBOUNCE_MS);
    };
    run();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey[0];
      if ((key === 'trips' || key === 'trip') && event.type === 'updated' && event.action.type === 'success') run();
    });
    let removeResume: (() => void) | undefined;
    void import('@capacitor/app').then(async ({ App }) => {
      const handle = await App.addListener('appStateChange', (state) => {
        if (state.isActive) run();
      });
      removeResume = () => void handle.remove();
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe();
      removeResume?.();
    };
  }, [userId, loading, lang, queryClient]);
}
