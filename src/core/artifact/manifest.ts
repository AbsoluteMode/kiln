import { z } from 'zod';

export const artifactType = z.enum(['app', 'dmg', 'pkg', 'zip', 'binary']);
export const signingStatus = z.enum(['unsigned', 'adhoc', 'self_signed', 'developer_id', 'app_store']);
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

/** The dev stage's record of the exact built candidate(s), pinned to its upstream contracts. */
export const artifactManifestSchema = z
  .object({
    schemaVersion: z.string().min(1),
    manifestRevision: z.number().int().nonnegative(),
    sourceSpec: z
      .object({ schemaVersion: z.string().min(1), specRevision: z.number().int().nonnegative(), contentDigest: z.string().nullable() })
      .strict(),
    sourceArch: z
      .object({ schemaVersion: z.string().min(1), archRevision: z.number().int().nonnegative(), contentDigest: z.string().nullable() })
      .strict(),
    sourceDev: z
      .object({ schemaVersion: z.string().min(1), devRevision: z.number().int().nonnegative(), contentDigest: z.string().nullable() })
      .strict(),
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
