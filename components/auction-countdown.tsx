'use client';

import { useEffect, useState } from 'react';
import type { AuctionClockView } from '@/game/auction-clock';

/** Browser time only animates the latest public server frame. It never submits
 * an auction action or decides that an authoritative deadline has expired. */
export function AuctionCountdown({ clock, playerName, paused = false }: {
  clock: AuctionClockView | null;
  playerName: string;
  paused?: boolean;
}) {
  const [local, setLocal] = useState<{ clock: AuctionClockView; remainingMs: number } | null>(null);
  const running = !!clock?.event && clock.running && !paused;
  useEffect(() => {
    if (!clock || !running || clock.remainingMs <= 0) return;
    const startedAt = performance.now();
    const timer = setInterval(() => {
      const remainingMs = Math.max(0, clock.remainingMs - Math.max(0, performance.now() - startedAt));
      setLocal({ clock, remainingMs });
      if (remainingMs === 0) clearInterval(timer);
    }, 200);
    return () => clearInterval(timer);
  }, [clock, running]);

  if (!clock) return null;
  const remainingMs = running && local?.clock === clock ? local.remainingMs : Math.max(0, clock.remainingMs);
  const seconds = Math.ceil(remainingMs / 1000);
  const status = clock.event !== null && seconds === 0
    ? `${paused ? 'Auction paused. ' : ''}Awaiting server resolution.`
    : clock.event === null
      ? `${paused ? 'Auction paused. ' : ''}Clock starts when ordinary bidding is ready.`
      : paused ? 'Auction paused.'
        : !clock.running ? 'Bidding clock held while the current game decision finishes.'
          : `${playerName} may bid or pass.`;
  return <section className="notice space-y-2" aria-label="Ordinary auction countdown" data-testid="auction-countdown">
    <output className="block">{status}</output>
    <p role="timer" aria-live="off" aria-atomic="true" aria-label={`${playerName}’s remaining bidding time`}
      className="font-semibold tabular-nums">{seconds} {seconds === 1 ? 'second' : 'seconds'} {clock.event === null ? 'available' : 'remaining'}</p>
    <p className="fine">Ordinary bidding gives each player 10 seconds to bid or pass. The server controls the deadline and resolves expiry.</p>
    <p className="fine">Online convention: if passing would violate a binding Truthtrance answer, the server submits only the required legal bid.
      If that bid wins, its normal payment is still owed.</p>
  </section>;
}
