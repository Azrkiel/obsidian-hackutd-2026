import Foundation

/// Discrete Assetto Corsa actions the phone can request.
///
/// These are stubs: the app sends an event packet and the receiver/bridge on the
/// PC decides how to perform it (virtual controller button, keystroke, etc.).
/// Wire format: `evt,<eventID>,<command>,<phase>` — e.g. `evt,12,shift_up,tap`.
/// Each event is sent three times; the receiver should ignore repeated IDs.
enum SimCommand: String, CaseIterable, Identifiable, Sendable {
    case shiftUp = "shift_up"
    case shiftDown = "shift_down"
    case pitLimiter = "pit_limiter"
    case drs
    case headlights
    case horn
    case lookBack = "look_back"
    case tractionControlDown = "tc_down"
    case tractionControlUp = "tc_up"
    case absDown = "abs_down"
    case absUp = "abs_up"
    case camera

    enum Phase: String, Sendable {
        /// A single press, e.g. a gear change.
        case tap
        /// Held actions (horn, look back) send `down` then `up`.
        case down, up
    }

    var id: String { rawValue }

    /// Buttons shown on the driving screen by default.
    static let primary: [SimCommand] = [.pitLimiter, .drs, .headlights, .horn, .lookBack]
    /// Optional buttons enabled from the Controls sheet.
    static let assists: [SimCommand] = [.tractionControlDown, .tractionControlUp, .absDown, .absUp, .camera]

    var title: LocalizedStringResource {
        switch self {
        case .shiftUp: "Shift up"
        case .shiftDown: "Shift down"
        case .pitLimiter: "Pit limiter"
        case .drs: "DRS"
        case .headlights: "Lights"
        case .horn: "Horn"
        case .lookBack: "Look back"
        case .tractionControlDown: "TC −"
        case .tractionControlUp: "TC +"
        case .absDown: "ABS −"
        case .absUp: "ABS +"
        case .camera: "Camera"
        }
    }

    var symbol: String {
        switch self {
        case .shiftUp: "plus"
        case .shiftDown: "minus"
        case .pitLimiter: "p.circle"
        case .drs: "wind"
        case .headlights: "lightbulb"
        case .horn: "speaker.wave.2"
        case .lookBack: "eye"
        case .tractionControlDown, .absDown: "minus.circle"
        case .tractionControlUp, .absUp: "plus.circle"
        case .camera: "video"
        }
    }

    /// Held for as long as the finger is down (sends down/up instead of tap).
    var isHeld: Bool {
        self == .horn || self == .lookBack
    }

    /// True until the PC bridge maps this command to a real Assetto Corsa input.
    var isStub: Bool {
        switch self {
        case .shiftUp, .shiftDown: false
        default: true
        }
    }
}
