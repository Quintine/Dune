import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { botActions, runBots } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { baseDeck, treacheryDeck } from '../game/cards';
import { createTechTokens } from '../game/tech-tokens';
import {
  createDukeVidal,
  acquireDuke,
  DUKE_VIDAL_ID,
} from '../game/duke-vidal';
import type { FactionId } from '../game/catalog';
import type { PlanClaim } from '../game/battle-promises';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
/** Test-only observation of the unchanged production inner dispatcher, before
 * its public wrapper drains automatic continuations. No runtime export or gate
 * is changed, and all resumed actions use the real production exports. */
const observed: {
  applyActionInner?: (g: Game, id: string, a: Action) => Game;
} = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { applyActionInner };\n',
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  {
    exports: observed,
    require: createRequire(new URL('../game/engine.ts', import.meta.url)),
    crypto: webcrypto,
    structuredClone,
    TextEncoder,
    JSON,
  },
);
function inner(g: Game, id: string, a: Action) {
  const before = structuredClone(g);
  const result = reload(observed.applyActionInner!(g, id, a));
  assert.deepEqual(g, before);
  return result;
}

function fixture(
  phase = 4,
  advanced = false,
  factions: FactionId[] = ['emperor', 'harkonnen', 'atreides'],
) {
  const g = createGame(
    'ORDINARYFRAME',
    newPlayer('p', 'Player', factions[0]),
    advanced,
  );
  g.players.push(
    newPlayer('q', 'Other', factions[1]),
    newPlayer('t', 'Third', factions[2]),
  );
  Object.assign(g, {
    status: 'playing',
    phase,
    turn: 2,
    storm: 18,
    active: phase === 5 ? 'p' : null,
    order: ['p', 'q', 't'],
    deck: baseDeck(),
    movementRemaining: phase === 5 ? ['p', 'q', 't'] : undefined,
  });
  for (const p of g.players) {
    p.hand = [];
    p.traitorChoices = [];
    p.traitors = [];
    p.spice = 10;
    p.forces = {};
    p.reserves = 20;
  }
  return g;
}
function hold(g: Game, id: string, effect: string) {
  const i = g.deck.findIndex(
    (c) => c.effect === effect || c.id === effect || c.kind === effect,
  );
  assert.ok(i >= 0, effect);
  const card = g.deck.splice(i, 1)[0];
  player(g, id).hand.push(card);
  return card.id;
}
function receipt(g: Game) {
  const c = g.pendingTreacheryDiscard!.continuation;
  if (c.kind !== 'ordinaryCardDiscard')
    throw Error('Missing ordinary card frame');
  return c;
}
function inventory(g: Game) {
  const ids = [
    ...g.deck,
    ...g.discard,
    ...g.players.flatMap((p) => p.hand),
    ...(g.richeseCache ?? []),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
  ]
    .map((c) => c.id)
    .sort();
  assert.equal(new Set(ids).size, ids.length);
  return ids;
}
function conserved(g: Game) {
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    assert.ok(p.spice >= 0);
    if (p.elites) {
      assert.ok(p.elites.reserves <= p.reserves);
      assert.ok(p.elites.tanks <= p.tanks);
      for (const [key, n] of Object.entries(p.elites.forces))
        assert.ok(n <= (p.forces[key] ?? 0));
    }
  }
}
function recover(g: Game) {
  const before = structuredClone(g),
    done = normalizeAutomaticGame(reload(g));
  assert.deepEqual(g, before);
  assert.equal(done.pendingTreacheryDiscard, null);
  assert.deepEqual(reload(normalizeAutomaticGame(reload(done))), reload(done));
  return done;
}
function play(initial: Game, id: string, action: Action) {
  const pending = inner(initial, id, action),
    c = receipt(pending);
  assert.equal(c.player, id);
  assert.equal(c.card, action.card);
  assert.equal(pending.pendingTreacheryDiscard!.batch.entries.length, 1);
  const e = pending.pendingTreacheryDiscard!.batch.entries[0];
  assert.equal(e.card.id, action.card);
  assert.equal(e.discardedBy, id);
  assert.equal(e.publicFace, true);
  assert.deepEqual(inventory(pending), inventory(initial));
  conserved(pending);
  const done = recover(pending);
  assert.deepEqual(reload(done), reload(applyAction(initial, id, action)));
  return { pending, done };
}
function allow(initial: Game) {
  let g = initial;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
function ready(initial: Game) {
  let g = initial;
  for (const p of g.players)
    if (!g.ready.includes(p.id)) g = applyAction(g, p.id, { type: 'ready' });
  return g;
}

void test('Hajr retires after granting one remaining move and cannot grant a third on recovery', () => {
  let g = fixture(5);
  const card = hold(g, 'p', 'hajr');
  player(g, 'p').forces = { 'imperial_basin:10': 3 };
  player(g, 'p').reserves = 17;
  g = applyAction(g, 'p', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    territory: 'arrakeen',
    sector: 10,
  });
  assert.equal(player(g, 'p').moved, 1);
  const { pending, done } = play(g, 'p', { type: 'card', card });
  assert.deepEqual(pending.hajr, ['p']);
  assert.equal(player(done, 'p').moved, 1);
  assert.equal(done.active, 'p');
  assert.equal(
    done.log.filter((e) => e.text === 'Player played Hajr.').length,
    1,
  );
  const next = applyAction(done, 'p', {
    type: 'move',
    forces: { 'imperial_basin:10': 1 },
    territory: 'carthag',
    sector: 11,
  });
  assert.equal(player(next, 'p').moved, 2);
  assert.throws(() =>
    applyAction(next, 'p', {
      type: 'move',
      forces: { 'imperial_basin:10': 1 },
      territory: 'arrakeen',
      sector: 10,
    }),
  );
  assert.throws(() => applyAction(done, 'p', { type: 'card', card }));
  conserved(next);
});

for (const afterDials of [false, true])
  void test(`Weather Control ${afterDials ? 'after revealed dials' : 'before dialing at zero'} restores the selected distance without moving the storm`, () => {
    let g = fixture(0);
    g.storm = 1;
    g.stormDialers = ['p', 'q'];
    const card = hold(g, 'p', 'weather');
    if (afterDials) {
      g = applyAction(g, 'p', { type: 'stormDial', amount: 2 });
      g = applyAction(g, 'q', { type: 'stormDial', amount: 3 });
      g = applyAction(g, 't', { type: 'ready' });
    }
    const amount = afterDials ? 2 : 0,
      { pending, done } = play(g, 'p', { type: 'card', card, amount });
    assert.equal(pending.stormPending, amount);
    assert.equal(pending.storm, 1);
    assert.deepEqual(pending.ready, []);
    assert.deepEqual(done.stormDials, g.stormDials);
    assert.equal(done.storm, 1);
    const next = ready(done);
    assert.equal(next.storm, 1 + amount);
    assert.equal(next.phase, 1);
    assert.equal(next.stormPending, null);
  });

function harvest(storm = false) {
  let g = fixture(1);
  g.deck = treacheryDeck(['ix']);
  g.spiceDeck = [{ territory: 'red_chasm', sector: 7, amount: 8 }];
  g.spice = { 'red_chasm:7': 3 };
  if (storm) {
    g.storm = 7;
    g.spice = {};
  }
  const first = hold(g, 'p', 'harvester'),
    second = hold(g, 'q', 'ix-harvester');
  g = ready(g);
  return { g, first, second };
}
void test('two physical Harvesters retire separate doubles of only the fresh blow, preserving older spice', () => {
  const initial = harvest();
  assert.equal(initial.g.spice['red_chasm:7'], 11);
  const first = play(initial.g, 'p', { type: 'card', card: initial.first });
  assert.equal(first.pending.spice['red_chasm:7'], 19);
  assert.equal(first.pending.spiceWindow!.amount, 16);
  const accepted = applyAction(first.done, 'p', { type: 'ready' }),
    second = play(accepted, 'q', { type: 'card', card: initial.second });
  assert.equal(second.pending.spice['red_chasm:7'], 35);
  assert.equal(second.pending.spiceWindow!.amount, 32);
  assert.equal(second.pending.spiceWindow!.harvesters, 2);
  assert.deepEqual(second.pending.ready, []);
  assert.equal(second.done.resolvedTreacheryDiscardSequence, 2);
  assert.equal(second.done.spice['red_chasm:7'], 35);
  assert.equal(ready(second.done).spiceWindow, null);
});
void test('a Harvester in the storm records its completed blow without creating ground spice', () => {
  const { g, first } = harvest(true),
    { pending, done } = play(g, 'p', { type: 'card', card: first });
  assert.equal(pending.spice['red_chasm:7'], undefined);
  assert.equal(done.spice['red_chasm:7'], undefined);
  assert.equal(done.spiceWindow!.amount, 16);
});

void test('Family Atomics can recover after killing its own qualifying Wall fighters and all typed opposing groups', () => {
  const g = fixture(0, true, ['emperor', 'fremen', 'atreides']),
    card = hold(g, 'p', 'atomics');
  player(g, 'p').forces = { 'shield_wall:8': 2, 'arrakeen:10': 1 };
  player(g, 'p').reserves = 17;
  player(g, 'p').elites = {
    forces: { 'shield_wall:8': 1 },
    reserves: 4,
    tanks: 0,
    revived: 0,
  };
  player(g, 'q').forces = { 'shield_wall:8': 3 };
  player(g, 'q').reserves = 17;
  player(g, 'q').elites = {
    forces: { 'shield_wall:8': 2 },
    reserves: 1,
    tanks: 0,
    revived: 0,
  };
  g.stormPending = 1;
  g.ready = ['t'];
  const { pending, done } = play(g, 'p', { type: 'card', card });
  assert.equal(pending.shieldWallDestroyed, true);
  assert.deepEqual(pending.ready, []);
  for (const [id, total, elite] of [
    ['p', 2, 1],
    ['q', 3, 2],
  ] as const) {
    assert.equal(player(done, id).forces['shield_wall:8'], undefined);
    assert.equal(player(done, id).tanks, total);
    assert.equal(player(done, id).elites!.tanks, elite);
  }
  assert.equal(player(done, 'p').forces['arrakeen:10'], 1);
  assert.deepEqual(done.players, pending.players);
  const after = ready(done);
  assert.equal(player(after, 'p').tanks, 2);
  assert.equal(player(after, 'q').tanks, 3);
  conserved(after);
});

for (const typed of [false, true])
  void test(`Ghola ${typed ? 'typed' : 'ordinary'} forces return once without consuming normal revival usage`, () => {
    const g = fixture(4, typed),
      card = hold(g, 'p', 'ghola');
    player(g, 'p').tanks = 5;
    player(g, 'p').reserves = 15;
    player(g, 'p').revived = 1;
    if (typed)
      player(g, 'p').elites = { reserves: 3, tanks: 2, forces: {}, revived: 0 };
    const amount = typed ? 2 : 5,
      { pending, done } = play(g, 'p', {
        type: 'card',
        card,
        amount,
        elite: typed ? 1 : 0,
      });
    assert.equal(player(pending, 'p').tanks, 5 - amount);
    assert.equal(player(done, 'p').reserves, 15 + amount);
    assert.equal(player(done, 'p').revived, 1);
    assert.equal(player(done, 'p').spice, 10);
    if (typed) {
      assert.equal(player(done, 'p').elites!.tanks, 1);
      assert.equal(player(done, 'p').elites!.reserves, 4);
      assert.equal(player(done, 'p').elites!.revived, 1);
      assert.throws(() =>
        applyAction(done, 'p', { type: 'revive', amount: 1, elite: 1 }),
      );
    }
  });

for (const kind of ['leader', 'kwisatz'] as const)
  void test(`Ghola ${kind} recovery preserves original custody and increments only the actual KH cycle`, () => {
    const g = fixture(4, true, ['atreides', 'harkonnen', 'emperor']),
      card = hold(g, 'p', 'ghola'),
      p = player(g, 'p');
    p.leaderRevived = true;
    p.revivalCycle = 2;
    p.leaders[0].dead = true;
    p.leaders[0].deaths = 2;
    p.leaders[0].concealed = { captor: 'q', dead: false, deaths: 1 };
    p.kwisatz = { dead: true, revivalCycle: 3 };
    const id = kind === 'leader' ? p.leaders[0].id : 'kwisatz',
      { pending, done } = play(g, 'p', { type: 'card', card, leader: id });
    assert.equal(player(done, 'p').leaderRevived, true);
    assert.equal(player(done, 'p').revivalCycle, 2);
    assert.equal(player(done, 'p').spice, 10);
    if (kind === 'leader') {
      assert.equal(player(done, 'p').leaders[0].dead, false);
      assert.equal(player(done, 'p').leaders[0].deaths, 2);
      assert.equal(player(done, 'p').leaders[0].concealed, undefined);
      assert.equal(player(done, 'p').kwisatz!.dead, true);
    } else {
      assert.equal(player(done, 'p').kwisatz!.dead, false);
      assert.equal(player(done, 'p').kwisatz!.revivalCycle, 4);
      assert.equal(player(done, 'p').leaders[0].dead, true);
    }
    assert.deepEqual(done.players, pending.players);
  });

for (const cancel of [false, true])
  void test(`Ghola's restored Tleilaxu income ${cancel ? 'cancels' : 'pays'} once after the already-earned Axlotl amount`, () => {
    const g = fixture(4, true, ['emperor', 'harkonnen', 'tleilaxu']),
      card = hold(g, 'p', 'ghola'),
      karama = hold(g, 'q', 'karama');
    player(g, 'p').tanks = 5;
    player(g, 'p').reserves = 15;
    g.techTokens = createTechTokens(g.players);
    g.techTokens.axlotl.owner = 'q';
    g.techTokens.heighliners.owner = 'q';
    g.revivalFreeIncome = { p: g.turn };
    const { pending, done } = play(g, 'p', { type: 'card', card, amount: 5 });
    assert.equal(pending.response, null);
    assert.deepEqual(receipt(pending).resume.response, {
      kind: 'revivalIncome',
      owner: 't',
      recipient: 'p',
      amount: 1,
      passed: [],
    });
    assert.equal(pending.techTokens!.axlotl.spice, 2);
    assert.equal(pending.techTokens!.axlotl.triggeredTurn, g.turn);
    assert.equal(player(done, 'q').spice, 10);
    assert.equal(player(done, 't').spice, 10);
    assert.deepEqual(done.revivalFreeIncome, g.revivalFreeIncome);
    const resolved = cancel
      ? applyAction(done, 'q', { type: 'card', card: karama, mode: 'cancel' })
      : allow(done);
    assert.equal(player(resolved, 't').spice, cancel ? 10 : 11);
    assert.equal(player(resolved, 'p').tanks, 0);
    assert.equal(resolved.techTokens!.axlotl.spice, 2);
    const end = ready(resolved);
    assert.equal(player(end, 'q').spice, 12);
    assert.equal(end.techTokens!.axlotl.spice, 0);
    conserved(end);
  });

void test('Ghola outside Revival automatically pays Tleilaxu once, while self-Ghola does not accrue Axlotl', () => {
  for (const self of [false, true]) {
    const g = fixture(
        self ? 4 : 8,
        true,
        self
          ? ['tleilaxu', 'harkonnen', 'emperor']
          : ['emperor', 'harkonnen', 'tleilaxu'],
      ),
      card = hold(g, 'p', 'ghola');
    player(g, 'p').tanks = 1;
    player(g, 'p').reserves = 19;
    g.techTokens = createTechTokens(g.players);
    g.techTokens.axlotl.owner = 'q';
    const { pending, done } = play(g, 'p', { type: 'card', card, amount: 1 });
    assert.equal(pending.techTokens!.axlotl.spice, 0);
    assert.ok(receipt(pending).resume.response);
    assert.equal(done.response, null);
    assert.equal(player(done, self ? 'p' : 't').spice, 11);
    assert.equal(player(done, 'p').reserves, 20);
  }
});

void test('a real acquired foreign leader stays in its original pool when its controlling Tleilaxu uses Ghola', () => {
  let g = fixture(4, true, ['atreides', 'harkonnen', 'tleilaxu']);
  player(g, 'p').leaders[0].dead = true;
  player(g, 'p').leaders[0].deaths = 1;
  player(g, 't').leaders[0].dead = true;
  player(g, 't').leaders[0].deaths = 1;
  g = allow(
    applyAction(g, 't', {
      type: 'reviveForeignGhola',
      leader: player(g, 'p').leaders[0].id,
    }),
  );
  assert.equal(player(g, 'p').leaders[0].gholaBy, 't');
  // A later death is the isolated scenario precondition; acquisition above is a real action.
  player(g, 'p').leaders[0].dead = true;
  player(g, 'p').leaders[0].deaths = 2;
  g.phase = 7;
  const card = hold(g, 'p', 'ghola'),
    before = structuredClone(g),
    leader = player(g, 'p').leaders[0].id;
  assert.throws(() => applyAction(g, 'p', { type: 'card', card, leader }));
  assert.deepEqual(g, before);
  player(g, 't').hand.push(player(g, 'p').hand.pop()!);
  const captured = reload(g);
  player(captured, 'p').leaders[0].capturedBy = 't';
  assert.throws(() =>
    applyAction(captured, 't', { type: 'card', card, leader }),
  );
  const { pending, done } = play(g, 't', { type: 'card', card, leader });
  assert.equal(player(done, 'p').leaders[0].dead, false);
  assert.equal(player(done, 'p').leaders[0].gholaBy, 't');
  assert.equal(player(done, 'p').leaders[0].deaths, 2);
  assert.equal(
    player(done, 't').leaders.some((l) => l.id === leader),
    false,
  );
  assert.deepEqual(
    done.players.map((p) => p.leaders),
    pending.players.map((p) => p.leaders),
  );
});

function ask(initial: Game, question: Record<string, unknown>) {
  let g = initial;
  const card = hold(g, 'q', 'truthtrance');
  g = applyAction(g, 'q', { type: 'card', card });
  while (g.truthtrance!.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  return applyAction(g, 'q', { type: 'truthAsk', question });
}
void test('shipment search keeps its Ghola plus escrow and Karama witness immutable, private and executable', () => {
  let g = fixture(5);
  const p = player(g, 'p');
  p.reserves = 1;
  p.tanks = 5;
  p.forces = { 'arrakeen:10': 14 };
  p.spice = 3;
  p.ally = 't';
  player(g, 't').ally = 'p';
  const ghola = hold(g, 'p', 'ghola'),
    karama = hold(g, 'p', 'karama');
  g = applyAction(g, 'p', { type: 'pledgeAid', amount: 2 });
  g = ask(g, {
    kind: 'shipment',
    target: 'p',
    territory: 'carthag',
    minimum: 6,
  });
  assert.deepEqual(viewGame(g, 'p').truthShipmentAnswers, ['yes', 'no']);
  g = applyAction(g, 'p', { type: 'truthAnswer', answer: 'yes' });
  const snapshot = structuredClone(g),
    first = viewGame(g, 'p').shipmentCompletion;
  assert.ok(first?.actions.some((a) => a.card === ghola));
  assert.deepEqual(viewGame(g, 'p').shipmentCompletion, first);
  assert.equal(viewGame(g, 'q').shipmentCompletion, null);
  assert.equal(viewGame(g, 't').shipmentCompletion, null);
  assert.deepEqual(g, snapshot);
  const beforeDiversion = structuredClone(g);
  assert.throws(
    () => applyAction(g, 'p', { type: 'card', card: ghola, amount: 1 }),
    /voluntar/,
  );
  assert.deepEqual(g, beforeDiversion);
  const actions: Action[] = [];
  let frameSeen = false;
  for (let i = 0; i < 5 && !player(g, 'p').shipped; i++) {
    const action = viewGame(g, 'p').shipmentCompletion!.actions[0];
    actions.push(action);
    if (action.card === ghola) {
      const observed = play(g, 'p', action);
      g = observed.done;
      frameSeen = true;
    } else g = applyAction(g, 'p', action);
  }
  assert.ok(frameSeen);
  assert.ok(actions.some((a) => a.type === 'pledgeAid'));
  assert.ok(actions.some((a) => a.card === karama));
  assert.equal(player(g, 'p').forces['carthag:11'], 6);
  assert.equal(player(g, 'p').tanks, 0);
  assert.equal(player(g, 'p').spice, 0);
  assert.equal(g.shipmentPromises![0].fulfilled, true);
  conserved(g);
});

function supportPromise() {
  let g = fixture(6, true, ['tleilaxu', 'harkonnen', 'emperor']);
  player(g, 'p').spice = 0;
  player(g, 'p').tanks = 1;
  player(g, 'p').reserves = 15;
  player(g, 'p').forces = { 'arrakeen:10': 4 };
  player(g, 't').reserves = 16;
  player(g, 't').forces = { 'arrakeen:10': 4 };
  hold(g, 'p', 'ghola');
  hold(g, 'q', 'karama');
  g.active = 'p';
  g = allow(
    applyAction(g, 'p', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 't',
    }),
  );
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  const claim: PlanClaim = { kind: 'support', compare: 'gte', value: 1 };
  g = ask(g, { kind: 'battlePlan', target: 'p', territory: 'arrakeen', claim });
  return applyAction(g, 'p', { type: 'truthAnswer', answer: 'yes' });
}
for (const cancel of [false, true])
  void test(`battle preparation preserves conditional Ghola income until the restored response ${cancel ? 'cancels' : 'pays'}`, () => {
    const g = supportPromise(),
      snapshot = structuredClone(g),
      preparation = viewGame(g, 'p').battle!.compliantPreparation!;
    assert.equal(preparation.actions.length, 1);
    assert.equal(preparation.actions[0].amount, 1);
    assert.equal(viewGame(g, 'q').battle!.compliantPreparation, null);
    assert.deepEqual(
      viewGame(g, 'p').battle!.compliantPreparation,
      preparation,
    );
    assert.deepEqual(g, snapshot);
    const { pending, done } = play(g, 'p', preparation.actions[0]);
    assert.equal(pending.battle!.truthPromises![0].released, undefined);
    assert.equal(player(pending, 'p').spice, 0);
    for (const p of pending.players) {
      const view = viewGame(pending, p.id);
      assert.equal(view.automaticContinuationPending, true);
      assert.equal(view.battle!.compliantPreparation, null);
    }
    assert.equal(
      viewGame(done, 'p').battle!.compliantPreparation!.waitingForIncome,
      true,
    );
    assert.equal(done.battle!.truthPromises![0].released, undefined);
    const resolved = cancel
      ? applyAction(done, 'q', {
          type: 'card',
          card: player(done, 'q').hand.find((c) => c.effect === 'karama')!.id,
          mode: 'cancel',
        })
      : allow(done);
    assert.equal(player(resolved, 'p').tanks, 0);
    assert.equal(player(resolved, 'p').spice, cancel ? 0 : 1);
    assert.equal(
      resolved.battle!.truthPromises![0].released,
      cancel ? true : undefined,
    );
    if (!cancel) {
      const plan = viewGame(resolved, 'p').battle!.compliantPlan!;
      assert.ok(plan);
      assert.equal(
        applyAction(resolved, 'p', { type: 'battlePlan', ...plan }).battle!
          .plans.p.support,
        1,
      );
    }
  });

void test('Ixian Ghola retains the cyborg exception without consuming the normal revival allowance', () => {
  const g = fixture(4, true, ['ixians', 'harkonnen', 'emperor']),
    card = hold(g, 'p', 'ghola'),
    p = player(g, 'p');
  p.tanks = 4;
  p.reserves = 16;
  p.revived = 3;
  p.elites = { tanks: 4, reserves: 3, forces: {}, revived: 3 };
  const { pending, done } = play(g, 'p', {
    type: 'card',
    card,
    amount: 4,
    elite: 4,
  });
  assert.equal(player(done, 'p').elites!.reserves, 7);
  assert.equal(player(done, 'p').elites!.tanks, 0);
  assert.equal(player(done, 'p').revived, 3);
  assert.deepEqual(done.players, pending.players);
});

function simpleFrame(
  effect: 'hajr' | 'weather' | 'harvester' | 'atomics' | 'ghola',
) {
  const phase =
      effect === 'hajr'
        ? 5
        : effect === 'harvester'
          ? 1
          : effect === 'ghola'
            ? 4
            : 0,
    g = fixture(phase),
    card = hold(g, 'p', effect);
  if (effect === 'harvester') {
    g.spiceWindow = {
      territory: 'red_chasm',
      sector: 7,
      amount: 8,
      harvested: false,
    };
    g.spice = { 'red_chasm:7': 11 };
  }
  if (effect === 'atomics') {
    player(g, 'p').forces = { 'shield_wall:8': 1 };
    player(g, 'p').reserves = 19;
  }
  if (effect === 'ghola') {
    player(g, 'p').tanks = 1;
    player(g, 'p').reserves = 19;
  }
  hold(g, 'q', 'shield');
  return inner(g, 'p', {
    type: 'card',
    card,
    ...(effect === 'weather'
      ? { amount: 0 }
      : effect === 'ghola'
        ? { amount: 1 }
        : {}),
  });
}
void test('all five pending frames expose only the public played card and make every AI profile wait', () => {
  for (const effect of [
    'hajr',
    'weather',
    'harvester',
    'atomics',
    'ghola',
  ] as const) {
    const pending = simpleFrame(effect),
      alternate = reload(pending),
      idx = alternate.deck.findIndex((c) => c.kind === 'snooper');
    [player(alternate, 'q').hand[0], alternate.deck[idx]] = [
      alternate.deck[idx],
      player(alternate, 'q').hand[0],
    ];
    for (const id of ['p', 'q', 't']) {
      const view = viewGame(pending, id);
      assert.equal(view.automaticContinuationPending, true);
      assert.ok(!('pendingTreacheryDiscard' in view));
      assert.ok(!('treacheryDiscardSequence' in view));
      assert.ok(view.log.some((e) => e.text.includes(' played ')));
      if (id !== 'q') assert.deepEqual(viewGame(alternate, id), view);
      for (const level of DIFFICULTIES) {
        view.players.find((p) => p.id === id)!.bot = level;
        assert.deepEqual(botActions(view), []);
      }
    }
    const snapshot = structuredClone(pending),
      bot = reload(pending);
    player(bot, 'p').bot = 'Hard';
    assert.doesNotThrow(() => normalizeAutomaticGame(bot));
    assert.deepEqual(pending, snapshot);
    assert.deepEqual(
      reload({ ...runBots(reload(pending), 0), botsPending: undefined }),
      reload({ ...recover(pending), botsPending: undefined }),
    );
  }
});

function rejectsCorrupt(frame: Game, mutations: ((g: Game) => void)[]) {
  for (const [index, mutate] of mutations.entries()) {
    const corrupt = reload(frame);
    mutate(corrupt);
    const snapshot = structuredClone(corrupt);
    assert.throws(() => normalizeAutomaticGame(corrupt), `normalize ${index}`);
    assert.throws(() => viewGame(corrupt, 'p'), `view ${index}`);
    assert.throws(
      () => applyAction(corrupt, 'p', { type: 'advanceBots' }),
      `action ${index}`,
    );
    assert.deepEqual(corrupt, snapshot);
  }
}
void test('every ordinary source rejects stale physical receipts, changed completed state and replay atomically', () => {
  for (const effect of [
    'hajr',
    'weather',
    'harvester',
    'atomics',
    'ghola',
  ] as const) {
    const frame = simpleFrame(effect),
      mutations: ((g: Game) => void)[] = [
        (g) => {
          g.turn++;
        },
        (g) => {
          g.phase++;
        },
        (g) => {
          g.status = 'setup';
        },
        (g) => {
          g.status = 'finished';
        },
        (g) => {
          g.treacheryDiscardSequence!++;
        },
        (g) => {
          g.resolvedTreacheryDiscardSequence = g.treacheryDiscardSequence;
        },
        (g) => {
          g.pendingTreacheryDiscard!.sequence++;
        },
        (g) => {
          g.pendingTreacheryDiscard!.batch.event += 'stale';
        },
        (g) => {
          g.pendingTreacheryDiscard!.batch.cause = 'ordinary:unknown';
        },
        (g) => {
          g.pendingTreacheryDiscard!.batch.entries[0].publicFace = false;
        },
        (g) => {
          g.pendingTreacheryDiscard!.batch.entries[0].discardedBy = 't';
        },
        (g) => {
          receipt(g).player = 'q';
        },
        (g) => {
          receipt(g).card = 'missing';
        },
        (g) => {
          Object.assign(receipt(g), { effect: 'unknown' });
        },
        (g) => {
          receipt(g).stateSignature += 'stale';
        },
        (g) => {
          g.discard = [];
        },
        (g) => {
          g.deck.push(structuredClone(g.discard.at(-1)!));
        },
        (g) => {
          player(g, 'q').hand.push(structuredClone(g.discard.at(-1)!));
        },
        (g) => {
          g.discard.at(-1)!.effect = 'karama';
        },
        (g) => {
          g.order.reverse();
        },
        (g) => {
          g.ready.push('p');
        },
        (g) => {
          player(g, 'p').spice++;
        },
        (g) => {
          player(g, 'p').reserves++;
        },
        (g) => {
          player(g, 'p').leaders[0].dead = true;
        },
        (g) => {
          receipt(g).resume.phaseOpening = { passed: [], initialize: false };
        },
        (g) => {
          receipt(g).resume.response = {
            kind: 'revivalIncome',
            owner: 'q',
            recipient: 'p',
            amount: 1,
            passed: [],
          };
        },
      ];
    for (const key of [
      'response',
      'decision',
      'pendingKarama',
      'phaseOpening',
      'truthtrance',
      'pendingNullentropy',
    ])
      mutations.push((g) => {
        Object.assign(g, { [key]: {} });
      });
    if (effect === 'hajr')
      mutations.push(
        (g) => {
          g.hajr = [];
        },
        (g) => {
          g.hajr.push('p');
        },
        (g) => {
          g.active = 'q';
        },
        (g) => {
          player(g, 'p').moved++;
        },
      );
    if (effect === 'weather')
      mutations.push(
        (g) => {
          g.stormPending = null;
        },
        (g) => {
          g.stormPending = 1;
        },
        (g) => {
          g.storm++;
        },
      );
    if (effect === 'harvester')
      mutations.push(
        (g) => {
          g.spiceWindow!.amount++;
        },
        (g) => {
          g.spiceWindow!.harvesters = 0;
        },
        (g) => {
          g.spiceWindow!.territory = 'hagga_basin';
        },
        (g) => {
          g.spice['red_chasm:7']++;
        },
      );
    if (effect === 'atomics')
      mutations.push(
        (g) => {
          g.shieldWallDestroyed = false;
        },
        (g) => {
          player(g, 'p').forces['shield_wall:8'] = 1;
        },
        (g) => {
          player(g, 'p').tanks = 0;
        },
      );
    if (effect === 'ghola')
      mutations.push(
        (g) => {
          player(g, 'p').tanks = 1;
        },
        (g) => {
          player(g, 'p').revived++;
        },
      );
    rejectsCorrupt(frame, mutations);
    const done = recover(frame);
    done.pendingTreacheryDiscard = structuredClone(
      frame.pendingTreacheryDiscard,
    );
    rejectsCorrupt(done, [() => {}]);
  }
});

void test('Ghola income and accrued technology cannot be rewritten or paid before the frame retires', () => {
  const g = fixture(4, true, ['emperor', 'harkonnen', 'tleilaxu']),
    card = hold(g, 'p', 'ghola');
  hold(g, 'q', 'karama');
  player(g, 'p').tanks = 1;
  player(g, 'p').reserves = 19;
  g.techTokens = createTechTokens(g.players);
  const frame = inner(g, 'p', { type: 'card', card, amount: 1 });
  rejectsCorrupt(frame, [
    (x) => {
      receipt(x).resume.response = null;
    },
    (x) => {
      receipt(x).resume.response!.owner = 'q';
    },
    (x) => {
      receipt(x).resume.response!.recipient = 'q';
    },
    (x) => {
      receipt(x).resume.response!.amount = 2;
    },
    (x) => {
      receipt(x).resume.response!.passed = ['q'];
    },
    (x) => {
      x.techTokens!.axlotl.spice++;
    },
    (x) => {
      x.techTokens!.axlotl.owner = 'q';
    },
    (x) => {
      x.techTokens!.axlotl.triggeredTurn = 1;
    },
    (x) => {
      player(x, 't').spice++;
    },
    (x) => {
      x.revivalFreeIncome = { p: x.turn };
    },
  ]);
});

void test('untrusted action JSON cannot select the internal shipment-preparation execution mode', () => {
  const g = fixture(4),
    card = hold(g, 'p', 'ghola');
  player(g, 'p').tanks = 1;
  player(g, 'p').reserves = 19;
  const frame = inner(g, 'p', {
    type: 'card',
    card,
    amount: 1,
    execution: 'shipmentPreparation',
    mode: 'shipmentPreparation',
  });
  assert.equal(receipt(frame).effect, 'ghola');
  assert.equal(player(frame, 'p').tanks, 0);
  assert.equal(recover(frame).resolvedTreacheryDiscardSequence, 1);
});

void test('a dead-leader preparation witness stays private and its Ghola cannot be diverted after a binding answer', () => {
  let g = fixture(6);
  player(g, 'p').forces = { 'arrakeen:10': 4 };
  player(g, 'p').reserves = 15;
  player(g, 'p').tanks = 1;
  player(g, 't').forces = { 'arrakeen:10': 4 };
  player(g, 't').reserves = 16;
  player(g, 'p').leaders[0].dead = true;
  player(g, 'p').leaders[0].deaths = 1;
  const card = hold(g, 'p', 'ghola'),
    leader = player(g, 'p').leaders[0].id;
  g.active = 'p';
  g = allow(
    applyAction(g, 'p', {
      type: 'chooseBattle',
      territory: 'arrakeen',
      target: 't',
    }),
  );
  while (g.battle?.preparation)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  g = ask(g, {
    kind: 'battlePlan',
    target: 'p',
    territory: 'arrakeen',
    claim: { kind: 'leader', leader },
  });
  g = applyAction(g, 'p', { type: 'truthAnswer', answer: 'yes' });
  const snapshot = structuredClone(g),
    prep = viewGame(g, 'p').battle!.compliantPreparation!;
  assert.equal(prep.actions[0].leader, leader);
  assert.equal(viewGame(g, 't').battle!.compliantPreparation, null);
  assert.deepEqual(g, snapshot);
  assert.throws(
    () => applyAction(g, 'p', { type: 'card', card, amount: 1 }),
    /voluntar/,
  );
  assert.deepEqual(g, snapshot);
  const { pending, done } = play(g, 'p', prep.actions[0]);
  assert.equal(player(pending, 'p').leaders[0].dead, false);
  assert.equal(done.battle!.truthPromises![0].released, undefined);
  const plan = viewGame(done, 'p').battle!.compliantPlan!;
  assert.equal(plan.leader, leader);
  assert.equal(
    applyAction(done, 'p', { type: 'battlePlan', ...plan }).battle!.plans.p
      .leader,
    leader,
  );
});

void test('an admitted shared Duke Ghola outcome binds the shared record outside all native leader arrays', () => {
  const g = fixture(4, true, ['ecaz', 'emperor', 'atreides']),
    card = hold(g, 'p', 'ghola');
  // Isolated saved-state precondition for the existing controlledLeaders path.
  // This does not assert how a controlled dead Duke arises in normal battle play.
  g.dukeVidal = acquireDuke(createDukeVidal(), 'p', g.turn, 'ecaz');
  g.dukeVidal.leader.dead = true;
  g.dukeVidal.leader.deaths = 1;
  const { pending, done } = play(g, 'p', {
    type: 'card',
    card,
    leader: DUKE_VIDAL_ID,
  });
  assert.equal(pending.dukeVidal!.leader.dead, false);
  assert.deepEqual(done.dukeVidal, pending.dukeVidal);
  assert.equal(
    done.players.some((p) => p.leaders.some((l) => l.id === DUKE_VIDAL_ID)),
    false,
  );
  rejectsCorrupt(pending, [
    (x) => {
      x.dukeVidal!.leader.dead = true;
    },
    (x) => {
      x.dukeVidal!.leader.deaths++;
    },
    (x) => {
      x.dukeVidal!.controller = 'q';
    },
    (x) => {
      x.dukeVidal!.leader.capturedBy = 'q';
    },
    (x) => {
      x.dukeVidal!.leader.gholaBy = 'q';
    },
    (x) => {
      delete x.dukeVidal;
    },
  ]);
});
