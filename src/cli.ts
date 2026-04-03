#!/usr/bin/env node

import { initWorkspace } from './workspace.js';
import { startServer } from './server/index.js';
import open from 'open';

function parseArgs(args: string[]): { workspacePath: string; port: number } {
  let workspacePath = process.cwd();
  let port = 3456;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith('--')) {
      workspacePath = args[i];
    }
  }

  return { workspacePath, port };
}

async function main() {
  const { workspacePath, port } = parseArgs(process.argv.slice(2));

  const workspace = initWorkspace(workspacePath);

  const actualPort = await startServer(workspace, port);

  const url = `http://localhost:${actualPort}`;
  await open(url);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
