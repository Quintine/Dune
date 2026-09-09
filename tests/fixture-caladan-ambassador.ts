import { newPlayer } from '../game/engine';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import {
  caladanVictoryFixture,
  holdVictoryCard,
  victoryInventory as inventory,
  victoryPlayer as p,
} from './fixture-caladan-victory';

/** Real native setup and battle dispatch, with an explicit Ecaz/Harkonnen/BG
 * scenario seam to exercise entry effects without fabricating victory receipts. */
export function caladanAmbassadorFixture() {
  const g = caladanVictoryFixture({ advanced: true });
  for (const [id, faction] of [
    ['ec', 'ecaz'],
    ['h', 'harkonnen'],
    ['bg', 'beneGesserit'],
  ] as const) {
    const player = newPlayer(id, faction, faction);
    Object.assign(player, {
      reserves: 20,
      tanks: 0,
      forces: {},
      hand: [],
      traitors: [],
      traitorChoices: [],
      spice: 20,
    });
    g.players.push(player);
  }
  g.expansions.push('ecaz');
  g.order = g.players.map((player) => player.id);
  for (const player of [p(g, 'a'), p(g, 'g')]) {
    player.forces['arrakeen:10'] = player.forces['hagga_basin:12'];
    delete player.forces['hagga_basin:12'];
  }
  p(g, 'ec').ally = 'h';
  p(g, 'h').ally = 'ec';
  p(g, 'ec').forces = { 'red_chasm:7': 1 };
  p(g, 'ec').reserves = 19;
  p(g, 'bg').forces = { 'sietch_tabr:14': 1 };
  p(g, 'bg').reserves = 19;
  const state = createAmbassadors(() => 0);
  const guild = state.tokens.find((token) => token.effect === 'guild')!;
  const fremen = state.tokens.find((token) => token.effect === 'fremen')!;
  state.cohort = [
    guild.id,
    fremen.id,
    ...state.tokens
      .filter(
        (token) =>
          token.effect !== 'ecaz' &&
          token.id !== guild.id &&
          token.id !== fremen.id,
      )
      .slice(0, 3)
      .map((token) => token.id),
  ];
  for (const token of state.tokens) {
    token.zone =
      token.effect === 'ecaz' || state.cohort.includes(token.id)
        ? 'supply'
        : 'pool';
    token.location = null;
  }
  g.ecazAmbassadors = state;
  for (const [token, destination] of [
    [guild, 'arrakeen'],
    [fremen, 'sietch_tabr'],
  ] as const)
    g.ecazAmbassadors = placeAmbassador(g.ecazAmbassadors, token.id, {
      turn: 1,
      availableSpice: 20,
      destination: {
        id: destination,
        stronghold: true,
        inStorm: false,
        allowed: true,
      },
    }).state;
  holdVictoryCard(g, 'ec', 'karama');
  inventory(g);
  return g;
}
