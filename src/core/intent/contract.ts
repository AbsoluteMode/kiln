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
