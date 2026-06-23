import { describe, it, expect } from 'vitest';
import { shouldAsk } from './gate';

describe('shouldAsk (governing principle)', () => {
  it('asks when uncertainty is real AND downstream-critical', () => {
    expect(shouldAsk({ inferable: false, affectsIrreversible: true })).toBe(true);
  });

  it('stays silent when it can be inferred', () => {
    expect(shouldAsk({ inferable: true, affectsIrreversible: true })).toBe(false);
  });

  it('stays silent when it does not affect anything irreversible', () => {
    expect(shouldAsk({ inferable: false, affectsIrreversible: false })).toBe(false);
  });
});
