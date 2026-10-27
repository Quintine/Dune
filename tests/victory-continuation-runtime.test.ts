import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createTechTokens } from '../game/tech-tokens';

/** Controlled late-game board: original public strongholds and Tech tokens are
 * placed directly to reach the rare simultaneous qualified result. Actions
 * from Collection to Mentat, each vote, and the subsequent phase are native.
 * This is not a naturally completed game or saved-room/deployment proof. */
function position(options: { advanced?: boolean; turn?: number; choam?: boolean; onlyAlliance?: boolean; prediction?: boolean } = {}): Game {
  const { advanced = true, turn = 2, choam = false, onlyAlliance = false, prediction = false } = options;
  const g = createGame('VICTORYVOTE', newPlayer('ix', 'Ixians', 'ixians'), advanced, choam ? ['choam'] : []);
  g.players.push(newPlayer('at', 'Atreides', 'atreides'));
  g.players.push(newPlayer('em', 'Emperor', 'emperor'));
  g.players.push(newPlayer('bg', 'Bene Gesserit', 'beneGesserit'));
  if (choam) g.players.push(newPlayer('ch', 'CHOAM', 'choam'));
  Object.assign(g, { status: 'playing', phase: 7, turn, storm: 18,
    order: g.players.map(p => p.id), ready: [], phaseOpening: null,
    deck: baseDeck(), active: null, mobileStronghold: { location: 'red_chasm:7' },
    techTokens: createTechTokens() });
  for (const p of g.players) Object.assign(p, { hand: [], forces: {},
    reserves: 20, spice: 20, traitors: [], traitorChoices: [] });
  const holds = (id: string, ...names: string[]) => {
    const p = g.players.find(row => row.id === id)!;
    p.forces = Object.fromEntries(names.map(name => [`${name}:${territory(name).sectors[0]}`, 1]));
    p.reserves -= names.length;
  };
  g.players[1].ally = 'em'; g.players[2].ally = 'at';
  holds('at', 'arrakeen', 'carthag');
  holds('em', 'sietch_tabr');
  for (const token of Object.values(g.techTokens!)) token.owner = 'at';
  if (!onlyAlliance) {
    holds('ix', 'tueks_sietch', 'habbanya_ridge_sietch');
    g.players[0].forces['hidden_mobile_stronghold:0'] = 1;
    g.players[0].reserves -= 1;
  }
  if (prediction) g.players[3].prediction = { faction: 'atreides', turn };
  return g;
}
function reachMentat(game: Game): Game {
  let g = structuredClone(game);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  if (g.phase === 7 && g.decision?.kind === 'choamMarket')
    g = applyAction(g, g.decision.player, { type: 'decision', done: true });
  return g;
}
function offer(game: Game): NonNullable<Game['victoryContinuation']> {
  const pending = game.victoryContinuation;
  assert.ok(pending, 'The original Collection and Mentat transition offers a public agreement');
  return pending;
}
function act(game: Game, player: string, mode: 'finish' | 'continue' | 'accept', extra?: number): Game {
  const pending = offer(game);
  return applyAction(game, player, { type: 'victoryContinuation', event: pending.event, mode,
    ...(extra === undefined ? {} : { extra }) });
}
function reject(game: Game, player: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, player, action));
  assert.deepEqual(game, before);
}
function completeVotes(game: Game, extra: number): Game {
  let g = game;
  const pending = offer(g), voters = [...pending.voters];
  g = act(g, voters[0], 'continue', extra);
  for (const voter of voters.slice(1)) g = act(g, voter, 'accept');
  return g;
}

void test('Advanced public simultaneous victory waits for each qualifying participant and rejects other actions', () => {
  const game = reachMentat(position());
  assert.equal(game.phase, 8); assert.equal(game.status, 'playing'); assert.deepEqual(game.winner, []);
  const pending = offer(game);
  assert.equal(pending.resume, 'mentat');
  assert.deepEqual(pending.sides, [['ix'], ['at', 'em']]);
  assert.deepEqual(pending.voters, ['ix', 'at', 'em']);
  assert.deepEqual(pending.accepted, []);
  const projected = viewGame(game, 'bg').victoryContinuation;
  assert.ok(projected); assert.equal(projected.actor, 'ix');
  assert.deepEqual(projected.sides, pending.sides); assert.equal(projected.extra, null);
  reject(game, 'bg', { type: 'victoryContinuation', event: pending.event, mode: 'finish' });
  reject(game, 'at', { type: 'victoryContinuation', event: pending.event, mode: 'continue', extra: 1 });
  reject(game, 'ix', { type: 'victoryContinuation', event: 'stale-event', mode: 'continue', extra: 1 });
  reject(game, 'ix', { type: 'victoryContinuation', event: pending.event, mode: 'continue', extra: -1 });
  reject(game, 'ix', { type: 'ready' });
  assert.deepEqual(offer(game), pending);
});

void test('declining the common proposal settles the original winners and correct private prediction', () => {
  const game = reachMentat(position({ prediction: true }));
  const vote = offer(game);
  assert.deepEqual(game.winner, []);
  const publicIx = viewGame(game, 'ix').victoryContinuation;
  const publicOther = viewGame(game, 'em').victoryContinuation;
  assert.deepEqual(publicIx, publicOther, 'The public vote does not expose the private prediction');
  let next = act(game, 'ix', 'continue', 1);
  assert.deepEqual(offer(next).accepted, ['ix']);
  reject(next, 'at', { type: 'victoryContinuation', event: vote.event, mode: 'accept', extra: 2 });
  next = act(next, 'at', 'finish');
  assert.equal(next.status, 'finished'); assert.deepEqual(next.winner, ['bg']);
  assert.ok(!next.victoryContinuation);
});

void test('unanimous continuation raises the ordinary solo and alliance targets without losing Mentat', () => {
  const original = reachMentat(position());
  const beforeForces = original.players.map(player => ({ id: player.id, forces: player.forces, reserves: player.reserves }));
  const next = completeVotes(original, 2);
  assert.equal(next.status, 'playing'); assert.equal(next.phase, 8); assert.equal(next.turn, original.turn);
  assert.deepEqual(next.winner, []); assert.ok(!next.victoryContinuation);
  assert.equal(next.victoryExtraStrongholds, 2);
  assert.deepEqual(next.players.map(player => ({ id: player.id, forces: player.forces, reserves: player.reserves })), beforeForces);
  const progress = viewGame(next, 'ix').victoryProgress;
  assert.equal(progress.find(row => row.player === 'ix')?.target, 5);
  assert.equal(progress.find(row => row.player === 'at')?.target, 6);
  assert.equal(progress.find(row => row.player === 'at')?.qualifies, false);
  let completed = next;
  for (const p of completed.players) completed = applyAction(completed, p.id, { type: 'ready' });
  assert.equal(completed.turn, original.turn + 1);
  assert.equal(completed.victoryExtraStrongholds, 2);
});

void test('zero-increase agreement preserves ordinary targets for the next turn', () => {
  const next = completeVotes(reachMentat(position()), 0);
  assert.equal(next.status, 'playing'); assert.equal(next.phase, 8);
  assert.equal(next.victoryExtraStrongholds ?? 0, 0);
  const progress = viewGame(next, 'ix').victoryProgress;
  assert.equal(progress.find(row => row.player === 'ix')?.target, 3);
  assert.equal(progress.find(row => row.player === 'at')?.target, 4);
});

void test('Basic multiple qualifiers can agree while one qualifying side still wins directly', () => {
  const basic = reachMentat(position({ advanced: false }));
  assert.equal(basic.status, 'playing');
  assert.ok(basic.victoryContinuation);
  const settled = act(basic, basic.victoryContinuation.voters[0], 'finish');
  assert.equal(settled.status, 'finished');
  const single = reachMentat(position({ onlyAlliance: true }));
  assert.equal(single.status, 'finished'); assert.ok(single.winner.length > 0);
  assert.ok(!single.victoryContinuation);
});

void test('all four minimal bot profiles produce a legal response for the public continuation', () => {
  const game = reachMentat(position());
  for (const level of DIFFICULTIES) {
    const view = viewGame(game, 'ix');
    view.players.find(player => player.id === 'ix')!.bot = level;
    // A pending native agreement takes priority over unrelated action guides.
    view.turnActionGuide = { event: 'controlled-guide', action: { type: 'ready' } };
    const action = botActions(view).find(row => row.type === 'victoryContinuation');
    assert.ok(action, `${level} resolves its own public agreement opportunity`);
    const next = applyAction(game, 'ix', action);
    assert.ok(next.status === 'finished' || next.victoryContinuation);
  }
});

void test('CHOAM final Mentat completion waits for unanimous votes before advancing', () => {
  let game = reachMentat(position({ choam: true }));
  assert.equal(game.phase, 8); assert.ok(!game.victoryContinuation);
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  if (game.decision?.kind === 'choamMarket') game = applyAction(game, 'ch', { type: 'decision', done: true });
  assert.equal(game.decision?.kind, 'choamMentat');
  game = applyAction(game, 'ch', { type: 'decision', done: true });
  assert.equal(offer(game).resume, 'advance');
  assert.equal(game.phase, 8); assert.equal(game.turn, 2);
  game = completeVotes(game, 1);
  assert.equal(game.status, 'playing'); assert.equal(game.turn, 3);
  assert.equal(game.victoryExtraStrongholds, 1); assert.ok(!game.victoryContinuation);
});
