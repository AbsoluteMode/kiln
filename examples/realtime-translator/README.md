# realtime-translator — built by Kiln

A macOS app that shows **real-time Russian subtitles for the English you hear** — on
YouTube and in video calls — by translating your Mac's **system audio**. Plus a
**global-hotkey quick-translate** (⌥Q) for when a word slips your mind mid-conversation.

Built by taking a vague idea ("real-time EN→RU translation of system audio") through the
**whole Kiln pipeline** (`start → arch → dev`) into a real, daily-use product — with the
contracts kept in sync as the app grew a quick-translate hotkey and launch-at-login.

## What it does

- **Live subtitles** — start from the menu bar, play an English video or join a call, and
  read Russian subtitles in a floating, always-on-top window (over fullscreen too).
  Powered by **OpenAI `gpt-realtime-translate`** — one streaming hop, audio in → translated
  text out.
- **Quick-translate** — press **⌥Q** anywhere (even over a fullscreen call), type a word or
  phrase, get an instant translation. Auto-detects direction (RU↔EN). Powered by
  **Gemini 3.5 Flash-Lite through OpenRouter** with minimal thinking for low latency.
- **System audio only** — captured via **ScreenCaptureKit**; the microphone is never touched.
- **Bring-your-own-key** — keys live in a local file (`0600`) or the Keychain; **never
  embedded in the build**.
- Launches at login, ships with an app icon, installs to `/Applications`.

## How Kiln built it

| Stage | Contract | Status |
|---|---|---|
| `kiln:start` | `kiln-spec.json` (rev3, grounded on 2026 stack research) | `ready` |
| `kiln:arch` | `kiln-arch.json` (rev2) — engine behind a swappable `TranslationEngine` protocol | `ready_for_build` · `kiln check` ✓ |
| `kiln:dev` | `kiln-dev.json` (rev2) + `kiln-artifact-manifest.json` (rev2) | `ready_for_release` · `kiln check` ✓ |

The architecture is **provider-agnostic** — the engine sits behind a `TranslationEngine`
protocol with a deterministic fake for tests, so the whole pipeline is verifiable **with no
API key** (`swift test`, 5/5). Real providers light up the live path.

The contracts are **kept in sync with the shipped app**: both surfaces — the live subtitles
and the quick-translate hotkey — plus launch-at-login are traced end to end (requirement →
journey → decision → component → verification), and `kiln check` holds the four-stage seam
(`spec → arch → dev → manifest`) at `ready_for_release`. The dev stage reached
`ready_for_release` only after the one check it could not automate — VER-003, subjective
translation quality — was run live with a real key and accepted; the gate refuses to
rubber-stamp quality it hasn't seen.

## Build & run

```bash
swift test                  # 5 pipeline tests, no keys required
./scripts/build-app.sh      # build + sign RealtimeTranslator.app
./scripts/install.sh        # install into /Applications

# from the repo root — validate the Kiln contract chain:
npm run kiln -- check examples/realtime-translator/kiln-spec.json \
  examples/realtime-translator/kiln-arch.json \
  examples/realtime-translator/kiln-dev.json \
  examples/realtime-translator/kiln-artifact-manifest.json
```

To run live: add a provider key in **Settings** (menu bar → Настройки), grant **Screen
Recording** on first start, then press **Старт**.
