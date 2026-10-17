import SwiftUI

@main
struct TripticWatchApp: App {
    @StateObject private var model = WatchModel()
    @Environment(\.scenePhase) private var scenePhase
    @State private var receiver: WatchConnectivityReceiver?

    var body: some Scene {
        WindowGroup {
            ContentView(model: model)
                .onAppear {
                    if receiver == nil {
                        let r = WatchConnectivityReceiver(model: model)
                        r.activate()
                        receiver = r
                    }
                    model.startLocation()
                }
                .onChange(of: scenePhase) { phase in
                    if phase == .active { model.startLocation() } else { model.stopLocation() }
                }
        }
    }
}
