import SwiftUI

/// The app flow (Pit Pal mobile app flow): Launch → Pairing → (Scan QR | a receiver | address) →
/// Connecting → Connected → Cockpit. In the cockpit, X goes back to Pairing and the sliders button
/// opens Controls. Errors show as cards over the current screen.
struct ContentView: View {
    enum Route: Equatable { case launch, pairing, scanner, connecting, cockpit }

    @Environment(\.scenePhase) private var scenePhase
    @State private var session = ReceiverSession()
    @State private var route = Route.launch
    @State private var manualAddress = false
    @State private var pendingLink: PairingCode?

    var body: some View {
        ZStack {
            switch route {
            case .launch:
                LaunchView { go(pendingLink == nil ? .pairing : .connecting) }
            case .pairing:
                PairingView(session: session, scan: { go(.scanner) }, manual: { manualAddress = true },
                            connect: connect)
            case .scanner:
                ScannerView(session: session, back: { go(.pairing) }, manual: { manualAddress = true },
                            found: { code in
                                session.connect(code: code)
                                go(.connecting)
                            })
            case .connecting:
                ConnectingView(session: session, cancel: {
                    session.disconnect()
                    go(.pairing)
                }, drive: { go(.cockpit) })
            case .cockpit:
                CockpitView(session: session, leave: {
                    session.disconnect()
                    go(.pairing)
                })
            }
        }
        .transition(.opacity)
        .overlay {
            if let error = session.error, route != .launch {
                ErrorCard(error: error, action: { handle(error) }, dismiss: {
                    session.error = nil
                    if session.destination == nil, route == .connecting || route == .cockpit { go(.pairing) }
                })
            }
        }
        .sheet(isPresented: $manualAddress) {
            ManualAddressView { endpoint in
                manualAddress = false
                session.connect(to: endpoint)
                go(.connecting)
            }
        }
        .background(Theme.bg.ignoresSafeArea())
        .tint(Theme.brand)
        .preferredColorScheme(.dark)
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .onOpenURL { url in
            // nomadsim://pair?… from the Camera app: pair straight away.
            guard let code = try? PairingCode(uri: url.absoluteString) else {
                session.error = .badCode
                return
            }
            session.disconnect()
            session.connect(code: code)
            if route == .launch { pendingLink = code } else { go(.connecting) }
        }
        .onChange(of: scenePhase, initial: true) {
            switch scenePhase {
            case .active:
                session.startDiscovery()
            case .background:
                session.disconnect()
                session.stopDiscovery()
                if route != .launch { route = .pairing }
            default:
                session.releasePedals()
            }
        }
        .task {
            #if DEBUG
            _ = PairingSelfTest.run()
            #endif
        }
    }

    private func go(_ next: Route) {
        // Screens change in one step, like sprite frames (no easing).
        route = next
    }

    private func connect(_ target: PairingView.Target) {
        switch target {
        case .saved(let code): session.connect(code: code)
        case .nearby(let endpoint): session.connect(to: endpoint)
        }
        go(.connecting)
    }

    private func handle(_ error: PPError) {
        session.error = nil
        switch error {
        case .noReply, .receiverLost:
            session.reconnect()
            go(.connecting)
        case .localNetworkOff:
            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
        case .badCode:
            session.disconnect()
            go(.scanner)
        }
    }
}

#Preview(traits: .landscapeLeft) {
    ContentView()
}
