import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { acquireDuke, createDukeVidal, expireDuke, DUKE_VIDAL_ID, type DukeSource } from '../game/duke-vidal';
import { ecazDukeAcquisitionBlock, quoteEcazDukeAcquisition } from '../game/ecaz-duke-acquisition';
import { actEcazDukeAlly, advanceEcazDukeAlly, battleEcazDukeAlly, createEcazDukeAllyFixture,
  ecazDukeAllyClean, ecazDukeAllyInventory, ecazDukeAllyPhysical, finishEcazDukeAlly } from './fixture-ecaz-duke-ally';

/** A controlled public quote position, not a claimed natural acquisition. */
function position(source: DukeSource, recipient: 'ec' | 'mor' = 'ec'): Game {
  const game = createGame('DUKEREACQUIRE', newPlayer('ec', 'Ecaz', 'ecaz'), false, ['ecaz']);
  game.players.push(newPlayer('mor', 'Moritani', 'moritani'), newPlayer('other', 'Emperor', 'emperor'));
  Object.assign(game, { status: 'playing', turn: 2, phase: 5, active: 'other' });
  game.players[0].ally = 'mor'; game.players[1].ally = 'ec';
  game.dukeVidal = acquireDuke(createDukeVidal(), recipient, 2, source);
  return game;
}

for (const [source, recipient] of [
  ['ally', 'mor'], ['moritani', 'mor'], ['ecazNexus', 'ec'],
] as const) {
  void test(`same-recipient ${source} tenure can become ordinary Ecaz Ambassador tenure`, () => {
    const game = position(source, recipient);
    game.dukeVidal!.leader.deaths = 2;
    game.dukeVidal!.leader.usedAt = 'arrakeen';
    const before = structuredClone(game), original = structuredClone(game.dukeVidal!);
    assert.equal(ecazDukeAcquisitionBlock(game, 'ec', recipient), null);
    const quote = quoteEcazDukeAcquisition(game, 'ec', recipient);
    assert.deepEqual(game, before, 'A detached quotation never changes the live disc');
    assert.deepEqual(quote, { ...original, source: 'ecaz', acquiredTurn: game.turn });
    assert.deepEqual(quote.leader, original.leader, 'Physical identity, prior use and deaths stay unchanged');
    assert.deepEqual(expireDuke(quote, game.turn), quote, 'Unused ordinary acquisition is retained after the turn');
    assert.notEqual(expireDuke(original, game.turn).controller, recipient, 'The original temporary tenure would expire');
    quote.leader.deaths = 99;
    assert.deepEqual(game, before, 'The quoted leader is detached from the source');
  });
}

void test('redundant ordinary tenure and invalid same-recipient custody remain unavailable', () => {
  const game = position('ecaz');
  const original = structuredClone(game);
  assert.ok(ecazDukeAcquisitionBlock(game, 'ec', 'ec'));
  assert.throws(() => quoteEcazDukeAcquisition(game, 'ec', 'ec'));
  assert.deepEqual(game, original);
  for (const mutate of [
    (g: Game) => { g.dukeVidal!.leader.dead = true; },
    (g: Game) => { g.dukeVidal!.leader.capturedBy = 'other'; },
    (g: Game) => { g.dukeVidal!.leader.gholaBy = 'other'; },
    (g: Game) => { g.dukeVidal!.leader.id = 'wrong-disc'; },
  ]) {
    const bad = position('ally', 'mor'); mutate(bad);
    const before = structuredClone(bad);
    assert.ok(ecazDukeAcquisitionBlock(bad, 'ec', 'mor'));
    assert.throws(() => quoteEcazDukeAcquisition(bad, 'ec', 'mor'));
    assert.deepEqual(bad, before);
  }
});

void test('same-controller exceptional custody cannot change the public redundant-control reason', () => {
  const game = position('ecaz'), reason = ecazDukeAcquisitionBlock(game, 'ec', 'ec');
  assert.ok(reason);
  for (const mutate of [
    (g: Game) => { g.dukeVidal!.leader.capturedBy = 'other'; },
    (g: Game) => { g.dukeVidal!.leader.gholaBy = 'other'; },
  ]) {
    const hidden = structuredClone(game); mutate(hidden);
    assert.equal(ecazDukeAcquisitionBlock(hidden, 'ec', 'ec'), reason);
    assert.throws(() => quoteEcazDukeAcquisition(hidden, 'ec', 'ec'));
  }
});

void test('Advanced Harkonnen does not disclose a concealed same-controller capture via the reacquisition offer', () => {
  const game = position('ecazNexus');
  game.advanced = true;
  game.players[1].faction = 'harkonnen';
  // Existing independent-Discovery profile admits Advanced Harkonnen. These
  // two controlled projections differ only in hidden Duke capture custody.
  game.players[0].ally = null; game.players[1].ally = null;
  game.ecazTreachery = true; game.discoveryEnabled = true;
  const hidden = structuredClone(game);
  hidden.dukeVidal!.leader.capturedBy = 'mor';
  hidden.dukeVidal!.leader.concealed = { captor: 'mor', controller: 'ec', dead: false, deaths: 0 };
  hidden.dukeVidal!.captureVisibility = { controller: 'ec', acquiredTurn: 2, source: 'ecazNexus' };
  const publicReason = ecazDukeAcquisitionBlock(game, 'ec', 'ec');
  assert.ok(publicReason, 'The capture-sensitive offer remains uniformly unavailable');
  assert.equal(ecazDukeAcquisitionBlock(hidden, 'ec', 'ec'), publicReason);
  assert.throws(() => quoteEcazDukeAcquisition(game, 'ec', 'ec'));
  assert.throws(() => quoteEcazDukeAcquisition(hidden, 'ec', 'ec'));
});

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} real Ambassador entry can regrant a controlled ally loan without replaying arrival`, () => {
    const f = createEcazDukeAllyFixture({ advanced });
    const staged = structuredClone(f.game);
    // Controlled custody supplement: the fixture earned the unique shared disc,
    // alliance, token placement and paid entry through real actions. Reassign
    // that same disc to the existing ally with the temporary loan source; no
    // additional leader, card, force or resource is created.
    staged.dukeVidal = acquireDuke(staged.dukeVidal!, f.ally, staged.turn, 'ally');
    const original = structuredClone(staged), physical = ecazDukeAllyPhysical(staged);
    const offer = viewGame(staged, f.owner).ambassadorEntry;
    assert.ok(offer);
    assert.equal(offer.beneficiaries!.find(row => row.player === f.ally)!.blocked, null);
    const command: Action = { type: 'decision', event: f.event, trigger: true, beneficiary: f.ally, choice: 'duke' };
    let game = actEcazDukeAlly(staged, f.owner, command);
    game = finishEcazDukeAlly(f, game);
    assert.deepEqual(staged, original, 'The accepted action does not mutate its input');
    assert.deepEqual([game.dukeVidal!.controller, game.dukeVidal!.source, game.dukeVidal!.acquiredTurn],
      [f.ally, 'ecaz', original.turn]);
    assert.deepEqual(game.dukeVidal!.leader, original.dukeVidal!.leader);
    assert.deepEqual(ecazDukeAllyPhysical(game), physical);
    assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === f.token)!.zone, 'supply');
    assert.deepEqual(ecazDukeAllyInventory(game), f.originalInventory);
    assert.ok(game.players.every(seat => !seat.leaders.some(leader => leader.id === DUKE_VIDAL_ID)));
    assert.throws(() => actEcazDukeAlly(game, f.owner, command), 'The same token event cannot be replayed');

    const fought = battleEcazDukeAlly(f, game, [], { useDuke: false });
    const next = advanceEcazDukeAlly(fought.game,
      state => state.turn === 3 && state.phase === 1 && ecazDukeAllyClean(state));
    assert.deepEqual([next.dukeVidal!.controller, next.dukeVidal!.source, next.dukeVidal!.acquiredTurn],
      [f.ally, 'ecaz', original.turn], 'Unused renewed tenure survives the actual Mentat boundary');
    assert.deepEqual(next.dukeVidal!.leader, original.dukeVidal!.leader);
    assert.deepEqual(ecazDukeAllyInventory(next), f.originalInventory);
  });
}
