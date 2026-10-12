import assert from 'node:assert/strict';
import { handLimit, type Action, type Game } from '../game/engine';
import { biddingPhysicalIds } from './fixture-homeworld-occupied-bidding';
import { semutaEmperorCardId, moveSemutaEmperorCard, semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import { createSemutaHomeworldChoamSetup, applySemutaHomeworldChoamStep, advanceSemutaHomeworldChoam } from './fixture-semuta-homeworld-choam';
import { nextRicheseSkillsTechNativeStep, type RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldKaramaAuctionScope = 'purchase' | 'payment';
export type SemutaHomeworldKaramaAuctionFixture = {
  scope: SemutaHomeworldKaramaAuctionScope;
  setup: Game;
  beforeLot: Game;
  game: Game;
  gameBeforeCost: Game;
  actor: string;
  owner: string;
  holder: string;
  card: string;
  action: Action;
  event: string;
  reservedLot: string;
  nativeBid: number;
  payers: { player: string; spice: number }[];
  custody: Game['homeworlds'];
  actions: RicheseSkillsTechStep[];
  staging: string[];
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

/** The original R/C/E/A setup and real first Bidding. Only conserved physical
 * cards and two still-unplayed Spice Cards are positioned; no economy or clock
 * is assigned. Richese declares last before the native normal pool is drawn. */
export function createSemutaHomeworldKaramaAuctionFixture(
  scope: SemutaHomeworldKaramaAuctionScope, advanced = false, fullHolder = false,
): SemutaHomeworldKaramaAuctionFixture {
  const native = createSemutaHomeworldChoamSetup(advanced);
  const setup = structuredClone(native.game), actions = native.actions, staging: string[] = [];
  let game = native.game;
  const actor = native.target, holder = native.holder;
  const physical = biddingPhysicalIds(game);
  const held = semutaEmperorPlayer(game, actor).hand.find(card => card.effect === 'karama');
  const card = held?.id ?? moveSemutaEmperorCard(game,
    semutaEmperorCardId(game, candidate => candidate.effect === 'karama'), actor);
  staging.push(`Conserved printed Karama ${card} in original Atreides ${actor} custody before Bidding.`);
  assert.ok(semutaEmperorPlayer(game, actor).hand.length < handLimit(semutaEmperorPlayer(game, actor)));
  assert.deepEqual(biddingPhysicalIds(game), physical);
  for (let position = 0; position < 2; position++) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card);
    assert.ok(index >= position);
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  staging.push('Position two original unplayed non-worm Spice Cards, retaining the original deck.');
  game = advanceSemutaHomeworldChoam(game, state => state.decision?.kind === 'richeseDeclaration', actions);
  game = applySemutaHomeworldChoamStep(game, game.decision!.player,
    { type: 'decision', event: game.richeseBidding!.event, position: 'last' }, actions);
  game = advanceSemutaHomeworldChoam(game, state => !!state.auction && clean(state), actions);
  const beforeLot = structuredClone(game);
  assert.equal(game.auction!.peekKnown, true, 'The actual native Atreides inspection has completed');
  assert.equal(game.richeseBidding!.position, 'last');
  const reservedLot = game.auction!.cards[game.auction!.index].id;
  if (fullHolder) {
    const original = biddingPhysicalIds(game), receiver = semutaEmperorPlayer(game, holder);
    while (receiver.hand.length < handLimit(receiver)) {
      const incoming = game.deck.shift();
      assert.ok(incoming, 'Original undealt stock must supply holder capacity');
      receiver.hand.push(incoming);
      staging.push(`After ordinary lot quantity committed, conserve undealt ${incoming.id} into ${holder} hand.`);
    }
    assert.equal(receiver.hand.length, 4);
    assert.deepEqual(biddingPhysicalIds(game), original);
  }
  if (scope === 'payment') {
    for (let n = 0; game.auction!.active !== actor && n < game.players.length; n++)
      game = applySemutaHomeworldChoamStep(game, game.auction!.active, { type: 'passBid' }, actions);
    assert.equal(game.auction!.active, actor);
    const amount = semutaEmperorPlayer(game, actor).spice + 1;
    game = applySemutaHomeworldChoamStep(game, actor, { type: 'bid', amount }, actions);
    for (let n = 0; game.decision?.kind !== 'auctionPayment' && n < game.players.length + 2; n++)
      game = applySemutaHomeworldChoamStep(game, game.auction!.active, { type: 'passBid' }, actions);
    assert.equal(game.decision?.kind, 'auctionPayment');
    assert.equal(game.decision!.player, actor);
    assert.equal(game.auction!.bidder, actor);
    assert.ok(game.auction!.bid > semutaEmperorPlayer(game, actor).spice);
  }
  assert.equal(game.auction!.cards[game.auction!.index].id, reservedLot);
  const action: Action = scope === 'purchase'
    ? { type: 'card', mode: 'purchase', card }
    : { type: 'decision', karama: true, card };
  return { scope, setup, beforeLot, game, gameBeforeCost: structuredClone(game), actor, owner: actor,
    holder, card, action, event: game.richeseBidding!.event, reservedLot, nativeBid: game.auction!.bid,
    payers: game.players.map(player => ({ player: player.id, spice: player.spice })),
    custody: structuredClone(game.homeworlds), actions, staging };
}

export function disposeSemutaHomeworldKaramaAuction(
  fixture: SemutaHomeworldKaramaAuctionFixture, state = fixture.game, actions?: RicheseSkillsTechStep[],
): Game {
  return applySemutaHomeworldChoamStep(state, fixture.actor, fixture.action, actions);
}

/** Keep every original remaining normal/cache lot and invoice. Finish with
 * native no-spend human choices, including the actual Bidding-end ready gate. */
export function finishSemutaHomeworldKaramaAuction(
  state: Game, fixture: SemutaHomeworldKaramaAuctionFixture, actions?: RicheseSkillsTechStep[],
): Game {
  let game = state;
  for (let n = 0; !(game.phase === 5 && clean(game)) && n < 1600; n++) {
    assert.equal(game.turn, fixture.game.turn);
    const end = game.biddingEnd;
    const actor = end && clean(game) ? end.owners.find(id => !end.ready.includes(id)) : undefined;
    if (actor) game = applySemutaHomeworldChoamStep(game, actor,
      { type: 'biddingEnd', event: end!.event, mode: 'ready' }, actions);
    else if (game.pendingTreacheryDiscard?.reaction?.stage === 'offer') {
      const pending = game.pendingTreacheryDiscard, reaction = pending.reaction;
      assert.ok(reaction?.stage === 'offer');
      const seat = game.players.find(player => !reaction.passed.includes(player.id))!;
      game = applySemutaHomeworldChoamStep(game, seat.id,
        { type: 'semutaPass', event: pending.batch.event }, actions);
    } else if (game.decision?.kind === 'choamMarket')
      game = applySemutaHomeworldChoamStep(game, game.decision.player, { type: 'decision', done: true }, actions);
    else if (game.decision?.kind === 'caladanReinforcement')
      game = applySemutaHomeworldChoamStep(game, game.decision.player,
        { type: 'decision', event: game.decision.event, decline: true }, actions);
    else {
      const next = nextRicheseSkillsTechNativeStep(game);
      game = applySemutaHomeworldChoamStep(game, next.actor, next.action, actions);
    }
  }
  assert.equal(game.phase, 5);
  assert.ok(clean(game));
  return game;
}
