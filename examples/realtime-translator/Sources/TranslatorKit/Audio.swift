import Foundation

/// A chunk of mono PCM audio captured from the Mac's system output.
public struct AudioFrame: Equatable {
    public let samples: [Float]
    public let sampleRate: Double
    public init(samples: [Float], sampleRate: Double) {
        self.samples = samples
        self.sampleRate = sampleRate
    }
}

/// Source of system-audio frames. The real implementation uses ScreenCaptureKit
/// (system audio only, never the microphone); tests use a deterministic fake.
public protocol AudioSource: AnyObject {
    func frames() -> AsyncStream<AudioFrame>
    func stop()
}

/// Deterministic audio source for tests: emits `count` non-empty frames.
public final class FakeAudioSource: AudioSource {
    private let count: Int
    private let sampleRate: Double
    public init(count: Int, sampleRate: Double = 48_000) {
        self.count = count
        self.sampleRate = sampleRate
    }
    public func frames() -> AsyncStream<AudioFrame> {
        AsyncStream { continuation in
            for _ in 0..<count {
                continuation.yield(AudioFrame(samples: [0.1, -0.1, 0.05, -0.05], sampleRate: sampleRate))
            }
            continuation.finish()
        }
    }
    public func stop() {}
}
