import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseIntentContract } from '../intent/contract';
import { parseArchSpec } from '../arch/spec';
import { parseDevReport } from '../dev/report';
import {
  validateArchAgainstIntent,
  validateDevAgainstArch,
  validateDevAgainstIntent,
  validateManifestAgainstDev,
  validateReleaseAgainstDev,
  digestIntent,
  digestDev,
  digestManifest,
} from './validate';
import { parseArtifactManifest } from '../artifact/manifest';
import { parseReleaseReport } from '../release/report';

const NAMES = ['breathing-timer', 'file-renamer'] as const;

function load(name: string, ext: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'docs/examples', `${name}.${ext}`), 'utf8'));
}
const intentOf = (n: string) => parseIntentContract(load(n, 'kiln-spec.json'));
const archOf = (n: string) => parseArchSpec(load(n, 'kiln-arch.json'));
const devOf = (n: string) => parseDevReport(load(n, 'kiln-dev.json'));

describe('cross-stage seam: arch ↔ intent', () => {
  it('both example architectures satisfy the seam against their intent', () => {
    for (const name of NAMES) {
      expect(validateArchAgainstIntent(archOf(name), intentOf(name))).toEqual([]);
    }
  });

  it('flags a decision that traces to a non-existent intent id', () => {
    const arch = archOf('breathing-timer');
    arch.decisionLog[0].tracesTo = ['REQ-999'];
    const v = validateArchAgainstIntent(arch, intentOf('breathing-timer'));
    expect(v.some((x) => x.code === 'unresolved_traces_to')).toBe(true);
  });

  it('flags a MUST requirement with no complete coverage row', () => {
    const arch = archOf('breathing-timer');
    arch.coverageMatrix = arch.coverageMatrix.filter((r) => r.requirementId !== 'REQ-001');
    const v = validateArchAgainstIntent(arch, intentOf('breathing-timer'));
    expect(v.some((x) => x.code === 'must_not_covered')).toBe(true);
  });

  it('flags an acceptance test with no verification record', () => {
    const arch = archOf('breathing-timer');
    arch.reliability.verificationMatrix = arch.reliability.verificationMatrix.filter(
      (r) => r.acceptanceTestId !== 'AT-003',
    );
    const v = validateArchAgainstIntent(arch, intentOf('breathing-timer'));
    expect(v.some((x) => x.code === 'acceptance_test_unverified')).toBe(true);
  });

  it('flags a capability that exceeds a confirmed capability need (least privilege)', () => {
    const intent = intentOf('breathing-timer');
    intent.capabilityNeeds[0].confirmationStatus = 'needs_confirmation';
    const v = validateArchAgainstIntent(archOf('breathing-timer'), intent);
    expect(v.some((x) => x.code === 'capability_not_confirmed')).toBe(true);
  });

  it('flags a hollow source pin on a ready_for_build architecture', () => {
    const arch = archOf('breathing-timer');
    arch.sourceSpec.contentDigest = null;
    const v = validateArchAgainstIntent(arch, intentOf('breathing-timer'));
    expect(v.some((x) => x.code === 'missing_digest')).toBe(true);
  });

  it('flags a digest that does not match the consumed intent', () => {
    const arch = archOf('breathing-timer');
    arch.sourceSpec.contentDigest = 'sha256:deadbeef';
    const v = validateArchAgainstIntent(arch, intentOf('breathing-timer'));
    expect(v.some((x) => x.code === 'digest_mismatch')).toBe(true);
  });

  it('digest is stable and order-independent', () => {
    expect(digestIntent(intentOf('breathing-timer'))).toBe(digestIntent(intentOf('breathing-timer')));
  });
});

describe('cross-stage seam: dev ↔ arch', () => {
  it('both example build reports satisfy the seam against their architecture', () => {
    for (const name of NAMES) {
      expect(validateDevAgainstArch(devOf(name), archOf(name))).toEqual([]);
    }
  });

  it('flags an implementation unit targeting an unknown component', () => {
    const dev = devOf('breathing-timer');
    dev.implementationUnits[0].componentId = 'CMP-NOPE';
    const v = validateDevAgainstArch(dev, archOf('breathing-timer'));
    expect(v.some((x) => x.code === 'unresolved_component')).toBe(true);
  });

  it('flags an unimplemented observability mechanism', () => {
    const dev = devOf('breathing-timer');
    dev.loggingImplemented = [];
    const v = validateDevAgainstArch(dev, archOf('breathing-timer'));
    expect(v.some((x) => x.code === 'observability_not_implemented')).toBe(true);
  });

  it('flags an architecture pin that does not match', () => {
    const dev = devOf('breathing-timer');
    dev.sourceArch.contentDigest = 'sha256:deadbeef';
    const v = validateDevAgainstArch(dev, archOf('breathing-timer'));
    expect(v.some((x) => x.code === 'arch_digest_mismatch')).toBe(true);
  });

  it('flags a ready_for_release build that skipped an architecture verification', () => {
    const dev = devOf('breathing-timer');
    dev.verificationResults = dev.verificationResults.filter((v) => v.verificationId !== 'VER-003');
    const v = validateDevAgainstArch(dev, archOf('breathing-timer'));
    expect(v.some((x) => x.code === 'verification_unrun')).toBe(true);
  });
});

describe('cross-stage seam: dev ↔ intent', () => {
  it('both example build reports trace to their intent', () => {
    for (const name of NAMES) {
      expect(validateDevAgainstIntent(devOf(name), intentOf(name))).toEqual([]);
    }
  });

  it('flags an implementation unit tracing to an unknown intent id', () => {
    const dev = devOf('breathing-timer');
    dev.implementationUnits[0].tracesTo = ['REQ-999'];
    const v = validateDevAgainstIntent(dev, intentOf('breathing-timer'));
    expect(v.some((x) => x.code === 'unresolved_traces_to')).toBe(true);
  });

  it('flags a MUST requirement that no implementation unit implements', () => {
    const dev = devOf('breathing-timer');
    for (const u of dev.implementationUnits) u.tracesTo = u.tracesTo.filter((r) => r !== 'REQ-001');
    const v = validateDevAgainstIntent(dev, intentOf('breathing-timer'));
    expect(v.some((x) => x.code === 'must_not_implemented')).toBe(true);
  });
});

describe('cross-stage seam: release ↔ dev ↔ manifest', () => {
  function manifestFor(name: 'file-renamer') {
    const dev = devOf(name);
    return parseArtifactManifest({
      schemaVersion: '1.0',
      manifestRevision: 1,
      sourceSpec: { schemaVersion: '1.0', specRevision: dev.sourceSpec.specRevision, contentDigest: dev.sourceSpec.contentDigest },
      sourceArch: { schemaVersion: '1.0', archRevision: dev.sourceArch.archRevision, contentDigest: dev.sourceArch.contentDigest },
      sourceDev: { schemaVersion: '1.0', devRevision: dev.devRevision, contentDigest: digestDev(dev) },
      artifacts: [{ id: 'ART-1', type: 'app', path: 'build/FileRenamer.app', sha256: 'sha256:aaaa', size: 1024, bundleIdentifier: 'com.kiln.renamer', applicationVersion: '0.1.0', buildNumber: '1', binaryUUIDs: [], dSYMRefs: [], signingStatus: 'adhoc', notarizationStatus: 'none' }],
      evidenceIndex: [],
      changeLog: [],
    });
  }
  function releaseFor(name: 'file-renamer') {
    const dev = devOf(name);
    const manifest = manifestFor(name);
    return parseReleaseReport({
      schemaVersion: '1.0',
      releaseRevision: 1,
      releaseId: 'REL-1',
      status: 'audit_passed',
      sourceSpec: { schemaVersion: '1.0', specRevision: dev.sourceSpec.specRevision, contentDigest: dev.sourceSpec.contentDigest },
      sourceArch: { schemaVersion: '1.0', archRevision: dev.sourceArch.archRevision, contentDigest: dev.sourceArch.contentDigest },
      sourceDev: { schemaVersion: '1.0', devRevision: dev.devRevision, contentDigest: digestDev(dev), artifactManifestDigest: digestManifest(manifest) },
      releaseContext: { releaseMode: 'audit_only', maximumExternalAction: 'none', authorizedChannelIds: ['CH-1'], authorizedArtifactIds: ['ART-1'], version: '0.1.0', buildNumber: '1' },
      releaseIdentity: { applicationName: 'FileRenamer', bundleIdentifier: 'com.kiln.renamer', version: '0.1.0', buildNumber: '1' },
      selectedCandidates: [{ artifactId: 'ART-1', sha256: 'sha256:aaaa', size: 1024, bundleIdentifier: 'com.kiln.renamer', applicationVersion: '0.1.0', buildNumber: '1' }],
      channels: [{ id: 'CH-1', type: 'direct_download', required: true, state: 'pending', candidateArtifactId: 'ART-1' }],
      openReleaseAuthorizations: [], intentIssues: [], architectureIssues: [], devIssues: [], ownerDeclarationIssues: [], environmentIssues: [], channelIssues: [],
      evidenceIndex: [],
      changeLog: [],
    });
  }

  it('manifest pins the dev it was built from', () => {
    expect(validateManifestAgainstDev(manifestFor('file-renamer'), devOf('file-renamer'))).toEqual([]);
  });
  it('release pins dev + manifest, candidate matches', () => {
    expect(validateReleaseAgainstDev(releaseFor('file-renamer'), devOf('file-renamer'), manifestFor('file-renamer'))).toEqual([]);
  });
  it('flags a manifest whose dev digest does not match', () => {
    const m = manifestFor('file-renamer');
    m.sourceDev.contentDigest = 'sha256:deadbeef';
    expect(validateManifestAgainstDev(m, devOf('file-renamer')).some((v) => v.code === 'dev_digest_mismatch')).toBe(true);
  });
  it('flags a selected candidate whose sha256 disagrees with the manifest', () => {
    const r = releaseFor('file-renamer');
    r.selectedCandidates[0].sha256 = 'sha256:tampered';
    expect(validateReleaseAgainstDev(r, devOf('file-renamer'), manifestFor('file-renamer')).some((v) => v.code === 'candidate_mismatch')).toBe(true);
  });
  it('flags release when dev is not ready_for_release', () => {
    const dev = devOf('file-renamer');
    (dev as any).status = 'implementation_failed';
    expect(validateReleaseAgainstDev(releaseFor('file-renamer'), dev, manifestFor('file-renamer')).some((v) => v.code === 'dev_not_ready')).toBe(true);
  });
  it('flags a candidate outside the authorized artifact ids', () => {
    const r = releaseFor('file-renamer');
    r.releaseContext.authorizedArtifactIds = [];
    expect(validateReleaseAgainstDev(r, devOf('file-renamer'), manifestFor('file-renamer')).some((v) => v.code === 'unauthorized_artifact')).toBe(true);
  });
});
