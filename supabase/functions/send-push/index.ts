/**
 * Supabase Edge Function: send-push — iOS 푸시 알림(APNs)
 *
 * 받는 사람·문구는 절대 호출자에게서 받지 않는다(아무나 푸시를 보내는 중계기가 되지 않게). 서버 안에서만 부른다: x-purge-secret(= PURGE_SECRET)이 맞아야 한다.
 *  - { kind: 'notification', notification_id }      DB 트리거(0112)가 커뮤니티 알림(내 글에 댓글·내 댓글에 답글)이 만들어질 때 부른다. 좋아요는 푸시하지 않는다.
 *  - { kind: 'app_notification', notification_id }  DB 트리거(0112)가 app_notifications(출발 임박·여행경보·동행·공동 편집·운영 조치) 한 줄이 생기면 부른다.
 *    받을지 말지(설정 묶음·전체 허용·차단)는 알림을 만들 때 이미 걸러졌다 — 여기서는 iOS 기기가 있으면 보낸다.
 * 토큰은 push_tokens(0024)의 iOS 기기들. APNs가 '더는 쓸 수 없는 토큰'이라고 하면 그 토큰을 지운다.
 *
 * 배포: `supabase functions deploy send-push --no-verify-jwt`(인증을 코드 안에서 한다).
 * 비밀값: APNS_KEY(AuthKey_XXXX.p8 파일 내용 전체), APNS_KEY_ID, APNS_TEAM_ID, APNS_TOPIC(앱 번들 ID, 기본 com.triptic.travel),
 *         APNS_ENV(기본 production — 개발용 빌드로 시험할 때만 sandbox), PURGE_SECRET. 하나라도 없으면 503으로 아무것도 보내지 않는다.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { secretMatches } from '../purge-archive/paths.ts';
import { apnsHost, buildPayload, classifyApnsResponse, importApnsKey, signProviderToken, type PushMessage } from './apns.ts';
import { appNotificationMessage, appNotificationPath, commentMessage, normalizeLocale, replyMessage, type AppNotificationData } from './messages.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Sender {
  send(tokens: string[], message: PushMessage, admin: SupabaseClient, userId: string): Promise<{ sent: number; removed: number; retry: number; failed: number }>;
}

/** 서명 키·공급자 토큰은 한 번만 만든다 */
async function makeSender(): Promise<Sender | null> {
  const pem = Deno.env.get('APNS_KEY');
  const keyId = Deno.env.get('APNS_KEY_ID');
  const teamId = Deno.env.get('APNS_TEAM_ID');
  if (!pem || !keyId || !teamId) return null;
  const topic = Deno.env.get('APNS_TOPIC') || 'com.triptic.travel';
  const host = apnsHost(Deno.env.get('APNS_ENV'));
  const key = await importApnsKey(pem.replace(/\\n/g, '\n'));
  const jwt = await signProviderToken(key, keyId, teamId, Math.floor(Date.now() / 1000));
  return {
    async send(tokens, message, admin, userId) {
      const result = { sent: 0, removed: 0, retry: 0, failed: 0 };
      const body = buildPayload(message);
      for (const token of tokens) {
        try {
          const res = await fetch(`${host}/3/device/${token}`, {
            method: 'POST',
            headers: { authorization: `bearer ${jwt}`, 'apns-topic': topic, 'apns-push-type': 'alert', 'apns-priority': '10', 'content-type': 'application/json' },
            body,
          });
          let reason: string | undefined;
          if (!res.ok) reason = ((await res.json().catch(() => null)) as { reason?: string } | null)?.reason;
          const outcome = classifyApnsResponse(res.status, reason);
          if (outcome === 'sent') result.sent++;
          else if (outcome === 'remove-token') {
            result.removed++;
            await admin.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
          } else if (outcome === 'retry-later') result.retry++;
          else {
            result.failed++;
            console.warn('[send-push] apns failed', res.status, reason);
          }
        } catch (e) {
          result.failed++;
          console.warn('[send-push] apns request error', e instanceof Error ? e.message : e);
        }
      }
      return result;
    },
  };
}

async function iosTokens(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin.from('push_tokens').select('token').eq('user_id', userId).eq('platform', 'ios').limit(10);
  return ((data ?? []) as { token: string }[]).map((r) => r.token);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!secretMatches(req.headers.get('x-purge-secret'), Deno.env.get('PURGE_SECRET'))) return json(401, { error: 'unauthorized' });
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'server_misconfigured' });
  const sender = await makeSender().catch(() => null);
  if (!sender) return json(503, { error: 'not_configured' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: { kind?: string; notification_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  // ── 커뮤니티 알림 한 건 ──
  if (body.kind === 'notification') {
    if (typeof body.notification_id !== 'string') return json(400, { error: 'invalid_request' });
    const { data: n } = await admin.from('notifications').select('id, user_id, kind, actor_id, post_id, comment_id').eq('id', body.notification_id).maybeSingle();
    if (!n || (n.kind !== 'post_comment' && n.kind !== 'comment_reply')) return json(200, { skipped: true });
    const tokens = await iosTokens(admin, n.user_id);
    if (tokens.length === 0) return json(200, { skipped: true, reason: 'no_tokens' });
    const [{ data: actor }, { data: me }] = await Promise.all([
      admin.from('profiles').select('display_name').eq('id', n.actor_id).maybeSingle(),
      admin.from('profiles').select('locale').eq('id', n.user_id).maybeSingle(),
    ]);
    const locale = normalizeLocale(me?.locale);
    const name = (actor?.display_name as string | null)?.trim() || (locale === 'ko' ? '누군가' : 'Someone');
    const text = n.kind === 'post_comment' ? commentMessage(locale, name) : replyMessage(locale, name);
    const path = `/community/post/${n.post_id}${n.comment_id ? `#comment-${n.comment_id}` : ''}`;
    return json(200, await sender.send(tokens, { ...text, path }, admin, n.user_id));
  }

  // ── 여행·동행·공동 편집·운영 알림 한 건(app_notifications) ──
  if (body.kind === 'app_notification') {
    if (typeof body.notification_id !== 'string') return json(400, { error: 'invalid_request' });
    const { data: n } = await admin
      .from('app_notifications')
      .select('id, user_id, kind, trip_id, companion_post_id, data')
      .eq('id', body.notification_id)
      .maybeSingle();
    if (!n) return json(200, { skipped: true });
    const tokens = await iosTokens(admin, n.user_id);
    if (tokens.length === 0) return json(200, { skipped: true, reason: 'no_tokens' });
    const { data: me } = await admin.from('profiles').select('locale').eq('id', n.user_id).maybeSingle();
    const data = (n.data ?? {}) as AppNotificationData & { post_id?: string | null };
    const text = appNotificationMessage(normalizeLocale(me?.locale), n.kind, data);
    if (!text) return json(200, { skipped: true, reason: 'unknown_kind' });
    const path = appNotificationPath(n.kind, n, data);
    return json(200, await sender.send(tokens, { ...text, path }, admin, n.user_id));
  }

  return json(400, { error: 'unknown_kind' });
});
