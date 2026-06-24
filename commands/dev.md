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

Pin the inputs: run `npm run kiln -- digest kiln-spec.json` and `npm run kiln -- digest kiln-arch.json`, and put the outputs in `sourceSpec.contentDigest` / `sourceArch.contentDigest`. Then `Write` `kiln-dev.json` next to the arch spec (see `src/core/dev/report.ts` for the authoritative schema):

```jsonc
{
  "schemaVersion": "1.0",
  "devRevision": 1,
  "status": "ready_for_release",   // a release candidate, or a blocking status; only kiln:release emits "released"
  "sourceSpec": { "schemaVersion": "1.0", "specRevision": 0, "contentDigest": "sha256:..." },
  "sourceArch": { "schemaVersion": "1.0", "archRevision": 0, "contentDigest": "sha256:..." },
  "codexStatus": "off|consulted|unavailable",
  "implementationUnits": [
    { "id": "IMP-*", "componentId": "CMP-*", "interfaceIds": ["IF-*"],
      "tracesTo": ["REQ-*", "JRN-*", "CAP-*"],
      "files": [{ "path": "...", "symbols": ["..."] }],
      "verificationIds": ["VER-*"], "status": "implemented" }
  ],
  "verificationResults": [{ "verificationId": "VER-*", "result": "pass", "evidenceRefs": ["..."] }],
  "loggingImplemented": ["..."],     // the observability mechanisms actually wired
  "defects": [], "intentIssues": [], "architectureIssues": [], "environmentIssues": [],
  "review": { "reviewer": "self|codex", "verdict": "pass|issues", "notes": ["..."] },
  "openRisks": ["..."],
  "changeLog": ["..."]
}
```

Stay in lane: `implementationUnits` reference **real** arch ids (`CMP-*`/`IF-*`/`VER-*`) and intent ids (`REQ-*`/`JRN-*`/`AT-*`/`CAP-*`) — never invent an id, and never an architecture- or intent-significant change (route those to `kiln:arch` / `kiln:start` as `architectureIssues` / `intentIssues`).

Gate: `status` is `"ready_for_release"` **only** when every implementation unit is `implemented`, every `verificationResults` entry is `pass`, no defect is open, no intent/architecture/environment issue remains, the review verdict is `pass`, and both pins are non-null. Enforce it: `npm run kiln -- check kiln-spec.json kiln-arch.json kiln-dev.json` must exit 0 — every arch `VER-*` has a result, every MUST requirement is implemented by a unit, every observability mechanism is wired, both digests match. The output is a **release candidate**; hand off to **`kiln:release`**, which alone emits `released`.

Then a short, **human-language** recap: what was built, that all N tests pass with evidence, what's logged, the review verdict, and any open risks.

## Hand-off

The pipeline proceeds to **validate** only when the build is green and reviewed. Report honestly — if a test fails or a prerequisite blocks, say so with the evidence.
