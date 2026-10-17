import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import type { RicheseAuctionMethod } from '../game/richese-auction';
import { createIndependentCardModulesFixture } from './fixture-independent-card-modules';
import { homeworldEcazClean, nextHomeworldEcazStep } from './fixture-homeworld-ecaz-occupy';

export type RicheseBureaucratOptions = {
  source?: 'cache' | 'blackMarket';
  advanced?: boolean;
  primary?: number;
  pledge?: number;
  buyer?: 'atreides' | 'emperor';
  owner?: 'beneGesserit' | 'atreides' | 'emperor' | 'richese';
  emperor?: boolean;
  counter?: boolean;
  method?: RicheseAuctionMethod;
  direction?: 'clockwise' | 'counterclockwise';
};
export type RicheseBureaucratStep = { actor: string; action: Action };
export function richeseBureaucratPlayer(game: Game, id: string) {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, `Missing original seat ${id}`);
  return player;
}
export function richeseBureaucratCards(game: Game): string[] {
  return [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? []),
  ].map(c => c.id).sort();
}
export function allowRicheseBureaucratResponses(state: Game): Game {
  let game = state;
  for (let n = 0; game.response && n < 40; n++) {
    const actor = game.players.find(p => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    assert.ok(actor, 'An original unpassed counter holder must remain');
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.equal(game.response, null);
  return game;
}

/** Genuine native all14 setup, ordinary first-turn play, a real one-spice bribe
 * collected only at Mentat, original turn-two worm alliance and native special
 * lot. Only unused Spice ordering and a conserved counter-card swap are staged. */
export function createRicheseBureaucratFixture(options: RicheseBureaucratOptions = {}) {
  const advanced = options.advanced ?? true, source = options.source ?? 'cache';
  assert.ok(advanced || source === 'cache');
  const payer = options.buyer ?? 'atreides', trainer = options.owner ?? 'beneGesserit';
  const donor = 'richese', emperor = options.emperor === false ? undefined : 'emperor';
  const roster: FactionId[] = ['richese', 'atreides', 'beneGesserit', emperor ?? 'guild'];
  assert.ok(roster.includes(payer) && roster.includes(trainer));
  const training: Partial<Record<FactionId, LeaderSkillId>> = {
    richese: 'smuggler', atreides: 'planetologist', beneGesserit: 'warmaster',
    [emperor ?? 'guild']: 'spice-banker', [trainer]: 'bureaucrat',
  };
  if (trainer === 'emperor') training.beneGesserit = 'spice-banker';
  const setup = createIndependentCardModulesFixture({ advanced, factions: roster, expansions: ['choam'],
    skills: true, independent: false, tech: false, training });
  let game = setup.game;
  const afterSetup = structuredClone(game), actions: RicheseBureaucratStep[] = [];
  const act = (actor: string, action: Action) => { actions.push({ actor, action }); game = applyAction(game, actor, action); };
  const next = () => {
    if (game.phase === 5 && homeworldEcazClean(game)) act(game.active!, { type: 'endMovement' });
    else {
      const step = nextHomeworldEcazStep(game);
      assert.ok(step, `Missing original Richese control ${game.phase}/${game.decision?.kind}`);
      act(step.actor, step.action);
    }
  };
  const reach = (until: (g: Game) => boolean) => {
    for (let n = 0; !until(game) && n < 800; n++) next();
    assert.ok(until(game), 'Reach the original Richese funding boundary');
  };
  // The first native cache acquisition costs Richese one. This real deferred
  // transfer, not a wallet assignment, makes a five-spice later pledge possible.
  act('atreides', { type: 'bribe', target: donor, amount: 1 });
  reach(g => g.turn === 2 && g.phase === 1 && homeworldEcazClean(g));
  const wormAt = game.spiceDeck.findIndex(c => 'worm' in c && !c.greatMaker && !c.suppressed);
  assert.ok(wormAt >= 0);
  game.spiceDeck.unshift(game.spiceDeck.splice(wormAt, 1)[0]);
  reach(g => !!g.nexus && !g.spiceWindow && !g.spiceResolution && homeworldEcazClean(g));
  const worm = structuredClone(game);
  act(donor, { type: 'alliance', target: payer });
  act(payer, { type: 'alliance', target: donor });
  const alliance = structuredClone(game);
  reach(g => g.phase === 3 && g.decision?.kind === (advanced ? 'richeseBlackMarket' : 'richeseDeclaration'));
  const choose = (values: Record<string, unknown>) => act(donor,
    { type: 'decision', event: game.richeseBidding!.event, ...values } as Action);
  if (advanced) {
    if (source === 'blackMarket') choose({ card: richeseBureaucratPlayer(game, donor).hand[0].id,
      method: options.method ?? 'silent', direction: options.direction ?? 'clockwise' });
    else choose({ decline: true });
  }
  if (source === 'cache') {
    choose({ position: 'first' });
    game = allowRicheseBureaucratResponses(game);
    choose({ card: game.richeseCache![0].id, method: 'silent' });
  }
  game = allowRicheseBureaucratResponses(game);
  assert.ok(game.richeseAuction && !game.richeseAuction.outcome);
  const staging = ['Conserved original unplayed worm moved to the next Spice reveal; actual worm alliance window retained.'];
  const counterActor = 'beneGesserit';
  let counterCard: string | undefined;
  if (options.counter) {
    const actor = richeseBureaucratPlayer(game, counterActor);
    const held = actor.hand.find(c => c.effect === 'karama');
    if (held) counterCard = held.id;
    else {
      const at = game.deck.findIndex(c => c.effect === 'karama');
      assert.ok(at >= 0 && actor.hand.length > 0);
      const original = actor.hand[0];
      actor.hand[0] = game.deck[at]; game.deck[at] = original;
      counterCard = actor.hand[0].id;
      staging.push(`Swap original unplayed ${counterCard} with held ${original.id}; retain hand size and physical stock.`);
    }
  }
  const primary = options.primary ?? 3, pledge = options.pledge ?? 5, price = primary + pledge;
  const beforePledge = structuredClone(game), physical = richeseBureaucratCards(game);
  act(donor, { type: 'pledgeAid', amount: pledge });
  const beforeAction = structuredClone(game), card = game.richeseAuction!.cardId;
  const action: Action = { type: 'richeseBid', event: game.richeseAuction!.event, amount: price, allyPayment: pledge };
  return { game, afterSetup, worm, alliance, beforePledge, beforeAction, actions, staging,
    source, advanced, payer, donor, seller: donor, trainer, emperor, counterActor, counterCard,
    banker: game.leaderSkills!.assignments.find(a => a.skill === 'spice-banker')!.owner,
    primary, pledge, price, card, action, physical };
}
export type RicheseBureaucratFixture = ReturnType<typeof createRicheseBureaucratFixture>;
export function payRicheseBureaucrat(fixture: RicheseBureaucratFixture): Game {
  let game = applyAction(fixture.game, fixture.payer, fixture.action);
  for (const actor of game.richeseAuction!.order)
    if (actor !== fixture.payer) game = applyAction(game, actor,
      { type: 'richeseBid', event: fixture.action.event, amount: 0 });
  return game;
}
export function chooseRicheseBureaucrat(game: Game, redirect: boolean): Game {
  assert.equal(game.decision?.kind, 'bureaucratPayment');
  return applyAction(game, game.decision!.player,
    { type: 'decision', event: game.bureaucratPaymentEvent, redirect });
}
