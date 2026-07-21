import XCTest
@testable import TranslatorKit

final class TranslatorKitTests: XCTestCase {

    // VER-002 (unit): a Russian line event renders as the current subtitle.
    func testReducerRendersRussianLine() {
        var reducer = SessionReducer()
        reducer.apply(.connecting)
        reducer.apply(.listening)
        reducer.apply(.line("Привет, как дела?"))
        XCTAssertEqual(reducer.state, .listening)
        XCTAssertEqual(reducer.currentLine, "Привет, как дела?")
    }

    // VER-004 (unit): stopping clears the subtitle.
    func testReducerStopClearsSubtitle() {
        var reducer = SessionReducer()
        reducer.apply(.line("Привет"))
        reducer.apply(.stopped)
        XCTAssertEqual(reducer.state, .stopped)
        XCTAssertEqual(reducer.currentLine, "")
    }

    // VER-001 + VER-002 (integration): audio frames reach the engine and a
    // scripted Russian line flows through the pipeline to a snapshot.
    func testPipelineDeliversFramesAndRussianLine() async {
        let engine = FakeTranslationEngine(script: ["Привет, как дела?"])
        let runner = SessionRunner(engine: engine, audioSource: FakeAudioSource(count: 5))
        var seenLines: [String] = []
        let final = await runner.runToCompletion { snapshot in
            if !snapshot.currentLine.isEmpty { seenLines.append(snapshot.currentLine) }
        }
        XCTAssertGreaterThan(engine.receivedFrames, 0)          // VER-001: audio reached the pipeline
        XCTAssertTrue(seenLines.contains("Привет, как дела?"))  // VER-002: line rendered
        XCTAssertEqual(final.state, .listening)
    }

    // VER-005 (integration): a mid-stream drop surfaces .reconnecting and the
    // session resumes with later lines, never crashing.
    func testReconnectResumesWithoutCrashing() async {
        let engine = FakeTranslationEngine(script: ["one", "two", "three"], dropAfter: 1)
        let runner = SessionRunner(engine: engine, audioSource: FakeAudioSource(count: 1))
        var states: [SessionState] = []
        let final = await runner.runToCompletion { snapshot in states.append(snapshot.state) }
        XCTAssertTrue(states.contains(.reconnecting))
        XCTAssertEqual(final.currentLine, "three")
        XCTAssertEqual(final.state, .listening)
    }

    // VER-006 (unit): bring-your-own-key round-trips through the file-backed store,
    // and a missing key reads as nil (so the app makes no cloud call).
    func testFileKeyStoreRoundTrip() throws {
        let dir = (NSTemporaryDirectory() as NSString).appendingPathComponent("kiln-keystore-\(UUID().uuidString)")
        let store = FileKeyStore(directory: dir)
        XCTAssertNil(try store.read(forProvider: "openai"))
        try store.save("sk-test-123", forProvider: "openai")
        XCTAssertEqual(try store.read(forProvider: "openai"), "sk-test-123")
        try store.delete(forProvider: "openai")
        XCTAssertNil(try store.read(forProvider: "openai"))
        try? FileManager.default.removeItem(atPath: dir)
    }

    func testQuickTranslatePayloadUsesGemini35FlashLiteWithMinimalReasoning() throws {
        let body = QuickTranslateRequest.body(text: "привет", target: "English")

        XCTAssertEqual(body["model"] as? String, "google/gemini-3.5-flash-lite")
        XCTAssertNil(body["provider"])

        let reasoning = try XCTUnwrap(body["reasoning"] as? [String: Any])
        XCTAssertEqual(reasoning["effort"] as? String, "minimal")
        XCTAssertEqual(reasoning["exclude"] as? Bool, true)

        let messages = try XCTUnwrap(body["messages"] as? [[String: String]])
        XCTAssertEqual(messages.last?["content"], "привет")
        XCTAssertTrue(messages.first?["content"]?.contains("English") == true)
        XCTAssertTrue(messages.first?["content"]?.contains("Output ONLY the translation") == true)
    }
}
