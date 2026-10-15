import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import type { NoFieldValue, RicheseNoField } from '../game/richese-no-field';
import { defaultHarassWithdrawAllocation } from '../game/harass-withdraw';
import { stageEcazOccupyCard } from './fixture-ecaz-occupy';
import { holdOccupyCardsTraitor } from './fixture-ecaz-occupy-cards';
import {
  createNoFieldReinforcementsSetup, NO_FIELD_HARASS, NO_FIELD_REINFORCEMENTS,
} from './fixture-no-field-reinforcements';
import {
  ecazOccupyRicheseFixture, openOccupyRichese, finishOccupyRichese, nextOccupyRichese,
  occupyRicheseSeat, type EcazOccupyRicheseFixture,
} from './fixture-ecaz-occupy-richese';

export type EcazOccupyMixedNoFieldOptions = {
  /** Original fresh Advanced setup; the independent cards must already be selected. */
  initial?: Game;
  lead?: 'ecaz' | 'ally';
  marker?: NoFieldValue;
  ordinary?: number;
  richeseReserves?: number;
  ecazReserves?: number;
  variableDial?: number;
  support?: number;
  opposingTraitor?: boolean;
};
export type EcazOccupyMixedNoFieldPlan = 'plain' | 'harass' | 'reinforcements' | 'both';
export type EcazOccupyMixedNoFieldFixture = {
  source: EcazOccupyRicheseFixture;
  initial: Game;
  afterSetup: Game;
  /** Admitted coalition, before choosing the lead. */
  beforeLead: Game;
  /** Native preparation complete, before either sealed plan; game is the same control. */
  preplan: Game;
  game: Game;
  owner: string;
  ecaz: string;
  ally: string;
  richese: string;
  opponent: string;
  territory: string;
  location: string;
  ordinary: number;
  marker: NoFieldValue;
  materializes: number;
  noField: RicheseNoField;
  fixedEcazDial: number;
  variableDial: number;
  support: number;
  opposingTraitor: boolean;
  plans: Record<EcazOccupyMixedNoFieldPlan | 'opponent', Action>;
  staging: string[];
};

/** Native Advanced variable ALLY with ordinary counters plus its own concealed
 * marker. The shared source performs setup, Nexus, conserved board staging,
 * actual No-Field shipment and battle admission. No phase/window is replaced. */
export function ecazOccupyMixedNoFieldFixture(
  options: EcazOccupyMixedNoFieldOptions = {},
): EcazOccupyMixedNoFieldFixture {
  const marker = options.marker ?? 3;
  const ordinary = options.ordinary ?? 2;
  assert.ok(Number.isSafeInteger(ordinary) && ordinary > 0);
  const source = ecazOccupyRicheseFixture({
    initial: options.initial ?? createNoFieldReinforcementsSetup(),
    allyFaction: 'richese', opponentFaction: 'guild', marker,
    mixedRicheseForces: ordinary, richeseReserves: options.richeseReserves ?? 6,
  });
  assert.equal(source.initial.ecazTreachery, true,
    'Select the original independent H/R inventory before native setup, not afterward.');
  const owner = options.lead === 'ecaz' ? source.ecaz : source.richese;
  // Preserve every original physical face, including auction acquisitions,
  // before staging two utility faces in a hand below the native four-card cap.
  for (const player of source.game.players) {
    source.game.deck.push(...player.hand);
    player.hand = [];
  }
  stageEcazOccupyCard(source.game, owner, card => card.id === NO_FIELD_HARASS);
  stageEcazOccupyCard(source.game, owner, card => card.id === NO_FIELD_REINFORCEMENTS);
  source.staging.push('Return all unselected original hands to the actual remaining deck; stage only the original Harass & Withdraw and Reinforcements identities in the selected lead hand.');
  if (options.ecazReserves !== undefined) {
    const player = occupyRicheseSeat(source.game, source.ecaz);
    assert.ok(Number.isSafeInteger(options.ecazReserves) && options.ecazReserves >= 0 && options.ecazReserves <= player.reserves);
    const relocated = player.reserves - options.ecazReserves;
    if (relocated) player.forces['polar_sink:0'] = (player.forces['polar_sink:0'] ?? 0) + relocated;
    player.reserves -= relocated;
    source.staging.push(`Conserve Ecaz counters: move ${relocated} unused reserves to Polar Sink, leaving ${options.ecazReserves} own reserves.`);
  }
  const beforeLead = structuredClone(source.game);
  const game = openOccupyRichese(source, options.lead ?? 'ally');
  const profile = viewGame(game, owner).battle?.ecazOccupy?.profile;
  assert.ok(profile);
  const noField = structuredClone(occupyRicheseSeat(game, source.richese).noField!);
  assert.ok(noField.deployed);
  const materializes = Math.min(marker, occupyRicheseSeat(game, source.richese).reserves);
  const physicalTraitors = new Set([...(game.traitorReserve ?? []), ...game.players.flatMap(player => player.traitors)]);
  const leader = occupyRicheseSeat(game, owner).leaders
    .filter(face => !face.dead && !face.usedAt && (!options.opposingTraitor || physicalTraitors.has(face.id)))
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  const enemyLeader = occupyRicheseSeat(game, source.opponent).leaders
    .filter(face => !face.dead && !face.usedAt)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(leader && enemyLeader);
  if (options.opposingTraitor) {
    holdOccupyCardsTraitor(game, source.opponent, leader.id);
    source.staging.push(`Exchange an actual original Traitor Card for ${leader.id} in the opposing hand.`);
  }
  const variableDial = options.variableDial ?? Math.min(3, ordinary + materializes);
  const support = options.support ?? variableDial;
  const plain: Action = { type: 'battlePlan', dial: profile.fixedEcazDial + variableDial,
    support, leader: leader.id };
  return {
    source, initial: source.initial, afterSetup: source.afterSetup, beforeLead,
    preplan: game, game, owner, ecaz: source.ecaz, ally: source.ally, richese: source.richese,
    opponent: source.opponent, territory: source.territory, location: source.location,
    ordinary, marker, materializes, noField, fixedEcazDial: profile.fixedEcazDial,
    variableDial, support, opposingTraitor: options.opposingTraitor ?? false,
    plans: { plain, harass: { ...plain, defense: NO_FIELD_HARASS },
      reinforcements: { ...plain, weapon: NO_FIELD_REINFORCEMENTS },
      both: { ...plain, weapon: NO_FIELD_REINFORCEMENTS, defense: NO_FIELD_HARASS },
      opponent: { type: 'battlePlan', dial: 0, support: 0, leader: enemyLeader.id } },
    staging: source.staging,
  };
}

/** The second actual seal, not this helper, produces the native reveal receipt. */
export function sealEcazOccupyMixedNoField(fixture: EcazOccupyMixedNoFieldFixture,
  plan: EcazOccupyMixedNoFieldPlan = 'plain', state = fixture.game): Game {
  const first = applyAction(state, fixture.owner, fixture.plans[plan]);
  return applyAction(first, fixture.opponent, fixture.plans.opponent);
}

/** Consume real allocation/response/Traitor decisions, then native aftermath,
 * including any original CHOAM market. Never clear a live decision or window. */
export function finishEcazOccupyMixedNoField(fixture: EcazOccupyMixedNoFieldFixture,
  state: Game): { afterVotes: Game; game: Game } {
  let game = state;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (game.response || game.phaseOpening) {
      game = nextOccupyRichese(game);
      continue;
    }
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
    if (!voter) return { afterVotes: game, game: finishOccupyRichese(game) };
    game = applyAction(game, voter, { type: 'traitorCall', call: fixture.opposingTraitor && voter === fixture.opponent });
  }
  throw Error('Mixed Occupy native declaration windows did not finish.');
}
