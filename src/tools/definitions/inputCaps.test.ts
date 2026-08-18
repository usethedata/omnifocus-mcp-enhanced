import assert from 'node:assert/strict';
import test from 'node:test';

import { schema as addTaskSchema } from './addOmniFocusTask.js';
import { schema as addProjectSchema } from './addProject.js';
import { schema as appendToNoteSchema } from './appendToNote.js';
import { schema as batchAddItemsSchema } from './batchAddItems.js';
import { schema as editItemSchema } from './editItem.js';

// Every tool below builds AppleScript by interpolating these values into a
// generated script. The caps bound what can reach osascript; the escaping in
// appleScriptString.ts is what makes it safe. Both matter.

const oversized = (n: number) => 'x'.repeat(n + 1);

test('task name is capped at 1000 characters', () => {
  assert.ok(addTaskSchema.safeParse({ name: 'x'.repeat(1000) }).success);
  assert.ok(!addTaskSchema.safeParse({ name: oversized(1000) }).success);
});

test('notes are capped at 10000 characters', () => {
  assert.ok(addTaskSchema.safeParse({ name: 'ok', note: 'x'.repeat(10000) }).success);
  assert.ok(!addTaskSchema.safeParse({ name: 'ok', note: oversized(10000) }).success);
});

test('date strings are capped at 50 characters', () => {
  assert.ok(!addTaskSchema.safeParse({ name: 'ok', dueDate: oversized(50) }).success);
  assert.ok(!editItemSchema.safeParse({ id: 'x', itemType: 'task', newDueDate: oversized(50) }).success);
});

test('ids are capped at 200 characters', () => {
  assert.ok(!addTaskSchema.safeParse({ name: 'ok', parentTaskId: oversized(200) }).success);
  assert.ok(!appendToNoteSchema.safeParse({ id: oversized(200), itemType: 'task', text: 'hi' }).success);
});

test('individual tags are capped at 200 characters', () => {
  assert.ok(addTaskSchema.safeParse({ name: 'ok', tags: ['x'.repeat(200)] }).success);
  assert.ok(!addTaskSchema.safeParse({ name: 'ok', tags: [oversized(200)] }).success);
});

test('tag arrays are capped at 50 entries', () => {
  const tag = (i: number) => `tag-${i}`;
  assert.ok(addTaskSchema.safeParse({ name: 'ok', tags: Array.from({ length: 50 }, (_, i) => tag(i)) }).success);
  assert.ok(!addTaskSchema.safeParse({ name: 'ok', tags: Array.from({ length: 51 }, (_, i) => tag(i)) }).success);
});

test('editItem tag operations are capped like task tags', () => {
  for (const field of ['addTags', 'removeTags', 'replaceTags'] as const) {
    assert.ok(
      !editItemSchema.safeParse({ id: 'x', itemType: 'task', [field]: [oversized(200)] }).success,
      `${field} should cap individual tag length`
    );
    assert.ok(
      !editItemSchema.safeParse({
        id: 'x',
        itemType: 'task',
        [field]: Array.from({ length: 51 }, (_, i) => `tag-${i}`)
      }).success,
      `${field} should cap array length`
    );
  }
});

test('appended note text is capped at 10000 characters', () => {
  assert.ok(!appendToNoteSchema.safeParse({ id: 'x', itemType: 'task', text: oversized(10000) }).success);
});

test('batchAddItems caps the item array at 100 and its nested fields', () => {
  const item = { type: 'task' as const, name: 'ok' };
  assert.ok(batchAddItemsSchema.safeParse({ items: Array.from({ length: 100 }, () => item) }).success);
  assert.ok(!batchAddItemsSchema.safeParse({ items: Array.from({ length: 101 }, () => item) }).success);
  assert.ok(!batchAddItemsSchema.safeParse({ items: [{ type: 'task', name: oversized(1000) }] }).success);
});

test('project schema caps mirror the task schema', () => {
  assert.ok(!addProjectSchema.safeParse({ name: oversized(1000) }).success);
  assert.ok(!addProjectSchema.safeParse({ name: 'ok', note: oversized(10000) }).success);
  assert.ok(!addProjectSchema.safeParse({ name: 'ok', folderName: oversized(1000) }).success);
});
