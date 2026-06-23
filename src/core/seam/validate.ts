import { createHash } from 'node:crypto';
import { IntentContract } from '../intent/contract';
import { ArchSpec } from '../arch/spec';
import { DevReport } from '../dev/report';

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

/** SHA-256 pin of the exact intent contract an architecture was built from. */
export function digestIntent(intent: IntentContract): string {
  const json = JSON.stringify(canonicalize(intent));
  return 'sha256:' + createHash('sha256').update(json).digest('hex');
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

  // 1. Every decision traces to a real intent id (no stale REQ-/JRN-/CAP-/AT- refs).
  for (const d of arch.decisionLog) {
    for (const ref of d.tracesTo) {
      if (!resolvesToIntentId(ref)) {
        violations.push({
          code: 'unresolved_traces_to',
          message: `decision ${d.id} traces to unknown intent id "${ref}"`,
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
 * A build report is only valid against the architecture it was built from: it must
 * cover every verification record and implement every declared observability mechanism.
 */
export function validateDevAgainstArch(dev: DevReport, arch: ArchSpec): SeamViolation[] {
  const violations: SeamViolation[] = [];

  const expectedVerifications = arch.reliability.verificationMatrix.length;
  if (dev.tests.written < expectedVerifications) {
    violations.push({
      code: 'verification_undercovered',
      message: `dev wrote ${dev.tests.written} tests but the architecture defines ${expectedVerifications} verification records`,
    });
  }
  for (const observability of arch.reliability.observability) {
    if (!dev.loggingImplemented.includes(observability)) {
      violations.push({
        code: 'observability_not_implemented',
        message: `architecture observability "${observability}" is not implemented`,
      });
    }
  }

  return violations;
}
