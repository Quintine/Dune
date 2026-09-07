import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { revivalPrevented } from '../game/revival';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { placeFixtureHand } from './fixture-hand';
function fixture() {
  let g = createGame('TREVIVAL2', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(g, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('t', 'Tleilaxu', 'guild'));
  joinGame(g, newPlayer('h', 'Observer', 'harkonnen'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'a', { type: 'start' });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g.players[2].faction = 'tleilaxu';
  g.players[2].leaders = leaders('tleilaxu');
  g.players[2].traitors = [];
  g.phase = 4;
  g.advanced = true;
  g.storm = 18;
  g.order = ['a', 'e', 't', 'h'];
  g.active = null;
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.reserves = 20;
    p.tanks = 0;
    p.spice = 20;
    p.revived = 0;
  }
  return g;
}

const karama = baseDeck().find((c) => c.effect === 'karama')!;
const ghola = baseDeck().find((c) => c.effect === 'ghola')!;
function beforeRevival() {
  const g = fixture();
  g.players[0].tanks = 8;
  g.players[0].reserves = 12;
  g.players[2].hand = [karama];
  return g;
}
function declare(g: Game, player = 'a', amount = 3) {
  return applyAction(g, player, { type: 'revive', amount });
}
function prevent(g: Game) {
  return applyAction(g, 't', {
    type: 'card',
    card: karama.id,
    mode: 'special',
  });
}
function allow(state: Game) {
  let g = state;
  while (g.response || g.decision?.kind === 'revivalStop')
    if (g.decision?.kind === 'revivalStop')
      g = applyAction(g, 't', { type: 'decision', decline: true });
    else
      g = applyAction(
        g,
        g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
        { type: 'passResponse' },
      );
  return g;
}
void test('every advanced foreign normal revival gets the same Tleilaxu window independently of card holdings', () => {
  const before = beforeRevival();
  const withCard = declare(before);
  before.players[2].hand = [];
  const withoutCard = declare(before);
  assert.deepEqual(
    viewGame(withCard, 'a').decision,
    viewGame(withoutCard, 'a').decision,
  );
  assert.deepEqual(withCard.decision, {
    kind: 'revivalStop',
    player: 't',
    recipient: 'a',
    revival: 'forces',
  });
  assert.equal(withCard.players[0].spice, 20);
  assert.equal(withCard.players[0].tanks, 8);
  assert.equal(withCard.players[0].revived, 0);
  const g = allow(withoutCard);
  assert.equal(g.players[0].tanks, 5);
  assert.equal(g.players[0].spice, 18);
  assert.equal(g.players[2].spice, 23);
  assert.equal(g.players[2].specialKaramaUsed, undefined);
});
void test('special Karama consumes one card once, aborts payment and prevents repeat force or leader revival for the turn', () => {
  let g = prevent(declare(beforeRevival()));
  assert.equal(g.players[2].specialKaramaUsed, true);
  assert.equal(g.discard.filter((c) => c.id === karama.id).length, 1);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].tanks, 8);
  assert.equal(g.players[0].revived, 0);
  assert.equal(g.players[2].spice, 20);
  assert.equal(g.pendingRevival, null);
  assert.equal(g.decision, null);
  assert.equal(g.response, null);
  assert.ok(revivalPrevented(g, 'a'));
  assert.ok(viewGame(g, 'a').revival.prevented);
  assert.throws(() => declare(g, 'a', 1), /prevented/);
  g.players[0].leaders.forEach((l) => {
    l.dead = true;
    l.deaths = 1;
  });
  assert.throws(
    () => applyAction(g, 'a', { type: 'reviveLeader', leader: 'atreides-0' }),
    /prevented/,
  );
  g.players[1].tanks = 2;
  g.players[1].reserves = 18;
  g = allow(declare(g, 'e', 2));
  assert.equal(g.players[1].tanks, 0);
  g.turn++;
  assert.ok(!revivalPrevented(g, 'a'));
  g = allow(declare(g, 'a', 1));
  assert.equal(g.players[0].tanks, 7);
  g.players[2].hand = [karama];
  assert.throws(() => prevent(g), /already been used/);
});
void test('ownership, actual Karama, window, target and decline validation reject immutably', () => {
  const idle = beforeRevival();
  assert.throws(() => prevent(idle), /declaration/);
  const g = declare(idle);
  const snapshot = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'a', { type: 'decision', decline: true }),
    /pending decision/,
  );
  assert.throws(
    () => applyAction(g, 't', { type: 'decision', decline: false }),
    /Allow the revival/,
  );
  assert.throws(
    () =>
      applyAction(g, 't', {
        type: 'card',
        card: karama.id,
        mode: 'special',
        target: 'e',
      }),
    /currently reviving/,
  );
  assert.throws(
    () =>
      applyAction(g, 't', { type: 'card', card: '__proto__', mode: 'special' }),
    /Karama card/,
  );
  assert.deepEqual(g, snapshot);
  const noCard = structuredClone(g);
  noCard.players[2].hand = [baseDeck().find((c) => c.kind === 'worthless')!];
  assert.throws(() => prevent(noCard), /Karama card/);
  const basic = beforeRevival();
  basic.advanced = false;
  assert.notEqual(declare(basic).decision?.kind, 'revivalStop');
});
void test('private leader quotes stay private through the stop decision and prevention removes the abandoned request', () => {
  let g = beforeRevival();
  const l = g.players[0].leaders[0];
  l.dead = true;
  l.deaths = 2;
  l.concealed = { captor: 'h', dead: false, deaths: 0 };
  g = applyAction(g, 'a', { type: 'requestLeaderRevival', leader: l.id });
  g = applyAction(g, 't', {
    type: 'quoteLeaderRevival',
    target: 'a',
    amount: 9,
  });
  g = applyAction(g, 'a', { type: 'acceptLeaderRevival' });
  assert.equal(g.decision?.kind, 'revivalStop');
  const other = viewGame(g, 'e');
  assert.ok(!JSON.stringify(other.decision).includes(l.id));
  assert.ok(!JSON.stringify(other.decision).includes('9'));
  assert.deepEqual(other.revivalRequests, {});
  g = prevent(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[0].spice, 20);
  assert.deepEqual(g.revivalRequests, {});
  assert.equal(viewGame(g, 'e').players[0].leaders[0].dead, false);
});
void test('allowing a revival resumes its discount/early-response chain exactly once', () => {
  let g = beforeRevival();
  g.players[0].ally = 't';
  g.players[2].ally = 'a';
  g = applyAction(g, 't', { type: 'tleilaxuAllyDiscount' });
  g = declare(g);
  g = applyAction(g, 't', { type: 'decision', decline: true });
  assert.equal(g.response, null);
  g = allow(g);
  assert.equal(g.players[0].spice, 19);
  assert.equal(g.players[0].tanks, 5);
  assert.equal(g.players[2].spice, 22);
  assert.throws(
    () => applyAction(g, 't', { type: 'decision', decline: true }),
    /Unknown|Unsupported|not available/i,
  );
});
void test('Emperor-funded extra revival waits for Tleilaxu and a stopped attempt consumes no payment or extra quota', () => {
  let g = beforeRevival();
  g.players[0].ally = 'e';
  g.players[1].ally = 'a';
  g = applyAction(g, 'e', { type: 'emperorRevival', amount: 3 });
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  assert.equal(g.decision?.kind, 'revivalStop');
  assert.equal(g.players[1].spice, 20);
  g = prevent(g);
  assert.equal(g.players[1].spice, 20);
  assert.equal(g.players[0].tanks, 8);
  assert.equal(g.emperorExtra?.a, undefined);
  assert.throws(
    () => applyAction(g, 'e', { type: 'emperorRevival', amount: 1 }),
    /prevented/,
  );
});
void test('allowing Emperor-funded revival preserves separate quota, correct payer and Tleilaxu income', () => {
  let g = beforeRevival();
  g.players[0].ally = 'e';
  g.players[1].ally = 'a';
  g = allow(applyAction(g, 'e', { type: 'emperorRevival', amount: 3 }));
  assert.equal(g.players[1].spice, 14);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[2].spice, 26);
  assert.equal(g.emperorExtra?.a, 3);
  assert.equal(g.players[0].revived, 0);
  assert.equal(g.players[0].tanks, 5);
});
void test('Ghola treachery and Emperor special Karama remain separate from blocked normal revivals', () => {
  let g = prevent(declare(beforeRevival()));
  placeFixtureHand(g, 0, [ghola]);
  g = allow(applyAction(g, 'a', { type: 'card', card: ghola.id, amount: 5 }));
  assert.equal(g.players[0].tanks, 3);
  assert.equal(g.players[0].revived, 0);
  let emperor = beforeRevival();
  emperor.players[1].tanks = 5;
  emperor.players[1].reserves = 15;
  emperor = prevent(declare(emperor, 'e', 2));
  emperor.players[1].hand = [karama];
  emperor = applyAction(emperor, 'e', {
    type: 'card',
    card: karama.id,
    mode: 'special',
    amount: 3,
  });
  assert.equal(emperor.players[1].tanks, 2);
  assert.equal(emperor.players[1].specialKaramaUsed, true);
});
void test('KH revival is prevented without changing its state, while a canceled attempt does not consume elite quota', () => {
  let g = beforeRevival();
  g.players[0].kwisatz = { dead: true, revivalCycle: 1 };
  g.players[0].revivalCycle = 1;
  g = applyAction(g, 'a', { type: 'reviveKwisatz' });
  g = prevent(g);
  assert.equal(g.players[0].kwisatz?.dead, true);
  assert.equal(g.players[0].leaderRevived, false);
  let elite = beforeRevival();
  elite.players[1].tanks = 5;
  elite.players[1].reserves = 15;
  elite.players[1].elites = { tanks: 1, reserves: 4, forces: {}, revived: 0 };
  elite = applyAction(elite, 'e', { type: 'revive', amount: 2, elite: 1 });
  elite = prevent(elite);
  assert.equal(elite.players[1].elites?.revived, 0);
  assert.equal(elite.players[1].elites?.tanks, 1);
});
void test('AI decides from public threats, preserves allies and progresses without a Karama', () => {
  for (const difficulty of DIFFICULTIES) {
    const before = beforeRevival();
    before.players[0].tanks = 15;
    before.players[0].reserves = 5;
    before.players[2].bot = difficulty;
    const g = declare(before);
    const action = botActions(viewGame(g, 't'))[0];
    assert.equal(action.mode, 'special');
    assert.doesNotThrow(() => applyAction(g, 't', action));
    const changed = structuredClone(g);
    changed.players[0].spice = 999;
    assert.deepEqual(
      botActions(viewGame(changed, 't')),
      botActions(viewGame(g, 't')),
    );
    g.players[2].ally = 'a';
    g.players[0].ally = 't';
    assert.deepEqual(botActions(viewGame(g, 't'))[0], {
      type: 'decision',
      decline: true,
    });
    g.players[2].ally = null;
    g.players[0].ally = null;
    g.players[2].hand = [];
    assert.deepEqual(botActions(viewGame(g, 't'))[0], {
      type: 'decision',
      decline: true,
    });
  }
});
void test('AI progresses a blocked Revival phase and retains force and spice invariants', () => {
  const before = beforeRevival();
  before.players[0].tanks = 15;
  before.players[0].reserves = 5;
  before.players.forEach((p) => {
    p.bot = 'Brutal';
  });
  let g = runBots(before);
  for (let i = 0; i < 8 && g.phase === 4; i++) g = runBots(g);
  assert.notEqual(g.phase, 4);
  assert.equal(g.players[2].specialKaramaUsed, true);
  for (const p of g.players) {
    assert.ok(p.spice >= 0);
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  }
});
