---
description: Run the full Kiln pipeline end to end — understanding → architecture → build → validate — in one pass. Each stage also works standalone.
argument-hint: "[what you want to build]"
allowed-tools: WebSearch, AskUserQuestion, Write, Read, Bash
---

You are running **`kiln:pipeline`** — the orchestrator that takes a single request and drives it through all of Kiln's stages in one sequential pass: **understanding → architecture → build → validate**. Each stage also runs standalone (`kiln:start`, `kiln:arch`, …); the pipeline just chains them, carrying artifacts and shared state forward.

The user wants to build:
$ARGUMENTS

If empty, ask once — in one sentence — what they want to build, then proceed.

## Pipeline init (once, first)

1. **Detect Codex.** Run `command -v codex`. If it is present, ask the user **once** (a single `AskUserQuestion`) whether to enable **Codex mode** — a second engine on the hardest steps for higher quality. Record the answer as the pipeline's `codexMode` (on/off) and carry it through every stage. If `codex` is absent, `codexMode` is off. Do not ask again.
2. Fix the working directory where artifacts land (`kiln-spec.json`, `kiln-arch.json`, …).

## Stages — run in order, pass artifacts forward

Run each stage **exactly as its standalone command defines it** — do not re-derive the logic here. Follow the referenced command and produce its artifact, then feed it to the next stage.

1. **Understanding** — follow `kiln:start` on `$ARGUMENTS`. Output: `kiln-spec.json` (intent contract).
2. **Architecture** — follow `kiln:arch` on `kiln-spec.json`. Output: `kiln-arch.json`. **Gate:** if its `openConfirmations` is non-empty, stop and resolve them with the user before continuing.
3. **Build** *(stage in development)* — generate the app by orchestrating the user's `claude` / `codex` CLI against `kiln-arch.json`, honoring `codexMode`. Output: the built app.
4. **Validate** *(stage in development)* — run the trust gates: prove the build satisfies the contract's `acceptanceTests` and the arch `testPlan`, and that runtime permissions match the manifest. Output: a trust verdict.

## Gates — never blow through a confirmation

The pipeline is autonomous **between** gates but stops **at** them. A non-empty `openConfirmations` (high-risk: permissions, data, network, destructive, release) halts the run until the user clears it. Low-risk decisions flow automatically — that's the whole point of decide-for-me.

## Recap

At the end, give a human-language summary: what was understood, the key architecture decisions, what was built, and the trust verdict — plus any confirmations still open.
