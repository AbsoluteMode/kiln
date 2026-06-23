import { z } from 'zod';

export const archTier = z.enum(['auto', 'needs_confirmation', 'confirmed']);
export type ArchTier = z.infer<typeof archTier>;

export const archPhase = z.enum([
  'stack',
  'ux',
  'data',
  'capabilities',
  'security',
  'reliability',
  'build',
]);
export type ArchPhase = z.infer<typeof archPhase>;

/** A pointer from a decision to the research/experiment that justifies it. */
export const evidenceRef = z.object({
  kind: z.enum(['research', 'experiment']),
  ref: z.string().min(1),
});
export type EvidenceRef = z.infer<typeof evidenceRef>;

export const archDecision = z
  .object({
    phase: archPhase,
    options: z.array(z.string().min(1)).min(1),
    selectionCriteria: z.string().min(1),
    chosen: z.string().min(1),
    rationale: z.string().min(1),
    tier: archTier,
    tracesTo: z.string().min(1),
    evidence: z.array(evidenceRef),
  })
  .refine((d) => d.options.includes(d.chosen), {
    message: 'chosen must be exactly one of the options',
  });
export type ArchDecision = z.infer<typeof archDecision>;

export const confirmationRecord = z.object({
  decision: z.string().min(1),
  rationale: z.string().min(1),
  tracesTo: z.string().min(1),
});
export type ConfirmationRecord = z.infer<typeof confirmationRecord>;

/** A finding from reverse-engineering how similar apps/repos implement a feature (via Explore). */
export const researchFinding = z.object({
  id: z.string().min(1),
  feature: z.string().min(1),
  finding: z.string().min(1),
  sources: z.array(z.string().min(1)).min(1),
});
export type ResearchFinding = z.infer<typeof researchFinding>;

/** A small isolated probe that de-risks a key technology BEFORE full implementation. */
export const experiment = z.object({
  id: z.string().min(1),
  hypothesis: z.string().min(1),
  method: z.string().min(1),
  result: z.string().min(1),
  verdict: z.enum(['confirmed', 'refuted', 'inconclusive']),
});
export type Experiment = z.infer<typeof experiment>;

/** What to log and how — so the built app can be debugged after the fact. */
export const logEntry = z.object({
  event: z.string().min(1),
  why: z.string().min(1),
  howLogged: z.string().min(1),
});
export type LogEntry = z.infer<typeof logEntry>;

export const archSpecSchema = z
  .object({
    tracesTo: z.string().min(1),
    stack: z.object({
      language: z.string().min(1),
      framework: z.string().min(1),
      artifactType: z.string().min(1),
      rationale: z.string().min(1),
    }),
    uxStructure: z.array(z.string().min(1)).min(1),
    dataModel: z.object({
      storage: z.string().min(1),
      schema: z.array(z.string()),
      migration: z.string().nullable(),
    }),
    capabilities: z.array(z.string()),
    permissionManifest: z.array(z.string()),
    reliability: z.object({
      errorHandling: z.array(z.string()),
      testPlan: z.array(z.string().min(1)).min(1),
    }),
    build: z.object({
      packaging: z.string().min(1),
      signing: z.string().min(1),
    }),
    decisionLog: z.array(archDecision).min(1),
    openConfirmations: z.array(confirmationRecord),
    research: z.array(researchFinding),
    experiments: z.array(experiment),
    loggingPlan: z.array(logEntry).min(1),
  })
  .superRefine((spec, ctx) => {
    // 1) every engineering phase must have a decision atom
    const phases = new Set(spec.decisionLog.map((d) => d.phase));
    for (const p of archPhase.options) {
      if (!phases.has(p)) {
        ctx.addIssue({ code: 'custom', message: `decisionLog is missing a decision for phase: ${p}` });
      }
    }
    // 2) evidence refs must resolve, and no decision may be driven by a refuted experiment
    const expById = new Map(spec.experiments.map((e) => [e.id, e]));
    const resIds = new Set(spec.research.map((r) => r.id));
    for (const d of spec.decisionLog) {
      for (const ev of d.evidence) {
        if (ev.kind === 'experiment') {
          const e = expById.get(ev.ref);
          if (!e) {
            ctx.addIssue({ code: 'custom', message: `decision (${d.phase}) cites unknown experiment: ${ev.ref}` });
          } else if (e.verdict === 'refuted') {
            ctx.addIssue({ code: 'custom', message: `decision (${d.phase}) is driven by a refuted experiment: ${ev.ref}` });
          }
        } else if (!resIds.has(ev.ref)) {
          ctx.addIssue({ code: 'custom', message: `decision (${d.phase}) cites unknown research: ${ev.ref}` });
        }
      }
    }
  });
export type ArchSpec = z.infer<typeof archSpecSchema>;

export function parseArchSpec(input: unknown): ArchSpec {
  return archSpecSchema.parse(input);
}
