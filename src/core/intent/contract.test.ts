import { describe, it, expect } from 'vitest';
import { parseIntentContract } from './contract';

/** A minimal valid draft contract; tests override fields to exercise the gates. */
function minimal(): any {
  return {
    schemaVersion: '1.0',
    specRevision: 1,
    status: 'draft',
    intent: {
      oneSentenceIntent: 'x',
      targetUsers: ['u'],
      problem: 'p',
      desiredOutcome: 'o',
      usageContexts: [],
      explicitConstraints: [],
      nonGoals: [],
    },
    classification: { jobClass: 'j', interactionSurfaces: ['window'], lifecycle: 'on_demand', interactionModel: 'single_shot' },
    coreJourneys: [{ id: 'J1', actor: 'a', trigger: 't', preconditions: [], steps: ['s'], expectedOutcome: 'o', failureRecovery: 'r' }],
    scope: { must: [], should: [], wont: [] },
    sources: [],
    analogClaims: [],
    requirements: { baseline: [], customDelta: [] },
    qualityAttributes: [],
    dataHandlingIntent: { dataFlows: [], forbiddenPractices: [] },
    capabilityNeeds: [],
    deliveryContext: { audience: 'personal', distributionConstraint: 'build_decides', compatibilityConstraints: [], offlineExpectation: 'required' },
    macBaseline: [],
    successCriteria: ['s'],
    acceptanceTests: [{ id: 'AT1', covers: ['REQ1'], given: 'g', when: 'w', then: ['t'], requiredEvidence: ['screenshot'] }],
    unknowns: [],
    unresolvedRisks: [],
    decisionLog: [],
    handoff: { buildMayDecide: [], buildMustPreserve: [], stopConditions: [], verificationEvidenceRequired: [] },
    changeLog: [],
  };
}

describe('parseIntentContract', () => {
  it('accepts a valid draft contract', () => {
    expect(parseIntentContract(minimal()).status).toBe('draft');
  });

  it('rejects an unknown top-level field (strict)', () => {
    expect(() => parseIntentContract({ ...minimal(), bogus: 1 })).toThrow();
  });

  it('rejects an unknown analog-claim classification', () => {
    const c = minimal();
    c.analogClaims = [{ id: 'C1', claim: 'x', classification: 'guess', analogFit: 'high', supportCount: 2, evidenceRefs: [], confidence: 'high', criticality: 'low' }];
    expect(() => parseIntentContract(c)).toThrow();
  });

  it('ready gate: blocks ready when a MUST requirement has no acceptance test', () => {
    const c = minimal();
    c.status = 'ready';
    c.requirements.baseline = [{ id: 'REQ9', statement: 'uncovered', priority: 'must', evidenceRefs: [] }];
    expect(() => parseIntentContract(c)).toThrow();
  });

  it('ready gate: blocks ready when a capability still needs confirmation', () => {
    const c = minimal();
    c.status = 'ready';
    c.capabilityNeeds = [{ id: 'CAP9', capability: 'mic', minimalScope: 's', purpose: 'p', userBenefit: 'b', confirmationStatus: 'needs_confirmation', evidenceRefs: [] }];
    expect(() => parseIntentContract(c)).toThrow();
  });

  it('ready gate: blocks ready when an unknown is still blocking', () => {
    const c = minimal();
    c.status = 'ready';
    c.unknowns = [{ id: 'UNK9', description: 'x', blocking: true, safeDefault: 'd', resolutionOwner: 'user', discoveryTrigger: null }];
    expect(() => parseIntentContract(c)).toThrow();
  });

  it('ready gate: allows ready when MUST is covered and nothing is pending', () => {
    const c = minimal();
    c.status = 'ready';
    c.requirements.baseline = [{ id: 'REQ1', statement: 'covered by AT1', priority: 'must', evidenceRefs: [] }];
    expect(parseIntentContract(c).status).toBe('ready');
  });

  it('flags a cloud data flow that lists no third parties', () => {
    const c = minimal();
    c.dataHandlingIntent.dataFlows = [{ dataCategory: 'audio', source: 'mic', purpose: 'x', sensitivity: 'high', destination: 'api', locality: 'cloud', retention: 'n', deletion: 'n', thirdParties: [] }];
    expect(() => parseIntentContract(c)).toThrow();
  });
});
