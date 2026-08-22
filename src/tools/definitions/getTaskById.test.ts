import assert from 'node:assert/strict';
import test from 'node:test';
import { formatTaskInfo } from './getTaskById.js';

test('formatTaskInfo includes attachment metadata for follow-up reads', () => {
  const output = formatTaskInfo({
    id: 'task-1',
    name: 'Review screenshots',
    note: 'Latest UI mocks are attached',
    hasChildren: false,
    childrenCount: 0,
    tags: [
      {
        id: 'tag-design',
        name: 'design',
        path: 'work / design',
        ancestorIds: ['tag-work'],
      },
    ],
    children: [],
    childrenTruncated: false,
    flagged: false,
    repetition: null,
    completed: false,
    linkedFileURLs: [],
    attachments: [
      {
        id: 'embedded-1',
        name: 'ui-mock.png',
        kind: 'image',
        mimeType: 'image/png',
        sizeBytes: 4096,
        source: 'embedded',
        isImage: true,
      },
    ],
  });

  assert.match(output, /Attachments\*\*: 1/);
  assert.match(output, /embedded-1/);
  assert.match(output, /ui-mock\.png/);
  assert.match(output, /image\/png/);
  assert.match(output, /Use read_task_attachment/);
  assert.match(output, /Tags\*\*: work \/ design/);
});

test('formatTaskInfo renders the repetition rule and next occurrence', () => {
  const output = formatTaskInfo({
    id: 'task-2',
    name: 'Weekly admin checklist',
    note: '',
    hasChildren: false,
    childrenCount: 0,
    tags: [],
    children: [],
    childrenTruncated: false,
    flagged: false,
    completed: false,
    linkedFileURLs: [],
    attachments: [],
    repetition: {
      ruleString: 'FREQ=WEEKLY;BYDAY=FR',
      scheduleType: 'Regularly',
      anchorDateKey: 'DueDate',
      catchUpAutomatically: true,
      nextOccurrence: '2026-08-07T10:00:00.000Z',
    },
  });

  assert.match(
    output,
    /Repeats\*\*: FREQ=WEEKLY;BYDAY=FR, Regularly, anchor DueDate, catch up/,
  );
  assert.match(output, /Next Occurrence\*\*: /);
});

test('formatTaskInfo omits repetition lines for one-off tasks', () => {
  const output = formatTaskInfo({
    id: 'task-3',
    name: 'One-off task',
    note: '',
    hasChildren: false,
    childrenCount: 0,
    tags: [],
    children: [],
    childrenTruncated: false,
    flagged: false,
    completed: false,
    linkedFileURLs: [],
    attachments: [],
    repetition: null,
  });

  assert.equal(/Repeats/.test(output), false);
  assert.equal(/Next Occurrence/.test(output), false);
});

// Regression guard. These three fields were a local delta that the 2.4.0 rebuild
// dropped, which silently broke a downstream procedure: it decides completion by
// looking for "Completed: Yes" here, and a completed task rendered identically to
// an incomplete one, so the check returned a false clean every time.
//
// This tool has no structured output, so the prose render is the only channel —
// an omission here is unrecoverable by the caller. Keep these assertions across
// upstream merges.

const baseTask = {
  id: 'task-guard',
  name: 'Guarded task',
  note: '',
  hasChildren: false,
  childrenCount: 0,
  tags: [],
  children: [],
  childrenTruncated: false,
  flagged: false,
  completed: false,
  repetition: null,
  linkedFileURLs: [],
  attachments: [],
};

test('formatTaskInfo distinguishes a completed task from an incomplete one', () => {
  const done = formatTaskInfo({ ...baseTask, completed: true });
  const open = formatTaskInfo({ ...baseTask, completed: false });

  assert.match(done, /\*\*Completed\*\*: Yes/);
  assert.match(open, /\*\*Completed\*\*: No/);
  assert.notEqual(done, open, 'a completed task must not render identically to an open one');
});

test('formatTaskInfo reports flagged state in both directions', () => {
  assert.match(formatTaskInfo({ ...baseTask, flagged: true }), /\*\*Flagged\*\*: Yes/);
  assert.match(formatTaskInfo({ ...baseTask, flagged: false }), /\*\*Flagged\*\*: No/);
});

test('formatTaskInfo reports an estimate when the task carries one', () => {
  assert.match(formatTaskInfo({ ...baseTask, estimatedMinutes: 45 }), /\*\*Estimated\*\*: 45 minutes/);
});

test('formatTaskInfo omits the estimate line when there is no estimate', () => {
  assert.doesNotMatch(formatTaskInfo(baseTask), /\*\*Estimated\*\*/);
  assert.doesNotMatch(formatTaskInfo({ ...baseTask, estimatedMinutes: 0 }), /\*\*Estimated\*\*/);
});
