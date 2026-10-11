import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { gameDistance, splitLocation, TERRITORIES } from '../game/board';
import { stormExposesTerritory } from '../game/disaster-rules';
import type { Card } from '../game/cards';
import { choamPowerAction, choamPowerPlays } from '../game/choam-power-options';
import {
  advanceSemutaNexusCunning, createSemutaNexusCunningStart,
  gamePlayer, holdSemutaNexusCunningCard, semutaNexusCunningInventory,
  type SemutaNexusCunningFixture, type SemutaNexusCunningStep,
} from './fixture-semuta-nexus-cunning';

export type SemutaNexusCunningReactiveEffect = 'baliset' | 'laLaLa' | 'jubba';
export type SemutaNexusCunningReactiveStep = SemutaNexusCunningStep;
export type SemutaNexusCunningReactiveOptions = {
  /** An already created shared start; only its live game and staging are used. */
  start?: SemutaNexusCunningFixture;
  advanced?: boolean;
  skills?: boolean;
  /** Hold one canonical Karama in the other seat for the prevention family. */
  karama?: boolean;
};
export type SemutaNexusCunningReactiveFixture = {
  start: SemutaNexusCunningFixture;
  /** The real reactive parent, before any Cunning declaration. */
  game: Game;
  /** The conserved state immediately before the real parent action(s). */
  before: Game;
  parent: Action;
  steps: SemutaNexusCunningReactiveStep[];
  effect: SemutaNexusCunningReactiveEffect;
  owner: string;
  holder: string;
  target: string;
  other: string;
  cost: Card;
  semuta: string;
  selection: Record<string, unknown>;
  /** The ordinary movement origin and destination of the Baliset family. */
  origin: string | null;
  destination: string | null;
  /** The protected (Jubba) or restricted (Baliset) territory, when any. */
  territory: string | null;
  /** A second original crossed territory that keeps its ordinary storm losses. */
  otherTerritory: string | null;
  distance: number;
  crossed: { sector: number; key: string; territory: string }[];
  dials: { actor: string; amount: number }[];
  staging: string[];
  cards: string[];
};

const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;


/** Physical stocks only: no wallets, clocks, phases or leader training. */
export function semutaNexusCunningReactiveBoard(game: Game) {
  return game.players.map(player => ({
    id: player.id, faction: player.faction, spice: player.spice,
    forces: player.forces, reserves: player.reserves, tanks: player.tanks,
    moved: player.moved, revived: player.revived,
    freeForcesRevived: player.freeForcesRevived,
  }));
}

/** Conserved later board counters, taken from the seat's own reserves. */
function stageForces(game: Game, actor: string, key: string, count: number, staging: string[]): void {
  const player = gamePlayer(game, actor);
  assert.ok(player.reserves >= count, 'A conserved later placement needs ordinary reserves');
  player.reserves -= count;
  player.forces[key] = (player.forces[key] ?? 0) + count;
  staging.push(`Conserved later ordinary force ${count} for ${actor} at ${key} from its own reserves; clocks, wallets, allowances and training unchanged.`);
}
/** Conserved later Tanks counters, taken from the seat's own reserves. */
function stageTanks(game: Game, actor: string, count: number, staging: string[]): void {
  const player = gamePlayer(game, actor);
  assert.ok(player.reserves >= count, 'A conserved later Tanks placement needs ordinary reserves');
  player.reserves -= count;
  player.tanks += count;
  staging.push(`Conserved later ${count} physical force(s) for ${actor} in its own Tanks; no revival, wallet, allowance or training change.`);
}
/** Existing board spice only, so a later real storm can be observed. */
function stageSpice(game: Game, key: string, amount: number, staging: string[]): void {
  game.spice[key] = (game.spice[key] ?? 0) + amount;
  staging.push(`Conserved ${amount} existing board spice at ${key} for the later real storm; no wallet change.`);
}

/** An original adjacent non-storm movement pair in ordinary sand territory. */
function balisetPair(game: Game): { from: string; to: string } {
  const keys = TERRITORIES.filter(t => t.type === 'sand' && t.id !== 'imperial_basin')
    .flatMap(t => t.sectors.map(s => `${t.id}:${s}`));
  for (const to of keys) {
    const destination = splitLocation(to);
    if (destination.sector === game.storm) continue;
    for (const from of keys) {
      const origin = splitLocation(from);
      if (origin.territory === destination.territory || origin.sector === game.storm) continue;
      if (gameDistance(game, from, to, key => splitLocation(key).sector === game.storm) !== 1) continue;
      return { from, to };
    }
  }
  throw Error('No original adjacent non-storm movement pair remains');
}

function crossedExposed(game: Game, distance: number) {
  const crossed: { sector: number; key: string; territory: string }[] = [];
  for (let step = 0; step < distance; step++) {
    const sector = ((game.storm + step) % 18) + 1;
    for (const territory of TERRITORIES)
      if (territory.sectors.includes(sector) && stormExposesTerritory(territory.id, game.shieldWallDestroyed))
        crossed.push({ sector, key: `${territory.id}:${sector}`, territory: territory.id });
  }
  return crossed;
}
function splitDistance(dialers: string[], distance: number) {
  const amounts: number[] = [];
  let remaining = distance;
  for (let index = 0; index < dialers.length; index++) {
    const rest = dialers.length - index - 1;
    const amount = Math.min(3, Math.max(1, remaining - rest * 3));
    amounts.push(amount); remaining -= amount;
  }
  assert.equal(remaining, 0);
  assert.ok(amounts.every(value => value >= 1 && value <= 3));
  return dialers.map((actor, index) => ({ actor, amount: amounts[index] }));
}
/** Basic uses real dialers; Advanced retains the already revealed original card distance. */
function stormPlacement(game: Game) {
  const dialers = game.stormDialers;
  const minimum = game.advanced ? game.stormPending! : dialers.length;
  const maximum = game.advanced ? minimum : dialers.length * 3;
  if (!game.advanced) assert.equal(dialers.length, 2, 'The original Basic storm keeps its two real dialers');
  for (let distance = minimum; distance <= maximum; distance++) {
    const crossed = crossedExposed(game, distance);
    const first = crossed[0];
    const second = first && crossed.find(entry => entry.territory !== first.territory);
    if (first && second)
      return { distance, crossed, dials: game.advanced ? [] : splitDistance(dialers, distance),
        protected: first, other: second };
  }
  throw Error('No original later storm crosses two exposed territories');
}


export function quoteSemutaNexusCunningReactive(
  game: Game, fixture: SemutaNexusCunningReactiveFixture,
  selection: Record<string, unknown> = {},
): Action {
  const own = viewGame(game, fixture.owner);
  const play = choamPowerPlays(own, fixture.effect).find(candidate =>
    candidate.source === 'nexus' && candidate.card.id === fixture.cost.id);
  assert.ok(play && !play.blocked, 'The original private Cunning quote must offer the actual canonical fuel');
  const action = choamPowerAction(own, play, { ...fixture.selection, ...selection });
  assert.ok(action, 'The original private Cunning quote must produce its source action');
  return action;
}
/** One ordinary printed-Karama prevention of the current Cunning declaration. */
export function cancelSemutaNexusCunningReactive(state: Game, fixture: SemutaNexusCunningReactiveFixture): Game {
  const responder = state.players.find(player => player.id !== fixture.owner &&
    player.hand.some(card => card.effect === 'karama') &&
    !!viewGame(state, player.id).responseControls?.cancelCards.length);
  assert.ok(responder, 'The prevention family needs one ordinary Karama holder');
  const card = responder.hand.find(candidate => candidate.effect === 'karama');
  assert.ok(card);
  return applyAction(state, responder.id, { type: 'card', mode: 'cancel', card: card.id });
}

/** Fresh real setup, then one original reactive parent: an ordinary declared
 * movement into a CHOAM-occupied territory, an ordinary free force revival, or
 * a real later dialed storm. Only conserved physical stocks are staged. */
export function createSemutaNexusCunningReactive(
  effect: SemutaNexusCunningReactiveEffect,
  options: SemutaNexusCunningReactiveOptions = {},
): SemutaNexusCunningReactiveFixture {
  const start = options.start ?? createSemutaNexusCunningStart({
    advanced: options.advanced ?? false, skills: options.skills ?? false,
  });
  const staging = start.staging, steps: SemutaNexusCunningReactiveStep[] = [];
  if (options.karama)
    holdSemutaNexusCunningCard(start.game, start.other, card => card.effect === 'karama', staging);
  const base = {
    start, steps, effect, owner: start.owner, holder: start.holder,
    target: start.target, other: start.other, cost: start.cost, semuta: start.semuta,
    staging, selection: {} as Record<string, unknown>, territory: null as string | null,
    otherTerritory: null as string | null, origin: null as string | null,
    destination: null as string | null,
    distance: 0, crossed: [], dials: [] as { actor: string; amount: number }[],
  };
  if (effect === 'baliset') {
    const before = advanceSemutaNexusCunning(start.game,
      game => game.phase === 5 && clean(game) && game.active === start.target, steps);
    const pair = balisetPair(before);
    stageForces(before, start.target, pair.from, 2, staging);
    stageForces(before, start.owner, pair.to, 3, staging);
    const parent: Action = { type: 'move', from: pair.from, amount: 1, ...splitLocation(pair.to) };
    const game = applyAction(before, start.target, parent);
    const movement = game.decision?.kind === 'choamMovement' ? game.decision : null;
    assert.ok(movement, 'A real move into a CHOAM territory opens the reactive parent');
    assert.equal(movement.mover, start.target);
    assert.equal(movement.territory, splitLocation(pair.to).territory);
    assert.equal(game.pendingChoamMove?.to, splitLocation(pair.to).territory);
    return {
      ...base, before, game, parent, origin: pair.from, destination: pair.to,
      territory: splitLocation(pair.to).territory,
      cards: semutaNexusCunningInventory(game),
    };
  }
  if (effect === 'laLaLa') {
    const before = advanceSemutaNexusCunning(start.game,
      game => game.phase === 4 && clean(game), steps);
    assert.ok(before.revivalRules, 'The real revival phase supplies its own rules');
    stageTanks(before, start.target, 3, staging);
    const parent: Action = { type: 'revive', amount: 2 };
    const game = applyAction(before, start.target, parent);
    const revival = game.decision?.kind === 'choamFreeRevival' ? game.decision : null;
    assert.ok(revival, 'A real free revival opens the reactive parent');
    assert.equal(revival.recipient, start.target);
    assert.ok(game.pendingRevival, 'The declared free revival stays uncommitted');
    return {
      ...base, before, game, parent,
      cards: semutaNexusCunningInventory(game),
    };
  }
  const before = advanceSemutaNexusCunning(start.game, game => {
    if (game.phase !== 0 || !clean(game)) return false;
    if (!game.advanced) return game.stormPending === null &&
      game.stormDialers.every(id => game.stormDials[id] === undefined);
    if (typeof game.stormPending !== 'number' || game.stormPending < 1) return false;
    const crossed = crossedExposed(game, game.stormPending);
    return !!crossed[0] && crossed.some(entry => entry.territory !== crossed[0].territory);
  }, steps);
  const placement = stormPlacement(before);
  stageForces(before, start.owner, placement.protected.key, 3, staging);
  stageForces(before, start.owner, placement.other.key, 3, staging);
  stageForces(before, start.target, placement.protected.key, 2, staging);
  stageForces(before, start.target, placement.other.key, 2, staging);
  stageSpice(before, placement.protected.key, 5, staging);
  stageSpice(before, placement.other.key, 6, staging);
  let dialed = before, parent: Action = before.advanced ? { type: 'ready' }
    : { type: 'stormDial', amount: placement.dials[0].amount };
  for (const dial of placement.dials) {
    parent = { type: 'stormDial', amount: dial.amount };
    steps.push({ actor: dial.actor, action: parent });
    dialed = applyAction(dialed, dial.actor, parent);
  }
  assert.equal(dialed.stormPending, placement.distance, 'The original storm preparation fixes its own distance');
  const game = advanceSemutaNexusCunning(dialed, state => state.decision?.kind === 'choamStorm', steps);
  if (before.advanced) parent = steps.at(-1)!.action;
  const storm = game.decision?.kind === 'choamStorm' ? game.decision : null;
  assert.ok(storm, 'The real prepared storm opens the reactive parent');
  assert.equal(storm.player, start.owner);
  assert.ok(storm.territories.some(entry => entry.territory === placement.protected.territory));
  return {
    ...base, before, game, parent, distance: placement.distance, crossed: placement.crossed,
    dials: placement.dials, territory: placement.protected.territory,
    otherTerritory: placement.other.territory, selection: { territory: placement.protected.territory },
    cards: semutaNexusCunningInventory(game),
  };
}
