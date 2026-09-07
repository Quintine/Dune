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
import { baseDeck } from '../game/cards';
import {
  createTerrorState,
  placeTerror,
  type TerrorKind,
} from '../game/moritani-terror';
import type { FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const decision = (g: Game, id: string, extra: Omit<Action, 'type'>) =>
  applyAction(g, id, { type: 'decision', ...extra });
function fixture(kind: TerrorKind = 'robbery', entrant: FactionId = 'emperor') {
  const g = createGame('TERROR03', newPlayer('m', 'Moritani', 'moritani'));
  g.players.push(
    newPlayer('e', 'Entrant', entrant),
    newPlayer('a', 'Atreides', 'atreides'),
    newPlayer('f', 'Fremen', 'fremen'),
  );
  g.status = 'playing';
  g.phase = 5;
  g.turn = 2;
  g.storm = 18;
  g.active = 'e';
  g.order = ['e', 'm', 'a', 'f'];
  g.movementRemaining = [...g.order];
  g.deck = baseDeck();
  for (const p of g.players) {
    p.forces = {};
    p.reserves = 20;
    p.spice = 20;
    p.hand = [];
  }
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens.find(
    (candidate) => candidate.kind === kind,
  )!;
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  return g;
}
const enter = (g = fixture()) =>
  applyAction(g, 'e', {
    type: 'ship',
    amount: 2,
    territory: 'arrakeen',
    sector: 10,
  });
const offer = (g = enter()) => decision(g, 'm', { alliance: true });
function allow(state: Game) {
  let g = state;
  for (let i = 0; g.response && i < 20; i++) {
    const id = g.players.find((p) => !g.response!.passed.includes(p.id))!.id;
    g = applyAction(g, id, { type: 'passResponse' });
  }
  assert.equal(g.response, null);
  return g;
}
function rejected(g: Game, id: string, action: Action) {
  const before = structuredClone(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function hold(g: Game, id: string, effect: string) {
  const index = g.deck.findIndex((card) => card.effect === effect);
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  player(g, id).hand.push(card);
  return card;
}

void test('Enemy of My Enemy opens a public Karama opportunity before allowing only the entrant to reply', () => {
  const initial = fixture();
  hold(initial, 'a', 'karama');
  const entered = enter(initial);
  assert.equal(viewGame(entered, 'm').terrorEntry!.canOfferAlliance, true);
  assert.equal(
    'canOfferAlliance' in viewGame(entered, 'e').terrorEntry!,
    false,
  );
  rejected(entered, 'e', { type: 'decision', alliance: true });
  const declared = offer(entered);
  assert.equal(declared.response?.kind, 'moritaniAlliance');
  assert.equal(declared.response?.owner, 'm');
  assert.deepEqual(declared.players, entered.players);
  assert.deepEqual(declared.moritaniTerror, entered.moritaniTerror);
  rejected(declared, 'e', { type: 'decision', accept: true });
  const reply = allow(reload(declared));
  assert.equal(reply.pendingTerrorEntry?.stage, 'allianceReply');
  assert.deepEqual(reply.decision, {
    kind: 'moritaniTerror',
    player: 'e',
    entrant: 'e',
    territory: 'arrakeen',
  });
  rejected(reply, 'm', { type: 'decision', accept: true });
  rejected(reply, 'a', { type: 'decision', accept: false });
  rejected(reply, 'e', { type: 'decision', decline: true });
  rejected(reply, 'e', { type: 'decision', accept: 'true' });
  assert.equal('kind' in viewGame(reply, 'e').terrorEntry!, false);
});

void test('acceptance outside Nexus joins both factions and returns the token hidden without repeating shipment', () => {
  const initial = fixture();
  player(initial, 'm').forces = { 'arrakeen:10': 1 };
  player(initial, 'm').reserves = 19;
  const entered = enter(initial);
  const before = structuredClone(entered.players);
  const done = decision(reload(allow(offer(entered))), 'e', { accept: true });
  assert.equal(done.nexus, false);
  assert.equal(player(done, 'm').ally, 'e');
  assert.equal(player(done, 'e').ally, 'm');
  for (const viewer of done.players) {
    const projection = viewGame(done, viewer.id);
    for (const member of ['m', 'e'])
      assert.equal(
        projection.players.find((p) => p.id === member)!.allySinceTurn,
        done.turn,
      );
  }
  assert.equal(player(done, 'e').forces['arrakeen:10'], 2);
  assert.equal(player(done, 'm').forces['arrakeen:10'], 1);
  assert.equal(player(done, 'e').spice, 18);
  assert.equal(player(done, 'e').reserves, 18);
  assert.equal(player(done, 'e').shipped, true);
  assert.equal(done.active, 'e');
  for (const old of before) {
    const current = player(done, old.id);
    assert.deepEqual(
      current,
      ['m', 'e'].includes(old.id)
        ? { ...old, ally: old.id === 'm' ? 'e' : 'm', allySinceTurn: done.turn }
        : old,
    );
  }
  assert.equal(done.pendingTerrorEntry, null);
  assert.equal(done.decision, null);
  assert.equal(done.response, null);
  assert.ok(
    done.moritaniTerror!.tokens.every(
      (token) => token.status === 'available' && token.location === null,
    ),
  );
  assert.ok(
    done.moritaniTerror!.tokens.every(
      (token) =>
        !entered.moritaniTerror!.tokens.some((old) => old.id === token.id),
    ),
  );
  assert.deepEqual(viewGame(done, 'a').moritaniTerror!.tokens, []);
  assert.equal(done.moritaniTerror!.placementTurn, 1);
  rejected(done, 'e', { type: 'decision', accept: true });
  rejected(done, 'e', {
    type: 'ship',
    amount: 2,
    territory: 'carthag',
    sector: 11,
  });
});

void test('acceptance detaches both previous partners and refunds broken-pair escrow exactly once while preserving unrelated funding', () => {
  let g = fixture();
  g.players.push(
    newPlayer('x', 'Ixians', 'ixians'),
    newPlayer('t', 'Tleilaxu', 'tleilaxu'),
  );
  g.order.push('x', 't');
  for (const id of ['x', 't']) player(g, id).spice = 20;
  for (const [a, b] of [
    ['m', 'a'],
    ['e', 'f'],
    ['x', 't'],
  ]) {
    player(g, a).ally = b;
    player(g, b).ally = a;
  }
  for (const [id, amount] of [
    ['m', 3],
    ['a', 4],
    ['e', 5],
    ['f', 6],
    ['x', 7],
  ] as const)
    g = applyAction(g, id, { type: 'pledgeAid', amount });
  g.allianceOffers = { m: 'a', a: 'm', e: 'f', f: 'e', x: 't', t: 'x' };
  const entered = enter(g);
  const pending = allow(offer(entered));
  assert.equal(player(pending, 'm').ally, 'a');
  assert.deepEqual(pending.aid, entered.aid);
  const done = decision(reload(pending), 'e', { accept: true });
  assert.deepEqual(
    done.players.map((p) => [p.id, p.ally]),
    [
      ['m', 'e'],
      ['e', 'm'],
      ['a', null],
      ['f', null],
      ['x', 't'],
      ['t', 'x'],
    ],
  );
  assert.deepEqual(done.aid, { x: { recipient: 't', amount: 7 } });
  assert.deepEqual(done.allianceOffers, { x: 't', t: 'x' });
  for (const id of ['m', 'a', 'f', 't'])
    assert.equal(player(done, id).spice, 20);
  assert.equal(player(done, 'e').spice, 18);
  assert.equal(player(done, 'x').spice, 13);
  rejected(reload(done), 'e', { type: 'decision', accept: true });
});

void test('refusing an offered alliance immediately reveals Robbery and does not restore the optional decline', () => {
  const pending = allow(offer());
  const refused = decision(reload(pending), 'e', { accept: false });
  assert.equal(refused.pendingTerrorEntry?.stage, 'robbery');
  assert.equal(refused.decision?.player, 'm');
  assert.equal(
    refused.moritaniTerror!.tokens.find((token) => token.kind === 'robbery')!
      .status,
    'removed',
  );
  assert.equal(player(refused, 'e').ally, null);
  assert.equal(player(refused, 'm').ally, null);
  rejected(refused, 'm', { type: 'decision', decline: true });
  const done = decision(refused, 'm', { choice: 'spice' });
  assert.equal(player(done, 'm').spice, 29);
  assert.equal(player(done, 'e').spice, 9);
  assert.equal(done.pendingTerrorEntry, null);
});

void test('a refused Sabotage offer discards once and retains only its optional gift decision after reload', () => {
  const initial = fixture('sabotage');
  player(initial, 'e').hand.push(...initial.deck.splice(0, 2));
  player(initial, 'm').hand.push(initial.deck.shift()!);
  const pending = allow(offer(enter(initial)));
  const refused = decision(reload(pending), 'e', { accept: false });
  assert.equal(player(refused, 'e').hand.length, 1);
  assert.equal(refused.discard.length, 1);
  assert.equal(refused.pendingTerrorEntry?.stage, 'gift');
  rejected(reload(refused), 'e', { type: 'decision', accept: false });
  const done = decision(reload(refused), 'm', { decline: true });
  assert.deepEqual(done.discard, refused.discard);
  assert.equal(done.pendingTerrorEntry, null);
});

void test('Karama cancels the alliance offer while preserving reveal or decline and blocking repeated offers', () => {
  const initial = fixture();
  const karama = hold(initial, 'a', 'karama');
  const entered = enter(initial);
  const pending = offer(entered);
  const canceled = applyAction(reload(pending), 'a', {
    type: 'card',
    card: karama.id,
    mode: 'cancel',
  });
  assert.equal(canceled.response, null);
  assert.equal(canceled.pendingTerrorEntry?.stage, 'offer');
  assert.equal(canceled.decision?.player, 'm');
  assert.equal(viewGame(canceled, 'm').terrorEntry!.canOfferAlliance, false);
  assert.ok(viewGame(canceled, 'm').terrorEntry!.allianceBlockedReason);
  assert.deepEqual(canceled.moritaniTerror, entered.moritaniTerror);
  assert.equal(
    canceled.discard.filter((card) => card.id === karama.id).length,
    1,
  );
  rejected(canceled, 'm', { type: 'decision', alliance: true });
  const declined = decision(reload(canceled), 'm', { decline: true });
  assert.equal(declined.pendingTerrorEntry, null);
  assert.deepEqual(declined.moritaniTerror, canceled.moritaniTerror);
  const revealed = decision(reload(canceled), 'm', { reveal: true });
  assert.equal(revealed.pendingTerrorEntry?.stage, 'robbery');
});

void test('Ecaz and presently unsupported refusal effects cannot receive an alliance offer', () => {
  for (const initial of [
    fixture('robbery', 'ecaz'),
    fixture('atomics'),
    fixture('extortion'),
  ]) {
    const g = enter(initial);
    assert.equal(viewGame(g, 'm').terrorEntry!.canOfferAlliance, false);
    assert.ok(viewGame(g, 'm').terrorEntry!.allianceBlockedReason);
    assert.equal(
      'allianceBlockedReason' in viewGame(g, 'e').terrorEntry!,
      false,
    );
    rejected(g, 'm', { type: 'decision', alliance: true });
    assert.equal(decision(g, 'm', { decline: true }).pendingTerrorEntry, null);
  }
});

void test('alliance declarations and replies do not expose different hidden Terror faces', () => {
  const initial = fixture();
  const alternative = structuredClone(initial);
  const robbery = alternative.moritaniTerror!.tokens.find(
    (token) => token.kind === 'robbery',
  )!;
  const sabotage = alternative.moritaniTerror!.tokens.find(
    (token) => token.kind === 'sabotage',
  )!;
  [robbery.kind, sabotage.kind] = [sabotage.kind, robbery.kind];
  const first = offer(enter(initial));
  const second = offer(enter(alternative));
  assert.deepEqual(viewGame(first, 'e'), viewGame(second, 'e'));
  assert.deepEqual(viewGame(allow(first), 'a'), viewGame(allow(second), 'a'));
});

void test('alliance acceptance resumes a suspended worm ride queue once after the token returns', () => {
  let g = fixture();
  player(g, 'f').forces = { 'imperial_basin:10': 2, 'hagga_basin:11': 1 };
  player(g, 'f').reserves = 17;
  g.phase = 1;
  g.active = null;
  g.decision = { kind: 'wormRide', player: 'f', territory: 'imperial_basin' };
  g.wormRides = ['hagga_basin'];
  g = applyAction(g, 'f', {
    type: 'decision',
    accept: true,
    territory: 'arrakeen',
    sector: 10,
    forces: { 'imperial_basin:10': 2 },
  });
  const pending = allow(offer(g));
  assert.deepEqual(pending.wormRides, ['hagga_basin']);
  const done = decision(reload(pending), 'f', { accept: true });
  assert.equal(player(done, 'f').ally, 'm');
  assert.deepEqual(done.wormRides, []);
  assert.deepEqual(done.decision, {
    kind: 'wormRide',
    player: 'f',
    territory: 'hagga_basin',
  });
  assert.equal(player(done, 'f').forces['arrakeen:10'], 2);
  assert.equal(done.pendingTerrorEntry, null);
});

void test('stale alliance response metadata rejects settlement without partial alliances or token return', () => {
  const initial = fixture();
  hold(initial, 'a', 'karama');
  const waiting = offer(enter(initial));
  for (const field of ['turn', 'phase'] as const) {
    const stale = reload(waiting);
    stale.pendingTerrorEntry![field]--;
    stale.response!.passed = stale.players.slice(1).map((p) => p.id);
    rejected(stale, stale.players[0].id, { type: 'passResponse' });
    const reply = allow(waiting);
    reply.pendingTerrorEntry![field]--;
    rejected(reply, 'e', { type: 'decision', accept: true });
    rejected(reply, 'e', { type: 'decision', accept: false });
  }
});

void test('nested Worthless-as-Karama cancellation restores the original alliance window without premature acceptance', () => {
  const initial = fixture('robbery', 'beneGesserit');
  initial.advanced = true;
  const worthlessIndex = initial.deck.findIndex(
    (card) => card.kind === 'worthless',
  );
  const worthless = initial.deck.splice(worthlessIndex, 1)[0];
  player(initial, 'e').hand.push(worthless);
  const karama = hold(initial, 'a', 'karama');
  const pending = offer(enter(initial));
  const converted = applyAction(pending, 'e', {
    type: 'card',
    card: worthless.id,
    mode: 'cancel',
  });
  assert.equal(converted.response?.kind, 'worthlessKarama');
  assert.equal(converted.pendingTerrorEntry?.stage, 'allianceResponse');
  assert.deepEqual(converted.moritaniTerror, pending.moritaniTerror);
  assert.equal(player(converted, 'm').ally, null);
  const restored = applyAction(reload(converted), 'a', {
    type: 'card',
    card: karama.id,
    mode: 'cancel',
  });
  assert.equal(
    restored.response,
    null,
    'spent cancellation cards leave no response choice',
  );
  assert.equal(restored.pendingTerrorEntry?.stage, 'allianceReply');
  assert.equal(restored.pendingKarama, null);
  assert.deepEqual(restored.moritaniTerror, pending.moritaniTerror);
  assert.equal(
    restored.discard.filter((card) => card.id === worthless.id).length,
    1,
  );
  assert.equal(
    restored.discard.filter((card) => card.id === karama.id).length,
    1,
  );
  const accepted = decision(allow(reload(restored)), 'e', { accept: true });
  assert.equal(player(accepted, 'm').ally, 'e');
  assert.equal(accepted.pendingTerrorEntry, null);
  const allowedConversion = allow(reload(converted));
  assert.equal(allowedConversion.pendingTerrorEntry?.stage, 'offer');
  assert.equal(
    viewGame(allowedConversion, 'm').terrorEntry!.canOfferAlliance,
    false,
  );
  assert.deepEqual(allowedConversion.moritaniTerror, pending.moritaniTerror);
});

void test('new allies survive their current movement finish and must separate on the following turn', () => {
  const initial = fixture();
  player(initial, 'm').forces = { 'arrakeen:10': 1 };
  player(initial, 'm').reserves = 19;
  player(initial, 'm').shipped = true;
  player(initial, 'm').moved = 1;
  initial.movementRemaining = ['e', 'a', 'f'];
  const accepted = decision(allow(offer(enter(initial))), 'e', {
    accept: true,
  });
  assert.equal(player(accepted, 'm').allySinceTurn, 2);
  assert.equal(player(accepted, 'e').allySinceTurn, 2);
  const currentTurn = applyAction(reload(accepted), 'e', {
    type: 'endMovement',
  });
  assert.equal(player(currentTurn, 'e').forces['arrakeen:10'], 2);
  assert.equal(player(currentTurn, 'e').tanks, 0);
  assert.equal(player(currentTurn, 'm').forces['arrakeen:10'], 1);
  const next = reload(accepted);
  next.turn++;
  next.active = 'e';
  next.movementRemaining = ['e', 'a', 'f'];
  const separated = applyAction(next, 'e', { type: 'endMovement' });
  assert.equal(player(separated, 'e').forces['arrakeen:10'] ?? 0, 0);
  assert.equal(player(separated, 'e').tanks, 2);
  assert.equal(player(separated, 'm').forces['arrakeen:10'], 1);
});

void test('ordinary Nexus formation stamps both allies with the same creation turn', () => {
  let g = fixture();
  g.phase = 1;
  g.nexus = true;
  g = applyAction(g, 'm', { type: 'alliance', target: 'e' });
  g = applyAction(g, 'e', { type: 'alliance', target: 'm' });
  assert.equal(player(g, 'm').ally, 'e');
  assert.equal(player(g, 'e').ally, 'm');
  assert.equal(player(g, 'm').allySinceTurn, g.turn);
  assert.equal(player(g, 'e').allySinceTurn, g.turn);
});

void test('returning an alliance token preserves other placed and removed token identities', () => {
  const initial = fixture();
  const placed = initial.moritaniTerror!.tokens.find(
    (token) => token.kind === 'sabotage',
  )!;
  initial.moritaniTerror = placeTerror(
    initial.moritaniTerror!,
    placed.id,
    'carthag',
    2,
  );
  const removed = initial.moritaniTerror!.tokens.find(
    (token) => token.kind === 'atomics',
  )!;
  removed.status = 'removed';
  const unchanged = initial.moritaniTerror!.tokens.filter(
    (token) => token.id === placed.id || token.id === removed.id,
  );
  const done = decision(allow(offer(enter(initial))), 'e', { accept: true });
  assert.deepEqual(
    done.moritaniTerror!.tokens.filter(
      (token) => token.id === placed.id || token.id === removed.id,
    ),
    unchanged,
  );
  assert.equal(
    done.moritaniTerror!.tokens.filter((token) => token.status === 'available')
      .length,
    4,
  );
  assert.equal(done.moritaniTerror!.placementTurn, 2);
  assert.equal('supplyEpoch' in viewGame(done, 'a').moritaniTerror!, false);
});

void test('all four AI profiles own only their alliance decisions and finish every supported alliance continuation from private views', () => {
  const ownerOffer = enter();
  const response = offer(ownerOffer);
  const entrantReply = allow(response);
  const refused = decision(entrantReply, 'e', { accept: false });
  const cancelInitial = fixture();
  const karama = hold(cancelInitial, 'a', 'karama');
  const canceled = applyAction(offer(enter(cancelInitial)), 'a', {
    type: 'card',
    card: karama.id,
    mode: 'cancel',
  });
  for (const difficulty of DIFFICULTIES) {
    for (const state of [
      ownerOffer,
      response,
      entrantReply,
      refused,
      canceled,
    ]) {
      let g = reload(state);
      for (const p of g.players) p.bot = difficulty;
      for (let step = 0; g.pendingTerrorEntry && step < 40; step++) {
        const choices = g.players.map((p) => ({
          id: p.id,
          actions: botActions(viewGame(g, p.id)),
        }));
        if (g.decision) {
          for (const choice of choices) {
            if (choice.id === g.decision.player)
              assert.ok(
                choice.actions.length > 0,
                difficulty + ':' + g.pendingTerrorEntry.stage,
              );
            else
              assert.deepEqual(
                choice.actions,
                [],
                'Only the pending decision owner may act.',
              );
          }
        }
        for (const choice of choices)
          for (const action of choice.actions)
            assert.doesNotThrow(() => applyAction(g, choice.id, action));
        const next = choices.find((choice) => choice.actions.length > 0);
        assert.ok(
          next,
          difficulty + ':' + g.pendingTerrorEntry.stage + ' cannot stall',
        );
        g = reload(applyAction(g, next.id, next.actions[0]));
      }
      assert.equal(
        g.pendingTerrorEntry,
        null,
        difficulty + ':' + state.pendingTerrorEntry!.stage,
      );
      assert.equal(g.decision, null);
      assert.equal(g.response, null);
      assert.equal(player(g, 'e').forces['arrakeen:10'], 2);
      assert.equal(player(g, 'e').reserves, 18);
    }
  }
});
