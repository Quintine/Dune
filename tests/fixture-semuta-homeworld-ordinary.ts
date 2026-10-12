import assert from 'node:assert/strict';
import {
  applyAction, type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { createSemutaHomeworldGuildIncomeFixture } from './fixture-semuta-homeworld-guild-income';
import {
  moveSemutaEmperorCard, semutaEmperorCardId, semutaEmperorPlayer,
} from './fixture-semuta-emperor-share';

export type SemutaHomeworldOrdinaryFixture = {
  game: Game; source: Game; holder: string; owner: string; semuta: string;
  hajr: string; action: Action;
};

/** Genuine original Homeworld occupation state already at an active Movement
 * owner. Only conserved later physical cards isolate this ordinary play; the
 * occupation epoch, custody, wallets and clocks stay native. */
export function createSemutaHomeworldOrdinaryFixture(): SemutaHomeworldOrdinaryFixture {
  const income = createSemutaHomeworldGuildIncomeFixture({ advanced: false });
  const game = income.game;
  assert.equal(game.phase, 5);
  assert.equal(game.active, 'a');
  const holder = income.holder, owner = income.canceller;
  assert.equal(semutaEmperorPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID), true);
  const hajr = moveSemutaEmperorCard(game,
    semutaEmperorCardId(game, card => card.effect === 'hajr'), 'a');
  assert.ok(semutaEmperorPlayer(game, 'a').hand.some(card => card.id === hajr));
  return { game, source: income.game, holder, owner, semuta: SEMUTA_DRUG_ID, hajr,
    action: { type: 'card', card: hajr } };
}

export function reactSemutaHomeworldOrdinary(
  state: Game, fixture: SemutaHomeworldOrdinaryFixture, claim: boolean,
): Game {
  const event = state.pendingTreacheryDiscard!.batch.event;
  if (claim) return applyAction(state, fixture.holder, { type: 'semutaCommit', event });
  let game = state;
  for (const player of state.players)
    game = applyAction(game, player.id, { type: 'semutaPass', event });
  return game;
}

/** Homeworld authority that an ordinary card play must not disturb. */
export function semutaHomeworldOrdinaryState(game: Game) {
  return {
    homeworlds: game.homeworlds,
    history: game.homeworldOccupationHistory,
    percentages: game.homeworldOccupiedPercentageLedger,
    players: game.players.map(player => ({
      id: player.id, faction: player.faction, ally: player.ally, spice: player.spice,
      reserves: player.reserves, tanks: player.tanks, forces: player.forces,
      elites: player.elites, shipped: player.shipped, moved: player.moved,
    })),
  };
}
