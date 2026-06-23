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
