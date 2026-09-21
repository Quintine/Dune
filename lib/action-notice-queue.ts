import type { FactionId } from '@/game/catalog';

export type AutomaticActionEvent = {
  id: string;
  seq: number;
  faction: FactionId;
  name: string;
};

export type QueuedActionNotice = AutomaticActionEvent & { count: number };

export type ActionNoticeCursor = { seenSeq: number; pending: QueuedActionNotice[] };

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

/** Keep at most three 1.5-second notices, including the one already on screen. */
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
