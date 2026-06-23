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

For each non-trivial feature, **dispatch a built-in `Explore` subagent** (Agent tool) to reverse-engineer how real apps and **open-source repos** implement it. Record each finding as an `evidence` entry (`type` ∈ `apple_primary_doc | dependency_doc | agent_inference`) with a concrete `source` and the ids it `supports`. **A sourceless finding is a guess** — never let it drive a decision.

## Step 2 — De-risk the unknowns with experiments

**Never promise "we'll use X" then discover it doesn't work.** For each risky/uncertain key technology, run a **small isolated probe** (`Bash`) that proves it lights up **before** committing. A confirmed probe becomes an `evidence` entry (`type: experiment`, `source` = the probe). A **refuted** hypothesis is discarded and **never cited** — pick an alternative and re-probe.

## Step 3 — Model the system

Choose the `platform` **per app** from `classification`/`deliveryContext` — never a default: artifact types, language, runtime, UI frameworks, minimum macOS, process topology, build system. Define the **component topology**: `system.components` (`id · responsibility · owns`), `system.interfaces` (`from → to · contract`), and `dependencyRules` (no reverse dependencies). Model `ux` from `coreJourneys` + `classification.interactionSurfaces` + `macBaseline`, and `data` from `dataHandlingIntent` (entities, invariants, persistence, lifecycle, concurrency, recovery).

## Step 4 — Decide what the user delegated (decision atoms)

One **decision atom** per architecture-significant choice, grounded in steps 1–3:

`{ id · phase · question · status · authority · engineeringRisk · reversibility · hardConstraints · options(≥1) · selectionCriteria · chosenOptionId · recommendedOptionId · rationale · rejectedOptions · tracesTo · evidenceRefs · confidence · consequences · fallback · verificationPlan }`

- `phase` ∈ `platformTopology | ux | data | integrationsCapabilities | securityPrivacy | reliabilityVerification | buildRelease`.
- `tracesTo` lists the **intent contract ids** that justify it (`REQ-*`, `JRN-*`, `CAP-*`, `AT-*`) — stable ids, never field-path strings. `evidenceRefs` point at `evidence[]` by id and **never cite a refuted probe**.
- Record `authority` (`inherited | delegated | outside_delegation`), `engineeringRisk`, and `reversibility` **separately** — engineering risk is not confirmation status.
- **`status` drives the gate:**
  - within delegation, low-risk → `decided`, with `chosenOptionId` ∈ `options`.
  - high-risk (**permissions, persisted data, network egress, destructive ops, signing/release**) **or** a `handoff.stopConditions` trip-wire → `pending_confirmation`: leave `chosenOptionId` null, set `recommendedOptionId`, emit a structured `openConfirmations` record, and keep the capability **out of** `security.effectivePermissionManifest`.

## Step 5 — Security, reliability, logging

- **Security:** a `threatModel` (`assets · trustBoundaries · abuseCases · mitigations · residualRisks`) and a least-privilege `effectivePermissionManifest`. A `capabilityNeed` enters the manifest **only** when `confirmed`/`confirmed_by_request`; anything unconfirmed stays in `openConfirmations`. Set `loggingPolicy` and `secretPolicy`.
- **Reliability & verification:** turn **each** `acceptanceTest` into a `verificationMatrix` record (`id · acceptanceTestId · level · harness · preconditions · execution · oracle · requiredEvidence · environment · flakinessControls`), honoring its `requiredEvidence`; define `failureModel` + `recovery`.
- **Logging:** `reliability.observability` names the concrete mechanisms (e.g. `os_log` subsystems) that reconstruct what went wrong — **cover every `failureModel` path**.

## Step 6 — Prove coverage and pin the source

For **every** MUST requirement, a `coverageMatrix` row linking it to journeys, decisions, components, capabilities, and verifications, with `coverage: "complete"`. Pin the consumed contract in `sourceSpec` (`schemaVersion`, `specRevision`, and a **non-null `contentDigest`** — the SHA-256 of the intent you read). Declare `environmentPrerequisites` (build/test/release; `blocking` true/false) — machine prerequisites, **distinct** from `openConfirmations` (unresolved user intent).

## Output — the architecture spec

`Write` `kiln-arch.json` (see `src/core/arch/spec.ts` for the authoritative schema):

```
schemaVersion, archRevision, status, sourceSpec{schemaVersion,specRevision,contentDigest},
codexStatus, architectureSummary,
platform{...}, system{components[],interfaces[],processes[],dependencyRules[]}, ux{...}, data{...},
capabilities[{id,capabilityNeedId,mechanism,owningComponent,availability,fallback,failureBehavior}],
integrations{networkPlan,externalServices[]},
security{threatModel,effectivePermissionManifest,loggingPolicy,secretPolicy},
reliability{failureModel[],recovery[],observability[],qualityBudgets[],verificationMatrix[]},
build{...}, dependencies[], evidence[{id,type,title,source,accessedAt,versionOrDate,supports[]}],
decisionLog[atoms], coverageMatrix[rows], assumptions[], risks[],
openConfirmations[{id,triggeredByDecisionId,questionForStart,whyIntentCannotBeInferred,recommendedDefault,alternatives[],consequences[],tracesTo[]}],
environmentPrerequisites[{id,prerequisite,affects,detectionMethod,fallback,blocking}],
handoff{buildMustImplement,buildMustPreserve,buildMustNotDo,buildMayDecide,stopConditions,expectedArtifacts,requiredVerificationEvidence},
changeLog
```

`status` is `"ready_for_build"` **only** when `openConfirmations` is empty, no decision is `pending_confirmation`, every coverage row is `complete`, and — checked against the consumed contract via `validateArchAgainstIntent` — every `tracesTo`/`capabilityNeedId` resolves to a real intent id, every MUST requirement has a complete coverage row, no `capability` exceeds a `confirmed` capability need, and `sourceSpec` pins the intent by digest.

Then a **human recap**: the chosen stack and 2–3 key decisions, the **evidence** (probes confirmed/refuted), the **costs / trade-offs / quality**, and any `openConfirmations` to clear.

## Hand-off

Non-empty `openConfirmations` blocks the build. Otherwise proceed to `kiln:dev`. Do not generate the app — that's the next stage.
