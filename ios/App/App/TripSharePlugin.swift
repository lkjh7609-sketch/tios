import Foundation
import Capacitor

/// 웹 화면(src/shared/widgetSync.ts)이 부르는 네이티브 플러그인 — 일정 JSON을 위젯·워치로 넘긴다.
@objc(TripSharePlugin)
public class TripSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TripSharePlugin"
    public let jsName = "TripShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setTrips", returnType: CAPPluginReturnPromise),
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
        TripSync.shared.store(json: json)
        call.resolve()
    }

    @objc func clear(_ call: CAPPluginCall) {
        TripSync.shared.clear()
        call.resolve()
    }
}
