'use client';
import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { bribeAction } from '@/game/bribe-options';
import { faction } from '@/game/catalog';
import { Button } from '@/components/ui/button';

export function Bribes({ game: g, act, busy }: {
  game: GameView; act: (action: Action) => void; busy: boolean;
}) {
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('1');
  const description = useId();
  if (g.status !== 'playing') return null;
  const options = g.bribeOptions;
  const recipient = options.targets.find(candidate => candidate.id === target);
  const player = recipient && g.players.find(candidate => candidate.id === recipient.id);
  const action = bribeAction(options, target, Number(amount));
  return (
    <details className="notice bribe-panel">
      <summary>Bribes{options.incoming > 0 ? ` · ${options.incoming} spice awaiting Mentat` : ''}</summary>
      <p id={description}>Pay another non-allied faction now. The amount is public; the recipient can spend their share only from the next Mentat Pause. A message or promise alone does not pay spice.</p>
      <p>Your incoming bribes: <strong>{options.incoming} spice</strong>, separate from your spendable supply.</p>
      {options.blocked ? <output className="bribe-status">{options.blocked}</output> : null}
      {options.targets.length === 0 ? <p>No non-allied recipient is available.</p> : (
        <div className="bribe-fields">
          <label>Bribe recipient
            <select value={recipient ? target : ''} onChange={event => setTarget(event.target.value)} disabled={busy || !!options.blocked}>
              <option value="">Choose a faction</option>
              {options.targets.map(candidate => {
                const seat = g.players.find(player => player.id === candidate.id)!;
                return <option key={seat.id} value={seat.id}>{seat.name} · {faction(seat.faction).name}</option>;
              })}
            </select>
          </label>
          <label>Bribe amount
            <input type="number" inputMode="numeric" min={1} max={recipient?.maximum ?? options.available}
              step={1} value={amount} onChange={event => setAmount(event.target.value)}
              disabled={busy || !!options.blocked || !recipient} aria-describedby={description} />
          </label>
          <Button className="game-action" disabled={busy || !action} onClick={() => { if (action) act(action); }}>
            {player && action ? `Pay ${Number(amount)} spice to ${player.name}` : 'Pay bribe'}
          </Button>
        </div>
      )}
      <p>{recipient ? `You may pay up to ${recipient.maximum} spice to this recipient.` : `Uncommitted spice: ${options.available}. Choose a recipient to see the payment limit.`}</p>
      {recipient?.limitation ? <p>{recipient.limitation}</p> : null}
      {recipient && !options.blocked && !action ? <output className="bribe-status">{recipient.maximum < 1 ? 'No spice is available for this payment.' : `Enter a whole number from 1 to ${recipient.maximum}.`}</output> : null}
      <p>Eligible Bureaucrats may divert two spice to the Bank. AI opponents can receive spice, but do not negotiate deals yet. <a href="/rules?topic=bribes#bribes">Bribe rules</a></p>
    </details>
  );
}
