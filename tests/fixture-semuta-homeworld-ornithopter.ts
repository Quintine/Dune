import assert from 'node:assert/strict';
import { handLimit, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES, gameDistance, location, splitLocation } from '../game/board';
import { nativeShipmentSources } from '../game/homeworld-options';
import type { NativeReserveSelections } from '../game/homeworld-native-reserves';
import type { OrnithopterMode } from '../game/ornithopter';
import type { RicheseSkillsTechStep } from './fixture-richese-skills-tech';
import { advanceSemutaHomeworldChoam, applySemutaHomeworldChoamStep,
  createSemutaHomeworldChoamSetup, holdSemutaHomeworldChoamCard } from './fixture-semuta-homeworld-choam';
import { moveSemutaEmperorCard, semutaEmperorPlayer as player } from './fixture-semuta-emperor-share';

export type SemutaHomeworldOrnithopterFixture = {
  setup: Game; beforeShipment: Game; afterShipment: Game; beforeFirstMove: Game; game: Game;
  owner: string; holder: string; card: string; mode: OrnithopterMode; earlyFinish: boolean;
  origin: string; destination: string; secondDestination: string; tooFarDestination: string;
  shipment: Action; firstMove: Action; action: Action; moves: number; amount: number;
  sources: NativeReserveSelections; originalForces: Record<string, number>;
  actions: RicheseSkillsTechStep[]; staging: string[];
};
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision && !g.pendingTreacheryDiscard;
export function semutaHomeworldOrnithopterStock(game: Game): string[] {
  return [game.deck, game.discard, game.richeseCache ?? [], game.richeseRemoved ?? [],
    ...game.players.map(p => p.hand), ...(game.ornithopter ? [[game.ornithopter.card]] : [])]
    .flat().map(card => card.id).sort();
}
export function semutaHomeworldOrnithopterResources(game: Game) {
  return { custody: structuredClone(game.homeworlds?.custody), spice: structuredClone(game.spice),
    players: game.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves,
      tanks: p.tanks, forces: structuredClone(p.forces), elites: structuredClone(p.elites),
      shipped: p.shipped, moved: p.moved, ally: p.ally })) };
}
function destination(game: Game, origin: string, range: number, excluded: string[] = []) {
  const key = TERRITORIES.filter(t => t.type === 'sand').flatMap(t => t.sectors.map(s => location(t.id, s)))
    .find(key => !excluded.includes(key) && splitLocation(key).sector !== game.storm &&
      game.players.every(p => !(p.forces[key] > 0)) &&
      gameDistance(game, origin, key, k => splitLocation(k).sector === game.storm) === range);
  assert.ok(key, `Original board needs an empty sand destination at range ${range}`);
  return key;
}
/** Fresh original setup and paid native CHOAM source counters. Only original
 * unplayed Spice Card order and conserved physical hand positions are staged. */
export function createSemutaHomeworldOrnithopterFixture(
  mode: OrnithopterMode, advanced = false, earlyFinish = false, fullHolder = false,
): SemutaHomeworldOrnithopterFixture {
  assert.ok(!earlyFinish || mode === 'twoGroups');
  const native = createSemutaHomeworldChoamSetup(advanced);
  let game = native.game;
  const setup = structuredClone(game), actions = native.actions;
  const staging = ['Conserved original physical Semuta in Richese hand.'];
  const blows = game.spiceDeck.filter(c => 'territory' in c).slice(0, 2);
  assert.equal(blows.length, 2);
  for (const [position, card] of blows.entries())
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Reorder two original unplayed non-worm Spice Cards; no replacement deck.');
  game = advanceSemutaHomeworldChoam(game,
    g => g.turn === 1 && g.phase === 5 && g.active === native.owner && clean(g), actions);
  const card = holdSemutaHomeworldChoamCard(game, native.owner, 'Ornithopter');
  assert.equal(card, 'richese-ornithopter');
  assert.ok(player(game, native.owner).hand.length <= handLimit(player(game, native.owner)));
  staging.push('Conserved original Richese cache Ornithopter to CHOAM; acquisition history unchanged.');
  if (fullHolder) {
    const holder = player(game, native.holder);
    while (holder.hand.length < handLimit(holder)) {
      assert.ok(game.deck[0]);
      moveSemutaEmperorCard(game, game.deck[0].id, holder.id);
    }
    staging.push('Conserved original undealt cards fill Richese to its native hand limit.');
  }
  const origin = 'red_chasm:7', amount = mode === 'twoGroups' && !earlyFinish ? 2 : 1;
  const sources = nativeShipmentSources(viewGame(game, native.owner), amount, 0);
  assert.ok(sources, 'Native Homeworld reserves must supply the actual counters');
  const shipment: Action = { type: 'ship', ...splitLocation(origin), amount, elite: 0,
    homeworldSources: sources, allyPayment: 0 };
  const beforeShipment = structuredClone(game);
  game = applySemutaHomeworldChoamStep(game, native.owner, shipment, actions);
  game = advanceSemutaHomeworldChoam(game, clean, actions);
  const afterShipment = structuredClone(game), beforeFirstMove = structuredClone(game);
  const originalForces = structuredClone(player(game, native.owner).forces);
  const target = destination(game, origin, mode === 'range3' ? 3 : 1);
  const secondDestination = destination(game, origin, 1, [target]);
  const tooFarDestination = destination(game, origin, 4);
  const option = viewGame(game, native.owner).ornithopter;
  assert.equal(option?.card.id, card);
  assert.ok(option?.modes.some(m => m.mode === mode && !m.blocked));
  const firstMove: Action = { type: 'move', from: origin, amount: 1, elite: 0,
    ...splitLocation(target), movementCard: card, ornithopter: mode };
  let action = firstMove;
  if (mode === 'twoGroups') {
    game = applySemutaHomeworldChoamStep(game, native.owner, firstMove, actions);
    assert.equal(game.ornithopter?.completed, 1);
    action = earlyFinish ? { type: 'endMovement' } : { type: 'move', from: origin, amount: 1,
      elite: 0, ...splitLocation(secondDestination), ornithopterEvent: game.ornithopter!.event };
  }
  return { setup, beforeShipment, afterShipment, beforeFirstMove, game,
    owner: native.owner, holder: native.holder, card, mode, earlyFinish, origin,
    destination: target, secondDestination, tooFarDestination, shipment, firstMove, action,
    amount, moves: mode === 'twoGroups' && !earlyFinish ? 2 : 1, sources: structuredClone(sources),
    originalForces, actions, staging };
}
export function disposeSemutaHomeworldOrnithopter(f: SemutaHomeworldOrnithopterFixture,
  state = f.game, actions?: RicheseSkillsTechStep[]): Game {
  return applySemutaHomeworldChoamStep(state, f.owner, f.action, actions);
}
/** Real original movement queue continuation; never another CHOAM ground move. */
export function finishSemutaHomeworldOrnithopter(state: Game, actions?: RicheseSkillsTechStep[]): Game {
  return advanceSemutaHomeworldChoam(state, g => g.phase > 5 && clean(g), actions);
}
