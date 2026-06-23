import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseDevReport, DevReport } from './report';
import { parseArchSpec } from '../arch/spec';

const NAMES = ['breathing-timer', 'file-renamer'] as const;

function loadRaw(name: string, ext: string): unknown {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), 'docs/examples', `${name}.${ext}`), 'utf8'),
  );
}
function loadDev(name: string): DevReport {
  return parseDevReport(loadRaw(name, 'kiln-dev.json'));
}

describe('kiln:dev build reports', () => {
  it('breathing-timer dev report validates', () => {
    const d = loadDev('breathing-timer');
    expect(d.tests.framework).toBe('XCTest');
    expect(d.tracesTo).toContain('kiln-arch');
  });

  it('file-renamer dev report validates', () => {
    const d = loadDev('file-renamer');
    expect(d.artifacts.length).toBeGreaterThan(0);
  });

  it('a completed build has all tests passing and a passing review', () => {
    for (const name of NAMES) {
      const d = loadDev(name);
      expect(d.tests.written).toBeGreaterThanOrEqual(1);
      expect(d.tests.passing).toBe(d.tests.written);
      expect(d.review.verdict).toBe('pass');
    }
  });

  it('writes a test per architecture verification record', () => {
    for (const name of NAMES) {
      const arch = parseArchSpec(loadRaw(name, 'kiln-arch.json'));
      const dev = loadDev(name);
      expect(dev.tests.written).toBe(arch.reliability.verificationMatrix.length);
    }
  });

  it('implements the architecture observability plan', () => {
    for (const name of NAMES) {
      const arch = parseArchSpec(loadRaw(name, 'kiln-arch.json'));
      const dev = loadDev(name);
      for (const obs of arch.reliability.observability) {
        expect(dev.loggingImplemented).toContain(obs);
      }
    }
  });

  it('rejects a build that claims success with failing tests', () => {
    expect(() =>
      parseDevReport({
        tracesTo: 'x.kiln-arch.json',
        tests: { framework: 'XCTest', written: 3, passing: 2, files: ['T.swift'] },
        loggingImplemented: [],
        review: { reviewer: 'self', verdict: 'pass', notes: [] },
        artifacts: ['App.app'],
        openRisks: [],
      }),
    ).toThrow();
  });
});
