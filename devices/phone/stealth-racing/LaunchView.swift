import SwiftUI

/// 1 · Launch: mascot, wordmark, an LED loader ("Warming up the pit wall"), Skip, checker strip.
struct LaunchView: View {
    let done: () -> Void

    @State private var lit = 0
    @State private var finished = false
    private let cells = 24

    var body: some View {
        PPScreen {
            ZStack(alignment: .bottom) {
                VStack(spacing: 10) {
                    Spacer(minLength: 0)
                    MascotImage(variant: .racer, bobs: true)
                        .frame(height: 132)
                    Wordmark()
                        .frame(height: 96)
                    Spacer(minLength: 0)
                    VStack(spacing: 6) {
                        LedMeter(cells: LedMeter.filled(lit, of: cells), size: 12)
                        PPLabel("Warming up the pit wall")
                    }
                    .padding(.bottom, 26)
                }
                .frame(maxWidth: .infinity)

                HStack(alignment: .bottom) {
                    Button("Skip", action: finish)
                        .buttonStyle(.pixel(.quiet, compact: true))
                    Spacer()
                    PPLabel("Sim racing coach", color: Theme.inkFaint)
                        .padding(.bottom, 10)
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 22)

                CheckerStrip(cell: 12)
                    .frame(height: 12)
                    .ignoresSafeArea(edges: .horizontal)
            }
        }
        .task {
            // One LED at a time (70 ms per cell), then on to pairing.
            for i in 1...cells {
                try? await Task.sleep(for: .milliseconds(70))
                lit = i
            }
            try? await Task.sleep(for: .milliseconds(300))
            finish()
        }
    }

    private func finish() {
        guard !finished else { return }   // Skip and the loader must not both navigate
        finished = true
        done()
    }
}

#Preview(traits: .landscapeLeft) {
    LaunchView {}
}
