import CryptoKit
import Foundation
import Security

/// QR pairing with the NomadSim receiver (`docs/PAIRING.md`, `coach/pairing.py`).
///
/// The PC shows `nomadsim://pair?v=1&h=<ipv4>[,…]&p=<port>&k=<key>&n=<name>&id=<id>`. The phone says
/// hello with a fresh nonce, the receiver answers with a signed welcome, and both derive a session
/// key. From then on every packet carries `,<tag16>` = hex(HMAC-SHA256(S, packet))[0..<16].
struct PairingCode: Codable, Equatable, Sendable {
    var hosts: [String]
    var port: UInt16
    var key: Data
    var name: String
    var receiverID: String

    enum ParseError: Error { case notPitPal }

    /// Parses the QR / deep-link URI. Anything else is "not a Pit Pal code".
    init(uri: String) throws(ParseError) {
        guard let comps = URLComponents(string: uri.trimmingCharacters(in: .whitespacesAndNewlines)),
              comps.scheme == "nomadsim", comps.host == "pair" else { throw .notPitPal }
        var q: [String: String] = [:]
        for item in comps.queryItems ?? [] where q[item.name] == nil { q[item.name] = item.value ?? "" }
        guard q["v"] == "1", let p = q["p"].flatMap(UInt16.init), p > 0,
              let k = q["k"].flatMap(Data.init(base64URL:)), k.count == 16 else { throw .notPitPal }
        let hosts = (q["h"] ?? "").split(separator: ",").map(String.init).filter { !$0.isEmpty }
        guard !hosts.isEmpty else { throw .notPitPal }
        self.hosts = hosts
        port = p
        key = k
        name = q["n"].flatMap { $0.isEmpty ? nil : $0 } ?? "Pit Pal receiver"
        receiverID = q["id"] ?? ""
    }
}

/// The phone's side of the handshake and packet signing (mirrors `coach.pairing.PhoneClient`).
struct PairingHandshake: Sendable {
    let key: SymmetricKey
    let phoneNonce: String

    init(key: Data, phoneNonce: String = PairingHandshake.freshNonce()) {
        self.key = SymmetricKey(data: key)
        self.phoneNonce = phoneNonce
    }

    static func freshNonce() -> String {
        var bytes = [UInt8](repeating: 0, count: 8)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    /// `h1,<pn>,<tag32>`
    var hello: String {
        let body = "h1,\(phoneNonce)"
        return "\(body),\(Self.tag(key, body, bytes: 16))"
    }

    /// Checks `w1,<pn>,<rn>,<name>,<tag32>`; returns the session (and the PC's name) if it's genuine.
    func accept(welcome: String) -> PairedSession? {
        guard let comma = welcome.lastIndex(of: ",") else { return nil }
        let body = String(welcome[..<comma]), tag = String(welcome[welcome.index(after: comma)...])
        let parts = body.split(separator: ",", omittingEmptySubsequences: false).map(String.init)
        guard parts.count == 4, parts[0] == "w1", parts[1] == phoneNonce,
              Self.constantTimeEqual(Self.tag(key, body, bytes: 16), tag) else { return nil }
        let s = HMAC<SHA256>.authenticationCode(for: Data("s1,\(phoneNonce),\(parts[2])".utf8), using: key)
        return PairedSession(key: SymmetricKey(data: Data(s)), receiverName: parts[3])
    }

    static func tag(_ key: SymmetricKey, _ text: String, bytes: Int) -> String {
        let mac = HMAC<SHA256>.authenticationCode(for: Data(text.utf8), using: key)
        return Data(mac).prefix(bytes).map { String(format: "%02x", $0) }.joined()
    }

    static func constantTimeEqual(_ a: String, _ b: String) -> Bool {
        let x = Array(a.utf8), y = Array(b.utf8)
        guard x.count == y.count else { return false }
        return zip(x, y).reduce(UInt8(0)) { $0 | ($1.0 ^ $1.1) } == 0
    }
}

/// A live signed session with one receiver.
struct PairedSession: Sendable {
    let key: SymmetricKey
    let receiverName: String

    /// `<packet>,<tag16>`
    func sign(_ packet: String) -> String {
        "\(packet),\(PairingHandshake.tag(key, packet, bytes: 8))"
    }

    /// The packet without its tag if the tag is right, else nil.
    func verify(_ signed: String) -> String? {
        guard let comma = signed.lastIndex(of: ",") else { return nil }
        let packet = String(signed[..<comma]), tag = String(signed[signed.index(after: comma)...])
        guard tag.count == 16 else { return nil }
        return PairingHandshake.constantTimeEqual(PairingHandshake.tag(key, packet, bytes: 8), tag) ? packet : nil
    }
}

// MARK: - Saved pairings (Keychain)

/// Pairing codes the phone has scanned, newest first, kept in the Keychain (the key is a secret).
enum PairingStore {
    private static let service = "com.hackutd.stealth.pairing"
    private static let account = "codes"

    static func load() -> [PairingCode] {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                    kSecAttrService as String: service, kSecAttrAccount as String: account,
                                    kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var out: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess, let data = out as? Data,
              let codes = try? JSONDecoder().decode([PairingCode].self, from: data) else { return [] }
        return codes
    }

    static func remember(_ code: PairingCode) {
        var codes = load().filter { $0.receiverID != code.receiverID || code.receiverID.isEmpty && $0.key != code.key }
        codes.insert(code, at: 0)
        save(Array(codes.prefix(8)))
    }

    static func forget(_ code: PairingCode) {
        save(load().filter { $0 != code })
    }

    private static func save(_ codes: [PairingCode]) {
        guard let data = try? JSONEncoder().encode(codes) else { return }
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                   kSecAttrService as String: service, kSecAttrAccount as String: account]
        SecItemDelete(base as CFDictionary)
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(add as CFDictionary, nil)
    }
}

extension Data {
    /// base64url without padding (the QR's `k`).
    init?(base64URL s: String) {
        var b = s.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        b += String(repeating: "=", count: (4 - b.count % 4) % 4)
        self.init(base64Encoded: b)
    }
}

#if DEBUG
/// The test vectors from docs/PAIRING.md, checked at launch in debug builds (no test target yet).
enum PairingSelfTest {
    static func run() -> Bool {
        guard let code = try? PairingCode(uri: "nomadsim://pair?v=1&h=192.168.1.20&p=5005&k=AAECAwQFBgcICQoLDA0ODw&n=RACE-PC&id=be45cb26"),
              code.key == Data(0...15), code.hosts == ["192.168.1.20"], code.port == 5005, code.name == "RACE-PC" else {
            return fail("URI")
        }
        let hs = PairingHandshake(key: code.key, phoneNonce: "0011223344556677")
        guard hs.hello == "h1,0011223344556677,1848502b318a1b49b374b83e1078ecae" else { return fail("hello") }
        guard let s = hs.accept(welcome: "w1,0011223344556677,8899aabbccddeeff,RACE-PC,85423be883ccfd4d1085c0216ffab5a0"),
              s.receiverName == "RACE-PC" else { return fail("welcome") }
        let sHex = s.key.withUnsafeBytes { Data($0) }.map { String(format: "%02x", $0) }.joined()
        guard sHex == "0bcf001ecf747095b6294c23a8d326db5f2a29b66d9747dfd193b467d1903144" else { return fail("session key") }
        guard s.sign("v1,30,-0.5,0.75,0") == "v1,30,-0.5,0.75,0,8e0946fe5fa26537",
              s.sign("evt,12,coach_next,tap") == "evt,12,coach_next,tap,bcb0c5fa3f6514d3",
              s.verify("ack,30,bb436dcdf47754f4") == "ack,30",
              s.verify("ack,30,bb436dcdf47754f5") == nil else { return fail("signing") }
        guard hs.accept(welcome: "w1,0011223344556677,8899aabbccddeeff,RACE-PC,00000000000000000000000000000000") == nil,
              (try? PairingCode(uri: "https://example.com")) == nil else { return fail("rejects") }
        print("PairingSelfTest: all PAIRING.md vectors pass")
        return true
    }

    private static func fail(_ what: String) -> Bool {
        assertionFailure("PairingSelfTest failed: \(what)")
        return false
    }
}
#endif
