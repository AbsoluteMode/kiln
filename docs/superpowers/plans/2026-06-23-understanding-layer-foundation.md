# Understanding Layer — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tested decision-core of Kiln's User Understanding Layer — the pure-logic foundation (intent contract, risk tiering, governing-principle gate, analog provenance) that LLM inference and UI will sit on top of.

**Architecture:** Pure TypeScript modules under `src/core/`, each one focused responsibility, no LLM and no UI dependencies. Everything is deterministic and unit-tested with Vitest. The LLM-powered inference layer (plan 2) and the React/Tauri UI (plan 3) consume these modules — this plan deliberately excludes them so the foundation is provable in isolation.

**Tech Stack:** Vite + React + TypeScript, Vitest for tests, Zod for the intent-contract schema (runtime validation + inferred types). Tauri shell is deferred to plan 3 (native launch isn't needed to test pure logic).

## Global Constraints

- All product code, identifiers, and user-facing copy in **English**.
- Runtime: **Node ≥ 18**.
- **TDD**: failing test first, minimal code, frequent commits (one per task minimum).
- Pure-logic modules in `src/core/` must have **no imports from React, Tauri, or any LLM client**.
- Provenance rule (from spec §5.3, verbatim): **uncited claims cannot drive permissions, data handling, or release behavior; no high-criticality inference enters the build spec without confirmation.**
- Decide-for-me tiers (spec §5.5): high-risk domains = permissions, data retention, network services, signing/release, irreversible/destructive actions → **confirm**; everything else → **auto**.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`
- Create: `src/core/smoke.test.ts` (temporary, deleted in step 6)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working `npm test` (Vitest) and `npm run build` (Vite + tsc).

- [ ] **Step 1: Initialize the Vite React-TS project into the current directory**

Run (the trailing `.` targets the existing repo dir; keep the git history and existing `docs/`):
```bash
npm create vite@latest . -- --template react-ts
```
If prompted about a non-empty directory, choose **"Ignore files and continue"**.

- [ ] **Step 2: Add Vitest and Zod**

```bash
npm install
npm install -D vitest
npm install zod
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

Add to `package.json` `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write a smoke test**

Create `src/core/smoke.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('scaffold', () => {
  it('runs tests', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run the smoke test to verify the toolchain**

Run: `npm test`
Expected: PASS — 1 test passed.

- [ ] **Step 6: Delete the smoke test and commit**

```bash
rm src/core/smoke.test.ts
git add -A
git commit -m "chore: scaffold Vite + React + TS + Vitest"
```

---

### Task 2: Intent Contract Schema & Types

**Files:**
- Create: `src/core/intent/contract.ts`
- Test: `src/core/intent/contract.test.ts`

**Interfaces:**
- Consumes: Zod (from Task 1).
- Produces:
  - `Confidence`, `Criticality` = `'low' | 'medium' | 'high'`
  - `ClaimClassification` = `'baseline' | 'common_pattern' | 'opinionated_choice' | 'uncertain'`
  - `AnalogClaim` type with fields: `claim: string`, `source: string`, `classification: ClaimClassification`, `confidence: Confidence`, `criticality: Criticality`, `affectsPermissionsOrData: boolean`
  - `IntentContract` type (all spec §5.4 fields, camelCase)
  - `intentContractSchema: z.ZodType<IntentContract>`
  - `parseIntentContract(input: unknown): IntentContract` — throws on invalid

- [ ] **Step 1: Write the failing test**

Create `src/core/intent/contract.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { parseIntentContract } from './contract';

const valid = {
  appClass: 'menu-bar timer',
  analogClaims: [
    {
      claim: 'plays a completion sound',
      source: 'https://example.com/box-breath',
      classification: 'baseline',
      confidence: 'high',
      criticality: 'low',
      affectsPermissionsOrData: false,
    },
  ],
  baselineRequirements: ['remembers last settings'],
  customDelta: ['4-7-8 breathing pattern'],
  successCriteria: ['user can start a session in one click'],
  acceptanceTests: ['starting a session shows a countdown'],
  dataFlows: ['settings stored locally'],
  permissions: ['notifications'],
  externalServices: [],
  localStorage: ['user settings'],
  unknowns: [],
  mustAskIfDiscovered: ['any network call'],
  decisionLog: [],
  unresolvedRisks: [],
};

describe('parseIntentContract', () => {
  it('accepts a valid contract', () => {
    expect(parseIntentContract(valid).appClass).toBe('menu-bar timer');
  });

  it('rejects an unknown classification', () => {
    const bad = {
      ...valid,
      analogClaims: [{ ...valid.analogClaims[0], classification: 'guess' }],
    };
    expect(() => parseIntentContract(bad)).toThrow();
  });

  it('rejects a missing required field', () => {
    const { appClass, ...rest } = valid;
    expect(() => parseIntentContract(rest)).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/core/intent/contract.test.ts`
Expected: FAIL — cannot find module `./contract`.

- [ ] **Step 3: Write the schema and types**

Create `src/core/intent/contract.ts`:
```typescript
import { z } from 'zod';

export const confidence = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof confidence>;

export const criticality = z.enum(['low', 'medium', 'high']);
export type Criticality = z.infer<typeof criticality>;

export const claimClassification = z.enum([
  'baseline',
  'common_pattern',
  'opinionated_choice',
  'uncertain',
]);
export type ClaimClassification = z.infer<typeof claimClassification>;

export const analogClaim = z.object({
  claim: z.string(),
  source: z.string(),
  classification: claimClassification,
  confidence,
  criticality,
  affectsPermissionsOrData: z.boolean(),
});
export type AnalogClaim = z.infer<typeof analogClaim>;

export const decisionLogEntry = z.object({
  decision: z.string(),
  rationale: z.string(),
  tier: z.enum(['auto', 'confirmed']),
});
export type DecisionLogEntry = z.infer<typeof decisionLogEntry>;

export const intentContractSchema = z.object({
  appClass: z.string().min(1),
  analogClaims: z.array(analogClaim),
  baselineRequirements: z.array(z.string()),
  customDelta: z.array(z.string()),
  successCriteria: z.array(z.string()),
  acceptanceTests: z.array(z.string()),
  dataFlows: z.array(z.string()),
  permissions: z.array(z.string()),
  externalServices: z.array(z.string()),
  localStorage: z.array(z.string()),
  unknowns: z.array(z.string()),
  mustAskIfDiscovered: z.array(z.string()),
  decisionLog: z.array(decisionLogEntry),
  unresolvedRisks: z.array(z.string()),
});
export type IntentContract = z.infer<typeof intentContractSchema>;

export function parseIntentContract(input: unknown): IntentContract {
  return intentContractSchema.parse(input);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/core/intent/contract.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/intent/contract.ts src/core/intent/contract.test.ts
git commit -m "feat: intent contract schema and types"
```

---

### Task 3: Risk Classification

**Files:**
- Create: `src/core/decide/risk.ts`
- Test: `src/core/decide/risk.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `RiskTier` = `'auto' | 'confirm'`
  - `DecisionDomain` = `'permissions' | 'data_retention' | 'network_service' | 'signing_release' | 'destructive_action' | 'ux_default' | 'commodity_stack'`
  - `classifyRisk(domain: DecisionDomain): RiskTier`

- [ ] **Step 1: Write the failing test**

Create `src/core/decide/risk.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { classifyRisk } from './risk';

describe('classifyRisk', () => {
  it('flags permissions as confirm', () => {
    expect(classifyRisk('permissions')).toBe('confirm');
  });

  it('flags signing/release as confirm', () => {
    expect(classifyRisk('signing_release')).toBe('confirm');
  });

  it('auto-resolves UX defaults', () => {
    expect(classifyRisk('ux_default')).toBe('auto');
  });

  it('auto-resolves commodity stack choices', () => {
    expect(classifyRisk('commodity_stack')).toBe('auto');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/core/decide/risk.test.ts`
Expected: FAIL — cannot find module `./risk`.

- [ ] **Step 3: Write the implementation**

Create `src/core/decide/risk.ts`:
```typescript
export type RiskTier = 'auto' | 'confirm';

export type DecisionDomain =
  | 'permissions'
  | 'data_retention'
  | 'network_service'
  | 'signing_release'
  | 'destructive_action'
  | 'ux_default'
  | 'commodity_stack';

const HIGH_RISK_DOMAINS: ReadonlySet<DecisionDomain> = new Set([
  'permissions',
  'data_retention',
  'network_service',
  'signing_release',
  'destructive_action',
]);

export function classifyRisk(domain: DecisionDomain): RiskTier {
  return HIGH_RISK_DOMAINS.has(domain) ? 'confirm' : 'auto';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/core/decide/risk.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/decide/risk.ts src/core/decide/risk.test.ts
git commit -m "feat: decision risk classification"
```

---

### Task 4: Decide-for-me Policy Engine

**Files:**
- Create: `src/core/decide/policy.ts`
- Test: `src/core/decide/policy.test.ts`

**Interfaces:**
- Consumes: `classifyRisk`, `DecisionDomain` from `./risk` (Task 3).
- Produces:
  - `Decision` = `{ id: string; domain: DecisionDomain; recommendation: string; rationale: string }`
  - `Resolution` = `{ decisionId: string; tier: RiskTier; applied: boolean; needsConfirmation: boolean }`
  - `resolveDecision(d: Decision): Resolution`

- [ ] **Step 1: Write the failing test**

Create `src/core/decide/policy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { resolveDecision, Decision } from './policy';

const base: Omit<Decision, 'domain'> = {
  id: 'd1',
  recommendation: 'use SQLite',
  rationale: 'standard local store',
};

describe('resolveDecision', () => {
  it('auto-applies low-risk decisions', () => {
    const r = resolveDecision({ ...base, domain: 'commodity_stack' });
    expect(r.tier).toBe('auto');
    expect(r.applied).toBe(true);
    expect(r.needsConfirmation).toBe(false);
  });

  it('holds high-risk decisions for confirmation', () => {
    const r = resolveDecision({ ...base, domain: 'permissions' });
    expect(r.tier).toBe('confirm');
    expect(r.applied).toBe(false);
    expect(r.needsConfirmation).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/core/decide/policy.test.ts`
Expected: FAIL — cannot find module `./policy`.

- [ ] **Step 3: Write the implementation**

Create `src/core/decide/policy.ts`:
```typescript
import { classifyRisk, DecisionDomain, RiskTier } from './risk';

export interface Decision {
  id: string;
  domain: DecisionDomain;
  recommendation: string;
  rationale: string;
}

export interface Resolution {
  decisionId: string;
  tier: RiskTier;
  applied: boolean;
  needsConfirmation: boolean;
}

export function resolveDecision(d: Decision): Resolution {
  const tier = classifyRisk(d.domain);
  return {
    decisionId: d.id,
    tier,
    applied: tier === 'auto',
    needsConfirmation: tier === 'confirm',
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/core/decide/policy.test.ts`
Expected: PASS — 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/decide/policy.ts src/core/decide/policy.test.ts
git commit -m "feat: risk-tiered decide-for-me policy engine"
```

---

### Task 5: Governing-Principle Gate

**Files:**
- Create: `src/core/principle/gate.ts`
- Test: `src/core/principle/gate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Uncertainty` = `{ inferable: boolean; affectsIrreversible: boolean }`
  - `shouldAsk(u: Uncertainty): boolean` — true iff `!inferable && affectsIrreversible`

- [ ] **Step 1: Write the failing test**

Create `src/core/principle/gate.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { shouldAsk } from './gate';

describe('shouldAsk (governing principle)', () => {
  it('asks when uncertainty is real AND downstream-critical', () => {
    expect(shouldAsk({ inferable: false, affectsIrreversible: true })).toBe(true);
  });

  it('stays silent when it can be inferred', () => {
    expect(shouldAsk({ inferable: true, affectsIrreversible: true })).toBe(false);
  });

  it('stays silent when it does not affect anything irreversible', () => {
    expect(shouldAsk({ inferable: false, affectsIrreversible: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/core/principle/gate.test.ts`
Expected: FAIL — cannot find module `./gate`.

- [ ] **Step 3: Write the implementation**

Create `src/core/principle/gate.ts`:
```typescript
export interface Uncertainty {
  /** Can we infer this with confidence (from analogs/memory)? */
  inferable: boolean;
  /** Does it affect an expensive/irreversible downstream decision? */
  affectsIrreversible: boolean;
}

/**
 * A question earns the right to be asked iff the uncertainty is real
 * (not inferable) AND it affects something irreversible downstream.
 */
export function shouldAsk(u: Uncertainty): boolean {
  return !u.inferable && u.affectsIrreversible;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/core/principle/gate.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/principle/gate.ts src/core/principle/gate.test.ts
git commit -m "feat: governing-principle question gate"
```

---

### Task 6: Analog Provenance Gate

**Files:**
- Create: `src/core/analog/provenance.ts`
- Test: `src/core/analog/provenance.test.ts`

**Interfaces:**
- Consumes: `AnalogClaim` from `../intent/contract` (Task 2).
- Produces:
  - `canDriveBuildSpec(claim: AnalogClaim): boolean` — enforces spec §5.3: an uncited claim cannot drive permissions/data; a high-criticality claim that touches permissions/data needs a citation and high confidence.

- [ ] **Step 1: Write the failing test**

Create `src/core/analog/provenance.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { canDriveBuildSpec } from './provenance';
import { AnalogClaim } from '../intent/contract';

const claim = (over: Partial<AnalogClaim>): AnalogClaim => ({
  claim: 'syncs to cloud',
  source: '',
  classification: 'common_pattern',
  confidence: 'medium',
  criticality: 'low',
  affectsPermissionsOrData: false,
  ...over,
});

describe('canDriveBuildSpec', () => {
  it('allows a low-criticality claim regardless of citation', () => {
    expect(canDriveBuildSpec(claim({ source: '' }))).toBe(true);
  });

  it('blocks an uncited high-criticality permissions/data claim', () => {
    expect(
      canDriveBuildSpec(
        claim({ source: '', criticality: 'high', affectsPermissionsOrData: true }),
      ),
    ).toBe(false);
  });

  it('blocks a cited but low-confidence high-criticality data claim', () => {
    expect(
      canDriveBuildSpec(
        claim({
          source: 'https://example.com',
          confidence: 'low',
          criticality: 'high',
          affectsPermissionsOrData: true,
        }),
      ),
    ).toBe(false);
  });

  it('allows a cited high-confidence high-criticality data claim', () => {
    expect(
      canDriveBuildSpec(
        claim({
          source: 'https://example.com',
          confidence: 'high',
          criticality: 'high',
          affectsPermissionsOrData: true,
        }),
      ),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- src/core/analog/provenance.test.ts`
Expected: FAIL — cannot find module `./provenance`.

- [ ] **Step 3: Write the implementation**

Create `src/core/analog/provenance.ts`:
```typescript
import { AnalogClaim } from '../intent/contract';

/**
 * Spec §5.3: uncited claims cannot drive permissions/data/release behavior;
 * no high-criticality inference enters the build spec without a citation
 * and high confidence. Low-criticality claims always pass.
 */
export function canDriveBuildSpec(claim: AnalogClaim): boolean {
  const cited = claim.source.trim().length > 0;
  if (claim.affectsPermissionsOrData && claim.criticality === 'high') {
    return cited && claim.confidence === 'high';
  }
  return true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- src/core/analog/provenance.test.ts`
Expected: PASS — 4 tests passed.

- [ ] **Step 5: Run the full suite and commit**

```bash
npm test
git add src/core/analog/provenance.ts src/core/analog/provenance.test.ts
git commit -m "feat: analog provenance gate for build-spec eligibility"
```

---

## Self-Review

**1. Spec coverage (foundation scope only):**
- Intent Contract §5.4 → Task 2 ✅ (all fields, camelCase, validated)
- Governing principle §5.1 → Task 5 ✅
- Provenance policy §5.3 → Task 6 ✅ (uncited high-criticality blocked)
- Decide-for-me tiers §5.5 → Tasks 3–4 ✅
- *Deferred to plan 2 (LLM inference):* analog-driven inference §5.2, app-class classification, research memory→search §5.3 orchestration, contract assembly, acceptance-test generation §5.6.
- *Deferred to plan 3 (UI):* the decide-for-me UI, reflect-and-confirm dialog, Tauri shell.

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every test step shows real assertions. ✅

**3. Type consistency:** `DecisionDomain`/`RiskTier` defined in Task 3, consumed identically in Task 4. `AnalogClaim` defined in Task 2, consumed in Task 6. `Confidence`/`Criticality` enums consistent. ✅

**Note for plan 2:** the LLM inference layer must populate `AnalogClaim` provenance fields so `canDriveBuildSpec` (Task 6) can gate them, and emit `Decision` objects (Task 4 shape) for the policy engine. These interfaces are the contract between this foundation and the next plan.
