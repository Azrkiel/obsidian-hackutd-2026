import SwiftUI

/// 7 · Controls: pedals and steering on the left, the Assetto Corsa buttons (wire names and the
/// Xbox pad button the coach presses) on the right; Done.
struct ControlsView: View {
    @Bindable var session: ReceiverSession
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        PPScreen {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    PPDisplay("Controls", size: 44)
                    Spacer()
                    Button("Done") { dismiss() }
                        .buttonStyle(.pixel(.primary, compact: true))
                }
                HStack(alignment: .top, spacing: 28) {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 10) {
                            PPLabel("Pedals")
                            PixelToggle(title: "On-screen pedals", isOn: $session.onScreenPedals)
                            Text("Touch pedals provide backup throttle and brake if the Arduino stops responding. Turn them off to switch to the Arduino cockpit layout.")
                                .font(PPFont.barlow(13))
                                .foregroundStyle(Theme.inkMuted)
                                .fixedSize(horizontal: false, vertical: true)
                            PPLabel("Steering").padding(.top, 6)
                            HStack {
                                Text("Full lock").font(PPFont.barlow(16, .medium))
                                Spacer()
                                ForEach([30.0, 45, 60, 90], id: \.self) { degrees in
                                    Button("\(Int(degrees))°") { session.fullLockDegrees = degrees }
                                        .font(PPFont.barlow(14, .bold))
                                        .foregroundStyle(session.fullLockDegrees == degrees ? Color.white : Theme.ink)
                                        .frame(width: 42, height: 30)
                                        .background(session.fullLockDegrees == degrees ? Theme.brand : Theme.raised)
                                        .accessibilityAddTraits(session.fullLockDegrees == degrees ? .isSelected : [])
                                }
                            }
                            PixelToggle(title: "Haptics", isOn: $session.hapticsEnabled)
                            PixelToggle(title: "More buttons (lights, TC, ABS, camera)", isOn: $session.showsAssistButtons)
                        }
                    }
                    .frame(maxWidth: .infinity)

                    VStack(alignment: .leading, spacing: 4) {
                        PPLabel("Assetto Corsa buttons")
                        ScrollView {
                            VStack(spacing: 0) {
                                ForEach(SimCommand.allCases) { command in
                                    HStack(spacing: 12) {
                                        Image(systemName: command.symbol)
                                            .font(.system(size: 16, weight: .semibold))
                                            .foregroundStyle(Theme.accent)
                                            .frame(width: 22)
                                        Text(command.title).font(PPFont.barlow(16, .medium))
                                        Spacer()
                                        Text(verbatim: command.rawValue)
                                            .font(.system(size: 12, design: .monospaced))
                                            .foregroundStyle(Theme.inkMuted)
                                        Text(command.padButton)
                                            .font(PPFont.barlow(11, .bold))
                                            .foregroundStyle(command.isCoach ? Theme.accent : Theme.ink)
                                            .padding(.horizontal, 6)
                                            .padding(.vertical, 2)
                                            .background(command.isCoach ? Theme.brandTint : Theme.raised)
                                    }
                                    .frame(minHeight: 34)
                                    .overlay(alignment: .bottom) { Rectangle().fill(Theme.hairline).frame(height: 1) }
                                    .accessibilityElement(children: .combine)
                                }
                            }
                        }
                        Text("Tap the steering dial when its retry countdown appears. Next also accepts an open retry. In drill mode, Next starts the offered drill or resets to your saved checkpoint. Resume ends the retry and returns you to where you left off.")
                            .font(PPFont.barlow(12))
                            .foregroundStyle(Theme.inkMuted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 14)
        }
    }
}

/// Square pixel switch: green when on.
struct PixelToggle: View {
    let title: LocalizedStringResource
    @Binding var isOn: Bool

    var body: some View {
        Button { isOn.toggle() } label: {
            HStack {
                Text(title)
                    .font(PPFont.barlow(16, .medium))
                    .foregroundStyle(Theme.ink)
                Spacer()
                ZStack(alignment: isOn ? .trailing : .leading) {
                    Rectangle().fill(isOn ? Theme.go : Theme.raised).frame(width: 44, height: 26)
                    Rectangle().fill(.white).frame(width: 18, height: 18).padding(4)
                }
                .pixelPanel(fill: .clear, outline: isOn ? Theme.pixelOutline : Theme.outlineStrong, width: 2)
            }
            .frame(minHeight: 36)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityRepresentation { Toggle(isOn: $isOn) { Text(title) } }
    }
}

#Preview(traits: .landscapeLeft) {
    ControlsView(session: .preview(status: .confirmed))
}
