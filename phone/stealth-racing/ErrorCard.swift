import SwiftUI

/// 8 · Error states, shown as a card over the current screen ("Oops · when something goes wrong").
struct ErrorCard: View {
    let error: PPError
    let action: () -> Void
    let dismiss: () -> Void

    var body: some View {
        ZStack {
            Theme.bg.opacity(0.82).ignoresSafeArea()
                .onTapGesture(perform: dismiss)
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 12) {
                    MascotImage(variant: .base).frame(height: 56)
                    VStack(alignment: .leading, spacing: 2) {
                        PPDisplay("Oops", size: 44)
                        PPLabel("When something goes wrong")
                    }
                    Spacer()
                    Button(action: dismiss) {
                        Image(systemName: "xmark").font(.system(size: 15, weight: .bold)).foregroundStyle(Theme.inkMuted)
                            .frame(width: 44, height: 44)
                    }
                    .accessibilityLabel(Text("Close"))
                }
                VStack(alignment: .leading, spacing: 8) {
                    Label { Text(title).font(PPFont.barlow(18, .semibold)) } icon: {
                        Image(systemName: icon).foregroundStyle(color)
                    }
                    Text(message)
                        .font(PPFont.barlow(14))
                        .foregroundStyle(Theme.inkMuted)
                        .fixedSize(horizontal: false, vertical: true)
                    Button(actionTitle, action: action)
                        .buttonStyle(.pixel(.quiet, compact: true))
                        .padding(.top, 4)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pixelPanel(fill: Theme.surface, outline: color, width: 2)
            }
            .padding(20)
            .frame(width: 460)
            .pixelPanel(fill: Theme.bg, outline: Theme.outlineStrong, drop: 4)
            .accessibilityElement(children: .contain)
            .accessibilityAddTraits(.isModal)
        }
    }

    private var title: LocalizedStringResource {
        switch error {
        case .noReply: "Sending · No reply"
        case .localNetworkOff: "Local Network is off"
        case .badCode: "That’s not a Pit Pal code"
        case .receiverLost: "Receiver lost"
        }
    }

    private var message: LocalizedStringResource {
        switch error {
        case .noReply(let paired):
            paired
                ? "Check that the receiver is running and that UDP 5005 is allowed through the Windows firewall."
                : "Check that the receiver is running and UDP 5005 is allowed through the firewall. If it asks for a code, scan its QR code instead."
        case .localNetworkOff: "Pit Pal can’t find your rig. Allow Local Network for this app in Settings, then come back."
        case .badCode: "Scan the code shown by Pit Pal on your PC. Codes stop working once the coach restarts."
        case .receiverLost: "No reply for a moment, so the car is coasting. Reconnect to keep driving."
        }
    }

    private var actionTitle: LocalizedStringResource {
        switch error {
        case .noReply: "Try again"
        case .localNetworkOff: "Open Settings"
        case .badCode: "Scan again"
        case .receiverLost: "Reconnect"
        }
    }

    private var icon: String {
        switch error {
        case .noReply: "exclamationmark.triangle"
        case .localNetworkOff: "lock"
        case .badCode: "qrcode.viewfinder"
        case .receiverLost: "wifi.exclamationmark"
        }
    }

    private var color: Color {
        switch error {
        case .noReply, .receiverLost: Theme.accent
        case .localNetworkOff: Theme.signalBlue
        case .badCode: Theme.caution
        }
    }
}

#Preview(traits: .landscapeLeft) {
    ErrorCard(error: .badCode, action: {}, dismiss: {})
}
