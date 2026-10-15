import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazOccupyGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import type { NoFieldValue } from '../game/richese-no-field';
import { defaultHarassWithdrawAllocation } from '../game/harass-withdraw';
import { stageEcazOccupyCard } from './fixture-ecaz-occupy';
import { holdOccupyCardsTraitor } from './fixture-ecaz-occupy-cards';
import {
  ecazOccupyRicheseFixture, finishOccupyRichese, nextOccupyRichese, occupyRicheseSeat,
  type EcazOccupyRicheseFixture,
} from './fixture-ecaz-occupy-richese';

export type NoFieldFullPlanOccupyOptions = {
  initial?: Game;
  lead?: 'ecaz' | 'ally';
  marker?: NoFieldValue;
  richeseReserves?: number;
  ordinary?: number;
  prevented?: boolean;
  utilities?: boolean;
  opposingTraitor?: boolean;
  variableDial?: number;
  support?: number;
};
export type NoFieldFullPlanOccupyFixture = EcazOccupyRicheseFixture & {
  source: EcazOccupyRicheseFixture;
  beforeLead: Game;
  prescience: Game;
  owner: string;
  atreides: string;
  inspectionCard: string;
  preventionCard: string | null;
  ordinary: number;
  marker: NoFieldValue;
  materializes: number;
  fixedEcazDial: number;
  variableDial: number;
  support: number;
  targetPlan: Action;
  atreidesPlan: Action;
  utilities: boolean;
  opposingTraitor: boolean;
};

/** Select the independent physical three-card source before the one original
 * initialization. A captured setup is instead continued without redealing. */
export function createNoFieldFullPlanOccupySetup(): Game {
  const roster = ['ecaz', 'richese', 'atreides', 'choam'] as const;
  let game = createGame('NOFIELDFULLPLANOCCUPY', newPlayer(roster[0], roster[0], roster[0]), true, ['ecaz', 'choam']);
  for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  for (let i = roster.length - 1; i >= 0; i--)
    if (viewGame(game, roster[i]).playerPositions[roster[i]] !== i + 1)
      game = applyAction(game, roster[i], { type: 'seatPosition', position: i + 1 });
  for (const faction of roster) game = applyAction(game, faction, { type: 'ready' });
  game.ecazTreachery = true;
  return initializeEcazOccupyGameForAudit(game);
}

/** The driver never consumes the boundary that the actual control must offer. */
export function advanceNoFieldFullPlanOccupy(state: Game, boundary: 'prescience' | 'offer'): Game {
  let game = state;
  for (let attempt = 0; attempt < 160; attempt++) {
    const prepared = !game.battle?.preLeader || game.battle.preLeader.closed;
    if (!game.response && !game.phaseOpening && prepared &&
      (boundary === 'prescience'
        ? game.battle?.preparation?.kind === 'prescience'
        : game.decision?.kind === 'fullPlanOffer')) return game;
    assert.notEqual(game.decision?.kind, 'fullPlanOffer', 'Do not auto-decline a real full-plan offer.');
    assert.notEqual(!game.response && !game.phaseOpening && prepared && game.battle?.preparation?.kind, 'prescience',
      'Ordinary Prescience requires an explicit choice before advancing to the special offer.');
    game = nextOccupyRichese(game);
  }
  throw Error(`Native coalition continuation did not reach ${boundary}.`);
}

/** The shared fixture performs genuine setup, Nexus alliance, native token
 * shipment and chooseBattle. Only labeled conserved card/Traitor staging follows. */
export function noFieldFullPlanOccupyFixture(options: NoFieldFullPlanOccupyOptions = {}): NoFieldFullPlanOccupyFixture {
  const marker = options.marker ?? 3;
  const ordinary = options.ordinary ?? 2;
  assert.ok(Number.isSafeInteger(ordinary) && ordinary >= 0);
  const source = ecazOccupyRicheseFixture({
    initial: options.initial ?? (options.utilities ? createNoFieldFullPlanOccupySetup() : undefined),
    opponentFaction: 'atreides', marker, mixedRicheseForces: ordinary,
    richeseReserves: options.richeseReserves ?? 6,
  });
  if (options.utilities) assert.equal(source.initial.ecazTreachery, true);
  const owner = options.lead === 'ecaz' ? source.ecaz : source.richese;
  const atreides = source.opponent;
  const inspectionCard = occupyRicheseSeat(source.game, atreides).hand.find(card => card.effect === 'karama')!.id;
  // Return, do not replace, unselected original cards. Keep the actual Karama
  // already staged by the shared source; all subsequent draws use that same deck.
  for (const player of source.game.players) {
    const returned = player.hand.filter(card => card.id !== inspectionCard);
    source.game.deck.push(...returned);
    player.hand = player.hand.filter(card => card.id === inspectionCard);
  }
  source.staging.push('Return all unselected original held cards to the remaining native deck; retain the original Atreides inspection Karama and stage only the selected real battle faces.');
  const preventionCard = options.prevented
    ? stageEcazOccupyCard(source.game, 'choam', card => card.effect === 'karama' && card.id !== inspectionCard)
    : null;
  if (preventionCard) source.staging.push(`Conserve distinct original CHOAM Karama ${preventionCard} for the actual Occupy response.`);
  const weapon = stageEcazOccupyCard(source.game, owner, card => options.utilities
    ? card.id === 'ecaz-reinforcements' : card.kind === 'projectile');
  const defense = stageEcazOccupyCard(source.game, owner, card => options.utilities
    ? card.id === 'ecaz-harass-withdraw' : card.kind === 'shield');
  const enemyDefense = stageEcazOccupyCard(source.game, atreides,
    card => card.kind === 'shield' && card.id !== defense);
  const physicalTraitors = new Set([...(source.game.traitorReserve ?? []),
    ...source.game.players.flatMap(player => player.traitors)]);
  const leader = occupyRicheseSeat(source.game, owner).leaders
    .filter(face => !face.dead && !face.usedAt && (!options.opposingTraitor || physicalTraitors.has(face.id)))
    .sort((a, b) => b.strength - a.strength)[0];
  const enemyLeader = occupyRicheseSeat(source.game, atreides).leaders
    .filter(face => !face.dead && !face.usedAt).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(leader && enemyLeader);
  if (options.opposingTraitor) {
    holdOccupyCardsTraitor(source.game, atreides, leader.id);
    source.staging.push(`Exchange an original held Traitor Card for actual ${leader.id} in the Atreides hand.`);
  }
  const beforeLead = structuredClone(source.game);
  assert.equal(source.game.decision?.kind, 'ecazBattleLead');
  let game = applyAction(source.game, source.ecaz, { type: 'decision', event: source.game.decision!.event, lead: owner });
  if (preventionCard) {
    assert.equal(game.response?.kind, 'ecazOccupy');
    game = applyAction(game, 'choam', { type: 'card', mode: 'cancel', card: preventionCard });
  }
  const prescience = advanceNoFieldFullPlanOccupy(game, 'prescience');
  const profile = viewGame(prescience, owner).battle!.ecazOccupy!.profile!;
  assert.ok(profile);
  const materializes = Math.min(marker, occupyRicheseSeat(prescience, source.richese).reserves);
  const variableDial = options.variableDial ?? Math.min(3, profile.forces.normal);
  const support = options.support ?? variableDial;
  return {
    ...source, source, beforeLead, game: prescience, prescience, owner, atreides,
    inspectionCard, preventionCard, ordinary, marker, materializes,
    fixedEcazDial: profile.fixedEcazDial, variableDial, support,
    targetPlan: { type: 'battlePlan', dial: profile.fixedEcazDial + variableDial,
      support, leader: leader.id, weapon, defense },
    atreidesPlan: { type: 'battlePlan', dial: 0, support: 0, leader: enemyLeader.id, defense: enemyDefense },
    utilities: options.utilities ?? false, opposingTraitor: options.opposingTraitor ?? false,
  };
}

export function offerNoFieldFullPlanOccupy(fixture: NoFieldFullPlanOccupyFixture, state = fixture.prescience): Game {
  assert.equal(state.battle?.preparation?.kind, 'prescience');
  return advanceNoFieldFullPlanOccupy(applyAction(state, fixture.atreides, { type: 'declineBattlePower' }), 'offer');
}
export function inspectNoFieldFullPlanOccupy(fixture: NoFieldFullPlanOccupyFixture,
  state = offerNoFieldFullPlanOccupy(fixture)): Game {
  return applyAction(state, fixture.atreides,
    { type: 'card', mode: 'special', card: fixture.inspectionCard, target: fixture.owner });
}

/** Real post-reveal allocation and declaration windows, including an optional
 * actual opposing Traitor call; never assigns an outcome or clears a decision. */
export function finishNoFieldFullPlanOccupy(fixture: NoFieldFullPlanOccupyFixture, state: Game): Game {
  let game = state;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (game.response || game.phaseOpening) { game = nextOccupyRichese(game); continue; }
    if (game.decision?.kind === 'harassWithdraw') {
      const decision = game.decision;
      const allocation = viewGame(game, decision.player).battle?.harassAllocation;
      assert.ok(allocation);
      game = applyAction(game, decision.player, { type: 'decision', event: decision.event,
        returns: defaultHarassWithdrawAllocation(allocation.context, allocation.dial, allocation.support) });
      continue;
    }
    const battle = viewGame(game, fixture.owner).battle;
    const voter = !game.decision && battle?.traitorVoters.find(id => !battle.traitorSubmitted.includes(id));
    if (!voter) return finishOccupyRichese(game);
    game = applyAction(game, voter,
      { type: 'traitorCall', call: fixture.opposingTraitor && voter === fixture.atreides });
  }
  throw Error('Native inspected coalition declarations did not finish.');
}
