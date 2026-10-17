import assert from 'node:assert/strict';
import { applyAction, handLimit, type Action, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { createIndependentCardModulesFixture } from './fixture-independent-card-modules';
import { homeworldEcazClean, nextHomeworldEcazStep } from './fixture-homeworld-ecaz-occupy';
import {
  allowRicheseBureaucratResponses, richeseBureaucratCards, richeseBureaucratPlayer,
} from './fixture-bureaucrat-richese-funding';

/** Original Advanced setup and purchases, not a full-hand state injection.
 * Only the conserved, unopened turn-two worm is moved to the next Spice reveal. */
export function createRicheseFullHandSelfPurchaseGame(options: {
  skills?: boolean;
  emperor?: boolean;
  owner?: 'beneGesserit' | 'atreides' | 'emperor' | 'richese';
} = {}): Game {
  const emperor = options.emperor !== false, owner = options.owner ?? 'beneGesserit';
  const roster: FactionId[] = ['richese', 'atreides', 'beneGesserit', emperor ? 'emperor' : 'guild'];
  assert.ok(roster.includes(owner));
  const training: Partial<Record<FactionId, LeaderSkillId>> = {
    richese: 'smuggler', atreides: 'planetologist', beneGesserit: 'warmaster',
    [emperor ? 'emperor' : 'guild']: 'spice-banker', [owner]: 'bureaucrat',
  };
  if (owner === 'emperor') training.beneGesserit = 'spice-banker';
  let game = createIndependentCardModulesFixture({ advanced: true, factions: roster, expansions: ['choam'],
    skills: options.skills ?? true, training, independent: false, tech: false }).game;
  const stock = richeseBureaucratCards(game);
  assert.equal(stock.length, 45);
  assert.equal(new Set(stock).size, stock.length);
  const original = richeseBureaucratPlayer(game, 'richese').hand.map(c => c.id);
  assert.equal(original.length, 1);
  assert.equal(richeseBureaucratPlayer(game, 'richese').spice, 5);
  const act = (actor: string, action: Action) => { game = applyAction(game, actor, action); };
  const choose = (values: Record<string, unknown>) => act('richese',
    { type: 'decision', event: game.richeseBidding!.event, ...values } as Action);
  const next = () => {
    if (game.turn === 1 && !game.response && !game.phaseOpening) {
      if (game.decision?.kind === 'richeseBlackMarket') { choose({ decline: true }); return; }
      if (game.decision?.kind === 'richeseDeclaration') { choose({ position: 'first' }); return; }
      if (game.decision?.kind === 'richeseCache') {
        choose({ card: game.richeseCache![0].id, method: 'silent' }); return;
      }
      if (game.decision?.kind === 'auctionPayment') {
        act(game.decision.player, { type: 'decision', karama: false }); return;
      }
      if (!game.decision && game.richeseAuction && !game.richeseAuction.outcome) {
        const lot = game.richeseAuction;
        assert.equal(lot.source, 'cache');
        const actor = lot.order.find(id => !lot.acted.includes(id));
        assert.ok(actor);
        act(actor, { type: 'richeseBid', event: lot.event, amount: actor === 'richese' ? 1 : 0 });
        return;
      }
      if (!game.decision && game.auction) {
        const actor = game.auction.active;
        act(actor, actor === 'richese' && richeseBureaucratPlayer(game, actor).hand.length < 4
          ? { type: 'bid', amount: 1 } : { type: 'passBid' });
        return;
      }
    }
    if (game.phase === 5 && homeworldEcazClean(game)) act(game.active!, { type: 'endMovement' });
    else {
      const step = nextHomeworldEcazStep(game);
      assert.ok(step, `Missing original full-hand action at ${game.turn}/${game.phase}/${game.decision?.kind}`);
      act(step.actor, step.action);
    }
  };
  const reach = (until: (state: Game) => boolean) => {
    for (let n = 0; !until(game) && n < 800; n++) next();
    assert.ok(until(game), 'Reach the original full-hand purchase boundary');
  };
  act('atreides', { type: 'bribe', target: 'richese', amount: 4 });
  assert.equal(richeseBureaucratPlayer(game, 'richese').spice, 5, 'A promised bribe is not spendable');
  reach(g => g.phase === 3 && g.richeseBidding?.stage === 'normal' && homeworldEcazClean(g));
  assert.equal(game.richeseBidding!.position, 'first');
  assert.equal(richeseBureaucratPlayer(game, 'richese').hand.length, 2);
  assert.equal(richeseBureaucratPlayer(game, 'richese').spice, 4);
  reach(g => g.phase === 4 && homeworldEcazClean(g));
  const full = richeseBureaucratPlayer(game, 'richese');
  assert.equal(full.hand.length, handLimit(full));
  assert.equal(full.hand.length, 4);
  assert.equal(full.hand[0].id, original[0]);
  assert.equal(full.spice, 2, 'The cache and two ordinary acquisitions each cost one');
  reach(g => g.phase === 8 && homeworldEcazClean(g));
  assert.equal(richeseBureaucratPlayer(game, 'richese').spice, 6, 'Only first Mentat collects the four-spice bribe');
  reach(g => g.turn === 2 && g.phase === 1 && homeworldEcazClean(g));
  const worm = game.spiceDeck.findIndex(c => 'worm' in c && !c.greatMaker && !c.suppressed);
  assert.ok(worm >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(worm, 1)[0]);
  reach(g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && homeworldEcazClean(g));
  act('richese', { type: 'alliance', target: 'atreides' });
  act('atreides', { type: 'alliance', target: 'richese' });
  reach(g => g.phase === 3 && g.decision?.kind === 'richeseBlackMarket');
  choose({ card: richeseBureaucratPlayer(game, 'richese').hand[0].id, method: 'silent' });
  game = allowRicheseBureaucratResponses(game);
  assert.ok(game.richeseAuction && !game.richeseAuction.outcome);
  assert.equal(game.richeseAuction.acted.length, 0);
  assert.equal(richeseBureaucratPlayer(game, 'richese').hand.length, 4);
  assert.equal(richeseBureaucratPlayer(game, 'richese').spice, 6);
  assert.equal(richeseBureaucratPlayer(game, 'richese').ally, 'atreides');
  assert.equal(richeseBureaucratPlayer(game, 'atreides').ally, 'richese');
  assert.deepEqual(richeseBureaucratCards(game), stock);
  return game;
}
