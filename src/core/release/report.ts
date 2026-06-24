import { z } from 'zod';

export const overallStatus = z.enum([
  'invalid_input',
  'blocked_on_dev',
  'blocked_on_architecture',
  'blocked_on_intent',
  'blocked_on_authorization',
  'blocked_on_owner_declaration',
  'blocked_on_environment',
  'blocked_on_channel',
  'audit_passed',
  'prepared',
  'uploaded',
  'submitted',
  'awaiting_external_review',
  'approved_pending_release',
  'publication_pending',
  'partially_released',
  'released',
  'release_failed',
  'rollback_pending',
  'rolled_back',
  'withdrawn',
]);
export type OverallStatus = z.infer<typeof overallStatus>;

export const maximumExternalAction = z.enum(['none', 'upload', 'submit_for_review', 'make_available']);
export type MaximumExternalAction = z.infer<typeof maximumExternalAction>;

export const channelType = z.enum([
  'mac_app_store_public',
  'mac_app_store_private',
  'mac_app_store_unlisted',
  'testflight_internal',
  'testflight_external',
  'direct_download',
  'internal_direct',
  'custom_channel',
]);

export const channelState = z.enum([
  'pending',
  'uploaded_processing',
  'ready_for_submission',
  'submitted_for_review',
  'awaiting_external_review',
  'review_issue',
  'approved_pending_release',
  'publication_requested',
  'availability_pending',
  'available_verified',
  'beta_available',
  'failed',
]);
export type ChannelState = z.infer<typeof channelState>;

/** Authorization ceiling: the channel states each maximumExternalAction permits. */
const CEILING: Record<MaximumExternalAction, ChannelState[]> = {
  none: ['pending', 'ready_for_submission', 'failed'],
  upload: ['pending', 'ready_for_submission', 'failed', 'uploaded_processing'],
  submit_for_review: [
    'pending',
    'ready_for_submission',
    'failed',
    'uploaded_processing',
    'submitted_for_review',
    'awaiting_external_review',
    'review_issue',
  ],
  make_available: channelState.options as unknown as ChannelState[],
};

export const selectedCandidate = z
  .object({
    artifactId: z.string().min(1),
    sha256: z.string().min(1),
    size: z.number().int().nonnegative(),
    bundleIdentifier: z.string().min(1),
    applicationVersion: z.string().min(1),
    buildNumber: z.string().min(1),
  })
  .strict();

export const releaseChannel = z
  .object({
    id: z.string().min(1),
    type: channelType,
    required: z.boolean(),
    state: channelState,
    candidateArtifactId: z.string().min(1),
  })
  .strict();

export const releaseReportSchema = z
  .object({
    schemaVersion: z.string().min(1),
    releaseRevision: z.number().int().nonnegative(),
    releaseId: z.string().min(1),
    status: overallStatus,
    sourceSpec: z
      .object({ schemaVersion: z.string().min(1), specRevision: z.number().int().nonnegative(), contentDigest: z.string().nullable() })
      .strict(),
    sourceArch: z
      .object({ schemaVersion: z.string().min(1), archRevision: z.number().int().nonnegative(), contentDigest: z.string().nullable() })
      .strict(),
    sourceDev: z
      .object({
        schemaVersion: z.string().min(1),
        devRevision: z.number().int().nonnegative(),
        contentDigest: z.string().nullable(),
        artifactManifestDigest: z.string().nullable(),
      })
      .strict(),
    releaseContext: z
      .object({
        releaseMode: z.enum(['audit_only', 'prepare', 'upload', 'submit', 'publish']),
        maximumExternalAction,
        authorizedChannelIds: z.array(z.string()),
        authorizedArtifactIds: z.array(z.string()),
        version: z.string().min(1),
        buildNumber: z.string().min(1),
      })
      .strict(),
    releaseIdentity: z
      .object({
        applicationName: z.string().min(1),
        bundleIdentifier: z.string().min(1),
        version: z.string().min(1),
        buildNumber: z.string().min(1),
      })
      .strict(),
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
      if (!candIds.has(ch.candidateArtifactId)) {
        ctx.addIssue({ code: 'custom', message: `channel ${ch.id} references unknown candidate ${ch.candidateArtifactId}` });
      }
    }
    // authorization ceiling
    const allowed = new Set(CEILING[r.releaseContext.maximumExternalAction]);
    for (const ch of r.channels) {
      if (!allowed.has(ch.state)) {
        ctx.addIssue({ code: 'custom', message: `channel ${ch.id} state "${ch.state}" exceeds maximumExternalAction "${r.releaseContext.maximumExternalAction}"` });
      }
    }
    // audit_only performs no preflight beyond pending
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
