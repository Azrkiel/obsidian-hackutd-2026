import SwiftUI

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var session = ReceiverSession()

    var body: some View {
        Group {
            if let destination = session.destination {
                DrivingView(session: session, receiver: session.receiverName(destination))
                    .transition(.opacity)
            } else {
                ReceiverSetupView(session: session)
                    .transition(.opacity)
            }
        }
        .animation(.smooth(duration: 0.25), value: session.destination == nil)
        .background(Theme.background.ignoresSafeArea())
        .tint(Theme.red)
        .preferredColorScheme(.dark)
        .onChange(of: scenePhase, initial: true) {
            switch scenePhase {
            case .active:
                session.startDiscovery()
            case .background:
                session.disconnect()
                session.stopDiscovery()
            default:
                session.releasePedals()
            }
        }
        .onDisappear {
            session.disconnect()
            session.stopDiscovery()
        }
    }
}

#Preview(traits: .landscapeLeft) {
    ContentView()
}
