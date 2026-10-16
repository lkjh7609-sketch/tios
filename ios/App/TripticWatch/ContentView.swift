import SwiftUI

private let brand = Color(red: 0.40, green: 0.75, blue: 0.70)
private let urgent = Color(red: 1.0, green: 0.62, blue: 0.04)

/// 한 화면(2026-10-17 사용자 결정 — 캔버스 시안 C '경로 타임라인'): 시계 줄 왼쪽 '1일차', 본문 맨 위 여행 이름,
/// 그 아래 왼쪽 세로선(지금 ● → 다음 ○)과 지금 장소 → 이동 시간 → 다음 일정 시각·장소 → 큰 출발 시각.
/// 큰 숫자는 '출발 시각'(다음 일정 시각 − 이동 시간)이라 일정 시각을 따로 '다음 일정 · 14:45'로 보여 준다.
/// 곧 출발(20분 이하)은 주황. 위치를 못 잡으면 시각 기준으로 대신 안내한다. 길면 디지털 크라운으로 내린다.
struct ContentView: View {
    @ObservedObject var model: WatchModel

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
            screen(day: dayLabel(plan: plan, lang: lang)) {
                planBody(plan: plan, lang: lang, now: now)
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

    /// 한 화면 + 세로 스크롤. watchOS 10+는 '1일차'를 시계와 같은 줄(툴바 왼쪽)에, 9는 본문 맨 위에 둔다
    @ViewBuilder
    private func screen<Day: View, Body: View>(day: Day, @ViewBuilder _ body: () -> Body) -> some View {
        if #available(watchOS 10.0, *) {
            NavigationStack {
                ScrollView { body() }
                    .toolbar {
                        ToolbarItem(placement: .topBarLeading) { day }
                    }
            }
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    day
                    body()
                }
            }
        }
    }

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

    private func planBody(plan: ActivePlan, lang: String, now: Date) -> some View {
        let here = model.hereState(in: plan, now: now)
        let stop = model.next(in: plan, now: now)
        let isUrgent: Bool = {
            if let m = stop?.minutesUntilDeparture { return m <= TripLogic.urgentMinutes }
            return false
        }()
        let tint: Color = isUrgent ? urgent : brand

        return VStack(alignment: .leading, spacing: 0) {
            tripTitle(plan)
            // 1행: ● 지금 장소 (+ 이동 시간). 왼쪽 선이 이 행 끝까지 내려가 2행의 ○와 이어진다
            HStack(alignment: .top, spacing: 8) {
                VStack(spacing: 3) {
                    Circle().fill(brand).frame(width: 10, height: 10)
                    if stop != nil {
                        Rectangle().fill(Color.white.opacity(0.25)).frame(width: 2).frame(maxHeight: .infinity)
                    }
                }
                .padding(.top, 4)
                .frame(width: 10)
                VStack(alignment: .leading, spacing: 1) {
                    hereBlock(here, plan: plan, lang: lang)
                    if let stop = stop, stop.travelMinutes > 0 {
                        Text("↓ " + TripStrings.format("travel", lang, stop.travelMinutes))
                            .font(.caption2).foregroundColor(.secondary)
                            .padding(.vertical, 5)
                    } else {
                        Spacer().frame(height: 8)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .fixedSize(horizontal: false, vertical: true)

            // 2행: ○ 다음 일정 시각 · 장소 · 큰 출발 시각
            if let stop = stop {
                HStack(alignment: .top, spacing: 8) {
                    Circle().strokeBorder(tint, lineWidth: 2).frame(width: 10, height: 10)
                        .padding(.top, 4)
                        .frame(width: 10)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(stop.place.t.map { TripStrings.format("nextAt", lang, $0) } ?? TripStrings.string("next", lang))
                            .font(.caption2.weight(.semibold)).foregroundColor(tint)
                        placeName(stop.place.n)
                        if let at = stop.departAt, let minutes = stop.minutesUntilDeparture {
                            HStack(alignment: .firstTextBaseline, spacing: 5) {
                                Text(hm(at))
                                    .font(.system(size: 26, weight: .heavy, design: .rounded))
                                    .minimumScaleFactor(0.8)
                                    .lineLimit(1)
                                Text(departLine(minutes: minutes, lang: lang))
                                    .font(.caption2.weight(.bold))
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .foregroundColor(isUrgent ? urgent : .primary)
                            .padding(.top, 2)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                Text(TripStrings.string("last", lang))
                    .font(.footnote.weight(.semibold))
                    .padding(.leading, 18)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }

    /// 지금 있는 곳 — GPS가 있으면 가장 가까운 일정 장소와 거리, 없으면 시각 기준 '지금 일정'
    @ViewBuilder
    private func hereBlock(_ state: WatchModel.HereState, plan: ActivePlan, lang: String) -> some View {
        switch state {
        case .gps(let index, let meters):
            Text(TripStrings.format("nowAt", lang, TripStrings.distanceText(meters)))
                .font(.caption2.weight(.semibold)).foregroundColor(brand)
            placeName(plan.places[min(index, plan.places.count - 1)].n)
        case .timed(let index):
            if index >= 0, index < plan.places.count {
                Text(plan.places[index].t.map { TripStrings.format("nowAt", lang, $0) } ?? TripStrings.string("nowTime", lang))
                    .font(.caption2.weight(.semibold)).foregroundColor(brand)
                placeName(plan.places[index].n)
            } else {
                Text(TripStrings.string("nowTime", lang))
                    .font(.caption2.weight(.semibold)).foregroundColor(brand)
                Text(TripStrings.string("before", lang)).font(.footnote.weight(.semibold))
            }
            // 위치를 못 잡은 이유 — 시각 기준으로 대신 안내 중임을 알려 준다
            Text(TripStrings.string(model.locationDenied ? "allowForNearest" : "locating", lang))
                .font(.caption2).foregroundColor(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// 장소 이름 — 길면 줄바꿈(자르지 않음)
    private func placeName(_ name: String) -> some View {
        Text(name)
            .font(.headline)
            .fixedSize(horizontal: false, vertical: true)
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
