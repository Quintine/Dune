import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { createAmbassadors, validateAmbassadors } from '../game/ecaz-ambassadors';
import { createDukeVidal, DUKE_VIDAL_ID } from '../game/duke-vidal';
import { placeFixtureHand } from './fixture-hand';
import { createAmbassadorRevivalIncomeFixture, actAmbassadorRevivalIncome } from './fixture-ambassador-revival-income';

const player = (g: Game, id = 'ecaz') => g.players.find(p => p.id === id)!;
function allow(g: Game) {
  for (let n = 0; g.response && n < 40; n++)
    g = applyAction(g, g.players.find(p => !g.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  assert.equal(g.response, null); return g;
}
/** Controlled consumer probes; the original-deal programme is separate. */
function fixture(copied = false, kwisatz = false) {
  const g = createGame('AMBINCOMEPROBE', newPlayer('ecaz', 'Ecaz', 'ecaz'), false, ['ecaz', 'ix']);
  g.players.push(newPlayer('entrant', 'Entrant', kwisatz ? 'harkonnen' : 'atreides'), newPlayer('t', 'Tleilaxu', 'tleilaxu'),
    newPlayer('ally', 'Ally', kwisatz ? 'atreides' : 'emperor'));
  Object.assign(g, { status: 'playing', phase: 5, turn: 2, storm: 18, active: 'entrant',
    order: g.players.map(p => p.id), movementRemaining: g.players.map(p => p.id), deck: baseDeck() });
  for (const p of g.players) { p.forces = {}; p.tanks = 3; p.reserves = 17; p.spice = 12; p.hand = []; }
  placeFixtureHand(g, 1, [g.deck.find(c => c.effect === 'karama')!]);
  const state = createAmbassadors(() => 0), effect = copied ? 'beneGesserit' : 'tleilaxu';
  const cohort = [effect, ...state.tokens.map(t => t.effect).filter(e => e !== effect && e !== 'ecaz')].slice(0, 5);
  state.cohort = state.tokens.filter(t => cohort.includes(t.effect)).map(t => t.id);
  for (const t of state.tokens) { t.zone = t.effect === 'ecaz' || state.cohort.includes(t.id) ? 'supply' : 'pool'; t.location = null; }
  const token = state.tokens.find(t => t.effect === effect)!;
  token.zone = 'placed'; token.location = 'arrakeen'; validateAmbassadors(state); g.ecazAmbassadors = state;
  return g;
}
function offer(g: Game, beneficiary = 'ecaz', copied = false) {
  if (beneficiary !== 'ecaz') { player(g).ally = beneficiary; player(g, beneficiary).ally = 'ecaz'; }
  g = allow(applyAction(g, 'entrant', { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 }));
  for (let n = 0; g.decision && ['advisor', 'intrusion'].includes(g.decision.kind) && n < 5; n++)
    g = allow(applyAction(g, g.decision.player, { type: 'decision', accept: false }));
  assert.ok(g.pendingAmbassador, JSON.stringify(g.decision));
  const event = g.pendingAmbassador!.event;
  g = applyAction(g, 'ecaz', { type: 'decision', event, trigger: true, beneficiary, choice: 'effect' });
  if (copied) g = applyAction(g, beneficiary, { type: 'decision', event, effect: 'tleilaxu' });
  assert.equal(g.pendingAmbassador?.stage, 'revival'); return g;
}
const revive = (g: Game, choice: Action = { type: 'decision', forces: 2 }) => applyAction(g,
  g.pendingAmbassador!.beneficiary!, { ...choice, type: 'decision', event: g.pendingAmbassador!.event });
const usage = (g: Game, id = 'ecaz') => {
  const p = player(g, id); return { revived: p.revived, free: p.freeForcesRevived, leader: p.leaderRevived };
};

void test('a positive Ambassador return commits before the one-spice income response and resumes once', () => {
  const offered = offer(fixture()), before = structuredClone(offered), g = revive(offered);
  assert.equal(g.response?.kind, 'revivalIncome'); assert.equal(g.response?.source, 'ambassadorRevival');
  assert.equal(g.response?.owner, 't'); assert.equal(g.response?.recipient, 'ecaz'); assert.equal(g.response?.amount, 1);
  assert.equal(g.pendingAmbassador?.stage, 'income'); assert.equal(g.decision, null);
  assert.equal(player(g).tanks, 1); assert.equal(player(g).reserves, 19);
  assert.equal(player(g).spice, player(before).spice); assert.deepEqual(usage(g), usage(before));
  assert.equal(g.revivalFreeIncome?.ecaz, g.turn); assert.equal(player(g, 't').spice, player(before, 't').spice);
  const done = allow(g);
  assert.equal(player(done, 't').spice, player(before, 't').spice + 1);
  assert.equal(done.pendingAmbassador, null); assert.equal(done.active, 'entrant');
  assert.ok(done.movementRemaining!.includes('entrant')); assert.equal(player(done).reserves, 19);
  assert.throws(() => revive(done));
  const ended = applyAction(done, 'entrant', { type: 'endMovement' });
  assert.equal(ended.movementRemaining!.includes('entrant'), false);
});

void test('canceling Ambassador income consumes Karama but keeps the committed return and spent free entitlement', () => {
  const source = fixture(), card = player(source, 'entrant').hand.find(c => c.effect === 'karama')!;
  const g = revive(offer(source)), balance = player(g, 't').spice;
  const done = applyAction(g, 'entrant', { type: 'card', card: card.id, mode: 'cancel' });
  assert.equal(done.response, null); assert.equal(done.pendingAmbassador, null);
  assert.equal(player(done, 't').spice, balance); assert.equal(player(done).reserves, 19);
  assert.equal(done.revivalFreeIncome?.ecaz, done.turn); assert.equal(done.discard.filter(c => c.id === card.id).length, 1);
  assert.equal(done.active, 'entrant'); assert.ok(done.movementRemaining!.includes('entrant'));
});

void test('countering a BG conversion restores the original income response without repeating revival', () => {
  const source = fixture(); source.advanced = true;
  source.players.push(newPlayer('bg', 'Bene Gesserit', 'beneGesserit'));
  source.order.push('bg'); source.movementRemaining!.push('bg');
  placeFixtureHand(source, 1, [...player(source, 'entrant').hand, source.deck.find(c => c.effect === 'karama')!]);
  const worthless = source.deck.find(c => c.kind === 'worthless')!;
  placeFixtureHand(source, 4, [worthless]);
  const g = revive(offer(source)), balance = player(g, 't').spice;
  const converted = applyAction(g, 'bg', { type: 'card', card: worthless.id, mode: 'cancel' });
  assert.equal(converted.response?.kind, 'worthlessKarama'); assert.equal(converted.pendingAmbassador?.stage, 'income');
  const counter = player(converted, 'entrant').hand.find(c => c.effect === 'karama')!;
  const restored = applyAction(converted, 'entrant', { type: 'card', card: counter.id, mode: 'cancel' });
  assert.equal(restored.response?.source, 'ambassadorRevival');
  assert.deepEqual(restored.pendingAmbassador?.revivalReceipt, g.pendingAmbassador?.revivalReceipt);
  assert.equal(player(restored).reserves, 19);
  const done = allow(restored);
  assert.equal(player(done, 't').spice, balance + 1); assert.equal(player(done).reserves, 19);
  assert.equal(done.pendingAmbassador, null); assert.equal(done.pendingKarama, null);
});

void test('prior ordinary free revival shares the turn entitlement while decline leaves it unused', () => {
  let ordinary = fixture(); ordinary.phase = 4;
  ordinary = allow(applyAction(ordinary, 'ecaz', { type: 'revive', amount: 1 }));
  const income = player(ordinary, 't').spice;
  ordinary.phase = 5;
  const done = revive(offer(ordinary));
  assert.equal(done.response, null); assert.equal(done.pendingAmbassador, null);
  assert.equal(player(done, 't').spice, income); assert.equal(player(done).reserves, 20);
  const declined = revive(offer(fixture()), { type: 'decision', decline: true });
  assert.equal(declined.response, null); assert.equal(declined.pendingAmbassador, null);
  assert.equal(declined.revivalFreeIncome?.ecaz, undefined); assert.equal(player(declined).tanks, 3);
});

for (const kind of ['native', 'duke', 'kwisatz'] as const) void test(`${kind} leader return earns one bank spice for the actual beneficiary`, () => {
  const source = fixture(false, kind === 'kwisatz'); let beneficiary = 'ecaz', leader: string;
  if (kind === 'duke') {
    source.dukeVidal = createDukeVidal(); Object.assign(source.dukeVidal.leader, { dead: true, deaths: 1 }); leader = DUKE_VIDAL_ID;
  } else if (kind === 'kwisatz') {
    beneficiary = 'ally'; const p = player(source, beneficiary);
    source.advanced = true; p.battleLosses = 7; p.kwisatz = { dead: true, revivalCycle: 1 }; leader = 'kwisatz';
  } else {
    beneficiary = 'ally'; const disc = player(source, beneficiary).leaders[0];
    Object.assign(disc, { dead: true, deaths: 1 }); leader = disc.id;
  }
  const g = revive(offer(source, beneficiary), { type: 'decision', leader });
  assert.equal(g.response?.recipient, beneficiary); assert.equal(g.revivalFreeIncome?.[beneficiary], g.turn);
  assert.equal(g.revivalFreeIncome?.ecaz, beneficiary === 'ecaz' ? g.turn : undefined);
  const income = player(g, 't').spice, done = allow(g);
  assert.equal(player(done, 't').spice, income + 1); assert.equal(done.pendingAmbassador, null);
});

void test('BG copied grants and Tleilaxu self-revival use the same beneficiary ledger', () => {
  const copied = revive(offer(fixture(true), 'ally', true));
  assert.equal(copied.response?.recipient, 'ally'); assert.equal(copied.pendingAmbassador?.revivalReceipt?.amount, 1);
  assert.equal(copied.ecazAmbassadors!.tokens.find(t => t.effect === 'beneGesserit')!.zone, 'removed');
  assert.equal(allow(copied).pendingAmbassador, null);
  const self = revive(offer(fixture(), 't')), balance = player(self, 't').spice;
  assert.equal(self.response?.owner, 't'); assert.equal(self.response?.recipient, 't');
  assert.equal(player(allow(self), 't').spice, balance + 1);
});

void test('an actual Ghola before or after the Ambassador retains its separate per-use bank reward', () => {
  for (const gholaFirst of [false, true]) {
    let g = fixture(); const card = g.deck.find(c => c.effect === 'ghola')!;
    placeFixtureHand(g, 0, [card]); const balance = player(g, 't').spice;
    if (gholaFirst) {
      g = allow(applyAction(g, 'ecaz', { type: 'card', card: card.id, amount: 1 }));
      assert.equal(g.revivalFreeIncome?.ecaz, undefined);
    }
    g = allow(revive(offer(g)));
    if (!gholaFirst) g = allow(applyAction(g, 'ecaz', { type: 'card', card: card.id, amount: 1 }));
    assert.equal(player(g, 't').spice, balance + 2); assert.equal(g.revivalFreeIncome?.ecaz, g.turn);
    assert.equal(player(g).tanks, 0); assert.equal(g.discard.filter(c => c.id === card.id).length, 1);
  }
});

void test('income continuation rejects a mismatched parent or amount without replaying physical revival', () => {
  const g = revive(offer(fixture()));
  for (const change of [(copy: Game) => { copy.response!.amount = 2; },
    (copy: Game) => { copy.pendingAmbassador!.event += ':stale'; },
    (copy: Game) => { copy.pendingAmbassador!.revivalReceipt!.returned = { kind: 'forces', amount: 4, elite: 0 }; }]) {
    const bad = structuredClone(g); change(bad); const before = structuredClone(bad);
    assert.throws(() => viewGame(bad, 'ecaz')); assert.throws(() => applyAction(bad, 'entrant', { type: 'passResponse' }));
    assert.deepEqual(bad, before);
  }
});

for (const copied of [false, true]) for (const canceled of [false, true])
  void test(`original Basic ${copied ? 'copied' : 'native'} grant ${canceled ? 'cancels' : 'allows'} bank income after the real Duke return`, () => {
    const f = createAmbassadorRevivalIncomeFixture({ copied }), source = f.game;
    assert.equal(source.advanced, false); assert.deepEqual(source.expansions, ['ecaz', 'ix']);
    assert.equal(f.originalTreachery.length, 47); assert.equal(f.originalSpice.length, 22);
    assert.equal(f.afterDeath.dukeVidal!.leader.dead, true); assert.equal(f.afterDeath.dukeVidal!.leader.deaths, 1);
    assert.ok(f.beforeStartingDeal.players.every(p => p.hand.length === 0));
    assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 5).map(c => c.id), f.deal);
    assert.ok(player(source, f.cancelActor).hand.some(c => c.id === f.cancelCard));
    const balance = player(source, f.incomeOwner).spice, originalUsage = usage(source, f.owner);
    const returned = actAmbassadorRevivalIncome(source, f.owner, { type: 'decision', event: f.event, leader: f.duke });
    assert.equal(returned.dukeVidal!.leader.dead, false); assert.equal(returned.dukeVidal!.controller, null);
    assert.equal(returned.pendingAmbassador?.stage, 'income'); assert.equal(returned.response?.amount, 1);
    assert.equal(returned.response?.source, 'ambassadorRevival'); assert.equal(player(returned, f.incomeOwner).spice, balance);
    const done = canceled ? actAmbassadorRevivalIncome(returned, f.cancelActor,
      { type: 'card', card: f.cancelCard, mode: 'cancel' }) : allow(returned);
    assert.equal(done.response, null); assert.equal(done.pendingAmbassador, null);
    assert.equal(player(done, f.incomeOwner).spice, balance + (canceled ? 0 : 1));
    assert.deepEqual(usage(done, f.owner), originalUsage); assert.equal(done.revivalFreeIncome?.[f.owner], source.turn);
    assert.equal(done.dukeVidal!.leader.dead, false); assert.equal(done.dukeVidal!.leader.deaths, 1);
    assert.equal(done.dukeVidal!.controller, null); assert.equal(player(done, f.owner).leaders.length, 5);
    assert.equal(done.active, f.entrant); assert.ok(done.movementRemaining!.includes(f.entrant));
    assert.equal(done.discard.some(c => c.id === f.cancelCard), canceled);
    const ended = actAmbassadorRevivalIncome(done, f.entrantContinuation.actor, f.entrantContinuation.action);
    assert.equal(ended.movementRemaining?.includes(f.entrant) ?? false, false);
  });
