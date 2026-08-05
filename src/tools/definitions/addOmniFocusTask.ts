import { z } from 'zod';
import {
  addOmniFocusTask,
  AddOmniFocusTaskParams,
  type AddOmniFocusTaskResult,
} from '../primitives/addOmniFocusTask.js';
import type { ToolHandlerExtra } from './toolHandler.js';

export const schema = z.object({
  name: z.string().describe('The name of the task'),
  note: z.string().optional().describe('Additional notes for the task'),
  dueDate: z
    .string()
    .optional()
    .describe(
      'The due date of the task in ISO format (YYYY-MM-DD or full ISO date)',
    ),
  deferDate: z
    .string()
    .optional()
    .describe(
      'The defer date of the task in ISO format (YYYY-MM-DD or full ISO date)',
    ),
  plannedDate: z
    .string()
    .optional()
    .describe(
      'The planned date of the task in ISO format (YYYY-MM-DD or full ISO date)',
    ),
  flagged: z
    .boolean()
    .optional()
    .describe('Whether the task is flagged or not'),
  estimatedMinutes: z
    .number()
    .optional()
    .describe('Estimated time to complete the task, in minutes'),
  tags: z.array(z.string()).optional().describe('Tags to assign to the task'),
  exclusiveTags: z
    .boolean()
    .optional()
    .describe(
      'Respect mutually exclusive tag groups when applying tags (default: true). When a tag belongs to an exclusive group, sibling tags from that group are removed.',
    ),
  projectName: z
    .string()
    .optional()
    .describe(
      'The name of the project to add the task to (will add to inbox if not specified)',
    ),
  parentTaskId: z
    .string()
    .optional()
    .describe('The ID of the parent task to create this task as a subtask'),
  parentTaskName: z
    .string()
    .optional()
    .describe(
      'The name of the parent task to create this task as a subtask (alternative to parentTaskId)',
    ),
  repetition: z
    .object({
      ruleString: z
        .string()
        .min(1)
        .describe(
          'ICS recurrence rule, e.g. FREQ=WEEKLY;BYDAY=FR. Encode UNTIL/COUNT here.',
        ),
      scheduleType: z
        .enum(['Regularly', 'FromCompletion'])
        .optional()
        .describe(
          'How the next occurrence is scheduled; omitted uses the OmniFocus default.',
        ),
      anchorDateKey: z
        .enum(['DueDate', 'DeferDate', 'PlannedDate'])
        .optional()
        .describe('Which date advances when the task repeats.'),
      catchUpAutomatically: z
        .boolean()
        .optional()
        .describe('Skip missed occurrences when the task is resolved.'),
    })
    .strict()
    .optional()
    .describe(
      'Recurrence applied and verified after creation. Verification failure removes the created task.',
    ),
});

/**
 * Success shape only. A failure returns `isError: true`, which the SDK exempts
 * from output validation.
 *
 * `taskId` is required: a tool whose job is to mint an identifier has not
 * completed its contract if it cannot report one, so the handler routes a
 * missing ID to the error path rather than reporting a success the caller
 * cannot act on.
 */
export const outputSchema = z.object({
  taskId: z.string().describe('Stable OmniFocus ID of the created task'),
  removedSiblings: z
    .array(z.string())
    .optional()
    .describe('Tags dropped because they share an exclusive group with a new tag'),
  missingTags: z
    .array(z.string())
    .optional()
    .describe('Requested tags that do not exist and were not created'),
  repetition: z
    .object({
      ruleString: z.string().optional(),
      scheduleType: z.string().optional(),
      anchorDateKey: z.string().optional(),
      catchUpAutomatically: z.boolean().optional(),
      nextOccurrence: z.string().nullable().optional(),
    })
    .optional()
    .describe('Recurrence applied and verified after creation'),
});

/**
 * Maps a primitive result to the tool result. Exported so the mapping — in
 * particular that `structuredContent` satisfies `outputSchema` — is testable
 * without reaching OmniFocus.
 */
export function buildResult(
  args: z.infer<typeof schema>,
  result: AddOmniFocusTaskResult,
) {
  if (result.success && !result.taskId) {
    // OmniFocus reported success without an ID. The task may exist, but it
    // cannot be verified or referenced, so this is not a usable success.
    return {
      content: [
        {
          type: 'text' as const,
          text: `Created task "${args.name}" but OmniFocus returned no task ID, so it cannot be verified or referenced. Check OmniFocus for a task with this name before retrying.`,
        },
      ],
      isError: true,
    };
  }

  if (result.success && result.taskId) {
    // Task was added successfully
    let locationText;
    if (args.parentTaskId || args.parentTaskName) {
      const parentRef = args.parentTaskId || args.parentTaskName;
      locationText = `as a subtask of "${parentRef}"`;
    } else if (args.projectName) {
      locationText = `in project "${args.projectName}"`;
    } else {
      locationText = 'in your inbox';
    }

    let tagText =
      args.tags && args.tags.length > 0
        ? ` with tags: ${args.tags.join(', ')}`
        : '';

    let dueDateText = args.dueDate
      ? ` due on ${new Date(args.dueDate).toLocaleDateString()}`
      : '';

    let plannedDateText = args.plannedDate
      ? ` planned for ${new Date(args.plannedDate).toLocaleDateString()}`
      : '';

    let exclusivityText =
      result.removedSiblings && result.removedSiblings.length > 0
        ? `\nRemoved mutually exclusive tags: ${result.removedSiblings.join(', ')}`
        : '';
    const repetitionText = result.repetition
      ? `\nRepeats: ${result.repetition.ruleString} (${result.repetition.scheduleType}, anchor ${result.repetition.anchorDateKey})` +
        (result.repetition.nextOccurrence
          ? `\nNext occurrence: ${new Date(result.repetition.nextOccurrence).toLocaleString()}`
          : '')
      : '';

    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Task "${args.name}" created successfully ${locationText}${dueDateText}${plannedDateText}${tagText}.\n\nid: ${result.taskId}${exclusivityText}${repetitionText}`,
        },
      ],
      structuredContent: {
        taskId: result.taskId,
        ...(result.removedSiblings
          ? { removedSiblings: result.removedSiblings }
          : {}),
        ...(result.missingTags ? { missingTags: result.missingTags } : {}),
        ...(result.repetition ? { repetition: result.repetition } : {}),
      },
    };
  }

  // Task creation failed
  return {
    content: [
      {
        type: 'text' as const,
        text: `Failed to create task${result.code ? ` [${result.code}]` : ''}: ${result.error}`,
      },
    ],
    isError: true,
  };
}

export async function handler(
  args: z.infer<typeof schema>,
  extra: ToolHandlerExtra,
) {
  try {
    // Call the addOmniFocusTask function
    const result = await addOmniFocusTask(args as AddOmniFocusTaskParams);
    return buildResult(args, result);
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Tool execution error: ${error.message}`);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error creating task: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}
