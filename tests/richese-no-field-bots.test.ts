import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type GameView,
  RuleError,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import {
  createRicheseNoField,
  deployRicheseNoField,
  type NoFieldValue,
} from '../game/richese-no-field';
import { presenceAt } from '../game/force-presence';
import { baseDeck } from '../game/cards';
import { territory } from '../game/board';

function fixture() {
  const g = createGame('NOFIELDBOTS', newPlayer('r', 'Richese', 'richese'));
  g.players.push(
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('e', 'Emperor', 'emperor'),
  );
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.order = ['r', 'a', 'e'];
  g.active = 'r';
  g.movementRemaining = [...g.order];
  for (const p of g.players) {
    p.hand = [];
    p.forces = {};
    p.spice = 10;
    p.reserves = 20;
  }
  g.players[0].noField = createRicheseNoField([
    'opaque0',
    'opaque3',
    'opaque5',
  ]);
  g.players[0].noFieldEvent = 'initial-no-field-event';
  return g;
}
function projection(g: Game, level: Difficulty, id = 'r') {
  const v = viewGame(g, id);
  v.players.find((p) => p.id === id)!.bot = level;
  return v;
}
function deploy(
  g: Game,
  value: NoFieldValue,
  place = { territory: 'imperial_basin', sector: 10 },
) {
  const p = g.players[0];
  const token = p.noField!.tokens.find((t) => t.value === value)!;
  p.noField = deployRicheseNoField(p.noField!, {
    tokenId: token.id,
    controller: p.id,
    location: place,
  });
  p.shipped = true;
  return g;
}
const noFieldShips = (v: GameView) =>
  botActions(v).filter((a) => a.type === 'ship' && a.noField);
const noFieldMoves = (v: GameView) =>
  botActions(v).filter((a) => a.type === 'move' && a.noField);

void test('all profiles ship an eligible private denomination for one-force price without spending physical reserves', () => {
  for (const level of DIFFICULTIES) {
    const g = fixture();
    const v = projection(g, level),
      before = structuredClone(v);
    const actions = noFieldShips(v);
    assert.ok(actions.length, level);
    assert.deepEqual(v, before);
    const preferred = level === 'Easy' ? 'opaque3' : 'opaque5';
    assert.ok(
      actions.every(
        (a) =>
          a.noField === preferred &&
          a.event === g.players[0].noFieldEvent &&
          a.amount === undefined,
      ),
    );
    for (const action of actions) {
      const settled = applyAction(g, 'r', action);
      const cost =
        territory(String(action.territory)).type === 'stronghold' ? 1 : 2;
      assert.equal(settled.players[0].spice, 10 - cost);
      assert.equal(settled.players[0].reserves, 20);
      assert.deepEqual(settled.players[0].forces, {});
      assert.equal(settled.players[0].noField!.deployed!.tokenId, preferred);
      assert.equal(
        presenceAt(viewGame(settled, 'a').players[0], String(action.territory)),
        1,
      );
    }
  }
});

void test('zero reserves still support a concealed zero shipment and last-used identity is never reused', () => {
  for (const level of DIFFICULTIES) {
    const g = fixture();
    g.players[0].reserves = 0;
    const action = noFieldShips(projection(g, level))[0];
    assert.equal(action.noField, 'opaque0');
    const placed = applyAction(g, 'r', action);
    assert.equal(placed.players[0].reserves, 0);
    assert.equal(placed.players[0].noField!.deployed!.tokenId, 'opaque0');
    g.players[0].noField!.lastShipped = 'opaque0';
    assert.ok(
      noFieldShips(projection(g, level)).every((a) => a.noField !== 'opaque0'),
    );
    g.players[0].spice = 0;
    assert.equal(noFieldShips(projection(g, level)).length, 0);
    g.players[0].spice = 1;
    assert.ok(
      noFieldShips(projection(g, level)).every(
        (a) => territory(String(a.territory)).type === 'stronghold',
      ),
    );
  }
});

void test('all profiles move the actual marker explicitly, with no fabricated physical force group, then reveal once', () => {
  for (const level of DIFFICULTIES) {
    let g = deploy(fixture(), 5);
    const actions = noFieldMoves(projection(g, level));
    assert.ok(actions.length, level);
    for (const action of actions) {
      assert.deepEqual(action.forces, {});
      assert.equal(action.noField, 'opaque5');
      const moved = applyAction(g, 'r', action);
      assert.deepEqual(moved.players[0].forces, {});
      assert.equal(moved.players[0].reserves, 20);
      assert.equal(moved.players[0].moved, 1);
      assert.equal(
        moved.players[0].noField!.deployed!.location.territory,
        action.territory,
      );
    }
    g = applyAction(g, 'r', actions[0]);
    g = JSON.parse(JSON.stringify(g));
    const reveal = botActions(projection(g, level))[0];
    assert.equal(reveal.type, 'revealNoField');
    g = applyAction(g, 'r', reveal);
    assert.equal(g.players[0].reserves, 15);
    assert.equal(
      Object.values(g.players[0].forces).reduce((n, count) => n + count, 0),
      5,
    );
    assert.equal(g.players[0].noField!.deployed, null);
    assert.ok(
      !botActions(projection(g, level)).some((a) => a.type === 'revealNoField'),
    );
  }
});

void test('positive markers reveal before a new shipment while zero and empty prospective pools remain concealed', () => {
  for (const level of DIFFICULTIES) {
    const g = deploy(fixture(), 3);
    g.players[0].shipped = false;
    const action = botActions(projection(g, level))[0];
    assert.equal(action.type, 'revealNoField');
    assert.equal(applyAction(g, 'r', action).players[0].reserves, 17);
    const zero = deploy(fixture(), 0);
    zero.players[0].moved = 1;
    assert.ok(
      !botActions(projection(zero, level)).some(
        (a) => a.type === 'revealNoField',
      ),
    );
    const shortage = deploy(fixture(), 5);
    shortage.players[0].reserves = 0;
    shortage.players[0].moved = 1;
    assert.ok(
      !botActions(projection(shortage, level)).some(
        (a) => a.type === 'revealNoField',
      ),
    );
  }
});

void test('marker candidates honor public occupancy, storm, own physical custody and authoritative blocked flags', () => {
  for (const level of DIFFICULTIES) {
    const g = fixture();
    g.players[1].forces = { 'arrakeen:9': 2 };
    g.players[2].forces = { 'arrakeen:9': 2 };
    g.players[0].forces = { 'carthag:11': 3 };
    const v = projection(g, level);
    assert.ok(
      noFieldShips(v).every(
        (a) =>
          a.territory !== 'arrakeen' &&
          a.territory !== 'carthag' &&
          a.sector !== 18,
      ),
    );
    v.richeseNoField!.canShip = false;
    v.richeseNoField!.shipBlock = 'Blocked shipment.';
    assert.equal(noFieldShips(v).length, 0);
    const moving = deploy(fixture(), 3);
    moving.players[0].moved = 1;
    const mv = projection(moving, level);
    mv.richeseNoField!.canReveal = false;
    assert.ok(!botActions(mv).some((a) => a.type === 'revealNoField'));
    assert.equal(viewGame(g, 'a').richeseNoField!.private, null);
    const foreign = projection(g, level, 'a');
    assert.ok(
      !botActions(foreign).some((a) => a.noField || a.type === 'revealNoField'),
    );
    const separate = deploy(fixture(), 0);
    separate.players[0].shipped = false;
    separate.players[0].forces = { 'arrakeen:9': 4 };
    assert.ok(
      botActions(projection(separate, level))
        .filter(
          (a) => ['ship', 'move', 'guildShip'].includes(a.type) && !a.noField,
        )
        .every((a) => a.territory !== 'imperial_basin'),
      'ordinary groups do not create an unsupported mixed marker battle',
    );
  }
});

void test('pending responses, decisions and Truthtrance precede all optional No-Field actions', () => {
  for (const level of DIFFICULTIES) {
    const g = fixture();
    g.players[1].hand = [baseDeck().find((c) => c.effect === 'karama')!];
    const offered = applyAction(g, 'r', noFieldShips(projection(g, level))[0]);
    assert.equal(offered.response?.kind, 'richeseNoField');
    assert.equal(noFieldShips(projection(offered, level)).length, 0);
    const v = projection(deploy(fixture(), 3), level);
    v.decision = { kind: 'richeseDeclaration', player: 'r' };
    v.richeseBidding = {
      owner: 'r',
      event: 'declaration',
      stage: 'declaration',
      position: null,
      cache: [],
      normalCount: null,
      offerBlocked: null,
    };
    assert.equal(botActions(v)[0].type, 'decision');
    v.decision = null;
    v.truthtrance = {
      stage: 'priority',
      passed: [],
      queue: [],
    } as unknown as NonNullable<GameView['truthtrance']>;
    assert.equal(botActions(v)[0].type, 'truthPass');
  }
});

void test('projected allied funding buys one marker and hidden rival denominations never inform ordinary AI choices', () => {
  for (const level of DIFFICULTIES) {
    const g = fixture();
    g.players[0].spice = 0;
    g.players[0].ally = 'a';
    g.players[1].ally = 'r';
    g.aid.a = { recipient: 'r', amount: 2 };
    const actions = noFieldShips(projection(g, level));
    assert.ok(actions.length);
    for (const action of actions) {
      const cost =
        territory(String(action.territory)).type === 'stronghold' ? 1 : 2;
      assert.equal(action.allyPayment, cost);
      const settled = applyAction(g, 'r', action);
      assert.equal(settled.players[0].spice, 0);
      assert.equal(settled.aid.a.amount, 2 - cost);
      assert.equal(settled.players[0].reserves, 20);
    }
    const views = ([0, 3, 5] as const).map((value) => {
      const hidden = deploy(fixture(), value, {
        territory: 'arrakeen',
        sector: 9,
      });
      hidden.active = 'a';
      const v = projection(hidden, level, 'a');
      assert.equal(v.richeseNoField!.private, null);
      assert.deepEqual(v.players[0].forces, {});
      assert.equal(presenceAt(v.players[0], 'arrakeen'), 1);
      return botActions(v);
    });
    assert.deepEqual(views[0], views[1]);
    assert.deepEqual(views[1], views[2]);
  }
});

void test('all profiles resolve marker-only battles using their private prospective pool, including zero and scarce reserves', () => {
  for (const level of DIFFICULTIES)
    for (const advanced of [false, true])
      for (const value of [0, 3, 5] as const) {
        let g = deploy(fixture(), value);
        g.advanced = advanced;
        g.phase = 6;
        g.players[0].reserves = value === 5 ? 2 : 20;
        const total = g.players[0].reserves;
        g.players[1].forces = { 'imperial_basin:10': 2 };
        const choose = botActions(projection(g, level)).find(
          (a) => a.type === 'chooseBattle',
        );
        assert.ok(choose, `${level}: concealed presence discovers the battle`);
        g = applyAction(g, 'r', choose);
        const privateView = projection(g, level);
        assert.equal(
          privateView.battle!.ownForces!.normal,
          Math.min(value, total),
        );
        assert.deepEqual(privateView.battle!.noFieldPlayers, ['r']);
        assert.equal(
          viewGame(g, 'e').battle!.ownForces,
          null,
          'noncombatant receives no prospective pool',
        );
        let sealed = false;
        for (let step = 0; g.battle && step < 80; step++) {
          let next: Game | undefined;
          for (const player of g.players) {
            const actions = botActions(projection(g, level, player.id));
            if (
              player.id === 'r' &&
              actions.some((a) => a.type === 'battlePlan')
            ) {
              const plans = actions.filter((a) => a.type === 'battlePlan');
              assert.ok(
                plans.every((a) => Number(a.dial) <= Math.min(value, total)),
              );
              if (value > 0)
                assert.ok(
                  plans.some((a) => Number(a.dial) > 0),
                  'private reserve-backed units inform candidates',
                );
            }
            for (const action of actions) {
              try {
                next = applyAction(g, player.id, action);
                if (player.id === 'r' && action.type === 'battlePlan') {
                  assert.ok(
                    action.leader,
                    'even zero keeps its mandatory leader',
                  );
                  sealed = true;
                }
                break;
              } catch (error) {
                if (!(error instanceof RuleError)) throw error;
              }
            }
            if (next) break;
          }
          assert.ok(
            next,
            `${level}/${advanced}/${value}: battle has a legal continuation`,
          );
          g = JSON.parse(JSON.stringify(next));
          const r = g.players[0];
          assert.equal(
            r.reserves +
              r.tanks +
              Object.values(r.forces).reduce((n, count) => n + count, 0),
            total,
          );
        }
        assert.equal(
          g.battle,
          null,
          `${level}/${advanced}/${value}: finite battle`,
        );
        assert.equal(sealed, true);
        assert.equal(g.players[0].noField!.deployed, null);
      }
});

void test('every Atreides profile avoids forbidden dial prescience and cannot distinguish concealed denominations', () => {
  for (const level of DIFFICULTIES) {
    const actions = ([0, 3, 5] as const).map((value) => {
      let g = deploy(fixture(), value);
      g.phase = 6;
      g.players[1].forces = { 'imperial_basin:10': 2 };
      g = applyAction(g, 'r', {
        type: 'chooseBattle',
        territory: 'imperial_basin',
        target: 'a',
      });
      for (const id of ['r', 'a'])
        g = applyAction(g, id, { type: 'battlePreparationReady', event: g.battle!.preLeader!.event });
      const view = projection(g, level, 'a');
      assert.equal(view.battle!.preparation!.kind, 'prescience');
      assert.equal(view.richeseNoField!.private, null);
      const action = botActions(view)[0];
      assert.deepEqual(action, { type: 'prescience', field: 'weapon' });
      assert.doesNotThrow(() => applyAction(g, 'a', action));
      return action;
    });
    assert.deepEqual(actions[0], actions[1]);
    assert.deepEqual(actions[1], actions[2]);
  }
});
