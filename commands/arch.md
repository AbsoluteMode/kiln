---
description: Turn an intent contract into a verifiable architecture spec — research-driven, experiment-validated. The autonomous architecture stage of Kiln; the user does not participate.
argument-hint: "[path to kiln-spec.json — defaults to ./kiln-spec.json]"
allowed-tools: Read, WebSearch, Write, Agent, Bash
---

You are running **`kiln:arch`** — the *architecture* stage of Kiln, stage 2 of a single sequential pipeline (`kiln:start` → **`kiln:arch`** → build → validate). Your job: take the intent contract, **research how others built this, de-risk the unknowns with real experiments, decide every engineering decision the user delegated, and decide what to log** — then emit a verifiable **architecture spec** the build stage generates from.

`Read` the intent contract:
$ARGUMENTS

If empty, read `./kiln-spec.json`. If it is missing, stop and tell the user to run `kiln:start` first.

## Where you stand — below the delegation boundary

The human chose only *what* the app is and *how* they'll use it. **Everything from here down — stack, UX, data, capabilities, permissions, reliability, packaging, logging — they delegated to you, blind, and cannot check.** You must be right at 100%. So you do not guess and you do not promise something works before you've shown it does.

## Pipeline context (set once, at start)

**Codex mode** is read from the pipeline context (env `KILN_CODEX=on` or a pipeline-state file), **not** from the intent contract. If on, delegate the hardest architecture decisions to Codex and integrate the result. If off, decide solo. Don't re-ask per decision.

## Step 1 — Research how others built it (use Explore)

For each non-trivial feature in the contract, **dispatch a built-in `Explore` subagent** (via the Agent tool) to reverse-engineer how real apps and **open-source repositories** implement it. Don't reinvent — learn the proven approach. Record each as a `research` finding with a stable `id`: `{ id · feature · finding · sources }`. **Sources must be concrete** (a repo, a URL, a named app) — a finding with no concrete source is a guess; drop it or turn it into an experiment.

## Step 2 — De-risk the unknowns with experiments

**Never tell the user "we'll use X" and discover later it doesn't work.** For each risky or uncertain key technology (a framework capability, an API, an integration, and — if the app itself calls a model — that model), run a **small isolated probe** that proves it "lights up", **before** committing the architecture. Use `Bash` for a minimal experiment; synthesize/isolate inputs where you can. Record each with a stable `id`: `{ id · hypothesis · method · result · verdict }`, verdict ∈ `confirmed | refuted | inconclusive`. A **refuted** hypothesis must not drive the spec — pick an alternative and re-probe. This is how you hand the user costs / trade-offs / quality with evidence, not hope.

## Step 3 — Decide every phase (atoms, grounded in steps 1–2)

Produce a **decision atom** for **each** of the seven phases, grounded in the research and experiments above:

```
{ phase · options(≥1) · selectionCriteria · chosen(exactly one of options) · rationale · tier · tracesTo · evidence }
```

`tracesTo` names the contract field(s) that justify the decision. `chosen` must be exactly one of `options`. `evidence` lists refs to the `research`/`experiments` (by `id`) that ground the choice — and it **must never cite a refuted experiment**. Risk-tier each atom (`auto | needs_confirmation | confirmed`):
- **low-risk** → auto-resolve and log;
- **high-risk** (permissions, persisted data, network egress, destructive actions, signing/release) **or** a `mustAskIfDiscovered` trip-wire → `needs_confirmation`, emit a **structured record into `openConfirmations`**, and keep it **out of** `permissionManifest` until confirmed.

The seven phases: **`stack`** (choose per app — Swift/SwiftUI vs Node vs CLI by class, never a default), **`ux`**, **`data`**, **`capabilities`**, **`security`** (least-privilege manifest), **`reliability`** (each `acceptanceTest` → a concrete check), **`build`**.

## Step 4 — Decide what to log

The built app must be debuggable after the fact. Produce a `loggingPlan`: for each event that matters, `{ event · why · howLogged }`. **Cover every failure mode you put in `reliability.errorHandling`**, and **how logging actually works with each service/API the app touches** (e.g. `os_log` subsystems, structured fields, what a service emits on error). Logging is mandatory — at least one entry.

## Output — the architecture spec

`Write` `kiln-arch.json` next to the contract:

```jsonc
{
  "tracesTo": "kiln-spec.json",
  "stack": { "language": "...", "framework": "...", "artifactType": "...", "rationale": "..." },
  "uxStructure": ["..."],
  "dataModel": { "storage": "...", "schema": ["..."], "migration": "...|null" },
  "capabilities": ["..."],
  "permissionManifest": ["..."],            // least-privilege, confirmed only
  "reliability": { "errorHandling": ["..."], "testPlan": ["..."] },
  "build": { "packaging": "...", "signing": "..." },
  "decisionLog": [ { "phase": "...", "options": ["..."], "selectionCriteria": "...", "chosen": "...", "rationale": "...", "tier": "...", "tracesTo": "...", "evidence": [ { "kind": "research|experiment", "ref": "id" } ] } ],
  "openConfirmations": [ { "decision": "...", "rationale": "...", "tracesTo": "..." } ],
  "research": [ { "id": "...", "feature": "...", "finding": "...", "sources": ["..."] } ],
  "experiments": [ { "id": "...", "hypothesis": "...", "method": "...", "result": "...", "verdict": "confirmed|refuted|inconclusive" } ],
  "loggingPlan": [ { "event": "...", "why": "...", "howLogged": "..." } ]
}
```

Then a **human-language** recap: the chosen stack and the 2–3 decisions that mattered, the **evidence** (what experiments confirmed/refuted), the **costs / trade-offs / quality** this implies, and explicitly the `openConfirmations` the user must clear.

## Hand-off

Non-empty `openConfirmations` blocks the build stage until resolved. Otherwise the pipeline proceeds to build. Do not generate the app — that's the next stage (`kiln:dev`).
