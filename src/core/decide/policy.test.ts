import { describe, it, expect } from 'vitest';
import { resolveDecision, Decision } from './policy';

const base: Omit<Decision, 'domain'> = {
  id: 'd1',
  recommendation: 'use SQLite',
  rationale: 'standard local store',
};

describe('resolveDecision', () => {
  it('auto-applies low-risk decisions', () => {
    const r = resolveDecision({ ...base, domain: 'commodity_stack' });
    expect(r.tier).toBe('auto');
    expect(r.applied).toBe(true);
    expect(r.needsConfirmation).toBe(false);
  });

  it('holds high-risk decisions for confirmation', () => {
    const r = resolveDecision({ ...base, domain: 'permissions' });
    expect(r.tier).toBe('needs_confirmation');
    expect(r.applied).toBe(false);
    expect(r.needsConfirmation).toBe(true);
  });
});
