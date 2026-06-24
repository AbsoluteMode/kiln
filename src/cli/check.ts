// WHY: docs/decisions/2026-06-24-executable-seam-gate.md
import { readFileSync } from 'node:fs';
import { IntentContract, parseIntentContract } from '../core/intent/contract';
import { ArchSpec, parseArchSpec } from '../core/arch/spec';
import { DevReport, parseDevReport } from '../core/dev/report';
import { ArtifactManifest, parseArtifactManifest } from '../core/artifact/manifest';
import { ReleaseReport, parseReleaseReport } from '../core/release/report';
import {
  validateArchAgainstIntent,
  validateDevAgainstArch,
  validateDevAgainstIntent,
  validateManifestAgainstDev,
  validateReleaseAgainstDev,
} from '../core/seam/validate';

/**
 * The executable seam gate. `kiln check` loads the stage artifacts, parses each
 * against its own schema, then runs the cross-stage validators. This is what makes
 * the seam *enforced* rather than merely defined — the command stages run it via
 * Bash and abort on a non-empty problem list.
 */
export interface CheckProblem {
  stage: string;
  code: string;
  message: string;
}

export interface CheckResult {
  ok: boolean;
  problems: CheckProblem[];
}

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function checkArtifacts(
  specPath: string,
  archPath: string,
  devPath?: string,
  manifestPath?: string,
  releasePath?: string,
): CheckResult {
  const problems: CheckProblem[] = [];

  let intent: IntentContract | undefined;
  let arch: ArchSpec | undefined;
  let dev: DevReport | undefined;
  let manifest: ArtifactManifest | undefined;
  let release: ReleaseReport | undefined;

  try {
    intent = parseIntentContract(loadJson(specPath));
  } catch (e) {
    problems.push({ stage: 'intent', code: 'parse_error', message: `${specPath}: ${errorMessage(e)}` });
  }
  try {
    arch = parseArchSpec(loadJson(archPath));
  } catch (e) {
    problems.push({ stage: 'arch', code: 'parse_error', message: `${archPath}: ${errorMessage(e)}` });
  }
  if (devPath) {
    try {
      dev = parseDevReport(loadJson(devPath));
    } catch (e) {
      problems.push({ stage: 'dev', code: 'parse_error', message: `${devPath}: ${errorMessage(e)}` });
    }
  }
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

  if (intent && arch) {
    for (const v of validateArchAgainstIntent(arch, intent)) {
      problems.push({ stage: 'arch<->intent', code: v.code, message: v.message });
    }
  }
  if (dev && arch) {
    for (const v of validateDevAgainstArch(dev, arch)) {
      problems.push({ stage: 'dev<->arch', code: v.code, message: v.message });
    }
  }
  if (dev && intent) {
    for (const v of validateDevAgainstIntent(dev, intent)) {
      problems.push({ stage: 'dev<->intent', code: v.code, message: v.message });
    }
  }
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

  return { ok: problems.length === 0, problems };
}
