import { AnalogClaim } from '../intent/contract';

/**
 * Spec §5.3: ANY claim that touches permissions or data must be cited and
 * high-confidence before it can drive the build spec; otherwise it must be
 * recorded as an unknown / unresolved risk, never as an accepted requirement.
 * Claims that don't touch permissions or data always pass.
 */
export function canDriveBuildSpec(claim: AnalogClaim): boolean {
  if (claim.affectsPermissionsOrData) {
    const cited = claim.source.trim().length > 0;
    return cited && claim.confidence === 'high';
  }
  return true;
}
