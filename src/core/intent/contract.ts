import { z } from 'zod';

export const confidence = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof confidence>;

export const criticality = z.enum(['low', 'medium', 'high']);
export type Criticality = z.infer<typeof criticality>;

export const specStatus = z.enum(['draft', 'awaiting_confirmation', 'ready', 'blocked']);
export type SpecStatus = z.infer<typeof specStatus>;

/** Review #3: analogs are evidence, not standards — classify what a claim actually is. */
export const claimClassification = z.enum([
  'platform_requirement',
  'common_pattern',
  'optional_pattern',
  'differentiator',
  'anti_pattern',
]);
export type ClaimClassification = z.infer<typeof claimClassification>;

/** Review #7: user statements are valid provenance, alongside platform docs and analogs. */
export const sourceType = z.enum([
  'user_statement',
  'apple_primary_doc',
  'analog_product_doc',
  'agent_inference',
]);

export const source = z.object({
  id: z.string().min(1),
  type: sourceType,
  title: z.string().min(1),
  url: z.string().optional(),
  supports: z.array(z.string().min(1)),
}).strict();
export type Source = z.infer<typeof source>;

export const analogClaim = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  classification: claimClassification,
  analogFit: z.enum(['low', 'medium', 'high']),
  supportCount: z.number().int().nonnegative(),
  evidenceRefs: z.array(z.string().min(1)),
  confidence,
  criticality,
}).strict();
export type AnalogClaim = z.infer<typeof analogClaim>;

/** Review #5: model real usage, not just a feature list. */
export const coreJourney = z.object({
  id: z.string().min(1),
  actor: z.string().min(1),
  trigger: z.string().min(1),
  preconditions: z.array(z.string()),
  steps: z.array(z.string().min(1)).min(1),
  expectedOutcome: z.string().min(1),
  failureRecovery: z.string().min(1),
}).strict();
export type CoreJourney = z.infer<typeof coreJourney>;

export const requirement = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  priority: z.enum(['must', 'should', 'wont']),
  evidenceRefs: z.array(z.string().min(1)),
}).strict();
export type Requirement = z.infer<typeof requirement>;

/** Review #7: every data category needs a full lifecycle. */
export const dataFlow = z.object({
  dataCategory: z.string().min(1),
  source: z.string().min(1),
  purpose: z.string().min(1),
  sensitivity: z.enum(['low', 'medium', 'high']),
  destination: z.string().min(1),
  locality: z.enum(['local', 'cloud']),
  retention: z.string().min(1),
  deletion: z.string().min(1),
  thirdParties: z.array(z.string()),
}).strict();
export type DataFlow = z.infer<typeof dataFlow>;

/** Review #1 + #6: intent-level capability needs, not concrete entitlements. */
export const confirmationStatus = z.enum([
  'confirmed_by_request',
  'needs_confirmation',
  'confirmed',
]);
export type ConfirmationStatus = z.infer<typeof confirmationStatus>;

export const capabilityNeed = z.object({
  id: z.string().min(1),
  capability: z.string().min(1),
  minimalScope: z.string().min(1),
  purpose: z.string().min(1),
  userBenefit: z.string().min(1),
  confirmationStatus,
  evidenceRefs: z.array(z.string().min(1)),
}).strict();
export type CapabilityNeed = z.infer<typeof capabilityNeed>;

/** Review #8: coverage-based acceptance tests with an observable oracle. */
export const acceptanceTest = z.object({
  id: z.string().min(1),
  covers: z.array(z.string().min(1)).min(1),
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.array(z.string().min(1)).min(1),
  requiredEvidence: z.array(z.string().min(1)).min(1),
}).strict();
export type AcceptanceTest = z.infer<typeof acceptanceTest>;

export const unknown = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  blocking: z.boolean(),
  safeDefault: z.string().nullable(),
  resolutionOwner: z.enum(['user', 'build', 'agent']),
  discoveryTrigger: z.string().nullable(),
}).strict();
export type Unknown = z.infer<typeof unknown>;

export const decisionLogEntry = z.object({
  decision: z.string().min(1),
  rationale: z.string().min(1),
  tier: z.enum(['auto', 'needs_confirmation', 'confirmed']),
}).strict();
export type DecisionLogEntry = z.infer<typeof decisionLogEntry>;

/** Review #9: explicit posture on each macOS baseline expectation. */
export const macBaselineExpectation = z.object({
  area: z.enum([
    'main_menu',
    'keyboard_only',
    'voiceover',
    'appearance',
    'empty_state',
    'state_restoration',
    'undo_or_confirm',
    'window_behavior',
    'offline_error',
  ]),
  status: z.enum(['required', 'not_applicable', 'deferred']),
}).strict();
export type MacBaselineExpectation = z.infer<typeof macBaselineExpectation>;

export const intentContractSchema = z
  .object({
    schemaVersion: z.string().min(1),
    specRevision: z.number().int().nonnegative(),
    status: specStatus,

    intent: z.object({
      oneSentenceIntent: z.string().min(1),
      targetUsers: z.array(z.string().min(1)).min(1),
      problem: z.string().min(1),
      desiredOutcome: z.string().min(1),
      usageContexts: z.array(z.string().min(1)),
      explicitConstraints: z.array(z.string()),
      nonGoals: z.array(z.string()),
    }).strict(),

    classification: z.object({
      jobClass: z.string().min(1),
      interactionSurfaces: z.array(z.string().min(1)).min(1),
      lifecycle: z.string().min(1),
      interactionModel: z.string().min(1),
    }).strict(),

    coreJourneys: z.array(coreJourney).min(1),

    scope: z.object({
      must: z.array(z.string()),
      should: z.array(z.string()),
      wont: z.array(z.string()),
    }).strict(),

    sources: z.array(source),
    analogClaims: z.array(analogClaim),

    requirements: z.object({
      baseline: z.array(requirement),
      customDelta: z.array(requirement),
    }).strict(),

    qualityAttributes: z.array(z.string()),

    dataHandlingIntent: z.object({
      dataFlows: z.array(dataFlow),
      forbiddenPractices: z.array(z.string()),
    }).strict(),

    capabilityNeeds: z.array(capabilityNeed),

    deliveryContext: z.object({
      audience: z.enum(['personal', 'team', 'public', 'unknown']),
      distributionConstraint: z.enum(['app_store', 'direct', 'internal', 'build_decides']),
      compatibilityConstraints: z.array(z.string()),
      offlineExpectation: z.enum(['required', 'preferred', 'not_required']),
    }).strict(),

    macBaseline: z.array(macBaselineExpectation),

    successCriteria: z.array(z.string().min(1)).min(1),
    acceptanceTests: z.array(acceptanceTest).min(1),

    unknowns: z.array(unknown),
    unresolvedRisks: z.array(z.string()),
    decisionLog: z.array(decisionLogEntry),

    handoff: z.object({
      buildMayDecide: z.array(z.string()),
      buildMustPreserve: z.array(z.string()),
      stopConditions: z.array(z.string()),
      verificationEvidenceRequired: z.array(z.string()),
    }).strict(),

    changeLog: z.array(z.string()),
  })
  .strict()
  .superRefine((spec, ctx) => {
    const allRequirements = [...spec.requirements.baseline, ...spec.requirements.customDelta];

    // Invariant (review #7): every capability need maps to a user benefit (field required) —
    // and every cloud data flow must declare third parties or "none".
    for (const f of spec.dataHandlingIntent.dataFlows) {
      if (f.locality === 'cloud' && f.thirdParties.length === 0) {
        ctx.addIssue({ code: 'custom', message: `data flow "${f.dataCategory}" is cloud but lists no third parties (use ["none"] if truly none)` });
      }
    }

    // Ready gate (review #2): status "ready" demands the contract is actually buildable.
    if (spec.status === 'ready') {
      const covered = new Set(spec.acceptanceTests.flatMap((t) => t.covers));
      for (const r of allRequirements) {
        if (r.priority === 'must' && !covered.has(r.id)) {
          ctx.addIssue({ code: 'custom', message: `ready: MUST requirement ${r.id} has no acceptance test` });
        }
      }
      for (const c of spec.capabilityNeeds) {
        if (c.confirmationStatus === 'needs_confirmation') {
          ctx.addIssue({ code: 'custom', message: `ready: capability ${c.id} still needs confirmation` });
        }
      }
      for (const u of spec.unknowns) {
        if (u.blocking) {
          ctx.addIssue({ code: 'custom', message: `ready: unknown ${u.id} is still blocking` });
        }
        if (u.safeDefault === null) {
          ctx.addIssue({ code: 'custom', message: `ready: unknown ${u.id} has no safe default` });
        }
      }
    }
  });
export type IntentContract = z.infer<typeof intentContractSchema>;

export function parseIntentContract(input: unknown): IntentContract {
  return intentContractSchema.parse(input);
}
