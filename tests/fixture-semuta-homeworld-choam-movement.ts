import assert from 'node:assert/strict';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES, gameDistance, location, splitLocation } from '../game/board';
import { nativeShipmentSources } from '../game/homeworld-options';
import { choamPowerAction, choamPowerPlays } from '../game/choam-power-options';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep,
  createSemutaHomeworldChoamSetup, holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import { moveSemutaEmperorCard, semutaEmperorPlayer } from './fixture-semuta-emperor-share';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type SemutaHomeworldChoamMovementEffect = 'kulon' | 'baliset';
export type SemutaHomeworldChoamMovementFixture = {
  setup: Game; game: Game; beforeShipment: Game; afterShipment: Game; beforeMove: Game;
  owner: string; holder: string; target: string; canceller: string; card: string;
  effect: SemutaHomeworldChoamMovementEffect; action: Action; shipment: Action;
  move: Action; tooFar: Action | null; alternateMove: Action | null;
  origin: string; destination: string; actions: RicheseSkillsTechStep[]; staging: string[];
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
export function semutaHomeworldChoamMovementStock(game: Game): string[] {
  return [game.deck, game.discard, game.richeseCache ?? [], game.richeseRemoved ?? [],
    ...game.players.map(player => player.hand)].flat().map(card => card.id).sort();
}
export function semutaHomeworldChoamMovementResources(game: Game) {
  return { custody: structuredClone(game.homeworlds?.custody),
    players: game.players.map(player => ({ id: player.id, spice: player.spice,
      reserves: player.reserves, tanks: player.tanks, forces: structuredClone(player.forces),
      elites: structuredClone(player.elites), shipped: player.shipped, moved: player.moved,
      ally: player.ally })), spice: structuredClone(game.spice) };
}
function destinationAtRange(game: Game, origin: string, range: number, excluded: string[] = []) {
  const destination = TERRITORIES.filter(t => t.type === 'sand' && !excluded.includes(t.id))
    .flatMap(t => t.sectors.map(sector => location(t.id, sector)))
    .find(key => splitLocation(key).sector !== game.storm &&
      game.players.every(player => !(player.forces[key] > 0)) &&
      gameDistance(game, origin, key, k => splitLocation(k).sector === game.storm) === range);
  assert.ok(destination, `Original board has a free sand destination at range ${range}`);
  return destination;
}

/** Original setup, first-turn order and paid native reserves shipment. Only
 * conserved physical hands and two still-unplayed Spice Cards are positioned. */
export function createSemutaHomeworldChoamMovementFixture(
  effect: SemutaHomeworldChoamMovementEffect, advanced = false, fullHolder = false,
): SemutaHomeworldChoamMovementFixture {
  const native = createSemutaHomeworldChoamSetup(advanced);
  let game = native.game;
  const setup = structuredClone(game), actions = native.actions;
  const staging = ['Conserved original physical Semuta in Richese hand.'];
  const blows = game.spiceDeck.filter(card => 'territory' in card).slice(0, 2);
  assert.equal(blows.length, 2);
  for (const [position, card] of blows.entries())
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Reorder two original unplayed non-worm Spice Cards; no new deck.');
  game = advanceSemutaHomeworldChoam(game,
    g => g.phase === 5 && g.active === native.owner && clean(g), actions);
  assert.equal(game.turn, 1);
  const card = holdSemutaHomeworldChoamCard(game, native.owner, effect === 'kulon' ? 'Kulon' : 'Baliset');
  holdSemutaHomeworldChoamCard(game, native.canceller, 'Karama');
  staging.push(`Conserved printed ${effect} to CHOAM and original Karama to Emperor.`);
  assert.ok(semutaEmperorPlayer(game, native.owner).hand.length <= handLimit(semutaEmperorPlayer(game, native.owner)));
  if (fullHolder) {
    const holder = semutaEmperorPlayer(game, native.holder);
    while (holder.hand.length < handLimit(holder)) {
      assert.ok(game.deck[0]);
      moveSemutaEmperorCard(game, game.deck[0].id, holder.id);
    }
    staging.push('Conserved original undealt cards fill Richese to its native hand limit.');
  }
  const origin = effect === 'kulon' ? 'red_chasm:7'
    : Object.keys(semutaEmperorPlayer(game, native.target).forces).find(key => semutaEmperorPlayer(game, native.target).forces[key] > 0)!;
  assert.ok(origin);
  const destination = destinationAtRange(game, origin, effect === 'kulon' ? 2 : 1);
  const shipTo = effect === 'kulon' ? origin : destination;
  const sources = nativeShipmentSources(viewGame(game, native.owner), 1, 0);
  assert.ok(sources);
  const shipment: Action = { type: 'ship', ...splitLocation(shipTo), amount: 1, elite: 0,
    homeworldSources: sources, allyPayment: 0 };
  const beforeShipment = structuredClone(game);
  game = applySemutaHomeworldChoamStep(game, native.owner, shipment, actions);
  game = advanceSemutaHomeworldChoam(game, g => clean(g), actions);
  const afterShipment = structuredClone(game);
  const move: Action = { type: 'move', from: origin, amount: 1, elite: 0, ...splitLocation(destination) };
  let beforeMove = structuredClone(game);
  let tooFar: Action | null = null, alternateMove: Action | null = null;
  if (effect === 'kulon') {
    tooFar = { type: 'move', from: origin, amount: 1, elite: 0,
      ...splitLocation(destinationAtRange(game, origin, 3)) };
  } else {
    game = applySemutaHomeworldChoamStep(game, native.owner, { type: 'endMovement' }, actions);
    game = advanceSemutaHomeworldChoam(game,
      g => g.phase === 5 && g.active === native.target && clean(g), actions);
    alternateMove = { type: 'move', from: origin, amount: 1, elite: 0,
      ...splitLocation(destinationAtRange(game, origin, 1, [splitLocation(destination).territory])) };
    beforeMove = structuredClone(game);
    game = applySemutaHomeworldChoamStep(game, native.target, move, actions);
    assert.equal(game.decision?.kind, 'choamMovement');
    assert.deepEqual(semutaEmperorPlayer(game, native.target).forces, semutaEmperorPlayer(beforeMove, native.target).forces);
    assert.equal(semutaEmperorPlayer(game, native.target).moved, 0);
  }
  const view = viewGame(game, native.owner);
  const printed = choamPowerPlays(view, effect).find(play => play.source === 'printed' && play.card.id === card);
  assert.ok(printed);
  const action = choamPowerAction(view, printed, effect === 'baliset'
    ? { target: native.target, territory: splitLocation(destination).territory } : {});
  assert.ok(action);
  return { setup, game, beforeShipment, afterShipment, beforeMove,
    owner: native.owner, holder: native.holder, target: effect === 'kulon' ? native.owner : native.target,
    canceller: native.canceller, card, effect, action, shipment, move, tooFar, alternateMove,
    origin, destination, actions, staging };
}

/** Pass only actual entitled native Worthless cancellation controls. */
export function allowSemutaHomeworldChoamMovement(state: Game, actions?: RicheseSkillsTechStep[]): Game {
  let game = state;
  for (let count = 0; game.response && count < 32; count++) {
    assert.equal(game.response.kind, 'choamWorthless');
    const entitled = game.players.find(player => {
      const controls = viewGame(game, player.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    assert.ok(entitled, 'An original entitled cancellation control must allow the power');
    game = applySemutaHomeworldChoamStep(game, entitled.id, { type: 'passResponse' }, actions);
  }
  assert.equal(game.response, null);
  return game;
}
export function disposeSemutaHomeworldChoamMovement(fixture: SemutaHomeworldChoamMovementFixture,
  state = fixture.game, actions?: RicheseSkillsTechStep[]): Game {
  return allowSemutaHomeworldChoamMovement(
    applySemutaHomeworldChoamStep(state, fixture.owner, fixture.action, actions), actions);
}

/** Execute a useful original ground move, then finish the original phase by
 * native controls. No phase, active player, wallet or custody is reassigned. */
export function finishSemutaHomeworldChoamMovement(state: Game,
  fixture: SemutaHomeworldChoamMovementFixture, actions?: RicheseSkillsTechStep[]): Game {
  let game = applySemutaHomeworldChoamStep(state, fixture.target,
    fixture.effect === 'kulon' ? fixture.move : fixture.alternateMove!, actions);
  game = advanceSemutaHomeworldChoam(game, g => g.phase > 5 && clean(g), actions);
  assert.equal(game.turn, 1);
  return game;
}
export function withoutSemutaHomeworldChoamMovementHolder(state: Game, holder: string): Game {
  const game = structuredClone(state), hand = semutaEmperorPlayer(game, holder).hand;
  const index = hand.findIndex(card => card.id === SEMUTA_DRUG_ID);
  const replacement = game.deck.findIndex(card => card.effect !== 'karama');
  assert.ok(index >= 0 && replacement >= 0);
  const semuta = hand[index];
  hand[index] = game.deck.splice(replacement, 1)[0];
  game.deck.push(semuta);
  return game;
}
