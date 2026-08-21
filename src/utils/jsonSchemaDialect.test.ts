import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DRAFT_07,
  DRAFT_2020_12,
  hasDialectSensitiveConstruct,
  retargetSchemaDialect,
  retargetToolListDialect
} from './jsonSchemaDialect.js';

const draft07 = (extra: Record<string, unknown> = {}) => ({
  $schema: DRAFT_07,
  type: 'object',
  ...extra
});

const toolListMessage = (tools: unknown[]) => ({
  jsonrpc: '2.0',
  id: 2,
  result: { tools }
});

test('a plain draft-07 schema is relabelled as 2020-12', () => {
  const result = retargetSchemaDialect(draft07({ properties: { name: { type: 'string' } } }));
  assert.equal((result as Record<string, unknown>).$schema, DRAFT_2020_12);
});

test('relabelling does not mutate the original schema', () => {
  const original = draft07();
  const result = retargetSchemaDialect(original);

  assert.notEqual(result, original);
  assert.equal(original.$schema, DRAFT_07, 'the SDK reuses these objects between requests');
});

test('a schema already on another dialect is returned untouched', () => {
  const already2020 = { $schema: DRAFT_2020_12, type: 'object' };
  assert.equal(retargetSchemaDialect(already2020), already2020);

  const unlabelled = { type: 'object' };
  assert.equal(retargetSchemaDialect(unlabelled), unlabelled);
});

test('non-schema values pass through', () => {
  assert.equal(retargetSchemaDialect(undefined), undefined);
  assert.equal(retargetSchemaDialect(null), null);
  assert.equal(retargetSchemaDialect('text'), 'text');
});

// The guard. Each of these means something different under 2020-12, so the
// schema must keep its draft-07 label rather than be relabelled incorrectly.

test('definitions blocks relabelling', () => {
  const schema = draft07({ definitions: { thing: { type: 'string' } } });
  assert.ok(hasDialectSensitiveConstruct(schema));
  assert.equal(retargetSchemaDialect(schema), schema);
});

test('tuple-form items blocks relabelling', () => {
  const schema = draft07({
    properties: { pair: { type: 'array', items: [{ type: 'string' }, { type: 'number' }] } }
  });
  assert.ok(hasDialectSensitiveConstruct(schema));
  assert.equal(retargetSchemaDialect(schema), schema);
});

test('single-schema items does not block relabelling', () => {
  const schema = draft07({
    properties: { tags: { type: 'array', items: { type: 'string' } } }
  });
  assert.ok(!hasDialectSensitiveConstruct(schema));
  assert.equal((retargetSchemaDialect(schema) as Record<string, unknown>).$schema, DRAFT_2020_12);
});

test('boolean exclusiveMinimum blocks relabelling', () => {
  const schema = draft07({
    properties: { count: { type: 'number', minimum: 0, exclusiveMinimum: true } }
  });
  assert.ok(hasDialectSensitiveConstruct(schema));
  assert.equal(retargetSchemaDialect(schema), schema);
});

test('numeric exclusiveMinimum does not block relabelling', () => {
  const schema = draft07({ properties: { count: { type: 'number', exclusiveMinimum: 0 } } });
  assert.ok(!hasDialectSensitiveConstruct(schema));
});

test('dependencies blocks relabelling', () => {
  const schema = draft07({ dependencies: { a: ['b'] } });
  assert.ok(hasDialectSensitiveConstruct(schema));
});

test('$recursiveRef blocks relabelling', () => {
  assert.ok(hasDialectSensitiveConstruct(draft07({ properties: { self: { $recursiveRef: '#' } } })));
});

test('$ref beside a validation keyword blocks relabelling', () => {
  // draft-07 ignores the sibling; 2020-12 applies it.
  const schema = draft07({
    properties: { name: { $ref: '#/properties/other', minLength: 3 } }
  });
  assert.ok(hasDialectSensitiveConstruct(schema));
  assert.equal(retargetSchemaDialect(schema), schema);
});

test('$ref beside only annotations does not block relabelling', () => {
  // This is the shape the server actually emits — description alongside $ref.
  const schema = draft07({
    properties: { name: { $ref: '#/properties/other', description: 'A name' } }
  });
  assert.ok(!hasDialectSensitiveConstruct(schema));
  assert.equal((retargetSchemaDialect(schema) as Record<string, unknown>).$schema, DRAFT_2020_12);
});

test('the guard reaches constructs nested deep in the tree', () => {
  const schema = draft07({
    properties: {
      outer: { type: 'object', properties: { inner: { definitions: { x: { type: 'string' } } } } }
    }
  });
  assert.ok(hasDialectSensitiveConstruct(schema));
});

// Message-level rewriting.

test('both inputSchema and outputSchema are relabelled in a tools/list response', () => {
  const message = toolListMessage([
    { name: 'get_tasks', inputSchema: draft07(), outputSchema: draft07() }
  ]);

  const result = retargetToolListDialect(message) as {
    result: { tools: Array<Record<string, Record<string, unknown>>> };
  };
  const tool = result.result.tools[0];

  assert.equal(tool.inputSchema.$schema, DRAFT_2020_12);
  assert.equal(tool.outputSchema.$schema, DRAFT_2020_12);
});

test('a tool without an outputSchema does not gain one', () => {
  const message = toolListMessage([{ name: 'dump_database', inputSchema: draft07() }]);

  const result = retargetToolListDialect(message) as {
    result: { tools: Array<Record<string, unknown>> };
  };

  assert.ok(!('outputSchema' in result.result.tools[0]));
});

test('a tool whose schema cannot be relabelled is left alone alongside ones that can', () => {
  const blocked = draft07({ definitions: { thing: { type: 'string' } } });
  const message = toolListMessage([
    { name: 'safe', outputSchema: draft07() },
    { name: 'blocked', outputSchema: blocked }
  ]);

  const result = retargetToolListDialect(message) as {
    result: { tools: Array<Record<string, Record<string, unknown>>> };
  };

  assert.equal(result.result.tools[0].outputSchema.$schema, DRAFT_2020_12);
  assert.equal(result.result.tools[1].outputSchema.$schema, DRAFT_07);
});

test('messages that are not tools/list responses pass through unchanged', () => {
  for (const message of [
    { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05' } },
    { jsonrpc: '2.0', id: 3, result: { prompts: [] } },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 4, error: { code: -32601, message: 'Method not found' } }
  ]) {
    assert.equal(retargetToolListDialect(message), message);
  }
});

test('a tools/list response needing no change returns the identical object', () => {
  const message = toolListMessage([{ name: 'x', inputSchema: { $schema: DRAFT_2020_12 } }]);
  assert.equal(retargetToolListDialect(message), message);
});

test('malformed messages do not throw', () => {
  assert.doesNotThrow(() => retargetToolListDialect(null));
  assert.doesNotThrow(() => retargetToolListDialect({ result: { tools: 'not-an-array' } }));
  assert.doesNotThrow(() => retargetToolListDialect({ result: { tools: [null, 42] } }));
});
