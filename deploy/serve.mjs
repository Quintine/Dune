import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';

const server = resolve('dist/server');
const config = JSON.parse(await readFile(resolve(server, 'wrangler.json'), 'utf8'));
const migrations = JSON.parse(await readFile('tools/wrangler.local.json', 'utf8'));
const migrationIds = new Map(migrations.d1_databases.map((db) => [db.binding, db.database_id]));
for (const db of config.d1_databases) {
  if (migrationIds.get(db.binding) !== db.database_id) {
    throw new Error(`Migration/runtime database identity mismatch for ${db.binding}`);
  }
}
const state = resolve(process.env.DUNE_STATE_PATH || '/data');
const port = Number(process.env.DUNE_PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid DUNE_PORT');
async function modulesIn(directory) {
  const modules = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) modules.push(...await modulesIn(path));
    else if (/\.m?js$/.test(entry.name)) modules.push({ type: 'ESModule', path });
  }
  return modules;
}
const entrypoint = resolve(server, config.main);
// Vinext contains computed imports. Register the complete emitted module graph
// explicitly instead of asking Miniflare's static import scanner to infer it.
const modules = [
  { type: 'ESModule', path: entrypoint },
  ...(await modulesIn(server)).filter((module) => module.path !== entrypoint),
];

// Serve the immutable build directly. Wrangler's development proxy can fail a
// subsequent POST after Vinext cancels a rejected request body with assets on.
const runtime = new Miniflare({
  name: config.name,
  host: '0.0.0.0',
  port,
  cf: false,
  modules,
  modulesRoot: server,
  compatibilityDate: config.compatibility_date,
  compatibilityFlags: config.compatibility_flags,
  bindings: { ...config.vars, DUNE_PUBLIC_ORIGIN: process.env.DUNE_PUBLIC_ORIGIN || '' },
  d1Databases: Object.fromEntries(config.d1_databases.map((db) => [db.binding, db.database_id])),
  // Match Wrangler's --persist-to layout, including its local migration ledger.
  d1Persist: resolve(state, 'v3/d1'),
  cachePersist: resolve(state, 'v3/cache'),
  assets: {
    directory: resolve(server, config.assets.directory),
    binding: 'ASSETS',
    routerConfig: { has_user_worker: true },
  },
});

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await runtime.dispose();
}
process.on('SIGTERM', () => { void stop(); });
process.on('SIGINT', () => { void stop(); });
try {
  await runtime.ready;
  console.log(`Dune listening on HTTP port ${port}`);
} catch (error) {
  await stop();
  throw error;
}
