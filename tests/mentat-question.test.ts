import assert from 'node:assert/strict';
import test, { mock } from 'node:test';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import {
  mentatHand,
  mentatWeaponNames,
  quoteMentatReveal,
} from '../game/mentat-question';
import { baseDeck, ixDeck } from '../game/cards';
import {
  finishMentatPosture,
  mentatPlayer,
  mentatQuestionGame,
  mentatReload,
} from './mentat-question-fixture';

function reject(game: Game, owner: string, action: Action) {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, owner, action));
  assert.equal(JSON.stringify(game), before);
}
function resources(game: Game) {
  return structuredClone({
    players: game.players,
    deck: game.deck,
    discard: game.discard,
    cache: game.richeseCache,
    skills: game.leaderSkills,
  });
}
function nameWeapon(game: Game, weapon = 'Crysknife') {
  return applyAction(game, 'a', {
    type: 'decision',
    event: game.battle!.mentatQuestionEvent,
    weapon,
  });
}
function ask(game: Game, weapon = 'Crysknife') {
  const pending = nameWeapon(game, weapon),
    choice = viewGame(pending, 'd').mentat.pending!;
  return applyAction(pending, 'd', {
    type: 'decision',
    event: choice.event,
    card: choice.cards[0].id,
  });
}
function finishPowers(game: Game) {
  game = finishMentatPosture(game);
  for (
    let i = 0;
    i < 12 &&
    (game.battle?.preparation || game.decision?.kind === 'fullPlanOffer');
    i++
  ) {
    game =
      game.decision?.kind === 'fullPlanOffer'
        ? applyAction(game, game.decision.player, {
            type: 'decision',
            decline: true,
          })
        : applyAction(game, game.battle!.preparation!.owner, {
            type: 'declineBattlePower',
          });
  }
  return game;
}

void test('Mentat names exact printed/default weapons and validates physical hands without permissive slot substitutes', () => {
  assert.equal(mentatWeaponNames([]).length, 9);
  const choam = mentatWeaponNames(['choam']);
  for (const name of [
    'Poison Tooth',
    'Artillery Strike',
    'Stone Burner',
    'Mirror Weapon',
  ])
    assert.ok(choam.includes(name));
  const ix = mentatWeaponNames(['ix']);
  for (const name of [
    'Poison Blade',
    'Hunter Seeker',
    'Basilia Weapon',
    'Weirding Way',
  ])
    assert.ok(ix.includes(name));
  for (const name of [
    'Chemistry',
    'Baliset',
    'Snooper',
    'Cheap Hero',
    'Residual Poison',
    'poison',
    'projectile',
  ]) {
    assert.ok(!choam.includes(name));
    assert.ok(!ix.includes(name));
    assert.throws(() => quoteMentatReveal(baseDeck().slice(0, 1), name, []));
  }
  assert.throws(() => mentatHand([baseDeck()[0], baseDeck()[0]], []));
  assert.throws(() => mentatHand([{ ...baseDeck()[0], name: 'Lasgun' }], []));
  assert.throws(() => mentatHand(ixDeck().slice(0, 1), []));
});

void test('Mentat requires a private preview opt-in and never exposes or accepts that flag through a player view or action', () => {
  for (const advanced of [false, true])
    for (const choam of [false, true]) {
      const ordinary = mentatQuestionGame({ advanced, choam, preview: false });
      assert.equal(ordinary.mentatQuestionPreview, undefined);
      assert.equal(ordinary.battle!.mentatQuestionVersion, undefined);
      assert.equal(ordinary.battle!.mentatQuestion, undefined);
      assert.equal(ordinary.decision?.kind, 'leaderSkillVisibility');
      assert.equal(viewGame(ordinary, 'a').mentat.pending, null);
      assert.equal(
        applyAction(ordinary, 'a', {
          type: 'advanceBots',
          mentatQuestionPreview: true,
        }).mentatQuestionPreview,
        undefined,
      );
    }
  const preview = mentatReload(mentatQuestionGame());
  assert.equal(preview.mentatQuestionPreview, true);
  assert.equal(
    normalizeAutomaticGame(preview).decision?.kind,
    'mentatQuestion',
  );
  for (const id of ['a', 'd', 'o'])
    assert.equal('mentatQuestionPreview' in viewGame(preview, id), false);
  delete preview.mentatQuestionPreview;
  for (const operation of [
    () => viewGame(preview, 'a'),
    () => normalizeAutomaticGame(preview),
    () => applyAction(preview, 'a', { type: 'advanceBots' }),
  ])
    assert.throws(operation);
});

for (const advanced of [false, true])
  for (const choam of [false, true])
    void test(`genuine ${choam ? 'CHOAM' : 'base'} ${advanced ? 'Advanced' : 'Basic'} Mentat asks privately before posture and faction powers`, () => {
      const game = mentatQuestionGame({
        advanced,
        choam,
        cards: [choam ? 'Poison Tooth' : 'Crysknife', 'Snooper'],
      });
      const before = resources(game),
        event = game.battle!.mentatQuestionEvent;
      assert.equal(game.decision?.kind, 'mentatQuestion');
      assert.equal(game.battle!.preparation, undefined);
      assert.equal(game.battle!.leaderSkillHidden, undefined);
      for (const owner of ['d', 'o'])
        assert.deepEqual(viewGame(game, owner).mentat.pending!.weapons, []);
      mock.method(globalThis.crypto, 'getRandomValues', () => {
        throw new Error('Unexpected disclosure RNG');
      });
      mock.method(globalThis.crypto, 'randomUUID', () => {
        throw new Error('Unexpected new disclosure event');
      });
      let done: Game;
      try {
        done = ask(mentatReload(game), choam ? 'Poison Tooth' : 'Crysknife');
      } finally {
        mock.restoreAll();
      }
      assert.deepEqual(resources(done), before);
      assert.equal(done.decision?.kind, 'leaderSkillVisibility');
      assert.equal(done.battle!.preparation, undefined);
      const observed = viewGame(done, 'a').mentat.history[0];
      assert.equal(observed.event, event);
      assert.equal(observed.card.id, mentatPlayer(game, 'd').hand[0].id);
      assert.deepEqual(viewGame(done, 'o').mentat.history, []);
      assert.ok(
        !JSON.stringify(viewGame(done, 'o')).includes(observed.card.id),
      );
      assert.ok(!JSON.stringify(done.log).includes(observed.card.id));
      assert.deepEqual(normalizeAutomaticGame(mentatReload(done)), done);
      done = finishMentatPosture(done);
      assert.equal(done.battle!.leaderSkillHidden!.a, true);
      assert.ok(
        done.battle!.preparation || done.decision?.kind === 'fullPlanOffer',
      );
      reject(done, 'a', { type: 'decision', event, weapon: 'Lasgun' });
    });

void test('absent weapon requires the opponent’s private choice of any other card, with no transfer, reservation or plan promise afterward', () => {
  let game = mentatQuestionGame();
  const before = resources(game),
    event = game.battle!.mentatQuestionEvent;
  game = nameWeapon(game, 'Lasgun');
  assert.equal(game.decision?.player, 'd');
  assert.equal(game.decision?.kind, 'mentatQuestion');
  for (const owner of ['a', 'o'])
    assert.deepEqual(viewGame(game, owner).mentat.pending!.cards, []);
  assert.deepEqual(
    viewGame(game, 'd').mentat.pending!.cards,
    mentatPlayer(game, 'd').hand,
  );
  reject(game, 'a', {
    type: 'decision',
    event,
    card: mentatPlayer(game, 'd').hand[1].id,
  });
  reject(game, 'd', {
    type: 'decision',
    event: 'stale',
    card: mentatPlayer(game, 'd').hand[1].id,
  });
  reject(game, 'd', { type: 'decision', event, decline: true });
  reject(game, 'd', { type: 'decision', event, card: 'missing' });
  reject(game, 'o', {
    type: 'card',
    card: mentatPlayer(game, 'o').hand[0].id,
    mode: 'special',
  });
  game = applyAction(mentatReload(game), 'd', {
    type: 'decision',
    event,
    card: mentatPlayer(game, 'd').hand[1].id,
  });
  assert.equal(viewGame(game, 'a').mentat.history[0].card.name, 'Snooper');
  assert.deepEqual(resources(game), before);
  game = finishPowers(game);
  game = applyAction(game, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
  });
  game = applyAction(game, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-1',
  });
  assert.equal(game.battle!.plans.d.defense, null);
  game = applyAction(game, 'a', { type: 'traitorCall', call: false });
  game = applyAction(game, 'd', { type: 'traitorCall', call: false });
  assert.equal(viewGame(game, 'a').mentat.history[0].card.name, 'Snooper');
  assert.ok(
    mentatPlayer(game, 'd').hand.some((card) => card.name === 'Snooper'),
  );
  assert.deepEqual(viewGame(mentatReload(game), 'o').mentat.history, []);
});

void test('exact match and single-card fallback use the same private response; decline is unspent and empty hands skip without disclosure', () => {
  const single = mentatQuestionGame({ cards: ['Snooper'] });
  assert.equal(nameWeapon(single).decision?.player, 'd');
  assert.equal(nameWeapon(mentatQuestionGame()).decision?.player, 'd');
  assert.equal(ask(single).battle!.mentatQuestion!.stage, 'answered');
  const named = mentatQuestionGame(),
    before = resources(named);
  const declined = applyAction(named, 'a', {
    type: 'decision',
    event: named.battle!.mentatQuestionEvent,
    decline: true,
  });
  assert.equal(declined.battle!.mentatQuestion!.stage, 'declined');
  assert.deepEqual(resources(declined), before);
  assert.deepEqual(viewGame(declined, 'a').mentat.history, []);
  const empty = mentatQuestionGame({ cards: [] });
  assert.equal(empty.battle!.mentatQuestion!.stage, 'unavailable');
  assert.equal(empty.decision?.kind, 'leaderSkillVisibility');
  assert.equal(viewGame(empty, 'a').mentat.pending, null);
  assert.deepEqual(viewGame(empty, 'a').mentat.history, []);
  assert.ok(
    empty.log.some((entry) =>
      entry.text.includes('empty-hand ruling remains unresolved'),
    ),
  );
  reject(empty, 'a', {
    type: 'decision',
    event: empty.battle!.mentatQuestionEvent,
    weapon: 'Crysknife',
  });
});

void test('a shown weapon need not be used; knowledge survives the selected native Mentat’s death and skill return', () => {
  let game = finishPowers(ask(mentatQuestionGame()));
  const observation = viewGame(game, 'a').mentat.history[0];
  game = applyAction(game, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
  });
  game = applyAction(game, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-1',
    weapon: observation.card.id,
  });
  game = applyAction(game, 'a', { type: 'traitorCall', call: false });
  game = applyAction(game, 'd', { type: 'traitorCall', call: false });
  assert.ok(
    mentatPlayer(game, 'a').leaders.find((leader) => leader.id === 'emperor-0')!
      .dead,
  );
  assert.ok(
    !game.leaderSkills!.assignments.some(
      (assignment) => assignment.skill === 'mentat',
    ),
  );
  assert.deepEqual(viewGame(mentatReload(game), 'a').mentat.history, [
    observation,
  ]);
  const noWeapon = finishPowers(ask(mentatQuestionGame()));
  const first = applyAction(noWeapon, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
  });
  assert.equal(
    applyAction(first, 'd', {
      type: 'battlePlan',
      dial: 0,
      leader: 'atreides-1',
    }).battle!.plans.d.weapon,
    null,
  );
});

void test('saved Mentat decisions and observations reject missing, changed, duplicate or nested context before any view, action or normalization', () => {
  const name = mentatQuestionGame(),
    reveal = nameWeapon(name, 'Lasgun'),
    answered = ask(name);
  const cases: [Game, (game: Game) => void][] = [
    [
      name,
      (g) => {
        g.decision = null;
      },
    ],
    [
      name,
      (g) => {
        delete g.battle!.mentatQuestion;
      },
    ],
    [
      name,
      (g) => {
        delete g.battle!.mentatQuestionEvent;
      },
    ],
    [
      name,
      (g) => {
        delete g.battle!.mentatQuestionVersion;
      },
    ],
    [
      name,
      (g) => {
        g.battle!.mentatQuestion!.event = 'forged';
      },
    ],
    [
      name,
      (g) => {
        mentatPlayer(g, 'd').hand.reverse();
      },
    ],
    [
      name,
      (g) => {
        g.deck.push({ ...mentatPlayer(g, 'd').hand[0] });
      },
    ],
    [
      reveal,
      (g) => {
        if (g.decision?.kind === 'mentatQuestion') g.decision.player = 'a';
      },
    ],
    [
      reveal,
      (g) => {
        g.pendingExchange = { decision: g.decision, response: null };
        g.decision = null;
      },
    ],
    [
      answered,
      (g) => {
        g.mentatHistory![0].card.name = 'Lasgun';
      },
    ],
    [
      answered,
      (g) => {
        g.mentatHistoryEvents = [];
      },
    ],
    [
      answered,
      (g) => {
        g.decision = name.decision;
      },
    ],
  ];
  for (const [source, mutate] of cases) {
    const game = mentatReload(source);
    mutate(game);
    const before = JSON.stringify(game);
    for (const operation of [
      () => viewGame(game, 'a'),
      () => normalizeAutomaticGame(game),
      () => applyAction(game, 'a', { type: 'advanceBots' }),
    ]) {
      assert.throws(operation);
      assert.equal(JSON.stringify(game), before);
    }
  }
});

void test('legacy unmarked battles are not reopened and later new battles receive a fresh question event', () => {
  const legacy = mentatQuestionGame();
  delete legacy.battle!.mentatQuestion;
  delete legacy.battle!.mentatQuestionEvent;
  delete legacy.battle!.mentatQuestionVersion;
  legacy.decision = {
    kind: 'leaderSkillVisibility',
    player: 'a',
    event: legacy.battle!.event!,
  };
  assert.equal(
    viewGame(normalizeAutomaticGame(mentatReload(legacy)), 'a').mentat.pending,
    null,
  );
  let game = finishPowers(ask(mentatQuestionGame()));
  const original = game.battle!.mentatQuestionEvent;
  game = applyAction(game, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
  });
  game = applyAction(game, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: 'atreides-1',
  });
  game = applyAction(game, 'a', { type: 'traitorCall', call: false });
  game = applyAction(game, 'd', { type: 'traitorCall', call: false });
  // Conserved next-turn board staging exercises the real new-battle creation hook.
  for (const id of ['a', 'd']) {
    const p = mentatPlayer(game, id);
    p.forces = { 'arrakeen:10': 1 };
    p.reserves = 19 - p.tanks;
    for (const leader of p.leaders) delete leader.usedAt;
  }
  Object.assign(game, {
    turn: 3,
    phase: 6,
    active: 'a',
    battle: null,
    decision: null,
    response: null,
    phaseOpening: null,
  });
  game = applyAction(game, 'a', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'd',
  });
  assert.notEqual(game.battle!.mentatQuestionEvent, original);
  assert.equal(game.decision?.kind, 'mentatQuestion');
  assert.equal(viewGame(game, 'a').mentat.history.length, 1);
  reject(game, 'a', { type: 'decision', event: original, weapon: 'Crysknife' });
});

void test('canonical Richese weapon disclosure uses the same private path and card conservation', () => {
  for (const name of ['Stone Burner', 'Mirror Weapon']) {
    const game = mentatQuestionGame({ choam: true, cards: [name, 'Snooper'] }),
      before = resources(game);
    const done = ask(game, name);
    assert.equal(viewGame(done, 'a').mentat.history[0].card.name, name);
    assert.deepEqual(resources(done), before);
    assert.deepEqual(viewGame(done, 'o').mentat.history, []);
  }
});

void test('captured Mentat grants no question and retains its selected captured-leader lower bonus', () => {
  let game = mentatQuestionGame({ captured: true });
  assert.equal(game.battle!.mentatQuestion, undefined);
  assert.equal(viewGame(game, 'd').mentat.pending, null);
  game = finishPowers(game);
  game = applyAction(game, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-1',
  });
  game = applyAction(game, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
  });
  game = applyAction(game, 'a', { type: 'traitorCall', call: false });
  game = applyAction(game, 'd', { type: 'traitorCall', call: false });
  assert.ok(
    game.log.some((entry) =>
      entry.text.includes('gained 2 battle strength from Mentat'),
    ),
  );
  assert.deepEqual(viewGame(game, 'd').mentat.history, []);
});

void test('exact match and absent weapon produce indistinguishable public question stages and hide response eligibility', () => {
  const held = mentatQuestionGame(),
    absent = mentatQuestionGame({ cards: ['Maula Pistol', 'Snooper'] });
  const namedHeld = nameWeapon(held),
    namedAbsent = nameWeapon(absent);
  const publicPending = (game: Game, viewer: string) => {
    const view = viewGame(game, viewer);
    const { event: _event, ...pending } = view.mentat.pending!;
    assert.equal(view.decision!.kind, 'mentatQuestion');
    const { event: _decisionEvent, ...decision } = view.decision as Extract<
      NonNullable<typeof view.decision>,
      { kind: 'mentatQuestion' }
    >;
    return {
      pending,
      decision,
      history: view.mentat.history,
      log: game.log.at(-1)!.text,
    };
  };
  for (const viewer of ['a', 'o'])
    assert.deepEqual(
      publicPending(namedHeld, viewer),
      publicPending(namedAbsent, viewer),
    );
  assert.equal(namedHeld.log.length - held.log.length, 1);
  assert.equal(namedAbsent.log.length - absent.log.length, 1);
  const legal = viewGame(namedHeld, 'd').mentat.pending!.cards;
  assert.equal(legal.length, 1);
  assert.equal(legal[0].name, 'Crysknife');
  reject(namedHeld, 'd', {
    type: 'decision',
    event: namedHeld.battle!.mentatQuestionEvent,
    card: mentatPlayer(namedHeld, 'd').hand[1].id,
  });
  assert.equal(viewGame(namedAbsent, 'd').mentat.pending!.cards.length, 2);
  assert.deepEqual(viewGame(namedHeld, 'a').mentat.pending!.cards, []);
  assert.deepEqual(viewGame(namedAbsent, 'a').mentat.pending!.cards, []);
});
