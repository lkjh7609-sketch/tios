-- 0112 · 알림 재정립 (2026-10-11, 사용자 결정)
--
--  묶음(설정 토글 단위):  trip(내 여행)  community(커뮤니티)  companion(동행)  collab(공동 편집)  ops(운영 조치 — 끌 수 없음)
--  · trip      출발 7일 전 · 3일 전 · 당일 오전(09:10 한국) + 여행경보(목적지 나라 2단계 이상)       → 종 + 푸시
--  · community 내 글 댓글·내 댓글 답글(종+푸시), 좋아요(종만) — 기존 notifications 표
--  · companion 지원 도착 · 수락/거절 · 매칭 확정 · 새 채팅(대화방마다 한 줄로 묶음) · 후기 요청     → 종 + 푸시
--  · collab    여행에 누가 참여/나감/내보내짐                                                        → 종 + 푸시
--  · ops       내 글·댓글·동행글이 운영자에 의해 숨김/삭제됨, 내가 한 신고의 처리 결과               → 종 + 푸시(설정으로 못 끈다)
--  푸시 전달은 send-push(Edge Function)가 한다 — 트리거가 알림 한 줄이 생기면 부른다(함수가 없거나 실패해도 알림 저장은 그대로).
--
--  이메일: 출발 3일 전 메일은 없앤다(출발 임박 알림으로 대신) — 크론을 내린다. 가입 환영·탈퇴 안내 메일은 그대로.
--  설정: notification_prefs를 {enabled, trip, community, companion, collab}로 바꾼다(예전 키는 지운다).
--        웹(예전 설정 화면)이 예전 키를 다시 쓰면 새 키가 있어 무시된다 — 웹 설정 화면도 같은 묶음으로 바꿔야 한다.

-- 1) 설정 묶음 키로 이전
alter table public.profiles alter column notification_prefs
  set default jsonb_build_object('trip', true, 'community', true, 'companion', true, 'collab', true);

update public.profiles
set notification_prefs =
  (coalesce(notification_prefs, '{}'::jsonb) - 'preDeparture' - 'flightChanges' - 'communityReplies' - 'marketing')
  || jsonb_build_object(
       'trip', coalesce((notification_prefs ->> 'preDeparture')::boolean, true),
       'community', coalesce((notification_prefs ->> 'communityReplies')::boolean, true),
       'companion', true,
       'collab', true
     );

-- 2) 이 묶음의 알림을 받는지 — 전체 허용(enabled)이 꺼져 있으면 모두 안 받고, ops는 묶음 설정과 무관(전체 허용만 따른다)
create or replace function public.notif_enabled(p_user uuid, p_group text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select coalesce((
    select case
      when (pr.notification_prefs ->> 'enabled') = 'false' then false
      when p_group = 'ops' then true
      else coalesce(
        (pr.notification_prefs ->> p_group)::boolean,
        case p_group
          when 'trip' then (pr.notification_prefs ->> 'preDeparture')::boolean
          when 'community' then (pr.notification_prefs ->> 'communityReplies')::boolean
        end,
        true
      )
    end
    from public.profiles pr where pr.id = p_user
  ), false)
$fn$;
revoke all on function public.notif_enabled(uuid, text) from public, anon, authenticated;

-- 커뮤니티 알림(기존 notifications)도 같은 규칙으로
create or replace function public.notify_community(
  p_user uuid, p_kind text, p_actor uuid, p_post uuid, p_comment uuid
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if exists (select 1 from public.blocks b where (b.blocker_id = p_user and b.blocked_id = p_actor) or (b.blocker_id = p_actor and b.blocked_id = p_user)) then
    return;
  end if;
  if not public.notif_enabled(p_user, 'community') then return; end if;
  insert into public.notifications (user_id, kind, actor_id, post_id, comment_id)
  values (p_user, p_kind, p_actor, p_post, p_comment)
  on conflict do nothing;
end;
$fn$;
revoke all on function public.notify_community(uuid, text, uuid, uuid, uuid) from public, anon, authenticated;

-- 3) 새 알림 표(여행·동행·공동 편집·운영) — 사용자는 자기 것만 읽고·읽음 표시하고·지울 수 있고, 만드는 건 트리거(함수)뿐
create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'trip_week', 'trip_soon', 'trip_today', 'travel_alert',
    'companion_applied', 'companion_accepted', 'companion_rejected', 'companion_matched', 'companion_message', 'companion_review',
    'ops_content_removed', 'ops_report_result',
    'collab_joined', 'collab_left', 'collab_removed'
  )),
  group_key text not null check (group_key in ('trip', 'companion', 'collab', 'ops')),
  trip_id uuid references public.trips (id) on delete cascade,
  companion_post_id uuid references public.companion_posts (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index if not exists app_notifications_dedupe_idx on public.app_notifications (user_id, dedupe_key) where dedupe_key is not null;
create index if not exists app_notifications_user_created_idx on public.app_notifications (user_id, created_at desc);

alter table public.app_notifications enable row level security;
create policy "read own app notifications" on public.app_notifications for select using (user_id = (select auth.uid()));
create policy "update own app notifications" on public.app_notifications for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "delete own app notifications" on public.app_notifications for delete using (user_id = (select auth.uid()));
revoke all on public.app_notifications from anon;
revoke insert, update on public.app_notifications from authenticated;
grant select, delete on public.app_notifications to authenticated;
grant update (read_at) on public.app_notifications to authenticated;

-- 4) 만들기(트리거·크론 전용) — 자기 자신·서로 차단한 사이·꺼 둔 묶음은 건너뛴다. p_bump면 같은 dedupe_key의 한 줄을 새로 올리고 개수를 센다(채팅)
create or replace function public.add_app_notification(
  p_user uuid, p_kind text, p_group text, p_trip uuid, p_post uuid, p_actor uuid, p_data jsonb, p_dedupe text, p_bump boolean default false
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if p_user is null or p_user = p_actor then return; end if;
  if p_actor is not null and exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_user and b.blocked_id = p_actor) or (b.blocker_id = p_actor and b.blocked_id = p_user)
  ) then
    return;
  end if;
  if not public.notif_enabled(p_user, p_group) then return; end if;

  if p_bump and p_dedupe is not null then
    insert into public.app_notifications as an (user_id, kind, group_key, trip_id, companion_post_id, actor_id, data, dedupe_key)
    values (p_user, p_kind, p_group, p_trip, p_post, p_actor, p_data, p_dedupe)
    on conflict (user_id, dedupe_key) where dedupe_key is not null
    do update set created_at = now(), read_at = null, actor_id = excluded.actor_id,
      data = excluded.data || jsonb_build_object('count', coalesce((an.data ->> 'count')::int, 1) + 1);
  else
    insert into public.app_notifications (user_id, kind, group_key, trip_id, companion_post_id, actor_id, data, dedupe_key)
    values (p_user, p_kind, p_group, p_trip, p_post, p_actor, p_data, p_dedupe)
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
end;
$fn$;
revoke all on function public.add_app_notification(uuid, text, text, uuid, uuid, uuid, jsonb, text, boolean) from public, anon, authenticated;

-- 5) 내 여행 — 여행경보(그 여행 하나) / 출발 임박(매일 아침)
create or replace function public.notify_trip_alert(p_trip uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  t record;
  v_cc text;
  v_lvl smallint;
  v_ko text;
  v_en text;
  u uuid;
begin
  select id, owner_id, title, city_lat, city_lng, start_date, status, deleted_at into t from public.trips where id = p_trip;
  if not found or t.deleted_at is not null or coalesce(t.status, '') = 'archived' or t.start_date is null or t.city_lat is null or t.city_lng is null then return; end if;
  if t.start_date < (now() at time zone 'Asia/Seoul')::date then return; end if;

  -- 여행 좌표에서 300km 안의 가장 가까운 우리 여행지의 나라(앱의 countryOfTrip과 같은 규칙)
  select x.country_code into v_cc
  from (
    select d.country_code,
           6371 * 2 * asin(sqrt(least(1, power(sin(radians(d.lat - t.city_lat) / 2), 2)
             + cos(radians(t.city_lat)) * cos(radians(d.lat)) * power(sin(radians(d.lng - t.city_lng) / 2), 2)))) as km
    from public.destinations d
  ) x
  where x.km <= 300
  order by x.km
  limit 1;
  if v_cc is null then return; end if;

  select a.alarm_lvl, a.country_name_ko, a.country_name_en into v_lvl, v_ko, v_en
  from public.travel_alerts a where a.country_code = v_cc and a.is_base limit 1;
  if v_lvl is null or v_lvl < 2 then return; end if;

  for u in select t.owner_id union select tm.user_id from public.trip_members tm where tm.trip_id = t.id loop
    perform public.add_app_notification(
      u, 'travel_alert', 'trip', t.id, null, null,
      jsonb_build_object('title', t.title, 'level', v_lvl, 'country', v_cc, 'country_ko', v_ko, 'country_en', v_en),
      'trip:' || t.id || ':alert:' || v_lvl
    );
  end loop;
end;
$fn$;
revoke all on function public.notify_trip_alert(uuid) from public, anon, authenticated;

create or replace function public.generate_trip_notifications()
returns int
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  r record;
  u uuid;
  v_kind text;
  n int := 0;
begin
  for r in
    select t.id, t.owner_id, t.title, t.city, (t.start_date - v_today) as diff
    from public.trips t
    where t.deleted_at is null and coalesce(t.status, '') <> 'archived'
      and t.start_date in (v_today, v_today + 3, v_today + 7)
  loop
    v_kind := case r.diff when 7 then 'trip_week' when 3 then 'trip_soon' else 'trip_today' end;
    for u in select r.owner_id union select tm.user_id from public.trip_members tm where tm.trip_id = r.id loop
      perform public.add_app_notification(
        u, v_kind, 'trip', r.id, null, null,
        jsonb_build_object('title', r.title, 'city', r.city, 'days', r.diff),
        'trip:' || r.id || ':' || v_kind
      );
      n := n + 1;
    end loop;
  end loop;

  for r in select t.id from public.trips t where t.deleted_at is null and coalesce(t.status, '') <> 'archived' and t.start_date >= v_today loop
    perform public.notify_trip_alert(r.id);
  end loop;
  return n;
end;
$fn$;
revoke all on function public.generate_trip_notifications() from public, anon, authenticated;
grant execute on function public.generate_trip_notifications() to service_role;

-- 여행을 새로 만들거나 목적지·출발일을 바꾸면 경보를 바로 확인한다(다음 날 아침까지 기다리지 않게)
create or replace function public.notify_trip_alert_on_change()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  perform public.notify_trip_alert(new.id);
  return new;
end;
$fn$;
revoke all on function public.notify_trip_alert_on_change() from public, anon, authenticated;
drop trigger if exists trips_alert_notify_ins on public.trips;
create trigger trips_alert_notify_ins after insert on public.trips for each row execute function public.notify_trip_alert_on_change();
drop trigger if exists trips_alert_notify_upd on public.trips;
create trigger trips_alert_notify_upd after update on public.trips for each row
  when (old.city_lat is distinct from new.city_lat or old.city_lng is distinct from new.city_lng or old.start_date is distinct from new.start_date)
  execute function public.notify_trip_alert_on_change();

-- 6) 동행
create or replace function public.companion_notify_ids(p_post uuid)
returns setof uuid
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select author_id from public.companion_posts where id = p_post
  union
  select applicant_id from public.companion_applications where post_id = p_post and status = 'accepted'
$fn$;
revoke all on function public.companion_notify_ids(uuid) from public, anon, authenticated;

create or replace function public.notify_on_companion_application()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_post record;
  v_name text;
begin
  select author_id, title into v_post from public.companion_posts where id = new.post_id;
  select display_name into v_name from public.profiles where id = new.applicant_id;
  perform public.add_app_notification(
    v_post.author_id, 'companion_applied', 'companion', null, new.post_id, new.applicant_id,
    jsonb_build_object('title', v_post.title, 'name', v_name), 'capp:' || new.id
  );
  return new;
end;
$fn$;
revoke all on function public.notify_on_companion_application() from public, anon, authenticated;
drop trigger if exists companion_application_notify on public.companion_applications;
create trigger companion_application_notify after insert on public.companion_applications for each row execute function public.notify_on_companion_application();

create or replace function public.notify_on_companion_application_status()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_post record;
begin
  if old.status is not distinct from new.status then return new; end if;
  select title, status into v_post from public.companion_posts where id = new.post_id;
  if new.status = 'accepted' then
    perform public.add_app_notification(new.applicant_id, 'companion_accepted', 'companion', null, new.post_id, null,
      jsonb_build_object('title', v_post.title), 'capp:' || new.id || ':accepted');
  elsif new.status = 'rejected' and v_post.status = 'recruiting' then
    -- 모집이 끝나거나 취소돼서 한꺼번에 거절 처리되는 건 알리지 않는다 — 글쓴이가 직접 거절한 것만
    perform public.add_app_notification(new.applicant_id, 'companion_rejected', 'companion', null, new.post_id, null,
      jsonb_build_object('title', v_post.title), 'capp:' || new.id || ':rejected');
  end if;
  return new;
end;
$fn$;
revoke all on function public.notify_on_companion_application_status() from public, anon, authenticated;
drop trigger if exists companion_application_status_notify on public.companion_applications;
create trigger companion_application_status_notify after update of status on public.companion_applications for each row execute function public.notify_on_companion_application_status();

create or replace function public.notify_on_companion_post_status()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  m uuid;
begin
  if old.status is not distinct from new.status then return new; end if;
  if new.status = 'matched' then
    for m in select public.companion_notify_ids(new.id) loop
      perform public.add_app_notification(m, 'companion_matched', 'companion', null, new.id, null,
        jsonb_build_object('title', new.title), 'cpost:' || new.id || ':matched');
    end loop;
  elsif new.status = 'closed' and old.status = 'matched' then
    for m in select public.companion_notify_ids(new.id) loop
      perform public.add_app_notification(m, 'companion_review', 'companion', null, new.id, null,
        jsonb_build_object('title', new.title), 'cpost:' || new.id || ':review');
    end loop;
  end if;
  return new;
end;
$fn$;
revoke all on function public.notify_on_companion_post_status() from public, anon, authenticated;
drop trigger if exists companion_post_status_notify on public.companion_posts;
create trigger companion_post_status_notify after update of status on public.companion_posts for each row execute function public.notify_on_companion_post_status();

create or replace function public.notify_on_companion_message()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_title text;
  v_name text;
  m uuid;
begin
  if new.status is distinct from 'published' then return new; end if;
  select title into v_title from public.companion_posts where id = new.post_id;
  select display_name into v_name from public.profiles where id = new.sender_id;
  for m in select public.companion_notify_ids(new.post_id) loop
    perform public.add_app_notification(m, 'companion_message', 'companion', null, new.post_id, new.sender_id,
      jsonb_build_object('title', v_title, 'name', v_name, 'count', 1), 'cmsg:' || new.post_id, true);
  end loop;
  return new;
end;
$fn$;
revoke all on function public.notify_on_companion_message() from public, anon, authenticated;
drop trigger if exists companion_message_notify on public.companion_messages;
create trigger companion_message_notify after insert on public.companion_messages for each row execute function public.notify_on_companion_message();

-- 7) 운영 조치 — 내 글·댓글·동행글이 (본인이 아닌) 누군가에 의해 숨김·삭제되면, 내가 한 신고가 처리되면
create or replace function public.notify_ops_content()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_target text;
  v_title text;
  v_post uuid;
begin
  if new.status not in ('removed', 'hidden') or old.status is not distinct from new.status then return new; end if;
  if tg_table_name = 'posts' then
    v_target := 'post'; v_title := coalesce(new.title, left(new.body, 30)); v_post := null;
  elsif tg_table_name = 'comments' then
    v_target := 'comment'; v_title := left(new.body, 30); v_post := new.post_id;
  else
    v_target := 'companion_post'; v_title := new.title; v_post := new.id;
  end if;
  if (select auth.uid()) is not distinct from new.author_id then return new; end if; -- 본인이 한 일은 알리지 않는다
  perform public.add_app_notification(
    new.author_id, 'ops_content_removed', 'ops', null, case when v_target = 'companion_post' then new.id else null end, null,
    jsonb_build_object('target', v_target, 'title', v_title, 'status', new.status, 'post_id', v_post),
    'ops:' || v_target || ':' || new.id
  );
  return new;
end;
$fn$;
revoke all on function public.notify_ops_content() from public, anon, authenticated;
drop trigger if exists posts_ops_notify on public.posts;
create trigger posts_ops_notify after update of status on public.posts for each row execute function public.notify_ops_content();
drop trigger if exists comments_ops_notify on public.comments;
create trigger comments_ops_notify after update of status on public.comments for each row execute function public.notify_ops_content();
drop trigger if exists companion_posts_ops_notify on public.companion_posts;
create trigger companion_posts_ops_notify after update of status on public.companion_posts for each row execute function public.notify_ops_content();

create or replace function public.notify_report_result()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
begin
  if new.status in ('actioned', 'dismissed') and old.status is distinct from new.status then
    perform public.add_app_notification(new.reporter_id, 'ops_report_result', 'ops', null, null, null,
      jsonb_build_object('result', new.status, 'target_type', new.target_type), 'ops:report:' || new.id);
  end if;
  return new;
end;
$fn$;
revoke all on function public.notify_report_result() from public, anon, authenticated;
drop trigger if exists reports_result_notify on public.reports;
create trigger reports_result_notify after update of status on public.reports for each row execute function public.notify_report_result();

-- 8) 공동 편집 — 누가 여행에 참여/나감/내보내짐
create or replace function public.notify_collab_join()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_trip record;
  v_name text;
  u uuid;
begin
  if new.role = 'owner' then return new; end if;
  select owner_id, title into v_trip from public.trips where id = new.trip_id and deleted_at is null;
  if not found then return new; end if;
  select display_name into v_name from public.profiles where id = new.user_id;
  for u in select v_trip.owner_id union select tm.user_id from public.trip_members tm where tm.trip_id = new.trip_id and tm.user_id <> new.user_id loop
    perform public.add_app_notification(u, 'collab_joined', 'collab', new.trip_id, null, new.user_id,
      jsonb_build_object('title', v_trip.title, 'name', v_name), null);
  end loop;
  return new;
end;
$fn$;
revoke all on function public.notify_collab_join() from public, anon, authenticated;
drop trigger if exists trip_members_join_notify on public.trip_members;
create trigger trip_members_join_notify after insert on public.trip_members for each row execute function public.notify_collab_join();

create or replace function public.notify_collab_leave()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_trip record;
  v_uid uuid := (select auth.uid());
  v_name text;
  u uuid;
begin
  if old.role = 'owner' or v_uid is null then return old; end if; -- 계정·여행이 통째로 지워지는 경우(로그인 없는 서버 작업)는 알리지 않는다
  select owner_id, title into v_trip from public.trips where id = old.trip_id and deleted_at is null;
  if not found then return old; end if;
  if v_uid = old.user_id then
    select display_name into v_name from public.profiles where id = old.user_id;
    for u in select v_trip.owner_id union select tm.user_id from public.trip_members tm where tm.trip_id = old.trip_id and tm.user_id <> old.user_id loop
      perform public.add_app_notification(u, 'collab_left', 'collab', old.trip_id, null, old.user_id,
        jsonb_build_object('title', v_trip.title, 'name', v_name), null);
    end loop;
  else
    perform public.add_app_notification(old.user_id, 'collab_removed', 'collab', old.trip_id, null, v_uid,
      jsonb_build_object('title', v_trip.title), null);
  end if;
  return old;
end;
$fn$;
revoke all on function public.notify_collab_leave() from public, anon, authenticated;
drop trigger if exists trip_members_leave_notify on public.trip_members;
create trigger trip_members_leave_notify after delete on public.trip_members for each row execute function public.notify_collab_leave();

-- 9) 푸시 — 알림 한 줄이 생기면(채팅은 새 메시지로 올라올 때도) send-push를 부른다. 못 불러도 알림 저장은 그대로
create or replace function public.push_after_notification()
returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp
as $fn$
declare
  v_table text := tg_table_name;
begin
  begin
    perform net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_secret')
      ),
      body := jsonb_build_object('kind', case when v_table = 'app_notifications' then 'app_notification' else 'notification' end, 'notification_id', new.id),
      timeout_milliseconds := 5000
    );
  exception when others then
    null;
  end;
  return new;
end;
$fn$;
revoke all on function public.push_after_notification() from public, anon, authenticated;

drop trigger if exists push_after_app_notification_ins on public.app_notifications;
create trigger push_after_app_notification_ins after insert on public.app_notifications for each row execute function public.push_after_notification();
drop trigger if exists push_after_app_notification_bump on public.app_notifications;
create trigger push_after_app_notification_bump after update of created_at on public.app_notifications for each row
  when (new.kind = 'companion_message' and old.created_at is distinct from new.created_at)
  execute function public.push_after_notification();
drop trigger if exists push_after_community_notice on public.notifications;
create trigger push_after_community_notice after insert on public.notifications for each row
  when (new.kind in ('post_comment', 'comment_reply'))
  execute function public.push_after_notification();

-- 10) 크론 — 출발 3일 전 이메일은 내리고, 매일 09:10(한국)에 출발 임박·여행경보 알림을 만든다(여행경보 새로 받기(09:00) 뒤)
select cron.unschedule(jobid) from cron.job where jobname in ('email-trip-reminders-daily', 'push-trip-reminders-daily');
select cron.unschedule(jobid) from cron.job where jobname = 'trip-notifications-daily';
select cron.schedule('trip-notifications-daily', '10 0 * * *', $cron$ select public.generate_trip_notifications(); $cron$);
