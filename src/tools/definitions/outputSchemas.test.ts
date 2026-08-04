import assert from 'node:assert/strict';
import test from 'node:test';

import * as batchAddItems from './batchAddItems.js';
import * as batchCompleteTasks from './batchCompleteTasks.js';
import * as batchEditItems from './batchEditItems.js';
import * as batchMoveTasks from './batchMoveTasks.js';
import * as batchRemoveItems from './batchRemoveItems.js';
import * as countTasks from './countTasks.js';
import * as filterTasks from './filterTasks.js';
import * as getProjects from './getProjects.js';
import * as getTasks from './getTasks.js';
import * as manageFolders from './manageFolders.js';
import * as manageTags from './manageTags.js';

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
  { name: 'get_projects', module: getProjects },
  { name: 'get_tasks', module: getTasks },
  { name: 'manage_folders', module: manageFolders },
  { name: 'manage_tags', module: manageTags },
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

test('get_tasks output schema accepts every source', () => {
  const base = { tasks: [{ id: 't', name: 'T' }], count: 1 };

  assert.equal(
    getTasks.outputSchema.parse({ ...base, source: 'inbox' }).source,
    'inbox',
  );
  assert.equal(
    getTasks.outputSchema.parse({ ...base, source: 'flagged' }).source,
    'flagged',
  );

  const forecast = getTasks.outputSchema.parse({
    ...base,
    source: 'forecast',
    groups: [{ date: '2026-08-04', tasks: [{ id: 't', name: 'T' }] }],
  });
  assert.equal(forecast.groups?.[0].date, '2026-08-04');

  const tag = getTasks.outputSchema.parse({
    ...base,
    source: 'tag',
    matchedTags: ['Work'],
    availableTags: ['Home'],
  });
  assert.deepEqual(tag.matchedTags, ['Work']);

  const custom = getTasks.outputSchema.parse({
    ...base,
    source: 'custom',
    totalCount: 12,
  });
  assert.equal(custom.totalCount, 12);
});

test('get_tasks output schema rejects an unknown source', () => {
  assert.throws(() =>
    getTasks.outputSchema.parse({ source: 'archive', count: 0, tasks: [] }),
  );
});

test('get_tasks output schema accepts a perspective task carrying completion fields', () => {
  // The custom-perspective read serializes its own node type; those fields are
  // optional on the shared task schema so one shape covers every source.
  const parsed = getTasks.outputSchema.parse({
    source: 'custom',
    count: 1,
    totalCount: 1,
    tasks: [
      {
        id: 't',
        name: 'Done thing',
        completed: true,
        dropped: false,
        completionDate: '2026-08-01T09:00:00.000Z',
        creationDate: '2026-07-01T09:00:00.000Z',
        tags: [{ name: 'Work' }],
      },
    ],
  });
  assert.equal(parsed.tasks[0].completed, true);
});

test('get_projects output schema accepts both views', () => {
  const all = getProjects.outputSchema.parse({
    view: 'all',
    count: 1,
    projects: [
      {
        id: 'proj-1',
        name: 'Launch',
        status: 'Active',
        folderName: 'Work',
        taskCount: 12,
        reviewInterval: { steps: 1, unit: 'weeks' },
        nextReviewDate: '2026-08-11T09:00:00.000Z',
      },
    ],
  });
  assert.equal(all.projects[0].reviewInterval?.unit, 'weeks');

  const review = getProjects.outputSchema.parse({
    view: 'due_for_review',
    count: 0,
    projects: [],
  });
  assert.equal(review.count, 0);
});

test('get_projects output schema accepts a project without review data', () => {
  // includeReviewData: false omits the review fields entirely.
  const parsed = getProjects.outputSchema.parse({
    view: 'all',
    count: 1,
    projects: [{ id: 'p', name: 'Bare' }],
  });
  assert.equal(parsed.projects[0].name, 'Bare');
});

test('manage_tags output schema covers every action it routes', () => {
  assert.deepEqual(
    manageTags.outputSchema.parse({
      action: 'list',
      tags: [{ id: 'tag-1', name: 'Work', parentTagID: null, active: true }],
    }).tags?.length,
    1,
  );
  assert.equal(
    manageTags.outputSchema.parse({ action: 'search', tags: [] }).action,
    'search',
  );
  assert.equal(
    manageTags.outputSchema.parse({ action: 'add', tagId: 't', name: 'New' }).tagId,
    't',
  );
  assert.equal(
    manageTags.outputSchema.parse({
      action: 'edit',
      tagId: 't',
      name: 'New',
      changedProperties: 'name',
    }).changedProperties,
    'name',
  );
  assert.equal(
    manageTags.outputSchema.parse({
      action: 'remove',
      name: 'Gone',
      affectedTaskCount: 3,
      childTagCount: 1,
    }).childTagCount,
    1,
  );
});

test('manage_folders output schema covers every action it routes', () => {
  assert.equal(
    manageFolders.outputSchema.parse({
      action: 'list',
      folders: [
        { id: 'f', name: 'Work', status: 'Active', parentFolderID: null, projectCount: 2 },
      ],
    }).folders?.length,
    1,
  );
  assert.equal(
    manageFolders.outputSchema.parse({
      action: 'get',
      folder: { id: 'f', name: 'Work', status: 'Active', parentFolderID: null },
    }).folder?.id,
    'f',
  );
  assert.equal(
    manageFolders.outputSchema.parse({ action: 'add', folderId: 'f', name: 'New' })
      .folderId,
    'f',
  );
  assert.equal(
    manageFolders.outputSchema.parse({
      action: 'remove',
      name: 'Gone',
      deletedProjectCount: 2,
      deletedTaskCount: 4,
    }).deletedTaskCount,
    4,
  );
});

test('the mixed-operation routers reject an action they do not have', () => {
  assert.throws(() => manageTags.outputSchema.parse({ action: 'get' }));
  assert.throws(() => manageFolders.outputSchema.parse({ action: 'search' }));
});
