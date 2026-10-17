import assert from 'node:assert/strict';
import { applyAction, createGame, handLimit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import type { Card } from '../game/cards';
import {
  advanceIndependentSkillsBattle, assertIndependentSkillsBattleCustody,
  createIndependentSkillsBattleFixture, createIndependentSkillsBattleSetup, finishIndependentSkillsBattle,
  independentSkillsBattleClean, independentSkillsBattlePlayer,
  type IndependentSkillsBattleStep,
} from './fixture-independent-skills-battle';

export type PlanetologistIndependentOptions = {
  advanced?: boolean;
  effect?: 'reinforcements' | 'harassWithdraw' | 'recruits';
  alternate?: boolean;
  poison?: boolean;
};

function conserve(game: Game, actor: string, matches: (card: Card) => boolean, staging: string[]): Card {
  const player = independentSkillsBattlePlayer(game, actor);
  const held = player.hand.find(matches);
  if (held) return held;
  assert.ok(player.hand.length < handLimit(player));
  for (const [zone, label] of [[game.deck, 'undealt deck'], [game.discard, 'discard']] as const) {
    const index = zone.findIndex(matches);
    if (index < 0) continue;
    const card = zone.splice(index, 1)[0];
    player.hand.push(card);
    staging.push(`Conserved original ${card.id} from ${label} to ${actor}; no purchase is claimed.`);
    return card;
  }
  throw Error('The original selected card must remain in stock or already be held.');
}

export function createPlanetologistIndependentFixture(options: PlanetologistIndependentOptions = {}) {
  const base = createIndependentSkillsBattleFixture({ advanced: options.advanced ?? true,
    skills: { owner: 'planetologist' } });
  let game = structuredClone(base.beforeBattle);
  const staging = [...base.staging];
  const before = base.actions.findIndex(step => step.action.type === 'chooseBattle');
  assert.ok(before >= 0);
  const actions = base.actions.slice(0, before);
  const effect = options.effect ?? 'reinforcements';
  const weapon = conserve(game, base.owner, card => card.effect === effect, staging);
  const defense = conserve(game, base.owner, card => card.effect === (effect === 'harassWithdraw' ? 'reinforcements' : 'harassWithdraw'), staging);
  const opposingWeapon = options.poison ? conserve(game, base.opponent, card => card.kind === 'poison', staging).id
    : base.plans[1].action.weapon;
  assertIndependentSkillsBattleCustody(game);
  const beforeBattle = structuredClone(game);
  actions.push(base.battleStep);
  game = applyAction(game, base.battleStep.actor, base.battleStep.action);
  game = advanceIndependentSkillsBattle(game,
    state => !!state.battle && !state.battle.revealed && independentSkillsBattleClean(state),
    actions, { hide: { [base.owner]: true, [base.opponent]: true } });
  const plans: IndependentSkillsBattleStep[] = [
    { actor: base.owner, action: { type: 'battlePlan', dial: 2, support: game.advanced ? 2 : 0,
      leader: base.trainers.owner, weapon: weapon.id, defense: defense.id,
      ...(effect === 'recruits' ? {} : { planetologistSpecial: options.alternate !== false }) } },
    { actor: base.opponent, action: { ...base.plans[1].action, weapon: opposingWeapon } },
  ];
  staging.push('Branch from the original pre-battle position; make real hidden postures and select the trained Planetologist. No army, wallet, clock or skill assignment changes.');
  return { initial: base.initial, offered: base.offered, beforeBattle, game,
    owner: base.owner, opponent: base.opponent, observer: base.observer,
    trainer: base.trainers.owner, location: base.location, first: base.first, second: base.second,
    returns: base.returns, plans, actions, staging, effect, alternate: effect === 'recruits' || options.alternate !== false };
}
export type PlanetologistIndependentFixture = ReturnType<typeof createPlanetologistIndependentFixture>;
export function sealPlanetologistIndependent(fixture: PlanetologistIndependentFixture): Game {
  let game = fixture.game;
  for (const step of fixture.plans) game = applyAction(game, step.actor, step.action);
  assert.ok(game.battle?.revealed);
  return game;
}
export function finishPlanetologistIndependent(game: Game, fixture: PlanetologistIndependentFixture,
  actions?: IndependentSkillsBattleStep[]): Game {
  return finishIndependentSkillsBattle(game, { return: fixture.returns, actions });
}

/** Actual stronghold deployment empties the reserves before the later utility plan. */
export function createPlanetologistEmptyReserveFixture(): PlanetologistIndependentFixture {
  const initial = createGame('PLANETEMPTY', newPlayer('h', 'Harkonnen', 'harkonnen'), true);
  joinGame(initial, newPlayer('g', 'Guild', 'guild'));
  joinGame(initial, newPlayer('e', 'Emperor', 'emperor'));
  const setup = createIndependentSkillsBattleSetup({ initial, advanced: true,
    skills: { owner: 'planetologist', opponent: 'rihani-decipherer', observer: 'prana-bindu-adept' } });
  const actions = [...setup.actions], staging = [...setup.staging];
  let game = setup.afterSetup;
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action });
    game = applyAction(game, actor, action);
  };
  game = advanceIndependentSkillsBattle(game,
    state => state.phase === 5 && state.active === 'h' && independentSkillsBattleClean(state), actions);
  act('h', { type: 'ship', territory: 'carthag', sector: 11, amount: 10 });
  game = advanceIndependentSkillsBattle(game, state => state.phase === 5 && state.active === 'h' &&
    independentSkillsBattleClean(state) && !state.pendingShipment, actions);
  act('h', { type: 'move', from: 'carthag:11', territory: 'imperial_basin', sector: 10, amount: 5 });
  act('h', { type: 'endMovement' });
  game = advanceIndependentSkillsBattle(game,
    state => state.phase === 5 && state.active === 'e' && independentSkillsBattleClean(state), actions);
  act('e', { type: 'ship', territory: 'imperial_basin', sector: 10, amount: 2 });
  game = advanceIndependentSkillsBattle(game,
    state => state.phase === 6 && independentSkillsBattleClean(state), actions);
  assert.equal(independentSkillsBattlePlayer(game, 'h').reserves, 0);
  conserve(game, 'h', card => card.id === 'ecaz-reinforcements', staging);
  conserve(game, 'h', card => card.id === 'ecaz-harass-withdraw', staging);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(candidate => candidate.territory === 'imperial_basin');
  assert.ok(choice && choice.attacker === 'h');
  act(choice.chooser, { type: 'chooseBattle', territory: choice.territory, target: choice.defender });
  game = advanceIndependentSkillsBattle(game,
    state => !!state.battle && !state.battle.revealed && independentSkillsBattleClean(state),
    actions, { hide: { h: true, e: false } });
  const other = independentSkillsBattlePlayer(game, 'e').leaders
    .find(leader => !leader.dead && leader.id !== setup.trainers.observer)!;
  const plans: IndependentSkillsBattleStep[] = [
    { actor: 'h', action: { type: 'battlePlan', leader: setup.trainers.owner,
      weapon: 'ecaz-reinforcements', defense: 'ecaz-harass-withdraw',
      dial: 0.5, support: 0, planetologistSpecial: true } },
    { actor: 'e', action: { type: 'battlePlan', leader: other.id, dial: 0, support: 0 } },
  ];
  staging.push('Harkonnen paid its real ten-spice shipment into its own Carthag, then moved five original counters into Imperial Basin. Zero reserves and a half-strength unpaid dial are native outcomes, not staged resources.');
  assertIndependentSkillsBattleCustody(game);
  return { initial: setup.initial, offered: setup.offered, beforeBattle, game,
    owner: 'h', opponent: 'e', observer: 'g', trainer: setup.trainers.owner,
    location: 'imperial_basin', first: 'imperial_basin:10', second: 'imperial_basin:10',
    returns: { 'imperial_basin:10': { normal: 4, elite: 0 } },
    plans, actions, staging, effect: 'reinforcements', alternate: true };
}
