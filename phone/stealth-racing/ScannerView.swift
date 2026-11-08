@preconcurrency import AVFoundation
import SwiftUI

/// 3 · Scan QR: the camera inside the pixel scanner frame, "Looking for a Pit Pal code", a torch,
/// "How it works" and the manual fallback. A Pit Pal code pairs straight away; anything else
/// shows "That's not a Pit Pal code".
struct ScannerView: View {
    let session: ReceiverSession
    let back: () -> Void
    let manual: () -> Void
    let found: (PairingCode) -> Void

    @State private var camera = QRCamera()
    @State private var torch = false
    @State private var lastBad: String?

    var body: some View {
        PPScreen {
            ZStack {
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Button(action: back) { Label("Back", systemImage: "chevron.left") }
                            .buttonStyle(.pixel(.quiet, compact: true))
                        Spacer()
                        PPLabel("How it works")
                        Text(howItWorks)
                            .font(PPFont.barlow(14))
                            .foregroundStyle(Theme.ink)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(width: 220, alignment: .leading)
                    Spacer()
                    VStack(alignment: .trailing) {
                        if camera.hasTorch {
                            PixelIconButton(title: torch ? "Torch off" : "Torch on",
                                            systemImage: torch ? "bolt.fill" : "bolt",
                                            tint: torch ? Theme.caution : Theme.ink) {
                                torch.toggle()
                                camera.setTorch(torch)
                            }
                        }
                        Spacer()
                        Button(action: manual) {
                            Label("Enter address manually", systemImage: "keyboard")
                                .font(PPFont.barlow(14, .semibold))
                                .foregroundStyle(Theme.ink)
                                .frame(minHeight: 44)
                        }
                    }
                    .frame(width: 220, alignment: .trailing)
                }
                .padding(.horizontal, 28)
                .padding(.vertical, 18)

                viewfinder
            }
        }
        .task { await camera.start() }
        .onDisappear { camera.stop() }
        .onChange(of: camera.code) { _, value in
            guard let value else { return }
            if let code = try? PairingCode(uri: value) {
                camera.stop()
                found(code)
            } else if value != lastBad {
                lastBad = value
                session.error = .badCode
            }
        }
    }

    private var howItWorks: AttributedString {
        var s = AttributedString(localized: "On your PC, Pit Pal shows **Scan me** with a code. Hold this phone steady and fill the frame.")
        s.font = PPFont.barlow(14)
        return s
    }

    private var viewfinder: some View {
        ZStack(alignment: .top) {
            Group {
                switch camera.state {
                case .running, .starting:
                    CameraPreview(session: camera.session)
                case .denied:
                    VStack(spacing: 10) {
                        Text("Camera access is off")
                            .font(PPFont.barlow(16, .semibold))
                        Text("Allow the camera for Pit Pal in Settings, or enter the address manually.")
                            .font(PPFont.barlow(13))
                            .foregroundStyle(Theme.inkMuted)
                            .multilineTextAlignment(.center)
                        Button("Open Settings") {
                            if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                        }
                        .buttonStyle(.pixel(.quiet, compact: true))
                    }
                    .padding(20)
                case .unavailable:
                    Text("No camera on this device")
                        .font(PPFont.barlow(14))
                        .foregroundStyle(Theme.inkMuted)
                }
            }
            .frame(width: 250, height: 250)
            .background(Theme.surface)
            .clipped()
            .overlay { ScannerFrameOverlay().padding(-6) }

            StatusPill("Looking for a Pit Pal code", tone: .caution)
                .offset(y: -14)
        }
    }
}

// MARK: - Camera

/// AVFoundation QR reader (custom frame and torch: the design's scanner, not VisionKit's).
@MainActor
@Observable
final class QRCamera {
    enum State { case starting, running, denied, unavailable }

    private(set) var state = State.starting
    private(set) var code: String?
    private(set) var hasTorch = false
    @ObservationIgnored let session = AVCaptureSession()
    @ObservationIgnored private var delegate: MetadataDelegate?
    @ObservationIgnored private var device: AVCaptureDevice?
    @ObservationIgnored private var configured = false

    func start() async {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: break
        case .notDetermined:
            guard await AVCaptureDevice.requestAccess(for: .video) else { state = .denied; return }
        default:
            state = .denied
            return
        }
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) else {
            state = .unavailable
            return
        }
        self.device = device
        hasTorch = device.hasTorch
        if !configured {
            guard let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) else {
                state = .unavailable
                return
            }
            session.beginConfiguration()
            session.addInput(input)
            let output = AVCaptureMetadataOutput()
            if session.canAddOutput(output) {
                session.addOutput(output)
                let delegate = MetadataDelegate { [weak self] value in self?.code = value }
                self.delegate = delegate
                output.setMetadataObjectsDelegate(delegate, queue: .main)
                if output.availableMetadataObjectTypes.contains(.qr) { output.metadataObjectTypes = [.qr] }
            }
            session.commitConfiguration()
            configured = true
        }
        code = nil
        let session = self.session
        await Task.detached(priority: .userInitiated) { session.startRunning() }.value
        state = .running
    }

    func stop() {
        setTorch(false)
        let session = self.session
        Task.detached { session.stopRunning() }
    }

    func setTorch(_ on: Bool) {
        guard let device, device.hasTorch, (try? device.lockForConfiguration()) != nil else { return }
        device.torchMode = on ? .on : .off
        device.unlockForConfiguration()
    }
}

private final class MetadataDelegate: NSObject, AVCaptureMetadataOutputObjectsDelegate {
    let onCode: @MainActor (String) -> Void

    init(onCode: @escaping @MainActor (String) -> Void) {
        self.onCode = onCode
    }

    nonisolated func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput objects: [AVMetadataObject],
                                    from connection: AVCaptureConnection) {
        guard let value = objects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first
        else { return }
        MainActor.assumeIsolated { onCode(value) }   // delegate queue is .main
    }
}

/// The live camera feed, rotated for the landscape interface.
struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {}

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }

        override func layoutSubviews() {
            super.layoutSubviews()
            // Back camera: landscape with the home side on the right is the sensor's natural 0°.
            let angle: CGFloat = window?.windowScene?.effectiveGeometry.interfaceOrientation == .landscapeLeft ? 180 : 0
            if let c = previewLayer.connection, c.isVideoRotationAngleSupported(angle) {
                c.videoRotationAngle = angle
            }
        }
    }
}

#Preview(traits: .landscapeLeft) {
    ScannerView(session: .preview(status: .disconnected), back: {}, manual: {}, found: { _ in })
}
