import Foundation
var fails = 0
func check(_ c: Bool, _ m: String, line: Int = #line) { if !c { fails += 1; print("FAIL line \(line): \(m)") } else { print("ok  \(m)") } }
var cal = Calendar(identifier: .gregorian); cal.timeZone = TimeZone(identifier: "Asia/Tokyo")!
func at(_ s: String) -> Date { let f = DateFormatter(); f.calendar = cal; f.timeZone = cal.timeZone; f.dateFormat = "yyyy-MM-dd HH:mm"; return f.date(from: s)! }

let osaka: [SharedPlace] = [
  SharedPlace(n: "구로몬 시장", lat: 34.6652, lng: 135.5063, t: "09:00"),
  SharedPlace(n: "오사카성", lat: 34.6873, lng: 135.5262, t: "10:50"),
  SharedPlace(n: "홋쿄쿠세이", lat: 34.6680, lng: 135.5013, t: "13:00"),
  SharedPlace(n: "우메다 공중정원", lat: 34.7053, lng: 135.4900, t: nil),
]
let trip = SharedTrip(id: "t1", title: "오사카 여행", start: "2026-11-13", end: "2026-11-16", days: ["1": [SharedPlace(n: "공항", lat: 34.43, lng: 135.24, t: "10:00")], "3": osaka])
let payload = SharedPayload(lang: "ko", updated: 0, trips: [trip])

// 상태
if case .active(let p) = TripLogic.state(payload, now: at("2026-11-15 09:30"), calendar: cal) { check(p.day == 3 && p.totalDays == 4 && p.places.count == 4, "11/15 = 3일차 4곳 중 3일차") } else { check(false, "active expected") }
if case .upcoming(_, let d) = TripLogic.state(payload, now: at("2026-11-10 12:00"), calendar: cal) { check(d == 3, "출발 3일 전 → upcoming 3") } else { check(false, "upcoming expected") }
check(TripLogic.state(payload, now: at("2026-10-01 12:00"), calendar: cal) == .none, "한 달 전 → none")
check(TripLogic.state(payload, now: at("2026-11-17 01:00"), calendar: cal) == .none, "종료 다음날 → none")
// 2일차는 장소가 없음 → upcoming 아님·active 아님
check(TripLogic.state(payload, now: at("2026-11-14 12:00"), calendar: cal) == .none, "장소 없는 일차 → none")
// 자정 경계: 11/15 00:10 도 3일차
if case .active(let p) = TripLogic.state(payload, now: at("2026-11-15 00:10"), calendar: cal) { check(p.day == 3, "자정 직후 3일차") } else { check(false, "midnight active") }

// 거리·이동
check(abs(TripLogic.distanceMeters(35.6812, 139.7671, 35.6812, 139.7671)) < 0.001, "같은 좌표 0m")
let d = TripLogic.distanceMeters(34.6652, 135.5063, 34.6873, 135.5262); check(d > 2900 && d < 3200, "구로몬→오사카성 약 3km (\(Int(d))m)")
check(TripLogic.travelMinutes(forMeters: 30) == 0, "30m → 0분")
check(TripLogic.travelMinutes(forMeters: 800) == 10, "800m 걷기 10분")
check(TripLogic.travelMinutes(forMeters: 3050) == 8 + 9, "3.05km 대중교통 17분")

// 가장 가까운 장소
let n = TripLogic.nearest(lat: 34.6870, lng: 135.5260, in: osaka)!; check(n.index == 1 && n.meters < 100, "오사카성 앞 → index 1")
check(TripLogic.nearest(lat: 0, lng: 0, in: []) == nil, "빈 목록 nil")

// 시각 기준 현재
check(TripLogic.currentIndexByTime(osaka, now: at("2026-11-15 08:00"), calendar: cal) == -1, "08:00 → 첫 일정 전")
check(TripLogic.currentIndexByTime(osaka, now: at("2026-11-15 11:30"), calendar: cal) == 1, "11:30 → 오사카성")
check(TripLogic.currentIndexByTime(osaka, now: at("2026-11-15 20:00"), calendar: cal) == 2, "시각 없는 마지막은 건너뜀 → 2")

// 다음 장소·출발 시각(GPS 좌표 있을 때)
let now = at("2026-11-15 12:00")
let ns = TripLogic.nextStop(places: osaka, currentIndex: 1, fromLat: 34.6873, fromLng: 135.5262, now: now, calendar: cal)!
check(ns.place.n == "홋쿄쿠세이", "다음 = 홋쿄쿠세이")
check(ns.travelMinutes > 10 && ns.travelMinutes < 30, "이동 \(ns.travelMinutes)분 대략")
check(ns.departAt != nil && ns.minutesUntilDeparture != nil && ns.minutesUntilDeparture! < 60 && ns.minutesUntilDeparture! > 20, "출발까지 \(ns.minutesUntilDeparture ?? -1)분")
// 다음 장소에 시각이 없으면 출발 시각 없음
let ns2 = TripLogic.nextStop(places: osaka, currentIndex: 2, now: now, calendar: cal)!
check(ns2.departAt == nil && ns2.minutesUntilDeparture == nil && ns2.place.n == "우메다 공중정원", "시각 없는 다음 장소")
check(TripLogic.nextStop(places: osaka, currentIndex: 3, now: now, calendar: cal) == nil, "마지막 장소 → nil")
// 첫 일정 전(-1)
let ns3 = TripLogic.nextStop(places: osaka, currentIndex: -1, now: at("2026-11-15 08:00"), calendar: cal)!
check(ns3.place.n == "구로몬 시장" && ns3.travelMinutes == 0 && ns3.minutesUntilDeparture == 60, "첫 일정 전: 09:00까지 60분")
// 이미 늦음
let ns4 = TripLogic.nextStop(places: osaka, currentIndex: 1, fromLat: 34.7053, fromLng: 135.4900, now: at("2026-11-15 12:55"), calendar: cal)!
check(ns4.minutesUntilDeparture! < 0, "늦음 \(ns4.minutesUntilDeparture!)분")

check(TripLogic.urgentMinutes == 20, "곧 출발 기준 20분")
check(TripStrings.format("leaveIn", "en", TripStrings.untilText(minutes: 42, "en")) == "Leave in 42 min", "영어 출발 문구")
check(TripStrings.format("dDay", "ja", 3) == "あと3日" && TripStrings.format("dDay", "ko", 3) == "D-3", "D-day 문구")
// 문구·JSON
check(TripStrings.resolve("zh-Hant-TW") == "zh-TW" && TripStrings.resolve("ja-JP") == "ja" && TripStrings.resolve("fr") == "en", "언어 정규화")
check(TripStrings.format("leaveBy", "ja", "13:05") == "13:05 出発", "일본어 출발")
check(TripStrings.untilText(minutes: 75, "en") == "in 1h 15m" && TripStrings.untilText(minutes: 0, "ko") == "지금 출발", "남은 시간 문구")
check(TripStrings.distanceText(240) == "240m" && TripStrings.distanceText(1530) == "1.5km", "거리 문구")
let json = String(data: try! JSONEncoder().encode(payload), encoding: .utf8)!
check(TripShareKeys.decode(json) == payload, "JSON 왕복")
check(TripShareKeys.decode("{bad") == nil, "깨진 JSON nil")
// 라이브 액티비티 일정(오사카 3일차: 09:00, 10:50, 13:00, 시각 없음)
let live = TripLogic.liveSchedule(osaka, on: at("2026-11-15 00:00"), calendar: cal)
check(live.first?.kind == .start && live.first?.at == at("2026-11-15 08:00"), "첫 일정 60분 전 켜기")
check(live.last?.kind == .end && live.last?.at == at("2026-11-15 14:00"), "마지막 일정 60분 뒤 끄기")
check(live.filter { $0.kind == .start }.count == 1, "6시간 하루는 한 번만 켠다")
check(zip(live, live.dropFirst()).allSatisfy { $0.at <= $1.at }, "시각순")
let departs = live.filter { $0.kind == .depart }
check(departs.count == 2, "출발 알림 2번(오사카성·홋쿄쿠세이) — \(departs.count)")
check(departs.first?.nextIndex == 1 && departs.first?.go == true && departs.first?.urgent == true, "첫 출발 알림은 오사카성으로, 지금 출발")
if let d0 = departs.first?.departAt { check(d0 == departs.first?.at && d0 < at("2026-11-15 10:50"), "출발 시각 = 일정 시각 − 이동 시간") }
check(live.contains { $0.kind == .update && $0.hereIndex == 1 && $0.at == at("2026-11-15 10:50") }, "10:50에 지금=오사카성으로 바뀜")
check(live.contains { $0.kind == .update && $0.urgent && !$0.go && $0.nextIndex == 1 }, "출발 20분 전 주황으로 바뀜")
check(TripLogic.liveSchedule([SharedPlace(n: "a", lat: 1, lng: 1, t: nil)], on: at("2026-11-15 00:00"), calendar: cal).isEmpty, "시각 없는 하루는 켜지 않음")
let longDay = [SharedPlace(n: "a", lat: 35, lng: 139, t: "07:00"), SharedPlace(n: "b", lat: 35.01, lng: 139, t: "21:00")]
check(TripLogic.liveSchedule(longDay, on: at("2026-11-15 00:00"), calendar: cal).filter { $0.kind == .start }.count == 3, "16시간 하루는 7시간 30분마다 다시 켬(3번)")
if let a = TripLogic.activeTrip(payload, now: at("2026-11-15 09:30"), calendar: cal) { check(a.trip.id == "t1" && a.day == 3, "오늘 진행 중인 여행·일차") } else { check(false, "activeTrip") }
// 지금·다음 — 시간 기준 + 도착 보정(2026-10-17): 오사카 3일차 09:00 구로몬, 10:50 오사카성, 13:00 홋쿄쿠세이, 시각 없음 우메다
let t1130 = at("2026-11-15 11:30")
let p0 = TripLogic.position(osaka, now: t1130, calendar: cal)
check(p0.hereIndex == 1 && !p0.arrived && p0.hereMeters == nil && p0.next?.place.n == "홋쿄쿠세이", "위치 없음 → 시각 기준 지금 오사카성")
let pFar = TripLogic.position(osaka, lat: 37.5665, lng: 126.9780, now: t1130, calendar: cal)
check(pFar.hereIndex == 1 && pFar.hereMeters == nil && pFar.next?.travelMinutes == p0.next?.travelMinutes, "서울(멀리) → 거리 숨김, 이동 시간은 장소 사이(\(pFar.next?.travelMinutes ?? -1)분)")
check((pFar.next?.travelMinutes ?? 999) < 60, "멀리 있어도 이동 수천 분 같은 값 없음")
let pNear = TripLogic.position(osaka, lat: 34.69045, lng: 135.5262, now: t1130, calendar: cal)
check(pNear.hereIndex == 1 && !pNear.arrived && (pNear.hereMeters ?? 0) > 300 && (pNear.hereMeters ?? 0) < 400, "오사카성 350m → 지금 · 350m(도착 아님) \(Int(pNear.hereMeters ?? -1))m")
check(pNear.next?.travelMinutes != p0.next?.travelMinutes, "30km 안 → 이동 시간은 내 위치에서")
let pEarly = TripLogic.position(osaka, lat: 34.6689, lng: 135.5013, now: t1130, calendar: cal)
check(pEarly.hereIndex == 2 && pEarly.arrived && (pEarly.hereMeters ?? 999) < 300 && pEarly.next?.place.n == "우메다 공중정원", "13:00 장소에 11:30 도착 → 앞당김")
let pHotel = TripLogic.position(osaka, lat: 34.7053, lng: 135.4900, now: at("2026-11-15 08:00"), calendar: cal)
check(pHotel.hereIndex == -1 && !pHotel.arrived && pHotel.next?.place.n == "구로몬 시장", "아침에 마지막 장소(우메다) 옆이어도 '첫 일정 전' 그대로")
let pFirst = TripLogic.position(osaka, lat: 34.6655, lng: 135.5063, now: at("2026-11-15 08:30"), calendar: cal)
check(pFirst.hereIndex == 0 && pFirst.arrived && pFirst.next?.place.n == "오사카성", "첫 일정 장소에 먼저 도착 → 앞당김")
check(TripStrings.durationText(minutes: 40, "ko") == "40분" && TripStrings.durationText(minutes: 65, "en") == "1h 5m", "걸린 시간 문구")
check(TripStrings.format("earlyBy", "ko", "14:00", "40분") == "일정 14:00 · 40분 일찍", "일찍 도착 문구")
for k in ["now","nowTime","before","next","last","tomorrowDay","arrivedAt","earlyBy","noTime","startIn","startsNow","startShort","minutes","hourMinutes","leaveBy","leaveNow","inMin","inHourMin","late","travel","away","dayOf","day","nowAt","nextAt","leaveShort","liveStartBody","liveDepartTitle","liveDepartBody","noTrip","upcoming","upcomingToday","openApp","locating","needLocation","widgetName","widgetDesc","leaveIn","allowForNearest","startsToday","dDay"] { for l in ["ko","en","ja","zh-TW"] { check(TripStrings.string(k, l) != k, "문구 \(k)/\(l)") } }
print(fails == 0 ? "ALL PASS" : "\(fails) FAILED"); exit(fails == 0 ? 0 : 1)
