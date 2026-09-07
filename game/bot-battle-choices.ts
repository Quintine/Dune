import type { Action, GameView } from './engine';
import { fighterCount } from './advisors';
import { presenceByLocation } from './force-presence';
import {
  gameDistance,
  gameTerritories,
  MOBILE_LOCATION,
  splitLocation,
} from './board';

/** Public fighter locations and storm order determine which battle may be chosen. */
export function botBattleChoices(g: GameView): Action[] {
  const me = g.players.find((p) => p.id === g.me)!;
  if (g.active !== me.id) return [];
  const ownLocations = Object.keys(presenceByLocation(me));
  return gameTerritories(g)
    .filter((t) => t.type !== 'polar' && fighterCount(me, t.id) > 0)
    .flatMap((t) =>
      g.players
        .filter(
          (p) =>
            p.id !== me.id &&
            p.id !== me.ally &&
            fighterCount(p, t.id) > 0 &&
            g.order.indexOf(p.id) >= g.order.indexOf(me.id) &&
            ownLocations
              .filter((key) => splitLocation(key).territory === t.id)
              .some((from) =>
                Object.keys(presenceByLocation(p))
                  .filter((key) => splitLocation(key).territory === t.id)
                  .some(
                    (to) =>
                      gameDistance(
                        g,
                        from,
                        to,
                        (key) =>
                          splitLocation(
                            key === MOBILE_LOCATION
                              ? (g.mobileStronghold?.location ?? key)
                              : key,
                          ).sector === g.storm,
                      ) === 0,
                  ),
              ),
        )
        .map((p) => ({ type: 'chooseBattle', territory: t.id, target: p.id })),
    );
}
