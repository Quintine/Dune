import type { Player } from './engine';
import { splitLocation, validLocation } from './board';

export class ForceLossPreflightError extends Error {}
function requireLoss(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ForceLossPreflightError(message);
}
const whole = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
/** Pure custody check for battle removal in the engine's physical location order.
 * A deferred typed winner can pass the maximum physical loss among its legal
 * allocations, so every offered allocation remains representable. */
export function validateBattleForceLoss(
  p: Pick<Player, 'forces' | 'elites' | 'tanks' | 'battleLosses'>,
  t: string,
  maximum: number,
) {
  requireLoss(
    maximum === Infinity || whole(maximum),
    'Battle losses need a nonnegative physical count.',
  );
  let remaining = maximum,
    losses = 0,
    eliteLosses = 0;
  for (const key of new Set([
    ...Object.keys(p.forces),
    ...Object.keys(p.elites?.forces ?? {}),
  ])) {
    const loc = splitLocation(key);
    if (loc.territory !== t) continue;
    const n = p.forces[key] ?? 0,
      elite = p.elites?.forces[key] ?? 0;
    requireLoss(
      key === `${loc.territory}:${loc.sector}` &&
        validLocation(loc.territory, loc.sector) &&
        whole(n) &&
        whole(elite) &&
        elite <= n,
      'Battle losses no longer match the ordinary and elite forces at each location.',
    );
    const lost = Math.min(n, remaining);
    losses += lost;
    eliteLosses += Math.min(elite, lost);
    remaining -= lost;
  }
  requireLoss(
    whole(p.tanks) &&
      whole(p.tanks + losses) &&
      whole(p.battleLosses) &&
      whole(p.battleLosses + losses) &&
      (!p.elites ||
        (whole(p.elites.tanks) &&
          p.elites.tanks <= p.tanks &&
          whole(p.elites.tanks + eliteLosses))),
    'Battle losses need valid tank and casualty counters.',
  );
}
