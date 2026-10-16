import WidgetKit
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

// 홈 화면·잠금 화면 위젯 — 오늘 여행의 '지금 일정(시각 기준)'과 '다음 장소·출발 시각'.
// 위젯은 GPS를 쓰지 않는다(그건 애플워치). 앱이 앱 그룹에 저장해 둔 일정(TripShareKeys.payloadKey)만 읽는다.

private let brand = Color(red: 0.18, green: 0.31, blue: 0.31)
private let urgentColor = Color(red: 1.0, green: 0.55, blue: 0.0)

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

    /// 출발까지 20분 이하(이미 늦은 것 포함)면 '곧 출발'로 주황 강조 — 워치와 같은 기준(TripLogic.urgentMinutes)
    private var isUrgent: Bool {
        if let m = stop.minutesUntilDeparture { return m <= TripLogic.urgentMinutes }
        return false
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(TripStrings.string("next", entry.lang))
                .font(.caption2.weight(.semibold))
                .foregroundColor(isUrgent ? urgentColor : brand)
            Text(place.n)
                .font(compact ? .subheadline.weight(.bold) : .headline.weight(.bold))
                .lineLimit(2)
                .minimumScaleFactor(0.8)
            if let line = departText(stop, now: entry.date, lang: entry.lang) {
                Text(line)
                    .font(.caption.weight(.semibold))
                    .foregroundColor(isUrgent ? urgentColor : .primary)
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
                    .layoutPriority(1)   // 다음 장소 쪽에 폭을 조금 더 — 이름과 '출발 · N분 후'가 덜 접히게
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
        #if os(iOS) && canImport(ActivityKit)
        if #available(iOS 16.1, *) {
            TripLiveActivityWidget()
        }
        #endif
    }
}

#if os(iOS) && canImport(ActivityKit)
import ActivityKit

// MARK: 라이브 액티비티 — 시안 '라이브 2 · 경로 타임라인'(2026-10-17 사용자 결정)
// 잠금 화면: 지금 ● ── 이동 약 N분 ── ○ 다음 일정, 아래 큰 출발 시각 + '출발 · N분'(시스템이 알아서 줄여 준다).
// 다이내믹 아일랜드: 접힘 = ●─○ + 출발 시각, 펼침 = 지금 / 출발 시각 / 다음 일정. 워치(watchOS 11+) 스마트 스택은 시스템이 접힘 모양으로 보여 준다.
// 내용은 서버가 푸시로 바꾼다(supabase/functions/live-activity) — 앱이 미리 계산해 올린 일정(TripLogic.liveSchedule) 그대로.

private let liveBrand = Color(red: 0.40, green: 0.75, blue: 0.70)
private let liveUrgent = Color(red: 1.0, green: 0.62, blue: 0.04)

@available(iOS 16.1, *)
struct LiveTexts {
    let attributes: TripActivityAttributes
    let state: TripActivityAttributes.ContentState
    var lang: String { attributes.lang }
    var tint: Color { state.urgent || state.go ? liveUrgent : liveBrand }
    var dayLine: String { TripStrings.format("day", lang, attributes.day) }
    var hereLabel: String {
        if state.here == nil { return TripStrings.string("nowTime", lang) }
        return state.hereTime.map { TripStrings.format("nowAt", lang, $0) } ?? TripStrings.string("nowTime", lang)
    }
    var hereName: String { state.here ?? TripStrings.string("before", lang) }
    var nextLabel: String { state.nextTime.map { TripStrings.format("nextAt", lang, $0) } ?? TripStrings.string("next", lang) }
    var nextName: String { state.next ?? TripStrings.string("last", lang) }
    var travel: String? { state.travel > 0 ? TripStrings.format("travel", lang, state.travel) : nil }
    var departHm: String? {
        guard let d = state.departDate else { return nil }
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: d)
    }
}

/// ●──○ 작은 연결선
@available(iOS 16.1, *)
struct LiveConnector: View {
    let tint: Color
    var dot: CGFloat = 8
    var body: some View {
        HStack(spacing: 0) {
            Circle().fill(liveBrand).frame(width: dot, height: dot)
            Rectangle().fill(Color.white.opacity(0.35)).frame(height: 2)
            Circle().strokeBorder(tint, lineWidth: 2).frame(width: dot, height: dot)
        }
    }
}

/// 큰 출발 시각 + '출발 · 18분'(남은 시간은 시스템이 줄여 준다). 출발 시각이 지났으면 '지금 출발'
@available(iOS 16.1, *)
struct LiveDepartRow: View {
    let t: LiveTexts
    var big: CGFloat = 34
    var body: some View {
        if t.state.go {
            Text(TripStrings.string("leaveNow", t.lang))
                .font(.system(size: big * 0.7, weight: .heavy, design: .rounded))
                .foregroundColor(liveUrgent)
        } else if let hm = t.departHm, let date = t.state.departDate {
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(hm).font(.system(size: big, weight: .heavy, design: .rounded))
                Text(TripStrings.string("leaveShort", t.lang) + " ·").font(.footnote.weight(.bold))
                Text(date, style: .relative).font(.footnote.weight(.bold))
            }
            .foregroundColor(t.state.urgent ? liveUrgent : .white)
        } else if t.state.next == nil {
            Text(TripStrings.string("last", t.lang)).font(.footnote.weight(.semibold)).foregroundColor(.white)
        }
    }
}

@available(iOS 16.1, *)
struct TripLiveLockView: View {
    let t: LiveTexts

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Triptic · " + t.dayLine)
                Spacer()
                Text(t.attributes.title).lineLimit(1)
            }
            .font(.caption.weight(.semibold))
            .foregroundColor(.white.opacity(0.7))

            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(t.hereLabel).font(.caption2.weight(.semibold)).foregroundColor(liveBrand)
                    Text(t.hereName).font(.subheadline.weight(.bold)).foregroundColor(.white).lineLimit(2)
                }
                VStack(spacing: 2) {
                    if let travel = t.travel {
                        Text(travel).font(.caption2).foregroundColor(.white.opacity(0.7)).lineLimit(1)
                    }
                    LiveConnector(tint: t.tint)
                }
                .frame(maxWidth: .infinity)
                VStack(alignment: .trailing, spacing: 1) {
                    Text(t.nextLabel).font(.caption2.weight(.semibold)).foregroundColor(t.tint)
                    Text(t.nextName).font(.subheadline.weight(.bold)).foregroundColor(.white).lineLimit(2)
                        .multilineTextAlignment(.trailing)
                }
            }

            LiveDepartRow(t: t)
        }
        .padding(16)
    }
}

@available(iOS 16.1, *)
struct TripLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TripActivityAttributes.self) { context in
            TripLiveLockView(t: LiveTexts(attributes: context.attributes, state: context.state))
                .activityBackgroundTint(Color.black.opacity(0.75))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let t = LiveTexts(attributes: context.attributes, state: context.state)
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 1) {
                        Text(t.hereLabel).font(.caption2.weight(.semibold)).foregroundColor(liveBrand)
                        Text(t.hereName).font(.footnote.weight(.bold)).lineLimit(2)
                    }
                }
                DynamicIslandExpandedRegion(.trailing) {
                    VStack(alignment: .trailing, spacing: 1) {
                        if t.state.go {
                            Text(TripStrings.string("leaveNow", t.lang)).font(.footnote.weight(.heavy)).foregroundColor(liveUrgent)
                        } else if let hm = t.departHm, let date = t.state.departDate {
                            Text(hm).font(.system(size: 26, weight: .heavy, design: .rounded)).foregroundColor(t.tint)
                            Text(date, style: .relative).font(.caption2.weight(.bold)).foregroundColor(t.tint)
                        }
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    HStack(spacing: 8) {
                        LiveConnector(tint: t.tint).frame(width: 44)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(t.nextLabel).font(.caption2.weight(.semibold)).foregroundColor(t.tint)
                            Text(t.nextName).font(.footnote.weight(.bold)).lineLimit(1)
                        }
                        Spacer(minLength: 0)
                        if let travel = t.travel {
                            Text(travel).font(.caption2).foregroundColor(.secondary).lineLimit(1)
                        }
                    }
                }
            } compactLeading: {
                LiveConnector(tint: t.tint, dot: 7).frame(width: 30)
            } compactTrailing: {
                if t.state.go {
                    Text(TripStrings.string("leaveShort", t.lang)).font(.caption.weight(.heavy)).foregroundColor(liveUrgent)
                } else {
                    Text(t.departHm ?? "--:--").font(.caption.weight(.heavy)).foregroundColor(t.tint)
                }
            } minimal: {
                Circle().strokeBorder(t.tint, lineWidth: 2.5).frame(width: 14, height: 14)
            }
            .keylineTint(t.tint)
        }
    }
}
#endif
