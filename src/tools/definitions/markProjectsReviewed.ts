import { z } from 'zod';
import type { ToolHandlerExtra } from './toolHandler.js';
import {
  markProjectsReviewed,
  type MarkProjectsReviewedResult,
} from '../primitives/markProjectsReviewed.js';
import { reviewIntervalSchema } from './sharedOutputSchemas.js';

export const schema = z
  .object({
    projectIds: z
      .array(z.string().min(1))
      .min(1)
      .max(100)
      .superRefine((ids, context) => {
        const seen = new Set<string>();
        ids.forEach((id, index) => {
          if (seen.has(id)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index],
              message: `Duplicate project ID: ${id}`,
            });
          }
          seen.add(id);
        });
      })
      .describe(
        'Stable IDs of projects the user explicitly confirmed as reviewed.',
      ),
  })
  .strict();

/**
 * Success shape only. A failure returns `isError: true`, which the SDK exempts
 * from output validation.
 *
 * Every per-project field is required because preflight rejects any project
 * that cannot supply them: ineligible status, no usable review interval, and no
 * next review date all fail before the first write
 * (`omnifocusScripts/markProjectsReviewed.js`).
 */
export const outputSchema = z.object({
  reviewedAt: z
    .string()
    .optional()
    .describe('One request timestamp applied to the whole batch'),
  count: z.number().int().describe('Projects marked reviewed and verified'),
  projects: z.array(
    z.object({
      id: z.string().describe('Stable OmniFocus project ID'),
      name: z.string(),
      status: z.string(),
      lastReviewDate: z.string(),
      nextReviewDate: z
        .string()
        .describe('Next review date OmniFocus generated from the interval'),
      reviewInterval: reviewIntervalSchema,
      verified: z
        .boolean()
        .describe('True when the written dates were read back and matched'),
    }),
  ),
});

/**
 * Maps a primitive result to the tool result. Exported so the mapping — in
 * particular that `structuredContent` satisfies `outputSchema` — is testable
 * without reaching OmniFocus.
 */
export function buildResult(result: MarkProjectsReviewedResult) {
  if (!result.success || !result.projects) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Failed to mark projects reviewed: ${result.error || 'Unknown error'}`,
        },
      ],
      isError: true,
    };
  }

  const lines = result.projects.map(
    (project) =>
      `- ${project.name} (${project.id}): next review ${new Date(project.nextReviewDate).toLocaleDateString()}`,
  );
  return {
    content: [
      {
        type: 'text' as const,
        text: `Marked and verified ${result.count || result.projects.length} project(s) reviewed.\n\n${lines.join('\n')}`,
      },
    ],
    structuredContent: {
      ...(result.reviewedAt ? { reviewedAt: result.reviewedAt } : {}),
      count: result.count ?? result.projects.length,
      projects: result.projects,
    },
  };
}

export async function handler(
  args: z.infer<typeof schema>,
  extra: ToolHandlerExtra,
) {
  try {
    const result = await markProjectsReviewed(args.projectIds);
    return buildResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error marking projects reviewed: ${message}`,
        },
      ],
      isError: true,
    };
  }
}
