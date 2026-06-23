import { classifyRisk, DecisionDomain, RiskTier } from './risk';

export interface Decision {
  id: string;
  domain: DecisionDomain;
  recommendation: string;
  rationale: string;
}

export interface Resolution {
  decisionId: string;
  tier: RiskTier;
  applied: boolean;
  needsConfirmation: boolean;
}

export function resolveDecision(d: Decision): Resolution {
  const tier = classifyRisk(d.domain);
  return {
    decisionId: d.id,
    tier,
    applied: tier === 'auto',
    needsConfirmation: tier === 'confirm',
  };
}
