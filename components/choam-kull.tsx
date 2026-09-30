'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { choamPowerKey } from '@/game/choam-power-options';
import { ChoamPowerCost } from './choam-power-cost';
import { NexusCardFace } from './nexus-cards';
import { Button } from './ui/button';

export function ChoamKull({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [selected, select] = useState('');
  const reaction = game.kullReaction;
  if (!reaction) return null;
  const reactor = game.players.find((player) => player.id === reaction.player);
  const target = game.players.find((player) => player.id === reaction.target);
  const ownsOffer = game.me === reaction.player && reaction.canDecline;
  const disabled = busy || game.status !== 'playing';
  // Foreign projections never authorize private cost controls or inspectors.
  const plays = ownsOffer ? reaction.plays : [];
  const play = plays.find((candidate) => choamPowerKey(candidate) === selected) ??
    plays.find((candidate) => !candidate.blocked) ?? plays[0];
  const canUse = !disabled && !reaction.blocked && !!play && !play.blocked;

  return (
    <section aria-label="Kull Wahad response" className="notice min-w-0 space-y-3">
      <h3>Kull Wahad · attempted Karama play</h3>
      <p>
        {target?.name ?? 'The activating player'} is attempting {reaction.intent}.
        The attempted card remains unplayed while {reactor?.name ?? 'CHOAM'} responds.
      </p>
      {!ownsOffer ? (
        <p aria-live="polite">Waiting for {reactor?.name ?? 'CHOAM'} to respond.</p>
      ) : (
        <>
          <p>
            Decline to continue the original play, or choose a listed physical
            cost for Kull Wahad. Printed Kull uses its own Worthless Card;
            CHOAM Nexus Cunning can use any eligible Treachery Card.
            Successful Kull retains the attempted card and prevents that
            player’s Karama activations for this phase. A different eligible
            Karama can prevent Kull before that restriction takes effect.
          </p>
          {reaction.blocked && <p className="fine">{reaction.blocked}</p>}
          <Button
            className="game-action min-h-11 whitespace-normal"
            disabled={disabled}
            onClick={() => {
              if (!disabled)
                act({ type: 'kullDecision', event: reaction.event, decline: true });
            }}
          >
            Decline Kull · allow the attempted play
          </Button>
          {!reaction.blocked && play && (
            <div className="min-w-0 space-y-3">
              <ChoamPowerCost plays={plays} play={play} select={select} busy={disabled} />
              {play.source === 'nexus' && game.nexusCards?.card === 'choam' && (
                <NexusCardFace card={game.nexusCards.card} mode="cunning" />
              )}
              <p className="fine">Physical Treachery cost: {play.card.id}</p>
              <Button
                className="game-action min-h-11 whitespace-normal"
                disabled={!canUse}
                onClick={() => {
                  if (canUse)
                    act({
                      type: 'kullDecision', event: reaction.event,
                      source: play.source, card: play.card.id,
                    });
                }}
              >
                Use Kull Wahad · {play.card.name} ({play.card.id})
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
