import { newPlayer } from '../game/engine';
import { createAmbassadors, placeAmbassador } from '../game/ecaz-ambassadors';
import {
  homeworldRevivalFixture,
  enterHomeworldRevival,
  holdRevivalCard,
  revivalPlayer as p,
  revivalInventory as inventory,
} from './fixture-homeworld-revival';

/** Genuine native revival fixture plus an explicit Ecaz/BG faction seam: no
 * fabricated revival, Ambassador, response or continuation receipt. */
export function homeworldRevivalAmbassadorFixture() {
  const g = homeworldRevivalFixture({ advanced: true, tleilaxu: true });
  for (const [id, faction] of [
    ['ec', 'ecaz'],
    ['bg', 'beneGesserit'],
    ['a', 'atreides'],
  ] as const) {
    const player = newPlayer(id, faction, faction);
    Object.assign(player, {
      reserves: 20,
      forces: {},
      tanks: 0,
      spice: 20,
      hand: [],
      traitors: [],
      traitorChoices: [],
    });
    g.players.push(player);
  }
  g.expansions.push('ecaz');
  g.order = g.players.map((player) => player.id);
  p(g, 'ec').ally = 'a';
  p(g, 'a').ally = 'ec';
  p(g, 'bg').forces = { 'sietch_tabr:14': 1 };
  p(g, 'bg').reserves = 19;
  p(g, 'ec').forces = { 'red_chasm:7': 1 };
  p(g, 'ec').reserves = 19;
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
  holdRevivalCard(entered, 'ec', 'karama');
  return entered;
}
