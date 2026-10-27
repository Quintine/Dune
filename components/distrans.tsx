'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { CardInspector, CardRules } from './card-inspector';
import { DistransTransferAction } from './distrans-transfer-action';

export function Distrans({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [target, setTarget] = useState('');
  const [selection, setSelection] = useState('');
  const distrans = game.distrans;
  if (!distrans) return null;
  const choice =
    distrans.choices.find((candidate) => candidate.recipient === target) ??
    distrans.choices.find(
      (candidate) => !candidate.blocked && candidate.cards.length > 0,
    ) ??
    distrans.choices[0];
  const recipient = game.players.find(
    (player) => player.id === choice?.recipient,
  );
  const given =
    choice?.cards.find((card) => card.id === selection) ?? choice?.cards[0];
  const reason =
    distrans.blocked ??
    choice?.blocked ??
    (!choice
      ? 'No recipient is available.'
      : !given
        ? 'No other card is available to transfer to this player.'
        : null);
  return (
    <details className="my-4 min-w-0">
      <summary className="min-h-11 cursor-pointer py-3">
        Distrans: transfer a card
      </summary>
      <div className="flex min-w-0 flex-col gap-4 py-3">
        <p>
          Give one other card from your hand to another player with room, then
          discard Distrans. No spice is paid. The transfer happens immediately,
          without a recipient confirmation or Karama response.
        </p>
        <p className="m-0 text-sm leading-6" aria-label="Provisional Distrans bid timing">
          Provisional bid timing: you may transfer before the first bid or pass
          on an ordinary, Once Around or normal Black Market lot, or before the
          first sealed submission in a Silent lot. Once that bidding has begun,
          the lot stays blocked while unresolved.
        </p>
        <CardInspector card={distrans.card} />
        {choice && (
          <>
            <label htmlFor={`${id}-target`}>Recipient</label>
            <select
              id={`${id}-target`}
              className="min-h-11 w-full min-w-0"
              value={choice.recipient}
              disabled={busy}
              onChange={(event) => {
                setTarget(event.target.value);
                setSelection('');
              }}
            >
              {distrans.choices.map((candidate) => (
                <option key={candidate.recipient} value={candidate.recipient}>
                  {game.players.find(
                    (player) => player.id === candidate.recipient,
                  )?.name ?? 'Player'}
                  {candidate.blocked ? ' — unavailable' : ''}
                </option>
              ))}
            </select>
            {choice.cards.length > 0 && (
              <>
                <label htmlFor={`${id}-given`}>Your card to transfer</label>
                <select
                  id={`${id}-given`}
                  className="min-h-11 w-full min-w-0"
                  value={given?.id ?? ''}
                  disabled={busy}
                  onChange={(event) => setSelection(event.target.value)}
                >
                  {choice.cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
                {given && (
                  <div className="flex min-w-0 flex-col gap-3">
                    <CardRules card={given} />
                    <CardInspector card={given} />
                  </div>
                )}
              </>
            )}
          </>
        )}
        {reason && (
          <p id={`${id}-reason`} className="notice">
            {reason}
          </p>
        )}
        <DistransTransferAction
          card={distrans.card}
          recipient={choice ? { id: choice.recipient, name: recipient?.name } : undefined}
          given={given}
          reason={reason}
          reasonId={`${id}-reason`}
          busy={busy}
          act={act}
        />
        {!!choice?.unavailable.length && (
          <div
            className="flex min-w-0 flex-col gap-3"
            aria-labelledby={`${id}-unavailable`}
          >
            <h4 id={`${id}-unavailable`}>
              Your cards unavailable for this transfer
            </h4>
            <ul className="flex list-none flex-col gap-4 p-0">
              {choice.unavailable.map(({ card, reason: blocked }) => (
                <li key={card.id} className="flex min-w-0 flex-col gap-2">
                  <strong>{card.name}</strong>
                  <p>{blocked}</p>
                  <CardInspector card={card} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
