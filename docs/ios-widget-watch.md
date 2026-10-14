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

## 워치 화면 디자인 (2026-10-14 확정: 시안 C)
- **한 화면에 하나씩 크게** — 1쪽 '현재 위치'(가장 가까운 장소 + 거리), 2쪽 '다음 장소 + 큰 출발 시각 + "출발 · N분 후" + "이동 약 N분"'. watchOS 10+는 위아래(디지털 크라운), 9는 옆으로 넘긴다. 쪽 점 표시는 시스템이 그린다.
- **곧 출발 = 20분 이하**(`TripLogic.urgentMinutes`)이면 2쪽 출발 시각·문구가 주황.
- **위치를 못 잡으면 시각 기준으로 대신 안내**: 1쪽이 '지금 일정'(시각이 지난 마지막 장소, 없으면 '첫 일정 전')으로 바뀌고 아래에 '위치 확인 중…' 또는 '위치를 허용하면 가까운 곳을 알려줘요'를 작게. 2쪽도 시각 기준 다음 장소.
- 장소 이름은 최대 2줄·글자 줄이기(0.75~0.8배), 40mm에서 긴 이름으로 웹 시안을 그려 넘침 없음을 확인(실제 워치는 TestFlight로 확인 필요). 큰 글자 설정에서도 페이지 안에서 잘리지 않게 크기를 줄이는 방식.
- 시안 이미지는 `brag-output/work/store/watch-render.mjs`로 만든 것(저장소 밖) — 확정 내용은 위 글로만 남긴다.

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
- 이 변경은 1.0.0 심사 빌드와 **무관**하다(브랜치 `app/widget-watch`). 1.1.0으로 올릴 때 합친다.
