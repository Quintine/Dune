'use client';

import {
  useEffect,
  useReducer,
  useSyncExternalStore,
} from 'react';
import { Bell, BellOff } from 'lucide-react';
import { FACTIONS } from '@/game/catalog';
import { initialActionNotices, updateActionNotices, type AutomaticActionEvent, type QueuedActionNotice } from '@/lib/action-notice-queue';
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
  const [presentation, updatePresentation] = useReducer(updateActionNotices, events, initialActionNotices);

  useEffect(() => {
    updatePresentation({
      type: 'events', events, enabled,
      visible: document.visibilityState !== 'hidden',
    });
  }, [events, enabled]);

  useEffect(() => {
    const hide = () => {
      if (document.visibilityState !== 'hidden') return;
      updatePresentation({ type: 'hide' });
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);

  const toggle = () => {
    const next = !enabled;
    memoryPreference = next;
    updatePresentation({ type: 'clear' });
    try {
      localStorage.setItem(PREFERENCE_KEY, String(next));
      memoryPreference = undefined;
    } catch {
      // Do not turn a cosmetic preference into an error or blocking dialog.
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  };

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
        {enabled && presentation.active && (
          <ActionNoticeCard notice={presentation.active} onContinue={() => updatePresentation({ type: 'continue' })} />
        )}
      </output>
    </>
  );
}

/** The notice alone accepts input; it does not trap or move keyboard focus. */
export function ActionNoticeCard({ notice, onContinue }: { notice: QueuedActionNotice; onContinue: () => void }) {
  const house = FACTIONS.find((candidate) => candidate.id === notice.faction);
  return <span
    className="pointer-events-auto block max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl border border-[#807456] border-l-4 bg-[#141814]/95 px-4 py-3 text-[#f5ecda] shadow-xl"
    style={{ borderLeftColor: house?.color ?? '#d4b77b' }}
  >
    <span className="block text-sm font-semibold leading-5 tracking-wider uppercase" style={{ color: house?.color ?? '#d4b77b' }}>
      {house?.name ?? 'Automatic action'}
    </span>
    <span className="mt-1 block break-words text-base font-medium leading-6">{notice.name}</span>
    {notice.count > 1 && <span className="mt-1 block text-sm leading-5 text-[#d6cdb8]">
      {notice.count - 1} earlier {notice.count === 2 ? 'action' : 'actions'} also completed. Details are in the table chronicle.
    </span>}
    <Button type="button" variant="outline" className="mt-3 min-h-11 max-w-full whitespace-normal" style={{ fontSize: '1rem' }} onClick={onContinue}>
      Continue
    </Button>
  </span>;
}
