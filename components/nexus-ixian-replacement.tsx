'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusCardMode } from '@/game/nexus-cards';
import { CardInspector, CardRules } from './card-inspector';
import { NexusCardFace } from './nexus-cards';
import { Button } from './ui/button';

/** The public boundary is neutral; only the buyer's projection authorizes a choice. */
export function NexusIxianReplacement({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const offer = game.nexusIxianReplacement;
  if (!offer) return null;
  const buyer = game.players.find((player) => player.id === offer.buyer);
  const own = game.players.find((player) => player.id === game.me);
  const canRespond = !!offer.event && offer.buyer === game.me && offer.canPass;
  const canUse = canRespond && offer.canUse && !offer.blocked && !!offer.purchased;
  const priorityBlocked = !!game.truthtrance || !!game.response || !!game.phaseOpening ||
    !!game.automaticContinuationPending || !!game.kullReaction || !!game.kullCounterEvent ||
    !!game.richeseBetrayalReaction || !!game.guildBetrayalReaction || !!game.semutaReaction ||
    !!game.nexusCards?.waiting.length || !!game.nexusTraitors?.pending ||
    (!!game.decision && (game.decision.kind !== 'nexusIxianReplacement' ||
      game.decision.player !== offer.buyer || game.decision.event !== offer.event));
  const disabled = busy || game.status !== 'playing' || game.phase !== 3 || priorityBlocked ||
    !!game.roomControl?.paused || !!game.roomControl?.closed || !!own?.autopilot;
  const ownIxianMode = game.nexusCards?.card === 'ixians' && own
    ? nexusCardMode('ixians', own.faction, game.players.map((player) => player.faction))
    : undefined;

  return (
    <section aria-label="Purchased card choice" data-testid="nexus-ixian-replacement" className="notice min-w-0 space-y-3">
      <h3>Purchased card choice</h3>
      <p>{buyer?.name ?? 'The buyer'} chooses whether to keep the completed purchase before the auction continues.</p>
      <p className="fine">
        This neutral development-preview boundary is offered independently of the buyer’s private Nexus face.
        Only the buyer can choose. The original payment stays paid; this is not another purchase or auction.{' '}
        <a href="/rules?topic=nexus-ixian-replacement#nexus-ixian-replacement">Purchased-card timing and preview limits</a>
      </p>
      {canRespond && offer.purchased && (
        <article aria-label="Your purchased Treachery Card" className="treachery-card">
          <h4>{offer.purchased.name}</h4>
          <CardRules card={offer.purchased} />
          <CardInspector card={offer.purchased} />
        </article>
      )}
      {game.nexusCards?.card === 'ixians' && (
        <div aria-label="Your private Ixian Nexus card">
          <NexusCardFace card="ixians" mode={ownIxianMode} />
          {canRespond && <p className="fine">
            Secret Ally requires you to be unallied with native Ixians absent. In this preview,
            eligible Use spends your Ixian Nexus and discards only the exact Treachery Card just purchased,
            then draws the actual next card from the Treachery Deck. It does not take an unsold auction card.
            If the deck is empty, the discard is reshuffled after your purchased card enters it;
            drawing that same physical card again is legal. Keeping retains both cards.
          </p>}
        </div>
      )}
      {!canRespond ? (
        <p aria-live="polite">Waiting for {buyer?.name ?? 'the buyer'}’s purchased card choice.</p>
      ) : (
        <>
          {offer.blocked && <p className="fine">{offer.blocked}</p>}
          <Button data-testid="nexus-ixian-replacement-pass" className="game-action min-h-11 whitespace-normal" disabled={disabled}
            onClick={() => { if (!disabled) act({ type: 'nexusIxianReplacementPass', event: offer.event }); }}>
            Keep purchased card
          </Button>
          {canUse && (
            <Button data-testid="nexus-ixian-replacement-use" className="game-action min-h-11 whitespace-normal" disabled={disabled}
              onClick={() => { if (!disabled) act({ type: 'nexusIxianReplacementUse', event: offer.event }); }}>
              Use Ixian Nexus · replace purchased card
            </Button>
          )}
        </>
      )}
    </section>
  );
}
