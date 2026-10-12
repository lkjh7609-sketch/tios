# Triptic 작업 지침 (프로젝트)

> 이 저장소를 여는 Claude는 먼저 이 파일을 읽는다. 사용자(이재헌)와 admin·lkjh 두 계정이 같은 저장소를 쓴다(브랜치 `admin/*`, `lkjh/*` → PR → main). 문서는 `docs/updates/4-v1.1.0/changelog.md`(현재 단계 기록)에 날짜별로 쌓는다.

## 📱 이 폴더는 앱 전용 복제본 (2026-10-11)

- 경로 `~/Desktop/Dev/triptic-ios`, 원격 `origin` = `lkjh7609-sketch/tios` (웹 저장소 `Triptic`과 **별개**). 웹 운영(triptic.my)은 `~/Triptic`에서 계속한다.
- **Vercel 연결 금지**(`.vercel` 삭제함, `vercel` 명령 쓰지 않는다). 빌드·배포는 Codemagic만.
- 웹 저장소와 헷갈리지 말 것: 여기서 push/PR 해도 웹은 배포되지 않는다. 웹에 필요한 수정은 `~/Triptic`에서 따로 한다.
- 2026-10-11 Google Maps 키가 옛 커밋(2026-07-08 `index.html`)에 노출돼 두 저장소 히스토리에서 지우고 키를 폐기했다. **비밀값은 코드·문서·채팅에 쓰지 않는다.**

## 🚀 iOS 앱 출시 — 1.0.0 MVP로 진행 (2026-10-12 결정, 이전의 '보류'를 대체)

**결정(사용자)**: Kayak 운영 키를 기다리지 않고 **현재 구조(항공 = Ignav 운임 목록 + 예약은 Trip.com KR/Kiwi.com, 호텔 = Agoda, 투어 = 마이리얼트립·Klook)로 MVP 출시**. Kayak 키가 오면 그때 바꾼다(기존 계획 유지). **프로·인앱결제 없이** 출시(사업자 미정) — 앱에서 프로를 팔거나 외부 결제로 유도하지 않는다(Apple 3.1.1). 여행 생성 한도는 **일단 무제한**(2026-10-12, `trip_limit`=1000 — 사용자가 모이면 다시 둔다, 방법은 `0114_unlimited_free_trips.sql`; 리딤 코드는 폐기 — 메모 참고). **한국 + 호주** 스토어, 무료, iPhone 전용. 심사·메타데이터 입력값은 `docs/launch/app-store-listing.md`, 심사용 계정은 `~/Desktop/Triptic 보안/App Review/demo-account.txt`(저장소에 비밀번호 쓰지 않는다).
**상태(2026-10-12)**: App Store Connect 앱 생성됨(1.0 Prepare for Submission, 번들 `com.triptic.travel`), 푸시(APNs) 서버·앱 실기기 확인, Supabase Redirect URL(`com.triptic.travel://auth/callback`) 등록 확인, `MARKETING_VERSION=1.0.0`(설정 화면 버전은 앱에서 설치된 앱 버전을 읽는다), 약관·개인정보처리방침 2026-10-12 반영(웹 저장소 PR로 배포), Universal Link용 AASA는 웹 저장소에서 배포(`~/Triptic` `public/.well-known/`).
**남은 것**: Apple 입력(앱 정보·연령 등급·콘텐츠 권한·App Privacy·가격/국가·스크린샷·App Review 메모), 웹 PR 머지·AASA 응답 확인, 최종 빌드 선택 후 심사 제출. TestFlight 외부 테스트는 필수 아님.

### 진행하다 만 것 (PR #10, 되돌려 main에서 빠짐 — 내용은 git 기록에 있다)
- 브랜치 `admin/native-push`(origin에 남아 있음), 머지 커밋 `e0f2133`(PR #10) — **되살리려면 새 폴더에서 이 브랜치/커밋을 가져온다**.
  - `3b76a8b` 푸시 서버: Edge Function `supabase/functions/send-push`(APNs, ES256 JWT를 WebCrypto로 서명) + `supabase/migrations/0103_push_delivery.sql`(댓글·답글 알림 트리거, 출발 3일 전 cron 09:05 한국, `push_log`). 함수 배포·APNs 비밀값(APNS_KEY·APNS_KEY_ID·APNS_TEAM_ID·APNS_TOPIC) 등록 **뒤에** 0103을 적용한다(운영 DB에는 **미적용**). 좋아요는 안 보낸다. 잠금 화면 문구엔 글 내용 없음.
  - `0dd4cb3` 푸시 앱 쪽: 로그인하면 권한 묻고 기기 등록(`PushBootstrap`), 알림 탭 → 앱 안 경로 이동, 로그아웃 때 이 기기 토큰 삭제.
  - `db349d9` iOS 설정: `App.entitlements`(푸시·Apple 로그인·`applinks:triptic.my`), `PrivacyInfo.xcprivacy`, Info.plist(원격 알림·사진 보관함 문구), AppDelegate 토큰 전달, pbxproj 연결, `public/.well-known/apple-app-site-association`(+vercel.json 헤더), `codemagic.yaml`.
- **사용자 결정**: **iPhone 전용**(project.pbxproj `TARGETED_DEVICE_FAMILY = "1,2"` → `"1"`로 바꾸고 iPad 방향 키 정리 — 아직 안 바꿈), 푸시 알림 포함.

### 이미 main에 있는 앱 관련 코드 (웹에서는 동작하지 않아야 한다)
- PR #9 앱 소셜 로그인: `src/shared/api/nativeAuth.ts`(인앱 브라우저 → `com.triptic.travel://auth/callback?code=` 복귀, 앱에서만 PKCE), `@capacitor/app`·`@capacitor/browser`, Info.plist URL scheme. ⚠️ Supabase Authentication → URL Configuration → Redirect URLs에 `com.triptic.travel://auth/callback` 등록 필요(운영 설정, 사용자).
- 앱에서 바깥 링크는 인앱 브라우저(`src/shared/externalLink.ts`), 호텔 탭은 웹=검색창 위젯 / 앱=구글 자동완성+우리 화면 결과(`HotelsScreen`).
- **웹 항공 탭(2026-10-09)**: 모든 언어에서 우리 화면의 운임 목록(Ignav) + 예약은 Trip.com KR(한국어)/Kiwi.com(그 외, Travelpayouts) 딥링크. 앱 재개 때 이 구조를 쓸지는 사용자 결정(Kayak은 보류).
- Kayak 연결은 **전부 제거됨**(PR #7, 커밋 `bae400c`) — Kayak 운영 키가 오면 그 이전 상태(항공 결과 목록은 `f09a626`에서 만들었다)를 되살려 항공에 붙인다. 호텔은 Agoda로 대체됨(화면에 제휴사 이름을 쓰지 않는다는 사용자 결정).

### 반드시 기억할 함정
1. **`isNativeApp()`**: `window.Capacitor`가 있는지만 보면 안 된다 — `@capacitor/core`를 번들에 넣으면 웹에서도 그 전역이 생긴다. 2026-10-08 푸시 코드를 메인 번들에 넣었다가 **웹 호텔 탭·소셜 로그인이 앱 방식으로 바뀌는 사고**가 났다. 지금은 `isNativePlatform()`을 본다(`src/shared/platform.ts`, 시험 있음). 앱 전용 코드를 웹 번들에 정적으로 import하기 전에 웹 동작을 꼭 확인할 것.
2. **약관·개인정보처리방침 원본은 루트 `terms.html`/`privacy.html`** 이다. 빌드(`scripts/build.js`)가 루트 → `public/`으로 덮어쓰므로 `public/`만 고치면 운영에 안 나간다(두 번 겪음). (2026-10-08 루트에 반영 완료 — 제휴사·방침을 바꿀 때마다 루트부터 고칠 것.)
3. Xcode가 이 컴퓨터에 없다(명령줄 도구만) — iOS 빌드는 **Codemagic**에서. pbxproj·plist는 문법(`plutil -lint`)·참조만 검증했고 실제 빌드는 못 했다.
4. 앱에서 구글 지도 키의 '웹 주소 제한'이 `capacitor://localhost`에서 막힐 수 있다 — 첫 TestFlight에서 지도가 뜨는지 확인.
5. 사용자 질문은 한두 번에 묶어서, 불확실하면 임의로 정하지 말고 묻는다. 비밀값(키·토큰)은 채팅에 쓰지 않는다.

### ⏸ 보류 중 — 위젯 + 애플워치 앱 (1.1.0 후보, 사용자 결정 2026-10-12: **1.0.0 승인 뒤에 다시 논의**)
- 요청: 애플워치에서 GPS로 일정 장소 중 가장 가까운 곳을 '현재 위치'로, 아래에 다음 장소·출발 시각. 폰에는 위젯(홈/잠금 화면).
- 코드는 **브랜치 `app/widget-watch` · PR #25(초안, 머지 금지)**에 있다. 구조·번들 ID·확인 목록은 `docs/ios-widget-watch.md`(이 PR에 사본), 프로젝트 파일은 `scripts/ios-add-widget-watch.rb`.
- ⚠️ **Xcode 없이 작성해 한 번도 빌드하지 못했다**(문법 검사·계산 시험 `sh ios/Tests/run.sh`만). 합치기 전에 Codemagic에서 그 브랜치를 먼저 빌드해 검증한다. 먼저 Apple Developer 사이트에서 앱 그룹 `group.com.triptic.travel` 등록 + `com.triptic.travel`·`.widget`에 App Groups 켜기(사용자 로그인 필요).
- 워치 화면 디자인은 아직 못 봤다 — 코드를 다듬기 전에 기기 모양 시안(웹 미리보기)을 먼저 만들어 확정하자고 제안해 둠.
- 심사 중에는 main에 합치지 않는다. 1.0.1은 main에서 만든다.

### 출시 체크리스트 (2026-10-12)
- [x] 항공 MVP 구조 결정(Ignav + Trip.com/Kiwi.com) · 프로 없이 출시 · 한국+호주
- [x] iPhone 전용 · 푸시(APNs) · Supabase Redirect URL · 심사용 데모 계정 · 약관/방침 최신화 · 1.0.0
- [ ] 웹 저장소 PR(AASA + 약관) 머지·배포 후 `curl -sI https://triptic.my/.well-known/apple-app-site-association` 확인
- [ ] 무료 한도 3개 + 추가 방법(협의 중) → 필요하면 마이그레이션(운영 적용은 사용자가 SQL 편집기에서)
- [ ] App Store Connect 입력(`docs/launch/app-store-listing.md`), 스크린샷, 빌드 선택, 심사 제출
