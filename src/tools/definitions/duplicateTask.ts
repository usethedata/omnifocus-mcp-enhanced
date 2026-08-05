import { z } from 'zod';
import {
  duplicateTask,
  DuplicateTaskParams,
} from '../primitives/duplicateTask.js';
import type { ToolHandlerExtra } from './toolHandler.js';

export const schema = z.object({
  taskId: z.string().optional().describe('The ID of the task to duplicate'),
  taskName: z
    .string()
    .optional()
    .describe(
      'The name of the task to duplicate (as fallback if ID not provided)',
    ),
  newName: z
    .string()
    .optional()
    .describe(
      'Optional new name for the duplicated task (keeps the original name if omitted)',
    ),
  includeSubtasks: z
    .boolean()
    .optional()
    .describe(
      "Whether to include the task's subtasks in the copy (default: true)",
    ),
});

/**
 * Success shape only. A failure returns `isError: true`, which the SDK exempts
 * from output validation.
 *
 * `newTaskId` is required; `name` and `childrenCount` stay optional because the
 * script result carries them alongside the ID and may omit either.
 */
export const outputSchema = z.object({
  newTaskId: z
    .string()
    .describe('Stable OmniFocus ID of the duplicated task'),
  name: z.string().optional().describe('Name of the duplicated task'),
  childrenCount: z
    .number()
    .int()
    .optional()
    .describe('Subtasks copied along with the task'),
});

/**
 * Maps a primitive result to the tool result. Exported so the mapping — in
 * particular that `structuredContent` satisfies `outputSchema` — is testable
 * without reaching OmniFocus.
 */
export function buildResult(
  result: Awaited<ReturnType<typeof duplicateTask>>,
) {
  if (result.success && !result.newTaskId) {
    // The copy may exist, but without an ID it cannot be verified or
    // referenced, so this is not a usable success.
    return {
      content: [
        {
          type: 'text' as const,
          text: 'Duplicated the task but OmniFocus returned no ID for the copy, so it cannot be verified or referenced. Check OmniFocus before retrying.',
        },
      ],
      isError: true,
    };
  }

  if (result.success && result.newTaskId) {
    const subtaskText =
      result.childrenCount && result.childrenCount > 0
        ? ` with ${result.childrenCount} subtask(s)`
        : '';
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Duplicated task as "${result.name}"${subtaskText}.\n\nid: ${result.newTaskId}`,
        },
      ],
      structuredContent: {
        newTaskId: result.newTaskId,
        ...(result.name !== undefined ? { name: result.name } : {}),
        ...(result.childrenCount !== undefined
          ? { childrenCount: result.childrenCount }
          : {}),
      },
    };
  }

  return {
    content: [
      {
        type: 'text' as const,
        text: `Failed to duplicate task: ${result.error}`,
      },
    ],
    isError: true,
  };
}

export async function handler(
  args: z.infer<typeof schema>,
  _extra: ToolHandlerExtra,
) {
  try {
    if (!args.taskId && !args.taskName) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Either taskId or taskName must be provided to duplicate a task.',
          },
        ],
        isError: true,
      };
    }

    const result = await duplicateTask(args as DuplicateTaskParams);
    return buildResult(result);
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Tool execution error: ${error.message}`);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error duplicating task: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}
