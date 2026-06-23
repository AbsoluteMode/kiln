import { readFileSync } from 'node:fs';
import { parseIntentContract } from '../core/intent/contract';
import { parseArchSpec } from '../core/arch/spec';
import { digestIntent, digestArch } from '../core/seam/validate';
import { checkArtifacts } from './check';

/**
 * Kiln's executable gate. Two subcommands:
 *   kiln digest <kiln-spec.json | kiln-arch.json>       -> prints the SHA-256 pin
 *   kiln check  <kiln-spec.json> <kiln-arch.json> [dev] -> enforces the cross-stage seam
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
  if (!path) fail('usage: kiln digest <kiln-spec.json | kiln-arch.json>');
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
    const isArch = !!raw && typeof raw === 'object' && 'archRevision' in raw;
    const digest = isArch ? digestArch(parseArchSpec(raw)) : digestIntent(parseIntentContract(raw));
    process.stdout.write(digest + '\n');
  } catch (e) {
    fail(`digest failed: ${e instanceof Error ? e.message : String(e)}`);
  }
} else if (command === 'check') {
  const [specPath, archPath, devPath] = rest;
  if (!specPath || !archPath) {
    fail('usage: kiln check <kiln-spec.json> <kiln-arch.json> [kiln-dev.json]');
  }
  const result = checkArtifacts(specPath, archPath, devPath);
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
