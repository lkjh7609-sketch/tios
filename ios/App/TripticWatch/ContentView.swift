import SwiftUI

private let brand = Color(red: 0.40, green: 0.75, blue: 0.70)

struct ContentView: View {
    @ObservedObject var model: WatchModel

    var body: some View {
        // 30초마다 다시 그려서 '몇 분 후 출발'을 새로 계산한다
        TimelineView(.periodic(from: Date(), by: 30)) { context in
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    body(now: context.date)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private func body(now: Date) -> some View {
        let lang = model.lang
        switch model.todayState {
        case .active(let plan):
            Text(TripStrings.format("dayOf", lang, plan.day, plan.totalDays) + " · " + plan.tripTitle)
                .font(.caption2)
                .foregroundColor(.secondary)
                .lineLimit(1)
            hereBlock(plan: plan, lang: lang)
            Divider()
            nextBlock(plan: plan, lang: lang, now: now)
        case .upcoming(let title, let days):
            Text(days == 0 ? TripStrings.format("upcomingToday", lang, title) : TripStrings.format("upcoming", lang, title, days))
                .font(.headline)
            Text(TripStrings.string("openApp", lang)).font(.caption2).foregroundColor(.secondary)
        case .none:
            Text(TripStrings.string("noTrip", lang)).font(.headline)
            if model.payload.trips.isEmpty {
                Text(TripStrings.string("openApp", lang)).font(.caption2).foregroundColor(.secondary)
            }
        }
    }

    @ViewBuilder
    private func hereBlock(plan: ActivePlan, lang: String) -> some View {
        Text(TripStrings.string("now", lang))
            .font(.caption2.weight(.semibold))
            .foregroundColor(brand)
        if let here = model.here(in: plan), here.index < plan.places.count {
            Text(plan.places[here.index].n)
                .font(.headline)
                .lineLimit(3)
            Text(TripStrings.format("away", lang, TripStrings.distanceText(here.meters)))
                .font(.caption2)
                .foregroundColor(.secondary)
        } else if model.locationDenied {
            Text(TripStrings.string("needLocation", lang)).font(.footnote)
        } else {
            Text(TripStrings.string("locating", lang)).font(.footnote).foregroundColor(.secondary)
        }
    }

    @ViewBuilder
    private func nextBlock(plan: ActivePlan, lang: String, now: Date) -> some View {
        Text(TripStrings.string("next", lang))
            .font(.caption2.weight(.semibold))
            .foregroundColor(brand)
        if let stop = model.next(in: plan, now: now) {
            Text(stop.place.n)
                .font(.headline)
                .lineLimit(3)
            if let at = stop.departAt, let minutes = stop.minutesUntilDeparture {
                Text(TripStrings.format("leaveBy", lang, hm(at)))
                    .font(.body.weight(.bold))
                Text(minutes < 0 ? TripStrings.string("late", lang) : TripStrings.untilText(minutes: minutes, lang))
                    .font(.caption)
                    .foregroundColor(minutes <= 10 ? .orange : .secondary)
            } else if let t = stop.place.t {
                Text(t).font(.body.weight(.bold))
            }
            if stop.travelMinutes > 0 {
                Text(TripStrings.format("travel", lang, stop.travelMinutes))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        } else {
            Text(TripStrings.string("last", lang)).font(.footnote)
        }
    }

    private func hm(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm"
        return f.string(from: date)
    }
}
