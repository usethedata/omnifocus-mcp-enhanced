import { executeOmniFocusScript } from '../../utils/scriptExecution.js';

export type ShiftUnit = 'd' | 'w' | 'm';

export const REVIEW_UNITS = ['days', 'weeks', 'months', 'years'] as const;
export type ReviewUnit = (typeof REVIEW_UNITS)[number];

export interface ReviewIntervalInput {
  steps: number;
  unit: ReviewUnit;
}

export interface BatchEditItem {
  /** Exactly one of taskId or projectId. A project's ID equals its root task's ID. */
  taskId?: string;
  projectId?: string;
  name?: string;
  note?: string;
  dueDate?: string | null;
  deferDate?: string | null;
  plannedDate?: string | null;
  dueDateShift?: string;
  deferDateShift?: string;
  plannedDateShift?: string;
  flagged?: boolean;
  estimatedMinutes?: number | null;
  addTags?: string[];
  removeTags?: string[];
  replaceTags?: string[];
  /** Projects only. Cannot be cleared; OmniFocus rejects a null interval. */
  reviewInterval?: ReviewIntervalInput;
}

export interface BatchEditItemsParams {
  items: BatchEditItem[];
  dryRun?: boolean;
}

export type EditErrorCode =
  | 'INVALID_EDIT'
  | 'EDIT_FAILED_RESTORED'
  | 'EDIT_VERIFICATION_FAILED_RESTORED'
  | 'EDIT_RESTORE_UNCONFIRMED';

export interface BatchEditChange {
  field: string;
  before: string | null;
  after: string | null;
}

export interface BatchEditItemsResult {
  success: boolean;
  code?: EditErrorCode;
  error?: string;
  restored?: boolean;
  dryRun?: boolean;
  items?: Array<{
    taskId?: string;
    projectId?: string;
    name: string;
    changes: BatchEditChange[];
  }>;
}

export const DATE_FIELDS = ['dueDate', 'deferDate', 'plannedDate'] as const;
export type DateField = (typeof DATE_FIELDS)[number];

const EDITABLE_KEYS = [
  'name',
  'note',
  'dueDate',
  'deferDate',
  'plannedDate',
  'dueDateShift',
  'deferDateShift',
  'plannedDateShift',
  'flagged',
  'estimatedMinutes',
  'addTags',
  'removeTags',
  'replaceTags',
  'reviewInterval',
] as const;

const SHIFT_PATTERN = /^([+-])(\d+)([dwm])$/;

export interface ParsedShift {
  amount: number;
  unit: ShiftUnit;
}

/**
 * Parse a signed offset such as `+1w` or `-3d`.
 *
 * A zero offset is rejected: it changes nothing, so accepting it would let a
 * request report success for work it never did.
 */
export function parseShift(
  raw: string,
): { shift: ParsedShift } | { error: string } {
  const match = SHIFT_PATTERN.exec(raw);
  if (!match) {
    return {
      error: `invalid shift "${raw}"; expected a signed offset such as +1w, -3d, or +2m`,
    };
  }

  const magnitude = Number(match[2]);
  if (magnitude === 0) {
    return { error: `shift "${raw}" has no effect; use a non-zero offset` };
  }

  return {
    shift: {
      amount: match[1] === '-' ? -magnitude : magnitude,
      unit: match[3] as ShiftUnit,
    },
  };
}

function shiftFieldFor(field: DateField): keyof BatchEditItem {
  return `${field}Shift` as keyof BatchEditItem;
}

function validateItem(
  item: BatchEditItem,
  index: number,
): string | null {
  const position = `items[${index}]`;

  const hasTaskId = typeof item.taskId === 'string' && item.taskId.trim().length > 0;
  const hasProjectId =
    typeof item.projectId === 'string' && item.projectId.trim().length > 0;

  if (hasTaskId && hasProjectId) {
    return `${position} sets both taskId and projectId; each item names one object`;
  }
  if (!hasTaskId && !hasProjectId) {
    return `${position} requires a taskId or a projectId`;
  }

  if ('reviewInterval' in item) {
    if (!hasProjectId) {
      return `${position} reviewInterval applies to projects; use projectId`;
    }
    const interval = item.reviewInterval;
    if (!interval || typeof interval !== 'object') {
      return `${position} reviewInterval must be an object with steps and unit`;
    }
    // OmniFocus silently coerces 0 and fractional steps to 1, and silently
    // discards the whole assignment when the unit is not one of these four
    // plural forms. Neither is detectable by reading the value back.
    if (!Number.isInteger(interval.steps) || interval.steps < 1) {
      return `${position} reviewInterval.steps must be an integer of at least 1`;
    }
    if (!REVIEW_UNITS.includes(interval.unit)) {
      return `${position} reviewInterval.unit must be one of ${REVIEW_UNITS.join(', ')}`;
    }
  }

  const touched = EDITABLE_KEYS.filter((key) => key in item);
  if (touched.length === 0) {
    return `${position} changes nothing; every item must set at least one field`;
  }

  if (item.name !== undefined && item.name.trim().length === 0) {
    // OmniFocus stores an empty name without complaint, so this is the only
    // thing standing between a bulk edit and a set of nameless tasks.
    return `${position} name must not be empty`;
  }

  if (item.estimatedMinutes !== undefined && item.estimatedMinutes !== null) {
    const minutes = item.estimatedMinutes;
    if (!Number.isInteger(minutes) || minutes < 0) {
      return `${position} estimatedMinutes must be a non-negative integer or null`;
    }
  }

  for (const field of DATE_FIELDS) {
    const shiftKey = shiftFieldFor(field);
    const hasAbsolute = field in item;
    const hasShift = shiftKey in item;

    if (hasAbsolute && hasShift) {
      return `${position} sets both ${field} and ${String(shiftKey)}; use one or the other`;
    }

    if (hasShift) {
      const parsed = parseShift(String(item[shiftKey]));
      if ('error' in parsed) {
        return `${position} ${String(shiftKey)}: ${parsed.error}`;
      }
    }

    if (hasAbsolute) {
      const value = item[field];
      if (value !== null) {
        const parsedDate = new Date(String(value));
        if (Number.isNaN(parsedDate.getTime())) {
          return `${position} ${field} is not a valid date: ${String(value)}`;
        }
      }
    }
  }

  const hasReplace = 'replaceTags' in item;
  if (hasReplace && ('addTags' in item || 'removeTags' in item)) {
    return `${position} combines replaceTags with addTags or removeTags; use one approach`;
  }

  for (const key of ['addTags', 'removeTags', 'replaceTags'] as const) {
    const value = item[key];
    if (value === undefined) continue;
    if (value.some((tag) => typeof tag !== 'string' || tag.trim().length === 0)) {
      return `${position} ${key} must not contain empty tag names`;
    }
  }

  return null;
}

export function validateParams(
  params: BatchEditItemsParams,
): { valid: boolean; error?: string } {
  if (!params.items || params.items.length === 0) {
    return { valid: false, error: 'items array is required' };
  }

  if (params.items.length > 100) {
    return { valid: false, error: 'items array must not exceed 100 entries' };
  }

  const seen = new Set<string>();
  for (let index = 0; index < params.items.length; index += 1) {
    const item = params.items[index];
    const itemError = validateItem(item, index);
    if (itemError) {
      return { valid: false, error: itemError };
    }

    // A project's ID equals its root task's ID, so one set catches both an
    // ID repeated under the same key and the same ID reached through both keys.
    const id = item.taskId ?? item.projectId ?? '';
    if (seen.has(id)) {
      // Two edits to one object would make the result depend on array order.
      return {
        valid: false,
        error: `duplicate id ${id}; list each task or project once`,
      };
    }
    seen.add(id);
  }

  return { valid: true };
}

export async function batchEditItems(
  params: BatchEditItemsParams,
): Promise<BatchEditItemsResult> {
  const validation = validateParams(params);
  if (!validation.valid) {
    return {
      success: false,
      code: 'INVALID_EDIT',
      error: validation.error,
    };
  }

  const result = await executeOmniFocusScript('@batchEditItems.js', {
    items: params.items,
    dryRun: params.dryRun === true,
  });

  if (typeof result === 'string') {
    return {
      success: false,
      code: 'INVALID_EDIT',
      error: `Unexpected script output: ${result}`,
    };
  }

  return result as BatchEditItemsResult;
}
