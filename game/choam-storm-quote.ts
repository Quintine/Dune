import type { Game, Decision } from './engine';
import { gameTerritories, splitLocation, territory } from './board';
import { validateStormTraversal } from './disaster-preflight';

export class ChoamStormQuoteError extends Error {}
function requireStorm(value: unknown, message: string): asserts value {
  if (!value) throw new ChoamStormQuoteError(message);
}
function exposed(g: Game, key: string) {
  const t = territory(splitLocation(key).territory);
  return (
    (t.type === 'sand' && t.id !== 'imperial_basin') ||
    (g.shieldWallDestroyed &&
      ['arrakeen', 'carthag', 'imperial_basin'].includes(t.id))
  );
}
/** Public threat computation only. Private hand contents never select an offer. */
export function choamStormTerritories(g: Game) {
  const choam = g.players.find((p) => p.faction === 'choam');
  const r = g.stormResolution;
  if (!choam || !r || r.traversed !== 0) return [];
  const crossed = new Set(
    Array.from({ length: r.distance }, (_, i) => ((r.from + i) % 18) + 1),
  );
  return gameTerritories(g)
    .filter((t) => !r.choamProtected?.includes(t.id))
    .flatMap((t) => {
      const forces = Object.entries(choam.forces).filter(
        ([key, n]) =>
          n > 0 &&
          splitLocation(key).territory === t.id &&
          exposed(g, key) &&
          crossed.has(splitLocation(key).sector),
      );
      return forces.length
        ? [
            {
              territory: t.id,
              amount: forces.reduce((sum, [, n]) => sum + n, 0),
              sectors: forces.map(([key]) => splitLocation(key).sector),
            },
          ]
        : [];
    });
}
export type ChoamStormQuote =
  | { kind: 'decision'; decision: Extract<Decision, { kind: 'choamStorm' }> }
  | { kind: 'protection' };
/** Quote the current public offer without moving the storm, revealing markers,
 * assigning casualty choices, or settling the later Fremen response. */
export function quoteChoamStormOffer(g: Game): ChoamStormQuote {
  try {
    const r = g.stormResolution;
    requireStorm(
      r &&
        r.traversed === 0 &&
        Array.isArray(r.pending) &&
        r.pending.length === 0 &&
        g.storm === r.from,
      'The CHOAM storm offer must precede its original untraversed storm.',
    );
    const protectedTerritories =
      r.choamProtected === undefined ? [] : r.choamProtected;
    requireStorm(
      Array.isArray(protectedTerritories) &&
        new Set(protectedTerritories).size === protectedTerritories.length &&
        protectedTerritories.every(
          (id) =>
            typeof id === 'string' &&
            gameTerritories(g).some((t) => t.id === id),
        ),
      'The storm needs a valid set of prior CHOAM protections.',
    );
    validateStormTraversal(g);
    const choam = g.players.find((p) => p.faction === 'choam');
    const territories = choamStormTerritories(g);
    if (choam && territories.length)
      return {
        kind: 'decision',
        decision: {
          kind: 'choamStorm',
          player: choam.id,
          territories,
          protected: [...protectedTerritories],
        },
      };
    return { kind: 'protection' };
  } catch (error) {
    if (error instanceof ChoamStormQuoteError) throw error;
    throw new ChoamStormQuoteError(
      error instanceof Error
        ? error.message
        : 'Malformed CHOAM storm continuation.',
    );
  }
}
