# RealtimeTranslator Gemini 3.5 Flash-Lite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Option+Q Quick Translate request to `google/gemini-3.5-flash-lite` with minimal thinking while leaving live audio translation unchanged.

**Architecture:** Keep the existing OpenRouter transport and key. Add a small payload builder to `TranslatorKit` so the model, reasoning level, prompt, and absence of a provider pin are testable without network access; make the AppKit/SwiftUI Quick Translate path serialize that payload.

**Tech Stack:** Swift 6 package, XCTest, SwiftUI/AppKit, `URLSession`, OpenRouter chat-completions API.

## Global Constraints

- Change only Option+Q Quick Translate; keep `gpt-realtime-translate` for live system audio.
- Use the pinned model ID `google/gemini-3.5-flash-lite`, not a moving alias.
- Send `reasoning.effort = minimal` and `reasoning.exclude = true`.
- Keep the existing OpenRouter key and endpoint; do not add a Google key or dependency.
- Remove the GLM-specific Cerebras provider pin and add no silent fallback.
- Preserve RU-to-EN / EN-to-RU direction detection, translation-only output, hotkey, and UI behavior.
- Do not touch the unrelated untracked `examples/realtime-translator/scripts/build-dmg.sh`.

---

### Task 1: Build and adopt a testable Gemini request payload

**Files:**
- Create: `examples/realtime-translator/Sources/TranslatorKit/QuickTranslateRequest.swift`
- Modify: `examples/realtime-translator/Tests/TranslatorKitTests/TranslatorKitTests.swift`
- Modify: `examples/realtime-translator/Sources/RealtimeTranslator/QuickTranslate.swift:74-93`

**Interfaces:**
- Consumes: `text: String` and `target: String` already computed by `QuickTranslateModel`.
- Produces: `QuickTranslateRequest.body(text:target:) -> [String: Any]`, ready for `JSONSerialization.data(withJSONObject:)`.

- [ ] **Step 1: Write the failing payload test**

Append this test to `TranslatorKitTests`:

```swift
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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd /Users/maxim/eye/examples/realtime-translator
swift test --filter TranslatorKitTests.testQuickTranslatePayloadUsesGemini35FlashLiteWithMinimalReasoning
```

Expected: compilation fails with `cannot find 'QuickTranslateRequest' in scope` because the helper does not exist.

- [ ] **Step 3: Implement the minimal request helper**

Create `Sources/TranslatorKit/QuickTranslateRequest.swift`:

```swift
import Foundation

public enum QuickTranslateRequest {
    public static func body(text: String, target: String) -> [String: Any] {
        let reasoning: [String: Any] = [
            "effort": "minimal",
            "exclude": true,
        ]
        let messages: [[String: String]] = [
            [
                "role": "system",
                "content": "You are a translator. Translate the user's text to \(target). Output ONLY the translation — no quotes, no notes, no alternatives.",
            ],
            ["role": "user", "content": text],
        ]
        return [
            "model": "google/gemini-3.5-flash-lite",
            "reasoning": reasoning,
            "messages": messages,
        ]
    }
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
swift test --filter TranslatorKitTests.testQuickTranslatePayloadUsesGemini35FlashLiteWithMinimalReasoning
```

Expected: one selected test passes with zero failures.

- [ ] **Step 5: Make Quick Translate use the tested payload**

In `QuickTranslateModel.callOpenRouter`, replace the inline GLM body with:

```swift
let body = QuickTranslateRequest.body(text: text, target: target)
request.httpBody = try? JSONSerialization.data(withJSONObject: body)
```

Delete the old `z-ai/glm-4.7`, Cerebras provider order, and `reasoning.enabled = false` dictionary.

- [ ] **Step 6: Verify the integration and full suite**

Run:

```bash
swift test
rg -n "z-ai/glm-4\.7|Cerebras" Sources Tests && exit 1 || true
```

Expected: all tests pass; the source/test scan prints no legacy model or provider reference.

- [ ] **Step 7: Commit the tested code change**

```bash
git add examples/realtime-translator/Sources/TranslatorKit/QuickTranslateRequest.swift \
  examples/realtime-translator/Sources/RealtimeTranslator/QuickTranslate.swift \
  examples/realtime-translator/Tests/TranslatorKitTests/TranslatorKitTests.swift
git commit -m "feat(realtime-translator): use Gemini 3.5 Flash-Lite"
```

---

### Task 2: Document, build, install, and smoke-test the model switch

**Files:**
- Modify: `examples/realtime-translator/README.md:17-19`
- Verify: `examples/realtime-translator/build/RealtimeTranslator.app`
- Install: `/Applications/RealtimeTranslator.app`

**Interfaces:**
- Consumes: the request helper and Quick Translate integration from Task 1.
- Produces: an installed app whose Option+Q path targets Gemini 3.5 Flash-Lite with minimal thinking.

- [ ] **Step 1: Update the README provider description**

Replace the Quick Translate provider lines with:

```markdown
- **Quick-translate** — press **⌥Q** anywhere (even over a fullscreen call), type a word or
  phrase, get an instant translation. Auto-detects direction (RU↔EN). Powered by
  **Gemini 3.5 Flash-Lite through OpenRouter** with minimal thinking for low latency.
```

Do not change the live-subtitle model description.

- [ ] **Step 2: Verify docs and source identify the intended models**

Run:

```bash
rg -n "gemini-3\.5-flash-lite|Gemini 3\.5 Flash-Lite|minimal" \
  Sources/TranslatorKit/QuickTranslateRequest.swift README.md
rg -n "gpt-realtime-translate" Sources/RealtimeTranslator/GPTRealtimeTranslateEngine.swift README.md
```

Expected: the first command finds the Gemini Quick Translate configuration and README copy; the second still finds the OpenAI live-audio model.

- [ ] **Step 3: Run fresh tests and build the signed app**

Run:

```bash
swift test
./scripts/build-app.sh
codesign --verify --deep --strict build/RealtimeTranslator.app
```

Expected: all tests pass, the release build completes, and `codesign` exits 0.

- [ ] **Step 4: Install and launch the rebuilt app**

Run:

```bash
./scripts/install.sh
open -a /Applications/RealtimeTranslator.app
sleep 2
pgrep -x RealtimeTranslator
```

Expected: installation succeeds and `pgrep` returns one running app PID.

- [ ] **Step 5: Smoke-test OpenRouter model availability without exposing the key**

Use the same file-backed key store as the personal app build:

```bash
quick_translate_key_path="$HOME/Library/Application Support/RealtimeTranslator/openrouter.key"
quick_translate_key=""
if [ -f "$quick_translate_key_path" ]; then
  quick_translate_key="$(<"$quick_translate_key_path")"
fi
if [ -z "$quick_translate_key" ]; then
  echo "SKIP: no OpenRouter key in the app's file-backed key store"
else
  response="$(curl -fsS https://openrouter.ai/api/v1/chat/completions \
    -H "Authorization: Bearer $quick_translate_key" \
    -H 'Content-Type: application/json' \
    --data '{"model":"google/gemini-3.5-flash-lite","reasoning":{"effort":"minimal","exclude":true},"messages":[{"role":"system","content":"Translate to English. Output ONLY the translation."},{"role":"user","content":"привет"}]}')"
  jq -e '.choices[0].message.content | strings | length > 0' <<<"$response" >/dev/null
  echo "PASS: Gemini 3.5 Flash-Lite returned a translation"
fi
unset quick_translate_key_path quick_translate_key response
```

Expected: `PASS` with a configured key, or an explicit `SKIP` without one; no secret is printed.

- [ ] **Step 6: Commit the documentation update**

```bash
git add examples/realtime-translator/README.md
git commit -m "docs(realtime-translator): document Gemini quick translate"
```

- [ ] **Step 7: Record final verification state**

Run:

```bash
git status --short --branch
git log -4 --oneline
```

Expected: only the pre-existing untracked `examples/realtime-translator/scripts/build-dmg.sh` remains; the design, code, and README commits appear in history.
