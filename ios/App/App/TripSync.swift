import Foundation
import WatchConnectivity
import WidgetKit

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
    }

    func clear() {
        latestJson = nil
        defaults?.removeObject(forKey: TripShareKeys.payloadKey)
        WidgetCenter.shared.reloadAllTimelines()
        pushToWatch()
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
