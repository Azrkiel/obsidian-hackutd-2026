import SwiftUI

/// 4 · Connecting and 5 · Connected: four numbered steps driven by the real link, then READY with
/// a green "Receiver confirmed" pill and Drive.
struct ConnectingView: View {
    let session: ReceiverSession
    let cancel: () -> Void
    let drive: () -> Void

    private var steps: ConnectSteps { session.steps }
    private var ready: Bool { steps.confirmed }

    var body: some View {
        PPScreen {
            HStack(alignment: .center, spacing: 28) {
                VStack(spacing: 14) {
                    MascotImage(variant: .racer, bobs: !ready)
                        .frame(height: 130)
                    if ready {
                        StatusPill("Receiver confirmed", tone: .go)
                    } else {
                        LedMeter(cells: LedMeter.filled(litCells, of: 15), size: 12)
                        PPLabel("Connecting…")
                    }
                }
                .frame(width: 220)

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        PPDisplay(ready ? "Ready" : "Pairing", size: 44)
                        Spacer()
                        if !ready {
                            StatusPill("Waiting for receiver", tone: .caution)
                        }
                    }
                    PairingStepRow(number: 1, title: "Found receiver", detail: receiverDetail,
                                   state: steps.found ? .done : .active)
                    PairingStepRow(number: 2, title: steps.paired ? "Pairing code verified" : "Not paired",
                                   detail: Text(steps.paired ? "Signed with the shared key" : "Unsigned: scan the code to pair"),
                                   state: steps.paired ? (steps.codeVerified ? .done : steps.found ? .active : .waiting) : .skipped)
                    PairingStepRow(number: 3, title: "Sending test packets", detail: Text("v1 steering at ~100 Hz"),
                                   state: steps.confirmed ? .done : steps.sending ? .active : .waiting)
                    PairingStepRow(number: 4, title: "Receiver confirmed", detail: Text("ack reply received"),
                                   state: steps.confirmed ? .done : .waiting)
                    HStack {
                        if ready {
                            Text("Hold the phone upright like a wheel, then tap Recenter. Pit Pal puts on the helmet when you drive.")
                                .font(PPFont.barlow(14))
                                .foregroundStyle(Theme.inkMuted)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 12)
                            Button("Drive", action: drive)
                                .buttonStyle(.pixel(.go))
                        } else {
                            Button("Cancel", action: cancel)
                                .buttonStyle(.pixel(.quiet, compact: true))
                            Spacer()
                        }
                    }
                    .padding(.top, 4)
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 14)
        }
        .sensoryFeedback(.success, trigger: ready) { _, now in now && session.hapticsEnabled }
    }

    private var receiverDetail: Text {
        let address = session.receiverAddress
        return Text(verbatim: address.isEmpty ? session.receiverName : "\(session.receiverName) · \(address)")
    }

    private var litCells: Int {
        [steps.found, steps.paired ? steps.codeVerified : true, steps.sending, steps.confirmed]
            .filter { $0 }.count * 4 - 1
    }
}

#Preview("Connecting", traits: .landscapeLeft) {
    ConnectingView(session: .preview(status: .checking,
                                     steps: ConnectSteps(paired: true, found: true, codeVerified: true, sending: true)),
                   cancel: {}, drive: {})
}

#Preview("Connected", traits: .landscapeLeft) {
    ConnectingView(session: .preview(status: .confirmed,
                                     steps: ConnectSteps(paired: true, found: true, codeVerified: true, sending: true, confirmed: true)),
                   cancel: {}, drive: {})
}
