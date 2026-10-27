import type { Action, GameView } from './engine';
import type {
  DiscoveryEntryOffer,
  DiscoveryEntryNoField,
  DiscoveryEntrySource,
} from './discovery-entry';
import { splitLocation } from './board';

function entryDecision(game: GameView) {
  const decision = game.decision;
  return decision?.kind === 'discoveryEntry' ? decision : null;
}

function currentEntry(game: GameView) {
  const decision = entryDecision(game),
    offer = game.discoveryEntry;
  if (
    game.status !== 'playing' ||
    !decision ||
    decision.player !== game.me ||
    !offer ||
    offer.owner !== game.me ||
    offer.event !== decision.event ||
    offer.blocked
  )
    return null;
  return { decision, offer };
}

function whole(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function selectedGroups(
  offer: DiscoveryEntryOffer,
  groups: readonly DiscoveryEntrySource[],
  allowEmpty = false,
): DiscoveryEntrySource[] | null {
  if (!Array.isArray(groups) || (!groups.length && !allowEmpty)) return null;
  const selected = groups
    .map((group) => ({ ...group }))
    .sort((a, b) => a.source.localeCompare(b.source));
  if (
    new Set(selected.map((group) => group.source)).size !== selected.length ||
    selected.some((group) => {
      const available = offer.sources.find(
        (source) => source.source === group.source,
      );
      return (
        Object.keys(group).sort().join(',') !== 'elite,normal,source' ||
        !available ||
        !whole(group.normal) ||
        !whole(group.elite) ||
        group.normal + group.elite <= 0 ||
        group.normal > available.normal ||
        group.elite > available.elite
      );
    })
  )
    return null;
  return selected;
}

export function discoveryEntryMoveAction(
  game: GameView,
  groups: readonly DiscoveryEntrySource[],
  noField?: DiscoveryEntryNoField,
): Action | null {
  const entry = currentEntry(game);
  if (!entry) return null;
  if (noField !== undefined) {
    const offered = entry.offer.noField;
    if (!noField || typeof noField !== 'object' || Array.isArray(noField) ||
        Object.keys(noField).sort().join(',') !== 'event,source,tokenId' ||
        typeof noField.tokenId !== 'string' || !noField.tokenId.trim() ||
        typeof noField.event !== 'string' || !noField.event.trim() ||
        typeof noField.source !== 'string' ||
        !offered || noField.tokenId !== offered.tokenId || noField.event !== offered.event ||
        noField.source !== offered.source) return null;
    const source = splitLocation(noField.source);
    if (source.territory !== entry.offer.parent || noField.source !== `${source.territory}:${source.sector}`)
      return null;
  }
  const selected = selectedGroups(entry.offer, groups, noField !== undefined);
  return selected
    ? {
        type: 'decision',
        event: entry.decision.event,
        accept: true,
        groups: selected,
        ...(noField ? { noField: noField.tokenId, noFieldEvent: noField.event } : {}),
      }
    : null;
}

export function discoveryEntryDeclineAction(
  game: GameView,
): Action | null {
  const entry = currentEntry(game);
  return entry
    ? { type: 'decision', event: entry.decision.event, accept: false }
    : null;
}

/** Uses only the current player's projected groups and offered owned marker. */
export function discoveryEntryBotActions(game: GameView): Action[] {
  const offer = game.discoveryEntry;
  if (!currentEntry(game) || !offer) return [];
  const move = discoveryEntryMoveAction(game, offer.sources, offer.noField),
    decline = discoveryEntryDeclineAction(game);
  return [move, decline].filter((action): action is Action => action !== null);
}
