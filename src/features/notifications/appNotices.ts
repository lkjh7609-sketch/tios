import { getSupabaseClient } from '@/shared/api/supabaseClient';

/** 서버가 만드는 여행·동행·공동 편집·운영 알림(0112 app_notifications) */
export type AppNoticeType =
  | 'trip_week'
  | 'trip_soon'
  | 'trip_today'
  | 'travel_alert'
  | 'companion_applied'
  | 'companion_accepted'
  | 'companion_rejected'
  | 'companion_matched'
  | 'companion_message'
  | 'companion_review'
  | 'ops_content_removed'
  | 'ops_report_result'
  | 'collab_joined'
  | 'collab_left'
  | 'collab_removed';

export interface AppNotice {
  kind: 'app';
  /** 종 목록의 키 — 다른 알림 id와 겹치지 않게 접두어를 붙인다 */
  id: string;
  rowId: string;
  type: AppNoticeType;
  tripId: string | null;
  companionPostId: string | null;
  /** 여행·글 제목(없을 수 있다) */
  title: string;
  name: string;
  count: number;
  level: number | null;
  countryCode: string | null;
  countryNameKo: string | null;
  /** 운영 조치 알림이 가리키는 글(댓글이 지워진 경우 그 글) */
  postId: string | null;
  target: string | null;
  result: string | null;
  createdAt: string;
  unread: boolean;
}

interface Row {
  id: string;
  kind: AppNoticeType;
  trip_id: string | null;
  companion_post_id: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
  read_at: string | null;
}

export const APP_ID_PREFIX = 'app:';

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function toAppNotice(row: Row): AppNotice {
  const d = row.data ?? {};
  return {
    kind: 'app',
    id: APP_ID_PREFIX + row.id,
    rowId: row.id,
    type: row.kind,
    tripId: row.trip_id,
    companionPostId: row.companion_post_id,
    title: str(d.title) ?? '',
    name: str(d.name) ?? '',
    count: num(d.count) ?? 1,
    level: num(d.level),
    countryCode: str(d.country),
    countryNameKo: str(d.country_ko),
    postId: str(d.post_id),
    target: str(d.target),
    result: str(d.result),
    createdAt: row.created_at,
    unread: row.read_at === null,
  };
}

/** 알림을 눌렀을 때 가는 앱 안 경로 */
export function appNoticePath(n: AppNotice): string {
  switch (n.type) {
    case 'collab_removed':
      return '/plan';
    case 'trip_week':
    case 'trip_soon':
    case 'trip_today':
    case 'travel_alert':
    case 'collab_joined':
    case 'collab_left':
      return n.tripId ? `/plan/${n.tripId}` : '/plan';
    case 'companion_message':
      return n.companionPostId ? `/community/companion/${n.companionPostId}/chat` : '/community';
    case 'ops_content_removed':
      if (n.postId) return `/community/post/${n.postId}`;
      return n.companionPostId ? `/community/companion/${n.companionPostId}` : '/community';
    case 'ops_report_result':
      return '/community';
    default:
      return n.companionPostId ? `/community/companion/${n.companionPostId}` : '/community';
  }
}

export async function listAppNotices(): Promise<AppNotice[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('app_notifications')
    .select('id, kind, trip_id, companion_post_id, data, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return ((data as Row[] | null) ?? []).map(toAppNotice);
}

export async function markAppNoticesRead(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('app_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function deleteAppNotice(rowId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('app_notifications').delete().eq('id', rowId);
  if (error) throw error;
}

/** 내 서버 알림(여행·동행·공동 편집·운영 조치)을 모두 지운다(RLS가 본인 것만 허용) */
export async function deleteAllAppNotices(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('app_notifications').delete().eq('user_id', userId);
  if (error) throw error;
}
