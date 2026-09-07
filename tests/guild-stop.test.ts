import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
const karmas = baseDeck().filter((c) => c.effect === 'karama');
function fixture() {
  let g = createGame('GUILDST2', newPlayer('e', 'Emperor', 'emperor'));
  joinGame(g, newPlayer('g', 'Guild', 'guild'));
  joinGame(g, newPlayer('b', 'Bene Gesserit', 'beneGesserit'));
  g.players.forEach((p) => (p.ready = true));
  g = applyAction(g, 'e', { type: 'start' });
  g = applyAction(g, 'b', { type: 'predict', faction: 'emperor', turn: 3 });
  for (const p of g.players)
    if (p.traitorChoices.length)
      g = applyAction(g, p.id, {
        type: 'traitor',
        leader: p.traitorChoices[0],
      });
  g.advanced = true;
  g.phase = 5;
  g.active = 'e';
  g.order = ['e', 'g', 'b'];
  g.movementRemaining = [...g.order];
  g.storm = 18;
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
    p.hand = [];
  }
  g.players[0].elites = { reserves: 5, tanks: 0, forces: {}, revived: 0 };
  g.players[1].hand = [karmas[0]];
  g.discard = [];
  return g;
}
const declaration = {
  type: 'ship',
  territory: 'arrakeen',
  sector: 10,
  amount: 4,
  elite: 2,
};
const stop = (g: Game) =>
  applyAction(g, 'g', { type: 'card', mode: 'special', card: karmas[0].id });
const permit = (g: Game) =>
  applyAction(g, 'g', { type: 'decision', allow: true });
function responses(state: Game) {
  let g = state;
  while (g.response)
    g = applyAction(
      g,
      g.players.find((p) => !g.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' },
    );
  return g;
}
void test('Guild decision precedes all payment, elite placement, advisor and intrusion effects', () => {
  const before = fixture();
  before.players[2].forces = { 'arrakeen:10': 1 };
  before.players[2].reserves = 19;
  const g = applyAction(before, 'e', declaration);
  assert.deepEqual(g.players, before.players);
  assert.equal(g.response, null);
  assert.deepEqual(g.decision, {
    kind: 'guildShipment',
    player: 'g',
    shipper: 'e',
    territory: 'arrakeen',
    sector: 10,
    amount: 4,
  });
  assert.equal(g.active, 'e');
  assert.equal(g.pendingShipment?.elite, 2);
  assert.equal(before.pendingShipment, undefined);
});
void test('stopping retains forces, elite tokens, spice and allied credit without Guild income or advisor followup', () => {
  const before = fixture();
  before.players[0].ally = 'b';
  before.players[2].ally = 'e';
  before.aid.b = { recipient: 'e', amount: 3 };
  const pending = applyAction(before, 'e', { ...declaration, allyPayment: 3 });
  const g = stop(pending);
  assert.equal(g.players[0].spice, 20);
  assert.deepEqual(g.players[0].forces, {});
  assert.deepEqual(g.players[0].elites, before.players[0].elites);
  assert.equal(g.players[0].reserves, 20);
  assert.equal(g.players[0].shipped, true);
  assert.equal(g.players[1].specialKaramaUsed, true);
  assert.equal(g.players[1].spice, 20);
  assert.equal(g.players[2].reserves, 20);
  assert.deepEqual(g.aid, before.aid);
  assert.equal(g.pendingShipment, null);
  assert.equal(g.decision, null);
  assert.equal(g.response, null);
  assert.equal(g.active, 'e');
  assert.equal(g.discard.filter((c) => c.id === karmas[0].id).length, 1);
  assert.throws(() => applyAction(g, 'e', declaration), /once/);
});
void test('a stopped shipment leaves ordinary movement available and cannot be countered by normal Karama', () => {
  const before = fixture();
  before.players[0].forces = { 'arrakeen:10': 3 };
  before.players[0].reserves = 17;
  let g = stop(
    applyAction(before, 'e', {
      ...declaration,
      territory: 'carthag',
      sector: 11,
    }),
  );
  g.players[0].hand = [karmas[1]];
  assert.throws(() =>
    applyAction(g, 'e', { type: 'card', mode: 'cancel', card: karmas[1].id }),
  );
  g = applyAction(g, 'e', {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'polar_sink',
    sector: 0,
    amount: 1,
  });
  assert.equal(g.players[0].forces['polar_sink:0'], 1);
});
void test('allowing commits once and resumes Guild income before Bene Gesserit accompaniment', () => {
  const initial = fixture();
  initial.players[0].hand = [karmas[1]];
  let g = permit(applyAction(initial, 'e', declaration));
  assert.equal(g.pendingShipment, null);
  assert.equal(g.players[0].spice, 16);
  assert.equal(g.players[0].reserves, 16);
  assert.equal(g.players[0].forces['arrakeen:10'], 4);
  assert.equal(g.players[0].elites?.forces['arrakeen:10'], 2);
  assert.equal(g.players[0].elites?.reserves, 3);
  assert.equal(g.response?.kind, 'guildIncome');
  assert.equal(g.players[1].specialKaramaUsed, undefined);
  assert.equal(g.decision?.kind, 'advisor');
  assert.throws(() => permit(g));
  g = responses(g);
  assert.equal(g.players[1].spice, 24);
  g = applyAction(g, 'b', { type: 'decision', accept: false });
  assert.equal(g.decision, null);
});
void test('allowing Guild-funded allied shipment pays only the shipper’s share to Guild', () => {
  const before = fixture();
  before.players[0].ally = 'g';
  before.players[1].ally = 'e';
  before.aid.g = { recipient: 'e', amount: 2 };
  let g = permit(applyAction(before, 'e', { ...declaration, allyPayment: 1 }));
  assert.equal(g.players[0].spice, 19);
  assert.equal(g.aid.g.amount, 1);
  assert.equal(g.response, null);
  g = responses(g);
  assert.equal(g.players[1].spice, 21);
});
void test('shipment rate card returns to its original owner on stop, including another player’s gift', () => {
  const before = fixture();
  before.players[2].hand = [karmas[1]];
  const benefit = applyAction(before, 'b', {
    type: 'card',
    mode: 'shipment',
    target: 'e',
    card: karmas[1].id,
  });
  const pending = applyAction(benefit, 'e', declaration);
  assert.equal(pending.pendingShipment?.cost, 2);
  const g = stop(pending);
  assert.deepEqual(g.players[2].hand, [karmas[1]]);
  assert.equal(
    g.discard.some((c) => c.id === karmas[1].id),
    false,
  );
  assert.equal(g.karamaShipping, null);
  const allowed = permit(pending);
  assert.equal(allowed.players[0].spice, 18);
  assert.equal(allowed.response, null);
  assert.equal(allowed.players[2].hand.length, 0);
  assert.equal(allowed.discard.filter((c) => c.id === karmas[1].id).length, 1);
});
void test('hidden Guild cards cannot change the offered decision or expose pending funding details', () => {
  const before = fixture();
  before.players[0].ally = 'b';
  before.players[2].ally = 'e';
  before.aid.b = { recipient: 'e', amount: 3 };
  const pending = applyAction(before, 'e', { ...declaration, allyPayment: 3 });
  before.players[1].hand = [];
  const empty = applyAction(before, 'e', { ...declaration, allyPayment: 3 });
  assert.deepEqual(empty.decision, pending.decision);
  const view = viewGame(JSON.parse(JSON.stringify(pending)), 'g');
  assert.equal('pendingShipment' in view, false);
  assert.equal('allyPayment' in view.decision!, false);
  assert.equal(view.players[0].hand, undefined);
  assert.throws(() => stop(empty), /Karama card/);
  assert.ok(permit(empty).players[0].shipped);
});
void test('invalid shipments and forged bypasses cannot spend the Guild power or alter state', () => {
  const before = fixture();
  const copy = structuredClone(before);
  for (const extra of [
    { amount: 21 },
    { elite: 5 },
    { sector: 18 },
    { allyPayment: 1 },
  ])
    assert.throws(() => applyAction(before, 'e', { ...declaration, ...extra }));
  assert.deepEqual(before, copy);
  assert.throws(() => stop(before), /declaration/);
  const pending = applyAction(before, 'e', {
    ...declaration,
    allow: true,
    skipGuild: true,
  });
  assert.equal(pending.decision?.kind, 'guildShipment');
  for (const [id, action] of [
    ['e', { type: 'decision', allow: true }],
    ['g', { type: 'decision', allow: false }],
    ['e', { type: 'endMovement' }],
    ['g', { type: 'card', mode: 'cancel', card: karmas[0].id }],
  ] as const)
    assert.throws(() => applyAction(pending, id, action));
  assert.equal(pending.players[0].shipped, false);
});
void test('the special power remains used on later turns, while ordinary Karama remains available', () => {
  let g = stop(applyAction(fixture(), 'e', declaration));
  g.turn++;
  g.players[0].shipped = false;
  g.players[1].hand = [karmas[1]];
  g = applyAction(g, 'g', {
    type: 'card',
    mode: 'shipment',
    card: karmas[1].id,
    target: 'e',
  });
  g = applyAction(g, 'e', declaration);
  assert.equal(g.decision?.kind, 'advisor');
  assert.equal(g.players[0].forces['arrakeen:10'], 4);
  assert.equal(g.players[1].specialKaramaUsed, true);
  assert.throws(() => stop(g), /already been used/);
});
void test('basic play and Fremen southern reinforcements do not open Guild special decisions', () => {
  let g = fixture();
  g.advanced = false;
  const shipped = applyAction(g, 'e', declaration);
  assert.equal(shipped.pendingShipment, undefined);
  assert.equal(shipped.response, null);
  assert.equal(shipped.players[1].spice, 24);
  g = fixture();
  g.players[0].faction = 'fremen';
  g.players[0].elites = undefined;
  g = applyAction(g, 'e', {
    type: 'ship',
    territory: 'sietch_tabr',
    sector: 14,
    amount: 3,
  });
  assert.equal(g.decision, null);
  assert.equal(g.pendingShipment, undefined);
  assert.equal(g.players[0].spice, 20);
  assert.equal(g.players[0].forces['sietch_tabr:14'], 3);
});
void test('cross-planet shipments bypass the off-planet stop decision', () => {
  const before = fixture();
  before.players[0].ally = 'g';
  before.players[1].ally = 'e';
  before.players[0].forces = { 'arrakeen:10': 3 };
  before.players[0].reserves = 17;
  const g = applyAction(before, 'e', {
    type: 'guildShip',
    from: 'arrakeen:10',
    territory: 'polar_sink',
    sector: 0,
    amount: 2,
  });
  assert.notEqual(g.decision?.kind, 'guildShipment');
  assert.equal(g.players[0].forces['polar_sink:0'], 2);
  assert.equal(g.players[1].specialKaramaUsed, undefined);
});
void test('AI resolves the shipment window from its own hand at every difficulty, protecting allies', () => {
  for (const difficulty of DIFFICULTIES) {
    const before = fixture();
    before.players[1].bot = difficulty;
    const pending = applyAction(before, 'e', declaration);
    const actions = botActions(viewGame(pending, 'g'));
    assert.ok(actions.length > 0, difficulty);
    const resolved = applyAction(pending, 'g', actions[0]);
    assert.equal(resolved.pendingShipment, null);
    const allied = structuredClone(pending);
    allied.players[1].ally = 'e';
    assert.deepEqual(botActions(viewGame(allied, 'g'))[0], {
      type: 'decision',
      allow: true,
    });
    const empty = structuredClone(pending);
    empty.players[1].hand = [];
    assert.deepEqual(botActions(viewGame(empty, 'g'))[0], {
      type: 'decision',
      allow: true,
    });
  }
});
void test('a persisted allowed shipment resumes intrusion before accompanying advisor choice', () => {
  const before = fixture();
  before.players[0].hand = [karmas[1]];
  before.players[2].forces = { 'arrakeen:10': 1 };
  before.players[2].reserves = 19;
  const pending = applyAction(before, 'e', declaration);
  let g = permit(JSON.parse(JSON.stringify(pending)));
  assert.equal(g.response?.kind, 'guildIncome');
  assert.equal(g.decision?.kind, 'intrusion');
  g = responses(g);
  g = applyAction(g, 'b', { type: 'decision', accept: true });
  assert.equal(g.response?.kind, 'advisorFlip');
  g = responses(g);
  assert.equal(g.decision?.kind, 'advisor');
  assert.ok(g.players[2].advisors?.arrakeen);
  assert.equal(g.players[0].forces['arrakeen:10'], 4);
  assert.equal(g.players[1].spice, 24);
});
void test('a converted Worthless shipment-rate card is restored only after its conversion was allowed', () => {
  const before = fixture();
  const worthless = baseDeck().find((c) => c.kind === 'worthless')!;
  before.players[2].hand = [worthless];
  let g = applyAction(before, 'b', {
    type: 'card',
    mode: 'shipment',
    card: worthless.id,
    target: 'e',
  });
  assert.equal(g.response?.kind, 'worthlessKarama');
  assert.throws(() => applyAction(g, 'e', declaration), /response window/);
  g = responses(g);
  g = stop(applyAction(g, 'e', declaration));
  assert.deepEqual(g.players[2].hand, [worthless]);
  assert.equal(g.pendingKarama, null);
  assert.equal(
    g.discard.some((c) => c.id === worthless.id),
    false,
  );
});
