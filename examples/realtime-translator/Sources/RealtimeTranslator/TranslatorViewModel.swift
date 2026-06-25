import Foundation
import Combine
import os
import TranslatorKit

/// Observable wrapper over a TranslatorKit session. Picks the real provider engine
/// + ScreenCaptureKit capture when a key is present; otherwise surfaces the no-key
/// state and makes no cloud call.
@MainActor
final class TranslatorViewModel: ObservableObject {
    static let shared = TranslatorViewModel(keyStore: TranslatorViewModel.defaultKeyStore())

    /// Keys live in a local file under Application Support (never in the bundle,
    /// never committed). Reliable for an ad-hoc personal build; the Keychain
    /// remains the path for distribution.
    static func defaultKeyStore() -> KeyStore {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
            .appendingPathComponent("RealtimeTranslator", isDirectory: true).path
        return FileKeyStore(directory: dir)
    }

    @Published private(set) var state: SessionState = .idle
    @Published private(set) var currentLine: String = ""
    @Published private(set) var hasKey: Bool = false

    private let keyStore: KeyStore
    private let provider = "openai"
    private var runner: SessionRunner?
    private var runTask: Task<Void, Never>?

    /// Observability: session lifecycle / connection state only — never the key,
    /// the audio, or the transcript text.
    private let log = Logger(subsystem: "com.kiln.realtimetranslator", category: "session")

    init(keyStore: KeyStore) {
        self.keyStore = keyStore
        self.hasKey = (try? keyStore.read(forProvider: provider)).flatMap { $0 } != nil
    }

    func saveKey(_ key: String) {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        try? keyStore.save(trimmed, forProvider: provider)
        hasKey = !trimmed.isEmpty
    }

    var isRunning: Bool {
        switch state {
        case .connecting, .listening, .reconnecting: return true
        default: return false
        }
    }

    func start() {
        let key = (try? keyStore.read(forProvider: provider)).flatMap { $0 } ?? ""
        guard !key.isEmpty else {
            state = .failed("no_key")
            log.info("session start blocked: no key configured")
            return
        }
        let engine = GPTRealtimeTranslateEngine(apiKey: key)
        let runner = SessionRunner(engine: engine, audioSource: SystemAudioSource())
        self.runner = runner
        state = .connecting
        log.info("session connecting")
        runTask = Task { [weak self] in
            await runner.runToCompletion { snapshot in
                Task { @MainActor in
                    self?.state = snapshot.state
                    self?.currentLine = snapshot.currentLine
                    self?.log.info("session state: \(String(describing: snapshot.state), privacy: .public)")
                }
            }
        }
    }

    func stop() {
        runner?.stop()
        runTask?.cancel()
        runner = nil
        runTask = nil
        state = .stopped
        currentLine = ""
        log.info("session stopped")
    }
}
