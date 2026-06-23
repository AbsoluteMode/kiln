# Kiln

> A Claude Code plugin that writes high-quality macOS services under the hood. Glaze lays on the glaze — Kiln fires it into something you can trust.

Vibe-coding studios solved **generation**. Kiln closes the gap they left open: **trust**. It understands what you want, fires it into a verifiable build spec, then builds it by orchestrating the CLIs you already have — **Claude Code**, and **Codex** when it's installed — proving the result does what you meant and is safe, for people who can't read code.

It does **not** write its own generation engine. It orchestrates the harnesses you already have; the value is the **contracts** and the **workflow**.

## Pipeline

1. **`kiln:start`** — *understanding*. Turns a vague request into a verifiable build spec (intent contract) via analog-driven market research, minimum questions, decide-for-me, and provenance gating. ✅ implemented
2. **build** — generation by orchestrating the user's own `claude` / `codex` CLI against the contract. *(next)*
3. **validate** — trust gates proving the build matches the contract. *(next)*

## Try it

```
/kiln:start a menu-bar breathing timer for focus
```

Worked examples of the output spec live in [docs/examples](docs/examples).

## Repo layout

- `commands/` — plugin commands (`kiln:start`)
- `.claude-plugin/` — plugin manifest
- `src/core/` — the decision core: intent-contract schema + trust gates (risk tiering, governing principle, provenance), fully unit-tested
- `docs/` — design spec, research, example specs

## Develop

```
npm install
npm test
npm run typecheck
```
