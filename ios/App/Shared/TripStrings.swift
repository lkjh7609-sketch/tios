import Foundation

// 위젯·워치 문구 4개 언어(앱에서 고른 언어를 따른다). 파일 하나로 두어 타깃마다 .strings 파일을 따로 두지 않는다.

public enum TripStrings {
    public static func normalize(_ lang: String) -> String {
        let l = lang.lowercased()
        if l.hasPrefix("zh") { return "zh-TW" }
        if l.hasPrefix("ja") { return "ja" }
        if l.hasPrefix("en") { return "en" }
        return l.hasPrefix("ko") ? "ko" : "en"
    }

    /// 앱에서 받은 언어가 있으면 그것, 없으면 기기 언어
    public static func resolve(_ payloadLang: String?) -> String {
        if let p = payloadLang, !p.isEmpty { return normalize(p) }
        return normalize(Locale.preferredLanguages.first ?? "ko")
    }

    private static let table: [String: [String: String]] = [
        "now": ["ko": "현재 위치", "en": "Now at", "ja": "現在地", "zh-TW": "目前位置"],
        "nowTime": ["ko": "지금 일정", "en": "Now", "ja": "今の予定", "zh-TW": "目前行程"],
        "before": ["ko": "첫 일정 전", "en": "Before first stop", "ja": "最初の予定の前", "zh-TW": "第一站之前"],
        "next": ["ko": "다음", "en": "Next", "ja": "次", "zh-TW": "下一站"],
        "last": ["ko": "마지막 일정이에요", "en": "That was the last stop", "ja": "最後の予定です", "zh-TW": "這是最後一站"],
        "leaveBy": ["ko": "%@ 출발", "en": "Leave by %@", "ja": "%@ 出発", "zh-TW": "%@ 出發"],
        "leaveNow": ["ko": "지금 출발", "en": "Leave now", "ja": "今すぐ出発", "zh-TW": "現在出發"],
        "inMin": ["ko": "%d분 후", "en": "in %d min", "ja": "%d分後", "zh-TW": "%d 分鐘後"],
        "inHourMin": ["ko": "%d시간 %d분 후", "en": "in %dh %dm", "ja": "%d時間%d分後", "zh-TW": "%d 小時 %d 分鐘後"],
        "leaveIn": ["ko": "출발 · %@", "en": "Leave %@", "ja": "出発 · %@", "zh-TW": "出發 · %@"],
        "allowForNearest": ["ko": "위치를 허용하면 가까운 곳을 알려줘요", "en": "Allow location to see the nearest stop", "ja": "位置情報を許可すると近い場所を表示します", "zh-TW": "允許定位即可顯示最近的地點"],
        "startsToday": ["ko": "오늘 출발", "en": "Starts today", "ja": "今日出発", "zh-TW": "今天出發"],
        "dDay": ["ko": "D-%d", "en": "In %d days", "ja": "あと%d日", "zh-TW": "還有 %d 天"],
        "late": ["ko": "서둘러요", "en": "Hurry up", "ja": "急ぎましょう", "zh-TW": "快點出發"],
        "travel": ["ko": "이동 약 %d분", "en": "~%d min travel", "ja": "移動 約%d分", "zh-TW": "移動約 %d 分鐘"],
        "away": ["ko": "%@ 떨어짐", "en": "%@ away", "ja": "%@先", "zh-TW": "距離 %@"],
        "dayOf": ["ko": "%d일차 / %d", "en": "Day %d of %d", "ja": "%d日目 / %d", "zh-TW": "第 %d 天 / %d"],
        "day": ["ko": "%d일차", "en": "Day %d", "ja": "%d日目", "zh-TW": "第 %d 天"],
        "noTrip": ["ko": "오늘은 일정이 없어요", "en": "No itinerary today", "ja": "今日の予定はありません", "zh-TW": "今天沒有行程"],
        "upcoming": ["ko": "%@ · D-%d", "en": "%@ · in %d days", "ja": "%@ · あと%d日", "zh-TW": "%@ · 還有 %d 天"],
        "upcomingToday": ["ko": "%@ · 오늘 출발", "en": "%@ · starts today", "ja": "%@ · 今日出発", "zh-TW": "%@ · 今天出發"],
        "openApp": ["ko": "Triptic 앱에서 로그인해 일정을 열어 주세요", "en": "Open Triptic on your iPhone and sign in", "ja": "iPhoneのTripticでログインして予定を開いてください", "zh-TW": "請在 iPhone 開啟 Triptic 並登入"],
        "locating": ["ko": "위치 확인 중…", "en": "Locating…", "ja": "位置を確認中…", "zh-TW": "定位中…"],
        "needLocation": ["ko": "위치 권한을 허용해 주세요", "en": "Allow location access", "ja": "位置情報を許可してください", "zh-TW": "請允許定位權限"],
        "appName": ["ko": "Triptic", "en": "Triptic", "ja": "Triptic", "zh-TW": "Triptic"],
        "widgetName": ["ko": "다음 일정", "en": "Next stop", "ja": "次の予定", "zh-TW": "下一站"],
        "widgetDesc": ["ko": "오늘 여행의 다음 장소와 출발 시각을 보여 줘요", "en": "Shows your next stop and when to leave", "ja": "今日の次の場所と出発時刻を表示します", "zh-TW": "顯示今天的下一站與出發時間"],
    ]

    public static func string(_ key: String, _ lang: String) -> String {
        let l = normalize(lang)
        return table[key]?[l] ?? table[key]?["en"] ?? key
    }

    public static func format(_ key: String, _ lang: String, _ args: CVarArg...) -> String {
        String(format: string(key, lang), arguments: args)
    }

    /// 남은 분 → "N분 후" / "N시간 M분 후" / "지금 출발"(0 이하) / "서둘러요"(이미 지남은 호출하는 쪽에서)
    public static func untilText(minutes: Int, _ lang: String) -> String {
        if minutes <= 0 { return string("leaveNow", lang) }
        if minutes < 60 { return format("inMin", lang, minutes) }
        return format("inHourMin", lang, minutes / 60, minutes % 60)
    }

    /// 거리(m) 표기 — 1km 미만은 m, 이상은 소수 한 자리 km
    public static func distanceText(_ meters: Double) -> String {
        if meters < 1000 { return "\(Int((meters / 10).rounded()) * 10)m" }
        return String(format: "%.1fkm", meters / 1000)
    }
}
