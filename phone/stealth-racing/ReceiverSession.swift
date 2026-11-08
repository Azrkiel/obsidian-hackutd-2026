import CoreMotion
import Network
import Observation
import UIKit

@MainActor
@Observable
final class ReceiverSession {
    private static var activeSessions = 0
    private static var idleTimerWasDisabled = false

    private(set) var status = ReceiverStatus.disconnected
    private(set) var destination: NWEndpoint?
    private(set) var receivers: [NWEndpoint] = []
    private(set) var discoveryIssue: LocalizedStringResource?
    private(set) var packetPreview = ""
    private(set) var lastSectionSeconds: Double?
    private(set) var bestTodaySeconds: Double?
    private(set) var historySource = "Waiting for history"
    @ObservationIgnored private var lastHistoryLap: String?
    @ObservationIgnored private var historyTask: Task<Void, Never>?
    private(set) var steering = 0.0
    private(set) var canRecenter = false
    var throttle = 0.0
    var brake = 0.0
    /// Fallback throttle/brake for when the Arduino pedals fail. When off, the
    /// phone sends 0 for both and the receiver relies on the Arduino.
    var onScreenPedals = UserDefaults.standard.object(forKey: "onScreenPedals") as? Bool ?? true {
        didSet {
            UserDefaults.standard.set(onScreenPedals, forKey: "onScreenPedals")
            if !onScreenPedals { releasePedals() }
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
    @ObservationIgnored private lazy var motion = CMMotionManager()
    @ObservationIgnored private var center: Double?
    @ObservationIgnored private var sequence = 0
    @ObservationIgnored private var firstSequence = 0
    @ObservationIgnored private var lastReply: ContinuousClock.Instant?
    @ObservationIgnored private var readySince: ContinuousClock.Instant?
    @ObservationIgnored private var isReceiving = false
    @ObservationIgnored private var eventID = 0

    func receiverName(_ endpoint: NWEndpoint) -> String {
        if case let .service(name, _, _, _) = endpoint { return name }
        return String(describing: endpoint)
    }

    func startDiscovery() {
        guard browser == nil else { return }
        discoveryIssue = nil
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
                case .waiting(.dns(-65570)), .failed(.dns(-65570)):
                    self.discoveryIssue = "Allow Local Network access in Settings to find receivers."
                case .waiting, .failed:
                    self.discoveryIssue = "Discovery unavailable. You can enter the receiver address manually."
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
    }

    func connect(to endpoint: NWEndpoint) {
        guard connection == nil else { return }
        let connection = NWConnection(to: endpoint, using: .udp)
        self.connection = connection
        destination = endpoint
        status = .connecting
        if case let .service(name, _, _, _) = endpoint {
            lastReceiverName = name
            UserDefaults.standard.set(name, forKey: "lastReceiver")
        }
        firstSequence = sequence
        if Self.activeSessions == 0 {
            Self.idleTimerWasDisabled = UIApplication.shared.isIdleTimerDisabled
            UIApplication.shared.isIdleTimerDisabled = true
        }
        Self.activeSessions += 1
        if motion.isDeviceMotionAvailable {
            motion.deviceMotionUpdateInterval = 0.01
            motion.startDeviceMotionUpdates()
        }

        connection.stateUpdateHandler = { [weak self, weak connection] state in
            MainActor.assumeIsolated {
                guard let self, let connection, self.connection === connection else { return }
                self.handle(state)
            }
        }
        connection.start(queue: .main)
        transmitTask = Task { [weak self, weak connection] in
            var tick = 0
            while let connection, !Task.isCancelled {
                self?.transmit(to: connection, refreshPreview: tick == 0)
                tick = (tick + 1) % 10
                do {
                    try await Task.sleep(for: .milliseconds(10))
                } catch {
                    break
                }
            }
        }
    }

    func disconnect() {
        historyTask?.cancel()
        historyTask = nil
        lastHistoryLap = nil
        lastSectionSeconds = nil
        bestTodaySeconds = nil
        historySource = "Waiting for history"
        guard let connection else { return }
        transmitTask?.cancel()
        transmitTask = nil
        self.connection = nil
        connection.cancel()
        motion.stopDeviceMotionUpdates()
        Self.activeSessions -= 1
        if Self.activeSessions == 0 {
            UIApplication.shared.isIdleTimerDisabled = Self.idleTimerWasDisabled
        }
        destination = nil
        status = .disconnected
        center = nil
        readySince = nil
        lastReply = nil
        isReceiving = false
        canRecenter = false
        steering = 0
        releasePedals()
        packetPreview = ""
    }

    func recenter() {
        center = wheelAngle
    }

    /// Sends a discrete sim action (gear change, pit limiter, ...) as an event packet.
    /// UDP can drop packets, so each event goes out three times with the same ID.
    func send(_ command: SimCommand, phase: SimCommand.Phase = .tap) {
        guard let connection, readySince != nil else { return }
        eventID += 1
        let packet = Data("evt,\(eventID),\(command.rawValue),\(phase.rawValue)".utf8)
        for _ in 0..<3 {
            connection.send(content: packet, completion: .idempotent)
        }
    }

    func releasePedals() {
        throttle = 0
        brake = 0
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
            status = .checking
        case .waiting(let error):
            readySince = nil
            releasePedals()
            status = .waiting("Check the receiver address and Local Network access. (\(String(describing: error)))")
        case .failed(let error):
            disconnect()
            status = .failed("Check that the receiver is running and the address and port are correct. (\(String(describing: error)))")
        default:
            break
        }
    }

    private func receiveReply(on connection: NWConnection) {
        isReceiving = true
        connection.receiveMessage { [weak self, weak connection] data, _, _, error in
            MainActor.assumeIsolated {
                guard let self, let connection, self.connection === connection else { return }
                self.isReceiving = false
                if error == nil, let data,
                   let packet = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   packet["type"] as? String == "race_history",
                   let history = packet["history"] as? [String: Any] {
                    self.receiveHistory(history)
                }
                if error == nil, let data, let reply = String(data: data, encoding: .utf8),
                   reply.hasPrefix("ack,"), let acknowledged = Int(reply.dropFirst(4)),
                   acknowledged >= self.firstSequence, acknowledged < self.sequence {
                    self.lastReply = .now
                }
            }
        }
    }

    /// The local recorder remains authoritative while cloud sync is offline or catching up.
    private func receiveHistory(_ history: [String: Any]) {
        lastSectionSeconds = history["last_s"] as? Double
        bestTodaySeconds = history["best_today_s"] as? Double
        historySource = history["last_valid"] as? Bool == false ? "Last pass invalid" : "Saved on race PC"
        guard let lap = history["lap_id"] as? String, lap != lastHistoryLap else { return }
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

    private func transmit(to connection: NWConnection, refreshPreview: Bool) {
        let angle = wheelAngle
        if center == nil { center = angle }
        // Clockwise wheel rotation maps to positive steering.
        let offset = (center ?? 0) - (angle ?? center ?? 0)
        let degrees = atan2(sin(offset), cos(offset)) * 180 / .pi
        let steer = abs(degrees) < 2 ? 0 : min(1, max(-1, degrees / fullLockDegrees))
        let packet = "v1,\(sequence),\(steer),\(onScreenPedals ? throttle : 0),\(onScreenPedals ? brake : 0)"

        if refreshPreview {
            canRecenter = angle != nil
            steering = steer
            packetPreview = packet
        }

        guard let readySince else { return }
        if !isReceiving { receiveReply(on: connection) }
        if refreshPreview {
            let now = ContinuousClock.now
            if let lastReply, lastReply.duration(to: now) < .seconds(3) {
                status = .confirmed
            } else if readySince.duration(to: now) >= .seconds(3) {
                status = .unconfirmed
            }
        }
        connection.send(content: Data(packet.utf8), completion: .idempotent)
        sequence += 1
    }
}

#if DEBUG
extension ReceiverSession {
    /// Preview-only session with a fake status and no network or motion.
    /// Note: the setting arguments persist to UserDefaults like the real toggles.
    static func preview(
        status: ReceiverStatus,
        steering: Double = 0,
        assists: Bool = false,
        onScreenPedals: Bool = true
    ) -> ReceiverSession {
        let session = ReceiverSession()
        session.status = status
        session.steering = steering
        session.canRecenter = true
        session.showsAssistButtons = assists
        session.onScreenPedals = onScreenPedals
        session.packetPreview = "v1,420,\(steering),0,0"
        return session
    }
}
#endif
