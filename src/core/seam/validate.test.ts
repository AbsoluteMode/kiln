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
  digestIntent,
} from './validate';

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

  it('flags a ready_for_validation build that skipped an architecture verification', () => {
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
