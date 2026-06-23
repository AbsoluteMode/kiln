export type RiskTier = 'auto' | 'needs_confirmation';

export type DecisionDomain =
  | 'permissions'
  | 'data_retention'
  | 'network_service'
  | 'signing_release'
  | 'destructive_action'
  | 'ux_default'
  | 'commodity_stack';

const HIGH_RISK_DOMAINS: ReadonlySet<DecisionDomain> = new Set([
  'permissions',
  'data_retention',
  'network_service',
  'signing_release',
  'destructive_action',
]);

export function classifyRisk(domain: DecisionDomain): RiskTier {
  return HIGH_RISK_DOMAINS.has(domain) ? 'needs_confirmation' : 'auto';
}
