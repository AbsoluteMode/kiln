import { z } from 'zod';

export const archStatus = z.enum([
  'ready_for_build',
  'invalid_input',
  'blocked_on_intent',
  'blocked_on_feasibility',
]);
export type ArchStatus = z.infer<typeof archStatus>;

export const decisionStatus = z.enum(['decided', 'pending_confirmation', 'not_applicable']);
export const authority = z.enum(['inherited', 'delegated', 'outside_delegation']);
export const engineeringRisk = z.enum(['low', 'medium', 'high']);
export const reversibility = z.enum(['easy', 'moderate', 'hard']);
export const archPhase = z.enum([
  'platformTopology',
  'ux',
  'data',
  'integrationsCapabilities',
  'securityPrivacy',
  'reliabilityVerification',
  'buildRelease',
]);
export type ArchPhase = z.infer<typeof archPhase>;

const idList = z.array(z.string().min(1));

export const decisionOption = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  advantages: z.array(z.string()),
  disadvantages: z.array(z.string()),
  eliminatedBy: z.array(z.string()),
}).strict();

export const selectionCriterion = z.object({
  criterion: z.string().min(1),
  priority: z.enum(['must', 'high', 'medium', 'low']),
}).strict();

/** Review #5/#6: a decision separates status, authority, engineering risk, reversibility. */
export const archDecision = z
  .object({
    id: z.string().min(1),
    phase: archPhase,
    question: z.string().min(1),
    status: decisionStatus,
    authority,
    engineeringRisk,
    reversibility,
    hardConstraints: z.array(z.string()),
    options: z.array(decisionOption).min(1),
    selectionCriteria: z.array(selectionCriterion),
    chosenOptionId: z.string().nullable(),
    recommendedOptionId: z.string().nullable(),
    rationale: z.string().min(1),
    rejectedOptions: z.array(z.object({ optionId: z.string().min(1), reason: z.string().min(1) }).strict()),
    tracesTo: idList,
    evidenceRefs: z.array(z.string()),
    confidence: z.enum(['low', 'medium', 'high']),
    consequences: z.array(z.string()),
    fallback: z.string().nullable(),
    verificationPlan: z.string().nullable(),
  })
  .strict()
  .superRefine((d, ctx) => {
    const optionIds = new Set(d.options.map((o) => o.id));
    if (d.status === 'decided') {
      if (!d.chosenOptionId) ctx.addIssue({ code: 'custom', message: `decision ${d.id}: status "decided" requires chosenOptionId` });
      else if (!optionIds.has(d.chosenOptionId)) ctx.addIssue({ code: 'custom', message: `decision ${d.id}: chosenOptionId not among options` });
    }
    if (d.status === 'pending_confirmation') {
      if (d.chosenOptionId) ctx.addIssue({ code: 'custom', message: `decision ${d.id}: status "pending_confirmation" forbids chosenOptionId` });
      if (!d.recommendedOptionId) ctx.addIssue({ code: 'custom', message: `decision ${d.id}: status "pending_confirmation" requires recommendedOptionId` });
    }
    if (d.recommendedOptionId && !optionIds.has(d.recommendedOptionId)) {
      ctx.addIssue({ code: 'custom', message: `decision ${d.id}: recommendedOptionId not among options` });
    }
  });
export type ArchDecision = z.infer<typeof archDecision>;

export const evidenceItem = z.object({
  id: z.string().min(1),
  type: z.enum(['apple_primary_doc', 'dependency_doc', 'experiment', 'agent_inference']),
  title: z.string().min(1),
  source: z.string().min(1),
  accessedAt: z.string().nullable(),
  versionOrDate: z.string().nullable(),
  supports: idList,
}).strict();

export const dependency = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  selectedVersionOrConstraint: z.string().min(1),
  source: z.string().min(1),
  license: z.string().min(1),
  maintenanceEvidence: z.string().min(1),
  platformCompatibility: z.string().min(1),
  privacyImpact: z.string().min(1),
  supplyChainRisk: z.enum(['low', 'medium', 'high']),
  replacementCost: z.enum(['low', 'medium', 'high']),
  tracesTo: idList,
}).strict();

export const verificationRecord = z.object({
  id: z.string().min(1),
  acceptanceTestId: z.string().min(1),
  level: z.enum(['unit', 'integration', 'ui', 'system', 'manual_audit']),
  harness: z.string().min(1),
  preconditions: z.array(z.string()),
  execution: z.string().min(1),
  oracle: z.array(z.string().min(1)).min(1),
  requiredEvidence: z.array(z.string().min(1)).min(1),
  environment: z.array(z.string()),
  flakinessControls: z.array(z.string()),
}).strict();

export const coverageRow = z.object({
  requirementId: z.string().min(1),
  journeyIds: idList,
  decisionIds: idList,
  componentIds: idList,
  capabilityIds: idList,
  verificationIds: idList,
  coverage: z.enum(['complete', 'partial', 'blocked']),
}).strict();

export const openConfirmation = z.object({
  id: z.string().min(1),
  triggeredByDecisionId: z.string().min(1),
  questionForStart: z.string().min(1),
  whyIntentCannotBeInferred: z.string().min(1),
  recommendedDefault: z.string().min(1),
  alternatives: z.array(z.string()),
  consequences: z.array(z.string()),
  tracesTo: idList,
}).strict();

export const environmentPrerequisite = z.object({
  id: z.string().min(1),
  prerequisite: z.string().min(1),
  affects: z.enum(['build', 'test', 'release']),
  detectionMethod: z.string().min(1),
  fallback: z.string().nullable(),
  blocking: z.boolean(),
}).strict();

export const archSpecSchema = z
  .object({
    schemaVersion: z.string().min(1),
    archRevision: z.number().int().nonnegative(),
    status: archStatus,
    sourceSpec: z.object({
      schemaVersion: z.string().min(1),
      specRevision: z.number().int().nonnegative(),
      contentDigest: z.string().nullable(),
    }).strict(),
    codexStatus: z.enum(['off', 'consulted', 'unavailable']),
    architectureSummary: z.string().min(1),

    platform: z.object({
      artifactTypes: z.array(z.string().min(1)).min(1),
      language: z.string().min(1),
      runtime: z.string().min(1),
      uiFrameworks: z.array(z.string()),
      minimumMacOS: z.string().min(1),
      processTopology: z.string().min(1),
      buildSystem: z.string().min(1),
    }).strict(),
    system: z.object({
      components: z.array(z.object({ id: z.string().min(1), responsibility: z.string().min(1), owns: z.array(z.string()) }).strict()).min(1),
      interfaces: z.array(z.object({ id: z.string().min(1), from: z.string().min(1), to: z.string().min(1), contract: z.string().min(1) }).strict()),
      processes: z.array(z.string()),
      dependencyRules: z.array(z.string()),
    }).strict(),
    ux: z.object({
      surfaces: z.array(z.string().min(1)).min(1),
      journeyFlows: z.array(z.object({ journeyId: z.string().min(1), flow: z.array(z.string().min(1)).min(1) }).strict()).min(1),
      stateModel: z.array(z.string()),
      commandModel: z.array(z.string()),
      accessibilityPlan: z.array(z.string()),
    }).strict(),
    data: z.object({
      entities: z.array(z.string()),
      invariants: z.array(z.string()),
      persistence: z.string().min(1),
      migrations: z.array(z.string()),
      lifecycle: z.array(z.string()),
      concurrency: z.string(),
      recovery: z.string(),
    }).strict(),
    capabilities: z.array(z.object({
      id: z.string().min(1),
      capabilityNeedId: z.string().min(1),
      mechanism: z.string().min(1),
      owningComponent: z.string().min(1),
      availability: z.string().min(1),
      fallback: z.string(),
      failureBehavior: z.string().min(1),
    }).strict()),
    integrations: z.object({
      networkPlan: z.string(),
      externalServices: z.array(z.string()),
    }).strict(),
    security: z.object({
      threatModel: z.object({
        assets: z.array(z.string()),
        trustBoundaries: z.array(z.string()),
        abuseCases: z.array(z.string()),
        mitigations: z.array(z.string()),
        residualRisks: z.array(z.string()),
      }).strict(),
      effectivePermissionManifest: z.object({
        entitlements: z.array(z.string()),
        tccUsageDescriptions: z.array(z.string()),
        sandboxAccess: z.array(z.string()),
        keychainAccess: z.array(z.string()),
        appGroups: z.array(z.string()),
        appleEvents: z.array(z.string()),
        hardenedRuntime: z.boolean(),
        runtimeExceptions: z.array(z.string()),
        privacyManifestPlan: z.string(),
      }).strict(),
      loggingPolicy: z.string().min(1),
      secretPolicy: z.string(),
    }).strict(),
    reliability: z.object({
      failureModel: z.array(z.string()),
      recovery: z.array(z.string()),
      observability: z.array(z.string()),
      qualityBudgets: z.array(z.string()),
      verificationMatrix: z.array(verificationRecord).min(1),
    }).strict(),
    build: z.object({
      project: z.string().min(1),
      targets: z.array(z.string()),
      configurations: z.array(z.string()),
      commands: z.array(z.string()).min(1),
      packaging: z.string().min(1),
      signing: z.string().min(1),
      notarization: z.string(),
      ci: z.array(z.string()),
      releaseArtifacts: z.array(z.string()),
      reproducibility: z.string(),
    }).strict(),

    dependencies: z.array(dependency),
    evidence: z.array(evidenceItem),
    decisionLog: z.array(archDecision).min(1),
    coverageMatrix: z.array(coverageRow),
    assumptions: z.array(z.string()),
    risks: z.array(z.string()),
    openConfirmations: z.array(openConfirmation),
    environmentPrerequisites: z.array(environmentPrerequisite),
    handoff: z.object({
      buildMustImplement: z.array(z.string()),
      buildMustPreserve: z.array(z.string()),
      buildMustNotDo: z.array(z.string()),
      buildMayDecide: z.array(z.string()),
      stopConditions: z.array(z.string()),
      expectedArtifacts: z.array(z.string()),
      requiredVerificationEvidence: z.array(z.string()),
    }).strict(),
    changeLog: z.array(z.string()),
  })
  .strict()
  .superRefine((spec, ctx) => {
    // evidence refs on decisions must resolve
    const evidenceIds = new Set(spec.evidence.map((e) => e.id));
    const decisionIds = new Set(spec.decisionLog.map((d) => d.id));
    for (const d of spec.decisionLog) {
      for (const ref of d.evidenceRefs) {
        if (!evidenceIds.has(ref)) ctx.addIssue({ code: 'custom', message: `decision ${d.id} cites unknown evidence: ${ref}` });
      }
    }
    for (const oc of spec.openConfirmations) {
      if (!decisionIds.has(oc.triggeredByDecisionId)) {
        ctx.addIssue({ code: 'custom', message: `openConfirmation ${oc.id} triggered by unknown decision: ${oc.triggeredByDecisionId}` });
      }
    }
    // Ready gate (review #12): ready_for_build demands no open confirmations,
    // no pending decisions, and complete coverage.
    if (spec.status === 'ready_for_build') {
      if (spec.openConfirmations.length > 0) {
        ctx.addIssue({ code: 'custom', message: 'ready_for_build: openConfirmations must be empty' });
      }
      for (const d of spec.decisionLog) {
        if (d.status === 'pending_confirmation') {
          ctx.addIssue({ code: 'custom', message: `ready_for_build: decision ${d.id} is still pending_confirmation` });
        }
      }
      for (const row of spec.coverageMatrix) {
        if (row.coverage !== 'complete') {
          ctx.addIssue({ code: 'custom', message: `ready_for_build: requirement ${row.requirementId} coverage is ${row.coverage}` });
        }
      }
    }
  });
export type ArchSpec = z.infer<typeof archSpecSchema>;

export function parseArchSpec(input: unknown): ArchSpec {
  return archSpecSchema.parse(input);
}
