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
 * through `children`.
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
    tags: z.array(taskTagSchema).optional(),
    childrenCount: z
      .number()
      .optional()
      .describe('Visible direct subtasks, present even when children are not expanded'),
    children: z.array(taskNodeSchema).optional(),
    childrenTruncated: z
      .boolean()
      .optional()
      .describe('True when expansion hit the node cap and stopped early'),
  }),
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
  tags?: Array<{
    id?: string;
    name: string;
    path?: string;
    ancestorIds?: string[];
  }>;
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
    note: z.string().optional(),
    taskCount: z.number().optional(),
    flagged: z.boolean().optional(),
    dueDate: z.string().nullable().optional(),
    deferDate: z.string().nullable().optional(),
    nextReviewDate: z.string().nullable().optional(),
    lastReviewDate: z.string().nullable().optional(),
    reviewInterval: reviewIntervalSchema.nullable().optional(),
  })
  .describe('A project as returned by the project reads');

export const tagSchema = z
  .object({
    id: z.string().describe('Stable OmniFocus tag ID'),
    name: z.string(),
    parentId: z.string().nullable().optional(),
    parentName: z.string().nullable().optional(),
    active: z.boolean().optional(),
    status: z.string().optional(),
    taskCount: z.number().optional(),
  })
  .describe('A tag as returned by the tag reads');

export const folderSchema = z
  .object({
    id: z.string().describe('Stable OmniFocus folder ID'),
    name: z.string(),
    parentId: z.string().nullable().optional(),
    parentName: z.string().nullable().optional(),
    status: z.string().optional(),
    projectCount: z.number().optional(),
    subfolderCount: z.number().optional(),
  })
  .describe('A folder as returned by the folder reads');
