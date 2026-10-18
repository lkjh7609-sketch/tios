# Triptic 작업 지침 (프로젝트)

> 이 저장소를 여는 Claude는 먼저 이 파일을 읽는다. 사용자(이재헌)와 admin·lkjh 두 계정이 같은 저장소를 쓴다(브랜치 `admin/*`, `lkjh/*` → PR → main). 문서는 `docs/updates/4-v1.1.0/changelog.md`(현재 단계 기록)에 날짜별로 쌓는다.

## 🧭 먼저 읽기: 진행 현황

**이 파일의 '🚀 iOS 앱' 절**이 최신 현황(2026-10-18)이다. 1.0.1 전체 경과(타임라인·운영 적용·빌드·스토어 입력값·결정·남은 일)는 `docs/launch/STATUS-1.0.1.md`. `docs/launch/STATUS.md`는 1.0.0 승인(2026-10-16)까지의 심사 기록(2.1 두 번 답변·재제출, 제품 결정). 심사 답장 원문은 `docs/launch/review-2026-10/`. 위젯·워치·라이브 액티비티의 결정 기록은 `docs/ios-widget-watch.md`, 날짜별 변경은 `docs/updates/4-v1.1.0/changelog.md`.

## 📱 이 폴더는 앱 전용 복제본 (2026-10-11)

- 경로 `~/Desktop/Dev/triptic-ios`, 원격 `origin` = `lkjh7609-sketch/tios` (웹 저장소 `Triptic`과 **별개**). 웹 운영(triptic.my)은 `~/Triptic`에서 계속한다.
- **Vercel 연결 금지**(`.vercel` 삭제함, `vercel` 명령 쓰지 않는다). 빌드·배포는 Codemagic만.
- 웹 저장소와 헷갈리지 말 것: 여기서 push/PR 해도 웹은 배포되지 않는다. 웹에 필요한 수정은 `~/Triptic`에서 따로 한다.
- 2026-10-11 Google Maps 키가 옛 커밋(2026-07-08 `index.html`)에 노출돼 두 저장소 히스토리에서 지우고 키를 폐기했다. **비밀값은 코드·문서·채팅에 쓰지 않는다.**

## 🚀 iOS 앱 — 1.0.0 출시됨(2026-10-16 승인), 1.0.1 심사 대기 (2026-10-18 갱신)

**제품 결정(사용자, 2026-10-12~)**: 항공 = Ignav 운임 목록 + 예약 Trip.com KR/Kiwi.com, 호텔 = Agoda, 투어 = 마이리얼트립·Klook(Kayak은 운영 키가 오면). **프로·인앱결제 없음**(Apple 3.1.1 — 앱에서 프로를 팔거나 외부 결제로 유도하지 않는다). 등급(프로) 화면은 앱·웹 모두 삭제(tios #34, 웹 #45) — DB `plan`/`trip_limit`·운영 콘솔은 남김, 약관 제5조 "한도를 둘 수 있다"는 유지(사용자 결정). 여행 생성 한도 **무제한**(`trip_limit`=1000, `0114`). 리딤 코드 폐기. 판매국 한국·호주·일본·대만, 무료, iPhone 전용. 심사·메타데이터는 `docs/launch/app-store-listing.md`, 심사용 계정은 `~/Desktop/Triptic 보안/App Review/demo-account.txt`(저장소에 비밀번호 쓰지 않는다).

**현황**
- **1.0.0(빌드 11) 2026-10-16 승인** — 심사 기록 `docs/launch/STATUS.md`(승인 전까지), 답장 원문 `docs/launch/review-2026-10/`.
- **1.0.1 (21) 심사 제출(2026-10-18 13:23 KST, 상태 Waiting for Review)** — main `6946aba`: 위젯·워치·라이브 액티비티, 도시 사진 DB만(#45·#46), 수정 4건(#47: 서류 종류 버튼별 빨간 표시·내 여행 구역 제목 삭제·탈퇴 시 Apple 토큰 철회·워치 출발 줄). 빌드 20으로 10-17에 냈다가 10-18 취소 후 다시 냄. 언어별 개인정보처리방침 URL(영어 `https://triptic.my/privacy-en.html`, 일본어 `…/privacy-ja.html`, 중국어(번체) `…/privacy-zh-TW.html`, 한국어 `…/privacy.html`) 함께 제출.
- **남은 것**: 심사 결과 대응. Apple 토큰 철회 실사용 확인(Apple 가입 시험 계정 삭제 뒤 Vercel 로그 — 환경 변수 `APPLE_TEAM_ID`·`APPLE_KEY_ID`·`APPLE_CLIENT_ID`·`APPLE_PRIVATE_KEY` 운영에 있음).

**빌드**: Codemagic 팀 "Triptic", 워크플로 "Triptic iOS (TestFlight)"(`codemagic.yaml`), 기기 **`mac_mini_m2`**(2026-10-17 사용자 요청), 빌드 번호 = TestFlight 마지막 + 1, TestFlight로 자동 업로드. **main에서** 빌드한다(위젯·워치가 main에 들어옴). Xcode가 이 컴퓨터에 없어 Swift 화면 코드는 Codemagic 빌드가 첫 컴파일 확인이다.

### 🙋 작업 규칙 (사용자 지시 — 반드시 지킬 것)
- **빌드·머지·운영 배포·외부 계정 작업(Apple Developer, App Store Connect, Codemagic, Supabase 운영)** 은 바로 그 직전에 사용자 허락을 받는다. "진행해"라고 해도 범위·대상·순서가 불확실하면 다시 묻는다. 맘대로 판단하지 않는다.
- 빌드·머지 직전, 앞서 물었는데 답을 못 받은 질문이 있으면 먼저 다시 묻는다(2026-10-17 — 빌드 뒤에 물어 혼남).
- 코드 수정·로컬 시험·PR 준비는 묻지 않고 해도 된다. 기록(이 파일·`docs/`·메모)을 먼저 읽고 천천히 생각한다.
- 사용자에게 보이는 글은 **한국어로만**(진행 안내 포함). 비밀값(키·토큰·비밀번호)은 코드·문서·채팅에 쓰지 않는다.
- 운영 DB 변경은 사용자가 적용한다(허락하면 `supabase db query --linked -f <파일>`로 대신 적용).
- 웹·앱 공용 코드(`src/`)는 두 저장소에 같이 고친다(웹 `~/Triptic` PR은 머지 = triptic.my 배포, 앱 PR은 다음 빌드에 들어감).

### 위젯 + 애플워치 + 라이브 액티비티 (PR #25, 2026-10-17 main 머지)
- 구조·번들 ID·확인 목록 `docs/ios-widget-watch.md`, 프로젝트 파일 `scripts/ios-add-widget-watch.rb`, 순수 계산 시험 `sh ios/Tests/run.sh`.
- 시안 캔버스: https://claude.ai/artifact/4QGxUzsUEwKUwy7yYkr8AA — 워치 = C '경로 타임라인' 한 화면, 라이브 액티비티 = '라이브 2', 맨 아래 줄 1~6 = '지금' 방식.
- **'지금' 정하는 방식**(2026-10-17): 시간 기준 + 도착 보정 — `TripLogic.position`. GPS는 지금/바로 다음 일정 장소 **300m 안 '도착'**(앞당김)과 **30km 안 거리 표시**에만. 워치·라이브 액티비티 같음.
- 라이브 액티비티: 여행 당일 앱을 열면 켜고, 다음 일정·출발 진동·8시간마다 다시 켜기는 서버 푸시. 함수 `live-activity` + `supabase/migrations/0116_live_activity.sql` **운영 적용됨**(2026-10-17, 1분 cron `live-activity-tick`, 되돌리기는 0116 머리말). iOS 17.2+만 서버가 켤 수 있다.
- Apple Developer: App Group `group.com.triptic.travel`, App ID `com.triptic.travel.widget` 등록됨.

### 출시 뒤 할 일
- [x] 인천 전광판 정기 갱신(PR #29, 0115 운영 적용, cron `airport-board-refresh`, 되돌리기 `select cron.unschedule('airport-board-refresh');`)
- [x] 공항 화면 로딩 표시 개선(tios #31)
- [x] 위젯 + 애플워치 + 라이브 액티비티(PR #25)
- [x] 1.0.1 심사 제출(2026-10-18, 빌드 21)
- [ ] 스마트 앱 배너 — 웹 `index.html`에 `<meta name="apple-itunes-app" content="app-id=6820429874">`(+`app-argument`), 웹 저장소 PR로
- [x] 계정 삭제 시 Apple 로그인 토큰 철회(가이드라인 5.1.1(v)) — 웹 #58·앱 #47, 실사용 확인은 남음
- [ ] (검토) 워치 컴플리케이션·스마트 스택 위젯

### 이미 main에 있는 앱 관련 코드 (웹에서는 동작하지 않아야 한다)
- 앱 소셜 로그인(PR #9): `src/shared/api/nativeAuth.ts`(인앱 브라우저 → `com.triptic.travel://auth/callback?code=` 복귀, 앱에서만 PKCE). Supabase Redirect URL 등록됨.
- 푸시(APNs): 함수 `send-push` + `0103_push_delivery.sql`, 앱 `PushBootstrap`(로그인 뒤 권한·기기 등록, 로그아웃 때 토큰 삭제). 좋아요는 안 보낸다, 잠금 화면에 글 내용 없음.
- 앱에서 바깥 링크는 인앱 브라우저(`src/shared/externalLink.ts`), 호텔 탭은 웹=검색창 위젯 / 앱=구글 자동완성+우리 화면 결과(`HotelsScreen`).
- 공개 조회 API(CDN 캐시)는 `applyPublicCors`(ACAO `*`), 로그인 필요한 API는 `applyCors(..., 'Content-Type, Authorization')` — 앱(`capacitor://localhost`)은 다른 출처라 빠지면 앱에서만 실패한다(2026-10-17 항공 특가·AI 추천 사고, 웹 `api/_lib/http.test.js`가 검사).

### 반드시 기억할 함정
1. **`isNativeApp()`**: `window.Capacitor`가 있는지만 보면 안 된다 — `@capacitor/core`를 번들에 넣으면 웹에서도 그 전역이 생긴다. 2026-10-08 푸시 코드를 메인 번들에 넣었다가 **웹 호텔 탭·소셜 로그인이 앱 방식으로 바뀌는 사고**가 났다. 지금은 `isNativePlatform()`을 본다(`src/shared/platform.ts`, 시험 있음). 앱 전용 코드를 웹 번들에 정적으로 import하기 전에 웹 동작을 꼭 확인할 것.
2. **약관·개인정보처리방침 원본은 루트 `terms.html`/`privacy.html`** 이다. 빌드(`scripts/build.js`)가 루트 → `public/`으로 덮어쓰므로 `public/`만 고치면 운영에 안 나간다(두 번 겪음). (2026-10-08 루트에 반영 완료 — 제휴사·방침을 바꿀 때마다 루트부터 고칠 것.)
3. Xcode가 이 컴퓨터에 없다(명령줄 도구만) — iOS 빌드·Swift 화면 코드 컴파일 확인은 **Codemagic**에서만(빌드 #16~#20 성공). 로컬에서는 pbxproj·plist 문법(`plutil -lint`)과 순수 계산 시험(`sh ios/Tests/run.sh`)만.
4. 앱에서 구글 지도 키의 '웹 주소 제한'이 `capacitor://localhost`에서 막힐 수 있다 — 첫 TestFlight에서 지도가 뜨는지 확인.
5. 사용자 질문은 한두 번에 묶어서, 불확실하면 임의로 정하지 말고 묻는다. 비밀값(키·토큰)은 채팅에 쓰지 않는다.
6. CSS 편집을 스크립트로 할 때 `s[s.index(a):s.index(b)]`처럼 잘라 바꾸면, b가 a보다 앞에 있으면 빈 문자열이 되어 파일 전체가 망가진다(2026-10-17 `ReviewSheet.module.css` 8만 줄 사고 — 시험은 CSS를 안 봐서 통과). 바꿀 문자열이 정확히 한 번 있는지 확인하고 바꾼다.
