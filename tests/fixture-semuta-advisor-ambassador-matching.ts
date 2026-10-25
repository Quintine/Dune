import assert from 'node:assert/strict';
import { applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaCombatCapabilities, nextSemutaCombatCapabilities,
  semutaCombatCapabilitiesPlayer, semutaCombatCapabilitiesInventory, semutaCombatCapabilitiesClean,
  passSemutaCombatCapabilities, claimSemutaCombatCapabilities,
} from './fixture-semuta-combat-capabilities';

export type SemutaAdvisorAmbassadorMatchingDirection = 'fightersToAdvisors' | 'advisorsToFighters';
export type SemutaAdvisorAmbassadorMatchingStep = { actor: string; action: Action };
export const actSemutaAdvisorAmbassadorMatching = actSemutaCombatCapabilities;
export const semutaAdvisorAmbassadorMatchingPlayer = semutaCombatCapabilitiesPlayer;
export const semutaAdvisorAmbassadorMatchingInventory = semutaCombatCapabilitiesInventory;
export const semutaAdvisorAmbassadorMatchingClean = semutaCombatCapabilitiesClean;
export const passSemutaAdvisorAmbassadorMatching = passSemutaCombatCapabilities;
export const claimSemutaAdvisorAmbassadorMatching = claimSemutaCombatCapabilities;
export const semutaAdvisorAmbassadorMatchingPhysical = (game: Game) => game.players.map(p => ({
  id: p.id, spice: p.spice, forces: p.forces, reserves: p.reserves, tanks: p.tanks, elites: p.elites,
  moved: p.moved, shipped: p.shipped, ally: p.ally, allySinceTurn: p.allySinceTurn,
}));

/** Native setup/quiet controls only; placements, Ambassador selections and
 * matching remain source/caller owned. Spiritual accompaniment is declined. */
export function nextSemutaAdvisorAmbassadorMatching(game: Game): SemutaAdvisorAmbassadorMatchingStep | null {
  if (game.response?.kind === 'advisorFlip') return null;
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'atreides', turn: 10 } };
    const ecaz = game.players.find(p => p.faction === 'ecaz');
    if (game.status === 'setup' && game.setupStage === 'forces' && ecaz?.reserves === 20)
      return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:10': 6 } } };
    const bg = game.players.find(p => p.faction === 'beneGesserit');
    if (game.status === 'setup' && game.setupStage === 'forces' && bg && !bg.advisorSetup)
      return { actor: bg.id, action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
    const d = game.decision;
    if (d?.kind === 'ecazPlacement' || d?.kind === 'ecazAmbassador') return null;
    if (d?.kind === 'advisorBattle' || d?.kind === 'advisor' || d?.kind === 'intrusion')
      return { actor: d.player, action: { type: 'decision', accept: false } };
  }
  return nextSemutaCombatCapabilities(game);
}
export const nextSemutaAdvisorAmbassadorMatchingStep = nextSemutaAdvisorAmbassadorMatching;
export function advanceSemutaAdvisorAmbassadorMatching(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorAmbassadorMatchingStep[] = []): Game {
  for (let count = 0; count < 3200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaAdvisorAmbassadorMatching(game);
    assert.ok(next, `Supply the actual Fremen Ambassador choice at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaAdvisorAmbassadorMatching(game, next.actor, next.action, actions);
  }
  throw Error('The native Semuta/Ambassador matching source did not reach its finite boundary');
}
export function allowSemutaAdvisorAmbassadorMatching(game: Game, actions: SemutaAdvisorAmbassadorMatchingStep[] = []): Game {
  const event = game.response?.advisorAmbassadorMatchingSource?.event; assert.ok(event);
  for (let count = 0; game.response?.advisorAmbassadorMatchingSource?.event === event && count < game.players.length; count++) {
    const p = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(p);
    game = actSemutaAdvisorAmbassadorMatching(game, p.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.advisorAmbassadorMatchingSource?.event, event); return game;
}
/** Finish only this consumed Ambassador grant. A prevented caller must first
 * choose a real legal alternate; no new decline payload is introduced here. */
export function finishSemutaAdvisorAmbassadorMatching(game: Game, actions: SemutaAdvisorAmbassadorMatchingStep[] = []): Game {
  assert.ok(!game.pendingTreacheryDiscard);
  return advanceSemutaAdvisorAmbassadorMatching(game, state => !state.pendingAmbassador &&
    !state.pendingAdvisorAmbassadorMatching && semutaAdvisorAmbassadorMatchingClean(state), actions);
}

function originalFremenPacket() {
  const original = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = ['fremen', ...original.filter(effect => effect !== 'fremen').slice(0, 4)];
  const order = [...supply, ...original.filter(effect => !supply.includes(effect))], current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(order[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, order); return { supply, order, scalars };
}
function createOriginalPacket(game: Game, step: SemutaAdvisorAmbassadorMatchingStep,
  actions: SemutaAdvisorAmbassadorMatchingStep[], scalars: number[]) {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1)
      array[0] = cursor < scalars.length ? scalars[cursor++] : 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, step.actor, step.action); assert.equal(cursor, scalars.length);
    actions.push(structuredClone(step)); return next;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Real native Fremen packet, paid token/fighter group and Nexus alliance.
 * The matching response precedes any independent relocation. */
export function createSemutaAdvisorAmbassadorMatchingFixture(options: { direction?: SemutaAdvisorAmbassadorMatchingDirection } = {}) {
  const direction = options.direction ?? 'fightersToAdvisors';
  const richese = 'richese', holder = 'choam', ecaz = 'ecaz', owner = 'beneGesserit', entrant = 'atreides', spender = 'emperor';
  let game = createGame('SEMUTAADVISORAMBASSADORMATCHING', newPlayer(richese, 'Richese', 'richese'), true, ['choam', 'ecaz']);
  for (const faction of ['choam', 'ecaz', 'beneGesserit', 'atreides', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorAmbassadorMatchingStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorAmbassadorMatching(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorAmbassadorMatching(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game); assert.equal(game.status, 'setup'); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAdvisorAmbassadorMatchingInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' || card.kind === 'poison').slice(0, 5);
  assert.equal(ordinary.length, 5); const selected = [...ordinary, printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card: card.id, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = printed.id, packet = originalFremenPacket();
  let packetCreation: { before: Game; steps: SemutaAdvisorAmbassadorMatchingStep[]; after: Game } | null = null;
  let advisorSetup: { before: Game; steps: SemutaAdvisorAmbassadorMatchingStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 180; count++) {
    const next = nextSemutaAdvisorAmbassadorMatching(game); assert.ok(next);
    const before = structuredClone(game), at = actions.length;
    const creates = game.setupStage === 'traitors' && next.action.type === 'traitor' &&
      game.players.filter(p => p.traitorChoices.length).length === 1;
    if (creates) game = createOriginalPacket(game, next, actions, packet.scalars);
    else act(next.actor, next.action);
    const record = { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
    if (creates) packetCreation = record;
    if (next.action.type === 'advisorSetup') advisorSetup = record;
  }
  assert.equal(game.status, 'playing'); assert.ok(packetCreation && advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.deepEqual(game.ecazAmbassadors!.cohort.map(id => game.ecazAmbassadors!.tokens.find(t => t.id === id)!.effect), packet.supply);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const orderLand = (positions: number[]) => positions.map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['imperial_basin', 'arrakeen', 'tueks_sietch', 'carthag'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  const spiceOrder = orderLand([0, 1]);
  let beforeBid: Game | undefined, bid: SemutaAdvisorAmbassadorMatchingStep | undefined, bidAt = -1;
  for (let count = 0; count < 1000 && !semutaAdvisorAmbassadorMatchingPlayer(game, holder).hand.some(c => c.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaAdvisorAmbassadorMatching(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  reach(state => state.turn === 1 && state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  const token = game.ecazAmbassadors!.tokens.find(t => t.effect === 'fremen' && t.zone === 'supply'); assert.ok(token);
  const placement = transition(() => {
    act(ecaz, { type: 'decision', token: token.id, territory: 'carthag' });
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
    act(ecaz, { type: 'decision', decline: true });
  });
  assert.equal(semutaAdvisorAmbassadorMatchingPlayer(placement.before, ecaz).spice - semutaAdvisorAmbassadorMatchingPlayer(game, ecaz).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && semutaAdvisorAmbassadorMatchingClean(state));
  const fighterShipment = transition(() => {
    act(owner, { type: 'ship', territory: 'tueks_sietch', sector: 5, amount: 2, elite: 0, allyPayment: 0 });
    reach(semutaAdvisorAmbassadorMatchingClean);
  });
  assert.equal(semutaAdvisorAmbassadorMatchingPlayer(fighterShipment.before, owner).spice - semutaAdvisorAmbassadorMatchingPlayer(game, owner).spice, 2);
  reach(state => state.turn === 2 && state.phase === 1 && semutaAdvisorAmbassadorMatchingClean(state) &&
    !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
  const beforeWorm = structuredClone(game), beforeWormInventory = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const wormIndex = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.thumper && !card.suppressed);
  assert.ok(wormIndex >= 0); const worm = game.spiceDeck.splice(wormIndex, 1)[0]; game.spiceDeck.unshift(worm);
  const wormOrder = { position: 0, from: wormIndex, card: structuredClone(worm) }, wormFollowupOrder = orderLand([1, 2]);
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), beforeWormInventory);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && semutaAdvisorAmbassadorMatchingClean(state));
  const alliance = transition(() => {
    act(owner, { type: 'alliance', target: ecaz }); act(ecaz, { type: 'alliance', target: owner });
  });
  reach(state => state.turn === 2 && state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  act(ecaz, { type: 'decision', decline: true });
  reach(state => state.turn === 2 && state.phase === 5 && state.active === entrant && semutaAdvisorAmbassadorMatchingClean(state));
  const entrantShipment = transition(() => {
    act(entrant, { type: 'ship', territory: 'carthag', sector: 11, amount: 1, elite: 0, allyPayment: 0 });
    reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'offer');
  });
  const event = game.pendingAmbassador!.event;
  const trigger = transition(() => {
    act(ecaz, { type: 'decision', event, trigger: true, beneficiary: owner });
    reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'move');
  });
  const fightersToAdvisors: Action = { type: 'decision', event, forces: { 'tueks_sietch:5': 1 }, territory: 'arrakeen', sector: 10 };
  const advisorsToFighters: Action = { type: 'decision', event, forces: { 'arrakeen:10': 1 }, territory: 'tueks_sietch', sector: 5 };
  const alternate: Action = { type: 'decision', event, forces: { 'tueks_sietch:5': 1 }, territory: 'polar_sink', sector: 0 };
  const relocationAction = direction === 'fightersToAdvisors' ? fightersToAdvisors : advisorsToFighters;
  const from = direction === 'fightersToAdvisors' ? 'tueks_sietch:5' : 'arrakeen:10';
  const to = direction === 'fightersToAdvisors' ? 'arrakeen:10' : 'tueks_sietch:5';
  const declaration = transition(() => { act(owner, relocationAction); });
  assert.ok(game.response?.kind === 'advisorFlip' && game.response.advisorAmbassadorMatchingSource);
  assert.ok(game.pendingAdvisorAmbassadorMatching && game.pendingAmbassador);
  assert.deepEqual(semutaAdvisorAmbassadorMatchingInventory(game), originalInventory);
  return { game, kind: 'advisorFlip' as const, advanced: true as const, direction, richese, holder, owner, ecaz, entrant, spender,
    beneficiary: owner, cost, karama: cost, semuta: SEMUTA_DRUG_ID,
    action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    originalResponse: structuredClone(game.response), originalSource: structuredClone(game.response.advisorAmbassadorMatchingSource),
    originalParent: structuredClone(game.pendingAdvisorAmbassadorMatching), originalAmbassador: structuredClone(game.pendingAmbassador),
    originalPhysical: structuredClone(semutaAdvisorAmbassadorMatchingPhysical(game)),
    originalStance: structuredClone(semutaAdvisorAmbassadorMatchingPlayer(game, owner).advisors!),
    originalTokens: structuredClone(game.ecazAmbassadors!), token: token.id, event, from, to, relocationAction, alternate,
    fightersToAdvisors, advisorsToFighters, initial, lobby, setup, beforeStartingDeal, afterSetup, advisorSetup,
    packet, packetCreation, dealOrder, deal: selected.map(c => c.id), originalInventory, originalSpice, spiceOrder,
    acquisition, acquired, cache: acquisition, placement, fighterShipment, beforeWorm, wormOrder, wormFollowupOrder,
    alliance, entrantShipment, trigger, declaration, actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Original narrow Advanced Ecaz Semuta initializer on ready R/C/Ecaz/BG/A/E, exact CHOAM+Ecaz and no modules. Native Ecaz Basin6/BG Arrakeen1 beside A10 setup execute. Only unopened main/Spice positions, scalar lotteries and original nine-draw Fremen packet are selected; C buys cache1 and E receives printed Karama.',
      'Ecaz really pays1 to place its original Fremen token in Carthag at first Revival. BG actually pays2 to ship two reserves into empty Tuek’s5 as fighters, retaining its original peaceful Arrakeen advisor. Actual next Storm, original worm/Nexus and reciprocal BG/Ecaz proposals earn the alliance.',
      'Atreides actually pays1 into the placed Carthag token; its earlier Spiritual opportunity is declined through native controls. Ecaz actually triggers Fremen for its BG ally and consumes the original token. BG selects a real one-counter opposite-type relocation, which stops at precommit matching without transferring the packet.',
      'The source exposes both actual stance directions and a native legal alternate relocating one Tuek’s fighter to empty Polar Sink. No new decline is invented. No played hand, wallet, token, ally, army, stance, clock, parent or Semuta window is installed.',
    ] };
}
export type SemutaAdvisorAmbassadorMatchingFixture = ReturnType<typeof createSemutaAdvisorAmbassadorMatchingFixture>;
