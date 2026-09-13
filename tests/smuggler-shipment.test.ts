import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  viewGame,
  normalizeAutomaticGame,
  type Game,
  type Action,
} from '../game/engine';
import { quoteSmugglerShipment } from '../game/smuggler-shipment';
import { reserveShipmentCost } from '../game/shipment-price';
import { validateLeaderSkills } from '../game/leader-skills';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { smugglerShipmentGame } from './smuggler-shipment-fixture';
import { territory } from '../game/board';

const ship: Action = {
  type: 'ship',
  territory: 'arrakeen',
  sector: 10,
  amount: 3,
  smuggler: true,
};
function conserve(g: Game) {
  validateLeaderSkills(g.leaderSkills!, g.players);
  for (const p of g.players) {
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
    if (p.elites)
      assert.equal(
        p.elites.reserves +
          p.elites.tanks +
          Object.values(p.elites.forces).reduce((a, b) => a + b, 0),
        5,
      );
  }
}
function reject(g: Game, actor: string, action: Action) {
  const before = JSON.stringify(g);
  assert.throws(() => applyAction(g, actor, action));
  assert.equal(JSON.stringify(g), before);
}

void test('Smuggler prices the total physical shipment as one fewer force and sends the actual payment to Guild', () => {
  const game = smugglerShipmentGame();
  game.players[0].spice = 2;
  const before = game.players[1].spice;
  const sent = applyAction(game, 'p', ship);
  assert.equal(sent.players[0].spice, 0);
  assert.equal(sent.players[0].reserves, 17);
  assert.equal(sent.players[0].forces['arrakeen:10'], 3);
  assert.equal(sent.players[1].spice, before + 2);
  assert.ok(sent.log.some((l) => l.automatic?.name === 'Smuggler shipment'));
  assert.deepEqual(
    normalizeAutomaticGame(JSON.parse(JSON.stringify(sent))),
    sent,
  );
  reject(sent, 'p', ship);
  conserve(sent);
  const desert = smugglerShipmentGame();
  desert.players[0].spice = 4;
  const arrived = applyAction(desert, 'p', {
    ...ship,
    territory: 'wind_pass',
    sector: 14,
  });
  assert.equal(arrived.players[0].spice, 0);
  conserve(arrived);
});

void test('Smuggler requires an accompanying force and an entirely empty territory including advisors', () => {
  const game = smugglerShipmentGame();
  assert.equal(quoteSmugglerShipment(game, 'p', 'arrakeen', 1), null);
  game.players[0].spice = 0;
  reject(game, 'p', { ...ship, amount: 1 });
  for (const owner of ['p', 'h']) {
    const occupied = smugglerShipmentGame();
    const p = occupied.players.find((p) => p.id === owner)!;
    p.forces['wind_pass:15'] = 1;
    p.reserves--;
    assert.equal(quoteSmugglerShipment(occupied, 'p', 'wind_pass', 3), null);
  }
  const advisors = smugglerShipmentGame('beneGesserit', true);
  advisors.players[0].forces['arrakeen:10'] = 1;
  advisors.players[0].reserves--;
  advisors.players[0].advisors = { arrakeen: { lockedTurn: advisors.turn } };
  assert.equal(quoteSmugglerShipment(advisors, 'p', 'arrakeen', 3), null);
  const hidden = viewGame(smugglerShipmentGame(), 'p');
  hidden.leaderSkills!.assignments.find((a) => a.owner === 'p')!.faceUp = false;
  assert.equal(quoteSmugglerShipment(hidden, 'p', 'arrakeen', 3), null);
  for (const unavailable of [
    { dead: true },
    { capturedBy: 'h' },
    { gholaBy: 'h' },
  ]) {
    const absent = smugglerShipmentGame();
    const leader = absent.players[0].leaders.find(
      (l) =>
        l.id ===
        absent.leaderSkills!.assignments.find((a) => a.owner === 'p')!.leader,
    )!;
    Object.assign(leader, unavailable);
    assert.equal(quoteSmugglerShipment(absent, 'p', 'arrakeen', 3), null);
  }
});

void test('Guild rounding follows the free force, while on-planet Fremen reinforcement has no Smuggler bonus', () => {
  const guild = smugglerShipmentGame('guild');
  guild.players[0].spice = 1;
  const done = applyAction(guild, 'p', ship);
  assert.equal(done.players[0].forces['arrakeen:10'], 3);
  assert.equal(done.players[0].spice, 0);
  conserve(done);
  const fremen = smugglerShipmentGame('fremen');
  assert.equal(quoteSmugglerShipment(fremen, 'p', 'the_great_flat', 5), null);
  const reinforced = applyAction(fremen, 'p', {
    ...ship,
    smuggler: false,
    territory: 'the_great_flat',
    sector: territory('the_great_flat').sectors.find((s) => s !== fremen.storm),
    amount: 5,
  });
  assert.equal(reinforced.players[0].reserves, 15);
  assert.ok(
    !reinforced.log.some((l) => l.automatic?.name === 'Smuggler shipment'),
  );
  conserve(reinforced);
});

void test('Advanced pending shipment freezes the free companion through JSON and preserves elite counters', () => {
  const game = smugglerShipmentGame('emperor', true);
  game.players[0].spice = 2;
  const pending = applyAction(game, 'p', { ...ship, elite: 2 });
  assert.equal(pending.decision?.kind, 'guildShipment');
  assert.equal(pending.pendingShipment?.smuggler?.amount, 3);
  assert.equal(pending.players[0].reserves, 20);
  assert.equal(pending.players[0].spice, 2);
  for (const corrupt of [
    (g: Game) => {
      g.pendingShipment!.smuggler!.amount = 4;
    },
    (g: Game) => {
      g.pendingShipment!.smuggler!.leader = 'stale';
    },
    (g: Game) => {
      delete g.pendingShipment!.smuggler;
    },
    (g: Game) => {
      g.decision = null;
    },
    (g: Game) => {
      g.decision!.player = 'p';
    },
    (g: Game) => {
      if (g.decision?.kind === 'guildShipment') g.decision.amount = 4;
    },
    (g: Game) => {
      g.pendingShipment = null;
    },
    (g: Game) => {
      g.players[1].forces['arrakeen:10'] = 1;
      g.players[1].reserves--;
    },
  ]) {
    const bad = structuredClone(pending);
    corrupt(bad);
    assert.throws(() => viewGame(bad, 'p'));
    assert.throws(() => normalizeAutomaticGame(bad));
    reject(bad, 'h', { type: 'decision', allow: true });
  }
  const done = applyAction(JSON.parse(JSON.stringify(pending)), 'h', {
    type: 'decision',
    allow: true,
  });
  assert.equal(done.players[0].reserves, 17);
  assert.equal(done.players[0].elites!.reserves, 3);
  assert.equal(done.players[0].elites!.forces['arrakeen:10'], 2);
  assert.equal(done.players[0].spice, 0);
  conserve(done);
});

void test('all four bots use the free companion through the shared public quote without hidden resources', () => {
  for (const difficulty of DIFFICULTIES) {
    const g = smugglerShipmentGame();
    g.players[0].spice = 1;
    const view = viewGame(g, 'p');
    view.players[0].bot = difficulty;
    const offers = botActions(view).filter(
      (a) => a.type === 'ship' && Number(a.amount) >= 2,
    );
    assert.ok(offers.length, difficulty);
    for (const action of offers) {
      const quote = quoteSmugglerShipment(
        view,
        'p',
        String(action.territory),
        Number(action.amount),
      );
      assert.ok(quote);
      assert.equal(
        reserveShipmentCost(
          { faction: 'emperor', halfRate: false },
          'stronghold',
          Number(action.amount) - 1,
        ),
        1,
      );
      const sent = applyAction(g, 'p', action);
      conserve(sent);
    }
  }
});

void test('declining the optional free companion preserves ordinary payments and old pending quotes', () => {
  for (const value of [false, undefined]) {
    const game = smugglerShipmentGame();
    game.players[0].spice = 3;
    const guildBefore = game.players[1].spice;
    const done = applyAction(game, 'p', { ...ship, smuggler: value });
    assert.equal(done.players[0].spice, 0);
    assert.equal(done.players[1].spice, guildBefore + 3);
    assert.equal(done.players[0].forces['arrakeen:10'], 3);
    assert.ok(!done.log.some((l) => l.automatic?.name === 'Smuggler shipment'));
    conserve(done);
  }
  const game = smugglerShipmentGame('emperor', true);
  game.players[0].spice = 3;
  const old = applyAction(game, 'p', { ...ship, smuggler: undefined });
  assert.equal(old.pendingShipment?.smuggler, undefined);
  assert.equal(old.pendingShipment?.cost, 3);
  const resumed = applyAction(JSON.parse(JSON.stringify(old)), 'h', {
    type: 'decision',
    allow: true,
  });
  assert.equal(resumed.players[0].spice, 0);
  conserve(resumed);
});

void test('a truthful shipment promise uses the free companion in its executable completion', () => {
  let g = smugglerShipmentGame();
  g.players[0].spice = 2;
  const index = g.deck.findIndex((card) => card.effect === 'truthtrance');
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  g.players[1].hand.push(card);
  g = applyAction(g, 'h', { type: 'card', card: card.id });
  while (g.truthtrance?.stage === 'priority') {
    const actor = g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!;
    g = applyAction(g, actor.id, { type: 'truthPass' });
  }
  g = applyAction(g, 'h', {
    type: 'truthAsk',
    question: {
      kind: 'shipment',
      target: 'p',
      territory: 'arrakeen',
      minimum: 3,
    },
  });
  assert.ok(viewGame(g, 'p').truthShipmentAnswers?.includes('yes'));
  g = applyAction(g, 'p', { type: 'truthAnswer', answer: 'yes' });
  const action = viewGame(JSON.parse(JSON.stringify(g)), 'p').shipmentCompletion
    ?.actions[0];
  assert.equal(action?.type, 'ship');
  assert.equal(action?.smuggler, true);
  const done = applyAction(g, 'p', action!);
  assert.equal(done.shipmentPromises?.[0].fulfilled, true);
  assert.equal(done.players[0].spice, 0);
  assert.equal(done.players[0].forces['arrakeen:10'], 3);
  conserve(done);
});
