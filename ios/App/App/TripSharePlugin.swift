import Foundation
import Capacitor

/// 웹 화면(src/shared/widgetSync.ts)이 부르는 네이티브 플러그인 — 일정 JSON을 위젯·워치로 넘긴다.
@objc(TripSharePlugin)
public class TripSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TripSharePlugin"
    public let jsName = "TripShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setTrips", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "refreshLive", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]

    @objc func setTrips(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), !json.isEmpty else {
            call.reject("json is required")
            return
        }
        // 깨진 JSON이 위젯·워치로 가지 않게 한 번 읽어 본다
        guard TripShareKeys.decode(json) != nil else {
            call.reject("invalid payload")
            return
        }
        // 라이브 액티비티 토큰을 백그라운드에서도 서버로 올릴 수 있게 Supabase 주소·공개 키를 넘겨 둔다
        if #available(iOS 16.2, *) {
            let endpoint = call.getString("liveEndpoint")
            let key = call.getString("liveKey")
            Task { @MainActor in LiveActivityManager.shared.configure(endpoint: endpoint, anonKey: key) }
        }
        TripSync.shared.store(json: json)
        call.resolve()
    }

    /// 일정은 그대로인데 앱을 다시 열었을 때 — 여행 당일이면 라이브 액티비티를 켠다
    @objc func refreshLive(_ call: CAPPluginCall) {
        TripSync.shared.refreshLive()
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        TripSync.shared.clear()
        call.resolve()
    }
}
