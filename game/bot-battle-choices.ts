import type { Action, GameView } from './engine';
import { fighterCount } from './advisors';
import { presenceByLocation } from './force-presence';
import {
  gameDistance,
  gameTerritories,
  MOBILE_LOCATION,
  splitLocation,
} from './board';

/** Use the authoritative chooser, which can differ from the physical attacker. */
export function botBattleChoices(g: GameView): Action[] {
  const me = g.players.find((p) => p.id === g.me)!;
  if (g.active !== me.id) return [];
  if (Array.isArray(g.battleChoices))
    return g.battleChoices
      .filter((battle) => (battle.chooser ?? battle.attacker) === me.id &&
        [battle.attacker, battle.defender].includes(me.id))
      .map((battle) => ({
        type: 'chooseBattle',
        territory: battle.territory,
        target: battle.attacker === me.id ? battle.defender : battle.attacker,
      }));
  // Legacy component fixtures may predate the authoritative combat frontier.
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
