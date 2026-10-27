import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { actTruthBid as act, advanceTruthBid as advance,
  truthBidClean as clean, truthBidInventory as inventory } from './fixture-truth-bid';
import { bindTruthTurnBid, createTruthTurnBidFixture } from './fixture-truth-turn-bid';

/** Original H/A/E public Basic or Advanced setup, actual starting deal and
 * native play through Charity. Only unopened starting deal/Spice positions
 * and the native scalar lotteries are selected by the shared fixture. */
function early(advanced: boolean) {
  const f = createTruthTurnBidFixture({ advanced });
  let game = structuredClone(f.afterSetup);
  for (const { position, from, card } of f.spiceOrder) {
    const [selected] = game.spiceDeck.splice(from, 1);
    assert.deepEqual(selected, card); game.spiceDeck.splice(position, 0, selected);
  }
  game = advance(game, state => state.turn === 1 && state.phase === 2 && clean(state));
  return { f, game };
}

function askSecond(game: Game, asker: string, card: string, question: object): Game {
  game = act(game, asker, { type: 'card', card });
  for (let count = 0; game.truthtrance?.stage === 'priority' && count < game.players.length; count++) {
    const player = game.players.find(seat => !game.truthtrance!.passed.includes(seat.id)); assert.ok(player);
    game = act(game, player.id, { type: 'truthPass' });
  }
  assert.equal(game.truthtrance?.stage, 'ask');
  return act(game, asker, { type: 'truthAsk', question });
}

/** Every answer projected to the respondent must be accepted and leave the
 * original phase promise usable; unknown creates no new binding obligation. */
function acceptEach(asked: Game, answers: readonly string[] | null, target: string, asker: string,
  prior: NonNullable<Game['phaseBidPromises']>[number], originalCards: string[]) {
  assert.ok(answers?.length, 'The open Truthtrance must offer a usable response');
  for (const answer of answers) {
    assert.ok(['yes', 'no', 'unknown'].includes(answer));
    let game = act(asked, target, { type: 'truthAnswer', answer });
    if (answer === 'unknown') {
      assert.equal(game.truthtrance?.stage, 'unknown');
      game = act(game, asker, { type: 'truthSave' });
    }
    assert.equal(game.truthtrance, null, `${answer} must have a usable continuation`);
    assert.deepEqual(game.phaseBidPromises![0], prior);
    game = advance(game, state => clean(state) && state.phase === 3 && state.auction?.active === target);
    game = act(game, target, { type: 'bid', amount: 4, allyPayment: 0 });
    assert.ok(game.phaseBidPromises?.some(row => row.player === target && row.fulfilled));
    assert.deepEqual(inventory(game), originalCards);
  }
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} displayed movement answers can be accepted alongside a pre-Bidding phase bid Yes`, () => {
    const { f, game: source } = early(advanced);
    let game = bindTruthTurnBid(f, 'yes', 4, source).game;
    const prior = structuredClone(game.phaseBidPromises![0]);
    game = askSecond(game, f.asker, f.truths[1],
      { kind: 'movement', target: f.target, territory: 'carthag', minimum: 1 });
    const answers = viewGame(game, f.target).truthMovementAnswers;
    assert.ok(answers?.includes('no'), 'An empty movement obligation does not spend the bid funds');
    acceptEach(game, answers, f.target, f.asker, prior, f.originalCards);
  });

  void test(`${mode} displayed shipment answers can be accepted alongside a pre-Bidding phase bid Yes`, () => {
    const { f, game: source } = early(advanced);
    let game = bindTruthTurnBid(f, 'yes', 4, source).game;
    const prior = structuredClone(game.phaseBidPromises![0]);
    game = askSecond(game, f.asker, f.truths[1],
      { kind: 'shipment', target: f.target, territory: 'carthag', minimum: 1 });
    acceptEach(game, viewGame(game, f.target).truthShipmentAnswers, f.target, f.asker, prior, f.originalCards);
  });

  void test(`${mode} displayed revival answers can be accepted alongside a pre-Bidding phase bid Yes`, () => {
    const { f, game: source } = early(advanced);
    // Controlled physical supplement: move one existing Emperor reserve force
    // into its Tanks; no spice, card, phase or promise is installed.
    const target = source.players.find(row => row.id === f.target)!;
    target.reserves -= 1; target.tanks += 1;
    let game = bindTruthTurnBid(f, 'yes', 4, source).game;
    const prior = structuredClone(game.phaseBidPromises![0]);
    game = askSecond(game, f.asker, f.truths[1],
      { kind: 'revival', target: f.target, turn: game.turn, counter: 'total', minimum: 1 });
    acceptEach(game, viewGame(game, f.target).truthRevivalAnswers, f.target, f.asker, prior, f.originalCards);
  });
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  void test(`${mode} an external debit releases only the phase bid made impossible by a funded independent bribe`, () => {
    const { f, game: source } = early(advanced);
    assert.equal(source.players.find(row => row.id === f.target)!.spice, 10);
    let game = bindTruthTurnBid(f, 'yes', 8, source).game;
    game = askSecond(game, f.asker, f.truths[1], { kind: 'bribe', target: f.target,
      turn: game.turn, recipient: f.asker, minimum: 2 });
    assert.ok(viewGame(game, f.target).truthBribeAnswers?.includes('yes'));
    game = act(game, f.target, { type: 'truthAnswer', answer: 'yes' });
    assert.equal(game.truthtrance, null);
    assert.ok(game.bribePromises?.some(row => row.player === f.target && row.answer && !row.released));
    // Controlled external-loss supplement: transfer one conserved existing
    // spice from the respondent to the asker; no cards or commitments change.
    // After the two-spice obligation, at most seven remains for the bid.
    const harmed = structuredClone(game);
    harmed.players.find(row => row.id === f.target)!.spice -= 1;
    harmed.players.find(row => row.id === f.asker)!.spice += 1;
    const settled = normalizeAutomaticGame(harmed);
    const phase = settled.phaseBidPromises?.find(row => row.player === f.target && row.minimum === 8);
    assert.ok(phase?.released, 'An evaluated two-spice payment leaves no funded bid of eight');
    assert.ok(settled.bribePromises?.some(row => row.player === f.target && row.answer && !row.released));
    assert.equal(settled.players.find(row => row.id === f.target)!.spice, 9);
    assert.deepEqual(inventory(settled), f.originalCards);
  });
}
