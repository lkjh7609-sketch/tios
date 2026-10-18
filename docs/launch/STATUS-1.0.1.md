# Triptic iOS 1.0.1 — 진행 기록·인수인계 (2026-10-18 기준)

> 1.0.0 승인(2026-10-16)부터 1.0.1 심사 제출(2026-10-18)까지의 기록이다. 1.0.0 심사 기록은 `docs/launch/STATUS.md`, 최신 현황은 `CLAUDE.md`의 '🚀 iOS 앱' 절.
> 새 에이전트는 **CLAUDE.md → 이 파일 → `docs/ios-widget-watch.md`** 순서로 읽는다. 날짜별 상세는 `docs/updates/4-v1.1.0/changelog.md`.
> 사용자(이재헌, Ben Lee)와는 **한국어로만**, 간결하게. **빌드·머지·운영 배포·외부 계정 작업은 바로 그 직전에 허락**을 받는다. **비밀값(키·토큰·비밀번호)은 코드·문서·채팅에 쓰지 않는다.**

## 1. 지금 어디까지 왔나
**1.0.1 (빌드 21, main `6946aba`)을 2026-10-18 13:23 KST에 심사 제출 — 상태 Waiting for Review.** 빌드 20으로 10-17 23:45에 냈다가 사용자 요청으로 10-18에 취소하고, 수정 4건을 더해 다시 냈다. 심사 중에는 새 빌드 업로드·스토어 입력값 변경·빌드가 쓰는 API 변경을 하지 않는다(심사관 질문 대응으로 사용자가 허락한 경우만).

## 2. 타임라인 (KST)
| 날짜·시각 | 일 |
|---|---|
| 10-16 | **1.0.0(빌드 11) 승인.** 1.0.1 시작 — 버전 올림 + 등급(프로) 표시 전부 제거(앱 #34·웹 #45), 공항 로딩 표시(#31). 위젯·워치를 **1.0.1에 포함**하기로(사용자). Apple Developer에 App Group `group.com.triptic.travel`·App ID `com.triptic.travel.widget` 등록 |
| 10-16 23:46 | 인천 전광판 정기 갱신 운영 적용(`incheon-board` 함수 + `0115`, cron `airport-board-refresh`) → #29 머지 |
| 10-17 00:33 | Codemagic #15 실패(워치 `SKIP_INSTALL=NO` → IPA 내보내기 실패) → 수정 → #16 성공, TestFlight **1.0.1 (12)** |
| 10-17 새벽 | 앱 항공 특가가 로딩만 뜨다 사라짐 → 공개 조회 API CORS `*`(웹 #46). TestFlight 재설치 문제는 테스터 삭제 후 다시 추가로 해결. **(13)** |
| 10-17 오전 | 워치 한 화면(C안 '경로 타임라인')·라이브 액티비티(라이브 2안) 시안 확정 → **(14)** 첫 컴파일 성공. 08:23 `live-activity` 함수 + `0116` 운영 적용(cron `live-activity-tick`). 앱 AI 추천 실패 → 로그인 API CORS에 Authorization 허용(웹 #47). 서류 인식 확인 화면(#35)·내 여행 숫자 타일 6개 제거(#36)·탭 줄 항상 표시·필터·세계지도 삭제(#37) → **(15)** |
| 10-17 12시 | '지금' 정하는 방식 결정(시간 기준 + 도착 보정) → **(16)**. 시간 칸 정리(#38), 빌드 기기 M2(#39), 12:34 **위젯·워치·라이브 액티비티 #25 main 머지** |
| 10-17 13시 | 개인정보처리방침·약관 10-17 개정(#42·웹 #53), AI 추천 12:00(#40·웹 #52), 영어 댓글 안내 줄임(#43·웹 #54), 지침 갱신(#41) → 14:06 **(17)** |
| 10-17 15시 | 앱스토어 스크린샷 16장 제작(가짜 데이터로 로컬 촬영). 영어 날짜 잘림 → 짧은 달 이름(#44·웹 #55) → **(18)**. ASC 1.0.1 입력 시작 → 'Apple Watch 스크린샷 필수'로 막힘 → 사용자가 워치 캡처 |
| 10-17 오후~밤 | 여행 카드 '호치민'에 인물 사진 → DB 도시 사진(#45·웹 #56) → **(19)**, 위키백과 조회 삭제·DB 사진만(#46·웹 #57) → **(20)** |
| 10-17 23:45 | **1.0.1 (20) 심사 제출** |
| 10-18 오전 | 사용자 요청으로 **제출 취소**(Developer Rejected). 수정 4건 요청 → 구현·시험 → Vercel 운영 환경 변수 `APPLE_*` 추가 → 웹 #58 머지(11:26, 배포 확인) → 앱 #47 머지(11:35) → Codemagic #25 → **(21)** |
| 10-18 13:23 | **1.0.1 (21) 다시 심사 제출** → Waiting for Review. 기록 PR #48 머지 |

## 3. 1.0.1에 들어간 것 (사용자에게 보이는 변화)
- **홈·잠금 화면 위젯, 애플워치 앱, 라이브 액티비티**(#25) — 구조·확인 목록은 `docs/ios-widget-watch.md`.
  - 워치: 한 화면 '경로 타임라인' — 시계 줄 'N일차', ● 지금 → 이동 → ○ 다음 일정, 큰 숫자 = 출발 시각(일정 시각 − 이동 시간). 출발 줄이 좁은 워치에서 어색하게 끊기던 것은 `ViewThatFits`로(#47).
  - '지금' = 시간 기준 + 도착 보정(`TripLogic.position`): GPS는 지금/바로 다음 장소 300m 안 '도착'(앞당김)과 30km 안 거리 표시에만.
  - 라이브 액티비티: 여행 당일 앱을 열면 켜지고, 다음 일정·출발 진동·8시간마다 다시 켜기는 서버 푸시(iOS 17.2+만 서버가 켤 수 있음).
- **등급·'무료' 표시 전부 제거**(#34·웹 #45): 프로 배지, 한도 박스, '남은 N개' 토스트. 여행 생성 무제한.
- **예약 서류 인식 확인 화면**(#35): 공항은 목록 검색, 날짜·시간 입력 칸, 빈 칸은 편명으로 찾아 채우기. 영어 날짜는 짧은 달 이름(#44). 종류를 안 고르고 올리면 **버튼마다** 빨간 표시(#47).
- **내 여행 화면**: 숫자 타일 6개 제거(#36), 탭 줄 항상 표시·필터·카드/목록·세계지도 삭제(#37), PC의 '진행 중·예정된 여행 / 지난 여행' 구역 제목 줄 삭제(#47).
- **일정 시간**: iPhone 시간 칸 정리, 시간 안 정한 장소는 12:00, 시각을 바꾸면 바로 그 자리로(#38). AI 추천도 12:00(#40).
- **도시 사진**: 여행 카드 사진은 DB `destinations.cover_url`(300곳)만 — 좌표 60km 안, 아니면 이름·slug, 없으면 정해 둔 기본 사진(#45·#46). 위키백과 조회와 코드에 박은 목록 삭제.
- **공항**: 로딩 표시 개선·탭 누를 때 미리 받기(#31), 인천 전광판 서버 정기 갱신(#29).
- **계정 삭제 시 Apple 로그인 토큰 철회**(#47·웹 #58, 가이드라인 5.1.1(v)) — §4.
- **약관·개인정보처리방침 10-17 개정**(#42·웹 #53): 위젯·워치·라이브 액티비티·위치·편명 조회, 제5조 한도 '두게 되면 미리 공지'. 앱 위치 권한 문구 갱신.
- 영어 댓글 입력 안내 줄임(#43).

## 4. 운영(서버·DB·설정)에 적용한 것
| 무엇 | 언제 | 되돌리기·비고 |
|---|---|---|
| `incheon-board` 함수 + `0115_incheon_board_cron.sql` (cron `airport-board-refresh`, 한국 06~24시 5분) | 10-16 | `select cron.unschedule('airport-board-refresh');` 하루 약 432회(상한 900) |
| `live-activity` 함수 + `0116_live_activity.sql` (cron `live-activity-tick`, 1분) | 10-17 08:23 | 되돌리기는 `0116` 머리말 |
| Vercel Production 환경 변수 `APPLE_TEAM_ID`·`APPLE_KEY_ID`·`APPLE_CLIENT_ID`·`APPLE_PRIVATE_KEY`(sensitive) | 10-18 | 값은 문서에 쓰지 않는다. 키 파일 `~/Desktop/Triptic 보안/Apple login/`. 없으면 철회만 건너뛰고 탈퇴는 진행 |
| 웹 배포(triptic.my) | 웹 #44~#58 | 웹 저장소 머지 = 배포 |
| Apple Developer: App Group·위젯 App ID | 10-16 | 워치 App ID는 Codemagic이 만듦 |
| Codemagic 빌드 기기 `mac_mini_m2` | 10-17 | 사용자 요청(#39) |

**Apple 토큰 철회 구조**: 앱이 탈퇴 직전 다시 로그인한 세션의 `provider_refresh_token`(없으면 `provider_token`)을 보낸다 — `app_metadata.provider === 'apple'`(Apple이 주 로그인)일 때만. 서버 `api/_lib/appleRevoke.js`가 ES256 client secret을 만들어 `https://appleid.apple.com/auth/revoke`에 보낸다. `APPLE_CLIENT_ID`는 Supabase가 웹 로그인에 쓰는 Services ID(`my.triptic.web`). **실패해도 탈퇴는 200**(로그만 남김). Apple은 가짜 토큰이면 client_id가 틀려도 200을 줘서 **설정을 미리 검증할 수 없다** — Apple로 가입한 시험 계정을 지운 뒤 Vercel 로그로 확인해야 한다(남은 일).

## 5. 빌드 기록 (Codemagic 팀 'Triptic', 워크플로 'Triptic iOS (TestFlight)')
| Codemagic | TestFlight | 내용 |
|---|---|---|
| #15 | — | 실패: 워치 `SKIP_INSTALL=NO` |
| #16 | 1.0.1 (12) | 위젯·워치 첫 성공(`app/widget-watch`) |
| #17 | (13) | 워치 머리글 A안 |
| #18 | (14) | 라이브 액티비티 첫 컴파일 |
| #19 | (15) | 최신 main 위로 rebase |
| #20 | (16) | '지금' 방식, 시간 칸 |
| #21 | (17) | main `2bb36f1`(#25 머지 뒤 main 빌드 시작) |
| #22 | (18) | 영어 짧은 달 이름(#44) |
| #23 | (19) | 도시 사진 DB(#45) |
| #24 | (20) | DB 사진만(#46), main `3006b22` — 10-17 제출 후 취소 |
| #25 | **(21)** | 수정 4건(#47), main `6946aba` — **심사 중** |

## 6. App Store Connect 1.0.1 입력값
- **빌드**: 21.
- **이번 버전의 새로운 기능**(4개 언어 — 10-18 수정 4건은 넣지 않음):
  - 한국어
    ```
    - 홈·잠금 화면 위젯: 오늘의 다음 일정과 출발 시각을 바로 확인해요.
    - 애플워치 앱: 지금 일정과 다음 장소, 출발 시각을 손목에서 봐요.
    - 라이브 액티비티: 여행 당일 잠금 화면과 다이내믹 아일랜드에 일정이 뜨고, 출발 시간에 알려 드려요.
    - 예약 서류 인식 개선: 공항은 목록에서 고르고, 빈 칸은 편명으로 찾아 채워요.
    - 장소 시간을 바꾸면 일정 순서가 바로 맞춰져요.
    - 그 밖의 오류 수정과 화면 개선.
    ```
  - 영어(호주)
    ```
    - Home & Lock Screen widgets: see your next stop and when to leave at a glance.
    - Apple Watch app: your current stop, next stop and departure time on your wrist.
    - Live Activities: on trip days, your plan appears on the Lock Screen and Dynamic Island, with an alert when it's time to leave.
    - Smarter booking scan: pick airports from a list, and empty fields are filled in from the flight number.
    - Change a stop's time and your day reorders instantly.
    - Bug fixes and design improvements.
    ```
  - 일본어
    ```
    - ホーム画面・ロック画面のウィジェット：次の予定と出発時刻をすぐに確認できます。
    - Apple Watch アプリ：今の予定、次の場所、出発時刻を手元で確認できます。
    - ライブアクティビティ：旅行当日はロック画面とダイナミックアイランドに予定が表示され、出発時刻にお知らせします。
    - 予約書類の読み取りを改善：空港は一覧から選べて、空欄は便名から調べて補います。
    - 場所の時刻を変えると、日程の順番がすぐに並び替わります。
    - そのほかの不具合の修正と画面の改善。
    ```
  - 중국어(번체)
    ```
    - 主畫面・鎖定畫面小工具：立即查看下一個行程與出發時間。
    - Apple Watch App：在手腕上查看目前行程、下一個地點與出發時間。
    - 即時動態：行程當天，行程會顯示在鎖定畫面與動態島，並在出發時間提醒你。
    - 訂位文件辨識更聰明：機場可從清單中選擇，空白欄位會依航班號碼查詢補上。
    - 修改地點時間後，行程順序會立即重新排列。
    - 其他錯誤修正與畫面改善。
    ```
- **iPhone 스크린샷**: 한국어 칸 = 한국어 8장, 영어(호주)·일본어·중국어(번체) 칸 = 영어 8장. 1320×2868로 만들어 1206×2622로 올림. 순서: 예약 서류 자동 채우기 → 동행 찾기 → 항공권 검색 → PDF 일정표 → 내 여행 통계 → 공항 정보 → 함께 편집 → 경비·더치페이. 화면 속 사람·여행·글은 모두 예시 데이터(로컬 앱을 가짜 데이터로 촬영 — 운영 계정·비밀번호 안 씀). 미리보기: https://claude.ai/artifact/BLBDJq8edy8RmxVVnxDa6k
- **Apple Watch 스크린샷**: 2장, 416×496(워치 앱이 들어가면 필수).
- **개인정보처리방침 URL(언어별)** — ASC 'App Privacy' 페이지에 있다(앱 정보 화면 아님): 영어(호주) `https://triptic.my/privacy-en.html`, 일본어 `…/privacy-ja.html`, 중국어(번체) `…/privacy-zh-TW.html`, 한국어 `…/privacy.html`. 제출 때 '공유 앱 정보 변경'으로 3개가 함께 나감.
- **App Privacy(수집 정보)**: 바꾸지 않음 — 라이브 액티비티 데이터는 이미 신고한 '기기 ID'·'기타 사용자 콘텐츠'에 들어가고, 정확한 위치는 기기 밖으로 안 나간다.
- **심사관 메모(3,993자)**: `docs/launch/review-2026-10/app-review-notes.txt` 바탕에서 위치 문장을 바꾸고 1.0.1 안내를 붙였다.
  ```
  - Location (while using the app) is used on the device only: to centre the map, and on the Apple Watch app and Live Activity to show the distance to today's stops. It is never sent to our server.

  New in 1.0.1 (to test with the demo account, open a trip whose dates include today and add places with times):
  - Home/Lock Screen widget "Next stop": add the Triptic widget from the Home Screen.
  - Apple Watch app: shows the current and next stop of today's trip.
  - Live Activity: starts automatically when the app is opened on a trip day; can be turned off in iOS Settings > Triptic > Live Activities.
  ```

## 7. 사용자 결정 (이 기간)
- 위젯·워치·라이브 액티비티는 1.1.0이 아니라 **1.0.1에 포함**.
- 워치는 두 쪽 대신 **한 화면 C안**, 라이브 액티비티는 **라이브 2안**(시안 캔버스 https://claude.ai/artifact/4QGxUzsUEwKUwy7yYkr8AA).
- 라이브 액티비티: 앱 열면 자동 켜기 / 갱신은 서버 푸시 / 서버가 다시 켜기(push-to-start). GPS 거리는 앱이 열려 있을 때만(A안 — '항상 허용' 권한 안 씀).
- '지금' = 시간 기준 + 도착 보정(300m 도착, 30km 안만 거리).
- 약관 제5조 '한도를 둘 수 있다'는 유지, 10-17 개정으로 '두게 되면 미리 공지'.
- 스크린샷: 카드뉴스 순서 그대로 8장, 한국 스토어 = 한국어 / 호주·일본·대만 = 영어.
- 도시 사진은 **DB 300곳 사진만**(위키백과 금지), 1.0.1에 포함.
- 10-18 수정 4건 → 1.0.1 (20) 제출 취소 후 (21)로 다시 제출. '새로운 기능' 문구는 그대로.
- 빌드 기기 `mac_mini_m2`.

## 8. 남은 일
- [ ] 심사 결과 대응(문의·거절이 오면 사용자가 본문을 주고, 답장·재제출은 사용자 승인 뒤).
- [ ] Apple 토큰 철회 실사용 확인 — Apple로 가입한 시험 계정 삭제 → Vercel 로그에서 `[deleteAccount] apple token revoked` 또는 `apple token not revoked: <이유>`(not_configured·no_token·bad_key·rejected·network) 확인(§4).
- [ ] 스마트 앱 배너 — 웹 `index.html`에 `<meta name="apple-itunes-app" content="app-id=6820429874">`(+`app-argument`), 웹 저장소 PR.
- [ ] (검토) 워치 컴플리케이션·스마트 스택 위젯.
- [ ] 영어 통계 문구 '5 trip(s) together' 다듬기.
- [ ] 앱 i18n 검사의 기존 실패 `dateDialog.confirmRange`(이번 작업과 무관, 예전부터).

## 9. 이 기간에 배운 것
1. **로그인 필요한 API는 `applyCors(..., 'Content-Type, Authorization')`, 공개 조회 API는 ACAO `*`** — 앱(`capacitor://localhost`)은 다른 출처라 빠지면 앱에서만 실패한다. Vercel CDN 캐시가 Origin 없는 요청으로 채워지면 ACAO가 빠진 응답이 앱에 간다(웹 #46·#47).
2. 워치 앱 타깃은 `SKIP_INSTALL`을 켜야 아카이브가 앱으로 나온다(#15 실패).
3. TestFlight에서 다시 설치가 안 되면 테스터를 지웠다가 다시 추가한다.
4. 위키백과로 도시 사진을 찾으면 300곳 중 49곳이 인물·동음이의 문서였다(예: 한국어 '호치민' → 인물 호찌민). 도시 사진은 우리 DB만 쓴다.
5. CSS를 스크립트로 자를 때 기준 문자열 순서가 바뀌면 파일 전체가 망가진다 — 바꿀 문자열이 정확히 한 번 있는지 확인(CLAUDE.md 함정 6).
6. ASC: 워치 앱이 들어간 버전은 Apple Watch 스크린샷이 필수. 언어별 개인정보처리방침 칸은 'App Privacy' 페이지. 제출 취소하면 버전은 Developer Rejected가 되고 입력값은 남는다.
7. Apple `auth/revoke`는 가짜 토큰에 200을 준다 — 설정 검증은 실제 토큰으로만.

## 10. 기록·파일 위치
- 에이전트 메모리: `~/.claude/projects/-Users-benlee-Desktop-Dev-triptic-ios/memory/` — `project_widget-watch.md`(1.0.1 경과 전부), `project_post-release-todo.md`, `feedback_*.md`(작업 규칙).
- 위젯·워치·라이브 액티비티 구조: `docs/ios-widget-watch.md`, 프로젝트 파일 생성 `scripts/ios-add-widget-watch.rb`, 순수 계산 시험 `sh ios/Tests/run.sh`.
- 스토어 입력값(1.0.0 기준 전체): `docs/launch/app-store-listing.md`. 심사 답장: `docs/launch/review-2026-10/`.
- 스크린샷 원본: 바탕화면 'Triptic 앱스토어 스크린샷 1.0.1' 폴더는 사용자가 지웠다(10-18, ASC에 올라가 있어 필요 없음). 다음 버전은 ASC가 이전 스크린샷을 이어 쓴다. 문구·화면을 바꿀 때만 새로 만든다(가짜 데이터로 로컬 앱 촬영 → 1320×2868).
