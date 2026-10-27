import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { baseDeck, spiceDeck } from '../game/cards';
import { createTechTokens } from '../game/tech-tokens';
import type { FactionId } from '../game/catalog';
import { actAdvancedRevivalOrder, nextAdvancedRevivalOrder } from './fixture-advanced-revival-order';

/** Controlled, conserved late-game position. Original strongholds and Tech
 * ownership are directly arranged to expose the rare simultaneous qualifying
 * result. Collection, Mentat and agreement actions use the live engine; this
 * is not an earned ten-turn game or a saved-room test. */
function position(options: { advanced?: boolean; guild?: boolean; fremen?: boolean; choam?: boolean; prediction?: boolean } = {}): Game {
  const g = createGame('EXTENDEDVICTORY', newPlayer('ix', 'Ixians', 'ixians'), options.advanced ?? true, options.choam ? ['choam'] : []);
  const seats: [string, string, FactionId][] = [
    ['at', 'Atreides', 'atreides'], ['em', 'Emperor', 'emperor'], ['bg', 'Bene Gesserit', 'beneGesserit'],
  ];
  if (options.guild) seats.push(['gu', 'Guild', 'guild']);
  if (options.fremen) seats.push(['fr', 'Fremen', 'fremen']);
  if (options.choam) seats.push(['ch', 'CHOAM', 'choam']);
  for (const [id, name, faction] of seats) g.players.push(newPlayer(id, name, faction));
  assert.ok(g.players.length <= 6);
  Object.assign(g, { status: 'playing', phase: 7, turn: 10, storm: 18,
    order: g.players.map(player => player.id), ready: [], phaseOpening: null,
    decision: null, response: null, active: null, deck: baseDeck(), spiceDeck: spiceDeck(),
    mobileStronghold: { location: 'red_chasm:7' }, techTokens: createTechTokens() });
  for (const p of g.players) Object.assign(p, { hand: [], forces: {},
    reserves: 20, spice: 20, traitors: [], traitorChoices: [] });
  const hold = (id: string, ...names: string[]) => {
    const p = g.players.find(player => player.id === id)!;
    for (const name of names) p.forces[`${name}:${territory(name).sectors[0]}`] = 1;
    p.reserves -= names.length;
  };
  g.players[1].ally = 'em'; g.players[2].ally = 'at';
  hold('at', 'arrakeen', 'carthag'); hold('em', 'sietch_tabr');
  hold('ix', 'tueks_sietch', 'habbanya_ridge_sietch');
  g.players[0].forces['hidden_mobile_stronghold:0'] = 1; g.players[0].reserves--;
  for (const token of Object.values(g.techTokens!)) token.owner = 'at';
  if (options.prediction) g.players[3].prediction = { faction: 'atreides', turn: 10 };
  return g;
}

function enterMentat(source: Game): Game {
  let g = structuredClone(source);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  if (g.phase === 7 && g.decision?.kind === 'choamMarket')
    g = applyAction(g, g.decision.player, { type: 'decision', done: true });
  assert.equal(g.phase, 8);
  if (g.players.some(player => player.faction === 'choam')) {
    for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
    if (g.decision?.kind === 'choamMarket')
      g = applyAction(g, g.decision.player, { type: 'decision', done: true });
    assert.equal(g.decision?.kind, 'choamMentat');
    g = applyAction(g, g.decision.player, { type: 'decision', done: true });
  }
  return g;
}
function offer(g: Game) {
  assert.ok(g.victoryContinuation, 'The actual Mentat check offers the qualifying sides a vote');
  return g.victoryContinuation;
}
function vote(g: Game, id: string, mode: 'finish' | 'continue' | 'accept', extra?: number): Game {
  return applyAction(g, id, { type: 'victoryContinuation', event: offer(g).event, mode,
    ...(extra === undefined ? {} : { extra }) });
}
function accept(g: Game, extra = 0): Game {
  const voters = [...offer(g).voters];
  g = vote(g, voters[0], 'continue', extra);
  for (const id of voters.slice(1)) g = vote(g, id, 'accept');
  return g;
}
function finishMentat(g: Game): Game {
  if (g.phase !== 8) return g;
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}
function reject(g: Game, player: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, player, action));
  assert.deepEqual(g, before);
}
function startEleventh(source = position(), extra = 0): Game {
  let g = accept(enterMentat(source), extra);
  assert.equal(g.victoryFinalTurn, 11);
  if (g.phase === 8) g = finishMentat(g);
  assert.equal(g.status, 'playing'); assert.equal(g.turn, 11); assert.equal(g.phase, 0);
  return g;
}

/** Controlled follow-up: retain the actual extended-turn state, but advance
 * its phase/ready boundary directly to Collection. Tests below do not claim a
 * full natural turn from Storm to Collection; all later checks and votes are
 * native engine actions on the labelled board. */
function stagedCollection(source: Game): Game {
  const g = structuredClone(source);
  Object.assign(g, { phase: 7, ready: [], active: null, decision: null, response: null,
    phaseOpening: null, stormPending: null, stormResolution: null });
  return g;
}
function clearForces(g: Game) {
  for (const p of g.players) {
    p.reserves += Object.values(p.forces).reduce((total, amount) => total + amount, 0);
    p.forces = {};
  }
}

void test('unanimous turn-ten agreement opens real turn eleven without replaying the prior board', () => {
  const original = position();
  const opening = enterMentat(original);
  const before = opening.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves }));
  const agreed = accept(opening, 1);
  assert.equal(agreed.turn, 10); assert.equal(agreed.phase, 8);
  assert.equal(agreed.victoryFinalTurn, 11); assert.equal(agreed.victoryExtraStrongholds, 1);
  assert.deepEqual(agreed.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves })), before);
  const next = finishMentat(agreed);
  assert.equal(next.status, 'playing'); assert.equal(next.turn, 11); assert.equal(next.phase, 0);
  assert.equal(next.victoryFinalTurn, 11); assert.equal(viewGame(next, 'ix').turn, 11);
  assert.deepEqual(next.players.map(p => ({ id: p.id, forces: p.forces, reserves: p.reserves })), before);
});

void test('Basic qualifying sides may also agree to play turn eleven', () => {
  const next = startEleventh(position({ advanced: false }));
  assert.equal(next.advanced, false);
  assert.equal(next.victoryFinalTurn, 11);
});

void test('accepted turn eleven follows native phases through its next Mentat check', () => {
  const source = position();
  // The turn-ten public board is controlled as above. Select two existing,
  // unopened ordinary Spice cards to avoid an unrelated worm negotiation;
  // this is not a claim about their naturally shuffled original order.
  const originalSpice = source.spiceDeck.map(card => JSON.stringify(card)).sort();
  const front: Game['spiceDeck'] = [];
  for (let i = 0; i < 2; i++) {
    const index = source.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
    assert.ok(index >= 0);
    front.push(source.spiceDeck.splice(index, 1)[0]);
  }
  source.spiceDeck.unshift(...front);
  assert.deepEqual(source.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let game = startEleventh(source, 1);
  const phases = new Set<number>();
  const actions: { actor: string; action: Action }[] = [];
  for (let count = 0; count < 1500 && game.status === 'playing' && game.phase !== 8; count++) {
    assert.equal(game.turn, 11);
    phases.add(game.phase);
    const next = nextAdvancedRevivalOrder(game);
    assert.ok(next, `Native turn-11 control unavailable at phase ${game.phase}, decision ${game.decision?.kind ?? 'none'}`);
    game = actAdvancedRevivalOrder(game, next.actor, next.action, actions);
  }
  assert.equal(game.turn, 11);
  assert.equal(game.phase, 8, 'The original phase sequence reaches the next Mentat check');
  assert.ok(game.status === 'finished' || game.victoryContinuation,
    'The extended final-turn check settles a winner or offers the next agreement');
  assert.equal(game.victoryFinalTurn, 11);
  assert.ok(actions.length > 0);
  for (const phase of [0, 1, 2, 3, 4, 5, 7])
    assert.ok(phases.has(phase), `Native phase ${phase} was not exercised`);
});

void test('a turn-ten refusal settles the original result and private prediction', () => {
  const g = enterMentat(position({ prediction: true })), pending = offer(g);
  reject(g, 'bg', { type: 'victoryContinuation', event: pending.event, mode: 'finish' });
  const settled = vote(g, pending.voters[0], 'finish');
  assert.equal(settled.status, 'finished'); assert.equal(settled.turn, 10);
  assert.deepEqual(settled.winner, ['bg']); assert.ok(!settled.victoryContinuation);
});

void test('a second unanimous agreement at turn eleven extends the final turn again', () => {
  const controlled = stagedCollection(startEleventh()), opening = enterMentat(controlled);
  assert.equal(opening.turn, 11); assert.equal(offer(opening).turn, 11);
  const agreed = accept(opening);
  assert.equal(agreed.victoryFinalTurn, 12);
  const next = finishMentat(agreed);
  assert.equal(next.status, 'playing'); assert.equal(next.turn, 12); assert.equal(next.phase, 0);
  assert.equal(next.victoryFinalTurn, 12);
});

void test('extended final-turn fallback applies Fremen, Guild and absent-faction outcomes', () => {
  for (const [options, expected] of [
    [{ guild: true, fremen: true }, 'fr'], [{ guild: true }, 'gu'], [{}, 'ix'],
  ] as const) {
    const controlled = stagedCollection(startEleventh(position(options), 1));
    clearForces(controlled);
    // The Atreides-owned Tech set gives it one hold in the no-Guild fallback.
    // Shift that physical set to Ix for an unambiguous highest-count winner.
    for (const token of Object.values(controlled.techTokens!)) token.owner = 'ix';
    const settled = enterMentat(controlled);
    assert.equal(settled.turn, 11); assert.equal(settled.status, 'finished');
    assert.deepEqual(settled.winner, [expected]);
  }
});

void test('a sole qualifying stronghold winner precedes fallback on the extended final turn', () => {
  const controlled = stagedCollection(startEleventh());
  // Controlled conserved removal prevents the alliance from qualifying while
  // leaving the original Ixian three-stronghold group intact.
  const emperor = controlled.players.find(p => p.id === 'em')!;
  emperor.reserves += Object.values(emperor.forces).reduce((sum, count) => sum + count, 0);
  emperor.forces = {};
  const settled = enterMentat(controlled);
  assert.equal(settled.status, 'finished'); assert.deepEqual(settled.winner, ['ix']);
});

void test('CHOAM Mentat continuation advances exactly once from turn ten to eleven', () => {
  const opening = enterMentat(position({ choam: true }));
  assert.equal(offer(opening).resume, 'advance');
  const next = accept(opening, 1);
  assert.equal(next.status, 'playing'); assert.equal(next.turn, 11); assert.equal(next.phase, 0);
  assert.equal(next.victoryFinalTurn, 11); assert.equal(next.victoryExtraStrongholds, 1);
});
