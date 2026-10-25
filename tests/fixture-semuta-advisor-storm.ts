import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaCombatCapabilities, nextSemutaCombatCapabilities,
  semutaCombatCapabilitiesPlayer, semutaCombatCapabilitiesInventory, semutaCombatCapabilitiesClean,
  passSemutaCombatCapabilities, claimSemutaCombatCapabilities,
} from './fixture-semuta-combat-capabilities';

export type SemutaAdvisorStormStep = { actor: string; action: Action };
export const actSemutaAdvisorStorm = actSemutaCombatCapabilities;
export const semutaAdvisorStormPlayer = semutaCombatCapabilitiesPlayer;
export const semutaAdvisorStormInventory = semutaCombatCapabilitiesInventory;
export const semutaAdvisorStormClean = semutaCombatCapabilitiesClean;
export const passSemutaAdvisorStorm = passSemutaCombatCapabilities;
export const claimSemutaAdvisorStorm = claimSemutaCombatCapabilities;
export const semutaAdvisorStormPhysical = (game: Game) => ({
  spice: game.spice,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, reserves: p.reserves,
    tanks: p.tanks, elites: p.elites, leaders: p.leaders, ally: p.ally, moved: p.moved, shipped: p.shipped })),
});

/** Quiet native controls only. Intrusion is source-owned; an actual mandatory
 * Storm conversion stops this driver until the caller resolves that source. */
export function nextSemutaAdvisorStorm(game: Game): SemutaAdvisorStormStep | null {
  if (game.response?.automaticAdvisorFlip) return null;
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'atreides', turn: 10 } };
    const bg = game.players.find(p => p.faction === 'beneGesserit');
    if (game.status === 'setup' && game.setupStage === 'forces' && bg && !bg.advisorSetup)
      return { actor: bg.id, action: { type: 'advisorSetup', territory: 'oh_gap', sector: 10 } };
    if (game.status === 'playing' && game.turn === 1 && game.phase === 0 && game.stormPending === null && !game.decision) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial', amount: game.stormDialers.indexOf(actor) === 0 ? 2 : 3 } };
    }
    const d = game.decision;
    if (d?.kind === 'intrusion') return null;
    if (d?.kind === 'advisorBattle' || d?.kind === 'advisor')
      return { actor: d.player, action: { type: 'decision', accept: false } };
  }
  return nextSemutaCombatCapabilities(game);
}
export const nextSemutaAdvisorStormStep = nextSemutaAdvisorStorm;
export function advanceSemutaAdvisorStorm(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorStormStep[] = []): Game {
  for (let count = 0; count < 2600; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaAdvisorStorm(game);
    assert.ok(next, `Supply the native Storm/advisor control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaAdvisorStorm(game, next.actor, next.action, actions);
  }
  throw Error('The native Semuta/Storm advisor programme did not reach its finite boundary');
}
export function allowSemutaAdvisorStorm(game: Game, actions: SemutaAdvisorStormStep[] = []): Game {
  assert.ok(game.response?.automaticAdvisorFlip?.producer === 'storm');
  for (let count = 0; game.response?.automaticAdvisorFlip?.producer === 'storm' && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaAdvisorStorm(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.automaticAdvisorFlip?.producer, 'storm'); return game;
}
/** Finish remaining native traversal only. Stop when phase1 opens, before its
 * ordinary Spice windows/readiness reveal any new Spice Card. */
export function finishSemutaAdvisorStorm(game: Game, actions: SemutaAdvisorStormStep[] = []): Game {
  assert.ok(!game.pendingTreacheryDiscard);
  return advanceSemutaAdvisorStorm(game, state => state.phase === 1, actions);
}

/** Scope only the real six-card native shuffle, on the actual final CHOAM
 * Mentat Done. No game Storm Card, order, forecast or traversal field is assigned. */
function drawOriginalStorm(game: Game, step: SemutaAdvisorStormStep, distance: 3 | 4,
  actions: SemutaAdvisorStormStep[]) {
  assert.equal(game.turn, 1); assert.equal(game.phase, 8);
  assert.ok(!game.response && !game.phaseOpening && !game.truthtrance && !game.pendingTreacheryDiscard);
  assert.equal(game.decision?.kind, 'choamMentat');
  assert.deepEqual(step, { actor: game.decision.player, action: { type: 'decision', done: true } });
  const original = [1, 2, 3, 4, 5, 6], order = [distance, ...original.filter(n => n !== distance)];
  const current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(order[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, order);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) {
      assert.ok(cursor < scalars.length, 'Only the original six-card shuffle consumes selected scalar entropy');
      array[0] = scalars[cursor++];
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, step.actor, step.action);
    assert.equal(cursor, scalars.length); actions.push(structuredClone(step));
    return { game: next, original, order, scalars };
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Genuine Advanced setup, cache1, paid reserve and accepted Intrusion earn
 * split-sector advisors; actual Storm traversal kills the last outsider first. */
export function createSemutaAdvisorStormFixture(options: { continues?: boolean } = {}) {
  const continues = options.continues ?? false, distance: 3 | 4 = continues ? 4 : 3;
  const richese = 'richese', holder = 'choam', owner = 'beneGesserit', outsider = 'atreides', spender = 'emperor';
  const territory = 'oh_gap', location = 'oh_gap:10', outsiderLocation = 'oh_gap:9', from = 6;
  let game = createGame('SEMUTAADVISORSTORM', newPlayer(richese, 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['choam', 'beneGesserit', 'atreides', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorStormStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorStorm(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorStorm(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.semutaPreview, true); assert.equal(game.advanced, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAdvisorStormInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' || card.kind === 'poison').slice(0, 4);
  assert.equal(ordinary.length, 4); const selected = [...ordinary, printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card: card.id, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = printed.id;
  const setupChoices = transition(() => { reach(state => state.status === 'playing'); });
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorStormPlayer(game, owner).forces[location], 1);
  assert.equal(semutaAdvisorStormPlayer(game, owner).advisors?.[territory], undefined);
  assert.equal(game.storm, 1);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  const firstStorm = transition(() => { reach(state => state.turn === 1 && state.phase === 1 && state.storm === from); });
  const firstStormDials = firstStorm.steps.filter(step => step.action.type === 'stormDial');
  assert.deepEqual(firstStormDials.map(step => step.action.amount), [2, 3]);
  let beforeBid: Game | undefined, bid: SemutaAdvisorStormStep | undefined, bidAt = -1;
  for (let count = 0; count < 1000 && !semutaAdvisorStormPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaAdvisorStorm(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorStormPlayer(beforeBid, holder).spice - semutaAdvisorStormPlayer(game, holder).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === outsider && semutaAdvisorStormClean(state));
  const shipment = transition(() => {
    act(outsider, { type: 'ship', territory, sector: 9, amount: 1, elite: 0, allyPayment: 0 });
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'intrusion');
  });
  const intrusionBefore = structuredClone(game), intrusionAt = actions.length;
  act(owner, { type: 'decision', accept: true });
  assert.ok(game.response?.kind === 'advisorFlip'); assert.equal(game.response.advisors, true);
  const intrusionResponse = structuredClone(game.response);
  reach(semutaAdvisorStormClean);
  const intrusion = { before: intrusionBefore, steps: structuredClone(actions.slice(intrusionAt)), after: structuredClone(game) };
  assert.equal(semutaAdvisorStormPlayer(shipment.before, outsider).spice - semutaAdvisorStormPlayer(game, outsider).spice, 2);
  assert.equal(semutaAdvisorStormPlayer(game, outsider).forces[outsiderLocation], 1);
  assert.ok(semutaAdvisorStormPlayer(game, owner).advisors?.[territory]);
  reach(state => state.turn === 1 && state.phase === 8 && semutaAdvisorStormClean(state));
  const mentat = structuredClone(game);
  const mentatReadiness = transition(() => {
    for (const p of game.players.slice(0, -1)) act(p.id, { type: 'ready' });
  });
  const mentatClose = transition(() => { act(game.players.at(-1)!.id, { type: 'ready' }); });
  assert.equal(game.turn, 1); assert.equal(game.phase, 8);
  assert.equal(game.decision?.kind, 'choamMarket'); assert.equal(game.decision.player, holder);
  const closingMarket = transition(() => { act(holder, { type: 'decision', done: true }); });
  const finalChoice = (game as Game).decision;
  assert.equal(finalChoice?.kind, 'choamMentat'); assert.equal(finalChoice.player, holder);
  const drawStep: SemutaAdvisorStormStep = { actor: holder, action: { type: 'decision', done: true } };
  const beforeDraw = structuredClone(game), drawAt = actions.length;
  const draw = drawOriginalStorm(game, drawStep, distance, actions); game = draw.game;
  const stormDraw = { before: beforeDraw, steps: structuredClone(actions.slice(drawAt)), after: structuredClone(game) };
  assert.equal(game.turn, 2); assert.equal(game.phase, 0); assert.equal(game.storm, from);
  assert.equal(game.stormPending, distance); assert.equal(game.stormMovementSource?.kind, 'card');
  assert.ok(semutaAdvisorStormClean(game)); assert.equal(game.ready.length, 0);
  const stormSource = structuredClone(game.stormMovementSource);
  const stormCardLog = structuredClone(game.log.findLast(row => row.component?.kind === 'stormCard' && row.component.distance === distance));
  assert.ok(stormCardLog);
  const stormReadiness = transition(() => {
    for (const p of game.players.slice(0, -1)) act(p.id, { type: 'ready' });
  });
  assert.equal(game.ready.length, game.players.length - 1);
  const triggerActor = game.players.at(-1)!.id, triggerAction: Action = { type: 'ready' };
  const storm = transition(() => { act(triggerActor, triggerAction); });
  assert.ok(game.response?.automaticAdvisorFlip?.producer === 'storm');
  const automatic = game.response.automaticAdvisorFlip;
  assert.equal(automatic.owner, owner); assert.equal(automatic.territory, territory);
  assert.deepEqual(automatic.forces, { [location]: 1 }); assert.equal(automatic.storm.sector, 9);
  assert.ok(game.stormResolution && game.stormResolution.traversed === 3); assert.deepEqual(game.stormResolution.pending, []);
  assert.equal(semutaAdvisorStormPlayer(game, outsider).forces[outsiderLocation] ?? 0, 0);
  assert.equal(semutaAdvisorStormPlayer(game, outsider).tanks, semutaAdvisorStormPlayer(storm.before, outsider).tanks + 1);
  assert.equal(semutaAdvisorStormPlayer(game, owner).forces[location], 1);
  assert.ok(game.pendingAutomaticAdvisorStorm?.ready); assert.deepEqual(semutaAdvisorStormInventory(game), originalInventory);
  return { game, kind: 'advisorFlip' as const, advanced: true as const, continues, distance, from,
    richese, holder, owner, outsider, atreides: outsider, spender, cost, karama: cost, semuta: SEMUTA_DRUG_ID,
    action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    territory, location, outsiderLocation, triggerActor, triggerAction,
    originalResponse: structuredClone(game.response), originalAutomaticSource: structuredClone(automatic),
    originalParent: structuredClone(game.pendingAutomaticAdvisorStorm!), originalQueue: structuredClone(game.pendingAutomaticAdvisorFlips!),
    originalPhysical: structuredClone(semutaAdvisorStormPhysical(game)),
    originalStance: structuredClone(semutaAdvisorStormPlayer(game, owner).advisors!),
    originalCursor: structuredClone(game.stormResolution), originalStormMovementSource: structuredClone(game.stormMovementSource),
    originalStormDials: structuredClone(game.stormDials), originalDeck: structuredClone(game.deck),
    originalReady: structuredClone(game.ready), originalSpiceDeck: structuredClone(game.spiceDeck),
    originalSpiceDiscard: structuredClone(game.spiceDiscard), initial, lobby, setup, setupChoices,
    beforeStartingDeal, afterSetup, dealOrder, deal: selected.map(card => card.id), originalInventory, originalSpice, spiceOrder,
    firstStorm, firstStormDials, acquisition, acquired, cache: acquisition, shipment, intrusion, intrusionResponse,
    mentat, mentatReadiness, mentatClose, closingMarket, stormDraw, originalStormCards: draw.original, stormCardOrder: draw.order,
    stormCardScalars: draw.scalars, stormSource, stormCardLog, stormReadiness, storm,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Original undealt Advanced R/C/BG/A/E Semuta initializer with CHOAM only, no Fremen or optional modules. Native BG setup places its real counter at empty Oh Gap10 and normally makes it a fighter. Only original unopened deals/Spice and scalar lotteries are selected; C really buys cache1 Semuta and E receives the printed Karama.',
      'Native first secret dials2/3 move Storm1→6. Atreides actually pays2 to ship one original reserve into Oh Gap9; BG accepts actual Intrusion and its ordinary advisorFlip response is allowed. Separate accompaniment is declined, retaining one actual advisor at10 beside one outsider at9.',
      'Real remaining movement, peaceful Battle/Collection and Mentat readiness execute. Select only the original six-card native shuffle when the actual final CHOAM Mentat Done opens turn2 to reveal distance3/4 with its original source/log. No card, forecast, order, stance, force, clock or cursor is assigned.',
      'Actual turn2 Storm readiness begins traversal from6. Sector9 really kills Atreides’ last outsider and opens mandatory conversion before sector10. Stop before the real cancellation cost; the held surviving BG group and full native cursor are actual engine output.',
    ] };
}
export type SemutaAdvisorStormFixture = ReturnType<typeof createSemutaAdvisorStormFixture>;
