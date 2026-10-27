import type { Action, GameView } from './engine';
import { gameTerritories, MOBILE_STRONGHOLD, splitLocation, validGameLocation } from './board';
import { quoteNexusGuildSecretShipment } from './nexus-guild-secret-ally';
import { guildNoFieldSelection } from './guild-no-field-selection';

/** Consume only the current actor's private offer and public faction roster. */
export function nexusGuildSecretAllyCanAct(g: GameView): boolean {
  const me = g.players.find((p) => p.id === g.me);
  if (
    !me ||
    me.ally ||
    g.nexusCards?.card !== 'guild' ||
    g.players.some((p) => p.faction === 'guild')
  )
    return false;
  const offer = g.nexusGuildSecretAlly;
  return !!(
    offer &&
    !offer.blocked &&
    offer.event === JSON.stringify(['nexusGuildSecretAlly', g.turn, g.me]) &&
    g.status === 'playing' &&
    g.phase === 5 &&
    g.active === g.me &&
    !me.shipped &&
    !g.response &&
    !g.decision &&
    !g.truthtrance &&
    !g.phaseOpening &&
    !g.automaticContinuationPending &&
    !g.nexusCards.waiting.length &&
    !g.nexusTraitors?.pending
  );
}

/** Price is independent of native faction; route permission is still separate. */
export function nexusGuildSecretAllyQuote(
  g: GameView,
  destination: string,
  amount: number,
  noField = false,
) {
  if (
    !nexusGuildSecretAllyCanAct(g) ||
    typeof noField !== 'boolean' ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > (noField ? 21 : 20)
  )
    return null;
  const me = g.players.find((p) => p.id === g.me)!;
  if (destination === 'reserves') {
    // User ruling 7 October 2026: the Secret Ally return grant overrides the
    // Arrakis-to-native-Homeworld restriction for the holder's own reserves.
    return quoteNexusGuildSecretShipment('reserves', amount, noField);
  }
  const world = g.homeworlds?.worlds?.find((w) => w.id === destination);
  if (world) {
    if (noField || world.native === me.id || world.native === me.ally) return null;
    return quoteNexusGuildSecretShipment('homeworld', amount, noField);
  }
  const to = gameTerritories(g).find((t) => t.id === destination);
  if (!to || (destination === MOBILE_STRONGHOLD && me.faction !== 'ixians'))
    return null;
  return quoteNexusGuildSecretShipment(to.type, amount, noField);
}

/** Add a selected source, never infer card use just from possession. */
export function nexusGuildSecretAllyAction(
  g: GameView,
  event: string,
  action: Action,
): Action | null {
  if (
    !nexusGuildSecretAllyCanAct(g) ||
    event !== g.nexusGuildSecretAlly!.event ||
    !['ship', 'guildShip', 'homeworldShip'].includes(action.type) ||
    action.nexus !== undefined ||
    (action.noField !== undefined && action.type !== 'guildShip') ||
    (action.type === 'guildShip' && action.from === 'reserves')
  )
    return null;
  const me = g.players.find((p) => p.id === g.me)!;
  const noField = action.noField !== undefined;
  let amount: number;
  if (noField) {
    const marker = guildNoFieldSelection(g, action);
    if (!marker || !action.forces || typeof action.forces !== 'object' || Array.isArray(action.forces) ||
        !validGameLocation(g, marker.location.territory, marker.location.sector) || marker.location.sector === g.storm)
      return null;
    let physical = 0;
    for (const [key, count] of Object.entries(action.forces)) {
      const source = splitLocation(key);
      if (!validGameLocation(g, source.territory, source.sector) ||
          typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0 ||
          count > (me.forces[key] ?? 0)) return null;
      if (!count) continue;
      if (source.territory !== marker.location.territory || source.sector === g.storm) return null;
      physical += count;
    }
    if (physical > 20) return null;
    amount = physical + 1;
  } else amount = action.type === 'homeworldShip'
      ? Object.values(
          (action.sources ?? {}) as Record<
            string,
            { normal: number; elite: number }
          >,
        ).reduce((n, p) => n + p.normal + p.elite, 0)
      : action.forces
        ? Object.values(action.forces as Record<string, number>).reduce(
            (n, p) => n + p,
            0,
          )
        : Number(action.amount);
  const destination = String(
    action.type === 'homeworldShip' ? action.destination : action.territory,
  );
  if (!nexusGuildSecretAllyQuote(g, destination, amount, noField)) return null;
  if (
    action.type === 'ship' &&
    (amount > me.reserves ||
      !gameTerritories(g).some((t) => t.id === destination))
  )
    return null;
  return { ...action, nexus: event };
}
