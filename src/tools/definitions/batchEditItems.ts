import { z } from 'zod';
import {
  batchEditItems,
  REVIEW_UNITS,
  type BatchEditItemsParams,
} from '../primitives/batchEditItems.js';
import type { ToolHandlerExtra } from './toolHandler.js';

const SHIFT_DESCRIPTION =
  'Signed offset applied to the current value: [+-]<integer><d|w|m>, e.g. "+1w", "-3d", "+2m". Month shifts clamp to the target month end (31 Jan +1m lands in February). Fails if the item has no value in that field.';

const tagArray = z.array(z.string().min(1));

const itemSchema = z
  .object({
    taskId: z
      .string()
      .min(1)
      .optional()
      .describe('Stable OmniFocus task ID. Set exactly one of taskId or projectId.'),
    projectId: z
      .string()
      .min(1)
      .optional()
      .describe(
        'Stable OmniFocus project ID. Set exactly one of taskId or projectId. A project ID and its root task ID are the same string, so passing a project ID as taskId is rejected.',
      ),
    name: z.string().optional().describe('New name; must not be empty'),
    note: z
      .string()
      .optional()
      .describe('Replace the note. Use append_to_note to add without replacing.'),
    dueDate: z
      .string()
      .nullable()
      .optional()
      .describe('Absolute due date, or null to clear it'),
    deferDate: z
      .string()
      .nullable()
      .optional()
      .describe('Absolute defer date, or null to clear it'),
    plannedDate: z
      .string()
      .nullable()
      .optional()
      .describe('Absolute planned date, or null to clear it'),
    dueDateShift: z.string().optional().describe(SHIFT_DESCRIPTION),
    deferDateShift: z.string().optional().describe(SHIFT_DESCRIPTION),
    plannedDateShift: z.string().optional().describe(SHIFT_DESCRIPTION),
    flagged: z.boolean().optional().describe('Set or clear the flag'),
    estimatedMinutes: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional()
      .describe(
        'Estimated minutes. null clears the estimate; 0 stores a zero-minute estimate.',
      ),
    addTags: tagArray
      .optional()
      .describe(
        'Tag names to add. Mutually exclusive tag groups are honoured: sibling tags from the same group are removed first.',
      ),
    removeTags: tagArray.optional().describe('Tag names to remove'),
    replaceTags: tagArray
      .optional()
      .describe(
        'Tag names to replace all current tags with. Cannot combine with addTags or removeTags.',
      ),
    reviewInterval: z
      .object({
        steps: z
          .number()
          .int()
          .min(1)
          .describe('How many units between reviews; at least 1'),
        unit: z
          .enum(REVIEW_UNITS)
          .describe(
            'Plural form only. OmniFocus silently discards the whole interval on any other spelling.',
          ),
      })
      .strict()
      .optional()
      .describe(
        'Projects only. Sets the review cadence; OmniFocus recomputes the next review date. The interval cannot be cleared.',
      ),
  })
  .strict()
  .superRefine((item, ctx) => {
    const dateFields = ['dueDate', 'deferDate', 'plannedDate'] as const;
    for (const field of dateFields) {
      const shiftKey = `${field}Shift` as const;
      if (field in item && shiftKey in item) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [shiftKey],
          message: `Set either ${field} or ${shiftKey}, not both`,
        });
      }
    }

    if ('replaceTags' in item && ('addTags' in item || 'removeTags' in item)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['replaceTags'],
        message: 'replaceTags cannot be combined with addTags or removeTags',
      });
    }

    if (item.name !== undefined && item.name.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['name'],
        message: 'name must not be empty',
      });
    }

    const hasTaskId = 'taskId' in item && item.taskId !== undefined;
    const hasProjectId = 'projectId' in item && item.projectId !== undefined;

    if (hasTaskId && hasProjectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['projectId'],
        message: 'Set either taskId or projectId, not both',
      });
    }
    if (!hasTaskId && !hasProjectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taskId'],
        message: 'Each item requires a taskId or a projectId',
      });
    }

    if ('reviewInterval' in item && !hasProjectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewInterval'],
        message: 'reviewInterval applies to projects; use projectId',
      });
    }

    const editable = Object.keys(item).filter(
      (key) => key !== 'taskId' && key !== 'projectId',
    );
    if (editable.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['taskId'],
        message: 'every item must set at least one field to change',
      });
    }
  });

export const schema = z
  .object({
    items: z
      .array(itemSchema)
      .min(1)
      .max(100)
      .describe(
        'Tasks and projects to edit, each named by one stable ID and carrying only the fields it changes. A field left out is untouched; an explicit null clears it. List each object once.',
      ),
    dryRun: z
      .boolean()
      .optional()
      .describe(
        'Compute and return the full diff without writing anything. Use this to confirm a large edit before applying it.',
      ),
  })
  .strict();

/**
 * Success shape only. A failure returns `isError: true`, which the SDK exempts
 * from output validation.
 */
export const outputSchema = z.object({
  dryRun: z
    .boolean()
    .describe('True when nothing was written and the diff is a preview'),
  items: z
    .array(
      z.object({
        taskId: z.string().optional().describe('Set when the item was a task'),
        projectId: z
          .string()
          .optional()
          .describe('Set when the item was a project'),
        name: z.string().describe('The object name after the edit'),
        changes: z
          .array(
            z.object({
              field: z.string(),
              before: z.string().nullable(),
              after: z.string().nullable(),
            }),
          )
          .describe('Verified per-field before and after values'),
      }),
    )
    .describe('One entry per edited object, in request order'),
});

export async function handler(
  args: z.infer<typeof schema>,
  extra: ToolHandlerExtra,
) {
  const result = await batchEditItems(args as BatchEditItemsParams);

  if (!result.success) {
    const restored = result.restored ? '\nAll previous values restored.' : '';
    return {
      content: [
        {
          type: 'text' as const,
          text: `Failed to edit [${result.code || 'EDIT_FAILED'}]: ${result.error || 'Unknown error'}${restored}`,
        },
      ],
      isError: true,
    };
  }

  const count = result.items?.length || 0;
  const changeCount =
    result.items?.reduce((total, item) => total + item.changes.length, 0) || 0;

  const heading = result.dryRun
    ? `🔍 Dry run — nothing written. ${count} item(s), ${changeCount} field change(s) would apply:`
    : `✅ Edited ${count} item(s), ${changeCount} field change(s) verified:`;

  const details = result.items
    ?.map((item, index) => {
      const lines = item.changes.map((change) => {
        const before = change.before === null ? '(none)' : change.before;
        const after = change.after === null ? '(none)' : change.after;
        return `   ${change.field}: ${before} → ${after}`;
      });
      const id = item.projectId ?? item.taskId ?? '';
      const kind = item.projectId ? 'project' : 'task';
      return [`${index + 1}. ${item.name} [${kind} ${id}]`, ...lines].join('\n');
    })
    .join('\n');

  return {
    content: [
      {
        type: 'text' as const,
        text: `${heading}\n\n${details}`,
      },
    ],
    structuredContent: {
      dryRun: result.dryRun === true,
      items: result.items ?? [],
    },
  };
}
