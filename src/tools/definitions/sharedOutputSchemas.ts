import { z } from 'zod';

/**
 * Output-schema pieces shared by more than one read tool.
 *
 * Every field optional in the corresponding TypeScript interface stays optional
 * here. The SDK validates `structuredContent` against these schemas and throws
 * on a mismatch, so demanding a field a script omits on some path would turn a
 * working read into a hard error.
 */

export const taskTagSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    path: z
      .string()
      .optional()
      .describe('Full tag path when the tag is nested, e.g. "Energy > High"'),
    ancestorIds: z.array(z.string()).optional(),
  })
  .describe('A tag assigned to a task');

/**
 * Mirrors TaskTreeNode in primitives/taskTreeFormatter.ts, which is recursive
 * through `children`, and is a superset of it: the custom-perspective read
 * serializes a different node type, so its completion fields appear here as
 * optional rather than forcing `get_tasks` to return two task shapes.
 */
export const taskNodeSchema: z.ZodType<TaskNodeShape> = z.lazy(() =>
  z.object({
    id: z.string().describe('Stable OmniFocus task ID'),
    name: z.string(),
    note: z.string().optional(),
    taskStatus: z.string().optional(),
    flagged: z.boolean().optional(),
    dueDate: z.string().nullable().optional(),
    deferDate: z.string().nullable().optional(),
    plannedDate: z.string().nullable().optional(),
    estimatedMinutes: z.number().nullable().optional(),
    projectId: z.string().nullable().optional(),
    projectName: z.string().nullable().optional(),
    parentId: z.string().nullable().optional(),
    inInbox: z.boolean().optional(),
    isRepeating: z.boolean().optional(),
    isDue: z.boolean().optional(),
    tags: z.array(taskTagSchema).optional(),
    completed: z.boolean().optional(),
    dropped: z.boolean().optional(),
    completionDate: z.string().nullable().optional(),
    creationDate: z.string().nullable().optional(),
    completedDate: z.string().nullable().optional(),
    createdDate: z.string().nullable().optional(),
    modifiedDate: z.string().nullable().optional(),
    childrenCount: z
      .number()
      .optional()
      .describe('Visible direct subtasks, present even when children are not expanded'),
    children: z.array(taskNodeSchema).optional(),
    childrenTruncated: z
      .boolean()
      .optional()
      .describe('True when expansion hit the node cap and stopped early'),
  }).passthrough(),
);

export interface TaskNodeShape {
  id: string;
  name: string;
  note?: string;
  taskStatus?: string;
  flagged?: boolean;
  dueDate?: string | null;
  deferDate?: string | null;
  plannedDate?: string | null;
  estimatedMinutes?: number | null;
  projectId?: string | null;
  projectName?: string | null;
  parentId?: string | null;
  inInbox?: boolean;
  isRepeating?: boolean;
  isDue?: boolean;
  tags?: Array<{
    id?: string;
    name: string;
    path?: string;
    ancestorIds?: string[];
  }>;
  completed?: boolean;
  dropped?: boolean;
  completionDate?: string | null;
  creationDate?: string | null;
  completedDate?: string | null;
  createdDate?: string | null;
  modifiedDate?: string | null;
  childrenCount?: number;
  children?: TaskNodeShape[];
  childrenTruncated?: boolean;
}

export const reviewIntervalSchema = z
  .object({
    steps: z.number().int(),
    unit: z.string(),
  })
  .describe(
    'Review cadence. OmniJS exposes only steps and unit, so no `fixed` field is reported.',
  );

export const projectSchema = z
  .object({
    id: z.string().describe('Stable OmniFocus project ID'),
    name: z.string(),
    status: z.string().optional(),
    folderName: z.string().nullable().optional(),
    folderID: z.string().nullable().optional(),
    sequential: z.boolean().optional(),
    note: z.string().optional(),
    taskCount: z.number().optional(),
    flagged: z.boolean().optional(),
    dueDate: z.string().nullable().optional(),
    deferDate: z.string().nullable().optional(),
    effectiveDueDate: z.string().nullable().optional(),
    effectiveDeferDate: z.string().nullable().optional(),
    completedByChildren: z.boolean().optional(),
    containsSingletonActions: z.boolean().optional(),
    nextReviewDate: z.string().nullable().optional(),
    lastReviewDate: z.string().nullable().optional(),
    reviewInterval: reviewIntervalSchema.nullable().optional(),
  })
  .passthrough()
  .describe('A project as returned by the project reads');

/** Field names follow OmniFocusTagSummary in primitives/listTags.ts. */
export const tagSchema = z
  .object({
    id: z.string().describe('Stable OmniFocus tag ID'),
    name: z.string(),
    parentTagID: z.string().nullable().optional(),
    active: z.boolean().optional(),
  })
  .describe('A tag as returned by the tag reads');

/** Field names follow OmniFocusFolderSummary in primitives/listFolders.ts. */
export const folderSchema = z
  .object({
    id: z.string().describe('Stable OmniFocus folder ID'),
    name: z.string(),
    parentFolderID: z.string().nullable().optional(),
    status: z.string().optional(),
    projectCount: z.number().optional(),
  })
  .describe('A folder as returned by the folder reads');
