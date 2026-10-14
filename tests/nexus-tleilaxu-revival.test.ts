import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer, type Game, type Player } from '../game/engine';
import { createAuditorLeader, leaders } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { createNexusCards } from '../game/nexus-cards';
import { forceRevivalRemaining, leaderRevivalOptions, newRevivalRules } from '../game/revival';
import { createDukeVidal, DUKE_VIDAL_ID } from '../game/duke-vidal';
import {
  NEXUS_TLEILAXU_FORCE_GROUP_CAP,
  NEXUS_TLEILAXU_POLICY,
  TleilaxuSecretAllyError,
  quoteTleilaxuSecretAlly,
  tleilaxuSecretAllyBlock,
  tleilaxuSecretAllyEvent,
  tleilaxuSecretAllyForceBounds,
  tleilaxuSecretAllyOptions,
} from '../game/nexus-tleilaxu-revival';

/** A Treachery card id, i.e. what a battle plan uses for a Cheap Hero. */
const CHEAP_HERO = 'treachery-17';

function holdNexusCard(g: Game, holder: string) {
  const cards = createNexusCards(
    g.players.map((seat) => ({
      id: seat.id,
      faction: seat.faction,
      ally: seat.ally,
    })),
    () => 0.5,
  );
  cards.deck = cards.deck.filter((card) => card !== 'tleilaxu');
  cards.hands[holder] = 'tleilaxu';
  g.nexusCards = { cards, phase: null };
}

function fixture(advanced = true, faction: FactionId = 'atreides') {
  const g = createGame('NEXUSREVIVAL', newPlayer('a', 'Holder', faction), advanced);
  g.players.push(newPlayer('h', 'Rival', 'harkonnen'));
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 3,
    order: ['a', 'h'],
    revivalRules: newRevivalRules(),
  });
  for (const p of g.players) {
    p.spice = 20;
    p.tanks = 10;
    p.elites = { reserves: 0, tanks: 0, forces: {}, revived: 0 };
  }
  holdNexusCard(g, 'a');
  return g;
}

function kill(p: Player, indexes: number[], deaths = 1) {
  for (const index of indexes) {
    p.leaders[index].dead = true;
    p.leaders[index].deaths = deaths;
  }
}

void test('actual held card, unallied non-Tleilaxu holder, quiet Revival and an owner-only event bind the projection', () => {
  const g = fixture();
  kill(g.players[0], [0]);
  const before = structuredClone(g);
  const offer = tleilaxuSecretAllyOptions(g, g.players[0]);
  assert.equal(offer.blocked, null);
  assert.equal(tleilaxuSecretAllyBlock(g, g.players[0]), null);
  assert.equal(offer.event, tleilaxuSecretAllyEvent(g, g.players[0]));
  assert.equal(
    offer.event,
    JSON.stringify(['nexusTleilaxuSecretAlly', 3, 4, 'a']),
  );
  assert.equal(offer.policy, NEXUS_TLEILAXU_POLICY);
  assert.deepEqual(offer.leaders, [
    {
      id: g.players[0].leaders[0].id,
      name: g.players[0].leaders[0].name,
      kind: 'leader',
      early: true,
    },
  ]);
  assert.deepEqual(g, before);

  g.nexusCards!.cards!.hands.a = null;
  assert.match(tleilaxuSecretAllyBlock(g, g.players[0])!, /holder of the Tleilaxu Nexus card/);
  g.nexusCards!.cards!.hands.a = 'tleilaxu';

  g.players[0].ally = 'h';
  g.players[1].ally = 'a';
  assert.match(tleilaxuSecretAllyBlock(g, g.players[0])!, /allied player/);
  g.players[0].ally = null;
  g.players[1].ally = null;

  g.players.push(newPlayer('t', 'Native', 'tleilaxu'));
  assert.match(tleilaxuSecretAllyBlock(g, g.players[0])!, /Tleilaxu absent/);
  g.players.pop();

  g.phase = 5;
  assert.match(tleilaxuSecretAllyBlock(g, g.players[0])!, /during Revival/);
  assert.throws(
    () =>
      quoteTleilaxuSecretAlly(g, g.players[0], {
        leader: g.players[0].leaders[0].id,
        amount: 0,
        elite: 0,
      }),
    (error: unknown) =>
      error instanceof TleilaxuSecretAllyError && error.reason === 'timing',
  );
  g.phase = 4;
  g.status = 'lobby';
  assert.match(tleilaxuSecretAllyBlock(g, g.players[0])!, /started game/);
  g.status = 'playing';

  g.pendingCapture = { player: 'a', loser: 'h', territory: 'arrakeen' };
  assert.match(tleilaxuSecretAllyBlock(g, g.players[0])!, /Finish the current interaction/);
  g.pendingCapture = null;
  assert.equal(tleilaxuSecretAllyBlock(g, g.players[0]), null);
});

void test('the roster waiver belongs to the card alone and never opens the ordinary cycle', () => {
  const g = fixture();
  const p = g.players[0];
  kill(p, [0]);
  // Ordinary rules still refuse: the cohort has never been opened (cycle 0).
  assert.deepEqual(leaderRevivalOptions(g, p).leaders, []);
  assert.equal(leaderRevivalOptions(g, p).cycle, 0);
  const offer = tleilaxuSecretAllyOptions(g, p);
  assert.deepEqual(
    offer.leaders.map((leader) => [leader.id, leader.kind, leader.early]),
    [[p.leaders[0].id, 'leader', true]],
  );
  // The synthetic cycle is a local projection only.
  assert.equal(p.revivalCycle, 0);
  assert.deepEqual(leaderRevivalOptions(g, p).leaders, []);
  assert.deepEqual(g.revivalRules!.earlyBlocked, []);

  // A second death is not returned early while the cohort has never been opened,
  // and the same disc is an ordinary candidate once that cohort level is open.
  const second = fixture();
  const seat = second.players[0];
  kill(seat, [0], 2);
  const withheld = tleilaxuSecretAllyOptions(second, seat);
  assert.deepEqual(withheld.leaders, []);
  assert.match(withheld.blocked!, /one own dead leader/);
  seat.revivalCycle = 2;
  assert.deepEqual(
    tleilaxuSecretAllyOptions(second, seat).leaders.map((leader) => [leader.id, leader.early]),
    [[seat.leaders[0].id, false]],
  );
});

void test('an opened ordinary cohort keeps canonical eligibility and is never marked early', () => {
  const g = fixture();
  const p = g.players[0];
  for (const leader of p.leaders) {
    leader.dead = true;
    leader.deaths = 1;
  }
  const offer = tleilaxuSecretAllyOptions(g, p);
  assert.deepEqual(
    offer.leaders.map((leader) => leader.id),
    p.leaders.map((leader) => leader.id),
  );
  assert.ok(offer.leaders.every((leader) => leader.kind === 'leader' && !leader.early));
});

void test('one own dead leader is mandatory: zero forces is legal, a force-only return is not, and the used slot closes it', () => {
  const g = fixture();
  const p = g.players[0];
  const offer = tleilaxuSecretAllyOptions(g, p);
  assert.deepEqual(offer.leaders, []);
  assert.match(offer.blocked!, /one own dead leader/);
  assert.ok(offer.maxForces > 0);
  assert.throws(
    () =>
      quoteTleilaxuSecretAlly(g, p, {
        leader: p.leaders[0].id,
        amount: 0,
        elite: 0,
      }),
    (error: unknown) =>
      error instanceof TleilaxuSecretAllyError && error.reason === 'leader',
  );
  kill(p, [0]);
  assert.equal(quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 0, elite: 0 }).cost, 0);
  p.leaderRevived = true;
  assert.deepEqual(tleilaxuSecretAllyOptions(g, p).leaders, []);
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 0, elite: 0 }),
    TleilaxuSecretAllyError,
  );
});

void test('exact paid typed counters: one bank spice each, physical Tanks, and the Advanced one-per-turn cap', () => {
  const g = fixture();
  const p = g.players[0];
  p.elites!.tanks = 3;
  kill(p, [0]);
  const offer = tleilaxuSecretAllyOptions(g, p);
  assert.equal(offer.maxForces, NEXUS_TLEILAXU_FORCE_GROUP_CAP);
  assert.equal(offer.maxElite, 1);
  assert.deepEqual(
    quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 4, elite: 1 }),
    { leader: p.leaders[0].id, kind: 'leader', amount: 4, elite: 1, cost: 4, limit: 5 },
  );
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 4, elite: 2 }),
    TleilaxuSecretAllyError,
  );
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 1, elite: 2 }),
    TleilaxuSecretAllyError,
  );
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 6, elite: 0 }),
    TleilaxuSecretAllyError,
  );
  p.elites!.tanks = 0;
  kill(p, [1, 2, 3, 4]);
  p.tanks = 2;
  assert.equal(tleilaxuSecretAllyForceBounds(g, p).maxForces, 2);
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 3, elite: 0 }),
    TleilaxuSecretAllyError,
  );
});

void test('Ixian Cyborgs and Basic typed counters keep identity without the Advanced cap or ordinary pricing', () => {
  const advanced = fixture(true, 'ixians');
  advanced.players[0].elites = { reserves: 0, tanks: 3, forces: {}, revived: 4 };
  kill(advanced.players[0], [0]);
  const ix = tleilaxuSecretAllyOptions(advanced, advanced.players[0]);
  assert.equal(ix.maxElite, 3);
  assert.equal(
    quoteTleilaxuSecretAlly(advanced, advanced.players[0], {
      leader: advanced.players[0].leaders[0].id,
      amount: 5,
      elite: 3,
    }).cost,
    5,
  );
  const basic = fixture(false, 'emperor');
  basic.players[0].elites = { reserves: 0, tanks: 2, forces: {}, revived: 5 };
  kill(basic.players[0], [0]);
  const emperor = tleilaxuSecretAllyOptions(basic, basic.players[0]);
  assert.equal(emperor.maxForces, 5);
  assert.equal(emperor.maxElite, 2);
});

void test('the shared ordinary ceiling is raised to five, counts earlier returns, and never doubles or shrinks a native limit', () => {
  const g = fixture();
  const p = g.players[0];
  kill(p, [0]);
  p.revived = 4;
  assert.equal(tleilaxuSecretAllyOptions(g, p).maxForces, 1);
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 2, elite: 0 }),
    TleilaxuSecretAllyError,
  );
  p.revived = 5;
  const spent = tleilaxuSecretAllyOptions(g, p);
  assert.equal(spent.maxForces, 0);
  assert.equal(spent.blocked, null);
  assert.equal(quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 0, elite: 0 }).cost, 0);
  assert.equal(tleilaxuSecretAllyForceBounds(g, p).ceiling, 5);

  // The group is not an independent extra five: its paid counters come out of
  // the same ordinary allowance, in either order.
  const ordered = fixture();
  const holder = ordered.players[0];
  kill(holder, [0]);
  const ordinary = forceRevivalRemaining(ordered, holder);
  assert.equal(ordinary, 3);
  const group = quoteTleilaxuSecretAlly(ordered, holder, {
    leader: holder.leaders[0].id,
    amount: 2,
    elite: 0,
  });
  holder.revived += group.amount;
  assert.equal(forceRevivalRemaining(ordered, holder), ordinary - 2);
  assert.deepEqual(ordered.revivalRules!.expanded, []);

  const choam = fixture(true, 'choam');
  kill(choam.players[0], [0]);
  choam.players[0].revived = 6;
  assert.equal(tleilaxuSecretAllyForceBounds(choam, choam.players[0]).ceiling, 20);
  assert.equal(tleilaxuSecretAllyOptions(choam, choam.players[0]).maxForces, NEXUS_TLEILAXU_FORCE_GROUP_CAP);

  const recruits = fixture();
  kill(recruits.players[0], [0]);
  recruits.recruits = { turn: recruits.turn, player: 'h', card: 'ecaz-recruits' };
  assert.equal(tleilaxuSecretAllyForceBounds(recruits, recruits.players[0]).ceiling, 7);
  assert.equal(tleilaxuSecretAllyOptions(recruits, recruits.players[0]).maxForces, NEXUS_TLEILAXU_FORCE_GROUP_CAP);
  assert.equal(
    quoteTleilaxuSecretAlly(recruits, recruits.players[0], {
      leader: recruits.players[0].leaders[0].id,
      amount: 5,
      elite: 0,
    }).cost,
    5,
  );
});

void test('a native Fremen free-rate restriction never rejects the explicit paid grant', () => {
  const g = fixture();
  const p = g.players[0];
  p.faction = 'fremen';
  p.leaders = leaders('fremen');
  p.revived = 3;
  p.freeForcesRevived = 3;
  kill(p, [0]);
  // The ordinary paid Fremen path is closed without Tleilaxu in play.
  assert.equal(forceRevivalRemaining(g, p), 0);
  assert.equal(
    quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 2, elite: 0 }).cost,
    2,
  );
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: p.leaders[0].id, amount: 3, elite: 0 }),
    TleilaxuSecretAllyError,
  );
});

void test('Kwisatz and Auditor keep their own canonical return cycles inside the grant', () => {
  const g = fixture(true, 'atreides');
  const p = g.players[0];
  p.kwisatz = { dead: true, revivalCycle: 1 };
  const offer = tleilaxuSecretAllyOptions(g, p);
  assert.deepEqual(offer.leaders, [
    { id: 'kwisatz', name: 'Kwisatz Haderach', kind: 'kwisatz', early: true },
  ]);
  assert.equal(
    quoteTleilaxuSecretAlly(g, p, { leader: 'kwisatz', amount: 0, elite: 0 }).kind,
    'kwisatz',
  );
  p.kwisatz = { dead: true, revivalCycle: 2 };
  assert.deepEqual(tleilaxuSecretAllyOptions(g, p).leaders, []);
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: 'kwisatz', amount: 0, elite: 0 }),
    TleilaxuSecretAllyError,
  );
  p.kwisatz = { dead: true, revivalCycle: 1 };
  g.revivalRules!.earlyBlocked.push('a:kwisatz');
  assert.deepEqual(tleilaxuSecretAllyOptions(g, p).leaders, []);
  g.revivalRules!.earlyBlocked.length = 0;
  p.kwisatz = { dead: false, revivalCycle: 1 };
  kill(p, [0]);
  g.revivalRules!.earlyBlocked.push(`a:${p.leaders[0].id}`);
  assert.deepEqual(tleilaxuSecretAllyOptions(g, p).leaders, []);

  const choam = fixture(true, 'choam');
  const seat = choam.players[0];
  const auditor = createAuditorLeader();
  auditor.dead = true;
  auditor.deaths = 1;
  seat.leaders.push(auditor);
  kill(seat, [0]);
  assert.deepEqual(tleilaxuSecretAllyOptions(choam, seat).leaders, [
    { id: auditor.id, name: 'Auditor', kind: 'leader', early: false },
    { id: seat.leaders[0].id, name: seat.leaders[0].name, kind: 'leader', early: true },
  ]);
});

void test('the shared Ecaz Duke is one more own identity and its custody blocks are named, not silently narrowed', () => {
  const shared = fixture(false, 'ecaz');
  shared.dukeVidal = createDukeVidal();
  shared.dukeVidal!.leader.dead = true;
  shared.dukeVidal!.leader.deaths = 1;
  const p = shared.players[0];
  const offer = tleilaxuSecretAllyOptions(shared, p);
  assert.deepEqual(offer.leaders, [
    { id: DUKE_VIDAL_ID, name: shared.dukeVidal!.leader.name, kind: 'duke', early: false },
  ]);
  assert.equal(
    quoteTleilaxuSecretAlly(shared, p, { leader: DUKE_VIDAL_ID, amount: 1, elite: 0 }).cost,
    1,
  );

  const contested = fixture(true, 'ecaz');
  contested.dukeVidal = createDukeVidal();
  contested.dukeVidal!.leader.dead = true;
  contested.dukeVidal!.leader.deaths = 1;
  const seat = contested.players[0];
  assert.match(tleilaxuSecretAllyOptions(contested, seat).blocked!, /Advanced Harkonnen/);
  kill(seat, [0]);
  const withLeader = tleilaxuSecretAllyOptions(contested, seat);
  assert.equal(withLeader.blocked, null);
  assert.ok(withLeader.leaders.every((leader) => leader.kind === 'leader'));
});

void test('living, captured, foreign ghola, wrong-faction and Cheap Hero custody are never candidates', () => {
  const g = fixture();
  const p = g.players[0];
  kill(p, [0]);
  p.leaders[1].dead = true;
  p.leaders[1].deaths = 1;
  p.leaders[1].capturedBy = 'h';
  p.leaders[2].dead = true;
  p.leaders[2].deaths = 1;
  p.leaders[2].gholaBy = 'h';
  p.leaders.push({
    id: CHEAP_HERO,
    name: 'Cheap Hero',
    strength: 0,
    faction: 'atreides',
    dead: true,
    deaths: 1,
  });
  p.leaders.push({
    id: 'harkonnen-0',
    name: 'Foreign Disc',
    strength: 6,
    faction: 'harkonnen',
    dead: true,
    deaths: 1,
  });
  const before = structuredClone(g);
  const offer = tleilaxuSecretAllyOptions(g, p);
  assert.deepEqual(
    offer.leaders.map((leader) => leader.id),
    [p.leaders[0].id],
  );
  assert.deepEqual(g, before);
  for (const id of [CHEAP_HERO, p.leaders[1].id, p.leaders[2].id, 'harkonnen-0', 'nobody'])
    assert.throws(
      () => quoteTleilaxuSecretAlly(g, p, { leader: id, amount: 0, elite: 0 }),
      TleilaxuSecretAllyError,
    );
});

void test('every offered candidate and bound quotes successfully and every overage is refused', () => {
  const g = fixture();
  const p = g.players[0];
  p.elites!.tanks = 3;
  kill(p, [0, 1]);
  const offer = tleilaxuSecretAllyOptions(g, p);
  assert.equal(offer.blocked, null);
  assert.deepEqual(
    offer.leaders.map((leader) => leader.id),
    [p.leaders[0].id, p.leaders[1].id],
  );
  for (const leader of offer.leaders)
    for (let amount = 0; amount <= offer.maxForces; amount++)
      for (let elite = 0; elite <= Math.min(amount, offer.maxElite); elite++) {
        const quote = quoteTleilaxuSecretAlly(g, p, { leader: leader.id, amount, elite });
        assert.equal(quote.kind, leader.kind);
        assert.equal(quote.cost, amount);
        assert.equal(quote.limit, offer.maxForces);
      }
  const target = offer.leaders[0].id;
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: target, amount: offer.maxForces + 1, elite: 0 }),
    TleilaxuSecretAllyError,
  );
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: target, amount: 1.5, elite: 0 }),
    TleilaxuSecretAllyError,
  );
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: target, amount: -1, elite: -1 }),
    TleilaxuSecretAllyError,
  );
  p.spice = 0;
  assert.throws(
    () => quoteTleilaxuSecretAlly(g, p, { leader: target, amount: 1, elite: 0 }),
    (error: unknown) =>
      error instanceof TleilaxuSecretAllyError && error.reason === 'price',
  );
  assert.equal(quoteTleilaxuSecretAlly(g, p, { leader: target, amount: 0, elite: 0 }).cost, 0);
});
