import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import {
  advancedNativePlayer, completeAdvancedNativeSkillsSetup, initializeAdvancedNativeSkillsSetup,
} from './fixture-advanced-native-skills';
import { takeHarassCard } from './fixture-harass-withdraw';
import { nextSkillsTechBattleStep, type SkillsTechBattleStep } from './fixture-skills-tech-battle';
import { quoteSpiceBankerIncomeBattleEconomics } from './fixture-spice-banker-income';

export type SmugglerArtilleryJourneyOptions = { weapon?: 'artillery' | 'stunner'; ownTraitor?: boolean };
export type SmugglerArtilleryJourney = {
  initial: Game; afterSetup: Game; beforeBattle: Game; game: Game;
  owner: string; opponent: string; observer: string; leader: string; opposingLeader: string;
  territory: string; key: string; printedAmount: number; cap: number;
  weapon: string; shields: [string, string]; ownTraitor: boolean;
  plans: [SkillsTechBattleStep, SkillsTechBattleStep];
  shipments: { before: Game; action: Action; actor: string; after: Game; price: number }[];
  movements: { before: Game; action: Action; actor: string; after: Game }[];
  steps: SkillsTechBattleStep[]; staging: string[];
};

export const smugglerArtilleryPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
};
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision && !g.pendingTreacheryDiscard;
const act = (game: Game, actor: string, action: Action, steps: SkillsTechBattleStep[]) => {
  steps.push({ actor, action: structuredClone(action) }); return applyAction(game, actor, action);
};
function next(game: Game): SkillsTechBattleStep {
  if (game.decision?.kind === 'leaderSkillVisibility')
    return { actor: game.decision.player, action: { type: 'leaderSkillVisibility',
      event: game.decision.event, hide: game.decision.player === 'emperor' } };
  return nextSkillsTechBattleStep(game);
}
function advance(state: Game, until: (game: Game) => boolean, steps: SkillsTechBattleStep[]): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1000; n++) {
    assert.equal(game.turn, 1, 'Continue only this original first-turn programme');
    assert.equal(game.status, 'playing');
    assert.notEqual(game.decision?.kind, 'smugglerCollection', 'This single printed pile requires no allocation choice');
    const step = next(game); game = act(game, step.actor, step.action, steps);
  }
  assert.ok(until(game), 'Reach the exact original native action boundary'); return game;
}

/** Fresh native Ix original47 + all14 setup, Emperor's actual Smuggler offer and
 * trainer choice, zero first-Storm dials, real eight-spice Red Chasm blow. Both
 * combatants pay to ship two normal counters to South Mesa, then really move
 * them one territory into Red Chasm. No live army, wallet, phase, order, owner,
 * skill assignment or receipt is assigned. Physical staging is listed below.
 */
export function createSmugglerArtilleryJourney(
  options: SmugglerArtilleryJourneyOptions = {},
): SmugglerArtilleryJourney {
  const owner = 'emperor', opponent = 'guild', observer = 'ixians';
  const initial = createGame('SMUGGLERARTILLERY', newPlayer(owner, owner, 'emperor'), true, ['ix']);
  joinGame(initial, newPlayer(observer, observer, 'ixians'));
  joinGame(initial, newPlayer(opponent, opponent, 'guild'));
  const setupOptions = { family: 'ixians' as const, requestedSkill: 'smuggler' as const,
    skillOwner: 'emperor' as const, opponents: ['guild'] as const, initial };
  let game = completeAdvancedNativeSkillsSetup(initializeAdvancedNativeSkillsSetup(setupOptions), setupOptions);
  const afterSetup = structuredClone(game), steps: SkillsTechBattleStep[] = [];
  const staging = [
    'Control only the first original all14 shuffle so Emperor is offered Smuggler; choose its original eligible Hasimir Fenring disc through the setup action.',
    'Position original unopened Red Chasm (8 spice, sector 7) and Broken Land non-worm Spice Cards before the first native Spice Blow; no pile is assigned.',
  ];
  for (const [position, territory] of ['red_chasm', 'broken_land'].entries()) {
    const index = game.spiceDeck.findIndex(card => 'territory' in card && card.territory === territory);
    assert.ok(index >= 0); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  const territory = 'red_chasm', key = 'red_chasm:7', printedAmount = 8;
  const shipments: SmugglerArtilleryJourney['shipments'] = [];
  const movements: SmugglerArtilleryJourney['movements'] = [];
  game = advance(game, g => g.phase === 5 && clean(g), steps);
  assert.equal(game.spice[key], printedAmount);
  while (game.phase === 5) {
    if (!clean(game)) { const step = next(game); game = act(game, step.actor, step.action, steps); continue; }
    const actor = game.active!;
    if ([owner, opponent].includes(actor)) {
      const before = structuredClone(game);
      const action: Action = { type: 'ship', territory: 'south_mesa', sector: 5, amount: 2, elite: 0, allyPayment: 0 };
      game = act(game, actor, action, steps);
      game = advance(game, clean, steps);
      const price = actor === owner ? 4 : 2;
      assert.equal(smugglerArtilleryPlayer(before, actor).spice - smugglerArtilleryPlayer(game, actor).spice, price);
      shipments.push({ before, action, actor, after: structuredClone(game), price });
      const beforeMove = structuredClone(game);
      const movement: Action = { type: 'move', from: 'south_mesa:5', territory, sector: 7, amount: 2, elite: 0 };
      game = act(game, actor, movement, steps);
      game = advance(game, clean, steps);
      movements.push({ before: beforeMove, action: movement, actor, after: structuredClone(game) });
      assert.equal(smugglerArtilleryPlayer(game, actor).forces[key], 2);
    }
    game = act(game, actor, { type: 'endMovement' }, steps);
  }
  game = advance(game, g => g.phase === 6 && clean(g), steps);
  // Return starting hands, including the native Ix setup stock, before taking
  // canonical physical cards. These are conserved transfers, not purchases.
  for (const player of game.players) game.deck.push(...player.hand.splice(0));
  const physicalWeapon = treacheryDeck(['ix']).find(card => options.weapon === 'stunner'
    ? card.name === 'Stunner' : card.kind === 'artillery');
  assert.ok(physicalWeapon);
  const weapon = takeHarassCard(game, owner, physicalWeapon.id).id;
  const shieldFaces = game.deck.filter(card => card.kind === 'shield').slice(0, 2);
  assert.equal(shieldFaces.length, 2);
  const shields: [string, string] = [takeHarassCard(game, owner, shieldFaces[0].id).id,
    takeHarassCard(game, opponent, shieldFaces[1].id).id];
  staging.push(`Conserve all original starting hands back to undealt stock, then transfer original ${physicalWeapon.name} (${weapon}) and Shield ${shields[0]} to Emperor, Shield ${shields[1]} to Guild. No card is created or purchased.`);
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === owner && a.skill === 'smuggler');
  assert.ok(assignment);
  const leader = assignment.leader;
  const cap = advancedNativePlayer(game, 'emperor').leaders.find(l => l.id === leader)!.strength;
  assert.equal(cap, 6);
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const opposing = smugglerArtilleryPlayer(game, opponent).leaders.filter(l => !l.dead && !trained.has(l.id))
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(opposing);
  if (options.ownTraitor && !smugglerArtilleryPlayer(game, owner).traitors.includes(opposing.id)) {
    const own = smugglerArtilleryPlayer(game, owner), returned = own.traitors[0];
    const index = game.traitorReserve!.indexOf(opposing.id);
    const donor = game.players.find(p => p.id !== owner && p.traitors.includes(opposing.id));
    assert.ok(returned && (index >= 0 || donor));
    if (index >= 0) game.traitorReserve![index] = returned;
    else donor!.traitors[donor!.traitors.indexOf(opposing.id)] = returned;
    own.traitors[0] = opposing.id;
    staging.push(`Conserve original Traitor ${opposing.id}: exchange Emperor's ${returned} with ${donor?.id ?? 'original reserve'}; no reveal history is assigned.`);
  }
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(c => c.territory === territory);
  assert.ok(choice);
  game = act(game, choice.chooser, { type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker }, steps);
  game = advance(game, g => !!g.battle && clean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false, steps);
  const plans: SmugglerArtilleryJourney['plans'] = [
    { actor: owner, action: { type: 'battlePlan', leader, dial: 1, support: 1, weapon, defense: shields[0] } },
    { actor: opponent, action: { type: 'battlePlan', leader: opposing.id, dial: 0, support: 0, defense: shields[1] } },
  ];
  assert.deepEqual(game.battle!.plans, {});
  assert.equal(game.spice[key], printedAmount);
  return { initial, afterSetup, beforeBattle, game, owner, opponent, observer, leader, opposingLeader: opposing.id,
    territory, key, printedAmount, cap, weapon, shields, ownTraitor: options.ownTraitor ?? false,
    plans, shipments, movements, steps, staging };
}

export function revealSmugglerArtilleryJourney(f: SmugglerArtilleryJourney, steps: SkillsTechBattleStep[] = []): Game {
  let game = structuredClone(f.game);
  for (const plan of f.plans) {
    game = act(game, plan.actor, plan.action, steps);
    game = advance(game, g => !!g.battle && clean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false, steps);
  }
  assert.ok(game.battle?.revealed); return game;
}

/** Original own call first; the other seat explicitly declines. Stop at the
 * winner's real optional card cleanup, after payout but before Collection.
 * The independent native quote uses the actual own call and the pending other
 * seat's no-call, never a rewritten live battle or a synthetic weapon effect.
 */
export function settleSmugglerArtilleryJourney(state: Game, f: SmugglerArtilleryJourney,
  steps: SkillsTechBattleStep[] = []) {
  let game = advance(state, g => !!g.battle?.revealed && clean(g), steps);
  game = act(game, f.owner, { type: 'traitorCall', call: f.ownTraitor }, steps);
  game = advance(game, g => !!g.battle?.revealed && clean(g), steps);
  const beforeResolution = structuredClone(game);
  const resolution = quoteSpiceBankerIncomeBattleEconomics(beforeResolution, beforeResolution).resolution;
  game = act(game, f.opponent, { type: 'traitorCall', call: false }, steps);
  game = advance(game, g => g.decision?.kind === 'battleCards' && !g.response && !g.phaseOpening, steps);
  assert.equal(game.decision?.player, f.owner);
  assert.equal(game.phase, 6);
  assert.ok(game.lastBattleContext?.smugglerCollection);
  return { game, beforeResolution, resolution };
}

/** Keep the winner's optional cards and resume the real next Collection. */
export function finishSmugglerArtilleryJourney(state: Game, steps: SkillsTechBattleStep[] = []): Game {
  assert.equal(state.decision?.kind, 'battleCards');
  const game = act(state, state.decision!.player, { type: 'decision', discard: [] }, steps);
  return advance(game, g => g.phase === 7 && clean(g), steps);
}
