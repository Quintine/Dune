import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { quoteNoFieldCancellation } from '../game/karama-no-field-cancellation';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaDisasterWorm, nextSemutaDisasterWorm, passSemutaDisasterWorm, claimSemutaDisasterWorm,
  semutaDisasterWormPlayer, semutaDisasterWormInventory, semutaDisasterWormClean,
} from './fixture-semuta-disaster-worm';

export type SemutaNoFieldCostKind = 'own' | 'allied' | 'ambassador';
export type SemutaNoFieldCostStep = { actor: string; action: Action };
export const actSemutaNoFieldCost = actSemutaDisasterWorm;
export const passSemutaNoFieldCost = passSemutaDisasterWorm;
export const claimSemutaNoFieldCost = claimSemutaDisasterWorm;
export const semutaNoFieldCostPlayer = semutaDisasterWormPlayer;
export const semutaNoFieldCostInventory = semutaDisasterWormInventory;
export const semutaNoFieldCostClean = semutaDisasterWormClean;
export const semutaNoFieldCostPhysical = (game: Game) => ({
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, elites: p.elites,
    reserves: p.reserves, tanks: p.tanks, shipped: p.shipped, moved: p.moved, ally: p.ally,
    noField: p.noField, noFieldEvent: p.noFieldEvent })),
  aid: game.aid, spice: game.spice,
});

/** Fresh groups and the independent Ambassador chooser remain caller-owned. */
export function nextSemutaNoFieldCost(game: Game): SemutaNoFieldCostStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance) return null;
  if (!game.response && !game.phaseOpening) {
    const ecaz = game.players.find(p => p.faction === 'ecaz');
    if (game.status === 'setup' && game.setupStage === 'forces' && ecaz?.reserves === 20 &&
        viewGame(game, ecaz.id).setupPending.includes(ecaz.id))
      return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:9': 6 } } };
    if (game.decision?.kind === 'ecazAmbassador') return null;
    if (game.decision?.kind === 'ecazPlacement')
      return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  }
  return nextSemutaDisasterWorm(game);
}
export const nextSemutaNoFieldCostStep = nextSemutaNoFieldCost;
export function advanceSemutaNoFieldCost(game: Game, until: (state: Game) => boolean,
  actions: SemutaNoFieldCostStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaNoFieldCost(game);
    assert.ok(step, `Choose the native fresh/Ambassador control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaNoFieldCost(game, step.actor, step.action, actions);
  }
  throw Error('The native No-Field cost source did not reach its finite boundary');
}
/** Allow this exact No-Field response only, then leave original shipment
 * permission/rate responses and independent arrival to finish. */
export function allowSemutaNoFieldCost(game: Game, actions: SemutaNoFieldCostStep[] = []): Game {
  assert.equal(game.response?.kind, 'richeseNoField');
  for (let count = 0; game.response?.kind === 'richeseNoField' && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaNoFieldCost(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, 'richeseNoField'); return game;
}
/** Drains only native original responses/permissions. A denied independent
 * grant stops at its restored chooser without choosing the reserve fallback. */
export function finishSemutaNoFieldCost(game: Game, actions: SemutaNoFieldCostStep[] = []): Game {
  return advanceSemutaNoFieldCost(game, state => semutaNoFieldCostClean(state) ||
    !state.response && !state.phaseOpening && !state.pendingTreacheryDiscard &&
      state.decision?.kind === 'ecazAmbassador', actions);
}

function originalGuildPacket() {
  const pool = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = ['guild', 'atreides', 'emperor', 'fremen', 'harkonnen'];
  const desired = [...supply, ...pool.filter(effect => !supply.includes(effect))], current = [...pool], rolls: number[] = [];
  for (let i = current.length - 1; i > 0; i--) {
    const j = current.indexOf(desired[i]); assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [current[i], current[j]] = [current[j], current[i]];
  }
  assert.deepEqual(current, desired); assert.equal(rolls.length, 9); return { supply, rolls };
}
function createOriginalGuildPacket(game: Game, step: SemutaNoFieldCostStep, rolls: number[], actions: SemutaNoFieldCostStep[]) {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < rolls.length ? rolls[cursor++] : 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, step.actor, step.action);
    assert.equal(cursor, rolls.length); actions.push(structuredClone(step)); return next;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Genuine own/allied Basic+Advanced and Basic independent Guild grant.
 * Advanced Ambassador substitution retains its existing Basic-only gate. */
export function createSemutaNoFieldCostFixture(options: {
  kind?: SemutaNoFieldCostKind; advanced?: boolean;
} = {}) {
  const kind = options.kind ?? 'own', advanced = options.advanced ?? false;
  assert.ok(kind !== 'ambassador' || !advanced,
    'Native Guild Ambassador No-Field substitution requires the existing bare Basic profile');
  const owner = 'richese', holder = 'choam', emperor = 'emperor', spender = 'guild', ecaz = 'ecaz';
  const recipient = kind === 'allied' ? emperor : owner, territory = kind === 'ambassador' ? 'sietch_tabr' : 'imperial_basin';
  const sector = kind === 'ambassador' ? 14 : 9, location = `${territory}:${sector}`;
  let game = createGame('SEMUTANOFIELDCOST', newPlayer(owner, 'Richese', 'richese'), advanced,
    kind === 'ambassador' ? ['choam', 'ecaz'] : ['choam']);
  for (const faction of ['choam', 'emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  if (kind === 'ambassador') joinGame(game, newPlayer(ecaz, 'Ecaz', 'ecaz'));
  const initial = structuredClone(game), actions: SemutaNoFieldCostStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaNoFieldCost(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaNoFieldCost(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  const circles = kind === 'ambassador' ? transition(() => {
    act(holder, { type: 'seatPosition', position: 6 });
    act(owner, { type: 'seatPosition', position: 2 });
    act(holder, { type: 'seatPosition', position: 1 });
  }) : null;
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'original-undealt-advanced-semuta-preview' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaNoFieldCostInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 3); assert.equal(ordinary.length, 3);
  const shield = game.deck.find(card => card.kind === 'shield'); assert.ok(shield);
  const selected = [ordinary[0], ordinary[1], ordinary[2], printed, ...(kind === 'ambassador' ? [shield] : [])];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game), packet = kind === 'ambassador' ? originalGuildPacket() : null;
  let packetCreation: { before: Game; steps: SemutaNoFieldCostStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const step = nextSemutaNoFieldCost(game); assert.ok(step);
    if (packet && game.setupStage === 'traitors' && step.action.type === 'traitor' &&
        game.players.filter(p => p.traitorChoices.length).length === 1) {
      const before = structuredClone(game);
      game = createOriginalGuildPacket(game, step, packet.rolls, actions);
      packetCreation = { before, steps: [structuredClone(step)], after: structuredClone(game) };
    } else act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game), cost = printed.id;
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  const originalNoField = structuredClone(semutaNoFieldCostPlayer(game, owner).noField); assert.ok(originalNoField);
  const token = originalNoField.tokens.find(token => token.value === 5)!;
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { turn: number; position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const orderSpice = (faces: string[]) => {
    for (let position = 0; position < faces.length; position++) {
      const face = faces[position], from = game.spiceDeck.findIndex((card, index) => index >= position &&
        (face === 'worm' ? 'worm' in card && !card.suppressed && !card.thumper && !card.greatMaker
          : 'territory' in card && card.territory === face && !card.discovery));
      assert.ok(from >= position, `The original unopened Spice stock needs ${face}`);
      const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
      spiceOrder.push({ turn: game.turn, position, from, card: structuredClone(card) });
    }
  };
  orderSpice(advanced ? ['funeral_plain', 'hagga_basin'] : ['funeral_plain']);
  let beforeBid: Game | undefined, bid: SemutaNoFieldCostStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaNoFieldCostPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaNoFieldCost(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaNoFieldCostPlayer(beforeBid, holder).spice - semutaNoFieldCostPlayer(game, holder).spice, 1);
  let placement: { before: Game; steps: SemutaNoFieldCostStep[]; after: Game } | null = null;
  let guildToken: string | null = null;
  if (kind === 'ambassador') {
    assert.ok(packetCreation);
    guildToken = game.ecazAmbassadors!.tokens.find(token => token.effect === 'guild')!.id;
    reach(state => state.decision?.kind === 'ecazPlacement' && !state.response && !state.phaseOpening);
    placement = transition(() => {
      act(ecaz, { type: 'decision', token: guildToken!, territory: 'carthag' });
      reach(state => state.decision?.kind === 'ecazPlacement' && !state.response && !state.phaseOpening);
      act(ecaz, { type: 'decision', decline: true });
    });
    assert.equal(semutaNoFieldCostPlayer(placement.before, ecaz).spice - semutaNoFieldCostPlayer(game, ecaz).spice, 1);
  }
  let alliance: { before: Game; steps: SemutaNoFieldCostStep[]; after: Game } | null = null;
  if (kind !== 'own') {
    reach(state => state.turn === 2 && state.phase === 1 && semutaNoFieldCostClean(state) &&
      !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
    orderSpice(['worm', 'the_great_flat', ...(advanced ? ['broken_land'] : [])]);
    reach(state => state.turn === 2 && state.phase === 1 && state.nexus && !state.spiceWindow &&
      !state.spiceResolution && semutaNoFieldCostClean(state));
    const ally = kind === 'ambassador' ? ecaz : emperor;
    alliance = transition(() => {
      act(owner, { type: 'alliance', target: ally }); act(ally, { type: 'alliance', target: owner });
    });
    assert.equal(semutaNoFieldCostPlayer(game, owner).ally, ally); assert.equal(semutaNoFieldCostPlayer(game, ally).ally, owner);
  }
  const turn = kind === 'own' ? 1 : 2;
  let priorShipment: { before: Game; steps: SemutaNoFieldCostStep[]; after: Game } | null = null;
  let entrantShipment: { before: Game; steps: SemutaNoFieldCostStep[]; after: Game } | null = null;
  if (kind === 'ambassador') {
    reach(state => state.turn === turn && state.phase === 5 && state.active === owner && semutaNoFieldCostClean(state));
    priorShipment = transition(() => {
      act(owner, { type: 'ship', amount: 1, elite: 0, allyPayment: 0, territory: 'polar_sink', sector: 0 });
      reach(semutaNoFieldCostClean); act(owner, { type: 'endMovement' });
    });
    reach(state => state.turn === turn && state.phase === 5 && state.active === emperor && semutaNoFieldCostClean(state));
    entrantShipment = transition(() => {
      act(emperor, { type: 'ship', amount: 1, elite: 0, allyPayment: 0, territory: 'carthag', sector: 11 });
      reach(state => !state.response && state.pendingAmbassador?.stage === 'offer');
    });
    act(ecaz, { type: 'decision', event: game.pendingAmbassador!.event, trigger: true, beneficiary: owner });
    assert.equal(game.pendingAmbassador?.stage, 'ship'); assert.equal(game.pendingAmbassador.effect, 'guild');
  } else reach(state => state.turn === turn && state.phase === 5 && state.active === recipient &&
    (semutaNoFieldCostClean(state) || kind === 'allied' && !state.response && !state.phaseOpening &&
      !state.pendingTreacheryDiscard && state.decision?.kind === 'richeseAllyOpportunity' && state.decision.player === owner));
  const beforeDeclaration = structuredClone(game), tokenEvent = semutaNoFieldCostPlayer(game, owner).noFieldEvent!;
  const entry = structuredClone(game.pendingAmbassador ?? null);
  const nativeAction: Action = kind === 'own'
    ? { type: 'ship', noField: token.id, event: tokenEvent, territory, sector, allyPayment: 0 }
    : kind === 'allied'
      ? { type: 'offerRicheseNoField', token: token.id, event: tokenEvent, payer: recipient, territory, sector }
      : { type: 'decision', event: entry!.event, amount: 1, noField: token.id, noFieldEvent: tokenEvent, territory, sector };
  const declaration = transition(() => {
    act(owner, nativeAction);
    if (kind === 'allied') act(recipient, { type: 'decision', event: game.richeseAllyOffer!.event, accept: true, elite: 0 });
  });
  assert.ok(game.response && game.pendingShipment);
  assert.equal(game.response.kind, 'richeseNoField'); assert.equal(game.response.owner, owner);
  assert.equal(game.response.source ?? null, kind === 'ambassador' ? 'ambassadorNoField' : null);
  assert.deepEqual(semutaNoFieldCostPhysical(game), semutaNoFieldCostPhysical(beforeDeclaration));
  assert.deepEqual(semutaNoFieldCostPlayer(game, owner).noField, originalNoField);
  const expected = kind === 'ambassador' ? null : quoteNoFieldCancellation(game, game.response);
  const source = structuredClone(game), originalResponse = structuredClone(game.response), originalShipment = structuredClone(game.pendingShipment);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  const replacementAction: Action = kind === 'ambassador'
    ? { type: 'decision', event: entry!.event, amount: 1, elite: 0, territory, sector }
    : { type: 'ship', amount: 1, elite: 0, allyPayment: 0, territory, sector };
  assert.ok(semutaNoFieldCostPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaNoFieldCostPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaNoFieldCostInventory(game), originalInventory);
  return { game, source, beforeCost: source, kind, advanced, owner, holder, spender, recipient, emperor, guild: spender,
    ecaz: kind === 'ambassador' ? ecaz : null, cost, karama: cost, semuta: SEMUTA_DRUG_ID, action, nativeAction,
    replacementAction, fallbackAction: replacementAction, replacementActor: recipient, token, tokenEvent, entry,
    originalResponse, originalShipment, originalPhysical: structuredClone(semutaNoFieldCostPhysical(game)), expected,
    territory, sector, location, turn, shipmentCost: kind === 'ambassador' ? 0 : 2, amount: kind === 'allied' ? 5 : 1,
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, deal: selected.map(card => card.id), dealOrder,
    originalInventory, originalNoField, originalSpice, spiceOrder, acquisition, acquired, packetCreation, circles,
    guildToken, placement, alliance, priorShipment, entrantShipment, beforeDeclaration, declaration,
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      advanced ? 'Original Advanced Semuta initializer on a genuinely ready undealt R/C/E/G lobby, main35/cache10, no modules.' : 'Actual public Basic R/C/E/G ready/start, adding original Ecaz/E3 only for the independent Ambassador source; main35/cache10 and no modules.',
      'Only original unopened starting-card/Spice positions and scalar lotteries are selected. Guild really receives printed Karama; CHOAM really pays one for cache Semuta. Richese retains its original three token identities, physical reserves and selection event before the declaration.',
      kind === 'allied' ? 'A real turn2 natural worm on the empty first Funeral pile creates Nexus. Richese and Emperor actually propose/accept alliance, then Richese privately offers its original five-marker during Emperor’s unused turn; Emperor really consents to five normals and its own two-spice fee.' : kind === 'ambassador' ? 'Basic-only native route: three public lobby circle choices put Richese before Emperor after the actual second Storm. Select the original nine-roll Guild packet, pay for its Carthag token, earn real Richese/Ecaz Nexus alliance. Richese really pays one for ordinary Polar entry and ends its turn. Emperor really pays one into Carthag, Ecaz really triggers Guild for allied Richese, then Richese really declares its original concealed marker for the independent free grant. Existing Advanced Ambassador/No-Field gate is preserved.' : 'At the original unused first movement turn, Richese really declares its original five-marker to Basin9 for the native one-marker two-spice fee.',
      'Stop at the native unpaid No-Field response before Guild spends its originally dealt printed Karama. No played hand, force, wallet, clock, alliance, token, shipment, Ambassador entry or response is assigned. Native denial runs without an allowed budget/capacity trial; actual ordinary/independent physical fallback remains caller-owned.',
    ],
  };
}
export type SemutaNoFieldCostFixture = ReturnType<typeof createSemutaNoFieldCostFixture>;
