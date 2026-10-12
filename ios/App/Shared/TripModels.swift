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
