import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorAmbassadorMatchingStep = { actor: string; action: Action };
export type AdvisorAmbassadorMatchingTransition = { before: Game; steps: AdvisorAmbassadorMatchingStep[]; after: Game };
export const actAdvisorAmbassadorMatching = actAdvisorPreparation;
export const advisorAmbassadorMatchingPlayer = advisorPreparationPlayer;
export const advisorAmbassadorMatchingInventory = advisorPreparationInventory;
export const advisorAmbassadorMatchingClean = advisorPreparationClean;

/** Native continuation never chooses an Ambassador relocation or a new
 * matching response. Ordinary preparation and Spiritual choices are declined. */
export function nextAdvisorAmbassadorMatching(game: Game): AdvisorAmbassadorMatchingStep | null {
  if (game.response?.kind === 'advisorFlip') return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const ecaz = game.players.find(player => player.faction === 'ecaz');
    if (game.status === 'setup' && game.setupStage === 'forces' && ecaz?.reserves === 20)
      return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:10': 6 } } };
    const decision = game.decision;
    if (decision?.kind === 'ecazPlacement' || decision?.kind === 'ecazAmbassador') return null;
    if (decision?.kind === 'advisorBattle')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorAmbassadorMatching(game: Game, until: (state: Game) => boolean,
  steps: AdvisorAmbassadorMatchingStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The native allied Ambassador chronology ended before its requested boundary');
    const next = nextAdvisorAmbassadorMatching(game);
    assert.ok(next, `Choose the original Ambassador/matching control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorAmbassadorMatching(game, next.actor, next.action, steps);
  }
  throw Error('The original allied Fremen Ambassador source did not reach its finite boundary');
}
export function passAdvisorAmbassadorMatching(game: Game, steps: AdvisorAmbassadorMatchingStep[] = []): Game {
  for (let count = 0; game.response && game.response.kind !== 'advisorFlip' && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorAmbassadorMatching(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response || game.response.kind === 'advisorFlip'); return game;
}
function originalFremenPacket() {
  const original = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = ['fremen', ...original.filter(effect => effect !== 'fremen').slice(0, 4)];
  const order = [...supply, ...original.filter(effect => !supply.includes(effect))];
  const current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(order[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, order); assert.equal(scalars.length, 9); return { supply, order, scalars };
}
function dealOriginalPacket(game: Game, step: AdvisorAmbassadorMatchingStep,
  steps: AdvisorAmbassadorMatchingStep[], scalars: number[]): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < scalars.length ? scalars[cursor++] : 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, step.actor, step.action);
    assert.equal(cursor, scalars.length, 'The native original Ecaz packet consumes its selected draws once');
    steps.push(structuredClone(step)); return next;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Public Advanced BG/Ecaz/Atreides base33. A paid native fighter group and the
 * original advisor survive to a real turn-two Nexus alliance. Ecaz then earns
 * an original Fremen trigger for its actual BG ally. Stop before relocation. */
export function createAdvisorAmbassadorMatchingFixture(options: {
  direction?: 'fightersToAdvisors' | 'advisorsToFighters';
} = {}) {
  const direction = options.direction ?? 'fightersToAdvisors';
  const bg = 'beneGesserit', ecaz = 'ecaz', holder = 'atreides';
  let game = createGame('ADVISORAMBASSADORMATCHING', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true, ['ecaz']);
  joinGame(game, newPlayer(ecaz, 'Ecaz', 'ecaz')); joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  const initial = structuredClone(game), steps: AdvisorAmbassadorMatchingStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorAmbassadorMatching(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorAmbassadorMatching(game, until, steps); };
  const transition = (run: () => void): AdvisorAmbassadorMatchingTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.deepEqual(game.expansions, ['ecaz']);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = advisorAmbassadorMatchingInventory(game); assert.equal(originalInventory.length, 33);
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = [ordinary[0], ordinary[1], karama];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game), packet = originalFremenPacket();
  let packetCreation: AdvisorAmbassadorMatchingTransition | null = null;
  let advisorSetup: AdvisorAmbassadorMatchingTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorAmbassadorMatching(game); assert.ok(next);
    const before = structuredClone(game), start = steps.length;
    const createsPacket = game.setupStage === 'traitors' && next.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length).length === 1;
    game = createsPacket ? dealOriginalPacket(game, next, steps, packet.scalars)
      : actAdvisorAmbassadorMatching(game, next.actor, next.action, steps);
    const record = { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
    if (createsPacket) packetCreation = record;
    if (next.action.type === 'advisorSetup') advisorSetup = record;
  }
  assert.equal(game.status, 'playing'); assert.ok(packetCreation && advisorSetup);
  const afterSetup = structuredClone(game), setupActionCount = steps.length;
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorAmbassadorMatchingPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorAmbassadorMatchingPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorAmbassadorMatchingPlayer(game, holder).forces['arrakeen:10'], 10);
  assert.deepEqual(game.ecazAmbassadors!.cohort.map(id => game.ecazAmbassadors!.tokens.find(token => token.id === id)!.effect), packet.supply);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['imperial_basin', 'arrakeen', 'tueks_sietch'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  const token = game.ecazAmbassadors!.tokens.find(candidate => candidate.effect === 'fremen')!;
  assert.equal(token.zone, 'supply');
  const placement = transition(() => {
    act(ecaz, { type: 'decision', token: token.id, territory: 'carthag' });
    game = passAdvisorAmbassadorMatching(game, steps);
  });
  assert.equal(advisorAmbassadorMatchingPlayer(placement.before, ecaz).spice - advisorAmbassadorMatchingPlayer(game, ecaz).spice, 1);
  act(ecaz, { type: 'decision', decline: true });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === bg && advisorAmbassadorMatchingClean(state));
  const fighterShipment = transition(() => {
    act(bg, { type: 'ship', territory: 'tueks_sietch', sector: 5, amount: 2, elite: 0, allyPayment: 0 });
    reach(advisorAmbassadorMatchingClean);
  });
  assert.equal(advisorAmbassadorMatchingPlayer(fighterShipment.before, bg).spice - advisorAmbassadorMatchingPlayer(game, bg).spice, 2);
  assert.equal(advisorAmbassadorMatchingPlayer(game, bg).forces['tueks_sietch:5'], 2);
  assert.ok(!advisorAmbassadorMatchingPlayer(game, bg).advisors?.tueks_sietch);
  reach(state => state.turn === 2 && state.phase === 1 && advisorAmbassadorMatchingClean(state) &&
    !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
  const beforeWorm = structuredClone(game), beforeWormInventory = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const wormIndex = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
  assert.ok(wormIndex >= 0);
  const worm = game.spiceDeck.splice(wormIndex, 1)[0]; game.spiceDeck.unshift(worm);
  const wormOrder = { position: 0, from: wormIndex, card: structuredClone(worm) };
  const wormFollowupOrder = [1, 2].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['imperial_basin', 'arrakeen', 'tueks_sietch'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), beforeWormInventory);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && advisorAmbassadorMatchingClean(state));
  const nexus = structuredClone(game);
  const alliance = transition(() => {
    act(bg, { type: 'alliance', target: ecaz });
    act(ecaz, { type: 'alliance', target: bg });
  });
  assert.equal(advisorAmbassadorMatchingPlayer(game, bg).ally, ecaz);
  assert.equal(advisorAmbassadorMatchingPlayer(game, ecaz).ally, bg);
  const allianceActionCount = steps.length;
  reach(state => state.turn === 2 && state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  act(ecaz, { type: 'decision', decline: true });
  reach(state => state.turn === 2 && state.phase === 5 && state.active === holder && advisorAmbassadorMatchingClean(state));
  const entrantShipment = transition(() => {
    act(holder, { type: 'ship', territory: 'carthag', sector: 11, amount: 1, elite: 0, allyPayment: 0 });
    reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'offer');
  });
  const offer = structuredClone(game), event = game.pendingAmbassador!.event;
  const trigger = transition(() => {
    act(ecaz, { type: 'decision', event, trigger: true, beneficiary: bg });
    reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'move');
  });
  assert.equal(game.pendingAmbassador!.beneficiary, bg); assert.equal(game.pendingAmbassador!.effect, 'fremen');
  assert.equal(game.decision?.player, bg);
  assert.equal(advisorAmbassadorMatchingPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorAmbassadorMatchingPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorAmbassadorMatchingPlayer(game, bg).forces['tueks_sietch:5'], 2);
  assert.ok(!advisorAmbassadorMatchingPlayer(game, bg).advisors?.tueks_sietch);
  assert.equal(advisorAmbassadorMatchingPlayer(game, bg).ally, ecaz);
  assert.equal(advisorAmbassadorMatchingPlayer(game, ecaz).ally, bg);
  assert.ok(advisorAmbassadorMatchingPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorAmbassadorMatchingInventory(game), originalInventory);
  const advisorsToFighters: Action = { type: 'decision', event, forces: { 'arrakeen:10': 1 }, territory: 'tueks_sietch', sector: 5 };
  const fightersToAdvisors: Action = { type: 'decision', event, forces: { 'tueks_sietch:5': 1 }, territory: 'arrakeen', sector: 10 };
  const largerPacket: Action = { type: 'decision', event, forces: { 'tueks_sietch:5': 2 }, territory: 'arrakeen', sector: 10 };
  const noMatch: Action = { type: 'decision', event, forces: { 'tueks_sietch:5': 1 }, territory: 'polar_sink', sector: 0 };
  const action = direction === 'fightersToAdvisors' ? fightersToAdvisors : advisorsToFighters;
  const sourceLocation = direction === 'fightersToAdvisors' ? 'tueks_sietch:5' : 'arrakeen:10';
  const destinationLocation = direction === 'fightersToAdvisors' ? 'arrakeen:10' : 'tueks_sietch:5';
  return { game, source: structuredClone(game), beforeSelection: structuredClone(game), initial, lobby, setup,
    beforeStartingDeal, afterSetup, advisorSetup, packet, packetCreation, placement, fighterShipment,
    beforeWorm, wormOrder, wormFollowupOrder, nexus, alliance, entrantShipment, offer, beforeTrigger: offer, trigger, triggerState: trigger.after,
    originalParent: structuredClone(game.pendingAmbassador), direction, bg, owner: bg, ecaz, holder, atreides: holder,
    karama: karama.id, card: karama.id, token: token.id, event, actor: bg, beneficiary: bg,
    action, advisorsToFighters, fightersToAdvisors, largerPacket, noMatch,
    matchingActions: [fightersToAdvisors, advisorsToFighters], replacement: largerPacket,
    replacements: [largerPacket, noMatch], replacementActions: [largerPacket, noMatch],
    sourceLocation, destinationLocation, from: sourceLocation, to: destinationLocation,
    relocationStep: { actor: bg, action } satisfies AdvisorAmbassadorMatchingStep,
    steps, actions: steps, sourceActionCount: steps.length, setupActionCount, allianceActionCount,
    originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced BG/Ecaz/Atreides ready/startPreview, original base33 and bare E3. Original prediction/private Traitors, native Ecaz Basin6 setup and actual BG advisorSetup beside Atreides’ native ten Arrakeen counters execute normally.',
      'Select only original scalar shuffle draws, three original unopened Treachery positions, two safe ordinary first-turn Spice positions, the original Ecaz nine-draw Fremen packet and one still-unopened turn-two Shai-Hulud followed by two safe original land cards. Atreides actually receives and retains its original printed Karama; no dealt hand is installed.',
      'Ecaz actually pays one at first Revival to place its original Fremen token in Carthag. During its real first movement turn BG actually pays two to ship two reserves into empty Tuek’s5 as fighters, retaining the original Arrakeen advisor. Other native turns and Collection/Mentat complete without a battle or force staging.',
      'Actual native turn-two Storm Card1 leaves both BG groups safe. The actual Shai-Hulud and Nexus permit BG’s real alliance proposal and Ecaz’s real acceptance. The reciprocal alliance is never assigned; no Nexus Card module is selected.',
      'Atreides actually ships one reserve into the still-placed Carthag token. The original entry/Spiritual controls resolve normally, then Ecaz really triggers Fremen for its actual BG ally. Stop at the original BG-owned stage move, before selecting or consuming any relocation packet.',
      'One original board exposes both opposite-type directions, two genuine one/two-fighter packets for retry, and a no-match relocation to empty Polar Sink. The new matching response, force transfer, mode change and later parent callbacks remain caller-owned outcomes; no played phase, alliance, army, wallet, stance, prevention or receipt is installed.',
    ] };
}
export type AdvisorAmbassadorMatchingFixture = ReturnType<typeof createAdvisorAmbassadorMatchingFixture>;

/** Submit only one original source selection; later matching stays owned. */
export function commitAdvisorAmbassadorMatching(source: Game, fixture: AdvisorAmbassadorMatchingFixture,
  action: Action = fixture.action, steps: AdvisorAmbassadorMatchingStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  const game = actAdvisorAmbassadorMatching(source, fixture.bg, action, steps);
  return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)) };
}
export function finishAdvisorAmbassadorMatching(source: Game, steps: AdvisorAmbassadorMatchingStep[] = []): Game {
  return advanceAdvisorAmbassadorMatching(source,
    game => !game.pendingAmbassador && advisorAmbassadorMatchingClean(game), steps);
}
