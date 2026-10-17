import Foundation
import WatchConnectivity

/// 폰 앱(TripSync.swift)이 보낸 오늘 일정을 받아 WatchModel에 넘긴다.
final class WatchConnectivityReceiver: NSObject, WCSessionDelegate {
    private weak var model: WatchModel?

    init(model: WatchModel) {
        self.model = model
        super.init()
    }

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    private func apply(_ context: [String: Any]) {
        guard let json = context["payload"] as? String else { return }
        model?.receive(json: json)
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        // 워치 앱을 켜기 전에 폰이 보낸 마지막 일정이 있으면 지금 받는다
        if activationState == .activated, !session.receivedApplicationContext.isEmpty {
            apply(session.receivedApplicationContext)
        }
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        apply(applicationContext)
    }
}
