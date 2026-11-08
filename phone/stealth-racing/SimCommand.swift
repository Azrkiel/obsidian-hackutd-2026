import Foundation

/// Discrete actions the phone can request.
///
/// The Pit Pal coach (`python -m coach --inputs`) presses the matching virtual Xbox
/// pad button (bind each one in Assetto Corsa's Controls). The two coach commands
/// drive the coaching loop instead: Next accepts the offered drill (or rewinds for a
/// retry) and Resume ends the drill and puts the car back where it started.
/// Wire format: `evt,<eventID>,<command>,<phase>` — e.g. `evt,12,shift_up,tap`.
/// Each event is sent three times; the receiver ignores repeated IDs.
enum SimCommand: String, CaseIterable, Identifiable, Sendable {
    case coachNext = "coach_next"
    case coachResume = "coach_resume"
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

    /// Buttons shown on the driving screen by default (one row of six).
    static let primary: [SimCommand] = [.coachNext, .coachResume, .pitLimiter, .drs, .horn, .lookBack]
    /// Optional buttons enabled from the Controls sheet (a second row of six).
    static let assists: [SimCommand] = [.headlights, .tractionControlDown, .tractionControlUp, .absDown, .absUp, .camera]

    var title: LocalizedStringResource {
        switch self {
        case .coachNext: "Next"
        case .coachResume: "Resume"
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
        case .coachNext: "forward.fill"
        case .coachResume: "flag.checkered"
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

    /// Coach commands steer the coaching loop; they are not game inputs.
    var isCoach: Bool {
        self == .coachNext || self == .coachResume
    }

    /// The virtual Xbox pad button the coach presses (`BINDINGS` in coach/inputs.py).
    var padButton: String {
        switch self {
        case .coachNext, .coachResume: "Coach"
        case .shiftUp: "RB"
        case .shiftDown: "LB"
        case .pitLimiter: "Y"
        case .drs: "X"
        case .headlights: "D-pad ↑"
        case .horn: "A"
        case .lookBack: "B"
        case .tractionControlDown: "D-pad ←"
        case .tractionControlUp: "D-pad →"
        case .absDown: "LS"
        case .absUp: "RS"
        case .camera: "Back"
        }
    }
}
