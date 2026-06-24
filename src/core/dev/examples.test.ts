import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDevReport, DevReport } from './report';

const NAMES = ['breathing-timer', 'file-renamer'] as const;

function loadRaw(name: string): any {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'docs/examples', `${name}.kiln-dev.json`), 'utf8'),
  );
}
function loadDev(name: string): DevReport {
  return parseDevReport(loadRaw(name));
}

describe('kiln:dev v2 build reports', () => {
  it('both examples validate as ready_for_release', () => {
    for (const name of NAMES) expect(loadDev(name).status).toBe('ready_for_release');
  });

  it('pins both the intent and the architecture by digest', () => {
    for (const name of NAMES) {
      const d = loadDev(name);
      expect(d.sourceSpec.contentDigest).toMatch(/^sha256:/);
      expect(d.sourceArch.contentDigest).toMatch(/^sha256:/);
    }
  });

  it('every implementation unit is implemented and traced', () => {
    for (const name of NAMES) {
      for (const u of loadDev(name).implementationUnits) {
        expect(u.status).toBe('implemented');
        expect(u.tracesTo.length).toBeGreaterThan(0);
      }
    }
  });

  it('records a result for every example verification', () => {
    for (const name of NAMES) {
      const d = loadDev(name);
      expect(d.verificationResults.length).toBeGreaterThanOrEqual(1);
      for (const v of d.verificationResults) expect(v.result).toBe('pass');
    }
  });

  it('rejects ready_for_release with a partially implemented unit', () => {
    const raw = loadRaw('breathing-timer');
    raw.implementationUnits[0].status = 'partial';
    expect(() => parseDevReport(raw)).toThrow();
  });

  it('rejects ready_for_release with an open defect', () => {
    const raw = loadRaw('breathing-timer');
    raw.defects.push({ id: 'BUG-001', severity: 'high', status: 'open', summary: 'flaky cue timing' });
    expect(() => parseDevReport(raw)).toThrow();
  });

  it('rejects ready_for_release with a hollow architecture pin', () => {
    const raw = loadRaw('breathing-timer');
    raw.sourceArch.contentDigest = null;
    expect(() => parseDevReport(raw)).toThrow();
  });

  it('rejects an implementation unit with no trace (no dangling code)', () => {
    const raw = loadRaw('breathing-timer');
    raw.implementationUnits[0].tracesTo = [];
    expect(() => parseDevReport(raw)).toThrow();
  });

  it('rejects ready_for_release with an unresolved external-blocker defect', () => {
    const raw = loadRaw('breathing-timer');
    raw.defects.push({ id: 'BUG-002', severity: 'medium', status: 'external_blocker', summary: 'blocked on upstream API' });
    expect(() => parseDevReport(raw)).toThrow();
  });
});
