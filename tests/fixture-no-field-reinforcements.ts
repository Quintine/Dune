import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazOccupyGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import type { NoFieldValue, RicheseNoField } from '../game/richese-no-field';
import { defaultHarassWithdrawAllocation } from '../game/harass-withdraw';
import { stageEcazOccupyCard } from './fixture-ecaz-occupy';
import { holdOccupyCardsTraitor } from './fixture-ecaz-occupy-cards';
import {
  ecazOccupyRicheseFixture, openOccupyRichese, finishOccupyRichese,
  occupyRicheseSeat, type EcazOccupyRicheseFixture,
} from './fixture-ecaz-occupy-richese';

export const NO_FIELD_REINFORCEMENTS = 'ecaz-reinforcements';
export const NO_FIELD_HARASS = 'ecaz-harass-withdraw';
export type NoFieldReinforcementsOptions = {
  initial?: Game;
  marker?: NoFieldValue;
  richeseReserves?: number;
  lead?: 'ecaz' | 'ally';
  ecazReserves?: number;
  opposingTraitor?: boolean;
  omitPreview?: boolean;
};
export type NoFieldReinforcementsFixture = {
  source: EcazOccupyRicheseFixture;
  initial: Game;
  afterSetup: Game;
  game: Game;
  owner: string;
  ecaz: string;
  ally: string;
  richese: string;
  opponent: string;
  territory: string;
  location: string;
  marker: NoFieldValue;
  noField: RicheseNoField;
  materializes: number;
  reservesBefore: Record<string, number>;
  fixedEcazDial: number;
  variableDial: number;
  opposingTraitor: boolean;
  plans: { both: Action; reinforcements: Action; harass: Action; plain: Action; opponent: Action };
  staging: string[];
};

/** Select the independent physical cards BEFORE the original admitted deal. */
export function createNoFieldReinforcementsSetup(): Game {
  const roster = ['ecaz', 'richese', 'guild', 'choam'] as const;
  let game = createGame('NOFIELDREINFORCEMENTS', newPlayer(roster[0], roster[0], roster[0]),
    true, ['ecaz', 'choam']);
  for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  for (let index = roster.length - 1; index >= 0; index--) {
    if (viewGame(game, roster[index]).playerPositions[roster[index]] !== index + 1)
      game = applyAction(game, roster[index], { type: 'seatPosition', position: index + 1 });
  }
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game.ecazTreachery = true;
  // Only the original initializer is deterministic. Native setup decisions,
  // shipment, marker identities and subsequent phase windows remain real.
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return initializeEcazOccupyGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Before either private plan: actual original setup, Nexus alliance, No-Field
 * shipment, Occupy lead and native preleader readiness. No marker or window is
 * assigned, cleared, removed/recreated or replaced with a synthetic receipt. */
export function noFieldReinforcementsFixture(options: NoFieldReinforcementsOptions = {}): NoFieldReinforcementsFixture {
  const marker = options.marker ?? 3;
  const source = ecazOccupyRicheseFixture({
    initial: options.initial ?? createNoFieldReinforcementsSetup(),
    allyFaction: 'richese', opponentFaction: 'guild', marker,
    richeseReserves: options.richeseReserves ?? 6, omitPreview: options.omitPreview,
  });
  assert.equal(source.initial.ecazTreachery, true);
  const owner = options.lead === 'ecaz' ? source.ecaz : source.richese;
  // Return every unselected real face to the conserved remaining deck first;
  // two staged utility cards never leave an over-limit native hand behind.
  for (const player of source.game.players) {
    source.game.deck.push(...player.hand);
    player.hand = [];
  }
  source.staging.push('After native shipment/admission: return unselected original hands to the remaining deck, then stage the two original utility faces in the actual lead hand.');
  stageEcazOccupyCard(source.game, owner, card => card.id === NO_FIELD_REINFORCEMENTS);
  stageEcazOccupyCard(source.game, owner, card => card.id === NO_FIELD_HARASS);
  if (options.ecazReserves !== undefined) {
    const ecaz = occupyRicheseSeat(source.game, source.ecaz);
    assert.ok(Number.isSafeInteger(options.ecazReserves) && options.ecazReserves >= 0 && options.ecazReserves <= ecaz.reserves);
    const staged = ecaz.reserves - options.ecazReserves;
    if (staged) ecaz.forces['polar_sink:0'] = (ecaz.forces['polar_sink:0'] ?? 0) + staged;
    ecaz.reserves -= staged;
    source.staging.push(`Conserve Ecaz counters: retain ${options.ecazReserves} own reserves and move ${staged} unused own reserves to Polar Sink.`);
  }
  const game = openOccupyRichese(source, options.lead ?? 'ally');
  const profile = viewGame(game, owner).battle?.ecazOccupy?.profile;
  assert.ok(profile);
  const noField = structuredClone(occupyRicheseSeat(game, source.richese).noField!);
  assert.ok(noField.deployed);
  assert.equal(noField.deployed.tokenId, noField.lastShipped);
  assert.deepEqual(noField.tokens, occupyRicheseSeat(source.afterSetup, source.richese).noField!.tokens);
  const physicalTraitors = new Set([...(game.traitorReserve ?? []), ...game.players.flatMap(player => player.traitors)]);
  const actorLeader = occupyRicheseSeat(game, owner).leaders
    .filter(leader => !leader.dead && !leader.usedAt && (!options.opposingTraitor || physicalTraitors.has(leader.id)))
    .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
  const enemyLeader = occupyRicheseSeat(game, source.opponent).leaders
    .filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(actorLeader && enemyLeader);
  if (options.opposingTraitor) {
    holdOccupyCardsTraitor(game, source.opponent, actorLeader.id);
    source.staging.push(`Conserved original Traitor Card exchange gives ${source.opponent} the selected real leader ${actorLeader.id}.`);
  }
  const variableDial = marker === 0 ? 0 : 1;
  const plain: Action = { type: 'battlePlan', dial: profile.fixedEcazDial + variableDial,
    support: variableDial, leader: actorLeader.id };
  return {
    source, initial: source.initial, afterSetup: source.afterSetup, game, owner,
    ecaz: source.ecaz, ally: source.ally, richese: source.richese, opponent: source.opponent,
    territory: source.territory, location: source.location, marker, noField,
    materializes: Math.min(marker, occupyRicheseSeat(game, source.richese).reserves),
    reservesBefore: Object.fromEntries(game.players.map(player => [player.id, player.reserves])),
    fixedEcazDial: profile.fixedEcazDial, variableDial,
    opposingTraitor: options.opposingTraitor ?? false,
    plans: {
      plain,
      both: { ...plain, weapon: NO_FIELD_REINFORCEMENTS, defense: NO_FIELD_HARASS },
      reinforcements: { ...plain, weapon: NO_FIELD_REINFORCEMENTS },
      harass: { ...plain, defense: NO_FIELD_HARASS },
      opponent: { type: 'battlePlan', dial: 0, support: 0, leader: enemyLeader.id },
    },
    staging: source.staging,
  };
}

/** Actual second sealed plan invokes the original native marker revelation. */
export function sealNoFieldReinforcements(fixture: NoFieldReinforcementsFixture,
  plan: 'both' | 'reinforcements' | 'harass' | 'plain' = 'both', state = fixture.game): Game {
  let game = applyAction(state, fixture.owner, fixture.plans[plan]);
  game = applyAction(game, fixture.opponent, fixture.plans.opponent);
  return game;
}

/** Revealed physical allocation, native Traitor votes, then the shared native
 * Occupy aftermath driver. Returns both the after-vote and completed controls. */
export function finishNoFieldReinforcements(fixture: NoFieldReinforcementsFixture, state: Game): {
  afterVotes: Game; game: Game;
} {
  let game = state;
  if (game.decision?.kind === 'harassWithdraw') {
    const decision = game.decision;
    const allocation = viewGame(game, decision.player).battle?.harassAllocation;
    assert.ok(allocation);
    game = applyAction(game, decision.player, { type: 'decision', event: decision.event,
      returns: defaultHarassWithdrawAllocation(allocation.context, allocation.dial, allocation.support) });
  }
  for (let attempt = 0; attempt < 10 && game.battle; attempt++) {
    const battle = viewGame(game, fixture.owner).battle;
    assert.ok(battle);
    const voter = battle.traitorVoters.find(id => !battle.traitorSubmitted.includes(id));
    if (!voter) break;
    game = applyAction(game, voter, { type: 'traitorCall',
      call: fixture.opposingTraitor && voter === fixture.opponent });
  }
  const afterVotes = game;
  return { afterVotes, game: finishOccupyRichese(game) };
}
