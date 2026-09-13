import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { captureSavedGames } from './saved-game-verification';
import { startIxPrototypeRoom } from './prototype-room';
import { sourceSnapshot } from './verification';

async function main() {
  const { values } = parseArgs({
    options: {
      db: { type: 'string' },
      room: { type: 'string' },
      version: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node --import tsx tools/start-prototype.ts --db PATH --room CODE --version NUMBER --out /private/new-directory\nStarts only a fresh ready Ix expansion lobby for local prototyping. Backs up all rooms first, preserves sessions and existing games, and rejects stale versions. Normal game-start and publication gates remain closed.',
    );
    return;
  }
  if (
    !values.db ||
    !values.room ||
    !values.out ||
    !/^\d+$/.test(values.version ?? '')
  )
    throw new Error(
      'Provide --db, --room, --version and a new private --out directory.',
    );
  const root = fileURLToPath(new URL('../', import.meta.url));
  const version = Number(values.version),
    source = sourceSnapshot(root);
  const snapshot = await captureSavedGames(root, values.db, values.out, true);
  if (
    !snapshot.rooms.some(
      (room) => room.code === values.room && room.version === version,
    )
  )
    throw new Error('The requested lobby version is absent from the backup.');
  const db = new DatabaseSync(values.db);
  try {
    const result = startIxPrototypeRoom(db, values.room, version);
    writeFileSync(
      resolve(values.out, 'prototype.json'),
      JSON.stringify(
        {
          format: 1,
          startedAt: new Date().toISOString(),
          profile: 'ix',
          source,
          beforeVersion: version,
          ...result,
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    console.log(JSON.stringify(result));
  } finally {
    db.close();
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Prototype start failed.',
  );
  process.exitCode = 1;
});
