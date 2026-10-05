import assert from 'node:assert/strict';
import { applyAction, handLimit, viewGame, type Action, type Game, type Player } from '../game/engine';
import { territory } from '../game/board';
import type { Card } from '../game/cards';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { createStrongholdCards, strongholdControllers, type StrongholdId } from '../game/stronghold-cards';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import {
  advanceClassicDiscoverySkills, classicDiscoverySkillsClean, createClassicDiscoverySkillsFixture,
  nextClassicDiscoverySkillsStep, revealClassicDiscoverySkills,
  type ClassicDiscoverySkillsFixture, type ClassicDiscoverySkillsOptions,
} from './fixture-discovery-classic-skills';
import { finishClassicSkillsStrongholdBattle, nextClassicSkillsStrongholdStep } from './fixture-classic-skills-stronghold';

export type DiscoverySkillsStrongholdsStep = { actor: string; action: Action };
export type DiscoverySkillsStrongholdsOptions = {
  /** Fresh authenticated lobby or original undealt setup, never a played save. */
  initial?: Game;
  tech?: boolean;
  kind?: Exclude<StrongholdId, 'hidden_mobile_stronghold'>;
  holder?: 'owner' | 'unclaimed';
  skill?: LeaderSkillId;
  hide?: boolean;
  nestedBattle?: boolean;
  ownerDial?: number;
  support?: number;
  opponentDial?: number;
  opponentSupport?: number;
  ownerWeapon?: Card['kind'];
  ownerDefense?: Card['kind'];
  opponentWeapon?: Card['kind'];
  opponentDefense?: Card['kind'];
  skillOwner?: ClassicDiscoverySkillsOptions['skillOwner'];
};
export type DiscoverySkillsStrongholdsFixture = {
  discovery: ClassicDiscoverySkillsFixture;
  initial: Game;
  setup: Game;
  beforeFirstMentat: Game;
  firstMentatStep: DiscoverySkillsStrongholdsStep;
  entryWindow: Game;
  entryStep: DiscoverySkillsStrongholdsStep;
  entered: Game;
  shipmentWindow: Game;
  paidShipmentStep: DiscoverySkillsStrongholdsStep;
  game: Game;
  owner: string;
  opponent: string;
  leader: string;
  kind: StrongholdId;
  key: string;
  hide: boolean;
  actions: DiscoverySkillsStrongholdsStep[];
  planActions: DiscoverySkillsStrongholdsStep[];
  staging: string[];
};
export function discoverySkillsStrongholdsPlayer(game: Game, actor: string): Player {
  const player = game.players.find(candidate => candidate.id === actor);
  assert.ok(player); return player;
}
function reserveExcept(game: Game, keep: string[]): void {
  for (const player of game.players) for (const key of Object.keys(player.forces)) {
    if (keep.includes(key)) continue;
    const elite = player.elites?.forces[key] ?? 0;
    player.reserves += player.forces[key];
    if (player.elites) { player.elites.reserves += elite; delete player.elites.forces[key]; }
    delete player.forces[key];
    if (player.advisors) delete player.advisors[key.split(':')[0]];
  }
}
function place(game: Game, actor: string, key: string, amount: number): void {
  const player = discoverySkillsStrongholdsPlayer(game, actor);
  assert.ok(player.reserves - (player.elites?.reserves ?? 0) >= amount);
  player.reserves -= amount; player.forces[key] = (player.forces[key] ?? 0) + amount;
}
function held(game: Game, actor: string, matches: (card: Card) => boolean, staging: string[], used: string[] = []): Card {
  const player = discoverySkillsStrongholdsPlayer(game, actor);
  const match = (card: Card) => matches(card) && !used.includes(card.id);
  const existing = player.hand.find(match); if (existing) return existing;
  assert.ok(player.hand.length < handLimit(player));
  const index = game.deck.findIndex(match);
  const donor = index < 0 ? game.players.find(candidate => candidate.id !== actor && candidate.hand.some(match)) : undefined;
  assert.ok(index >= 0 || donor, 'Original base33 card custody must supply the staged card.');
  const card = index >= 0 ? game.deck.splice(index, 1)[0] : donor!.hand.splice(donor!.hand.findIndex(match), 1)[0];
  player.hand.push(card);
  staging.push(`Conserved ${card.id}: ${donor?.id ?? 'original deck'} custody to ${actor}'s hand.`);
  return card;
}

/** Exact human sequence: create -> entryStep in entryWindow -> shipping controls
 * in shipmentWindow -> prepare -> planActions -> finish. All phases, training,
 * reveal, first end-Mentat custody and free entry use original actions. Explicit
 * force/card staging conserves counters and base33 custody, not earned receipts. */
export function createDiscoverySkillsStrongholdsFixture(options: DiscoverySkillsStrongholdsOptions = {}): DiscoverySkillsStrongholdsFixture {
  let skill = options.skill;
  if (!skill && options.initial?.status === 'setup') {
    const initial = options.initial;
    const actor = initial.players.find(seat => seat.faction === (options.skillOwner ?? 'guild'))?.id;
    assert.ok(actor && initial.leaderSkills);
    const assignment = initial.leaderSkills.assignments.find(candidate => candidate.owner === actor);
    const view = viewGame(initial, actor).leaderSkills!;
    skill = assignment?.skill ?? initial.leaderSkills.offers[actor]?.cards.find(candidate =>
      !['spice-banker', 'mentat', 'diplomat'].includes(candidate) && !view.unavailableSkills?.[candidate]);
    assert.ok(skill, 'Actual undealt offers need an available source-clear original skill; never substitute an injected offer.');
  }
  const discovery = createClassicDiscoverySkillsFixture({ initial: options.initial, advanced: true,
    strongholdCards: true, tech: options.tech, skill: skill ?? 'suk-graduate', skillOwner: options.skillOwner,
    face: 'cistern', amount: 3 });
  const owner = discovery.collector, opponent = discovery.opponent;
  const kind = options.kind ?? 'arrakeen', hide = options.hide ?? true;
  const strongholdKey = `${kind}:${territory(kind).sectors[0]}`;
  const actions: DiscoverySkillsStrongholdsStep[] = [...discovery.actions];
  const staging = [...discovery.staging];
  let game = revealClassicDiscoverySkills(discovery, actions);
  game = advanceClassicDiscoverySkills(game, state => state.phase === 8 && classicDiscoverySkillsClean(state), actions);
  assert.deepEqual(game.strongholdCards, createStrongholdCards());
  reserveExcept(game, [`${discovery.parent}:${discovery.parentSector}`]);
  if (options.holder !== 'unclaimed') place(game, owner, strongholdKey, 1);
  staging.push('Before original first end-Mentat, conserved all non-source board counters through their own reserves; preserved the three Discovery source forces and placed one ordinary claimant in the named stronghold.');
  let beforeFirstMentat: Game | undefined, firstMentatStep: DiscoverySkillsStrongholdsStep | undefined;
  for (let count = 0; game.turn === 1 && count < 200; count++) {
    const next = nextClassicDiscoverySkillsStep(game), before = structuredClone(game);
    actions.push(next); game = applyAction(game, next.actor, next.action);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  assert.equal(game.strongholdCards!.claimedTurn, 1);
  assert.deepEqual(game.strongholdCards!.owners, strongholdControllers(beforeFirstMentat.players, false));
  assert.equal(game.strongholdCards!.owners[kind], options.holder === 'unclaimed' ? null : owner);
  game = advanceClassicDiscoverySkills(game, state => state.turn === 2 && state.decision?.kind === 'discoveryEntry' && state.decision.player === owner, actions);
  const entryWindow = structuredClone(game), entryView = viewGame(game, owner);
  const entryAction = discoveryEntryMoveAction(entryView, entryView.discoveryEntry!.sources); assert.ok(entryAction);
  const entryStep: DiscoverySkillsStrongholdsStep = { actor: owner, action: entryAction };
  actions.push(entryStep); game = applyAction(game, owner, entryAction);
  const entered = structuredClone(game);
  // Original Weather Control owns a deterministic safe storm, not a staged dial.
  const weather = held(game, owner, card => card.effect === 'weather', staging);
  game = advanceClassicDiscoverySkills(game, state => state.phase === 0 && classicDiscoverySkillsClean(state), actions);
  const weatherStep: DiscoverySkillsStrongholdsStep = { actor: owner, action: { type: 'card', card: weather.id, amount: 0 } };
  actions.push(weatherStep); game = applyAction(game, owner, weatherStep.action);
  game = advanceClassicDiscoverySkills(game, state => state.phase === 5 && state.active === owner && classicDiscoverySkillsClean(state), actions);
  const shipmentWindow = structuredClone(game);
  reserveExcept(game, ['cistern:0']);
  const key = options.nestedBattle ? 'cistern:0' : strongholdKey;
  const ownerForces = discoverySkillsStrongholdsPlayer(game, owner).forces[key] ?? 0;
  place(game, owner, key, 8 - ownerForces); place(game, opponent, key, 8);
  staging.push(`Before original turn-two movement completion, conserved eight ordinary counters per combatant at ${key}; retained three actually entered Cistern forces and original first-Mentat custody.`);
  const used: string[] = [];
  const card = (actor: string, kind: Card['kind'] | undefined): string | null => {
    if (!kind) return null;
    const physical = held(game, actor, candidate => candidate.kind === kind, staging, used);
    used.push(physical.id); return physical.id;
  };
  const ownerWeapon = card(owner, options.ownerWeapon), ownerDefense = card(owner, options.ownerDefense);
  const opponentWeapon = card(opponent, options.opponentWeapon), opponentDefense = card(opponent, options.opponentDefense);
  const untrained = (actor: string) => {
    const eligible = discoverySkillsStrongholdsPlayer(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt &&
      !game.leaderSkills!.assignments.some(assignment => assignment.leader === leader.id));
    const leader = eligible.find(candidate => candidate.strength === 3) ?? eligible[0]; assert.ok(leader); return leader.id;
  };
  const leader = hide ? discovery.leader : untrained(owner);
  const enemyLeader = untrained(opponent);
  game = advanceClassicDiscoverySkills(game, state => state.phase === 6 && !!state.active && classicDiscoverySkillsClean(state), actions);
  const actor = game.active!; assert.ok(actor === owner || actor === opponent);
  const battleStep: DiscoverySkillsStrongholdsStep = { actor, action: { type: 'chooseBattle', territory: options.nestedBattle ? 'cistern' : kind, target: actor === owner ? opponent : owner } };
  actions.push(battleStep); game = applyAction(game, actor, battleStep.action);
  const planActions: DiscoverySkillsStrongholdsStep[] = [
    { actor: owner, action: { type: 'battlePlan', dial: options.ownerDial ?? 4, support: options.support ?? 2, leader, weapon: ownerWeapon, defense: ownerDefense } },
    { actor: opponent, action: { type: 'battlePlan', dial: options.opponentDial ?? 0, support: options.opponentSupport ?? 0, leader: enemyLeader, weapon: opponentWeapon, defense: opponentDefense } },
  ];
  const paidShipmentStep: DiscoverySkillsStrongholdsStep = { actor: owner,
    action: { type: 'ship', territory: 'cistern', sector: 0, amount: 1, elite: 0, allyPayment: 0 } };
  return { discovery, initial: discovery.initial, setup: discovery.setup, beforeFirstMentat, firstMentatStep,
    entryWindow, entryStep, entered, shipmentWindow, paidShipmentStep, game, owner, opponent, leader, kind, key, hide, actions, planActions, staging };
}
export function prepareDiscoverySkillsStrongholdsBattle(fixture: DiscoverySkillsStrongholdsFixture): Game {
  let game = structuredClone(fixture.game);
  for (let count = 0; count < 160; count++) {
    let next = nextClassicSkillsStrongholdStep(game);
    if (!next && game.battle?.preLeader?.closed === false) next = nextClassicDiscoverySkillsStep(game);
    if (!next) { assert.ok(game.battle && !game.battle.revealed); return game; }
    if (next.action.type === 'leaderSkillVisibility') next.action.hide = next.actor === fixture.owner && fixture.hide;
    game = applyAction(game, next.actor, next.action);
  }
  throw Error('Original Discovery skills/Strongholds pre-plan continuation did not open.');
}
export function revealDiscoverySkillsStrongholdsBattle(fixture: DiscoverySkillsStrongholdsFixture): Game {
  let game = prepareDiscoverySkillsStrongholdsBattle(fixture);
  for (const next of fixture.planActions) {
    game = applyAction(game, next.actor, next.action);
    while (game.response || game.phaseOpening || game.decision?.kind === 'fullPlanOffer') {
      const continuation = nextClassicDiscoverySkillsStep(game);
      game = applyAction(game, continuation.actor, continuation.action);
    }
  }
  assert.ok(game.battle?.revealed); return game;
}
export const finishDiscoverySkillsStrongholdsBattle = finishClassicSkillsStrongholdBattle;
