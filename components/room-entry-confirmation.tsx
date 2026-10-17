'use client';

import { Button } from './ui/button';

/** A local acknowledgement: polling and game actions do not dismiss this text. */
export function RoomEntryConfirmation({ kind, code, onContinue }: {
  kind: 'create' | 'join';
  code: string;
  onContinue: () => void;
}) {
  return <section className="notice min-w-0 space-y-3 break-words" style={{ fontSize: '1rem', lineHeight: 1.5 }} aria-label="Room confirmation">
    <h2>{kind === 'create' ? 'Room created' : 'Room joined'}</h2>
    <output className="block" aria-live="polite">
      {kind === 'create'
        ? <>Room <strong>{code}</strong> is ready. Share the room code or invitation link from the lobby so others can join.</>
        : <>You have joined room <strong>{code}</strong>. Your faction and the rules are shown at the table.</>}
    </output>
    <p>Use Protect your saved seat to keep a recovery kit. This message stays until you select Continue.</p>
    <Button type="button" variant="outline" className="min-h-11" style={{ fontSize: '1rem' }} onClick={onContinue}>Continue</Button>
  </section>;
}
