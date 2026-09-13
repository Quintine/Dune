import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game, type Action } from '../game/engine';
import { baseDeck } from '../game/cards';
import {
  quoteDiplomatDefense,
  copiedDiplomatDefense,
} from '../game/diplomat-defense';
import { leaderSkillBattleBonus } from '../game/leader-skill-combat';
import {
  diplomatDefenseGame,
  revealDiplomatPlans,
  takeBattleCard,
} from './diplomat-defense-fixture';

function choose(game: Game, card: string | null): Game {
  assert.equal(game.decision?.kind, 'diplomatDefense');
  return applyAction(JSON.parse(JSON.stringify(game)), 'a', {
    type: 'decision',
    event: game.decision.event,
    card,
  });
}
function finish(game: Game, call = false): Game {
  let next = applyAction(game, 'a', { type: 'traitorCall', call });
  next = applyAction(next, 'd', { type: 'traitorCall', call: false });
  for (const p of next.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const ids = [
    ...next.deck,
    ...next.discard,
    ...next.players.flatMap((p) => p.hand),
  ].map((c) => c.id);
  assert.equal(new Set(ids).size, 33);
  assert.equal(ids.length, 33);
  return next;
}
function reject(game: Game, owner: string, action: Action) {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, owner, action));
  assert.equal(JSON.stringify(game), before);
}

void test('Diplomat quotes one physical Worthless from either slot and never copies absent or unsupported defenses', () => {
  const cards = baseDeck(),
    worthless = cards.filter((c) => c.kind === 'worthless'),
    snooper = cards.find((c) => c.kind === 'snooper')!;
  const assignments = [
    {
      skill: 'diplomat' as const,
      leader: 'trainer',
      faceUp: true,
      captured: false,
    },
  ];
  const quote = quoteDiplomatDefense({
    assignments,
    selectedLeader: 'other',
    weapon: worthless[0],
    defense: worthless[1],
    opposingDefense: snooper,
  })!;
  assert.deepEqual(
    quote.cards,
    worthless.slice(0, 2).map((c) => c.id),
  );
  assert.equal(copiedDiplomatDefense(quote, worthless[0].id).kind, 'snooper');
  assert.equal(worthless[0].kind, 'worthless');
  assert.throws(() => copiedDiplomatDefense(quote, 'unplayed'));
  for (const opposingDefense of [
    undefined,
    worthless[0],
    { ...snooper, id: 'unrecognized' },
    { ...snooper, kind: 'shieldSnooper' as const },
  ])
    assert.equal(
      quoteDiplomatDefense({
        assignments,
        selectedLeader: 'other',
        weapon: worthless[0],
        opposingDefense,
      }),
      null,
    );
  assert.equal(
    quoteDiplomatDefense({
      assignments,
      selectedLeader: 'other',
      weapon: worthless[0],
      defense: snooper,
      opposingDefense: snooper,
    }),
    null,
  );
  assert.equal(
    quoteDiplomatDefense({
      assignments: [{ ...assignments[0], faceUp: false }],
      selectedLeader: 'other',
      weapon: worthless[0],
      opposingDefense: snooper,
    }),
    null,
  );
  assert.ok(
    quoteDiplomatDefense({
      assignments: [{ ...assignments[0], faceUp: false }],
      selectedLeader: 'trainer',
      weapon: worthless[0],
      opposingDefense: snooper,
    }),
  );
  assert.equal(
    quoteDiplomatDefense({
      assignments: [{ ...assignments[0], captured: true }],
      selectedLeader: 'trainer',
      weapon: worthless[0],
      opposingDefense: snooper,
    }),
    null,
  );
});

void test('native face-up and selected Diplomats copy a Snooper after reveal in Basic and Advanced without rewriting sealed plans', () => {
  for (const advanced of [false, true])
    for (const hide of [false, true])
      for (const slot of ['weapon', 'defense'] as const) {
        const game = diplomatDefenseGame(hide, advanced),
          card = game.players[0].hand[0].id;
        const pending = revealDiplomatPlans(game, slot),
          plans = structuredClone(pending.battle!.plans);
        assert.equal(pending.decision?.kind, 'diplomatDefense');
        reject(pending, 'd', {
          type: 'decision',
          event: pending.decision.event,
          card,
        });
        reject(pending, 'a', { type: 'traitorCall', call: false });
        reject(pending, 'a', { type: 'decision', event: 'stale', card });
        const copied = choose(pending, card);
        assert.deepEqual(copied.battle!.plans, plans);
        assert.equal(
          copied.players[0].hand.find((c) => c.id === card)!.kind,
          'worthless',
        );
        const done = finish(copied),
          leader = done.players[0].leaders.find(
            (l) => l.id === (hide ? 'emperor-0' : 'emperor-1'),
          )!;
        assert.equal(leader.dead, false);
        assert.ok(!done.players[0].hand.some((c) => c.id === card));
        assert.equal(done.discard.filter((c) => c.id === card).length, 1);
        reject(done, 'a', {
          type: 'decision',
          event: pending.decision.event,
          card,
        });
      }
});

void test('declining the visible copy leaves ordinary weapon deaths and card custody unchanged', () => {
  const game = diplomatDefenseGame(),
    card = game.players[0].hand[0].id;
  const pending = revealDiplomatPlans(game);
  const done = finish(choose(pending, null));
  assert.equal(
    done.players[0].leaders.find((l) => l.id === 'emperor-1')!.dead,
    true,
  );
  assert.equal(done.players[0].forces['arrakeen:10'] ?? 0, 0);
  assert.equal(done.discard.filter((c) => c.id === card).length, 1);
});

void test('two committed Worthless cards offer one choice and only the chosen winner card is mandatory discard', () => {
  let game = diplomatDefenseGame();
  const first = game.players[0].hand[0],
    second = takeBattleCard(game, 'a', 'worthless');
  game = applyAction(game, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-1',
    weapon: first.id,
    defense: second.id,
  });
  game = applyAction(game, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: 'guild-1',
    weapon: game.players[1].hand.find((c) => c.kind === 'poison')!.id,
    defense: game.players[1].hand.find((c) => c.kind === 'snooper')!.id,
  });
  assert.equal(game.decision?.kind, 'diplomatDefense');
  assert.deepEqual(
    new Set(game.decision.cards),
    new Set([first.id, second.id]),
  );
  const done = finish(choose(game, second.id));
  assert.equal(done.discard.filter((c) => c.id === second.id).length, 1);
  assert.ok(done.players[0].hand.some((c) => c.id === first.id));
  assert.equal(done.decision?.kind, 'battleCards');
  assert.ok(done.decision.cards.includes(first.id));
  assert.ok(!done.decision.cards.includes(second.id));
});

void test('an actual defense or absent opposing defense creates no Diplomat choice', () => {
  for (const ownDefense of [false, true]) {
    let game = diplomatDefenseGame();
    const defense = ownDefense
      ? takeBattleCard(game, 'a', 'snooper').id
      : undefined;
    game = applyAction(game, 'a', {
      type: 'battlePlan',
      dial: 0,
      leader: 'emperor-1',
      weapon: game.players[0].hand[0].id,
      defense,
    });
    game = applyAction(game, 'd', {
      type: 'battlePlan',
      dial: 0,
      leader: 'guild-1',
      defense: ownDefense
        ? game.players[1].hand.find((c) => c.kind === 'snooper')!.id
        : undefined,
    });
    assert.notEqual(game.decision?.kind, 'diplomatDefense');
    finish(game);
  }
});

void test('copying a Shield preserves the existing Lasgun explosion instead of making a survival loop', () => {
  let game = diplomatDefenseGame(true);
  const card = game.players[0].hand[0].id,
    laser = takeBattleCard(game, 'd', 'lasgun'),
    shield = takeBattleCard(game, 'd', 'shield');
  // The staged opponent only needs its played pair; return other physical cards to the deck.
  game.deck.push(
    ...game.players[1].hand.filter(
      (c) => ![laser.id, shield.id].includes(c.id),
    ),
  );
  game.players[1].hand = game.players[1].hand.filter((c) =>
    [laser.id, shield.id].includes(c.id),
  );
  game = applyAction(game, 'a', {
    type: 'battlePlan',
    dial: 0,
    leader: 'emperor-0',
    defense: card,
  });
  game = applyAction(game, 'd', {
    type: 'battlePlan',
    dial: 0,
    leader: 'guild-1',
    weapon: laser.id,
    defense: shield.id,
  });
  const done = finish(choose(game, card));
  for (const p of done.players) assert.equal(p.tanks, 5);
  assert.equal(
    done.players[0].leaders.find((l) => l.id === 'emperor-0')!.dead,
    true,
  );
  assert.equal(
    done.players[1].leaders.find((l) => l.id === 'guild-1')!.dead,
    true,
  );
  assert.equal(done.discard.filter((c) => c.id === card).length, 1);
});

void test('copied defense role supports captured Medic or Prana while the physical Worthless still supports Warmaster', () => {
  const card = baseDeck().find((c) => c.kind === 'worthless')!;
  for (const [skill, kind] of [
    ['killer-medic', 'snooper'],
    ['prana-bindu-adept', 'shield'],
    ['warmaster', 'snooper'],
  ] as const) {
    const bonus = leaderSkillBattleBonus({
      assignments: [
        { skill, leader: 'captive', faceUp: false, captured: true },
      ],
      selectedLeader: { id: 'captive', kind: 'disc' },
      weapon: undefined,
      defense: card,
      effectiveDefense: { id: card.id, name: 'Copied defense', kind },
      skilledLeaderSurvives: true,
    });
    assert.equal(bonus.bonus, 3, skill);
  }
});

void test('old unmarked revealed battles retain their original continuation without inventing a copy', () => {
  const unsealed = diplomatDefenseGame();
  delete unsealed.battle!.diplomatDefenseVersion;
  const game = revealDiplomatPlans(unsealed);
  assert.notEqual(game.decision?.kind, 'diplomatDefense');
  assert.equal(
    viewGame(JSON.parse(JSON.stringify(game)), 'a').battle!.revealed,
    true,
  );
  const done = finish(game);
  assert.equal(
    done.players[0].leaders.find((l) => l.id === 'emperor-1')!.dead,
    true,
  );
});
