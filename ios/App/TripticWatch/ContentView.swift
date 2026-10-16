import SwiftUI

private let brand = Color(red: 0.40, green: 0.75, blue: 0.70)
private let urgent = Color(red: 1.0, green: 0.62, blue: 0.04)

/// 시안 C(2026-10-14 확정): 한 화면에 하나씩 크게 — 1쪽 '현재 위치', 2쪽 '다음 장소·출발 시각'. 위아래로 밀거나(watchOS 10+ 디지털 크라운) 옆으로 넘긴다(watchOS 9).
/// 곧 출발(20분 이하)은 주황. 위치를 못 잡으면 시각 기준으로 대신 안내한다.
struct ContentView: View {
    @ObservedObject var model: WatchModel
    @State private var page = 0

    var body: some View {
        // 30초마다 다시 그려서 '몇 분 후 출발'을 새로 계산한다
        TimelineView(.periodic(from: Date(), by: 30)) { context in
            content(now: context.date)
        }
    }

    @ViewBuilder
    private func content(now: Date) -> some View {
        let lang = model.lang
        switch model.todayState {
        case .active(let plan):
            pager(header: dayLabel(plan: plan, lang: lang)) {
                hereScreen(plan: plan, lang: lang, now: now).tag(0)
                nextScreen(plan: plan, lang: lang, now: now).tag(1)
            }
        case .upcoming(let title, let days):
            VStack(spacing: 6) {
                Text(title).font(.footnote.weight(.semibold)).foregroundColor(brand).lineLimit(2).minimumScaleFactor(0.8)
                Text(days == 0 ? TripStrings.string("startsToday", lang) : TripStrings.format("dDay", lang, days))
                    .font(.system(size: 30, weight: .heavy, design: .rounded))
                    .minimumScaleFactor(0.7)
                    .multilineTextAlignment(.center)
                Text(TripStrings.string("openApp", lang)).font(.caption2).foregroundColor(.secondary).multilineTextAlignment(.center)
            }
            .padding(.horizontal, 6)
        case .none:
            VStack(spacing: 6) {
                Image(systemName: "calendar").font(.title2).foregroundColor(brand)
                Text(TripStrings.string("noTrip", lang)).font(.headline).multilineTextAlignment(.center)
                if model.payload.trips.isEmpty {
                    Text(TripStrings.string("openApp", lang)).font(.caption2).foregroundColor(.secondary).multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 6)
        }
    }

    /// watchOS 10+는 위아래로 넘기는 세로 페이지(디지털 크라운), 9는 옆으로 넘기는 페이지
    /// 10+에서는 '1일차'만 맨 위 시계와 같은 줄(툴바 왼쪽)에 둔다 — 2026-10-17 실기기 확인 후 사용자 요청
    @ViewBuilder
    private func pager<Header: View, Content: View>(header: Header, @ViewBuilder _ content: () -> Content) -> some View {
        if #available(watchOS 10.0, *) {
            NavigationStack {
                TabView(selection: $page) { content() }
                    .tabViewStyle(.verticalPage)
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) { header }
                    }
            }
        } else {
            TabView(selection: $page) { content() }.tabViewStyle(.page)
        }
    }

    /// '1일차'를 툴바(시계 줄)에 두는가 — watchOS 10+. 9는 본문 맨 위에 둔다
    private var headerInToolbar: Bool {
        if #available(watchOS 10.0, *) { return true }
        return false
    }

    // MARK: 1쪽 — 현재 위치

    /// '1일차' — watchOS 10+는 시계 줄(툴바), 9는 본문 맨 위
    private func dayLabel(plan: ActivePlan, lang: String) -> some View {
        Text(TripStrings.format("day", lang, plan.day))
            .font(.caption2)
            .foregroundColor(.secondary)
            .lineLimit(1)
    }

    /// 여행 이름 — 본문 맨 위. 길면 다음 줄로 넘기고 자르지 않는다. 아래 일정과는 조금 띄운다
    private func tripTitle(_ plan: ActivePlan) -> some View {
        Text(plan.tripTitle)
            .font(.caption2.weight(.semibold))
            .foregroundColor(.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.bottom, 6)
    }

    private func hereScreen(plan: ActivePlan, lang: String, now: Date) -> some View {
        let state = model.hereState(in: plan, now: now)
        return VStack(alignment: .leading, spacing: 4) {
            if !headerInToolbar { dayLabel(plan: plan, lang: lang) }
            tripTitle(plan)
            switch state {
            case .gps(let index, let meters):
                Label(TripStrings.string("now", lang), systemImage: "mappin.and.ellipse")
                    .font(.footnote.weight(.semibold)).foregroundColor(brand)
                placeName(plan.places[min(index, plan.places.count - 1)].n)
                Text(TripStrings.format("away", lang, TripStrings.distanceText(meters)))
                    .font(.footnote.weight(.bold)).foregroundColor(brand)
            case .timed(let index):
                Label(TripStrings.string("nowTime", lang), systemImage: "clock")
                    .font(.footnote.weight(.semibold)).foregroundColor(brand)
                if index >= 0, index < plan.places.count {
                    placeName(plan.places[index].n)
                    if let t = plan.places[index].t { Text(t).font(.footnote.weight(.bold)).foregroundColor(brand) }
                } else {
                    Text(TripStrings.string("before", lang)).font(.headline)
                }
                // 위치를 못 잡은 이유 — 시각 기준으로 대신 안내 중임을 알려 준다
                Text(TripStrings.string(model.locationDenied ? "allowForNearest" : "locating", lang))
                    .font(.caption2).foregroundColor(.secondary).lineLimit(2).minimumScaleFactor(0.8)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }

    private func placeName(_ name: String) -> some View {
        Text(name)
            .font(.title3.weight(.bold))
            .lineLimit(2)
            .minimumScaleFactor(0.75)
    }

    // MARK: 2쪽 — 다음 장소·출발 시각

    private func nextScreen(plan: ActivePlan, lang: String, now: Date) -> some View {
        let stop = model.next(in: plan, now: now)
        let tint: Color = {
            if let m = stop?.minutesUntilDeparture, m <= TripLogic.urgentMinutes { return urgent }
            return brand
        }()
        return VStack(alignment: .leading, spacing: 4) {
            if !headerInToolbar { dayLabel(plan: plan, lang: lang) }
            tripTitle(plan)
            if let stop = stop {
                Label(TripStrings.string("next", lang), systemImage: "arrow.right")
                    .font(.footnote.weight(.semibold)).foregroundColor(tint)
                Text(stop.place.n)
                    .font(.footnote.weight(.semibold))
                    .lineLimit(2).minimumScaleFactor(0.8)
                if let at = stop.departAt, let minutes = stop.minutesUntilDeparture {
                    Text(hm(at))
                        .font(.system(size: 38, weight: .heavy, design: .rounded))
                        .foregroundColor(minutes <= TripLogic.urgentMinutes ? urgent : .primary)
                        .minimumScaleFactor(0.8)
                    Text(departLine(minutes: minutes, lang: lang))
                        .font(.footnote.weight(.bold))
                        .foregroundColor(minutes <= TripLogic.urgentMinutes ? urgent : .primary)
                        .lineLimit(2).minimumScaleFactor(0.8)
                } else if let t = stop.place.t {
                    Text(t).font(.system(size: 38, weight: .heavy, design: .rounded)).minimumScaleFactor(0.8)
                }
                if stop.travelMinutes > 0 {
                    Text(TripStrings.format("travel", lang, stop.travelMinutes))
                        .font(.caption2).foregroundColor(.secondary)
                }
            } else {
                Text(TripStrings.string("last", lang)).font(.headline)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }

    /// "출발 · 42분 후" / 0분 이하 "지금 출발" / 이미 늦음 "서둘러요"
    private func departLine(minutes: Int, lang: String) -> String {
        if minutes < 0 { return TripStrings.string("late", lang) }
        if minutes == 0 { return TripStrings.string("leaveNow", lang) }
        return TripStrings.format("leaveIn", lang, TripStrings.untilText(minutes: minutes, lang))
    }

    private func hm(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }
}
