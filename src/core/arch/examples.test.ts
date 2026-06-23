import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArchSpec, ArchSpec } from './spec';

const NAMES = ['breathing-timer', 'file-renamer'] as const;

function loadArch(name: string): ArchSpec {
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), 'docs/examples', `${name}.kiln-arch.json`), 'utf8'),
  );
  return parseArchSpec(raw);
}

describe('kiln:arch example specs', () => {
  it('both examples validate as ready_for_build', () => {
    for (const name of NAMES) expect(loadArch(name).status).toBe('ready_for_build');
  });

  it('pins the source spec revision', () => {
    for (const name of NAMES) expect(loadArch(name).sourceSpec.specRevision).toBeGreaterThanOrEqual(1);
  });

  it('every decided decision has a chosen option among its options (no chosen+pending contradiction)', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      for (const d of a.decisionLog) {
        if (d.status === 'decided') {
          expect(d.chosenOptionId).not.toBeNull();
          expect(d.options.map((o) => o.id)).toContain(d.chosenOptionId);
        }
        if (d.status === 'pending_confirmation') {
          expect(d.chosenOptionId).toBeNull();
          expect(d.recommendedOptionId).not.toBeNull();
        }
      }
    }
  });

  it('traces decisions to stable IDs, not field-path strings', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      for (const d of a.decisionLog) {
        for (const ref of d.tracesTo) {
          expect(ref).toMatch(/^(REQ|JRN|CAP|AT)-/);
        }
      }
    }
  });

  it('every coverage row is complete when ready_for_build', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      for (const row of a.coverageMatrix) expect(row.coverage).toBe('complete');
    }
  });

  it('chooses the platform per app — different artifact types for different classes', () => {
    const b = loadArch('breathing-timer');
    const r = loadArch('file-renamer');
    expect(b.platform.artifactTypes).toContain('menu_bar_extra');
    expect(r.platform.artifactTypes).not.toContain('menu_bar_extra');
  });

  it('gives every verification record an oracle and required evidence', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      for (const v of a.reliability.verificationMatrix) {
        expect(v.oracle.length).toBeGreaterThan(0);
        expect(v.requiredEvidence.length).toBeGreaterThan(0);
      }
    }
  });

  it('decision evidence refs resolve to declared evidence items', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      const ids = new Set(a.evidence.map((e) => e.id));
      for (const d of a.decisionLog) {
        for (const ref of d.evidenceRefs) expect(ids.has(ref)).toBe(true);
      }
    }
  });

  it('keeps a clean handoff and separates environment prerequisites from confirmations', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      expect(a.openConfirmations).toEqual([]);
      expect(a.environmentPrerequisites.length).toBeGreaterThan(0);
    }
  });

  it('rejects a coverage row that references a phantom arch-internal id', () => {
    const raw = JSON.parse(
      readFileSync(resolve(process.cwd(), 'docs/examples', 'breathing-timer.kiln-arch.json'), 'utf8'),
    );
    raw.coverageMatrix[0].componentIds.push('CMP-DOES-NOT-EXIST');
    expect(() => parseArchSpec(raw)).toThrow();
  });
});
