import SwiftUI

/// 6 · Cockpit: shift tiles at the sides, the steering dial in the middle, and the
/// Assetto Corsa buttons along the bottom. Touch pedals sit below the shifters when enabled.
/// A coach retry offer highlights the steering dial with a tappable countdown.
struct CockpitView: View {
    @Bindable var session: ReceiverSession
    let leave: () -> Void

    @State private var showsControls = false
    @State private var confirmsLeave = false
    @State private var shiftCount = 0
    @State private var lastShift: SimCommand?
    @State private var shiftFlashTask: Task<Void, Never>?

    private var isLive: Bool { session.status.isSending }

    var body: some View {
        PPScreen {
            let columnWidth: CGFloat = session.onScreenPedals ? 138 : 104
            let shiftHeight: CGFloat? = session.onScreenPedals ? 92 : nil
            HStack(spacing: 14) {
                VStack(spacing: 10) {
                    ShiftTile(command: .shiftDown, action: shift)
                        .frame(height: shiftHeight)
                    if session.onScreenPedals {
                        PedalTile(title: "Brake", value: $session.brake, fill: Theme.brand, ink: .white)
                    }
                }
                .frame(width: columnWidth)
                .disabled(!isLive)

                VStack(spacing: 8) {
                    topBar
                    gauge.frame(maxHeight: .infinity)
                    commandRows.disabled(!isLive)
                }
                .frame(maxWidth: .infinity)

                VStack(spacing: 10) {
                    ShiftTile(command: .shiftUp, action: shift)
                        .frame(height: shiftHeight)
                    if session.onScreenPedals {
                        PedalTile(title: "Throttle", value: $session.throttle, fill: Theme.ink, ink: Theme.bg)
                    }
                }
                .frame(width: columnWidth)
                .disabled(!isLive)
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 10)
        }
        .sensoryFeedback(.impact(weight: .heavy), trigger: shiftCount) { _, _ in session.hapticsEnabled }
        .sensoryFeedback(.warning, trigger: session.offersShown) { _, _ in session.hapticsEnabled }
        .fullScreenCover(isPresented: $showsControls) {
            ControlsView(session: session)
        }
        .confirmationDialog("Leave \(session.receiverName)?", isPresented: $confirmsLeave, titleVisibility: .visible) {
            Button("Disconnect", role: .destructive, action: leave)
        }
    }

    // MARK: Top bar

    private var topBar: some View {
        HStack(spacing: 8) {
            StatusPill(verbatim: "\(session.receiverName)  ·  \(String(localized: session.status.title))", tone: statusTone)
            Spacer(minLength: 0)
            Button {
                session.onScreenPedals.toggle()
            } label: {
                Label(session.onScreenPedals ? "Touch pedals" : "Arduino", systemImage: "arrow.left.arrow.right")
            }
            .buttonStyle(.pixel(.quiet, compact: true))
            .fixedSize()
            .accessibilityLabel("Pedal layout")
            .accessibilityValue(session.onScreenPedals ? "Touch pedals" : "Arduino")
            .accessibilityHint("Switches to the other pedal layout.")
            PixelIconButton(title: "Controls", systemImage: "slider.horizontal.3") { showsControls = true }
            PixelIconButton(title: "Disconnect", systemImage: "xmark", tint: Theme.accent) { confirmsLeave = true }
        }
    }

    private var statusTone: StatusPill.Tone {
        switch session.status {
        case .confirmed: .go
        case .unconfirmed, .waiting, .failed: .brand
        default: .caution
        }
    }

    // MARK: Steering gauge

    private var gauge: some View {
        VStack(spacing: 4) {
            GeometryReader { proxy in
                let d = min(proxy.size.width, proxy.size.height)
                ZStack {
                    TachRoundel(value: session.steering)
                    MascotImage(variant: .helmet)
                        .frame(width: d * 0.34)
                        .rotationEffect(.degrees(session.steering * 30))
                        .offset(y: -d * 0.06)
                    if let lastShift {
                        Text(lastShift == .shiftUp ? "▲ Shift up" : "▼ Shift down")
                            .font(PPFont.barlow(13, .bold))
                            .tracking(1)
                            .textCase(.uppercase)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 4)
                            .background(lastShift == .shiftUp ? Theme.brand : Theme.raised)
                            .offset(y: d * 0.24)
                    }
                }
                .frame(width: d, height: d)
                .overlay {
                    if isLive, let offer = session.offer {
                        SteeringRetryPrompt(offer: offer) {
                            guard let current = session.offer, current.id == offer.id,
                                  current.secondsLeft() > 0 else { return }
                            session.send(.coachNext)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            HStack(spacing: 12) {
                PPLabel("Steer")
                if session.canRecenter {
                    Text(session.steering, format: .number.precision(.fractionLength(2)).sign(strategy: .always(includingZero: false)))
                        .font(PPFont.barlow(20, .bold))
                        .monospacedDigit()
                        .foregroundStyle(Theme.ink)
                } else {
                    Text("Waiting for motion")
                        .font(PPFont.small)
                        .foregroundStyle(Theme.inkMuted)
                }
                Button(action: session.recenter) {
                    Label("Recenter", systemImage: "scope")
                        .font(PPFont.barlow(15, .semibold))
                        .foregroundStyle(Theme.accent)
                        .frame(minHeight: 36)
                }
                .disabled(!session.canRecenter)
            }
        }
    }

    // MARK: Buttons

    private var commandRows: some View {
        let rows = session.showsAssistButtons ? [SimCommand.primary, SimCommand.assists] : [SimCommand.primary]
        return VStack(spacing: 6) {
            ForEach(rows.indices, id: \.self) { i in
                HStack(spacing: 6) {
                    ForEach(rows[i]) { command in
                        CommandTile(command: command, compact: session.showsAssistButtons) { phase in
                            session.send(command, phase: phase)
                        }
                    }
                }
            }
        }
    }

    private func shift(_ command: SimCommand) {
        session.send(command)
        shiftCount += 1
        lastShift = command
        shiftFlashTask?.cancel()
        shiftFlashTask = Task {
            try? await Task.sleep(for: .milliseconds(600))
            if !Task.isCancelled { lastShift = nil }
        }
    }
}

// MARK: - Tach roundel (SteeringGauge)

/// Graphite disc, a 240° sweep of ticks every 7.5° (major every 30°); ticks from centre to the
/// steer value are brand red.
struct TachRoundel: View {
    let value: Double

    var body: some View {
        Canvas { context, size in
            let d = min(size.width, size.height)
            let c = CGPoint(x: size.width / 2, y: size.height / 2)
            let s = d / 196   // the design's 196 pt dial
            let disc = CGRect(x: c.x - 96 * s, y: c.y - 96 * s, width: 192 * s, height: 192 * s)
            context.fill(Path(ellipseIn: disc), with: .color(Theme.surface))
            context.stroke(Path(ellipseIn: disc), with: .color(Theme.pixelOutline), lineWidth: 3 * s)
            let active = value * 120
            for k in -16...16 {
                let deg = Double(k) * 7.5
                let major = k % 4 == 0
                let lit = (active >= 0 && deg >= 0 && deg <= active) || (active < 0 && deg <= 0 && deg >= active)
                let r0 = (major ? 70 : 76) * s, r1 = 84 * s
                let a = (deg - 90) * .pi / 180
                var p = Path()
                p.move(to: CGPoint(x: c.x + cos(a) * r0, y: c.y + sin(a) * r0))
                p.addLine(to: CGPoint(x: c.x + cos(a) * r1, y: c.y + sin(a) * r1))
                let color = lit ? Theme.brand : major ? Theme.inkMuted : Theme.inkFaint
                context.stroke(p, with: .color(color), lineWidth: (major ? 4 : 3) * s)
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Tiles

/// Shift tile: fires on touch-down, like a paddle shifter (down: raised, up: brand red).
struct ShiftTile: View {
    let command: SimCommand
    let action: (SimCommand) -> Void

    @Environment(\.isEnabled) private var isEnabled
    @GestureState private var pressed = false
    private var isUp: Bool { command == .shiftUp }

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: isUp ? "arrowtriangle.up.fill" : "arrowtriangle.down.fill")
                .font(.system(size: 20, weight: .bold))
            Text(isUp ? "Shift up" : "Shift down")
                .font(PPFont.barlow(13, .bold))
                .tracking(1)
                .textCase(.uppercase)
        }
        .foregroundStyle(isUp ? Color.white : Theme.ink)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pixelPanel(fill: isUp ? Theme.brand : Theme.raised,
                    outline: Theme.pixelOutline, drop: pressed ? 0 : 3)
        .offset(y: pressed ? 3 : 0)
        .opacity(isEnabled ? 1 : 0.45)
        .contentShape(Rectangle())
        // Simultaneous so a shift never waits on (or cancels) a held pedal.
        .simultaneousGesture(DragGesture(minimumDistance: 0).updating($pressed) { _, p, _ in p = true })
        .onChange(of: pressed) { _, isPressed in if isPressed { action(command) } }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(command.title))
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { action(command) }
    }
}

/// Spring-loaded pedal pad: slide up for more, lift to release.
struct PedalTile: View {
    let title: LocalizedStringResource
    @Binding var value: Double
    let fill: Color
    let ink: Color

    @Environment(\.isEnabled) private var isEnabled
    @GestureState private var touching = false

    var body: some View {
        GeometryReader { proxy in
            let h = proxy.size.height
            ZStack(alignment: .bottom) {
                Theme.surface
                fill.frame(height: h * value)
                labels(color: .white)
                labels(color: ink).mask(alignment: .bottom) { Rectangle().frame(height: h * value) }
            }
            .contentShape(Rectangle())
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .updating($touching) { _, t, _ in t = true }
                    .onChanged { drag in
                        value = min(1, max(0, (h - drag.location.y) / (h * 0.85)))  // top 15% = full travel
                    }
                    .onEnded { _ in value = 0 }
            )
        }
        .pixelPanel(fill: Theme.surface, outline: Theme.outlineStrong)
        .opacity(isEnabled ? 1 : 0.45)
        .onChange(of: touching) { _, t in if !t { value = 0 } }
        .onChange(of: isEnabled) { _, e in if !e { value = 0 } }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(title))
        .accessibilityValue(Text(value, format: .percent.precision(.fractionLength(0))))
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: value = min(1, value + 0.1)
            case .decrement: value = max(0, value - 0.1)
            @unknown default: break
            }
        }
    }

    private func labels(color: Color) -> some View {
        VStack {
            Text(title)
                .font(PPFont.barlow(15, .bold))
                .tracking(1.5)
                .textCase(.uppercase)
            Spacer()
            Text("Backup pedal")
                .font(PPFont.barlow(12, .medium))
        }
        .foregroundStyle(color)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Square command button, icon over label (`.pp-cmd`). Held commands send down/up.
struct CommandTile: View {
    let command: SimCommand
    var compact = false
    let send: (SimCommand.Phase) -> Void

    @Environment(\.isEnabled) private var isEnabled
    @GestureState private var pressed = false

    var body: some View {
        VStack(spacing: 4) {
            Image(systemName: command.symbol)
                .font(.system(size: compact ? 15 : 18, weight: .semibold))
            Text(command.title)
                .font(PPFont.barlow(11, .bold))
                .tracking(0.5)
                .textCase(.uppercase)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .foregroundStyle(fg)
        .frame(maxWidth: .infinity, minHeight: compact ? 40 : 52)
        .background(alignment: .top) { Rectangle().fill(.white.opacity(0.18)).frame(height: 3) }
        .pixelPanel(fill: bg, outline: Theme.pixelOutline)
        .offset(y: pressed ? 3 : 0)
        .opacity(isEnabled ? 1 : 0.45)
        .contentShape(Rectangle())
        .simultaneousGesture(DragGesture(minimumDistance: 0).updating($pressed) { _, p, _ in p = true })
        .onChange(of: pressed) { _, isPressed in
            if isPressed { send(command.isHeld ? .down : .tap) } else if command.isHeld { send(.up) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(command.title))
        .accessibilityAddTraits(.isButton)
        .accessibilityAction {
            if command.isHeld { send(.down); send(.up) } else { send(.tap) }
        }
    }

    private var bg: Color {
        switch command {
        case .coachNext: Theme.brand
        case .coachResume: Theme.go
        default: pressed ? Theme.brandTint : Theme.raised
        }
    }

    private var fg: Color {
        switch command {
        case .coachNext: .white
        case .coachResume: Theme.onGo
        default: pressed ? Theme.accent : Theme.ink
        }
    }
}

#Preview("Cockpit · touch pedals", traits: .landscapeLeft) {
    CockpitView(session: .preview(status: .confirmed, steering: 0.35), leave: {})
}

#Preview("Cockpit · retry offer", traits: .landscapeLeft) {
    CockpitView(session: .preview(status: .confirmed, steering: -0.2, offer: ("Lesmo 1", 4)), leave: {})
}

#Preview("Cockpit · Arduino pedals", traits: .landscapeLeft) {
    CockpitView(session: .preview(status: .confirmed, steering: -0.6, assists: true, onScreenPedals: false), leave: {})
}
