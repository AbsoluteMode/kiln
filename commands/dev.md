---
description: Build the app from the architecture spec — test-first, fully logged, then reviewed. The implementation stage of Kiln; the most accountable one.
argument-hint: "[path to kiln-arch.json — defaults to ./kiln-arch.json]"
allowed-tools: Read, Write, Bash, Agent
---

You are running **`kiln:dev`** — the *implementation* stage of Kiln, stage 3 (`kiln:start` → `kiln:arch` → **`kiln:dev`** → validate). The **most accountable** stage: you write the whole app, prove it with tests, wire the logging, and have it reviewed. You ship something demonstrated to work, not vibes.

`Read` the architecture spec:
$ARGUMENTS

If empty, read `./kiln-arch.json`. Also `Read` the `sourceSpec` intent contract (`kiln-spec.json`) for the acceptance tests.

## Input gate

Build only when: `kiln-arch.json` `status` is `"ready_for_build"`; `openConfirmations` is empty; the contract's `acceptanceTests` and the arch `reliability.verificationMatrix` are present; and `npm run kiln -- check kiln-spec.json kiln-arch.json` exits 0 (the cross-stage seam — stale ids, an uncovered MUST, or a capability beyond what the user confirmed all fail it). Check `environmentPrerequisites`: a `blocking: true` prerequisite that's missing (e.g. no Xcode) **stops the build** with a clear message; a non-blocking one (e.g. no Developer ID) only limits release, not implementation. If the gate fails, stop and report — do not build a partial app.

## Pipeline context

**Codex mode** comes from the pipeline context. If on, **delegate the hardest implementation and the review to Codex** and integrate. If off, do it solo.

## Step 1 — Tests first (TDD)

Before implementation, write the test suite from the arch `reliability.verificationMatrix` (one test per record, at its `level`, on its `harness`, asserting its `oracle`, producing its `requiredEvidence`) **and** the contract's `acceptanceTests`. Run them and confirm they **fail** (red).

## Step 2 — Implement to the spec

Generate the app strictly from `kiln-arch.json`: the `platform`, `system` components/interfaces, `ux`, `data`, and `capabilities` mechanisms. Request **only** what's in `security.effectivePermissionManifest` — never an entitlement or TCC access beyond it. Honor `handoff.buildMustImplement` / `buildMustPreserve` / `buildMustNotDo`; decide freely only within `handoff.buildMayDecide`. Where Codex mode is on and a piece is hard, delegate it and integrate. Keep files small.

## Step 3 — Wire the logging

Implement the arch `reliability.observability` and `security.loggingPolicy` in full (e.g. the declared `os_log` subsystems), redacting per policy. The point is post-hoc debugging — when the app misbehaves, these logs must reconstruct what went wrong. Cover the `reliability.failureModel` paths.

## Step 4 — Make it green, then review

Run the suite; confirm **every test passes** and produce each verification's `requiredEvidence`. Build the app (`xcodebuild` per `build.commands`). Then **review**: Codex adversarial review if Codex mode is on, else self-review against the spec. A finding is "fixed" only once its test is green again.

## Output — the build report

`Write` `kiln-dev.json` next to the arch spec:

```jsonc
{
  "tracesTo": "kiln-arch.json",
  "tests": { "framework": "...", "written": 0, "passing": 0, "files": ["..."] },
  "loggingImplemented": ["..."],          // the observability subsystems wired
  "review": { "reviewer": "self|codex", "verdict": "pass|issues", "notes": ["..."] },
  "artifacts": ["..."],
  "openRisks": ["..."]
}
```

Invariant: a completed build has `tests.passing === tests.written` and `tests.written ≥ 1`. If they differ, the stage is **not** done — report what failed, do not claim success. Then run `npm run kiln -- check kiln-spec.json kiln-arch.json kiln-dev.json` — it must exit 0: the build must cover **every** `verificationMatrix` record and implement **every** `reliability.observability` mechanism, or the seam fails.

Then a short, **human-language** recap: what was built, that all N tests pass with evidence, what's logged, the review verdict, and any open risks.

## Hand-off

The pipeline proceeds to **validate** only when the build is green and reviewed. Report honestly — if a test fails or a prerequisite blocks, say so with the evidence.
