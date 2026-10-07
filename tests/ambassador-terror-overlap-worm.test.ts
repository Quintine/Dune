import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import { createTerrorState, placeTerror, type TerrorKind } from '../game/moritani-terror';
import { botArrivalBlock } from '../game/bot-arrival';
import { botActions } from '../game/bots';

const seat = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const action = (g: Game, id: string, a: Action) => applyAction(reload(g), id, a);

/** Classic Ecaz/Moritani table where Moritani precedes Ecaz in storm order. */
function table(kind: TerrorKind, order: string[] = ['m', 'ec', 'in']) {
  const g = createGame('OVERLAPWORM', newPlayer('ec', 'Ecaz', 'ecaz'), true, ['ecaz']);
  g.players.push(newPlayer('m', 'Moritani', 'moritani'), newPlayer('in', 'Rider', 'fremen'));
  Object.assign(g, {
    status: 'playing', phase: 1, turn: 3, storm: 18, active: null, order,
    deck: baseDeck(),
  });
  g.movementRemaining = ['in', 'm', 'ec'];
  for (const player of g.players)
    Object.assign(player, { hand: [], spice: 20, forces: {}, reserves: 20 });
  seat(g, 'in').forces = { 'imperial_basin:10': 3, 'hagga_basin:12': 1 };
  seat(g, 'in').reserves = 16;
  const ambassadors = createAmbassadors(() => 0.2);
  const emperor = ambassadors.tokens.find((token) => token.effect === 'emperor')!;
  ambassadors.cohort = [emperor.id, ...ambassadors.tokens
    .filter((token) => token.effect !== 'ecaz' && token.id !== emperor.id)
    .slice(0, 4).map((token) => token.id)];
  for (const token of ambassadors.tokens) {
    token.zone = token.effect === 'ecaz' || ambassadors.cohort.includes(token.id)
      ? 'supply' : 'pool';
    token.location = null;
  }
  g.ecazAmbassadors = placeAmbassador(ambassadors, emperor.id, {
    turn: 2, availableSpice: 20,
    destination: { id: 'arrakeen', stronghold: true, inStorm: false, allowed: true },
  }).state;
  const terror = createTerrorState(() => 0.2);
  const token = terror.tokens.find((candidate) => candidate.kind === kind)!;
  g.moritaniTerror = placeTerror(terror, token.id, 'arrakeen', 1);
  return { g, terror: token.id };
}
const ride: Action = {
  type: 'decision', accept: true, territory: 'arrakeen', sector: 10,
  forces: { 'imperial_basin:10': 2 },
};
/** A Fremen ride into the stronghold, leaving a queued second ride behind it. */
function wormRide(g: Game) {
  const state = reload(g);
  state.decision = { kind: 'wormRide', player: 'in', territory: 'imperial_basin' };
  state.wormRides = ['hagga_basin'];
  return applyAction(state, 'in', ride);
}
function ready(state: Game) {
  let g = state;
  for (const player of state.players)
    if (!g.ready.includes(player.id)) g = action(g, player.id, { type: 'ready' });
  return g;
}
const queuedRide = { kind: 'wormRide', player: 'in', territory: 'hagga_basin' } as const;

void test('Terror first keeps Robbery overflow custody and the ordered arrival intact', () => {
  const { g, terror } = table('robbery');
  seat(g, 'm').hand = g.deck.splice(0, 4);
  const offered = wormRide(g);
  assert.equal(offered.pendingArrivalOverlap?.resume, 'wormRide');
  assert.equal(offered.pendingArrivalOverlap?.cause, 'wormRide');
  assert.equal(offered.pendingArrivalOverlap?.first, 'terror');
  assert.equal(offered.pendingArrivalOverlap?.stage, 'first');
  assert.equal(offered.pendingTerrorEntry?.cause, 'wormRide');
  assert.equal(offered.pendingTerrorEntry?.resume, 'none');
  assert.deepEqual(offered.wormRides, ['hagga_basin']);
  assert.equal(seat(offered, 'in').forces['arrakeen:10'], 2);
  const beforeDraw = seat(offered, 'm').hand.map((card) => card.id);
  let state = action(offered, 'm', { type: 'decision', reveal: true });
  assert.equal(state.pendingTerrorEntry?.stage, 'robbery');
  state = action(state, 'm', { type: 'decision', choice: 'card' });
  assert.equal(state.pendingTerrorEntry?.stage, 'discard');
  state = action(state, 'm', { type: 'decision', card: seat(state, 'm').hand[0].id });
  assert.equal(state.pendingTerrorEntry, null);
  assert.equal(state.pendingArrivalOverlap?.stage, 'second');
  assert.equal(state.decision?.kind, 'ecazAmbassador');
  assert.equal(seat(state, 'm').hand.length, 4);
  assert.equal(state.discard.filter((card) => beforeDraw.includes(card.id)).length, 1);
  assert.equal(state.moritaniTerror!.tokens.find((token) => token.id === terror)!.status, 'removed');
  state = action(state, 'ec', {
    type: 'decision', event: state.pendingAmbassador!.event, decline: true,
  });
  assert.equal(state.pendingArrivalOverlap ?? null, null);
  assert.deepEqual(state.decision, queuedRide);
  assert.deepEqual(state.wormRides, []);
  assert.equal(seat(state, 'in').forces['arrakeen:10'], 2);
  assert.equal(seat(state, 'in').forces['imperial_basin:10'], 1);
});

void test('Ambassador first lets the second Terror discard, gift once and resume the ride', () => {
  const { g, terror } = table('sabotage', ['ec', 'm', 'in']);
  seat(g, 'in').hand = g.deck.splice(0, 1);
  seat(g, 'm').hand = g.deck.splice(0, 1);
  const offered = wormRide(g);
  assert.equal(offered.pendingArrivalOverlap?.first, 'ambassador');
  assert.equal(offered.decision?.kind, 'ecazAmbassador');
  let state = action(offered, 'ec', {
    type: 'decision', event: offered.pendingAmbassador!.event, decline: true,
  });
  assert.equal(state.pendingArrivalOverlap?.stage, 'second');
  assert.equal(state.decision?.kind, 'moritaniTerror');
  assert.equal(state.pendingTerrorEntry?.cause, 'wormRide');
  assert.equal(state.pendingTerrorEntry?.resume, 'none');
  state = action(state, 'm', { type: 'decision', reveal: true });
  assert.equal(state.pendingTerrorEntry?.stage, 'gift');
  state = action(state, 'm', { type: 'decision', decline: true });
  assert.equal(state.pendingTerrorEntry, null);
  assert.equal(state.pendingArrivalOverlap ?? null, null);
  assert.equal(state.moritaniTerror!.tokens.find((token) => token.id === terror)!.status, 'removed');
  assert.deepEqual(state.decision, queuedRide);
  assert.equal(seat(state, 'in').forces['imperial_basin:10'], 1);
  assert.equal(seat(state, 'in').forces['arrakeen:10'], 2);
  const ended = action(state, 'in', { type: 'decision', accept: false });
  assert.deepEqual(ended.wormRides, []);
  assert.equal(ended.pendingArrivalOverlap ?? null, null);
  assert.equal(ended.pendingTerrorEntry ?? null, null);
  assert.equal(ended.decision ?? null, null);
  assert.equal(seat(ended, 'in').forces['arrakeen:10'], 2);
});

void test('a summoned worm during the overlap opens its Nexus before the queued ride', () => {
  const { g } = table('robbery');
  const karama = g.deck.find((card) => card.effect === 'karama')!;
  g.deck = g.deck.filter((card) => card.id !== karama.id);
  seat(g, 'in').hand = [karama];
  const offered = wormRide(g);
  assert.equal(offered.pendingArrivalOverlap?.resume, 'wormRide');
  assert.equal(offered.decision?.kind, 'moritaniTerror');
  // The summoned worm has nobody to devour on the Great Flat, so it resolves at once.
  let state = action(offered, 'in', {
    type: 'card', mode: 'special', card: karama.id, territory: 'the_great_flat',
  });
  assert.equal(state.summonedWorm ?? null, null);
  assert.equal(state.summonedNexusBeforeRides, true);
  assert.equal(state.pendingArrivalOverlap?.resume, 'wormRide');
  assert.equal(state.decision?.kind, 'moritaniTerror');
  assert.equal(state.discard.filter((card) => card.id === karama.id).length, 1);
  assert.equal(seat(state, 'in').specialKaramaUsed, true);
  state = action(state, 'm', { type: 'decision', reveal: true });
  state = action(state, 'm', { type: 'decision', choice: 'spice' });
  assert.equal(state.pendingTerrorEntry, null);
  assert.equal(state.decision?.kind, 'ecazAmbassador');
  state = action(state, 'ec', {
    type: 'decision', event: state.pendingAmbassador!.event, decline: true,
  });
  assert.equal(state.nexus, true);
  assert.deepEqual(state.wormRides, ['hagga_basin']);
  assert.equal(state.decision, null, 'the Nexus must precede the queued ride');
  assert.equal(state.pendingArrivalOverlap ?? null, null);
  state = ready(state);
  assert.equal(state.nexus, true, 'the Nexus follows the summoned spice blow');
  assert.deepEqual(state.wormRides, ['hagga_basin']);
  assert.equal(state.decision ?? null, null);
  assert.equal(state.pendingTerrorEntry ?? null, null);
  assert.equal(seat(state, 'in').forces['imperial_basin:10'], 1);
});

void test('bots treat the supported overlapping stronghold as a legal ordinary arrival', () => {
  const { g } = table('robbery');
  Object.assign(g, { phase: 5, active: 'in' });
  const mover = seat(g, 'in');
  Object.assign(mover, { shipped: true, forces: { 'imperial_basin:10': 2 }, reserves: 18 });
  const move: Action = {
    type: 'move', from: 'imperial_basin:10', territory: 'arrakeen', sector: 10, amount: 2,
  };
  const view = viewGame(g, 'in');
  assert.equal(view.arrivalOverlapMode, true);
  assert.equal(botArrivalBlock(view, move), null);
  assert.equal(botArrivalBlock({ ...view, arrivalOverlapMode: false }, move),
    'Ambassadors combined with another arrival reaction are still being implemented. This entry has not been committed.');
  const entered = applyAction(reload(g), 'in', move);
  assert.equal(entered.pendingArrivalOverlap?.cause, 'movement');
  assert.equal(entered.pendingArrivalOverlap?.first, 'terror');
  assert.equal(entered.pendingArrivalOverlap?.ecaz, 'ec');
  assert.equal(entered.pendingArrivalOverlap?.moritani, 'm');
  assert.equal(entered.pendingTerrorEntry?.cause, 'movement');
  assert.equal(entered.pendingTerrorEntry?.resume, 'none');
  assert.equal(seat(entered, 'in').forces['arrakeen:10'], 2);
});

void test('worm-riding bots treat the Terror arrival beside a pending BG intrusion as a legal deferred entry', () => {
  const { g } = table('robbery');
  g.ecazAmbassadors = createAmbassadors(() => 0.2);
  const bg = newPlayer('bg', 'Bene Gesserit', 'beneGesserit');
  bg.forces = { 'arrakeen:10': 1 };
  bg.reserves = 19;
  g.players.push(bg);
  g.order.push(bg.id);
  g.movementRemaining!.push(bg.id);
  g.decision = { kind: 'wormRide', player: 'in', territory: 'imperial_basin' };
  g.wormRides = ['hagga_basin'];
  const before = JSON.stringify(g);
  // The ride commits; the BG fighter intrusion owns the pending interaction, so the
  // Terror entry is deferred in `pendingArrivalReaction` instead of being rejected.
  const entered = action(g, 'in', ride);
  assert.deepEqual(entered.decision, {
    kind: 'intrusion', player: 'bg', territory: 'arrakeen', wormRide: true,
  });
  assert.equal(entered.pendingTerrorEntry ?? null, null);
  assert.equal(entered.pendingArrivalReaction?.[0]?.cause, 'wormRide');
  assert.equal(entered.pendingArrivalReaction?.[0]?.entrant, 'in');
  assert.equal(entered.pendingArrivalReaction?.[0]?.territory, 'arrakeen');
  assert.equal(entered.pendingArrivalReaction?.[0]?.sector, 10);
  assert.equal(entered.pendingArrivalReaction?.[0]?.amount, 2);
  assert.equal(entered.pendingArrivalReaction?.[0]?.resume, 'wormRide');
  assert.deepEqual(entered.wormRides, ['hagga_basin']);
  assert.equal(seat(entered, 'in').forces['arrakeen:10'], 2);
  assert.equal(seat(entered, 'in').forces['imperial_basin:10'], 1);
  for (const bot of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(g, 'in');
    view.players.find(p => p.id === 'in')!.bot = bot;
    assert.equal(botArrivalBlock(view, ride), null);
    const choices = botActions(view);
    assert.ok(choices.length, bot);
    // The formerly rejected stronghold ride is now a legal choice bots offer.
    assert.ok(choices.some(choice => choice.type === 'decision' &&
      choice.accept === true && choice.territory === 'arrakeen'), bot);
    assert.ok(applyAction(g, 'in', choices[0]));
  }
  assert.equal(JSON.stringify(g), before);
  // Answering the intrusion and the queued ride settles the deferral: the Terror
  // entry now opens from the stored arrival reaction.
  let state = action(g, 'in', ride);
  state = action(state, 'bg', { type: 'decision', accept: false });
  assert.deepEqual(state.decision, queuedRide);
  assert.equal(state.pendingArrivalReaction?.[0]?.cause, 'wormRide');
  assert.equal(state.pendingTerrorEntry ?? null, null);
  state = action(state, 'in', { type: 'decision', accept: false });
  assert.equal(state.pendingArrivalReaction ?? null, null);
  assert.equal(state.pendingTerrorEntry?.cause, 'wormRide');
  assert.equal(state.pendingTerrorEntry?.resume, 'wormRide');
  assert.equal(state.pendingTerrorEntry?.stage, 'offer');
  assert.equal(state.decision?.kind, 'moritaniTerror');
  assert.match(state.log.at(-1)!.text,
    /Moritani may reveal a Terror token after Rider entered Arrakeen/);
  assert.equal(seat(state, 'in').forces['arrakeen:10'], 2);
});
