'use client';

import type { Action, GameView } from '@/game/engine';
import { CardInspector, CardRules } from './card-inspector';
import { NexusCardFace } from './nexus-cards';
import { Button } from './ui/button';

export function NexusRicheseBetrayal({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const reaction = game.richeseBetrayalReaction;
  if (!reaction) return null;
  const target = game.players.find((player) => player.id === reaction.target);
  const buyer = game.players.find((player) => player.id === reaction.buyer);
  const canRespond = reaction.canPass && !reaction.hasPassed;
  const canUse = canRespond && reaction.canUse && !reaction.blocked;
  const disabled = busy || game.status !== 'playing';
  // The receipt grants no card-face entitlement. Only the already-public cache
  // face is shown; a Black Market face is never inferred from a seller's hand.
  const card = reaction.source === 'cache' && game.richeseAuction?.source === 'cache'
    ? game.richeseAuction.card
    : null;

  return (
    <section aria-label="Richese Nexus Betrayal response" className="notice min-w-0 space-y-3">
      <h3>Richese Nexus Betrayal · before payment</h3>
      <p>
        {buyer?.name ?? 'The buyer'} won {reaction.source === 'cache' ? 'the public cache lot' : 'the concealed Black Market lot'} for {reaction.price} spice.
        {reaction.kind === 'purchase'
          ? ` ${target?.name ?? 'Richese'} is buying its own cache card. Betrayal discards that card without payment or delivery.`
          : ` Payment would go to ${target?.name ?? 'Richese'}. Betrayal sends the same payment to the Spice Bank instead; the buyer still receives the card.`}
      </p>
      {card && <div className="space-y-2"><CardRules card={card} /><CardInspector card={card} /></div>}
      {reaction.source === 'blackMarket' && <p>The card remains face down; this response does not grant inspection.</p>}
      <p className="fine">
        Every publicly possible unallied responder acknowledges this boundary, regardless of their secret Nexus identity.
        Passing continues the original auction after all required acknowledgements; no payment or acquisition has happened yet.{' '}
        <a href="/rules?topic=nexus-richese-betrayal#nexus-richese-betrayal">Betrayal timing and preview limits</a>
      </p>
      {!canRespond ? (
        <p aria-live="polite">{reaction.hasPassed ? 'You have passed. Waiting for the remaining acknowledgements.' : 'Waiting for the required acknowledgements.'}</p>
      ) : (
        <>
          {reaction.blocked && <p className="fine">{reaction.blocked}</p>}
          <Button
            className="game-action min-h-11 whitespace-normal"
            disabled={disabled}
            onClick={() => { if (!disabled) act({ type: 'richeseBetrayalPass', event: reaction.event }); }}
          >
            Pass · allow the original purchase
          </Button>
          {canUse && (
            <div className="space-y-3">
              {game.nexusCards?.card === 'richese' && <NexusCardFace card="richese" mode="betrayal" />}
              <Button
                className="game-action min-h-11 whitespace-normal"
                disabled={disabled}
                onClick={() => { if (!disabled) act({ type: 'richeseBetrayalUse', event: reaction.event }); }}
              >
                {reaction.kind === 'purchase' ? 'Use Richese Nexus · discard purchase without payment' : 'Use Richese Nexus · divert payment to Spice Bank'}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
