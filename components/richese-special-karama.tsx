'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { Button } from './ui/button';
import { CardInspector, CardRules } from './card-inspector';

export function RicheseSpecialKarama({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [activation, setActivation] = useState('');
  const [selection, setSelection] = useState('');
  const purchase = game.richeseSpecialKarama;
  if (!purchase) return null;
  const karama =
    purchase.karamas.find((card) => card.id === activation) ??
    purchase.karamas[0];
  const acquired =
    purchase.cards.find((card) => card.id === selection) ?? purchase.cards[0];
  const payee = purchase.payee
    ? (game.players.find((player) => player.id === purchase.payee)?.name ??
      'Emperor')
    : 'the Spice Bank';
  const reason =
    purchase.blocked ??
    (!karama
      ? 'You need an available Karama card.'
      : !acquired
        ? 'No cache card is available for this purchase.'
        : null);
  return (
    <details className="my-4">
      <summary className="min-h-11 cursor-pointer py-3">
        Richese special Karama: buy from your cache
      </summary>
      <div className="flex flex-col gap-4 py-3">
        <p>
          Spend a Karama and 3 of your spice to secretly choose a cache card for
          your hand. This uses your once-per-game special power. Payment goes to{' '}
          {payee}.
        </p>
        <p className="fine">
          The special purchase cannot be canceled by Karama. Emperor income has
          its separate response. The remaining Richese card effects are still
          being implemented; inspect a card before choosing it.
        </p>
        {purchase.karamas.length > 0 && (
          <>
            <label htmlFor={`${id}-activation`}>Karama to spend</label>
            <select
              id={`${id}-activation`}
              className="min-h-11"
              value={karama?.id ?? ''}
              disabled={busy}
              onChange={(event) => setActivation(event.target.value)}
            >
              {purchase.karamas.map((card) => (
                <option value={card.id} key={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
            {karama && <CardInspector card={karama} />}
          </>
        )}
        {purchase.cards.length > 0 && (
          <>
            <label htmlFor={`${id}-selection`}>Private cache choice</label>
            <select
              id={`${id}-selection`}
              className="min-h-11"
              value={acquired?.id ?? ''}
              disabled={busy}
              onChange={(event) => setSelection(event.target.value)}
            >
              {purchase.cards.map((card) => (
                <option value={card.id} key={card.id}>
                  {card.name}
                </option>
              ))}
            </select>
            {acquired && (
              <div className="flex flex-col gap-3">
                <CardRules card={acquired} />
                <CardInspector card={acquired} />
              </div>
            )}
          </>
        )}
        {reason && (
          <p id={`${id}-reason`} className="notice">
            {reason}
          </p>
        )}
        <Button
          className="min-h-11 whitespace-normal"
          disabled={busy || !!reason}
          aria-describedby={reason ? `${id}-reason` : undefined}
          onClick={() => {
            if (!busy && !reason && karama && acquired)
              act({
                type: 'card',
                mode: 'special',
                card: karama.id,
                acquire: acquired.id,
              });
          }}
        >
          Spend Karama and 3 spice to buy {acquired?.name ?? 'a cache card'}
        </Button>
      </div>
    </details>
  );
}
