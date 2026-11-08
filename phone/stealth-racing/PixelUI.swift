import SwiftUI

// Pit Pal components (design system → components/bundle.css). Everything is square with stepped
// corners and hard 1-cell shadows; motion moves in whole steps and stops under Reduce Motion.

// MARK: - Pixel button (.pp-btn)

struct PixelButtonStyle: ButtonStyle {
    enum Kind { case primary, go, quiet }
    var kind: Kind = .primary
    var compact = false

    func makeBody(configuration: Configuration) -> some View {
        PixelButtonBody(configuration: configuration, kind: kind, compact: compact)
    }

    struct PixelButtonBody: View {
        let configuration: Configuration
        let kind: Kind
        let compact: Bool
        @Environment(\.isEnabled) private var isEnabled

        var body: some View {
            let b: CGFloat = 4
            let pressed = configuration.isPressed
            let (fill, text, outline, bevel): (Color, Color, Color, Color) = {
                guard isEnabled else { return (Theme.raised, Theme.inkMuted, Theme.hairline, .clear) }
                switch kind {
                case .primary: return (Theme.brand, Theme.onBrand, Theme.pixelOutline, Theme.brandDeep)
                case .go: return (Theme.go, Theme.onGo, Theme.pixelOutline, .black.opacity(0.28))
                case .quiet: return (Theme.raised, Theme.ink, Theme.outlineStrong, .clear)
                }
            }()
            configuration.label
                .font(PPFont.barlow(compact ? 14 : 16, .bold))
                .tracking(compact ? 0.5 : 0.64)
                .textCase(.uppercase)
                .foregroundStyle(text)
                .padding(.horizontal, compact ? 14 : 24)
                .padding(.vertical, compact ? 8 : 12)
                .frame(minHeight: compact ? 36 : 44)
                .background(fill)
                .overlay(alignment: .top) {   // top light bevel
                    if isEnabled { Rectangle().fill(.white.opacity(kind == .quiet ? 0.08 : 0.28)).frame(height: b) }
                }
                .overlay(alignment: .bottom) { // bottom dark bevel, gone when pressed
                    if isEnabled && !pressed { Rectangle().fill(bevel).frame(height: b) }
                }
                .background {
                    ZStack {
                        if isEnabled && !pressed && kind != .quiet {
                            PixelFrame(width: b, style: Theme.pixelOutline).offset(y: 2 * b)
                        }
                        PixelFrame(width: b, style: outline)
                    }
                }
                .padding(b)
                .offset(y: pressed && isEnabled ? b : 0)
                .contentShape(Rectangle())
        }
    }
}

extension ButtonStyle where Self == PixelButtonStyle {
    static var pixel: PixelButtonStyle { PixelButtonStyle() }
    static func pixel(_ kind: PixelButtonStyle.Kind, compact: Bool = false) -> PixelButtonStyle {
        PixelButtonStyle(kind: kind, compact: compact)
    }
}

// MARK: - Status pill (.pp-pill)

struct StatusPill: View {
    enum Tone { case neutral, go, caution, brand, info }
    let text: Text
    var tone: Tone = .neutral

    init(_ text: LocalizedStringResource, tone: Tone = .neutral) {
        self.text = Text(text)
        self.tone = tone
    }

    init(verbatim: String, tone: Tone = .neutral) {
        self.text = Text(verbatim: verbatim)
        self.tone = tone
    }

    var body: some View {
        HStack(spacing: Theme.Space.s2) {
            Blinking(enabled: tone == .caution) {
                Rectangle().fill(dot).frame(width: 8, height: 8)
            }
            text
                .font(PPFont.barlow(13, .semibold))
                .tracking(0.5)
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
        }
        .padding(.leading, 10)
        .padding(.trailing, 12)
        .padding(.vertical, 4)
        .background(Theme.raised, in: .capsule)
        .overlay { Capsule().strokeBorder(Theme.outlineStrong, lineWidth: 1) }
        .accessibilityElement(children: .combine)
    }

    private var dot: Color {
        switch tone {
        case .neutral: Theme.inkMuted
        case .go: Theme.go
        case .caution: Theme.caution
        case .brand: Theme.accent
        case .info: Theme.signalBlue
        }
    }
}

/// Information pill used for hints like "Same Wi-Fi" or "UDP 5005".
struct InfoPill: View {
    let text: LocalizedStringResource
    var tone: StatusPill.Tone = .neutral

    var body: some View {
        StatusPill(text, tone: tone)
    }
}

// MARK: - Blink (pp-blink: 1 s on/off, stepped)

struct Blinking<Content: View>: View {
    var enabled = true
    @ViewBuilder var content: Content
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if enabled && !reduceMotion {
            TimelineView(.periodic(from: .now, by: 0.5)) { context in
                let dim = Int(context.date.timeIntervalSinceReferenceDate * 2) % 2 == 1
                content.opacity(dim ? 0.25 : 1)
            }
        } else {
            content
        }
    }
}

// MARK: - LED meter / loading bar (.pp-led, .pp-load)

struct LedMeter: View {
    enum Cell { case off, go, caution, brand }
    let cells: [Cell]
    var size: CGFloat = 12
    var gap: CGFloat = 3

    var body: some View {
        HStack(spacing: gap) {
            ForEach(Array(cells.enumerated()), id: \.offset) { _, cell in
                Rectangle()
                    .fill(color(cell))
                    .frame(width: size, height: size)
                    .shadow(color: cell == .brand ? Theme.led.opacity(0.55) : .clear, radius: 6)
            }
        }
        .accessibilityHidden(true)
    }

    private func color(_ cell: Cell) -> Color {
        switch cell {
        case .off: Theme.hairline
        case .go: Theme.go
        case .caution: Theme.caution
        case .brand: Theme.brand
        }
    }

    /// `count` cells, the first `lit` coloured green → amber → red by position.
    static func filled(_ lit: Int, of count: Int) -> [Cell] {
        (0..<count).map { i in
            guard i < lit else { return .off }
            let f = Double(i) / Double(max(count - 1, 1))
            return f < 0.55 ? .go : f < 0.8 ? .caution : .brand
        }
    }
}

/// Loading bar that fills one LED at a time (pp-load--run: 70 ms per cell), then holds and restarts.
struct LoadingBar: View {
    var count = 24
    var size: CGFloat = 12
    var running = true
    /// When set, shows this fraction lit instead of the running animation.
    var progress: Double?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if let progress {
            LedMeter(cells: LedMeter.filled(Int((progress * Double(count)).rounded()), of: count), size: size)
        } else if running && !reduceMotion {
            TimelineView(.periodic(from: .now, by: 0.07)) { context in
                let step = Int(context.date.timeIntervalSinceReferenceDate / 0.07) % (count + 8)
                LedMeter(cells: LedMeter.filled(min(step, count), of: count), size: size)
            }
        } else {
            LedMeter(cells: LedMeter.filled(count / 2, of: count), size: size)
        }
    }
}

// MARK: - Pairing step row (.pp-step)

struct PairingStepRow: View {
    enum State { case done, active, waiting, skipped }
    let number: Int
    let title: LocalizedStringResource
    let detail: Text
    let state: State

    var body: some View {
        HStack(spacing: 14) {
            Text(String(format: "%02d", number))
                .font(PPFont.barlow(13, .bold))
                .tracking(1.3)
                .foregroundStyle(Theme.inkMuted)
                .frame(width: 24, alignment: .leading)
            ZStack {
                Rectangle().fill(markFill)
                switch state {
                case .done: Image(systemName: "checkmark").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.onGo)
                case .active: Text(verbatim: "…").font(PPFont.barlow(16, .bold)).foregroundStyle(Theme.bg)
                case .skipped: Image(systemName: "minus").font(.system(size: 16, weight: .bold)).foregroundStyle(Theme.ink)
                case .waiting: EmptyView()
                }
            }
            .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 0) {
                Text(title)
                    .font(PPFont.barlow(16, .semibold))
                    .foregroundStyle(state == .waiting ? Theme.inkMuted : Theme.ink)
                detail
                    .font(PPFont.barlow(13))
                    .foregroundStyle(Theme.inkMuted)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .frame(minHeight: 54)
        .pixelPanel(fill: Theme.surface, outline: Theme.hairline)
        .accessibilityElement(children: .combine)
        .accessibilityValue(Text(stateLabel))
    }

    private var markFill: Color {
        switch state {
        case .done: Theme.go
        case .active: Theme.caution
        case .waiting, .skipped: Theme.hairline
        }
    }

    private var stateLabel: LocalizedStringResource {
        switch state {
        case .done: "Done"
        case .active: "In progress"
        case .waiting: "Waiting"
        case .skipped: "Skipped"
        }
    }
}

// MARK: - Scanner frame (.pp-scan)

/// Four red pixel corner brackets and a scan line sweeping in 16 steps over 2.4 s.
struct ScannerFrameOverlay: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        GeometryReader { proxy in
            let w = proxy.size.width, h = proxy.size.height
            ZStack(alignment: .topLeading) {
                corner(rotation: 0).position(x: 14, y: 14)
                corner(rotation: 90).position(x: w - 14, y: 14)
                corner(rotation: 270).position(x: 14, y: h - 14)
                corner(rotation: 180).position(x: w - 14, y: h - 14)
                if reduceMotion {
                    line(width: w).position(x: w / 2, y: h / 2)
                } else {
                    TimelineView(.periodic(from: .now, by: 2.4 / 16)) { context in
                        let step = Int(context.date.timeIntervalSinceReferenceDate / (2.4 / 16)) % 16
                        let f = step < 8 ? Double(step) / 8 : Double(16 - step) / 8 // 12% → 88% → 12%
                        line(width: w).position(x: w / 2, y: h * (0.12 + 0.76 * f))
                    }
                }
            }
        }
        .accessibilityHidden(true)
    }

    private func corner(rotation: Double) -> some View {
        Path { p in
            p.move(to: CGPoint(x: 0, y: 40))
            p.addLine(to: .zero)
            p.addLine(to: CGPoint(x: 40, y: 0))
        }
        .stroke(Theme.brand, style: StrokeStyle(lineWidth: 6, lineCap: .square))
        .frame(width: 40, height: 40)
        .rotationEffect(.degrees(rotation))
    }

    private func line(width: CGFloat) -> some View {
        Rectangle()
            .fill(Theme.brand)
            .frame(width: max(0, width - 48), height: 4)
            .shadow(color: Theme.led.opacity(0.55), radius: 6)
    }
}

// MARK: - Checker strip (finish-line motif, pitch 24)

struct CheckerStrip: View {
    var cell: CGFloat = 12

    var body: some View {
        Canvas { context, size in
            let cols = Int(ceil(size.width / cell)), rows = Int(ceil(size.height / cell))
            for r in 0..<rows {
                for c in 0..<cols where (r + c) % 2 == 0 {
                    context.fill(Path(CGRect(x: CGFloat(c) * cell, y: CGFloat(r) * cell, width: cell, height: cell)),
                                 with: .color(.white))
                }
            }
        }
        .accessibilityHidden(true)
    }
}

// MARK: - Icon button (square, quiet, 44 pt)

struct PixelIconButton: View {
    let title: LocalizedStringResource
    let systemImage: String
    var tint: Color = Theme.ink
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 40, height: 36)
                .pixelPanel(fill: Theme.raised, outline: Theme.outlineStrong)
        }
        .buttonStyle(PressDropStyle())
        .accessibilityLabel(Text(title))
    }
}

/// Press drops a cell (3 pt), no easing.
struct PressDropStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.offset(y: configuration.isPressed ? 3 : 0)
    }
}

// MARK: - Screen chrome

/// The landscape screen container: Pit background, safe-area aware, entrance in steps.
struct PPScreen<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.bg.ignoresSafeArea())
            .foregroundStyle(Theme.ink)
    }
}
