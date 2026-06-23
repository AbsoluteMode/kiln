import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseIntentContract, IntentContract } from './contract';
import { canDriveBuildSpec } from '../analog/provenance';

function loadSpec(name: string): IntentContract {
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), 'docs/examples', `${name}.kiln-spec.json`), 'utf8'),
  );
  return parseIntentContract(raw);
}

describe('kiln:start example specs', () => {
  it('breathing-timer validates as an intent contract', () => {
    const c = loadSpec('breathing-timer');
    expect(c.appClass).toContain('breathing');
    expect(c.analogClaims.length).toBeGreaterThan(0);
    expect(c.acceptanceTests.length).toBeGreaterThan(0);
  });

  it('file-renamer validates as an intent contract', () => {
    const c = loadSpec('file-renamer');
    expect(c.appClass).toContain('renamer');
    expect(c.acceptanceTests.length).toBeGreaterThan(0);
  });

  it('provenance gate blocks a high-risk, medium-confidence claim from driving the spec', () => {
    const c = loadSpec('breathing-timer');
    const health = c.analogClaims.find((x) => x.claim.includes('Apple Health'));
    expect(health).toBeDefined();
    // high criticality + touches data, but only medium confidence → must NOT drive the build spec
    expect(canDriveBuildSpec(health!)).toBe(false);
  });

  it('provenance gate lets a low-risk cited claim drive the spec', () => {
    const c = loadSpec('breathing-timer');
    const menubar = c.analogClaims.find((x) => x.claim.includes('menu bar'));
    expect(menubar).toBeDefined();
    expect(canDriveBuildSpec(menubar!)).toBe(true);
  });

  it('keeps provenance-rejected high-risk claims out of permissions (recorded as risks instead)', () => {
    const c = loadSpec('breathing-timer');
    const health = c.analogClaims.find((x) => x.claim.includes('Apple Health'))!;
    expect(canDriveBuildSpec(health)).toBe(false);
    const permissionsBlob = c.permissions.join(' ').toLowerCase();
    const safetyBlob = [...c.unknowns, ...c.unresolvedRisks].join(' ').toLowerCase();
    expect(permissionsBlob).not.toContain('apple health');
    expect(safetyBlob).toContain('apple health');
  });
});
