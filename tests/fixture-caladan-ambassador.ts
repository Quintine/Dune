import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import {
  caladanVictoryFixture,
  holdVictoryCard,
  victoryInventory as inventory,
  victoryPlayer as p,
} from './fixture-caladan-victory';

/** Real final native/Ecaz/Harkonnen/BG setup and battle dispatch, with
 * staged positions and Ambassador tokens to exercise entry effects without fabricating victory receipts. */
export function caladanAmbassadorFixture(seatIds: Record<string, string> = {}) {
  const id = (key: string) => seatIds[key] ?? key;
  const g = caladanVictoryFixture({
    advanced: true,
    seatIds,
    extraSeats: [
      { id: 'ec', faction: 'ecaz' },
      { id: 'h', faction: 'harkonnen' },
      { id: 'bg', faction: 'beneGesserit' },
    ],
  });
  g.expansions.push('ecaz');
  g.order = g.players.map((player) => player.id);
  for (const player of [p(g, id('a')), p(g, id('g'))]) {
    player.forces['arrakeen:10'] = player.forces['hagga_basin:12'];
    delete player.forces['hagga_basin:12'];
  }
  p(g, id('ec')).ally = id('h');
  p(g, id('h')).ally = id('ec');
  p(g, id('ec')).forces = { 'red_chasm:7': 1 };
  p(g, id('ec')).reserves = 19;
  p(g, id('bg')).forces = { 'sietch_tabr:14': 1 };
  p(g, id('bg')).reserves = 19;
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
  holdVictoryCard(g, id('ec'), 'karama');
  inventory(g);
  return g;
}
