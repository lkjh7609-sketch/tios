import WidgetKit
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// 홈 화면·잠금 화면 위젯 — 오늘 여행의 '지금 일정(시각 기준)'과 '다음 장소·출발 시각'.
// 위젯은 GPS를 쓰지 않는다(그건 애플워치). 앱이 앱 그룹에 저장해 둔 일정(TripShareKeys.payloadKey)만 읽는다.

private let brand = Color(red: 0.18, green: 0.31, blue: 0.31)

struct TripEntry: TimelineEntry {
    let date: Date
    let lang: String
    let state: TodayState
    let currentIndex: Int      // -1 = 첫 일정 전
    let next: NextStop?
}

struct TripProvider: TimelineProvider {
    private func loadPayload() -> SharedPayload {
        let defaults = UserDefaults(suiteName: TripShareKeys.appGroup)
        guard let json = defaults?.string(forKey: TripShareKeys.payloadKey), let payload = TripShareKeys.decode(json) else {
            return .empty
        }
        return payload
    }

    static func makeEntry(payload: SharedPayload, at date: Date) -> TripEntry {
        let lang = TripStrings.resolve(payload.lang)
        let state = TripLogic.state(payload, now: date)
        if case .active(let plan) = state {
            let idx = TripLogic.currentIndexByTime(plan.places, now: date)
            let next = TripLogic.nextStop(places: plan.places, currentIndex: idx, now: date)
            return TripEntry(date: date, lang: lang, state: state, currentIndex: idx, next: next)
        }
        return TripEntry(date: date, lang: lang, state: state, currentIndex: -1, next: nil)
    }

    func placeholder(in context: Context) -> TripEntry {
        let places = [
            SharedPlace(n: "Triptic", lat: 35.68, lng: 139.76, t: "10:00"),
            SharedPlace(n: "Shibuya", lat: 35.66, lng: 139.70, t: "13:00")
        ]
        let plan = ActivePlan(tripTitle: "Tokyo", day: 2, totalDays: 4, places: places)
        return TripEntry(date: Date(), lang: TripStrings.resolve(nil), state: .active(plan), currentIndex: 0,
                         next: TripLogic.nextStop(places: places, currentIndex: 0, now: Date()))
    }

    func getSnapshot(in context: Context, completion: @escaping (TripEntry) -> Void) {
        completion(Self.makeEntry(payload: loadPayload(), at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TripEntry>) -> Void) {
        let payload = loadPayload()
        let now = Date()
        let cal = Calendar.current
        var dates: Set<Date> = [now]
        // 앞으로 3시간은 10분마다 — '몇 분 후 출발' 문구를 새로 그린다
        for i in 1...18 { dates.insert(now.addingTimeInterval(TimeInterval(i * 600))) }
        // 오늘 일정의 시각·출발 시각에도 한 장씩 — 현재 일정이 바뀌는 순간
        if case .active(let plan) = TripLogic.state(payload, now: now) {
            for (i, p) in plan.places.enumerated() {
                if let t = TripLogic.time(p.t, on: now, cal), t > now { dates.insert(t) }
                if let stop = TripLogic.nextStop(places: plan.places, currentIndex: i - 1, now: now), let depart = stop.departAt, depart > now {
                    dates.insert(depart)
                }
            }
        }
        let sorted = dates.sorted().prefix(40)
        let entries = sorted.map { Self.makeEntry(payload: payload, at: $0) }
        let reload = (sorted.last ?? now).addingTimeInterval(600)
        completion(Timeline(entries: entries, policy: .after(reload)))
    }
}

// MARK: - 화면

private func hm(_ date: Date) -> String {
    let f = DateFormatter()
    f.dateFormat = "HH:mm"
    return f.string(from: date)
}

/// 다음 장소의 출발 안내 한 줄("13:05 출발 · 25분 후")
private func departText(_ stop: NextStop, now: Date, lang: String) -> String? {
    guard let at = stop.departAt, let minutes = stop.minutesUntilDeparture else { return nil }
    let head = TripStrings.format("leaveBy", lang, hm(at))
    if minutes < 0 { return "\(head) · \(TripStrings.string("late", lang))" }
    return "\(head) · \(TripStrings.untilText(minutes: minutes, lang))"
}

private struct NextBlock: View {
    let entry: TripEntry
    let place: SharedPlace
    let stop: NextStop
    var compact = false

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(TripStrings.string("next", entry.lang))
                .font(.caption2.weight(.semibold))
                .foregroundColor(brand)
            Text(place.n)
                .font(compact ? .subheadline.weight(.bold) : .headline.weight(.bold))
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            if let line = departText(stop, now: entry.date, lang: entry.lang) {
                Text(line)
                    .font(.caption.weight(.semibold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
            } else if let t = place.t {
                Text(t).font(.caption.weight(.semibold))
            }
            if stop.travelMinutes > 0 {
                Text(TripStrings.format("travel", entry.lang, stop.travelMinutes))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }
}

private struct EmptyBlock: View {
    let entry: TripEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            switch entry.state {
            case .upcoming(let title, let days):
                Text(days == 0 ? TripStrings.format("upcomingToday", entry.lang, title) : TripStrings.format("upcoming", entry.lang, title, days))
                    .font(.subheadline.weight(.bold))
                    .lineLimit(3)
            default:
                Text(TripStrings.string("noTrip", entry.lang))
                    .font(.subheadline.weight(.bold))
                    .lineLimit(2)
                Text(TripStrings.string("openApp", entry.lang))
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
            }
        }
    }
}

private extension View {
    /// iOS 17+는 containerBackground, 그 전은 일반 배경
    @ViewBuilder func widgetBackground(_ color: Color) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(color, for: .widget)
        } else {
            background(color)
        }
    }
}

struct TripWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: TripEntry

    private var plan: ActivePlan? {
        if case .active(let p) = entry.state { return p }
        return nil
    }

    var body: some View {
        content
            .widgetBackground(widgetBackgroundColor)
    }

    private var widgetBackgroundColor: Color {
        #if canImport(UIKit)
        return Color(UIColor.systemBackground)
        #else
        return Color.white
        #endif
    }

    @ViewBuilder private var content: some View {
        switch family {
        #if os(iOS)
        case .accessoryRectangular:
            accessoryRect
        case .accessoryInline:
            accessoryInline
        #endif
        case .systemMedium:
            medium
        default:
            small
        }
    }

    private var header: some View {
        Group {
            if let plan = plan {
                Text(TripStrings.format("dayOf", entry.lang, plan.day, plan.totalDays) + " · " + plan.tripTitle)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            } else {
                Text(TripStrings.string("appName", entry.lang))
                    .font(.caption2.weight(.bold))
                    .foregroundColor(brand)
            }
        }
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 6) {
            header
            if plan != nil, let next = entry.next {
                NextBlock(entry: entry, place: next.place, stop: next, compact: true)
            } else if plan != nil {
                Text(TripStrings.string("last", entry.lang)).font(.subheadline.weight(.bold))
            } else {
                EmptyBlock(entry: entry)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var medium: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            if let plan = plan {
                HStack(alignment: .top, spacing: 14) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(TripStrings.string("nowTime", entry.lang))
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(brand)
                        if entry.currentIndex >= 0, entry.currentIndex < plan.places.count {
                            Text(plan.places[entry.currentIndex].n)
                                .font(.headline.weight(.bold))
                                .lineLimit(3)
                                .minimumScaleFactor(0.8)
                            if let t = plan.places[entry.currentIndex].t {
                                Text(t).font(.caption).foregroundColor(.secondary)
                            }
                        } else {
                            Text(TripStrings.string("before", entry.lang))
                                .font(.subheadline.weight(.bold))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    Divider()
                    Group {
                        if let next = entry.next {
                            NextBlock(entry: entry, place: next.place, stop: next)
                        } else {
                            Text(TripStrings.string("last", entry.lang)).font(.subheadline.weight(.bold))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                EmptyBlock(entry: entry)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var accessoryRect: some View {
        VStack(alignment: .leading, spacing: 1) {
            if let next = entry.next {
                Text(TripStrings.string("next", entry.lang) + " · " + next.place.n)
                    .font(.headline)
                    .lineLimit(1)
                if let line = departText(next, now: entry.date, lang: entry.lang) {
                    Text(line).font(.caption).lineLimit(1)
                }
                if next.travelMinutes > 0 {
                    Text(TripStrings.format("travel", entry.lang, next.travelMinutes)).font(.caption2).lineLimit(1)
                }
            } else if plan != nil {
                Text(TripStrings.string("last", entry.lang)).font(.headline).lineLimit(2)
            } else if case .upcoming(let title, let days) = entry.state {
                Text(days == 0 ? TripStrings.format("upcomingToday", entry.lang, title) : TripStrings.format("upcoming", entry.lang, title, days))
                    .font(.headline)
                    .lineLimit(2)
            } else {
                Text(TripStrings.string("noTrip", entry.lang)).font(.headline).lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var accessoryInline: some View {
        Group {
            if let next = entry.next {
                if let at = next.departAt {
                    Text("\(next.place.n) · \(TripStrings.format("leaveBy", entry.lang, hm(at)))")
                } else {
                    Text("\(TripStrings.string("next", entry.lang)) · \(next.place.n)")
                }
            } else {
                Text(TripStrings.string("noTrip", entry.lang))
            }
        }
    }
}

struct TripticNextStopWidget: Widget {
    let kind = "TripticNextStopWidget"

    #if os(iOS)
    static let families: [WidgetFamily] = [.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline]
    #else
    static let families: [WidgetFamily] = [.systemSmall, .systemMedium]   // 이 컴퓨터(macOS)에서 문법 검사할 때만
    #endif

    var body: some WidgetConfiguration {
        let lang = TripStrings.resolve(nil)
        return StaticConfiguration(kind: kind, provider: TripProvider()) { entry in
            TripWidgetView(entry: entry)
        }
        .configurationDisplayName(TripStrings.string("widgetName", lang))
        .description(TripStrings.string("widgetDesc", lang))
        .supportedFamilies(Self.families)
    }
}

@main
struct TripticWidgetBundle: WidgetBundle {
    var body: some Widget {
        TripticNextStopWidget()
    }
}
