import Network
import SwiftUI

/// 2 · Pairing: Scan QR code first, then nearby receivers (paired before: "Last used", Bonjour),
/// then "Enter address manually". QR pairs and signs; the nearby list and the address connect
/// unsigned unless the receiver was paired before.
struct PairingView: View {
    enum Target {
        case saved(PairingCode)
        case nearby(NWEndpoint)
    }

    let session: ReceiverSession
    let scan: () -> Void
    let manual: () -> Void
    let connect: (Target) -> Void

    var body: some View {
        PPScreen {
            HStack(alignment: .center, spacing: 28) {
                brand
                    .frame(width: 250)
                VStack(alignment: .leading, spacing: 14) {
                    scanButton
                    HStack {
                        PPLabel("Nearby receivers")
                        Spacer()
                        StatusPill(session.isSearching ? "Searching" : "Not searching",
                                   tone: session.isSearching ? .caution : .neutral)
                    }
                    ScrollView {
                        VStack(spacing: 6) {
                            ForEach(session.savedCodes, id: \.receiverID) { code in
                                ReceiverRow(name: code.name,
                                            detail: code.name == session.lastReceiverName ? "Last used · paired" : "Paired",
                                            highlighted: code.name == session.lastReceiverName) {
                                    connect(.saved(code))
                                }
                                .contextMenu {
                                    Button("Forget this receiver", systemImage: "trash", role: .destructive) {
                                        session.forget(code)
                                    }
                                }
                            }
                            ForEach(nearby, id: \.debugDescription) { endpoint in
                                let name = session.receiverName(endpoint)
                                ReceiverRow(name: name,
                                            detail: name == session.lastReceiverName ? "Last used · Bonjour" : "Bonjour",
                                            highlighted: false) {
                                    connect(.nearby(endpoint))
                                }
                            }
                            if session.savedCodes.isEmpty && nearby.isEmpty {
                                Text(session.discoveryIssue ?? "No receivers found yet. Start the coach on your PC, then scan its code.")
                                    .font(PPFont.small)
                                    .foregroundStyle(Theme.inkMuted)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.vertical, 8)
                            }
                        }
                        .padding(3)
                    }
                    .scrollBounceBehavior(.basedOnSize)
                    Button(action: manual) {
                        Label("Enter address manually", systemImage: "keyboard")
                            .font(PPFont.barlow(15, .semibold))
                            .foregroundStyle(Theme.ink)
                            .frame(minHeight: 44)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 18)
        }
    }

    /// Bonjour receivers not already listed as paired ones.
    private var nearby: [NWEndpoint] {
        let paired = Set(session.savedCodes.map(\.name))
        return session.receivers.filter { !paired.contains(session.receiverName($0)) }
    }

    private var brand: some View {
        VStack(alignment: .leading, spacing: 12) {
            MascotImage(variant: .racer, bobs: true)
                .frame(height: 110)
            Wordmark()
                .frame(height: 58)
            Text("Pair with the receiver on your rig and turn this iPhone into a wheel.")
                .font(PPFont.small)
                .foregroundStyle(Theme.inkMuted)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                InfoPill(text: "Same Wi-Fi", tone: .info)
                InfoPill(text: "UDP 5005")
            }
        }
    }

    private var scanButton: some View {
        Button(action: scan) {
            HStack(spacing: 14) {
                Image(systemName: "qrcode.viewfinder")
                    .font(.system(size: 22, weight: .semibold))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Scan QR code")
                        .font(PPFont.barlow(18, .bold))
                    Text("Find “Scan me” on the Pit Pal window")
                        .font(PPFont.barlow(13, .medium))
                        .textCase(nil)
                        .opacity(0.85)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.pixel(.primary))
    }
}

/// A receiver in the list: square icon, name, detail, CONNECT.
struct ReceiverRow: View {
    let name: String
    let detail: LocalizedStringResource
    var highlighted = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: "desktopcomputer")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(highlighted ? Theme.onBrand : Theme.ink)
                    .frame(width: 36, height: 36)
                    .background(highlighted ? Theme.brand : Theme.raised)
                VStack(alignment: .leading, spacing: 0) {
                    Text(verbatim: name)
                        .font(PPFont.barlow(16, .semibold))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Text(detail)
                        .font(PPFont.barlow(13))
                        .foregroundStyle(Theme.inkMuted)
                }
                Spacer(minLength: 8)
                Text("Connect")
                    .font(PPFont.barlow(14, .bold))
                    .tracking(1)
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.accent)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .pixelPanel(fill: Theme.surface, outline: Theme.hairline)
        }
        .buttonStyle(PressDropStyle())
        .accessibilityLabel(Text("Connect to \(name)"))
    }
}

/// Manual address entry (IPv4, IPv6 or hostname, and the UDP port). Connects unsigned.
struct ManualAddressView: View {
    let connect: (NWEndpoint) -> Void

    @Environment(\.dismiss) private var dismiss
    @AppStorage("macIP") private var address = ""
    @AppStorage("receiverPort") private var savedPort = 5005
    @State private var port: Int?
    @FocusState private var addressFocused: Bool

    private var trimmedAddress: String { address.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var networkPort: NWEndpoint.Port? {
        guard let port, port > 0, let value = UInt16(exactly: port) else { return nil }
        return NWEndpoint.Port(rawValue: value)
    }

    var body: some View {
        PPScreen {
            HStack(alignment: .top, spacing: 28) {
                VStack(alignment: .leading, spacing: 14) {
                    HStack {
                        PPDisplay("Address", size: 44)
                        Spacer()
                        Button("Cancel") { dismiss() }
                            .buttonStyle(.pixel(.quiet, compact: true))
                    }
                    field("Address") {
                        TextField("IP address or hostname", text: $address)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($addressFocused)
                            .submitLabel(.go)
                            .onSubmit(go)
                    }
                    field("UDP port") {
                        TextField("5005", value: $port, format: .number.grouping(.never))
                            .keyboardType(.numberPad)
                    }
                    Text(networkPort == nil
                         ? "Enter a UDP port from 1 to 65535."
                         : "On Windows, run ipconfig and use the IPv4 address of the adapter on this iPhone’s network.")
                        .font(PPFont.barlow(13))
                        .foregroundStyle(Theme.inkMuted)
                    Button("Connect", action: go)
                        .buttonStyle(.pixel(.primary))
                        .disabled(trimmedAddress.isEmpty || networkPort == nil)
                }
                VStack(spacing: 10) {
                    MascotImage(variant: .base)
                        .frame(height: 80)
                    Text("Phone and PC on the same network")
                        .font(PPFont.barlow(15, .semibold))
                    Text("This connects without a code. If the receiver asks for one, scan its QR code instead.")
                        .font(PPFont.barlow(13))
                        .foregroundStyle(Theme.inkMuted)
                }
                .multilineTextAlignment(.center)
                .padding(16)
                .frame(width: 220)
                .pixelPanel(fill: Theme.surface, outline: Theme.hairline)
                .padding(.top, 50)
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 20)
        }
        .onAppear {
            port = savedPort
            if trimmedAddress.isEmpty { addressFocused = true }
        }
    }

    private func field(_ label: LocalizedStringResource, @ViewBuilder content: () -> some View) -> some View {
        HStack(spacing: 12) {
            PPLabel(label).frame(width: 90, alignment: .leading)
            content()
                .font(PPFont.barlow(17, .medium))
                .monospacedDigit()
                .foregroundStyle(Theme.ink)
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 44)
        .pixelPanel(fill: Theme.surface, outline: Theme.outlineStrong)
    }

    private func go() {
        guard !trimmedAddress.isEmpty, let networkPort else { return }
        savedPort = Int(networkPort.rawValue)
        addressFocused = false
        connect(.hostPort(host: NWEndpoint.Host(trimmedAddress), port: networkPort))
    }
}

#Preview("Pairing", traits: .landscapeLeft) {
    PairingView(session: .preview(status: .disconnected), scan: {}, manual: {}, connect: { _ in })
}

#Preview("Address", traits: .landscapeLeft) {
    ManualAddressView { _ in }
}
