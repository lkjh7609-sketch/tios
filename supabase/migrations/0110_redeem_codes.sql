-- (운영 적용: 2026-10-11, Supabase MCP — 0110_redeem_codes 적용 뒤 admin_create_redeem_codes만 0110b로 고쳐 다시 적용. 이 파일은 합친 최종본)
-- 0110 · 무료 한도 2회 + 리딤 코드(여행 한도 추가) + 프로 만료일 칸
--
-- 결정(2026-10-11, 사용자):
--  · 무료 여행 생성 한도 기본 5 → 2. 기존 회원도 2로(관리자 제외 — 운영자 계정은 그대로).
--  · 리딤 코드: 관리자가 특정 회원에게만 직접 발급하는 1회용 코드. 쓰면 그 회원의 여행 한도가 코드의 수량만큼 늘어난다(예: +3).
--    프로 이용 중에는 쓸 수 없고(코드는 그대로 남음), 프로가 끝나 무료로 돌아온 뒤에야 적용된다. 한 코드는 한 번만.
--  · 프로 1개월권 같은 기간 부여는 이 코드로 하지 않는다 — 유료 프로는 인앱결제, 이벤트성 프로는 Apple 오퍼 코드로 한다
--    (그래서 kind는 지금 'trips'뿐). profiles.pro_until은 그때(구독 만료일) 채울 자리이고, 여행 한도 검사도 미리 따른다.
--  · 코드는 표에 직접 닿을 수 없고(RLS만 켜고 정책 없음) 아래 함수로만 쓰고 만든다. 실패가 쌓이면 잠시 막아 코드 대입을 어렵게 한다.

-- 1) 무료 한도 기본 2, 기존 회원 2(관리자 제외)
alter table public.profiles alter column trip_limit set default 2;
update public.profiles set trip_limit = 2 where role <> 'admin' and trip_limit <> 2;

-- 2) 프로 만료일 — 없으면(관리자가 수동으로 정한 프로) 만료 없음
alter table public.profiles add column if not exists pro_until timestamptz;

-- 3) 여행 생성 한도 — 무료이거나, 프로인데 만료일이 지났으면 한도를 적용한다
create or replace function public.enforce_trip_quota()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_plan text;
  v_limit int;
  v_next_count int;
  v_pro_until timestamptz;
begin
  select plan, trip_limit, trips_created_count + 1, pro_until into v_plan, v_limit, v_next_count, v_pro_until
  from public.profiles where id = new.owner_id for update;

  if (v_plan = 'free' or (v_plan = 'pro' and v_pro_until is not null and v_pro_until <= now())) and v_next_count > v_limit then
    raise exception 'free plan trip limit reached' using errcode = 'P0001', hint = 'trip_limit_reached';
  end if;

  update public.profiles set trips_created_count = v_next_count where id = new.owner_id;
  return new;
end;
$fn$;

-- 4) 리딤 코드(1회용). code는 대문자·하이픈 없는 12자(TRIP + 8자) — 화면에는 TRIP-XXXX-XXXX로 보인다
create table if not exists public.redeem_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^TRIP[A-HJ-NP-Z2-9]{8}$'),
  kind text not null default 'trips' check (kind in ('trips')),
  amount int not null check (amount between 1 and 100),
  note text,
  expires_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz,
  disabled_at timestamptz
);
alter table public.redeem_codes enable row level security;
revoke all on public.redeem_codes from anon, authenticated;

-- 쓰기 시도 기록 — 틀린 코드를 넣은 횟수를 세어 대입 공격을 막는다
create table if not exists public.redeem_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists redeem_attempts_user_at on public.redeem_attempts (user_id, at desc);
alter table public.redeem_attempts enable row level security;
revoke all on public.redeem_attempts from anon, authenticated;

-- 5) 코드 쓰기 — 결과를 jsonb로 돌려준다(실패도 예외가 아니라 값이라 실패 기록이 남는다)
--    reason: not_signed_in | pro_active | too_many_attempts | invalid | used | expired
create or replace function public.redeem_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_norm text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_plan text;
  v_pro_until timestamptz;
  v_row public.redeem_codes%rowtype;
  v_limit int;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  -- 프로 이용 중에는 쓸 수 없다(코드는 소모되지 않는다) — 프로가 끝난 뒤에 쓰면 된다
  select plan, pro_until into v_plan, v_pro_until from public.profiles where id = v_uid for update;
  if v_plan = 'pro' and (v_pro_until is null or v_pro_until > now()) then
    return jsonb_build_object('ok', false, 'reason', 'pro_active');
  end if;

  -- 최근 1시간 동안 실패가 10번이면 잠시 막는다
  if (select count(*) from public.redeem_attempts where user_id = v_uid and at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_attempts');
  end if;

  select * into v_row from public.redeem_codes where code = v_norm and disabled_at is null for update;
  if not found then
    insert into public.redeem_attempts (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  if v_row.redeemed_at is not null then
    insert into public.redeem_attempts (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'used');
  end if;
  if v_row.expires_at is not null and v_row.expires_at <= now() then
    insert into public.redeem_attempts (user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  update public.profiles set trip_limit = trip_limit + v_row.amount where id = v_uid returning trip_limit into v_limit;
  update public.redeem_codes set redeemed_by = v_uid, redeemed_at = now() where id = v_row.id;
  return jsonb_build_object('ok', true, 'kind', v_row.kind, 'amount', v_row.amount, 'trip_limit', v_limit);
end;
$fn$;

-- 6) 관리자: 코드 만들기 — 한 번에 p_count개(1~50). 만든 코드(TRIP-XXXX-XXXX)를 돌려준다
create or replace function public.admin_create_redeem_codes(
  p_amount int,
  p_count int default 1,
  p_expires_at timestamptz default null,
  p_note text default null
)
returns table (id uuid, code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 0·O·1·I처럼 헷갈리는 글자는 뺐다
  v_bytes bytea;
  v_code text;
  v_i int;
  v_n int := 0;
  v_id uuid;
begin
  if not exists (select 1 from public.profiles where profiles.id = auth.uid() and role = 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 100 then
    raise exception 'invalid amount: %', p_amount using errcode = '22023';
  end if;
  if p_count is null or p_count < 1 or p_count > 50 then
    raise exception 'invalid count: %', p_count using errcode = '22023';
  end if;
  while v_n < p_count loop
    v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex'); -- 16바이트 무작위
    v_code := 'TRIP';
    for v_i in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % 32) + 1, 1);
    end loop;
    -- 출력 열 이름(id·code)과 겹치지 않게 별칭을 쓰고, 충돌은 제약 이름으로 지정한다(운영 적용 때 처음 버전의 `on conflict (code)`가 모호하다는 오류가 나서 고쳤다)
    insert into public.redeem_codes as rc (code, amount, note, expires_at, created_by)
    values (v_code, p_amount, nullif(trim(p_note), ''), p_expires_at, auth.uid())
    on conflict on constraint redeem_codes_code_key do nothing
    returning rc.id into v_id;
    if v_id is not null then
      v_n := v_n + 1;
      id := v_id;
      code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4) || '-' || substr(v_code, 9, 4);
      return next;
      v_id := null;
    end if;
  end loop;
end;
$fn$;

-- 7) 관리자: 코드 목록(최근 순) — 누가 썼는지 표시 이름과 함께
create or replace function public.admin_list_redeem_codes(p_limit int default 200)
returns table (
  id uuid, code text, kind text, amount int, note text, expires_at timestamptz,
  created_at timestamptz, redeemed_at timestamptz, redeemed_by_name text, disabled_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not exists (select 1 from public.profiles where profiles.id = auth.uid() and role = 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  return query
  select c.id,
         substr(c.code, 1, 4) || '-' || substr(c.code, 5, 4) || '-' || substr(c.code, 9, 4),
         c.kind, c.amount, c.note, c.expires_at, c.created_at, c.redeemed_at, p.display_name, c.disabled_at
  from public.redeem_codes c
  left join public.profiles p on p.id = c.redeemed_by
  order by c.created_at desc, c.id
  limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$fn$;

-- 8) 관리자: 아직 안 쓴 코드 끄기(잘못 만들었거나 회수할 때)
create or replace function public.admin_disable_redeem_code(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not exists (select 1 from public.profiles where profiles.id = auth.uid() and role = 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  update public.redeem_codes set disabled_at = now() where id = p_id and redeemed_at is null and disabled_at is null;
  if not found then
    raise exception 'code not found or already used';
  end if;
end;
$fn$;

revoke all on function public.redeem_code(text) from public, anon;
revoke all on function public.admin_create_redeem_codes(int, int, timestamptz, text) from public, anon;
revoke all on function public.admin_list_redeem_codes(int) from public, anon;
revoke all on function public.admin_disable_redeem_code(uuid) from public, anon;
grant execute on function public.redeem_code(text) to authenticated;
grant execute on function public.admin_create_redeem_codes(int, int, timestamptz, text) to authenticated;
grant execute on function public.admin_list_redeem_codes(int) to authenticated;
grant execute on function public.admin_disable_redeem_code(uuid) to authenticated;
