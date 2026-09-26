'use client';

import { Button } from './ui/button';

export type SeatConfirmationKind = 'recovery' | 'handover';

/** Local acknowledgement only; reconnects and game actions never dismiss it. */
export function SeatConfirmation({ kind, onContinue }: { kind: SeatConfirmationKind; onContinue: () => void }) {
  return <section className="notice" style={{ fontSize: '1rem', lineHeight: 1.5 }} aria-label="Seat confirmation">
    <h2>{kind === 'recovery' ? 'Seat recovered' : 'Seat handover complete'}</h2>
    <output className="block">{kind === 'recovery'
        ? 'Your seat is recovered in this browser. Previous browser sessions for this seat have been revoked.'
        : 'You now control this seat and its saved progress. The previous owner’s access has been revoked. Use Protect your saved seat to create your own recovery kit.'}</output>
    <Button type="button" variant="outline" className="mt-3 min-h-11" style={{ fontSize: '1rem' }} onClick={onContinue}>Continue</Button>
  </section>;
}
