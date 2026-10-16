# 위젯 + 애플워치 (iOS 1.1.0 후보 · 2026-10-12 시작)

오늘 여행의 **다음 장소·출발 시각**을 홈/잠금 화면 위젯과 애플워치에 보여 준다. 워치는 GPS로 일정 장소 중 **가장 가까운 곳을 '현재 위치'**로 잡는다.
⚠️ 이 컴퓨터에는 Xcode가 없어 **Swift 코드를 실제로 빌드해 보지 못했다** — 문법 검사(macOS SDK)와 순수 계산 시험만 했다. 첫 Codemagic 빌드가 진짜 검증이다.

## 구조
```
웹 화면(src/shared/widgetSync.ts, useWidgetSync.ts)
   일정 변경·앱 재개·언어 변경 때 오늘~14일 안 여행을 JSON(SharedPayload)으로 만든다
        │  Capacitor 플러그인 TripShare (ios/App/App/TripSharePlugin.swift)
        ▼
TripSync (ios/App/App/TripSync.swift)
   ├─ 앱 그룹 UserDefaults(group.com.triptic.travel) ──► 위젯 (ios/App/TripticWidget)  — 시각 기준 '지금 일정' + 다음 장소·출발 시각
   └─ WatchConnectivity applicationContext ───────────► 워치 앱 (ios/App/TripticWatch) — GPS 가장 가까운 장소 + 다음 장소·출발 시각
공통 계산: ios/App/Shared (TripModels·TripLogic·TripStrings) — 세 대상이 같은 파일을 쓴다. 시험: `sh ios/Tests/run.sh`
```
- **출발 시각** = 다음 장소의 시각 − 이동 시간. 이동 시간은 길 찾기 API 없이 **거리로 추정**(1.2km 이하 걷기 분당 80m, 그 이상 대중교통 8분 + 분당 350m). 화면에는 '이동 약 N분'.
- **오늘** = 여행 기간 안이면 `(오늘 − 시작일 + 1)`일차. 기간 밖이면 7일 안에 시작하는 여행을 'D-N'으로, 아니면 '오늘은 일정이 없어요'.
- 언어는 앱에서 고른 언어(ko/en/ja/zh-TW)를 JSON에 실어 보낸다 — 위젯·워치가 그것을 따른다(없으면 기기 언어).
- 로그아웃하면 앱 그룹·워치 데이터를 지운다. 위젯·워치는 로그인·네트워크가 없다.
- 위젯은 GPS를 쓰지 않는다(위젯은 위치를 마음대로 못 쓴다). 워치만 GPS.

## 워치 화면 디자인 (2026-10-17 사용자 결정: 한 화면 · 경로 타임라인)
- 10-14에 정한 두 쪽(1쪽 현재 위치 / 2쪽 다음·출발)은 실기기 확인 뒤 **버리고 처음 구상대로 한 화면**으로. 시안 캔버스(비공개): https://claude.ai/artifact/4QGxUzsUEwKUwy7yYkr8AA — 워치 'C · 경로 타임라인' 선택.
- 맨 위 시계와 같은 줄(툴바 왼쪽, watchOS 10+) **'1일차'만**. 본문 첫 줄 **여행 이름**(길면 줄바꿈, 자르지 않음), 조금 띄우고:
  - 1행 ● `지금 · 350m`(GPS 거리, GPS가 없으면 `지금 · 그 일정 시각`) / 장소 이름 / `↓ 이동 약 25분`
  - 2행 ○ `다음 일정 · 14:45`(다음 장소의 **일정 시각**) / 장소 이름 / **큰 출발 시각 14:20** + `출발 · 18분 후`
  - 큰 숫자는 **출발 시각 = 다음 일정 시각 − 이동 시간**이다(일정 시각과 헷갈리지 않게 둘을 따로 보여 준다 — 사용자 지적).
  - 왼쪽 세로선이 ●와 ○를 잇는다. 내용이 길면 디지털 크라운으로 스크롤(`ScrollView`). watchOS 9는 '1일차'도 본문 맨 위.
- **곧 출발 = 20분 이하**(`TripLogic.urgentMinutes`)이면 ○·다음 라벨·출발 시각이 주황. **홈 화면 위젯도 같은 기준**(잠금 화면 위젯은 단색이라 색 없음).
- **위치를 못 잡으면 시각 기준으로 대신 안내**: 1행이 시각이 지난 마지막 장소(없으면 '첫 일정 전')가 되고 아래에 '위치 확인 중…' 또는 '위치를 허용하면 가까운 곳을 알려줘요'를 작게.
- 장소 이름은 줄바꿈(자르지 않음). 실제 모양은 TestFlight로 40mm·45mm 확인 필요.

## 라이브 액티비티 (2026-10-17 사용자 결정, 1.0.1에 포함)
잠금 화면·다이내믹 아일랜드·워치 스마트 스택(watchOS 11+, 시스템이 접힘 모양으로 보여 줌). 디자인은 캔버스 '라이브 2 · 경로 타임라인'.
- **켜기**: ① 여행 당일 앱을 열면 자동(1-a, `LiveActivityManager.refresh`) ② 서버가 첫 일정 60분 전에 push-to-start(iOS 17.2+). **8시간 제한** 때문에 서버가 7시간 30분마다 끄고 다시 켠다. iOS 16.2~17.1은 서버가 켤 수 없어 앱을 열 때만 켜진다.
- **'지금' 거리(A안, 2026-10-17)**: 앱을 열었을 때만, 이미 '앱 사용 중' 위치를 허용했으면 위치를 한 번 받아 가장 가까운 일정 장소를 '지금 · 350m'로(새 권한은 묻지 않음). 잠긴 동안 서버 푸시가 오면 시각 기준 '지금 · 14:00'으로 돌아간다. 장소 도착 감지(항상 허용 필요)는 써 보고 다음 버전에서 검토.
- **바꾸기·알림**: 일정 시각마다 '지금'이 바뀌고, 출발 20분 전 주황, **출발 시각에 알림(소리·진동, 우선순위 10)** — 워치를 차고 있으면 워치가 울린다. 나머지 갱신은 조용히(우선순위 5).
- **끄기**: 마지막 일정 60분 뒤.
- **구조**: 앱이 하루하루 '몇 시에 무엇을'(`TripLogic.liveSchedule`, 시각 기준 — GPS 없음)을 계산해 서버 함수 `live-activity`에 올리고(`live_activity_events`), DB 정기 실행(0116, 1분마다)이 그 시각에 APNs(`apns-push-type: liveactivity`, topic `com.triptic.travel.push-type.liveactivity`)로 보낸다. 서버는 다시 계산하지 않는다(시간대·출발 시각은 기기가 정답).
- 기기는 앱이 만든 임의 키(`deviceKey`, 64자)로만 구분 — 백그라운드에서 깨어나 토큰을 올릴 때 웹 화면·로그인이 없어서. 토큰은 `push_tokens`와 따로(`live_activity_tokens`, `live_activity_devices.start_token`).
- 데이터 모양: `TripActivityAttributes`(ios/App/Shared/TripModels.swift) ↔ 서버 `supabase/functions/live-activity/payload.ts`. 출발 시각은 Unix 초(숫자) — Date로 두면 JSON 날짜 기준(2001년)이 서버와 어긋난다.
- **적용 순서(운영, 사용자 확인 뒤)**: ① `supabase functions deploy live-activity` ② `0116_live_activity.sql` 실행 ③ Codemagic 빌드·TestFlight 확인. 되돌리기는 0116 머리말.
- ⚠️ Xcode 없이 작성 — ActivityKit·WidgetKit 코드는 문법 검사만 했다. 첫 Codemagic 빌드가 진짜 검증이다.

## 대상·번들 ID
| 대상 | 번들 ID | 최소 OS | 비고 |
|---|---|---|---|
| App | com.triptic.travel | iOS 15 | 앱 그룹 권한 추가 |
| TripticWidget | com.triptic.travel.widget | iOS 16 | 홈(소·중)·잠금(사각·한 줄) |
| TripticWatch | com.triptic.travel.watchkitapp | watchOS 9 | 워치 전용 단일 대상, 위치 권한 문구 4개 언어 |

프로젝트 파일은 `scripts/ios-add-widget-watch.rb`(xcodeproj 젬)로 만들었다. 대상 설정을 바꿀 때는 이 스크립트를 고쳐 다시 돌린다(여러 번 돌려도 같은 결과).

## 빌드 전에 사람이 해야 하는 것 (Apple Developer 사이트 — API로 못 한다)
1. https://developer.apple.com/account/resources/identifiers → **App Groups**에 `group.com.triptic.travel` 등록
2. Identifiers에서 `com.triptic.travel`과 새 `com.triptic.travel.widget`(없으면 만들기)에 **App Groups** 기능을 켜고 위 그룹을 선택. (워치 `com.triptic.travel.watchkitapp`은 Codemagic이 만들면 되고 앱 그룹 불필요)
3. Codemagic에서 이 브랜치로 빌드 → `fetch-signing-files`가 세 번들 ID의 프로파일을 받아 온다(새 기능을 켠 뒤라 앱 프로파일도 새로 만들어진다).
4. TestFlight에서 설치 → 확인 목록:
   - 폰 앱 로그인 → 홈 화면 위젯 추가(소·중), 잠금 화면 위젯 추가 → 오늘이 여행 기간이면 다음 장소·출발 시각이 보인다
   - 워치에서 Triptic 열기 → 위치 권한 허용 → '현재 위치'에 가장 가까운 장소와 거리, 아래에 다음 장소·출발 시각
   - 앱에서 일정을 고치면(몇 초 뒤) 위젯·워치가 바뀐다 / 로그아웃하면 비워진다 / 앱 언어를 바꾸면 문구 언어가 바뀐다

## 알려진 한계·다음 단계
- 위젯 '지금 일정'은 시각 기준(시각이 없는 장소는 건너뜀). GPS 기반 '현재 위치'는 워치에서만.
- 워치 컴플리케이션(워치 페이스)은 아직 없다 — 워치용 WidgetKit 확장을 더 추가하면 된다.
- 시간대: 기기 시간대 기준. 여행지와 기기 시간대가 다르면(출발 전 집에서 볼 때) 장소 시각이 어긋날 수 있다.
- 1.0.0 승인(2026-10-16) 뒤 **1.0.1에 함께 넣기로 결정**(사용자). 위젯·워치의 `MARKETING_VERSION`은 앱과 같아야 한다(다르면 업로드 거부) — `scripts/ios-add-widget-watch.rb`의 `VERSION`과 pbxproj를 앱 버전과 함께 올린다.
