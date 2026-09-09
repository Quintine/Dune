import type { Game } from './engine';
import { gameTerritories, location, MOBILE_STRONGHOLD, splitLocation } from './board';
import { presenceAt } from './force-presence';
import { fighterCount } from './advisors';
import { territoryEntryBlock } from './occupancy';
import { homeworldContext } from './homeworld-game';
import { HOMEWORLD_CARDS } from './homeworld-cards';
import { homeworldForceGroups, quoteHomeworldCustody, HomeworldCustodyError } from './homeworld-custody';
import { quoteNativeReserveWithdrawal } from './homeworld-native-reserves';
import { lowGrummanRevealBlock } from './homeworld-collection';
import { homeworldSpiritualAdvisorLimit } from './homeworld-mobility';
import type { HomeworldRevivalDeploymentQuote } from './homeworld-revival-deployment';

type Context = Pick<Game, 'advanced' | 'players' | 'homeworlds' | 'storm' | 'mobileStronghold' | 'moritaniTerror'>;
export type HomeworldRevivalDestination = {
  id: string;
  name: string;
  territory?: string;
  sector?: number;
  homeworld?: string;
  blocked: string | null;
};

/** Only the complete earned group to one destination is admitted here.
 * Shipment-specific reactions remain explicit source boundaries. No token face,
 * opposing hand, spice balance or concealed denomination influences these lists. */
export function homeworldRevivalDestinations(
  g: Context,
  player: string,
  grant: HomeworldRevivalDeploymentQuote,
): HomeworldRevivalDestination[] {
  const p = g.players.find((seat) => seat.id === player);
  if (!p || !g.homeworlds?.custody)
    throw new HomeworldCustodyError('Revival placement needs its seated native Homeworld owner.');
  const amount = grant.normal + grant.elite;
  const bg = g.players.find((seat) => seat.faction === 'beneGesserit');
  const moritani = g.players.find((seat) => seat.faction === 'moritani');
  const advisors = grant.kind === 'tleilax' && bg && bg.reserves > 0 &&
    homeworldSpiritualAdvisorLimit(g, bg.id, 'polar_sink') > 0
    ? 'Spiritual Advisors after Tleilax revival deployment await a shipment-classification ruling.' : null;
  const destinations: HomeworldRevivalDestination[] = gameTerritories(g).flatMap((t) => {
    if (grant.kind === 'fedaykin' && presenceAt(p, t.id) === 0) return [];
    return t.sectors.map((sector) => {
      const effectiveSector = t.id === MOBILE_STRONGHOLD
        ? splitLocation(g.mobileStronghold!.location!).sector : sector;
      let blocked = grant.blocked ?? advisors;
      if (!blocked && effectiveSector !== 0 && effectiveSector === g.storm)
        blocked = grant.kind === 'fedaykin'
          ? 'Fedaykin revival placement into storm awaits its own permission ruling.'
          : 'Revival deployment cannot enter a sector in storm.';
      if (!blocked && t.id === MOBILE_STRONGHOLD)
        blocked = 'Revival placement in the Hidden Mobile Stronghold awaits its shipment-classification ruling.';
      blocked ??= territoryEntryBlock(g.players, p.id, t.id);
      if (!blocked && g.advanced && bg && bg.id !== p.id && fighterCount(bg, t.id) > 0)
        blocked = 'Intrusion after Homeworld revival placement awaits an entry-classification ruling.';
      if (!blocked && moritani && p.id !== moritani.id && p.id !== moritani.ally &&
          !lowGrummanRevealBlock(g, moritani.id, amount) &&
          g.moritaniTerror?.tokens.some((token) => token.status === 'placed' && token.location === t.id))
        blocked = 'Terror after Homeworld revival placement awaits an entry-classification ruling.';
      return { id: location(t.id, sector), name: `${t.name}${sector ? ` · sector ${sector}` : ''}`,
        territory: t.id, sector, blocked };
    });
  });
  if (grant.kind === 'tleilax') {
    for (const home of homeworldForceGroups(homeworldContext(g), g.homeworlds.custody)) {
      const native = g.players.find((seat) => seat.id === home.native)!;
      const card = HOMEWORLD_CARDS.find((card) => card.faction === native.faction && (card.id === 'salusa_secundus') === home.secondary)!;
      destinations.push({ id: home.id, name: card.name, homeworld: home.id,
        blocked: grant.blocked ??
          (p.ally === native.id && native.ally === p.id ? 'You cannot deploy to your ally’s Homeworld.' : null),
      });
    }
  }
  return destinations;
}

/** A custody quote only: the engine commits the physical arrival and its
 * Ambassador continuation. No fee, new revival or shipment allowance is used. */
export function quoteHomeworldRevivalDestination(
  g: Context,
  player: string,
  grant: HomeworldRevivalDeploymentQuote,
  destination: string,
) {
  const selected = homeworldRevivalDestinations(g, player, grant).find((d) => d.id === destination);
  if (!selected || selected.blocked)
    throw new HomeworldCustodyError(selected?.blocked ?? 'Choose a currently eligible revival destination.');
  const forces = { normal: grant.normal, elite: grant.elite };
  const context = homeworldContext(g);
  if (selected.homeworld) {
    const native = homeworldForceGroups(context, g.homeworlds!.custody!)
      .find((home) => home.native === player && !home.secondary)!;
    const transfer = quoteHomeworldCustody(context, g.homeworlds!.custody!, [
      { homeworld: native.id, player, withdraw: forces, deposit: { normal: 0, elite: 0 } },
      { homeworld: selected.homeworld, player, withdraw: { normal: 0, elite: 0 }, deposit: forces },
    ]);
    return { selected, transfer };
  }
  return { selected, transfer: quoteNativeReserveWithdrawal(context, g.homeworlds!.custody!, player, forces) };
}
