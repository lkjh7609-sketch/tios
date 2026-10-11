-- 0111 · 리딤 코드(여행 한도 +N) 제거 — 사용자 결정(2026-10-11): 앱 안에서 코드로 한도를 늘리지 않는다.
-- 이벤트성 프로 이용은 Apple 오퍼 코드로 한다. 0110의 무료 한도 2회·pro_until 칸·enforce_trip_quota는 그대로 둔다.
-- ⚠️ 아직 운영에 적용하지 않음(적용 시도가 취소됨 — 사용자 확인 뒤 적용). 코드는 한 번도 발급된 적이 없어(0개) 지워도 데이터 손실은 없다.
drop function if exists public.redeem_code(text);
drop function if exists public.admin_create_redeem_codes(int, int, timestamptz, text);
drop function if exists public.admin_list_redeem_codes(int);
drop function if exists public.admin_disable_redeem_code(uuid);
drop table if exists public.redeem_attempts;
drop table if exists public.redeem_codes;
