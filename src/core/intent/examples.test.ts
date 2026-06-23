import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseIntentContract, IntentContract } from './contract';
import { canDriveBaseline } from '../analog/provenance';

const NAMES = ['breathing-timer', 'file-renamer'] as const;

function loadSpec(name: string): IntentContract {
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), 'docs/examples', `${name}.kiln-spec.json`), 'utf8'),
  );
  return parseIntentContract(raw);
}

describe('kiln:start example specs', () => {
  it('both examples validate as ready contracts', () => {
    for (const name of NAMES) {
      expect(loadSpec(name).status).toBe('ready');
    }
  });

  it('every MUST requirement is covered by an acceptance test', () => {
    for (const name of NAMES) {
      const c = loadSpec(name);
      const covered = new Set(c.acceptanceTests.flatMap((t) => t.covers));
      const musts = [...c.requirements.baseline, ...c.requirements.customDelta].filter((r) => r.priority === 'must');
      for (const r of musts) {
        expect(covered.has(r.id)).toBe(true);
      }
    }
  });

  it('no ready contract carries an unconfirmed capability', () => {
    for (const name of NAMES) {
      const c = loadSpec(name);
      for (const cap of c.capabilityNeeds) {
        expect(cap.confirmationStatus).not.toBe('needs_confirmation');
      }
    }
  });

  it('every capability need maps to a purpose and a user benefit', () => {
    for (const name of NAMES) {
      const c = loadSpec(name);
      for (const cap of c.capabilityNeeds) {
        expect(cap.purpose.length).toBeGreaterThan(0);
        expect(cap.userBenefit.length).toBeGreaterThan(0);
      }
    }
  });

  it('baseline-driving analog claims pass the evidence policy', () => {
    for (const name of NAMES) {
      const c = loadSpec(name);
      for (const claim of c.analogClaims) {
        // every common-pattern claim used in these examples is corroborated enough to drive a baseline
        expect(canDriveBaseline(claim, c.sources)).toBe(true);
      }
    }
  });

  it('no data leaves the machine by default (all flows local)', () => {
    for (const name of NAMES) {
      const c = loadSpec(name);
      for (const f of c.dataHandlingIntent.dataFlows) {
        expect(f.locality).toBe('local');
      }
    }
  });
});
