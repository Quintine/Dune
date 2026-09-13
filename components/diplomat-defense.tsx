'use client';

import type { Action, GameView } from '@/game/engine';
import { battleCardLabel } from '@/game/battle-cards';
import { Button } from './ui/button';

export function DiplomatDefense({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const decision =
    game.decision?.kind === 'diplomatDefense' ? game.decision : null;
  if (!decision || decision.player !== game.me) return null;
  const me = game.players.find((player) => player.id === game.me);
  const visibleCards = [...(game.battle?.cards ?? []), ...(me?.hand ?? [])];
  const card = (id: string) => visibleCards.find((entry) => entry.id === id);
  const source = card(decision.source);
  const copiedDefense = source ? battleCardLabel(source.kind) : 'defense';
  return (
    <div className="flex flex-col gap-3" aria-label="Diplomat defense choice">
      <p>
        The opposing committed defense,{' '}
        <strong>{source?.name ?? decision.source}</strong>, provides{' '}
        <strong>{copiedDefense}</strong> protection. Diplomat can copy that
        protection onto one of your committed Worthless cards.
      </p>
      <p className="fine">
        Choose one committed Worthless card as the copied defense. That card
        must be discarded after this battle. Decline to proceed without a copied
        defense.
      </p>
      {decision.cards.map((id) => (
        <Button
          key={id}
          className="game-action min-h-11 whitespace-normal"
          disabled={busy}
          onClick={() =>
            !busy && act({ type: 'decision', event: decision.event, card: id })
          }
        >
          Copy {source?.name ?? copiedDefense} with {card(id)?.name ?? id} ·
          mandatory discard
        </Button>
      ))}
      <Button
        variant="outline"
        className="game-action min-h-11 whitespace-normal"
        disabled={busy}
        onClick={() =>
          !busy && act({ type: 'decision', event: decision.event, card: null })
        }
      >
        Decline Diplomat defense
      </Button>
    </div>
  );
}
