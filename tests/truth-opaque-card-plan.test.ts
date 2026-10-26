import assert from 'node:assert/strict';
import test from 'node:test';
import { baseDeck } from '../game/cards';
import { viewGame, type Game } from '../game/engine';
import { createDistransPrebidFixture } from './fixture-distrans-prebid';
import {
  askTruthTurnCombat as ask,
  createTruthTurnCombatFixture as fixture,
  declareTruthTurnCombat as declare,
  truthTurnCombatGroup as group,
  truthTurnCombatInventory as inventory,
  truthTurnCombatPlan as plan,
  truthTurnCombatPlayer as player,
  truthTurnCombatTraitors as traitors,
  type TruthTurnCombatFixture,
} from './fixture-truth-turn-combat';

type OpaqueQuote = Game & { _turnActionUnknownCards: string[] };

/** Detached-forecast-only metadata supplement. The fixture's card was really
 * acquired and is physically held; this marker models an opaque future card
 * only for read-only quotation. It is never installed by a gameplay action. */
function opaqueQuote(source: Game, card: string): OpaqueQuote {
  return Object.assign(structuredClone(source), { _turnActionUnknownCards: [card] });
}

function originalWeapon(f: TruthTurnCombatFixture) {
  assert.ok(f.ordinary);
  assert.equal(f.game.battle!.plans[f.target], undefined);
  const held = player(f.game, f.target).hand.find(card => card.id === f.ordinary);
  assert.ok(held);
  const canonical = baseDeck().find(card => card.id === held.id);
  assert.ok(canonical);
  assert.equal(canonical.kind, 'projectile');
  assert.deepEqual(held, canonical);
  assert.equal(f.sourceActions.length, f.sourceActionCount);
  assert.equal(Object.hasOwn(f.game, '_turnActionUnknownCards'), false);
  return held.id;
}

function physical(source: Game, f: TruthTurnCombatFixture) {
  assert.deepEqual(inventory(source), f.originalCards);
  assert.deepEqual(traitors(source), f.originalTraitors);
  assert.equal(inventory(source).length, 33);
}

void test('detached opaque forecast cannot fund a whole positive weapon-plan quote with the same physically held canonical card', () => {
  const f = fixture(), card = originalWeapon(f), original = structuredClone(f.game);
  const mixed = plan(f.event, f.territory, f.weaponClaim);
  const asked = ask(declare(f).game, f.asker, f.target, mixed), before = structuredClone(asked);
  assert.deepEqual(viewGame(asked, f.target).truthTurnActionAnswers, ['yes', 'no']);

  const opaque = opaqueQuote(asked, card), quoteBefore = structuredClone(opaque);
  assert.ok(player(opaque, f.target).hand.some(held => held.id === card));
  const opaqueView = viewGame(opaque, f.target);
  assert.deepEqual(opaqueView.truthTurnActionAnswers, ['no']);
  assert.equal(Object.hasOwn(opaqueView, '_turnActionUnknownCards'), false);
  assert.deepEqual(opaque, quoteBefore);
  assert.deepEqual(asked, before);
  assert.deepEqual(f.game, original);
  assert.equal(Object.hasOwn(asked, '_turnActionUnknownCards'), false);
  physical(asked, f); physical(opaque, f); physical(f.game, f);
});

void test('detached opaque weapon forecast retains an independent positive dial-plan alternative and whole No', () => {
  const f = fixture(), card = originalWeapon(f), original = structuredClone(f.game);
  const mixed = group('or', plan(f.event, f.territory, f.weaponClaim),
    plan(f.event, f.territory, { kind: 'dial', compare: 'gte', value: 1 }));
  const asked = ask(declare(f).game, f.asker, f.target, mixed), before = structuredClone(asked);
  const known = viewGame(asked, f.target).truthTurnActionAnswers;
  assert.ok(known?.includes('yes'));
  assert.ok(known?.includes('no'), 'An unarmed zero-dial plan satisfies the whole No');

  const opaque = opaqueQuote(asked, card), quoteBefore = structuredClone(opaque);
  const answers = viewGame(opaque, f.target).truthTurnActionAnswers;
  assert.ok(answers?.includes('yes'), 'The positive-dial branch does not borrow the opaque weapon');
  assert.ok(answers?.includes('no'), 'An unarmed zero-dial plan remains legal with the opaque card held');
  assert.deepEqual(opaque, quoteBefore);
  assert.deepEqual(asked, before);
  assert.deepEqual(f.game, original);
  assert.equal(Object.hasOwn(asked, '_turnActionUnknownCards'), false);
  physical(asked, f); physical(opaque, f); physical(f.game, f);
});

void test('detached opaque acquisition supplies generic Distrans transfer, but cannot activate Distrans itself', () => {
  const f = createDistransPrebidFixture(), original = structuredClone(f.game);
  const recipient = f.action.target as string, given = f.action.give as string;
  assert.ok(viewGame(f.game, f.holder).distrans?.choices.some(choice =>
    choice.recipient === recipient && choice.cards.some(card => card.id === given)));
  const opaque = opaqueQuote(f.game, given), before = structuredClone(opaque);
  assert.ok(viewGame(opaque, f.holder).distrans?.choices.some(choice =>
    choice.recipient === recipient && choice.cards.some(card => card.id === given)),
  'A generic other-card transfer does not require an unseen specific effect');
  assert.deepEqual(opaque, before);
  const unknownRole = opaqueQuote(f.game, f.card);
  assert.match(viewGame(unknownRole, f.holder).distrans?.blocked ?? '', /unseen future acquired card/i);
  assert.deepEqual(f.game, original);
  assert.equal(Object.hasOwn(f.game, '_turnActionUnknownCards'), false);
});
