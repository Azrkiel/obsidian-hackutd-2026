import SwiftUI

/// Palette pulled from the Stealth mascot assets (stealth-mascot-final).
enum Theme {
    static let background = Color(hex: 0x12141C)
    static let surface = Color(hex: 0x1C1F2A)
    static let raised = Color(hex: 0x222633)
    static let hairline = Color(hex: 0x2B2F3A)
    static let outline = Color(hex: 0x363B49)
    static let text = Color(hex: 0xE8EBF2)
    static let secondaryText = Color(hex: 0x8D96AD)
    static let tertiaryText = Color(hex: 0x5A6277)
    static let red = Color(hex: 0xD92B1F)
    static let redHighlight = Color(hex: 0xFF6A58)
    static let redTint = Color(hex: 0x3A1512)
    static let confirmed = Color(hex: 0x3FD17A)
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

/// The pixel-art mascot, scaled without smoothing.
struct MascotImage: View {
    enum Variant: String {
        case helmetSuit = "Mascot"
        case base = "MascotBase"
    }

    var variant: Variant = .helmetSuit

    var body: some View {
        Image(variant.rawValue)
            .resizable()
            .interpolation(.none)
            .scaledToFit()
            .accessibilityHidden(true)
    }
}

/// Small rounded label used for hints like "Same Wi-Fi" or "UDP 5005".
struct InfoPill: View {
    let text: LocalizedStringResource

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .monospacedDigit()
            .foregroundStyle(Color(hex: 0xC5CDE0))
            .padding(.horizontal, 10)
            .padding(.vertical, 5)
            .background(Theme.raised, in: .capsule)
    }
}
