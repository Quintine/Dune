import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { AMBASSADOR_EFFECTS, type AmbassadorEffect } from '../game/ecaz-ambassadors';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type SpiritualAdvisorFlowStep = { actor: string; action: Action };
export type SpiritualAdvisorFlowTransition = { before: Game; steps: SpiritualAdvisorFlowStep[]; after: Game };
export type SpiritualAdvisorFlowStance = 'fighters' | 'advisors' | 'polarFighters';
export const actSpiritualAdvisorFlow = actAdvisorPreparation;
export const spiritualAdvisorFlowPlayer = advisorPreparationPlayer;
export const spiritualAdvisorFlowInventory = advisorPreparationInventory;
export const spiritualAdvisorFlowClean = advisorPreparationClean;

/** The original Spiritual decision, Intrusion and every advisorFlip remain
 * owned choices. Source construction explicitly handles its original Intrusion. */
export function nextSpiritualAdvisorFlow(game: Game): SpiritualAdvisorFlowStep | null {
  if (game.response?.kind === 'advisorFlip') return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    const ecaz = game.players.find(player => player.faction === 'ecaz');
    if (game.status === 'setup' && game.setupStage === 'forces' && ecaz?.reserves === 20)
      return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:10': 6 } } };
    const decision = game.decision;
    if (decision?.kind === 'advisor' || decision?.kind === 'intrusion' ||
        decision?.kind === 'ecazAmbassador' || decision?.kind === 'ecazPlacement') return null;
    if (decision?.kind === 'advisorBattle')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceSpiritualAdvisorFlow(game: Game, until: (state: Game) => boolean,
  steps: SpiritualAdvisorFlowStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original Spiritual chronology ended before its requested boundary');
    const next = nextSpiritualAdvisorFlow(game);
    assert.ok(next, `Choose the original Spiritual/Intrusion/Ambassador response at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSpiritualAdvisorFlow(game, next.actor, next.action, steps);
  }
  throw Error('The native Spiritual Advisor source did not reach its finite boundary');
}
/** Ordinary shipping responses may finish, but matching/automatic conversion
 * always stays caller-owned, including after the original free-shipping counter. */
export function passSpiritualAdvisorFlow(game: Game, steps: SpiritualAdvisorFlowStep[] = []): Game {
  for (let count = 0; game.response && game.response.kind !== 'advisorFlip' && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSpiritualAdvisorFlow(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response || game.response.kind === 'advisorFlip'); return game;
}
function originalGuildPacket() {
  const original = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const supply: Exclude<AmbassadorEffect, 'ecaz'>[] = ['guild', ...original.filter(effect => effect !== 'guild').slice(0, 4)];
  const order = [...supply, ...original.filter(effect => !supply.includes(effect))];
  const current = [...original], scalars: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const from = current.indexOf(order[index]); assert.ok(from >= 0 && from <= index);
    scalars.push(Math.floor((from + 0.5) * 4294967296 / (index + 1)));
    [current[index], current[from]] = [current[from], current[index]];
  }
  assert.deepEqual(current, order); assert.equal(scalars.length, 9); return { supply, order, scalars };
}
function createOriginalPacket(game: Game, step: SpiritualAdvisorFlowStep,
  steps: SpiritualAdvisorFlowStep[], scalars: number[]): Game {
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
    assert.equal(cursor, scalars.length, 'Only the original Ecaz packet consumes its nine selected draws');
    steps.push(structuredClone(step)); return next;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Actual Advanced public setup/shipments and actual Intrusion choices, stopped
 * before the separate free Spiritual Advisor choice. Foreign forces and costs
 * are already committed; BG has not yet declared its accompanying/sink counter. */
export function createSpiritualAdvisorFlowFixture(options: {
  parent?: 'ordinary' | 'ambassador'; stance?: SpiritualAdvisorFlowStance;
} = {}) {
  const parent = options.parent ?? 'ordinary', stance = options.stance ?? 'fighters';
  const bg = 'beneGesserit', holder = 'atreides', other = parent === 'ambassador' ? 'ecaz' : 'emperor';
  const foreignDestination = stance === 'polarFighters' ? 'polar_sink' : 'tueks_sietch';
  const sector = stance === 'polarFighters' ? 0 : 5, location = `${foreignDestination}:${sector}`;
  let game = createGame('SPIRITUALADVISORFLOW', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true,
    parent === 'ambassador' ? ['ecaz'] : []);
  if (parent === 'ambassador') {
    joinGame(game, newPlayer(other, 'Ecaz', 'ecaz')); joinGame(game, newPlayer(holder, 'Atreides', 'atreides'));
  } else {
    joinGame(game, newPlayer(holder, 'Atreides', 'atreides')); joinGame(game, newPlayer(other, 'Emperor', 'emperor'));
  }
  const initial = structuredClone(game), steps: SpiritualAdvisorFlowStep[] = [];
  const act = (actor: string, action: Action) => { game = actSpiritualAdvisorFlow(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSpiritualAdvisorFlow(game, until, steps); };
  const transition = (run: () => void): SpiritualAdvisorFlowTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true);
  assert.deepEqual(game.expansions, parent === 'ambassador' ? ['ecaz'] : []);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = spiritualAdvisorFlowInventory(game); assert.equal(originalInventory.length, 33);
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = parent === 'ambassador' ? [ordinary[0], ordinary[1], karama] : [ordinary[0], karama, ordinary[1]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game), packet = parent === 'ambassador' ? originalGuildPacket() : null;
  let packetCreation: SpiritualAdvisorFlowTransition | null = null;
  let advisorSetup: SpiritualAdvisorFlowTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextSpiritualAdvisorFlow(game); assert.ok(next);
    if (next.action.type === 'advisorSetup') next.action = { type: 'advisorSetup', territory: foreignDestination, sector };
    const before = structuredClone(game), start = steps.length;
    const createsPacket = packet && game.setupStage === 'traitors' && next.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length).length === 1;
    game = createsPacket ? createOriginalPacket(game, next, steps, packet!.scalars)
      : actSpiritualAdvisorFlow(game, next.actor, next.action, steps);
    const record = { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
    if (createsPacket) packetCreation = record;
    if (next.action.type === 'advisorSetup') advisorSetup = record;
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(spiritualAdvisorFlowPlayer(game, bg).forces[location], 1);
  assert.ok(!spiritualAdvisorFlowPlayer(game, bg).advisors?.[foreignDestination]);
  if (packet) {
    assert.ok(packetCreation);
    assert.deepEqual(game.ecazAmbassadors!.cohort.map(id => game.ecazAmbassadors!.tokens.find(token => token.id === id)!.effect), packet.supply);
  }
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let placement: SpiritualAdvisorFlowTransition | null = null;
  let token: string | null = null;
  if (parent === 'ambassador') {
    reach(state => state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
    const guild = game.ecazAmbassadors!.tokens.find(candidate => candidate.effect === 'guild')!; token = guild.id;
    assert.equal(guild.zone, 'supply');
    placement = transition(() => {
      act(other, { type: 'decision', token: guild.id, territory: 'carthag' });
      game = passSpiritualAdvisorFlow(game, steps);
    });
    assert.equal(spiritualAdvisorFlowPlayer(placement.before, other).spice - spiritualAdvisorFlowPlayer(game, other).spice, 1);
    act(other, { type: 'decision', decline: true });
  }
  reach(state => state.phase === 5 && state.active === bg && spiritualAdvisorFlowClean(state));
  const bgEnd = transition(() => {
    act(bg, { type: 'endMovement' });
    reach(state => state.phase === 5 && state.active === holder && spiritualAdvisorFlowClean(state));
  });
  let paidEntry: SpiritualAdvisorFlowTransition | null = null;
  let offer: Game | null = null, trigger: SpiritualAdvisorFlowTransition | null = null;
  let event: string | null = null;
  if (parent === 'ambassador') {
    paidEntry = transition(() => {
      act(holder, { type: 'ship', territory: 'carthag', sector: 11, amount: 1, elite: 0, allyPayment: 0 });
      for (let count = 0; !(game.pendingAmbassador?.stage === 'offer' && !game.response && !game.phaseOpening) && count < 150; count++) {
        if (!game.response && !game.phaseOpening && game.decision?.kind === 'advisor')
          act(bg, { type: 'decision', accept: false });
        else {
          const next = nextSpiritualAdvisorFlow(game); assert.ok(next, 'Finish only the actual earlier Carthag entry');
          act(next.actor, next.action);
        }
      }
      assert.equal(game.pendingAmbassador?.stage, 'offer');
    });
    assert.equal(spiritualAdvisorFlowPlayer(paidEntry.before, holder).spice - spiritualAdvisorFlowPlayer(game, holder).spice, 1);
    offer = structuredClone(game); event = game.pendingAmbassador!.event;
    trigger = transition(() => {
      act(other, { type: 'decision', event, trigger: true, beneficiary: other });
      reach(state => !state.response && !state.phaseOpening && state.pendingAmbassador?.stage === 'ship');
    });
  }
  const shipper = parent === 'ordinary' ? holder : other;
  const foreignShipmentAction: Action = parent === 'ordinary'
    ? { type: 'ship', territory: foreignDestination, sector, amount: 1, elite: 0, allyPayment: 0 }
    : { type: 'decision', event, territory: foreignDestination, sector, amount: 1, elite: 0 };
  const foreignShipment = transition(() => {
    act(shipper, foreignShipmentAction);
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'intrusion');
  });
  const beforeIntrusion = structuredClone(game);
  const intrusion = transition(() => {
    act(bg, { type: 'decision', accept: stance === 'advisors' });
    if (stance === 'advisors') {
      for (let count = 0; game.response && count < 60; count++) {
        assert.equal(game.response.kind, 'advisorFlip'); assert.equal(game.response.advisors, true);
        assert.ok(!game.response.automaticAdvisorFlip, 'Only the identified original Intrusion response is allowed here');
        const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
        act(actor.id, { type: 'passResponse' });
      }
    }
    reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'advisor');
  });
  assert.ok(game.decision?.kind === 'advisor'); assert.equal(game.decision.player, bg);
  assert.equal(game.decision.shipment, shipper); assert.equal(game.decision.destination, location);
  assert.equal(game.decision.ambassadorEvent ?? null, event);
  assert.equal(spiritualAdvisorFlowPlayer(game, bg).forces[location], 1);
  assert.equal(!!spiritualAdvisorFlowPlayer(game, bg).advisors?.[foreignDestination], stance === 'advisors');
  assert.equal(spiritualAdvisorFlowPlayer(game, shipper).forces[location], 1);
  const foreignCost = spiritualAdvisorFlowPlayer(foreignShipment.before, shipper).spice - spiritualAdvisorFlowPlayer(game, shipper).spice;
  assert.equal(foreignCost, parent === 'ambassador' ? 0 : foreignDestination === 'polar_sink' ? 2 : 1);
  if (parent === 'ordinary') assert.equal(spiritualAdvisorFlowPlayer(game, shipper).shipped, true);
  else assert.equal(spiritualAdvisorFlowPlayer(game, shipper).shipped, spiritualAdvisorFlowPlayer(foreignShipment.before, shipper).shipped);
  const paidShipmentAction = paidEntry?.steps.find(step => step.action.type === 'ship')?.action ?? foreignShipmentAction;
  const entryCost = paidEntry ? spiritualAdvisorFlowPlayer(paidEntry.before, holder).spice -
    spiritualAdvisorFlowPlayer(paidEntry.after, holder).spice : foreignCost;
  const placementCost = placement ? spiritualAdvisorFlowPlayer(placement.before, other).spice -
    spiritualAdvisorFlowPlayer(placement.after, other).spice : 0;
  assert.ok(spiritualAdvisorFlowPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(spiritualAdvisorFlowInventory(game), originalInventory);
  const accompany: Action = { type: 'decision', accept: true, accompany: true, amount: 1 };
  const sink: Action = { type: 'decision', accept: true, accompany: false, amount: 1 };
  const decline: Action = { type: 'decision', accept: false };
  return { game, source: structuredClone(game), beforeDecision: structuredClone(game), initial, lobby, setup,
    beforeStartingDeal, afterSetup, advisorSetup, packet, packetCreation, placement, token,
    bgEnd, paidEntry, offer, trigger, foreignShipment, beforeIntrusion, intrusion,
    parent, stance, bg, owner: bg, holder, atreides: holder, other,
    ecaz: parent === 'ambassador' ? other : null, emperor: parent === 'ordinary' ? other : null,
    karama: karama.id, card: karama.id, shipper, actor: bg, foreignDestination, territory: foreignDestination,
    location, foreignLocation: location, sector, foreignCost, cost: foreignCost, entryCost, placementCost,
    foreignReservesBefore: spiritualAdvisorFlowPlayer(foreignShipment.before, shipper).reserves,
    foreignReservesAfter: spiritualAdvisorFlowPlayer(game, shipper).reserves,
    event, parentEvent: event, order: structuredClone(game.pendingAmbassador?.shipmentReceipt?.order ?? null),
    parentEntry: structuredClone(game.pendingAmbassador ?? null),
    paidShipmentAction, foreignShipmentAction, childShipmentAction: parent === 'ambassador' ? foreignShipmentAction : null,
    foreignShipmentStep: { actor: shipper, action: foreignShipmentAction } satisfies SpiritualAdvisorFlowStep,
    accompany, accompanyAction: accompany, accept: accompany, action: accompany,
    sink, sinkAction: sink, decline, declineAction: decline,
    steps, actions: steps, sourceActionCount: steps.length, originalInventory, originalSpice, dealOrder, spiceOrder,
    staging: [
      parent === 'ordinary'
        ? 'Actual public Advanced BG/Atreides/Emperor ready/startPreview, original base33 and no optional module.'
        : 'Actual public Advanced BG/Ecaz/Atreides ready/startPreview, bare E3/base33 and no optional module. Exactly nine original Ecaz packet draws on the last real Traitor choice earn Guild in the original cohort.',
      'Native prediction, private Traitors and actual advisorSetup place BG’s original counter in empty Tuek’s5 or Polar0, which native setup normally makes a fighter. Only three original unopened Treachery positions and two ordinary Spice positions are selected; Atreides actually receives its original printed Karama.',
      'Actually complete safe first Storm, dual Spice, Charity, Bidding and Revival. BG’s real movement turn ends without moving the resident group. No played hand, force, wallet, phase, stance, prevention or receipt is installed.',
      parent === 'ordinary'
        ? 'Atreides really pays one for a reserve shipment to Tuek’s5, or two to Polar0. That original foreign shipment has physically committed before the separate free Spiritual Advisors decision.'
        : 'Ecaz actually pays one to place its original Guild token at Carthag. Atreides actually pays one to enter, and BG declines that earlier ordinary accompaniment. Ecaz really triggers Guild for itself, then sends one actual reserve free to the target through the original child shipment; its physical order/receipt remains native.',
      stance === 'advisors'
        ? 'BG actually accepts the resulting Intrusion and every original advisorFlip response allows the fighter→advisor change. Stop before the later independent Spiritual Advisors choice.'
        : 'BG actually declines the original Intrusion, retaining the original resident fighter, including in the Polar variant. Stop before the later independent Spiritual Advisors choice.',
      'Accompany, Polar Sink and decline payloads remain caller-owned. Matching, original free-shipping counter, reserve transfer, automatic alone conversion and parent resumption are not preinstalled or silently selected.',
    ] };
}
export type SpiritualAdvisorFlowFixture = ReturnType<typeof createSpiritualAdvisorFlowFixture>;

/** Submit only the owned free-shipping choice; do not answer later counters. */
export function commitSpiritualAdvisorFlow(source: Game, fixture: SpiritualAdvisorFlowFixture,
  choice: 'accompany' | 'sink' | 'decline' = 'accompany', steps: SpiritualAdvisorFlowStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  const game = actSpiritualAdvisorFlow(source, fixture.bg, fixture[choice], steps);
  return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)) };
}
/** After explicit owned counters, finish only the original shipment parent. */
export function finishSpiritualAdvisorFlow(source: Game, steps: SpiritualAdvisorFlowStep[] = []): Game {
  return advanceSpiritualAdvisorFlow(source,
    game => !game.pendingAmbassador && spiritualAdvisorFlowClean(game), steps);
}
