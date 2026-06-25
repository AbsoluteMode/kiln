import Foundation

/// Observable lifecycle state of a translation session.
public enum SessionState: Equatable {
    case idle
    case connecting
    case listening
    case reconnecting
    case stopped
    case failed(String)
}

public struct SessionSnapshot: Equatable {
    public let state: SessionState
    public let currentLine: String
    public init(state: SessionState, currentLine: String) {
        self.state = state
        self.currentLine = currentLine
    }
}

/// Pure reducer: maps engine events to the observable session state.
/// Deterministic and UI-free, so the entire pipeline is verifiable without keys.
public struct SessionReducer {
    public private(set) var state: SessionState = .idle
    public private(set) var currentLine: String = ""
    public init() {}

    public mutating func apply(_ event: TranslationEvent) {
        switch event {
        case .connecting:
            state = .connecting
        case .listening:
            state = .listening
        case .line(let text):
            state = .listening
            currentLine = text
        case .reconnecting:
            state = .reconnecting
        case .stopped:
            state = .stopped
            currentLine = ""
        case .failed(let category):
            state = .failed(category)
        }
    }

    public var snapshot: SessionSnapshot { SessionSnapshot(state: state, currentLine: currentLine) }

    public mutating func reset() {
        state = .idle
        currentLine = ""
    }
}

/// Orchestrates one session: pumps audio frames into the engine and reduces its
/// events into snapshots. The app layer wraps this in an ObservableObject.
public final class SessionRunner {
    private let engine: TranslationEngine
    private let audioSource: AudioSource
    private var reducer = SessionReducer()

    public init(engine: TranslationEngine, audioSource: AudioSource) {
        self.engine = engine
        self.audioSource = audioSource
    }

    /// Runs the session until the engine stream completes, delivering a snapshot
    /// after every event. Returns the final snapshot.
    @discardableResult
    public func runToCompletion(onSnapshot: ((SessionSnapshot) -> Void)? = nil) async -> SessionSnapshot {
        let engine = self.engine
        let audioSource = self.audioSource
        let pump = Task {
            for await frame in audioSource.frames() {
                engine.send(frame)
            }
        }
        for await event in engine.start() {
            reducer.apply(event)
            onSnapshot?(reducer.snapshot)
        }
        _ = await pump.value
        return reducer.snapshot
    }

    public func stop() {
        engine.stop()
        audioSource.stop()
    }
}
