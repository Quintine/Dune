import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { quoteFremenRevivalGrant, validateFremenRevivalGrant } from '../game/fremen-revival-grant';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaDisasterWorm, nextSemutaDisasterWorm, passSemutaDisasterWorm, claimSemutaDisasterWorm,
  semutaDisasterWormPlayer, semutaDisasterWormInventory,
} from './fixture-semuta-disaster-worm';

export type SemutaFremenGrantCostStep = { actor: string; action: Action };
export const actSemutaFremenGrantCost = actSemutaDisasterWorm;
export const passSemutaFremenGrantCost = passSemutaDisasterWorm;
export const claimSemutaFremenGrantCost = claimSemutaDisasterWorm;
export const semutaFremenGrantCostPlayer = semutaDisasterWormPlayer;
export const semutaFremenGrantCostInventory = semutaDisasterWormInventory;
export const semutaFremenGrantCostClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingRevival;
export const semutaFremenGrantCostPhysical = (game: Game) => ({
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, elites: p.elites,
    reserves: p.reserves, tanks: p.tanks, leaders: p.leaders, ally: p.ally,
    revived: p.revived, freeForcesRevived: p.freeForcesRevived, leaderRevived: p.leaderRevived,
    shipped: p.shipped, moved: p.moved })),
  spice: game.spice, revivalFreeIncome: game.revivalFreeIncome, revivalRequests: game.revivalRequests,
});

/** Native setup/readiness, real positive first-Storm dials and declined
 * ordinary optional controls. No grant, revival or fresh group is chosen. */
export function nextSemutaFremenGrantCost(game: Game): SemutaFremenGrantCostStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance) return null;
  if (!game.response && !game.phaseOpening &&
      (game.decision?.kind === 'revivalStop' || game.decision?.kind === 'choamFreeRevival'))
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  const step = nextSemutaDisasterWorm(game);
  if (step?.action.type === 'stormDial' && game.turn === 1)
    return { actor: step.actor, action: { ...step.action, amount: step.actor === game.stormDialers[0] ? 11 : 0 } };
  return step;
}
export const nextSemutaFremenGrantCostStep = nextSemutaFremenGrantCost;
export function advanceSemutaFremenGrantCost(game: Game, until: (state: Game) => boolean,
  actions: SemutaFremenGrantCostStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaFremenGrantCost(game);
    assert.ok(step, `Choose the original fresh/private control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaFremenGrantCost(game, step.actor, step.action, actions);
  }
  throw Error('The native Fremen grant source did not reach its finite boundary');
}
export function allowSemutaFremenGrantCost(game: Game, actions: SemutaFremenGrantCostStep[] = []): Game {
  assert.equal(game.response?.kind, 'fremenRevivalGrant');
  for (let count = 0; game.response?.kind === 'fremenRevivalGrant' && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaFremenGrantCost(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, 'fremenRevivalGrant'); return game;
}
/** Settle only this original grant or an already requested ordinary return;
 * never ready the phase, resubmit a request or bypass a fresh cost. */
export function finishSemutaFremenGrantCost(game: Game, actions: SemutaFremenGrantCostStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null, 'Choose the original fresh cost first');
  return advanceSemutaFremenGrantCost(game, semutaFremenGrantCostClean, actions);
}

/** Genuine cache1 Semuta, original printed cost, exposed native casualties,
 * real Nexus pact and completed intrinsic free return before the grant. */
export function createSemutaFremenGrantCostFixture(options: { advanced?: boolean } = {}) {
  const advanced = options.advanced ?? false, seller = 'richese', holder = 'choam', owner = 'fremen';
  const recipient = 'emperor', spender = 'guild', territory = 'hagga_basin', sector = 13, location = `${territory}:${sector}`;
  let game = createGame('SEMUTAFREMENGRANTCOST', newPlayer(seller, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['choam', 'fremen', 'emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaFremenGrantCostStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaFremenGrantCost(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaFremenGrantCost(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
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
  const originalInventory = semutaFremenGrantCostInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'), shield = game.deck.find(card => card.kind === 'shield');
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 3); assert.equal(ordinary.length, 3);
  assert.ok(printed && shield);
  const selected = [...ordinary, shield, printed], dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game); reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), cost = printed.id;
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaFremenGrantCostPlayer(game, owner).forces['sietch_tabr:14'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { turn: number; position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const orderSpice = (faces: string[]) => {
    for (let position = 0; position < faces.length; position++) {
      const face = faces[position], from = game.spiceDeck.findIndex((card, index) => index >= position &&
        (face === 'worm' ? 'worm' in card && !card.suppressed && !card.thumper && !card.greatMaker
          : 'territory' in card && card.territory === face && !card.discovery));
      assert.ok(from >= position, `Choose the original still-unopened ${face} Spice Card`);
      const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
      spiceOrder.push({ turn: game.turn, position, from, card: structuredClone(card) });
    }
  };
  orderSpice(advanced ? ['funeral_plain', 'broken_land'] : ['funeral_plain']);
  let beforeBid: Game | undefined, bid: SemutaFremenGrantCostStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaFremenGrantCostPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaFremenGrantCost(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaFremenGrantCostPlayer(beforeBid, holder).spice - semutaFremenGrantCostPlayer(game, holder).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === recipient && semutaFremenGrantCostClean(state));
  assert.equal(game.storm, 12);
  const shipment = transition(() => {
    act(recipient, { type: 'ship', territory, sector, amount: 3, elite: 0, allyPayment: 0 });
    reach(semutaFremenGrantCostClean); act(recipient, { type: 'endMovement' });
  });
  assert.equal(semutaFremenGrantCostPlayer(shipment.before, recipient).spice - semutaFremenGrantCostPlayer(game, recipient).spice, 6);
  assert.equal(semutaFremenGrantCostPlayer(game, recipient).forces[location], 3);
  reach(state => state.turn === 2 && state.phase === 0 && semutaFremenGrantCostClean(state));
  const storm = transition(() => {
    reach(state => state.turn === 2 && state.phase === 1 && semutaFremenGrantCostClean(state) &&
      !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
  });
  assert.equal(semutaFremenGrantCostPlayer(game, recipient).tanks, 3);
  assert.equal(semutaFremenGrantCostPlayer(game, recipient).forces[location] ?? 0, 0);
  orderSpice(['worm', 'the_great_flat', ...(advanced ? ['hagga_basin'] : [])]);
  reach(state => state.turn === 2 && state.phase === 1 && state.nexus && !state.spiceWindow &&
    !state.spiceResolution && semutaFremenGrantCostClean(state));
  const alliance = transition(() => {
    act(owner, { type: 'alliance', target: recipient }); act(recipient, { type: 'alliance', target: owner });
  });
  assert.equal(semutaFremenGrantCostPlayer(game, owner).ally, recipient);
  assert.equal(semutaFremenGrantCostPlayer(game, recipient).ally, owner);
  reach(state => state.turn === 2 && state.phase === 4 && semutaFremenGrantCostClean(state));
  const beforePriorRevival = structuredClone(game), intrinsicBefore = structuredClone(viewGame(game, recipient).revival);
  assert.equal(intrinsicBefore.freeRemaining, 1); assert.equal(intrinsicBefore.forcesRemaining, 3);
  const priorRevivalAction: Action = { type: 'revive', amount: 1, elite: 0 };
  const priorRevival = transition(() => {
    act(recipient, priorRevivalAction); game = finishSemutaFremenGrantCost(game, actions);
  });
  assert.equal(semutaFremenGrantCostPlayer(game, recipient).revived, 1);
  assert.equal(semutaFremenGrantCostPlayer(game, recipient).freeForcesRevived, 1);
  assert.equal(semutaFremenGrantCostPlayer(game, recipient).tanks, 2);
  assert.equal(semutaFremenGrantCostPlayer(game, recipient).spice, 4);
  const beforeDeclaration = structuredClone(game), intrinsic = structuredClone(viewGame(game, recipient).revival);
  assert.equal(intrinsic.freeRemaining, 0); assert.equal(intrinsic.forcesRemaining, 2);
  const nativeAction: Action = { type: 'grantRevival' };
  const declaration = transition(() => { act(owner, nativeAction); });
  assert.ok(game.response?.fremenGrant); assert.equal(game.response.kind, 'fremenRevivalGrant');
  assert.equal(game.response.owner, owner); assert.equal(game.response.recipient, recipient);
  validateFremenRevivalGrant(game, game.response.fremenGrant);
  assert.deepEqual(game.response.fremenGrant, quoteFremenRevivalGrant(game, owner));
  assert.ok(game.revivalRules);
  assert.equal(game.pendingRevival ?? null, null); assert.equal(game.decision ?? null, null);
  assert.deepEqual(semutaFremenGrantCostPhysical(game), semutaFremenGrantCostPhysical(beforeDeclaration));
  const source = structuredClone(game), originalResponse = structuredClone(game.response), fremenGrant = structuredClone(game.response.fremenGrant);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  const replacementAction: Action = { type: 'revive', amount: 2, elite: 0 };
  assert.deepEqual(semutaFremenGrantCostInventory(game), originalInventory);
  return { game, source, beforeCost: source, advanced, kind: 'fremenRevivalGrant' as const, seller, richese: seller,
    holder, owner, fremen: owner, recipient, ally: recipient, spender, guild: spender, cost, karama: cost,
    semuta: SEMUTA_DRUG_ID, action, nativeAction, grantAction: nativeAction, replacementAction,
    ordinaryRevivalAction: replacementAction, priorRevivalAction, originalResponse, fremenGrant,
    sourceFremenGrant: fremenGrant, originalRules: structuredClone(game.revivalRules),
    originalFreeRevival: [...game.freeRevival], originalPhysical: structuredClone(semutaFremenGrantCostPhysical(game)),
    intrinsicBefore, intrinsic, replacementAmount: 2, deniedCost: 4, allowedCost: 0,
    territory, sector, location, initial, lobby, setup, initialization, beforeStartingDeal, afterSetup,
    deal: selected.map(card => card.id), dealOrder, originalInventory, originalSpice, spiceOrder,
    acquisition, acquired, shipment, storm, alliance, beforePriorRevival, priorRevival, beforeDeclaration, declaration,
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      advanced ? 'Original Advanced Semuta initializer on the genuinely ready undealt R/C/F/E/G lobby, main35/cache10, no modules.' : 'Actual public Basic R/C/F/E/G ready/start, original main35/cache10 and no modules.',
      'Only unopened original starting-card/Spice positions and scalar lotteries are selected. Guild really receives printed Karama; CHOAM really pays cache1 for Semuta. Fremen actually places native ten at Tabr. Actual first-Storm dials11+0 end at12.',
      'Emperor really pays six for three original normal reserves at exposed Hagga13. The original next Storm crosses13 and kills all three; native Fremen forecast/CHOAM/Guild controls are passed without spending the cancellation card. No casualties or weather cursor are installed.',
      'An actual original turn2 worm on the empty first Funeral pile earns Nexus. Fremen proposes and Emperor accepts their actual mutual pact. At real Revival, Emperor completes its intrinsic free1, earning revived1/freeUsed1 with two Tanks and four spice left, before Fremen declares the original grant.',
      'Stop at the typed native fremenRevivalGrant response with no pendingRevival. No played hand, wallet, force, alliance, clock, free rate, return, rules or pending frame is installed. The same later ordinary2 action costs four if denied and is free if allowed; all prior return/usage remains native.',
    ],
  };
}
export type SemutaFremenGrantCostFixture = ReturnType<typeof createSemutaFremenGrantCostFixture>;
