import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import type { Card } from '../game/cards';
import {
  advanceIndependentCardModules, createIndependentCardModulesFixture,
  nextIndependentCardModulesStep, type IndependentCardModulesStep,
} from './fixture-independent-card-modules';

export const MODULE_REINFORCEMENTS = 'ecaz-reinforcements';
export const MODULE_HARASS = 'ecaz-harass-withdraw';
export type BattleCardModulesStep = IndependentCardModulesStep;
export type BattleCardModulesOptions = {
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  /** Native Ixian normal-first mixed fee plus earned Sietch Tabr income. */
  route?: 'arrakeen' | 'ix-sietch';
  dial?: number;
  opponentDial?: number;
  ownerLeader?: 'strongest' | 'weakest';
  /** Conserved physical identity exchange, not a synthetic traitor receipt. */
  opposingTraitor?: boolean;
  slot?: 'weapon' | 'defense';
  /** Two-seat Advanced Strongholds without Tech uses the same original route. */
  players?: 2 | 3;
};
export type BattleCardModulesFixture = {
  initial: Game;
  afterSetup: Game;
  beforeMentat: Game;
  mentatStep: BattleCardModulesStep;
  afterMentat: Game;
  beforeShipment: Game;
  shipmentStep: BattleCardModulesStep;
  afterShipment: Game;
  beforeBattle: Game;
  battleStep: BattleCardModulesStep;
  /** Both original combatants may now seal their plans. */
  game: Game;
  owner: string;
  opponent: string;
  location: string;
  route: 'arrakeen' | 'ix-sietch';
  plans: { both: BattleCardModulesStep; opponent: BattleCardModulesStep };
  nativeSteps: BattleCardModulesStep[];
  staging: string[];
};

export function battleCardModulesPlayer(game: Game, actor: string) {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, `Missing original ${actor} seat`);
  return player;
}
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;

/** Only actual native decisions; unsealed plans deliberately remain human work. */
export function nextBattleCardModulesStep(game: Game): BattleCardModulesStep | null {
  return nextIndependentCardModulesStep(game);
}
export function advanceBattleCardModules(game: Game, until: (state: Game) => boolean,
  steps: BattleCardModulesStep[] = []): Game {
  return advanceIndependentCardModules(game, until, steps);
}

/** Explicit physical staging only. All original cards retain exactly one zone. */
function positionCard(game: Game, actor: string, id: string, staging: string[]) {
  const player = battleCardModulesPlayer(game, actor);
  if (player.hand.some(card => card.id === id)) return;
  const zones: { label: string; cards: Card[] }[] = [
    { label: 'remaining original deck', cards: game.deck },
    { label: 'original discard', cards: game.discard },
    ...game.players.filter(p => p.id !== actor).map(p => ({ label: `${p.id}'s hand`, cards: p.hand })),
  ];
  const source = zones.find(zone => zone.cards.some(card => card.id === id));
  assert.ok(source, `Original physical ${id} is missing`);
  if (player.hand.length >= 4) {
    const index = player.hand.findIndex(card => ![MODULE_HARASS, MODULE_REINFORCEMENTS].includes(card.id));
    assert.ok(index >= 0);
    const [returned] = player.hand.splice(index, 1);
    game.deck.push(returned);
    staging.push(`Physical staging: ${returned.id}, ${actor}'s hand → remaining original deck (printed hand limit).`);
  }
  player.hand.push(source.cards.splice(source.cards.findIndex(card => card.id === id), 1)[0]);
  staging.push(`Physical staging: conserved ${id}, ${source.label} → ${actor}'s hand; no purchase or replacement face.`);
}
function positionTraitor(game: Game, actor: string, identity: string, staging: string[]) {
  const player = battleCardModulesPlayer(game, actor);
  if (player.traitors.includes(identity)) return;
  const returned = player.traitors[0];
  assert.ok(returned);
  const reserve = game.traitorReserve?.indexOf(identity) ?? -1;
  const donor = game.players.find(p => p.id !== actor && p.traitors.includes(identity));
  assert.ok(reserve >= 0 || donor, 'Requested original identity must still have physical custody');
  if (reserve >= 0) game.traitorReserve![reserve] = returned;
  else donor!.traitors[donor!.traitors.indexOf(identity)] = returned;
  player.traitors[0] = identity;
  staging.push(`Physical staging: conserved traitor ${identity} from ${donor?.id ?? 'original reserve'} exchanged for ${actor}'s ${returned}.`);
}

/**
 * Original setup → paid first-turn Ix shipment (when selected) → original END
 * Mentat ownership → paid next-turn attack → original Heighliners settlement →
 * native battle/preparation. No phase, wallet, force, owner, control or history
 * assignment. Original Storm Cards remain unmodified; every possible turn-two
 * distance leaves these printed strongholds safe after zero opening dials.
 */
export function createBattleCardModulesFixture(options: BattleCardModulesOptions = {}): BattleCardModulesFixture {
  const route = options.route ?? 'arrakeen';
  const advanced = options.advanced ?? true;
  const tech = options.tech ?? true;
  const strongholds = options.strongholds ?? advanced;
  const players = options.players ?? 3;
  assert.ok(!strongholds || advanced, 'Stronghold Cards require Advanced');
  assert.ok(!tech || players === 3, 'Original Tech setup requires three seats');
  assert.ok(route !== 'ix-sietch' || advanced, 'The mixed native fee route is Advanced');
  assert.ok(route !== 'ix-sietch' || players === 3, 'The native Ix route retains its original three-seat roster');
  const source = createIndependentCardModulesFixture({ advanced, tech, strongholds,
    factions: route === 'ix-sietch' ? ['ixians', 'atreides', 'guild'] :
      players === 2 ? ['emperor', 'atreides'] : ['emperor', 'atreides', 'guild'],
    expansions: route === 'ix-sietch' ? ['ix'] : [],
  });
  let game = source.game;
  const afterSetup = structuredClone(game);
  const nativeSteps = source.steps;
  const staging: string[] = [];
  const owner = route === 'ix-sietch' ? 'ixians' : 'atreides';
  const opponent = route === 'ix-sietch' ? 'atreides' : 'emperor';
  const territory = route === 'ix-sietch' ? 'sietch_tabr' : 'arrakeen';
  const sector = route === 'ix-sietch' ? 14 : 10;
  const location = `${territory}:${sector}`;
  const act = (step: BattleCardModulesStep): Game => {
    nativeSteps.push(structuredClone(step));
    game = applyAction(game, step.actor, step.action);
    return game;
  };
  const advance = (until: (state: Game) => boolean) => {
    game = advanceBattleCardModules(game, until, nativeSteps);
  };
  if (route === 'ix-sietch') {
    advance(g => g.turn === 1 && g.phase === 5 && g.active === owner && clean(g));
    // The original fourteen reserves contain ten normal and four cyborgs.
    // Shipping eight normal leaves precisely two normal for the three-force fee.
    act({ actor: owner, action: { type: 'ship', territory, sector, amount: 8, elite: 0 } });
  }
  advance(g => g.turn === 1 && g.phase === 8 && clean(g));
  if (strongholds) {
    assert.equal(game.strongholdCards!.claimedTurn, 0);
    assert.ok(Object.values(game.strongholdCards!.owners).every(id => id === null));
  }
  let beforeMentat: Game | undefined;
  let mentatStep: BattleCardModulesStep | undefined;
  while (game.turn === 1) {
    const next = nextBattleCardModulesStep(game);
    assert.ok(next);
    const before = structuredClone(game);
    const after = act(next);
    if (after.turn === 2) { beforeMentat = before; mentatStep = next; }
  }
  assert.ok(beforeMentat && mentatStep);
  if (strongholds) {
    assert.equal(game.strongholdCards!.claimedTurn, 1);
    assert.equal(game.strongholdCards!.owners[territory], owner);
  }
  const afterMentat = structuredClone(game);
  advance(g => g.turn === 2 && g.phase === 5 && g.active === opponent && clean(g));
  const beforeShipment = structuredClone(game);
  const shipmentStep: BattleCardModulesStep = { actor: opponent,
    action: { type: 'ship', territory, sector, amount: 4, elite: 0 } };
  act(shipmentStep);
  const afterShipment = structuredClone(game);
  advance(g => g.phase === 6 && clean(g));
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === territory);
  assert.ok(choice, 'Only the actual paid native armies may open this battle');
  const battleStep: BattleCardModulesStep = { actor: choice.chooser,
    action: { type: 'chooseBattle', territory,
      target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep);
  advance(g => !!g.battle && !g.battle.preparation &&
    (!g.battle.preLeader || g.battle.preLeader.closed) && clean(g));
  positionCard(game, owner, MODULE_REINFORCEMENTS, staging);
  positionCard(game, owner, MODULE_HARASS, staging);
  const available = (actor: string) => battleCardModulesPlayer(game, actor).leaders
    .filter(leader => !leader.dead && (!leader.usedAt || leader.usedAt === territory));
  const ownLeader = available(owner).sort((a, b) =>
    (options.ownerLeader === 'weakest' ? a.strength - b.strength : b.strength - a.strength) ||
    a.id.localeCompare(b.id))[0];
  const otherLeader = available(opponent).sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(ownLeader && otherLeader);
  if (options.opposingTraitor) positionTraitor(game, opponent, ownLeader.id, staging);
  const dial = options.dial ?? (route === 'ix-sietch' ? 1 : 3);
  const opponentDial = options.opponentDial ?? (route === 'ix-sietch' ? 2 : 0);
  const slot = options.slot ?? 'weapon';
  const plans = {
    both: { actor: owner, action: { type: 'battlePlan', dial, support: advanced && route !== 'ix-sietch' ? dial : 0,
      leader: ownLeader.id, weapon: slot === 'weapon' ? MODULE_REINFORCEMENTS : MODULE_HARASS,
      defense: slot === 'weapon' ? MODULE_HARASS : MODULE_REINFORCEMENTS } },
    opponent: { actor: opponent, action: { type: 'battlePlan', dial: opponentDial,
      support: advanced ? opponentDial : 0, leader: otherLeader.id } },
  } satisfies Record<string, BattleCardModulesStep>;
  return { initial: source.initial, afterSetup, beforeMentat, mentatStep, afterMentat,
    beforeShipment, shipmentStep, afterShipment, beforeBattle, battleStep, game,
    owner, opponent, location, route, plans, nativeSteps, staging };
}

export function sealBattleCardModules(fixture: BattleCardModulesFixture,
  steps: BattleCardModulesStep[] = []): Game {
  let game = fixture.game;
  for (const step of [fixture.plans.both, fixture.plans.opponent]) {
    steps.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  return game;
}
export function callBattleCardModules(game: Game, calls: readonly string[] = [],
  steps: BattleCardModulesStep[] = []): Game {
  for (const actor of viewGame(game, game.host).battle!.traitorVoters) {
    const step: BattleCardModulesStep = { actor, action: { type: 'traitorCall', call: calls.includes(actor) } };
    steps.push(step); game = applyAction(game, actor, step.action);
  }
  return game;
}
/** Completes original mandatory Tech/cleanup/aftercare, including automatic phase income. */
export function finishBattleCardModules(game: Game, steps: BattleCardModulesStep[] = []): Game {
  return advanceBattleCardModules(game, g => !g.battle && clean(g) && !g.pendingTreacheryDiscard, steps);
}
