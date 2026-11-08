import SwiftUI

/// Landscape cockpit: paddles on the top corners, fallback pedals underneath,
/// steering feedback in the middle and Assetto Corsa buttons along the bottom.
struct DrivingView: View {
    @Bindable var session: ReceiverSession
    let receiver: String

    @State private var showsControls = false
    @State private var confirmsDisconnect = false
    @State private var shiftCount = 0
    @State private var lastShift: SimCommand?
    @State private var shiftFlashTask: Task<Void, Never>?

    private var isLive: Bool { session.status.isSending }

    var body: some View {
        HStack(spacing: 16) {
            VStack(spacing: 12) {
                PaddleButton(command: .shiftDown, action: shift)
                    .frame(height: 104)
                pedal("Brake", value: $session.brake, fill: Theme.red, textOnFill: .white, fallback: "Arduino brake")
            }
            .frame(width: 150)
            .disabled(!isLive)

            VStack(spacing: 10) {
                topBar
                steering
                    .frame(maxHeight: .infinity)
                commandGrid
                    .disabled(!isLive)
            }
            .frame(maxWidth: .infinity)

            VStack(spacing: 12) {
                PaddleButton(command: .shiftUp, action: shift)
                    .frame(height: 104)
                pedal("Throttle", value: $session.throttle, fill: Theme.text, textOnFill: Theme.background, fallback: "Arduino throttle")
            }
            .frame(width: 150)
            .disabled(!isLive)
        }
        .padding(.vertical, 12)
        .padding(.horizontal, 8)
        .background(Theme.background.ignoresSafeArea())
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .sensoryFeedback(.impact(weight: .heavy), trigger: shiftCount) { _, _ in session.hapticsEnabled }
        .sheet(isPresented: $showsControls) {
            ControlsSheet(session: session)
        }
        .confirmationDialog("Disconnect from \(receiver)?", isPresented: $confirmsDisconnect, titleVisibility: .visible) {
            Button("Disconnect", role: .destructive, action: session.disconnect)
        }
    }

    // MARK: Top bar

    private var topBar: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 8, height: 8)
                    Text(receiver)
                        .font(.subheadline.weight(.semibold))
                        .lineLimit(1)
                    Text(session.status.title)
                        .font(.footnote)
                        .foregroundStyle(Theme.secondaryText)
                        .lineLimit(1)
                }
                .padding(.vertical, 8)
                .padding(.leading, 10)
                .padding(.trailing, 14)
                .background(Theme.surface, in: .capsule)
                .accessibilityElement(children: .combine)

                Spacer(minLength: 0)

                circleButton("Controls", systemImage: "slider.horizontal.3", tint: Theme.text) {
                    showsControls = true
                }
                circleButton("Disconnect", systemImage: "xmark", tint: Theme.redHighlight) {
                    confirmsDisconnect = true
                }
            }

            if let detail = session.status.detail {
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(Theme.secondaryText)
                    .lineLimit(2)
                    .padding(.horizontal, 10)
            }
        }
    }

    private var statusColor: Color {
        switch session.status {
        case .confirmed: Theme.confirmed
        case .unconfirmed, .waiting, .failed: Theme.redHighlight
        default: Theme.secondaryText
        }
    }

    private func circleButton(_ title: LocalizedStringResource, systemImage: String, tint: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 44, height: 44)
                .background(Theme.surface, in: .circle)
        }
        .accessibilityLabel(Text(title))
    }

    // MARK: Steering

    /// Shrinks the gauge rather than clipping when the status detail line and
    /// the assist button rows both take vertical space.
    private var steering: some View {
        ViewThatFits(in: .vertical) {
            steeringGauge(diameter: 250)
            steeringGauge(diameter: 210)
            steeringGauge(diameter: 170)
        }
    }

    private func steeringGauge(diameter: CGFloat) -> some View {
        VStack(spacing: 6) {
            ZStack(alignment: .top) {
                SteeringArc(value: session.steering, diameter: diameter)
                MascotImage()
                    .frame(width: diameter * 0.37)
                    .rotationEffect(.degrees(session.steering * 30))
                    .padding(.top, diameter * 0.16)
                if let lastShift {
                    Text(lastShift == .shiftUp ? "▲ Shift up" : "▼ Shift down")
                        .font(.subheadline.weight(.bold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(lastShift == .shiftUp ? Theme.red : Theme.raised, in: .capsule)
                        .padding(.top, 2)
                        .transition(.scale(scale: 0.8).combined(with: .opacity))
                }
            }
            .animation(.linear(duration: 0.1), value: session.steering)
            .animation(.snappy(duration: 0.15), value: lastShift)

            HStack(spacing: 12) {
                Text("Steer")
                    .font(.footnote.weight(.semibold))
                    .textCase(.uppercase)
                    .foregroundStyle(Theme.secondaryText)
                if session.canRecenter {
                    Text(session.steering, format: .number.precision(.fractionLength(2)).sign(strategy: .always(includingZero: false)))
                        .font(.title3.weight(.bold))
                        .monospacedDigit()
                } else {
                    Text("Waiting for motion")
                        .font(.subheadline)
                        .foregroundStyle(Theme.secondaryText)
                }
                Button(action: session.recenter) {
                    Label("Recenter", systemImage: "scope")
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Theme.redHighlight)
                        .frame(minHeight: 44)
                        .padding(.horizontal, 6)
                }
                .disabled(!session.canRecenter)
            }
            .accessibilityElement(children: .contain)
        }
    }

    // MARK: Sim buttons

    private var commands: [SimCommand] {
        session.showsAssistButtons ? SimCommand.primary + SimCommand.assists : SimCommand.primary
    }

    private var commandGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 5), spacing: 8) {
            ForEach(commands) { command in
                CommandButton(command: command, compact: session.showsAssistButtons) { phase in
                    session.send(command, phase: phase)
                }
            }
        }
    }

    // MARK: Pedals

    @ViewBuilder
    private func pedal(_ title: LocalizedStringResource, value: Binding<Double>, fill: Color, textOnFill: Color, fallback: LocalizedStringResource) -> some View {
        if session.onScreenPedals {
            PedalPad(title: title, value: value, fill: fill, textOnFill: textOnFill)
        } else {
            VStack(spacing: 6) {
                Image(systemName: "cable.connector")
                    .font(.title3)
                Text(fallback)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
            }
            .foregroundStyle(Theme.secondaryText)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay {
                RoundedRectangle(cornerRadius: 22)
                    .strokeBorder(Theme.outline, style: StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
            }
            .accessibilityElement(children: .combine)
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

// MARK: - Components

/// Gear paddle that fires on touch-down, like a real paddle shifter.
struct PaddleButton: View {
    let command: SimCommand
    let action: (SimCommand) -> Void

    @Environment(\.isEnabled) private var isEnabled
    @GestureState private var pressed = false

    private var isUp: Bool { command == .shiftUp }

    var body: some View {
        let shape = UnevenRoundedRectangle(
            topLeadingRadius: 22,
            bottomLeadingRadius: isUp ? 22 : 56,
            bottomTrailingRadius: isUp ? 56 : 22,
            topTrailingRadius: 22,
            style: .continuous
        )
        VStack(spacing: 2) {
            Image(systemName: command.symbol)
                .font(.system(size: 28, weight: .bold))
            Text(isUp ? "Up" : "Down")
                .font(.caption.weight(.semibold))
                .textCase(.uppercase)
                .opacity(0.8)
        }
        .foregroundStyle(isUp ? Color.white : Theme.text)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(isUp ? Theme.red : Theme.raised, in: shape)
        .overlay { shape.stroke(isUp ? Color.clear : Theme.outline, lineWidth: 1) }
        .brightness(pressed ? 0.12 : 0)
        .scaleEffect(pressed ? 0.96 : 1)
        .animation(.snappy(duration: 0.12), value: pressed)
        .opacity(isEnabled ? 1 : 0.45)
        .contentShape(shape)
        // Simultaneous so a paddle tap never waits on (or cancels) a held pedal.
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .updating($pressed) { _, isPressed, _ in isPressed = true }
        )
        .onChange(of: pressed) { _, isPressed in
            if isPressed { action(command) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(command.title))
        .accessibilityAddTraits(.isButton)
        .accessibilityAction { action(command) }
    }
}

/// Spring-loaded analog pedal: slide up for more, lift your finger to release.
struct PedalPad: View {
    let title: LocalizedStringResource
    @Binding var value: Double
    let fill: Color
    let textOnFill: Color

    @Environment(\.isEnabled) private var isEnabled
    @GestureState private var touching = false

    var body: some View {
        GeometryReader { proxy in
            let height = proxy.size.height
            ZStack(alignment: .bottom) {
                Theme.surface
                fill.frame(height: height * value)
                labels(primary: Theme.text, secondary: Theme.secondaryText)
                labels(primary: textOnFill, secondary: textOnFill.opacity(0.75))
                    .mask(alignment: .bottom) {
                        Rectangle().frame(height: height * value)
                    }
            }
            .clipShape(.rect(cornerRadius: 22))
            .overlay {
                RoundedRectangle(cornerRadius: 22).strokeBorder(Theme.hairline)
            }
            .contentShape(.rect(cornerRadius: 22))
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .updating($touching) { _, isTouching, _ in isTouching = true }
                    .onChanged { drag in
                        // The top 15% of the pad is full travel.
                        value = min(1, max(0, (height - drag.location.y) / (height * 0.85)))
                    }
                    .onEnded { _ in value = 0 }
            )
        }
        .opacity(isEnabled ? 1 : 0.45)
        .onChange(of: touching) { _, isTouching in
            if !isTouching { value = 0 }
        }
        .onChange(of: isEnabled) { _, enabled in
            if !enabled { value = 0 }
        }
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

    private func labels(primary: Color, secondary: Color) -> some View {
        VStack(alignment: .leading) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .textCase(.uppercase)
                .foregroundStyle(secondary)
            Spacer()
            Text(value, format: .percent.precision(.fractionLength(0)))
                .font(.system(size: 28, weight: .bold))
                .monospacedDigit()
                .foregroundStyle(primary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

/// Momentary sim button. Held commands (horn, look back) send down/up.
struct CommandButton: View {
    let command: SimCommand
    var compact = false
    let send: (SimCommand.Phase) -> Void

    @Environment(\.isEnabled) private var isEnabled
    @GestureState private var pressed = false

    var body: some View {
        VStack(spacing: 3) {
            Image(systemName: command.symbol)
                .font(.system(size: compact ? 15 : 17, weight: .semibold))
            Text(command.title)
                .font(.caption2.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .foregroundStyle(pressed ? Theme.redHighlight : Theme.text)
        .frame(maxWidth: .infinity, minHeight: compact ? 44 : 52)
        .background(pressed ? Theme.redTint : Theme.surface, in: .rect(cornerRadius: 14))
        .overlay {
            RoundedRectangle(cornerRadius: 14).strokeBorder(pressed ? Theme.red : Color.clear)
        }
        .opacity(isEnabled ? 1 : 0.45)
        .contentShape(.rect(cornerRadius: 14))
        .simultaneousGesture(
            DragGesture(minimumDistance: 0)
                .updating($pressed) { _, isPressed, _ in isPressed = true }
        )
        .onChange(of: pressed) { _, isPressed in
            if isPressed {
                send(command.isHeld ? .down : .tap)
            } else if command.isHeld {
                send(.up)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(command.title))
        .accessibilityAddTraits(.isButton)
        .accessibilityAction {
            if command.isHeld {
                send(.down)
                send(.up)
            } else {
                send(.tap)
            }
        }
    }
}

/// Half-circle gauge: red arc grows from top center toward the steering side.
struct SteeringArc: View {
    let value: Double
    var diameter: CGFloat = 250

    var body: some View {
        let end = 0.75 + value * 0.25
        ZStack {
            Circle()
                .trim(from: 0.5, to: 1)
                .stroke(Theme.raised, style: StrokeStyle(lineWidth: 10, lineCap: .round))
            Circle()
                .trim(from: min(0.75, end), to: max(0.75, end))
                .stroke(Theme.red, style: StrokeStyle(lineWidth: 10, lineCap: .round))
        }
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.tertiaryText)
                .frame(width: 2, height: 18)
                .offset(y: -4)
        }
        .frame(width: diameter, height: diameter)
        .padding(6)
        .frame(width: diameter + 12, height: diameter / 2 + 11, alignment: .top)
        .accessibilityHidden(true)
    }
}

#Preview("Drive", traits: .landscapeLeft) {
    DrivingView(session: .preview(status: .confirmed, steering: 0.35), receiver: "Stealth Racing - RIG")
}

#Preview("Drive · detail + assists", traits: .landscapeLeft) {
    DrivingView(session: .preview(status: .unconfirmed, steering: -0.6, assists: true), receiver: "Stealth Racing - RIG")
}

#Preview("Drive · Arduino pedals", traits: .landscapeLeft) {
    DrivingView(session: .preview(status: .checking, onScreenPedals: false), receiver: "Stealth Racing - RIG")
}
