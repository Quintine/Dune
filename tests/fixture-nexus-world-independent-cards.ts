import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { combatArmy } from '../game/combat-location';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { RECRUITS_CARD_ID } from '../game/recruits';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import {
  createClassicIndependentNexusFixture, advanceClassicIndependentNexus,
  type ClassicIndependentNexusOptions, type ClassicIndependentNexusStep,
} from './fixture-classic-independent-nexus';
import { applyClassicDiscoveryNexusStep, nextClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export type WorldIndependentCardStep = ClassicIndependentNexusStep;
export type WorldIndependentCardOptions = Pick<ClassicIndependentNexusOptions, 'advanced' | 'skills' | 'tech' | 'strongholds'>;
export const worldIndependentCardPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const worldIndependentCardsClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingGuildBetrayal &&
  !game.pendingNexusHarkonnenBetrayal && !game.pendingNexusIxianBetrayal;

/** Only still-unopened original Spice Cards are ordered. Neither a clock nor
 * any army, payment, card hand or battle outcome is assigned. */
function orderOriginalLandBlows(game: Game, turns: number): void {
  for (let index = 0; index < turns * (game.advanced ? 2 : 1); index++) {
    const source = game.spiceDeck.findIndex((card, position) => position >= index && 'territory' in card && !card.discovery);
    assert.ok(source >= index);
    game.spiceDeck.splice(index, 0, game.spiceDeck.splice(source, 1)[0]);
  }
}
function nextWorldIndependentCardStep(game: Game): WorldIndependentCardStep | null {
  if (!game.phaseOpening && !game.response) {
    const decision = game.decision;
    if (decision?.kind === 'harassWithdraw') return null;
    if (decision?.kind === 'homeworldDefense')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, use: false } };
    if (decision?.kind === 'homeworldExplosion')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, choice: 0 } };
    if (decision?.kind === 'homeworldRevivalDeployment' || decision?.kind === 'caladanReinforcement')
      return { actor: decision.player, action: { type: 'decision', event: decision.event, decline: true } };
  }
  return nextClassicDiscoveryNexusStep(game);
}
export function actWorldIndependentCard(game: Game, actor: string, action: Action,
  actions?: WorldIndependentCardStep[]): Game {
  return applyClassicDiscoveryNexusStep(game, { actor, action }, actions);
}
/** Reuse public native controls and legal Nexus acknowledgement. Sealed plans
 * and typed Harass allocations stay explicit human-owned actions. */
export function advanceWorldIndependentCards(game: Game, until: (state: Game) => boolean,
  actions: WorldIndependentCardStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original game ended before the requested card action');
    if (game.pendingGuildBetrayal) {
      game = advanceClassicIndependentNexus(game, state => !state.pendingGuildBetrayal, actions);
      continue;
    }
    const step = nextWorldIndependentCardStep(game);
    assert.ok(step, `A real human plan/allocation is required at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actWorldIndependentCard(game, step.actor, step.action, actions);
  }
  throw Error('Original Nexus/World card programme did not reach its requested boundary');
}

/** Fresh selected classic independent36/Nexus12/Homeworlds only. The physical
 * card is dealt from the original shuffle, not moved out of a played hand. */
export function createWorldIndependentRecruitsFixture(options: WorldIndependentCardOptions = {}) {
  const source = createClassicIndependentNexusFixture({ ...options, independent: true, homeworlds: true,
    roster: ['emperor', 'fremen', 'atreides', 'guild'], startingCards: { emperor: [RECRUITS_CARD_ID] } });
  let game = structuredClone(source.game);
  const afterSetup = structuredClone(game), actions = source.actions;
  orderOriginalLandBlows(game, 2);
  const staging = [...source.staging, 'Order two original non-worm Spice Blows before they are drawn; hold the genuinely dealt Recruits through real native battles.'];
  const act = (actor: string, action: Action) => { game = actWorldIndependentCard(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceWorldIndependentCards(game, until, actions); };
  const shipments = new Map<string, { amount: number; elite: number; territory: string; sector: number }>([
    ['emperor', { amount: 3, elite: 0, territory: 'sietch_tabr', sector: 14 }],
    ['fremen', { amount: 8, elite: 3, territory: 'sietch_tabr', sector: 14 }],
    ['guild', { amount: 3, elite: 0, territory: 'arrakeen', sector: 10 }],
  ]);
  reach(state => state.phase === 5 && worldIndependentCardsClean(state));
  while (game.phase === 5) {
    const actor = game.active!, request = worldIndependentCardsClean(game) ? shipments.get(actor) : undefined;
    if (request) {
      const sources = nativeShipmentSources(viewGame(game, actor), request.amount, request.elite); assert.ok(sources);
      act(actor, { type: 'ship', ...request, homeworldSources: sources });
      shipments.delete(actor);
    } else {
      const step = nextWorldIndependentCardStep(game); assert.ok(step); act(step.actor, step.action);
    }
  }
  assert.equal(shipments.size, 0);
  reach(state => state.phase === 6 && worldIndependentCardsClean(state));
  while (game.phase === 6) {
    if (worldIndependentCardsClean(game) && !game.battle && game.active) {
      const choice = viewGame(game, game.active).battleChoices[0]; assert.ok(choice);
      act(choice.chooser, { type: 'chooseBattle', territory: choice.territory,
        target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
    }
    if (game.battle && !game.battle.revealed) {
      reach(state => worldIndependentCardsClean(state) && !state.battle?.preparation && state.battle?.preLeader?.closed !== false);
      const battle = game.battle!;
      for (const actor of [battle.attacker, battle.defender]) {
        if (game.battle!.plans[actor]) continue;
        // Keep optional assigned skill discs out of this focused printed-rate
        // case; they remain genuinely assigned in their original physical pool.
        const leaders = worldIndependentCardPlayer(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt &&
          !game.leaderSkills?.assignments.some(assignment => assignment.owner === actor && assignment.leader === leader.id))
          .sort((a, b) => a.strength - b.strength);
        const leader = actor === 'emperor' || actor === 'guild' ? leaders.at(-1) : leaders[0]; assert.ok(leader);
        act(actor, { type: 'battlePlan', leader: leader.id, dial: 0, support: 0 });
        reach(state => worldIndependentCardsClean(state) && !state.battle?.preparation && state.battle?.preLeader?.closed !== false);
      }
    } else {
      const step = nextWorldIndependentCardStep(game); assert.ok(step); act(step.actor, step.action);
    }
  }
  reach(state => state.turn === 2 && state.phase === 4 && worldIndependentCardsClean(state));
  assert.equal(worldIndependentCardPlayer(game, 'fremen').reserves, 2);
  assert.equal(worldIndependentCardPlayer(game, 'fremen').tanks, 18);
  assert.ok(worldIndependentCardPlayer(game, 'emperor').hand.some(card => card.id === RECRUITS_CARD_ID));
  return { ...source, afterSetup, game, actions, staging };
}

/** Original typed invasion of a foreign World, or a native defender's legal
 * own-World rejection. The Harass card is held from its native starting deal. */
export function createWorldIndependentHarassFixture(options: WorldIndependentCardOptions & { native?: boolean } = {}) {
  const source = createClassicIndependentNexusFixture({ ...options, independent: true, homeworlds: true,
    roster: ['emperor', 'guild', 'atreides'], startingCards: { emperor: [HARASS_WITHDRAW_CARD] } });
  let game = structuredClone(source.game);
  const afterSetup = structuredClone(game), actions = source.actions;
  orderOriginalLandBlows(game, 1);
  const staging = [...source.staging, 'Order the unopened original first non-worm Spice Blow; use real typed native invasion and sealed plans.'];
  const owner = 'emperor', native = options.native ? owner : 'guild', visitor = options.native ? 'guild' : owner;
  const location = options.native ? 'homeworld:emperor' : 'homeworld:guild';
  game = advanceWorldIndependentCards(game, state => state.phase === 5 && state.active === visitor && worldIndependentCardsClean(state), actions);
  const beforeShipment = structuredClone(game);
  const sources = nativeShipmentSources(viewGame(game, visitor), options.native ? 5 : 7, options.native ? 0 : 4); assert.ok(sources);
  const quote = homeworldShipmentChoice(viewGame(game, visitor), location,
    Object.fromEntries(Object.entries(sources).filter(([, force]) => force.normal + force.elite > 0)));
  assert.ok(quote.action, quote.blocked ?? 'The original native invasion must have a paid typed route');
  const shipmentStep: WorldIndependentCardStep = { actor: visitor, action: quote.action };
  game = actWorldIndependentCard(game, visitor, quote.action, actions);
  game = advanceWorldIndependentCards(game, state => !state.pendingHomeworldShipment && !state.pendingShipment && worldIndependentCardsClean(state), actions);
  const afterShipment = structuredClone(game);
  assert.deepEqual(combatArmy(game, visitor, location), options.native ? { normal: 5, elite: 0 } : { normal: 3, elite: 4 });
  game = advanceWorldIndependentCards(game, state => state.phase === 6 && !!state.active && worldIndependentCardsClean(state), actions);
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices.find(battle => battle.territory === location);
  assert.ok(choice);
  const battleStep: WorldIndependentCardStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory: location,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  game = actWorldIndependentCard(game, battleStep.actor, battleStep.action, actions);
  game = advanceWorldIndependentCards(game, state => !!state.battle && !state.battle.preparation &&
    state.battle.preLeader?.closed !== false && worldIndependentCardsClean(state), actions);
  const leaders = (actor: string) => worldIndependentCardPlayer(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt &&
    !game.leaderSkills?.assignments.some(assignment => assignment.owner === actor && assignment.leader === leader.id))
    .sort((a, b) => a.strength - b.strength);
  const ownLeader = leaders(owner)[0], otherLeader = leaders('guild').at(-1); assert.ok(ownLeader && otherLeader);
  const plans: WorldIndependentCardStep[] = [
    { actor: owner, action: { type: 'battlePlan', dial: options.native ? 0 : 2, support: options.advanced && !options.native ? 1 : 0,
      leader: ownLeader.id, defense: HARASS_WITHDRAW_CARD } },
    { actor: 'guild', action: { type: 'battlePlan', dial: options.native ? 0 : 3, support: options.advanced && !options.native ? 3 : 0,
      leader: otherLeader.id } },
  ];
  return { ...source, afterSetup, game, actions, staging, owner, native, visitor, location,
    beforeShipment, shipmentStep, afterShipment, beforeBattle, battleStep, plans,
    returns: { [location]: { normal: 2, elite: 3 } } };
}
export function revealWorldIndependentHarass(game: Game, plans: readonly WorldIndependentCardStep[], actions: WorldIndependentCardStep[] = []) {
  for (const plan of plans) {
    game = actWorldIndependentCard(game, plan.actor, plan.action, actions);
    game = advanceWorldIndependentCards(game, state => !!state.battle && !state.battle.preparation &&
      state.battle.preLeader?.closed !== false && (!state.decision || state.decision.kind === 'harassWithdraw') &&
      !state.phaseOpening && !state.response, actions);
  }
  assert.ok(game.battle?.revealed); return game;
}
