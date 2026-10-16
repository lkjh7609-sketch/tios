-- ============================================================================
-- 0116: iOS 라이브 액티비티(잠금 화면·다이내믹 아일랜드·워치 스마트 스택) — 서버 푸시로 켜고·바꾸고·끄기
--
-- 사용자 결정(2026-10-17): 여행 당일 앱을 열면 자동으로 켜고(앱), 다음 일정으로 넘기는 것은 서버 푸시, 8시간 제한은 서버가 다시 켠다(push-to-start, iOS 17.2+).
-- 앱(ios/App/App/TripSync.swift LiveActivityManager)이 하루하루 '몇 시에 무엇을 보낼지'를 계산해 올리고(live_activity_events),
-- 함수 live-activity가 1분마다 시각이 된 것을 Apple 푸시로 보낸다. 출발 시각에는 알림(소리·진동)을 붙인다.
-- 기기는 앱이 만든 임의 키(device_key, 64자 16진수)로만 구분한다 — 백그라운드에서도 토큰을 올릴 수 있게 로그인 토큰을 쓰지 않는다.
-- 토큰은 push_tokens(일반 알림, 0024)와 따로 둔다: 라이브 액티비티 토큰으로 일반 알림을 보내면 안 된다.
-- 세 테이블 모두 RLS를 켜고 정책을 두지 않는다 — 함수(service_role)만 읽고 쓴다.
--
-- 순서: ① `supabase functions deploy live-activity` ② 이 SQL 실행(운영 적용은 사용자 확인 뒤).
-- 필요: vault의 project_url · anon_key · purge_secret(0068·0115와 같음), 함수 비밀값 APNS_*·PURGE_SECRET(send-push와 같음).
-- 되돌리기: select cron.unschedule('live-activity-tick'); drop table public.live_activity_events, public.live_activity_tokens, public.live_activity_devices;
-- ============================================================================

create table if not exists public.live_activity_devices (
  device_key text primary key check (device_key ~ '^[0-9a-f]{64}$'),
  apns_env text not null default 'production' check (apns_env in ('production', 'sandbox')),
  start_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.live_activity_tokens (
  device_key text not null references public.live_activity_devices(device_key) on delete cascade,
  trip_id text not null,
  day integer not null,
  token text not null,
  updated_at timestamptz not null default now(),
  primary key (device_key, trip_id, day)
);

create table if not exists public.live_activity_events (
  id bigserial primary key,
  device_key text not null references public.live_activity_devices(device_key) on delete cascade,
  at timestamptz not null,
  type text not null check (type in ('start', 'update', 'depart', 'end')),
  trip_id text not null,
  day integer not null,
  payload jsonb not null,
  sent_at timestamptz,
  result text
);

create index if not exists live_activity_events_due_idx on public.live_activity_events (at) where sent_at is null;
create index if not exists live_activity_events_device_idx on public.live_activity_events (device_key);

alter table public.live_activity_devices enable row level security;
alter table public.live_activity_tokens enable row level security;
alter table public.live_activity_events enable row level security;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'live-activity-tick';

-- 1분마다(하루 종일 — 여행지 시간대가 제각각이라). 보낼 것이 없으면 함수는 조회 한 번만 하고 끝난다.
select cron.schedule(
  'live-activity-tick',
  '* * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/live-activity',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')
    ),
    body := '{"kind":"tick"}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
