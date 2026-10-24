import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { faction, type FactionId } from '../game/catalog';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createBasicSemutaAmbassadorFixture, actBasicSemutaAmbassador as act,
  advanceBasicSemutaAmbassador as advance, basicSemutaAmbassadorPlayer as player,
  basicSemutaAmbassadorInventory as inventory, basicSemutaAmbassadorBalances as balances } from './fixture-basic-semuta-ambassador';

function lobby(roster: FactionId[], advanced = false) {
  const expansions = [...new Set(roster.map(id => faction(id).expansion).filter(id => id !== 'base'))];
  let game = createGame('BASICSEMUTAENTRY', newPlayer(roster[0], roster[0], roster[0]), advanced, expansions);
  for (const id of roster.slice(1)) joinGame(game, newPlayer(id, id, id));
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  return game;
}
void test('fresh public bare Basic Richese starts initialize Semuta before the original setup', () => {
  for (const roster of [['richese', 'guild'], ['ecaz', 'richese', 'choam', 'guild'],
    ['ecaz', 'ixians', 'choam', 'richese', 'moritani', 'tleilaxu']] as FactionId[][]) {
    const source = lobby(roster), before = structuredClone(source);
    const started = applyAction(source, source.host, { type: 'start' });
    assert.equal(started.semutaPreview, true); assert.equal(started.status, 'setup');
    assert.equal(started.advanced, false); assert.equal(started.richeseCache?.length, 10);
    assert.ok(started.players.every(p => p.hand.length === 0));
    assert.equal(viewGame(started, source.host).semutaPreview, true);
    assert.deepEqual(source, before);
  }
});

void test('automatic Semuta initialization does not spread to Advanced, optional-module or non-Richese starts', () => {
  const advanced = lobby(['richese', 'guild'], true);
  const optional = lobby(['richese', 'guild']); optional.lobbyOptions = { leaderSkills: true };
  for (const source of [advanced, optional, lobby(['ecaz', 'choam', 'guild'])]) {
    const started = applyAction(source, source.host, source.advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
    assert.equal(started.semutaPreview, undefined);
  }
  const dirty = lobby(['richese', 'guild']); dirty.semutaPreview = true;
  assert.throws(() => applyAction(dirty, dirty.host, { type: 'start' }));
});

function rejected(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action)); assert.deepEqual(game, before);
}
function pass(game: Game) {
  const event = game.pendingTreacheryDiscard!.batch.event;
  for (const p of game.players) game = act(game, p.id, { type: 'semutaPass', event });
  return game;
}
function claim(game: Game, actor: string, target: string) {
  const event = game.pendingTreacheryDiscard!.batch.event;
  game = act(game, actor, { type: 'semutaCommit', event });
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = act(game, actor, { type: 'semutaSelect', event, card: target });
  return game;
}

for (const effect of ['choam', 'ixians'] as const) for (const copied of [false, true]) {
  for (const claims of [false, true]) void test(
    `public Basic ${copied ? 'BG-copy' : 'native'} ${effect} discards ${claims ? 'claim' : 'pass'} before exactly one original continuation`, () => {
      const f = createBasicSemutaAmbassadorFixture({ effect, copied });
      assert.equal(f.game.pendingAmbassador!.arrivalCause, 'shipment');
      const source = structuredClone(f.game), sourceBalances = balances(source);
      const pending = act(source, f.discardStep.actor, f.discardStep.action);
      assert.deepEqual(source, f.game);
      const receipt = pending.pendingTreacheryDiscard!;
      assert.equal(receipt?.reaction?.stage, 'offer'); assert.equal(receipt.continuation.kind, 'ambassador');
      assert.equal(receipt.batch.cause, `ambassador:${effect}`);
      assert.deepEqual(receipt.batch.entries.map(e => e.card.id), f.chosenCards);
      assert.ok(receipt.batch.entries.every(e => !e.publicFace && e.discardedBy === f.beneficiary));
      assert.equal(pending.pendingAmbassador, null); assert.equal(pending.active, f.entrant);
      const payout = effect === 'choam' ? 6 : 0;
      assert.equal(player(pending).spice, sourceBalances[f.beneficiary] + payout);
      assert.deepEqual(pending.deck, source.deck, 'Ix replacement waits for this reaction');
      for (const p of pending.players) {
        const reaction = viewGame(pending, p.id).semutaReaction!;
        assert.deepEqual(reaction.candidates, []); assert.equal(reaction.canCommit, p.id === f.holder);
      }
      rejected(pending, f.holder, { type: 'semutaSelect', event: receipt.batch.event, card: f.chosenCards[0] });
      rejected(pending, f.entrant, f.entrantContinuation.action);
      rejected(pending, f.beneficiary, f.discardStep.action);
      let resumed: Game;
      if (claims && effect === 'choam') {
        const committed = act(pending, f.holder, { type: 'semutaCommit', event: receipt.batch.event });
        assert.equal(committed.pendingTreacheryDiscard?.reaction?.stage, 'select');
        assert.deepEqual(viewGame(committed, f.holder).semutaReaction!.candidates.map(c => c.id), f.chosenCards);
        for (const p of committed.players.filter(p => p.id !== f.holder))
          assert.deepEqual(viewGame(committed, p.id).semutaReaction!.candidates, []);
        rejected(committed, f.beneficiary, { type: 'semutaSelect', event: receipt.batch.event, card: f.chosenCards[0] });
        rejected(committed, f.holder, { type: 'semutaPass', event: receipt.batch.event });
        resumed = act(committed, f.holder, { type: 'semutaSelect', event: receipt.batch.event, card: f.chosenCards[0] });
      } else resumed = claims ? claim(pending, f.holder, f.chosenCards[0]) : pass(pending);
      assert.equal(resumed.pendingTreacheryDiscard, null); assert.equal(resumed.pendingAmbassador, null);
      assert.equal(resumed.active, f.entrant); assert.equal(resumed.phase, 5);
      assert.equal(player(resumed).spice, sourceBalances[f.beneficiary] + payout);
      assert.equal(player(resumed, f.entrant).spice, sourceBalances[f.entrant]);
      assert.equal(player(resumed, f.entrant).forces[f.location], 1);
      assert.equal(player(resumed, f.holder).hand.some(c => c.id === f.chosenCards[0]), claims);
      assert.equal(resumed.discard.filter(c => c.id === f.semuta).length, Number(claims));
      assert.equal(resumed.discard.some(c => c.id === f.chosenCards[0]), !claims);
      if (effect === 'ixians') {
        assert.ok(player(resumed).hand.some(c => c.id === f.preReplacementDeckTop.id));
        assert.deepEqual(resumed.deck.map(c => c.id), source.deck.slice(1).map(c => c.id));
      } else assert.deepEqual(resumed.deck, source.deck);
      assert.deepEqual(inventory(resumed), f.originalTreachery);
      rejected(resumed, f.holder, { type: 'semutaCommit', event: receipt.batch.event });
      resumed = advance(resumed, state => !state.response && !state.phaseOpening && !state.decision);
      const finished = act(resumed, f.entrant, f.entrantContinuation.action);
      assert.ok(!finished.movementRemaining?.includes(f.entrant));
      assert.deepEqual(inventory(finished), f.originalTreachery);
    });
}

void test('CHOAM may discard nothing without opening an empty Semuta event or crediting spice', () => {
  const f = createBasicSemutaAmbassadorFixture({ effect: 'choam' });
  const game = act(f.game, f.beneficiary, { type: 'decision', event: f.event, cards: [] });
  assert.equal(game.pendingTreacheryDiscard, undefined); assert.equal(game.pendingAmbassador, null);
  assert.deepEqual(balances(game), f.balances); assert.deepEqual(inventory(game), f.originalTreachery);
});

for (const effect of ['choam', 'ixians'] as const) void test(`actual ordinary movement entry resumes after ${effect} Semuta recovery`, () => {
  const f = createBasicSemutaAmbassadorFixture({ effect, arrival: 'movement' });
  assert.equal(f.game.pendingAmbassador!.arrivalCause, 'movement');
  assert.equal(player(f.game, f.entrant).moved, 1);
  const pending = act(f.game, f.discardStep.actor, f.discardStep.action);
  assert.equal(pending.pendingTreacheryDiscard?.reaction?.stage, 'offer');
  let game = claim(pending, f.holder, f.chosenCards[0]);
  assert.equal(game.pendingAmbassador, null); assert.equal(game.active, f.entrant);
  assert.equal(player(game, f.entrant).moved, 1);
  assert.equal(player(game, f.entrant).forces[f.location], 1);
  game = advance(game, state => !state.response && !state.phaseOpening && !state.decision);
  game = act(game, f.entrant, f.entrantContinuation.action);
  assert.ok(!game.movementRemaining?.includes(f.entrant));
  assert.deepEqual(inventory(game), f.originalTreachery);
});

void test('older entries without an arrival witness and nested transports retain the original non-Semuta path', () => {
  const f = createBasicSemutaAmbassadorFixture({ effect: 'ixians' });
  for (const cause of [undefined, 'guildTransport', 'advisor', 'wormRide'] as const) {
    const source = structuredClone(f.game); source.pendingAmbassador!.arrivalCause = cause;
    const game = act(source, f.discardStep.actor, f.discardStep.action);
    assert.equal(game.pendingTreacheryDiscard, null); assert.equal(game.pendingAmbassador, null);
    assert.ok(player(game).hand.some(c => c.id === f.preReplacementDeckTop.id));
    assert.deepEqual(balances(game), f.balances); assert.deepEqual(inventory(game), f.originalTreachery);
  }
  const old = structuredClone(f.game); delete old.semutaPreview;
  const resumed = act(old, f.discardStep.actor, f.discardStep.action);
  assert.equal(resumed.semutaPreview, undefined); assert.equal(resumed.pendingTreacheryDiscard, null);
});

void test('a controlled full hand exchanges Semuta atomically without consuming the beneficiary replacement slot', () => {
  const f = createBasicSemutaAmbassadorFixture({ effect: 'ixians', copied: true });
  const game = structuredClone(f.game), owner = player(game, f.holder);
  while (owner.hand.length < 4) owner.hand.push(game.deck.pop()!);
  const pending = act(game, f.discardStep.actor, f.discardStep.action);
  assert.equal(viewGame(pending, f.holder).semutaReaction!.canCommit, true);
  const result = claim(pending, f.holder, f.chosenCards[0]);
  assert.equal(player(result, f.holder).hand.length, 4);
  assert.ok(player(result).hand.some(c => c.id === f.preReplacementDeckTop.id));
  assert.deepEqual(inventory(result), f.originalTreachery);
});

void test('a controlled beneficiary holding Semuta cannot retrieve its own fresh private discard', () => {
  const f = createBasicSemutaAmbassadorFixture({ effect: 'choam' }), game = structuredClone(f.game);
  const holder = player(game, f.holder), semuta = holder.hand.splice(holder.hand.findIndex(c => c.id === f.semuta), 1)[0];
  player(game).hand.push(semuta);
  const pending = act(game, f.discardStep.actor, f.discardStep.action), event = pending.pendingTreacheryDiscard!.batch.event;
  assert.equal(viewGame(pending, f.beneficiary).semutaReaction!.canCommit, false);
  rejected(pending, f.beneficiary, { type: 'semutaCommit', event });
  const result = pass(pending); assert.ok(player(result).hand.some(c => c.id === f.semuta));
  assert.deepEqual(inventory(result), f.originalTreachery);
});

void test('all four existing profiles legally complete actual Ambassador Semuta reactions', () => {
  const f = createBasicSemutaAmbassadorFixture({ effect: 'choam', copied: true });
  for (const difficulty of DIFFICULTIES) {
    let game = act(f.game, f.discardStep.actor, f.discardStep.action), count = 0;
    while (game.pendingTreacheryDiscard && count++ < 12) {
      const reaction = game.pendingTreacheryDiscard.reaction!;
      const actor = reaction.stage === 'select' ? reaction.player :
        game.players.find(p => !reaction.passed.includes(p.id))!.id;
      const view = viewGame(game, actor); view.players.find(p => p.id === actor)!.bot = difficulty;
      const action = botActions(view)[0]; assert.ok(action); game = act(game, actor, action);
    }
    assert.ok(count < 12); assert.equal(game.pendingTreacheryDiscard, null);
    assert.equal(game.pendingAmbassador, null); assert.equal(game.active, f.entrant);
    assert.deepEqual(inventory(game), f.originalTreachery);
  }
});
