import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { TruthQuestion } from '../game/truthtrance';
import { createKullBribeFixture, act, advance, clean, inventory, player } from './fixture-kull-bribe';
import { beforeIxSpiceDraw, orderIxSpiceCards } from './fixture-ix-spice-cards';
import { nextKullPurposeStep } from './fixture-kull-purpose';

// The unopened physical cards are ordered by the inherited fixture; only a later
// unopened worm and replacement are selected here. No ally or promise is staged.
function source() {
  const f = createKullBribeFixture();
  let game = advance(structuredClone(f.game), g => g.turn === 2 && beforeIxSpiceDraw(g));
  orderIxSpiceCards(game, ['worm', 'land']);
  game = advance(game, g => g.phase === 1 && g.nexus && clean(g) && !g.spiceWindow && !g.spiceResolution);
  game = act(game, f.counterOwner, { type: 'alliance', target: f.actor });
  return { f, game };
}
function close(game: Game): Game {
  for (let i = 0; i < 300 && game.nexus; i++) {
    const guide = game.players.map(p => ({ p, guide: viewGame(game, p.id).alliancePromiseGuide }))
      .find(row => row.guide);
    const step = guide ? { actor: guide.p.id, action: guide.guide!.action } : nextKullPurposeStep(game);
    assert.ok(step, 'Native Nexus has a legal continuation');
    game = act(game, step.actor, step.action);
  }
  assert.equal(game.nexus, false); return game;
}
for (const kind of ['alliance', 'allianceExpression', 'mixedAlliance'] as const) {
  void test(`printed Kull Basic game resolves native ${kind} Truthtrance in the ordinary worm Nexus`, () => {
    const { f, game: original } = source(); let game = original;
    game = act(game, f.asker, { type: 'card', card: f.truth });
    for (let i = 0; game.truthtrance?.stage === 'priority' && i < game.players.length; i++) {
      const seat = game.players.find(p => !game.truthtrance!.passed.includes(p.id)); assert.ok(seat);
      game = act(game, seat.id, { type: 'truthPass' });
    }
    const question: TruthQuestion = kind === 'alliance'
      ? { kind, target: f.actor, turn: game.turn, partner: f.counterOwner }
      : kind === 'allianceExpression'
        ? { kind, target: f.actor, turn: game.turn, claim: { kind: 'partner', partner: f.counterOwner } }
        : { kind, target: f.actor, turn: game.turn, mixed: { kind: 'and', terms: [
          { kind: 'fact', fact: { kind: 'spice', compare: 'gte', value: 0 } },
          { kind: 'action', action: { partner: f.counterOwner } },
        ] } };
    game = act(game, f.asker, { type: 'truthAsk', question });
    game = act(game, f.actor, { type: 'truthAnswer', answer: 'yes' });
    const guide = viewGame(game, f.actor).alliancePromiseGuide; assert.ok(guide);
    assert.equal(guide.action.type, 'alliance'); assert.equal(guide.action.target, f.counterOwner);
    const bot = viewGame(game, f.actor); bot.players.find(p => p.id === f.actor)!.bot = 'Easy';
    const botAlliance = botActions(bot).find(action => action.alliancePromiseEvent === guide.action.alliancePromiseEvent); assert.ok(botAlliance);
    assert.equal(player(act(structuredClone(game), f.actor, botAlliance), f.actor).ally, f.counterOwner);
    game = act(game, f.actor, guide.action);
    assert.equal(player(game, f.actor).ally, f.counterOwner);
    game = close(game);
    const view = viewGame(game, f.actor);
    const rows = kind === 'alliance' ? view.alliancePromises : kind === 'allianceExpression'
      ? view.allianceExpressionPromises : view.mixedAlliancePromises;
    assert.ok(rows.some(row => row.fulfilled));
    assert.equal(game.discard.filter(card => card.id === f.truth).length, 1);
    assert.ok(player(game, f.reactor).hand.some(card => card.id === f.kull));
    assert.deepEqual(inventory(game), f.originalCards);
  });
}
