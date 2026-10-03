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
      'ecaz-treachery': { type: 'boolean' },
      'mentat-question': { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node --import tsx tools/start-prototype.ts --profile ix|discovery|leader-skills|banker-income|factions|stronghold-factions|nexus|moritani-assassinate|ecaz-treachery|ecaz-occupy|semuta|kull|richese-betrayal|nexus-kull|guild-betrayal|ixian-replacement|ixian-betrayal|harkonnen-betrayal --db PATH --room CODE --version NUMBER --out /private/new-directory\nStarts only a fresh ready lobby for the selected development prototype. Stronghold-factions opts a fresh ready 2–6-seat Advanced roster with at least one selected native Ixians, Tleilaxu, CHOAM or Richese faction and otherwise classic opponents into Stronghold Cards alone. Select one or both distinct Ix/CHOAM decks; each native faction requires its family deck. The selected decks supply 47 Ix or combined, or 35 CHOAM canonical physical Treachery Cards, with a separate ten-card Richese cache when Richese plays. Native setup choices, HMS placement, Face Dancers, Richese cache and CHOAM Auditor remain genuine; custody starts unowned and is claimed by actual END Mentat. It does not redeal, reset or retrofit a saved game. Banker-income opts a fresh 2–6-seat classic Basic/Advanced base-deck roster, supported Basic Ixian/Tleilaxu/CHOAM/Moritani skill roster with its single required deck, or Advanced native Ixians, Tleilaxu and/or CHOAM plus classic roster with distinct required family decks, into automatic deferred normal income and native Mentat collection with all fourteen Leader Skills. Original bank payer costs exclude the separate Tleilaxu free-revival award; already-earned spice stays with its original faction under the existing provisional policy. Nexus enables the existing private Nexus setup. Moritani-assassinate explicitly opts into the bounded Advanced assassination preview. Semuta opts a fresh Richese roster into bounded clean-discard reactions; an included Ix deck supplies physical Thumper without opening public starts. Kull opts a fresh eligible CHOAM roster into the user-selected Karama interception preview. Richese-betrayal opts a fresh paired CHOAM/Richese Nexus roster into cache-purchase veto and sale-bank diversion. Nexus-kull opts a fresh CHOAM-plus-classic roster with CHOAM/Ix decks and Nexus into source-aware printed or any-Treachery-fueled Cunning Kull. Guild-betrayal opts a fresh classic roster with native Guild into full funded shipment-payment replacement; it preserves an explicitly enabled Homeworld module for Junction routes. Ixian-replacement opts a fresh classic Basic/Advanced base-deck roster, or Basic Tleilaxu plus classic opponents with the original Ix47 deck and no optional Sandtrout, into the exact normal-auction purchased-card replacement with Nexus alone. Native Ixians, Harkonnen buyers and special purchase sources remain unsupported. Ixian-betrayal opts a fresh 2–6-seat Basic/Advanced native Ixian plus classic/Tleilaxu roster with Ix 47-card Treachery and Nexus only into prevention of one actual native Bidding draw or Advanced Technology exchange, after native Karama counters. Harkonnen-betrayal opts a fresh 2–6-seat classic Basic/Advanced roster with native Harkonnen, base 33-card Treachery and Nexus alone into cancellation of an actual declared personal or allied Harkonnen Traitor Card after native counters, physical retirement and shuffle, and one private actual Mentat replacement. Modules, overlays, public starts and old-game retrofits remain excluded. Nexus is not dealt initially: a qualifying alliance requires at least three seats; two unallied receivers require four. Backs up all rooms first, preserves sessions and existing games, and rejects stale versions. Normal game-start and publication gates remain closed.',
      '\nEcaz-occupy (--profile ecaz-occupy) opts only a fresh ready 2–6-seat Advanced lobby with native Ecaz and classic/Ixian/Tleilaxu/CHOAM/Richese opponents (optional native Moritani). Distinct selected decks include ecaz and each native ix/choam family; ordinary33/47/35 cards retain real original offers/HMS/Auditor/Face Dancers and Richese cache. Explicit --ecaz-treachery independently adds the three physical variant cards, making36/50/38. Native Richese ordinary and marker-only pools compose with selected lead plans; original own mixed No-Field dialing, whole-plan disclosure and optional overlays remain guarded.' +
      '\nLeader-skills retains existing classic and Basic native entries and adds native Basic Richese/CHOAM. Advanced Ixians, Tleilaxu, CHOAM and/or Richese plus classic rosters use distinct required family decks and all fourteen skills, with original cache, Face Dancers, Auditor exclusion and typed aftermath. Foreign revival grants no new skill. Separate non-Harkonnen Advanced Moritani uses the ecaz deck and original skill-first assassination preview. Native Ecaz supports its five ordinary discs, original Ambassador/Duke custody and ecaz deck with classic opponents in Basic/Advanced; Advanced Harkonnen retains its existing Duke capture exclusion. Explicit --mentat-question stays private; banker-income additionally supports native Richese and Ecaz, never ordinary seller/allowed Emperor income or a bank grant as a payer cost. Basic auction recipients remain unchanged. Public activation, exhausted-cache counts, native Ixian Technology on Richese lots, own mixed No-Field, captured replacement, shared-Duke assignment, combined Occupy skills and other pending module/rulings remain guarded.',
    );
    return;
  }
  if (values['ecaz-treachery'] && values.profile !== 'ecaz-occupy')
    throw new Error('--ecaz-treachery requires --profile ecaz-occupy.');
  if (values['mentat-question'] && values.profile !== 'leader-skills')
    throw new Error('--mentat-question requires --profile leader-skills.');
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
    const result = startPrototypeRoom(db, values.room, version, values.profile,
      { ecazTreachery: values['ecaz-treachery'], mentatQuestion: values['mentat-question'] });
    writeFileSync(
      resolve(values.out, 'prototype.json'),
      JSON.stringify(
        {
          format: 1,
          startedAt: new Date().toISOString(),
          profile: values.profile,
          ecazTreachery: !!values['ecaz-treachery'],
          mentatQuestion: !!values['mentat-question'],
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
