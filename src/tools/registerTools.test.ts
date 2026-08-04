import assert from 'node:assert/strict';
import test from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ZodTypeAny } from 'zod';

import { registerTools } from './registerTools.js';

interface RegisteredToolCall {
  name: string;
  config: {
    annotations?: ToolAnnotations;
    description?: string;
    inputSchema?: ZodTypeAny | Record<string, ZodTypeAny>;
    outputSchema?: ZodTypeAny;
  };
}

function captureTools(): RegisteredToolCall[] {
  const calls: RegisteredToolCall[] = [];
  const server = {
    registerTool(name: string, config: RegisteredToolCall['config']): void {
      calls.push({ name, config });
    },
  } as unknown as McpServer;

  registerTools(server);
  return calls;
}

test('registerTools exposes 26 unique consolidated tools', () => {
  const calls = captureTools();
  const names = calls.map((call) => call.name);

  assert.equal(calls.length, 26);
  assert.equal(new Set(names).size, calls.length);
  assert.equal(names.includes('manage_task_notifications'), true);
  assert.equal(names.includes('batch_edit_items'), true);
  assert.equal(names.includes('get_today_completed_tasks'), false);
  assert.equal(names.includes('list_task_notifications'), false);
  assert.equal(names.includes('add_task_notification'), false);
  assert.equal(names.includes('remove_task_notification'), false);
});

test('registerTools marks local reads and destructive writes accurately', () => {
  const calls = captureTools();
  const byName = new Map(
    calls.map((call) => [call.name, call.config.annotations]),
  );

  assert.deepEqual(byName.get('filter_tasks'), {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  });
  assert.deepEqual(byName.get('add_omnifocus_task'), {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  });
  assert.deepEqual(byName.get('create_project_from_outline'), {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  });
  assert.deepEqual(byName.get('batch_remove_items'), {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
  });
  for (const name of [
    'manage_tags',
    'manage_folders',
    'manage_task_notifications',
  ]) {
    assert.deepEqual(byName.get(name), {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    });
  }
  assert.equal(
    calls.every((call) => call.config.annotations?.openWorldHint === false),
    true,
  );
});

// The SDK throws when a tool declaring an output schema returns success without
// structured content, so the key must never appear on a tool that does not
// build one. Absent means absent, not `undefined`.
test('registerTools forwards an output schema only for migrated tools', () => {
  const calls = captureTools();
  const withSchema = calls
    .filter((call) => 'outputSchema' in call.config)
    .map((call) => call.name)
    .sort();

  assert.deepEqual(withSchema, [
    'batch_add_items',
    'batch_complete_tasks',
    'batch_edit_items',
    'batch_move_tasks',
    'batch_remove_items',
    'count_tasks',
    'filter_tasks',
    'get_tasks',
  ]);

  for (const call of calls) {
    if (!withSchema.includes(call.name)) continue;
    assert.equal(
      typeof call.config.outputSchema?.parse,
      'function',
      `${call.name} must forward a Zod output schema`,
    );
  }
});
