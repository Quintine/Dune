import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  initializeHomeworldGameForAudit,
  joinGame,
  newPlayer,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { nativeShipmentSources } from '../game/homeworld-options';
import type { NativeReserveSelections } from '../game/homeworld-native-reserves';
import { territory } from '../game/board';

const emperor = (g: Game) => g.players.find((p) => p.id === 'e')!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));

// Deal and choose traitors through the actual Homeworld setup. Subsequent
// fixtures reposition phase/opportunity only; every physical force relocation
// uses an accepted engine action. Keep dealt cards in their physical deck/hand.
function fixture(advanced = true) {
  let g = createGame(
    'HOMEWORLDBOTS',
    newPlayer('e', 'Emperor', 'emperor'),
    advanced,
  );
  joinGame(g, newPlayer('a', 'Atreides', 'atreides'));
  g = applyAction(g, 'e', { type: 'homeworlds', enabled: true });
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  g = initializeHomeworldGameForAudit(g);
  while (g.setupStage === 'traitors') {
    const p = g.players.find((seat) => seat.traitorChoices.length)!;
    g = applyAction(g, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  }
  assert.equal(g.status, 'playing');
  g.deck.push(...emperor(g).hand.splice(0));
  return movement(g);
}
function movement(g: Game, shipped = false) {
  g.phase = 5;
  g.phaseOpening = null;
  g.response = null;
  g.decision = null;
  g.active = 'e';
  g.movementRemaining = ['e', 'a'];
  g.ready = [];
  for (const p of g.players) {
    p.shipped = p.id === 'e' && shipped;
    p.moved = 0;
  }
  homeworldGameIntegrity(g);
  return g;
}
function transfer(g: Game, origin: string, normal: number, elite: number) {
  const result = applyAction(g, 'e', {
    type: 'emperorHomeworldMove',
    event: viewGame(g, 'e').homeworldMove!.event,
    origin,
    normal,
    elite,
  });
  homeworldGameIntegrity(result);
  return movement(reload(result));
}
function candidates(g: Game, level: Difficulty) {
  const view = viewGame(g, 'e');
  view.players.find((p) => p.id === 'e')!.bot = level;
  const before = structuredClone(view);
  const actions = botActions(view);
  assert.deepEqual(
    view,
    before,
    'bot policy leaves the public projection unchanged',
  );
  assert.ok(actions.length > 0);
  for (const action of actions) {
    const source = structuredClone(g);
    const result = applyAction(g, 'e', action);
    homeworldGameIntegrity(result);
    assert.deepEqual(
      g,
      source,
      `${level}/${action.type} leaves source unchanged`,
    );
  }
  return actions;
}
function assertSources(g: Game, action: Action) {
  const me = emperor(g);
  const amount = action.amount as number;
  const elite =
    action.elite === undefined
      ? Math.max(0, amount - (me.reserves - me.elites!.reserves))
      : (action.elite as number);
  const sources = action.homeworldSources as NativeReserveSelections;
  assert.ok(sources);
  const homes = viewGame(g, 'e').homeworlds!.worlds!.filter(
    (h) => h.native === 'e',
  );
  assert.deepEqual(Object.keys(sources).sort(), homes.map((h) => h.id).sort());
  const total = { normal: 0, elite: 0 };
  for (const [id, force] of Object.entries(sources)) {
    assert.deepEqual(Object.keys(force).sort(), ['elite', 'normal']);
    const available = homes.find((h) => h.id === id)!.forces.e;
    for (const kind of ['normal', 'elite'] as const) {
      assert.ok(Number.isSafeInteger(force[kind]) && force[kind] >= 0);
      assert.ok(force[kind] <= available[kind]);
      total[kind] += force[kind];
    }
  }
  assert.deepEqual(total, { normal: amount - elite, elite });
}

for (const level of DIFFICULTIES) {
  void test(`${level} ships legally from split native homes with explicit normal and elite custody and private-state invariance`, () => {
    let g = fixture();
    g = transfer(g, 'homeworld:emperor', 4, 0);
    g = transfer(g, 'homeworld:emperor:salusa', 0, 2);
    const actions = candidates(g, level);
    const ships = actions.filter((a) => a.type === 'ship');
    assert.ok(ships.length > 0);
    for (const ship of ships) assertSources(g, ship);
    assert.ok(!actions.some((a) => a.type === 'emperorHomeworldMove'));
    if (level !== 'Easy')
      assert.ok(
        ships.some((ship) => {
          const sources = ship.homeworldSources as NativeReserveSelections;
          return (
            sources['homeworld:emperor'].elite > 0 &&
            sources['homeworld:emperor:salusa'].elite > 0
          );
        }),
        'a typed shipment draws Sardaukar across both native homes',
      );

    const alternative = reload(g);
    const opponent = alternative.players.find((p) => p.id === 'a')!;
    assert.ok(opponent.hand.length && alternative.deck.length);
    [opponent.hand[0], alternative.deck[0]] = [
      alternative.deck[0],
      opponent.hand[0],
    ];
    assert.deepEqual(
      candidates(alternative, level),
      actions,
      'changing the unseen opponent card and deck order does not change candidates',
    );
    const guarded = viewGame(g, 'e');
    guarded.players.find((p) => p.id === 'e')!.bot = level;
    const other = guarded.players.find((p) => p.id === 'a')!;
    for (const key of ['hand', 'traitors', 'prediction'])
      Object.defineProperty(other, key, {
        get() {
          throw new Error('opponent secret read');
        },
      });
    assert.deepEqual(botActions(guarded), actions);
  });

  void test(`${level} chooses one legal Salusa repair after its actual shipment and never reverses it on a renewed opportunity`, () => {
    let g = transfer(fixture(), 'homeworld:emperor:salusa', 0, 4);
    const ship: Action = {
      type: 'ship',
      territory: 'false_wall_west',
      sector: territory('false_wall_west').sectors[0],
      amount: 1,
      elite: 0,
      homeworldSources: nativeShipmentSources(viewGame(g, 'e'), 1, 0),
    };
    g = applyAction(g, 'e', ship);
    assert.equal(emperor(g).shipped, true);
    const actions = candidates(g, level);
    assert.equal(actions[0].type, 'emperorHomeworldMove');
    assert.equal(
      actions.filter((a) => a.type === 'emperorHomeworldMove').length,
      1,
    );
    assert.equal(actions[0].elite, 1);
    const before = {
      reserves: emperor(g).reserves,
      elites: emperor(g).elites!.reserves,
      spice: emperor(g).spice,
    };
    g = applyAction(g, 'e', actions[0]);
    assert.deepEqual(
      {
        reserves: emperor(g).reserves,
        elites: emperor(g).elites!.reserves,
        spice: emperor(g).spice,
      },
      before,
    );
    assert.equal(emperor(g).moved, 1);
    assert.equal(g.homeworlds!.custody!.salusa!.elite, 2);
    assert.ok(
      !candidates(reload(g), level).some(
        (a) => a.type === 'emperorHomeworldMove',
      ),
    );
    assert.ok(
      !candidates(movement(reload(g), true), level).some(
        (a) => a.type === 'emperorHomeworldMove',
      ),
    );
  });

  void test(`${level} Basic Homeworld shipment candidates remain legal with no internal Emperor movement`, () => {
    const g = fixture(false);
    assert.equal(viewGame(g, 'e').homeworldMove, null);
    const actions = candidates(g, level);
    assert.ok(!actions.some((a) => a.type === 'emperorHomeworldMove'));
    const ships = actions.filter((a) => a.type === 'ship');
    assert.ok(ships.length > 0);
    for (const ship of ships) assertSources(g, ship);
  });
}

for (const advanced of [false, true])
  void test(`Easy's omitted elite choice ships forced all-Sardaukar reserves legally in ${advanced ? 'Advanced' : 'Basic'}`, () => {
    let g = fixture(advanced);
    // Supply a shipment budget at this phase checkpoint; physical force custody
    // comes entirely from genuine setup and the following fifteen-force action.
    emperor(g).spice = 20;
    g = applyAction(g, 'e', {
      type: 'ship',
      territory: 'carthag',
      sector: territory('carthag').sectors[0],
      amount: 15,
      elite: 0,
      homeworldSources: nativeShipmentSources(viewGame(g, 'e'), 15, 0),
    });
    g = movement(reload(g));
    assert.equal(emperor(g).reserves, 5);
    assert.equal(emperor(g).elites!.reserves, 5);
    const ships = candidates(g, 'Easy').filter((a) => a.type === 'ship');
    assert.ok(ships.length > 0);
    for (const ship of ships) {
      assert.equal(ship.elite, undefined);
      assertSources(g, ship);
      const next = applyAction(g, 'e', ship);
      assert.equal(emperor(next).elites!.reserves, 5 - (ship.amount as number));
      assert.equal(emperor(next).reserves, emperor(next).elites!.reserves);
    }
  });
