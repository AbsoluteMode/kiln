import Foundation
import TranslatorKit

/// Entry point. Normally launches the GUI; `--smoke <wav>` runs the real engine
/// headlessly on a 48 kHz mono PCM16 WAV and prints the Russian (verifies the
/// engine without Screen Recording permission). Reads OPENAI_API_KEY from the
/// environment or the local key store.
@main
struct Entry {
    static func main() {
        let args = CommandLine.arguments
        if let idx = args.firstIndex(of: "--smoke"), idx + 1 < args.count {
            runSmoke(path: args[idx + 1])
            return
        }
        RealtimeTranslatorApp.main()
    }
}

private func runSmoke(path: String) {
    let key = ProcessInfo.processInfo.environment["OPENAI_API_KEY"] ?? ""
    guard !key.isEmpty else { print("SMOKE: no OPENAI_API_KEY"); return }
    guard let frames = loadFrames48k(path: path) else { print("SMOKE: cannot read \(path)"); return }
    print("SMOKE: \(frames.count) frames @48k -> gpt-realtime-translate")

    let engine = GPTRealtimeTranslateEngine(apiKey: key)
    let done = DispatchSemaphore(value: 0)
    Task {
        var last = ""
        let collector = Task {
            for await event in engine.start() {
                if case .line(let s) = event { last = s; print("RU: \(s)") }
            }
        }
        for frame in frames {
            engine.send(frame)
            try? await Task.sleep(nanoseconds: 18_000_000)
        }
        try? await Task.sleep(nanoseconds: 6_000_000_000)
        engine.stop()
        collector.cancel()
        print("SMOKE FINAL: \(last)")
        done.signal()
    }
    done.wait()
}

private func loadFrames48k(path: String) -> [AudioFrame]? {
    guard let data = FileManager.default.contents(atPath: path), data.count > 44 else { return nil }
    let pcm = data.subdata(in: 44..<data.count)
    var samples = [Float]()
    samples.reserveCapacity(pcm.count / 2)
    pcm.withUnsafeBytes { raw in
        for v in raw.bindMemory(to: Int16.self) {
            samples.append(Float(Int16(littleEndian: v)) / Float(Int16.max))
        }
    }
    var frames = [AudioFrame]()
    var i = 0
    let chunk = 480  // ~20ms @ 24k
    while i < samples.count {
        let end = min(i + chunk, samples.count)
        frames.append(AudioFrame(samples: Array(samples[i..<end]), sampleRate: 24_000))
        i = end
    }
    return frames
}
