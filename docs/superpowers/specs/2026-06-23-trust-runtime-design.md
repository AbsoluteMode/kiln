# Trust Runtime — Design Spec

> Working name. Date: 2026-06-23. Status: design approved in conversation; first layer (User Understanding Layer) specced in detail, Core deferred.

---

## 1. Context & Problem

Vibe-coding studios (Glaze by Raycast, and peers) have solved **generation**: describe an app in plain language, get a working native macOS app. Under the hood they orchestrate Claude Code / OpenAI Codex. Generation is now a commodity.

What they have **not** solved is **trust**. A no-code user cannot verify that the generated app:
- **(a)** does what they actually meant, at a market-quality level, and
- **(b)** is safe — won't leak data, won't ship malicious or hallucinated code.

The user does not read code. They delegate the entire engineering process blind and **cannot check the result**. Public signal (HN, analysts, Raycast's own docs) confirms this is the loudest, most consistent, structurally-unsolved gap — and the moat Raycast could build but hasn't. See [research](../../research/2026-06-23-glaze-blockers.md).

**This product closes that gap.**

## 2. Vision

**Trust Runtime** is a layer that sits between *intent* and *finished app* and turns unverified output into **trusted** output. It is not a generator — generation is delegated to Claude/Codex/Glaze. Our value is the assurance layer around it.

Two axes of trust:
- **Axis A — Correctness:** does the app do what the user meant, at the market standard?
- **Axis B — Safety:** does the app avoid harm (data leaks, malicious/hallucinated code, over-broad permissions)?

Both are absent in current tools; both are critical precisely because the no-code user cannot self-check.

### Non-goals
- **Not a generator** — generation is commodity; we wrap it, we don't rebuild it.
- **Not a competitor to Glaze** — we strengthen any generator, we don't fight it.
- **Not a universal verifier** of arbitrary software — we focus on app classes where assurance is achievable.

## 3. Architecture

### 3.1 The Delegation Boundary

The single load-bearing decision. A line runs **between phase 1 and phase 2**:

- **Above the line (phases 0–1):** the human *decides*. They can have an opinion about *what* the app is and *how* they'll use it.
- **Below the line (phases 2–8):** the human *delegates blind*. Asking a no-code user "which framework? what data model? which permissions?" is a failure. They cannot even check the result — so the machine must be an expert at 100%.

All the weight is in the autonomous Core. The human-facing layer therefore must extract intent as precisely as possible, because everything it fails to capture, the Core will **guess** — and every guess is a miss against the user's intent.

### 3.2 Three Blocks

```
  HUMAN                            MACHINE                       HUMAN
┌──────────────┐   intent     ┌────────────────────┐  trust   ┌──────────────┐
│ FRONT (0–1)  │   contract   │   CORE (2–8)       │  verdict │ TRUST BRIDGE │
│ understand   │ ───────────► │  autonomous expert │ ───────► │ report in    │
│ the user     │              │  decision engine   │          │ user's terms │
│ (this spec)  │              │  + validation      │          │ "trust it?"  │
└──────────────┘              └────────────────────┘          └──────────────┘
                                  (deferred)                     (deferred)
```

### 3.3 Engineering Decision Phases (0–8)

The Core operates over the full space of engineering decisions an app goes through, start → release. Each is an **abstraction axis**; the user touches only 0–1.

| # | Phase | Examples | User? |
|---|-------|----------|-------|
| 0 | **Intent & scope** | app type, user, boundaries, success criteria | ✅ |
| 1 | **Form-factor & usage** | window / menu-bar / CLI / background; how the user interacts | ✅ |
| 2 | **Stack & architecture** | language, framework, runtime, pattern, deps | ❌ |
| 3 | **UX & interaction** | layout, navigation, shortcuts, states, accessibility | ❌ |
| 4 | **Data & state** | storage, format, persistence, migrations, sync, privacy | ❌ |
| 5 | **System capabilities** | FS, network, notifications, clipboard, background, external APIs | ❌ |
| 6 | **Security & permissions** | least privilege, capability manifest, egress, isolation, secrets — *Axis B* | ❌ |
| 7 | **Reliability & correctness** | errors, edge cases, input validation, tests, performance — *Axis A* | ❌ |
| 8 | **Build, release, ops** | signing, packaging, versioning, publish, updates, logs, debug, rollback | ❌ |

### 3.4 The Decision Atom

Every decision is formalized, not vibed:

```
decision = { when it arises · option space · selection criteria · default policy }
```

Glaze collapses the atom into one vibe-answer. We expand it and choose deliberately. This is the "surgical precision" standard.

## 4. Tech Stack

Chosen for: ability to spawn/launch native `.app`, fast prototype iteration, authenticity to Raycast's architecture (webview + native shell), and trust-narrative (attack surface matters — we *are* the trust layer). Independently confirmed by Codex.

- **Understanding surface:** **Tauri** (Rust shell) + **React / TypeScript** webview. React/TS matches the Raycast extension developer surface; Rust gives an explicit native capability boundary that is itself part of the trust narrative.
- **Launch / Trust broker (deferred):** a *separate* native Rust module for `.app` inspection, launch, process tracking, code-signature checks, and permission gating. **Do not build one monolith** — Tauri's Rust command boundary supports this split cleanly.
- **LLM:** Claude API (Anthropic) for understanding + research. Model selection deferred.

## 5. First Layer — User Understanding Layer (Front, phases 0–1)

**This is the current build target.** Two skills.

- **Skill 1 — Capture intent:** learn *what* the user wants to create.
- **Skill 2 — Capture usage:** learn *how* they want to use it — **only if not obvious from the request.**

### 5.1 Governing Principle

> A question earns the right to be asked **iff** the uncertainty is **(a) real** — cannot be inferred with confidence — **and (b)** affects an autonomous decision that is expensive/irreversible to undo.
> Otherwise, infer a default (and surface it in the Trust Bridge for confirmation, non-blocking).

Minimum friction, maximum alignment. A no-code user who gets interrogated quits — and ease is what makes Glaze valuable.

### 5.2 Method — Analog-Driven Inference

Reflect-and-confirm, fed by analogs — not interrogation:

1. **Listen** → classify the app type.
2. **Find analogs** — from memory, then search.
3. **Extract from analogs** — typical features + **how people actually interact with them** (usage patterns, UX conventions).
4. **Build a hypothesis** of intent + usage from the analogs.
5. **Show the user**; ask only about the contested / critical.

**Key reframing:** analogs are not "examples to copy" — they are carriers of **market standards**. They reveal the implicit requirements a user won't name (treats as obvious) but without which the app feels cheap. This operationalizes:
- *"top level"* = market standard of the class met + custom delta delivered;
- *"the devils are in the details"* = exactly those unspoken market standards.

**Tension the method must hold:** analogs supply *conventions*, but the user's *custom* always governs. They came for *their* thing, not a clone. Standard fills the gaps; custom overrides.

### 5.3 Research Provenance Policy

Source policy **(C)**: **memory → instant hypothesis, search → verification of the downstream-critical.** The trust layer must not trust even its own memory on faith; verification depth is calibrated by the governing principle.

Every analog claim is **first-class and classified** (Codex hardening):
- `classification`: `baseline` | `common_pattern` | `opinionated_choice` | `uncertain`
- `source` / citation
- `confidence`
- `criticality`
- `affects_permissions_or_data` (bool)

**Uncited claims cannot drive permissions, data handling, or release behavior.** No high-criticality inference enters the build spec without user confirmation or a standing policy.

### 5.4 Intent Contract (the artifact crossing the boundary)

Defined as `intent_contract.schema.json` **before UI polish** (Codex advice). Prose summary ≠ build contract — the schema must carry the fields the Core could otherwise silently mis-resolve.

```jsonc
{
  "app_class": "string",
  "analog_claims": [
    { "claim": "string", "source": "string|citation",
      "classification": "baseline|common_pattern|opinionated_choice|uncertain",
      "confidence": "low|medium|high", "criticality": "low|medium|high",
      "affects_permissions_or_data": false }
  ],
  "baseline_requirements": ["string"],     // market standard for the class
  "custom_delta": ["string"],              // the user's unique "own"
  "success_criteria": ["string"],
  "acceptance_tests": ["string"],          // intent → tests → spec (Codex)
  "data_flows": ["string"],
  "permissions": ["string"],
  "external_services": ["string"],
  "local_storage": ["string"],
  "unknowns": ["string"],                  // explicitly unresolved (Codex)
  "must_ask_if_discovered": ["string"],    // trip-wires for the Core (Codex)
  "decision_log": [ { "decision": "string", "rationale": "string", "tier": "auto|confirmed" } ],
  "unresolved_risks": ["string"]
}
```

### 5.5 Decide-for-me — Risk-Tiered Policy Engine

Not a single button — a policy engine with risk tiers (Codex hardening):

- **Tier 1 — auto-resolve** (low risk): reversible UX defaults, commodity stack choices. Applied silently, logged in `decision_log`.
- **Tier 2 — recommend + confirm** (high risk): permissions, data retention, network services, signing/release, irreversible/destructive actions. Show recommendation + rationale, require confirmation.

"Decide for me" = the governing principle made into UI: one-click delegation, but safe because the engine knows which decisions cannot be auto-resolved.

### 5.6 Boundary Hardening (Codex)

The phase 1→2 handoff is: **intent contract → generated acceptance tests → generation spec.** If a later phase finds a contradiction, it **halts**, emits a decision record, and routes to policy — it does not silently guess.

## 6. Error Handling & Edge Cases (Front)

- **Vague / contradictory request** → reflect a best-effort hypothesis, ask only the critical disambiguation.
- **No analogs found** → degrade to first-principles hypothesis; flag low confidence; lean on search.
- **Analogs diverge** (different standards) → present the divergence as a Tier-2 decision, don't average silently.
- **User deviates from standard** → flag ("usually X — sure you want Y?"); custom wins, but the deviation is logged.
- **Memory hallucination risk** → search-verify any downstream-critical claim before it drives the contract.

## 7. Testing Strategy

TDD for the understanding layer. Test targets:
- app-class classification from a request,
- intent-contract assembly (schema-valid, required fields populated),
- provenance classification of analog claims,
- risk-tiering of decisions (correct tier assignment),
- decide-for-me behavior (Tier 1 auto vs Tier 2 confirm),
- governing-principle gate (a question is asked iff real ∧ downstream-critical).

## 8. Deferred (not this layer)

- **Core (phases 2–8)** — autonomous decision engine + validation.
- **Trust Bridge** — reporting decisions back to the user in their language; trust verdict.
- **Launch / Trust broker** — native Rust module to inspect/launch/track `.app`.
- **Axis B (safety)** depth — sandbox, capability broker, egress firewall, security scanner.
- Product name (currently "Trust Runtime", working title).
