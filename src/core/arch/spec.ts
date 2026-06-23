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

export const archDecision = z
  .object({
    phase: archPhase,
    options: z.array(z.string().min(1)).min(1),
    selectionCriteria: z.string().min(1),
    chosen: z.string().min(1),
    rationale: z.string().min(1),
    tier: archTier,
    tracesTo: z.string().min(1),
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

export const archSpecSchema = z.object({
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
});
export type ArchSpec = z.infer<typeof archSpecSchema>;

export function parseArchSpec(input: unknown): ArchSpec {
  return archSpecSchema.parse(input);
}
