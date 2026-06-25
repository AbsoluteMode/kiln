# realtime-translator — engine, signing, and audio decisions

**Date:** 2026-06-24

## Context

The realtime-translator example was taken through the Kiln pipeline and then iterated
live into a real, daily-use product (system-audio subtitles + a global-hotkey
quick-translate). Several non-obvious engineering decisions were made along the way,
each verified by action rather than assumption.

## Decisions & why

### 1. Subtitles: OpenAI `gpt-realtime-translate` (unified realtime), not an ASR→MT pipeline
A unified realtime speech-translation model streams audio in and translated transcript
out in **one hop**. This beats a two-hop Deepgram-ASR → LLM-translate pipeline on both
axes that matter here: **latency** (no wait-for-utterance-final + second round-trip) and
**quality** (the model hears the audio directly, so there's no "ASR mis-hears a word →
translate the wrong word" failure). The protocol was **verified against the live API**
(a Python probe), which caught a wrong client event name (`input_audio_buffer.append`
needs the `session.` prefix on the `/v1/realtime/translations` endpoint) — taken from the
server's own error, not from memory.

### 2. Quick-translate: `z-ai/glm-4.7` on Cerebras, reasoning **off**
Translating single words/phrases is not a reasoning task. Measured, warm:
- `claude-opus-4.8-fast`: ~3 s, premium price
- `glm-4.7` on Cerebras with **reasoning on**: ~6.9 s
- `glm-4.7` on Cerebras with **reasoning off**: **~0.4 s**, ~25× cheaper

Disabling reasoning was the lever (≈7× faster); Cerebras provides the ultra-fast
inference. Quality on real words was clean. Picked for instant, cheap lookups.

### 3. Stable self-signed code signing (not ad-hoc)
Ad-hoc signing (`codesign -s -`) changes the binary's cdhash on every rebuild, so macOS
TCC treats the app as "changed" and re-prompts for **Screen Recording** endlessly. Signing
with a **stable self-signed identity** keeps the designated requirement constant across
rebuilds, so the permission persists. Diagnosed from `os_log` (`SCStreamError.userDeclined`)
plus the signature reading `adhoc`.

### 4. Bring-your-own-key in a local `0600` file, never embedded
Embedding API keys in a distributed client is a security hole — they're trivially
extracted (`strings`/Hopper) and the account drained. Keys live in
`~/Library/Application Support/RealtimeTranslator/*.key` (mode `0600`) or the Keychain; the
shipped binary contains none (verified: zero key-like strings in the Mach-O).

### 5. ScreenCaptureKit captures at 24 kHz; the growing lag was render-debt, not rate
Hypothesis: SCK ignores `sampleRate=24000` and delivers 48 kHz, so we over-feed 2× and the
lag accumulates. **Disproven by a one-time format log**: SCK delivers exactly
`24000 Hz, 1 ch`. The real cause of the growing lag was **UI rendering debt** (yielding a UI
update on every transcript delta); fixed by throttling subtitle updates to ~14 fps. An
`AVAudioConverter` resample to 24 kHz was still added as a safety net for other Macs.

## Rejected

- **`gpt-4o`** for translation — outdated; the current frontier list was pulled live from
  the provider, not assumed.
- **Ad-hoc signing** — breaks the Screen Recording grant on every rebuild.
- **Embedding keys in the bundle** — extractable.
- **Deepgram-ASR → LLM-translate two-hop pipeline** for subtitles — more latency and an
  ASR-error-propagation failure mode; kept only as a documented alternative behind the
  swappable `TranslationEngine` protocol.

## Resync to the shipped app (contracts must match the code)

After publishing, the Kiln contracts had drifted from the app: `kiln-dev.json` referenced a
`RealtimeProviderEngine.swift` that no longer existed (the real engine is
`GPTRealtimeTranslateEngine.swift`), and two shipped features — the Option-Q quick-translate
and launch-at-login — were absent from the contracts entirely. For a tool whose whole value is
"the contract matches the code," that gap is the worst possible advertisement. We chose a
**full resync** over a lighter "honest-MVP" patch: spec rev3 / arch rev2 / dev rev2 now trace
both surfaces end to end, and `kiln check` holds the four-stage seam at `ready_for_release`.

Dev moved to `ready_for_release` only because the one check it cannot automate (VER-003,
subjective translation quality) had genuinely been run live and accepted —
`blocked_on_environment` was the honest state when no key was in the build run;
`ready_for_release` is the honest state once the owner ran the smoke. Signing is now recorded
as `self_signed` (a value added to the manifest `signingStatus` enum), matching the stable
"Sidekey Dev" identity rather than the throwaway `adhoc` it had claimed. An independent Codex
pass confirmed no remaining drift (14/14 Swift files traced, all symbols present).

---
Captured before publishing the repo (AbsoluteMode/kiln) public; resync section added 2026-06-25.
