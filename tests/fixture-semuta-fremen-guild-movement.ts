import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { TERRITORIES, gameDistance, location, splitLocation } from '../game/board';
import { PLAYER_CIRCLE_SECTORS } from '../game/player-positions';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaRicheseCacheKarama, nextSemutaRicheseCacheKarama,
  semutaRicheseCacheKaramaClean, semutaRicheseCacheKaramaInventory,
  semutaRicheseCacheKaramaPlayer,
} from './fixture-semuta-richese-cache-karama';

export type SemutaFremenGuildMovementStep = { actor: string; action: Action };
export const actSemutaFremenGuildMovement = actSemutaRicheseCacheKarama;
export const semutaFremenGuildMovementPlayer = semutaRicheseCacheKaramaPlayer;
export const semutaFremenGuildMovementInventory = semutaRicheseCacheKaramaInventory;
export const semutaFremenGuildMovementClean = semutaRicheseCacheKaramaClean;

export function nextSemutaFremenGuildMovement(game: Game, guildWait = false): SemutaFremenGuildMovementStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance) return null;
  if (!game.response && !game.phaseOpening) {
    const fremen = game.players.find(player => player.faction === 'fremen');
    if (game.status === 'setup' && game.setupStage === 'forces' && fremen?.reserves === 20 &&
        viewGame(game, fremen.id).setupPending.includes(fremen.id))
      return { actor: fremen.id, action: { type: 'fremenSetup', placements: { 'sietch_tabr:14': 10 } } };
    if (game.decision?.kind === 'guildTiming')
      return { actor: game.decision.player, action: { type: 'decision', take: false } };
  }
  const next = nextSemutaRicheseCacheKarama(game);
  if (next?.action.type === 'stormDial' && game.turn === 1)
    return { actor: next.actor, action: { ...next.action,
      amount: guildWait && next.actor === game.stormDialers[0] ? 6 : 0 } };
  return next;
}
export function advanceSemutaFremenGuildMovement(game: Game, until: (state: Game) => boolean,
  actions: SemutaFremenGuildMovementStep[] = [], guildWait = false): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaFremenGuildMovement(game, guildWait);
    assert.ok(next, 'Resolve the original fresh reaction or native declaration before continuing');
    game = actSemutaFremenGuildMovement(game, next.actor, next.action, actions);
  }
  throw Error('The native Fremen/Guild source did not reach its finite boundary');
}
export function semutaFremenGuildMove(game: Game, range: 1 | 2, from = 'sietch_tabr:14'): Action {
  const to = TERRITORIES.filter(territory => territory.type === 'sand').flatMap(territory =>
    territory.sectors.filter(sector => sector !== game.storm).map(sector => location(territory.id, sector)))
    .find(to => gameDistance(game, from, to, key => splitLocation(key).sector === game.storm) === range);
  assert.ok(to, `The original Tabr group needs a legal range-${range} sand destination`);
  const destination = splitLocation(to);
  return { type: 'move', from, amount: 1, elite: 0, territory: destination.territory, sector: destination.sector };
}

/** Original public Basic/undealt Advanced setup and paid cache1. WAIT uses only
 * actual lobby circle choices and first-Storm dials, never installed order. */
export function createSemutaFremenGuildMovementFixture(options: {
  kind?: 'fremenMovement' | 'guildTiming'; advanced?: boolean; take?: boolean;
} = {}) {
  const kind = options.kind ?? 'fremenMovement';
  const advanced = options.advanced ?? kind === 'guildTiming', take = options.take ?? true;
  assert.ok(kind !== 'guildTiming' || advanced, 'Flexible native Guild timing is Advanced only');
  const guildWait = kind === 'guildTiming' && !take;
  const richese = 'richese', holder = 'choam', fremen = 'fremen', guild = 'guild', spender = 'emperor';
  const owner = kind === 'fremenMovement' ? fremen : guild;
  let game = createGame('SEMUTAFREMENGUILDMOVEMENT', newPlayer(richese, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of [holder, fremen, guild, spender] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaFremenGuildMovementStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaFremenGuildMovement(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => {
    game = advanceSemutaFremenGuildMovement(game, until, actions, guildWait);
  };
  if (guildWait) {
    act(fremen, { type: 'seatPosition', position: 6 });
    act(guild, { type: 'seatPosition', position: 3 });
    act(fremen, { type: 'seatPosition', position: 4 });
  }
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'original-undealt-semuta-preview' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaFremenGuildMovementInventory(game);
  assert.equal(originalInventory.length, 45); assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 4); assert.equal(ordinary.length, 4);
  const deal = [...ordinary.map(card => card.id), printed.id], cost = printed.id;
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal);
  assert.equal(semutaFremenGuildMovementPlayer(game, fremen).forces['sietch_tabr:14'], 10);
  assert.ok(semutaFremenGuildMovementPlayer(game, spender).hand.some(card => card.id === cost));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const front: Game['spiceDeck'] = [], spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced ? 2 : 1); position++) {
    const from = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(from >= 0);
    const card = game.spiceDeck.splice(from, 1)[0]; front.push(card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  game.spiceDeck.unshift(...front);
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaFremenGuildMovementStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaFremenGuildMovementPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaFremenGuildMovement(game, guildWait); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = {
    before: beforeBid, bid, steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1,
  };
  assert.equal(semutaFremenGuildMovementPlayer(beforeBid, holder).spice - semutaFremenGuildMovementPlayer(game, holder).spice, 1);
  assert.equal(semutaFremenGuildMovementPlayer(game, richese).spice - semutaFremenGuildMovementPlayer(beforeBid, richese).spice, 1);
  let shipment: { before: Game; action: Action; after: Game; steps: SemutaFremenGuildMovementStep[] } | null = null;
  let beforeDeclaration: Game, nativeAction: Action;
  if (kind === 'fremenMovement') {
    reach(state => state.phase === 5 && state.active === fremen && semutaFremenGuildMovementClean(state));
    const before = structuredClone(game), start = actions.length;
    const action: Action = { type: 'ship', territory: 'the_great_flat', sector: 15, amount: 1, elite: 0, allyPayment: 0 };
    act(fremen, action); reach(semutaFremenGuildMovementClean);
    shipment = { before, action, after: structuredClone(game), steps: structuredClone(actions.slice(start)) };
    assert.equal(semutaFremenGuildMovementPlayer(game, fremen).shipped, true);
    assert.equal(semutaFremenGuildMovementPlayer(game, fremen).moved, 0);
    assert.equal(semutaFremenGuildMovementPlayer(game, fremen).forces['the_great_flat:15'], 1);
    assert.equal(semutaFremenGuildMovementPlayer(game, fremen).reserves, semutaFremenGuildMovementPlayer(before, fremen).reserves - 1);
    assert.equal(semutaFremenGuildMovementPlayer(game, fremen).spice, semutaFremenGuildMovementPlayer(before, fremen).spice);
    beforeDeclaration = structuredClone(game); nativeAction = semutaFremenGuildMove(game, 2);
    act(fremen, nativeAction);
    assert.ok(game.pendingFremenMove);
    assert.deepEqual(semutaFremenGuildMovementPlayer(game, fremen), semutaFremenGuildMovementPlayer(beforeDeclaration, fremen));
  } else {
    reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'guildTiming');
    assert.equal(game.decision?.player, guild);
    assert.equal(game.movementRemaining![0] === guild, !take);
    if (guildWait) {
      assert.equal(game.playerPositions![guild], 3);
      assert.equal(PLAYER_CIRCLE_SECTORS[game.playerPositions![guild] - 1], 8);
      assert.equal(game.storm, 7);
      assert.deepEqual(actions.filter(step => step.action.type === 'stormDial').map(step => step.action.amount).sort((a,b) => Number(a)-Number(b)), [0, 6]);
    }
    beforeDeclaration = structuredClone(game); nativeAction = { type: 'decision', take };
    act(guild, nativeAction);
    assert.equal(game.response?.take, take); assert.equal(game.active, null);
  }
  assert.equal(game.response?.kind, kind); assert.equal(game.response?.owner, owner);
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.decision, null);
  assert.ok(!game.pendingTreacheryDiscard);
  assert.ok(semutaFremenGuildMovementPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaFremenGuildMovementPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaFremenGuildMovementInventory(game), originalInventory);
  const source = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return {
    game, source, beforeCost: source, kind, advanced, take, guildWait,
    richese, holder, fremen, guild, spender, owner, cost, karama: cost, semuta: SEMUTA_DRUG_ID,
    action, nativeAction, beforeDeclaration, pending: structuredClone(game.pendingFremenMove ?? null),
    originalResponse: structuredClone(game.response), originalOrder: [...game.order],
    originalRemaining: [...game.movementRemaining!], originalActive: game.active,
    shipment, initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, deal, dealOrder,
    originalSpice, spiceOrder, acquired, acquisition, originalInventory, inventory: originalInventory,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      advanced ? 'Original Advanced Semuta initializer on the ready undealt R/C/F/G/E lobby.' : 'Actual public bare Basic R/C/F/G/E ready/start initializes its original Semuta preview.',
      'Only unopened original deal/Spice positions and scalar lotteries are selected. Fremen really places ten starting forces at Tabr14; Emperor really receives its printed Karama. CHOAM pays one in the native first cache auction for the original Semuta.',
      kind === 'fremenMovement'
        ? 'Earlier original combined turns finish. Fremen actually ships one native reserve free to The Great Flat15, then declares one ordinary Tabr force to a shared-board distance-two sand destination. Its actual native response retains the exact uncommitted group and move0.'
        : guildWait
          ? 'Actual lobby circle moves Fremen to temporary empty6, Guild to vacated3, then Fremen to vacated4. Printed circle3 points to sector8. Native first-Storm dials6+0 move the storm from1 to7, genuinely making Guild first. Guild really chooses WAIT out of order; no order, clock, grant or pending response is installed.'
          : 'Default native circles and original first-Storm zero dials leave Guild nonfirst. At the actual first phase-five timing decision Guild chooses TAKE out of order, before any physical combined turn.',
      'Stop before the exact dealt cancellation cost. No played hand, wallet, force, clock, queue, shipment allowance or pending receipt is assigned.',
    ],
  };
}
export type SemutaFremenGuildMovementFixture = ReturnType<typeof createSemutaFremenGuildMovementFixture>;

export function passSemutaFremenGuildMovement(game: Game, actions: SemutaFremenGuildMovementStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const actor = game.players.find(player => !reaction.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaFremenGuildMovement(game, actor.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaFremenGuildMovement(game: Game, holder: string,
  actions: SemutaFremenGuildMovementStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event, card = pending.batch.entries[0].card.id;
  game = actSemutaFremenGuildMovement(game, holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaFremenGuildMovement(game, holder, { type: 'semutaSelect', event, card }, actions);
  return game;
}
export function allowSemutaFremenGuildMovement(game: Game, actions: SemutaFremenGuildMovementStep[] = []): Game {
  const kind = game.response?.kind; assert.ok(kind === 'fremenMovement' || kind === 'guildTiming');
  for (let count = 0; game.response?.kind === kind && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaFremenGuildMovement(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, kind); return game;
}
export function replaceSemutaFremenMovement(game: Game, fixture: Pick<SemutaFremenGuildMovementFixture, 'fremen'>,
  actions: SemutaFremenGuildMovementStep[] = []) {
  assert.equal(game.active, fixture.fremen); assert.equal(game.response, null);
  const before = structuredClone(game), replacement = semutaFremenGuildMove(game, 1);
  game = actSemutaFremenGuildMovement(game, fixture.fremen, replacement, actions);
  game = advanceSemutaFremenGuildMovement(game, semutaFremenGuildMovementClean, actions);
  const afterReplacement = structuredClone(game), end: Action = { type: 'endMovement' };
  assert.equal(semutaFremenGuildMovementPlayer(game, fixture.fremen).moved, 1);
  game = actSemutaFremenGuildMovement(game, fixture.fremen, end, actions);
  return { game, before, replacement, afterReplacement, end };
}
