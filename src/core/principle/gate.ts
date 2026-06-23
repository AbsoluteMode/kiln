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
