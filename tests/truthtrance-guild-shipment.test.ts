import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, newPlayer, prepareSpecialKaramaIntent, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { territory } from '../game/board';

const player = (g: Game, id: string) => g.players.find(p => p.id === id)!;
// Controlled response probes, distinct from the original-action fixture.
function fixture(target: 'guild' | 'emperor' | 'fremen' = 'emperor', spice = 12, ownKarama = false) {
  const g = createGame('GUILDTRUTHPROBE', newPlayer('a', 'Asker', 'atreides'), true);
  g.players.push(newPlayer('p', 'Respondent', target));
  g.players.push(newPlayer('o', 'Other', target === 'guild' ? 'emperor' : 'guild'));
  Object.assign(g, { status: 'playing', phase: 5, turn: 2, storm: 18,
    active: 'p', order: ['p', 'a', 'o'], movementRemaining: ['p', 'a', 'o'], deck: baseDeck() });
  for (const p of g.players) { p.hand = []; p.forces = {}; p.reserves = 20; p.spice = 12; }
  player(g, 'p').spice = spice;
  const hold = (id: string, effect: string) => {
    const index = g.deck.findIndex(c => c.effect === effect); assert.ok(index >= 0);
    const card = g.deck.splice(index, 1)[0]; player(g, id).hand.push(card); return card.id;
  };
  const truth = hold('a', 'truthtrance');
  const guild = target === 'guild' ? 'p' : 'o';
  const cancel = hold('a', 'karama');
  const special = hold(ownKarama ? 'p' : guild === 'p' ? 'o' : guild, 'karama');
  return { game: g, truth, cancel, special, guild };
}
function bind(f: ReturnType<typeof fixture>, answer = 'yes', minimum = 6, mixed = false) {
  let g = applyAction(f.game, 'a', { type: 'card', card: f.truth });
  while (g.truthtrance?.stage === 'priority') {
    const actor = g.players.find(p => !g.truthtrance!.passed.includes(p.id))!;
    g = applyAction(g, actor.id, { type: 'truthPass' });
  }
  const leaf = { kind: 'shipment', territory: 'carthag', minimum };
  const question = mixed ? { kind: 'mixedShipment', target: 'p', mixed: { kind: 'or', terms: [
    { kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 0 } }, leaf,
  ] } } : { ...leaf, target: 'p' };
  g = applyAction(g, 'a', { type: 'truthAsk', question });
  assert.ok(viewGame(g, 'p').truthShipmentAnswers?.includes(answer as 'yes' | 'no'));
  return applyAction(g, 'p', { type: 'truthAnswer', answer });
}
function ship(g: Game, amount = 6) {
  return applyAction(g, 'p', { type: 'ship', territory: 'carthag', sector: 11, amount, allyPayment: 0 });
}
function allowInterception(g: Game, guild: string) {
  assert.equal(g.decision?.kind, 'guildShipment');
  assert.equal(viewGame(g, 'p').shipmentCompletion, null, 'No executable guide during interception');
  return applyAction(g, guild, { type: 'decision', allow: true });
}
function pass(g: Game) {
  for (let n = 0; g.response && n < 30; n++) {
    const actor = g.players.find(p => !g.response!.passed.includes(p.id))!;
    g = applyAction(g, actor.id, { type: 'passResponse' });
  }
  assert.equal(g.response, null); return g;
}
function reject(g: Game, actor: string, action: Action) {
  const before = structuredClone(g); assert.throws(() => applyAction(g, actor, action)); assert.deepEqual(g, before);
}

for (const [answer, amount, mixed] of [['yes', 6, false], ['no', 1, false], ['yes', 1, true]] as const)
  void test(`opposing Guild stop settles ${mixed ? 'mixed true OR shipment' : answer} from the actual absent shipment`, () => {
    const f = fixture(), bound = bind(f, answer, 6, mixed), pending = ship(bound, amount);
    assert.equal(pending.shipmentPromises![0].fulfilled, undefined);
    assert.equal(pending.shipmentPromises![0].released, undefined);
    const done = applyAction(pending, f.guild, { type: 'card', mode: 'special', card: f.special });
    const released = answer === 'yes' && !mixed;
    assert.equal(done.shipmentPromises![0].released === true, released);
    assert.equal(done.shipmentPromises![0].fulfilled === true, !released);
    assert.equal(player(done, 'p').shipped, true);
    assert.deepEqual(done.players.map(p => [p.spice, p.reserves, p.forces]), bound.players.map(p => [p.spice, p.reserves, p.forces]));
    assert.equal(player(done, f.guild).specialKaramaUsed, true);
    assert.equal(done.discard.filter(c => c.id === f.special).length, 1);
    assert.equal(done.discard.filter(c => c.id === f.truth).length, 1);
    assert.equal(done.log.some(row => /shipment answer is no longer binding/.test(row.text)), released);
    reject(done, f.guild, { type: 'card', mode: 'special', card: f.special });
  });

void test('Guild cannot evade its own positive answer by self-interception, but may stop a nonmatching No shipment', () => {
  const f = fixture('guild', 12, true), pending = ship(bind(f));
  const action = { type: 'card', mode: 'special', card: f.special };
  assert.match(viewGame(pending, 'p').guildShipmentStopPromiseBlock!, /Honor your Truthtrance/);
  assert.throws(() => prepareSpecialKaramaIntent(pending, 'p', action), /Honor your Truthtrance/);
  reject(pending, 'p', action);
  assert.equal(player(pending, 'p').specialKaramaUsed, undefined);
  const negative = ship(bind(f, 'no'), 1);
  assert.equal(viewGame(negative, 'p').guildShipmentStopPromiseBlock, null);
  const done = applyAction(negative, 'p', action);
  assert.equal(done.shipmentPromises![0].fulfilled, true);
  assert.equal(done.shipmentPromises![0].released, undefined);
});

for (const [spice, ownKarama] of [[6, false], [3, false], [3, true]] as const)
  void test(`Guild rate cancellation with ${spice} spice and ${ownKarama ? 'owned' : 'no owned'} alternative preserves the real completion`, () => {
    const f = fixture('guild', spice, ownKarama), bound = bind(f), declared = ship(bound);
    const rate = allowInterception(declared, f.guild);
    assert.equal(rate.response?.kind, 'guildRate');
    assert.equal(viewGame(rate, 'p').shipmentCompletion, null);
    const done = applyAction(rate, 'a', { type: 'card', mode: 'cancel', card: f.cancel });
    if (spice === 6) {
      assert.equal(player(done, 'p').shipped, true);
      assert.equal(player(done, 'p').spice, 0);
      assert.equal(player(done, 'p').forces['carthag:11'], 6);
      assert.equal(done.shipmentPromises![0].fulfilled, true);
    } else {
      assert.equal(player(done, 'p').shipped, false);
      assert.equal(player(done, 'p').spice, spice);
      assert.equal(player(done, 'p').reserves, 20);
      assert.equal(done.shipmentPromises![0].released === true, !ownKarama);
      if (ownKarama) {
        const preparation = viewGame(done, 'p').shipmentCompletion!.actions[0];
        assert.equal(preparation.card, f.special); assert.equal(preparation.mode, 'shipment');
        const prepared = pass(applyAction(done, 'p', preparation));
        const delivered = pass(allowInterception(ship(prepared), f.guild));
        assert.equal(delivered.shipmentPromises![0].fulfilled, true);
        assert.equal(player(delivered, 'p').forces['carthag:11'], 6);
      }
    }
  });

for (const destination of ['carthag', 'the_great_flat'] as const) void test(
  `denied Fremen southern transport ${destination === 'carthag' ? 'releases an unreachable destination' : 'retains ordinary free reinforcement'}`, () => {
    const f = fixture('fremen', 12);
    player(f.game, 'p').ally = f.guild; player(f.game, f.guild).ally = 'p';
    // Reuse the bound grammar while selecting an independent destination.
    let g = applyAction(f.game, 'a', { type: 'card', card: f.truth });
    while (g.truthtrance?.stage === 'priority') {
      const actor = g.players.find(p => !g.truthtrance!.passed.includes(p.id))!;
      g = applyAction(g, actor.id, { type: 'truthPass' });
    }
    g = applyAction(g, 'a', { type: 'truthAsk', question: { kind: 'shipment', target: 'p', territory: destination, minimum: 6 } });
    g = applyAction(g, 'p', { type: 'truthAnswer', answer: 'yes' });
    const sector = territory(destination).sectors[0];
    g = applyAction(g, 'p', { type: 'guildShip', from: 'reserves', territory: destination, sector, amount: 6 });
    assert.equal(g.response?.kind, 'guildTransportPermission');
    assert.equal(viewGame(g, 'p').shipmentCompletion, null);
    g = applyAction(g, 'a', { type: 'card', mode: 'cancel', card: f.cancel });
    assert.equal(player(g, 'p').shipped, false);
    assert.equal(player(g, 'p').reserves, 20);
    assert.equal(g.shipmentPromises![0].released === true, destination === 'carthag');
    if (destination === 'the_great_flat') {
      const action = viewGame(g, 'p').shipmentCompletion!.actions[0];
      assert.equal(action.type, 'ship'); assert.equal(action.territory, destination);
      const delivered = applyAction(g, 'p', action);
      assert.equal(delivered.shipmentPromises![0].fulfilled, true);
      assert.equal(player(delivered, 'p').spice, 12);
    }
  });
