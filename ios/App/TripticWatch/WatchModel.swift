import Foundation
import CoreLocation
import SwiftUI

/// 워치 화면의 상태 — 폰이 보낸 오늘 일정 + 워치 GPS로 '가장 가까운 장소(현재 위치)'와 '다음 장소·출발 시각'을 계산한다.
final class WatchModel: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published private(set) var payload: SharedPayload = .empty
    @Published private(set) var location: CLLocation?
    @Published private(set) var authorization: CLAuthorizationStatus = .notDetermined

    private let manager = CLLocationManager()
    private let storeKey = "triptic.watch.payload.v1"

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        manager.distanceFilter = 20
        authorization = manager.authorizationStatus
        if let json = UserDefaults.standard.string(forKey: storeKey), let p = TripShareKeys.decode(json) {
            payload = p
        }
    }

    // MARK: 폰에서 받은 일정

    /// 폰이 보낸 JSON. 빈 문자열이면 로그아웃·삭제 → 비운다
    func receive(json: String) {
        let next = json.isEmpty ? SharedPayload.empty : (TripShareKeys.decode(json) ?? payload)
        UserDefaults.standard.set(json.isEmpty ? nil : json, forKey: storeKey)
        DispatchQueue.main.async { self.payload = next }
    }

    // MARK: 위치

    /// 화면이 보이는 동안만 위치를 받는다(배터리)
    func startLocation() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            manager.startUpdatingLocation()
        default:
            break
        }
    }

    func stopLocation() {
        manager.stopUpdatingLocation()
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        DispatchQueue.main.async { self.authorization = manager.authorizationStatus }
        if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse {
            manager.startUpdatingLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let last = locations.last, last.horizontalAccuracy >= 0 else { return }
        DispatchQueue.main.async { self.location = last }
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        // 일시적인 실패(실내 등)는 그대로 두고 다음 업데이트를 기다린다
    }

    // MARK: 화면용 계산

    var lang: String { TripStrings.resolve(payload.lang) }

    var todayState: TodayState { TripLogic.state(payload) }

    /// 가장 가까운 장소(현재 위치) — 위치를 아직 못 받았으면 nil
    func here(in plan: ActivePlan) -> (index: Int, meters: Double)? {
        guard let loc = location else { return nil }
        return TripLogic.nearest(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude, in: plan.places)
    }

    func next(in plan: ActivePlan, now: Date) -> NextStop? {
        if let loc = location, let h = here(in: plan) {
            return TripLogic.nextStop(places: plan.places, currentIndex: h.index,
                                      fromLat: loc.coordinate.latitude, fromLng: loc.coordinate.longitude, now: now)
        }
        // 위치가 없으면 시각 기준으로
        let idx = TripLogic.currentIndexByTime(plan.places, now: now)
        return TripLogic.nextStop(places: plan.places, currentIndex: idx, now: now)
    }

    var locationDenied: Bool {
        authorization == .denied || authorization == .restricted
    }
}
