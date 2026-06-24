# kiln:release Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the release contract (`kiln-artifact-manifest.json` + `kiln-release.json`) and enforce the candidate pin ("release ships the EXACT verified build") with the executable seam gate — schema-first, no external actions, no credentials.

**Architecture:** Two new Zod schemas in `src/core` (artifact manifest = candidate identity; release report = ladder/authorization/channels), three new seam validators (`digestDev`/`digestManifest`, `validateManifestAgainstDev`, `validateReleaseAgainstDev`), CLI `kiln check`/`digest` extended, a synthetic stable example chain, and the `commands/release.md` v1 stage prose. Mirrors the kiln:dev Slice 1 pattern.

**Tech Stack:** TypeScript, Zod 4, Vitest 4, tsx. Existing patterns in `src/core/{intent,arch,dev}` and `src/core/seam/validate.ts`.

## Global Constraints

- Source of truth = Zod in `src/core`; runtime = command markdown; executable gate = `npm run kiln -- check`.
- Slice 1 performs NO external actions (no upload/submit/publish/notarize). Modes `audit_only`/`prepare` only.
- Keep existing ID families; release owns new `ART-*` / channel ids. No `fixed` in the overall status enum.
- `status: "released"` is unreachable in Slice 1 (no real channels) — by design.
- Digest helpers reuse `sha256Canonical` already in `src/core/seam/validate.ts`.
- Synthetic example uses a fixed placeholder artifact `sha256` (real `.app` digests are build-volatile → Slice 2).
- Commit after every task. The Swift project under `examples/file-renamer/` is untouched.

---

### Task 1: Artifact-manifest schema

**Files:**
- Create: `src/core/artifact/manifest.ts`
- Test: `src/core/artifact/manifest.test.ts`

**Interfaces:**
- Produces: `parseArtifactManifest(input: unknown): ArtifactManifest`; type `ArtifactManifest` with `.artifacts: CandidateArtifact[]`, `.sourceDev/.sourceSpec/.sourceArch` pins; `CandidateArtifact` with `id,type,path,sha256,size,bundleIdentifier,applicationVersion,buildNumber,binaryUUIDs[],dSYMRefs[],signingStatus,notarizationStatus`.

- [ ] **Step 1: Write the failing test**

`src/core/artifact/manifest.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseArtifactManifest } from './manifest';

function validManifest(): any {
  return {
    schemaVersion: '1.0',
    manifestRevision: 1,
    sourceSpec: { schemaVersion: '1.0', specRevision: 1, contentDigest: null },
    sourceArch: { schemaVersion: '1.0', archRevision: 1, contentDigest: null },
    sourceDev: { schemaVersion: '1.0', devRevision: 1, contentDigest: null },
    artifacts: [{
      id: 'ART-1', type: 'app', path: 'build/FileRenamer.app',
      sha256: 'sha256:aaaa', size: 1024, bundleIdentifier: 'com.kiln.renamer',
      applicationVersion: '0.1.0', buildNumber: '1', binaryUUIDs: [], dSYMRefs: [],
      signingStatus: 'adhoc', notarizationStatus: 'none',
    }],
    evidenceIndex: [], changeLog: [],
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/artifact/manifest.test.ts`
Expected: FAIL — cannot find module `./manifest`.

- [ ] **Step 3: Write the schema**

`src/core/artifact/manifest.ts`:
```ts
import { z } from 'zod';

export const artifactType = z.enum(['app', 'dmg', 'pkg', 'zip', 'binary']);
export const signingStatus = z.enum(['unsigned', 'adhoc', 'developer_id', 'app_store']);
export const notarizationStatus = z.enum(['none', 'submitted', 'accepted', 'stapled']);

export const candidateArtifact = z
  .object({
    id: z.string().min(1),
    type: artifactType,
    path: z.string().min(1),
    sha256: z.string().min(1),
    size: z.number().int().nonnegative(),
    bundleIdentifier: z.string().min(1),
    applicationVersion: z.string().min(1),
    buildNumber: z.string().min(1),
    binaryUUIDs: z.array(z.string()),
    dSYMRefs: z.array(z.string()),
    signingStatus,
    notarizationStatus,
  })
  .strict();
export type CandidateArtifact = z.infer<typeof candidateArtifact>;

const pin = (revisionKey: 'specRevision' | 'archRevision' | 'devRevision') =>
  z.object({
    schemaVersion: z.string().min(1),
    [revisionKey]: z.number().int().nonnegative(),
    contentDigest: z.string().nullable(),
  }).strict();

export const artifactManifestSchema = z
  .object({
    schemaVersion: z.string().min(1),
    manifestRevision: z.number().int().nonnegative(),
    sourceSpec: pin('specRevision'),
    sourceArch: pin('archRevision'),
    sourceDev: pin('devRevision'),
    artifacts: z.array(candidateArtifact).min(1),
    evidenceIndex: z.array(z.string()),
    changeLog: z.array(z.string()),
  })
  .strict()
  .superRefine((m, ctx) => {
    const seen = new Set<string>();
    for (const a of m.artifacts) {
      if (seen.has(a.id)) ctx.addIssue({ code: 'custom', message: `duplicate artifact id ${a.id}` });
      seen.add(a.id);
    }
  });
export type ArtifactManifest = z.infer<typeof artifactManifestSchema>;

export function parseArtifactManifest(input: unknown): ArtifactManifest {
  return artifactManifestSchema.parse(input);
}
```

Note: the `pin()` helper uses a computed key; if `tsc` objects to the dynamic key type, replace `pin('specRevision')` etc. with three inline `z.object({...}).strict()` literals (specRevision/archRevision/devRevision respectively).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/artifact/manifest.test.ts && npx tsc --noEmit`
Expected: PASS (3 tests); tsc clean. If tsc complains about the `pin()` computed key, inline the three pin objects and re-run.

- [ ] **Step 5: Commit**

```bash
git add src/core/artifact/manifest.ts src/core/artifact/manifest.test.ts
git commit -m "feat(release): kiln-artifact-manifest v1 schema (candidate identity)"
```

---

### Task 2: Release-report schema

**Files:**
- Create: `src/core/release/report.ts`
- Test: `src/core/release/report.test.ts`

**Interfaces:**
- Produces: `parseReleaseReport(input: unknown): ReleaseReport`; type `ReleaseReport` with `.status`, `.releaseContext{releaseMode,maximumExternalAction,authorizedArtifactIds[],...}`, `.selectedCandidates[]`, `.channels[]`, `.sourceDev{...,artifactManifestDigest}`.

- [ ] **Step 1: Write the failing test**

`src/core/release/report.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseReleaseReport } from './report';

function validRelease(): any {
  return {
    schemaVersion: '1.0', releaseRevision: 1, releaseId: 'REL-1', status: 'audit_passed',
    sourceSpec: { schemaVersion: '1.0', specRevision: 1, contentDigest: null },
    sourceArch: { schemaVersion: '1.0', archRevision: 1, contentDigest: null },
    sourceDev: { schemaVersion: '1.0', devRevision: 1, contentDigest: null, artifactManifestDigest: null },
    releaseContext: {
      releaseMode: 'audit_only', maximumExternalAction: 'none',
      authorizedChannelIds: ['CH-1'], authorizedArtifactIds: ['ART-1'],
      version: '0.1.0', buildNumber: '1',
    },
    releaseIdentity: { applicationName: 'FileRenamer', bundleIdentifier: 'com.kiln.renamer', version: '0.1.0', buildNumber: '1' },
    selectedCandidates: [{ artifactId: 'ART-1', sha256: 'sha256:aaaa', size: 1024, bundleIdentifier: 'com.kiln.renamer', applicationVersion: '0.1.0', buildNumber: '1' }],
    channels: [{ id: 'CH-1', type: 'direct_download', required: true, state: 'pending', candidateArtifactId: 'ART-1' }],
    openReleaseAuthorizations: [], intentIssues: [], architectureIssues: [], devIssues: [],
    ownerDeclarationIssues: [], environmentIssues: [], channelIssues: [],
    evidenceIndex: [], changeLog: [],
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/release/report.test.ts`
Expected: FAIL — cannot find module `./report`.

- [ ] **Step 3: Write the schema**

`src/core/release/report.ts`:
```ts
import { z } from 'zod';

export const overallStatus = z.enum([
  'invalid_input', 'blocked_on_dev', 'blocked_on_architecture', 'blocked_on_intent',
  'blocked_on_authorization', 'blocked_on_owner_declaration', 'blocked_on_environment', 'blocked_on_channel',
  'audit_passed', 'prepared', 'uploaded', 'submitted', 'awaiting_external_review',
  'approved_pending_release', 'publication_pending', 'partially_released', 'released',
  'release_failed', 'rollback_pending', 'rolled_back', 'withdrawn',
]);
export type OverallStatus = z.infer<typeof overallStatus>;

export const maximumExternalAction = z.enum(['none', 'upload', 'submit_for_review', 'make_available']);
export type MaximumExternalAction = z.infer<typeof maximumExternalAction>;

export const channelType = z.enum([
  'mac_app_store_public', 'mac_app_store_private', 'mac_app_store_unlisted',
  'testflight_internal', 'testflight_external', 'direct_download', 'internal_direct', 'custom_channel',
]);

export const channelState = z.enum([
  'pending', 'uploaded_processing', 'ready_for_submission', 'submitted_for_review',
  'awaiting_external_review', 'review_issue', 'approved_pending_release', 'publication_requested',
  'availability_pending', 'available_verified', 'beta_available', 'failed',
]);
export type ChannelState = z.infer<typeof channelState>;

/** Authorization ceiling: which channel states each maximumExternalAction permits. */
const CEILING: Record<MaximumExternalAction, ChannelState[]> = {
  none: ['pending', 'ready_for_submission', 'failed'],
  upload: ['pending', 'ready_for_submission', 'failed', 'uploaded_processing'],
  submit_for_review: ['pending', 'ready_for_submission', 'failed', 'uploaded_processing', 'submitted_for_review', 'awaiting_external_review', 'review_issue'],
  make_available: channelState.options as ChannelState[],
};

export const selectedCandidate = z.object({
  artifactId: z.string().min(1),
  sha256: z.string().min(1),
  size: z.number().int().nonnegative(),
  bundleIdentifier: z.string().min(1),
  applicationVersion: z.string().min(1),
  buildNumber: z.string().min(1),
}).strict();

export const releaseChannel = z.object({
  id: z.string().min(1),
  type: channelType,
  required: z.boolean(),
  state: channelState,
  candidateArtifactId: z.string().min(1),
}).strict();

export const releaseReportSchema = z
  .object({
    schemaVersion: z.string().min(1),
    releaseRevision: z.number().int().nonnegative(),
    releaseId: z.string().min(1),
    status: overallStatus,
    sourceSpec: z.object({ schemaVersion: z.string().min(1), specRevision: z.number().int().nonnegative(), contentDigest: z.string().nullable() }).strict(),
    sourceArch: z.object({ schemaVersion: z.string().min(1), archRevision: z.number().int().nonnegative(), contentDigest: z.string().nullable() }).strict(),
    sourceDev: z.object({ schemaVersion: z.string().min(1), devRevision: z.number().int().nonnegative(), contentDigest: z.string().nullable(), artifactManifestDigest: z.string().nullable() }).strict(),
    releaseContext: z.object({
      releaseMode: z.enum(['audit_only', 'prepare', 'upload', 'submit', 'publish']),
      maximumExternalAction,
      authorizedChannelIds: z.array(z.string()),
      authorizedArtifactIds: z.array(z.string()),
      version: z.string().min(1),
      buildNumber: z.string().min(1),
    }).strict(),
    releaseIdentity: z.object({
      applicationName: z.string().min(1),
      bundleIdentifier: z.string().min(1),
      version: z.string().min(1),
      buildNumber: z.string().min(1),
    }).strict(),
    selectedCandidates: z.array(selectedCandidate),
    channels: z.array(releaseChannel),
    openReleaseAuthorizations: z.array(z.string()),
    intentIssues: z.array(z.string()),
    architectureIssues: z.array(z.string()),
    devIssues: z.array(z.string()),
    ownerDeclarationIssues: z.array(z.string()),
    environmentIssues: z.array(z.string()),
    channelIssues: z.array(z.string()),
    evidenceIndex: z.array(z.string()),
    changeLog: z.array(z.string()),
  })
  .strict()
  .superRefine((r, ctx) => {
    const candIds = new Set<string>();
    for (const c of r.selectedCandidates) {
      if (candIds.has(c.artifactId)) ctx.addIssue({ code: 'custom', message: `duplicate selected candidate ${c.artifactId}` });
      candIds.add(c.artifactId);
    }
    const chIds = new Set<string>();
    for (const ch of r.channels) {
      if (chIds.has(ch.id)) ctx.addIssue({ code: 'custom', message: `duplicate channel id ${ch.id}` });
      chIds.add(ch.id);
      if (!candIds.has(ch.candidateArtifactId)) ctx.addIssue({ code: 'custom', message: `channel ${ch.id} references unknown candidate ${ch.candidateArtifactId}` });
    }
    // authorization ceiling
    const allowed = new Set(CEILING[r.releaseContext.maximumExternalAction]);
    for (const ch of r.channels) {
      if (!allowed.has(ch.state)) ctx.addIssue({ code: 'custom', message: `channel ${ch.id} state "${ch.state}" exceeds maximumExternalAction "${r.releaseContext.maximumExternalAction}"` });
    }
    // audit_only does no preflight beyond pending
    if (r.releaseContext.releaseMode === 'audit_only') {
      for (const ch of r.channels) {
        if (ch.state !== 'pending') ctx.addIssue({ code: 'custom', message: `audit_only: channel ${ch.id} must be pending` });
      }
    }
    // release gate
    if (r.status === 'released') {
      for (const ch of r.channels) {
        if (ch.required && ch.state !== 'available_verified') {
          ctx.addIssue({ code: 'custom', message: `released: required channel ${ch.id} is ${ch.state}, not available_verified` });
        }
      }
    }
  });
export type ReleaseReport = z.infer<typeof releaseReportSchema>;

export function parseReleaseReport(input: unknown): ReleaseReport {
  return releaseReportSchema.parse(input);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/release/report.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/release/report.ts src/core/release/report.test.ts
git commit -m "feat(release): kiln-release v1 schema (ladder, authorization ceiling, release gate)"
```

---

### Task 3: Seam — release/manifest digests + validators

**Files:**
- Modify: `src/core/seam/validate.ts`
- Test: `src/core/seam/validate.test.ts` (append)

**Interfaces:**
- Consumes: `DevReport` (`../dev/report`), `ArtifactManifest` (`../artifact/manifest`), `ReleaseReport` (`../release/report`), existing `sha256Canonical`.
- Produces: `digestDev(dev): string`; `digestManifest(manifest): string`; `validateManifestAgainstDev(manifest, dev): SeamViolation[]`; `validateReleaseAgainstDev(release, dev, manifest): SeamViolation[]`.

- [ ] **Step 1: Write the failing test (append to `src/core/seam/validate.test.ts`)**

Add these imports at the top (extend the existing import from `./validate`), then append the describe block:
```ts
import {
  digestDev,
  digestManifest,
  validateManifestAgainstDev,
  validateReleaseAgainstDev,
} from './validate';
import { parseArtifactManifest } from '../artifact/manifest';
import { parseReleaseReport } from '../release/report';

describe('cross-stage seam: release ↔ dev ↔ manifest', () => {
  function manifestFor(name: 'file-renamer') {
    const dev = devOf(name);
    return parseArtifactManifest({
      schemaVersion: '1.0', manifestRevision: 1,
      sourceSpec: { schemaVersion: '1.0', specRevision: dev.sourceSpec.specRevision, contentDigest: dev.sourceSpec.contentDigest },
      sourceArch: { schemaVersion: '1.0', archRevision: dev.sourceArch.archRevision, contentDigest: dev.sourceArch.contentDigest },
      sourceDev: { schemaVersion: '1.0', devRevision: dev.devRevision, contentDigest: digestDev(dev) },
      artifacts: [{ id: 'ART-1', type: 'app', path: 'build/FileRenamer.app', sha256: 'sha256:aaaa', size: 1024, bundleIdentifier: 'com.kiln.renamer', applicationVersion: '0.1.0', buildNumber: '1', binaryUUIDs: [], dSYMRefs: [], signingStatus: 'adhoc', notarizationStatus: 'none' }],
      evidenceIndex: [], changeLog: [],
    });
  }
  function releaseFor(name: 'file-renamer') {
    const dev = devOf(name);
    const manifest = manifestFor(name);
    return parseReleaseReport({
      schemaVersion: '1.0', releaseRevision: 1, releaseId: 'REL-1', status: 'audit_passed',
      sourceSpec: { schemaVersion: '1.0', specRevision: dev.sourceSpec.specRevision, contentDigest: dev.sourceSpec.contentDigest },
      sourceArch: { schemaVersion: '1.0', archRevision: dev.sourceArch.archRevision, contentDigest: dev.sourceArch.contentDigest },
      sourceDev: { schemaVersion: '1.0', devRevision: dev.devRevision, contentDigest: digestDev(dev), artifactManifestDigest: digestManifest(manifest) },
      releaseContext: { releaseMode: 'audit_only', maximumExternalAction: 'none', authorizedChannelIds: ['CH-1'], authorizedArtifactIds: ['ART-1'], version: '0.1.0', buildNumber: '1' },
      releaseIdentity: { applicationName: 'FileRenamer', bundleIdentifier: 'com.kiln.renamer', version: '0.1.0', buildNumber: '1' },
      selectedCandidates: [{ artifactId: 'ART-1', sha256: 'sha256:aaaa', size: 1024, bundleIdentifier: 'com.kiln.renamer', applicationVersion: '0.1.0', buildNumber: '1' }],
      channels: [{ id: 'CH-1', type: 'direct_download', required: true, state: 'pending', candidateArtifactId: 'ART-1' }],
      openReleaseAuthorizations: [], intentIssues: [], architectureIssues: [], devIssues: [], ownerDeclarationIssues: [], environmentIssues: [], channelIssues: [],
      evidenceIndex: [], changeLog: [],
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/seam/validate.test.ts`
Expected: FAIL — `digestDev`/`validateManifestAgainstDev`/`validateReleaseAgainstDev` not exported.

- [ ] **Step 3: Add digests + validators to `src/core/seam/validate.ts`**

Add imports near the top (next to the existing `DevReport` import):
```ts
import { ArtifactManifest } from '../artifact/manifest';
import { ReleaseReport } from '../release/report';
```

Add after `digestArch` (next to the other digest helpers):
```ts
/** SHA-256 pin of the exact dev report a release candidate came from. */
export function digestDev(dev: DevReport): string {
  return sha256Canonical(dev);
}

/** SHA-256 pin of the artifact manifest a release selects candidates from. */
export function digestManifest(manifest: ArtifactManifest): string {
  return sha256Canonical(manifest);
}
```

Append the two validators at the end of the file:
```ts
/**
 * An artifact manifest is only valid against the exact dev report it was produced
 * from: it pins that dev (revision + digest) and shares its upstream spec/arch.
 */
export function validateManifestAgainstDev(manifest: ArtifactManifest, dev: DevReport): SeamViolation[] {
  const violations: SeamViolation[] = [];
  if (manifest.sourceDev.devRevision !== dev.devRevision) {
    violations.push({ code: 'dev_revision_mismatch', message: `manifest sourceDev.devRevision ${manifest.sourceDev.devRevision} != dev.devRevision ${dev.devRevision}` });
  }
  if (manifest.sourceDev.contentDigest === null) {
    violations.push({ code: 'missing_dev_digest', message: 'manifest sourceDev.contentDigest must pin the dev report' });
  } else if (manifest.sourceDev.contentDigest !== digestDev(dev)) {
    violations.push({ code: 'dev_digest_mismatch', message: 'manifest sourceDev.contentDigest does not match the provided dev report' });
  }
  if (manifest.sourceSpec.contentDigest !== dev.sourceSpec.contentDigest || manifest.sourceSpec.specRevision !== dev.sourceSpec.specRevision) {
    violations.push({ code: 'upstream_spec_mismatch', message: 'manifest sourceSpec disagrees with the dev report' });
  }
  if (manifest.sourceArch.contentDigest !== dev.sourceArch.contentDigest || manifest.sourceArch.archRevision !== dev.sourceArch.archRevision) {
    violations.push({ code: 'upstream_arch_mismatch', message: 'manifest sourceArch disagrees with the dev report' });
  }
  return violations;
}

/**
 * A release is only valid against the exact verified candidate: dev must be
 * ready_for_release, the release must pin that dev + the manifest, and every
 * selected candidate must match a manifest artifact exactly (the candidate pin).
 */
export function validateReleaseAgainstDev(release: ReleaseReport, dev: DevReport, manifest: ArtifactManifest): SeamViolation[] {
  const violations: SeamViolation[] = [];

  if (dev.status !== 'ready_for_release') {
    violations.push({ code: 'dev_not_ready', message: `release requires dev.status ready_for_release, got ${dev.status}` });
  }
  if (release.sourceDev.devRevision !== dev.devRevision) {
    violations.push({ code: 'dev_revision_mismatch', message: `release sourceDev.devRevision ${release.sourceDev.devRevision} != dev.devRevision ${dev.devRevision}` });
  }
  if (release.sourceDev.contentDigest === null) {
    violations.push({ code: 'missing_dev_digest', message: 'release sourceDev.contentDigest must pin the dev report' });
  } else if (release.sourceDev.contentDigest !== digestDev(dev)) {
    violations.push({ code: 'dev_digest_mismatch', message: 'release sourceDev.contentDigest does not match the provided dev report' });
  }
  if (release.sourceDev.artifactManifestDigest === null) {
    violations.push({ code: 'missing_manifest_digest', message: 'release sourceDev.artifactManifestDigest must pin the artifact manifest' });
  } else if (release.sourceDev.artifactManifestDigest !== digestManifest(manifest)) {
    violations.push({ code: 'manifest_digest_mismatch', message: 'release sourceDev.artifactManifestDigest does not match the provided manifest' });
  }

  const byId = new Map(manifest.artifacts.map((a) => [a.id, a]));
  const authorized = new Set(release.releaseContext.authorizedArtifactIds);
  for (const c of release.selectedCandidates) {
    if (!authorized.has(c.artifactId)) {
      violations.push({ code: 'unauthorized_artifact', message: `selected candidate ${c.artifactId} is not in authorizedArtifactIds` });
    }
    const a = byId.get(c.artifactId);
    if (!a) {
      violations.push({ code: 'unresolved_candidate', message: `selected candidate ${c.artifactId} is not in the manifest` });
      continue;
    }
    if (a.sha256 !== c.sha256 || a.size !== c.size || a.bundleIdentifier !== c.bundleIdentifier || a.applicationVersion !== c.applicationVersion || a.buildNumber !== c.buildNumber) {
      violations.push({ code: 'candidate_mismatch', message: `selected candidate ${c.artifactId} does not match the manifest artifact (not the verified build)` });
    }
  }
  return violations;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/seam/validate.test.ts && npx tsc --noEmit`
Expected: PASS (existing + 6 new); tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/seam/validate.ts src/core/seam/validate.test.ts
git commit -m "feat(release): seam digests + manifest/release validators (candidate pin)"
```

---

### Task 4: CLI — extend check + digest

**Files:**
- Modify: `src/cli/check.ts`
- Modify: `src/cli/kiln.ts`
- Test: `src/cli/check.test.ts` (append)

**Interfaces:**
- Produces: `checkArtifacts(specPath, archPath, devPath?, manifestPath?, releasePath?): CheckResult` (extended signature); `kiln check <spec> <arch> [dev] [manifest] [release]`; `kiln digest` auto-detects manifest/release.

- [ ] **Step 1: Extend `src/cli/check.ts`**

Add imports:
```ts
import { ArtifactManifest, parseArtifactManifest } from '../core/artifact/manifest';
import { ReleaseReport, parseReleaseReport } from '../core/release/report';
import { validateManifestAgainstDev, validateReleaseAgainstDev } from '../core/seam/validate';
```
Change the signature and add the parsing + checks. Replace the function signature line:
```ts
export function checkArtifacts(specPath: string, archPath: string, devPath?: string): CheckResult {
```
with:
```ts
export function checkArtifacts(
  specPath: string,
  archPath: string,
  devPath?: string,
  manifestPath?: string,
  releasePath?: string,
): CheckResult {
```
After the existing `dev` parse block, add manifest + release parses:
```ts
  let manifest: ArtifactManifest | undefined;
  let release: ReleaseReport | undefined;
  if (manifestPath) {
    try {
      manifest = parseArtifactManifest(loadJson(manifestPath));
    } catch (e) {
      problems.push({ stage: 'manifest', code: 'parse_error', message: `${manifestPath}: ${errorMessage(e)}` });
    }
  }
  if (releasePath) {
    try {
      release = parseReleaseReport(loadJson(releasePath));
    } catch (e) {
      problems.push({ stage: 'release', code: 'parse_error', message: `${releasePath}: ${errorMessage(e)}` });
    }
  }
```
After the existing `dev && intent` block (before `return`), add:
```ts
  if (manifest && dev) {
    for (const v of validateManifestAgainstDev(manifest, dev)) {
      problems.push({ stage: 'manifest<->dev', code: v.code, message: v.message });
    }
  }
  if (release && dev && manifest) {
    for (const v of validateReleaseAgainstDev(release, dev, manifest)) {
      problems.push({ stage: 'release<->dev', code: v.code, message: v.message });
    }
  } else if (release && (!dev || !manifest)) {
    problems.push({ stage: 'release', code: 'missing_inputs', message: 'release check requires both a dev report and an artifact manifest' });
  }
```

- [ ] **Step 2: Extend `src/cli/kiln.ts`**

Update imports to add the manifest/release parsers + digests:
```ts
import { parseArtifactManifest } from '../core/artifact/manifest';
import { parseReleaseReport } from '../core/release/report';
import { digestIntent, digestArch, digestDev, digestManifest } from '../core/seam/validate';
import { parseDevReport } from '../core/dev/report';
```
Replace the `digest` block with auto-detection across all artifact kinds:
```ts
if (command === 'digest') {
  const path = rest[0];
  if (!path) fail('usage: kiln digest <kiln-spec.json | kiln-arch.json | kiln-dev.json | kiln-artifact-manifest.json | kiln-release.json>');
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const has = (k: string) => !!raw && typeof raw === 'object' && k in (raw as Record<string, unknown>);
    let digest: string;
    if (has('manifestRevision')) digest = digestManifest(parseArtifactManifest(raw));
    else if (has('releaseRevision')) fail('release reports are pinned by their inputs, not digested');
    else if (has('devRevision')) digest = digestDev(parseDevReport(raw));
    else if (has('archRevision')) digest = digestArch(parseArchSpec(raw));
    else digest = digestIntent(parseIntentContract(raw));
    process.stdout.write(digest + '\n');
  } catch (e) {
    fail(`digest failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
```
Replace the `check` argument handling:
```ts
  const [specPath, archPath, devPath] = rest;
```
with:
```ts
  const [specPath, archPath, devPath, manifestPath, releasePath] = rest;
```
and update the `checkArtifacts` call:
```ts
  const result = checkArtifacts(specPath, archPath, devPath, manifestPath, releasePath);
```
and the usage string to:
```ts
    fail('usage: kiln check <kiln-spec.json> <kiln-arch.json> [kiln-dev.json] [kiln-artifact-manifest.json] [kiln-release.json]');
```

- [ ] **Step 3: Append the chain test to `src/cli/check.test.ts`**

```ts
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
```
(These reference example files created in Task 5; run them in Task 5 Step 4.)

- [ ] **Step 4: Type-check + run the non-chain tests**

Run: `npx tsc --noEmit && npx vitest run src/core/`
Expected: tsc clean; all `src/core/` tests pass (the two new `check.test.ts` chain tests will fail until Task 5 creates the examples — that's expected and fixed in Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/cli/check.ts src/cli/kiln.ts src/cli/check.test.ts
git commit -m "feat(release): kiln check/digest extended to manifest + release"
```

---

### Task 5: Synthetic example chain + real pins + green check

**Files:**
- Create: `docs/examples/file-renamer.kiln-artifact-manifest.json`
- Create: `docs/examples/file-renamer.kiln-release.json`

**Interfaces:**
- Consumes: `kiln digest` (Task 4) for dev + manifest pins; the existing `docs/examples/file-renamer.kiln-{spec,arch,dev}.json`.

- [ ] **Step 1: Write the manifest with the real dev pin**

First compute the dev digest:
```bash
npm run --silent kiln -- digest docs/examples/file-renamer.kiln-dev.json
```
Record the printed value as `<DEV_DIGEST>`. Then write `docs/examples/file-renamer.kiln-artifact-manifest.json` (use the dev example's existing spec/arch digests `sha256:63e815…` and `sha256:f89210…`, and `<DEV_DIGEST>`):
```json
{
  "schemaVersion": "1.0",
  "manifestRevision": 1,
  "sourceSpec": { "schemaVersion": "1.0", "specRevision": 1, "contentDigest": "sha256:63e815d1c2f332de63764f57254c3bb98b8a808c07def80bb6a4a350407b8bb3" },
  "sourceArch": { "schemaVersion": "1.0", "archRevision": 1, "contentDigest": "sha256:f892103062882cbed87292da6a71e18853a556cdbaf2f227d8c3ff5281d5ff13" },
  "sourceDev": { "schemaVersion": "1.0", "devRevision": 1, "contentDigest": "<DEV_DIGEST>" },
  "artifacts": [
    {
      "id": "ART-1",
      "type": "app",
      "path": "build/FileRenamer.app",
      "sha256": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      "size": 0,
      "bundleIdentifier": "com.kiln.renamer",
      "applicationVersion": "0.1.0",
      "buildNumber": "1",
      "binaryUUIDs": [],
      "dSYMRefs": [],
      "signingStatus": "adhoc",
      "notarizationStatus": "none"
    }
  ],
  "evidenceIndex": ["synthetic candidate identity; real signed .app digest lands in Slice 2"],
  "changeLog": ["rev1: synthetic candidate manifest for the release contract"]
}
```

- [ ] **Step 2: Write the release with the real dev + manifest pins**

Compute the manifest digest:
```bash
npm run --silent kiln -- digest docs/examples/file-renamer.kiln-artifact-manifest.json
```
Record as `<MANIFEST_DIGEST>`. Then write `docs/examples/file-renamer.kiln-release.json` (substitute `<DEV_DIGEST>` and `<MANIFEST_DIGEST>`):
```json
{
  "schemaVersion": "1.0",
  "releaseRevision": 1,
  "releaseId": "REL-file-renamer-1",
  "status": "audit_passed",
  "sourceSpec": { "schemaVersion": "1.0", "specRevision": 1, "contentDigest": "sha256:63e815d1c2f332de63764f57254c3bb98b8a808c07def80bb6a4a350407b8bb3" },
  "sourceArch": { "schemaVersion": "1.0", "archRevision": 1, "contentDigest": "sha256:f892103062882cbed87292da6a71e18853a556cdbaf2f227d8c3ff5281d5ff13" },
  "sourceDev": { "schemaVersion": "1.0", "devRevision": 1, "contentDigest": "<DEV_DIGEST>", "artifactManifestDigest": "<MANIFEST_DIGEST>" },
  "releaseContext": {
    "releaseMode": "audit_only",
    "maximumExternalAction": "none",
    "authorizedChannelIds": ["CH-direct"],
    "authorizedArtifactIds": ["ART-1"],
    "version": "0.1.0",
    "buildNumber": "1"
  },
  "releaseIdentity": { "applicationName": "FileRenamer", "bundleIdentifier": "com.kiln.renamer", "version": "0.1.0", "buildNumber": "1" },
  "selectedCandidates": [
    { "artifactId": "ART-1", "sha256": "sha256:0000000000000000000000000000000000000000000000000000000000000000", "size": 0, "bundleIdentifier": "com.kiln.renamer", "applicationVersion": "0.1.0", "buildNumber": "1" }
  ],
  "channels": [
    { "id": "CH-direct", "type": "direct_download", "required": true, "state": "pending", "candidateArtifactId": "ART-1" }
  ],
  "openReleaseAuthorizations": [],
  "intentIssues": [], "architectureIssues": [], "devIssues": [],
  "ownerDeclarationIssues": [], "environmentIssues": [], "channelIssues": [],
  "evidenceIndex": [],
  "changeLog": ["rev1: audit_passed release contract — no external actions (Slice 1)"]
}
```

- [ ] **Step 3: Run the executable gate on the full chain**

Run:
```bash
npm run --silent kiln -- check docs/examples/file-renamer.kiln-spec.json docs/examples/file-renamer.kiln-arch.json docs/examples/file-renamer.kiln-dev.json docs/examples/file-renamer.kiln-artifact-manifest.json docs/examples/file-renamer.kiln-release.json; echo "exit=$?"
```
Expected: `OK seam holds - all cross-stage checks passed`, exit 0. If a digest mismatch appears, the `<DEV_DIGEST>`/`<MANIFEST_DIGEST>` placeholders were not substituted correctly — recompute and fix.

- [ ] **Step 4: Run the full test suite + tsc**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc clean; all tests pass (including the two `check.test.ts` chain tests from Task 4).

- [ ] **Step 5: Commit**

```bash
git add docs/examples/file-renamer.kiln-artifact-manifest.json docs/examples/file-renamer.kiln-release.json
git commit -m "feat(release): synthetic file-renamer manifest + release; kiln check green on the full chain"
```

---

### Task 6: Stage prose (release.md) + pipeline + final verify

**Files:**
- Create: `commands/release.md`
- Modify: `commands/pipeline.md`

**Interfaces:** none (documentation).

- [ ] **Step 1: Write `commands/release.md`**

```markdown
---
description: Promote a verified release candidate through its authorized channel and prove users can obtain it. Stage 4 of Kiln. Slice 1: audit/prepare only — no external actions.
argument-hint: "[path to kiln-release.json — defaults to ./kiln-release.json]"
allowed-tools: Read, Glob, Grep, Write, Bash, WebSearch
---

You are running **`kiln:release`** — the *promotion* stage, stage 4 (`kiln:start` → `kiln:arch` → `kiln:dev` → **`kiln:release`**). You take a **verified release candidate** and promote the EXACT artifact through its authorized channel, then prove users can obtain it. You perform external release actions — so you move only within explicit authorization, and you never claim more than channel-visible evidence shows.

**Slice 1 scope:** `audit_only` / `prepare` only. No upload/submit/publish/notarize. External channel actions are described below but **deferred** until credentials + a channel are wired (Slice 2).

## Stage boundary
`release` owns: authorization enforcement; candidate identity validation; channel preflight; (later) finalization/upload/submission/publication; availability verification; the release ledger, notes and rollback runbook. It does NOT own intent, scope, architecture, production code, or legal/pricing/privacy declarations. Only `kiln:release` may emit `status: "released"`.

## Mandatory inputs + pins
`Read` `kiln-spec.json`, `kiln-arch.json`, `kiln-dev.json`, `kiln-artifact-manifest.json`, and any existing `kiln-release.json`. Record `sourceSpec`/`sourceArch`/`sourceDev` (with `artifactManifestDigest`). Never invent a digest, revision, external id, timestamp or channel state.

## Input gate
Do not perform any external action unless: `spec.status == "ready"`, `arch.status == "ready_for_build"`, `dev.status == "ready_for_release"`; the manifest pins the same dev; every selected candidate matches its manifest artifact exactly (the **candidate pin**); the requested action is authorized. Enforce it: `npm run kiln -- check kiln-spec.json kiln-arch.json kiln-dev.json kiln-artifact-manifest.json kiln-release.json` must exit 0.

## Authorization
Read `releaseContext` once: `releaseMode` and `maximumExternalAction`. **Execution never exceeds `maximumExternalAction`** (`none` → no upload; `upload` → no submit; `submit_for_review` → no make-available). Authorization holds **references, not secrets**. An externally visible action that is not authorized becomes an `openReleaseAuthorization` — do not execute it.

## Candidate immutability
A selected candidate is frozen. Do not modify its bundle, Info.plist, entitlements, privacy manifest, dependencies, version or build; do not rebuild; do not re-sign a different binary. If any bundle content must change, stop and return to **`kiln:dev`**.

## Decision authority
Classify each decision and route it: intent change → `kiln:start`; architecture/channel-incompatibility → `kiln:arch`; artifact/binary/metadata-in-binary/runtime defect → `kiln:dev` (with evidence); legal/tax/privacy/commercial declaration → the **owner**; missing tool/identity/credential → `environmentIssue`; channel rejection/outage → `channelIssue`. Never answer an owner declaration on the owner's behalf.

## Truth ladder (deferred actions — Slice 2)
`prepared → uploaded → submitted → approved → published → available → released`. **Never** equate upload with submission, submission with approval, approval with publication, publication with availability, or a dashboard status with a user install. Verify availability independently via the audience-facing channel, in a clean environment — not only an admin dashboard. **No asynchronous claims:** you operate only during the invocation; record the exact pending state and stop cleanly. (Upload/submit/publish/notarize/availability are **deferred** to Slice 2 with credentials + a channel.)

## Output — the release record
`Write` `kiln-release.json` (see `src/core/release/report.ts` for the authoritative schema): `releaseId`, `status`, `sourceSpec`/`sourceArch`/`sourceDev{…,artifactManifestDigest}`, `releaseContext{releaseMode,maximumExternalAction,authorizedChannelIds,authorizedArtifactIds,version,buildNumber}`, `releaseIdentity`, `selectedCandidates[]`, `channels[{id,type,required,state,candidateArtifactId}]`, issue arrays, `changeLog`. In Slice 1 the legitimate terminal status is `audit_passed` (audit_only) or `prepared` (prepare); `released` is reachable only when every required channel is `available_verified` (Slice 2). Then a short human recap: the exact candidate identity, what (if any) external actions happened, the channel state, and whether users can actually obtain the build — using precise language ("submitted for review", "publication requested, visibility not yet verified", "available and independently verified"). Never say "released" unless `status == "released"`.
```

- [ ] **Step 2: Update `commands/pipeline.md`**

In `commands/pipeline.md`, change the overview line `understanding → architecture → build → validate` to `understanding → architecture → build → release`. Replace the stage-4 bullet (the `**Validate**` / `**Release**` line near the end of the Stages list) with:
```markdown
4. **Release** — follow `kiln:release` on `kiln-release.json` + the candidate manifest. **Gate:** `npm run kiln -- check kiln-spec.json kiln-arch.json kiln-dev.json kiln-artifact-manifest.json kiln-release.json` must exit 0 (the candidate pin: the release ships the exact verified build). Slice 1 stops at `audit_passed`/`prepared` (no external actions); real signing/notarization/distribution and `released` are Slice 2 (credential-gated). Output: `kiln-release.json` (the release record).
```
If the current stage-4 line differs in wording, replace whatever the 4th numbered stage says with the block above. Verify there is no remaining stale reference to a "validate" stage in `pipeline.md` (`grep -n -i validate commands/pipeline.md` should return nothing meaningful).

- [ ] **Step 3: Final verification**

Run:
```bash
npx tsc --noEmit && npx vitest run 2>&1 | tail -3
npm run --silent kiln -- check docs/examples/file-renamer.kiln-spec.json docs/examples/file-renamer.kiln-arch.json docs/examples/file-renamer.kiln-dev.json docs/examples/file-renamer.kiln-artifact-manifest.json docs/examples/file-renamer.kiln-release.json; echo "exit=$?"
```
Expected: tsc clean; all vitest tests pass; chain check exits 0.

- [ ] **Step 4: Commit**

```bash
git add commands/release.md commands/pipeline.md
git commit -m "feat(release): kiln:release stage prose v1 + pipeline stage-4 = release"
```

---

## Self-Review

**Spec coverage:**
- artifact-manifest v1 schema — Task 1. ✓
- release v1 schema (ladder, authorization ceiling set-based, release gate, no `fixed`) — Task 2. ✓
- seam `digestDev`/`digestManifest` + `validateManifestAgainstDev` + `validateReleaseAgainstDev` (candidate pin) — Task 3. ✓
- CLI `check`/`digest` extended to manifest+release — Task 4. ✓
- synthetic stable example chain + real pins + `kiln check` green — Task 5. ✓
- `commands/release.md` v1 (audit/prepare; external actions deferred prose) + `pipeline.md` stage-4 = release — Task 6. ✓
- DoD 1–7 — covered across Tasks 1–6. ✓

**Placeholder scan:** the only intentional placeholders are `<DEV_DIGEST>`/`<MANIFEST_DIGEST>` in Task 5, each with an explicit compute-then-substitute command; the artifact `sha256`/`size` are deliberately synthetic (documented). No vague "add validation" steps.

**Type consistency:** `parseArtifactManifest`/`ArtifactManifest`/`CandidateArtifact`, `parseReleaseReport`/`ReleaseReport`, `digestDev`/`digestManifest`, `validateManifestAgainstDev`/`validateReleaseAgainstDev`, `checkArtifacts(spec,arch,dev?,manifest?,release?)` — names/signatures consistent across Tasks 1–6 and the seam codes (`dev_digest_mismatch`, `candidate_mismatch`, `dev_not_ready`, `unauthorized_artifact`, `missing_inputs`).
