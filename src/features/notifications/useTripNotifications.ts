import { useMemo, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { useSession } from '@/shared/hooks/useSession';
import {
  dismissNotification,
  markNotificationsRead,
  readNotificationState,
  subscribeNotifications,
} from './notificationStore';
import { useAnnouncements } from '@/features/notices/useAnnouncements';
import { APP_ID_PREFIX, deleteAppNotice, listAppNotices, markAppNoticesRead, type AppNotice } from './appNotices';
import {
  COMMUNITY_ID_PREFIX,
  deleteCommunityNotice,
  listCommunityNotices,
  markCommunityNoticesRead,
  type CommunityNotice,
} from './communityNotices';

/** 운영자가 올린 공지·업데이트(0088) — 읽음·지움은 이 기기에 기록한다 */
export interface AnnouncementNotice {
  kind: 'announcement';
  id: string;
  announcementId: string;
  title: string;
  noticeKind: 'notice' | 'update';
  version: string | null;
  unread: boolean;
}

export type TripNotification = AppNotice | CommunityNotice | AnnouncementNotice;

/** 종 알림에 올리는 공지는 최근 한 달 안의 것만, 최대 5개 */
const ANNOUNCEMENT_DAYS = 30;
const ANNOUNCEMENT_MAX = 5;

const communityKey = (userId: string | null) => ['notifications', 'community', userId ?? ''] as const;

const appKey = (userId: string | null) => ['notifications', 'app', userId ?? ''] as const;

const today = () => format(new Date(), 'yyyy-MM-dd');

/**
 * 종 모양 알림 — 서버가 만든 알림을 1분마다·창에 돌아올 때 다시 읽는다: 내 글·댓글에 달린 댓글·답글·좋아요(0087),
 * 내 여행의 출발 임박·여행경보, 동행·공동 편집·운영 조치(0112). 읽음·지움은 서버에 기록한다(기기가 바뀌어도 같다).
 * 운영자 공지는 이 기기에만 읽음을 기록한다. 로그인하지 않았으면 비어 있다
 */
export function useTripNotifications() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  // 앱을 켜 둔 채 날짜가 바뀌어도 공지 기간(30일)이 맞게 — 창에 돌아올 때 오늘을 다시 읽는다
  const [todayYmd] = useState(today);

  const queryClient = useQueryClient();
  const { data: community } = useQuery({
    queryKey: communityKey(userId),
    queryFn: listCommunityNotices,
    enabled: !!userId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: app } = useQuery({
    queryKey: appKey(userId),
    queryFn: listAppNotices,
    enabled: !!userId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const { data: announcements } = useAnnouncements(!!userId);
  const markAppRead = useMutation({
    mutationFn: () => markAppNoticesRead(userId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appKey(userId) }),
  });
  const deleteApp = useMutation({
    mutationFn: (rowId: string) => deleteAppNotice(rowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appKey(userId) }),
  });
  const markCommunityRead = useMutation({
    mutationFn: () => markCommunityNoticesRead(userId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communityKey(userId) }),
  });
  const deleteCommunity = useMutation({
    mutationFn: (rowId: string) => deleteCommunityNotice(rowId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: communityKey(userId) }),
  });

  const state = useSyncExternalStore(
    subscribeNotifications,
    () => (userId ? readNotificationState(userId) : null),
    () => null,
  );

  const items = useMemo<TripNotification[]>(() => {
    if (!userId || !state) return [];
    // 렌더 중에 Date.now()를 부르지 않도록 이미 있는 todayYmd 상태에서 기준일을 뽑는다
    const sinceYmd = format(subDays(new Date(`${todayYmd}T00:00:00`), ANNOUNCEMENT_DAYS), 'yyyy-MM-dd');
    const notices: AnnouncementNotice[] = (announcements ?? [])
      .filter((a) => a.published_at.slice(0, 10) >= sinceYmd)
      .slice(0, ANNOUNCEMENT_MAX)
      .map((a) => ({
        kind: 'announcement' as const,
        id: `announcement:${a.id}`,
        announcementId: a.id,
        title: a.title,
        noticeKind: a.kind,
        version: a.version,
        unread: false,
      }))
      .filter((n) => !state.dismissed.includes(n.id))
      .map((n) => ({ ...n, unread: !state.read.includes(n.id) }));
    // 서버가 만든 알림은 새것부터, 그 아래에 운영자 공지
    const server = [...(community ?? []), ...(app ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return [...server, ...notices];
  }, [userId, state, todayYmd, community, app, announcements]);

  return {
    signedIn: !!userId,
    items,
    unreadCount: items.filter((i) => i.unread).length,
    markAllRead: () => {
      if (!userId) return;
      markNotificationsRead(
        userId,
        items.filter((i) => i.kind === 'announcement').map((i) => i.id),
      );
      if (items.some((i) => i.kind === 'community' && i.unread)) markCommunityRead.mutate();
      if (items.some((i) => i.kind === 'app' && i.unread)) markAppRead.mutate();
    },
    dismiss: (id: string) => {
      if (!userId) return;
      if (id.startsWith(COMMUNITY_ID_PREFIX)) deleteCommunity.mutate(id.slice(COMMUNITY_ID_PREFIX.length));
      else if (id.startsWith(APP_ID_PREFIX)) deleteApp.mutate(id.slice(APP_ID_PREFIX.length));
      else dismissNotification(userId, id);
    },
  };
}
