# 트립틱 iOS 1.0.0 — App Store Connect 입력값 (2026-10-12)

> 복사해서 붙여 넣는 용도. 비밀번호 등 비밀값은 여기 쓰지 않는다(심사용 계정 비밀번호는 `~/Desktop/Triptic 보안/App Review/demo-account.txt`).
> 출시 범위: **대한민국 + 호주**, **무료**, **프로·인앱결제 없음**, iPhone 전용, 항공은 Ignav 목록 + Trip.com(한국어)/Kiwi.com(그 외) 예약.

## 1. 앱 정보 (App Information)
| 칸 | 값 |
|---|---|
| 이름(한국어) | 트립틱 - 만능 여행 플래너 *(이미 입력됨, 15자)* |
| 부제(한국어, 30자) | 일정부터 동행까지 한 번에 |
| 기본 언어 | Korean *(그대로)* |
| 카테고리 | Primary **Travel** / Secondary **Lifestyle** |
| 콘텐츠 권한(Content Rights) | “서드파티 콘텐츠를 포함하거나 표시·접근합니까?” → **예** → 필요한 권리를 갖고 있음에 체크. 이유: 이용자가 올린 글·사진, 제휴사(마이리얼트립·Agoda 등) 상품 정보·이미지, 지도 |
| 연령 등급(Age Ratings) | 아래 §6 |
| 라이선스 계약 | Apple 표준 계약 *(그대로)* |

## 2. 한국어 버전 정보 (1.0 Prepare for Submission → Korean)
**프로모션 텍스트(170자)**
> 항공권·호텔 검색부터 일정 짜기, 예약 서류 자동 인식, 동행 찾기까지. 여행 준비의 모든 것을 트립틱 하나로 끝내 보세요.

**설명(4000자)**
```
트립틱은 여행의 시작부터 끝까지 함께하는 만능 여행 플래너입니다.

■ 일정 짜기
도시와 날짜만 고르면 일정표가 만들어져요. 지도에서 장소를 검색해 담으면 핀과 이동 시간이 자동으로 계산되고, 숙소·항공편·경비·체크리스트까지 한곳에서 관리할 수 있어요.

■ 예약 서류 자동 인식
항공권·숙소 예약 확인서(PDF·사진·스크린샷)를 올리면 항공편, 숙소, 날짜와 시간을 읽어 일정에 채워 줘요.

■ 친구와 함께 편집
링크 하나로 친구를 초대하면 같은 일정을 실시간으로 함께 보고 고칠 수 있어요.

■ 동행 찾기
같이 갈 사람을 찾는 모집글을 올리고, 지원자를 수락하면 매칭 그룹 채팅방이 열려요. 만날 때는 QR 코드로 같은 그룹인지 확인할 수 있어요.

■ 여행자 커뮤니티
여행지별 게시판과 자유게시판에서 후기와 질문을 나누고, 팔로우·좋아요·스크랩을 할 수 있어요. 신고와 차단 기능으로 안전하게 이용할 수 있어요.

■ 항공·호텔·액티비티 검색
최저가 특가와 노선별 운임을 한눈에 보고, 호텔과 투어·액티비티를 검색해 제휴 사이트에서 예약할 수 있어요.

■ 공항 실시간 정보
인천·김포·김해·대구·제주 공항의 실시간 출·도착과 주차 현황을 확인하세요.

■ 나의 여행 통계
다녀온 나라와 도시를 세계 지도에 칠하고, 경비와 여행 습관을 한눈에 돌아볼 수 있어요.

■ 알림
출발이 가까워지면 알려 드리고, 내 글에 댓글이 달리거나 동행 신청이 오면 푸시 알림으로 알려 드려요. 알림은 설정에서 묶음별로 끌 수 있어요.

※ 서비스 이용은 무료예요. 일정 만들기에는 무료 이용 한도가 있어요.
※ 항공권·호텔·투어 예약은 제휴 사이트에서 이루어지며, 표시된 가격은 검색 시점의 참고 가격이에요.
```

**키워드(100자, 쉼표로 구분, 공백 없이)**
```
여행,여행계획,여행일정,플래너,동행,동행찾기,항공권,호텔,해외여행,공항,경비,체크리스트,여행커뮤니티
```
**지원 URL**: `https://triptic.my/terms.html` *(맨 아래 ‘문의’에 이메일이 있는 페이지. 지원 페이지를 따로 만들면 그 주소로 교체)*
**마케팅 URL(선택)**: `https://triptic.my`
**개인정보처리방침 URL**: `https://triptic.my/privacy.html`
**저작권**: `2026 이재헌`

## 3. 영어 버전 정보 (호주 스토어용 — Localization 추가 → English (Australia))
| 칸 | 값 |
|---|---|
| Name (30) | Triptic - Travel Planner |
| Subtitle (30) | Plan trips, find travel mates |
| Promotional text | From flights and hotels to itineraries, booking-document scanning and travel companions — plan your whole trip in one app. |
| Keywords (100) | travel,trip planner,itinerary,flights,hotels,travel buddy,companion,airport,expenses,checklist |

**Description**
```
Triptic is an all-in-one travel planner that stays with you from the first idea to the flight home.

PLAN YOUR TRIP
Pick a city and your dates and your itinerary is ready. Search for places on the map, add them to your day, and Triptic shows pins and travel times. Keep stays, flights, expenses and your packing checklist in one place.

SCAN BOOKING DOCUMENTS
Upload a flight or hotel confirmation (PDF, photo or screenshot) and Triptic reads the flight, stay, dates and times into your itinerary.

EDIT TOGETHER
Invite friends with a link and plan the same trip live, together.

FIND TRAVEL COMPANIONS
Post a request to find people to travel with. When you accept an applicant, a group chat opens, and you can confirm each other with a QR code when you meet.

TRAVELLER COMMUNITY
Share stories and ask questions in destination boards, follow other travellers, and report or block anyone to stay safe.

FLIGHTS, HOTELS AND ACTIVITIES
Compare fares by route, search hotels and tours, and book on our partners' sites.

LIVE AIRPORT INFO
Check live departures, arrivals and parking at Korean airports.

TRAVEL STATS
Colour in the countries you've visited and look back at your spending and travel habits.

NOTIFICATIONS
Get a heads-up as your trip gets closer, and push notifications for comments, replies and companion requests. Turn them off by group in Settings.

Triptic is free to use. There is a free limit on how many trips you can create.
Flight and hotel bookings are completed on partner sites, and prices shown are reference prices at the time of search.
```
Support/Marketing/Privacy URL은 한국어와 같다. (앱 UI는 영어 지원. 현재 호주 사용자에게 보이는 가격 통화·항공 검색 지역은 한국 기준이므로, 호주는 ‘한국 여행 정보를 보는 영어권 사용자’ 용도로 안내된다.)

## 4. 이 버전의 새로운 기능 (What's New) / 릴리스 노트
첫 버전(1.0.0)에는 이 칸이 안 나올 수 있다. 나오면:
- **한국어**: 트립틱 첫 출시! 일정 짜기, 예약 서류 자동 인식, 동행 찾기, 항공·호텔 검색, 공항 실시간 정보를 한 앱에서 만나 보세요.
- **English**: Welcome to Triptic! Plan itineraries, scan booking documents, find travel companions, search flights and hotels, and check live airport info — all in one app.

## 5. App Review 정보
- **로그인 필요**: 예
- **계정**: `apple.review@triptic.my` / 비밀번호는 `demo-account.txt` 참고(심사 화면에 직접 입력)
- **연락처**: 이름·전화·이메일(admin@triptic.my) 입력
- **메모(Notes)**
```
Triptic is a free travel planner. Sign-in options: Sign in with Apple, Google, Kakao, or email. A demo email account is provided above.

- Community and companion matching are user-generated content. Users can report and block from the "⋮" menu on any post, comment or companion listing, and the operator reviews reports within 24 hours. Contact: admin@triptic.my.
- Account deletion: Settings (My tab) > bottom of the screen > delete account.
- Push notifications are requested after sign-in and can be switched off in Settings > Notifications.
- Flights/hotels/activities open partner sites inside an in-app browser. We do not sell digital goods; there are no in-app purchases in this version.
- The camera is used only to scan a companion's QR code; the photo library is used to attach photos/booking documents; location (while using the app) is used only to centre the map.
```
- **푸시/Sign in with Apple/Universal Link**: 해당 설정은 앱 ID에 이미 켜져 있음.

## 6. 연령 등급 질문 — 권장 답
| 질문 유형 | 답 |
|---|---|
| 폭력·공포·성적 콘텐츠·욕설·약물/알코올/도박 묘사 | 모두 **없음** (이용자 글에서 나올 수 있지만 앱 자체 콘텐츠가 아님 — UGC 질문에서 다룸) |
| 사용자 생성 콘텐츠 / 메시징·채팅 | **예** (글·댓글·동행 채팅. 신고·차단·운영자 검토 있음) |
| 제한 없는 웹 접근 | **아니요** (정해진 제휴 사이트로 가는 링크만 인앱 브라우저로 열림) |
| 광고 | **아니요** |
| 도박·응모형 보상 | **없음** |
결과 등급은 Apple이 계산한다(UGC·채팅 때문에 보통 12+~16+ 범위). **18+가 나오면** 위 답 중 어느 질문이 원인인지 다시 확인.

## 7. App Privacy(수집 정보) — 입력값
**추적(Tracking)**: 아니요(다른 회사 앱·웹과 연결하지 않음, IDFA 미사용 → ATT 팝업 불필요).
**‘데이터 수집함’으로 답할 항목** (전부 *사용자에게 연결됨*, *추적에 사용 안 함*):

| 데이터 유형 | 목적 |
|---|---|
| 연락처 정보 → 이메일 주소 | 앱 기능 |
| 연락처 정보 → 이름 | 앱 기능 |
| 사용자 콘텐츠 → 사진 또는 비디오 | 앱 기능 |
| 사용자 콘텐츠 → 고객 지원 | 앱 기능 |
| 사용자 콘텐츠 → 기타 사용자 콘텐츠 (여행 일정·글·댓글·채팅·경비·나잇대·성별) | 앱 기능 |
| 식별자 → 사용자 ID | 앱 기능, 분석 |
| 식별자 → 기기 ID (푸시 토큰) | 앱 기능 |
| 위치 → 대략적 위치 (접속 국가) | 앱 기능 |
| 사용 데이터 → 제품 상호작용 (PostHog) | 분석 |
| 진단 → 비정상 종료 데이터 (Sentry) | 앱 기능 |
| 진단 → 성능 데이터 (Sentry) | 앱 기능 |

**수집 안 함**: 금융 정보(결제 없음), 건강, 연락처 목록, 정확한 위치(기기에서만 사용), 검색 기록, 구매, 민감 정보, 브라우징 기록, 광고 데이터.
이 표는 `ios/App/App/PrivacyInfo.xcprivacy`와 같다.

## 8. 가격 및 사용 가능 여부
- 가격: **무료**.
- 국가: **대한민국, 호주** (나중에 같은 화면에서 언제든 추가 가능). 호주 스토어용 영어 정보(§3)와 영어 스크린샷이 필요하다(스크린샷은 한국어 것을 같이 써도 된다).
- 유료 앱 계약·세금 정보는 무료 앱이라 필요 없음. EU DSA 거래자 신고는 EU를 선택하지 않으면 불필요.

## 9. 스크린샷
- iPhone 6.9형 규격 **1320×2868**(또는 1290×2796) — 업로드 칸에서 요구 규격이 표시된다. 필수는 이 한 세트이고 나머지 크기는 자동 축소된다.
- 최소 1장, 최대 10장. 추천 순서: 홈 → 일정 상세 → 예약 서류 인식 → 동행 찾기 → 커뮤니티 → 항공 검색 → 공항 → 내 여행 통계.
- 내 iPhone(393pt)에서 화면 캡처(전원+볼륨 업) → 파일을 모아 주면 규격에 맞춰 변환(`sips`).

## 10. 일본어 · 중국어(번체, 대만) — 2026-10-12 App Store Connect에 입력함
- **판매 국가**: 한국·호주·일본·대만(4개국). 모두 "출시 시 판매".
- **이름은 일본어·중국어(번체) 모두 영어 `Triptic`**(한국어 목록 이름은 '트립틱 - 만능 여행 플래너', 영어(호주)는 `Triptic - Travel Planner`). 설치된 앱 이름은 별개로 한국어 기기 `트립틱`, 그 밖 `Triptic`(앱의 `InfoPlist.strings`).
- **부제**: 일본어 `旅の計画から同行者探しまで` / 중국어(번체) `從行程規劃到尋找旅伴`
- **프로모션 문구**: 일본어 `航空券・ホテルの検索から旅程づくり、予約書類の自動読み取り、同行者探しまで。旅の準備はTripticひとつで。` / 중국어(번체) `從機票、飯店搜尋到行程規劃、訂位文件自動辨識與尋找旅伴，旅行準備一個 App 就搞定。`
- **키워드**: 일본어 `旅行,旅行計画,旅程,プランナー,同行者,航空券,ホテル,海外旅行,空港,経費,チェックリスト,韓国旅行` / 중국어(번체) `旅遊,行程規劃,旅行計畫,旅伴,機票,飯店,出國,機場,記帳,清單,社群,韓國旅遊`
- **설명**: 영어 설명(§3)을 번역한 9개 항목(旅程づくり/規劃行程 … 通知) + 무료 한도·제휴 사이트 안내.
- **지원·마케팅 URL, 개인정보처리방침 URL**은 한국어와 같다(`terms.html`·`triptic.my`·`privacy.html`).
- **스크린샷**은 한국어 것을 그대로 쓴다(언어별로 따로 올리지 않으면 기본 언어 것이 쓰인다). 일본·대만용으로 현지 화면을 따로 찍으려면 앱을 해당 언어로 바꿔 같은 방식으로 촬영한다.
