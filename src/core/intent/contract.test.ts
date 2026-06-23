import { describe, it, expect } from 'vitest';
import { parseIntentContract } from './contract';

const valid = {
  appClass: 'menu-bar timer',
  analogClaims: [
    {
      claim: 'plays a completion sound',
      source: 'https://example.com/box-breath',
      classification: 'baseline',
      confidence: 'high',
      criticality: 'low',
      affectsPermissionsOrData: false,
    },
  ],
  baselineRequirements: ['remembers last settings'],
  customDelta: ['4-7-8 breathing pattern'],
  successCriteria: ['user can start a session in one click'],
  acceptanceTests: ['starting a session shows a countdown'],
  dataFlows: ['settings stored locally'],
  permissions: ['notifications'],
  externalServices: [],
  localStorage: ['user settings'],
  unknowns: [],
  mustAskIfDiscovered: ['any network call'],
  decisionLog: [],
  unresolvedRisks: [],
};

describe('parseIntentContract', () => {
  it('accepts a valid contract', () => {
    expect(parseIntentContract(valid).appClass).toBe('menu-bar timer');
  });

  it('rejects an unknown classification', () => {
    const bad = {
      ...valid,
      analogClaims: [{ ...valid.analogClaims[0], classification: 'guess' }],
    };
    expect(() => parseIntentContract(bad)).toThrow();
  });

  it('rejects a missing required field', () => {
    const { appClass, ...rest } = valid;
    expect(() => parseIntentContract(rest)).toThrow();
  });
});
