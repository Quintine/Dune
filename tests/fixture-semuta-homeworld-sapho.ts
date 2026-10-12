import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES, gameDistance, location, splitLocation } from '../game/board';
import { nativeShipmentSources } from '../game/homeworld-options';
import { advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep,
  createSemutaHomeworldChoamSetup, holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import { moveSemutaEmperorCard, semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';
import { biddingPhysicalIds } from './fixture-homeworld-occupied-bidding';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldSaphoScope = 'onceAround' | 'movement';
export type SemutaHomeworldSaphoMode = 'first' | 'last';
export type SemutaHomeworldSaphoFixture = {
  setup: Game; game: Game; scope: SemutaHomeworldSaphoScope; mode: SemutaHomeworldSaphoMode;
  holder: string; owner: string; card: string; action: Action; event: string;
  nextActor: string; suffix: string[]; prefix: string[]; originalQueue: string[];
  lotCard: string | null; actions: RicheseSkillsTechStep[]; staging: string[];
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

/** Original completed R/E/C/A Homeworld setup, native finite lot or unstarted
 * Movement queue. Only original unplayed Spice order and physical cards move. */
export function createSemutaHomeworldSaphoFixture(
  scope: SemutaHomeworldSaphoScope, mode: SemutaHomeworldSaphoMode,
  advanced = false, fullHolder = false,
): SemutaHomeworldSaphoFixture {
  const native = createSemutaHomeworldChoamSetup(advanced);
  let game = native.game;
  const setup = structuredClone(game), actions = native.actions;
  const staging = ['Conserved original physical Semuta in Richese hand.'];
  const blows = game.spiceDeck.filter(card => 'territory' in card).slice(0, 2);
  assert.equal(blows.length, 2);
  for (const [position, card] of blows.entries())
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Reorder two original unplayed non-worm Spice Cards; no replacement stock.');
  let lotCard: string | null = null;
  if (scope === 'onceAround') {
    game = advanceSemutaHomeworldChoam(game, g => g.decision?.kind === 'richeseDeclaration', actions);
    game = applySemutaHomeworldChoamStep(game, native.holder,
      { type: 'decision', event: game.richeseBidding!.event, position: 'first' }, actions);
    game = advanceSemutaHomeworldChoam(game, g => g.decision?.kind === 'richeseCache', actions);
    assert.equal(game.decision?.kind, 'richeseCache');
    const selected = game.richeseCache!.find(card => card.id !== 'richese-juice-of-sapho')!;
    lotCard = selected.id;
    game = applySemutaHomeworldChoamStep(game, native.holder,
      { type: 'decision', event: game.richeseBidding!.event, card: selected.id,
        method: 'onceAround', direction: 'counterclockwise' }, actions);
    game = advanceSemutaHomeworldChoam(game, g => !!g.richeseAuction && clean(g), actions);
    assert.equal(game.richeseAuction!.source, 'cache');
    assert.equal(game.richeseAuction!.method, 'onceAround');
    const actor = game.richeseAuction!.active!;
    assert.ok(player(game, actor).spice >= 1);
    game = applySemutaHomeworldChoamStep(game, actor,
      { type: 'richeseBid', event: game.richeseAuction!.event, amount: 1, allyPayment: 0 }, actions);
  } else {
    game = advanceSemutaHomeworldChoam(game, g => g.phase === 5 && clean(g), actions);
    assert.ok(game.players.every(p => !p.shipped && p.moved === 0));
    assert.deepEqual(game.movementRemaining, game.order);
  }
  assert.equal(game.turn, 1);
  const originalQueue = scope === 'onceAround' ? [...game.richeseAuction!.order] : [...game.movementRemaining!];
  const prefix = scope === 'onceAround' ? [...game.richeseAuction!.acted] : [];
  const remaining = originalQueue.filter(id => !prefix.includes(id));
  const owner = remaining.find(id => id !== native.holder &&
    (mode === 'first' ? id !== remaining[0] : id !== remaining.at(-1)));
  assert.ok(owner, 'A real non-Richese unacted actor changes its selected position');
  const card = holdSemutaHomeworldChoamCard(game, owner, 'Juice of Sapho');
  staging.push(`Conserved original printed Juice of Sapho to ${owner}; not an auction acquisition.`);
  assert.ok(player(game, owner).hand.length <= handLimit(player(game, owner)));
  if (fullHolder) {
    const holder = player(game, native.holder);
    while (holder.hand.length < handLimit(holder)) {
      assert.ok(game.deck[0]);
      moveSemutaEmperorCard(game, game.deck[0].id, holder.id);
    }
    staging.push('Conserved original undealt cards fill Richese to its native hand limit.');
  }
  const option = viewGame(game, owner).saphoOptions.find(option => option.scope === scope && option.mode === mode);
  assert.ok(option);
  const action: Action = { type: 'card', card, scope, mode, event: option.event };
  const suffix = mode === 'first' ? [owner, ...remaining.filter(id => id !== owner)]
    : [...remaining.filter(id => id !== owner), owner];
  assert.deepEqual(biddingPhysicalIds(game), biddingPhysicalIds(setup));
  return { setup, game, scope, mode, holder: native.holder, owner, card, action,
    event: option.event!, nextActor: suffix[0], suffix, prefix, originalQueue, lotCard, actions, staging };
}

export function disposeSemutaHomeworldSapho(fixture: SemutaHomeworldSaphoFixture, state = fixture.game): Game {
  return applyAction(state, fixture.owner, fixture.action);
}

/** Finish only this same finite lot: each remaining bidder passes once, leaving
 * the real earlier one-spice invoice to native quote/payment/acquisition. */
export function finishSemutaHomeworldSaphoAuction(state: Game, fixture: SemutaHomeworldSaphoFixture,
  actions: RicheseSkillsTechStep[] = []): Game {
  let game = state;
  while (game.richeseAuction?.event === fixture.event && !game.richeseAuction.outcome) {
    assert.ok(clean(game));
    const actor = game.richeseAuction.active!;
    game = applySemutaHomeworldChoamStep(game, actor,
      { type: 'richeseBid', event: fixture.event, amount: null, allyPayment: 0 }, actions);
  }
  return game;
}

/** One actual paid original reserve shipment and one ground move, then each
 * original remaining combined turn ends once through public native controls. */
export function finishSemutaHomeworldSaphoMovement(state: Game, fixture: SemutaHomeworldSaphoFixture,
  actions: RicheseSkillsTechStep[] = []): { game: Game; beforeShipment: Game; afterShipment: Game;
    origin: string; destination: string; shipment: Action; move: Action } {
  let game = state;
  assert.ok(clean(game));
  assert.equal(game.active, fixture.nextActor);
  const origin = TERRITORIES.filter(t => t.type === 'sand').flatMap(t => t.sectors.map(s => location(t.id, s)))
    .find(key => splitLocation(key).sector !== game.storm && game.players.every(p => !(p.forces[key] > 0)));
  assert.ok(origin);
  const destination = TERRITORIES.filter(t => t.type === 'sand').flatMap(t => t.sectors.map(s => location(t.id, s)))
    .find(key => splitLocation(key).sector !== game.storm && game.players.every(p => !(p.forces[key] > 0)) &&
      gameDistance(game, origin, key, k => splitLocation(k).sector === game.storm) === 1);
  assert.ok(destination);
  const sources = nativeShipmentSources(viewGame(game, fixture.nextActor), 1, 0);
  assert.ok(sources);
  const shipment: Action = { type: 'ship', ...splitLocation(origin), amount: 1, elite: 0,
    homeworldSources: sources, allyPayment: 0 };
  const beforeShipment = structuredClone(game);
  game = applySemutaHomeworldChoamStep(game, fixture.nextActor, shipment, actions);
  game = advanceSemutaHomeworldChoam(game, clean, actions);
  const afterShipment = structuredClone(game);
  const move: Action = { type: 'move', from: origin, ...splitLocation(destination), amount: 1, elite: 0 };
  game = applySemutaHomeworldChoamStep(game, fixture.nextActor, move, actions);
  game = advanceSemutaHomeworldChoam(game, clean, actions);
  game = advanceSemutaHomeworldChoam(game, g => g.phase > 5 && clean(g), actions);
  return { game, beforeShipment, afterShipment, origin, destination, shipment, move };
}
