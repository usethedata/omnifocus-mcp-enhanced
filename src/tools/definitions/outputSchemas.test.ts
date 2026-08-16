import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

import * as addOmniFocusTask from './addOmniFocusTask.js';
import * as addProject from './addProject.js';
import * as batchAddItems from './batchAddItems.js';
import * as batchCompleteTasks from './batchCompleteTasks.js';
import * as batchEditItems from './batchEditItems.js';
import * as batchMoveTasks from './batchMoveTasks.js';
import * as batchRemoveItems from './batchRemoveItems.js';
import * as countTasks from './countTasks.js';
import * as createProjectFromOutline from './createProjectFromOutline.js';
import * as duplicateTask from './duplicateTask.js';
import * as filterTasks from './filterTasks.js';
import * as getProjects from './getProjects.js';
import * as getTasks from './getTasks.js';
import * as manageFolders from './manageFolders.js';
import * as manageTags from './manageTags.js';
import * as markProjectsReviewed from './markProjectsReviewed.js';

const require = createRequire(import.meta.url);
const { toJsonSchemaCompat } = require(
  '@modelcontextprotocol/sdk/server/zod-json-schema-compat.js',
);
const { AjvJsonSchemaValidator } = require(
  '@modelcontextprotocol/sdk/validation/ajv',
);

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
  { name: 'add_omnifocus_task', module: addOmniFocusTask },
  { name: 'add_project', module: addProject },
  { name: 'duplicate_task', module: duplicateTask },
  { name: 'create_project_from_outline', module: createProjectFromOutline },
  { name: 'mark_projects_reviewed', module: markProjectsReviewed },
];

const mcpOutputValidator = new AjvJsonSchemaValidator();

function assertMcpOutputMatches(schema: unknown, structuredContent: unknown): void {
  const jsonSchema = toJsonSchemaCompat(schema, {
    strictUnions: true,
    pipeStrategy: 'output',
  });
  const result = mcpOutputValidator.getValidator(jsonSchema)(structuredContent);
  assert.equal(result.valid, true, result.errorMessage);
}

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

test('filter_tasks MCP output schema accepts the real filter serializer fields', () => {
  assertMcpOutputMatches(filterTasks.outputSchema, {
    tasks: [
      {
        id: 'task-1',
        name: 'Filtered task',
        completedDate: null,
        createdDate: '2026-07-01T09:00:00.000Z',
        modifiedDate: '2026-08-01T09:00:00.000Z',
      },
    ],
    matchedCount: 1,
    totalCount: 1,
    hasMore: false,
    nextCursor: null,
  });
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

test('get_tasks MCP output schema accepts forecast due annotations', () => {
  const task = { id: 'task-1', name: 'Forecast task', isDue: true };
  assertMcpOutputMatches(getTasks.outputSchema, {
    source: 'forecast',
    count: 1,
    tasks: [task],
    groups: [{ date: '2026-08-04', tasks: [task] }],
  });
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

test('get_projects MCP output schema accepts every OmniJS project field', () => {
  assertMcpOutputMatches(getProjects.outputSchema, {
    view: 'all',
    count: 1,
    projects: [
      {
        id: 'project-1',
        name: 'Launch',
        status: 'Active',
        folderName: 'Work',
        folderID: 'folder-1',
        sequential: false,
        dueDate: null,
        deferDate: null,
        effectiveDueDate: null,
        effectiveDeferDate: null,
        completedByChildren: false,
        containsSingletonActions: false,
        note: '',
        taskCount: 0,
        flagged: false,
        nextReviewDate: null,
        lastReviewDate: null,
        reviewInterval: { steps: 1, unit: 'weeks' },
      },
    ],
  });
});

test('shared read schemas tolerate additive OmniJS serializer fields', () => {
  assertMcpOutputMatches(filterTasks.outputSchema, {
    tasks: [{ id: 'task-1', name: 'Task', futureTaskField: true }],
    matchedCount: 1,
    totalCount: 1,
    hasMore: false,
    nextCursor: null,
  });
  assertMcpOutputMatches(getProjects.outputSchema, {
    view: 'all',
    count: 1,
    projects: [{ id: 'project-1', name: 'Project', futureProjectField: true }],
  });
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

/**
 * The identifier-minting group. Every ID here is required rather than mirroring
 * the optional field on the result interface, because a tool that creates
 * something and cannot report its ID has not completed its contract. The
 * handlers route that case to `isError` instead, so the schema never sees it.
 * See docs/plans/2026-08-05-identifier-minting-output-design.md.
 */

test('add_omnifocus_task output schema accepts a bare creation', () => {
  assert.equal(
    addOmniFocusTask.outputSchema.parse({ taskId: 'task-1' }).taskId,
    'task-1',
  );
});

test('add_omnifocus_task output schema accepts exclusivity and repetition', () => {
  const parsed = addOmniFocusTask.outputSchema.parse({
    taskId: 'task-1',
    removedSiblings: ['Low Energy'],
    missingTags: [],
    repetition: {
      ruleString: 'FREQ=WEEKLY;BYDAY=FR',
      scheduleType: 'Regularly',
      anchorDateKey: 'DueDate',
      catchUpAutomatically: false,
      nextOccurrence: '2026-08-07T17:00:00.000Z',
    },
  });
  assert.equal(parsed.repetition?.ruleString, 'FREQ=WEEKLY;BYDAY=FR');
  assert.deepEqual(parsed.removedSiblings, ['Low Energy']);
});

test('add_omnifocus_task output schema tolerates a null next occurrence', () => {
  const parsed = addOmniFocusTask.outputSchema.parse({
    taskId: 'task-1',
    repetition: { ruleString: 'FREQ=DAILY', nextOccurrence: null },
  });
  assert.equal(parsed.repetition?.nextOccurrence, null);
});

test('add_project output schema accepts a creation with dropped siblings', () => {
  const parsed = addProject.outputSchema.parse({
    projectId: 'proj-1',
    removedSiblings: ['Someday'],
  });
  assert.equal(parsed.projectId, 'proj-1');
});

test('duplicate_task output schema accepts a copy with subtasks', () => {
  const parsed = duplicateTask.outputSchema.parse({
    newTaskId: 'task-2',
    name: 'Draft outline copy',
    childrenCount: 3,
  });
  assert.equal(parsed.childrenCount, 3);
});

test('duplicate_task output schema accepts a copy reported without a name', () => {
  assert.equal(
    duplicateTask.outputSchema.parse({ newTaskId: 'task-2' }).newTaskId,
    'task-2',
  );
});

test('create_project_from_outline output schema accepts a created tree', () => {
  const parsed = createProjectFromOutline.outputSchema.parse({
    projectId: 'proj-1',
    taskCount: 2,
    items: [
      {
        id: 'proj-1',
        type: 'project',
        path: 'Launch',
        parentId: null,
        verified: true,
      },
      {
        id: 'task-1',
        type: 'task',
        path: 'Launch > Draft outline',
        parentId: 'proj-1',
        verified: true,
      },
    ],
    affectedPaths: ['Launch'],
  });
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].parentId, null);
});

test('create_project_from_outline output schema rejects an unknown item type', () => {
  assert.throws(() =>
    createProjectFromOutline.outputSchema.parse({
      projectId: 'proj-1',
      taskCount: 1,
      items: [
        {
          id: 'f-1',
          type: 'folder',
          path: 'Launch',
          parentId: null,
          verified: true,
        },
      ],
    }),
  );
});

test('mark_projects_reviewed output schema accepts a verified review batch', () => {
  const parsed = markProjectsReviewed.outputSchema.parse({
    reviewedAt: '2026-08-05T09:00:00.000Z',
    count: 1,
    projects: [
      {
        id: 'proj-1',
        name: 'Launch',
        status: 'Active',
        lastReviewDate: '2026-08-05T09:00:00.000Z',
        nextReviewDate: '2026-08-12T09:00:00.000Z',
        reviewInterval: { steps: 1, unit: 'weeks' },
        verified: true,
      },
    ],
  });
  assert.equal(parsed.projects[0].reviewInterval.steps, 1);
  assert.equal(parsed.count, 1);
});

test('mark_projects_reviewed output schema requires the verified review dates', () => {
  // Preflight guarantees these, so a payload missing them is a real defect
  // rather than a shape the tool is allowed to return.
  assert.throws(() =>
    markProjectsReviewed.outputSchema.parse({
      count: 1,
      projects: [{ id: 'proj-1', name: 'Launch', status: 'Active' }],
    }),
  );
});

test('every identifier-minting schema rejects a payload missing its ID', () => {
  assert.throws(() => addOmniFocusTask.outputSchema.parse({}));
  assert.throws(() => addProject.outputSchema.parse({}));
  assert.throws(() => duplicateTask.outputSchema.parse({ name: 'Copy' }));
  assert.throws(() =>
    createProjectFromOutline.outputSchema.parse({ taskCount: 0, items: [] }),
  );
});

/**
 * The checks above validate hand-written payloads. These validate what the
 * handlers actually build, which is the drift the SDK would otherwise only
 * catch on a live call against OmniFocus.
 */

function assertStructuredMatches(
  module: { outputSchema: { parse: (value: unknown) => unknown } },
  result: { structuredContent?: unknown; isError?: boolean },
) {
  assert.ok(!result.isError, 'expected a success result');
  assert.ok(result.structuredContent, 'expected structuredContent');
  module.outputSchema.parse(result.structuredContent);
}

test('add_omnifocus_task builds structured content matching its schema', () => {
  assertStructuredMatches(
    addOmniFocusTask,
    addOmniFocusTask.buildResult(
      { name: 'Draft outline', tags: ['Deep Work'] } as never,
      {
        success: true,
        taskId: 'task-1',
        removedSiblings: ['Low Energy'],
        missingTags: [],
        repetition: {
          ruleString: 'FREQ=WEEKLY;BYDAY=FR',
          scheduleType: 'Regularly',
          anchorDateKey: 'DueDate',
          catchUpAutomatically: false,
          nextOccurrence: '2026-08-07T17:00:00.000Z',
        },
      },
    ),
  );
});

test('add_project builds structured content matching its schema', () => {
  assertStructuredMatches(
    addProject,
    addProject.buildResult({ name: 'Launch' } as never, {
      success: true,
      projectId: 'proj-1',
      removedSiblings: ['Someday'],
    }),
  );
});

test('duplicate_task builds structured content matching its schema', () => {
  assertStructuredMatches(
    duplicateTask,
    duplicateTask.buildResult({
      success: true,
      newTaskId: 'task-2',
      name: 'Draft outline copy',
      childrenCount: 3,
    }),
  );
});

test('create_project_from_outline builds structured content matching its schema', () => {
  assertStructuredMatches(
    createProjectFromOutline,
    createProjectFromOutline.buildResult({
      success: true,
      projectId: 'proj-1',
      taskCount: 1,
      items: [
        {
          id: 'proj-1',
          type: 'project',
          path: 'Launch',
          parentId: null,
          verified: true,
        },
        {
          id: 'task-1',
          type: 'task',
          path: 'Launch > Draft outline',
          parentId: 'proj-1',
          verified: true,
        },
      ],
      affectedPaths: ['Launch'],
    }),
  );
});

test('mark_projects_reviewed builds structured content matching its schema', () => {
  assertStructuredMatches(
    markProjectsReviewed,
    markProjectsReviewed.buildResult({
      success: true,
      reviewedAt: '2026-08-05T09:00:00.000Z',
      count: 1,
      projects: [
        {
          id: 'proj-1',
          name: 'Launch',
          status: 'Active',
          lastReviewDate: '2026-08-05T09:00:00.000Z',
          nextReviewDate: '2026-08-12T09:00:00.000Z',
          reviewInterval: { steps: 1, unit: 'weeks' },
          verified: true,
        },
      ],
    }),
  );
});

/**
 * The guard that turns a success-without-an-ID into a failure. Both AppleScript
 * primitives cast an unvalidated field out of parsed JSON, so this path is
 * reachable; before this release it printed "id: undefined" as a success.
 */

test('add_omnifocus_task reports an error when OmniFocus returns no task ID', () => {
  const result = addOmniFocusTask.buildResult({ name: 'Draft outline' } as never, {
    success: true,
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.match(result.content[0].text, /no task ID/);
});

test('add_project reports an error when OmniFocus returns no project ID', () => {
  const result = addProject.buildResult({ name: 'Launch' } as never, {
    success: true,
  });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.match(result.content[0].text, /no project ID/);
});

test('duplicate_task reports an error when OmniFocus returns no copy ID', () => {
  const result = duplicateTask.buildResult({ success: true, name: 'Copy' });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent, undefined);
  assert.match(result.content[0].text, /no ID for the copy/);
});

test('a failed creation carries no structured content', () => {
  for (const result of [
    addOmniFocusTask.buildResult({ name: 'x' } as never, {
      success: false,
      error: 'nope',
    }),
    addProject.buildResult({ name: 'x' } as never, {
      success: false,
      error: 'nope',
    }),
    duplicateTask.buildResult({ success: false, error: 'nope' }),
    createProjectFromOutline.buildResult({ success: false, error: 'nope' }),
    markProjectsReviewed.buildResult({ success: false, error: 'nope' }),
  ]) {
    assert.equal(result.isError, true);
    assert.equal(result.structuredContent, undefined);
  }
});
