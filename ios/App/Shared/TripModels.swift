import Foundation

// 앱(웹 화면) → 위젯·워치가 함께 쓰는 일정 데이터. 앱의 src/shared/widgetSync.ts가 이 모양의 JSON을 만든다.
// 키 이름을 짧게 한 이유: 워치로 보내는 applicationContext 크기를 줄이려고.

/// 일정 장소 하나
public struct SharedPlace: Codable, Hashable {
    public let n: String      // 장소 이름
    public let lat: Double
    public let lng: Double
    public let t: String?     // 방문 시각 "HH:mm"(없을 수 있음)

    public init(n: String, lat: Double, lng: Double, t: String?) {
        self.n = n
        self.lat = lat
        self.lng = lng
        self.t = t
    }
}

/// 여행 하나(일차별 장소)
public struct SharedTrip: Codable, Hashable {
    public let id: String
    public let title: String
    public let start: String   // "YYYY-MM-DD"
    public let end: String     // "YYYY-MM-DD"
    public let days: [String: [SharedPlace]]   // "1", "2", … 일차

    public init(id: String, title: String, start: String, end: String, days: [String: [SharedPlace]]) {
        self.id = id
        self.title = title
        self.start = start
        self.end = end
        self.days = days
    }
}

/// 앱이 보내는 전체 데이터
public struct SharedPayload: Codable, Hashable {
    public let v: Int
    public let lang: String        // ko / en / ja / zh-TW — 앱에서 고른 언어
    public let updated: Double     // 보낸 시각(초)
    public let trips: [SharedTrip]

    public init(v: Int = 1, lang: String, updated: Double, trips: [SharedTrip]) {
        self.v = v
        self.lang = lang
        self.updated = updated
        self.trips = trips
    }

    public static let empty = SharedPayload(lang: "ko", updated: 0, trips: [])
}

/// 앱 그룹·워치가 데이터를 주고받는 이름
public enum TripShareKeys {
    public static let appGroup = "group.com.triptic.travel"
    public static let payloadKey = "triptic.sharedPayload.v1"

    public static func decode(_ json: String) -> SharedPayload? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(SharedPayload.self, from: data)
    }
}

#if os(iOS) && canImport(ActivityKit)
import ActivityKit

/// 라이브 액티비티(잠금 화면·다이내믹 아일랜드·워치 스마트 스택) — 앱과 위젯 확장이 함께 쓴다.
/// 서버(supabase/functions/live-activity)가 이 모양 그대로 JSON을 보낸다: 키 이름·타입을 바꾸면 서버 쪽도 같이 바꿔야 한다.
/// 이름 'TripActivityAttributes'는 서버가 켤 때(push-to-start) 보내는 attributes-type이다.
@available(iOS 16.1, *)
public struct TripActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var here: String?        // 지금 일정(시각 기준), nil = 첫 일정 전
        public var hereTime: String?    // "HH:mm"
        public var hereMeters: Double?  // 지금 장소까지 거리(m) — 앱을 열었을 때 GPS로만 채운다(서버 푸시에는 없음 → 시각 표시로 돌아간다)
        public var next: String?        // 다음 일정, nil = 마지막
        public var nextTime: String?    // 다음 일정 시각 "HH:mm"
        public var travel: Int          // 이동 시간(분, 추정)
        public var departAt: Double?    // 출발 시각(Unix 초) — Date로 두면 JSON 날짜 기준(2001년)이 서버와 어긋나서 숫자로 둔다
        public var urgent: Bool         // 곧 출발(20분 이하) — 주황
        public var go: Bool             // 출발 시각이 지났다 — '지금 출발'

        public init(here: String?, hereTime: String?, hereMeters: Double? = nil, next: String?, nextTime: String?, travel: Int, departAt: Double?, urgent: Bool, go: Bool) {
            self.here = here
            self.hereTime = hereTime
            self.hereMeters = hereMeters
            self.next = next
            self.nextTime = nextTime
            self.travel = travel
            self.departAt = departAt
            self.urgent = urgent
            self.go = go
        }

        public var departDate: Date? { departAt.map { Date(timeIntervalSince1970: $0) } }
    }

    public var tripId: String
    public var title: String
    public var day: Int
    public var lang: String

    public init(tripId: String, title: String, day: Int, lang: String) {
        self.tripId = tripId
        self.title = title
        self.day = day
        self.lang = lang
    }
}

@available(iOS 16.1, *)
public extension TripActivityAttributes.ContentState {
    /// 일정 계산 결과(LiveStep) → 화면 상태
    init(step: LiveStep, places: [SharedPlace]) {
        let here = step.hereIndex >= 0 && step.hereIndex < places.count ? places[step.hereIndex] : nil
        let next = step.nextIndex.flatMap { $0 < places.count ? places[$0] : nil }
        self.init(here: here?.n, hereTime: here?.t, next: next?.n, nextTime: next?.t,
                  travel: step.travelMinutes, departAt: step.departAt?.timeIntervalSince1970,
                  urgent: step.urgent, go: step.go)
    }

    /// 앱을 열었을 때(GPS) — 가장 가까운 일정 장소를 '지금'으로, 거리와 그 자리에서 다음 장소까지 이동 시간으로 계산한다(워치와 같은 방식)
    init?(places: [SharedPlace], lat: Double, lng: Double, now: Date = Date(), calendar cal: Calendar = .current) {
        guard let near = TripLogic.nearest(lat: lat, lng: lng, in: places) else { return nil }
        let next = TripLogic.nextStop(places: places, currentIndex: near.index, fromLat: lat, fromLng: lng, now: now, calendar: cal)
        let minutes = next?.minutesUntilDeparture
        self.init(here: places[near.index].n, hereTime: places[near.index].t, hereMeters: near.meters,
                  next: next?.place.n, nextTime: next?.place.t, travel: next?.travelMinutes ?? 0,
                  departAt: next?.departAt?.timeIntervalSince1970,
                  urgent: minutes.map { $0 <= TripLogic.urgentMinutes } ?? false, go: minutes.map { $0 <= 0 } ?? false)
    }
}
#endif
