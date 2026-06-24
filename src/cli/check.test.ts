import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { checkArtifacts } from './check';

const ex = (f: string) => resolve(process.cwd(), 'docs/examples', f);

describe('kiln check (executable seam gate core)', () => {
  it('passes for a consistent intent + arch + dev set', () => {
    const r = checkArtifacts(
      ex('breathing-timer.kiln-spec.json'),
      ex('breathing-timer.kiln-arch.json'),
      ex('breathing-timer.kiln-dev.json'),
    );
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('passes with only intent + arch (dev is optional)', () => {
    const r = checkArtifacts(ex('file-renamer.kiln-spec.json'), ex('file-renamer.kiln-arch.json'));
    expect(r.ok).toBe(true);
  });

  it('fails when an arch is checked against the wrong intent (digest pin)', () => {
    const r = checkArtifacts(ex('breathing-timer.kiln-spec.json'), ex('file-renamer.kiln-arch.json'));
    expect(r.ok).toBe(false);
    expect(r.problems.some((p) => p.code === 'digest_mismatch')).toBe(true);
  });

  it('reports a parse error for a missing file instead of throwing', () => {
    const r = checkArtifacts(ex('nope.kiln-spec.json'), ex('breathing-timer.kiln-arch.json'));
    expect(r.ok).toBe(false);
    expect(r.problems.some((p) => p.code === 'parse_error')).toBe(true);
  });

  it('passes the full release chain (spec→arch→dev→manifest→release)', () => {
    const r = checkArtifacts(
      ex('file-renamer.kiln-spec.json'),
      ex('file-renamer.kiln-arch.json'),
      ex('file-renamer.kiln-dev.json'),
      ex('file-renamer.kiln-artifact-manifest.json'),
      ex('file-renamer.kiln-release.json'),
    );
    expect(r.problems).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('fails a release checked without its manifest', () => {
    const r = checkArtifacts(
      ex('file-renamer.kiln-spec.json'),
      ex('file-renamer.kiln-arch.json'),
      ex('file-renamer.kiln-dev.json'),
      undefined,
      ex('file-renamer.kiln-release.json'),
    );
    expect(r.ok).toBe(false);
    expect(r.problems.some((p) => p.code === 'missing_inputs')).toBe(true);
  });
});
