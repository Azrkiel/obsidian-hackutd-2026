import Network
import SwiftUI

/// Pairing: pick a nearby (Bonjour) receiver, or enter an address manually.
struct ReceiverSetupView: View {
    let session: ReceiverSession

    @State private var path: [Route] = []

    enum Route: Hashable { case manual }

    var body: some View {
        NavigationStack(path: $path) {
            HStack(alignment: .center, spacing: 28) {
                hero
                    .frame(width: 260)
                receiverList
            }
            .padding(.horizontal, 24)
            .background(Theme.background)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { _ in
                ManualAddressView(session: session)
            }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 10) {
            MascotImage()
                .frame(width: 124)
                .padding(.bottom, 6)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(Theme.red).frame(height: 4)
                }
            Text("Stealth Racing")
                .font(.largeTitle.weight(.heavy))
                .foregroundStyle(Theme.text)
                .padding(.top, 8)
                .accessibilityAddTraits(.isHeader)
            Text("Pair with the receiver running on your rig to use this iPhone as a wheel.")
                .font(.subheadline)
                .foregroundStyle(Theme.secondaryText)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 8) {
                InfoPill(text: "Same Wi‑Fi")
                InfoPill(text: "UDP \(String(UserDefaults.standard.object(forKey: "receiverPort") as? Int ?? 5005))")
            }
            .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var receiverList: some View {
        List {
            if case .failed = session.status, let detail = session.status.detail {
                Section {
                    Label {
                        Text(detail).foregroundStyle(Theme.text)
                    } icon: {
                        Image(systemName: "exclamationmark.triangle.fill").foregroundStyle(Theme.redHighlight)
                    }
                    .font(.subheadline)
                }
                .listRowBackground(Theme.redTint)
            }

            Section {
                if let issue = session.discoveryIssue {
                    Label(issue, systemImage: "exclamationmark.circle")
                        .foregroundStyle(Theme.secondaryText)
                } else if session.receivers.isEmpty {
                    HStack(spacing: 12) {
                        ProgressView()
                        Text("Start the receiver on your PC…")
                            .foregroundStyle(Theme.secondaryText)
                    }
                    .frame(minHeight: 44)
                }
                ForEach(session.receivers, id: \.self) { endpoint in
                    receiverRow(endpoint)
                }
            } header: {
                HStack {
                    Text("Nearby receivers")
                    Spacer()
                    if session.discoveryIssue == nil && !session.receivers.isEmpty {
                        ProgressView().controlSize(.mini)
                    }
                }
            }
            .listRowBackground(Theme.surface)

            Section {
                NavigationLink(value: Route.manual) {
                    Label("Enter address manually", systemImage: "keyboard")
                        .foregroundStyle(Theme.text)
                        .frame(minHeight: 36)
                }
            } footer: {
                Text("Windows PCs without Bonjour won’t appear above. On the race PC, run `ipconfig` and enter its IPv4 address.")
            }
            .listRowBackground(Theme.surface)
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
    }

    private func receiverRow(_ endpoint: NWEndpoint) -> some View {
        let name = session.receiverName(endpoint)
        let isLast = name == session.lastReceiverName
        return Button {
            session.connect(to: endpoint)
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "desktopcomputer")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(isLast ? Theme.red : Theme.hairline, in: .rect(cornerRadius: 9))
                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.headline)
                        .foregroundStyle(Theme.text)
                    Text(isLast ? "Last used" : "Bonjour")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                }
                Spacer()
                Text("Connect")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Theme.redHighlight)
            }
            .frame(minHeight: 48)
            .contentShape(.rect)
        }
        .accessibilityLabel(Text("Connect to \(name)"))
    }
}

/// Manual IPv4 / IPv6 / hostname entry for receivers that Bonjour can't see.
struct ManualAddressView: View {
    let session: ReceiverSession

    @AppStorage("macIP") private var address = ""
    @AppStorage("receiverPort") private var savedPort = 5005
    @State private var port: Int?
    @FocusState private var addressFocused: Bool

    private var trimmedAddress: String {
        address.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var networkPort: NWEndpoint.Port? {
        guard let port, port > 0, let value = UInt16(exactly: port) else { return nil }
        return NWEndpoint.Port(rawValue: value)
    }

    var body: some View {
        HStack(alignment: .top, spacing: 24) {
            Form {
                Section {
                    LabeledContent("Address") {
                        TextField("IP address or hostname", text: $address)
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($addressFocused)
                            .submitLabel(.go)
                            .onSubmit(connect)
                            .monospacedDigit()
                    }
                    LabeledContent("UDP port") {
                        TextField("5005", value: $port, format: .number.grouping(.never))
                            .keyboardType(.numberPad)
                            .monospacedDigit()
                    }
                } footer: {
                    if networkPort == nil {
                        Text("Enter a UDP port from 1 to 65535.")
                    } else {
                        Text("On Windows, run `ipconfig` and use the IPv4 address of the adapter on the same network as this iPhone. Allow the UDP port through Windows Firewall.")
                    }
                }
                .listRowBackground(Theme.surface)
            }
            .scrollContentBackground(.hidden)

            VStack(spacing: 10) {
                MascotImage(variant: .base)
                    .frame(width: 92)
                Text("Phone and PC on the same network")
                    .font(.subheadline.weight(.semibold))
                Text("Venue Wi-Fi blocks devices? Use this iPhone’s Personal Hotspot and the PC’s hotspot IPv4 address.")
                    .font(.footnote)
                    .foregroundStyle(Theme.secondaryText)
            }
            .multilineTextAlignment(.center)
            .padding(16)
            .frame(width: 220)
            .background(Theme.surface, in: .rect(cornerRadius: 18))
            .padding(.top, 20)
        }
        .padding(.horizontal, 24)
        .background(Theme.background)
        .navigationTitle("Receiver address")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Connect", action: connect)
                    .disabled(trimmedAddress.isEmpty || networkPort == nil)
            }
        }
        .onAppear {
            port = savedPort
            if trimmedAddress.isEmpty { addressFocused = true }
        }
    }

    private func connect() {
        guard !trimmedAddress.isEmpty, let networkPort else { return }
        savedPort = Int(networkPort.rawValue)
        addressFocused = false
        session.connect(to: .hostPort(host: NWEndpoint.Host(trimmedAddress), port: networkPort))
    }
}
