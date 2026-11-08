import CoreMotion
import Network
import Observation
import UIKit

/// The phone's link to the Pit Pal receiver (`python -m coach --inputs`):
/// Bonjour discovery, QR pairing, ~100 Hz `v1` steering packets, `evt` buttons, receipt
/// confirmation (`ack`) and the coach's retry offers (`ofr` / `ofx`).
@MainActor
@Observable
final class ReceiverSession {
    private static var activeSessions = 0
    private static var idleTimerWasDisabled = false

    // Connection
    private(set) var status = ReceiverStatus.disconnected
    private(set) var destination: NWEndpoint?
    private(set) var receiverName = ""
    private(set) var receiverAddress = ""
    /// The connecting screen's four steps.
    private(set) var steps = ConnectSteps()
    /// The error card to show, if any (design: 8 · Error states).
    var error: PPError?
    /// Set after a successful QR handshake: every packet is signed with it.
    private(set) var signed: PairedSession?
    private(set) var savedCodes: [PairingCode] = PairingStore.load()

    // Discovery
    private(set) var receivers: [NWEndpoint] = []
    private(set) var discoveryIssue: LocalizedStringResource?
    private(set) var isSearching = false

    // Driving
    private(set) var steering = 0.0
    private(set) var canRecenter = false
    var throttle = 0.0
    var brake = 0.0
    /// The coach's open retry offer, shown on the steering dial.
    private(set) var offer: RetryOffer?
    /// Bumped when a new offer appears (one haptic tap).
    private(set) var offersShown = 0
    @ObservationIgnored private var lastAnnouncedOfferID: String?

    // Race history
    private(set) var lastSectionSeconds: Double?
    private(set) var bestTodaySeconds: Double?
    private(set) var historySource: LocalizedStringResource?
    @ObservationIgnored private var lastHistoryLap: String?
    @ObservationIgnored private var historyTask: Task<Void, Never>?

    // Settings
    /// On-screen throttle/brake. On: the receiver takes the pedals from the phone, even
    /// while the Arduino is plugged in (it goes on standby). Off: the phone sends 0 and
    /// the receiver uses the Arduino again.
    var onScreenPedals = UserDefaults.standard.object(forKey: "onScreenPedals") as? Bool ?? false {
        didSet {
            UserDefaults.standard.set(onScreenPedals, forKey: "onScreenPedals")
            if !onScreenPedals { releasePedals() }
            if onScreenPedals != oldValue { sendPedalMode() }
        }
    }
    /// Wheel rotation (degrees) that maps to full steering lock.
    var fullLockDegrees = UserDefaults.standard.object(forKey: "fullLockDegrees") as? Double ?? 45 {
        didSet { UserDefaults.standard.set(fullLockDegrees, forKey: "fullLockDegrees") }
    }
    var hapticsEnabled = UserDefaults.standard.object(forKey: "hapticsEnabled") as? Bool ?? true {
        didSet { UserDefaults.standard.set(hapticsEnabled, forKey: "hapticsEnabled") }
    }
    var showsAssistButtons = UserDefaults.standard.bool(forKey: "showsAssistButtons") {
        didSet { UserDefaults.standard.set(showsAssistButtons, forKey: "showsAssistButtons") }
    }
    private(set) var lastReceiverName = UserDefaults.standard.string(forKey: "lastReceiver")

    @ObservationIgnored private var browser: NWBrowser?
    @ObservationIgnored private var connection: NWConnection?
    @ObservationIgnored private var transmitTask: Task<Void, Never>?
    @ObservationIgnored private var handshakeTask: Task<Void, Never>?
    @ObservationIgnored private lazy var motion = CMMotionManager()
    @ObservationIgnored private var center: Double?
    @ObservationIgnored private var sequence = 0
    @ObservationIgnored private var firstSequence = 0
    @ObservationIgnored private var lastReply: ContinuousClock.Instant?
    @ObservationIgnored private var everConfirmed = false
    @ObservationIgnored private var readySince: ContinuousClock.Instant?
    @ObservationIgnored private var isReceiving = false
    @ObservationIgnored private var eventID = 0
    @ObservationIgnored private var code: PairingCode?
    @ObservationIgnored private var handshake: PairingHandshake?
    @ObservationIgnored private var rehellos = 0
    @ObservationIgnored private var sending = false
    @ObservationIgnored private var lastEndpoint: NWEndpoint?

    func receiverName(_ endpoint: NWEndpoint) -> String {
        switch endpoint {
        case let .service(name, _, _, _): name
        case let .hostPort(host, port): "\(host):\(port)"
        default: String(describing: endpoint)
        }
    }

    // MARK: Discovery

    func startDiscovery() {
        guard browser == nil else { return }
        discoveryIssue = nil
        isSearching = true
        let browser = NWBrowser(for: .bonjour(type: "_stealth-racing._udp", domain: "local."), using: .udp)
        // Both Network framework callbacks are delivered on the main queue.
        browser.browseResultsChangedHandler = { [weak self, weak browser] results, _ in
            MainActor.assumeIsolated {
                guard let self, let browser, self.browser === browser else { return }
                self.receivers = results.map(\.endpoint).sorted {
                    self.receiverName($0).localizedStandardCompare(self.receiverName($1)) == .orderedAscending
                }
            }
        }
        browser.stateUpdateHandler = { [weak self, weak browser] state in
            MainActor.assumeIsolated {
                guard let self, let browser, self.browser === browser else { return }
                switch state {
                case .ready:
                    self.discoveryIssue = nil
                case .waiting(.dns(-65570)), .failed(.dns(-65570)):  // kDNSServiceErr_PolicyDenied
                    self.discoveryIssue = "Allow Local Network for Pit Pal in Settings to find your rig."
                    self.error = .localNetworkOff
                case .waiting, .failed:
                    self.discoveryIssue = "Discovery unavailable. Scan the code or enter the address."
                default:
                    break
                }
            }
        }
        self.browser = browser
        browser.start(queue: .main)
    }

    func stopDiscovery() {
        browser?.cancel()
        browser = nil
        receivers = []
        isSearching = false
    }

    // MARK: Connect

    /// Pair with a scanned (or saved) code: try each of the PC's addresses until one answers the hello.
    func connect(code: PairingCode) {
        guard connection == nil else { return }
        self.code = code
        receiverName = code.name
        error = nil
        steps = ConnectSteps(paired: true)
        status = .connecting
        handshakeTask = Task { [weak self] in
            guard let self else { return }
            var sawBadWelcome = false
            for host in code.hosts {
                guard !Task.isCancelled else { return }
                let endpoint = NWEndpoint.hostPort(host: .init(host), port: .init(rawValue: code.port) ?? 5005)
                self.open(endpoint, address: host)
                let hs = PairingHandshake(key: code.key)
                self.handshake = hs
                for _ in 0..<3 {   // UDP: say hello up to three times per address
                    self.sendRaw(hs.hello)
                    try? await Task.sleep(for: .milliseconds(450))
                    if self.signed != nil { return }
                    if self.steps.badWelcome { sawBadWelcome = true }
                }
                if self.signed != nil { return }
                self.close(keepingSteps: true)
            }
            guard !Task.isCancelled, self.signed == nil else { return }
            self.status = .disconnected
            self.error = sawBadWelcome ? .badCode : .noReply(paired: true)
        }
    }

    /// Connect without a code (nearby list or manual address). Works while the receiver still accepts
    /// unpaired phones (`--pairing optional` before any phone has paired, or `off`).
    func connect(to endpoint: NWEndpoint) {
        guard connection == nil else { return }
        code = nil
        handshake = nil
        signed = nil
        error = nil
        lastEndpoint = endpoint
        receiverName = receiverName(endpoint)
        steps = ConnectSteps(paired: false)
        if case let .service(name, _, _, _) = endpoint {
            lastReceiverName = name
            UserDefaults.standard.set(name, forKey: "lastReceiver")
        }
        open(endpoint, address: Self.address(of: endpoint))
        startDriving()
    }

    func disconnect() {
        handshakeTask?.cancel()
        handshakeTask = nil
        close(keepingSteps: false)
        historyTask?.cancel()
        historyTask = nil
        lastHistoryLap = nil
        lastSectionSeconds = nil
        bestTodaySeconds = nil
        historySource = nil
        status = .disconnected
        signed = nil
        handshake = nil
        code = nil
        offer = nil
        lastAnnouncedOfferID = nil
        rehellos = 0
    }

    /// Try the same receiver again (the error cards' Try again / Reconnect).
    func reconnect() {
        let again = code, endpoint = lastEndpoint
        disconnect()
        if let again { connect(code: again) } else if let endpoint { connect(to: endpoint) }
    }

    func forget(_ code: PairingCode) {
        PairingStore.forget(code)
        savedCodes = PairingStore.load()
    }

    func recenter() {
        center = wheelAngle
    }

    /// Sends a discrete sim action (gear change, pit limiter, ...) as an event packet.
    /// UDP can drop packets, so each event goes out three times with the same ID.
    func send(_ command: SimCommand, phase: SimCommand.Phase = .tap) {
        guard readySince != nil, sending else { return }
        eventID += 1
        let packet = "evt,\(eventID),\(command.rawValue),\(phase.rawValue)"
        for _ in 0..<3 { sendRaw(packet, sign: true) }
        if command == .coachNext, offer != nil {
            offer = nil  // the receiver takes Next as "accept this offer"; ofx will follow
        }
    }

    /// Tells the receiver who drives the pedals: `pedals_phone` or `pedals_auto` (Arduino first).
    /// Not a pad button, so it isn't a SimCommand (it would show up in the Controls list).
    func sendPedalMode() {
        guard sending else { return }
        eventID += 1
        let packet = "evt,\(eventID),\(onScreenPedals ? "pedals_phone" : "pedals_auto"),tap"
        for _ in 0..<3 { sendRaw(packet, sign: true) }
    }

    func releasePedals() {
        throttle = 0
        brake = 0
    }

    // MARK: Internals

    private static func address(of endpoint: NWEndpoint) -> String {
        if case let .hostPort(host, _) = endpoint { return "\(host)" }
        return ""
    }

    private func open(_ endpoint: NWEndpoint, address: String) {
        let connection = NWConnection(to: endpoint, using: .udp)
        self.connection = connection
        destination = endpoint
        receiverAddress = address
        status = .connecting
        firstSequence = sequence
        everConfirmed = false
        lastReply = nil
        connection.stateUpdateHandler = { [weak self, weak connection] state in
            MainActor.assumeIsolated {
                guard let self, let connection, self.connection === connection else { return }
                self.handle(state)
            }
        }
        connection.start(queue: .main)
    }

    private func close(keepingSteps: Bool) {
        transmitTask?.cancel()
        transmitTask = nil
        if let connection {
            connection.cancel()
            self.connection = nil
        }
        if sending {
            sending = false
            motion.stopDeviceMotionUpdates()
            Self.activeSessions -= 1
            if Self.activeSessions == 0 {
                UIApplication.shared.isIdleTimerDisabled = Self.idleTimerWasDisabled
            }
        }
        destination = nil
        center = nil
        readySince = nil
        lastReply = nil
        isReceiving = false
        canRecenter = false
        steering = 0
        releasePedals()
        if !keepingSteps { steps = ConnectSteps() }
    }

    /// Start the 100 Hz steering stream (after the handshake, or straight away when unpaired).
    private func startDriving() {
        guard !sending, let connection else { return }
        sending = true
        // A phone with on-screen pedals on takes the pedals as soon as it connects. (A phone with them
        // off says nothing, so a Pedals switch made on the dashboard or Rev is left alone.)
        if onScreenPedals { sendPedalMode() }
        if Self.activeSessions == 0 {
            Self.idleTimerWasDisabled = UIApplication.shared.isIdleTimerDisabled
            UIApplication.shared.isIdleTimerDisabled = true
        }
        Self.activeSessions += 1
        if motion.isDeviceMotionAvailable {
            motion.deviceMotionUpdateInterval = 0.01
            motion.startDeviceMotionUpdates()
        }
        transmitTask = Task { [weak self, weak connection] in
            var tick = 0
            while let connection, !Task.isCancelled {
                self?.transmit(to: connection, refresh: tick == 0)
                tick = (tick + 1) % 10
                do { try await Task.sleep(for: .milliseconds(10)) } catch { break }
            }
        }
    }

    private func sendRaw(_ packet: String, sign: Bool = false) {
        guard let connection else { return }
        let text = sign ? (signed?.sign(packet) ?? packet) : packet
        connection.send(content: Data(text.utf8), completion: .idempotent)
        if !isReceiving { receive(on: connection) }
    }

    private var wheelAngle: Double? {
        guard let gravity = motion.deviceMotion?.gravity else { return nil }
        return atan2(gravity.x, gravity.y)
    }

    private func handle(_ state: NWConnection.State) {
        switch state {
        case .ready:
            readySince = .now
            lastReply = nil
            steps.found = true
            if sending { status = .checking }
        case .waiting(let error):
            readySince = nil
            releasePedals()
            if case .posix(.ENETDOWN) = error { self.error = .localNetworkOff }
            status = .waiting("Check the receiver address and Local Network access.")
        case .failed:
            let paired = code != nil
            disconnect()
            self.error = .noReply(paired: paired)
        default:
            break
        }
    }

    private func receive(on connection: NWConnection) {
        isReceiving = true
        connection.receiveMessage { [weak self, weak connection] data, _, _, error in
            MainActor.assumeIsolated {
                guard let self, let connection, self.connection === connection else { return }
                self.isReceiving = false
                if error == nil, let data, let text = String(data: data, encoding: .utf8) {
                    self.handle(reply: text)
                }
                if self.connection === connection { self.receive(on: connection) }
            }
        }
    }

    private func handle(reply raw: String) {
        if raw.hasPrefix("w1,"), let handshake, signed == nil {
            if let session = handshake.accept(welcome: raw) {
                signed = session
                receiverName = session.receiverName
                steps.codeVerified = true
                rehellos = 0
                if let code {
                    PairingStore.remember(code)
                    savedCodes = PairingStore.load()
                    lastReceiverName = code.name
                    UserDefaults.standard.set(code.name, forKey: "lastReceiver")
                }
                startDriving()
            } else {
                steps.badWelcome = true
            }
            return
        }
        if raw == "rehello" {
            // The receiver has no session for us (it restarted, or a new code was made).
            guard let code, rehellos < 1 else {
                if code != nil { disconnect(); error = .badCode }
                return
            }
            rehellos += 1
            lastAnnouncedOfferID = nil
            let hs = PairingHandshake(key: code.key)
            handshake = hs
            signed = nil
            for _ in 0..<3 { sendRaw(hs.hello) }
            return
        }
        // Everything else must be signed when we're paired.
        let packet: String
        if let signed {
            guard let p = signed.verify(raw) else { return }
            packet = p
        } else {
            packet = raw
        }
        if packet.hasPrefix("ack,"), let n = Int(packet.dropFirst(4)), n >= firstSequence, n < sequence {
            lastReply = .now
        } else if packet.hasPrefix("ofr,") {
            handleOffer(packet)
        } else if packet.hasPrefix("ofx,") {
            let id = String(packet.dropFirst(4))
            if offer?.id == id { offer = nil }
        } else if packet.first == "{",
                  let payload = try? JSONSerialization.jsonObject(with: Data(packet.utf8)) as? [String: Any],
                  payload["type"] as? String == "race_history",
                  let history = payload["history"] as? [String: Any] {
            receiveHistory(history)
        }
    }

    /// `ofr,<offer id>,<corner>,<ms left>` (~4/s while the offer is open).
    private func handleOffer(_ packet: String) {
        let parts = packet.split(separator: ",", omittingEmptySubsequences: false).map(String.init)
        guard parts.count >= 4, let ms = Int(parts[parts.count - 1]), ms > 0 else { return }
        let id = parts[1]
        let corner = parts[2..<(parts.count - 1)].joined(separator: ",")
        let now = ContinuousClock.now
        let next = RetryOffer(id: id, corner: corner, deadline: now + .milliseconds(ms), lastHeard: now)
        if lastAnnouncedOfferID != id {
            lastAnnouncedOfferID = id
            offersShown += 1
        }
        offer = next
    }

    /// The local recorder remains authoritative while cloud sync is offline or catching up.
    private func receiveHistory(_ history: [String: Any]) {
        let lap = history["lap_id"] as? String
        if let lap, lap == lastHistoryLap { return }
        lastSectionSeconds = history["last_s"] as? Double
        bestTodaySeconds = history["best_today_s"] as? Double
        historySource = history["last_valid"] as? Bool == false ? "Last pass invalid" : "Saved on race PC"
        guard let lap else { return }
        lastHistoryLap = lap
        historyTask?.cancel()
        guard let cloud = history["cloud"] as? [String: Any],
              let server = cloud["url"] as? String, let database = cloud["database"] as? String,
              !database.isEmpty, let driver = cloud["driver_id"] as? String,
              UUID(uuidString: driver) != nil, let base = URL(string: server),
              ["https", "http"].contains(base.scheme?.lowercased() ?? ""), base.host != nil,
              base.user == nil, base.password == nil else { return }
        let endpoint = base.appendingPathComponent("v1/database").appendingPathComponent(database).appendingPathComponent("sql")
        let quoted: (String) -> String = { "'" + $0.replacingOccurrences(of: "'", with: "''") + "'" }
        var sql = "SELECT lap.* FROM lap JOIN session ON lap.session_id = session.session_id WHERE session.driver_id = \(quoted(driver))"
        for field in ["track", "car", "corner"] {
            if let value = cloud[field] as? String { sql += " AND session.\(field) = \(quoted(value))" }
        }
        let query = sql
        historyTask = Task { [weak self] in
            // Give the outbox time to deliver this lap. Each pass triggers at most four reads.
            for delay in [0, 1, 2, 4] {
                if delay > 0 {
                    do { try await Task.sleep(for: .seconds(delay)) } catch { return }
                }
                guard !Task.isCancelled else { return }
                do {
                    var request = URLRequest(url: endpoint)
                    request.httpMethod = "POST"
                    request.setValue("text/plain", forHTTPHeaderField: "Content-Type")
                    request.httpBody = Data(query.utf8)
                    request.timeoutInterval = 3
                    let (data, response) = try await URLSession.shared.data(for: request)
                    guard let response = response as? HTTPURLResponse, response.statusCode == 200,
                          let results = try JSONSerialization.jsonObject(with: data) as? [[String: Any]],
                          let result = results.first, let schema = result["schema"] as? [String: Any],
                          let elements = schema["elements"] as? [[String: Any]],
                          let rows = result["rows"] as? [[Any]] else { continue }
                    let names = elements.map { element -> String in
                        if let name = element["name"] as? String { return name }
                        return (element["name"] as? [String: String])?["some"] ?? ""
                    }
                    guard !names.contains(""), Set(names).count == names.count else { continue }
                    let records = rows.filter { $0.count == names.count }.map { Dictionary(uniqueKeysWithValues: zip(names, $0)) }
                    guard let latest = records.first(where: { $0["lap_id"] as? String == lap }),
                          let self, self.lastHistoryLap == lap, !Task.isCancelled else { continue }
                    self.lastSectionSeconds = latest["valid"] as? Bool == true ? Self.sqlNumber(latest["section_s"]) : nil
                    let midnight = Calendar.current.startOfDay(for: Date()).timeIntervalSince1970
                    self.bestTodaySeconds = records.compactMap { row -> Double? in
                        guard row["valid"] as? Bool == true,
                              let at = Self.sqlNumber(row["at"]), at >= midnight,
                              let seconds = Self.sqlNumber(row["section_s"]), seconds > 0 else { return nil }
                        return seconds
                    }.min()
                    self.historySource = latest["valid"] as? Bool == true ? "Live history" : "Last pass invalid"
                    return
                } catch { /* Keep the local packet values; steering is independent of this task. */ }
            }
        }
    }

    private static func sqlNumber(_ value: Any?) -> Double? {
        if let number = value as? Double, number.isFinite { return number }
        if let option = value as? [String: Any] { return sqlNumber(option["some"]) }
        if let option = value as? [Any], option.count == 2, option[0] as? Int == 0 { return sqlNumber(option[1]) }
        return nil
    }

    private func transmit(to connection: NWConnection, refresh: Bool) {
        let angle = wheelAngle
        if center == nil { center = angle }
        // Clockwise wheel rotation maps to positive steering.
        let offset = (center ?? 0) - (angle ?? center ?? 0)
        let degrees = atan2(sin(offset), cos(offset)) * 180 / .pi
        let steer = abs(degrees) < 2 ? 0 : min(1, max(-1, degrees / fullLockDegrees))
        let packet = "v1,\(sequence),\(steer),\(onScreenPedals ? throttle : 0),\(onScreenPedals ? brake : 0)"

        if refresh {
            canRecenter = angle != nil
            steering = steer
        }
        guard let readySince else { return }
        if refresh {
            let now = ContinuousClock.now
            steps.sending = true
            if let lastReply, lastReply.duration(to: now) < .seconds(3) {
                status = .confirmed
                steps.confirmed = true
                everConfirmed = true
                if case .noReply = error { error = nil }
                if error == .receiverLost { error = nil }
            } else if readySince.duration(to: now) >= .seconds(3) {
                status = .unconfirmed
                if everConfirmed {
                    if error == nil { error = .receiverLost }
                } else if readySince.duration(to: now) >= .seconds(6), error == nil {
                    error = .noReply(paired: signed != nil)
                }
            }
            if let offer, offer.lastHeard.duration(to: now) > .milliseconds(1200) || offer.deadline < now {
                self.offer = nil  // no ofr for a while: the offer closed and the ofx was lost
            }
        }
        sendRaw(packet, sign: true)
        sequence += 1
    }
}

/// The four steps on the Connecting screen.
struct ConnectSteps: Equatable {
    var paired = false
    var found = false
    var codeVerified = false
    var badWelcome = false
    var sending = false
    var confirmed = false
}

/// A retry offer from the coach (`ofr`): the corner and when its countdown ends.
struct RetryOffer: Equatable {
    let id: String
    let corner: String
    let deadline: ContinuousClock.Instant
    let lastHeard: ContinuousClock.Instant

    func secondsLeft(at now: ContinuousClock.Instant = .now) -> Int {
        max(0, Int((now.duration(to: deadline) / .seconds(1)).rounded(.up)))
    }
}

/// The design's error states.
enum PPError: Equatable, Identifiable {
    case noReply(paired: Bool)
    case localNetworkOff
    case badCode
    case receiverLost

    var id: String {
        switch self {
        case .noReply: "noReply"
        case .localNetworkOff: "localNetworkOff"
        case .badCode: "badCode"
        case .receiverLost: "receiverLost"
        }
    }
}

#if DEBUG
extension ReceiverSession {
    /// Preview-only session with a fake state and no network or motion.
    /// Note: the setting arguments persist to UserDefaults like the real toggles.
    static func preview(
        status: ReceiverStatus,
        steering: Double = 0,
        assists: Bool = false,
        onScreenPedals: Bool = true,
        steps: ConnectSteps = ConnectSteps(),
        offer: (corner: String, seconds: Int)? = nil
    ) -> ReceiverSession {
        let session = ReceiverSession()
        session.status = status
        session.steering = steering
        session.canRecenter = true
        session.showsAssistButtons = assists
        session.onScreenPedals = onScreenPedals
        session.receiverName = "Stealth Racing - RIG"
        session.receiverAddress = "192.168.1.24"
        session.steps = steps
        if let offer {
            let now = ContinuousClock.now
            session.offer = RetryOffer(id: "e1", corner: offer.corner,
                                       deadline: now + .seconds(offer.seconds), lastHeard: now)
        }
        return session
    }
}
#endif
