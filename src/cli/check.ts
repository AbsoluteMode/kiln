// WHY: docs/decisions/2026-06-24-executable-seam-gate.md
import { readFileSync } from 'node:fs';
import { IntentContract, parseIntentContract } from '../core/intent/contract';
import { ArchSpec, parseArchSpec } from '../core/arch/spec';
import { DevReport, parseDevReport } from '../core/dev/report';
import { validateArchAgainstIntent, validateDevAgainstArch } from '../core/seam/validate';

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

export function checkArtifacts(specPath: string, archPath: string, devPath?: string): CheckResult {
  const problems: CheckProblem[] = [];

  let intent: IntentContract | undefined;
  let arch: ArchSpec | undefined;
  let dev: DevReport | undefined;

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

  return { ok: problems.length === 0, problems };
}
