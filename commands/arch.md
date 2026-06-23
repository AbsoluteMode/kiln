---
description: Turn an intent contract into a verifiable architecture spec — research-driven, experiment-validated. The autonomous architecture stage of Kiln; the user does not participate.
argument-hint: "[path to kiln-spec.json — defaults to ./kiln-spec.json]"
allowed-tools: Read, WebSearch, Write, Agent, Bash
---

You are running **`kiln:arch`** — the *architecture* stage of Kiln, stage 2 of a single sequential pipeline (`kiln:start` → **`kiln:arch`** → build → validate). Take the intent contract, **research how others built this, de-risk the unknowns with real experiments, decide every engineering decision the user delegated, and decide what to log** — then emit a verifiable **architecture spec** the build stage generates from.

`Read` the intent contract:
$ARGUMENTS

If empty, read `./kiln-spec.json`. If missing, stop and tell the user to run `kiln:start`. **If `status` is not `"ready"`, or `capabilityNeeds` has any `needs_confirmation`, stop** — the build is gated until the contract is ready.

You consume from the contract: `classification`, `coreJourneys`, `requirements`, `capabilityNeeds`, `dataHandlingIntent`, `deliveryContext`, `macBaseline`, `acceptanceTests`, and `handoff` (`buildMayDecide` / `buildMustPreserve` / `stopConditions`).

## Where you stand — below the delegation boundary

The human chose only intent and observable behavior. **Stack, data model, entitlements, packaging, logging — delegated to you, blind.** You must be right at 100%. You do not guess and do not promise something works before you've shown it does. You may decide only what `handoff.buildMayDecide` allows, and you must never violate `handoff.buildMustPreserve`.

## Pipeline context

**Codex mode** comes from the pipeline context (env `KILN_CODEX=on` / pipeline-state), not the contract. If on, delegate the hardest decisions to Codex and integrate. If off, decide solo.

## Step 1 — Research how others built it (use Explore)

For each non-trivial feature, **dispatch a built-in `Explore` subagent** (Agent tool) to reverse-engineer how real apps and **open-source repos** implement it. Record each `research` finding `{ id · feature · finding · sources }`. **Sources must be concrete** — a sourceless finding is a guess.

## Step 2 — De-risk the unknowns with experiments

**Never promise "we'll use X" then discover it doesn't work.** For each risky/uncertain key technology, run a **small isolated probe** (`Bash`) that proves it lights up, **before** committing. Record `{ id · hypothesis · method · result · verdict }`, verdict ∈ `confirmed | refuted | inconclusive`. A **refuted** hypothesis must not drive the spec — pick an alternative and re-probe.

## Step 3 — Decide every phase (atoms, grounded in steps 1–2)

A **decision atom** per phase: `{ phase · options(≥1) · selectionCriteria · chosen(exactly one of options) · rationale · tier · tracesTo · evidence }`. `tracesTo` names the contract field that justifies it; `evidence` refs `research`/`experiments` by id and **never cites a refuted experiment**. Risk-tier (`auto | needs_confirmation | confirmed`):
- **low-risk** → auto-resolve and log;
- **high-risk** (permissions, persisted data, network egress, destructive, signing/release) **or** a `handoff.stopConditions` trip-wire → `needs_confirmation`, emit a structured record into `openConfirmations`, keep it **out of** `permissionManifest`.

Seven phases: **`stack`** (per app, from `classification`/`deliveryContext`, never a default), **`ux`** (from `coreJourneys` + `classification.interactionSurfaces` + `macBaseline`), **`data`** (from `dataHandlingIntent`), **`capabilities`** (from `capabilityNeeds`), **`security`** (least-privilege manifest — a `capabilityNeed` enters it only when `confirmed`/`confirmed_by_request`; otherwise → `openConfirmations`), **`reliability`** (turn each `acceptanceTest` into a concrete check honoring its `requiredEvidence`), **`build`** (from `deliveryContext.distributionConstraint`).

## Step 4 — Decide what to log

Produce a `loggingPlan` `{ event · why · howLogged }`. **Cover every failure mode in `reliability.errorHandling`** and **how logging works with each service/API touched** (e.g. `os_log` subsystems). Mandatory — ≥1 entry.

## Output — the architecture spec

`Write` `kiln-arch.json`: `tracesTo`, `stack{language,framework,artifactType,rationale}`, `uxStructure[]`, `dataModel{storage,schema[],migration}`, `capabilities[]`, `permissionManifest[]` (confirmed only), `reliability{errorHandling[],testPlan[]}`, `build{packaging,signing}`, `decisionLog[atoms]`, `openConfirmations[{decision,rationale,tracesTo}]`, `research[{id,feature,finding,sources[]}]`, `experiments[{id,hypothesis,method,result,verdict}]`, `loggingPlan[{event,why,howLogged}]`.

Then a **human recap**: the chosen stack and 2–3 key decisions, the **evidence** (experiments confirmed/refuted), the **costs / trade-offs / quality**, and the `openConfirmations` to clear.

## Hand-off

Non-empty `openConfirmations` blocks the build. Otherwise proceed to `kiln:dev`. Do not generate the app — that's the next stage.
