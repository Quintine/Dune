import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { FACTIONS, type FactionId } from '../game/catalog';
import {
  acquireDuke,
  createDukeVidal,
  DUKE_VIDAL_ID,
} from '../game/duke-vidal';

function fixture(faction: FactionId = 'emperor', advanced = false) {
  const g = createGame(
    'GHOLALIFE',
    newPlayer('p', 'Player', faction),
    advanced,
  );
  g.players.push(
    newPlayer('q', 'Opponent', faction === 'guild' ? 'emperor' : 'guild'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 4,
    turn: 2,
    storm: 18,
    order: ['p', 'q'],
    deck: baseDeck(),
  });
  for (const p of g.players)
    Object.assign(p, {
      hand: [],
      traitors: [],
      traitorChoices: [],
      forces: {},
      reserves: 20,
      spice: 10,
    });
  const card = g.deck.splice(
    g.deck.findIndex((c) => c.effect === 'ghola'),
    1,
  )[0];
  g.players[0].hand.push(card);
  return { g, card: card.id };
}
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
function prepared(g: Game, territory: string, target?: string) {
  g = applyAction(g, g.active!, {
    type: 'chooseBattle',
    territory,
    target: target ?? (g.active === 'p' ? 'q' : 'p'),
  });
  for (
    let n = 0;
    n < 20 && (g.response || g.battle?.preparation || g.decision);
    n++
  ) {
    if (g.response)
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
    else if (g.battle?.preparation)
      g = applyAction(g, g.battle.preparation.owner, {
        type: 'declineBattlePower',
      });
    else if (g.decision?.kind === 'fullPlanOffer')
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        decline: true,
      });
    else throw Error(JSON.stringify(g.decision));
  }
  return g;
}
void test('Ghola returns an actually killed leader for another territory in the same Battle phase', () => {
  for (const advanced of [false, true]) {
    const initial = fixture('emperor', advanced);
    const card = initial.card;
    let g = initial.g;
    Object.assign(g, { phase: 6, active: 'p', order: ['p', 'q', 's'] });
    for (const p of g.players)
      Object.assign(p, {
        forces: { 'arrakeen:10': 2, 'carthag:11': 2 },
        reserves: 16,
      });
    const poison = g.deck.splice(
      g.deck.findIndex((c) => c.kind === 'poison'),
      1,
    )[0];
    g.players.push(newPlayer('s', 'Third', 'fremen'));
    Object.assign(g.players[2], {
      forces: { 'arrakeen:10': 2 },
      reserves: 18,
      hand: [poison],
      traitors: [],
      traitorChoices: [],
      spice: 10,
    });
    const leader = g.players[0].leaders[0].id;
    // First win establishes usedAt through real resolution. A second opponent
    // then kills the same leader in the same territory before the Ghola play.
    for (const opponent of ['q', 's']) {
      g = prepared(g, 'arrakeen', opponent);
      g = applyAction(g, 'p', {
        type: 'battlePlan',
        dial: 0,
        support: 0,
        leader,
      });
      g = applyAction(g, opponent, {
        type: 'battlePlan',
        dial: 0,
        support: 0,
        leader: g.players.find((p) => p.id === opponent)!.leaders.at(-1)!.id,
        ...(opponent === 's' ? { weapon: poison.id } : {}),
      });
      g = applyAction(g, 'p', { type: 'traitorCall', call: false });
      g = applyAction(g, opponent, { type: 'traitorCall', call: false });
      while (g.decision) {
        assert.equal(g.decision.kind, 'battleCards');
        g = applyAction(g, g.decision.player, {
          type: 'decision',
          discard: [],
        });
      }
      if (opponent === 'q') {
        assert.equal(
          g.players[0].leaders.find((l) => l.id === leader)!.dead,
          false,
        );
        assert.equal(
          g.players[0].leaders.find((l) => l.id === leader)!.usedAt,
          'arrakeen',
        );
      }
    }
    assert.equal(g.phase, 6);
    assert.equal(g.battle, null);
    const dead = g.players[0].leaders.find((l) => l.id === leader)!;
    assert.equal(dead.dead, true);
    assert.equal(dead.usedAt, undefined);
    assert.equal(dead.deaths, 1);
    const before = reload(g),
      spice = g.players[0].spice;
    assert.ok(viewGame(g, 'p').ghola.leaders.some((l) => l.id === leader));
    g = applyAction(reload(g), 'p', { type: 'card', card, leader });
    assert.deepEqual(
      before.players[0].leaders.find((l) => l.id === leader),
      dead,
    );
    assert.equal(
      g.players[0].leaders.find((l) => l.id === leader)!.usedAt,
      undefined,
    );
    assert.equal(g.players[0].leaders.find((l) => l.id === leader)!.deaths, 1);
    assert.equal(g.players[0].spice, spice);
    assert.equal(g.players[0].leaderRevived, before.players[0].leaderRevived);
    assert.equal(g.discard.filter((c) => c.id === card).length, 1);
    g = prepared(reload(g), 'carthag');
    g = applyAction(g, 'p', {
      type: 'battlePlan',
      dial: 0,
      support: 0,
      leader,
    });
    assert.equal(g.battle!.plans.p.leader, leader);
  }
});
void test('all non-Ecaz factions are refused a synthetic dead temporarily controlled Duke without spending Ghola', () => {
  for (const f of FACTIONS.filter((f) => f.id !== 'ecaz')) {
    const { g, card } = fixture(f.id as FactionId);
    g.dukeVidal = acquireDuke(createDukeVidal(), 'p', 2, 'ally');
    Object.assign(g.dukeVidal.leader, { dead: true, deaths: 1 });
    const before = reload(g);
    assert.ok(
      !viewGame(g, 'p').ghola.leaders.some((l) => l.id === DUKE_VIDAL_ID),
    );
    assert.throws(
      () => applyAction(g, 'p', { type: 'card', card, leader: DUKE_VIDAL_ID }),
      /Only Ecaz/,
    );
    assert.deepEqual(g, before);
  }
});
void test('Ghola projection excludes captured or foreign controlled native leaders and exceptional Duke custody', () => {
  const { g } = fixture('ecaz');
  g.dukeVidal = acquireDuke(createDukeVidal(), 'p', 2, 'ecaz');
  Object.assign(g.dukeVidal.leader, { dead: true, deaths: 1 });
  Object.assign(g.players[0].leaders[0], {
    dead: true,
    deaths: 1,
    capturedBy: 'q',
  });
  Object.assign(g.players[0].leaders[1], {
    dead: true,
    deaths: 1,
    gholaBy: 'q',
  });
  Object.assign(g.players[0].leaders[2], { dead: true, deaths: 1 });
  assert.deepEqual(
    viewGame(g, 'p')
      .ghola.leaders.map((l) => l.id)
      .sort(),
    [DUKE_VIDAL_ID, g.players[0].leaders[2].id].sort(),
  );
  g.dukeVidal.leader.concealed = { captor: 'q', dead: false, deaths: 0 };
  const a = viewGame(g, 'p').ghola;
  g.dukeVidal.leader.dead = false;
  g.dukeVidal.leader.capturedBy = 'q';
  assert.deepEqual(viewGame(g, 'p').ghola, a);
  assert.deepEqual(
    a.leaders.map((l) => l.id),
    [g.players[0].leaders[2].id],
  );
});
void test('Ghola options are own-hand only and ignore opponents private spice cards and traitors', () => {
  const { g } = fixture();
  Object.assign(g.players[0], { tanks: 5, reserves: 15 });
  const before = reload(g),
    a = viewGame(g, 'p').ghola;
  assert.equal(a.maxForces, 5);
  assert.equal(a.available, true);
  assert.equal(viewGame(g, 'q').ghola.available, false);
  g.players[1].spice = 987;
  g.players[1].hand = g.deck.splice(0, 4);
  g.players[1].traitors = ['emperor-0'];
  assert.deepEqual(viewGame(g, 'p').ghola, a);
  assert.deepEqual(before.players[0], g.players[0]);
});
void test('Ghola respects pending table windows while normal revival prevention does not block it', () => {
  const { g, card } = fixture();
  Object.assign(g.players[0], {
    tanks: 5,
    reserves: 15,
    revived: 3,
    leaderRevived: true,
  });
  g.revivalPrevention = { player: 'p', turn: 2 };
  assert.equal(viewGame(g, 'p').ghola.available, true);
  const done = applyAction(g, 'p', { type: 'card', card, amount: 5 });
  assert.equal(done.players[0].reserves, 20);
  assert.equal(done.players[0].revived, 3);
  assert.equal(done.players[0].leaderRevived, true);
  for (const mutate of [
    (x: Game) => {
      x.phaseOpening = { passed: [], initialize: false };
    },
    (x: Game) => {
      x.response = {
        kind: 'revivalIncome',
        owner: 'q',
        recipient: 'p',
        amount: 1,
        passed: [],
      };
    },
    (x: Game) => {
      x.decision = { kind: 'fullPlanOffer', player: 'p' };
    },
  ]) {
    const blocked = reload(g);
    mutate(blocked);
    const before = reload(blocked);
    assert.equal(viewGame(blocked, 'p').ghola.available, false);
    assert.throws(() =>
      applyAction(blocked, 'p', { type: 'card', card, amount: 5 }),
    );
    assert.deepEqual(blocked, before);
  }
});
void test('Ghola force options honor physical elite composition and remaining elite allowance', () => {
  const { g, card } = fixture('emperor', true);
  Object.assign(g.players[0], { tanks: 5, reserves: 15 });
  g.players[0].elites = { forces: {}, reserves: 3, tanks: 2, revived: 1 };
  const options = viewGame(g, 'p').ghola;
  assert.equal(options.maxForces, 3);
  assert.equal(options.eliteRemaining, 0);
  assert.throws(
    () => applyAction(g, 'p', { type: 'card', card, amount: 4, elite: 1 }),
    /Only one elite/,
  );
  const done = applyAction(g, 'p', { type: 'card', card, amount: 3, elite: 0 });
  assert.equal(done.players[0].tanks, 2);
  assert.deepEqual(done.players[0].elites, g.players[0].elites);
});
void test('Ghola returns Kwisatz without a stale battle location or normal leader-slot use', () => {
  const { g, card } = fixture('atreides', true);
  g.players[0].kwisatz = { dead: true, usedAt: 'arrakeen', revivalCycle: 1 };
  const before = reload(g);
  const done = applyAction(g, 'p', { type: 'card', card, leader: 'kwisatz' });
  assert.equal(done.players[0].kwisatz?.dead, false);
  assert.equal(done.players[0].kwisatz?.usedAt, undefined);
  assert.equal(done.players[0].leaderRevived, before.players[0].leaderRevived);
  assert.equal(done.players[0].spice, before.players[0].spice);
});

void test('Ghola revives an actually exploded Kwisatz for a later territory in the same turn', () => {
  const initial = fixture('atreides', true);
  const card = initial.card;
  let g = initial.g;
  Object.assign(g, { phase: 6, active: 'p', order: ['p', 'q'] });
  for (const p of g.players)
    Object.assign(p, {
      forces: { 'arrakeen:10': 3, 'carthag:11': 3 },
      reserves: 14,
    });
  // Activation is a conserved prior-game precondition; both battles below are real actions.
  g.players[0].battleLosses = 7;
  const shield = g.deck.splice(
    g.deck.findIndex((c) => c.kind === 'shield'),
    1,
  )[0];
  const lasgun = g.deck.splice(
    g.deck.findIndex((c) => c.kind === 'lasgun'),
    1,
  )[0];
  g.players[0].hand.push(shield);
  g.players[1].hand.push(lasgun);
  g = prepared(g, 'arrakeen');
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: g.players[0].leaders[0].id,
    defense: shield.id,
    kwisatz: true,
  });
  g = applyAction(g, 'q', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: g.players[1].leaders[0].id,
    weapon: lasgun.id,
  });
  g = applyAction(g, 'p', { type: 'traitorCall', call: false });
  g = applyAction(g, 'q', { type: 'traitorCall', call: false });
  assert.equal(g.battle, null);
  assert.equal(g.phase, 6);
  assert.equal(g.players[0].kwisatz?.dead, true);
  assert.equal(g.players[0].kwisatz?.usedAt, 'arrakeen');
  assert.equal(g.players[0].tanks, 3);
  const before = reload(g);
  g = applyAction(reload(g), 'p', { type: 'card', card, leader: 'kwisatz' });
  assert.equal(g.players[0].kwisatz?.dead, false);
  assert.equal(g.players[0].kwisatz?.usedAt, undefined);
  assert.equal(g.players[0].kwisatz?.revivalCycle, 2);
  assert.equal(g.players[0].leaderRevived, before.players[0].leaderRevived);
  assert.equal(g.players[0].spice, before.players[0].spice);
  assert.equal(g.players[0].tanks, 3);
  assert.equal(
    g.players[0].leaders[0].dead,
    true,
    'Ghola revived only Kwisatz',
  );
  g = prepared(reload(g), 'carthag');
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: g.players[0].leaders[1].id,
    kwisatz: true,
  });
  assert.equal(g.battle!.plans.p.kwisatz, true);
  assert.equal(viewGame(g, 'q').battle!.plans.p, undefined);
});
