import { describe, it, expect } from 'vitest';
import { classifyRisk } from './risk';

describe('classifyRisk', () => {
  it('flags permissions as confirm', () => {
    expect(classifyRisk('permissions')).toBe('confirm');
  });

  it('flags signing/release as confirm', () => {
    expect(classifyRisk('signing_release')).toBe('confirm');
  });

  it('auto-resolves UX defaults', () => {
    expect(classifyRisk('ux_default')).toBe('auto');
  });

  it('auto-resolves commodity stack choices', () => {
    expect(classifyRisk('commodity_stack')).toBe('auto');
  });
});
