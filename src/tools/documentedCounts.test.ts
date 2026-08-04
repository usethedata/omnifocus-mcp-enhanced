import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { registerPrompts } from '../context/prompts.js';
import { registerResources } from '../context/resources.js';
import { registerTools } from './registerTools.js';

/**
 * The READMEs advertise counts for tools, prompts, and resources. Those numbers
 * drifted before: the surface line claimed five prompts for several releases
 * while the server registered six, because `task_health_scan` was added without
 * touching the docs. Derive the counts from the server and assert the docs match.
 */

interface CountedServer {
  registerTool: (name: string) => void;
  registerPrompt: (name: string) => void;
  registerResource: (name: string) => void;
}

function countRegistrations(): {
  tools: number;
  toolsWithOutputSchema: number;
  prompts: number;
  resources: number;
} {
  let tools = 0;
  let toolsWithOutputSchema = 0;
  let prompts = 0;
  let resources = 0;

  const server = {
    registerTool: (_name: string, config?: { outputSchema?: unknown }) => {
      tools += 1;
      if (config && 'outputSchema' in config) toolsWithOutputSchema += 1;
    },
    registerPrompt: () => {
      prompts += 1;
    },
    registerResource: () => {
      resources += 1;
    },
  } as unknown as CountedServer;

  // The register functions take an McpServer; this stand-in only counts calls.
  registerTools(server as never);
  registerPrompts(server as never);
  registerResources(server as never);

  return { tools, toolsWithOutputSchema, prompts, resources };
}

function readDoc(name: string): string {
  // Compiled to dist/tools/, so the repo root is two levels up.
  return readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
}

test('both READMEs advertise the counts the server actually registers', () => {
  const counts = countRegistrations();

  const english = readDoc('README.md');
  const chinese = readDoc('README.zh.md');

  assert.match(
    english,
    new RegExp(
      `\\*\\*${counts.tools} tools \\(${counts.toolsWithOutputSchema} with structured output\\), ${counts.prompts} prompts, ${counts.resources} resources\\*\\*`,
    ),
    'README.md surface line must match the registered counts',
  );

  assert.match(
    chinese,
    new RegExp(
      `\\*\\*${counts.tools} 个工具（其中 ${counts.toolsWithOutputSchema} 个带结构化输出）、${counts.prompts} 个 Prompts、${counts.resources} 个 Resources\\*\\*`,
    ),
    'README.zh.md surface line must match the registered counts',
  );

  assert.match(
    english,
    new RegExp(`${counts.prompts} guided workflows`),
    'README.md prompt bullet must match the registered prompt count',
  );
  assert.match(
    chinese,
    new RegExp(`${counts.prompts} 个引导式工作流`),
    'README.zh.md prompt bullet must match the registered prompt count',
  );
});

test('the tool reference heading matches the registered tool count', () => {
  const counts = countRegistrations();

  assert.match(
    readDoc('README.md'),
    new RegExp(`Complete Tool Reference — ${counts.tools} Tools`),
  );
  assert.match(
    readDoc('README.zh.md'),
    new RegExp(`完整工具参考——${counts.tools} 个工具`),
  );
});

// The tarball ships README.md and README.zh.md but not docs/, so a relative link
// into docs/ is dead for anyone reading the README inside node_modules.
test('the READMEs link into docs with absolute URLs, not relative paths', () => {
  for (const name of ['README.md', 'README.zh.md']) {
    const relative = readDoc(name).match(/\]\(docs\/[^)]+\)/g);
    assert.equal(
      relative,
      null,
      `${name} must not link into docs/ with a relative path: ${relative?.join(', ')}`,
    );
  }
});
