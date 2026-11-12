import SwiftUI

/// The retry prompt sits over the dial and leaves the steering readout in place.
struct SteeringRetryPrompt: View {
    let offer: RetryOffer
    let accept: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.periodic(from: .now, by: reduceMotion ? 0.25 : 0.1)) { context in
            let seconds = offer.secondsLeft()
            if seconds > 0 {
                Button(action: accept) {
                    ZStack(alignment: .top) {
                        Circle()
                            .strokeBorder(Theme.led, lineWidth: 10)
                            .overlay {
                                Circle()
                                    .strokeBorder(Theme.caution.opacity(ringOpacity(at: context.date)), lineWidth: 10)
                            }
                            .accessibilityHidden(true)
                        VStack(spacing: 2) {
                            HStack(spacing: 6) {
                                Label("Retry", systemImage: "arrow.counterclockwise")
                                    .font(PPFont.barlow(22, .bold))
                                    .textCase(.uppercase)
                                    .lineLimit(1)
                                    .minimumScaleFactor(0.65)
                                Text("\(seconds)s")
                                    .font(PPFont.barlow(19, .bold))
                                    .monospacedDigit()
                                    .foregroundStyle(Theme.caution)
                                    .padding(.horizontal, 5)
                                    .background(Theme.bg)
                                    .fixedSize()
                            }
                            Text("\(offer.corner) · Tap steering")
                                .font(PPFont.barlow(14, .bold))
                                .lineLimit(1)
                                .minimumScaleFactor(0.65)
                        }
                        .foregroundStyle(Theme.bg)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 5)
                        .pixelPanel(fill: Theme.caution, outline: Theme.pixelOutline)
                        .padding(8)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text("Retry \(offer.corner)"))
                .accessibilityValue(Text("\(seconds) seconds left"))
                .accessibilityHint(Text("Rewinds to just before the corner."))
            }
        }
    }

    private func ringOpacity(at date: Date) -> Double {
        if reduceMotion { return 1 }
        let phase = date.timeIntervalSinceReferenceDate * 2 * .pi / 1.2
        return 0.55 + 0.45 * cos(phase)
    }
}
