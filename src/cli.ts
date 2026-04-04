#!/usr/bin/env node

import { openWorkspace } from './workspace.js';
import { openDb } from './db/index.js';
import { startServer } from './server/index.js';
import open from 'open';

function parseArgs(args: string[]): { workspacePath: string | null; port: number } {
  let workspacePath: string | null = null;
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

  if (workspacePath) {
    const ws = openWorkspace(workspacePath);
    openDb(ws.dbPath);
  }

  const actualPort = await startServer(port);
  await open(`http://localhost:${actualPort}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
