import type { FactionId } from '@/game/catalog';

export type AutomaticActionEvent = {
  id: string;
  seq: number;
  faction: FactionId;
  name: string;
};

export type QueuedActionNotice = AutomaticActionEvent & { count: number };

export type ActionNoticeCursor = { seenSeq: number; pending: QueuedActionNotice[] };

export type ActionNoticePresentation = ActionNoticeCursor & { active: QueuedActionNotice | null };

type ActionNoticeUpdate =
  | { type: 'events'; events: readonly AutomaticActionEvent[]; enabled: boolean; visible: boolean }
  | { type: 'continue' }
  | { type: 'hide' }
  | { type: 'clear' };

/** Existing history establishes a silent baseline, including after refresh. */
export function initialActionNotices(events: readonly AutomaticActionEvent[]): ActionNoticePresentation {
  return { seenSeq: events.reduce((last, event) => Math.max(last, event.seq), -1), pending: [], active: null };
}

/** Local presentation only: reading or dismissing a notice never advances the game. */
export function updateActionNotices(state: ActionNoticePresentation, update: ActionNoticeUpdate): ActionNoticePresentation {
  if (update.type === 'hide') return { ...state, pending: [] };
  if (update.type === 'clear') return { ...state, active: null, pending: [] };
  if (update.type === 'continue') return { ...state, active: state.pending[0] ?? null, pending: state.pending.slice(1) };

  const active = update.enabled ? state.active : null;
  const cursor = advanceActionNotices(state, update.events, {
    active: !!active,
    show: update.enabled && update.visible,
  });
  // New updates never replace text that the player has not dismissed.
  return active
    ? { ...cursor, active }
    : { ...cursor, active: cursor.pending[0] ?? null, pending: cursor.pending.slice(1) };
}

/** Consume every observed sequence, even when presentation is disabled. */
export function advanceActionNotices(
  cursor: ActionNoticeCursor,
  events: readonly AutomaticActionEvent[],
  options: { active: boolean; show: boolean },
): ActionNoticeCursor {
  let seenSeq = cursor.seenSeq;
  const fresh: AutomaticActionEvent[] = [];
  for (const event of events.filter(event => event.seq > seenSeq).toSorted((a, b) => a.seq - b.seq)) {
    if (event.seq <= seenSeq) continue;
    seenSeq = event.seq;
    fresh.push(event);
  }
  return {
    seenSeq,
    pending: options.show ? appendActionNotices(cursor.pending, fresh, options.active) : [],
  };
}

/** Keep at most three notices, including the one awaiting local dismissal. */
export function appendActionNotices(
  pending: readonly QueuedActionNotice[],
  incoming: readonly AutomaticActionEvent[],
  active: boolean,
): QueuedActionNotice[] {
  const notices = [...pending, ...incoming.map(event => ({ ...event, count: 1 }))];
  const capacity = active ? 2 : 3;
  if (notices.length <= capacity) return notices;
  const mergedLength = notices.length - capacity + 1;
  const merged = notices.slice(0, mergedLength);
  return [
    { ...merged[merged.length - 1], count: merged.reduce((sum, notice) => sum + notice.count, 0) },
    ...notices.slice(mergedLength),
  ];
}
