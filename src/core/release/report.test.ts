import { describe, it, expect } from 'vitest';
import { parseReleaseReport } from './report';

function validRelease(): any {
  return {
    schemaVersion: '1.0',
    releaseRevision: 1,
    releaseId: 'REL-1',
    status: 'audit_passed',
    sourceSpec: { schemaVersion: '1.0', specRevision: 1, contentDigest: null },
    sourceArch: { schemaVersion: '1.0', archRevision: 1, contentDigest: null },
    sourceDev: { schemaVersion: '1.0', devRevision: 1, contentDigest: null, artifactManifestDigest: null },
    releaseContext: {
      releaseMode: 'audit_only',
      maximumExternalAction: 'none',
      authorizedChannelIds: ['CH-1'],
      authorizedArtifactIds: ['ART-1'],
      version: '0.1.0',
      buildNumber: '1',
    },
    releaseIdentity: { applicationName: 'FileRenamer', bundleIdentifier: 'com.kiln.renamer', version: '0.1.0', buildNumber: '1' },
    selectedCandidates: [
      { artifactId: 'ART-1', sha256: 'sha256:aaaa', size: 1024, bundleIdentifier: 'com.kiln.renamer', applicationVersion: '0.1.0', buildNumber: '1' },
    ],
    channels: [{ id: 'CH-1', type: 'direct_download', required: true, state: 'pending', candidateArtifactId: 'ART-1' }],
    openReleaseAuthorizations: [],
    intentIssues: [],
    architectureIssues: [],
    devIssues: [],
    ownerDeclarationIssues: [],
    environmentIssues: [],
    channelIssues: [],
    evidenceIndex: [],
    changeLog: [],
  };
}

describe('kiln-release v1', () => {
  it('accepts a valid audit_only release', () => {
    const r = parseReleaseReport(validRelease());
    expect(r.status).toBe('audit_passed');
    expect(r.channels[0].state).toBe('pending');
  });

  it('rejects released when a required channel is not available_verified', () => {
    const raw = validRelease();
    raw.status = 'released';
    raw.releaseContext.maximumExternalAction = 'make_available';
    expect(() => parseReleaseReport(raw)).toThrow();
  });

  it('rejects exceeding the authorization ceiling (none + uploaded channel)', () => {
    const raw = validRelease();
    raw.channels[0].state = 'uploaded_processing';
    expect(() => parseReleaseReport(raw)).toThrow();
  });

  it('rejects audit_only with a non-pending channel', () => {
    const raw = validRelease();
    raw.releaseContext.maximumExternalAction = 'submit_for_review';
    raw.channels[0].state = 'ready_for_submission';
    expect(() => parseReleaseReport(raw)).toThrow();
  });

  it('rejects a channel candidate not in selectedCandidates', () => {
    const raw = validRelease();
    raw.channels[0].candidateArtifactId = 'ART-NOPE';
    expect(() => parseReleaseReport(raw)).toThrow();
  });
});
