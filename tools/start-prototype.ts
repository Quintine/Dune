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
      'nexus-cards': { type: 'boolean' },
      discoveries: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(
      'Usage: node --import tsx tools/start-prototype.ts --profile ix|discovery|homeworld-occupation|leader-skills|banker-income|factions|stronghold-factions|nexus|moritani-assassinate|ecaz-treachery|ecaz-occupy|semuta|kull|richese-betrayal|nexus-kull|guild-betrayal|ixian-replacement|ixian-betrayal|harkonnen-betrayal --db PATH --room CODE --version NUMBER --out /private/new-directory\nStarts only a fresh ready lobby for the selected development prototype. Stronghold-factions opts a fresh ready 2–6-seat Advanced roster with at least one selected native Ixians, Tleilaxu, CHOAM or Richese faction and otherwise classic opponents into Stronghold Cards, optionally preserving unused Tech Tokens at 3–6 seats. Select one or both distinct Ix/CHOAM decks; each native faction requires its family deck. The selected decks supply 47 Ix or combined, or 35 CHOAM canonical physical Treachery Cards, with a separate ten-card Richese cache when Richese plays. Native setup choices, HMS placement, Face Dancers, Richese cache and CHOAM Auditor remain genuine; custody starts unowned and is claimed by actual END Mentat. It does not redeal, reset or retrofit a saved game. Banker-income opts a fresh 2–6-seat classic Basic/Advanced base-deck roster, supported Basic Ixian/Tleilaxu/CHOAM/Moritani skill roster with its single required deck, or Advanced native Ixians, Tleilaxu and/or CHOAM plus classic roster with distinct required family decks, into automatic deferred normal income and native Mentat collection with all fourteen Leader Skills. Original bank payer costs exclude the separate Tleilaxu free-revival award; already-earned spice stays with its original faction under the existing provisional policy. Nexus enables the existing private Nexus setup. Moritani-assassinate explicitly opts into the bounded Advanced assassination preview. Semuta opts a fresh Richese roster into bounded clean-discard reactions; an included Ix deck supplies physical Thumper without opening public starts. Kull opts a fresh eligible CHOAM roster into the user-selected Karama interception preview. Richese-betrayal opts a fresh paired CHOAM/Richese Nexus roster into cache-purchase veto and sale-bank diversion. Nexus-kull opts a fresh CHOAM-plus-classic roster with CHOAM/Ix decks and Nexus into source-aware printed or any-Treachery-fueled Cunning Kull. Guild-betrayal opts a fresh classic roster with native Guild into full funded shipment-payment replacement; it preserves an explicitly enabled Homeworld module for Junction routes. Ixian-replacement opts a fresh classic Basic/Advanced base-deck roster, or Basic Tleilaxu plus classic opponents with the original Ix47 deck and no optional Sandtrout, into the exact normal-auction purchased-card replacement with Nexus alone. Native Ixians, Harkonnen buyers and special purchase sources remain unsupported. Ixian-betrayal opts a fresh 2–6-seat Basic/Advanced native Ixian plus classic/Tleilaxu roster with Ix 47-card Treachery and Nexus only into prevention of one actual native Bidding draw or Advanced Technology exchange, after native Karama counters. Harkonnen-betrayal opts a fresh 2–6-seat classic Basic/Advanced roster with native Harkonnen, base 33-card Treachery and Nexus alone into cancellation of an actual declared personal or allied Harkonnen Traitor Card after native counters, physical retirement and shuffle, and one private actual Mentat replacement. Modules, overlays, public starts and old-game retrofits remain excluded except for each profile’s documented composition. Nexus is not dealt initially: a qualifying alliance requires at least three seats; two unallied receivers require four. Backs up all rooms first, preserves sessions and existing games, and rejects stale versions. Normal game-start and publication gates remain closed.',
      '\nEcaz-occupy (--profile ecaz-occupy) opts only a fresh ready 2–6-seat lobby with native Ecaz and classic/Ixian/Tleilaxu/CHOAM/Richese opponents (optional native Moritani). Advanced uses distinct selected ecaz/ix/choam decks; Basic uses the exact ecaz deck with classic/optional Moritani opponents. Ordinary33/47/35 cards retain real original offers/HMS/Auditor/Face Dancers and Richese cache. Explicit --ecaz-treachery independently adds the three physical variant cards, making36/50/38 (Advanced only). Basic combined battles require an even Ecaz force count; the preserved publisher odd-force casualty-rounding conflict rejects before any lead choice. Native Richese ordinary and marker-only pools compose with selected lead plans; original own mixed No-Field dialing, whole-plan disclosure and optional overlays remain guarded.' +
      '\nLeader-skills retains existing classic and Basic native entries and adds native Basic Richese/CHOAM. Advanced Ixians, Tleilaxu, CHOAM and/or Richese plus classic rosters use distinct required family decks and all fourteen skills, with original cache, Face Dancers, Auditor exclusion and typed aftermath. Foreign revival grants no new skill. Separate non-Harkonnen Advanced Moritani uses the ecaz deck and original skill-first assassination preview. Native Ecaz supports its five ordinary discs, original Ambassador/Duke custody and ecaz deck with classic opponents in Basic/Advanced; Advanced Harkonnen retains its existing Duke capture exclusion. Explicit --mentat-question stays private; banker-income additionally supports native Richese and Ecaz, never ordinary seller/allowed Emperor income or a bank grant as a payer cost. Basic auction recipients remain unchanged. Public activation, exhausted-cache counts, native Ixian Technology on Richese lots, own mixed No-Field, captured replacement, shared-Duke assignment, combined Occupy skills and other pending module/rulings remain guarded.',
      '\nStronghold-factions additionally admits standalone Advanced Ecaz OR Moritani with classic opponents and the exact ecaz deck, six Stronghold Cards with optional unused Tech Tokens at 3–6 seats. Original setup and actual end-Mentat claims remain. Ecaz holds shared-control cards and only the actual selected holder-plan benefits. Native Moritani retains original assassination with printed bounty and one private Mentat replacement; Harkonnen is excluded there. An E3 pair, E1/E2/E3 mixtures and other modules remain separate.' +
      '\nLeader-skills and banker-income preserve canonical unused Tech Tokens selected in fresh three-through-six-seat classic or supported native Basic/Advanced lobbies. Original selected decks, Richese cache, all fourteen skills, printed native Tech owners, phase-end income and mandatory original-winner reward before Face Dance remain. Banker income and --mentat-question stay separate existing opt-ins. Mixed E3 families, other modules and played-game conversion remain excluded.',
      '\nLeader-skills and banker-income also preserve canonical unused Stronghold Cards in fresh Advanced classic or supported native two-through-six-seat lobbies. Optional Tech Tokens requires three-through-six seats. All14 original skills, decks/cache and actual end-Mentat Stronghold assignment remain. Basic Strongholds, mixed E3 families, other overlays, public activation and save conversion stay excluded.',
      '\nThese skill/module entries additionally preserve standalone Ecaz OR Moritani ecaz33/all14 profiles. Tech is Basic/Advanced three-through-six seats; Strongholds is Advanced two-through-six. Native Ecaz five-disc/Duke assignment and Advanced Harkonnen exclusion, plus original Advanced Moritani skill-first assassination/normal-call forfeiture, remain. E3 pairs, mixed families, allied Occupy skills and other overlays are not opened.',
      '\nWithout Skills, factions preserves unused original Tech Tokens in fresh 3–6-seat Basic/Advanced selected E1/E2 native or standalone Ecaz OR Moritani lobbies with classic opponents; stronghold-factions composes them with Advanced Stronghold Cards. Original physical inventories, first-Storm owners, selected Ecaz lead rewards, even-force Basic Occupy and non-Harkonnen Advanced Moritani assassination remain. Skills, unrelated overlays, paired/mixed E3 rosters and public starts remain separate.',
      '\nNexus preserves selected unused original Tech Tokens in classic/base33/all12 three-through-six-seat Basic/Advanced lobbies, and/or unused Stronghold Cards in Advanced two-through-six-seat lobbies; both requires3+. Existing Homeworlds may be retained. Genuine first-Storm/end-Mentat custody and closing Nexus deals remain. Borrowed tariff/force identity, original free-return ledgers, phase-end industry, held support and retention/winner rewards reuse existing handlers. Skills, expansion families outside their documented entries, unrelated previews, unresolved effects and public starts remain separate.',
      '\nNexus additionally routes a supported paired native E1 (Ixians+Tleilaxu) OR E2 (CHOAM+Richese) lobby with classics and one required deck through original paired setup when Tech and/or Advanced Strongholds is selected. Tech requires3–6 Basic/Advanced, Strongholds2–6 Advanced, both3–6 Advanced. All12 Nexus, original47/35 decks/cache, native setup and actual module custody remain. Mixed families, E3, Skills, other overlays, public starts and pending rulings stay separate.',
      '\nNexus additionally admits standalone Ecaz OR Moritani with classics and the original ecaz33/all12 deck without Skills, Basic/Advanced2–6, optionally original Homeworlds, Discovery through --discoveries, Tech3+ and Advanced Strongholds2+. Original Traitors/native setup and qualifying end-Spice closing draw remain; no starting Nexus deal or training is added. Ecaz Arrakis Occupy and quiet living-Duke Cunning retain their own boundaries; an otherwise legal Advanced Ecaz/Harkonnen roster does not lift the separate Cunning exclusion. Advanced Moritani excludes Harkonnen and uses original post-loss assassination/normal-call forfeiture, private replacement and supply-only Terror Cunning. E3 pairs/mixed families, native free-return/relocation rulings, unrelated previews, public starts and save conversion stay separate.',
      '\nNexus additionally admits exactly one native Ixians OR Tleilaxu with the Ix47 deck, or CHOAM OR Richese with CHOAM35 and the original Richese cache when seated, plus classic opponents, Basic/Advanced2–6. Original Homeworlds may be retained; --discoveries preserves Discovery7/8, Tech requires3+ and Strongholds require Advanced2+. Without Skills it reuses original faction/Traitor/native setup; leader-skills --nexus-cards additionally retains all14 offered training. Original Ix offer/HMS, Tleilaxu Face Dancers, CHOAM Auditor and signed Richese markers remain physical. The paired entry still requires both native factions. Mixed-family Nexus, E3pairs, public starts, played-save conversion and pending effect rulings remain separate.',
      '\nLeader-skills --nexus-cards explicitly adds all12 Nexus to fresh classic/base33 OR single or paired Ixians/Tleilaxu with Ix47 OR single or paired CHOAM/Richese with CHOAM35 and native Richese cache, plus classics and all14 skills, two-through-six seats Basic/Advanced. Existing Homeworlds may be retained. Original starting hands/offers, skill/Traitor/native order and genuine closing deals remain. Mixed families/E3 pairs, Banker/Mentat previews, borrowed Smuggler/pair-companion arithmetic, public starts and unresolved interactions stay separate.',
      '\nThese classic, single-native or paired one-family skill-Nexus entries preserve selected unused original Tech Tokens at3–6 Basic/Advanced and/or Stronghold Cards at2–6 Advanced; both require3–6 Advanced. Real first-Storm/end-Mentat custody, phase-end industry, held subsidy, typed skill rescue/equal substitution, signed one-invoice marker pairs and mandatory original-winner Tech before Face Dance use original handlers. No mixed-family/native free-return accounting or pending rulings are opened.',
      '\nThe same fresh skill/Nexus entry admits standalone Ecaz OR Moritani with classics, exact ecaz33/all14/all12, Basic/Advanced2–6. Optional unused Tech requires3+; Strongholds requires Advanced; both3+ Advanced. Native Ecaz five-disc/Duke assignment and quiet living-Duke Cunning, plus original Advanced Moritani skill-first assassination/normal-traitor forfeiture, remain. Advanced Harkonnen, shared-Duke assignment, enhanced Terror relocation/HMS/Grumman and other pending effects stay guarded.',
      '\nIn the standalone Ecaz skill/Nexus profile, mandatory Advanced Occupy composes the chosen faction’s skill with separately labelled armies. Ecaz-led Suk rescues its own fixed casualties after the ally’s variable losses; Diplomat uses the chosen faction’s undialed own pool. Shared training, Basic odd rounding and other pending effects remain separate.',
      '\nHomeworld-occupation opts a fresh ready 2–6-seat Basic/Advanced lobby with original selected faction decks into occupied bank Collection/immediate ally sharing, Kaitain/Junction/Richese percentage receipts, completed total Southern Hemisphere Collection, Caladan shared inspection, displaced Ix pool control, Richese card-only selection with native seller terms, Giedi receiver choice and occupied native defenses. Advanced follows the authorized supplied rulebook p22: sole foreign qualification, retained until its last force leaves; later contests/native repopulation do not expire it, and a new sole arrival after departure has a new source epoch. Basic retains unresolved lifecycle guards. Native income/peek cancellation remains distinct from printed occupied effects. Other borrowed/exceptional powers, overlays, public starts and old-game conversion remain separate.',
      '\nWhen native CHOAM is seated, this fresh entry additionally marks original occupied Tupile hand slots and owner-selected normal-limit cleanup. The occupier/reciprocal ally gain one validated slot through existing capacity consumers; Advanced departure and ally removal queue the original lost-holder cleanup. Private selected-ID discards preserve current phase/opening and remaining movement, with no new card or fee. Known occupation suppresses new native low-intelligence queries; proved Advanced expiry restores eligibility without resetting historical answers/usage. Basic unknown cases retain source guards. Unmarked played profiles are not upgraded.',
      '\nWhen native Ecaz is seated, this original fresh entry separately marks its printed high Homeworld alliance victory: current native seven-plus, one actual joint stronghold, two distinct other native factions with proved current occupied holdings. It adds no ordinary stronghold/Tech points, pays no reward and changes no Duke authority. Public progress remains prospective until original Mentat; qualifying members join original winners before BG prediction/final fallback. Unmarked played/public profiles remain unchanged.',
      '\nDiscovery opts fresh classic, selected E1/E2 native families or standalone Ecaz OR Moritani with classics into original Discovery setup in Basic/Advanced2–6, optionally retaining original Homeworlds, unused Tech3–6 and Advanced Strongholds2–6. Original decks/cache, HMS/Face Dancers, typed entry, revealed-only nested No-Fields, stash limits, end-Mentat claims and native outcomes remain. Advanced Moritani excludes Harkonnen. Skills/Nexus, paired/mixed E3, contested/shared-payer rulings, public starts and played-game conversion stay separate.',
      '\nLeader-skills --discoveries composes fresh supported classic or native original family decks/all14 Skills with Discovery7/8 at2–6 seats Basic/Advanced under each existing roster predicate. Original Homeworlds may be retained; adding --nexus-cards requires classic factions, single or paired native Ixians/Tleilaxu OR CHOAM/Richese with one family deck, or standalone Ecaz OR Moritani with classics. Tech requires3–6 and Strongholds Advanced2–6. Original private card choices/training/hands, Maker/votes/rides, physical residual Cyborg exchange, native aftermath and cleanup/Tech/Face Dance retain their own timing. Mixed decks, E3pairs/mixed families, independent variants, Banker/Mentat previews, shared Duke/borrowed Smuggler/pair companion/native returns and pending rulings remain separate.',
      '\nNexus --discoveries explicitly composes fresh classic/base33, single or paired native Ixians/Tleilaxu with Ix47 OR CHOAM/Richese with CHOAM35 and native Richese cache, or standalone Ecaz OR Moritani/ecaz33 with classics, all12 Nexus and original Discovery7/8 at2–6 seats Basic/Advanced without Skills, optionally retaining original Homeworlds. Unused Tech requires3+; optional Strongholds require Advanced; both3+. Actual Great Maker losses/votes/typed reserve rides, both Advanced piles, settled-alliance end-Spice closing deals and original held claims remain. Signed native two-marker nested shipments retain one printed invoice, current revealed destination and original reserve materialization. E3pairs/mixed families, mixed-module Fremen Betrayal, pending rulings, public activation and save conversion stay guarded.',
      '\nFresh supported classic or native E1/E2/standalone E3 lobbies with original Homeworlds support leader-skills, discovery or leader-skills --discoveries, Basic/Advanced2–6. Preserve unused Tech3+ and Advanced Strongholds2+; both requireAdvanced3+. Classic, single-native or paired E1/E2, or standalone Ecaz OR Moritani/classic entries additionally compose Nexus through original leader-skills --nexus-cards with optional --discoveries, or original nexus with optional --discoveries/Tech/Strongholds without Skills. Native roster/deck/assassination/Duke boundaries remain. Original all14 when Skills selected/DS7+8 when selected, private native starts, split Imperial and typed native/visitor/nested pools, real closing draws, printed native revival deposits, phase-end industry, held effects and winner rewards use original consumers. Mixed-deck Nexus, unsupported E3pair/mixed rosters, unrelated previews, public starts and save conversion remain separate.',
    );
    return;
  }
  if (values['ecaz-treachery'] && values.profile !== 'ecaz-occupy')
    throw new Error('--ecaz-treachery requires --profile ecaz-occupy.');
  if (values['mentat-question'] && values.profile !== 'leader-skills')
    throw new Error('--mentat-question requires --profile leader-skills.');
  if (values['nexus-cards'] && values.profile !== 'leader-skills')
    throw new Error('--nexus-cards requires --profile leader-skills.');
  if (values.discoveries && values.profile !== 'leader-skills' && values.profile !== 'nexus')
    throw new Error('--discoveries requires --profile leader-skills or nexus.');
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
      { ecazTreachery: values['ecaz-treachery'], mentatQuestion: values['mentat-question'], nexusCards: values['nexus-cards'], discoveries: values.discoveries });
    writeFileSync(
      resolve(values.out, 'prototype.json'),
      JSON.stringify(
        {
          format: 1,
          startedAt: new Date().toISOString(),
          profile: values.profile,
          ecazTreachery: !!values['ecaz-treachery'],
          mentatQuestion: !!values['mentat-question'],
          nexusCards: !!values['nexus-cards'],
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
