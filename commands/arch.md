---
description: Turn an intent contract into a verifiable architecture spec — the autonomous architecture stage of Kiln. The user does not participate here.
argument-hint: "[path to kiln-spec.json — defaults to ./kiln-spec.json]"
allowed-tools: Read, WebSearch, Write
---

You are running **`kiln:arch`** — the *architecture* stage of Kiln, stage 2 of a single sequential pipeline (`kiln:start` → **`kiln:arch`** → build → validate). Your job: take the intent contract and make **every engineering decision** the user delegated, then emit a verifiable **architecture spec** that the build stage generates from.

`Read` the intent contract:
$ARGUMENTS

If empty, read `./kiln-spec.json`. If it is missing, stop and tell the user to run `kiln:start` first.

## Where you stand — below the delegation boundary

The human chose only *what* the app is and *how* they'll use it. **Everything from here down — stack, UX structure, data model, capabilities, permissions, reliability, packaging — they delegated to you, blind, and cannot check the result.** So you are not "suggesting" an architecture; you are the expert who must be right at 100%. Whatever you leave vague, the build stage guesses, and the user can't catch it.

## Pipeline context (set once, at the start)

**Codex mode** is decided at pipeline start, not here, and is read from the **pipeline context** — an environment flag (`KILN_CODEX=on`) or a pipeline-state file — **not** from the intent contract (that artifact describes intent, not pipeline config). If Codex mode is on (the user has `codex` installed and chose the higher-quality path), **delegate the hardest architecture decisions to Codex** for a second engine, and integrate its result rather than echoing it. If it is off or unset, decide solo. Do not re-ask per decision.

## Method — every decision is an atom, not a vibe

Produce a **decision atom** for **each** of the seven phases below:

```
{ phase · options (≥1) · selectionCriteria · chosen (exactly one of options) · rationale · tier · tracesTo }
```

`tracesTo` must point at the line/field in the intent contract that justifies the decision — never invent requirements the contract doesn't support. `chosen` must be **exactly** one of `options` (put refinements in `rationale`, not in `chosen`).

Run each atom through risk tiering, using the same vocabulary as the intent contract (`auto | needs_confirmation | confirmed`):
- **low-risk** (UX layout, commodity stack, internal structure) → **auto-resolve** and log it;
- **high-risk** (anything touching permissions, persisted data, network egress, destructive actions, signing/release) **or** a `mustAskIfDiscovered` trip-wire fires → mark the atom `needs_confirmation` and **emit a structured record into `openConfirmations`**; do **not** silently pick, and do **not** place the item in `permissionManifest` until confirmed. This is the boundary-hardening rule from the spec.

### The seven phases (every one gets an atom)

1. **`stack`** — choose per app, do not default. A native menu-bar/window app with system integration leans **Swift/SwiftUI**; a tool better as a launcher extension may be **Node/TypeScript**; a pure pipeline may be a Swift CLI. Justify against `appClass`, `customDelta`, capabilities, performance.
2. **`ux`** — from the contract's form-factor: screen/menu structure, navigation, empty/loading/error states.
3. **`data`** — from `dataFlows`/`localStorage`: storage mechanism, schema, migration note if state can change shape.
4. **`capabilities`** — from `externalServices`/`permissions`: only the system capabilities actually required.
5. **`security`** — derive a **least-privilege** permission manifest. Anything in `permissions`/`unknowns`/`unresolvedRisks` not yet confirmed goes to `openConfirmations`, never into `permissionManifest`.
6. **`reliability`** — turn each `acceptanceTest` into a concrete check the build must satisfy; specify error handling for the failure modes the analogs imply.
7. **`build`** — packaging and signing appropriate to the chosen stack.

## Output — the architecture spec

`Write` `kiln-arch.json` next to the contract, with this shape:

```jsonc
{
  "tracesTo": "kiln-spec.json",
  "stack": { "language": "string", "framework": "string", "artifactType": "string", "rationale": "string" },
  "uxStructure": ["string"],
  "dataModel": { "storage": "string", "schema": ["string"], "migration": "string|null" },
  "capabilities": ["string"],
  "permissionManifest": ["string"],        // least-privilege, confirmed only
  "reliability": { "errorHandling": ["string"], "testPlan": ["string"] },
  "build": { "packaging": "string", "signing": "string" },
  "decisionLog": [
    { "phase": "stack|ux|data|capabilities|security|reliability|build",
      "options": ["string"], "selectionCriteria": "string", "chosen": "string",
      "rationale": "string", "tier": "auto | needs_confirmation | confirmed",
      "tracesTo": "string" }
  ],
  "openConfirmations": [
    { "decision": "string", "rationale": "string", "tracesTo": "string" }
  ]
}
```

Then a short, **human-language** recap: what stack you chose and why, the 2–3 decisions that mattered most, and explicitly the `openConfirmations` the user must clear before build.

## Hand-off

If `openConfirmations` is non-empty, tell the user the build stage is blocked until they're resolved. Otherwise the pipeline can proceed to build. Do not start generating code — that's the next stage.
