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
import { botActions } from '../game/bots';
import {
  botEntryAllowed,
  botGroundMoveAllowed,
  botMovementRange,
  fremenReserveEntry,
} from '../game/bot-mobility';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import {
  gameDistance,
  location,
  MOBILE_LOCATION,
  MOBILE_STRONGHOLD,
  splitLocation,
  territory,
} from '../game/board';
import type { FactionId } from '../game/catalog';
import {
  createRicheseNoField,
  deployRicheseNoField,
} from '../game/richese-no-field';
import { baseDeck } from '../game/cards';

function fixture(faction: FactionId = 'emperor', advanced = false): Game {
  const g = createGame(
    'REACHREVIEW',
    newPlayer('p', 'Mover', faction),
    advanced,
  );
  g.players.push(
    newPlayer('o', 'Opponent', 'atreides'),
    newPlayer('x', 'Third', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    storm: 18,
    active: 'p',
    order: ['p', 'o', 'x'],
    movementRemaining: ['p', 'o', 'x'],
  });
  for (const p of g.players)
    Object.assign(p, { hand: [], forces: {}, spice: 50, reserves: 20 });
  return g;
}
function army(g: Game, seat: number, forces: Record<string, number>) {
  g.players[seat].forces = forces;
  g.players[seat].reserves =
    20 - Object.values(forces).reduce((sum, n) => sum + n, 0);
}
function projection(g: Game, difficulty: Difficulty) {
  const view = viewGame(g, 'p');
  view.players[0].bot = difficulty;
  return view;
}
function candidates(g: Game, difficulty: Difficulty, type: string) {
  const view = projection(g, difficulty),
    before = structuredClone(view);
  const actions = botActions(view).filter((a) => a.type === type);
  assert.deepEqual(
    view,
    before,
    'Generating candidates must not mutate the player projection.',
  );
  for (const action of actions)
    assert.doesNotThrow(
      () => applyAction(g, 'p', action),
      `${difficulty}: ${JSON.stringify(action)}`,
    );
  return actions;
}
const destination = (a: Action) =>
  location(String(a.territory), Number(a.sector));

void test('independent review: every offered ordinary move respects actual faction range, typed Ix selection and cancellation', () => {
  for (const difficulty of DIFFICULTIES)
    for (const mode of [
      'ordinary',
      'fremen',
      'ix',
      'ixCanceled',
      'city',
      'choam',
    ] as const) {
      const faction =
        mode === 'fremen'
          ? 'fremen'
          : mode.startsWith('ix')
            ? 'ixians'
            : mode === 'choam'
              ? 'choam'
              : 'emperor';
      const g = fixture(faction);
      army(g, 0, {
        'red_chasm:7': 5,
        ...(mode === 'city' ? { 'arrakeen:10': 1 } : {}),
      });
      g.players[0].shipped = true;
      if (mode.startsWith('ix'))
        g.players[0].elites = {
          forces: { 'red_chasm:7': 3 },
          reserves: 4,
          tanks: 0,
          revived: 0,
        };
      if (mode === 'ixCanceled')
        g.players[0].ixMovementBlocked = { turn: 2, move: 0 };
      if (mode === 'choam') g.choamMovement = { turn: 2, bonus: 1 };
      const range =
        mode === 'city' ? 3 : ['fremen', 'ix', 'choam'].includes(mode) ? 2 : 1;
      const actions = candidates(g, difficulty, 'move').filter(
        (a) => a.from === 'red_chasm:7',
      );
      assert.ok(
        actions.length > 0,
        `${difficulty} ${mode}: keep reachable moves after filtering ranked targets`,
      );
      assert.ok(
        actions.every(
          (a) => gameDistance(g, String(a.from), destination(a)) <= range,
        ),
      );
      if (range > 1)
        assert.ok(
          actions.some(
            (a) => gameDistance(g, String(a.from), destination(a)) === range,
          ),
          `${difficulty} ${mode}: retain longer legal routes`,
        );
      if (mode.startsWith('ix'))
        assert.ok(
          actions.every((a) => a.elite === 3),
          'Easy must include unavoidable cyborgs when moving the whole group.',
        );
    }
});

void test('independent review: Fremen geometric reserve radius stays free and preserves Advanced storm arrivals', () => {
  assert.equal(fremenReserveEntry('sietch_tabr'), true);
  assert.equal(fremenReserveEntry('cielago_west'), true);
  assert.equal(fremenReserveEntry('polar_sink'), true);
  assert.equal(fremenReserveEntry('carthag'), false);
  assert.equal(fremenReserveEntry('arrakeen'), false);
  for (const difficulty of DIFFICULTIES)
    for (const advanced of [false, true]) {
      const g = fixture('fremen', advanced);
      g.storm = territory('sietch_tabr').sectors[0];
      g.players[0].spice = 0;
      const actions = candidates(g, difficulty, 'ship');
      assert.ok(actions.length > 0);
      assert.ok(
        actions.every(
          (a) => !['carthag', 'arrakeen'].includes(String(a.territory)),
        ),
      );
      if (!advanced) assert.ok(actions.every((a) => a.sector !== g.storm));
      else if (difficulty !== 'Easy')
        assert.ok(
          actions.some(
            (a) => a.territory === 'sietch_tabr' && a.sector === g.storm,
          ),
          'A high-ranked legal storm reinforcement must survive target filtering.',
        );
    }
});

void test('independent review: two-fighter strongholds reject new fighters while advisor entry and departure remain available', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture('beneGesserit', true);
    army(g, 0, { 'arrakeen:10': 4 });
    army(g, 1, { 'arrakeen:10': 1, 'imperial_basin:10': 1 });
    army(g, 2, { 'arrakeen:10': 1, 'imperial_basin:10': 1 });
    g.players[0].advisors = { arrakeen: {} };
    g.players[0].shipped = true;
    const actions = candidates(g, difficulty, 'move');
    assert.ok(
      actions.some((a) => a.territory === 'imperial_basin'),
      'Advisors can leave a stronghold containing two other fighter factions.',
    );
    const view = projection(g, difficulty);
    assert.equal(
      botMovementRange(view, view.players[0], 0),
      1,
      'Advisors in Arrakeen do not grant city movement.',
    );
    g.players[0].shipped = false;
    const shipView = projection(g, difficulty);
    assert.equal(
      botEntryAllowed(shipView, shipView.players[0], 'arrakeen', 10, 'ship'),
      true,
    );
    const joining = candidates(g, difficulty, 'ship');
    if (difficulty !== 'Easy')
      assert.ok(
        joining.some((a) => a.territory === 'arrakeen'),
        'Reserves can join existing advisors.',
      );
    g.players[0].advisors = {};
    army(g, 0, {});
    const blocked = candidates(g, difficulty, 'ship');
    assert.ok(
      !blocked.some((a) => a.territory === 'arrakeen'),
      'Direct reserve arrivals cannot invent advisor stance.',
    );
  }
});

void test('independent review: advisor lock and ally destination rules do not block legal advisor or polar entry', () => {
  const g = fixture('beneGesserit', true);
  army(g, 0, { 'arrakeen:10': 2, 'imperial_basin:10': 1 });
  army(g, 1, { 'arrakeen:10': 1, 'imperial_basin:10': 1, 'polar_sink:0': 1 });
  g.players[0].advisors = { arrakeen: { lockedTurn: 2 } };
  g.players[0].shipped = true;
  for (const difficulty of DIFFICULTIES) {
    let view = projection(g, difficulty);
    assert.equal(
      botGroundMoveAllowed(
        view,
        view.players[0],
        'arrakeen:10',
        'imperial_basin:10',
        0,
      ),
      false,
    );
    assert.ok(
      !candidates(g, difficulty, 'move').some(
        (a) => a.from === 'arrakeen:10' && a.territory === 'imperial_basin',
      ),
    );
    const advisors = structuredClone(g);
    advisors.players[0].advisors!.imperial_basin = {};
    advisors.players[0].ally = 'o';
    advisors.players[1].ally = 'p';
    view = projection(advisors, difficulty);
    assert.equal(
      botGroundMoveAllowed(
        view,
        view.players[0],
        'arrakeen:10',
        'imperial_basin:10',
        0,
      ),
      true,
    );
    assert.doesNotThrow(() =>
      applyAction(advisors, 'p', {
        type: 'move',
        from: 'arrakeen:10',
        amount: 1,
        territory: 'imperial_basin',
        sector: 10,
      }),
    );
    assert.equal(
      botEntryAllowed(view, view.players[0], 'polar_sink', 0, 'ship'),
      true,
    );
  }
});

void test('independent review: hidden No-Field denomination counts as one public faction without changing movement candidates', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture();
    g.players[2].faction = 'richese';
    army(g, 0, { 'imperial_basin:10': 4 });
    army(g, 1, { 'arrakeen:10': 1 });
    const nf = createRicheseNoField(['opaque-a', 'opaque-b', 'opaque-c']);
    g.players[2].noField = deployRicheseNoField(nf, {
      tokenId: 'opaque-a',
      controller: 'x',
      location: { territory: 'arrakeen', sector: 10 },
    });
    g.players[2].noFieldEvent = 'concealed';
    const before = botActions(projection(g, difficulty));
    assert.ok(
      !before.some(
        (a) =>
          ['move', 'ship', 'guildShip'].includes(a.type) &&
          a.territory === 'arrakeen',
      ),
    );
    const changed = structuredClone(g);
    changed.players[2].noField!.tokens[0].value = 5;
    changed.players[2].noField!.tokens[2].value = 0;
    changed.players[1].spice = 123456;
    changed.players[1].hand = baseDeck().slice(-4);
    assert.deepEqual(
      botActions(projection(changed, difficulty)),
      before,
      'Private enemy balances, cards and marker values are not candidate-generation inputs.',
    );
    candidates(g, difficulty, 'move');
    candidates(g, difficulty, 'ship');
  }
});

void test('independent review: mobile stronghold permits ground entry but reserves remain Ixian-only, including sector-zero storm immunity', () => {
  for (const faction of ['emperor', 'ixians'] as const)
    for (const difficulty of DIFFICULTIES) {
      const g = fixture(faction);
      g.mobileStronghold = { location: 'red_chasm:7' };
      army(g, 0, { 'red_chasm:7': 4 });
      const actions = candidates(g, difficulty, 'move');
      assert.ok(actions.some((a) => destination(a) === MOBILE_LOCATION));
      const ships = candidates(g, difficulty, 'ship');
      if (faction === 'emperor')
        assert.ok(!ships.some((a) => a.territory === MOBILE_STRONGHOLD));
      else if (difficulty !== 'Easy')
        assert.ok(ships.some((a) => a.territory === MOBILE_STRONGHOLD));
      g.storm = 0;
      const view = projection(g, difficulty);
      assert.equal(
        botGroundMoveAllowed(
          view,
          view.players[0],
          'red_chasm:7',
          MOBILE_LOCATION,
          0,
        ),
        true,
      );
      assert.equal(
        botEntryAllowed(view, view.players[0], 'polar_sink', 0, 'ship'),
        true,
      );
    }
});

void test('independent review: Guild transports use paid affordability and may carry allied Fremen beyond their free-entry radius', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = fixture('fremen');
    g.players[1].faction = 'guild';
    g.players[0].ally = 'o';
    g.players[1].ally = 'p';
    g.players[0].spice = 0;
    assert.deepEqual(candidates(g, difficulty, 'guildShip'), []);
    g.aid.o = { recipient: 'p', amount: 10 };
    const funded = candidates(g, difficulty, 'guildShip');
    assert.ok(funded.length > 0);
    if (difficulty !== 'Easy')
      assert.ok(
        funded.some((a) => a.territory === 'arrakeen'),
        'Guild transport does not inherit the Fremen free reinforcement radius.',
      );
    assert.ok(funded.every((a) => a.from === 'reserves'));
    assert.ok(
      funded.every((a) => splitLocation(destination(a)).sector !== g.storm),
    );
  }
});

void test('independent review: allied transit, Baliset same-territory movement and real storm barriers keep their distinct rules', () => {
  const g = fixture('fremen');
  army(g, 0, { 'red_chasm:7': 4 });
  army(g, 1, { 'pasty_mesa:7': 1 });
  g.players[0].ally = 'o';
  g.players[1].ally = 'p';
  g.players[0].shipped = true;
  for (const difficulty of DIFFICULTIES) {
    let view = projection(g, difficulty);
    assert.equal(
      botGroundMoveAllowed(
        view,
        view.players[0],
        'red_chasm:7',
        'pasty_mesa:7',
        0,
      ),
      false,
    );
    assert.equal(
      botGroundMoveAllowed(
        view,
        view.players[0],
        'red_chasm:7',
        'the_minor_erg:7',
        0,
      ),
      true,
      'Allied presence cannot become a ground transit barrier.',
    );
    candidates(g, difficulty, 'move');
    const baliset = structuredClone(g);
    baliset.players[0].ally = null;
    baliset.players[1].ally = null;
    baliset.players[1].faction = 'choam';
    baliset.choamBaliset = [{ player: 'p', territory: 'pasty_mesa', turn: 2 }];
    view = projection(baliset, difficulty);
    assert.equal(
      botGroundMoveAllowed(
        view,
        view.players[0],
        'red_chasm:7',
        'pasty_mesa:7',
        0,
      ),
      false,
    );
    assert.equal(
      botEntryAllowed(view, view.players[0], 'pasty_mesa', 7, 'ship'),
      true,
    );
    army(baliset, 0, { 'pasty_mesa:6': 4 });
    view = projection(baliset, difficulty);
    assert.equal(
      botGroundMoveAllowed(
        view,
        view.players[0],
        'pasty_mesa:6',
        'pasty_mesa:7',
        0,
      ),
      true,
    );
    assert.doesNotThrow(() =>
      applyAction(baliset, 'p', {
        type: 'move',
        from: 'pasty_mesa:6',
        territory: 'pasty_mesa',
        sector: 7,
        amount: 1,
      }),
    );
    army(baliset, 1, {});
    view = projection(baliset, difficulty);
    assert.equal(
      botGroundMoveAllowed(
        view,
        view.players[0],
        'red_chasm:7',
        'pasty_mesa:7',
        0,
      ),
      true,
      'A stale restriction without CHOAM presence is ineffective.',
    );
    const storm = structuredClone(g);
    storm.storm = 7;
    assert.deepEqual(
      candidates(storm, difficulty, 'move'),
      [],
      'Forces in the actual storm sector cannot initiate a ground move.',
    );
  }
});
