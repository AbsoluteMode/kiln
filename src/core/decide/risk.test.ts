import { describe, it, expect } from 'vitest';
import { classifyRisk } from './risk';

describe('classifyRisk', () => {
  it('flags permissions as needs_confirmation', () => {
    expect(classifyRisk('permissions')).toBe('needs_confirmation');
  });

  it('flags signing/release as needs_confirmation', () => {
    expect(classifyRisk('signing_release')).toBe('needs_confirmation');
  });

  it('auto-resolves UX defaults', () => {
    expect(classifyRisk('ux_default')).toBe('auto');
  });

  it('auto-resolves commodity stack choices', () => {
    expect(classifyRisk('commodity_stack')).toBe('auto');
  });
});
