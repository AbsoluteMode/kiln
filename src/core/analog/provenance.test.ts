import { describe, it, expect } from 'vitest';
import { canDriveBuildSpec } from './provenance';
import { AnalogClaim } from '../intent/contract';

const claim = (over: Partial<AnalogClaim>): AnalogClaim => ({
  claim: 'syncs to cloud',
  source: '',
  classification: 'common_pattern',
  confidence: 'medium',
  criticality: 'low',
  affectsPermissionsOrData: false,
  ...over,
});

describe('canDriveBuildSpec', () => {
  it('allows a claim that touches neither permissions nor data, regardless of citation', () => {
    expect(canDriveBuildSpec(claim({ source: '' }))).toBe(true);
  });

  it('blocks an uncited high-criticality permissions/data claim', () => {
    expect(
      canDriveBuildSpec(
        claim({ source: '', criticality: 'high', affectsPermissionsOrData: true }),
      ),
    ).toBe(false);
  });

  it('blocks a cited but low-confidence permissions/data claim', () => {
    expect(
      canDriveBuildSpec(
        claim({
          source: 'https://example.com',
          confidence: 'low',
          criticality: 'high',
          affectsPermissionsOrData: true,
        }),
      ),
    ).toBe(false);
  });

  it('blocks a medium-criticality, medium-confidence permissions/data claim (any data claim needs high confidence)', () => {
    expect(
      canDriveBuildSpec(
        claim({
          source: 'https://example.com',
          confidence: 'medium',
          criticality: 'medium',
          affectsPermissionsOrData: true,
        }),
      ),
    ).toBe(false);
  });

  it('allows a cited high-confidence permissions/data claim', () => {
    expect(
      canDriveBuildSpec(
        claim({
          source: 'https://example.com',
          confidence: 'high',
          criticality: 'high',
          affectsPermissionsOrData: true,
        }),
      ),
    ).toBe(true);
  });
});
