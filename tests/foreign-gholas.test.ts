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
} from '../game/engine';
import { baseDeck, leaders } from '../game/cards';
import { normalRevivalCycle } from '../game/revival';
import { controlsLeader } from '../game/leader-control';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
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
const gholaCard = baseDeck().find((c) => c.effect === 'ghola')!;
function die(g: Game, player = 0, index = 0, deaths = 1) {
  const l = g.players[player].leaders[index];
  l.dead = true;
  l.deaths = deaths;
  return l;
}
function allow(state: Game, only?: string) {
  let g = state;
  while (
    (g.response && (!only || g.response.kind === only)) ||
    g.decision?.kind === 'revivalStop'
  )
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
function acquire(g: Game, leader = 'atreides-0') {
  return applyAction(g, 't', { type: 'reviveForeignGhola', leader });
}
function acquired(leader = 'atreides-0') {
  const g = fixture();
  die(g, 2);
  die(g, leader.startsWith('emperor') ? 1 : 0);
  return allow(acquire(g, leader));
}
function startBattle(state: Game) {
  const before = structuredClone(state);
  before.phase = 6;
  before.order = ['t', 'a', 'e', 'h'];
  before.active = 't';
  for (const p of before.players) {
    p.forces = {};
    p.reserves = 20;
    p.traitors = [];
  }
  for (const id of ['t', 'a']) {
    const p = before.players.find((p) => p.id === id)!;
    p.forces = { 'arrakeen:10': 5 };
    p.reserves = 15;
  }
  let g = allow(
    applyAction(before, 't', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'a',
    }),
  );
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}
void test('foreign ghola acquisition pays the bank, changes control without cloning identity, and survives JSON', () => {
  const g = acquired();
  const l = g.players[0].leaders[0];
  assert.equal(l.dead, false);
  assert.equal(l.gholaBy, 't');
  assert.equal(l.faction, 'atreides');
  assert.equal(l.deaths, 1);
  assert.equal(g.players[2].spice, 17);
  assert.equal(
    g.players.flatMap((p) => p.leaders).filter((leader) => leader.id === l.id)
      .length,
    1,
  );
  assert.ok(controlsLeader(g.players[2], l));
  assert.ok(!controlsLeader(g.players[0], l));
  const restored = JSON.parse(JSON.stringify(g)) as Game;
  for (const viewer of g.players) {
    const view = viewGame(restored, viewer.id);
    assert.equal(
      view.players[2].leaders.find((leader) => leader.id === l.id)?.gholaBy,
      't',
    );
  }
});
void test('multiple foreign gholas fill exactly five active leaders in one phase', () => {
  let g = fixture();
  die(g, 2, 0);
  die(g, 2, 1);
  die(g);
  die(g, 0, 1);
  die(g, 0, 2);
  g = allow(acquire(g));
  g = allow(acquire(g, 'atreides-1'));
  const snapshot = structuredClone(g);
  assert.throws(() => acquire(g, 'atreides-2'), /up to five/);
  assert.deepEqual(g, snapshot);
  assert.equal(
    viewGame(g, 't').players[2].leaders.filter(
      (l) => !l.dead && controlsLeader(g.players[2], l),
    ).length,
    5,
  );
});
void test('foreign acquisition enforces advanced mode, faction, phase, death, ownership, funds and Auditor exclusion', () => {
  const g = fixture();
  die(g, 2);
  die(g);
  for (const [change, pattern] of [
    [
      (x: Game) => {
        x.advanced = false;
      },
      /advanced/,
    ],
    [
      (x: Game) => {
        x.phase = 5;
      },
      /advanced/,
    ],
    [
      (x: Game) => {
        x.players[0].leaders[0].dead = false;
      },
      /dead leader/,
    ],
    [
      (x: Game) => {
        x.players[0].leaders[0].capturedBy = 'h';
      },
      /dead leader/,
    ],
    [
      (x: Game) => {
        x.players[2].spice = 2;
      },
      /spice/,
    ],
  ] as const) {
    const altered = structuredClone(g);
    change(altered);
    const snapshot = structuredClone(altered);
    assert.throws(() => acquire(altered), pattern);
    assert.deepEqual(altered, snapshot);
  }
  const auditorOwner = newPlayer('c', 'CHOAM', 'choam');
  auditorOwner.leaders.push({
    id: 'choam-auditor',
    name: 'Auditor',
    faction: 'choam',
    strength: 2,
    dead: true,
    deaths: 1,
  });
  g.players.push(auditorOwner);
  assert.throws(() => acquire(g, 'choam-auditor'), /Auditor/);
  assert.throws(
    () =>
      applyAction(g, 'a', { type: 'reviveForeignGhola', leader: 'atreides-0' }),
    /advanced/,
  );
  assert.throws(() => acquire(g, 'tleilaxu-0'), /another faction/);
  assert.throws(() => acquire(g, 'kwisatz'), /another faction/);
});
void test('specific-ghola Karama cancellation preserves cost and identity and blocks only that leader for this turn', () => {
  let g = fixture();
  die(g, 2);
  die(g);
  die(g, 0, 1);
  g.players[3].hand = [karama];
  g = acquire(g);
  assert.equal(g.response?.kind, 'foreignGhola');
  const hidden = JSON.stringify(viewGame(g, 'e').response);
  assert.ok(!hidden.includes('atreides-0'));
  g = applyAction(g, 'h', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.players[2].spice, 20);
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[0].leaders[0].gholaBy, undefined);
  assert.throws(() => acquire(g), /canceled this turn/);
  assert.deepEqual(viewGame(g, 't').players[2].gholaBlocked, ['atreides-0']);
  assert.equal(viewGame(g, 'a').players[2].gholaBlocked, undefined);
  g = allow(acquire(g, 'atreides-1'));
  assert.equal(g.players[0].leaders[1].dead, false);
  g.turn++;
  die(g, 2, 1);
  g = allow(acquire(g));
  assert.equal(g.players[0].leaders[0].dead, false);
});
void test('ghola discount has its own response and canceled discount cannot partially acquire an unaffordable leader', () => {
  let g = fixture();
  die(g, 2);
  die(g);
  g.players[2].spice = 3;
  g.players[3].hand = [karama];
  g = allow(acquire(g), 'foreignGhola');
  assert.equal(g.response?.kind, 'revivalDiscount');
  g = applyAction(g, 'h', { type: 'card', card: karama.id, mode: 'cancel' });
  assert.equal(g.players[2].spice, 3);
  assert.equal(g.players[0].leaders[0].dead, true);
  assert.equal(g.players[0].leaders[0].gholaBy, undefined);
  assert.equal(g.pendingRevival, null);
});
void test('face-down executed leaders can become gholas without losing death history or leaking pending identity', () => {
  let g = fixture();
  g.players[3].hand = [karama];
  die(g, 2);
  const l = die(g, 0, 0, 2);
  l.concealed = { captor: 'h', dead: false, deaths: 0 };
  g = acquire(g);
  assert.equal(viewGame(g, 'e').players[0].leaders[0].dead, false);
  assert.equal(viewGame(g, 't').players[0].leaders[0].dead, true);
  g = allow(g);
  assert.equal(g.players[0].leaders[0].concealed, undefined);
  assert.equal(g.players[0].leaders[0].deaths, 2);
  assert.equal(
    viewGame(g, 'e').players[2].leaders.find((leader) => leader.id === l.id)
      ?.gholaBy,
    't',
  );
});
void test('a living ghola cannot be sold back; death enables a private negotiated return even with all native leaders unavailable', () => {
  let g = acquired();
  assert.throws(
    () =>
      applyAction(g, 'a', {
        type: 'requestLeaderRevival',
        leader: 'atreides-0',
      }),
    /dead native/,
  );
  g.players[0].leaders.forEach((l) => {
    l.dead = true;
    l.deaths = 2;
  });
  assert.throws(
    () => applyAction(g, 'a', { type: 'reviveLeader', leader: 'atreides-0' }),
    /dead leader/,
  );
  g = applyAction(g, 'a', {
    type: 'requestLeaderRevival',
    leader: 'atreides-0',
  });
  g = applyAction(g, 't', {
    type: 'quoteLeaderRevival',
    target: 'a',
    amount: 7,
  });
  assert.deepEqual(viewGame(g, 'e').revivalRequests, {});
  g = allow(applyAction(g, 'a', { type: 'acceptLeaderRevival' }));
  assert.equal(g.players[0].spice, 13);
  assert.equal(g.players[2].spice, 24);
  assert.equal(g.players[0].leaders[0].gholaBy, undefined);
  assert.equal(g.players[0].leaders[0].dead, false);
  assert.equal(g.players[0].leaderRevived, true);
  assert.ok(
    !viewGame(g, 't').players[2].leaders.some((l) => l.id === 'atreides-0'),
  );
});
void test('a rejected or stale buyback cannot transfer the leader or charge the original owner', () => {
  let g = acquired();
  die(g, 0, 0, 2);
  g = applyAction(g, 'a', {
    type: 'requestLeaderRevival',
    leader: 'atreides-0',
  });
  g = applyAction(g, 't', { type: 'declineLeaderRevival', target: 'a' });
  assert.throws(
    () => applyAction(g, 'a', { type: 'acceptLeaderRevival' }),
    /declined/,
  );
  g = applyAction(g, 't', {
    type: 'quoteLeaderRevival',
    target: 'a',
    amount: 0,
  });
  g = allow(acquire(g));
  const snapshot = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'a', { type: 'acceptLeaderRevival' }),
    /dead native/,
  );
  assert.deepEqual(g, snapshot);
});
void test('ghola control counts as native unavailability for ordinary revival cycles', () => {
  const g = acquired();
  for (let i = 1; i < 5; i++) die(g, 0, i);
  assert.equal(normalRevivalCycle(g.players[0]), 1);
  const revived = allow(
    applyAction(g, 'a', { type: 'reviveLeader', leader: 'atreides-1' }),
  );
  assert.equal(revived.players[0].leaders[1].dead, false);
  assert.equal(revived.players[0].leaders[0].gholaBy, 't');
});
void test('Ghola treachery revives an existing controlled ghola, but its native faction cannot bypass a buyback', () => {
  let g = acquired();
  die(g, 0, 0, 2);
  g.phase = 7;
  placeFixtureHand(g, 0, [gholaCard]);
  assert.throws(
    () =>
      applyAction(g, 'a', {
        type: 'card',
        card: gholaCard.id,
        leader: 'atreides-0',
      }),
    /your pool/,
  );
  g.players[0].hand = [];
  placeFixtureHand(g, 2, [gholaCard]);
  g = allow(
    applyAction(g, 't', {
      type: 'card',
      card: gholaCard.id,
      leader: 'atreides-0',
    }),
  );
  assert.equal(g.players[0].leaders[0].dead, false);
  assert.equal(g.players[0].leaders[0].gholaBy, 't');
  assert.equal(g.players[2].spice, 18);
});
void test('ghola leaders fight for Tleilaxu and remain susceptible to their original traitor cards', () => {
  let g = startBattle(acquired('emperor-0'));
  g.players[0].traitors = ['emperor-0'];
  g = applyAction(g, 't', { type: 'battlePlan', dial: 0, leader: 'emperor-0' });
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
  });
  g = applyAction(g, 't', { type: 'traitorCall', call: false });
  g = applyAction(g, 'a', { type: 'traitorCall', call: true });
  assert.equal(g.players[1].leaders[0].dead, true);
  assert.equal(g.players[1].leaders[0].deaths, 2);
  assert.equal(g.players[1].leaders[0].gholaBy, 't');
  assert.equal(g.players[2].tanks, 5);
});
void test('a native faction cannot seal its living foreign ghola in a battle plan', () => {
  let g = startBattle(acquired());
  g = applyAction(g, 't', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
  });
  const snapshot = structuredClone(g);
  assert.throws(
    () =>
      applyAction(g, 'a', {
        type: 'battlePlan',
        dial: 0,
        leader: 'atreides-0',
      }),
    /leader/i,
  );
  assert.deepEqual(g, snapshot);
});
void test('all AI difficulties acquire only affordable gholas from their private projection and recognize control', () => {
  for (const difficulty of DIFFICULTIES) {
    const before = fixture();
    die(before, 2);
    die(before);
    before.players[2].bot = difficulty;
    const actions = botActions(viewGame(before, 't'));
    const action = actions.find((a) => a.type === 'reviveForeignGhola')!;
    assert.ok(action);
    const g = allow(applyAction(before, 't', action));
    const combat = startBattle(g);
    const plans = botActions(viewGame(combat, 't')).filter(
      (a) => a.type === 'battlePlan',
    );
    assert.ok(plans.some((a) => a.leader === 'atreides-0'));
    const altered = structuredClone(before);
    altered.players[0].spice = 9999;
    assert.deepEqual(botActions(viewGame(altered, 't')), actions);
  }
});
void test('AI revival with foreign gholas and private buybacks terminates without duplicating leaders', () => {
  const before = fixture();
  die(before, 2, 0);
  die(before, 2, 1);
  die(before);
  die(before, 0, 1);
  before.players.forEach((p) => {
    p.bot = 'Hard';
  });
  let g = runBots(before);
  for (let i = 0; i < 12 && g.phase === 4; i++) g = runBots(g);
  assert.notEqual(g.phase, 4);
  const identities = g.players.flatMap((p) => p.leaders.map((l) => l.id));
  assert.equal(identities.length, 20);
  assert.equal(new Set(identities).size, 20);
  assert.ok(g.players.every((p) => p.spice >= 0));
});

void test('Harkonnen capture reveals a ghola identity to its current controller and returns control after one use', () => {
  let g = acquired('emperor-0');
  for (const l of g.players[2].leaders) {
    l.dead = true;
    l.deaths = 1;
  }
  g.phase = 6;
  g.active = 'h';
  g.order = ['h', 't', 'a', 'e'];
  for (const id of ['h', 't']) {
    const p = g.players.find((p) => p.id === id)!;
    p.forces = { 'arrakeen:10': 5 };
    p.reserves = 15;
  }
  g = allow(
    applyAction(g, 'h', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 't',
    }),
  );
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  g = applyAction(g, 'h', {
    type: 'battlePlan',
    dial: 1,
    support: 1,
    leader: 'harkonnen-0',
  });
  g = applyAction(g, 't', { type: 'battlePlan', dial: 0, leader: 'emperor-0' });
  g = applyAction(g, 'h', { type: 'traitorCall', call: false });
  g = applyAction(g, 't', { type: 'traitorCall', call: false });
  if (g.decision?.kind === 'battleLosses')
    g = applyAction(g, 'h', { type: 'decision', choice: 0 });
  assert.equal(g.decision?.kind, 'captureOffer');
  g = allow(applyAction(g, 'h', { type: 'decision', accept: true }));
  assert.equal(g.decision?.kind, 'capturedLeader');
  assert.equal(
    (viewGame(g, 't').decision as { leader: string }).leader,
    'emperor-0',
  );
  assert.equal((viewGame(g, 'e').decision as { leader: string }).leader, '');
  assert.equal(
    viewGame(g, 't').players[2].leaders.find((l) => l.id === 'emperor-0')
      ?.capturedBy,
    'h',
  );
  assert.equal(viewGame(g, 'e').players[1].leaders[0].capturedBy, undefined);
  g = applyAction(g, 'h', { type: 'decision', mode: 'keep' });
  if (g.decision?.kind === 'faceDance')
    g = applyAction(g, 't', { type: 'decision', reveal: false });
  g.phase = 6;
  g.active = 'h';
  g.order = ['h', 'a', 't', 'e'];
  g.response = null;
  g.players[0].forces = { 'arrakeen:10': 5 };
  g.players[0].reserves = 15;
  g = allow(
    applyAction(g, 'h', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 'a',
    }),
  );
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  g = applyAction(g, 'h', { type: 'battlePlan', dial: 0, leader: 'emperor-0' });
  g = applyAction(g, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-0',
  });
  g = applyAction(g, 'h', { type: 'traitorCall', call: false });
  g = applyAction(g, 'a', { type: 'traitorCall', call: false });
  assert.equal(g.players[1].leaders[0].capturedBy, undefined);
  assert.equal(g.players[1].leaders[0].gholaBy, 't');
  assert.equal(g.players[1].leaders[0].dead, false);
  assert.ok(controlsLeader(g.players[2], g.players[1].leaders[0]));
});

void test('AI requests an eligible dead-ghola buyback when every native leader is unavailable', () => {
  const g = acquired();
  for (const leader of g.players[0].leaders) {
    leader.dead = true;
    leader.deaths = 2;
  }
  g.players[0].leaders[1].strength = 9;
  for (const difficulty of DIFFICULTIES) {
    g.players[0].bot = difficulty;
    const actions = botActions(viewGame(g, 'a'));
    const request = actions.find(
      (action) => action.type === 'requestLeaderRevival',
    );
    assert.equal(request?.leader, 'atreides-0');
    assert.doesNotThrow(() => applyAction(g, 'a', request!));
  }
});
