import Foundation
import UIKit
import WatchConnectivity
import WidgetKit
#if canImport(ActivityKit)
import ActivityKit
#endif
import CoreLocation

/// 앱이 받은 일정 JSON을 ① 위젯이 읽는 앱 그룹 저장소에 쓰고 ② 애플워치로 보낸다.
/// 위젯·워치는 앱의 웹 화면과 로그인을 모르므로, 이 JSON(TripModels.swift의 SharedPayload)이 둘이 아는 전부다.
final class TripSync: NSObject, WCSessionDelegate {
    static let shared = TripSync()

    private let defaults = UserDefaults(suiteName: TripShareKeys.appGroup)
    private var latestJson: String?

    private override init() {
        super.init()
        latestJson = defaults?.string(forKey: TripShareKeys.payloadKey)
    }

    /// 앱을 켤 때 한 번 — 워치와 연결을 준비한다
    func activate() {
        if #available(iOS 16.2, *) {
            // 서버가 켠 라이브 액티비티(push-to-start)의 토큰도 받아 올리려고 앱이 켜질 때마다 듣기 시작한다
            Task { @MainActor in LiveActivityManager.shared.startObserving() }
        }
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func store(json: String) {
        latestJson = json
        defaults?.set(json, forKey: TripShareKeys.payloadKey)
        WidgetCenter.shared.reloadAllTimelines()
        pushToWatch()
        refreshLive()
    }

    /// 라이브 액티비티 — 일정이 그대로여도 앱을 열 때마다 부른다(여행 당일이면 켜고, 서버 일정도 다시 올린다)
    func refreshLive() {
        guard #available(iOS 16.2, *), let json = latestJson, let payload = TripShareKeys.decode(json) else { return }
        Task { @MainActor in
            LiveActivityManager.shared.refresh(payload, appActive: UIApplication.shared.applicationState == .active)
        }
    }

    func clear() {
        latestJson = nil
        defaults?.removeObject(forKey: TripShareKeys.payloadKey)
        WidgetCenter.shared.reloadAllTimelines()
        pushToWatch()
        if #available(iOS 16.2, *) {
            Task { @MainActor in LiveActivityManager.shared.clear() }
        }
    }

    /// 마지막 일정을 워치로 — 워치 앱이 설치돼 있을 때만. 받는 쪽은 최신 하나만 쓰는 applicationContext를 쓴다
    private func pushToWatch() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
        let context: [String: Any] = [
            "payload": latestJson ?? "",
            "ts": Date().timeIntervalSince1970
        ]
        do {
            try session.updateApplicationContext(context)
        } catch {
            NSLog("[TripSync] updateApplicationContext failed: \(error.localizedDescription)")
        }
    }

    // MARK: WCSessionDelegate

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if activationState == .activated { pushToWatch() }
    }

    func sessionWatchStateDidChange(_ session: WCSession) {
        // 워치 앱을 새로 설치했거나 짝을 바꿨을 때 지금 일정을 바로 보낸다
        pushToWatch()
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
}

// MARK: - 라이브 액티비티(잠금 화면·다이내믹 아일랜드·워치 스마트 스택)

#if canImport(ActivityKit)
/// 하루 일정을 시각별 내용으로 계산해(TripLogic.liveSchedule) 서버(supabase/functions/live-activity)에 올리고,
/// 서버는 그 시각에 Apple 푸시로 켜고(push-to-start, iOS 17.2+) · 바꾸고 · 출발 시각에 진동 알림을 주고 · 끈다.
/// 앱을 열면 여행 당일엔 여기서 바로 켠다(사용자 결정 2026-10-17: 1-a 자동, 2-b 서버 푸시, 3 서버가 다시 켜기).
/// 서버와는 기기마다 만든 임의 키(deviceKey)로만 통한다 — 백그라운드(웹 화면 없이)에서도 토큰을 올릴 수 있게.
@available(iOS 16.2, *)
@MainActor
final class LiveActivityManager {
    static let shared = LiveActivityManager()

    private let defaults = UserDefaults.standard
    private let endpointKey = "triptic.live.endpoint"
    private let anonKeyKey = "triptic.live.anonKey"
    private let deviceKeyKey = "triptic.live.deviceKey"
    private var observing = false
    private var watched = Set<String>()
    private var lastScheduleJson: String?

    /// TestFlight·App Store 빌드는 운영 APNs, Xcode 디버그 빌드만 sandbox
    private var apnsEnv: String {
        #if DEBUG
        return "sandbox"
        #else
        return "production"
        #endif
    }

    /// 기기마다 한 번 만드는 임의 키(64자) — 서버의 이 기기 줄을 찾는 열쇠
    var deviceKey: String {
        if let k = defaults.string(forKey: deviceKeyKey), k.count == 64 { return k }
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        let k = bytes.map { String(format: "%02x", $0) }.joined()
        defaults.set(k, forKey: deviceKeyKey)
        return k
    }

    /// 웹 화면이 Supabase 주소·공개 키를 넘겨준다(백그라운드에서 토큰을 올릴 때 쓴다)
    func configure(endpoint: String?, anonKey: String?) {
        if let e = endpoint, !e.isEmpty { defaults.set(e, forKey: endpointKey) }
        if let k = anonKey, !k.isEmpty { defaults.set(k, forKey: anonKeyKey) }
    }

    func startObserving() {
        guard !observing else { return }
        observing = true
        for activity in Activity<TripActivityAttributes>.activities { watch(activity) }
        Task { @MainActor in
            for await activity in Activity<TripActivityAttributes>.activityUpdates { self.watch(activity) }
        }
        if #available(iOS 17.2, *) {
            Task { @MainActor in
                for await data in Activity<TripActivityAttributes>.pushToStartTokenUpdates {
                    self.send(["kind": "start_token", "token": Self.hex(data), "env": self.apnsEnv])
                }
            }
        }
    }

    /// 켜진 라이브 액티비티의 갱신 토큰 → 서버(그 여행·일차의 푸시는 이 토큰으로 간다)
    private func watch(_ activity: Activity<TripActivityAttributes>) {
        guard !watched.contains(activity.id) else { return }
        watched.insert(activity.id)
        Task { @MainActor in
            for await data in activity.pushTokenUpdates {
                self.send(["kind": "activity_token", "token": Self.hex(data),
                           "trip_id": activity.attributes.tripId, "day": activity.attributes.day])
            }
        }
    }

    func refresh(_ payload: SharedPayload, appActive: Bool) {
        startObserving()
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let cal = Calendar.current
        let now = Date()
        uploadSchedule(payload, now: now, cal: cal)

        // 오늘 일정이 아닌 라이브 액티비티는 끈다
        let today = TripLogic.activeTrip(payload, now: now, calendar: cal)
        for activity in Activity<TripActivityAttributes>.activities {
            let same = today.map { activity.attributes.tripId == $0.trip.id && activity.attributes.day == $0.day } ?? false
            if !same { Task { await activity.end(nil, dismissalPolicy: .immediate) } }
        }
        guard let today = today else { return }
        let steps = TripLogic.liveSchedule(today.places, on: now, calendar: cal)
        guard let open = steps.first?.at, let close = steps.last?.at, now >= open, now < close else { return }

        let step = TripLogic.liveState(today.places, at: now, kind: .update, calendar: cal)
        let content = ActivityContent(state: TripActivityAttributes.ContentState(step: step, places: today.places), staleDate: nil)
        if let existing = Activity<TripActivityAttributes>.activities.first(where: { $0.attributes.tripId == today.trip.id && $0.attributes.day == today.day }) {
            Task { await existing.update(content) }
            if appActive { updateWithLocation(existing, places: today.places) }
        } else if appActive {
            // 1-a: 여행 당일 앱을 열면 자동으로 켠다(앱이 앞에 있을 때만 켤 수 있다 — Apple)
            let attributes = TripActivityAttributes(tripId: today.trip.id, title: today.trip.title, day: today.day, lang: payload.lang)
            do {
                let activity = try Activity.request(attributes: attributes, content: content, pushType: .token)
                watch(activity)
                updateWithLocation(activity, places: today.places)
            } catch {
                NSLog("[LiveActivity] request failed: \(error.localizedDescription)")
            }
        }
    }

    /// 앱을 열었을 때만(A안, 2026-10-17): 이미 '앱 사용 중' 위치를 허용했으면 한 번 위치를 받아 워치와 같은 규칙(TripLogic.position)으로 바꾼다 —
    /// 30km 안이면 '지금 · 350m', 다음 장소 300m 안이면 '도착 · 120m'로 앞당김, 멀면 시각 기준 그대로.
    /// 새 권한은 묻지 않는다. 잠긴 동안 서버 푸시가 오면 시각 기준 내용으로 돌아간다(서버는 위치를 모른다).
    private let locator = OneShotLocator()
    private func updateWithLocation(_ activity: Activity<TripActivityAttributes>, places: [SharedPlace]) {
        locator.request { location in
            guard let loc = location,
                  let state = TripActivityAttributes.ContentState(places: places, lat: loc.coordinate.latitude, lng: loc.coordinate.longitude) else { return }
            Task { await activity.update(ActivityContent(state: state, staleDate: nil)) }
        }
    }

    /// 오늘부터 여행 끝날까지 바뀌는 순간들을 서버에 통째로 올린다(같은 내용이면 다시 안 보냄)
    private func uploadSchedule(_ payload: SharedPayload, now: Date, cal: Calendar) {
        let lang = payload.lang
        var events: [[String: Any]] = []
        for trip in payload.trips {
            guard let start = TripLogic.parseYmd(trip.start, cal), let end = TripLogic.parseYmd(trip.end, cal) else { continue }
            let total = TripLogic.dayDiff(from: start, to: end, cal) + 1
            guard total >= 1 else { continue }
            for day in 1...total {
                guard let date = cal.date(byAdding: .day, value: day - 1, to: start),
                      let places = trip.days[String(day)], !places.isEmpty else { continue }
                for step in TripLogic.liveSchedule(places, on: date, calendar: cal) where step.at > now.addingTimeInterval(-60) {
                    var ev: [String: Any] = [
                        "at": Int(step.at.timeIntervalSince1970),
                        "type": step.kind.rawValue,
                        "trip_id": trip.id,
                        "day": day,
                        "state": Self.json(TripActivityAttributes.ContentState(step: step, places: places)),
                    ]
                    if step.kind == .start {
                        ev["attributes"] = ["tripId": trip.id, "title": trip.title, "day": day, "lang": lang]
                        ev["alert"] = ["title": trip.title + " · " + TripStrings.format("day", lang, day),
                                       "body": TripStrings.string("liveStartBody", lang)]
                    }
                    if step.kind == .depart, let ni = step.nextIndex, ni < places.count {
                        ev["alert"] = ["title": TripStrings.string("liveDepartTitle", lang),
                                       "body": TripStrings.format("liveDepartBody", lang, places[ni].n, step.travelMinutes)]
                    }
                    events.append(ev)
                }
            }
        }
        let body: [String: Any] = ["kind": "schedule", "env": apnsEnv, "events": Array(events.prefix(500))]
        let key = (try? JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])).flatMap { String(data: $0, encoding: .utf8) }
        if key != nil && key == lastScheduleJson { return }
        lastScheduleJson = key
        send(body)
    }

    /// 로그아웃 — 켜진 것을 끄고 서버의 이 기기 기록을 지운다
    func clear() {
        for activity in Activity<TripActivityAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        lastScheduleJson = nil
        send(["kind": "unregister"])
    }

    private func send(_ body: [String: Any]) {
        guard let base = defaults.string(forKey: endpointKey), let anon = defaults.string(forKey: anonKeyKey),
              let url = URL(string: base.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/functions/v1/live-activity") else { return }
        var payload = body
        payload["device_key"] = deviceKey
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(anon, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(anon)", forHTTPHeaderField: "Authorization")
        req.httpBody = data
        // 백그라운드에서 깨어나 토큰을 올리는 중에도 끝까지 보내도록
        var task = UIBackgroundTaskIdentifier.invalid
        task = UIApplication.shared.beginBackgroundTask(withName: "live-activity") {
            UIApplication.shared.endBackgroundTask(task)
        }
        URLSession.shared.dataTask(with: req) { _, response, error in
            if let error = error { NSLog("[LiveActivity] send failed: \(error.localizedDescription)") }
            else if let http = response as? HTTPURLResponse, http.statusCode >= 300 { NSLog("[LiveActivity] send HTTP \(http.statusCode)") }
            DispatchQueue.main.async { UIApplication.shared.endBackgroundTask(task) }
        }.resume()
    }

    private static func hex(_ data: Data) -> String { data.map { String(format: "%02x", $0) }.joined() }

    private static func json(_ state: TripActivityAttributes.ContentState) -> Any {
        guard let data = try? JSONEncoder().encode(state), let obj = try? JSONSerialization.jsonObject(with: data) else { return [String: Any]() }
        return obj
    }
}
#endif

/// 위치 한 번 받기 — 이미 허용된 경우에만(권한을 묻지 않는다). 못 받으면 nil
final class OneShotLocator: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var completion: ((CLLocation?) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func request(_ done: @escaping (CLLocation?) -> Void) {
        let status: CLAuthorizationStatus
        if #available(iOS 14.0, *) { status = manager.authorizationStatus } else { status = CLLocationManager.authorizationStatus() }
        guard status == .authorizedWhenInUse || status == .authorizedAlways else {
            done(nil)
            return
        }
        completion = done
        manager.requestLocation()
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        completion?(locations.last)
        completion = nil
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        completion?(nil)
        completion = nil
    }
}
