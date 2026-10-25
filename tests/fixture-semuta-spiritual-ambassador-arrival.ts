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

export type SemutaSpiritualAmbassadorArrivalStep = { actor: string; action: Action };
export const actSemutaSpiritualAmbassadorArrival = actSemutaCombatCapabilities;
export const semutaSpiritualAmbassadorArrivalPlayer = semutaCombatCapabilitiesPlayer;
export const semutaSpiritualAmbassadorArrivalInventory = semutaCombatCapabilitiesInventory;
export const semutaSpiritualAmbassadorArrivalClean = semutaCombatCapabilitiesClean;
export const passSemutaSpiritualAmbassadorArrival = passSemutaCombatCapabilities;
export const claimSemutaSpiritualAmbassadorArrival = claimSemutaCombatCapabilities;
export const semutaSpiritualAmbassadorArrivalPhysical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, active: game.active, order: game.order,
  ready: game.ready, movementRemaining: game.movementRemaining, spice: game.spice,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, reserves: p.reserves,
    tanks: p.tanks, elites: p.elites, leaders: p.leaders, ally: p.ally, moved: p.moved, shipped: p.shipped })),
});

/** Placements, the Guild benefit and free Spiritual choice remain explicit
 * native selections. No mandatory conversion is silently answered here. */
export function nextSemutaSpiritualAmbassadorArrival(game: Game): SemutaSpiritualAmbassadorArrivalStep | null {
  if (game.response?.automaticAdvisorFlip) return null;
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
    if (d?.kind === 'ecazPlacement' || d?.kind === 'ecazAmbassador' || d?.kind === 'advisor' || d?.kind === 'intrusion') return null;
    if (d?.kind === 'advisorBattle') return { actor: d.player, action: { type: 'decision', accept: false } };
  }
  return nextSemutaCombatCapabilities(game);
}
export const nextSemutaSpiritualAmbassadorArrivalStep = nextSemutaSpiritualAmbassadorArrival;
export function advanceSemutaSpiritualAmbassadorArrival(game: Game, until: (state: Game) => boolean,
  actions: SemutaSpiritualAmbassadorArrivalStep[] = []): Game {
  for (let count = 0; count < 2800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaSpiritualAmbassadorArrival(game);
    assert.ok(next, `Supply the real Guild/Spiritual choice at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaSpiritualAmbassadorArrival(game, next.actor, next.action, actions);
  }
  throw Error('The native Guild Spiritual-arrival source did not reach its finite boundary');
}
export function allowSemutaSpiritualAmbassadorArrival(game: Game, actions: SemutaSpiritualAmbassadorArrivalStep[] = []): Game {
  assert.ok(game.response?.automaticAdvisorFlip?.producer === 'spiritualArrival');
  for (let count = 0; game.response?.automaticAdvisorFlip?.producer === 'spiritualArrival' && count < game.players.length; count++) {
    const p = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(p);
    game = actSemutaSpiritualAmbassadorArrival(game, p.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.automaticAdvisorFlip?.producer, 'spiritualArrival'); return game;
}
/** Finish only this free child's Guild/outer suffix. The original Atreides
 * combined turn and actual endMovement remain caller-owned. */
export function finishSemutaSpiritualAmbassadorArrival(game: Game, actions: SemutaSpiritualAmbassadorArrivalStep[] = []): Game {
  assert.ok(!game.pendingTreacheryDiscard);
  return advanceSemutaSpiritualAmbassadorArrival(game, state => !state.pendingSpiritualAdvisor &&
    !state.pendingAmbassador && !state.pendingAutomaticAdvisorFlips?.length && !state.pendingArrivalReaction?.length &&
    semutaSpiritualAmbassadorArrivalClean(state), actions);
}

function originalGuildPacket() {
  const original = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = ['guild', ...original.filter(effect => effect !== 'guild').slice(0, 4)];
  const order = [...supply, ...original.filter(effect => !supply.includes(effect))], current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(order[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, order); return { supply, order, scalars };
}
function createOriginalPacket(game: Game, step: SemutaSpiritualAmbassadorArrivalStep,
  actions: SemutaSpiritualAmbassadorArrivalStep[], scalars: number[]) {
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

/** Native original Guild packet, paid entrant, real independent Ecaz reserve
 * and actually placed BG Polar advisor. No played parent or state is installed. */
export function createSemutaSpiritualAmbassadorArrivalFixture() {
  const richese = 'richese', holder = 'choam', ecaz = 'ecaz', owner = 'beneGesserit', entrant = 'atreides', spender = 'emperor';
  const territory = 'polar_sink', sector = 0, location = 'polar_sink:0', guildTerritory = 'tueks_sietch', guildSector = 5, guildLocation = 'tueks_sietch:5';
  let game = createGame('SEMUTASPIRITUALAMBASSADORARRIVAL', newPlayer(richese, 'Richese', 'richese'), true, ['choam', 'ecaz']);
  for (const faction of ['choam', 'ecaz', 'beneGesserit', 'atreides', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaSpiritualAmbassadorArrivalStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaSpiritualAmbassadorArrival(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaSpiritualAmbassadorArrival(game, until, actions); };
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
  const originalInventory = semutaSpiritualAmbassadorArrivalInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' || card.kind === 'poison').slice(0, 5);
  assert.equal(ordinary.length, 5); const selected = [...ordinary, printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(c => c.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card: card.id, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = printed.id, packet = originalGuildPacket();
  let packetCreation: { before: Game; steps: SemutaSpiritualAmbassadorArrivalStep[]; after: Game } | null = null;
  let advisorSetup: { before: Game; steps: SemutaSpiritualAmbassadorArrivalStep[]; after: Game } | null = null;
  for (let count = 0; game.status === 'setup' && count < 180; count++) {
    const next = nextSemutaSpiritualAmbassadorArrival(game); assert.ok(next);
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
  assert.deepEqual(game.players.flatMap(p => p.hand.map(c => c.id)), selected.map(c => c.id));
  assert.deepEqual(game.ecazAmbassadors!.cohort.map(id => game.ecazAmbassadors!.tokens.find(t => t.id === id)!.effect), packet.supply);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaSpiritualAmbassadorArrivalStep | undefined, bidAt = -1;
  for (let count = 0; count < 1000 && !semutaSpiritualAmbassadorArrivalPlayer(game, holder).hand.some(c => c.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaSpiritualAmbassadorArrival(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  reach(state => state.turn === 1 && state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  const token = game.ecazAmbassadors!.tokens.find(t => t.effect === 'guild' && t.zone === 'supply'); assert.ok(token);
  const placement = transition(() => {
    act(ecaz, { type: 'decision', token: token.id, territory: 'carthag' });
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
    act(ecaz, { type: 'decision', decline: true });
  });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === entrant && semutaSpiritualAmbassadorArrivalClean(state));
  let ordinaryDecline: { before: Game; steps: SemutaSpiritualAmbassadorArrivalStep[]; after: Game } | null = null;
  const paidAction: Action = { type: 'ship', territory: 'carthag', sector: 11, amount: 1, elite: 0, allyPayment: 0 };
  const beforeEntrantShipment = structuredClone(game), entrantAt = actions.length;
  act(entrant, paidAction);
  for (let count = 0; !(game.pendingAmbassador?.stage === 'offer' && !game.response && !game.phaseOpening) && count < 100; count++) {
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'advisor' && !game.decision.ambassadorEvent)
      ordinaryDecline = transition(() => { act(owner, { type: 'decision', accept: false }); });
    else { const next = nextSemutaSpiritualAmbassadorArrival(game); assert.ok(next); act(next.actor, next.action); }
  }
  const entrantShipment = { before: beforeEntrantShipment, steps: structuredClone(actions.slice(entrantAt)), after: structuredClone(game) };
  assert.ok(game.pendingAmbassador?.stage === 'offer'); assert.ok(ordinaryDecline);
  const event = game.pendingAmbassador.event;
  const triggerAction: Action = { type: 'decision', event, trigger: true, beneficiary: ecaz };
  const trigger = transition(() => {
    act(ecaz, triggerAction); reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'ship');
  });
  const grantAction: Action = { type: 'decision', event, territory: guildTerritory, sector: guildSector, amount: 1, elite: 0 };
  const grant = transition(() => {
    act(ecaz, grantAction);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'advisor' && state.decision.ambassadorEvent === event);
  });
  assert.equal(semutaSpiritualAmbassadorArrivalPlayer(game, ecaz).forces[guildLocation], 1);
  const chooseAction: Action = { type: 'decision', accept: true, accompany: false, amount: 1 };
  const declaration = transition(() => { act(owner, chooseAction); });
  assert.ok(game.response?.kind === 'advisor' && game.response.spiritualAdvisorSource);
  const shippingResponse = structuredClone(game.response), spiritualSource = structuredClone(game.response.spiritualAdvisorSource);
  const shippingFrame = structuredClone(game.pendingSpiritualAdvisor!);
  const placed = transition(() => {
    for (let count = 0; game.response?.kind === 'advisor' && count < game.players.length; count++) {
      const p = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(p); act(p.id, { type: 'passResponse' });
    }
  });
  assert.ok(game.response?.automaticAdvisorFlip?.producer === 'spiritualArrival');
  const automatic = game.response.automaticAdvisorFlip;
  assert.ok(game.pendingSpiritualAdvisor?.stage === 'arrival' && game.pendingAmbassador?.shipmentReceipt);
  assert.equal(game.pendingAmbassador.shipmentReceipt.next, 'advisor');
  assert.equal(game.pendingSpiritualAdvisor.decision.ambassadorEvent, event);
  assert.equal(semutaSpiritualAmbassadorArrivalPlayer(game, owner).forces[location], 1);
  assert.deepEqual(semutaSpiritualAmbassadorArrivalInventory(game), originalInventory);
  return { game, kind: 'advisorFlip' as const, advanced: true as const, richese, holder, ecaz, owner, entrant, spender,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    originalResponse: structuredClone(game.response), originalSource: spiritualSource, originalSpiritualSource: spiritualSource,
    originalAutomaticSource: structuredClone(automatic), originalFrame: structuredClone(game.pendingSpiritualAdvisor),
    originalQueue: structuredClone(game.pendingAutomaticAdvisorFlips!), originalParent: structuredClone(game.pendingAmbassador),
    originalAmbassador: structuredClone(game.pendingAmbassador), originalReceipt: structuredClone(game.pendingAmbassador.shipmentReceipt),
    originalDeposit: structuredClone(game.pendingSpiritualAdvisor.deposit!),
    originalLocks: structuredClone(semutaSpiritualAmbassadorArrivalPlayer(game, owner).advisors?.[territory]),
    originalStance: structuredClone(semutaSpiritualAmbassadorArrivalPlayer(game, owner).advisors!),
    originalPhysical: structuredClone(semutaSpiritualAmbassadorArrivalPhysical(game)), originalTokens: structuredClone(game.ecazAmbassadors!),
    originalPaidQueue: structuredClone(game.pendingArrivalReaction ?? null), originalDeck: structuredClone(game.deck),
    token: token.id, event, territory, sector, location, guildTerritory, guildSector, guildLocation,
    paidAction, triggerAction, grantAction, chooseAction, shippingResponse, shippingFrame,
    initial, lobby, setup, beforeStartingDeal, afterSetup, packet, packetCreation, advisorSetup,
    dealOrder, deal: selected.map(c => c.id), originalInventory, originalSpice, spiceOrder,
    acquisition, acquired, cache: acquisition, placement, entrantShipment, ordinaryDecline,
    trigger, grant, declaration, placed, actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Original narrow Advanced R/C/Ecaz/BG/A/E Semuta initializer, exact CHOAM+Ecaz and no modules. Original packet draws earn Guild; actual Ecaz Basin6 and BG Arrakeen1 beside A10 setup remain native. C actually buys cache1 Semuta and E is dealt original printed Karama.',
      'Ecaz actually pays1 to place Guild in Carthag. A actually pays1 to enter; BG explicitly declines that earlier ordinary Spiritual opportunity. Ecaz really triggers Guild for itself, consuming the original token before choosing its independent free reserve1 shipment to empty Tuek’s5.',
      'BG then actually chooses free Polar1 from the Guild shipment’s native advisor decision. Real shipping-counter passes withdraw and place an advisor, lock it and open mandatory spiritualArrival. The original Guild receipt remains at advisor with its exact committed order while the free child completes.',
      'No paid hand, wallet, army, stance, token, parent, source/frame, lock, deposit, clock or Semuta window is installed. Stop before the separate printed conversion cost; original native child and outer callbacks remain unchanged.',
    ] };
}
export type SemutaSpiritualAmbassadorArrivalFixture = ReturnType<typeof createSemutaSpiritualAmbassadorArrivalFixture>;
