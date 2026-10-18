import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, viewGame, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { acquireDuke, captureDuke, createDukeVidal } from '../game/duke-vidal';
import { richeseCards } from '../game/richese-cards';

const card = 'richese-residual-poison';
const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
// Controlled custody probes. The separate capture programme earns the real
// cache card, deployments and captive through original actions.
function fixture(kind: 'ordinary' | 'ghola' | 'duke' = 'ordinary', semuta = false) {
  let g = createGame('POISONCUSTODY', newPlayer('r', 'Richese', 'richese'), true, ['choam']);
  g.players.push(newPlayer('h', 'Harkonnen', 'harkonnen'),
    newPlayer('e', 'Original owner', kind === 'duke' ? 'ecaz' : 'emperor'));
  if (kind === 'ghola') g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
  Object.assign(g, { status: 'playing', phase: 6, turn: 2, storm: 18,
    active: 'r', order: g.players.map(p => p.id), deck: baseDeck(), richeseCache: richeseCards() });
  for (const p of g.players) { p.hand = []; p.forces = {}; p.spice = 10; }
  for (const id of ['r', 'h']) player(g, id).forces = { 'arrakeen:10': 2 };
  const take = (effect: string, owner: string) => {
    const index = g.richeseCache!.findIndex(c => c.effect === effect); assert.ok(index >= 0);
    player(g, owner).hand.push(g.richeseCache!.splice(index, 1)[0]);
  };
  take('residualPoison', 'r');
  if (semuta) { g.semutaPreview = true; take('semutaDrug', 'e'); }
  // Native discs remain alive, but their earlier territory use excludes them.
  for (const leader of player(g, 'h').leaders) leader.usedAt = 'carthag';
  let victim: string;
  if (kind === 'duke') {
    g.dukeVidal = captureDuke(acquireDuke(createDukeVidal(), 'e', 2, 'ecaz'), 'h', 'e', 2, 'carthag');
    victim = g.dukeVidal.leader.id;
  } else {
    const leader = player(g, 'e').leaders[0]; victim = leader.id;
    leader.capturedBy = 'h';
    if (kind === 'ghola') leader.gholaBy = 't';
    leader.concealed = { captor: 'h', controller: kind === 'ghola' ? 't' : 'e', dead: false, deaths: 0 };
  }
  g = applyAction(g, 'r', { type: 'chooseBattle', territory: 'arrakeen', target: 'h' });
  return { game: g, victim };
}
function poison(g: Game) {
  return applyAction(g, 'r', { type: 'card', card, target: 'h', event: g.battle!.event });
}
function physical(g: Game, id: string) {
  return [...g.players.flatMap(p => p.leaders), ...(g.dukeVidal ? [g.dukeVidal.leader] : [])].find(l => l.id === id)!;
}

for (const kind of ['ordinary', 'ghola', 'duke'] as const) void test(
  `Residual Poison ends ${kind} captivity with one public death and original revival custody`, () => {
    const { game, victim } = fixture(kind), before = structuredClone(game);
    assert.equal(viewGame(game, 'r').residualPoison?.blocked, null);
    const done = poison(game), dead = physical(done, victim);
    assert.deepEqual(game, before);
    assert.equal(dead.dead, true); assert.equal(dead.deaths, 1);
    assert.equal(dead.capturedBy, undefined); assert.equal(dead.concealed, undefined);
    assert.equal(dead.gholaBy, kind === 'ghola' ? 't' : undefined);
    if (kind === 'duke') {
      assert.equal(done.dukeVidal!.controller, null);
      assert.equal(done.dukeVidal!.captureVisibility, undefined);
      assert.equal(done.dukeVidal!.acquiredTurn, null);
      assert.equal(done.dukeVidal!.source, null);
      assert.equal(done.players.some(p => p.leaders.some(l => l.id === victim)), false);
    } else {
      assert.equal(player(done, 'e').leaders.filter(l => l.id === victim).length, 1);
      const publicDead = viewGame(done, 'r').players.find(p => p.id === 'e')!.leaders.find(l => l.id === victim)!;
      assert.equal(publicDead.dead, true); assert.equal(publicDead.deaths, 1);
      assert.equal(publicDead.capturedBy, undefined);
    }
    assert.deepEqual(done.players.map(p => p.spice), game.players.map(p => p.spice));
    assert.deepEqual(done.players.map(p => p.forces), game.players.map(p => p.forces));
    assert.equal(done.discard.filter(c => c.id === card).length, 1);
    assert.equal(done.battle?.event, game.battle?.event);
    assert.deepEqual(done.battle?.plans, {});
    assert.match(done.log.at(-1)!.text, /No spice is awarded/);
  });

void test('killing the last native Harkonnen disc returns living captives without executing them', () => {
  const { game, victim } = fixture();
  const natives = player(game, 'h').leaders;
  delete natives[0].usedAt;
  for (const leader of natives.slice(1)) { leader.dead = true; leader.deaths = 1; }
  physical(game, victim).usedAt = 'carthag';
  const done = poison(game), returned = physical(done, victim);
  assert.equal(player(done, 'h').leaders[0].dead, true);
  assert.equal(returned.dead, false); assert.equal(returned.deaths, 0);
  assert.equal(returned.capturedBy, undefined); assert.equal(returned.concealed, undefined);
  assert.equal(returned.usedAt, 'carthag');
  assert.deepEqual(done.players.map(p => p.spice), game.players.map(p => p.spice));
  assert.ok(done.log.some(row => /returned 1 captive leaders/.test(row.text)));
});

for (const kind of ['ordinary', 'duke'] as const) void test(
  `Semuta finds the dead ${kind} physical disc after temporary control ends`, () => {
    const { game, victim } = fixture(kind, true);
    const pending = poison(game), event = pending.pendingTreacheryDiscard!.batch.event;
    assert.equal(pending.pendingTreacheryDiscard?.continuation.kind, 'residualPoisonDiscard');
    assert.equal(physical(pending, victim).capturedBy, undefined);
    assert.equal(viewGame(pending, 'e').semutaReaction?.canCommit, true);
    const done = applyAction(pending, 'e', { type: 'semutaCommit', event });
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.equal(physical(done, victim).dead, true); assert.equal(physical(done, victim).deaths, 1);
    assert.equal(player(done, 'e').hand.filter(c => c.id === card).length, 1);
    assert.equal(done.battle?.event, game.battle?.event);
    assert.deepEqual(done.players.map(p => p.spice), game.players.map(p => p.spice));
    assert.throws(() => applyAction(done, 'e', { type: 'semutaCommit', event }));
  });
