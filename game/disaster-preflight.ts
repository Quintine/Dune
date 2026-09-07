import type { Game, Player, ResponseWindow } from './engine';
import { splitLocation, territory, validLocation } from './board';
import { SPICE_CARDS } from './cards';
import { revealRicheseNoField } from './richese-no-field';

export class DisasterPreflightError extends Error {}
function requireDisaster(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new DisasterPreflightError(message);
}
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
function boardKey(key: string) {
  const loc = splitLocation(key);
  requireDisaster(
    key === `${loc.territory}:${loc.sector}` &&
      validLocation(loc.territory, loc.sector),
    'The disaster needs a valid board location.',
  );
  return loc;
}
function exposed(g: Game, key: string) {
  const t = territory(boardKey(key).territory);
  return (
    (t.type === 'sand' && t.id !== 'imperial_basin') ||
    (!!g.shieldWallDestroyed &&
      ['arrakeen', 'carthag', 'imperial_basin'].includes(t.id))
  );
}
/** Validate only physical groups that this disaster can destroy. Concealed
 * materialization is quoted without allocating its actual reveal event. */
function casualtyCustody(
  g: Game,
  p: Player,
  affected: (key: string) => boolean,
  cause: 'storm' | 'worm',
) {
  let losses = 0,
    eliteLosses = 0;
  for (const key of new Set([
    ...Object.keys(p.forces),
    ...Object.keys(p.elites?.forces ?? {}),
  ])) {
    if (!affected(key)) continue;
    const n = p.forces[key] ?? 0,
      elite = p.elites?.forces[key] ?? 0;
    requireDisaster(
      whole(n) && whole(elite) && elite <= n,
      'Disaster casualties no longer match the ordinary and elite forces.',
    );
    losses += n;
    eliteLosses += elite;
  }
  const marker = p.noField?.deployed;
  if (
    marker &&
    affected(`${marker.location.territory}:${marker.location.sector}`)
  ) {
    requireDisaster(
      marker.controller === p.id && p.faction === 'richese',
      'The exposed No-Field no longer belongs to its force controller.',
    );
    try {
      const reveal = revealRicheseNoField(p.noField!, {
        tokenId: marker.tokenId,
        reserves: p.reserves,
        cause,
      });
      losses += reveal.forces;
    } catch (error) {
      throw new DisasterPreflightError(
        error instanceof Error
          ? error.message
          : 'The exposed No-Field is invalid.',
      );
    }
  }
  requireDisaster(
    whole(p.tanks) &&
      whole(p.tanks + losses) &&
      (!p.elites ||
        (whole(p.elites.tanks) &&
          p.elites.tanks <= p.tanks &&
          whole(p.elites.tanks + eliteLosses))),
    'Disaster casualties need valid remaining tank capacity.',
  );
}
export function validateStormTraversal(g: Game) {
  const r = g.stormResolution;
  requireDisaster(
    g.status === 'playing' &&
      g.phase === 0 &&
      r &&
      whole(r.from) &&
      r.from >= 0 &&
      r.from <= 18 &&
      whole(r.distance) &&
      r.distance <= 40 &&
      whole(r.traversed) &&
      r.traversed <= r.distance &&
      Array.isArray(r.pending) &&
      new Set(r.pending).size === r.pending.length,
    'The pending storm needs a valid, finite traversal.',
  );
  const current = ((r.from - 1 + r.traversed) % 18) + 1;
  requireDisaster(
    r.pending.every(
      (key) =>
        r.traversed > 0 && exposed(g, key) && boardKey(key).sector === current,
    ),
    'The pending storm loss groups do not belong to its current sector.',
  );
  const crossed = new Set(
    Array.from(
      { length: r.distance - r.traversed },
      (_, i) => ((r.from + r.traversed + i) % 18) + 1,
    ),
  );
  for (const p of g.players)
    casualtyCustody(
      g,
      p,
      (key) => {
        const loc = boardKey(key);
        return (
          exposed(g, key) &&
          (crossed.has(loc.sector) ||
            (p.faction === 'fremen' && r.pending.includes(key))) &&
          !(p.faction === 'choam' && r.choamProtected?.includes(loc.territory))
        );
      },
      'storm',
    );
}
export function validateStormCancellation(g: Game, response: ResponseWindow) {
  const p = g.players.find((p) => p.id === response.owner);
  requireDisaster(
    response.kind === 'stormProtection' &&
      g.status === 'playing' &&
      g.advanced &&
      p?.faction === 'fremen',
    'This storm protection needs its current Fremen owner.',
  );
  if (response.resume === 'storm') {
    validateStormTraversal(g);
    requireDisaster(
      g.stormResolution!.traversed === 0 &&
        g.stormResolution!.pending.length === 0,
      'Storm protection must precede the pending traversal.',
    );
    return;
  }
  requireDisaster(
    response.resume === 'shipment' &&
      g.phase === 5 &&
      g.active === p.id &&
      p.shipped &&
      typeof response.location === 'string',
    'This storm protection needs its original shipment.',
  );
  const key = response.location,
    loc = boardKey(key),
    n = response.amount,
    elite = response.elite ?? 0;
  requireDisaster(
    loc.sector === g.storm &&
      whole(n) &&
      n > 0 &&
      whole(elite) &&
      elite <= n &&
      n <= (p.forces[key] ?? 0) &&
      elite <= (p.elites?.forces[key] ?? 0) &&
      n - elite <= (p.forces[key] ?? 0) - (p.elites?.forces[key] ?? 0),
    'The canceled shipment no longer has its declared ordinary and elite cohort.',
  );
  casualtyCustody(g, p, (candidate) => candidate === key, 'storm');
}
export function validateWormDevouring(
  g: Game,
  t: string,
  protectedAlly?: string,
  protectFremen = true,
) {
  requireDisaster(validTerritory(t), 'The worm needs a valid territory.');
  for (const p of g.players)
    if ((!protectFremen || p.faction !== 'fremen') && p.id !== protectedAlly)
      casualtyCustody(
        g,
        p,
        (key) => splitLocation(key).territory === t && !!boardKey(key),
        'worm',
      );
}
function validTerritory(t: unknown): t is string {
  if (typeof t !== 'string') return false;
  try {
    return territory(t).type === 'sand' || SPICE_CARDS.some(([id]) => id === t);
  } catch {
    return false;
  }
}
export function validateWormCancellation(g: Game, response: ResponseWindow) {
  const fremen = g.players.find((p) => p.id === response.owner);
  requireDisaster(
    g.status === 'playing' &&
      g.phase === 1 &&
      fremen?.faction === 'fremen' &&
      validTerritory(response.location) &&
      ['wormSurvival', 'wormAllyProtection', 'wormPlacement'].includes(
        response.kind,
      ),
    'This worm cancellation needs its original Fremen response and territory.',
  );
  requireDisaster(
    g.summonedWorm
      ? g.summonedWorm.territory === response.location &&
          !!g.summonedWorm.resume
      : !!(g.spiceSequence || g.spiceResolution),
    'This worm needs its pending spice blow or summoned continuation.',
  );
  requireDisaster(
    !g.spiceSequence ||
      ((g.spiceSequence.pile === 0 || g.spiceSequence.pile === 1) &&
        Array.isArray(g.spiceSequence.skipped)),
    'The worm needs a valid spice discard pile.',
  );
  requireDisaster(
    !g.spiceResolution || Array.isArray(g.spiceResolution.skipped),
    'The worm needs a valid deferred spice-card list.',
  );
  requireDisaster(
    Array.isArray(g.spiceDiscard[0]) &&
      Array.isArray(g.spiceDiscard[1]) &&
      Array.isArray(g.spiceDeck),
    'The worm needs its spice deck and discard piles.',
  );
  requireDisaster(
    Array.isArray(g.wormRides),
    'The worm needs its current ride list.',
  );
  if (g.summonedWorm) {
    const parent = g.summonedWorm.resume;
    requireDisaster(
      Array.isArray(parent.wormRides) &&
        parent.wormRides.every(validTerritory) &&
        typeof parent.nexus === 'boolean',
      'The summoned worm needs its saved ride and Nexus continuation.',
    );
  }
  if (response.recipient !== undefined)
    requireDisaster(
      g.players.some((p) => p.id === response.recipient),
      'The protected ally is no longer seated.',
    );
  if (response.kind === 'wormPlacement') {
    requireDisaster(
      g.advanced &&
        !g.summonedWorm &&
        territory(response.location).type === 'sand',
      'Additional worm placement requires its Advanced spice sequence.',
    );
    return;
  }
  // Canceling allied protection may first open the separate survival decision;
  // validate the affected army now without executing that future window.
  validateWormDevouring(
    g,
    response.location,
    response.kind === 'wormSurvival' ? response.recipient : undefined,
    response.kind === 'wormAllyProtection',
  );
}
