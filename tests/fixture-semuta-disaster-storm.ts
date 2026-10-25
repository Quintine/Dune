import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { validateStormCancellation } from '../game/disaster-preflight';
import { stormSectorAfter } from '../game/disaster-rules';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaFremenGuildMovement, nextSemutaFremenGuildMovement,
  passSemutaFremenGuildMovement, claimSemutaFremenGuildMovement,
  semutaFremenGuildMovementClean, semutaFremenGuildMovementInventory, semutaFremenGuildMovementPlayer,
} from './fixture-semuta-fremen-guild-movement';

export type SemutaDisasterStormKind = 'traversal' | 'shipment';
export type SemutaDisasterStormStep = { actor: string; action: Action };
export const actSemutaDisasterStorm = actSemutaFremenGuildMovement;
export const passSemutaDisasterStorm = passSemutaFremenGuildMovement;
export const claimSemutaDisasterStorm = claimSemutaFremenGuildMovement;
export const semutaDisasterStormPlayer = semutaFremenGuildMovementPlayer;
export const semutaDisasterStormInventory = semutaFremenGuildMovementInventory;
export const semutaDisasterStormClean = semutaFremenGuildMovementClean;

/** First-Storm dials are real controls. Every later distance remains the actual
 * positive native Storm Card. Protection/fresh disposal stays caller-owned. */
export function nextSemutaDisasterStorm(game: Game,
  kind: SemutaDisasterStormKind = 'traversal'): SemutaDisasterStormStep | null {
  if (game.response?.kind === 'stormProtection' || game.pendingTreacheryDiscard || game.truthtrance) return null;
  const step = nextSemutaFremenGuildMovement(game);
  if (step?.action.type === 'stormDial' && game.turn === 1)
    return { actor: step.actor, action: { ...step.action,
      amount: step.actor === game.stormDialers[0] ? kind === 'shipment' ? 14 : 13 : 0 } };
  return step;
}
export function advanceSemutaDisasterStorm(game: Game, until: (state: Game) => boolean,
  actions: SemutaDisasterStormStep[] = [], kind: SemutaDisasterStormKind = 'traversal'): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaDisasterStorm(game, kind);
    assert.ok(step, 'Resolve the actual protection or fresh-cost choice before advancing');
    game = actSemutaDisasterStorm(game, step.actor, step.action, actions);
  }
  throw Error('The native Storm-protection source did not reach its finite boundary');
}
/** Allow only the original protection. A real mixed casualty chooser is left
 * explicit, and later forecast/phase-opening controls are never answered here. */
export function allowSemutaDisasterStorm(game: Game, actions: SemutaDisasterStormStep[] = []): Game {
  assert.equal(game.response?.kind, 'stormProtection');
  for (let count = 0; count < game.players.length && game.response?.kind === 'stormProtection'; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaDisasterStorm(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, 'stormProtection'); return game;
}
/** Finish the actual casualty choice and original Storm's post-traversal market
 * only. Stop at phase1, retaining its new forecast/opening; shipment stays on
 * the already paid/free committed combined turn. No second arrival is issued. */
export function finishSemutaDisasterStorm(game: Game, kind: SemutaDisasterStormKind,
  actions: SemutaDisasterStormStep[] = [], elite = 0): Game {
  for (let count = 0; count < 20; count++) {
    assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Choose the original cost batch first');
    if (game.decision?.kind === 'stormLosses') {
      game = actSemutaDisasterStorm(game, game.decision.player, { type: 'decision', elite }, actions);
    } else if (kind === 'traversal' && game.phase === 0 && game.decision?.kind === 'choamMarket') {
      game = actSemutaDisasterStorm(game, game.decision.player, { type: 'decision', done: true }, actions);
    } else {
      assert.equal(game.stormResolution ?? null, null);
      assert.equal(game.pendingArrivalReaction?.length ?? 0, 0);
      assert.equal(game.phase, kind === 'shipment' ? 5 : 1);
      return game;
    }
  }
  throw Error('The original Storm-protection aftermath did not settle');
}

/** Actual Advanced R/C/F/E preview: original deal/cache, native Fremen setup,
 * first-Storm dials, free reserve entry, and (for traversal) the next real Storm.
 * No played force, typed custody, clock, wallet or pending control is installed. */
export function createSemutaDisasterStormFixture(options: { kind: SemutaDisasterStormKind }) {
  const kind = options.kind, richese = 'richese', holder = 'choam', owner = 'fremen', spender = 'emperor';
  const key = 'the_great_flat:15', amount = 3, elite = 1, firstDistance = kind === 'shipment' ? 14 : 13;
  let game = createGame('SEMUTADISASTERSTORM', newPlayer(richese, 'Richese', 'richese'), true, ['choam']);
  for (const faction of [holder, owner, spender] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaDisasterStormStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaDisasterStorm(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaDisasterStorm(game, until, actions, kind); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: 'original-advanced-semuta-initializer-on-ready-undealt-lobby' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaDisasterStormInventory(game); assert.equal(originalInventory.length, 45);
  assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 3);
  assert.equal(ordinary.length, 3);
  const deal = [...ordinary.map(card => card.id), printed.id], cost = printed.id;
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, from, position };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal);
  assert.equal(semutaDisasterStormPlayer(game, owner).forces['sietch_tabr:14'], 10);
  assert.equal(semutaDisasterStormPlayer(game, owner).elites?.reserves, 3);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < 4; position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      ['hagga_basin', 'rock_outcroppings', 'broken_land', 'oh_gap'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaDisasterStormStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaDisasterStormPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaDisasterStorm(game, kind); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaDisasterStormPlayer(beforeBid, holder).spice - semutaDisasterStormPlayer(game, holder).spice, 1);
  assert.equal(semutaDisasterStormPlayer(game, richese).spice - semutaDisasterStormPlayer(beforeBid, richese).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && semutaDisasterStormClean(state));
  assert.equal(game.storm, stormSectorAfter(1, firstDistance));
  const nativeAction: Action = { type: 'ship', territory: 'the_great_flat', sector: 15, amount, elite, allyPayment: 0 };
  const beforeDeclaration = structuredClone(game);
  const shipment = transition(() => { act(owner, nativeAction); });
  assert.equal(semutaDisasterStormPlayer(game, owner).forces[key], amount);
  assert.equal(semutaDisasterStormPlayer(game, owner).elites?.forces[key], elite);
  assert.equal(semutaDisasterStormPlayer(game, owner).reserves, semutaDisasterStormPlayer(beforeDeclaration, owner).reserves - amount);
  assert.equal(semutaDisasterStormPlayer(game, owner).elites?.reserves, 2);
  assert.equal(semutaDisasterStormPlayer(game, owner).spice, semutaDisasterStormPlayer(beforeDeclaration, owner).spice);
  let beforeStorm: Game | null = null, traversal: ReturnType<typeof transition> | null = null;
  if (kind === 'traversal') {
    assert.equal(game.response ?? null, null); assert.equal(game.pendingArrivalReaction?.length ?? 0, 0);
    act(owner, { type: 'endMovement' });
    reach(state => state.turn === 2 && state.phase === 0 && !state.stormResolution && semutaDisasterStormClean(state));
    beforeStorm = structuredClone(game);
    traversal = transition(() => { reach(state => state.response?.kind === 'stormProtection'); });
    assert.equal(game.stormResolution?.from, 14); assert.equal(game.stormResolution?.traversed, 0);
    assert.ok(game.stormResolution && game.stormResolution.distance >= 1 && game.stormResolution.distance <= 6);
    assert.deepEqual(game.stormResolution.pending, []);
  } else {
    assert.equal(game.pendingArrivalReaction?.length, 1);
    assert.deepEqual(game.pendingArrivalReaction![0], {
      entrant: owner, territory: 'the_great_flat', sector: 15, amount, elite,
      cause: 'shipment', resume: 'none', turn: 1, phase: 5,
    });
  }
  assert.equal(game.response?.kind, 'stormProtection'); assert.equal(game.response?.owner, owner);
  assert.equal(game.response?.resume, kind === 'shipment' ? 'shipment' : 'storm');
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  validateStormCancellation(game, game.response!);
  assert.equal(semutaDisasterStormPlayer(game, owner).tanks, 0);
  assert.equal(semutaDisasterStormPlayer(game, owner).elites?.tanks, 0);
  assert.ok(semutaDisasterStormPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaDisasterStormPlayer(game, spender).hand.some(card => card.id === cost));
  const source = structuredClone(game), originalResponse = structuredClone(game.response!);
  const originalResolution = structuredClone(game.stormResolution ?? null);
  const originalArrival = structuredClone(game.pendingArrivalReaction ?? null);
  const originalStormMovementSource = structuredClone(game.stormMovementSource ?? null);
  const expectedStorm = kind === 'traversal' ? stormSectorAfter(originalResolution!.from, originalResolution!.distance) : game.storm;
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  assert.deepEqual(semutaDisasterStormInventory(game), originalInventory);
  return { game, source, beforeCost: source, kind, advanced: true, richese, holder, spender, owner,
    cost, semuta: SEMUTA_DRUG_ID, action, nativeAction, key, location: key, target: 'the_great_flat',
    amount, elite, expectedStorm, firstDistance,
    originalResponse, originalResolution, originalArrival, originalStormMovementSource,
    beforeDeclaration, shipment, beforeStorm, traversal, initial, lobby, setup, initialization,
    beforeStartingDeal, afterSetup, deal, dealOrder, originalSpice, spiceOrder, acquired, acquisition,
    originalInventory, actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original Advanced Semuta initializer on its genuinely ready undealt R/C/F/E lobby; original main35/cache10 remain physical. Only unopened deal/Spice positions and scalar lotteries are selected. Emperor receives printed Karama; CHOAM really pays1 for original cache Semuta.',
      'Fremen really places ten ordinary setup counters at protected Tabr14, retaining ten reserves including three native elite counters. Actual first Storm dials13+0 (traversal) or14+0 (shipment) end14 or15; Tabr remains safe.',
      'Fremen actually ships three reserves, including one native elite, free to The Great Flat15. No played force, typed custody, wallet, clock or pending receipt is installed.',
      kind === 'shipment' ? 'The physical shipment already committed and its original nine-field arrival is queued behind native stormProtection. Preserve that exact queue through the used-cost child; the native arrival drains after casualties without shipping again.' :
        'The safe first-turn entry finishes; the next actual positive native Storm Card necessarily crosses Great Flat15 from14. Stop before traversed0 protection, with the physical mixed cohort and original full traversal inputs unchanged.',
      'Native allowance loses ceil(3/2)=2 and offers the actual 0..1 elite casualty chooser; prevention loses all3 including the one elite. Finish only original casualties/Storm market, retaining later forecast/opening controls.',
    ] };
}
export type SemutaDisasterStormFixture = ReturnType<typeof createSemutaDisasterStormFixture>;
