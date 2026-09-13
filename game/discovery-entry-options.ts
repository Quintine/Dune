import type { Action, GameView } from './engine';
import type {
  DiscoveryEntryOffer,
  DiscoveryEntrySource,
} from './discovery-entry';

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
): DiscoveryEntrySource[] | null {
  if (!Array.isArray(groups) || !groups.length) return null;
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
): Action | null {
  const entry = currentEntry(game);
  if (!entry) return null;
  const selected = selectedGroups(entry.offer, groups);
  return selected
    ? {
        type: 'decision',
        event: entry.decision.event,
        accept: true,
        groups: selected,
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

/** Uses only the current player's projected physical source groups. */
export function discoveryEntryBotActions(game: GameView): Action[] {
  const offer = game.discoveryEntry;
  if (!currentEntry(game) || !offer) return [];
  const move = discoveryEntryMoveAction(game, offer.sources),
    decline = discoveryEntryDeclineAction(game);
  return [move, decline].filter((action): action is Action => action !== null);
}
