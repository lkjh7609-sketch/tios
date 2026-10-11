/** 푸시 문구 — 받는 사람의 언어(profiles.locale)로. 글·댓글 내용은 잠금 화면에 보이지 않게 담지 않는다 */
export type PushLocale = 'ko' | 'en' | 'ja' | 'zh-TW';

export function normalizeLocale(value: string | null | undefined): PushLocale {
  if (!value) return 'ko';
  if (value.startsWith('ko')) return 'ko';
  if (value.startsWith('ja')) return 'ja';
  if (value.startsWith('zh')) return 'zh-TW';
  return 'en';
}

const COMMENT: Record<PushLocale, (name: string) => { title: string; body: string }> = {
  ko: (n) => ({ title: '새 댓글', body: `${n}님이 내 글에 댓글을 남겼어요` }),
  en: (n) => ({ title: 'New comment', body: `${n} commented on your post` }),
  ja: (n) => ({ title: '新しいコメント', body: `${n}さんがあなたの投稿にコメントしました` }),
  'zh-TW': (n) => ({ title: '新留言', body: `${n} 在你的貼文留言了` }),
};

const REPLY: Record<PushLocale, (name: string) => { title: string; body: string }> = {
  ko: (n) => ({ title: '새 답글', body: `${n}님이 내 댓글에 답글을 남겼어요` }),
  en: (n) => ({ title: 'New reply', body: `${n} replied to your comment` }),
  ja: (n) => ({ title: '新しい返信', body: `${n}さんがあなたのコメントに返信しました` }),
  'zh-TW': (n) => ({ title: '新回覆', body: `${n} 回覆了你的留言` }),
};

/** app_notifications.data — 서버(0112 트리거)가 담는 값. 아무 것도 보장하지 않으니 모두 선택으로 읽는다 */
export interface AppNotificationData {
  title?: string | null;
  name?: string | null;
  count?: number | null;
  level?: number | null;
  country_ko?: string | null;
  country_en?: string | null;
  days?: number | null;
  target?: string | null;
  result?: string | null;
}

export type AppNotificationKind =
  | 'trip_week' | 'trip_soon' | 'trip_today' | 'travel_alert'
  | 'companion_applied' | 'companion_accepted' | 'companion_rejected' | 'companion_matched' | 'companion_message' | 'companion_review'
  | 'ops_content_removed' | 'ops_report_result'
  | 'collab_joined' | 'collab_left' | 'collab_removed';

type Text = { title: string; body: string };
type Builder = (d: Required<Pick<AppNotificationData, 'title' | 'name'>> & AppNotificationData) => Text;

const APP: Record<PushLocale, Record<AppNotificationKind, Builder>> = {
  ko: {
    trip_week: (d) => ({ title: '여행이 얼마 안 남았어요', body: `${d.title} 출발까지 7일 남았어요` }),
    trip_soon: (d) => ({ title: '여행이 얼마 안 남았어요', body: `${d.title} 출발까지 3일! 짐 챙길 시간이에요` }),
    trip_today: (d) => ({ title: '오늘은 여행 당일이에요 ✈️', body: `${d.title} — 즐거운 여행이 되었으면 좋겠어요~` }),
    travel_alert: (d) => ({ title: '여행경보 안내', body: `${d.title}의 목적지 ${d.country_ko ?? ''}에 여행경보 ${d.level ?? ''}단계가 발령 중이에요` }),
    companion_applied: (d) => ({ title: '새 동행 신청', body: `${d.name}님이 동행을 신청했어요` }),
    companion_accepted: () => ({ title: '동행 신청이 수락됐어요', body: '함께 여행을 준비해 보세요' }),
    companion_rejected: () => ({ title: '동행 신청 결과', body: '아쉽게도 이번에는 함께하지 못하게 됐어요' }),
    companion_matched: () => ({ title: '동행이 확정됐어요', body: '대화방에서 일정을 맞춰 보세요' }),
    companion_message: (d) => ({ title: '새 동행 메시지', body: (d.count ?? 1) > 1 ? `새 메시지 ${d.count}개가 도착했어요` : `${d.name}님이 메시지를 보냈어요` }),
    companion_review: () => ({ title: '동행 후기를 남겨 주세요', body: '함께한 여행은 어땠나요?' }),
    ops_content_removed: (d) => ({ title: '운영 조치 안내', body: `내 ${d.target === 'comment' ? '댓글' : d.target === 'companion_post' ? '동행 글' : '글'}이 운영 정책에 따라 숨김 처리됐어요` }),
    ops_report_result: (d) => ({ title: '신고 처리 결과', body: d.result === 'actioned' ? '신고하신 내용을 확인해 조치했어요' : '신고하신 내용을 검토했고, 조치할 사항은 없었어요' }),
    collab_joined: (d) => ({ title: '공동 편집 참여', body: `${d.name}님이 ${d.title} 여행에 참여했어요` }),
    collab_left: (d) => ({ title: '공동 편집 나감', body: `${d.name}님이 ${d.title} 여행에서 나갔어요` }),
    collab_removed: (d) => ({ title: '공동 편집에서 제외됐어요', body: `${d.title} 여행에서 제외됐어요` }),
  },
  en: {
    trip_week: (d) => ({ title: 'Your trip is coming up', body: `${d.title} — 7 days to go` }),
    trip_soon: (d) => ({ title: 'Your trip is coming up', body: `${d.title} — 3 days to go! Time to pack` }),
    trip_today: (d) => ({ title: "It's trip day! ✈️", body: `${d.title} — have a wonderful trip!` }),
    travel_alert: (d) => ({ title: 'Travel advisory', body: `A level ${d.level ?? ''} advisory is in effect for ${d.country_en ?? 'your destination'} (${d.title})` }),
    companion_applied: (d) => ({ title: 'New companion request', body: `${d.name} wants to join you` }),
    companion_accepted: () => ({ title: 'Request accepted', body: 'Start planning the trip together' }),
    companion_rejected: () => ({ title: 'Companion request update', body: "Unfortunately, it won't work out this time" }),
    companion_matched: () => ({ title: "You're matched!", body: 'Head to the chat to line up plans' }),
    companion_message: (d) => ({ title: 'New companion message', body: (d.count ?? 1) > 1 ? `${d.count} new messages` : `${d.name} sent a message` }),
    companion_review: () => ({ title: 'Leave a review', body: 'How was the trip together?' }),
    ops_content_removed: (d) => ({ title: 'Moderation notice', body: `Your ${d.target === 'comment' ? 'comment' : d.target === 'companion_post' ? 'companion post' : 'post'} was hidden under our policies` }),
    ops_report_result: (d) => ({ title: 'Report update', body: d.result === 'actioned' ? 'We reviewed your report and took action' : 'We reviewed your report; no action was needed' }),
    collab_joined: (d) => ({ title: 'Joined your trip', body: `${d.name} joined ${d.title}` }),
    collab_left: (d) => ({ title: 'Left your trip', body: `${d.name} left ${d.title}` }),
    collab_removed: (d) => ({ title: 'Removed from a trip', body: `You were removed from ${d.title}` }),
  },
  ja: {
    trip_week: (d) => ({ title: '旅行まであと少し', body: `${d.title} — 出発まであと7日です` }),
    trip_soon: (d) => ({ title: '旅行まであと少し', body: `${d.title} — 出発まであと3日！荷造りの時間です` }),
    trip_today: (d) => ({ title: '今日は旅行当日です ✈️', body: `${d.title} — 素敵な旅になりますように` }),
    travel_alert: (d) => ({ title: '渡航情報', body: `${d.title}の目的地に危険情報(レベル${d.level ?? ''})が出ています` }),
    companion_applied: (d) => ({ title: '新しい同行の申請', body: `${d.name}さんが同行を申請しました` }),
    companion_accepted: () => ({ title: '同行申請が承認されました', body: '一緒に旅の準備を始めましょう' }),
    companion_rejected: () => ({ title: '同行申請の結果', body: '今回は見送りとなりました' }),
    companion_matched: () => ({ title: '同行が確定しました', body: 'チャットで予定を合わせましょう' }),
    companion_message: (d) => ({ title: '新しい同行メッセージ', body: (d.count ?? 1) > 1 ? `新着メッセージ${d.count}件` : `${d.name}さんからメッセージが届きました` }),
    companion_review: () => ({ title: 'レビューをお願いします', body: '一緒の旅はいかがでしたか？' }),
    ops_content_removed: (d) => ({ title: '運営からのお知らせ', body: `あなたの${d.target === 'comment' ? 'コメント' : d.target === 'companion_post' ? '同行募集' : '投稿'}は運営ポリシーにより非表示になりました` }),
    ops_report_result: (d) => ({ title: '通報の結果', body: d.result === 'actioned' ? '通報内容を確認し、対応しました' : '通報内容を確認しましたが、対応は不要でした' }),
    collab_joined: (d) => ({ title: '共同編集に参加', body: `${d.name}さんが${d.title}に参加しました` }),
    collab_left: (d) => ({ title: '共同編集から退出', body: `${d.name}さんが${d.title}から退出しました` }),
    collab_removed: (d) => ({ title: '共同編集から外されました', body: `${d.title}から外されました` }),
  },
  'zh-TW': {
    trip_week: (d) => ({ title: '旅行快到囉', body: `${d.title} — 距離出發還有 7 天` }),
    trip_soon: (d) => ({ title: '旅行快到囉', body: `${d.title} — 還有 3 天！該打包了` }),
    trip_today: (d) => ({ title: '今天就是出發日 ✈️', body: `${d.title} — 祝你旅途愉快～` }),
    travel_alert: (d) => ({ title: '旅遊警示', body: `${d.title} 的目的地目前有第 ${d.level ?? ''} 級旅遊警示` }),
    companion_applied: (d) => ({ title: '新的同行申請', body: `${d.name} 申請與你同行` }),
    companion_accepted: () => ({ title: '同行申請已通過', body: '一起開始準備旅行吧' }),
    companion_rejected: () => ({ title: '同行申請結果', body: '很可惜，這次無法同行' }),
    companion_matched: () => ({ title: '同行已確認', body: '到聊天室對一下行程吧' }),
    companion_message: (d) => ({ title: '新的同行訊息', body: (d.count ?? 1) > 1 ? `有 ${d.count} 則新訊息` : `${d.name} 傳來訊息` }),
    companion_review: () => ({ title: '留下同行評價', body: '一起旅行的感覺如何？' }),
    ops_content_removed: (d) => ({ title: '營運通知', body: `你的${d.target === 'comment' ? '留言' : d.target === 'companion_post' ? '同行貼文' : '貼文'}依營運政策已被隱藏` }),
    ops_report_result: (d) => ({ title: '檢舉處理結果', body: d.result === 'actioned' ? '我們已確認你的檢舉並採取處理' : '我們已審查你的檢舉，無需處理' }),
    collab_joined: (d) => ({ title: '加入共同編輯', body: `${d.name} 加入了 ${d.title}` }),
    collab_left: (d) => ({ title: '離開共同編輯', body: `${d.name} 離開了 ${d.title}` }),
    collab_removed: (d) => ({ title: '已被移出共同編輯', body: `你已被移出 ${d.title}` }),
  },
};

export function commentMessage(locale: PushLocale, actorName: string) {
  return COMMENT[locale](actorName);
}
export function replyMessage(locale: PushLocale, actorName: string) {
  return REPLY[locale](actorName);
}

/** app_notifications 한 줄 → 푸시 문구. 모르는 종류면 null(보내지 않는다) */
export function appNotificationMessage(locale: PushLocale, kind: string, data: AppNotificationData | null): Text | null {
  const build = (APP[locale] as Record<string, Builder>)[kind];
  if (!build) return null;
  const d = data ?? {};
  const fallbackName = locale === 'ko' ? '누군가' : locale === 'ja' ? '誰か' : locale === 'zh-TW' ? '有人' : 'Someone';
  const fallbackTitle = locale === 'ko' ? '내 여행' : locale === 'ja' ? 'マイトリップ' : locale === 'zh-TW' ? '我的旅行' : 'your trip';
  return build({ ...d, title: d.title?.trim() || fallbackTitle, name: d.name?.trim() || fallbackName });
}

/** 알림을 눌렀을 때 열 앱 안 경로 */
export function appNotificationPath(kind: string, row: { trip_id: string | null; companion_post_id: string | null }, data: AppNotificationData & { post_id?: string | null } | null): string | undefined {
  if (kind.startsWith('trip_') || kind === 'travel_alert' || kind.startsWith('collab_')) return kind === 'collab_removed' || !row.trip_id ? '/plan' : `/plan/${row.trip_id}`;
  if (kind === 'companion_message') return row.companion_post_id ? `/community/companion/${row.companion_post_id}/chat` : undefined;
  if (kind.startsWith('companion_')) return row.companion_post_id ? `/community/companion/${row.companion_post_id}` : undefined;
  if (kind === 'ops_content_removed') return data?.post_id ? `/community/post/${data.post_id}` : row.companion_post_id ? `/community/companion/${row.companion_post_id}` : '/community';
  return '/settings';
}
