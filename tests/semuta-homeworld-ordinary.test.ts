import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import {
  createSemutaHomeworldBoxFixture, createSemutaHomeworldOrdinaryFixture,
  reactSemutaHomeworldBox, reactSemutaHomeworldOrdinary,
  semutaHomeworldOrdinaryState,
} from './fixture-semuta-homeworld-ordinary';

for (const claim of [false, true]) void test(
  `Homeworld ordinary special play Semuta ${claim ? 'claims' : 'passes'} the used card without disturbing occupation`, () => {
    const f = createSemutaHomeworldOrdinaryFixture();
    assert.equal(f.game.phase, 5);
    assert.equal(f.game.active, 'a');
    assert.ok(semutaEmperorPlayer(f.game, f.holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
    const played = applyAction(f.game, 'a', f.action);
    const pending = played.pendingTreacheryDiscard;
    assert.ok(pending, 'The used ordinary special must offer its printed Semuta cost');
    assert.equal(pending.batch.cause, 'ordinary:hajr');
    assert.deepEqual(pending.batch.entries.map(entry => ({
      id: entry.card.id, by: entry.discardedBy, face: entry.publicFace,
    })), [{ id: f.hajr, by: 'a', face: true }]);
    assert.equal(pending.reaction?.stage, 'offer');
    assert.deepEqual(played.hajr, ['a'], 'The Hajr movement grant already committed');
    assert.equal(played.discard.filter(card => card.id === f.hajr).length, 1);
    for (const player of played.players) viewGame(played, player.id);
    const before = semutaHomeworldOrdinaryState(played);
    const event = pending.batch.event;
    assert.throws(() => applyAction(played, f.owner, { type: 'semutaCommit', event }));
    assert.throws(() => applyAction(played, f.holder, { type: 'semutaSelect', event, card: f.hajr }));
    const done = reactSemutaHomeworldOrdinary(played, f, claim);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.equal(done.resolvedTreacheryDiscardSequence, pending.sequence);
    const holder = semutaEmperorPlayer(done, f.holder);
    assert.equal(holder.hand.some(card => card.id === f.hajr), claim);
    assert.equal(holder.hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
    assert.equal(done.discard.filter(card => card.id === f.hajr).length, Number(!claim));
    assert.equal(done.discard.filter(card => card.id === SEMUTA_DRUG_ID).length, Number(claim));
    assert.deepEqual(semutaHomeworldOrdinaryState(done), before,
      'Claiming the used card cannot move wallets, custody or occupation authority');
    assert.deepEqual(done.hajr, ['a']);
    assert.throws(() => applyAction(done, 'a', f.action), 'The used card cannot be played again');
    assert.throws(() => applyAction(done, f.holder, { type: 'semutaCommit', event }));
    const suffix = applyAction(done, 'a', { type: 'endMovement' });
    assert.ok(!suffix.movementRemaining?.includes('a'));
    assert.equal(suffix.phase, 5);
    assert.deepEqual(semutaHomeworldOrdinaryState(suffix), before);
  },
);

for (const claim of [false, true]) void test(
  `Homeworld paid Nullentropy Box Semuta ${claim ? 'claims' : 'passes'} the used Box after its real search`, () => {
    const f = createSemutaHomeworldBoxFixture();
    const searched = applyAction(f.game, f.owner, f.action);
    const pending = searched.pendingTreacheryDiscard;
    assert.ok(pending, 'The completed paid Box search must offer its printed Semuta cost');
    assert.equal(pending.batch.cause, 'nullentropyBox');
    assert.deepEqual(pending.batch.entries.map(entry => ({
      id: entry.card.id, by: entry.discardedBy, face: entry.publicFace,
    })), [{ id: f.box, by: f.owner, face: true }]);
    assert.equal(searched.discard.at(-1)?.id, f.box, 'The used Box stays on top of the shuffled pile');
    assert.equal(semutaEmperorPlayer(searched, f.owner).spice,
      semutaEmperorPlayer(f.game, f.owner).spice - f.cost);
    for (const player of searched.players) viewGame(searched, player.id);
    const before = semutaHomeworldOrdinaryState(searched);
    const event = pending.batch.event;
    assert.throws(() => applyAction(searched, f.holder, { type: 'semutaSelect', event, card: f.box }));
    const done = reactSemutaHomeworldBox(searched, f, claim);
    assert.equal(done.pendingTreacheryDiscard, null);
    assert.equal(done.resolvedTreacheryDiscardSequence, pending.sequence);
    const holder = semutaEmperorPlayer(done, f.holder);
    assert.equal(holder.hand.some(card => card.id === f.box), claim);
    assert.equal(holder.hand.some(card => card.id === SEMUTA_DRUG_ID), !claim);
    assert.equal(done.discard.some(card => card.id === f.box), !claim);
    assert.deepEqual(semutaHomeworldOrdinaryState(done), before,
      'The two-spice payment, searched card and occupation authority are unchanged');
    assert.throws(() => applyAction(done, f.owner, f.action));
    const suffix = applyAction(done, f.owner, { type: 'endMovement' });
    assert.ok(!suffix.movementRemaining?.includes(f.owner));
    assert.equal(suffix.phase, 5);
  },
);

for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) void test(
  `the ${difficulty} bot settles the Homeworld paid-Box Semuta cost`, () => {
    const f = createSemutaHomeworldBoxFixture();
    const searched = applyAction(f.game, f.owner, f.action);
    const view = viewGame(searched, f.holder);
    view.players.find(player => player.id === f.holder)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.ok(action);
    const done = applyAction(searched, f.holder, action);
    assert.equal(done.pendingTreacheryDiscard, null);
    const holder = done.players.find(player => player.id === f.holder)!;
    const claimed = holder.hand.some(card => card.id === f.box);
    assert.equal(claimed || done.discard.some(card => card.id === f.box), true);
    assert.equal(holder.hand.some(card => card.id === SEMUTA_DRUG_ID), !claimed);
    assert.equal(done.players.find(player => player.id === f.owner)!.spice,
      f.game.players.find(player => player.id === f.owner)!.spice - f.cost);
  },
);

void test('a full-hand Homeworld Richese exchanges Semuta for the used ordinary card', () => {
  const f = createSemutaHomeworldOrdinaryFixture();
  const holder = semutaEmperorPlayer(f.game, f.holder);
  holder.hand.push(...f.game.deck.splice(0, 4 - holder.hand.length));
  assert.equal(holder.hand.length, 4);
  const played = applyAction(f.game, 'a', f.action);
  const offer = viewGame(played, f.holder).semutaReaction!;
  assert.equal(offer.canCommit, true);
  assert.deepEqual(offer.candidates, []);
  const done = applyAction(played, f.holder, { type: 'semutaCommit', event: played.pendingTreacheryDiscard!.batch.event });
  assert.equal(semutaEmperorPlayer(done, f.holder).hand.length, 4);
  assert.ok(semutaEmperorPlayer(done, f.holder).hand.some(card => card.id === f.hajr));
});

for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) void test(
  `the ${difficulty} bot settles the Homeworld ordinary-card Semuta cost`, () => {
    const f = createSemutaHomeworldOrdinaryFixture();
    const played = applyAction(f.game, 'a', f.action);
    const view = viewGame(played, f.holder);
    view.players.find(player => player.id === f.holder)!.bot = difficulty;
    const action = botActions(view)[0];
    assert.ok(action);
    const done = applyAction(played, f.holder, action);
    assert.equal(done.pendingTreacheryDiscard, null);
    const holder = done.players.find(player => player.id === f.holder)!;
    const claimed = holder.hand.some(card => card.id === f.hajr);
    assert.equal(claimed || done.discard.some(card => card.id === f.hajr), true,
      'A legal bot either acquires the used card or leaves it discarded');
    assert.equal(holder.hand.some(card => card.id === SEMUTA_DRUG_ID), !claimed);
    assert.equal(done.hajr.includes('a'), true);
    assert.equal(holder.spice, f.game.players.find(player => player.id === f.holder)!.spice);
  },
);
