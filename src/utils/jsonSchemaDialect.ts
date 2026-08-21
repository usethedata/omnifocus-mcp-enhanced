/**
 * Re-labels outgoing tool schemas from JSON Schema draft-07 to 2020-12.
 *
 * Why this exists
 * ---------------
 * `@modelcontextprotocol/sdk` hardcodes draft-07 when it converts Zod schemas to
 * JSON Schema. In `server/zod-json-schema-compat.js` the Zod v3 branch calls
 * `zodToJsonSchema` with only `strictUnions` and `pipeStrategy` — never `target` —
 * and while the Zod v4 branch does accept a target, `server/mcp.js` never passes
 * one, so it falls back to draft-07 as well. There is no configuration knob, and
 * migrating to Zod v4 would not change the result. As of SDK 1.30.0 this is still
 * the case.
 *
 * Some MCP clients reject a draft-07 `outputSchema` outright, which makes every
 * structured-output tool unreachable before the call ever gets to OmniFocus. The
 * schemas this server emits are, in fact, already valid 2020-12 — only the
 * `$schema` string is wrong. So this rewrites the label rather than the schema.
 *
 * The guard is the point
 * ----------------------
 * Relabeling is only safe while the schemas avoid constructs whose meaning
 * differs between the two dialects. `hasDialectSensitiveConstruct` checks for
 * exactly those, and a schema containing one is passed through untouched, still
 * labelled draft-07. A wrong label is worse than an old one: it would make a
 * client validate against rules the schema was never written for. As upstream
 * adds tools, this degrades to "no change" instead of to "silently incorrect".
 *
 * This is a workaround for a client/SDK interop gap, not a fix for either, and
 * should be removed once the SDK emits a modern dialect.
 */

export const DRAFT_07 = 'http://json-schema.org/draft-07/schema#';
export const DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema';

type JsonObject = Record<string, unknown>;

/**
 * Keywords that may sit alongside `$ref` without changing what validates.
 *
 * In draft-07 a `$ref` overrides its siblings; in 2020-12 the siblings apply.
 * That difference only matters for keywords that constrain a value, so a `$ref`
 * carrying nothing but annotations means the same thing in both dialects.
 */
const ANNOTATION_KEYWORDS = new Set([
  '$schema',
  '$ref',
  '$comment',
  'title',
  'description',
  'default',
  'examples',
  'deprecated',
  'readOnly',
  'writeOnly'
]);

/**
 * True if any node in the schema means something different under 2020-12.
 *
 * - `definitions` was replaced by `$defs`
 * - array-form `items` (tuple validation) was replaced by `prefixItems`
 * - boolean `exclusiveMinimum`/`exclusiveMaximum` became numeric in draft-06
 * - `dependencies` was split into `dependentSchemas`/`dependentRequired`
 * - `$recursiveRef`/`$recursiveAnchor` were replaced by `$dynamicRef`/`$dynamicAnchor`
 * - `$ref` beside validation keywords, which draft-07 ignores and 2020-12 honors
 */
export function hasDialectSensitiveConstruct(node: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some(hasDialectSensitiveConstruct);
  }

  if (node === null || typeof node !== 'object') {
    return false;
  }

  const schema = node as JsonObject;

  if ('definitions' in schema) return true;
  if ('dependencies' in schema) return true;
  if ('$recursiveRef' in schema || '$recursiveAnchor' in schema) return true;
  if (Array.isArray(schema.items)) return true;
  if (typeof schema.exclusiveMinimum === 'boolean') return true;
  if (typeof schema.exclusiveMaximum === 'boolean') return true;

  if ('$ref' in schema && Object.keys(schema).some((key) => !ANNOTATION_KEYWORDS.has(key))) {
    return true;
  }

  return Object.values(schema).some(hasDialectSensitiveConstruct);
}

/**
 * Returns the schema labelled 2020-12, or the original object if it is not a
 * draft-07 schema or is not safe to relabel. Never mutates its argument —
 * the SDK reuses these objects between requests.
 */
export function retargetSchemaDialect(schema: unknown): unknown {
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    return schema;
  }

  const candidate = schema as JsonObject;
  if (candidate.$schema !== DRAFT_07) return schema;
  if (hasDialectSensitiveConstruct(candidate)) return schema;

  return { ...candidate, $schema: DRAFT_2020_12 };
}

/**
 * Rewrites the schema dialect in a `tools/list` response, leaving every other
 * message untouched and returning the original object when nothing changed.
 *
 * Both `inputSchema` and `outputSchema` are relabelled. Only `outputSchema` is
 * known to be rejected in the wild, but the guard establishes safety for both,
 * and one tool advertising two dialects is a puzzle nobody should have to solve
 * later. Narrowing this to output only is a one-line change if it ever matters.
 */
export function retargetToolListDialect(message: unknown): unknown {
  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    return message;
  }

  const envelope = message as JsonObject;
  const result = envelope.result;
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    return message;
  }

  const tools = (result as JsonObject).tools;
  if (!Array.isArray(tools)) return message;

  let changed = false;

  const retargeted = tools.map((tool) => {
    if (tool === null || typeof tool !== 'object' || Array.isArray(tool)) return tool;

    const definition = tool as JsonObject;
    const inputSchema = retargetSchemaDialect(definition.inputSchema);
    const outputSchema = retargetSchemaDialect(definition.outputSchema);

    if (inputSchema === definition.inputSchema && outputSchema === definition.outputSchema) {
      return tool;
    }

    changed = true;
    const copy: JsonObject = { ...definition };
    if ('inputSchema' in definition) copy.inputSchema = inputSchema;
    if ('outputSchema' in definition) copy.outputSchema = outputSchema;
    return copy;
  });

  if (!changed) return message;

  return {
    ...envelope,
    result: { ...(result as JsonObject), tools: retargeted }
  };
}
