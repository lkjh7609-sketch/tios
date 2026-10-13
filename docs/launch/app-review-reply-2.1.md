# App Review 답변 초안 — Guideline 2.1 Information Needed (2026-10-13)

심사 결과(2026-10-12 제출 → 10-13 회신): **Rejected — 2.1.0 Performance: App Completeness / Information Needed – New App Submission.** 버그가 아니라 **정보 요청**이다(개발자 계정의 심사 이력이 적은 신규 앱이라 추가 설명 요구). 새 빌드 없이 **App Store Connect에서 답장 + 영상 첨부 + 같은 내용을 App Review Information의 Notes에 추가 → Resubmit to App Review**.
Apple이 요구한 것: ① 실기기 화면 녹화 ② 앱 목적·대상 ③ 사용 방법·로그인 정보 ④ 외부 서비스 목록 ⑤ 지역별 차이 ⑥ 규제 산업/제3자 자료 증빙.

⚠️ 비밀번호는 여기 쓰지 않는다 — 심사용 계정 `apple.review@triptic.my`의 비밀번호는 `~/Desktop/Triptic 보안/App Review/demo-account.txt`.

---
## ① 화면 녹화(사용자가 실기기에서 — 내가 대신 못 한다)
- **최신 iOS 아이폰 실기기**에서 **앱 아이콘을 눌러 켜는 순간부터** 한 번에 녹화(화면 기록, 3~5분, 소리 없어도 됨. 영어 자막/음성이 있으면 더 좋음).
- 순서: ① 앱 실행 → ② **계정 만들기**(새 이메일로 가입 — 테스트용 따로) → ③ 알림 권한 팝업 → ④ **새 여행 만들기 → 장소 추가 → 지도에서 동선 확인** → ⑤ **커뮤니티 → 글 쓰기 → 다른 사람 글의 ⋮ → 신고 → 사용자 차단**(신고·차단 장면이 꼭 보여야 함) → ⑥ 동행 찾기 모집글 보기·지원 → ⑦ 항공 탭 검색 → 예약하기(인앱 브라우저) → ⑧ **설정 → 알림 설정** → ⑨ **설정 → 계정 삭제**(⚠️ 가입한 **테스트 계정**으로 — **심사용 데모 계정으로 삭제하지 말 것**) → ⑩ 마지막에 데모 계정으로 다시 로그인되는 화면.
- 유료 콘텐츠·인앱결제는 없음(영상에서 따로 보일 것 없음, 답장에 명시).

---
## 답장 본문(영어) — Reply to App Review에 붙여 넣기 + Notes에도 같은 내용
```
Hello App Review team, thank you for the feedback. Here is the information you requested. Three screen recordings captured on a physical iPhone (launching the app, account registration, login with e-mail and Sign in with Apple, user-generated content with reporting/blocking, and account deletion) are attached.

1) Screen recordings (3 files, captured on a physical iPhone; each starts from launching the app)
- video1_full_flow.mp4 (4:33): e-mail account registration with e-mail confirmation, creating a trip, posting in the community with a photo, creating a companion recruitment post, flight search and the booking link opening in the in-app browser, notification settings, blocking a user from a post's menu, and account deletion (done with a separate test account).
- video2_demo_login.mp4 (0:53): login with the demo account provided in App Review Information, push notification permission, home, the airport tab and settings.
- video3_apple_login_report.mp4 (0:47): Sign in with Apple, then reporting another user's post (reason selection and confirmation).
The app has no paid content, subscriptions or in-app purchases.

2) Purpose and target audience
Triptic is a free travel-planning app for independent travelers (mainly adults in their 20s–40s in Korea, Japan, Taiwan and Australia). It solves the problem of travel plans being scattered across notes, screenshots, chat rooms and booking e-mails: users build a day-by-day itinerary on a map, import flight/hotel booking confirmations (OCR), co-edit a trip with friends, search flights and hotels, find travel companions, and read/write short trip stories by destination.

3) How to use the main features (demo account)
- Sign in with the demo e-mail account (apple.review@triptic.my; the password is in the Password field of App Review Information). Sign in with Apple, Google, Kakao and e-mail sign-up are also supported.
- My trips tab: "New trip" creates a trip; open it to add places per day, see the route on the map, add a hotel, flights and expenses.
- Community tab: destination boards and a free board (posts, comments, likes). Companion tab: recruitment posts, applying, group chat after matching.
- Flights tab: fare list; "Book" opens the partner site in an in-app browser. Hotels / tours open partner sites in an in-app browser.
- Settings (My tab): notifications on/off, language (Korean/English/Japanese/Traditional Chinese), blocked users, and "Delete account" at the bottom.
- User-generated content safeguards: every post, comment and companion listing has a "⋮" menu with Report and Block. Reports are reviewed by the operator within 24 hours, objectionable content and abusive users are removed (zero tolerance, see Terms of Service). Contact: admin@triptic.my.

4) External services used
Supabase (authentication, database, file storage, edge functions); Vercel and Cloudflare (hosting/CDN); Sign in with Apple, Google Sign-In and Kakao Login (authentication); Apple Push Notification service (notifications); Apple WeatherKit (weather); Google Maps Platform (maps, place search, routes) and Google Cloud Vision (OCR of booking documents); DeepSeek via OpenRouter (AI place recommendations and extracting booking fields — sensitive numbers are masked before sending); Resend (transactional e-mail); PostHog and Sentry (usage analytics and crash reports; no advertising identifiers, no tracking); Ignav (flight fare data); partner sites opened in the in-app browser: Agoda, MyRealTrip, Trip.com, Kiwi.com, Klook, Usimsa. Incheon Airport and Korea Airports Corporation public flight-status APIs (data.go.kr) feed the Airport tab.

5) Regional differences
The app is the same in every region and nothing is removed per country. Differences: (a) the interface language follows the user's choice (Korean, English, Japanese, Traditional Chinese); (b) the flight "Book" button opens Trip.com for Korean-language users and Kiwi.com for other languages; (c) the Airport tab shows live boards for Korean airports only (Korean public data); (d) partner offers (tours, SIM cards) vary by partner and language. The app is offered in Korea, Australia, Japan and Taiwan.

6) Regulated industry / protected third-party material
The app is not in a regulated industry and does not distribute protected third-party material. Travel prices and availability come from licensed/partner APIs and partner sites; booking and payment happen on the partner's site, not in the app.

Thank you. Please let us know if anything else is needed.
```

---
## 제출 순서
1. 위 ① 영상 촬영 → 2. ASC: 이 심사 제출 화면(Messages) → **Reply to App Review**에 본문 붙여 넣고 영상 첨부 → 전송 → 3. **App Review Information → Notes**에 같은 본문(영상 제외) 추가(Apple이 "향후 제출에 참고하도록 Notes에도" 요구) → 4. **Resubmit to App Review**.
- 답장·재제출은 Apple로 나가는 것이라 **사용자 확인 후** 진행한다. 새 빌드는 필요 없다(빌드 11 유지). 1.0.1(약관 링크 수정 등)은 승인 뒤에.
