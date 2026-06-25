# realtime-translator — built by Kiln

A macOS app that shows **real-time Russian subtitles for the English you hear** — on
YouTube and in video calls — by translating your Mac's **system audio**. Plus a
**global-hotkey quick-translate** (⌥Q) for when a word slips your mind mid-conversation.

Built by taking a vague idea ("real-time EN→RU translation of system audio") through the
**whole Kiln pipeline** (`start → arch → dev`), then iterated live into a real,
daily-use product.

## What it does

- **Live subtitles** — start from the menu bar, play an English video or join a call, and
  read Russian subtitles in a floating, always-on-top window (over fullscreen too).
  Powered by **OpenAI `gpt-realtime-translate`** — one streaming hop, audio in → translated
  text out.
- **Quick-translate** — press **⌥Q** anywhere (even over a fullscreen call), type a word or
  phrase, get an instant translation. Auto-detects direction (RU↔EN). Powered by
  **`glm-4.7` on Cerebras** (reasoning off) — sub-second.
- **System audio only** — captured via **ScreenCaptureKit**; the microphone is never touched.
- **Bring-your-own-key** — keys live in a local file (`0600`) or the Keychain; **never
  embedded in the build**.
- Launches at login, ships with an app icon, installs to `/Applications`.

## How Kiln built it

| Stage | Contract | Status |
|---|---|---|
| `kiln:start` | `kiln-spec.json` (rev2, grounded on 2026 stack research) | `ready` |
| `kiln:arch` | `kiln-arch.json` — engine behind a swappable `TranslationEngine` protocol | `ready_for_build` · `kiln check` ✓ |
| `kiln:dev` | `kiln-dev.json` + `kiln-artifact-manifest.json` | `kiln check` ✓ |

The architecture is **provider-agnostic** — the engine sits behind a `TranslationEngine`
protocol with a deterministic fake for tests, so the whole pipeline is verifiable **with no
API key** (`swift test`, 5/5). Real providers light up the live path.

> **Note:** the `kiln-*.json` contracts capture the initial Kiln-generated dev slice. The
> app was then iterated live (the realtime engine, quick-translate, app icon, launch-at-login)
> beyond the contract — see the source for the current implementation.

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
