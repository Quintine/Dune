import { placeFixtureHand } from './fixture-hand';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
  type Player,
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { forceRevivalLimit, forceRevivalQuote } from '../game/revival';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createTechTokens } from '../game/tech-tokens';
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
function tanks(p: Player, n: number) {
  p.tanks = n;
  p.reserves = 20 - n;
}
function dead(p: Player, indices = [0]) {
  for (const i of indices) {
    p.leaders[i].dead = true;
    p.leaders[i].deaths = 1;
  }
}
function allow(state: Game) {
  let g = state;
  while (g.response || g.decision?.kind === 'revivalStop')
    g =
      g.decision?.kind === 'revivalStop'
        ? applyAction(g, g.decision.player, { type: 'decision', decline: true })
        : applyAction(
            g,
            g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
            { type: 'passResponse' },
          );
  return g;
}
function passWindow(state: Game) {
  let g = state;
  const kind = g.response!.kind;
  while (g.response?.kind === kind)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
const revive = (g: Game, id: string, amount: number, elite = 0) =>
  applyAction(g, id, { type: 'revive', amount, elite });
const karama = baseDeck().find((c) => c.effect === 'karama')!;
function cancel(g: Game, id = 'h') {
  return applyAction(g, id, { type: 'card', card: karama.id, mode: 'cancel' });
}
function request(g: Game, id = 'a', leader = 'atreides-0') {
  return applyAction(g, id, { type: 'requestLeaderRevival', leader });
}
function quote(g: Game, amount: number, id = 'a') {
  return applyAction(g, 't', {
    type: 'quoteLeaderRevival',
    target: id,
    amount,
  });
}
function conserved(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    assert.ok(p.spice >= 0);
  }
}
void test('paid and free force revival income goes to Tleilaxu after a separate response', () => {
  const before = fixture();
  before.players[3].hand = [karama];
  tanks(before.players[0], 3);
  let g = revive(before, 'a', 3);
  assert.equal(g.players[0].spice, 18);
  assert.equal(g.players[0].reserves, 20);
  assert.equal(g.players[2].spice, 20);
  assert.equal(g.response?.kind, 'revivalIncome');
  g = allow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.players[2].spice, 23);
  conserved(g);
});
void test('splitting free revival into individual forces never duplicates its income', () => {
  const before = fixture();
  tanks(before.players[0], 3);
  let g = allow(revive(before, 'a', 1));
  assert.equal(g.players[2].spice, 21);
  g = allow(revive(g, 'a', 1));
  assert.equal(g.players[2].spice, 21);
  g = allow(revive(g, 'a', 1));
  assert.equal(g.players[2].spice, 23);
});
void test('Karama redirects one revival payment without undoing force return or granting a second free-income claim', () => {
  const before = fixture();
  tanks(before.players[0], 3);
  before.players[3].hand = [karama];
  let g = cancel(revive(before, 'a', 1));
  assert.equal(g.players[2].spice, 20);
  assert.equal(g.players[0].tanks, 2);
  g = allow(revive(g, 'a', 1));
  assert.equal(g.players[2].spice, 20);
  g = allow(revive(g, 'a', 1));
  assert.equal(g.players[2].spice, 22);
});
void test('Tleilaxu can revive all twenty forces at half price and gain their own free-revival income', () => {
  const before = fixture();
  before.players[3].hand = [karama];
  tanks(before.players[2], 20);
  let g = revive(before, 't', 20);
  assert.equal(g.response?.kind, 'revivalLimit');
  assert.equal(g.players[2].tanks, 20);
  assert.equal(g.players[2].spice, 20);
  g = passWindow(g);
  assert.equal(g.response?.kind, 'revivalDiscount');
  g = allow(g);
  assert.equal(g.players[2].tanks, 0);
  assert.equal(g.players[2].revived, 20);
  assert.equal(g.players[2].spice, 3);
  conserved(g);
});
void test('canceling the expanded limit aborts the pending revival and restores three-force limits for everyone', () => {
  const before = fixture();
  tanks(before.players[0], 5);
  tanks(before.players[2], 6);
  before.players[3].hand = [karama];
  let g = applyAction(before, 't', {
    type: 'tleilaxuRevivalLimit',
    target: 'a',
  });
  g = cancel(revive(g, 't', 6));
  assert.equal(g.pendingRevival, null);
  assert.equal(g.players[2].revived, 0);
  assert.equal(g.players[2].spice, 20);
  assert.equal(forceRevivalLimit(g, g.players[0]), 3);
  assert.throws(() => revive(g, 'a', 5), /integer/);
  assert.throws(
    () => applyAction(g, 't', { type: 'tleilaxuRevivalLimit', target: 'a' }),
    /unavailable/,
  );
  g = allow(revive(g, 't', 3));
  assert.equal(g.players[2].revived, 3);
  conserved(g);
});
void test('a canceled discount recomputes the price before any payment or force mutation', () => {
  const before = fixture();
  tanks(before.players[2], 3);
  before.players[3].hand = [karama];
  let g = revive(before, 't', 3);
  assert.equal(g.response?.kind, 'revivalDiscount');
  g = allow(cancel(g));
  assert.equal(g.players[2].spice, 19);
  assert.equal(g.revivalRules?.fullPrice, true);
  // Two spice paid at full rate and one free-revival income returned.
  const poor = fixture();
  tanks(poor.players[2], 3);
  poor.players[2].spice = 1;
  poor.players[3].hand = [karama];
  const stopped = cancel(revive(poor, 't', 3));
  assert.equal(stopped.pendingRevival, null);
  assert.equal(stopped.players[2].tanks, 3);
  assert.equal(stopped.players[2].spice, 1);
});
void test('Tleilaxu grant five force revivals and optional half price to an ally who pays the cost', () => {
  const before = fixture();
  before.players[0].ally = 't';
  before.players[2].ally = 'a';
  tanks(before.players[0], 5);
  let g = applyAction(before, 't', {
    type: 'tleilaxuRevivalLimit',
    target: 'a',
  });
  g = applyAction(g, 't', { type: 'tleilaxuAllyDiscount' });
  assert.deepEqual(forceRevivalQuote(g, g.players[0], 5), {
    free: 2,
    normalCost: 6,
    cost: 3,
  });
  g = allow(revive(g, 'a', 5));
  assert.equal(g.players[0].spice, 17);
  assert.equal(g.players[2].spice, 24);
  conserved(g);
});
void test('an ally discount can be canceled without changing another faction’s standard free allowance', () => {
  const before = fixture();
  before.players[0].ally = 't';
  before.players[2].ally = 'a';
  tanks(before.players[0], 3);
  before.players[3].hand = [karama];
  let g = applyAction(before, 't', { type: 'tleilaxuAllyDiscount' });
  g = allow(cancel(revive(g, 'a', 3)));
  assert.equal(g.players[0].spice, 18);
  assert.equal(g.players[2].spice, 23);
  assert.equal(g.revivalRules?.discountBlocked, true);
});
void test('ordinary leader revivals pay Tleilaxu and preserve native revival-cycle eligibility', () => {
  const before = fixture();
  dead(before.players[0], [0, 1, 2, 3, 4]);
  let g = applyAction(before, 'a', {
    type: 'reviveLeader',
    leader: 'atreides-0',
  });
  assert.equal(g.response, null);
  g = allow(g);
  assert.equal(g.players[0].spice, 15);
  assert.equal(g.players[2].spice, 25);
  assert.equal(g.players[0].revivalCycle, 1);
  assert.throws(
    () => applyAction(g, 'a', { type: 'reviveLeader', leader: 'atreides-1' }),
    /one leader/,
  );
});
void test('Tleilaxu revive multiple own leaders early at rounded half price including Zoal', () => {
  const before = fixture();
  dead(before.players[2], [0, 1, 2]);
  let g = applyAction(before, 't', {
    type: 'reviveLeader',
    leader: 'tleilaxu-0',
  });
  assert.equal(g.response, null);
  assert.equal(g.players[2].leaders[0].dead, false);
  g = allow(g);
  assert.equal(g.players[2].spice, 18);
  g = allow(
    applyAction(g, 't', { type: 'reviveLeader', leader: 'tleilaxu-1' }),
  );
  g = allow(
    applyAction(g, 't', { type: 'reviveLeader', leader: 'tleilaxu-2' }),
  );
  assert.equal(g.players[2].spice, 14);
  assert.ok(g.players[2].leaders.every((l) => !l.dead));
});
void test('negotiated early revival is requested, privately quoted, accepted and settled once', () => {
  const before = fixture();
  before.players[3].hand = [karama];
  dead(before.players[0]);
  let g = request(before);
  assert.deepEqual(viewGame(g, 'h').revivalRequests, {});
  assert.equal(viewGame(g, 't').revivalRequests.a.leader, 'atreides-0');
  g = quote(g, 7);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].leaders[0].dead, true);
  g = applyAction(g, 'a', { type: 'acceptLeaderRevival' });
  assert.equal(g.response?.kind, 'earlyRevival');
  assert.equal('pendingRevival' in viewGame(g, 'h'), false);
  g = passWindow(JSON.parse(JSON.stringify(g)));
  assert.equal(g.response?.kind, 'revivalIncome');
  assert.equal(viewGame(g, 'h').response?.amount, undefined);
  g = allow(g);
  assert.equal(g.players[0].spice, 13);
  assert.equal(g.players[2].spice, 27);
  assert.equal(g.players[0].leaders[0].dead, false);
  assert.deepEqual(g.revivalRequests, {});
  assert.throws(() => applyAction(g, 'a', { type: 'acceptLeaderRevival' }));
});
void test('a negotiated zero-spice return is allowed but all-unavailable leaders use ordinary paid revival', () => {
  const before = fixture();
  dead(before.players[0]);
  const g = allow(
    applyAction(quote(request(before), 0), 'a', {
      type: 'acceptLeaderRevival',
    }),
  );
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[2].spice, 20);
  const all = fixture();
  dead(all.players[0], [0, 1, 2, 3, 4]);
  assert.throws(() => request(all), /ordinary revival/);
  all.players[0].leaders[4].dead = false;
  all.players[0].leaders[4].capturedBy = 'h';
  assert.throws(() => request(all), /ordinary revival/);
});
void test('an early-return cancellation preserves a concealed leader and keeps its identity private', () => {
  const before = fixture();
  dead(before.players[0]);
  before.players[0].leaders[0].deaths = 2;
  before.players[0].leaders[0].concealed = {
    captor: 'h',
    dead: false,
    deaths: 0,
  };
  before.players[1].hand = [karama];
  let g = applyAction(quote(request(before), 3), 'a', {
    type: 'acceptLeaderRevival',
  });
  g = cancel(g, 'e');
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[2].spice, 20);
  assert.deepEqual(viewGame(g, 'e').revivalRules.earlyBlocked, []);
  assert.deepEqual(viewGame(g, 'a').revivalRules.earlyBlocked, [
    'a:atreides-0',
  ]);
  assert.throws(
    () => applyAction(g, 'a', { type: 'acceptLeaderRevival' }),
    /canceled/,
  );
});
void test('quote ownership, negative prices, missing requests, refusal and withdrawal are enforced', () => {
  const before = fixture();
  dead(before.players[0]);
  let g = request(before);
  const snapshot = structuredClone(g);
  assert.throws(
    () =>
      applyAction(g, 'e', {
        type: 'quoteLeaderRevival',
        target: 'a',
        amount: 0,
      }),
    /Only Tleilaxu/,
  );
  assert.throws(() => quote(g, -1), /integer/);
  assert.throws(() =>
    applyAction(g, 't', {
      type: 'quoteLeaderRevival',
      target: '__proto__',
      amount: 1,
    }),
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(Object.prototype, 'price'),
    false,
  );
  assert.deepEqual(g, snapshot);
  assert.throws(
    () => applyAction(g, 'a', { type: 'acceptLeaderRevival' }),
    /quote/,
  );
  g = applyAction(g, 't', { type: 'declineLeaderRevival', target: 'a' });
  assert.throws(
    () => applyAction(g, 'a', { type: 'acceptLeaderRevival' }),
    /declined/,
  );
  g = quote(g, 2);
  g = applyAction(g, 'a', { type: 'cancelLeaderRequest' });
  assert.deepEqual(g.revivalRequests, {});
});
void test('KH can be revived through a negotiated early return', () => {
  const before = fixture();
  before.advanced = true;
  before.players[0].kwisatz = { dead: true };
  let g = request(before, 'a', 'kwisatz');
  g = allow(applyAction(quote(g, 4), 'a', { type: 'acceptLeaderRevival' }));
  assert.equal(g.players[0].kwisatz?.dead, false);
  assert.equal(g.players[0].kwisatz?.revivalCycle, 2);
  assert.equal(g.players[2].spice, 24);
});
void test('Ghola treachery grants one income separately from normal free revival, including outside Revival', () => {
  const before = fixture();
  tanks(before.players[0], 6);
  const ghola = baseDeck().find((c) => c.effect === 'ghola')!;
  placeFixtureHand(before, 0, [ghola]);
  let g = allow(revive(before, 'a', 1));
  g.phase = 8;
  g = applyAction(g, 'a', { type: 'card', card: ghola.id, amount: 5 });
  assert.equal(g.response, null);
  g = allow(g);
  assert.equal(g.players[2].spice, 22);
  assert.equal(g.players[0].revived, 1);
  conserved(g);
});
void test('Emperor extra revival payments go to Tleilaxu after the Emperor response', () => {
  const before = fixture();
  before.players[3].hand = [karama];
  before.players[0].ally = 'e';
  before.players[1].ally = 'a';
  tanks(before.players[0], 8);
  let g = applyAction(before, 't', {
    type: 'tleilaxuRevivalLimit',
    target: 'a',
  });
  g = allow(revive(g, 'a', 5));
  g = applyAction(g, 'e', { type: 'emperorRevival', amount: 3 });
  assert.equal(g.response?.kind, 'emperorRevival');
  g = passWindow(g);
  assert.equal(g.response?.kind, 'revivalIncome');
  g = allow(g);
  assert.equal(g.players[0].tanks, 0);
  assert.equal(g.players[0].revived, 5);
  assert.equal(g.emperorExtra.a, 3);
  assert.equal(g.players[1].spice, 14);
  assert.equal(g.players[2].spice, 33);
  conserved(g);
});
void test('elite revival cap is preserved under the larger limit and pending-discount serialization', () => {
  const before = fixture();
  before.advanced = true;
  tanks(before.players[1], 5);
  before.players[1].elites = { reserves: 3, tanks: 2, forces: {}, revived: 0 };
  let g = applyAction(before, 't', {
    type: 'tleilaxuRevivalLimit',
    target: 'e',
  });
  assert.throws(() => revive(g, 'e', 5, 2), /one elite/);
  g = allow(revive(g, 'e', 4, 1));
  assert.equal(g.players[1].elites?.revived, 1);
  assert.equal(g.players[1].elites?.reserves, 4);
  assert.throws(() => revive(g, 'e', 1, 1), /one elite/);
  conserved(g);
});
void test('tech-token income stays separate from Tleilaxu revival income', () => {
  const before = fixture();
  tanks(before.players[0], 2);
  before.techTokens = createTechTokens();
  before.techTokens.axlotl.owner = 't';
  const g = allow(revive(before, 'a', 2));
  assert.equal(g.players[2].spice, 21);
  assert.equal(g.techTokens?.axlotl.spice, 1);
});
void test('all AI levels handle Tleilaxu permissions, prices and private revival requests', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[2].bot = difficulty;
    tanks(g.players[0], 5);
    g.revivalRequests = { a: { leader: 'atreides-0', price: null } };
    const choices = botActions(viewGame(g, 't'));
    assert.ok(choices.some((a) => a.type === 'quoteLeaderRevival'));
    assert.ok(choices.some((a) => a.type === 'tleilaxuRevivalLimit'));
    assert.doesNotThrow(() => applyAction(g, 't', choices[0]));
    const changed = structuredClone(g);
    changed.players[0].spice = 999;
    assert.deepEqual(botActions(viewGame(changed, 't')), choices);
  }
});
void test('AI-only revival phase completes without a pending transaction or negative resources', () => {
  let g = fixture();
  for (const p of g.players) {
    p.bot = 'Hard';
    tanks(p, 8);
    dead(p, [0, 1, 2]);
  }
  for (let i = 0; i < 20 && g.phase === 4; i++) g = runBots(g, 20);
  assert.notEqual(g.phase, 4);
  assert.equal(g.pendingRevival ?? null, null);
  conserved(g);
});
