import test from 'node:test';
import assert from 'node:assert/strict';
import { botActions } from '../game/bots';
import { viewGame, type Game } from '../game/engine';
import { spiceDeck } from '../game/cards';
import { actIxSpice, advanceIxSpice, ixSpiceClean, ixSpicePlayer as player,
  runIxSpiceProgramme, type IxSpiceProgramme } from './fixture-ix-spice-cards';

const cardStock = (game: Game) => [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)]
  .map(card => card.id).sort();
function physicalSpice(game: Game) {
  return [...game.spiceDeck, ...game.spiceDiscard.flat(), ...(game.spiceSequence?.skipped ?? [])]
    .filter(card => !('worm' in card && card.thumper));
}

for (const advanced of [false, true]) for (const mode of [
  'first-thumper', 'normal-thumper', 'first-trout-worm', 'double-harvester', 'waiting-thumper', 'replacement-worm',
] as IxSpiceProgramme[]) void test(`genuine ${advanced ? 'Advanced' : 'Basic'} Ix Spice ${mode} follows the selected source policy through the actual phase`, () => {
  const done = runIxSpiceProgramme(mode, advanced), f = done.source;
  assert.equal(f.game.advanced, advanced); assert.deepEqual(f.game.expansions, ['ix']);
  assert.ok(f.actions.some(step => step.action.type === 'start'));
  assert.ok(f.beforeStartingDeal.players.every(player => player.hand.length === 0));
  assert.deepEqual(f.beforeStartingDeal.deck.slice(0, 4).map(card => card.id), f.startingDeal);
  assert.ok(player(f.afterSetup).hand.some(card => card.id === f.thumper));
  assert.ok(player(f.afterSetup, 'harkonnen').hand.some(card => card.id === f.harvesters.harkonnen));
  assert.ok(player(f.afterSetup, 'fremen').hand.some(card => card.id === f.harvesters.fremen));
  const land = done.prefix.find(row => 'territory' in row.card)!.card; assert.ok('territory' in land);
  const amount = land.amount * (mode === 'waiting-thumper' ? 2 : 1);
  assert.equal(done.revealed.spiceWindow!.territory, land.territory);
  assert.equal(done.revealed.spiceWindow!.amount, amount);
  assert.equal(done.revealed.nexus, mode === 'normal-thumper' || mode === 'replacement-worm');
  assert.equal(done.game.phase, 2);
  assert.equal(done.game.sandtrout, mode === 'first-trout-worm');
  assert.deepEqual(cardStock(done.game), f.originalTreachery);
  const physical = physicalSpice(done.game);
  assert.equal(physical.filter(card => 'worm' in card).length, 6);
  assert.equal(physical.filter(card => 'territory' in card).length, 15);
  assert.equal(physical.filter(card => 'sandtrout' in card).length + (done.game.sandtrout ? 1 : 0), 1);
  assert.equal(physical.length + (done.game.sandtrout ? 1 : 0), spiceDeck(true).length);
  assert.equal(done.game.discard.filter(card => card.id === f.thumper).length, done.usesThumper ? 1 : 0);
  if (mode === 'first-thumper') {
    assert.ok(done.game.log.some(entry => /first-turn worm rule ignores this Thumper/.test(entry.text)));
    assert.equal(done.game.spiceDiscard.flat().some(card => 'worm' in card && card.thumper), false);
  }
  if (mode === 'first-trout-worm')
    assert.ok(done.game.log.some(entry => /first-turn worm rule leaves Sandtrout waiting/.test(entry.text)));
  if (done.waitingSource) {
    assert.equal(done.waitingSource.sandtrout, true);
    assert.equal(done.before.turn, 2); assert.equal(done.before.sandtrout, true);
  }
  if (done.secondHarvester) {
    assert.equal(done.firstHarvester!.spiceWindow!.amount, amount * 2);
    assert.deepEqual(done.passed!.ready, ['atreides']);
    assert.deepEqual(done.secondHarvester.ready, []);
    assert.equal(done.secondHarvester.spiceWindow!.amount, amount * 4);
    assert.equal(done.secondHarvester.spiceWindow!.harvesters, 2);
    for (const [actor, card] of Object.entries(f.harvesters)) {
      assert.equal(done.game.discard.filter(held => held.id === card).length, 1);
      assert.equal(player(done.game, actor).hand.some(held => held.id === card), false);
    }
  }
});

void test('all four minimal profiles accept an actual harvested source window with a legal native continuation', () => {
  const done = runIxSpiceProgramme('double-harvester', true), original = done.secondHarvester!;
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const view = viewGame(original, 'fremen'); view.players.find(player => player.id === 'fremen')!.bot = difficulty;
    const action = botActions(view)[0]; assert.deepEqual(action, { type: 'ready' });
    let game = actIxSpice(original, 'fremen', action);
    game = advanceIxSpice(game, game => game.phase === 2 && ixSpiceClean(game));
    assert.equal(game.phase, 2); assert.deepEqual(cardStock(game), done.source.originalTreachery);
  }
});
