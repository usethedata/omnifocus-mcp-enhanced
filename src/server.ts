#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import { getPackageVersion } from './version.js';

import { registerPrompts } from './context/prompts.js';
import { registerResources } from './context/resources.js';
import { registerTools } from './tools/registerTools.js';
import { retargetToolListDialect } from './utils/jsonSchemaDialect.js';

// Create an MCP server
const server = new McpServer({
  name: 'OmniFocus MCP',
  version: getPackageVersion(),
});

registerTools(server);

// Register prompts (guided review workflows) and resources (live snapshots)
registerPrompts(server);
registerResources(server);

// Start the MCP server
const transport = new StdioServerTransport();

// The SDK hardcodes JSON Schema draft-07 for tool schemas and offers no way to
// change it. Some clients reject a draft-07 outputSchema, which makes every
// structured-output tool unreachable. Relabel the dialect on the way out; the
// helper verifies each schema is safe to relabel and leaves it alone otherwise.
// See src/utils/jsonSchemaDialect.ts. Remove once the SDK emits 2020-12.
const sendMessage = transport.send.bind(transport);
transport.send = (message: JSONRPCMessage) =>
  sendMessage(retargetToolListDialect(message) as JSONRPCMessage);

// Use await with server.connect to ensure proper connection
(async function () {
  try {
    await server.connect(transport);
  } catch (err) {
    console.error(`Failed to start MCP server: ${err}`);
  }
})();

// For a cleaner shutdown if the process is terminated
