-- 0113 · 프로필 사진 올리기 수정 (2026-10-12) — 운영 DB에 적용함(SQL 편집기, 사용자 승인 하에 내 도구로 실행)
-- 증상: 프로필 사진을 올리면 항상 실패(작은 사진도). 원인: avatars 버킷에 insert·update·delete 정책만 있고 읽기(select) 정책이 없었다.
--  · 앱은 `upload(..., { upsert: true })`로 올리는데, 서버는 upsert 때 기존 행 확인을 위해 읽기 권한까지 요구해 403(new row violates row-level security policy).
--  · `remove()`도 같은 이유로 에러 없이 0건만 지웠다(사진 지우기·탈퇴 때 파일이 남을 수 있었다).
-- 해결: 본인 폴더(<user_id>/...) 파일만 읽는 정책. 버킷은 원래 공개(public)라 사진 주소로 보는 것은 영향 없고, 목록 조회·upsert·삭제만 본인 폴더로 열린다.
create policy "avatars owner select" on storage.objects for select
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
