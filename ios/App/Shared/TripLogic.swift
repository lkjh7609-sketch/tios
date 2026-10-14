import Foundation

// 오늘 일정에서 '현재 위치'(가장 가까운 장소 / 시각 기준)와 '다음 장소·출발 시각'을 계산한다. UI·프레임워크에 기대지 않는 순수 계산이라 따로 시험한다.

/// 오늘 보여 줄 상태
public enum TodayState: Equatable {
    case active(ActivePlan)
    case upcoming(title: String, daysUntil: Int)
    case none
}

/// 오늘 진행 중인 여행의 그날 일정
public struct ActivePlan: Equatable {
    public let tripTitle: String
    public let day: Int
    public let totalDays: Int
    public let places: [SharedPlace]
}

/// 다음 장소 안내
public struct NextStop: Equatable {
    public let place: SharedPlace
    public let travelMinutes: Int          // 지금 자리에서 다음 장소까지 이동 시간(추정)
    public let departAt: Date?             // 다음 장소 시각 − 이동 시간(다음 장소에 시각이 있을 때만)
    public let minutesUntilDeparture: Int? // 출발까지 남은 분(음수면 이미 늦음)
}

public enum TripLogic {
    /// 출발까지 이 분 이하로 남으면 '곧 출발'로 강조한다(주황) — 사용자 결정 2026-10-14
    public static let urgentMinutes = 20

    // MARK: 날짜

    static func ymd(_ date: Date, _ cal: Calendar) -> String {
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func parseYmd(_ s: String, _ cal: Calendar) -> Date? {
        let p = s.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }

    /// 두 날짜(시각 무시) 사이의 일 수
    static func dayDiff(from a: Date, to b: Date, _ cal: Calendar) -> Int {
        let da = cal.startOfDay(for: a)
        let db = cal.startOfDay(for: b)
        return cal.dateComponents([.day], from: da, to: db).day ?? 0
    }

    /// 지금 시각의 상태 — 오늘이 여행 기간 안이고 그날 장소가 있으면 active, 없으면 7일 안에 시작하는 여행이 있으면 upcoming
    public static func state(_ payload: SharedPayload, now: Date = Date(), calendar cal: Calendar = .current) -> TodayState {
        var upcoming: (String, Int)?
        for trip in payload.trips {
            guard let start = parseYmd(trip.start, cal), let end = parseYmd(trip.end, cal) else { continue }
            let sinceStart = dayDiff(from: start, to: now, cal)   // 오늘 − 시작일
            let untilEnd = dayDiff(from: now, to: end, cal)       // 종료일 − 오늘
            if sinceStart >= 0 && untilEnd >= 0 {
                let day = sinceStart + 1
                let total = dayDiff(from: start, to: end, cal) + 1
                let places = trip.days[String(day)] ?? []
                if !places.isEmpty {
                    return .active(ActivePlan(tripTitle: trip.title, day: day, totalDays: total, places: places))
                }
            } else if sinceStart < 0 && -sinceStart <= 7 {
                if upcoming == nil || -sinceStart < upcoming!.1 { upcoming = (trip.title, -sinceStart) }
            }
        }
        if let u = upcoming { return .upcoming(title: u.0, daysUntil: u.1) }
        return .none
    }

    // MARK: 거리·이동 시간

    /// 두 좌표 사이 거리(m, 하버사인)
    public static func distanceMeters(_ lat1: Double, _ lng1: Double, _ lat2: Double, _ lng2: Double) -> Double {
        let r = 6_371_000.0
        let dLat = (lat2 - lat1) * .pi / 180
        let dLng = (lng2 - lng1) * .pi / 180
        let a = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1 * .pi / 180) * cos(lat2 * .pi / 180) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * r * asin(min(1, sqrt(a)))
    }

    /// 이동 시간 추정(분) — 1.2km 안은 걷기(분당 80m), 그보다 멀면 대중교통(분당 350m + 대기 8분). 길 찾기 API 없이 낸 대략값이라 화면에는 '약'을 붙인다.
    public static func travelMinutes(forMeters meters: Double) -> Int {
        if meters < 50 { return 0 }
        if meters <= 1200 { return Int((meters / 80).rounded(.up)) }
        return 8 + Int((meters / 350).rounded(.up))
    }

    // MARK: 현재 위치(가장 가까운 장소)

    /// 내 좌표에서 가장 가까운 장소의 위치(인덱스)와 거리. 비었으면 nil
    public static func nearest(lat: Double, lng: Double, in places: [SharedPlace]) -> (index: Int, meters: Double)? {
        var best: (Int, Double)?
        for (i, p) in places.enumerated() {
            let d = distanceMeters(lat, lng, p.lat, p.lng)
            if best == nil || d < best!.1 { best = (i, d) }
        }
        return best.map { (index: $0.0, meters: $0.1) }
    }

    // MARK: 시각 기준 현재 위치(위젯 — GPS를 못 쓸 때)

    /// "HH:mm" → 오늘 그 시각의 Date
    public static func time(_ hm: String?, on day: Date, _ cal: Calendar) -> Date? {
        guard let hm = hm else { return nil }
        let p = hm.split(separator: ":").compactMap { Int($0) }
        guard p.count >= 2, (0..<24).contains(p[0]), (0..<60).contains(p[1]) else { return nil }
        return cal.date(bySettingHour: p[0], minute: p[1], second: 0, of: day)
    }

    /// 지금 시각까지 지나온 마지막 장소의 위치. 시각이 있는 장소 중 지금 이전인 마지막 것, 하나도 없으면 -1(아직 첫 일정 전)
    public static func currentIndexByTime(_ places: [SharedPlace], now: Date, calendar cal: Calendar = .current) -> Int {
        var idx = -1
        for (i, p) in places.enumerated() {
            if let t = time(p.t, on: now, cal), t <= now { idx = i }
        }
        return idx
    }

    // MARK: 다음 장소

    /// currentIndex(현재 위치) 다음 장소와 출발 시각. 마지막이면 nil.
    /// 현재 위치가 없으면(-1) from 좌표가 없으므로 이동 시간은 0으로 두고 다음 장소 시각만 알려 준다.
    public static func nextStop(places: [SharedPlace], currentIndex: Int, fromLat: Double? = nil, fromLng: Double? = nil, now: Date = Date(), calendar cal: Calendar = .current) -> NextStop? {
        let nextIdx = currentIndex + 1
        guard nextIdx >= 0, nextIdx < places.count else { return nil }
        let next = places[nextIdx]
        var meters = 0.0
        if let la = fromLat, let ln = fromLng {
            meters = distanceMeters(la, ln, next.lat, next.lng)
        } else if currentIndex >= 0, currentIndex < places.count {
            let cur = places[currentIndex]
            meters = distanceMeters(cur.lat, cur.lng, next.lat, next.lng)
        }
        let travel = travelMinutes(forMeters: meters)
        var departAt: Date?
        var until: Int?
        if let at = time(next.t, on: now, cal) {
            let d = at.addingTimeInterval(TimeInterval(-travel * 60))
            departAt = d
            until = Int((d.timeIntervalSince(now) / 60).rounded(.down))
        }
        return NextStop(place: next, travelMinutes: travel, departAt: departAt, minutesUntilDeparture: until)
    }
}
