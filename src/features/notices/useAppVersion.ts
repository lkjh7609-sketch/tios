import { useEffect, useState } from 'react';
import { isNativeApp } from '@/shared/platform';
import { useAnnouncements } from './useAnnouncements';
import type { Announcement } from './noticeService';

/** 업데이트 공지가 아직 없을 때(웹) 설정 화면에 보이는 버전 */
export const FALLBACK_APP_VERSION = '1.0.0';

/**
 * 가장 최근에 게시한 '업데이트' 공지의 버전. 공지(notice) 종류는 버전을 적어도 보지 않고,
 * 버전이 비어 있는 업데이트도 건너뛴다. 없으면 null.
 */
export function latestUpdateVersion(list: Announcement[] | undefined): string | null {
  const updates = (list ?? []).filter((a) => a.kind === 'update' && a.published && a.version?.trim());
  if (updates.length === 0) return null;
  updates.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
  return updates[0].version!.trim();
}

/** iOS 앱이면 설치된 앱의 실제 버전(App Store·TestFlight의 버전과 같다). 웹이거나 못 읽으면 null */
function useNativeAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    void import('@capacitor/app')
      .then(({ App }) => App.getInfo())
      .then((info) => {
        if (!cancelled && info.version) setVersion(info.version);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return version;
}

/**
 * 설정 화면의 '버전' — 앱에서는 설치된 앱의 버전, 웹에서는 관리자가 업데이트 공지에 입력한 가장 최근 버전(없으면 기본값).
 * 웹과 같은 공지를 읽는 앱이 웹의 버전 번호를 보여 주지 않게 앱은 항상 자기 버전을 쓴다
 */
export function useAppVersion(): string {
  const { data } = useAnnouncements();
  const native = useNativeAppVersion();
  return native ?? latestUpdateVersion(data) ?? FALLBACK_APP_VERSION;
}
