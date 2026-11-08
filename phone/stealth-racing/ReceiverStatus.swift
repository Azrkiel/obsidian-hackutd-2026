import Foundation

enum ReceiverStatus: Equatable {
    case disconnected, connecting, checking, confirmed, unconfirmed
    case waiting(LocalizedStringResource), failed(LocalizedStringResource)

    var title: LocalizedStringResource {
        switch self {
        case .disconnected: "Disconnected"
        case .connecting: "Connecting…"
        case .checking: "Waiting for receiver…"
        case .confirmed: "Receiver confirmed"
        case .unconfirmed: "Sending · No reply"
        case .waiting: "Network unavailable"
        case .failed: "Connection failed"
        }
    }

    var icon: String {
        switch self {
        case .disconnected: "circle"
        case .connecting, .checking: "ellipsis.circle"
        case .confirmed: "checkmark.circle.fill"
        case .unconfirmed, .waiting, .failed: "exclamationmark.circle"
        }
    }

    var detail: LocalizedStringResource? {
        switch self {
        case .waiting(let message), .failed(let message): message
        case .unconfirmed: "Check that the current receiver is running and its UDP port is allowed through the firewall."
        default: nil
        }
    }

    var isSending: Bool {
        switch self {
        case .checking, .confirmed, .unconfirmed: true
        default: false
        }
    }
}
