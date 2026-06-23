import { AnalogClaim, Source } from '../intent/contract';

/**
 * Review #3: analogs are EVIDENCE of common expectations, not standards.
 * A claim may drive a baseline requirement only if it is:
 *  - a platform requirement, OR
 *  - backed by an explicit user statement, OR
 *  - corroborated by >= 2 independent, not-low-fit analogs.
 * An anti-pattern never drives the baseline. One popular product's feature
 * is not, by itself, a norm.
 */
export function canDriveBaseline(claim: AnalogClaim, sources: Source[]): boolean {
  if (claim.classification === 'anti_pattern') return false;
  if (claim.classification === 'platform_requirement') return true;
  const backedByUser = claim.evidenceRefs.some((ref) =>
    sources.some((s) => s.id === ref && s.type === 'user_statement'),
  );
  if (backedByUser) return true;
  return claim.supportCount >= 2 && claim.analogFit !== 'low';
}
