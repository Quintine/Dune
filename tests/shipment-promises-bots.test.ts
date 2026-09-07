import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import {
  matchesShipment,
  liveShipmentPromises,
} from '../game/shipment-promises';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function hold(g: Game, id: string, effect: string) {
  const index = g.deck.findIndex((c) => c.effect === effect);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  player(g, id).hand.push(card);
  return card;
}
function fixture(level: Difficulty) {
  const g = createGame(
    'SHIPMENTAIPROMISE',
    newPlayer('e', 'Emperor', 'emperor'),
  );
  g.players.push(
    newPlayer('a', 'Asker', 'atreides'),
    newPlayer('h', 'Observer', 'harkonnen'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: 5,
    turn: 2,
    active: 'e',
    order: ['e', 'a', 'h'],
    storm: 18,
    deck: baseDeck(),
  });
  for (const p of g.players) {
    p.spice = 20;
    p.traitors = [p.leaders[0].id];
  }
  player(g, 'e').bot = level;
  hold(g, 'a', 'truthtrance');
  return g;
}
function pending(g: Game, territory = 'carthag', minimum = 6) {
  g = applyAction(g, 'a', {
    type: 'card',
    card: player(g, 'a').hand.find((c) => c.effect === 'truthtrance')!.id,
  });
  for (let n = 0; n < 10 && g.truthtrance?.stage === 'priority'; n++)
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  assert.equal(g.truthtrance?.stage, 'ask');
  return applyAction(g, 'a', {
    type: 'truthAsk',
    question: { kind: 'shipment', target: 'e', territory, minimum },
  });
}
function proposals(g: Game) {
  const v = viewGame(g, 'e'),
    before = structuredClone(v),
    actions = botActions(v);
  assert.deepEqual(v, before);
  for (const action of actions)
    assert.doesNotThrow(
      () => applyAction(g, 'e', action),
      JSON.stringify(action),
    );
  return actions;
}
function honor(g: Game) {
  for (let n = 0; n < 15 && !player(g, 'e').shipped; n++) {
    if (g.response) {
      const actor = g.players.find(
        (p) => !g.response!.passed.includes(p.id),
      )!.id;
      g = applyAction(g, actor, { type: 'passResponse' });
      continue;
    }
    const actions = proposals(g);
    assert.ok(actions.length, 'a live positive promise needs a legal witness');
    g = applyAction(JSON.parse(JSON.stringify(g)), 'e', actions[0]);
  }
  assert.equal(player(g, 'e').shipped, true);
  return g;
}
function reserveShipment(a: Action) {
  return a.type === 'ship' || (a.type === 'guildShip' && a.from === 'reserves')
    ? { territory: String(a.territory), amount: Number(a.amount) }
    : null;
}

void test('all four profiles answer Yes and honor six-force shipment omitted by their ordinary quantity policy', () => {
  for (const level of DIFFICULTIES) {
    const start = fixture(level);
    assert.equal(
      botActions(viewGame(start, 'e')).some(
        (a) =>
          a.type === 'ship' &&
          a.territory === 'carthag' &&
          Number(a.amount) >= 6,
      ),
      false,
    );
    const g = pending(start);
    assert.deepEqual(viewGame(g, 'e').truthShipmentAnswers, ['yes', 'no']);
    for (const id of ['a', 'h'])
      assert.equal(viewGame(g, id).truthShipmentAnswers, null);
    const answers = proposals(g);
    assert.deepEqual(answers, [{ type: 'truthAnswer', answer: 'yes' }]);
    const promised = applyAction(g, 'e', answers[0]);
    assert.equal(viewGame(promised, 'a').shipmentCompletion, null);
    assert.equal(viewGame(promised, 'h').shipmentCompletion, null);
    const actions = proposals(promised);
    assert.ok(
      actions.every(
        (a) => !['move', 'endMovement', 'guildShip'].includes(a.type),
      ),
    );
    const done = honor(promised);
    assert.ok(player(done, 'e').forces['carthag:11'] >= 6);
    assert.ok(done.shipmentPromises!.every((p) => p.fulfilled && !p.released));
  }
});

void test('a server witness makes all four profiles honor a legal destination outside their top24 targets', () => {
  for (const level of DIFFICULTIES) {
    const start = fixture(level);
    assert.equal(
      botActions(viewGame(start, 'e')).some(
        (a) => a.type === 'ship' && a.territory === 'polar_sink',
      ),
      false,
    );
    const g = pending(start, 'polar_sink', 6);
    assert.ok(viewGame(g, 'e').truthShipmentAnswers!.includes('yes'));
    const promised = applyAction(g, 'e', {
      type: 'truthAnswer',
      answer: 'yes',
    });
    const actions = proposals(promised);
    assert.equal(actions[0].territory, 'polar_sink');
    assert.ok(Number(actions[0].amount) >= 6);
    assert.ok(honor(promised).players[0].forces['polar_sink:0'] >= 6);
  }
});

void test('all four profiles honor a negative answer and filter forbidden shipments without blocking alternatives', () => {
  for (const level of DIFFICULTIES) {
    const g = pending(fixture(level), 'polar_sink', 1);
    assert.deepEqual(proposals(g), [{ type: 'truthAnswer', answer: 'no' }]);
    const promised = applyAction(g, 'e', { type: 'truthAnswer', answer: 'no' });
    const live = liveShipmentPromises(
      promised.shipmentPromises!,
      'e',
      promised.turn,
    );
    const actions = proposals(promised);
    assert.ok(actions.length);
    for (const action of actions.filter((a) =>
      ['ship', 'guildShip', 'move', 'endMovement'].includes(a.type),
    ))
      assert.ok(
        live.every(
          (p) => matchesShipment(p, reserveShipment(action)) === p.answer,
        ),
      );
    assert.ok(actions.some((a) => a.type === 'endMovement'));
    const done = applyAction(promised, 'e', actions[0]);
    assert.equal(player(done, 'e').forces['polar_sink:0'] ?? 0, 0);
  }
});

void test('all four profiles use only the first owned-Karama preparation then recompute the funded shipment', () => {
  for (const level of DIFFICULTIES) {
    const start = fixture(level);
    player(start, 'e').spice = 3;
    const karama = hold(start, 'e', 'karama');
    const g = pending(start);
    assert.deepEqual(proposals(g), [{ type: 'truthAnswer', answer: 'yes' }]);
    const promised = applyAction(g, 'e', {
      type: 'truthAnswer',
      answer: 'yes',
    });
    const view = viewGame(promised, 'e');
    assert.equal(view.shipmentCompletion!.actions[0].card, karama.id);
    assert.equal(viewGame(promised, 'a').shipmentCompletion, null);
    const actions = proposals(promised);
    assert.equal(actions[0].type, 'card');
    assert.equal(actions[0].mode, 'shipment');
    assert.ok(
      !actions.some((a) => a.type === 'ship'),
      'unfunded later route steps are not alternatives',
    );
    const done = honor(promised);
    assert.equal(player(done, 'e').spice, 0);
    assert.equal(player(done, 'e').forces['carthag:11'], 6);
    assert.equal(done.discard.filter((c) => c.id === karama.id).length, 1);
  }
});

void test('answers and mandatory witness proposals do not change after unrelated private opponent changes', () => {
  for (const level of DIFFICULTIES) {
    const start = fixture(level);
    hold(start, 'h', 'ghola');
    const g = pending(start);
    const altered = structuredClone(g),
      old = player(altered, 'h').hand.pop()!;
    altered.deck.push(old);
    hold(altered, 'h', 'hajr');
    player(altered, 'h').spice = 999;
    assert.deepEqual(viewGame(altered, 'e'), viewGame(g, 'e'));
    assert.deepEqual(proposals(altered), proposals(g));
    const a = applyAction(g, 'e', { type: 'truthAnswer', answer: 'yes' });
    const b = applyAction(altered, 'e', { type: 'truthAnswer', answer: 'yes' });
    assert.deepEqual(viewGame(a, 'e'), viewGame(b, 'e'));
    assert.deepEqual(proposals(a), proposals(b));
  }
});

void test('all profiles respect an existing No when a later stronghold question permits only No', () => {
  for (const level of DIFFICULTIES) {
    const start = fixture(level);
    hold(start, 'a', 'truthtrance');
    const first = applyAction(pending(start), 'e', {
      type: 'truthAnswer',
      answer: 'no',
    });
    const next = pending(first, 'carthag', 7);
    assert.deepEqual(viewGame(next, 'e').truthShipmentAnswers, ['no']);
    assert.deepEqual(proposals(next), [{ type: 'truthAnswer', answer: 'no' }]);
    const committed = applyAction(next, 'e', proposals(next)[0]);
    for (const action of proposals(committed).filter((a) =>
      ['ship', 'guildShip', 'move', 'endMovement'].includes(a.type),
    ))
      assert.ok(
        liveShipmentPromises(
          committed.shipmentPromises!,
          'e',
          committed.turn,
        ).every(
          (p) => matchesShipment(p, reserveShipment(action)) === p.answer,
        ),
      );
  }
});

void test('all profiles execute owned Ghola and outgoing pledge recovery before the required physical shipment', () => {
  for (const level of DIFFICULTIES)
    for (const preparation of ['ghola', 'pledge'] as const) {
      let start = fixture(level);
      if (preparation === 'ghola') {
        player(start, 'e').reserves = 1;
        player(start, 'e').tanks = 19;
        hold(start, 'e', 'ghola');
        player(start, 'e').spice = 6;
      } else {
        player(start, 'e').ally = 'h';
        player(start, 'h').ally = 'e';
        player(start, 'e').spice = 6;
        start = applyAction(start, 'e', { type: 'pledgeAid', amount: 6 });
        assert.equal(player(start, 'e').spice, 0);
      }
      const g = pending(start);
      assert.ok(viewGame(g, 'e').truthShipmentAnswers!.includes('yes'));
      const promised = applyAction(g, 'e', {
        type: 'truthAnswer',
        answer: 'yes',
      });
      const first = proposals(promised)[0];
      assert.equal(first.type, preparation === 'ghola' ? 'card' : 'pledgeAid');
      const done = honor(promised);
      assert.equal(player(done, 'e').forces['carthag:11'], 6);
      assert.equal(player(done, 'e').spice, 0);
      if (preparation === 'ghola') assert.equal(player(done, 'e').tanks, 14);
      else assert.equal(done.aid.e?.amount ?? 0, 0);
    }
});

void test('all four profiles honor reserve promises through paid Guild-allied Fremen southern-reserve shipment', () => {
  for (const level of DIFFICULTIES) {
    const start = fixture(level);
    start.players[0] = newPlayer('e', 'Fremen', 'fremen');
    start.players[2] = newPlayer('h', 'Guild', 'guild');
    player(start, 'e').spice = 20;
    player(start, 'e').bot = level;
    player(start, 'e').ally = 'h';
    player(start, 'h').ally = 'e';
    const g = pending(start);
    assert.ok(viewGame(g, 'e').truthShipmentAnswers!.includes('yes'));
    const promised = applyAction(g, 'e', {
      type: 'truthAnswer',
      answer: 'yes',
    });
    const first = proposals(promised)[0];
    assert.equal(first.type, 'guildShip');
    assert.equal(first.from, 'reserves');
    const done = honor(promised);
    assert.equal(player(done, 'e').forces['carthag:11'], 6);
    assert.equal(player(done, 'e').spice, 17);
    assert.equal(player(done, 'h').spice, 3);
    assert.ok(done.shipmentPromises!.every((p) => p.fulfilled));
  }
});
