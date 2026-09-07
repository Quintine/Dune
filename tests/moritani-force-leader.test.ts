import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { type FactionId } from '../game/catalog';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createTechTokens } from '../game/tech-tokens';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const decide = (g: Game, extra: Omit<Action, 'type'>) =>
  applyAction(g, 'm', { type: 'decision', ...extra });
function fixture(
  kind: 'assassination' | 'sneakAttack' = 'assassination',
  entrant: FactionId = 'emperor',
) {
  const g = createGame('TERROR02', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(
    newPlayer('e', 'Entrant', entrant),
    newPlayer('a', 'Atreides', 'atreides'),
  );
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.active = 'e';
  g.order = ['e', 'm', 'a'];
  g.movementRemaining = [...g.order];
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
    p.hand = [];
  }
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find((t) => t.kind === kind)!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  return g;
}
const enter = (g: Game) =>
  applyAction(g, 'e', {
    type: 'ship',
    amount: 2,
    territory: 'arrakeen',
    sector: 10,
  });
const offered = (kind: 'assassination' | 'sneakAttack' = 'assassination') =>
  enter(fixture(kind));
function rejected(g: Game, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, 'm', action));
  assert.deepEqual(g, before);
}
const totalForces = (g: Game, id: string) => {
  const p = player(g, id);
  return (
    p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0)
  );
};

void test('Assassination selects exactly one live ordinary leader, spends its token and leaves the client no victim choice', () => {
  const g = offered();
  const original = structuredClone(player(g, 'e').leaders);
  assert.equal(original.length, 5);
  const done = decide(g, {
    reveal: true,
    leader: 'not-a-leader-or-a-valid-choice',
  });
  const victims = player(done, 'e').leaders.filter((leader) => leader.dead);
  assert.equal(victims.length, 1);
  assert.ok(original.some((leader) => leader.id === victims[0].id));
  assert.equal(victims[0].deaths, 1);
  assert.equal(player(done, 'm').spice, 20 + victims[0].strength);
  assert.equal(done.pendingTerrorEntry, null);
  assert.equal(done.decision, null);
  assert.equal(
    done.moritaniTerror!.tokens.find((t) => t.kind === 'assassination')!.status,
    'removed',
  );
  assert.deepEqual(player(g, 'e').leaders, original);
  for (const leader of player(done, 'e').leaders.filter(
    (leader) => !leader.dead,
  ))
    assert.deepEqual(
      leader,
      original.find((l) => l.id === leader.id),
    );
  rejected(reload(done), { type: 'decision', reveal: true });
});

void test('each native leader is eligible when alone alive; death count and battle-use marker settle exactly once', () => {
  for (let index = 0; index < 5; index++) {
    const initial = fixture();
    player(initial, 'e').leaders.forEach((leader, i) => {
      leader.dead = i !== index;
      leader.deaths = i === index ? 2 : 1;
      leader.usedAt = 'carthag';
    });
    const g = enter(initial);
    const before = structuredClone(player(g, 'e').leaders);
    const done = decide(reload(g), { reveal: true });
    const victim = player(done, 'e').leaders[index];
    assert.equal(victim.dead, true);
    assert.equal(victim.deaths, 3);
    assert.equal(victim.usedAt, undefined);
    assert.equal(player(done, 'm').spice, 20 + before[index].strength);
    for (let other = 0; other < 5; other++)
      if (other !== index)
        assert.deepEqual(player(done, 'e').leaders[other], before[other]);
    rejected(reload(done), { type: 'decision', reveal: true });
  }
});

void test('Assassination pays three for Zoal but leaves unaudited empty live-leader pools unchanged', () => {
  const initial = fixture('assassination', 'tleilaxu');
  const zoal = player(initial, 'e').leaders.find(
    (leader) => leader.name === 'Zoal',
  )!;
  assert.ok(zoal);
  for (const leader of player(initial, 'e').leaders)
    leader.dead = leader.id !== zoal.id;
  const done = decide(enter(initial), { reveal: true });
  assert.equal(player(done, 'm').spice, 23);
  assert.equal(
    player(done, 'e').leaders.find((leader) => leader.id === zoal.id)!.dead,
    true,
  );
  const empty = fixture();
  player(empty, 'e').leaders.forEach((leader) => {
    leader.dead = true;
    leader.deaths = 2;
  });
  const entered = enter(empty);
  assert.equal(viewGame(entered, 'm').terrorEntry!.canReveal, false);
  rejected(entered, { type: 'decision', reveal: true });
  assert.equal(
    entered.moritaniTerror!.tokens.find(
      (token) => token.kind === 'assassination',
    )!.status,
    'placed',
  );
  const declined = decide(entered, { decline: true });
  assert.deepEqual(declined.players, entered.players);
  assert.equal(declined.pendingTerrorEntry, null);
});

void test('unresolved native and foreign custody disables Assassination only in the owner projection and rejects atomically', () => {
  for (const field of ['capturedBy', 'gholaBy'] as const) {
    for (const foreign of [false, true]) {
      const initial = fixture();
      if (foreign) player(initial, 'a').leaders[0][field] = 'e';
      else player(initial, 'e').leaders[0][field] = 'a';
      const g = enter(initial);
      assert.equal(viewGame(g, 'm').terrorEntry!.canReveal, false);
      assert.equal('canReveal' in viewGame(g, 'e').terrorEntry!, false);
      assert.equal('kind' in viewGame(g, 'a').terrorEntry!, false);
      rejected(g, { type: 'decision', reveal: true });
      const declined = decide(g, { decline: true });
      assert.equal(declined.pendingTerrorEntry, null);
      assert.deepEqual(declined.players, g.players);
    }
  }
});

void test('Assassination is inspectable only by its owner before revelation', () => {
  const g = offered();
  assert.equal(viewGame(g, 'm').terrorEntry!.kind, 'assassination');
  assert.equal(viewGame(g, 'm').terrorEntry!.canReveal, true);
  for (const id of ['e', 'a']) {
    assert.equal('kind' in viewGame(g, id).terrorEntry!, false);
    assert.equal('canReveal' in viewGame(g, id).terrorEntry!, false);
    assert.ok(
      viewGame(g, id).moritaniTerror!.tokens.every(
        (token) => !('kind' in token),
      ),
    );
  }
});

void test('Sneak Attack deploys up to five reserves for free and does not consume ordinary shipment or movement', () => {
  const g = offered('sneakAttack');
  const owner = player(g, 'm');
  owner.shipped = true;
  owner.moved = 1;
  const revealed = decide(g, { reveal: true });
  assert.equal(revealed.pendingTerrorEntry?.stage, 'sneakAttack');
  assert.equal(
    revealed.moritaniTerror!.tokens.find(
      (token) => token.kind === 'sneakAttack',
    )!.status,
    'removed',
  );
  assert.equal(player(revealed, 'm').reserves, 20);
  const done = decide(reload(revealed), { amount: 5 });
  assert.equal(player(done, 'm').forces['arrakeen:10'], 5);
  assert.equal(player(done, 'm').reserves, 15);
  assert.equal(player(done, 'm').spice, 20);
  assert.equal(player(done, 'm').shipped, true);
  assert.equal(player(done, 'm').moved, 1);
  assert.equal(totalForces(done, 'm'), totalForces(g, 'm'));
  assert.equal(done.pendingTerrorEntry, null);
  assert.equal(done.decision, null);
  assert.deepEqual(player(done, 'e'), player(g, 'e'));
  rejected(reload(done), { type: 'decision', amount: 5 });
});

void test('Sneak Attack rejects invalid amounts without spending forces and zero completes without a new arrival', () => {
  const revealed = decide(offered('sneakAttack'), { reveal: true });
  for (const amount of [-1, 6, 1.5, '2', null, undefined, Infinity, NaN])
    rejected(revealed, { type: 'decision', amount });
  const limited = reload(revealed);
  player(limited, 'm').reserves = 2;
  rejected(limited, { type: 'decision', amount: 3 });
  const deployed = decide(limited, { amount: 2 });
  assert.equal(player(deployed, 'm').reserves, 0);
  assert.equal(player(deployed, 'm').forces['arrakeen:10'], 2);
  const none = decide(reload(revealed), { amount: 0 });
  assert.deepEqual(none.players, revealed.players);
  assert.equal(none.pendingTerrorEntry, null);
  assert.equal(none.decision, null);
  const empty = reload(revealed);
  player(empty, 'm').reserves = 0;
  rejected(empty, { type: 'decision', amount: 1 });
  assert.equal(decide(empty, { amount: 0 }).pendingTerrorEntry, null);
});

void test('Sneak Attack respects storm, printed sector, and two-enemy stronghold occupancy', () => {
  const revealed = decide(offered('sneakAttack'), { reveal: true });
  const storm = reload(revealed);
  storm.storm = 10;
  rejected(storm, { type: 'decision', amount: 1 });
  assert.equal(decide(storm, { amount: 0 }).pendingTerrorEntry, null);
  const invalid = reload(revealed);
  invalid.pendingTerrorEntry!.sector = 9;
  rejected(invalid, { type: 'decision', amount: 1 });
  const initial = fixture('sneakAttack');
  player(initial, 'a').forces = { 'arrakeen:10': 1 };
  player(initial, 'a').reserves = 19;
  const crowded = decide(enter(initial), { reveal: true });
  rejected(crowded, { type: 'decision', amount: 1 });
  assert.equal(decide(crowded, { amount: 0 }).pendingTerrorEntry, null);
});

void test('Sneak Attack reinforces a stronghold already occupied by Moritani without duplicating its prior forces', () => {
  const initial = fixture('sneakAttack');
  player(initial, 'm').forces = { 'arrakeen:10': 2 };
  player(initial, 'm').reserves = 18;
  const g = decide(enter(initial), { reveal: true });
  const done = decide(reload(g), { amount: 3 });
  assert.equal(player(done, 'm').forces['arrakeen:10'], 5);
  assert.equal(player(done, 'm').reserves, 15);
  assert.equal(totalForces(done, 'm'), 20);
});

void test('all four AI profiles offer legal Assassination and Sneak Attack decisions', () => {
  for (const difficulty of DIFFICULTIES) {
    for (const state of [
      offered(),
      offered('sneakAttack'),
      decide(offered('sneakAttack'), { reveal: true }),
    ]) {
      player(state, 'm').bot = difficulty;
      const actions = botActions(viewGame(state, 'm'));
      assert.ok(
        actions.length > 0,
        difficulty + ':' + state.pendingTerrorEntry?.stage,
      );
      for (const action of actions)
        assert.doesNotThrow(() => applyAction(state, 'm', action));
    }
  }
});

void test('unknown native leader identities cannot bypass Assassination; newly verified rosters are eligible', () => {
  const unknown = fixture();
  player(unknown, 'e').leaders[0].id = 'not-a-catalog-leader';
  const offeredUnknown = enter(unknown);
  assert.equal(viewGame(offeredUnknown, 'm').terrorEntry!.canReveal, false);
  rejected(offeredUnknown, { type: 'decision', reveal: true });
  for (const faction of ['choam', 'richese'] as const) {
    const known = enter(fixture('assassination', faction));
    assert.equal(viewGame(known, 'm').terrorEntry!.canReveal, true);
    const malformed = fixture('assassination', faction);
    player(malformed, 'e').leaders[0].id = 'unverified-expansion-leader';
    const missing = enter(malformed);
    assert.equal(viewGame(missing, 'm').terrorEntry!.canReveal, false);
    rejected(missing, { type: 'decision', reveal: true });
  }
});

void test('advanced Harkonnen tables uniformly disable Assassination without exposing hidden capture changes', () => {
  const initial = fixture();
  initial.advanced = true;
  const harkonnen = newPlayer('h', 'Harkonnen', 'harkonnen');
  initial.players.push(harkonnen);
  initial.order.push('h');
  const empty = enter(initial);
  assert.equal(viewGame(empty, 'm').terrorEntry!.canReveal, false);
  rejected(empty, { type: 'decision', reveal: true });
  const captured = structuredClone(initial);
  player(captured, 'e').leaders[0].capturedBy = 'h';
  const held = enter(captured);
  assert.deepEqual(
    viewGame(held, 'm').terrorEntry,
    viewGame(empty, 'm').terrorEntry,
  );
  rejected(held, { type: 'decision', reveal: true });
});

void test('Sneak Attack rejects an altered client sector and unsupported technology classification while allowing zero', () => {
  const revealed = decide(offered('sneakAttack'), { reveal: true });
  rejected(revealed, { type: 'decision', amount: 1, sector: 9 });
  const valid = decide(revealed, { amount: 1, sector: 10 });
  assert.equal(player(valid, 'm').forces['arrakeen:10'], 1);
  const technology = reload(revealed);
  technology.techTokens = createTechTokens();
  technology.techTokens.heighliners.owner = 'm';
  technology.techTokens.heighliners.spice = 2;
  rejected(technology, { type: 'decision', amount: 1 });
  const passed = decide(technology, { amount: 0 });
  assert.deepEqual(passed.techTokens, technology.techTokens);
  assert.deepEqual(passed.players, technology.players);
  assert.equal(passed.pendingTerrorEntry, null);
});

void test('Sneak Attack leaves unresolved Bene Gesserit arrival interactions unchanged and permits zero', () => {
  const initial = fixture('sneakAttack', 'beneGesserit');
  initial.advanced = true;
  player(initial, 'e').forces = { 'arrakeen:10': 1 };
  player(initial, 'e').reserves = 19;
  const revealed = decide(enter(initial), { reveal: true });
  rejected(revealed, { type: 'decision', amount: 1 });
  const done = decide(revealed, { amount: 0 });
  assert.deepEqual(done.players, revealed.players);
  assert.equal(done.pendingTerrorEntry, null);
  assert.equal(done.decision, null);
});

void test('all four AI profiles complete blocked effects by declining instead of retrying illegal choices', () => {
  const noLeaders = fixture();
  player(noLeaders, 'e').leaders.forEach((leader) => {
    leader.dead = true;
  });
  const blockedAssassination = enter(noLeaders);
  const blockedSneak = decide(offered('sneakAttack'), { reveal: true });
  blockedSneak.storm = 10;
  const blockedOffer = offered('sneakAttack');
  blockedOffer.storm = 10;
  const emptyOffer = offered('sneakAttack');
  player(emptyOffer, 'm').reserves = 0;
  assert.ok(viewGame(blockedOffer, 'm').terrorEntry!.sneakAttack?.blocked);
  assert.equal(viewGame(blockedOffer, 'm').terrorEntry!.stage, 'offer');
  assert.equal(viewGame(emptyOffer, 'm').terrorEntry!.sneakAttack?.maximum, 0);
  for (const state of [blockedOffer, emptyOffer]) {
    for (const id of ['e', 'a']) {
      assert.equal('sneakAttack' in viewGame(state, id).terrorEntry!, false);
      assert.equal('kind' in viewGame(state, id).terrorEntry!, false);
    }
  }
  for (const difficulty of DIFFICULTIES) {
    for (const state of [
      blockedAssassination,
      blockedSneak,
      blockedOffer,
      emptyOffer,
    ]) {
      const g = reload(state);
      player(g, 'm').bot = difficulty;
      const actions = botActions(viewGame(g, 'm'));
      assert.ok(actions.length > 0);
      for (const action of actions) {
        const done = applyAction(g, 'm', action);
        assert.equal(done.pendingTerrorEntry, null);
        assert.equal(done.decision, null);
        assert.deepEqual(done.players, g.players);
        if (state === blockedOffer || state === emptyOffer) {
          assert.equal(action.decline, true);
          assert.deepEqual(done.moritaniTerror, g.moritaniTerror);
          assert.equal(
            done.moritaniTerror!.tokens.find(
              (token) => token.kind === 'sneakAttack',
            )!.status,
            'placed',
          );
        }
      }
    }
  }
  assert.ok(viewGame(blockedSneak, 'm').terrorEntry!.sneakAttack?.blocked);
  assert.equal(
    'sneakAttack' in viewGame(blockedSneak, 'e').terrorEntry!,
    false,
  );
});
