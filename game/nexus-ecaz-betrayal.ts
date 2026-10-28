import { gameTerritories, splitLocation, validGameLocation } from './board';
import type { Game, Player } from './engine';
import { nexusCoreProfile } from './faction-module-profile';
import { mixedE3NexusLeaderSkillsProfile, pairedE3NexusLeaderSkillsProfile, standaloneE3NexusLeaderSkillsProfile } from './leader-skill-profile';
import { nexusCardMode, validateNexusCards } from './nexus-cards';
import { mixedE3NexusProfile, pairedE3NexusProfile, standaloneE3NexusProfile } from './nexus-module-profile';
import { isBoardNoFieldLocation, validateRicheseNoField } from './richese-no-field';

export type EcazBetrayalCounts = Readonly<{ normal: number; elite: number }>;
export type EcazBetrayalTerritory = Readonly<{
  territory: string;
  /** Visible physical ally group, keyed by current board location. */
  sectors: Readonly<Record<string, EcazBetrayalCounts>>;
  total: EcazBetrayalCounts;
  /** One public concealed marker; its denomination is never a force count here. */
  concealed?: true;
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
  /** Private source for a face-down recall, not a reveal/materialization quote. */
  noField?: EcazBetrayalNoFieldSource;
}>;
export type EcazBetrayalNoFieldSource = Readonly<{
  supplier: string;
  event: string;
  tokenId: string;
  location: Readonly<{ territory: string; sector: number }>;
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
  const remaining = g.movementRemaining;
  const guildFirst = g.advanced && g.guildTimingGranted === true && !g.guildTimingLocked &&
    g.players.some(player => player.faction === 'guild' && player.id === g.active);
  return g.status === 'playing' && g.phase === 5 &&
    Array.isArray(g.order) && g.order.length === g.players.length &&
    new Set(g.order).size === g.players.length &&
    g.players.every(p => g.order.includes(p.id) && p.shipped === false && p.moved === 0) &&
    Array.isArray(remaining) && remaining.length === g.order.length &&
    new Set(remaining).size === remaining.length && remaining.every(id => g.order.includes(id)) &&
    remaining.includes(g.active!) && (g.active === remaining[0] || guildFirst);
}

/** Original native E3 envelopes and the selected-independent Nexus core share
 * the same effect. Quiet timing and actual alliance/card custody are separate. */
export function ecazBetrayalModeSupported(g: Game): boolean {
  if (!g.nexusCards?.cards || !g.players.some(p => p.faction === 'ecaz') || g.sandtrout) return false;
  if (nexusCoreProfile(g) || standaloneE3NexusProfile(g) || pairedE3NexusProfile(g) || mixedE3NexusProfile(g) ||
    (g.leaderSkills && (standaloneE3NexusLeaderSkillsProfile(g) || pairedE3NexusLeaderSkillsProfile(g) ||
      mixedE3NexusLeaderSkillsProfile(g)))) return true;
  // Preserve the original unselected-deck audit/runtime shape. Fresh combined
  // configurations use the canonical predicates above, not this legacy seam.
  return g.expansions.length === 0 && g.players.length >= 2 && g.players.length <= 6 &&
    new Set(g.players.map(p => p.faction)).size === g.players.length &&
    g.players.every(p => Object.hasOwn(allowedFactions, p.faction)) &&
    !g.homeworlds && !g.leaderSkills && !g.discoveryEnabled && !g.discoveries &&
    !g.discoveryStash && !g.greatMaker && !g.ecazTreachery && !g.techTokens && !g.strongholdCards &&
    !g.semutaPreview && !g.advancedPreview && !g.kullPreview && !g.nexusKullPreview &&
    !g.guildBetrayalPreview && !g.richeseBetrayalPreview && !g.nexusIxianReplacementPreview &&
    !g.nexusIxianBetrayalPreview && !g.nexusHarkonnenBetrayalPreview;
}

function boardLocation(g: Game, key: string): boolean {
  const { territory, sector } = splitLocation(key);
  return Number.isSafeInteger(sector) && key === `${territory}:${sector}` &&
    gameTerritories(g).some(t => t.id === territory) && validGameLocation(g, territory, sector);
}

function locations(g: Game, player: Player): Map<string, Record<string, EcazBetrayalCounts>> {
  if (!plain(player.forces) || (player.elites && !plain(player.elites.forces)))
    throw new Error('Ecaz Betrayal needs plain physical force custody.');
  const elites = player.elites?.forces;
  for (const [key, elite] of Object.entries(elites ?? {})) {
    if (!count(elite) || (elite > 0 && !Object.hasOwn(player.forces, key)))
      throw new Error('Ecaz Betrayal has invalid elite custody.');
  }
  const result = new Map<string, Record<string, EcazBetrayalCounts>>();
  for (const [key, total] of Object.entries(player.forces)) {
    const { territory } = splitLocation(key);
    if (!boardLocation(g, key) || !count(total))
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

/** Public presence only. Do not inspect the selected token or its value when
 * constructing offers, even for a zero marker or a controller with no reserves. */
function markerSupplier(g: Game, ally: string, territory: string): Player | undefined {
  const suppliers = g.players.filter(p => p.noField?.deployed?.controller === ally &&
    isBoardNoFieldLocation(p.noField.deployed.location) && p.noField.deployed.location.territory === territory);
  if (suppliers.length > 1) throw new Error('Ecaz Betrayal has multiple concealed marker sources.');
  return suppliers[0];
}

function markerSource(g: Game, ally: string, territory: string): EcazBetrayalNoFieldSource | undefined {
  const supplier = markerSupplier(g, ally, territory);
  if (!supplier) return undefined;
  const marker = supplier.noField!.deployed!;
  validateRicheseNoField(supplier.noField!);
  if (!isBoardNoFieldLocation(marker.location)) return undefined;
  if (supplier.faction !== 'richese' || typeof supplier.noFieldEvent !== 'string' || !supplier.noFieldEvent ||
    !boardLocation(g, `${marker.location.territory}:${marker.location.sector}`))
    throw new Error('Ecaz Betrayal has invalid concealed marker custody.');
  return { supplier: supplier.id, event: supplier.noFieldEvent, tokenId: marker.tokenId,
    location: { ...marker.location } };
}

function allyLocations(g: Game, ally: Player): Map<string, Record<string, EcazBetrayalCounts>> {
  const result = locations(g, ally);
  for (const supplier of g.players) {
    const marker = supplier.noField?.deployed;
    if (!marker || marker.controller !== ally.id || !isBoardNoFieldLocation(marker.location)) continue;
    if (!boardLocation(g, `${marker.location.territory}:${marker.location.sector}`))
      throw new Error('Ecaz Betrayal has invalid concealed board custody.');
    if (!result.has(marker.location.territory)) result.set(marker.location.territory, {});
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
  else if (!ecazBetrayalModeSupported(g))
    blocked = 'This Ecaz Betrayal roster and module combination is unavailable.';
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
    const occupied = locations(g, ecaz);
    for (const [territory, sectors] of allyLocations(g, ally))
      if (occupied.has(territory)) territories.push({ ...territoryQuote(territory, sectors),
        ...(markerSupplier(g, ally.id, territory) ? { concealed: true as const } : {}) });
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
  const noField = markerSource(g, offer.ally!, territory);
  return { event, owner, ally: offer.ally!, turn: g.turn, territory,
    discardIndex: g.nexusCards!.cards!.discard.length,
    sectors: selected.sectors, total: selected.total, ...(noField ? { noField } : {}) };
}

/** Validate a saved pre-return quote against frozen authoritative physical
 * custody. pending=true is only for the engine's own saved, already-spent card
 * response frame; the caller must authenticate that frame separately. */
export function validateEcazBetrayalSnapshot(
  g: Game, snapshot: EcazBetrayalSnapshot, pending = false,
): void {
  if (!exactKeys(snapshot, ['event', 'owner', 'ally', 'turn', 'territory', 'discardIndex', 'sectors', 'total',
    ...(snapshot?.noField !== undefined ? ['noField'] : [])]) ||
    typeof snapshot.event !== 'string' || typeof snapshot.owner !== 'string' ||
    typeof snapshot.ally !== 'string' || typeof snapshot.territory !== 'string' ||
    !Number.isSafeInteger(snapshot.turn) || snapshot.turn !== g.turn ||
    !Number.isSafeInteger(snapshot.discardIndex) || snapshot.discardIndex < 0 ||
    !exactKeys(snapshot.total, ['normal', 'elite']) ||
    !count(snapshot.total.normal) || !count(snapshot.total.elite) ||
    !plain(snapshot.sectors) || (!Object.keys(snapshot.sectors).length && !snapshot.noField) ||
    !gameTerritories(g).some(t => t.id === snapshot.territory))
    throw new Error('Ecaz Betrayal has an invalid saved force snapshot.');
  if (snapshot.noField !== undefined && (!exactKeys(snapshot.noField, ['supplier', 'event', 'tokenId', 'location']) ||
    typeof snapshot.noField.supplier !== 'string' || !snapshot.noField.supplier ||
    typeof snapshot.noField.event !== 'string' || !snapshot.noField.event ||
    typeof snapshot.noField.tokenId !== 'string' || !snapshot.noField.tokenId ||
    !exactKeys(snapshot.noField.location, ['territory', 'sector']) ||
    snapshot.noField.location.territory !== snapshot.territory ||
    !boardLocation(g, `${snapshot.noField.location.territory}:${snapshot.noField.location.sector}`)))
    throw new Error('Ecaz Betrayal has an invalid saved concealed marker.');
  for (const [key, group] of Object.entries(snapshot.sectors)) {
    const { territory } = splitLocation(key);
    if (territory !== snapshot.territory || !boardLocation(g, key) ||
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
    if (!openingReady(g) || !ecazBetrayalModeSupported(g) || !cards || cards.hands[snapshot.owner] !== null ||
      cards.discard[snapshot.discardIndex] !== 'ecaz' || !ecaz || !ally ||
      ecaz.ally !== ally.id || ally.ally !== ecaz.id || !holder ||
      holder.ally || holder.faction === 'ecaz' ||
      snapshot.event !== JSON.stringify(['nexusEcazBetrayal', g.turn,
        snapshot.owner, ally.id, snapshot.discardIndex]))
      throw new Error('Ecaz Betrayal has lost its pending card or alliance.');
    validateNexusCards(cards, g.players);
    const occupied = locations(g, ecaz);
    const selected = allyLocations(g, ally).get(snapshot.territory);
    if (!occupied.has(snapshot.territory) || !selected)
      throw new Error('Ecaz Betrayal has lost the shared physical territory.');
    const noField = markerSource(g, ally.id, snapshot.territory);
    fresh = { event: snapshot.event, turn: g.turn, owner: snapshot.owner,
      ally: ally.id, discardIndex: snapshot.discardIndex,
      ...territoryQuote(snapshot.territory, selected), ...(noField ? { noField } : {}) };
  } else fresh = quoteEcazBetrayal(g, snapshot.owner, snapshot.event, snapshot.territory);
  if (snapshot.ally !== fresh.ally || snapshot.discardIndex !== fresh.discardIndex ||
    snapshot.total.normal !== fresh.total.normal || snapshot.total.elite !== fresh.total.elite ||
    snapshot.noField?.supplier !== fresh.noField?.supplier || snapshot.noField?.event !== fresh.noField?.event ||
    snapshot.noField?.tokenId !== fresh.noField?.tokenId ||
    snapshot.noField?.location.territory !== fresh.noField?.location.territory ||
    snapshot.noField?.location.sector !== fresh.noField?.location.sector ||
    Object.keys(snapshot.sectors).length !== Object.keys(fresh.sectors).length ||
    Object.entries(fresh.sectors).some(([key, group]) =>
      !Object.hasOwn(snapshot.sectors, key) ||
      snapshot.sectors[key].normal !== group.normal || snapshot.sectors[key].elite !== group.elite))
    throw new Error('Ecaz Betrayal no longer matches its original physical ally group.');
}
