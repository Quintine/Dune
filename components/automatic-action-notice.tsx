'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Bell, BellOff } from 'lucide-react';
import { FACTIONS } from '@/game/catalog';
import { advanceActionNotices, type AutomaticActionEvent, type QueuedActionNotice } from '@/lib/action-notice-queue';
import { Button } from './ui/button';

export type { AutomaticActionEvent } from '@/lib/action-notice-queue';

const PREFERENCE_KEY = 'dune.automatic-action-notices';
const PREFERENCE_EVENT = 'dune-automatic-action-notices-preference';
let memoryPreference: boolean | undefined;
function readPreference() {
  if (memoryPreference !== undefined) return memoryPreference;
  try {
    return localStorage.getItem(PREFERENCE_KEY) !== 'false';
  } catch {
    return true;
  }
}
function subscribePreference(listener: () => void) {
  window.addEventListener(PREFERENCE_EVENT, listener);
  return () => window.removeEventListener(PREFERENCE_EVENT, listener);
}
const serverPreference = () => true;

/** Cosmetic feedback only. Supply public events with increasing, room-local sequences. */
export function AutomaticActionNotice({
  events,
}: {
  events: readonly AutomaticActionEvent[];
}) {
  const enabled = useSyncExternalStore(
    subscribePreference,
    readPreference,
    serverPreference,
  );
  // The first snapshot establishes a baseline. Refreshing never replays history.
  const seenSeq = useRef(
    events.reduce((last, event) => Math.max(last, event.seq), -1),
  );
  const queue = useRef<QueuedActionNotice[]>([]);
  const active = useRef<QueuedActionNotice | null>(null);
  const [notice, setNotice] = useState<
    (QueuedActionNotice & { fading: boolean }) | null
  >(null);
  const [completed, setCompleted] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  const showNext = useCallback(() => {
    if (active.current) return;
    if (!readPreference() || document.visibilityState === 'hidden') {
      queue.current = [];
      return;
    }
    const next = queue.current.shift();
    if (!next) return;
    active.current = next;
    clearTimers();
    timers.current = [
      setTimeout(() => {
        setNotice({ ...next, fading: false });
      }, 0),
      setTimeout(() => {
        setNotice((current) =>
          current?.id === next.id ? { ...current, fading: true } : current,
        );
      }, 1250),
      setTimeout(() => {
        active.current = null;
        setNotice(null);
        setCompleted((count) => count + 1);
      }, 1500),
    ];
  }, [clearTimers]);

  useEffect(() => {
    // Preserve the visible notice. Summarize older pending actions so a bot
    // batch cannot leave minutes of stale feedback; the chronicle keeps detail.
    const next = advanceActionNotices({ seenSeq: seenSeq.current, pending: queue.current }, events, {
      active: !!active.current,
      show: readPreference() && document.visibilityState !== 'hidden',
    });
    seenSeq.current = next.seenSeq;
    queue.current = next.pending;
    showNext();
  }, [events, showNext, completed]);

  useEffect(() => {
    const hide = () => {
      if (document.visibilityState !== 'hidden') return;
      clearTimers();
      queue.current = [];
      active.current = null;
      setNotice(null);
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, [clearTimers]);

  useEffect(
    () => () => {
      clearTimers();
      queue.current = [];
      active.current = null;
    },
    [clearTimers],
  );

  const toggle = () => {
    const next = !enabled;
    memoryPreference = next;
    clearTimers();
    queue.current = [];
    active.current = null;
    setNotice(null);
    try {
      localStorage.setItem(PREFERENCE_KEY, String(next));
      memoryPreference = undefined;
    } catch {
      // Do not turn a cosmetic preference into an error or blocking dialog.
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  };
  const house = notice
    ? FACTIONS.find((candidate) => candidate.id === notice.faction)
    : undefined;

  return (
    <>
      <Button
        variant="outline"
        className="min-h-11 max-w-full whitespace-normal motion-reduce:transition-none"
        aria-label="Automatic action notices"
        aria-pressed={enabled}
        onClick={toggle}
      >
        {enabled ? <Bell aria-hidden="true" /> : <BellOff aria-hidden="true" />}
        Automatic action notices
        <span aria-hidden="true">{enabled ? 'On' : 'Off'}</span>
      </Button>
      <output
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed top-[max(1rem,env(safe-area-inset-top))] left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2"
      >
        {enabled && notice && (
          <span
            className={`block rounded-xl border border-[#807456] border-l-4 bg-[#141814]/95 px-4 py-3 text-[#f5ecda] shadow-xl transition-opacity duration-250 motion-reduce:opacity-100 motion-reduce:transition-none ${notice.fading ? 'opacity-0' : 'opacity-100'}`}
            style={{ borderLeftColor: house?.color ?? '#d4b77b' }}
          >
            <span
              className="block text-xs font-semibold tracking-wider uppercase"
              style={{ color: house?.color ?? '#d4b77b' }}
            >
              {house?.name ?? 'Automatic action'}
            </span>
            <span className="mt-1 block break-words text-sm font-medium leading-5">
              {notice.name}
            </span>
            {notice.count > 1 && <span className="mt-1 block text-sm leading-5 text-[#d6cdb8]">
              {notice.count - 1} earlier {notice.count === 2 ? 'action' : 'actions'} also completed. Details are in the table chronicle.
            </span>}
          </span>
        )}
      </output>
    </>
  );
}
