import { z } from 'zod';
import {
  batchEditItems,
  type BatchEditItemsParams,
} from '../primitives/batchEditItems.js';
import type { ToolHandlerExtra } from './toolHandler.js';

const SHIFT_DESCRIPTION =
  'Signed offset applied to the task\'s current value: [+-]<integer><d|w|m>, e.g. "+1w", "-3d", "+2m". Month shifts clamp to the target month end (31 Jan +1m lands in February). Fails if the task has no value in that field.';

const tagArray = z.array(z.string().min(1));

const itemSchema = z
  .object({
    taskId: z.string().min(1).describe('Stable OmniFocus task ID'),
    name: z.string().optional().describe('New task name; must not be empty'),
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

    const editable = Object.keys(item).filter((key) => key !== 'taskId');
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
        'Tasks to edit, each named by stable ID and carrying only the fields it changes. A field left out is untouched; an explicit null clears it. List each task once.',
      ),
    dryRun: z
      .boolean()
      .optional()
      .describe(
        'Compute and return the full diff without writing anything. Use this to confirm a large edit before applying it.',
      ),
  })
  .strict();

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
          text: `Failed to edit tasks [${result.code || 'EDIT_FAILED'}]: ${result.error || 'Unknown error'}${restored}`,
        },
      ],
      isError: true,
    };
  }

  const count = result.items?.length || 0;
  const changeCount =
    result.items?.reduce((total, item) => total + item.changes.length, 0) || 0;

  const heading = result.dryRun
    ? `🔍 Dry run — nothing written. ${count} task(s), ${changeCount} field change(s) would apply:`
    : `✅ Edited ${count} task(s), ${changeCount} field change(s) verified:`;

  const details = result.items
    ?.map((item, index) => {
      const lines = item.changes.map((change) => {
        const before = change.before === null ? '(none)' : change.before;
        const after = change.after === null ? '(none)' : change.after;
        return `   ${change.field}: ${before} → ${after}`;
      });
      return [`${index + 1}. ${item.name} [${item.taskId}]`, ...lines].join('\n');
    })
    .join('\n');

  return {
    content: [
      {
        type: 'text' as const,
        text: `${heading}\n\n${details}`,
      },
    ],
  };
}
