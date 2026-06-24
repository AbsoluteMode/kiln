import { describe, it, expect } from 'vitest';
import { parseArtifactManifest } from './manifest';

function validManifest(): any {
  return {
    schemaVersion: '1.0',
    manifestRevision: 1,
    sourceSpec: { schemaVersion: '1.0', specRevision: 1, contentDigest: null },
    sourceArch: { schemaVersion: '1.0', archRevision: 1, contentDigest: null },
    sourceDev: { schemaVersion: '1.0', devRevision: 1, contentDigest: null },
    artifacts: [
      {
        id: 'ART-1',
        type: 'app',
        path: 'build/FileRenamer.app',
        sha256: 'sha256:aaaa',
        size: 1024,
        bundleIdentifier: 'com.kiln.renamer',
        applicationVersion: '0.1.0',
        buildNumber: '1',
        binaryUUIDs: [],
        dSYMRefs: [],
        signingStatus: 'adhoc',
        notarizationStatus: 'none',
      },
    ],
    evidenceIndex: [],
    changeLog: [],
  };
}

describe('kiln-artifact-manifest v1', () => {
  it('accepts a valid manifest', () => {
    const m = parseArtifactManifest(validManifest());
    expect(m.artifacts[0].id).toBe('ART-1');
    expect(m.artifacts[0].signingStatus).toBe('adhoc');
  });

  it('rejects duplicate artifact ids', () => {
    const raw = validManifest();
    raw.artifacts.push({ ...raw.artifacts[0] });
    expect(() => parseArtifactManifest(raw)).toThrow();
  });

  it('rejects an empty artifacts array', () => {
    const raw = validManifest();
    raw.artifacts = [];
    expect(() => parseArtifactManifest(raw)).toThrow();
  });
});
