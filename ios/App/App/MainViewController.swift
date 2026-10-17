import UIKit
import Capacitor

/// 앱 안에 둔 플러그인(TripShare)을 Capacitor에 등록하려고 기본 CAPBridgeViewController를 확장한다.
/// (node_modules에서 오는 플러그인은 자동 등록되지만, 앱 대상에 직접 둔 플러그인은 이렇게 등록해야 한다.)
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(TripSharePlugin())
    }
}
