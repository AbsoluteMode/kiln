<div align="center">

# 🔥 Kiln

**A Claude Code plugin that turns a vague idea into a verified, working macOS app — and machine-checks every step, so you can trust the result even if you can't read code.**

</div>

Vibe-coding tools solved **generation**. Kiln closes the gap they leave open: **trust**.

It runs a four-stage pipeline — **understand → architect → build → release** — where every stage emits a strict, versioned **contract**, and a machine gate (`kiln check`) enforces that each stage actually traces back to the one before it. No stage can claim "done" unless the contracts line up, every MUST requirement is covered, and the thing you ship is exactly the thing that was verified.

Kiln does **not** ship its own code-generation engine. It orchestrates the harnesses you already have — **Claude Code**, and **Codex** when installed — and adds the part they lack: the **contracts** and the **seam gate** between them.

## The pipeline

| Stage | Command | Output contract |
|---|---|---|
| **Understand** | `kiln:start` | **intent** (`kiln-spec.json`) — researched, traceable, with acceptance tests |
| **Architect** | `kiln:arch` | **architecture** (`kiln-arch.json`) — decisions + evidence + coverage, pinned to the intent |
| **Build** | `kiln:dev` | real code + **dev** (`kiln-dev.json`) + an artifact manifest |
| **Release** | `kiln:release` | **release** (`kiln-release.json`) — the candidate pinned to the exact verified build |

Every stage **pins the previous one by SHA-256 digest**, and `kiln check` validates the cross-stage seam: every `tracesTo` resolves to a real id, every MUST requirement has a complete coverage row, no capability exceeds what the user confirmed, and the released artifact matches the verified build byte-for-byte.

## Examples — built by Kiln, contracts machine-verified

| Example | What it is | Verified |
|---|---|---|
| **[calculator](examples/calculator)** | a four-function macOS calculator | `swift test` ✓ · `kiln check` ✓ (5-artifact chain) |
| **[file-renamer](examples/file-renamer)** | batch file-renamer — live preview, undo, conflict detection | `kiln check` ✓ |
| **[realtime-translator](examples/realtime-translator)** | **the showcase** — a real-time English→Russian **subtitle app for system audio** (YouTube, video calls) + a global-hotkey quick-translate | `swift test` ✓ · `kiln check` ✓ |

## Try it

In a project with the plugin installed:

```
/kiln:start a menu-bar breathing timer for focus
```

Kiln researches comparable apps, asks only the questions that change the outcome, and writes the intent contract. Then `/kiln:arch` → `/kiln:dev` → `/kiln:release`.

## The seam gate (the trust layer)

```bash
# validate a full chain — exits non-zero on any cross-stage violation
npm run kiln -- check kiln-spec.json kiln-arch.json kiln-dev.json kiln-artifact-manifest.json kiln-release.json

# print the SHA-256 pin of any contract
npm run kiln -- digest kiln-spec.json
```

## Repo layout

- `commands/` — the four pipeline stages (`kiln:start` · `:arch` · `:dev` · `:release`) + `kiln:pipeline`
- `src/core/` — the contract schemas (Zod, strict) + the cross-stage **seam validators**
- `src/cli/` — the `kiln check` / `kiln digest` CLI
- `examples/` — apps built by Kiln, with their machine-verified contracts
- `docs/` — design specs, decisions, research

## Develop

```bash
npm install
npm test          # 88 unit tests
npm run typecheck
```

## License

[MIT](LICENSE)
