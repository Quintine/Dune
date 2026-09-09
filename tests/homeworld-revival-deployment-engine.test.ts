import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions } from '../game/bots';
import {
  homeworldRevivalDeploymentActions,
  homeworldRevivalActionBlock,
} from '../game/homeworld-revival-deployment-options';
import {
  homeworldRevivalFixture,
  enterHomeworldRevival,
  positionRevivalForces,
  holdRevivalCard,
  revivalPlayer as p,
  revivalReload as reload,
  revivalInventory as inventory,
  rejectRevivalAction as reject,
} from './fixture-homeworld-revival';

function choice(g: Game, actor: string, destination = 'arrakeen:10'): Action {
  const offer = viewGame(g, actor).homeworldRevivalDeployment;
  assert.ok(offer);
  assert.equal(offer.player, actor);
  assert.ok(
    offer.destinations.some(
      (target) => target.id === destination && !target.blocked,
    ),
  );
  return {
    type: 'decision',
    event: offer.event,
    destination,
    amount: offer.normal + offer.elite,
  };
}
function stable(g: Game) {
  inventory(g);
  const before = reload(g);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(g))), before);
  for (const player of g.players) {
    const view = viewGame(reload(g), player.id);
    for (const other of view.players.filter(
      (other) => other.id !== player.id,
    )) {
      assert.equal(other.hand, undefined);
      assert.equal(other.spice, undefined);
    }
  }
}

void test('actual high Southern revival moves every newly revived Basic star once while ordinary returns stay native', () => {
  let g = enterHomeworldRevival(homeworldRevivalFixture());
  const old = structuredClone(p(g, 'f'));
  g = applyAction(g, 'f', { type: 'revive', amount: 3, elite: 2 });
  assert.equal(g.decision?.kind, 'homeworldRevivalDeployment');
  assert.equal(p(g, 'f').reserves, old.reserves + 3);
  assert.equal(p(g, 'f').elites!.reserves, old.elites!.reserves + 2);
  assert.deepEqual(g.homeworldRevivalReturn!.group, {
    amount: 3,
    elite: 2,
    free: 3,
  });
  assert.equal(viewGame(g, 'f').homeworldRevivalDeployment!.normal, 0);
  assert.equal(viewGame(g, 'f').homeworldRevivalDeployment!.elite, 2);
  assert.ok(
    viewGame(g, 'f').homeworldRevivalDeployment!.destinations.every(
      (target) => !target.homeworld,
    ),
  );
  stable(g);
  const action = choice(g, 'f');
  for (const amount of [0, 1, 3])
    reject(g, 'f', { ...action, amount }, /entire/);
  g = applyAction(reload(g), 'f', action);
  assert.equal(p(g, 'f').reserves, old.reserves + 1);
  assert.equal(p(g, 'f').elites!.reserves, old.elites!.reserves);
  assert.equal(p(g, 'f').forces['arrakeen:10'], old.forces['arrakeen:10'] + 2);
  assert.equal(p(g, 'f').elites!.forces['arrakeen:10'], 2);
  assert.equal(p(g, 'f').tanks, old.tanks - 3);
  assert.equal(p(g, 'f').spice, old.spice);
  assert.equal(p(g, 'f').shipped, old.shipped);
  assert.equal(p(g, 'f').moved, old.moved);
  assert.equal(g.homeworldRevivalReturn!.stage, 'complete');
  reject(g, 'f', action);
  stable(g);
});

void test('Advanced Southern keeps the shared one-star revival cap through decline and a later Ghola', () => {
  let g = enterHomeworldRevival(homeworldRevivalFixture({ advanced: true }));
  const ghola = holdRevivalCard(g, 'f', 'ghola');
  reject(g, 'f', { type: 'revive', amount: 2, elite: 2 }, /one elite/);
  g = applyAction(g, 'f', { type: 'revive', amount: 1, elite: 1 });
  const offer = viewGame(g, 'f').homeworldRevivalDeployment!;
  const returned = structuredClone(p(g, 'f'));
  g = applyAction(reload(g), 'f', {
    type: 'decision',
    event: offer.event,
    decline: true,
  });
  assert.deepEqual(p(g, 'f'), returned);
  assert.equal(g.homeworldRevivalReturn!.destination, 'decline');
  reject(
    g,
    'f',
    { type: 'card', card: ghola, amount: 1, elite: 1 },
    /one elite/,
  );
  assert.ok(p(g, 'f').hand.some((card) => card.id === ghola));
  stable(g);
});

void test('high Tleilax mixed paid and free revival deploys only the actual free group and excludes old reserves', () => {
  let g = enterHomeworldRevival(homeworldRevivalFixture({ tleilaxu: true }));
  const old = structuredClone(p(g, 't'));
  g = applyAction(g, 't', { type: 'revive', amount: 3, elite: 0 });
  assert.equal(p(g, 't').reserves, old.reserves + 3);
  assert.deepEqual(g.homeworldRevivalReturn!.group, {
    amount: 3,
    elite: 0,
    free: 2,
  });
  assert.equal(viewGame(g, 't').homeworldRevivalDeployment!.normal, 2);
  const action = choice(g, 't');
  reject(g, 't', { ...action, amount: 1 }, /entire/);
  reject(g, 't', { ...action, amount: 3 }, /entire/);
  const paid = p(g, 't').spice;
  g = applyAction(reload(g), 't', action);
  assert.equal(p(g, 't').reserves, old.reserves + 1);
  assert.equal(p(g, 't').forces['arrakeen:10'], old.forces['arrakeen:10'] + 2);
  assert.equal(p(g, 't').tanks, old.tanks - 3);
  assert.equal(
    p(g, 't').spice,
    old.spice - 1 + 1,
    'Pay the Tleilaxu one-spice self-revival price for the single paid force; independent free-revival income settles once.',
  );
  assert.ok(paid <= p(g, 't').spice);
  assert.equal(p(g, 't').revived, 3);
  assert.equal(p(g, 't').freeForcesRevived, 2);
  stable(g);
});

void test('Emperor extra revival earns Southern placement without spending another ordinary revival allowance', () => {
  let g = homeworldRevivalFixture();
  p(g, 'f').ally = 'e';
  p(g, 'e').ally = 'f';
  p(g, 'f').allySinceTurn = p(g, 'e').allySinceTurn = 1;
  g = enterHomeworldRevival(g);
  g = applyAction(g, 'f', { type: 'revive', amount: 3, elite: 0 });
  assert.equal(g.homeworldRevivalReturn ?? null, null);
  const payer = p(g, 'e').spice;
  g = applyAction(g, 'e', { type: 'emperorRevival', amount: 2, elite: 2 });
  assert.equal(g.homeworldRevivalReturn!.source, 'emperorExtra');
  assert.deepEqual(g.homeworldRevivalReturn!.group, {
    amount: 2,
    elite: 2,
    free: 0,
  });
  assert.equal(p(g, 'e').spice, payer - 4);
  const action = choice(g, 'f');
  g = applyAction(reload(g), 'f', action);
  assert.equal(p(g, 'f').tanks, 0);
  assert.equal(p(g, 'f').revived, 3);
  assert.equal(p(g, 'f').freeForcesRevived, 3);
  assert.equal(g.emperorExtra.f, 2);
  assert.equal(p(g, 'e').spice, payer - 4);
  stable(g);
});

void test('Tleilax free group can enter a nonallied Homeworld while allied Homeworlds reject without mutation', () => {
  const setup = enterHomeworldRevival(
    homeworldRevivalFixture({ tleilaxu: true }),
  );
  const pending = applyAction(setup, 't', {
    type: 'revive',
    amount: 2,
    elite: 0,
  });
  const target = viewGame(
    pending,
    't',
  ).homeworldRevivalDeployment!.destinations.find(
    (destination) => destination.id === 'homeworld:emperor',
  );
  assert.ok(target && !target.blocked);
  const action = choice(pending, 't', target.id);
  const returned = p(pending, 't').reserves;
  const done = applyAction(reload(pending), 't', action);
  const home = viewGame(done, 't').homeworlds!.worlds!.find(
    (world) => world.id === target.id,
  )!;
  assert.deepEqual(home.forces.t, { normal: 2, elite: 0 });
  assert.equal(
    p(done, 't').reserves,
    returned - 2,
    'Visiting counters leave native reserves and remain in explicit foreign custody.',
  );
  assert.equal(p(done, 't').shipped, false);
  stable(done);
  const allied = reload(pending);
  p(allied, 't').ally = 'e';
  p(allied, 'e').ally = 't';
  p(allied, 't').allySinceTurn = p(allied, 'e').allySinceTurn = 1;
  assert.match(
    viewGame(allied, 't').homeworldRevivalDeployment!.destinations.find(
      (destination) => destination.id === target.id,
    )!.blocked!,
    /ally/,
  );
  reject(allied, 't', action, /ally/);
});

void test('Southern Ghola retires its physical card before choice and restores the independent Tleilaxu income response after placement', () => {
  let g = enterHomeworldRevival(
    homeworldRevivalFixture({ advanced: true, tleilaxu: true }),
  );
  const ghola = holdRevivalCard(g, 'f', 'ghola');
  holdRevivalCard(g, 'e', 'karama');
  const initial = p(g, 't').spice;
  g = applyAction(g, 'f', { type: 'card', card: ghola, amount: 2, elite: 1 });
  assert.equal(g.homeworldRevivalReturn!.source, 'ghola');
  assert.equal(g.homeworldRevivalReturn!.card, ghola);
  assert.equal(
    p(g, 'f').hand.some((card) => card.id === ghola),
    false,
  );
  assert.equal(g.discard.filter((card) => card.id === ghola).length, 1);
  assert.equal(g.response, null);
  assert.equal(g.homeworldRevivalReturn!.resumeResponse?.kind, 'revivalIncome');
  assert.equal(p(g, 't').spice, initial);
  assert.equal(p(g, 'f').revived, 0);
  stable(g);
  for (const cancel of [false, true]) {
    let done = applyAction(reload(g), 'f', choice(g, 'f'));
    assert.equal(done.response?.kind, 'revivalIncome');
    const command = cancel
      ? {
          type: 'card',
          mode: 'cancel',
          card: p(done, 'e').hand.find((card) => card.effect === 'karama')!.id,
        }
      : { type: 'passResponse' };
    done = applyAction(reload(done), 'e', command);
    assert.equal(done.response, null);
    assert.equal(p(done, 't').spice, initial + (cancel ? 0 : 1));
    assert.equal(done.discard.filter((card) => card.id === ghola).length, 1);
    stable(done);
  }
});

void test('low populations do not invent a deployment; first reaching high rejects ordinary and Ghola returns before payment or custody changes', () => {
  for (const ghola of [false, true]) {
    let g = homeworldRevivalFixture();
    positionRevivalForces(g, 'f', { native: 1, tanks: 5, eliteTanks: 2 });
    g = enterHomeworldRevival(g);
    const card = ghola ? holdRevivalCard(g, 'f', 'ghola') : undefined;
    const action = ghola
      ? { type: 'card', card, amount: 1, elite: 1 }
      : { type: 'revive', amount: 1, elite: 1 };
    const low = applyAction(reload(g), 'f', action);
    assert.equal(low.homeworldRevivalReturn ?? null, null);
    assert.equal(viewGame(low, 'f').homeworldRevivalDeployment, null);
    assert.equal(p(low, 'f').reserves, 2);
    stable(low);
    reject(g, 'f', { ...action, amount: 2 }, /timing ruling/);
  }
  let t = homeworldRevivalFixture({ tleilaxu: true });
  positionRevivalForces(t, 't', { native: 8, tanks: 5 });
  t = enterHomeworldRevival(t);
  reject(t, 't', { type: 'revive', amount: 1, elite: 0 }, /timing ruling/);
  const card = holdRevivalCard(t, 't', 'ghola');
  const done = applyAction(t, 't', { type: 'card', card, amount: 2, elite: 0 });
  assert.equal(
    done.homeworldRevivalReturn ?? null,
    null,
    'Tleilax Ghola is not ordinary free revival.',
  );
  stable(done);
});

void test('signed deployment rejects corrupted original groups, missing choices, stale events and foreign destinations immutably', () => {
  const g = applyAction(enterHomeworldRevival(homeworldRevivalFixture()), 'f', {
    type: 'revive',
    amount: 2,
    elite: 2,
  });
  const action = choice(g, 'f');
  reject(g, 'e', action);
  reject(g, 'f', { ...action, event: 'old-event' });
  reject(g, 'f', { ...action, destination: 'homeworld:emperor' });
  reject(g, 'f', { ...action, decline: true });
  for (const mutate of [
    (bad: Game) => {
      bad.homeworldRevivalReturn!.group.elite = 1;
    },
    (bad: Game) => {
      bad.homeworldRevivalReturn!.quote.elite = 1;
    },
    (bad: Game) => {
      bad.homeworldRevivalReturn!.player = 'e';
    },
    (bad: Game) => {
      bad.homeworldRevivalReturn!.signature = 'forged';
    },
    (bad: Game) => {
      delete bad.homeworldRevivalReturn;
    },
    (bad: Game) => {
      bad.decision = null;
    },
  ]) {
    const bad = reload(g);
    mutate(bad);
    const before = structuredClone(bad);
    assert.throws(() => viewGame(bad, 'f'), /revival|returned group/i);
    assert.throws(() => normalizeAutomaticGame(bad), /revival|returned group/i);
    reject(bad, 'f', action, /revival|returned group/i);
    assert.deepEqual(bad, before);
  }
  stable(g);
});

void test('real deployment projections expose destinations only to their owner and every bot profile can settle them legally', () => {
  const original = applyAction(
    enterHomeworldRevival(homeworldRevivalFixture()),
    'f',
    { type: 'revive', amount: 2, elite: 2 },
  );
  const observer = viewGame(original, 'e');
  assert.deepEqual(observer.homeworldRevivalDeployment?.destinations ?? [], []);
  assert.deepEqual(homeworldRevivalDeploymentActions(observer), []);
  assert.equal(observer.decision?.kind, 'homeworldRevivalDeployment');
  for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(reload(original), 'f');
    view.players.find((player) => player.id === 'f')!.bot = profile;
    const proposed = homeworldRevivalDeploymentActions(view);
    assert.equal(proposed.length, 1);
    assert.deepEqual(botActions(view), proposed);
    const done = applyAction(reload(original), 'f', proposed[0]);
    assert.equal(done.homeworldRevivalReturn!.stage, 'complete');
    assert.equal(viewGame(done, 'f').homeworldRevivalDeployment, null);
    stable(done);
  }
});

void test('every bot profile avoids actual low-to-high ordinary and Ghola star returns while the shared block permits a leader return', () => {
  for (const advanced of [false, true]) {
    let g = homeworldRevivalFixture({ advanced });
    positionRevivalForces(g, 'f', { native: 2, tanks: 3, eliteTanks: 3 });
    g = enterHomeworldRevival(g);
    const ghola = holdRevivalCard(g, 'f', 'ghola');
    const ownView = viewGame(g, 'f');
    assert.match(
      homeworldRevivalActionBlock(ownView, {
        type: 'revive',
        amount: 1,
        elite: 1,
      })!,
      /timing ruling/,
    );
    if (!advanced)
      assert.match(
        homeworldRevivalActionBlock(ownView, { type: 'card', card: ghola })!,
        /timing ruling/,
      );
    assert.match(
      homeworldRevivalActionBlock(ownView, {
        type: 'card',
        card: ghola,
        amount: 1,
      })!,
      /timing ruling/,
    );
    reject(g, 'f', { type: 'card', card: ghola, amount: 1 }, /timing ruling/);
    for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const view = viewGame(reload(g), 'f');
      view.players.find((player) => player.id === 'f')!.bot = profile;
      const actions = botActions(view);
      assert.ok(
        actions.length,
        `${profile} must retain a legal way to advance.`,
      );
      assert.ok(
        actions.every(
          (action) =>
            action.type !== 'revive' &&
            !(action.type === 'card' && action.card === ghola),
        ),
      );
      for (const action of actions) {
        assert.equal(homeworldRevivalActionBlock(view, action), null);
        const next = applyAction(reload(g), 'f', action);
        inventory(next);
      }
    }
    const leader = p(g, 'f').leaders[0];
    leader.dead = true;
    const leaderAction = { type: 'card', card: ghola, leader: leader.id };
    assert.equal(
      homeworldRevivalActionBlock(viewGame(g, 'f'), leaderAction),
      null,
    );
    const done = applyAction(g, 'f', leaderAction);
    assert.equal(
      p(done, 'f').leaders.find((candidate) => candidate.id === leader.id)!
        .dead,
      false,
    );
    assert.equal(p(done, 'f').reserves, 2);
    assert.equal(p(done, 'f').tanks, 3);
    assert.equal(done.homeworldRevivalReturn ?? null, null);
    assert.equal(done.discard.filter((card) => card.id === ghola).length, 1);
    stable(done);
  }
});
