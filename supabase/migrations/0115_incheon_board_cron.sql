-- ============================================================================
-- 0115: 인천 출·도착 전광판 정기 갱신 — 한국 06:00~24:00에 5분마다 DB가 incheon-board를 불러 값을 미리 받아 둔다.
--
-- 왜: 지금은 '요청이 올 때 3분이 지났으면 그 요청이 외부 API를 불러 기다렸다가 응답'이라, 보는 사람이 적은 지금은 첫 방문이 3~4초 비어 보였다.
--   정기 실행이 운영 시간 내내 값을 새로 해 두면 보는 사람은 항상 저장된 값을 바로 받는다(함수는 그 시간대에 사람이 부르면 7분이 넘었을 때만 직접 갱신 — 안전망).
-- 하루 외부 호출: 한국 06~24시 = 18시간 × 12회 = 216회 × 2(출발·도착) = 432회 + 새벽 요청 갱신. 일일 상한 900회(claim_airport_refresh) 안.
-- 시간표: cron은 UTC — 한국 06:00~23:55 = UTC 21:00~14:55 → '*/5 21-23,0-14 * * *'. 새벽(한국 00~06시)은 예전 방식 그대로.
--
-- 순서: ① 함수 먼저 배포(`supabase functions deploy incheon-board`) ② 이 SQL 실행. (함수를 아직 안 올려도 정기 실행은 동작하지만 사람이 부를 때의 7분 기준이 적용되지 않는다.)
-- 필요: vault의 project_url · anon_key · purge_secret(0068·0103과 같음, 이미 있음), 함수 시크릿 PURGE_SECRET(send-push와 같음, 이미 있음).
-- 되돌리기: select cron.unschedule('airport-board-refresh');
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.unschedule(jobid) from cron.job where jobname = 'airport-board-refresh';

select cron.schedule(
  'airport-board-refresh',
  '*/5 21-23,0-14 * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/incheon-board',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
