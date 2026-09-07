'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { Bell, BellOff } from 'lucide-react';
import { FACTIONS, type FactionId } from '@/game/catalog';
import { Button } from './ui/button';

export type AutomaticActionEvent = {
  id: string;
  seq: number;
  faction: FactionId;
  name: string;
};

const PREFERENCE_KEY = 'dune.automatic-action-notices';
const PREFERENCE_EVENT = 'dune-automatic-action-notices-preference';
const MAX_QUEUED_NOTICES = 250;
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
  const queue = useRef<AutomaticActionEvent[]>([]);
  const active = useRef<AutomaticActionEvent | null>(null);
  const [notice, setNotice] = useState<
    (AutomaticActionEvent & { fading: boolean }) | null
  >(null);
  const [completed, setCompleted] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  const showNext = useCallback(() => {
    if (active.current) return;
    if (!readPreference()) {
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
    const fresh = events
      .filter((event) => event.seq > seenSeq.current)
      .toSorted((a, b) => a.seq - b.seq);
    const additions: AutomaticActionEvent[] = [];
    for (const event of fresh) {
      if (event.seq <= seenSeq.current) continue;
      seenSeq.current = event.seq;
      additions.push(event);
    }
    // Disabled notices are consumed, so enabling cannot replay missed events.
    if (!readPreference()) return;
    const capacity = MAX_QUEUED_NOTICES - (active.current ? 1 : 0);
    // Preserve the active notice and retain the newest pending events on overflow.
    queue.current = [...queue.current, ...additions].slice(-capacity);
    showNext();
  }, [events, showNext, completed]);

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
          </span>
        )}
      </output>
    </>
  );
}
