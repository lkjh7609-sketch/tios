/**
 * Supabase Edge Function: send-email — 가입 감사·탈퇴 완료 안내 메일 (Resend)
 *
 * 받는 사람·제목·본문은 절대 호출자에게서 받지 않는다(아무나 메일을 보내는 중계기가 되지 않게). 종류마다 호출 자격이 다르다.
 *  - { kind: 'welcome' }          로그인한 회원 본인(JWT). 받는 주소는 그 회원의 주소. 이메일 인증(소셜은 가입)이 24시간 안이고
 *                                  아직 안 보냈을 때만 한 번 — 기존 회원이 로그인할 때마다 받지 않는다. 클라이언트가 로그인 직후 호출한다.
 *  - { kind: 'account_deleted', to, locale, name }  탈퇴 처리 서버(api/deleteAccount.js)가 service_role 키로 호출(관리자 API가 열리는 키인지로 확인) — 계정이 이미 없어서 주소를 직접 받는다.
 * (여행 3일 전 메일은 0112에서 없앴다 — 출발 임박 앱 알림으로 대신.)
 * 같은 메일이 두 번 나가지 않게 email_log(user_id, kind, ref_id)에 먼저 적고(유일 제약) 보낸다. 보내기에 실패하면 지워서 다음에 다시 시도한다.
 *
 * 배포: 이 함수는 인증을 코드 안에서 하므로 `supabase functions deploy send-email --no-verify-jwt`(서비스 키가 새 형식이어도 통과해야 한다).
 * 비밀값: RESEND_API_KEY(필수), MAIL_FROM(선택, 기본 'Triptic <noreply@triptic.my>').
 */
import { createClient } from '@supabase/supabase-js';
import { accountDeletedMail, normalizeLocale, welcomeMail, type Mail, type MailKind } from './templates.ts';

const REPLY_TO = 'admin@triptic.my';
const WELCOME_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function corsHeaders(origin: string | null) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  return headers;
}

/** 이 키가 service_role(또는 새 형식 secret) 키인지 — 키 모양(JWT 여부)에 기대지 않고, 관리자 API가 실제로 열리는지로 확인한다 */
async function isServiceKey(url: string, key: string): Promise<boolean> {
  if (!key) return false;
  try {
    const probe = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await probe.auth.admin.listUsers({ page: 1, perPage: 1 });
    return !error;
  } catch {
    return false;
  }
}


async function sendViaResend(to: string, mail: Mail, idempotencyKey: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({
      from: Deno.env.get('MAIL_FROM') || 'Triptic <noreply@triptic.my>',
      to: [to],
      reply_to: REPLY_TO,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    }),
  });
  if (!res.ok) console.warn('[send-email] resend failed', res.status);
  return res.ok;
}

type Admin = ReturnType<typeof createClient>;

/** email_log에 먼저 적는다 — 이미 있으면(다른 호출이 보냈거나 보내는 중) false */
async function claim(admin: Admin, userId: string, kind: MailKind, refId: string): Promise<boolean> {
  const { error } = await admin.from('email_log').insert({ user_id: userId, kind, ref_id: refId });
  if (!error) return true;
  if (error.code === '23505') return false;
  throw error;
}

async function release(admin: Admin, userId: string, kind: MailKind, refId: string) {
  await admin.from('email_log').delete().eq('user_id', userId).eq('kind', kind).eq('ref_id', refId);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const headers = corsHeaders(origin);
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json(500, { error: 'server_misconfigured' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'bad_json' });
  }
  const kind = body.kind;
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');

  // ── 탈퇴 완료: 서버(service_role)만 ──
  if (kind === 'account_deleted') {
    if (!(await isServiceKey(url, bearer))) return json(401, { error: 'unauthorized' });
    const to = typeof body.to === 'string' ? body.to.trim() : '';
    if (!EMAIL_RE.test(to)) return json(400, { error: 'bad_to' });
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 60) : to.split('@')[0];
    const ok = await sendViaResend(to, accountDeletedMail(normalizeLocale(typeof body.locale === 'string' ? body.locale : null), name), `account_deleted:${to}:${Math.floor(Date.now() / 3_600_000)}`);
    return json(ok ? 200 : 502, { sent: ok });
  }

  // ── 가입 감사: 로그인한 본인 ──
  if (kind === 'welcome') {
    if (!bearer) return json(401, { error: 'unauthorized' });
    const { data, error } = await admin.auth.getUser(bearer);
    const user = data?.user;
    if (error || !user) return json(401, { error: 'unauthorized' });
    if (user.is_anonymous || !user.email) return json(200, { sent: false, reason: 'no_email' });
    const confirmedAt = user.email_confirmed_at ? new Date(user.email_confirmed_at).getTime() : NaN;
    if (!Number.isFinite(confirmedAt) || Date.now() - confirmedAt > WELCOME_WINDOW_MS) return json(200, { sent: false, reason: 'not_new' });
    if (!(await claim(admin, user.id, 'welcome', ''))) return json(200, { sent: false, reason: 'already_sent' });
    const { data: profile } = await admin.from('profiles').select('display_name, locale').eq('id', user.id).maybeSingle();
    const name = (profile?.display_name as string | null)?.trim() || user.email.split('@')[0];
    const ok = await sendViaResend(user.email, welcomeMail(normalizeLocale(profile?.locale as string | null), name), `welcome:${user.id}`);
    if (!ok) await release(admin, user.id, 'welcome', '');
    return json(ok ? 200 : 502, { sent: ok });
  }

  return json(400, { error: 'unknown_kind' });
});
