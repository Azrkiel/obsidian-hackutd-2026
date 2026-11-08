import SwiftUI

/// Settings reachable while driving: fallback pedals, steering, and the
/// Assetto Corsa button stubs the PC bridge still needs to map.
struct ControlsSheet: View {
    @Bindable var session: ReceiverSession
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("On‑screen pedals", isOn: $session.onScreenPedals)
                } header: {
                    Text("Pedals")
                } footer: {
                    Text("Backup throttle and brake for when the Arduino pedals aren’t responding. When off, the phone sends 0 and the receiver uses the Arduino.")
                }

                Section("Steering") {
                    Picker("Full lock", selection: $session.fullLockDegrees) {
                        ForEach([30.0, 45, 60, 90], id: \.self) { degrees in
                            Text("\(Int(degrees))°").tag(degrees)
                        }
                    }
                    Toggle("Haptics", isOn: $session.hapticsEnabled)
                }

                Section {
                    Toggle("Show assist buttons", isOn: $session.showsAssistButtons)
                    ForEach(SimCommand.allCases) { command in
                        HStack(spacing: 12) {
                            Image(systemName: command.symbol)
                                .foregroundStyle(Theme.redHighlight)
                                .frame(width: 24)
                            Text(command.title)
                            Spacer()
                            Text(command.rawValue)
                                .font(.caption.monospaced())
                                .foregroundStyle(Theme.secondaryText)
                            Text(command.padButton)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(command.isCoach ? Theme.redHighlight : Theme.secondaryText)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 3)
                                .background(Theme.hairline, in: .rect(cornerRadius: 6))
                        }
                        .accessibilityElement(children: .combine)
                    }
                } header: {
                    Text("Assetto Corsa buttons")
                } footer: {
                    Text("With the coach as receiver (`--inputs`), each button presses the Xbox pad button shown; bind those in Assetto Corsa’s Controls. Next accepts the coach’s drill (or rewinds for a retry); Resume ends the drill and puts the car back where it started. bridge.py ignores buttons.")
                }

                Section("Debug") {
                    LabeledContent("Outgoing packet") {
                        Text(session.packetPreview)
                            .font(.caption.monospaced())
                            .textSelection(.enabled)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.background)
            .navigationTitle("Controls")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.dark)
        .tint(Theme.red)
    }
}

#Preview(traits: .landscapeLeft) {
    ControlsSheet(session: .preview(status: .confirmed, steering: 0.2))
}
