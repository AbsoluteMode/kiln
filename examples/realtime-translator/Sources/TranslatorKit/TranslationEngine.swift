import Foundation

/// Events a translation engine emits for one session: connection signals plus
/// Russian subtitle lines. No payloads beyond the translated text are surfaced.
public enum TranslationEvent: Equatable {
    case connecting
    case listening
    case line(String)
    case reconnecting
    case stopped
    case failed(String)
}

/// The swappable seam: English audio in -> Russian transcript events out.
/// Real implementations wrap a provider WebSocket (a unified realtime model, or
/// an ASR+MT pipeline); the fake scripts events so the whole pipeline is testable
/// without any API key.
public protocol TranslationEngine: AnyObject {
    func start() -> AsyncStream<TranslationEvent>
    func send(_ frame: AudioFrame)
    func stop()
}

/// Deterministic engine for tests: emits scripted Russian lines, optionally
/// simulating a mid-stream drop + recover after `dropAfter` lines.
public final class FakeTranslationEngine: TranslationEngine {
    private let script: [String]
    private let dropAfter: Int?
    private var continuation: AsyncStream<TranslationEvent>.Continuation?
    public private(set) var receivedFrames = 0

    public init(script: [String], dropAfter: Int? = nil) {
        self.script = script
        self.dropAfter = dropAfter
    }

    public func start() -> AsyncStream<TranslationEvent> {
        AsyncStream { continuation in
            self.continuation = continuation
            continuation.yield(.connecting)
            continuation.yield(.listening)
            for (index, line) in script.enumerated() {
                if let dropAfter, index == dropAfter {
                    continuation.yield(.reconnecting)
                    continuation.yield(.listening)
                }
                continuation.yield(.line(line))
            }
            continuation.finish()
        }
    }

    public func send(_ frame: AudioFrame) {
        receivedFrames += 1
    }

    public func stop() {
        continuation?.yield(.stopped)
        continuation?.finish()
    }
}
