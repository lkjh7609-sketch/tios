# Triptic iOS 1.0.0 — 진행 현황 인수인계 (2026-10-15 기준)

> 새 에이전트는 **CLAUDE.md → 이 파일 → `docs/launch/app-store-listing.md`** 순서로 읽는다.
> 사용자(이재헌, Ben Lee)는 한국어로 대화하며 **간결한 답(caveman)** 을 선호한다. 자세한 설명은 "[explain]"을 붙였을 때만.
> **비밀값(키·토큰·비밀번호)은 코드·문서·채팅·메모에 쓰지 않는다.** 데모 계정 비밀번호는 `~/Desktop/Triptic 보안/App Review/demo-account.txt`에만 있다.

## 1. 지금 어디까지 왔나 (한 줄 요약)
**1.0.0(빌드 11)이 App Store 심사 중(재심사 대기).** Apple이 두 번 "정보 요청(2.1)"을 보냈고 둘 다 답변·재제출했다. 승인되면 아래 §6 목록을 순서대로 진행한다.

## 2. App Store Connect(ASC) 타임라인
| 날짜 | 일 |
|---|---|
| 2026-10-12 | 1.0.0 빌드 11 제출(한국·호주·일본·대만, 무료, iPhone 전용) |
| 10-13 | **거절 — Guideline 2.1 Information Needed(신규 앱 정보 요청)**: 실기기 화면 녹화, 앱 목적, 사용법·로그인, 외부 서비스, 지역별 차이, 규제 여부 |
| 10-14 | 영어 답장 + 영상 3개(실기기, ASC 4000자·10MB 제한 때문에 2번에 나눠 전송) + App Review Notes 교체 → **Update Review** → Ready for Review. 답장 원문: `docs/launch/review-2026-10/reply-2.1a-info-needed.txt`, 메모: `app-review-notes.txt` |
| 10-15 | **2.1(b) Information Needed — 사업 모델 문의**(iPad Air 11 M3로 심사). 설명문 "일정 만들기에는 무료 이용 한도가 있어요" 때문에 유료 여부를 물음. 조치: ASC 설명 4개 언어에서 그 문장 삭제(ko/en-AU/ja/zh-Hant), 영어 답장 전송(`reply-2.1b-business-model.txt`: 최초 기획엔 유료가 있었으나 무료 출시로 확정, 인앱결제·구독 없음) → 사용자가 **Update Review** 눌러 재제출 |
| 이후 | **Apple 응답 대기.** 또 문의/거절이 오면 사용자가 본문을 붙여 준다 → 대응(답장·재제출은 사용자 "보내/눌러" 승인 뒤) |

- 영상 3개(원본은 `~/Downloads/ScreenRecording_10-13-2026 …`, 줄인 사본은 작업 임시 폴더)는 저장소에 넣지 않았다. video1 4:33 전체 흐름(이메일 가입·확인, 여행, 커뮤니티 글, 동행 모집, 항공·Trip.com 인앱 브라우저, 알림 설정, 차단, 계정 삭제), video2 0:53 데모 로그인·푸시·공항·설정, video3 0:47 Apple 로그인+신고.
- 심사용 데모 계정: `apple.review@triptic.my` (비밀번호는 위 보안 폴더 파일).

### 심사 중 절대 하지 말 것
새 빌드 업로드, ASC 메타데이터·스크린샷 변경(이번처럼 심사관 질문 대응으로 사용자가 허락한 경우 제외), 데모 계정 변경, 빌드가 쓰는 서버/웹 API 변경, 운영 DB·함수 배포. 모든 "Apple로 나가는 행동"(답장·Update Review·제출)은 **사용자 명시 승인 후**.

## 3. 제품 결정(사용자)
- 가격: **무료, 인앱결제·구독·프로 없음**(Apple 3.1.1: 앱에서 외부 결제 유도 금지). 여행 생성 한도 **무제한**(`profiles.trip_limit`=1000, `0114_unlimited_free_trips.sql` 운영 적용 완료). 리딤 코드 폐기.
- 판매국 한국·호주·일본·대만. 앱 언어 ko/en/ja/zh-TW. 스토어 현지화 ko·en-AU·ja·zh-Hant(스크린샷 ja·zh-Hant 현지화본 업로드됨).
- 항공 = Ignav 운임 목록 + 예약 Trip.com(KR)/Kiwi.com, 호텔 Agoda, 투어 마이리얼트립·Klook. Kayak은 보류.
- 약관·방침: 한·영·일·중(번체) 4개 언어, 앱 언어를 따라 링크. 운영자 이름은 영/일/중 **Jea Hun Lee**, 한국어는 이재헌(영문 병기 여부 미정).
- 구독을 나중에 넣고 싶다: 가능(업데이트로). **StoreKit 인앱결제 필수**, ASC 구독 상품·약관 링크 등록, 사업자·유료 앱 계약 필요, 무료로 주던 핵심 기능을 갑자기 막지 않기.
- 남은 "한도" 흔적(심사관이 볼 수도 있음): 약관 제5조 "한도를 둘 수 있다", 완료한 여행 재편집 무료 5회 제한(`reopen_trip`, 결제와 무관). 또 문의 오면 정리 검토.

## 4. 저장소 / PR 상태
앱 `lkjh7609-sketch/tios`(`~/Desktop/Dev/triptic-ios`), 웹 `lkjh7609-sketch/Triptic`(`~/Triptic`, triptic.my 배포). **Xcode가 없다 — iOS 빌드는 Codemagic만.**

main에 머지됨: #12–#24, #26–#28, #30(출시 뒤 할 일 문서). 웹: #41–#43(번역 약관, 운영자 이름) 머지·배포됨.

**열려 있는 것(전부 출시 승인 뒤)**
| PR/브랜치 | 내용 | 적용 조건 |
|---|---|---|
| #25 `app/widget-watch` (초안) | 홈/잠금 위젯 + 애플워치 앱. **한 번도 빌드 안 함** | §6-6 |
| #29 `airport/incheon-cron` (초안) | 인천 전광판 5분 갱신(KST 06~24) | §6-5 |
| #31 `airport/loading-ux` (초안) | 공항 로딩 문구·뼈대 줄·탭 누를 때 미리 받기(앱 코드만) | §6-4 |
| `docs/free-wording` | 스토어 설명 문구 문서 반영 + 이 인수인계 문서 | 문서, 언제든 머지 |
| `docs/app-review-reply` | 2.1 답장 초안 문서(비밀번호 없음) | 선택 |

## 5. 알아 둘 함정(요약 — 상세는 CLAUDE.md)
1. 네이티브 판별은 `isNativePlatform()`(`window.Capacitor` 금지). 2. 약관·방침 원본은 **루트** `terms*.html`/`privacy*.html`(빌드가 public으로 복사). 3. WKWebView는 `target=_blank`를 무시 → 앱에서 약관 링크는 `staticPageUrl`·`externalLink` 사용. 4. Google Maps 키는 교체하지 않기로 결정(다시 묻지 말 것). 5. Apple Developer 사이트·App Group 등록은 사용자 로그인 필요. 6. Apple 로그인 계정 삭제 시 **토큰 폐기 미구현**(5.1.1(v)) — 출시 후 할 일. 7. 자동 모드 분류기가 ASC 입력 JS 등을 거부할 수 있음 — 우회하지 말고 사용자에게 허락을 구한다(이번엔 사용자가 "ASC 설명 수정 허용"이라고 해서 진행).

## 6. 승인 뒤 순서 (사용자가 "출시됐다"고 하면 바로 시작)
1. **1.0.1 빌드**(main): 약관 링크 수정(#23)·번역 연결(#26)·한도 무제한 화면 처리(#22)가 이미 main에 있음 → Codemagic 빌드 → TestFlight 확인 → ASC에 새 버전.
2. **스마트 앱 배너**: 웹 `index.html`에 `<meta name="apple-itunes-app" content="app-id=6820429874">`(+`app-argument`) — 웹 저장소 PR.
3. **ASC 개인정보처리방침 URL 언어별**: en `https://triptic.my/privacy-en.html`, ja `…/privacy-ja.html`, zh-Hant `…/privacy-zh-TW.html`, ko `…/privacy.html`.
4. **#31 머지**(공항 로딩 개선).
5. **#29 인천 전광판 갱신**: ① `supabase functions deploy incheon-board` ② `0115_incheon_board_cron.sql` 실행(운영 적용은 사용자) ③ 머지. 되돌리기 `select cron.unschedule('airport-board-refresh');`. 하루 외부 호출 ≈432회(상한 900).
6. **위젯 + 애플워치(#25)**: 사용자가 Apple Developer에서 App Group `group.com.triptic.travel` 등록 + `com.triptic.travel`·`.widget` 번들 ID에 App Groups 켜기 → Codemagic에서 `app/widget-watch` 브랜치 빌드 → 오류 수정 → TestFlight(40mm·45mm) 확인. 설계: `docs/ios-widget-watch.md`. 디자인 확정: 워치 시안 C(한 화면에 하나: 1쪽 현재 위치, 2쪽 다음 장소+출발 시각), **20분 이하 주황(urgent)**, GPS 불가 시 시각 기준 안내, 홈 위젯도 20분 주황. 계산 시험 `sh ios/Tests/run.sh`.
7. **Apple 로그인 토큰 폐기**(`api/deleteAccount.js`): Supabase OAuth에서 Apple refresh token을 얻는 방법 조사부터.

## 7. 메모리·기타 위치
- 에이전트 메모리: `~/.claude/projects/-Users-benlee-Desktop-Dev-triptic-ios/memory/` (`project_ios-1-0-0-submitted.md`, `project_post-release-todo.md`, `project_widget-watch.md` 등).
- 스토어 입력값 전체: `docs/launch/app-store-listing.md`. 변경 기록: `docs/updates/4-v1.1.0/changelog.md`.
- 스토어 스크린샷 생성 스크립트: `brag-output/work/store/`(git 무시됨, 데모 계정 정보는 제거함).
