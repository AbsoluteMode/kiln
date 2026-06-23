import { z } from 'zod';

export const devReportSchema = z
  .object({
    tracesTo: z.string().min(1),
    tests: z.object({
      framework: z.string().min(1),
      written: z.number().int().nonnegative(),
      passing: z.number().int().nonnegative(),
      files: z.array(z.string().min(1)).min(1),
    }),
    loggingImplemented: z.array(z.string().min(1)),
    review: z.object({
      reviewer: z.enum(['self', 'codex']),
      verdict: z.enum(['pass', 'issues']),
      notes: z.array(z.string()),
    }),
    artifacts: z.array(z.string().min(1)).min(1),
    openRisks: z.array(z.string()),
  })
  .superRefine((r, ctx) => {
    // a completed build has at least one test and all tests passing
    if (r.tests.written < 1) {
      ctx.addIssue({ code: 'custom', message: 'a completed build must have at least one test' });
    }
    if (r.tests.passing !== r.tests.written) {
      ctx.addIssue({
        code: 'custom',
        message: `not done: ${r.tests.passing}/${r.tests.written} tests passing`,
      });
    }
    // a passing review cannot ship with unaddressed issues
    if (r.review.verdict === 'issues') {
      ctx.addIssue({ code: 'custom', message: 'review verdict is "issues" — resolve before completing the build' });
    }
  });
export type DevReport = z.infer<typeof devReportSchema>;

export function parseDevReport(input: unknown): DevReport {
  return devReportSchema.parse(input);
}
