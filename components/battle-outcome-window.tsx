'use client';

import type { BattleOutcomeWindow } from '@/game/battle-outcome-window';
import { Button } from './ui/button';

export function BattleOutcomeWindowControls({
  window,
  me,
  players,
  busy,
  onReady,
}: {
  window: BattleOutcomeWindow;
  me: string;
  players: readonly { id: string; name: string }[];
  busy: boolean;
  onReady: (event: string) => void;
}) {
  const combatants = [window.attacker, window.defender];
  const participant = combatants.includes(me);
  const ownReady = window.ready.includes(me);
  return (
    <section className="my-4 flex min-w-0 flex-col gap-3" aria-label="Final battle actions" data-event={window.event}>
      <h3>Final battle actions</h3>
      <p>
        Play any optional final battle card you want to use, then finish.
        Battle resolution waits for both players.
      </p>
      <p className="notice">
        If Juice of Sapho changes the aggressor, both finished marks are
        cleared and both players get a fresh final opportunity.
      </p>
      <ul aria-label="Final battle action status">
        {combatants.map(player => (
          <li key={player}>
            {players.find(seat => seat.id === player)?.name ?? player}:{' '}
            {window.ready.includes(player) ? 'Finished' : 'Choosing final actions'}
          </li>
        ))}
      </ul>
      {participant && (
        <Button
          className="min-h-11 whitespace-normal motion-reduce:transition-none"
          disabled={busy || window.closed || ownReady}
          onClick={() => {
            if (!participant || busy || window.closed || ownReady) return;
            onReady(window.event);
          }}
        >
          Finish final battle actions
        </Button>
      )}
    </section>
  );
}
