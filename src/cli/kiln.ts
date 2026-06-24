import { readFileSync } from 'node:fs';
import { parseIntentContract } from '../core/intent/contract';
import { parseArchSpec } from '../core/arch/spec';
import { parseDevReport } from '../core/dev/report';
import { parseArtifactManifest } from '../core/artifact/manifest';
import { digestIntent, digestArch, digestDev, digestManifest } from '../core/seam/validate';
import { checkArtifacts } from './check';

/**
 * Kiln's executable gate. Two subcommands:
 *   kiln digest <spec | arch | dev | artifact-manifest>  -> prints the SHA-256 pin
 *   kiln check  <spec> <arch> [dev] [manifest] [release] -> enforces the cross-stage seam
 *
 * Downstream stages write the digest into their sourceSpec/sourceArch pin; every
 * stage then runs `check` and aborts if it exits non-zero.
 */
function fail(message: string): never {
  process.stderr.write(message + '\n');
  process.exit(1);
}

const [, , command, ...rest] = process.argv;

if (command === 'digest') {
  const path = rest[0];
  if (!path) fail('usage: kiln digest <kiln-spec.json | kiln-arch.json | kiln-dev.json | kiln-artifact-manifest.json>');
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
} else if (command === 'check') {
  const [specPath, archPath, devPath, manifestPath, releasePath] = rest;
  if (!specPath || !archPath) {
    fail('usage: kiln check <kiln-spec.json> <kiln-arch.json> [kiln-dev.json] [kiln-artifact-manifest.json] [kiln-release.json]');
  }
  const result = checkArtifacts(specPath, archPath, devPath, manifestPath, releasePath);
  if (result.ok) {
    process.stdout.write('OK seam holds - all cross-stage checks passed\n');
  } else {
    process.stderr.write(`FAIL ${result.problems.length} seam violation(s):\n`);
    for (const p of result.problems) {
      process.stderr.write(`  [${p.stage}] ${p.code}: ${p.message}\n`);
    }
    process.exit(1);
  }
} else {
  fail('usage: kiln <check|digest> ...');
}
