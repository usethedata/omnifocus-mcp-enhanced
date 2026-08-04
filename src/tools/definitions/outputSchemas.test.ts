import assert from 'node:assert/strict';
import test from 'node:test';

import * as batchAddItems from './batchAddItems.js';
import * as batchCompleteTasks from './batchCompleteTasks.js';
import * as batchEditItems from './batchEditItems.js';
import * as batchMoveTasks from './batchMoveTasks.js';
import * as batchRemoveItems from './batchRemoveItems.js';
import * as countTasks from './countTasks.js';
import * as filterTasks from './filterTasks.js';

/**
 * The SDK throws when a tool declaring an output schema returns success without
 * matching `structuredContent` (mcp.js validateToolOutput). These tests run the
 * same validation against representative payloads so a schema cannot drift away
 * from what its handler builds.
 */
const MIGRATED = [
  { name: 'count_tasks', module: countTasks },
  { name: 'batch_add_items', module: batchAddItems },
  { name: 'batch_complete_tasks', module: batchCompleteTasks },
  { name: 'batch_edit_items', module: batchEditItems },
  { name: 'batch_move_tasks', module: batchMoveTasks },
  { name: 'batch_remove_items', module: batchRemoveItems },
  { name: 'filter_tasks', module: filterTasks },
];

test('every migrated tool exports an object output schema', () => {
  for (const { name, module } of MIGRATED) {
    assert.ok(module.outputSchema, `${name} must export outputSchema`);
    assert.equal(
      typeof module.outputSchema.parse,
      'function',
      `${name} outputSchema must be a Zod schema`,
    );
  }
});

test('count_tasks output schema accepts a real count payload', () => {
  const parsed = countTasks.outputSchema.parse({
    total: 42,
    byStatus: { Available: 30, Overdue: 12 },
  });
  assert.equal(parsed.total, 42);
});

test('count_tasks output schema accepts an empty breakdown', () => {
  const parsed = countTasks.outputSchema.parse({ total: 0, byStatus: {} });
  assert.equal(parsed.total, 0);
});

test('count_tasks output schema rejects a missing total', () => {
  assert.throws(() => countTasks.outputSchema.parse({ byStatus: {} }));
});

test('batch_edit_items output schema accepts a task and a project entry', () => {
  const parsed = batchEditItems.outputSchema.parse({
    dryRun: false,
    items: [
      {
        taskId: 'task-1',
        name: 'Draft outline',
        changes: [
          { field: 'dueDate', before: null, after: '2026-09-15T17:00:00.000Z' },
        ],
      },
      {
        projectId: 'proj-1',
        name: 'Launch',
        changes: [{ field: 'reviewInterval', before: '1 weeks', after: '2 months' }],
      },
    ],
  });
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].taskId, 'task-1');
  assert.equal(parsed.items[1].projectId, 'proj-1');
});

test('batch_edit_items output schema accepts an empty dry run', () => {
  const parsed = batchEditItems.outputSchema.parse({ dryRun: true, items: [] });
  assert.equal(parsed.dryRun, true);
});

test('batch_complete_tasks output schema accepts a repeating-task result', () => {
  const parsed = batchCompleteTasks.outputSchema.parse({
    items: [
      {
        taskId: 'task-1',
        status: 'completed',
        completionDate: '2026-08-04T09:00:00.000Z',
        generatedTaskId: 'task-2',
        nextOccurrence: '2026-08-11T09:00:00.000Z',
      },
      { taskId: 'task-3', status: 'unchanged' },
    ],
  });
  assert.equal(parsed.items.length, 2);
});

test('batch_complete_tasks output schema rejects an unknown status', () => {
  assert.throws(() =>
    batchCompleteTasks.outputSchema.parse({
      items: [{ taskId: 't', status: 'archived' }],
    }),
  );
});

test('batch_move_tasks output schema accepts each destination kind', () => {
  for (const kind of ['project', 'parent', 'inbox']) {
    const parsed = batchMoveTasks.outputSchema.parse({
      movedCount: 1,
      unchangedCount: 0,
      results: [
        {
          taskId: 't',
          taskName: 'T',
          destination: { kind, id: kind === 'inbox' ? null : 'dest', name: 'Dest' },
          verified: true,
          changed: true,
        },
      ],
    });
    assert.equal(parsed.results[0].destination.kind, kind);
  }
});

test('batch_remove_items output schema accepts a cascading removal', () => {
  const parsed = batchRemoveItems.outputSchema.parse({
    removedCount: 1,
    results: [
      {
        id: 'proj-1',
        itemType: 'project',
        name: 'Launch',
        cascadeCount: 7,
        verified: true,
      },
    ],
  });
  assert.equal(parsed.results[0].cascadeCount, 7);
});

test('batch_add_items output schema carries per-item success and failure', () => {
  // This is the one batch tool that reports partial success.
  const parsed = batchAddItems.outputSchema.parse({
    addedCount: 1,
    failedCount: 1,
    results: [
      { type: 'task', name: 'Ok', success: true, id: 'task-1', error: null },
      { type: 'project', name: 'Bad', success: false, id: null, error: 'boom' },
    ],
  });
  assert.equal(parsed.addedCount, 1);
  assert.equal(parsed.results[1].id, null);
});

test('batch_add_items output schema rejects a missing id key', () => {
  // `id` is nullable but not optional: omitting it would hide whether the item
  // produced an object.
  assert.throws(() =>
    batchAddItems.outputSchema.parse({
      addedCount: 1,
      failedCount: 0,
      results: [{ type: 'task', name: 'Ok', success: true, error: null }],
    }),
  );
});

test('filter_tasks output schema accepts a nested task tree', () => {
  const parsed = filterTasks.outputSchema.parse({
    tasks: [
      {
        id: 'task-1',
        name: 'Parent',
        childrenCount: 1,
        tags: [{ id: 'tag-1', name: 'High', path: 'Energy > High' }],
        children: [
          {
            id: 'task-2',
            name: 'Child',
            dueDate: '2026-09-15T17:00:00.000Z',
            projectId: null,
            projectName: null,
            inInbox: true,
          },
        ],
      },
    ],
    matchedCount: 2,
    totalCount: 9,
    hasMore: true,
    nextCursor: 'abc',
  });
  assert.equal(parsed.tasks[0].children?.[0].id, 'task-2');
  assert.equal(parsed.nextCursor, 'abc');
});

test('filter_tasks output schema accepts an empty result with a null cursor', () => {
  const parsed = filterTasks.outputSchema.parse({
    tasks: [],
    matchedCount: 0,
    totalCount: 0,
    hasMore: false,
    nextCursor: null,
  });
  assert.equal(parsed.tasks.length, 0);
});

test('filter_tasks output schema accepts a task carrying only id and name', () => {
  // Every other field is optional in TaskTreeNode, and a script that omits one
  // must not turn a working read into a validation error.
  const parsed = filterTasks.outputSchema.parse({
    tasks: [{ id: 't', name: 'Bare' }],
    matchedCount: 1,
    totalCount: 1,
    hasMore: false,
    nextCursor: null,
  });
  assert.equal(parsed.tasks[0].name, 'Bare');
});
