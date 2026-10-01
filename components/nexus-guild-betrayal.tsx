'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusCardMode } from '@/game/nexus-cards';
import { NexusCardFace } from './nexus-cards';
import { Button } from './ui/button';

export function NexusGuildBetrayal({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const reaction = game.guildBetrayalReaction;
  if (!reaction) return null;
  const shipper = game.players.find((player) => player.id === reaction.shipper);
  const canRespond = !!reaction.event && reaction.canPass && !reaction.hasPassed;
  const canUse = canRespond && reaction.canUse && !reaction.blocked;
  const disabled = busy || game.status !== 'playing';
  const own = game.players.find((player) => player.id === game.me);
  const ownGuildMode = game.nexusCards?.card === 'guild' && own
    ? nexusCardMode('guild', own.faction, game.players.map((player) => player.faction))
    : undefined;

  return (
    <section aria-label="Guild Nexus Betrayal response" className="notice min-w-0 space-y-3">
      <h3>Guild Nexus Betrayal · before shipment payment</h3>
      <p>{shipper?.name ?? 'The shipper'} has a pending shipment payment. No payment or force delivery has happened yet.</p>
      <p className="fine">
        Every publicly possible unallied responder acknowledges this boundary, regardless of their secret Nexus identity.
        Passing allows the original shipment after all required acknowledgements. Betrayal takes the whole original funded payment,
        including your own payment, instead of the Guild, Spice Bank or Junction occupier receiving it. It does not create another shipment.
        Your own refund cannot fund the upfront cost. This response reveals no private price, route or source.{' '}
        <a href="/rules?topic=nexus-guild-betrayal#nexus-guild-betrayal">Betrayal timing and preview limits</a>
      </p>
      {game.nexusCards?.card === 'guild' && <NexusCardFace card="guild" mode={ownGuildMode} />}
      {!canRespond ? (
        <p aria-live="polite">{reaction.hasPassed ? 'You have passed. Waiting for the remaining acknowledgements.' : 'Waiting for the required acknowledgements.'}</p>
      ) : (
        <>
          {reaction.blocked && <p className="fine">{reaction.blocked}</p>}
          <Button
            className="game-action min-h-11 whitespace-normal"
            disabled={disabled}
            onClick={() => { if (!disabled) act({ type: 'guildBetrayalPass', event: reaction.event }); }}
          >
            Pass · allow the original shipment payment
          </Button>
          {canUse && (
            <Button
              className="game-action min-h-11 whitespace-normal"
              disabled={disabled}
              onClick={() => { if (!disabled) act({ type: 'guildBetrayalUse', event: reaction.event }); }}
            >
              Use Guild Nexus · take the whole shipment payment
            </Button>
          )}
        </>
      )}
    </section>
  );
}
