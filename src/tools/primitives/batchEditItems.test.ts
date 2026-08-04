import assert from 'node:assert/strict';
import test from 'node:test';
import { batchEditItems, parseShift, validateParams } from './batchEditItems.js';

test('parseShift accepts day, week, and month offsets in both directions', () => {
  assert.deepEqual(parseShift('+1w'), { shift: { amount: 1, unit: 'w' } });
  assert.deepEqual(parseShift('-3d'), { shift: { amount: -3, unit: 'd' } });
  assert.deepEqual(parseShift('+12m'), { shift: { amount: 12, unit: 'm' } });
});

test('parseShift rejects unsupported units', () => {
  for (const raw of ['+1y', '+1h', '+1q', '+1']) {
    const parsed = parseShift(raw);
    assert.ok('error' in parsed, `expected ${raw} to be rejected`);
  }
});

test('parseShift rejects malformed offsets', () => {
  for (const raw of ['1w', '++1w', 'w1', '+1.5d', '', '+ 1w']) {
    const parsed = parseShift(raw);
    assert.ok('error' in parsed, `expected "${raw}" to be rejected`);
  }
});

test('parseShift rejects a zero offset because it would report success for no work', () => {
  const parsed = parseShift('+0d');
  assert.ok('error' in parsed);
  assert.match(parsed.error, /no effect/);
});

test('validateParams rejects an empty items array', () => {
  const result = validateParams({ items: [] });
  assert.equal(result.valid, false);
  assert.match(result.error || '', /required/);
});

test('validateParams rejects more than 100 items', () => {
  const items = Array.from({ length: 101 }, (_, index) => ({
    taskId: `task-${index}`,
    flagged: true,
  }));
  const result = validateParams({ items });
  assert.equal(result.valid, false);
  assert.match(result.error || '', /100/);
});

test('validateParams rejects a duplicate taskId', () => {
  const result = validateParams({
    items: [
      { taskId: 'task-1', flagged: true },
      { taskId: 'task-1', flagged: false },
    ],
  });
  assert.equal(result.valid, false);
  assert.match(result.error || '', /duplicate/);
});

test('validateParams rejects an item that changes nothing', () => {
  const result = validateParams({ items: [{ taskId: 'task-1' }] });
  assert.equal(result.valid, false);
  assert.match(result.error || '', /changes nothing/);
});

test('validateParams rejects an empty or whitespace-only name', () => {
  for (const name of ['', '   ']) {
    const result = validateParams({ items: [{ taskId: 'task-1', name }] });
    assert.equal(result.valid, false, `expected "${name}" to be rejected`);
    assert.match(result.error || '', /name must not be empty/);
  }
});

test('validateParams rejects both an absolute date and a shift on one field', () => {
  const result = validateParams({
    items: [{ taskId: 'task-1', dueDate: '2026-09-15', dueDateShift: '+1w' }],
  });
  assert.equal(result.valid, false);
  assert.match(result.error || '', /use one or the other/);
});

test('validateParams rejects an unparseable absolute date', () => {
  const result = validateParams({
    items: [{ taskId: 'task-1', dueDate: 'next tuesday' }],
  });
  assert.equal(result.valid, false);
  assert.match(result.error || '', /not a valid date/);
});

test('validateParams accepts null to clear a date', () => {
  const result = validateParams({ items: [{ taskId: 'task-1', dueDate: null }] });
  assert.equal(result.valid, true);
});

test('validateParams separates null, absent, and zero for estimatedMinutes', () => {
  assert.equal(
    validateParams({ items: [{ taskId: 'task-1', estimatedMinutes: null }] }).valid,
    true,
  );
  assert.equal(
    validateParams({ items: [{ taskId: 'task-1', estimatedMinutes: 0 }] }).valid,
    true,
  );
  assert.equal(
    validateParams({ items: [{ taskId: 'task-1', estimatedMinutes: -5 }] }).valid,
    false,
  );
  assert.equal(
    validateParams({ items: [{ taskId: 'task-1', estimatedMinutes: 12.5 }] }).valid,
    false,
  );
});

test('validateParams rejects replaceTags combined with addTags or removeTags', () => {
  const withAdd = validateParams({
    items: [{ taskId: 'task-1', replaceTags: ['a'], addTags: ['b'] }],
  });
  assert.equal(withAdd.valid, false);
  assert.match(withAdd.error || '', /one approach/);

  const withRemove = validateParams({
    items: [{ taskId: 'task-1', replaceTags: ['a'], removeTags: ['b'] }],
  });
  assert.equal(withRemove.valid, false);
});

test('validateParams accepts addTags together with removeTags', () => {
  const result = validateParams({
    items: [{ taskId: 'task-1', addTags: ['a'], removeTags: ['b'] }],
  });
  assert.equal(result.valid, true);
});

test('validateParams rejects an empty tag name', () => {
  const result = validateParams({
    items: [{ taskId: 'task-1', addTags: ['ok', '  '] }],
  });
  assert.equal(result.valid, false);
  assert.match(result.error || '', /empty tag names/);
});

test('batchEditItems reports an invalid request without touching OmniFocus', async () => {
  const result = await batchEditItems({ items: [] });
  assert.equal(result.success, false);
  assert.equal(result.code, 'INVALID_EDIT');
});
