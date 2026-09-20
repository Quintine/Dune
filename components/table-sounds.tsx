'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { LocalTableAudio, TableSoundCursor, soundVolume, type TableSoundFrame } from '@/lib/table-sound';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

const KEY = 'dune.table-sounds';
const EVENT = 'dune-table-sounds-preference';
const DEFAULT = { enabled: false, volume: 35 };
let cached = DEFAULT;
let lastRaw: string | null | undefined;
let memoryOnly = false;

function readPreference() {
  if (memoryOnly) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== lastRaw) {
      lastRaw = raw;
      try {
        const value = JSON.parse(raw ?? 'null');
        cached = { enabled: value?.enabled === true, volume: soundVolume(value?.volume) };
      } catch { cached = DEFAULT; }
    }
  } catch { /* Keep this tab's preference if storage is unavailable. */ }
  return cached;
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) {
      memoryOnly = false;
      lastRaw = undefined;
      listener();
    }
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', storage);
  };
}
function savePreference(value: typeof DEFAULT) {
  cached = value;
  memoryOnly = true;
  try {
    lastRaw = JSON.stringify(value);
    localStorage.setItem(KEY, lastRaw);
    memoryOnly = false;
  } catch { /* A cosmetic setting must never interrupt a game. */ }
  window.dispatchEvent(new Event(EVENT));
}
const serverPreference = () => DEFAULT;

export function TableSounds({ frame }: { frame: TableSoundFrame }) {
  const preference = useSyncExternalStore(subscribe, readPreference, serverPreference);
  const audio = useRef<LocalTableAudio | null>(null);
  const cursor = useRef<TableSoundCursor | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const player = new LocalTableAudio();
    audio.current = player;
    const unlock = () => {
      if (readPreference().enabled && document.visibilityState === 'visible') void player.unlock();
    };
    const hide = () => {
      if (document.visibilityState !== 'visible') player.stop();
    };
    // A saved preference still respects the browser's user-gesture requirement.
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', hide);
      player.dispose();
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    const player = audio.current;
    const tracker = cursor.current ?? (cursor.current = new TableSoundCursor());
    const cue = tracker.consume(frame);
    if (!preference.enabled || preference.volume === 0) player?.stop();
    if (cue && readPreference().enabled && document.visibilityState === 'visible')
      player?.play(cue, readPreference().volume);
  }, [frame, preference]);

  const preview = async () => {
    const player = audio.current;
    if (!player) return;
    const ready = await player.unlock();
    if (audio.current !== player || !readPreference().enabled || document.visibilityState !== 'visible') return;
    setUnavailable(!ready);
    if (ready) player.play('phase', readPreference().volume, true);
  };

  return (
    <details className="table-sounds">
      <summary className="min-h-11 cursor-pointer rounded-md border px-3 py-2 text-sm motion-reduce:transition-none">
        {preference.enabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
        Sound effects: {preference.enabled ? 'On' : 'Off'}
      </summary>
      <div className="table-sounds-panel">
        <Button variant="outline" aria-label="Sound effects" aria-pressed={preference.enabled} onClick={() => {
          const next = !preference.enabled;
          if (!next) audio.current?.stop();
          savePreference({ ...preference, enabled: next });
          setUnavailable(false);
          if (next) void preview();
        }}>
          {preference.enabled ? 'Mute sound effects' : 'Enable sound effects'}
        </Button>
        <label id="table-sounds-volume-label">Volume · {preference.volume}%</label>
        <Slider aria-labelledby="table-sounds-volume-label" min={0} max={100} step={5} value={[preference.volume]} onValueChange={(value) => {
          audio.current?.stop();
          savePreference({ ...preference, volume: soundVolume(Array.isArray(value) ? value[0] : value) });
        }} />
        <Button variant="outline" disabled={!preference.enabled || preference.volume === 0} onClick={() => void preview()}>Test sound</Button>
        <p>Short cues for phase changes and automatic actions. Only this browser; silent in background tabs.</p>
        {unavailable && <output>Sound is unavailable. You can keep playing and try Test sound again.</output>}
      </div>
    </details>
  );
}
