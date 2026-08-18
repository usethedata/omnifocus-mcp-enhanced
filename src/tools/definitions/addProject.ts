import { z } from 'zod';
import { addProject, AddProjectParams } from '../primitives/addProject.js';
import type { ToolHandlerExtra } from './toolHandler.js';

export const schema = z.object({
  name: z.string().max(1000).describe('The name of the project'),
  note: z.string().max(10000).optional().describe('Additional notes for the project'),
  dueDate: z
    .string().max(50)
    .optional()
    .describe(
      'The due date of the project in ISO format (YYYY-MM-DD or full ISO date)',
    ),
  deferDate: z
    .string().max(50)
    .optional()
    .describe(
      'The defer date of the project in ISO format (YYYY-MM-DD or full ISO date)',
    ),
  plannedDate: z
    .string().max(50)
    .optional()
    .describe(
      'The planned date of the project in ISO format (YYYY-MM-DD or full ISO date)',
    ),
  flagged: z
    .boolean()
    .optional()
    .describe('Whether the project is flagged or not'),
  estimatedMinutes: z
    .number()
    .optional()
    .describe('Estimated time to complete the project, in minutes'),
  tags: z
    .array(z.string().max(200)).max(50)
    .optional()
    .describe('Tags to assign to the project'),
  exclusiveTags: z
    .boolean()
    .optional()
    .describe(
      'Respect mutually exclusive tag groups when applying tags (default: true). When a tag belongs to an exclusive group, sibling tags from that group are removed.',
    ),
  folderName: z
    .string().max(1000)
    .optional()
    .describe(
      'The name of the folder to add the project to (will add to root if not specified)',
    ),
  sequential: z
    .boolean()
    .optional()
    .describe(
      'Whether tasks in the project should be sequential (default: false)',
    ),
});

/**
 * Success shape only. A failure returns `isError: true`, which the SDK exempts
 * from output validation.
 *
 * `projectId` is required for the same reason as `add_omnifocus_task`: without
 * it the caller cannot reference what was just created.
 */
export const outputSchema = z.object({
  projectId: z.string().describe('Stable OmniFocus ID of the created project'),
  removedSiblings: z
    .array(z.string())
    .optional()
    .describe('Tags dropped because they share an exclusive group with a new tag'),
  missingTags: z
    .array(z.string())
    .optional()
    .describe('Requested tags that do not exist and were not created'),
});

/**
 * Maps a primitive result to the tool result. Exported so the mapping — in
 * particular that `structuredContent` satisfies `outputSchema` — is testable
 * without reaching OmniFocus.
 */
export function buildResult(
  args: z.infer<typeof schema>,
  result: Awaited<ReturnType<typeof addProject>>,
) {
  if (result.success && !result.projectId) {
    // OmniFocus reported success without an ID. The project may exist, but it
    // cannot be verified or referenced, so this is not a usable success.
    return {
      content: [
        {
          type: 'text' as const,
          text: `Created project "${args.name}" but OmniFocus returned no project ID, so it cannot be verified or referenced. Check OmniFocus for a project with this name before retrying.`,
        },
      ],
      isError: true,
    };
  }

  if (result.success && result.projectId) {
    // Project was added successfully
    let locationText = args.folderName
      ? `in folder "${args.folderName}"`
      : 'at the root level';

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

    let sequentialText = args.sequential ? ' (sequential)' : ' (parallel)';

    let exclusivityText =
      result.removedSiblings && result.removedSiblings.length > 0
        ? `\nRemoved mutually exclusive tags: ${result.removedSiblings.join(', ')}`
        : '';

    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Project "${args.name}" created successfully ${locationText}${dueDateText}${plannedDateText}${tagText}${sequentialText}.\n\nid: ${result.projectId}${exclusivityText}`,
        },
      ],
      structuredContent: {
        projectId: result.projectId,
        ...(result.removedSiblings
          ? { removedSiblings: result.removedSiblings }
          : {}),
        ...(result.missingTags ? { missingTags: result.missingTags } : {}),
      },
    };
  }

  // Project creation failed
  return {
    content: [
      {
        type: 'text' as const,
        text: `Failed to create project: ${result.error}`,
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
    // Call the addProject function
    const result = await addProject(args as AddProjectParams);
    return buildResult(args, result);
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`Tool execution error: ${error.message}`);
    return {
      content: [
        {
          type: 'text' as const,
          text: `Error creating project: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
}
