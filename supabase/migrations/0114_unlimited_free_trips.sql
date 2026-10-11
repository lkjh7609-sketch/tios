-- 0114 · 무료 여행 생성 한도 사실상 해제 — 사용자 결정(2026-10-12): 출시 초기엔 모두 무제한, 사용자가 모이면 다시 둔다.
-- 한도 구조(profiles.trip_limit · enforce_trip_quota)는 그대로 두고 값만 1000(운영 콘솔 상한 MAX_TRIP_LIMIT)으로 올린다.
-- 다시 제한하려면: alter column default 값을 내리고 `update ... set trip_limit = <값> where plan = 'free' and role <> 'admin'`.
alter table public.profiles alter column trip_limit set default 1000;
update public.profiles set trip_limit = 1000 where trip_limit < 1000;
