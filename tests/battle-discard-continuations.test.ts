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
import { baseDeck, type Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { createTechTokens } from '../game/tech-tokens';
import { createAuditorLeader, CHOAM_AUDITOR_ID } from '../game/choam-auditor';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
/** Test-only observation of the unchanged production inner dispatcher, before
 * its public wrapper drains automatic continuations. No runtime export or gate
 * is changed, and all resumed actions use the real production exports. */
const observed: {
  applyActionInner?: (g: Game, id: string, a: Action) => Game;
  finishResponse?: (g: Game, canceled: boolean) => void;
} = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL('../game/engine.ts', import.meta.url), 'utf8') +
      '\nexport { applyActionInner, finishResponse };\n',
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
function fixture(winner: FactionId = 'guild', extra?: 'moritani' | 'choam') {
  const g = createGame('BATTLEFRAME', newPlayer('w', 'Winner', winner), true);
  g.players.push(newPlayer('l', 'Loser', 'emperor'));
  if (extra) g.players.push(newPlayer('x', 'Observer', extra));
  Object.assign(g, {
    status: 'playing',
    phase: 6,
    turn: 2,
    storm: 18,
    active: 'w',
    order: g.players.map((p) => p.id),
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.forces = p.id === 'x' ? {} : { 'arrakeen:10': 5 };
    p.reserves = p.id === 'x' ? 20 : 15;
    p.spice = 20;
    p.hand = [];
    p.traitors = [];
    for (const leader of p.leaders) leader.strength = 0;
  }
  if (extra === 'moritani') {
    player(g, 'l').ally = 'x';
    player(g, 'x').ally = 'l';
  }
  return g;
}
function hold(g: Game, id: string, kind: Card['kind']) {
  const index = g.deck.findIndex((c) => c.kind === kind);
  assert.ok(index >= 0);
  const [card] = g.deck.splice(index, 1);
  player(g, id).hand.push(card);
  return card.id;
}
function inventory(g: Game) {
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((c) => c.id)
    .sort();
  assert.equal(
    new Set(ids).size,
    ids.length,
    'every physical card has one custodian',
  );
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  return ids;
}
function prepared(state: Game) {
  let g = applyAction(state, 'w', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'l',
  });
  for (let i = 0; i < 40; i++) {
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
    else return g;
  }
  throw Error('Preparation stalled');
}
function beforeLast(
  state: Game,
  options: {
    hero?: string;
    weapon?: string;
    defense?: string;
    loserWeapon?: string;
    loserDefense?: string;
    dial?: number;
    support?: number;
    traitors?: boolean;
  } = {},
) {
  let g = prepared(state);
  g = applyAction(g, 'w', {
    type: 'battlePlan',
    dial: options.dial ?? 2,
    support: options.support ?? 2,
    leader: options.hero ?? player(g, 'w').leaders[0].id,
    weapon: options.weapon,
    defense: options.defense,
  });
  g = applyAction(g, 'l', {
    type: 'battlePlan',
    dial: 0,
    support: 0,
    leader: player(g, 'l').leaders[0].id,
    weapon: options.loserWeapon,
    defense: options.loserDefense,
  });
  return applyAction(g, 'w', {
    type: 'traitorCall',
    call: options.traitors ?? false,
  });
}
const finalAction = (call = false): Action => ({ type: 'traitorCall', call });
function frame(g: Game, call = false) {
  const result = inner(g, 'l', finalAction(call));
  assert.equal(
    result.pendingTreacheryDiscard?.continuation.kind,
    'battleResolved',
  );
  return result;
}
function mandatory(g: Game) {
  const c = g.pendingTreacheryDiscard!.continuation;
  assert.equal(c.kind, 'battleResolved');
  if (c.kind !== 'battleResolved') throw Error('Wrong continuation');
  return c;
}
function stable(g: Game) {
  return g.players.map((p) => ({
    id: p.id,
    spice: p.spice,
    tanks: p.tanks,
    leaders: p.leaders,
  }));
}
function resumed(g: Game) {
  const result = normalizeAutomaticGame(reload(g));
  assert.equal(result.pendingTreacheryDiscard, null);
  assert.deepEqual(normalizeAutomaticGame(reload(result)), result);
  return result;
}

void test('last real traitor vote stages a mixed-owner public discard after double-traitor losses, with no replay', () => {
  const initial = fixture();
  const w = hold(initial, 'w', 'shield'),
    l = hold(initial, 'l', 'snooper');
  player(initial, 'w').traitors = [player(initial, 'l').leaders[0].id];
  player(initial, 'l').traitors = [player(initial, 'w').leaders[0].id];
  const ids = inventory(initial);
  const before = beforeLast(initial, {
    defense: w,
    loserDefense: l,
    traitors: true,
  });
  for (const p of before.players) {
    const revealed = viewGame(before, p.id).battle!;
    assert.equal(revealed.revealed, true);
    assert.deepEqual(
      revealed.cards.map((c) => c.id),
      [w, l],
    );
  }
  const pending = frame(before, true),
    batch = pending.pendingTreacheryDiscard!.batch;
  assert.deepEqual(
    batch.entries.map((e) => [e.card.id, e.discardedBy, e.publicFace]),
    [
      [w, 'w', true],
      [l, 'l', true],
    ],
  );
  assert.equal(batch.cause, 'battle:mandatory');
  assert.equal(mandatory(pending).winner, null);
  assert.equal(pending.battle, null);
  assert.deepEqual(pending.lastBattle, ['w', 'l']);
  assert.deepEqual(
    pending.players.map((p) => p.tanks),
    [5, 5],
  );
  assert.deepEqual(
    pending.players.map((p) => p.leaders[0].deaths),
    [1, 1],
  );
  const result = resumed(pending);
  assert.deepEqual(stable(result), stable(pending));
  assert.deepEqual(result, applyAction(before, 'l', finalAction(true)));
  assert.deepEqual(inventory(result), ids);
  assert.equal(result.resolvedTreacheryDiscardSequence, 1);
});

void test('winner hero and loser defense share one mandatory batch before the sole supported casualty allocation', () => {
  const initial = fixture();
  const hero = hold(initial, 'w', 'hero'),
    defense = hold(initial, 'l', 'snooper');
  const ids = inventory(initial),
    before = beforeLast(initial, { hero, loserDefense: defense });
  const pending = frame(before),
    c = mandatory(pending);
  assert.equal(c.casualties!.options.length, 1);
  assert.deepEqual(
    pending.pendingTreacheryDiscard!.batch.entries.map((e) => e.discardedBy),
    ['w', 'l'],
  );
  assert.equal(player(pending, 'w').tanks, 0);
  assert.equal(player(pending, 'l').tanks, 5);
  assert.equal(player(pending, 'w').spice, 18);
  const result = resumed(pending);
  assert.equal(player(result, 'w').tanks, 2);
  assert.equal(
    result.log.filter((e) => e.automatic?.name === 'Battle casualties').length,
    1,
  );
  assert.deepEqual(result, applyAction(before, 'l', finalAction()));
  assert.deepEqual(inventory(result), ids);
});

void test('Fedaykin casualty choices survive reload with their committed effective force allocation', () => {
  const initial = fixture('fremen');
  player(initial, 'w').elites = {
    reserves: 2,
    tanks: 0,
    forces: { 'arrakeen:10': 1 },
    revived: 0,
  };
  const defense = hold(initial, 'l', 'snooper');
  const pending = frame(
    beforeLast(initial, { loserDefense: defense, support: 0 }),
  );
  const options = mandatory(pending).casualties!.options;
  assert.ok(options.some((c) => c.normal === 2 && c.elite === 0));
  assert.ok(options.some((c) => c.normal === 0 && c.elite === 1));
  const result = resumed(pending);
  assert.equal(result.decision?.kind, 'battleLosses');
  assert.equal(player(result, 'w').tanks, 0);
  for (let choice = 0; choice < options.length; choice++) {
    const chosen = applyAction(reload(result), 'w', {
      type: 'decision',
      choice,
    });
    assert.equal(
      player(chosen, 'w').tanks,
      options[choice].normal + options[choice].elite,
    );
    assert.equal(player(chosen, 'w').elites!.tanks, options[choice].elite);
    inventory(chosen);
  }
});

void test('leader bounty and CHOAM support income occur once across mandatory and later winner discard frames', () => {
  const initial = fixture('guild', 'choam');
  player(initial, 'l').leaders[0].strength = 3;
  const weapon = hold(initial, 'w', 'projectile'),
    defense = hold(initial, 'l', 'snooper');
  const pending = frame(beforeLast(initial, { weapon, loserDefense: defense }));
  assert.equal(player(pending, 'w').spice, 21);
  assert.equal(player(pending, 'l').leaders[0].deaths, 1);
  assert.equal(player(pending, 'x').spice, 20);
  let result = resumed(pending);
  assert.equal(result.decision?.kind, 'battleCards');
  const cleanup = inner(result, 'w', { type: 'decision', discard: [weapon] });
  assert.equal(cleanup.pendingTreacheryDiscard?.batch.cause, 'battle:winner');
  assert.equal(cleanup.pendingTreacheryDiscard?.sequence, 2);
  assert.deepEqual(
    cleanup.pendingTreacheryDiscard?.batch.entries.map((e) => e.card.id),
    [weapon],
  );
  result = resumed(cleanup);
  assert.equal(player(result, 'x').spice, 21);
  assert.equal(player(result, 'l').leaders[0].deaths, 1);
  assert.equal(player(result, 'w').tanks, 2);
  assert.equal(result.resolvedTreacheryDiscardSequence, 2);
  inventory(result);
});

void test('Moritani reserves loser cards from the mandatory batch and disposes them only in its later cleanup', () => {
  const initial = fixture('guild', 'moritani');
  const hero = hold(initial, 'w', 'hero'),
    weapon = hold(initial, 'l', 'projectile'),
    defense = hold(initial, 'l', 'snooper');
  const pending = frame(
    beforeLast(initial, { hero, loserWeapon: weapon, loserDefense: defense }),
  );
  assert.deepEqual(
    pending.pendingTreacheryDiscard!.batch.entries.map((e) => e.card.id),
    [hero],
  );
  assert.deepEqual(pending.moritaniRetention!.played, [weapon, defense]);
  const result = resumed(pending);
  assert.equal(result.decision?.kind, 'moritaniRetention');
  const next = inner(result, 'l', { type: 'decision', keep: null });
  assert.equal(next.pendingTreacheryDiscard?.batch.cause, 'battle:moritani');
  assert.deepEqual(
    next.pendingTreacheryDiscard?.batch.entries.map((e) => e.card.id),
    [weapon, defense],
  );
  assert.equal(next.moritaniRetention, null);
  const settled = resumed(next);
  assert.equal(settled.resolvedTreacheryDiscardSequence, 2);
  assert.equal(player(settled, 'l').hand.length, 0);
  inventory(settled);
});

void test('an empty mandatory batch goes directly to cleanup without allocating a discard event', () => {
  const initial = fixture(),
    before = beforeLast(initial);
  const result = inner(before, 'l', finalAction());
  assert.equal(result.pendingTreacheryDiscard ?? null, null);
  assert.equal(result.treacheryDiscardSequence ?? 0, 0);
  assert.equal(player(result, 'w').tanks, 2);
  assert.deepEqual(
    normalizeAutomaticGame(result),
    applyAction(before, 'l', finalAction()),
  );
});

void test('winner and Moritani cleanup validate the event, complete played set, retained custody and consumed alliance record', () => {
  for (const source of ['winner', 'moritani'] as const) {
    const initial = fixture(
      'guild',
      source === 'moritani' ? 'moritani' : undefined,
    );
    const weapon = hold(initial, 'w', 'projectile'),
      defense = hold(initial, 'w', 'shield');
    const loserDefense = hold(initial, 'l', 'snooper');
    let g = applyAction(
      beforeLast(initial, { weapon, defense, loserDefense }),
      'l',
      finalAction(),
    );
    if (source === 'moritani')
      g = applyAction(g, 'w', { type: 'decision', discard: [] });
    const pending = inner(
      g,
      source === 'winner' ? 'w' : 'l',
      source === 'winner'
        ? { type: 'decision', discard: [weapon] }
        : { type: 'decision', keep: null },
    );
    const continuation = (state: Game) => {
      const c = state.pendingTreacheryDiscard!.continuation;
      if (c.kind !== 'battleCleanup') throw Error('Missing cleanup');
      return c;
    };
    assert.equal(continuation(pending).source, source);
    const changes: ((g: Game) => void)[] = [
      (g) => {
        continuation(g).event = 'stale';
      },
      (g) => {
        continuation(g).played = [];
      },
      (g) => {
        continuation(g).played.push(continuation(g).played[0]);
      },
      (g) => {
        continuation(g).player = 'stranger';
      },
      (g) => {
        continuation(g).source = source === 'winner' ? 'moritani' : 'winner';
      },
      (g) => {
        g.lastBattleContext!.territory = 'carthag';
      },
    ];
    if (source === 'winner')
      changes.push(
        (g) => {
          g.deck.push(
            structuredClone(player(g, 'w').hand.find((c) => c.id === defense)!),
          );
        },
        (g) => {
          continuation(g).kept = [];
        },
      );
    else
      changes.push(
        (g) => {
          delete continuation(g).retention;
        },
        (g) => {
          player(g, 'x').ally = null;
        },
        (g) => {
          continuation(g).retention!.turn--;
        },
        (g) => {
          continuation(g).retention!.played = [];
        },
      );
    for (const change of changes) {
      const corrupt = reload(pending);
      change(corrupt);
      const before = structuredClone(corrupt);
      assert.throws(() => normalizeAutomaticGame(corrupt));
      assert.throws(() => viewGame(corrupt, 'w'));
      assert.throws(() => applyAction(corrupt, 'w', { type: 'advanceBots' }));
      assert.deepEqual(corrupt, before);
    }
    resumed(pending);
    inventory(pending);
  }
});

void test('battle frames reject stale identity, private faces, custody corruption and inconsistent frozen casualties atomically', () => {
  const initial = fixture(),
    defense = hold(initial, 'l', 'snooper');
  const valid = frame(beforeLast(initial, { loserDefense: defense }));
  const corruptions: ((g: Game) => void)[] = [
    (g) => {
      g.turn++;
    },
    (g) => {
      g.phase = 7;
    },
    (g) => {
      g.treacheryDiscardSequence!++;
    },
    (g) => {
      g.lastBattle = ['l', 'w'];
    },
    (g) => {
      mandatory(g).combatants = ['w', 'w'];
    },
    (g) => {
      mandatory(g).territory = 'missing';
    },
    (g) => {
      mandatory(g).winner = 'stranger';
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.entries[0].publicFace = false;
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.entries[0].discardedBy = 'stranger';
    },
    (g) => {
      g.deck.push(structuredClone(g.discard[0]));
    },
    (g) => {
      g.discard = [];
    },
    (g) => {
      mandatory(g).cards = [defense];
    },
    (g) => {
      mandatory(g).casualties!.forces.normal++;
    },
    (g) => {
      mandatory(g).casualties!.options[0].normal++;
    },
    (g) => {
      mandatory(g).casualties!.dial = -1;
    },
    (g) => {
      g.pendingTreacheryDiscard!.batch.cause = 'battle:winner';
    },
    (g) => {
      delete mandatory(g).casualties;
    },
    (g) => {
      mandatory(g).event = 'stale-battle';
    },
    (g) => {
      mandatory(g).result = 'traitor';
    },
    (g) => {
      g.lastBattleContext!.winner = 'l';
    },
    (g) => {
      g.lastBattleContext!.turn--;
    },
  ];
  for (const corrupt of corruptions) {
    const g = reload(valid);
    corrupt(g);
    const before = structuredClone(g);
    assert.throws(() => normalizeAutomaticGame(g));
    assert.throws(() => applyAction(g, 'w', { type: 'advanceBots' }));
    assert.throws(() => viewGame(g, 'w'));
    assert.deepEqual(g, before);
  }
});

void test('all profiles wait on the public automatic marker; battle faces are public but unrelated hands remain private', () => {
  const initial = fixture(),
    defense = hold(initial, 'l', 'snooper');
  const secret = hold(initial, 'w', 'worthless');
  const pending = frame(beforeLast(initial, { loserDefense: defense }));
  for (const difficulty of DIFFICULTIES)
    for (const p of pending.players) {
      const view = viewGame(pending, p.id);
      view.players.find((other) => other.id === p.id)!.bot = difficulty;
      assert.equal(view.automaticContinuationPending, true);
      assert.deepEqual(botActions(view), []);
      assert.ok(!('pendingTreacheryDiscard' in view));
      const opponent = view.players.find((other) => other.id !== p.id)!;
      assert.equal(opponent.hand, undefined);
      if (p.id === 'l') assert.ok(!JSON.stringify(view).includes(secret));
    }
  const before = structuredClone(pending),
    automatic = runBots(reload(pending), 0);
  assert.equal(automatic.pendingTreacheryDiscard, null);
  assert.deepEqual(pending, before);
  assert.deepEqual(
    { ...automatic, botsPending: undefined },
    { ...resumed(pending), botsPending: undefined },
  );
});

for (const blockElite of [false, true])
  for (const blockSupport of [false, true])
    void test(`persisted Fremen casualties preserve actual Karama effects: elite ${blockElite ? 'canceled' : 'allowed'}, free support ${blockSupport ? 'canceled' : 'allowed'}`, () => {
      let g = fixture('fremen', 'choam');
      player(g, 'w').elites = {
        reserves: 2,
        tanks: 0,
        forces: { 'arrakeen:10': 1 },
        revived: 0,
      };
      const defense = hold(g, 'l', 'snooper');
      const karamas = g.deck.filter((c) => c.effect === 'karama');
      for (const card of karamas) {
        g.deck.splice(
          g.deck.findIndex((c) => c.id === card.id),
          1,
        );
        player(g, 'x').hand.push(card);
      }
      const ids = inventory(g);
      g = applyAction(g, 'w', {
        type: 'chooseBattle',
        territory: 'arrakeen',
        target: 'l',
      });
      for (let i = 0; g.response && i < 30; i++) {
        const cancel =
          (g.response.kind === 'eliteStrength' && blockElite) ||
          (g.response.kind === 'fremenSupport' && blockSupport);
        if (cancel)
          g = applyAction(g, 'x', {
            type: 'card',
            card: player(g, 'x').hand.find((c) => c.effect === 'karama')!.id,
            mode: 'cancel',
          });
        else
          g = applyAction(
            g,
            g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
            { type: 'passResponse' },
          );
      }
      assert.equal(g.response, null);
      assert.equal(
        g.discard.filter((c) => c.effect === 'karama').length,
        Number(blockElite) + Number(blockSupport),
      );
      while (g.battle?.preparation)
        g = applyAction(g, g.battle.preparation.owner, {
          type: 'declineBattlePower',
        });
      g = applyAction(g, 'w', {
        type: 'battlePlan',
        leader: player(g, 'w').leaders[0].id,
        dial: 2,
        support: blockSupport ? 2 : 0,
      });
      g = applyAction(g, 'l', {
        type: 'battlePlan',
        leader: player(g, 'l').leaders[0].id,
        dial: 0,
        support: 0,
        defense,
      });
      g = applyAction(g, 'w', finalAction());
      const pending = frame(g),
        commitment = mandatory(pending).casualties!;
      assert.equal(pending.battle, null);
      assert.equal(commitment.forces.freeSupport, !blockSupport);
      assert.equal(commitment.forces.eliteStrength, blockElite ? 1 : 2);
      assert.equal(commitment.forces.normal, 4);
      assert.equal(commitment.forces.elite, 1);
      assert.equal(player(pending, 'w').tanks, 0);
      const recovered = resumed(pending);
      assert.deepEqual(recovered, applyAction(g, 'l', finalAction()));
      if (commitment.options.length === 1) {
        assert.equal(player(recovered, 'w').tanks, 2);
        assert.equal(player(recovered, 'w').elites!.tanks, 0);
        assert.notEqual(recovered.decision?.kind, 'battleLosses');
      } else {
        assert.equal(recovered.decision?.kind, 'battleLosses');
        assert.equal(player(recovered, 'w').tanks, 0);
        if (recovered.decision?.kind !== 'battleLosses')
          throw Error('Missing casualty decision');
        assert.deepEqual(recovered.decision.options, commitment.options);
      }
      for (const p of recovered.players) viewGame(recovered, p.id);
      assert.deepEqual(inventory(recovered), ids);
    });

for (const winner of ['harkonnen', 'choam'] as const)
  void test(`${winner} simultaneous post-battle effects survive recovery and reject inconsistent saved obligations`, () => {
    const g = fixture(winner, winner === 'harkonnen' ? 'choam' : undefined);
    g.players.push(newPlayer('t', 'Tleilaxu', 'tleilaxu'));
    g.order.push('t');
    if (winner === 'choam') player(g, 'w').leaders.push(createAuditorLeader());
    g.techTokens = createTechTokens();
    g.techTokens.axlotl.owner = 'l';
    g.techTokens.production.owner = 'l';
    const defense = hold(g, 'l', 'snooper');
    hold(g, 'l', 'worthless');
    const ids = inventory(g);
    const before = beforeLast(g, {
      loserDefense: defense,
      ...(winner === 'choam' ? { hero: CHOAM_AUDITOR_ID } : {}),
    });
    const pending = frame(before);
    assert.ok(pending.pendingFaceDance);
    assert.ok(pending.pendingTech);
    if (winner === 'harkonnen') {
      assert.ok(pending.pendingCapture);
      assert.ok(pending.pendingChoamBattleIncome);
    } else assert.ok(pending.pendingAuditor);
    const result = resumed(pending);
    assert.deepEqual(result, applyAction(before, 'l', finalAction()));
    assert.equal(result.decision?.kind, 'techToken');
    assert.deepEqual(result.pendingFaceDance, pending.pendingFaceDance);
    assert.deepEqual(result.pendingCapture, pending.pendingCapture);
    assert.deepEqual(result.pendingAuditor, pending.pendingAuditor);
    if (winner === 'harkonnen') {
      assert.equal(player(result, 'x').spice, 21);
      assert.equal(result.pendingChoamBattleIncome, null);
    }
    for (const p of result.players) viewGame(result, p.id);
    assert.deepEqual(inventory(result), ids);
    const mutations: ((g: Game) => void)[] = [
      (g) => {
        g.pendingFaceDance!.winner = 'l';
      },
      (g) => {
        g.pendingFaceDance!.territory = 'carthag';
      },
      (g) => {
        g.pendingFaceDance!.player = 'l';
      },
      (g) => {
        g.pendingTech!.player = 'l';
      },
      (g) => {
        g.pendingTech!.loser = 'w';
      },
      (g) => {
        g.pendingTech!.choices = [];
      },
      (g) => {
        g.pendingTech!.choices.push(g.pendingTech!.choices[0]);
      },
      (g) => {
        g.techTokens!.axlotl.owner = 't';
      },
    ];
    if (winner === 'harkonnen')
      mutations.push(
        (g) => {
          g.pendingCapture!.player = 'l';
        },
        (g) => {
          g.pendingCapture!.loser = 'w';
        },
        (g) => {
          g.pendingCapture!.territory = 'carthag';
        },
        (g) => {
          g.pendingChoamBattleIncome!.amount = 0;
        },
        (g) => {
          g.pendingChoamBattleIncome!.amount = 0.5;
        },
        (g) => {
          g.pendingChoamBattleIncome!.owner = 'w';
        },
      );
    else
      mutations.push(
        (g) => {
          g.pendingAuditor!.event = 'stale';
        },
        (g) => {
          g.pendingAuditor!.territory = 'carthag';
        },
        (g) => {
          g.pendingAuditor!.stage = 'response';
        },
        (g) => {
          g.pendingAuditor!.owner = 'l';
        },
      );
    for (const mutate of mutations) {
      const corrupt = reload(pending);
      mutate(corrupt);
      const unchanged = structuredClone(corrupt);
      assert.throws(() => normalizeAutomaticGame(corrupt));
      assert.throws(() => applyAction(corrupt, 'w', { type: 'advanceBots' }));
      assert.throws(() => viewGame(corrupt, 'w'));
      assert.deepEqual(corrupt, unchanged);
    }
  });
