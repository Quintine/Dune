import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES, type Difficulty } from '../game/bot-profiles';
import { defaultVoiceMatch } from '../game/battle-cards';
import { validateNexusBorrowedVoice, type NexusBorrowedVoiceFrame } from '../game/nexus-borrowed-voice';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import {
  createNexusBorrowedVoiceFixture, nexusBorrowedVoiceInventory,
  nexusBorrowedVoicePlayer as player,
  type NexusBorrowedVoiceFixture,
} from './fixture-nexus-borrowed-voice';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
/** The engine's own frame bound to this real battle, never a stand-in. */
function frame(game: Game): NexusBorrowedVoiceFrame {
  const record = game.battle?.nexusBorrowedVoice;
  assert.ok(record, 'The battle must carry the absent-Bene-Gesserit borrowed-Voice frame');
  return record;
}
function context(game: Game) {
  const battle = game.battle!;
  assert.ok(battle.event);
  return { turn: game.turn,
    battle: { event: battle.event, attacker: battle.attacker, defender: battle.defender } };
}
function offer(game: Game, actor: string) {
  const view = viewGame(game, actor).nexusBorrowedVoice;
  assert.ok(view, `The current queue owner must see the borrowed-Voice offer for ${actor}`);
  return view;
}
function preparation(game: Game, actor?: string) {
  const battle = actor ? viewGame(game, actor).battle : game.battle;
  return battle?.preparation;
}
function reject(game: Game, actor: string, action: Action, error?: RegExp): void {
  const before = structuredClone(game);
  if (error) assert.throws(() => applyAction(game, actor, action), error);
  else assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'A refused queue action cannot spend, deal, command or move anything');
}
/** The single opportunistic physical auction purchase this fixture makes. */
function declareStep(game: Game, fixture: NexusBorrowedVoiceFixture, must: boolean,
  kind = fixture.targetKind): Game {
  const neutral = applyAction(game, fixture.atreides,
    { type: 'nexusBorrowedVoice', event: offer(game, fixture.atreides).event, use: false });
  return applyAction(neutral, fixture.holder,
    { type: 'nexusBorrowedVoice', event: offer(neutral, fixture.holder).event,
      use: true, kind, must });
}
/** Settle the original Voice response exactly as the engine's own window does. */
function settledWindow(game: Game): Game {
  let state = game;
  for (let index = 0; state.response && index < 24; index++) {
    const actor = state.players.find(seat => !state.response!.passed.includes(seat.id))!.id;
    state = applyAction(state, actor, { type: 'passResponse' });
  }
  assert.equal(state.response, null);
  return state;
}
function policy(game: Game, actor: string, difficulty: Difficulty): Action[] {
  const saved = reload(game);
  player(saved, actor).bot = difficulty;
  return botActions(viewGame(saved, actor));
}
function plan(game: Game, actor: string, weapon: string | null): Action {
  const leader = player(game, actor).leaders.filter(candidate => !candidate.dead)
    .sort((a, b) => b.strength - a.strength)[0];
  assert.ok(leader);
  return { type: 'battlePlan', leader: leader.id, dial: 0, support: 0, weapon, defense: null };
}
/** Decline the native preparation exactly as the original flow allows, including
 * the Advanced Atreides full-plan offer that follows it. */
function declinePreparation(game: Game, actor: string): Game {
  const declined = applyAction(game, actor, { type: 'declineBattlePower' });
  return declined.decision?.kind === 'fullPlanOffer'
    ? applyAction(declined, declined.decision.player, { type: 'decision', decline: true })
    : declined;
}
const built: Partial<Record<'basic' | 'advanced', NexusBorrowedVoiceFixture>> = {};
function fixture(advanced: boolean): NexusBorrowedVoiceFixture {
  const key = advanced ? 'advanced' : 'basic';
  built[key] ??= createNexusBorrowedVoiceFixture({ advanced });
  return built[key]!;
}

for (const advanced of [false, true]) {
  const band = advanced ? 'Advanced' : 'Basic';

  void test(`${band} absent-Bene-Gesserit Nexus offers both real combatants in attacker order before native Prescience`, () => {
    const f = fixture(advanced);
    const game = reload(f.game);
    const record = frame(game);
    assert.equal(record.stage, 'choose');
    assert.deepEqual(record.order, [f.atreides, f.holder]);
    assert.deepEqual(record.passed, []);
    assert.equal(record.owner, null);
    assert.equal(record.voice, null);
    assert.equal(record.turn, game.turn);
    assert.equal(record.battle, game.battle!.event);
    validateNexusBorrowedVoice(context(game), record);
    assert.equal(preparation(game, f.atreides)!.kind, 'nexusVoice');
    assert.equal(preparation(game, f.atreides)!.owner, f.atreides);
    const first = offer(game, f.atreides);
    assert.equal(first.event, record.event);
    assert.equal(first.owner, f.atreides);
    assert.equal(first.target, f.holder);
    assert.equal(first.canUse, false, 'The neutral aggressor owns no physical Nexus card');
    assert.equal(viewGame(game, f.holder).nexusBorrowedVoice, null, 'Only the current queue owner sees the offer');
    assert.equal(viewGame(game, f.canceler).nexusBorrowedVoice, null);
    assert.equal(viewGame(game, f.partner).nexusBorrowedVoice, null);
    assert.equal(preparation(game, f.canceler)!.kind, 'nexusVoice',
      'The public preparation names who must acknowledge without exposing a card');
    assert.equal(preparation(game, f.canceler)!.owner, f.atreides);
    // A cardless or foreign seat may never command, and the queue event is bound.
    reject(game, f.atreides, { type: 'nexusBorrowedVoice', event: first.event, use: true,
      kind: f.targetKind, must: true });
    reject(game, f.holder, { type: 'nexusBorrowedVoice', event: first.event, use: false });
    reject(game, f.canceler, { type: 'nexusBorrowedVoice', event: first.event, use: false });
    reject(game, f.partner, { type: 'nexusBorrowedVoice', event: first.event, use: false });
    reject(game, f.atreides, { type: 'nexusBorrowedVoice', event: `${first.event}:stale`, use: false });
    reject(game, f.atreides, { type: 'nexusBorrowedVoice', event: game.battle!.event, use: false });
    nexusBorrowedVoiceInventory(game);

    // The neutral aggressor acknowledges first; nothing is spent or dealt.
    const hands = player(game, f.holder).hand.map(card => card.id);
    const passed = applyAction(game, f.atreides, { type: 'nexusBorrowedVoice', event: first.event, use: false });
    const afterFirst = frame(passed);
    assert.equal(afterFirst.stage, 'choose');
    assert.deepEqual(afterFirst.passed, [f.atreides]);
    assert.equal(passed.battle!.voice, undefined);
    assert.deepEqual(player(passed, f.holder).hand.map(card => card.id), hands);
    assert.equal(passed.nexusCards!.cards!.hands[f.holder], f.nexusCard);
    assert.equal(viewGame(passed, f.atreides).nexusBorrowedVoice, null);
    const second = offer(passed, f.holder);
    assert.equal(second.owner, f.holder);
    assert.equal(second.target, f.atreides);
    assert.equal(second.canUse, true, 'The actual holder may use the physical card once');
    assert.ok(!second.blocked, 'The eligible holder has no queue blockage');
    assert.equal(preparation(passed, f.holder)!.owner, f.holder);
    // Only one ordered opportunity each: the answered seat cannot speak again.
    reject(passed, f.atreides, { type: 'nexusBorrowedVoice', event: second.event, use: false });
    reject(passed, f.holder, { type: 'nexusBorrowedVoice', event: second.event, use: true,
      kind: f.targetKind });
    assert.equal(frame(passed).passed.length, 1, 'A malformed declaration never consumes the opportunity');
    nexusBorrowedVoiceInventory(passed);
  });

  void test(`${band} absent-Bene-Gesserit Nexus accepts only the eligible holder declaration and spends the physical card`, () => {
    const f = fixture(advanced);
    const game = reload(f.game);
    const nexusDiscard = [...game.nexusCards!.cards!.discard];
    const hands = Object.fromEntries(game.players.map(seat => [seat.id, seat.hand.map(card => card.id)]));
    const declared = declareStep(game, f, true);
    const record = frame(declared);
    assert.equal(record.stage, 'declared');
    assert.equal(record.owner, f.holder);
    assert.deepEqual(record.voice, { target: f.atreides, kind: f.targetKind, must: true });
    assert.deepEqual(declared.battle!.voice, { target: f.atreides, kind: f.targetKind, must: true });
    assert.equal(declared.battle!.revealed, false);
    assert.equal(declared.battle!.plans[f.atreides], undefined);
    assert.equal(declared.nexusCards!.cards!.hands[f.holder], null,
      'The declaration spends the physical Bene Gesserit Nexus card');
    assert.deepEqual(declared.nexusCards!.cards!.discard, [...nexusDiscard, f.nexusCard]);
    assert.equal(declared.response?.kind, 'voice');
    assert.equal(declared.response?.owner, f.holder, 'The original Voice response opens for the declaring seat');
    assert.equal(viewGame(declared, f.holder).nexusBorrowedVoice, null, 'The queue closes for good');
    assert.equal(viewGame(declared, f.atreides).nexusBorrowedVoice, null);
    // No second declaration, no re-deal and no extra spend.
    const handMap = (state: Game) => Object.fromEntries(
      state.players.map(seat => [seat.id, seat.hand.map(card => card.id)]));
    const before = handMap(declared);
    reject(declared, f.holder, { type: 'nexusBorrowedVoice', event: record.event, use: true, kind: f.targetKind, must: true });
    reject(declared, f.holder, { type: 'nexusBorrowedVoice', event: record.event, use: false });
    reject(declared, f.atreides, { type: 'nexusBorrowedVoice', event: record.event, use: true, kind: f.targetKind, must: true });
    assert.deepEqual(handMap(declared), before);
    assert.deepEqual(before, hands, 'The declaration spends the Nexus card, not a Treachery card');
    // The original Voice window settles normally and the command survives into Prescience.
    const settled = settledWindow(declared);
    assert.equal(frame(settled).stage, 'active');
    assert.deepEqual(settled.battle!.voice, { target: f.atreides, kind: f.targetKind, must: true });
    assert.equal(settled.response, null);
    const preparationAfter = preparation(settled, f.atreides)!;
    assert.equal(preparationAfter.kind, 'prescience', 'The original preparation continues under the command');
    assert.equal(preparationAfter.owner, f.atreides, 'The native first inspection belongs to the seated Atreides seat');
    const next = nextStrongholdFactionsNativeStep(settled);
    assert.ok(next);
    assert.equal(next.actor, f.atreides);
    nexusBorrowedVoiceInventory(settled);
  });

  void test(`${band} absent-Bene-Gesserit Nexus: all-pass leaves the hidden card unspent and continues the original preparation`, () => {
    const f = fixture(advanced);
    const game = reload(f.game);
    const record = frame(game);
    const first = applyAction(game, f.atreides,
      { type: 'nexusBorrowedVoice', event: record.event, use: false });
    const answered = applyAction(first, f.holder,
      { type: 'nexusBorrowedVoice', event: frame(first).event, use: false });
    const after = frame(answered);
    assert.equal(after.stage, 'passed');
    assert.deepEqual(after.passed, [f.atreides, f.holder]);
    assert.equal(after.owner, null);
    assert.equal(after.voice, null);
    assert.equal(answered.battle!.voice, undefined, 'All-pass never declares a command');
    assert.equal(answered.response, null, 'All-pass opens no Voice response');
    assert.equal(answered.nexusCards!.cards!.hands[f.holder], f.nexusCard,
      'All-pass keeps the physical Nexus card in hand');
    assert.deepEqual(answered.nexusCards!.cards!.discard, game.nexusCards!.cards!.discard);
    const preparationAfter = preparation(answered, f.atreides)!;
    assert.equal(preparationAfter.kind, 'prescience', 'All-pass resumes the original preparation');
    assert.equal(preparationAfter.owner, f.atreides);
    assert.equal(frame(answered).order[0], f.atreides);
    const next = nextStrongholdFactionsNativeStep(answered);
    assert.ok(next, 'The original continuation must not stall on a passed queue');
    assert.equal(next.actor, f.atreides);
    assert.equal(next.action.type, 'declineBattlePower');
    // The answered queue stays settled: no reopen, no late command, no spend.
    reject(answered, f.holder, { type: 'nexusBorrowedVoice', event: after.event, use: false });
    reject(answered, f.holder, { type: 'nexusBorrowedVoice', event: after.event, use: true,
      kind: f.targetKind, must: true });
    assert.equal(answered.nexusCards!.cards!.hands[f.holder], f.nexusCard);
    nexusBorrowedVoiceInventory(answered);
  });

  void test(`${band} absent-Bene-Gesserit Nexus: a real auctioned Karama cancels only the Voice and leaves the Nexus card spent`, () => {
    const f = fixture(advanced);
    const declared = declareStep(reload(f.game), f, true);
    const nexusBefore = structuredClone(declared.nexusCards!.cards!);
    const voice = structuredClone(declared.battle!.voice);
    const preparationBefore = structuredClone(preparation(declared, f.atreides));
    const karama = player(declared, f.canceler).hand.find(card => card.id === f.cancelerCard);
    assert.ok(karama && karama.effect === 'karama',
      'The real first-auction Karama must still be in the allied seat hand');
    assert.notEqual(f.canceler, declared.response!.owner);
    const canceled = applyAction(declared, f.canceler,
      { type: 'card', mode: 'cancel', card: karama.id });
    assert.equal(canceled.battle!.voice, undefined, 'Cancellation removes only the Voice');
    assert.deepEqual(preparation(canceled, f.atreides), preparationBefore,
      'The original preparation survives cancellation');
    assert.equal(canceled.nexusCards!.cards!.hands[f.holder], null,
      'The spent Nexus card is not returned to the holder');
    assert.deepEqual(canceled.nexusCards!.cards!.discard, nexusBefore.discard,
      'The Nexus card stays spent through cancellation');
    assert.equal(frame(canceled).stage, 'canceled');
    assert.deepEqual(frame(canceled).voice, voice, 'A canceled command remains a receipt');
    assert.equal(canceled.discard.some(card => card.id === karama.id), true, 'The Karama is spent');
    assert.equal(canceled.response, null);
    assert.equal(viewGame(canceled, f.holder).nexusBorrowedVoice, null);
    assert.equal(viewGame(canceled, f.atreides).nexusBorrowedVoice, null);
    const next = nextStrongholdFactionsNativeStep(canceled);
    assert.ok(next, 'The canceled declaration must not stall the original continuation');
    assert.equal(next.actor, f.atreides);
    assert.equal(preparation(canceled, f.atreides)!.kind, 'prescience');
    nexusBorrowedVoiceInventory(canceled);
  });

  void test(`${band} absent-Bene-Gesserit Nexus: the command binds the target's original plan and never the declarer's`, () => {
    const f = fixture(advanced);
    const must = settledWindow(declareStep(reload(f.game), f, true));
    const state = declinePreparation(must, f.atreides);
    assert.equal(state.battle!.preparation, undefined);
    assert.deepEqual(state.battle!.voice, { target: f.atreides, kind: f.targetKind, must: true });
    reject(state, f.atreides, plan(state, f.atreides, null), /Voice/);
    const compliant = applyAction(state, f.atreides, plan(state, f.atreides, f.targetCard));
    assert.equal(compliant.battle!.plans[f.atreides].weapon, f.targetCard);
    // The declarer carries no obligation of its own Voice.
    const declared = applyAction(compliant, f.holder, plan(compliant, f.holder, null));
    assert.equal(declared.battle!.plans[f.holder].weapon, null);

    const forbid = settledWindow(declareStep(reload(f.game), f, false));
    const forbidding = declinePreparation(forbid, f.atreides);
    reject(forbidding, f.atreides, plan(forbidding, f.atreides, f.targetCard), /Voice/);
    const free = applyAction(forbidding, f.atreides, plan(forbidding, f.atreides, null));
    assert.equal(free.battle!.plans[f.atreides].weapon, null);

    // A public category the target cannot supply is not an impossible command.
    const absent = settledWindow(declareStep(reload(f.game), f, true, f.absentKind));
    assert.deepEqual(absent.battle!.voice,
      { target: f.atreides, kind: f.absentKind, must: true });
    const unstoppable = applyAction(declinePreparation(absent, f.atreides),
      f.atreides, plan(absent, f.atreides, null));
    assert.equal(unstoppable.battle!.plans[f.atreides].weapon, null);
    assert.equal(player(absent, f.atreides).hand.some(card => defaultVoiceMatch(card, f.absentKind)), false);
  });

  void test(`${band} absent-Bene-Gesserit Nexus: native Prescience and the extra Nexus inspection wait for the queue`, () => {
    const f = fixture(advanced);
    const game = reload(f.game);
    reject(game, f.atreides, { type: 'prescience', field: 'weapon' });
    reject(game, f.atreides, { type: 'declineBattlePower' });
    reject(game, f.atreides, { type: 'battlePlan', leader: player(game, f.atreides).leaders[0].id,
      dial: 0, support: 0, weapon: null, defense: null });
    const inspection = viewGame(game, f.atreides).nexusAtreides;
    assert.ok(inspection, 'The seated Atreides seat also holds the physical Atreides Nexus card');
    assert.ok(inspection.blocked, 'The extra inspection stays blocked before the first native inspection');
    reject(game, f.atreides, { type: 'nexusAtreides', event: inspection.event,
      mode: inspection.mode, field: 'weapon' });
    assert.equal(preparation(game, f.atreides)!.kind, 'nexusVoice');
    nexusBorrowedVoiceInventory(game);
  });

  void test(`${band} absent-Bene-Gesserit Nexus: all four native policies answer the queue legally`, () => {
    const f = fixture(advanced);
    for (const difficulty of DIFFICULTIES) {
      const neutralStage = reload(f.game);
      const neutralPolicy = policy(neutralStage, f.atreides, difficulty);
      const pass = neutralPolicy.find(action => action.type === 'nexusBorrowedVoice');
      assert.ok(pass, `${difficulty} must answer the borrowed-Voice queue`);
      assert.equal(pass.use, false, 'The cardless combatant can only continue');
      const passed = applyAction(neutralStage, f.atreides, pass);
      assert.deepEqual(frame(passed).passed, [f.atreides]);
      const holderPolicy = policy(passed, f.holder, difficulty);
      const answer = holderPolicy.find(action => action.type === 'nexusBorrowedVoice');
      assert.ok(answer, `${difficulty} must answer the holder opportunity`);
      const done = applyAction(passed, f.holder, answer);
      if (answer.use === true) {
        assert.equal(frame(done).stage, 'declared');
        assert.equal(done.nexusCards!.cards!.hands[f.holder], null,
          'A policy use spends the same physical card');
      } else {
        assert.equal(frame(done).stage, 'passed');
        assert.equal(done.nexusCards!.cards!.hands[f.holder], f.nexusCard);
      }
      nexusBorrowedVoiceInventory(done);
    }
  });
}

