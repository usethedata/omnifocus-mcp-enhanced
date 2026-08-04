import { z } from 'zod';
import { getInboxTasks } from '../primitives/getInboxTasks.js';
import { getFlaggedTasks } from '../primitives/getFlaggedTasks.js';
import { getForecastTasks } from '../primitives/getForecastTasks.js';
import { getTasksByTag } from '../primitives/getTasksByTag.js';
import { getCustomPerspectiveTasks } from '../primitives/getCustomPerspectiveTasks.js';
import { resolveCustomPerspectiveDisplayMode } from './getCustomPerspectiveTasks.js';
import type { ToolHandlerExtra } from './toolHandler.js';
import { taskNodeSchema } from './sharedOutputSchemas.js';
import type { TaskTreeNode } from '../primitives/taskTreeFormatter.js';

const inputSchema = z
  .object({
    source: z
      .enum(['inbox', 'flagged', 'forecast', 'tag', 'custom'])
      .describe(
        'Task view to read. Each source accepts only its documented source-specific parameters.',
      ),
    tagName: z
      .string()
      .min(1)
      .optional()
      .describe('Required when source is tag.'),
    perspectiveName: z
      .string()
      .min(1)
      .optional()
      .describe('Required when source is custom.'),
    days: z
      .number()
      .int()
      .min(1)
      .max(30)
      .optional()
      .describe('Forecast lookahead days (default: 7; forecast only).'),
    hideCompleted: z
      .boolean()
      .optional()
      .describe('Hide completed tasks (default: true; all sources).'),
    projectFilter: z
      .string()
      .optional()
      .describe('Filter by project name (flagged only).'),
    exactMatch: z
      .boolean()
      .optional()
      .describe('Require an exact tag match (default: false; tag only).'),
    showSubtasks: z
      .boolean()
      .optional()
      .describe('Expand each matching task subtask tree (not custom).'),
    maxSubtaskDepth: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('Maximum subtask levels to expand (not custom).'),
    displayMode: z
      .enum(['project_tree', 'task_tree', 'flat'])
      .optional()
      .describe('Custom perspective display mode (custom only).'),
    showHierarchy: z
      .boolean()
      .optional()
      .describe('Legacy custom perspective hierarchy option (custom only).'),
    groupByProject: z
      .boolean()
      .optional()
      .describe('Legacy custom perspective grouping option (custom only).'),
    includeDeferredOnly: z
      .boolean()
      .optional()
      .describe('Show only deferred tasks becoming available (forecast only).'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(1000)
      .optional()
      .describe('Maximum tasks in flat custom perspective mode (custom only).'),
  })
  .strict();

export const inputShape = inputSchema.shape;

const SOURCE_FIELDS: Record<
  z.infer<typeof inputSchema>['source'],
  Record<string, true>
> = {
  inbox: {
    source: true,
    hideCompleted: true,
    showSubtasks: true,
    maxSubtaskDepth: true,
  },
  flagged: {
    source: true,
    hideCompleted: true,
    projectFilter: true,
    showSubtasks: true,
    maxSubtaskDepth: true,
  },
  forecast: {
    source: true,
    hideCompleted: true,
    days: true,
    includeDeferredOnly: true,
    showSubtasks: true,
    maxSubtaskDepth: true,
  },
  tag: {
    source: true,
    hideCompleted: true,
    tagName: true,
    exactMatch: true,
    showSubtasks: true,
    maxSubtaskDepth: true,
  },
  custom: {
    source: true,
    hideCompleted: true,
    perspectiveName: true,
    displayMode: true,
    showHierarchy: true,
    groupByProject: true,
    limit: true,
  },
};

export const schema = inputSchema.superRefine((args, ctx) => {
  if (args.source === 'tag' && !args.tagName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['tagName'],
      message: 'tagName is required when source is tag',
    });
  }
  if (args.source === 'custom' && !args.perspectiveName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['perspectiveName'],
      message: 'perspectiveName is required when source is custom',
    });
  }

  const allowed = SOURCE_FIELDS[args.source];
  for (const [key, value] of Object.entries(args)) {
    if (value !== undefined && !allowed[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is not valid when source is ${args.source}`,
      });
    }
  }
});

/**
 * Success shape only. A failure returns `isError: true`, which the SDK exempts
 * from output validation.
 *
 * `tasks` is present for every source so an assistant can pull IDs without
 * branching on `source`. The source-specific fields are optional.
 */
export const outputSchema = z.object({
  source: z.enum(['inbox', 'flagged', 'forecast', 'tag', 'custom']),
  count: z.number().int().describe('How many tasks are in `tasks`'),
  tasks: z
    .array(taskNodeSchema)
    .describe('The tasks the text describes, flattened across any grouping'),
  totalCount: z
    .number()
    .int()
    .optional()
    .describe('custom source: total the perspective reported'),
  groups: z
    .array(z.object({ date: z.string(), tasks: z.array(taskNodeSchema) }))
    .optional()
    .describe('forecast source: the same tasks kept grouped by date'),
  matchedTags: z
    .array(z.string())
    .optional()
    .describe('tag source: tag names the query resolved to'),
  availableTags: z
    .array(z.string())
    .optional()
    .describe('tag source: suggestions returned when nothing matched'),
});

interface GetTasksDependencies {
  getInboxTasks: typeof getInboxTasks;
  getFlaggedTasks: typeof getFlaggedTasks;
  getForecastTasks: typeof getForecastTasks;
  getTasksByTag: typeof getTasksByTag;
  getCustomPerspectiveTasks: typeof getCustomPerspectiveTasks;
}

const defaultDependencies: GetTasksDependencies = {
  getInboxTasks,
  getFlaggedTasks,
  getForecastTasks,
  getTasksByTag,
  getCustomPerspectiveTasks,
};

function validationError(error: z.ZodError) {
  return {
    content: [
      {
        type: 'text' as const,
        text: `Invalid get_tasks arguments: ${error.issues
          .map((issue) => issue.message)
          .join('; ')}`,
      },
    ],
    isError: true,
  };
}

export function createHandler(dependencies: GetTasksDependencies) {
  return async (rawArgs: z.input<typeof inputSchema>, _extra: ToolHandlerExtra) => {
    const parsed = schema.safeParse(rawArgs);
    if (!parsed.success) return validationError(parsed.error);
    const args = parsed.data;

    try {
      const hideCompleted = args.hideCompleted !== false;
      const showSubtasks = args.showSubtasks === true;
      let text: string;
      let tasks: TaskTreeNode[] = [];
      const extras: Record<string, unknown> = {};

      switch (args.source) {
        case 'inbox': {
          const result = await dependencies.getInboxTasks({
            hideCompleted,
            showSubtasks,
            maxSubtaskDepth: args.maxSubtaskDepth,
          });
          text = result.text;
          tasks = result.tasks;
          break;
        }
        case 'flagged': {
          const result = await dependencies.getFlaggedTasks({
            hideCompleted,
            projectFilter: args.projectFilter,
            showSubtasks,
            maxSubtaskDepth: args.maxSubtaskDepth,
          });
          text = result.text;
          tasks = result.tasks;
          break;
        }
        case 'forecast': {
          const result = await dependencies.getForecastTasks({
            days: args.days ?? 7,
            hideCompleted,
            includeDeferredOnly: args.includeDeferredOnly ?? false,
            showSubtasks,
            maxSubtaskDepth: args.maxSubtaskDepth,
          });
          text = result.text;
          tasks = result.tasks;
          extras.groups = result.groups;
          break;
        }
        case 'tag': {
          const result = await dependencies.getTasksByTag({
            tagName: args.tagName!,
            hideCompleted,
            exactMatch: args.exactMatch ?? false,
            showSubtasks,
            maxSubtaskDepth: args.maxSubtaskDepth,
          });
          text = result.text;
          tasks = result.tasks;
          extras.matchedTags = result.matchedTags;
          extras.availableTags = result.availableTags;
          break;
        }
        case 'custom': {
          const result = await dependencies.getCustomPerspectiveTasks({
            perspectiveName: args.perspectiveName!,
            hideCompleted,
            limit: args.limit ?? 1000,
            displayMode: resolveCustomPerspectiveDisplayMode(args),
            showHierarchy: args.showHierarchy ?? false,
            groupByProject: args.groupByProject !== false,
          });
          text = result.text;
          tasks = result.tasks;
          extras.totalCount = result.totalCount;
          break;
        }
      }

      return {
        content: [{ type: 'text' as const, text }],
        structuredContent: {
          source: args.source,
          count: tasks.length,
          tasks,
          ...extras,
        },
      };
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error getting tasks (${args.source}): ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  };
}

export const handler = createHandler(defaultDependencies);
