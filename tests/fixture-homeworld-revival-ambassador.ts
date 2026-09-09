import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import {
  homeworldRevivalFixture,
  enterHomeworldRevival,
  holdRevivalCard,
  revivalPlayer as p,
  revivalInventory as inventory,
} from './fixture-homeworld-revival';

/** Genuine final native/Ecaz/BG revival roster with staged positions: no
 * fabricated revival, Ambassador, response or continuation receipt. */
export function homeworldRevivalAmbassadorFixture(
  seatIds: Record<string, string> = {},
) {
  const id = (key: string) => seatIds[key] ?? key;
  const g = homeworldRevivalFixture({
    advanced: true,
    tleilaxu: true,
    seatIds,
    extraSeats: [
      { id: 'ec', faction: 'ecaz' },
      { id: 'bg', faction: 'beneGesserit' },
      { id: 'a', faction: 'atreides' },
    ],
  });
  g.expansions.push('ecaz');
  g.order = g.players.map((player) => player.id);
  p(g, id('ec')).ally = id('a');
  p(g, id('a')).ally = id('ec');
  p(g, id('bg')).forces = { 'sietch_tabr:14': 1 };
  p(g, id('bg')).reserves = 19;
  p(g, id('ec')).forces = { 'red_chasm:7': 1 };
  p(g, id('ec')).reserves = 19;
  const state = createAmbassadors(() => 0);
  const first = state.tokens.find((token) => token.effect === 'guild')!;
  const second = state.tokens.find((token) => token.effect === 'fremen')!;
  state.cohort = [
    first.id,
    second.id,
    ...state.tokens
      .filter(
        (token) =>
          token.effect !== 'ecaz' &&
          token.id !== first.id &&
          token.id !== second.id,
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
    [first, 'arrakeen'],
    [second, 'sietch_tabr'],
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
  inventory(g);
  const entered = enterHomeworldRevival(g);
  holdRevivalCard(entered, id('ec'), 'karama');
  return entered;
}
