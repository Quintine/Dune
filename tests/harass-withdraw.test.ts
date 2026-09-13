import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { quoteHarassWithdraw } from '../game/harass-withdraw';
import {
  quoteBattleResolution,
  type BattleResolutionInput,
} from '../game/battle-resolution-quote';
import {
  finishHarassPreparation,
  harassCustody,
  harassWithdrawGame,
  takeHarassCard,
} from './fixture-harass-withdraw';

const ownLeader = (g: Game) =>
  [...g.players[0].leaders].sort((a, b) => b.strength - a.strength)[0].id;
const otherLeader = (g: Game) =>
  [...g.players[1].leaders].sort((a, b) => a.strength - b.strength)[0].id;
function ownPlan(g: Game, extra: Partial<Action> = {}): Action {
  return {
    type: 'battlePlan',
    dial: 2,
    support: g.advanced ? 2 : 0,
    leader: ownLeader(g),
    defense: 'ecaz-harass-withdraw',
    ...extra,
  };
}
function seal(
  g: Game,
  own: Partial<Action> = {},
  other: Partial<Action> = {},
): Game {
  g = applyAction(g, g.players[0].id, ownPlan(g, own));
  return applyAction(g, g.players[1].id, {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: otherLeader(g),
    ...other,
  });
}
function resolve(g: Game, own = false, other = false): Game {
  g = applyAction(g, g.players[0].id, { type: 'traitorCall', call: own });
  for (const p of g.players)
    assert.deepEqual(
      viewGame(JSON.parse(JSON.stringify(g)), p.id),
      viewGame(g, p.id),
    );
  const before = JSON.stringify(g);
  const done = applyAction(g, g.players[1].id, {
    type: 'traitorCall',
    call: other,
  });
  assert.equal(JSON.stringify(g), before);
  harassCustody(done);
  for (const p of done.players)
    assert.deepEqual(
      viewGame(JSON.parse(JSON.stringify(done)), p.id),
      viewGame(done, p.id),
    );
  return done;
}
function reject(g: Game, player: string, action: Action, reason: RegExp) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, player, action), reason);
  assert.equal(JSON.stringify(g), before);
}
function setIdentity(
  g: Game,
  target: { get(): string; set(value: string): void },
  identity: string,
) {
  const entries = [
    ...(g.traitorReserve ?? []).map((_, i) => ({
      get: () => g.traitorReserve![i],
      set: (value: string) => {
        g.traitorReserve![i] = value;
      },
    })),
    ...g.players.flatMap((p) => [
      ...p.traitors.map((_, i) => ({
        get: () => p.traitors[i],
        set: (value: string) => {
          p.traitors[i] = value;
        },
      })),
      ...(p.faceDancers ?? []).map((_, i) => ({
        get: () => p.faceDancers![i].leader,
        set: (value: string) => {
          p.faceDancers![i].leader = value;
        },
      })),
    ]),
  ];
  const source = entries.find((entry) => entry.get() === identity)!;
  assert.ok(source);
  const old = target.get();
  source.set(old);
  target.set(identity);
}
function heldTraitor(g: Game, player: number, identity: string) {
  const p = g.players[player];
  setIdentity(
    g,
    {
      get: () => p.traitors[0],
      set: (value) => {
        p.traitors[0] = value;
      },
    },
    identity,
  );
}

void test('Harass & Withdraw returns only undialed forces for Basic/Advanced winners and losers in either slot', () => {
  for (const advanced of [false, true])
    for (const slot of ['weapon', 'defense'])
      for (const winning of [false, true]) {
        let g = harassWithdrawGame({ advanced });
        const start = g.players[0].reserves;
        g = seal(
          g,
          slot === 'weapon'
            ? { weapon: 'ecaz-harass-withdraw', defense: null }
            : {},
          winning
            ? {}
            : {
                dial: 5,
                support: advanced ? 5 : 0,
                leader: g.players[1].leaders[0].id,
              },
        );
        const done = resolve(g);
        assert.equal(done.lastBattleContext?.winner, winning ? 'a' : 'd');
        assert.equal(done.players[0].reserves, start + 3);
        assert.equal(done.players[0].tanks, 2);
        assert.deepEqual(done.players[0].forces, {});
        assert.equal(
          done.discard.filter((c) => c.id === 'ecaz-harass-withdraw').length,
          1,
        );
        assert.equal(
          done.log.filter((entry) =>
            entry.text.includes('used Harass & Withdraw'),
          ).length,
          1,
        );
        assert.equal(
          done.players[0].leaders.find((l) => l.id === ownLeader(g))!.dead,
          false,
        );
        reject(
          done,
          'd',
          { type: 'traitorCall', call: false },
          /battle|traitor|pending|response|Waiting|Resolve/i,
        );
      }
});

void test('zero dial and unique half-strength elite allocation preserve exact reserve and Tanks subpools', () => {
  let g = harassWithdrawGame();
  let done = resolve(seal(g, { dial: 0 }));
  assert.equal(done.players[0].reserves, 20);
  assert.equal(done.players[0].tanks, 0);
  g = harassWithdrawGame({ advanced: true, normal: 1, elite: 2 });
  const context = viewGame(g, 'a').battle!.harassWithdraw!;
  const quote = quoteHarassWithdraw(context, 1, 0);
  assert.deepEqual(quote.returned, { normal: 1, elite: 1 });
  done = resolve(seal(g, { dial: 1, support: 0 }));
  assert.equal(done.players[0].reserves, 19);
  assert.equal(done.players[0].tanks, 1);
  assert.equal(done.players[0].elites!.reserves, 4);
  assert.equal(done.players[0].elites!.tanks, 1);
  assert.deepEqual(done.players[0].elites!.forces, {});
});

void test('own successful traitor retains dialed forces but the used Harass card is a mandatory discard', () => {
  let g = harassWithdrawGame({ advanced: true });
  heldTraitor(g, 0, otherLeader(g));
  harassCustody(g);
  g = seal(g);
  const done = resolve(g, true, false);
  assert.equal(done.lastBattleContext?.result, 'traitor');
  assert.equal(done.players[0].reserves, 18);
  assert.equal(done.players[0].tanks, 0);
  assert.deepEqual(done.players[0].forces, { 'arrakeen:10': 2 });
  assert.equal(
    done.discard.filter((c) => c.id === 'ecaz-harass-withdraw').length,
    1,
  );
  assert.equal(
    done.players[0].spice,
    30 + g.players[1].leaders.find((l) => l.id === otherLeader(g))!.strength,
  );
});

void test('opposing and mutual traitor calls cancel withdrawal before forces return', () => {
  for (const mutual of [false, true]) {
    let g = harassWithdrawGame();
    heldTraitor(g, 1, ownLeader(g));
    if (mutual) heldTraitor(g, 0, otherLeader(g));
    g = seal(g);
    const done = resolve(g, mutual, true);
    assert.equal(done.players[0].reserves, 15);
    assert.equal(done.players[0].tanks, 5);
    assert.equal(
      done.log.filter((entry) =>
        entry.text.includes('Harass & Withdraw was canceled'),
      ).length,
      1,
    );
    assert.equal(
      done.log.filter((entry) => entry.text.includes('used Harass & Withdraw'))
        .length,
      0,
    );
    assert.equal(
      done.players[0].leaders.find((l) => l.id === ownLeader(g))!.dead,
      true,
    );
    assert.equal(
      done.discard.filter((c) => c.id === 'ecaz-harass-withdraw').length,
      1,
    );
  }
});

void test('weapon deaths and Lasgun/Shield explosion occur after undialed returns', () => {
  let g = harassWithdrawGame();
  const weapon = g.deck.find((c) => c.kind === 'projectile')!;
  takeHarassCard(g, 'd', weapon.id);
  let done = resolve(seal(g, {}, { weapon: weapon.id }));
  assert.equal(done.players[0].reserves, 18);
  assert.equal(done.players[0].tanks, 2);
  assert.equal(
    done.players[0].leaders.find((l) => l.id === ownLeader(g))!.dead,
    true,
  );
  g = harassWithdrawGame({ advanced: true });
  const shield = g.deck.find((c) => c.kind === 'shield')!,
    lasgun = g.deck.find((c) => c.kind === 'lasgun')!;
  takeHarassCard(g, 'a', shield.id);
  takeHarassCard(g, 'd', lasgun.id);
  g.players[2].forces = { 'arrakeen:10': 3 };
  g.players[2].reserves -= 3;
  done = resolve(
    seal(
      g,
      { weapon: 'ecaz-harass-withdraw', defense: shield.id },
      { weapon: lasgun.id },
    ),
  );
  assert.equal(done.lastBattleContext?.result, 'explosion');
  assert.equal(done.players[0].reserves, 18);
  assert.equal(done.players[0].tanks, 2);
  assert.equal(done.players[1].tanks, 5);
  assert.equal(done.players[2].tanks, 3);
  assert.equal(done.players[2].reserves, 17);
  assert.deepEqual(done.players[2].forces, {});
  assert.equal(
    done.players[0].leaders.find((l) => l.id === ownLeader(g))!.dead,
    true,
  );
  assert.equal(
    done.discard.filter((c) => c.id === 'ecaz-harass-withdraw').length,
    1,
  );
});

void test('a later Face Dancer can replace only the dialed survivors, never returned reserves', () => {
  let g = harassWithdrawGame();
  heldTraitor(g, 0, otherLeader(g));
  const t = g.players[2];
  setIdentity(
    g,
    {
      get: () => t.faceDancers![0].leader,
      set: (value) => {
        t.faceDancers![0].leader = value;
      },
    },
    ownLeader(g),
  );
  g = resolve(seal(g), true, false);
  assert.equal(g.decision?.kind, 'faceDance');
  reject(
    g,
    't',
    { type: 'decision', reveal: true, sources: { reserves: 3 }, sector: 10 },
    /more forces than the winner/,
  );
  g = applyAction(JSON.parse(JSON.stringify(g)), 't', {
    type: 'decision',
    reveal: true,
    sources: { reserves: 2 },
    sector: 10,
  });
  assert.equal(g.players[0].reserves, 20);
  assert.equal(g.players[0].tanks, 0);
  assert.equal(g.players[2].forces['arrakeen:10'], 2);
  assert.equal(g.players[2].reserves, 18);
  harassCustody(g);
});

void test('Harkonnen capture follows withdrawal and mandatory discard without recapturing returned counters', () => {
  let g = harassWithdrawGame({
    advanced: true,
    factions: ['emperor', 'harkonnen', 'guild'],
  });
  const leader = [...g.players[0].leaders].sort(
    (a, b) => a.strength - b.strength,
  )[0].id;
  const winnerLeader = [...g.players[1].leaders].sort(
    (a, b) => b.strength - a.strength,
  )[0].id;
  g = resolve(
    seal(g, { leader }, { dial: 5, support: 5, leader: winnerLeader }),
  );
  assert.equal(g.lastBattleContext?.winner, 'd');
  assert.equal(g.players[0].leaders.find((l) => l.id === leader)!.dead, false);
  assert.equal(g.players[0].reserves, 18);
  assert.equal(g.players[0].tanks, 2);
  assert.equal(
    g.discard.filter((c) => c.id === 'ecaz-harass-withdraw').length,
    1,
  );
  assert.equal(g.decision?.kind, 'captureOffer');
  g = applyAction(JSON.parse(JSON.stringify(g)), 'd', {
    type: 'decision',
    accept: true,
  });
  while (g.response) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  assert.equal(g.decision?.kind, 'capturedLeader');
  assert.equal(
    g.players[0].leaders.filter((l) => l.capturedBy === 'd').length,
    1,
  );
  for (const p of g.players)
    assert.deepEqual(
      viewGame(JSON.parse(JSON.stringify(g)), p.id),
      viewGame(g, p.id),
    );
  g = applyAction(g, 'd', { type: 'decision', mode: 'keep' });
  assert.equal(g.players[0].reserves, 18);
  assert.equal(g.players[0].tanks, 2);
  assert.equal(
    g.discard.filter((c) => c.id === 'ecaz-harass-withdraw').length,
    1,
  );
  harassCustody(g);
});

void test('Moritani ally retention excludes the used Harass card while preserving an ordinary played card', () => {
  let g = harassWithdrawGame({ factions: ['emperor', 'atreides', 'moritani'] });
  g.players[0].ally = 't';
  g.players[2].ally = 'a';
  const weapon = takeHarassCard(
    g,
    'a',
    g.deck.find((c) => c.kind === 'projectile')!.id,
  );
  const shield = takeHarassCard(
    g,
    'd',
    g.deck.find((c) => c.kind === 'shield')!.id,
  );
  g = resolve(
    seal(
      g,
      { weapon: weapon.id },
      {
        dial: 5,
        leader: [...g.players[1].leaders].sort(
          (a, b) => b.strength - a.strength,
        )[0].id,
        defense: shield.id,
      },
    ),
  );
  assert.equal(g.lastBattleContext?.winner, 'd');
  assert.equal(g.players[0].reserves, 18);
  assert.equal(g.players[0].tanks, 2);
  // The winner may still choose its ordinary discard before the ally benefit.
  if (g.decision?.kind === 'battleCards')
    g = applyAction(g, g.decision.player, { type: 'decision', discard: [] });
  assert.equal(g.decision?.kind, 'moritaniRetention');
  assert.deepEqual(g.moritaniRetention!.eligible, [weapon.id]);
  reject(
    g,
    'a',
    { type: 'decision', keep: 'ecaz-harass-withdraw' },
    /eligible|retain|Choose/i,
  );
  g = applyAction(JSON.parse(JSON.stringify(g)), 'a', {
    type: 'decision',
    keep: weapon.id,
  });
  while (g.response) {
    const p = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(g, p.id, { type: 'passResponse' });
  }
  assert.ok(g.players[0].hand.some((c) => c.id === weapon.id));
  assert.equal(
    g.discard.filter((c) => c.id === 'ecaz-harass-withdraw').length,
    1,
  );
  harassCustody(g);
});

void test('co-present reciprocal Ecaz allies are publicly guarded before sealing either combat side', () => {
  for (const side of [0, 1]) {
    const g = harassWithdrawGame({ factions: ['emperor', 'atreides', 'ecaz'] });
    g.players[side].ally = 't';
    g.players[2].ally = g.players[side].id;
    g.players[2].forces = { 'arrakeen:10': 3 };
    g.players[2].reserves = 17;
    assert.match(
      viewGame(g, 'a').battle!.harassWithdraw!.blocked!,
      /combined-army/,
    );
    reject(g, 'a', ownPlan(g), /combined-army/);
    // The guard depends on the visible coalition, not its cards or leader choice.
    const hidden = structuredClone(g);
    takeHarassCard(
      hidden,
      'd',
      hidden.deck.find((c) => c.kind === 'poison')!.id,
    );
    assert.deepEqual(
      viewGame(hidden, 'a').battle!.harassWithdraw,
      viewGame(g, 'a').battle!.harassWithdraw,
    );
    g.players[2].forces = {};
    g.players[2].reserves = 20;
    assert.equal(viewGame(g, 'a').battle!.harassWithdraw!.blocked, null);
    assert.doesNotThrow(() => applyAction(g, 'a', ownPlan(g)));
    harassCustody(g);
  }
});

void test('legacy ambiguous unit mixes and sector allocations reject before sealing without hidden opponent dependence', () => {
  let g = harassWithdrawGame({ advanced: true, normal: 3, elite: 1 });
  delete g.battle!.harassAllocationVersion;
  reject(
    g,
    'a',
    ownPlan(g, { dial: 2, support: 1 }),
    /ambiguous regular\/elite/,
  );
  g = harassWithdrawGame({ territory: 'imperial_basin', sector: 9 });
  delete g.battle!.harassAllocationVersion;
  g.players[0].forces = { 'imperial_basin:9': 2, 'imperial_basin:10': 3 };
  const preview = viewGame(g, 'a').battle!.harassWithdraw!;
  assert.throws(
    () => quoteHarassWithdraw(preview, 2, 0),
    /ambiguous allocation among sectors/,
  );
  reject(g, 'a', ownPlan(g), /ambiguous allocation among sectors/);
  const hidden = structuredClone(g);
  takeHarassCard(
    hidden,
    'd',
    hidden.deck.find((c) => c.kind === 'projectile')!.id,
  );
  assert.deepEqual(viewGame(hidden, 'a').battle!.harassWithdraw, preview);
  assert.doesNotThrow(() => applyAction(g, 'a', ownPlan(g, { dial: 0 })));
  assert.doesNotThrow(() => applyAction(g, 'a', ownPlan(g, { dial: 5 })));
});

void test('Prescience binds no category while retaining the exact private Harass slot and ordinary reveal', () => {
  let g = harassWithdrawGame({ prepare: false });
  const named = takeHarassCard(
    g,
    'a',
    g.deck.find((c) => c.kind === 'projectile')!.id,
  );
  assert.equal(g.battle?.preparation?.kind, 'prescience');
  g = applyAction(g, 'd', { type: 'prescience', field: 'weapon' });
  while (g.response) {
    const next = g.players.find((p) => !g.response!.passed.includes(p.id))!;
    g = applyAction(g, next.id, { type: 'passResponse' });
  }
  reject(
    g,
    'a',
    { type: 'prescienceAnswer', value: 'ecaz-harass-withdraw' },
    /legal battle plan/,
  );
  g = applyAction(g, 'a', { type: 'prescienceAnswer', value: null });
  g = finishHarassPreparation(g);
  g = applyAction(
    g,
    'a',
    ownPlan(g, { weapon: 'ecaz-harass-withdraw', defense: null }),
  );
  for (const player of ['a', 'd'])
    assert.equal(viewGame(g, player).battle!.insight!.value, null);
  const observer = viewGame(g, 't');
  assert.equal(observer.battle!.insight, null);
  assert.equal(observer.battle!.harassWithdraw, null);
  assert.deepEqual(observer.battle!.plans, {});
  assert.deepEqual(observer.battle!.cards, []);
  const roundtrip = JSON.parse(JSON.stringify(g));
  for (const p of g.players)
    assert.deepEqual(viewGame(roundtrip, p.id), viewGame(g, p.id));
  assert.equal(g.battle!.nexusInspection, undefined);
  for (const change of ['replace', 'move', 'remove-field']) {
    const corrupt: Game = JSON.parse(JSON.stringify(g));
    corrupt.battle!.plans.a.weapon = named.id;
    corrupt.battle!.plans.a.defense =
      change === 'move' ? 'ecaz-harass-withdraw' : null;
    if (change === 'remove-field')
      Reflect.deleteProperty(corrupt.battle!.plans.a, 'weapon');
    const before = JSON.stringify(corrupt);
    for (const p of corrupt.players)
      assert.throws(() => viewGame(corrupt, p.id), /inspected commitment/);
    assert.equal(JSON.stringify(corrupt), before);
    reject(
      corrupt,
      'a',
      { type: 'setAutopilot', difficulty: 'Easy' },
      /inspected commitment/,
    );
    reject(
      corrupt,
      'd',
      { type: 'battlePlan', dial: 0, leader: otherLeader(g) },
      /inspected commitment/,
    );
  }
  g = applyAction(roundtrip, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: otherLeader(g),
  });
  assert.equal(viewGame(g, 't').battle!.plans.a.weapon, 'ecaz-harass-withdraw');
  assert.ok(
    viewGame(g, 't').battle!.cards.some((c) => c.id === 'ecaz-harass-withdraw'),
  );
  resolve(g);
});

void test('saved Harass pairs cannot supply an actual defense for Chemistry or weapon for Weirding Way', () => {
  for (const invalid of ['ix-chemistry', 'ix-weirding-way']) {
    let g = harassWithdrawGame();
    takeHarassCard(g, 'a', invalid);
    const context = viewGame(g, 'a').battle!.harassWithdraw!;
    g = seal(
      g,
      invalid === 'ix-chemistry'
        ? {}
        : { weapon: 'ecaz-harass-withdraw', defense: null },
    );
    const side = (index: number) => {
      const p = g.players[index],
        plan = g.battle!.plans[p.id];
      return {
        id: p.id,
        faction: p.faction,
        spice: p.spice,
        hand: p.hand,
        plan,
        leader: p.leaders.find((l) => l.id === plan.leader),
        forces:
          index === 0
            ? context.forces
            : {
                normal: 5,
                elite: 0,
                eliteStrength: 1 as const,
                freeSupport: true,
              },
        ...(index === 0 ? { harassWithdraw: context } : {}),
      };
    };
    const input: BattleResolutionInput = {
      advanced: false,
      turn: g.turn,
      territory: g.battle!.territory,
      attacker: side(0),
      defender: side(1),
      voters: g.players
        .slice(0, 2)
        .map((p) => ({
          id: p.id,
          beneficiary: p.id,
          called: false,
          traitors: p.traitors,
        })),
      participants: g.players.map((p) => ({ id: p.id, faction: p.faction })),
      physicalCards: [
        ...g.deck,
        ...g.discard,
        ...g.players.flatMap((p) => p.hand),
      ],
      pendingAuditorPresent: false,
      pendingRetentionPresent: false,
    };
    assert.doesNotThrow(() => quoteBattleResolution(input));
    g.battle!.plans.a[invalid === 'ix-chemistry' ? 'weapon' : 'defense'] =
      invalid;
    const before = JSON.stringify(g),
      quoteBefore = JSON.stringify(input);
    assert.throws(
      () => quoteBattleResolution(input),
      /invalid weapon and defense pair/,
    );
    assert.equal(JSON.stringify(input), quoteBefore);
    for (const p of g.players)
      assert.throws(() => viewGame(g, p.id), /invalid weapon and defense pair/);
    assert.equal(JSON.stringify(g), before);
    reject(
      g,
      'a',
      { type: 'setAutopilot', difficulty: 'Easy' },
      /invalid weapon and defense pair/,
    );
    reject(
      g,
      'd',
      { type: 'traitorCall', call: false },
      /invalid weapon and defense pair/,
    );
    harassCustody(g);
  }
});

void test('Basic and Advanced Ixian half-dial withdrawal preserves all seven physical cyborgs', () => {
  for (const advanced of [false, true]) {
    let g = harassWithdrawGame({
      advanced,
      factions: ['ixians', 'atreides', 'tleilaxu'],
      normal: 2,
      elite: 2,
    });
    harassCustody(g);
    const quoted = quoteHarassWithdraw(
      viewGame(g, 'a').battle!.harassWithdraw!,
      0.5,
      0,
    );
    assert.deepEqual(quoted.returned, { normal: 1, elite: 2 });
    g = resolve(seal(g, { dial: 0.5, support: 0 }));
    assert.equal(g.lastBattleContext?.winner, 'a');
    assert.equal(g.players[0].reserves, 19);
    assert.equal(g.players[0].tanks, 1);
    assert.equal(g.players[0].elites!.reserves, 7);
    assert.equal(g.players[0].elites!.tanks, 0);
    assert.deepEqual(g.players[0].forces, {});
    assert.equal(
      g.discard.filter((c) => c.id === 'ecaz-harass-withdraw').length,
      1,
    );
    harassCustody(g);
  }
});

void test('Reinforcements and public Richese/optional-module contexts remain guarded', () => {
  let g = harassWithdrawGame();
  takeHarassCard(g, 'a', 'ecaz-reinforcements');
  reject(
    g,
    'a',
    ownPlan(g, { defense: 'ecaz-reinforcements' }),
    /Reinforcements.*still/,
  );
  const richese = harassWithdrawGame({
    factions: ['emperor', 'atreides', 'richese'],
  });
  assert.match(
    viewGame(richese, 'a').battle!.harassWithdraw!.blocked!,
    /Richese card family/,
  );
  reject(richese, 'a', ownPlan(richese), /Richese card family/);
  g = harassWithdrawGame({ factions: ['emperor', 'atreides', 'choam'] });
  assert.equal(viewGame(g, 'a').battle!.harassWithdraw!.blocked, null);
  const forged = structuredClone(g);
  forged.nexusCards = { cards: null, phase: null };
  reject(forged, 'a', ownPlan(forged), /optional modules|Nexus/i);
});

void test('malformed sealed withdrawal allocations reject private reads and both ordinary/autopilot actions', () => {
  let g = harassWithdrawGame({ advanced: true, normal: 3, elite: 1 });
  delete g.battle!.harassAllocationVersion;
  g = applyAction(g, 'a', ownPlan(g, { dial: 0, support: 0 }));
  g.battle!.plans.a.dial = 2;
  g.battle!.plans.a.support = 1;
  for (const p of g.players)
    assert.throws(() => viewGame(g, p.id), /ambiguous regular\/elite/);
  reject(
    g,
    'a',
    { type: 'setAutopilot', difficulty: 'Easy' },
    /ambiguous regular\/elite/,
  );
  reject(
    g,
    'd',
    { type: 'battlePlan', dial: 0, leader: otherLeader(g) },
    /ambiguous regular\/elite/,
  );
  g = harassWithdrawGame();
  g.players[0].reserves = Number.MAX_SAFE_INTEGER;
  reject(g, 'a', ownPlan(g), /reserve and elite counters/);
  g = harassWithdrawGame();
  g = applyAction(g, 'a', ownPlan(g));
  g.battle!.plans.a.leader = 'ecaz-harass-withdraw';
  g.battle!.plans.a.defense = null;
  for (const p of g.players)
    assert.throws(
      () => viewGame(g, p.id),
      /exactly one ordinary Battle Plan card slot/,
    );
});
