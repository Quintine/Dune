import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaRicheseCacheKarama, nextSemutaRicheseCacheKarama,
  semutaRicheseCacheKaramaClean, semutaRicheseCacheKaramaInventory, semutaRicheseCacheKaramaPlayer,
} from './fixture-semuta-richese-cache-karama';
import {
  passSemutaFremenGuildMovement, claimSemutaFremenGuildMovement,
} from './fixture-semuta-fremen-guild-movement';

export type SemutaAdvisorTransportStep = { actor: string; action: Action };
export const actSemutaAdvisorTransport = actSemutaRicheseCacheKarama;
export const passSemutaAdvisorTransport = passSemutaFremenGuildMovement;
export const claimSemutaAdvisorTransport = claimSemutaFremenGuildMovement;
export const semutaAdvisorTransportPlayer = semutaRicheseCacheKaramaPlayer;
export const semutaAdvisorTransportInventory = semutaRicheseCacheKaramaInventory;
export const semutaAdvisorTransportClean = semutaRicheseCacheKaramaClean;
export const semutaAdvisorTransportPhysical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order, active: game.active, ready: game.ready,
  movementRemaining: game.movementRemaining,
  guildTimingGranted: game.guildTimingGranted, guildTimingLocked: game.guildTimingLocked,
  spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard,
  auction: game.auction, richeseAuction: game.richeseAuction, richeseBidding: game.richeseBidding,
  basicAlliedShipment: game.basicAlliedShipment,
  players: game.players.map(player => ({ id: player.id, spice: player.spice,
    reserves: player.reserves, tanks: player.tanks, forces: player.forces, elites: player.elites,
    leaders: player.leaders, shipped: player.shipped, moved: player.moved, revived: player.revived, ally: player.ally })),
});

/** Actual native setup and transport continuations. The Guild takes its real
 * early opportunity; the original automatic flip and fresh cost remain owned
 * by the caller. No scalar selection installs a movement order or grant. */
export function nextSemutaAdvisorTransport(game: Game): SemutaAdvisorTransportStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.response?.kind === 'advisorFlip') return null;
  if (!game.phaseOpening && !game.response) {
    const bg = game.players.find(player => player.faction === 'beneGesserit'); assert.ok(bg);
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: bg.id, action: { type: 'predict', faction: 'atreides', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'forces' && !bg.advisorSetup)
      return { actor: bg.id, action: { type: 'advisorSetup', territory: 'tueks_sietch', sector: 5 } };
    if (game.decision?.kind === 'advisorBattle' || game.decision?.kind === 'advisor' || game.decision?.kind === 'intrusion')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: true } };
  }
  return nextSemutaRicheseCacheKarama(game);
}
export function advanceSemutaAdvisorTransport(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorTransportStep[] = []): Game {
  for (let count = 0; count < 1400; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaAdvisorTransport(game);
    assert.ok(step, 'Choose the original automatic flip or fresh cost before continuing');
    game = actSemutaAdvisorTransport(game, step.actor, step.action, actions);
  }
  throw Error('The original transport-conversion programme did not reach its finite boundary');
}
/** Allow only the original committed transport's conversion. Permission, rate
 * and the physical shipment have already completed; none is replayed. */
export function allowSemutaAdvisorTransport(game: Game,
  actions: SemutaAdvisorTransportStep[] = []): Game {
  assert.equal(game.response?.automaticAdvisorFlip?.producer, 'guildTransport');
  for (let count = 0; game.response?.kind === 'advisorFlip' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaAdvisorTransport(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.equal(game.response ?? null, null); return game;
}
/** Resolve only the original transport arrival, then genuinely close this
 * already-shipped Guild turn. Do not submit another shipment or ground move. */
export function finishSemutaAdvisorTransport(game: Game,
  actions: SemutaAdvisorTransportStep[] = []): Game {
  const guild = game.players.find(player => player.faction === 'guild'); assert.ok(guild);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.equal(game.pendingAutomaticAdvisorTransport, undefined);
  assert.equal(game.pendingAutomaticAdvisorFlips, undefined);
  assert.equal(game.pendingArrivalReaction ?? null, null);
  assert.ok(semutaAdvisorTransportClean(game));
  assert.equal(game.phase, 5); assert.equal(game.active, guild.id);
  assert.equal(guild.shipped, true); assert.equal(guild.moved, 0);
  game = actSemutaAdvisorTransport(game, guild.id, { type: 'endMovement' }, actions);
  assert.ok(!game.movementRemaining?.includes(guild.id));
  return game;
}

/** Native Advanced R/C/BG/A/G, paid original cache Semuta, and all five native
 * Guild counters leaving the original BG advisor at Tuek's Sietch5. Only
 * original unopened card/Spice positions and scoped scalar lotteries are
 * selected. No played resource, stance, clock, control or receipt is installed. */
export function createSemutaAdvisorTransportFixture(options: { kind: 'cross' | 'return' }) {
  const { kind } = options, richese = 'richese', holder = 'choam', owner = 'beneGesserit', spender = 'atreides', guild = 'guild';
  let game = createGame('SEMUTAADVISORTRANSPORT', newPlayer(richese, 'Richese', 'richese'), true, ['choam']);
  for (const faction of [holder, owner, spender, guild] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorTransportStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorTransport(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorTransport(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: 'original-undealt-semuta-preview' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAdvisorTransportInventory(game);
  assert.equal(originalInventory.length, 45); assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 4);
  assert.equal(ordinary.length, 4);
  const selected = [ordinary[0], ordinary[1], ordinary[2], printed, ordinary[3]], cost = printed.id;
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorTransportPlayer(game, owner).forces['tueks_sietch:5'], 1);
  assert.equal(isAdvisor(semutaAdvisorTransportPlayer(game, owner), 'tueks_sietch'), true);
  assert.equal(semutaAdvisorTransportPlayer(game, guild).forces['tueks_sietch:5'], 5);
  assert.ok(semutaAdvisorTransportPlayer(game, spender).hand.some(card => card.id === cost));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < 2; position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaAdvisorTransportStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaAdvisorTransportPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaAdvisorTransport(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0, 'CHOAM really purchases the original Semuta from cache');
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorTransportPlayer(beforeBid, holder).spice - semutaAdvisorTransportPlayer(game, holder).spice, 1);
  assert.equal(semutaAdvisorTransportPlayer(game, richese).spice - semutaAdvisorTransportPlayer(beforeBid, richese).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && !state.phaseOpening && !state.response && state.decision?.kind === 'advisorBattle');
  const openingOffer = structuredClone(game);
  const declinedPreparation = transition(() => {
    act(owner, { type: 'decision', accept: false });
    reach(state => state.phase === 5 && state.active === guild && semutaAdvisorTransportClean(state));
  });
  assert.equal(semutaAdvisorTransportPlayer(game, guild).shipped, false);
  assert.equal(semutaAdvisorTransportPlayer(game, guild).moved, 0);
  const from = 'tueks_sietch:5', territory = 'tueks_sietch', to = kind === 'return' ? 'reserves' : 'imperial_basin:10';
  const nativeAction: Action = { type: 'guildShip', from, amount: 5, elite: 0, allyPayment: 0,
    territory: kind === 'return' ? 'reserves' : 'imperial_basin', ...(kind === 'cross' ? { sector: 10 } : {}) };
  const beforeDeclaration = structuredClone(game);
  const transport = transition(() => {
    act(guild, nativeAction);
    reach(state => state.response?.automaticAdvisorFlip?.producer === 'guildTransport');
  });
  const actor = semutaAdvisorTransportPlayer(game, guild);
  const price = semutaAdvisorTransportPlayer(transport.before, guild).spice - actor.spice;
  assert.ok(price > 0, 'The native accepted Guild rate is actually paid before the automatic flip');
  assert.equal(actor.forces[from], undefined); assert.equal(actor.shipped, true); assert.equal(actor.moved, 0);
  if (kind === 'return') assert.equal(actor.reserves, semutaAdvisorTransportPlayer(transport.before, guild).reserves + 5);
  else assert.equal(actor.forces[to], 5);
  assert.equal(game.response?.kind, 'advisorFlip'); assert.equal(game.response?.owner, owner);
  assert.equal(game.response?.automaticAdvisorFlip?.producer, 'guildTransport');
  assert.ok(game.pendingAutomaticAdvisorTransport && game.pendingAutomaticAdvisorFlips?.length === 1);
  assert.equal(isAdvisor(semutaAdvisorTransportPlayer(game, owner), territory), true);
  assert.ok(semutaAdvisorTransportPlayer(game, owner).advisors?.[territory]?.aloneFlipHold);
  assert.equal(game.pendingGuildTransport ?? null, null);
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.ok(semutaAdvisorTransportPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaAdvisorTransportPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaAdvisorTransportInventory(game), originalInventory);
  const source = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, kind, advanced: true as const, richese, holder, owner, bg: owner,
    spender, atreides: spender, guild, actor: guild, cost, semuta: SEMUTA_DRUG_ID, action, nativeAction,
    from, to, territory, sector: 5, location: from, amount: 5, elite: 0, price,
    originalResponse: structuredClone(game.response!),
    originalAutomaticSource: structuredClone(game.response!.automaticAdvisorFlip!),
    originalParent: structuredClone(game.pendingAutomaticAdvisorTransport!),
    originalQueue: structuredClone(game.pendingAutomaticAdvisorFlips!),
    originalArrival: structuredClone(game.pendingArrivalReaction ?? null),
    originalHeldStance: structuredClone(semutaAdvisorTransportPlayer(game, owner).advisors![territory]),
    originalPhysical: structuredClone(semutaAdvisorTransportPhysical(game)), originalHistory: structuredClone(game.log),
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, dealOrder, spiceOrder, originalSpice,
    acquired, acquisition, openingOffer, declinedPreparation, beforeDeclaration, transport: { ...transport, price },
    originalInventory, actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original Advanced Semuta initializer acts only on the ready undealt R/C/BG/A/G lobby, with CHOAM expansion and no optional modules. Select original unopened starting-card and ordinary first-Spice positions only.',
      'Actually predict Atreides, choose original private Traitors and use advisorSetup at Tueks Sietch5 beside Guilds five native counters. Atreides is genuinely dealt its original printed Karama; CHOAM actually buys original cache Semuta for one spice.',
      'Complete actual first Storm, both Spice blows, Charity, Bidding and Revival. Decline the genuine initial advisorBattle offer, take the original native Guild timing opportunity and pass its original response. No played order, clock, grant, hand, wallet or counter is installed.',
      kind === 'return'
        ? 'Submit actual guildShip returning all five original Tueks counters to abstract reserves; allow original transport permission and native rate. The native fee and physical return commit before capturing the alone-advisor response.'
        : 'Submit actual guildShip crossing all five original Tueks counters to empty Imperial Basin10; allow original transport permission and native rate. The native fee and board transfer commit before capturing the alone-advisor response.',
      'Stop at the original automatic guildTransport advisorFlip before the Atreides cost is played. Parent/source/queue/held stance stay original. Final native turn closure uses endMovement once, with no new shipment or ground move.',
    ],
  };
}
export type SemutaAdvisorTransportFixture = ReturnType<typeof createSemutaAdvisorTransportFixture>;
