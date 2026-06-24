import { createHash } from 'node:crypto';
import { IntentContract } from '../intent/contract';
import { ArchSpec } from '../arch/spec';
import { DevReport } from '../dev/report';
import { ArtifactManifest } from '../artifact/manifest';
import { ReleaseReport } from '../release/report';

/**
 * Cross-stage seam validation.
 *
 * Each stage contract (`intent`, `arch`, `dev`) has its own strict schema, but a
 * schema can only see *one* document. It cannot tell whether an architecture
 * actually traces to the intent it claims, whether every MUST requirement is
 * covered, whether a capability exceeds what the user confirmed, or whether the
 * build implemented what the architecture demanded. Those invariants live in the
 * *seam* between stages — this module enforces them. (Codex review, Section 2 + 7.)
 */
export interface SeamViolation {
  code: string;
  message: string;
}

/** Key-sorted clone so a digest is independent of property order / whitespace. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

function sha256Canonical(value: unknown): string {
  return 'sha256:' + createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

/** SHA-256 pin of the exact intent contract an architecture was built from. */
export function digestIntent(intent: IntentContract): string {
  return sha256Canonical(intent);
}

/** SHA-256 pin of the exact architecture a build was produced from. */
export function digestArch(arch: ArchSpec): string {
  return sha256Canonical(arch);
}

/** SHA-256 pin of the exact dev report a release candidate came from. */
export function digestDev(dev: DevReport): string {
  return sha256Canonical(dev);
}

/** SHA-256 pin of the artifact manifest a release selects candidates from. */
export function digestManifest(manifest: ArtifactManifest): string {
  return sha256Canonical(manifest);
}

/**
 * An architecture is only valid against the *exact* intent contract it implements.
 * Returns every seam violation (empty array ⇒ the seam holds).
 */
export function validateArchAgainstIntent(arch: ArchSpec, intent: IntentContract): SeamViolation[] {
  const violations: SeamViolation[] = [];

  const allRequirements = [...intent.requirements.baseline, ...intent.requirements.customDelta];
  const reqIds = new Set(allRequirements.map((r) => r.id));
  const journeyIds = new Set(intent.coreJourneys.map((j) => j.id));
  const acceptanceTestIds = new Set(intent.acceptanceTests.map((t) => t.id));
  const capabilityNeedIds = new Set(intent.capabilityNeeds.map((c) => c.id));
  const confirmedCapabilityNeedIds = new Set(
    intent.capabilityNeeds
      .filter(
        (c) =>
          c.confirmationStatus === 'confirmed' || c.confirmationStatus === 'confirmed_by_request',
      )
      .map((c) => c.id),
  );
  const mustRequirementIds = new Set<string>([
    ...intent.scope.must,
    ...allRequirements.filter((r) => r.priority === 'must').map((r) => r.id),
  ]);

  const resolvesToIntentId = (id: string) =>
    reqIds.has(id) ||
    journeyIds.has(id) ||
    acceptanceTestIds.has(id) ||
    capabilityNeedIds.has(id);

  // 1. Every `tracesTo` in the arch — on decisions, dependencies, AND open
  //    confirmations — must resolve to a real intent id (no stale REQ-/JRN-/CAP-/AT-).
  const tracedObjects: Array<{ label: string; tracesTo: string[] }> = [
    ...arch.decisionLog.map((d) => ({ label: `decision ${d.id}`, tracesTo: d.tracesTo })),
    ...arch.dependencies.map((dep) => ({ label: `dependency ${dep.id}`, tracesTo: dep.tracesTo })),
    ...arch.openConfirmations.map((oc) => ({ label: `openConfirmation ${oc.id}`, tracesTo: oc.tracesTo })),
  ];
  for (const obj of tracedObjects) {
    for (const ref of obj.tracesTo) {
      if (!resolvesToIntentId(ref)) {
        violations.push({
          code: 'unresolved_traces_to',
          message: `${obj.label} traces to unknown intent id "${ref}"`,
        });
      }
    }
  }

  // 2. Coverage rows reference real ids, and every MUST requirement has a complete row.
  const completelyCoveredRequirementIds = new Set<string>();
  for (const row of arch.coverageMatrix) {
    if (!reqIds.has(row.requirementId)) {
      violations.push({
        code: 'unresolved_requirement',
        message: `coverage row references unknown requirement "${row.requirementId}"`,
      });
    }
    for (const j of row.journeyIds) {
      if (!journeyIds.has(j)) {
        violations.push({
          code: 'unresolved_journey',
          message: `coverage row ${row.requirementId} references unknown journey "${j}"`,
        });
      }
    }
    if (row.coverage === 'complete') completelyCoveredRequirementIds.add(row.requirementId);
  }
  for (const id of mustRequirementIds) {
    if (!completelyCoveredRequirementIds.has(id)) {
      violations.push({
        code: 'must_not_covered',
        message: `MUST requirement ${id} has no complete coverage row`,
      });
    }
  }

  // 3. Verification records map to real acceptance tests; every acceptance test is verified.
  const verifiedAcceptanceTestIds = new Set<string>();
  for (const rec of arch.reliability.verificationMatrix) {
    if (!acceptanceTestIds.has(rec.acceptanceTestId)) {
      violations.push({
        code: 'unresolved_acceptance_test',
        message: `verification ${rec.id} references unknown acceptance test "${rec.acceptanceTestId}"`,
      });
    } else {
      verifiedAcceptanceTestIds.add(rec.acceptanceTestId);
    }
  }
  for (const t of intent.acceptanceTests) {
    if (!verifiedAcceptanceTestIds.has(t.id)) {
      violations.push({
        code: 'acceptance_test_unverified',
        message: `acceptance test ${t.id} has no verification record`,
      });
    }
  }

  // 4. Least privilege: every implemented capability maps to a CONFIRMED capability need.
  for (const cap of arch.capabilities) {
    if (!capabilityNeedIds.has(cap.capabilityNeedId)) {
      violations.push({
        code: 'unresolved_capability',
        message: `capability ${cap.id} references unknown capabilityNeed "${cap.capabilityNeedId}"`,
      });
    } else if (!confirmedCapabilityNeedIds.has(cap.capabilityNeedId)) {
      violations.push({
        code: 'capability_not_confirmed',
        message: `capability ${cap.id} implements unconfirmed capabilityNeed ${cap.capabilityNeedId} (least privilege)`,
      });
    }
  }

  // 5. The architecture must pin the exact intent revision it was built from.
  if (arch.sourceSpec.specRevision !== intent.specRevision) {
    violations.push({
      code: 'revision_mismatch',
      message: `sourceSpec.specRevision ${arch.sourceSpec.specRevision} != intent.specRevision ${intent.specRevision}`,
    });
  }
  if (arch.status === 'ready_for_build') {
    if (arch.sourceSpec.contentDigest === null) {
      violations.push({
        code: 'missing_digest',
        message: 'ready_for_build requires a non-null sourceSpec.contentDigest pinning the intent',
      });
    } else if (arch.sourceSpec.contentDigest !== digestIntent(intent)) {
      violations.push({
        code: 'digest_mismatch',
        message: 'sourceSpec.contentDigest does not match the provided intent contract',
      });
    }
  }

  return violations;
}

/**
 * A build report is only valid against the architecture it was built from: every
 * implementation unit must target real arch components/interfaces/verifications,
 * every declared observability mechanism must be implemented, the arch must be
 * pinned, and (when ready_for_release) every arch verification must have a result.
 */
export function validateDevAgainstArch(dev: DevReport, arch: ArchSpec): SeamViolation[] {
  const violations: SeamViolation[] = [];

  const componentIds = new Set(arch.system.components.map((c) => c.id));
  const interfaceIds = new Set(arch.system.interfaces.map((i) => i.id));
  const verificationIds = new Set(arch.reliability.verificationMatrix.map((v) => v.id));

  for (const u of dev.implementationUnits) {
    if (!componentIds.has(u.componentId)) {
      violations.push({ code: 'unresolved_component', message: `implementation unit ${u.id} references unknown component "${u.componentId}"` });
    }
    for (const i of u.interfaceIds) {
      if (!interfaceIds.has(i)) {
        violations.push({ code: 'unresolved_interface', message: `implementation unit ${u.id} references unknown interface "${i}"` });
      }
    }
    for (const v of u.verificationIds) {
      if (!verificationIds.has(v)) {
        violations.push({ code: 'unresolved_verification', message: `implementation unit ${u.id} references unknown verification "${v}"` });
      }
    }
  }
  for (const vr of dev.verificationResults) {
    if (!verificationIds.has(vr.verificationId)) {
      violations.push({ code: 'unresolved_verification', message: `verificationResult references unknown verification "${vr.verificationId}"` });
    }
  }
  for (const observability of arch.reliability.observability) {
    if (!dev.loggingImplemented.includes(observability)) {
      violations.push({ code: 'observability_not_implemented', message: `architecture observability "${observability}" is not implemented` });
    }
  }
  if (dev.sourceArch.archRevision !== arch.archRevision) {
    violations.push({ code: 'arch_revision_mismatch', message: `sourceArch.archRevision ${dev.sourceArch.archRevision} != arch.archRevision ${arch.archRevision}` });
  }

  if (dev.status === 'ready_for_release') {
    const resulted = new Set(dev.verificationResults.map((v) => v.verificationId));
    for (const v of arch.reliability.verificationMatrix) {
      if (!resulted.has(v.id)) {
        violations.push({ code: 'verification_unrun', message: `architecture verification ${v.id} has no dev result` });
      }
    }
    if (dev.sourceArch.contentDigest === null) {
      violations.push({ code: 'missing_arch_digest', message: 'ready_for_release requires a non-null sourceArch.contentDigest' });
    } else if (dev.sourceArch.contentDigest !== digestArch(arch)) {
      violations.push({ code: 'arch_digest_mismatch', message: 'sourceArch.contentDigest does not match the provided architecture' });
    }
  }

  return violations;
}

/**
 * A build report must also trace to the intent it ultimately serves: every
 * implementation unit traces to a real intent id, and (when ready_for_release)
 * every MUST requirement is implemented and the intent is pinned.
 */
export function validateDevAgainstIntent(dev: DevReport, intent: IntentContract): SeamViolation[] {
  const violations: SeamViolation[] = [];

  const allRequirements = [...intent.requirements.baseline, ...intent.requirements.customDelta];
  const reqIds = new Set(allRequirements.map((r) => r.id));
  const journeyIds = new Set(intent.coreJourneys.map((j) => j.id));
  const acceptanceTestIds = new Set(intent.acceptanceTests.map((t) => t.id));
  const capabilityNeedIds = new Set(intent.capabilityNeeds.map((c) => c.id));
  const resolvesToIntentId = (id: string) =>
    reqIds.has(id) || journeyIds.has(id) || acceptanceTestIds.has(id) || capabilityNeedIds.has(id);
  const mustRequirementIds = new Set<string>([
    ...intent.scope.must,
    ...allRequirements.filter((r) => r.priority === 'must').map((r) => r.id),
  ]);

  for (const u of dev.implementationUnits) {
    for (const ref of u.tracesTo) {
      if (!resolvesToIntentId(ref)) {
        violations.push({ code: 'unresolved_traces_to', message: `implementation unit ${u.id} traces to unknown intent id "${ref}"` });
      }
    }
  }

  if (dev.status === 'ready_for_release') {
    const tracedRequirementIds = new Set(dev.implementationUnits.flatMap((u) => u.tracesTo));
    for (const id of mustRequirementIds) {
      if (!tracedRequirementIds.has(id)) {
        violations.push({ code: 'must_not_implemented', message: `MUST requirement ${id} is not traced by any implementation unit` });
      }
    }
    if (dev.sourceSpec.specRevision !== intent.specRevision) {
      violations.push({ code: 'spec_revision_mismatch', message: `sourceSpec.specRevision ${dev.sourceSpec.specRevision} != intent.specRevision ${intent.specRevision}` });
    }
    if (dev.sourceSpec.contentDigest === null) {
      violations.push({ code: 'missing_spec_digest', message: 'ready_for_release requires a non-null sourceSpec.contentDigest' });
    } else if (dev.sourceSpec.contentDigest !== digestIntent(intent)) {
      violations.push({ code: 'spec_digest_mismatch', message: 'sourceSpec.contentDigest does not match the provided intent contract' });
    }
  }

  return violations;
}

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
