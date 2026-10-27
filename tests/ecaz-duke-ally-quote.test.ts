import assert from 'node:assert/strict';
import test from 'node:test';
import { newPlayer, type Game } from '../game/engine';
import { acquireDuke, consumeDuke, createDukeVidal, expireDuke } from '../game/duke-vidal';
import {
  quoteEcazDukeAcquisition as quote, ecazDukeAcquisitionBlock as block,
  EcazDukeAcquisitionError, type EcazDukeContext,
} from '../game/ecaz-duke-acquisition';

type Position = Omit<EcazDukeContext, 'players'> & { players: Game['players'] };
/** Controlled pure-rule inputs only: no native setup, acquisition, alliance or
 * battle chronology is claimed. The canonical shared disc is never copied to
 * one of the four native leader rosters. */
function position(advanced = false): Position {
  const players = [newPlayer('ec', 'Ecaz', 'ecaz'), newPlayer('al', 'Ally', 'atreides'),
    newPlayer('g', 'Guild', 'guild'), newPlayer('m', 'Moritani', 'moritani')];
  players[0].ally = 'al'; players[1].ally = 'ec';
  return { status: 'playing', turn: 2, advanced, expansions: ['ecaz'], players, dukeVidal: createDukeVidal() };
}
const seat = (g: Position, id: string) => { const p = g.players.find(p => p.id === id); assert.ok(p); return p; };
function rejected(g: Position, owner = 'ec', recipient = 'al') {
  const before = structuredClone(g); assert.throws(() => quote(g, owner, recipient));
  assert.equal(block(g, owner, recipient), 'Duke Vidal is unavailable for this acquisition.');
  assert.deepEqual(g, before);
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced' : 'Basic';
  void test(`${band} ordinary Ecaz Duke quote preserves the existing default self acquisition`, () => {
    const g = position(advanced), before = structuredClone(g);
    const own = quote(g, 'ec');
    assert.deepEqual(own, quote(g, 'ec', 'ec'));
    assert.deepEqual(own, { leader: g.dukeVidal!.leader, controller: 'ec', acquiredTurn: 2, source: 'ecaz' });
    assert.equal(block(g, 'ec'), null); assert.equal(block(g, 'ec', 'ec'), null); assert.deepEqual(g, before);
    const legacy: EcazDukeContext = { ...g, players: g.players.map(({ id, faction }) => ({ id, faction })) };
    assert.deepEqual(quote(legacy, 'ec'), own, 'Old self-only context callers need no ally property');
    assert.equal(block(legacy, 'ec', 'al'), 'Duke Vidal is unavailable for this acquisition.');
  });

  void test(`${band} a reciprocal ally receives the same living or set-aside Duke with ordinary until-battle tenure`, () => {
    for (const prior of ['setAside', 'ecaz', 'ecazNexus', 'moritani', 'ally'] as const) {
      const g = position(advanced);
      if (prior !== 'setAside')
        g.dukeVidal = acquireDuke(g.dukeVidal!, prior === 'ecaz' || prior === 'ecazNexus' ? 'ec' : 'm',
          prior === 'ecazNexus' ? g.turn : 1, prior);
      g.dukeVidal!.leader.deaths = 2; g.dukeVidal!.leader.usedAt = 'arrakeen';
      const before = structuredClone(g), shared = quote(g, 'ec', 'al');
      assert.equal(shared.controller, 'al'); assert.equal(shared.source, 'ecaz'); assert.equal(shared.acquiredTurn, g.turn);
      assert.deepEqual(shared.leader, g.dukeVidal!.leader); assert.equal(shared.leader.faction, 'ecaz');
      assert.equal(shared.leader.deaths, 2); assert.equal(shared.leader.usedAt, 'arrakeen');
      assert.equal(block(g, 'ec', 'al'), null); assert.deepEqual(g, before);
      assert.notEqual(shared, g.dukeVidal); assert.notEqual(shared.leader, g.dukeVidal!.leader);
      assert.deepEqual(expireDuke(shared, g.turn + 1), shared, 'Unused ordinary acquisition does not inherit the turn-loan expiry');
      const loan = acquireDuke(createDukeVidal(), 'al', g.turn, 'ally');
      assert.equal(expireDuke(loan, g.turn).controller, null, 'New-alliance loan remains a distinct turn-limited source');
      const used = consumeDuke(shared); assert.equal(used.controller, null); assert.equal(used.source, null);
      assert.equal(used.leader.usedAt, 'arrakeen'); assert.equal(used.leader.deaths, 2);
      shared.leader.deaths = 99; assert.deepEqual(g, before, 'Mutating the detached quote cannot mutate a physical source disc');
      assert.deepEqual(g.players.map(p => p.leaders), before.players.map(p => p.leaders));
    }
  });

  void test(`${band} Ecaz-held Duke may transfer to its ally while same-recipient acquisition remains a no-op refusal`, () => {
    const g = position(advanced); g.dukeVidal = acquireDuke(g.dukeVidal!, 'ec', 1, 'ecaz');
    const oldReason = block(g, 'ec');
    assert.equal(oldReason, 'Ecaz already controls Duke Vidal through its Ambassador.');
    assert.throws(() => quote(g, 'ec'), error => error instanceof EcazDukeAcquisitionError && error.reason === 'alreadyControlled');
    const shared = quote(g, 'ec', 'al'); assert.equal(shared.controller, 'al'); assert.equal(shared.source, 'ecaz');
    g.dukeVidal = shared; const before = structuredClone(g);
    assert.equal(block(g, 'ec', 'al'), 'The chosen beneficiary already controls Duke Vidal through the Ambassador.');
    assert.throws(() => quote(g, 'ec', 'al'), error => error instanceof EcazDukeAcquisitionError && error.reason === 'alreadyControlled');
    assert.deepEqual(g, before);
    // Public same-controller descriptors do not vary with a private capture or
    // Ghola marker. They confer no permission to transfer that custody.
    g.dukeVidal.leader.capturedBy = 'g';
    assert.equal(block(g, 'ec', 'al'), 'The chosen beneficiary already controls Duke Vidal through the Ambassador.');
    rejected(g, 'ec', 'ec');
    delete g.dukeVidal.leader.capturedBy; g.dukeVidal.leader.gholaBy = 'g';
    assert.equal(block(g, 'ec', 'al'), 'The chosen beneficiary already controls Duke Vidal through the Ambassador.');
    rejected(g, 'ec', 'ec');
  });
}

void test('shared ordinary Duke acquisition rechecks the current unique Ecaz owner and reciprocal recipient', () => {
  for (const change of [
    (g: Position) => { seat(g, 'ec').ally = null; },
    (g: Position) => { seat(g, 'al').ally = null; },
    (g: Position) => { seat(g, 'ec').ally = 'g'; },
    (g: Position) => { seat(g, 'al').ally = 'g'; },
    (g: Position) => { g.players = g.players.filter(p => p.id !== 'al'); },
    (g: Position) => { g.players.push(newPlayer('al', 'Duplicate recipient', 'emperor')); },
    (g: Position) => { g.players.push(newPlayer('secondEcaz', 'Duplicate native owner', 'ecaz')); },
    (g: Position) => { g.status = 'setup'; },
    (g: Position) => { g.turn = 0; },
  ]) { const g = position(); change(g); rejected(g); }
  const g = position(); rejected(g, 'al', 'ec'); rejected(g, 'ec', 'g'); rejected(g, 'ec', 'missing');
  const earlier = quote(g, 'ec', 'al'); seat(g, 'al').ally = null; rejected(g);
  assert.equal(earlier.controller, 'al', 'An earlier detached quote cannot authorize a now-broken alliance');
});

void test('shared ordinary Duke quote blocks exceptional physical custody with one generic public reason and supplies no revival', () => {
  for (const advanced of [false, true]) for (const change of [
    (g: Position) => { delete g.dukeVidal; },
    (g: Position) => { g.dukeVidal!.leader.dead = true; },
    (g: Position) => { g.dukeVidal!.leader.capturedBy = 'g'; },
    (g: Position) => { g.dukeVidal!.leader.gholaBy = 'g'; },
    (g: Position) => { g.dukeVidal!.leader.concealed = { captor: 'g', controller: 'ec', dead: false, deaths: 0 }; },
    (g: Position) => { g.dukeVidal!.captureVisibility = { controller: 'ec', acquiredTurn: 1, source: 'ecaz' }; },
    (g: Position) => { g.dukeVidal!.leader.id = 'replacement-disc'; },
    (g: Position) => { g.dukeVidal!.leader.faction = 'atreides'; },
    (g: Position) => { g.dukeVidal!.leader.strength = 5; },
    (g: Position) => { g.dukeVidal!.leader.deaths = -1; },
    (g: Position) => { g.dukeVidal!.controller = 'absent'; },
    (g: Position) => { g.dukeVidal = acquireDuke(g.dukeVidal!, 'm', 3, 'moritani'); },
  ]) {
    const g = position(advanced); change(g); rejected(g);
    assert.equal(g.players.flatMap(p => p.leaders).some(leader => leader.id === 'duke-vidal'), false);
  }
});

void test('sharing ordinary acquisition preserves the existing Advanced Harkonnen table boundary and admitted no-Skills profile', () => {
  const g = position(true); seat(g, 'g').faction = 'harkonnen';
  const reason = block(g, 'ec', 'al'); assert.match(reason!, /Advanced Harkonnen/);
  assert.throws(() => quote(g, 'ec', 'al'), error => error instanceof EcazDukeAcquisitionError && error.reason === 'table');
  g.dukeVidal!.leader.capturedBy = 'g'; assert.equal(block(g, 'ec', 'al'), reason);
  delete g.dukeVidal!.leader.capturedBy;
  const basic = structuredClone(g); basic.advanced = false; assert.equal(block(basic, 'ec', 'al'), null);
  g.ecazTreachery = true; g.discoveryEnabled = true;
  assert.equal(quote(g, 'ec', 'al').controller, 'al'); assert.equal(block(g, 'ec', 'al'), null);
  g.leaderSkills = {}; assert.equal(block(g, 'ec', 'al'), reason);
});
