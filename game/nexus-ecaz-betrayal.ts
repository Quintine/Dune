import { TERRITORIES, splitLocation, validLocation } from './board';
import type { Game, Player } from './engine';
import { nexusCardMode, validateNexusCards } from './nexus-cards';

export type EcazBetrayalCounts = Readonly<{ normal: number; elite: number }>;
export type EcazBetrayalTerritory = Readonly<{
  territory: string;
  /** Complete physical ally group, keyed by printed board location. */
  sectors: Readonly<Record<string, EcazBetrayalCounts>>;
  total: EcazBetrayalCounts;
}>;
export type EcazBetrayalOffer = Readonly<{
  event: string;
  blocked: string | null;
  ally: string | null;
  territories: readonly EcazBetrayalTerritory[];
}>;
export type EcazBetrayalSnapshot = Readonly<{
  event: string;
  owner: string;
  ally: string;
  turn: number;
  discardIndex: number;
  territory: string;
  sectors: Readonly<Record<string, EcazBetrayalCounts>>;
  total: EcazBetrayalCounts;
}>;

const allowedFactions: Record<string, true> = {
  atreides: true, harkonnen: true, emperor: true, fremen: true,
  guild: true, beneGesserit: true, ecaz: true, moritani: true,
};
const plain = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  plain(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
function openingReady(g: Game): boolean {
  return g.status === 'playing' && g.phase === 5 &&
    Array.isArray(g.order) && g.order.length === g.players.length &&
    new Set(g.order).size === g.players.length &&
    g.players.every(p => g.order.includes(p.id) && p.shipped === false && p.moved === 0) &&
    g.active === g.order[0] && Array.isArray(g.movementRemaining) &&
    g.movementRemaining.length === g.order.length &&
    g.movementRemaining.every((id, index) => id === g.order[index]);
}

function locations(player: Player): Map<string, Record<string, EcazBetrayalCounts>> {
  if (!plain(player.forces) || (player.elites && !plain(player.elites.forces)))
    throw new Error('Ecaz Betrayal needs plain physical force custody.');
  const elites = player.elites?.forces;
  for (const [key, elite] of Object.entries(elites ?? {})) {
    if (!count(elite) || (elite > 0 && !Object.hasOwn(player.forces, key)))
      throw new Error('Ecaz Betrayal has invalid elite custody.');
  }
  const result = new Map<string, Record<string, EcazBetrayalCounts>>();
  for (const [key, total] of Object.entries(player.forces)) {
    const { territory, sector } = splitLocation(key);
    if (!TERRITORIES.some(t => t.id === territory) ||
      !Number.isSafeInteger(sector) || !validLocation(territory, sector) ||
      key !== `${territory}:${sector}` || !count(total))
      throw new Error('Ecaz Betrayal has invalid physical board custody.');
    const elite = elites && Object.hasOwn(elites, key) ? elites[key] : 0;
    if (!count(elite) || elite > total)
      throw new Error('Ecaz Betrayal has invalid typed force custody.');
    if (!total) continue;
    const sectors = result.get(territory) ?? {};
    sectors[key] = { normal: total - elite, elite };
    result.set(territory, sectors);
  }
  return result;
}

function territoryQuote(territory: string, sectors: Record<string, EcazBetrayalCounts>): EcazBetrayalTerritory {
  let normal = 0, elite = 0;
  for (const group of Object.values(sectors)) {
    normal += group.normal;
    elite += group.elite;
  }
  if (!Number.isSafeInteger(normal) || !Number.isSafeInteger(elite))
    throw new Error('Ecaz Betrayal force totals exceed physical custody.');
  return { territory, sectors, total: { normal, elite } };
}

/** Public-only offer for an unallied holder of Ecaz's actual Betrayal card.
 * The engine separately authorizes card custody and handles Karama response. */
export function ecazBetrayalOffer(g: Game, owner: string, automaticPending = false): EcazBetrayalOffer | null {
  const holder = g.players.find(p => p.id === owner);
  const ecaz = g.players.find(p => p.faction === 'ecaz');
  const cards = g.nexusCards?.cards;
  if (!holder || !ecaz || holder.id === ecaz.id || holder.faction === 'ecaz' ||
    !cards || !Object.hasOwn(cards.hands, owner) || cards.hands[owner] !== 'ecaz' ||
    nexusCardMode('ecaz', holder.faction, g.players.map(p => p.faction)) !== 'betrayal') return null;
  const ally = g.players.find(p => p.id === ecaz.ally && p.ally === ecaz.id);
  const event = JSON.stringify(['nexusEcazBetrayal', g.turn, owner, ally?.id ?? null, cards.discard.length]);
  let blocked: string | null = null;
  if (holder.ally) blocked = 'An allied player cannot hold or play a Nexus card.';
  else if (!openingReady(g))
    blocked = 'Use Ecaz Betrayal before the first Shipment and Movement action.';
  else if (!ally) blocked = 'Ecaz needs a real reciprocal alliance.';
  else if (g.expansions.some(expansion => expansion !== 'ecaz') ||
    g.players.some(p => !Object.hasOwn(allowedFactions, p.faction)) ||
    g.homeworlds || g.leaderSkills || g.discoveryEnabled || g.discoveries ||
    g.discoveryStash || g.greatMaker || g.ecazTreachery || g.techTokens ||
    g.strongholdCards || g.sandtrout || g.players.some(p => p.noField ||
      (p.advisors && Object.keys(p.advisors).length > 0)))
    blocked = 'Combined modules, No-Fields and advisor stances remain unavailable.';
  else if (automaticPending || g.response || g.decision || g.truthtrance ||
    g.phaseOpening || g.battle || g.pendingTreacheryDiscard || g.pendingExchange ||
    g.pendingKarama || g.pendingRevival || g.pendingAmbassador || g.pendingCapture ||
    g.pendingFremenMove || g.pendingMobileMove || g.pendingIxMove || g.pendingNullentropy ||
    g.pendingTerrorEntry || g.pendingMoritaniPlacement || g.pendingRicheseGift ||
    g.nexusTraitorPending || g.nexusCards?.phase?.stage === 'drawing')
    blocked = 'Finish the current interaction before using Ecaz Betrayal.';
  if (!blocked) validateNexusCards(cards, g.players);
  const territories: EcazBetrayalTerritory[] = [];
  if (!blocked && ally) {
    const occupied = locations(ecaz);
    for (const [territory, sectors] of locations(ally))
      if (occupied.has(territory)) territories.push(territoryQuote(territory, sectors));
    if (!territories.length) blocked = 'Ecaz and its ally share no territory containing physical forces.';
  }
  return { event, blocked, ally: ally?.id ?? null, territories };
}

/** Quote an accepted *entire* ally group before spending the card or returning
 * forces. All inputs are the authoritative live Game and authenticated owner,
 * plus the submitted event and one offered public territory. Throws if stale. */
export function quoteEcazBetrayal(g: Game, owner: string, event: string, territory: string): EcazBetrayalSnapshot {
  const offer = ecazBetrayalOffer(g, owner);
  if (!offer || offer.blocked || event !== offer.event)
    throw new Error(offer?.blocked ?? 'This Ecaz Betrayal opportunity is stale.');
  const selected = offer.territories.find(row => row.territory === territory);
  if (!selected) throw new Error('Choose one shared territory with Ecaz and its ally.');
  return { event, owner, ally: offer.ally!, turn: g.turn, territory,
    discardIndex: g.nexusCards!.cards!.discard.length,
    sectors: selected.sectors, total: selected.total };
}

/** Validate a saved pre-return quote against frozen authoritative physical
 * custody. pending=true is only for the engine's own saved, already-spent card
 * response frame; the caller must authenticate that frame separately. */
export function validateEcazBetrayalSnapshot(
  g: Game, snapshot: EcazBetrayalSnapshot, pending = false,
): void {
  if (!exactKeys(snapshot, ['event', 'owner', 'ally', 'turn', 'territory', 'discardIndex', 'sectors', 'total']) ||
    typeof snapshot.event !== 'string' || typeof snapshot.owner !== 'string' ||
    typeof snapshot.ally !== 'string' || typeof snapshot.territory !== 'string' ||
    !Number.isSafeInteger(snapshot.turn) || snapshot.turn !== g.turn ||
    !Number.isSafeInteger(snapshot.discardIndex) || snapshot.discardIndex < 0 ||
    !exactKeys(snapshot.total, ['normal', 'elite']) ||
    !count(snapshot.total.normal) || !count(snapshot.total.elite) ||
    !plain(snapshot.sectors) || !Object.keys(snapshot.sectors).length)
    throw new Error('Ecaz Betrayal has an invalid saved force snapshot.');
  for (const [key, group] of Object.entries(snapshot.sectors)) {
    const { territory, sector } = splitLocation(key);
    if (territory !== snapshot.territory || !TERRITORIES.some(t => t.id === territory) ||
      !Number.isSafeInteger(sector) || !validLocation(territory, sector) ||
      key !== `${territory}:${sector}` ||
      !exactKeys(group, ['normal', 'elite']) || !count(group.normal) || !count(group.elite) ||
      group.normal + group.elite <= 0 || !Number.isSafeInteger(group.normal + group.elite))
      throw new Error('Ecaz Betrayal has an invalid saved sector group.');
  }
  let fresh: EcazBetrayalSnapshot;
  if (pending) {
    const cards = g.nexusCards?.cards;
    const ecaz = g.players.find(p => p.faction === 'ecaz');
    const ally = g.players.find(p => p.id === snapshot.ally);
    const holder = g.players.find(p => p.id === snapshot.owner);
    if (!openingReady(g) || !cards || cards.hands[snapshot.owner] !== null ||
      cards.discard[snapshot.discardIndex] !== 'ecaz' || !ecaz || !ally ||
      ecaz.ally !== ally.id || ally.ally !== ecaz.id || !holder ||
      holder.ally || holder.faction === 'ecaz' ||
      snapshot.event !== JSON.stringify(['nexusEcazBetrayal', g.turn,
        snapshot.owner, ally.id, snapshot.discardIndex]))
      throw new Error('Ecaz Betrayal has lost its pending card or alliance.');
    validateNexusCards(cards, g.players);
    const occupied = locations(ecaz);
    const selected = locations(ally).get(snapshot.territory);
    if (!occupied.has(snapshot.territory) || !selected)
      throw new Error('Ecaz Betrayal has lost the shared physical territory.');
    fresh = { event: snapshot.event, turn: g.turn, owner: snapshot.owner,
      ally: ally.id, discardIndex: snapshot.discardIndex,
      ...territoryQuote(snapshot.territory, selected) };
  } else fresh = quoteEcazBetrayal(g, snapshot.owner, snapshot.event, snapshot.territory);
  if (snapshot.ally !== fresh.ally || snapshot.discardIndex !== fresh.discardIndex ||
    snapshot.total.normal !== fresh.total.normal || snapshot.total.elite !== fresh.total.elite ||
    Object.keys(snapshot.sectors).length !== Object.keys(fresh.sectors).length ||
    Object.entries(fresh.sectors).some(([key, group]) =>
      !Object.hasOwn(snapshot.sectors, key) ||
      snapshot.sectors[key].normal !== group.normal || snapshot.sectors[key].elite !== group.elite))
    throw new Error('Ecaz Betrayal no longer matches its original physical ally group.');
}
