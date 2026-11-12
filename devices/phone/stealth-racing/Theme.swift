import SwiftUI

/// Pit Pal design tokens, Pit (dark) theme. Source: the Pit Pal design system's `tokens.json`.
/// The app is dark only (landscape controller); the Paper theme is for the website and print.
enum Theme {
    // Surfaces
    static let bg = Color(hex: 0x12141C)
    static let surface = Color(hex: 0x1C1F2A)
    static let raised = Color(hex: 0x222633)
    static let hairline = Color(hex: 0x2B2F3A)
    static let outlineStrong = Color(hex: 0x616B83)
    static let pixelOutline = Color(hex: 0x0A0B10)
    // Ink
    static let ink = Color(hex: 0xE8EBF2)
    static let inkMuted = Color(hex: 0x8D96AD)
    /// Low contrast (2.6:1 on surface): only for disabled or decorative marks.
    static let inkFaint = Color(hex: 0x5A6277)
    // Brand
    static let brand = Color(hex: 0xD92B1F)
    static let onBrand = Color.white
    static let accent = Color(hex: 0xFF6A58)
    static let brandDeep = Color(hex: 0x8A150F)
    static let brandTint = Color(hex: 0x3A1512)
    // Status
    static let go = Color(hex: 0x3FD17A)
    static let onGo = Color(hex: 0x06210F)
    static let caution = Color(hex: 0xFFC233)
    static let signalBlue = Color(hex: 0x4AA8FF)
    static let led = Color(hex: 0xFF7A1A)

    /// Spacing on a 4 pt unit (space-1 ... space-12).
    enum Space {
        static let s1: CGFloat = 4, s2: CGFloat = 8, s3: CGFloat = 12, s4: CGFloat = 16
        static let s6: CGFloat = 24, s8: CGFloat = 32, s12: CGFloat = 48
    }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

// MARK: - Type

/// Two families only: Pit Pal Bubble (display, capitals) and Barlow (everything else).
enum PPFont {
    static let displayName = "PitPalBubble-Regular"

    static func barlow(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        let name = switch weight {
        case .bold, .heavy, .black: "Barlow-Bold"
        case .semibold: "Barlow-SemiBold"
        case .medium: "Barlow-Medium"
        default: "Barlow-Regular"
        }
        return .custom(name, size: size)
    }

    // Token styles (tokens.json → type.groups)
    static let title = barlow(28, .bold)
    static let heading = barlow(20, .semibold)
    static let body = barlow(16)
    static let small = barlow(14, .medium)
    static let label = barlow(12, .semibold)
}

/// Tracked uppercase label (`.pp-label`): 12 / 16, +0.16 em, ink-muted.
struct PPLabel: View {
    let text: LocalizedStringResource
    var color: Color = Theme.inkMuted

    init(_ text: LocalizedStringResource, color: Color = Theme.inkMuted) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text)
            .font(PPFont.label)
            .tracking(12 * 0.16)
            .textCase(.uppercase)
            .foregroundStyle(color)
    }
}

/// The Pit Pal Bubble heading recipe (`.pp-display`): white face, a 1-cell ink ring, a 1-cell red
/// drop shadow with its own ink edge. One art cell = size / 22; sizes are multiples of 22.
struct PPDisplay: View {
    let text: String
    var size: CGFloat = 44

    init(_ text: String, size: CGFloat = 44) {
        self.text = text.uppercased()
        self.size = size
    }

    var body: some View {
        let c = size / 22
        let ink = Theme.bg
        let ring: [(CGFloat, CGFloat)] = [(c, 0), (-c, 0), (0, c), (0, -c), (-c, -c), (c, -c), (-c, c)]
        let shadowEdge: [(CGFloat, CGFloat)] = [(2 * c, c), (c, 2 * c), (2 * c, 2 * c)]
        ZStack {
            ForEach(Array(shadowEdge.enumerated()), id: \.offset) { _, o in glyphs(ink).offset(x: o.0, y: o.1) }
            glyphs(Theme.brand).offset(x: c, y: c)
            ForEach(Array(ring.enumerated()), id: \.offset) { _, o in glyphs(ink).offset(x: o.0, y: o.1) }
            glyphs(.white)
        }
        .padding(c * 2)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(text.capitalized))
        .accessibilityAddTraits(.isHeader)
    }

    private func glyphs(_ color: Color) -> some View {
        Text(verbatim: text)
            .font(.custom(PPFont.displayName, fixedSize: size))
            .foregroundStyle(color)
            .lineLimit(1)
            .fixedSize()
    }
}

// MARK: - Pixel outline

/// Stepped-corner outline: four `b`-wide bars around the content and none on the corners, which is
/// how the design system draws pixel boxes (`box-shadow` on four sides, `radius-none`).
struct PixelFrame<S: ShapeStyle>: View {
    var width: CGFloat = 3
    let style: S

    var body: some View {
        ZStack {
            Rectangle().fill(style).padding(.vertical, -width)
            Rectangle().fill(style).padding(.horizontal, -width)
        }
    }
}

extension View {
    /// A pixel panel: fill, stepped outline, optional hard drop (`shadow-pixel`, never blurred).
    func pixelPanel(fill: Color = Theme.surface, outline: Color = Theme.hairline, width: CGFloat = 3,
                    drop: CGFloat = 0) -> some View {
        self
            .background(fill)
            .background {
                ZStack {
                    if drop > 0 { PixelFrame(width: width, style: Theme.pixelOutline).offset(y: drop) }
                    PixelFrame(width: width, style: outline)
                }
            }
            .padding(width)
    }
}

// MARK: - Mascot

/// The pixel-art mascot, nearest-neighbour scaled. Racer = main form (red suit, no helmet);
/// helmet = racing sessions (the cockpit); base = plain creature for empty states.
struct MascotImage: View {
    enum Variant: String {
        case racer = "PitPalRacer"
        case helmet = "PitPalHelmet"
        case base = "PitPalBase"
    }

    var variant: Variant = .racer
    /// The 1.1 s two-step bob from the motion spec (off under Reduce Motion).
    var bobs = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if bobs && !reduceMotion {
            TimelineView(.periodic(from: .now, by: 0.55)) { context in
                let up = Int(context.date.timeIntervalSinceReferenceDate / 0.55) % 2 == 1
                art.offset(y: up ? -7 : 0)
            }
        } else {
            art
        }
    }

    private var art: some View {
        Image(variant.rawValue)
            .resizable()
            .interpolation(.none)
            .scaledToFit()
            .accessibilityHidden(true)
    }
}

/// The PIT PAL wordmark (design-system asset; never re-typeset the mark).
struct Wordmark: View {
    var body: some View {
        Image("Wordmark")
            .resizable()
            .interpolation(.none)
            .scaledToFit()
            .accessibilityLabel(Text("Pit Pal"))
    }
}
