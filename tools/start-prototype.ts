import { DatabaseSync } from 'node:sqlite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { captureSavedGames } from './saved-game-verification';
import { isPrototypeProfile, startPrototypeRoom } from './prototype-room';
import { sourceSnapshot } from './verification';

async function main() {
  const { values } = parseArgs({
    options: {
      db: { type: 'string' },
      profile: { type: 'string', default: 'ix' },
      room: { type: 'string' },
      version: { type: 'string' },
      out: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node --import tsx tools/start-prototype.ts --profile ix|discovery|leader-skills|factions|nexus|moritani-assassinate|ecaz-treachery|semuta|kull|richese-betrayal|nexus-kull|guild-betrayal --db PATH --room CODE --version NUMBER --out /private/new-directory\nStarts only a fresh ready lobby for the selected development prototype. Nexus enables the existing private Nexus setup. Moritani-assassinate explicitly opts into the bounded Advanced assassination preview. Semuta opts a fresh Richese roster into bounded clean-discard reactions; an included Ix deck supplies physical Thumper without opening public starts. Kull opts a fresh eligible CHOAM roster into the user-selected Karama interception preview. Richese-betrayal opts a fresh paired CHOAM/Richese Nexus roster into cache-purchase veto and sale-bank diversion. Nexus-kull opts a fresh CHOAM-plus-classic roster with CHOAM/Ix decks and Nexus into source-aware printed or any-Treachery-fueled Cunning Kull. Guild-betrayal opts a fresh classic roster with native Guild into full funded shipment-payment replacement; it preserves an explicitly enabled Homeworld module for Junction routes. Backs up all rooms first, preserves sessions and existing games, and rejects stale versions. Normal game-start and publication gates remain closed.',
    );
    return;
  }
  if (
    !isPrototypeProfile(values.profile) ||
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
    const result = startPrototypeRoom(db, values.room, version, values.profile);
    writeFileSync(
      resolve(values.out, 'prototype.json'),
      JSON.stringify(
        {
          format: 1,
          startedAt: new Date().toISOString(),
          profile: values.profile,
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
