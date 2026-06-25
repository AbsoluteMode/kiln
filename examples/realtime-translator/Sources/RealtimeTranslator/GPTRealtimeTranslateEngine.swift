import Foundation
import os
import TranslatorKit

/// The real engine: OpenAI `gpt-realtime-translate`. English system audio streams
/// into ONE model over a WebSocket; Russian transcript deltas stream back out.
/// One hop, sub-second, purpose-built for live translation.
///
/// Protocol verified against the live API:
///   wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate
///   session.update -> { audio: { output: { language: "ru" } } }
///   send   session.input_audio_buffer.append  { audio: base64 pcm16 @ 24 kHz }
///   recv   session.output_transcript.delta  { delta: "<russian>" }
final class GPTRealtimeTranslateEngine: TranslationEngine {
    private let apiKey: String
    private var task: URLSessionWebSocketTask?
    private var continuation: AsyncStream<TranslationEvent>.Continuation?
    private let session = URLSession(configuration: .default)
    private var line = ""
    private var firstDelta = true
    private var lastYieldAt = Date.distantPast
    private let olog = Logger(subsystem: "com.kiln.realtimetranslator", category: "engine")
    private let debug = ProcessInfo.processInfo.environment["KILN_DEBUG"] != nil

    init(apiKey: String) { self.apiKey = apiKey }

    private func dbg(_ s: String) {
        if debug { FileHandle.standardError.write(Data((s + "\n").utf8)) }
    }

    func start() -> AsyncStream<TranslationEvent> {
        AsyncStream { continuation in
            self.continuation = continuation
            continuation.yield(.connecting)

            var request = URLRequest(url: URL(string: "wss://api.openai.com/v1/realtime/translations?model=gpt-realtime-translate")!)
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
            request.setValue("kiln-realtime-translator", forHTTPHeaderField: "OpenAI-Safety-Identifier")

            let task = session.webSocketTask(with: request)
            self.task = task
            task.resume()

            // target language: Russian
            sendJSON(["type": "session.update", "session": ["audio": ["output": ["language": "ru"]]]])
            continuation.yield(.listening)
            olog.info("connecting to gpt-realtime-translate")
            receiveLoop()
        }
    }

    private func receiveLoop() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure(let error):
                self.dbg("WS-FAIL: \(error)")
                self.olog.error("ws failure: \(error.localizedDescription, privacy: .public)")
                self.continuation?.yield(.reconnecting)
            case .success(let message):
                if case .string(let text) = message { self.handle(text) }
                self.receiveLoop()
            }
        }
    }

    private func handle(_ text: String) {
        guard let data = text.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = obj["type"] as? String else { return }
        dbg("RECV: \(type)")
        if type == "error" {
            dbg("RAW: \(text.prefix(400))")
            olog.error("api error: \(text.prefix(300), privacy: .public)")
        }

        if type == "session.output_transcript.delta", let delta = obj["delta"] as? String {
            if firstDelta { firstDelta = false; olog.info("first russian delta received") }
            line += delta
            // Drop the OLDEST sentence only once the buffer is large. This is rare and
            // happens far above the visible area, so on-screen lines never reflow/jump
            // (frequent word-trimming was what made the text feel "not anchored").
            if line.count > 800, let sentenceEnd = line.range(of: ". ") {
                line = String(line[sentenceEnd.upperBound...])
            }
            // Throttle UI updates (~14 fps) so rendering can't fall behind the audio
            // and accumulate a growing display lag ("rendering debt").
            let now = Date()
            if now.timeIntervalSince(lastYieldAt) >= 0.07 {
                lastYieldAt = now
                continuation?.yield(.line(line))
            }
        }
    }

    func send(_ frame: AudioFrame) {
        // frames are 24 kHz mono Float (capture is configured at 24 kHz) -> pcm16 LE.
        var pcm = Data(capacity: frame.samples.count * 2)
        for sample in frame.samples {
            let value = Int16(max(-1.0, min(1.0, sample)) * Float(Int16.max))
            withUnsafeBytes(of: value.littleEndian) { pcm.append(contentsOf: $0) }
        }
        sendJSON(["type": "session.input_audio_buffer.append", "audio": pcm.base64EncodedString()])
    }

    private func sendJSON(_ object: [String: Any]) {
        guard let task,
              let data = try? JSONSerialization.data(withJSONObject: object),
              let string = String(data: data, encoding: .utf8) else { return }
        task.send(.string(string)) { _ in }
    }

    func stop() {
        sendJSON(["type": "session.close"])
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        continuation?.yield(.stopped)
        continuation?.finish()
    }
}
