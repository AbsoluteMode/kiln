import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArchSpec, ArchSpec, archPhase } from './spec';

const NAMES = ['breathing-timer', 'file-renamer'] as const;

function loadArch(name: string): ArchSpec {
  const raw = JSON.parse(
    readFileSync(resolve(process.cwd(), 'docs/examples', `${name}.kiln-arch.json`), 'utf8'),
  );
  return parseArchSpec(raw);
}

describe('kiln:arch example specs', () => {
  it('breathing-timer arch validates and traces to its contract', () => {
    const a = loadArch('breathing-timer');
    expect(a.stack.language).toBe('Swift');
    expect(a.tracesTo).toContain('kiln-spec');
    expect(a.decisionLog.length).toBeGreaterThan(0);
  });

  it('file-renamer arch validates', () => {
    const a = loadArch('file-renamer');
    expect(a.stack.language).toBe('Swift');
    expect(a.reliability.testPlan.length).toBeGreaterThan(0);
  });

  it('chooses the stack per app — different artifact types for different classes', () => {
    const breathing = loadArch('breathing-timer');
    const renamer = loadArch('file-renamer');
    expect(breathing.stack.artifactType).not.toBe(renamer.stack.artifactType);
    expect(breathing.stack.artifactType).toContain('menu-bar');
    expect(renamer.stack.artifactType).toContain('window');
  });

  it('keeps unconfirmed high-risk out of the permission manifest, deferring to openConfirmations', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      expect(a.permissionManifest).toEqual([]);
      expect(a.openConfirmations.length).toBeGreaterThan(0);
    }
  });

  it('every decision is honest — chosen is exactly one of the options', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      for (const d of a.decisionLog) {
        expect(d.options).toContain(d.chosen);
      }
    }
  });

  it('decisionLog covers all seven engineering phases', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      const phases = new Set(a.decisionLog.map((d) => d.phase));
      for (const p of archPhase.options) {
        expect(phases.has(p)).toBe(true);
      }
    }
  });

  it('decisions cite only resolvable, non-refuted evidence', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      const expById = new Map(a.experiments.map((e) => [e.id, e]));
      const resIds = new Set(a.research.map((r) => r.id));
      for (const d of a.decisionLog) {
        for (const ev of d.evidence) {
          if (ev.kind === 'experiment') {
            expect(expById.has(ev.ref)).toBe(true);
            expect(expById.get(ev.ref)!.verdict).not.toBe('refuted');
          } else {
            expect(resIds.has(ev.ref)).toBe(true);
          }
        }
      }
    }
  });

  it('every open confirmation is a structured, traceable record', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      for (const c of a.openConfirmations) {
        expect(c.decision.length).toBeGreaterThan(0);
        expect(c.tracesTo.length).toBeGreaterThan(0);
      }
    }
  });

  it('research findings carry sources (reverse-engineered, not invented)', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      for (const r of a.research) {
        expect(r.sources.length).toBeGreaterThan(0);
      }
    }
  });

  it('every app has a non-empty logging plan with how-logged for each event', () => {
    for (const name of NAMES) {
      const a = loadArch(name);
      expect(a.loggingPlan.length).toBeGreaterThan(0);
      for (const l of a.loggingPlan) {
        expect(l.howLogged.length).toBeGreaterThan(0);
      }
    }
  });
});
