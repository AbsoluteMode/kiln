import { describe, it, expect } from 'vitest';
import { canDriveBaseline } from './provenance';
import { AnalogClaim, Source } from '../intent/contract';

const claim = (over: Partial<AnalogClaim>): AnalogClaim => ({
  id: 'C1',
  claim: 'shows a live preview',
  classification: 'common_pattern',
  analogFit: 'high',
  supportCount: 2,
  evidenceRefs: [],
  confidence: 'medium',
  criticality: 'low',
  ...over,
});

describe('canDriveBaseline (evidence policy)', () => {
  it('lets a platform requirement drive the baseline regardless of analog support', () => {
    expect(canDriveBaseline(claim({ classification: 'platform_requirement', supportCount: 0 }), [])).toBe(true);
  });

  it('lets a user-statement-backed claim drive the baseline', () => {
    const sources: Source[] = [{ id: 'S1', type: 'user_statement', title: 'the user asked for it', supports: [] }];
    expect(canDriveBaseline(claim({ supportCount: 0, evidenceRefs: ['S1'] }), sources)).toBe(true);
  });

  it('requires >= 2 not-low-fit analogs for a common pattern', () => {
    expect(canDriveBaseline(claim({ supportCount: 1 }), [])).toBe(false);
    expect(canDriveBaseline(claim({ supportCount: 2 }), [])).toBe(true);
  });

  it('blocks a single-analog common pattern (no corroboration)', () => {
    expect(canDriveBaseline(claim({ supportCount: 1, analogFit: 'high' }), [])).toBe(false);
  });

  it('never lets an anti-pattern drive the baseline, however common', () => {
    expect(canDriveBaseline(claim({ classification: 'anti_pattern', supportCount: 5 }), [])).toBe(false);
  });

  it('rejects low-fit analogs even when numerous', () => {
    expect(canDriveBaseline(claim({ analogFit: 'low', supportCount: 5 }), [])).toBe(false);
  });
});
