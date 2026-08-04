import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

interface FakeTag {
  id: { primaryKey: string };
  name: string;
  parent: FakeTag | null;
  children: FakeTag[];
  childrenAreMutuallyExclusive?: boolean;
}

interface FakeTask {
  id: { primaryKey: string };
  name: string;
  note: string;
  completed: boolean;
  taskStatus: string;
  dueDate: Date | null;
  deferDate: Date | null;
  plannedDate: Date | null;
  flagged: boolean;
  estimatedMinutes: number | null;
  tags: FakeTag[];
  addTag: (tag: FakeTag) => void;
  removeTag: (tag: FakeTag) => void;
  clearTags: () => void;
}

/** The observable task state these tests assert stays unchanged. */
interface TaskSnapshot {
  id: string;
  name: string;
  note: string;
  dueDate: number | null;
  deferDate: number | null;
  plannedDate: number | null;
  flagged: boolean;
  estimatedMinutes: number | null;
  tags: string;
}

interface ScriptChange {
  field: string;
  before: string | null;
  after: string | null;
}

interface ScriptItem {
  taskId: string;
  name: string;
  changes: ScriptChange[];
}

/** The contract batchEditItems.js returns; these tests are what assert it. */
interface ScriptResult {
  success: boolean;
  code?: string;
  error?: string;
  restored?: boolean;
  dryRun?: boolean;
  items?: ScriptItem[];
}

interface ScriptRun {
  result: ScriptResult;
  tasks: FakeTask[];
  before: TaskSnapshot[];
}

/** OmniJS exposes flattenedTags as an array carrying a byName lookup. */
interface TagLookup extends Array<FakeTag> {
  byName: (name: string) => FakeTag | null;
}

interface RunOptions {
  tasks?: FakeTask[];
  tags?: FakeTag[];
  /** Throw when this task's field is assigned, simulating a write failure. */
  failWrite?: { taskId: string; field: string };
  /** Silently store a wrong value, simulating a verification mismatch. */
  corrupt?: { taskId: string; field: string };
}

function tag(name: string): FakeTag {
  return { id: { primaryKey: name }, name, parent: null, children: [] };
}

function exclusiveGroup(parentName: string, childNames: string[]): FakeTag[] {
  const parent = tag(parentName);
  parent.childrenAreMutuallyExclusive = true;
  parent.children = childNames.map((name) => {
    const child = tag(name);
    child.parent = parent;
    return child;
  });
  return [parent, ...parent.children];
}

/**
 * Stands in for an OmniJS TagArray: indexable and length-bearing, but
 * Array.isArray is false and no Array methods exist. The real database returns
 * collections in this shape, so a fake built from a plain Array cannot catch a
 * helper that guards on Array.isArray.
 */
function tagCollection(items: FakeTag[]): FakeTag[] {
  const view: { length: number } & Record<number, FakeTag> = { length: items.length };
  items.forEach((item, index) => {
    view[index] = item;
  });
  return view as unknown as FakeTag[];
}

/** Read a tag collection whether it is a real Array or a TagArray stand-in. */
function tagNamesIn(collection: FakeTag[]): string[] {
  const names: string[] = [];
  for (let index = 0; index < collection.length; index += 1) {
    names.push(collection[index].name);
  }
  return names;
}

/** A task whose tags read back as a TagArray stand-in rather than an Array. */
function taskWithTagCollection(id: string, initial: FakeTag[]): FakeTask {
  const backing = initial.slice();
  const value = task(id);
  Object.defineProperty(value, 'tags', {
    get: () => tagCollection(backing),
    configurable: true,
  });
  value.addTag = (candidate: FakeTag) => {
    const carried = backing.some(
      (existing) => existing.id.primaryKey === candidate.id.primaryKey,
    );
    if (!carried) backing.push(candidate);
  };
  value.removeTag = (candidate: FakeTag) => {
    const index = backing.findIndex(
      (existing) => existing.id.primaryKey === candidate.id.primaryKey,
    );
    if (index >= 0) backing.splice(index, 1);
  };
  value.clearTags = () => {
    backing.length = 0;
  };
  return value;
}

/** An exclusive group whose children read back as a TagArray stand-in. */
function exclusiveGroupAsCollection(
  parentName: string,
  childNames: string[],
): FakeTag[] {
  const group = exclusiveGroup(parentName, childNames);
  const children = group[0].children;
  Object.defineProperty(group[0], 'children', {
    get: () => tagCollection(children),
    configurable: true,
  });
  return group;
}

function task(id: string, overrides: Partial<FakeTask> = {}): FakeTask {
  const value: FakeTask = {
    id: { primaryKey: id },
    name: overrides.name ?? `Task ${id}`,
    note: overrides.note ?? '',
    completed: overrides.completed ?? false,
    taskStatus: overrides.taskStatus ?? 'Available',
    dueDate: overrides.dueDate ?? null,
    deferDate: overrides.deferDate ?? null,
    plannedDate: overrides.plannedDate ?? null,
    flagged: overrides.flagged ?? false,
    estimatedMinutes: overrides.estimatedMinutes ?? null,
    tags: overrides.tags ? overrides.tags.slice() : [],
    addTag() {},
    removeTag() {},
    clearTags() {},
  };

  value.addTag = function (candidate: FakeTag) {
    const carried = this.tags.some(
      (existing) => existing.id.primaryKey === candidate.id.primaryKey,
    );
    if (!carried) this.tags.push(candidate);
  };
  value.removeTag = function (candidate: FakeTag) {
    this.tags = this.tags.filter(
      (existing) => existing.id.primaryKey !== candidate.id.primaryKey,
    );
  };
  value.clearTags = function () {
    this.tags = [];
  };

  return value;
}

function snapshotOf(tasks: FakeTask[]): TaskSnapshot[] {
  return tasks.map((current) => ({
    id: current.id.primaryKey,
    name: current.name,
    note: current.note,
    dueDate: current.dueDate ? current.dueDate.getTime() : null,
    deferDate: current.deferDate ? current.deferDate.getTime() : null,
    plannedDate: current.plannedDate ? current.plannedDate.getTime() : null,
    flagged: current.flagged,
    estimatedMinutes: current.estimatedMinutes,
    tags: tagNamesIn(current.tags).join('|'),
  }));
}

function changeFor(result: ScriptResult, index: number, field: string): ScriptChange {
  const item = result.items?.[index];
  assert.ok(item, `expected an item at index ${index}`);
  const change = item.changes.find((candidate) => candidate.field === field);
  assert.ok(change, `expected a ${field} change`);
  return change;
}

function runScript(
  args: Record<string, unknown>,
  options: RunOptions = {},
): ScriptRun {
  const helper = readFileSync(
    new URL('../../utils/omnifocusScripts/tagAssignmentHelpers.js', import.meta.url),
    'utf8',
  );
  const script = readFileSync(
    new URL('../../utils/omnifocusScripts/batchEditItems.js', import.meta.url),
    'utf8',
  );

  const tasks = options.tasks || [task('task-1')];
  const tags = options.tags || [];

  if (options.failWrite) {
    const failWrite = options.failWrite;
    const target = tasks.find((current) => current.id.primaryKey === failWrite.taskId);
    if (target) {
      Object.defineProperty(target, failWrite.field, {
        get() {
          return null;
        },
        set() {
          throw new Error('simulated write failure');
        },
        configurable: true,
      });
    }
  }

  if (options.corrupt) {
    const corrupt = options.corrupt;
    const target = tasks.find((current) => current.id.primaryKey === corrupt.taskId);
    if (target) {
      let stored: unknown = null;
      Object.defineProperty(target, corrupt.field, {
        get() {
          return stored;
        },
        set() {
          stored = corrupt.field === 'flagged' ? false : null;
        },
        configurable: true,
      });
    }
  }

  const before = snapshotOf(tasks);

  // Attaching byName mirrors the OmniJS global; an array literal cannot express it.
  const flattenedTags = tags.slice() as TagLookup;
  flattenedTags.byName = (name: string) =>
    tags.find((current) => current.name === name) || null;

  const raw = vm.runInNewContext(`${helper}\n${script}`, {
    injectedArgs: args,
    flattenedTasks: tasks,
    flattenedTags,
    Tag: {
      named: (name: string) => tags.find((current) => current.name === name) || null,
    },
    Task: {
      byIdentifier: (id: string) =>
        tasks.find((current) => current.id.primaryKey === id) || null,
      Status: { Dropped: 'Dropped' },
    },
    JSON,
    String,
    Date,
    Number,
    Array,
    Math,
    Object,
    Boolean,
  });

  return { result: JSON.parse(String(raw)) as ScriptResult, tasks, before };
}

test('batch edit script applies an absolute date and a flag, then verifies', () => {
  const run = runScript({
    items: [{ taskId: 'task-1', dueDate: '2026-09-15T17:00:00.000Z', flagged: true }],
  });

  assert.equal(run.result.success, true);
  assert.equal(run.tasks[0].dueDate?.toISOString(), '2026-09-15T17:00:00.000Z');
  assert.equal(run.tasks[0].flagged, true);

  const change = changeFor(run.result, 0, 'dueDate');
  assert.equal(change.before, null);
  assert.equal(change.after, '2026-09-15T17:00:00.000Z');
});

test('batch edit script clears a date with an explicit null', () => {
  const run = runScript(
    { items: [{ taskId: 'task-1', dueDate: null }] },
    { tasks: [task('task-1', { dueDate: new Date(2026, 8, 15, 17, 0, 0) })] },
  );

  assert.equal(run.result.success, true);
  assert.equal(run.tasks[0].dueDate, null);
});

test('batch edit script separates clearing an estimate from storing zero', () => {
  const cleared = runScript(
    { items: [{ taskId: 'task-1', estimatedMinutes: null }] },
    { tasks: [task('task-1', { estimatedMinutes: 30 })] },
  );
  assert.equal(cleared.result.success, true);
  assert.equal(cleared.tasks[0].estimatedMinutes, null);

  const zeroed = runScript(
    { items: [{ taskId: 'task-1', estimatedMinutes: 0 }] },
    { tasks: [task('task-1', { estimatedMinutes: 30 })] },
  );
  assert.equal(zeroed.result.success, true);
  assert.equal(zeroed.tasks[0].estimatedMinutes, 0);
});

test('batch edit script shifts a date by weeks and preserves wall-clock time', () => {
  // Adding milliseconds would move the clock by an hour across a DST boundary;
  // shifting the calendar date does not.
  const run = runScript(
    { items: [{ taskId: 'task-1', dueDateShift: '+1w' }] },
    { tasks: [task('task-1', { dueDate: new Date(2026, 2, 1, 17, 30, 0) })] },
  );

  assert.equal(run.result.success, true);
  const shifted = run.tasks[0].dueDate;
  assert.ok(shifted);
  assert.equal(shifted.getDate(), 8);
  assert.equal(shifted.getMonth(), 2);
  assert.equal(shifted.getHours(), 17);
  assert.equal(shifted.getMinutes(), 30);
});

test('batch edit script shifts a date backwards by days', () => {
  const run = runScript(
    { items: [{ taskId: 'task-1', deferDateShift: '-3d' }] },
    { tasks: [task('task-1', { deferDate: new Date(2026, 8, 10, 9, 0, 0) })] },
  );

  assert.equal(run.result.success, true);
  assert.equal(run.tasks[0].deferDate?.getDate(), 7);
});

test('batch edit script clamps a month shift to the target month end', () => {
  const nonLeap = runScript(
    { items: [{ taskId: 'task-1', dueDateShift: '+1m' }] },
    { tasks: [task('task-1', { dueDate: new Date(2026, 0, 31, 17, 0, 0) })] },
  );
  assert.equal(nonLeap.result.success, true);
  assert.equal(nonLeap.tasks[0].dueDate?.getMonth(), 1);
  assert.equal(nonLeap.tasks[0].dueDate?.getDate(), 28);
  assert.equal(nonLeap.tasks[0].dueDate?.getHours(), 17);

  const leap = runScript(
    { items: [{ taskId: 'task-1', dueDateShift: '+1m' }] },
    { tasks: [task('task-1', { dueDate: new Date(2028, 0, 31, 17, 0, 0) })] },
  );
  assert.equal(leap.tasks[0].dueDate?.getMonth(), 1);
  assert.equal(leap.tasks[0].dueDate?.getDate(), 29);

  const backwards = runScript(
    { items: [{ taskId: 'task-1', dueDateShift: '-1m' }] },
    { tasks: [task('task-1', { dueDate: new Date(2026, 2, 31, 17, 0, 0) })] },
  );
  assert.equal(backwards.tasks[0].dueDate?.getMonth(), 1);
  assert.equal(backwards.tasks[0].dueDate?.getDate(), 28);
});

test('batch edit script refuses to shift a field the task has no value for', () => {
  const run = runScript({ items: [{ taskId: 'task-1', dueDateShift: '+1w' }] });

  assert.equal(run.result.success, false);
  assert.equal(run.result.code, 'INVALID_EDIT');
  assert.match(run.result.error || '', /has no dueDate/);
  assert.deepEqual(snapshotOf(run.tasks), run.before);
});

test('batch edit script refuses a shift that pushes deferDate past an untouched dueDate', () => {
  const run = runScript(
    { items: [{ taskId: 'task-1', deferDateShift: '+2w' }] },
    {
      tasks: [
        task('task-1', {
          dueDate: new Date(2026, 8, 10, 9, 0, 0),
          deferDate: new Date(2026, 8, 5, 9, 0, 0),
        }),
      ],
    },
  );

  assert.equal(run.result.success, false);
  assert.match(run.result.error || '', /later than dueDate/);
  assert.deepEqual(snapshotOf(run.tasks), run.before);
});

test('batch edit script refuses a completed task and writes nothing', () => {
  const run = runScript(
    {
      items: [
        { taskId: 'task-1', flagged: true },
        { taskId: 'task-2', flagged: true },
      ],
    },
    { tasks: [task('task-1'), task('task-2', { completed: true })] },
  );

  assert.equal(run.result.success, false);
  assert.match(run.result.error || '', /completed/);
  assert.deepEqual(snapshotOf(run.tasks), run.before);
});

test('batch edit script refuses a dropped task', () => {
  const run = runScript(
    { items: [{ taskId: 'task-1', flagged: true }] },
    { tasks: [task('task-1', { taskStatus: 'Dropped' })] },
  );

  assert.equal(run.result.success, false);
  assert.match(run.result.error || '', /dropped/);
});

test('batch edit script refuses an unknown tag name and writes nothing', () => {
  const run = runScript(
    {
      items: [
        { taskId: 'task-1', flagged: true },
        { taskId: 'task-2', addTags: ['Nonexistent'] },
      ],
    },
    { tasks: [task('task-1'), task('task-2')], tags: [tag('Known')] },
  );

  assert.equal(run.result.success, false);
  assert.match(run.result.error || '', /unknown tag: Nonexistent/);
  assert.deepEqual(snapshotOf(run.tasks), run.before);
});

test('batch edit script drops the sibling tag when adding into an exclusive group', () => {
  const group = exclusiveGroup('Energy', ['High', 'Low']);
  const low = group.find((current) => current.name === 'Low');
  assert.ok(low);
  const run = runScript(
    { items: [{ taskId: 'task-1', addTags: ['High'] }] },
    { tasks: [task('task-1', { tags: [low] })], tags: group },
  );

  assert.equal(run.result.success, true);
  assert.deepEqual(tagNamesIn(run.tasks[0].tags), ['High']);

  const change = changeFor(run.result, 0, 'tags');
  assert.equal(change.before, 'Low');
  assert.equal(change.after, 'High');
});

// Regression: task.tags and tag.children are TagArray, not Array, in the real
// database. Guarding on Array.isArray read them as empty, so exclusive-group
// sibling removal silently never fired and a tag write failed its own read-back.
test('batch edit script handles tag collections that are not real Arrays', () => {
  const group = exclusiveGroupAsCollection('Energy', ['High', 'Low']);
  const low = group.find((current) => current.name === 'Low');
  assert.ok(low);
  const run = runScript(
    { items: [{ taskId: 'task-1', addTags: ['High'] }] },
    { tasks: [taskWithTagCollection('task-1', [low])], tags: group },
  );

  assert.equal(run.result.success, true, run.result.error);
  assert.deepEqual(tagNamesIn(run.tasks[0].tags), ['High']);

  const change = changeFor(run.result, 0, 'tags');
  assert.equal(change.before, 'Low');
  assert.equal(change.after, 'High');
});

test('batch edit script applies removeTags before addTags', () => {
  const alpha = tag('Alpha');
  const beta = tag('Beta');
  const run = runScript(
    { items: [{ taskId: 'task-1', removeTags: ['Alpha'], addTags: ['Beta'] }] },
    { tasks: [task('task-1', { tags: [alpha] })], tags: [alpha, beta] },
  );

  assert.equal(run.result.success, true);
  assert.deepEqual(
    run.tasks[0].tags.map((current) => current.name),
    ['Beta'],
  );
});

test('batch edit script replaces tags and honours exclusive groups while doing it', () => {
  const group = exclusiveGroup('Energy', ['High', 'Low']);
  const errand = tag('Errand');
  const run = runScript(
    { items: [{ taskId: 'task-1', replaceTags: ['Low', 'High'] }] },
    { tasks: [task('task-1', { tags: [errand] })], tags: [...group, errand] },
  );

  assert.equal(run.result.success, true);
  // Two tags from one exclusive group must collapse to the last one applied.
  assert.deepEqual(
    run.tasks[0].tags.map((current) => current.name),
    ['High'],
  );
});

test('batch edit script restores every earlier item when a write throws', () => {
  const run = runScript(
    {
      items: [
        { taskId: 'task-1', flagged: true, note: 'changed' },
        { taskId: 'task-2', flagged: true },
      ],
    },
    {
      tasks: [task('task-1'), task('task-2')],
      failWrite: { taskId: 'task-2', field: 'flagged' },
    },
  );

  assert.equal(run.result.success, false);
  assert.equal(run.result.code, 'EDIT_FAILED_RESTORED');
  assert.equal(run.result.restored, true);
  assert.equal(run.tasks[0].flagged, false);
  assert.equal(run.tasks[0].note, '');
});

test('batch edit script restores everything when read-back disagrees', () => {
  const run = runScript(
    {
      items: [
        { taskId: 'task-1', note: 'first' },
        { taskId: 'task-2', note: 'second' },
      ],
    },
    {
      tasks: [task('task-1'), task('task-2')],
      corrupt: { taskId: 'task-2', field: 'note' },
    },
  );

  assert.equal(run.result.success, false);
  assert.equal(run.result.code, 'EDIT_VERIFICATION_FAILED_RESTORED');
  assert.equal(run.result.restored, true);
  assert.equal(run.tasks[0].note, '');
});

test('batch edit script dry run reports the diff and writes nothing', () => {
  const run = runScript(
    {
      items: [{ taskId: 'task-1', dueDateShift: '+1w', flagged: true }],
      dryRun: true,
    },
    { tasks: [task('task-1', { dueDate: new Date(2026, 8, 1, 17, 0, 0) })] },
  );

  assert.equal(run.result.success, true);
  assert.equal(run.result.dryRun, true);
  assert.equal(run.result.items?.[0].changes.length, 2);
  assert.deepEqual(snapshotOf(run.tasks), run.before);
});

test('batch edit script rejects a duplicate taskId before writing', () => {
  const run = runScript({
    items: [
      { taskId: 'task-1', flagged: true },
      { taskId: 'task-1', flagged: false },
    ],
  });

  assert.equal(run.result.success, false);
  assert.match(run.result.error || '', /duplicate taskId/);
  assert.deepEqual(snapshotOf(run.tasks), run.before);
});

test('batch edit script rejects a missing task before writing', () => {
  const run = runScript(
    {
      items: [
        { taskId: 'task-1', flagged: true },
        { taskId: 'ghost', flagged: true },
      ],
    },
    { tasks: [task('task-1')] },
  );

  assert.equal(run.result.success, false);
  assert.match(run.result.error || '', /Task not found: ghost/);
  assert.deepEqual(snapshotOf(run.tasks), run.before);
});

test('batch edit script rejects an empty name', () => {
  const run = runScript({ items: [{ taskId: 'task-1', name: '   ' }] });

  assert.equal(run.result.success, false);
  assert.match(run.result.error || '', /name must not be empty/);
});
