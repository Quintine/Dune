import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorStormFlipStep = { actor: string; action: Action };
export type AdvisorStormFlipTransition = { before: Game; steps: AdvisorStormFlipStep[]; after: Game };
export const actAdvisorStormFlip = actAdvisorPreparation;
export const advisorStormFlipClean = advisorPreparationClean;
export const advisorStormFlipInventory = advisorPreparationInventory;
export const advisorStormFlipPlayer = advisorPreparationPlayer;

/** Native first Storm uses real 2/3 dials. Setup's empty Oh Gap group becomes
 * fighters normally; later original Intrusion really changes it to advisors. */
export function nextAdvisorStormFlip(game: Game): AdvisorStormFlipStep | null {
  if (game.response?.automaticAdvisorFlip) return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'forces' &&
        !advisorStormFlipPlayer(game, 'beneGesserit').advisorSetup)
      return { actor: 'beneGesserit', action: { type: 'advisorSetup', territory: 'oh_gap', sector: 10 } };
    if (game.status === 'playing' && game.turn === 1 && game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
      if (actor) return { actor, action: { type: 'stormDial', amount: game.stormDialers.indexOf(actor) === 0 ? 2 : 3 } };
    }
    if (game.decision?.kind === 'intrusion')
      return { actor: game.decision.player, action: { type: 'decision', accept: true } };
    if (game.decision?.kind === 'advisorBattle')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorStormFlip(game: Game, until: (state: Game) => boolean,
  steps: AdvisorStormFlipStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine Storm chronology ended before its requested boundary');
    const next = nextAdvisorStormFlip(game);
    assert.ok(next, `Choose the original advisor conversion at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorStormFlip(game, next.actor, next.action, steps);
  }
  throw Error('The native advisor Storm source did not reach its finite boundary');
}
export function passAdvisorStormFlip(game: Game, steps: AdvisorStormFlipStep[] = []): Game {
  for (let count = 0; game.response && !game.response.automaticAdvisorFlip && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorStormFlip(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response || game.response.automaticAdvisorFlip); return game;
}

/** Select just the six original Storm Cards' native Fisher-Yates shuffle on
 * the real last Mentat readiness action. No Storm Card or clock is assigned. */
function drawOriginalStormCard(game: Game, step: AdvisorStormFlipStep, distance: 3 | 4,
  steps: AdvisorStormFlipStep[]) {
  assert.equal(game.phase, 8); assert.equal(game.turn, 1); assert.ok(advisorStormFlipClean(game));
  assert.equal(game.ready.length, game.players.length - 1); assert.equal(step.action.type, 'ready');
  const original = [1, 2, 3, 4, 5, 6], order = [distance, ...original.filter(value => value !== distance)];
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
      assert.ok(cursor < scalars.length, 'Only the original turn-two Storm shuffle consumes selected entropy');
      array[0] = scalars[cursor++];
    } else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, step.actor, step.action);
    assert.equal(cursor, scalars.length, 'The real six-card Storm shuffle consumes its original permutation once');
    steps.push(structuredClone(step)); return { game: next, original, order, scalars };
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Public Advanced BG/Atreides/Emperor base33, no Fremen or optional module.
 * Original setup, first dials, paid shipment and Intrusion earn a split-sector
 * peaceful group. Stop before the last actual turn-two Storm Ready action. */
export function createAdvisorStormFlipFixture(options: { continues?: boolean; sameSector?: boolean } = {}) {
  const continues = options.continues ?? false, distance: 3 | 4 = continues ? 4 : 3;
  const sameSector = options.sameSector ?? false;
  const bg = 'beneGesserit', holder = 'atreides', emperor = 'emperor';
  const territory = 'oh_gap', location = sameSector ? 'oh_gap:9' : 'oh_gap:10', outsiderLocation = 'oh_gap:9';
  let game = createGame('ADVISORSTORMFLIP', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true);
  joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(emperor, 'Emperor', 'emperor'));
  const initial = structuredClone(game), steps: AdvisorStormFlipStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorStormFlip(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorStormFlip(game, until, steps); };
  const transition = (run: () => void): AdvisorStormFlipTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.deepEqual(game.expansions, []);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = advisorStormFlipInventory(game); assert.equal(originalInventory.length, 33);
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = [ordinary[0], karama, ordinary[1]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: AdvisorStormFlipTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorStormFlip(game); assert.ok(next);
    const before = next.action.type === 'advisorSetup' ? structuredClone(game) : null;
    if (before && sameSector) next.action = { type: 'advisorSetup', territory, sector: 9 };
    act(next.actor, next.action);
    if (before) advisorSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.equal(game.storm, 1);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorStormFlipPlayer(game, bg).forces[location], 1);
  assert.ok(!advisorStormFlipPlayer(game, bg).advisors?.[territory]);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  const firstStorm = transition(() => {
    reach(state => state.turn === 1 && state.phase === 1 && state.storm === 6);
  });
  const firstStormDialSteps = firstStorm.steps.filter(step => step.action.type === 'stormDial');
  assert.deepEqual(firstStormDialSteps.map(step => step.action.amount), [2, 3]);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === bg && advisorStormFlipClean(state));
  const beforeMovement = structuredClone(game);
  const bgEnd = transition(() => {
    act(bg, { type: 'endMovement' });
    reach(state => state.phase === 5 && state.active === holder && advisorStormFlipClean(state));
  });
  const shipment = transition(() => {
    act(holder, { type: 'ship', territory, sector: 9, amount: 1, elite: 0, allyPayment: 0 });
    reach(state => !state.phaseOpening && !state.response && state.decision?.kind === 'intrusion');
  });
  const beforeIntrusion = structuredClone(game);
  const intrusion = transition(() => {
    act(bg, { type: 'decision', accept: true });
    assert.equal(game.response?.kind, 'advisorFlip'); assert.equal(game.response?.advisors, true);
    reach(advisorStormFlipClean);
  });
  assert.equal(advisorStormFlipPlayer(shipment.before, holder).spice - advisorStormFlipPlayer(game, holder).spice, 2);
  assert.equal(advisorStormFlipPlayer(game, holder).forces[outsiderLocation], 1);
  assert.equal(advisorStormFlipPlayer(game, bg).forces[location], 1);
  assert.ok(advisorStormFlipPlayer(game, bg).advisors?.[territory]);
  const afterIntrusion = structuredClone(game);
  reach(state => state.turn === 1 && state.phase === 8 && advisorStormFlipClean(state));
  const mentat = structuredClone(game);
  const mentatReadiness = transition(() => {
    for (const player of game.players.slice(0, -1)) act(player.id, { type: 'ready' });
  });
  const drawStep: AdvisorStormFlipStep = { actor: game.players.at(-1)!.id, action: { type: 'ready' } };
  const beforeDraw = structuredClone(game), drawStart = steps.length;
  const draw = drawOriginalStormCard(game, drawStep, distance, steps); game = draw.game;
  const stormDraw: AdvisorStormFlipTransition = {
    before: beforeDraw, steps: structuredClone(steps.slice(drawStart)), after: structuredClone(game),
  };
  assert.equal(game.turn, 2); assert.equal(game.phase, 0); assert.equal(game.storm, 6);
  assert.equal(game.stormPending, distance); assert.equal(game.stormMovementSource?.kind, 'card');
  assert.ok(advisorStormFlipClean(game)); assert.equal(game.ready.length, 0);
  const stormSource = structuredClone(game.stormMovementSource);
  const stormCardLog = structuredClone(game.log.findLast(entry => entry.component?.kind === 'stormCard' && entry.component.distance === distance));
  assert.ok(stormCardLog, 'The original native Storm Card reveal is actually logged');
  const beforeStormReadiness = structuredClone(game);
  const stormReadiness = transition(() => {
    for (const player of game.players.slice(0, -1)) act(player.id, { type: 'ready' });
  });
  const triggerActor = game.players.at(-1)!.id, action: Action = { type: 'ready' };
  assert.equal(game.ready.length, 2); assert.ok(!game.ready.includes(triggerActor));
  assert.equal(game.stormResolution, null);
  assert.equal(advisorStormFlipPlayer(game, holder).forces[outsiderLocation], 1);
  assert.equal(advisorStormFlipPlayer(game, bg).forces[location], 1);
  assert.ok(advisorStormFlipPlayer(game, bg).advisors?.[territory]);
  assert.ok(advisorStormFlipPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorStormFlipInventory(game), originalInventory);
  return { game, source: structuredClone(game), beforeAction: structuredClone(game), initial, lobby, setup,
    beforeStartingDeal, afterSetup, advisorSetup, firstStorm, firstStormDialSteps,
    beforeMovement, bgEnd, shipment, beforeIntrusion, intrusion, afterIntrusion,
    mentat, mentatReadiness, beforeDraw, drawStep, stormDraw, beforeStormReadiness, stormReadiness,
    originalStormCards: draw.original, stormCardOrder: draw.order, stormCardScalars: draw.scalars,
    stormSource, stormCardLog, continues, sameSector, bg, owner: bg, holder, atreides: holder, emperor,
    karama: karama.id, card: karama.id, territory, location, outsiderLocation, from: 6, distance,
    triggerActor, actor: triggerActor, action,
    triggerStep: { actor: triggerActor, action } satisfies AdvisorStormFlipStep,
    steps, actions: steps, sourceActionCount: steps.length, stepCount: steps.length,
    originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      `Actual public Advanced BG/Atreides/Emperor ready/startPreview, original base33 and no Fremen or optional module. Original prediction/private Traitor choices and actual advisorSetup place BG’s original counter in empty exposed Oh Gap${sameSector ? 9 : 10}, which native setup normally makes a fighter.`,
      'Select only original scalar shuffle draws, three original unopened Treachery positions and two original unopened ordinary Spice positions. BG/Emperor receive ordinary cards; Atreides receives its original Karama. No played hand, force, phase, wallet, Tanks or stance is installed.',
      'Actually submit first native secret Storm dials two and three. Original Storm moves from sector1 to6 without crossing BG10. Both Spice blows, Charity, normal Bidding and Revival execute normally; actual original circle order finishes Emperor before BG’s movement turn.',
      `BG actually ends movement; Atreides pays two spice to ship one original reserve to Oh Gap9. BG actually accepts the resulting original Intrusion, all standard advisorFlip responses allow it, and separate Spiritual Advisors accompaniment is declined. A1 at sector9 and BG’s original peaceful advisor1 at sector${sameSector ? 9 : 10} remain physical neighbours in one territory.`,
      'Actual remaining movement, peaceful Battle completion, Collection and first Mentat readiness run normally. Scope exactly the native six-card Storm shuffle on the real last Mentat Ready to reveal three/four, with its original source signature and real Storm Card log; no Storm Pending/Card/phase/forecast is assigned.',
      sameSector
        ? 'Actually submit two turn-two Storm Ready actions, stopping before traversal from6 through9 destroys both colocated counters without a surviving advisor conversion.'
        : 'Actually submit only two of the three turn-two Storm Ready actions. Stop before the final original Ready triggers traversal from6: three sectors ends9 with BG10 safe; four sectors continues through10. The original counter, casualties, traversal cursor and later Spice reveal remain caller-owned outcomes.',
    ],
  };
}
export type AdvisorStormFlipFixture = ReturnType<typeof createAdvisorStormFlipFixture>;

/** Submit only the final real Ready. The new conversion response is untouched. */
export function commitAdvisorStormFlip(source: Game, fixture: AdvisorStormFlipFixture,
  steps: AdvisorStormFlipStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  const game = actAdvisorStormFlip(source, fixture.triggerActor, fixture.action, steps);
  return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)),
    resolution: structuredClone(game.stormResolution), source: structuredClone(game.stormMovementSource) };
}
/** Call after the caller's conversion choice. Stop as soon as native traversal
 * opens phase1; its ordinary windows may remain, and no Spice is revealed. */
export function finishAdvisorStormFlip(source: Game, steps: AdvisorStormFlipStep[] = []): Game {
  return advanceAdvisorStormFlip(source, game => game.phase === 1, steps);
}
