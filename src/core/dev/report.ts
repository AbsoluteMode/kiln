import { z } from 'zod';

/**
 * kiln-dev.json v2 — the build-stage contract.
 *
 * The dev stage implements the architecture, traces every implementation unit
 * back to real arch components and intent requirements, runs the architecture's
 * verifications, and hands a `ready_for_validation` artifact to the validate
 * stage. It does NOT absorb validate/release (notarization, signing, sanitizers,
 * artifact manifests) — those land with a real build stage. Statuses here stop at
 * `ready_for_validation`, never `ready_for_user`.
 */
export const devStatus = z.enum([
  'invalid_input',
  'blocked_on_intent',
  'blocked_on_architecture',
  'blocked_on_environment',
  'implementation_failed',
  'ready_for_validation',
]);
export type DevStatus = z.infer<typeof devStatus>;

const idList = z.array(z.string().min(1));

/** One bounded unit of implementation, traced to arch + intent. */
export const implementationUnit = z
  .object({
    id: z.string().min(1),
    componentId: z.string().min(1),
    interfaceIds: idList,
    tracesTo: idList,
    files: z.array(z.object({ path: z.string().min(1), symbols: z.array(z.string()) }).strict()),
    verificationIds: idList,
    status: z.enum(['implemented', 'partial', 'blocked']),
  })
  .strict();
export type ImplementationUnit = z.infer<typeof implementationUnit>;

export const verificationResult = z
  .object({
    verificationId: z.string().min(1),
    result: z.enum(['pass', 'fail', 'skip']),
    evidenceRefs: z.array(z.string()),
  })
  .strict();

export const devDefect = z
  .object({
    id: z.string().min(1),
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    status: z.enum(['open', 'reproduced', 'fixed', 'not_reproducible', 'external_blocker']),
    summary: z.string().min(1),
  })
  .strict();

const sourcePin = z.object({
  schemaVersion: z.string().min(1),
  contentDigest: z.string().nullable(),
});

export const devReportSchema = z
  .object({
    schemaVersion: z.string().min(1),
    devRevision: z.number().int().nonnegative(),
    status: devStatus,
    sourceSpec: sourcePin.extend({ specRevision: z.number().int().nonnegative() }).strict(),
    sourceArch: sourcePin.extend({ archRevision: z.number().int().nonnegative() }).strict(),
    codexStatus: z.enum(['off', 'consulted', 'unavailable']),
    implementationUnits: z.array(implementationUnit),
    verificationResults: z.array(verificationResult),
    loggingImplemented: z.array(z.string().min(1)),
    defects: z.array(devDefect),
    intentIssues: z.array(z.string()),
    architectureIssues: z.array(z.string()),
    environmentIssues: z.array(z.string()),
    review: z
      .object({
        reviewer: z.enum(['self', 'codex']),
        verdict: z.enum(['pass', 'issues']),
        notes: z.array(z.string()),
      })
      .strict(),
    openRisks: z.array(z.string()),
    changeLog: z.array(z.string()),
  })
  .strict()
  .superRefine((d, ctx) => {
    const seen = new Set<string>();
    for (const u of d.implementationUnits) {
      if (seen.has(u.id)) ctx.addIssue({ code: 'custom', message: `duplicate implementation unit id ${u.id}` });
      seen.add(u.id);
    }

    // The dev ready gate: ready_for_validation demands a complete, defect-free,
    // pinned, fully-verified hand-off. (Cross-stage ID/coverage checks live in the seam.)
    if (d.status === 'ready_for_validation') {
      if (d.implementationUnits.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'ready_for_validation requires at least one implementation unit' });
      }
      for (const u of d.implementationUnits) {
        if (u.status !== 'implemented') {
          ctx.addIssue({ code: 'custom', message: `ready_for_validation: implementation unit ${u.id} is ${u.status}` });
        }
      }
      for (const v of d.verificationResults) {
        if (v.result !== 'pass') {
          ctx.addIssue({ code: 'custom', message: `ready_for_validation: verification ${v.verificationId} is ${v.result}` });
        }
      }
      for (const bug of d.defects) {
        if (bug.status === 'open' || bug.status === 'reproduced') {
          ctx.addIssue({ code: 'custom', message: `ready_for_validation: defect ${bug.id} is still ${bug.status}` });
        }
      }
      if (d.intentIssues.length || d.architectureIssues.length || d.environmentIssues.length) {
        ctx.addIssue({ code: 'custom', message: 'ready_for_validation: unresolved intent/architecture/environment issues remain' });
      }
      if (d.review.verdict !== 'pass') {
        ctx.addIssue({ code: 'custom', message: 'ready_for_validation: review verdict is not pass' });
      }
      if (d.sourceSpec.contentDigest === null) {
        ctx.addIssue({ code: 'custom', message: 'ready_for_validation: sourceSpec.contentDigest must pin the intent' });
      }
      if (d.sourceArch.contentDigest === null) {
        ctx.addIssue({ code: 'custom', message: 'ready_for_validation: sourceArch.contentDigest must pin the architecture' });
      }
    }
  });
export type DevReport = z.infer<typeof devReportSchema>;

export function parseDevReport(input: unknown): DevReport {
  return devReportSchema.parse(input);
}
