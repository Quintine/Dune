'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusCardMode } from '@/game/nexus-cards';
import { NexusCardFace } from './nexus-cards';
import { Button } from './ui/button';

export function NexusIxianBetrayal({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const reaction = game.nexusIxianBetrayalReaction;
  if (!reaction) return null;
  const own = game.players.find((player) => player.id === game.me);
  const provider = game.players.find((player) => player.id === reaction.provider);
  const canRespond = !!reaction.event && reaction.canPass && !reaction.hasPassed;
  const canUse = canRespond && reaction.canUse && !reaction.blocked;
  const priorityBlocked = game.automaticContinuationPending || !!game.truthtrance ||
    !!game.response || !!game.decision || !!game.phaseOpening ||
    !!game.nexusCards?.waiting.length || !!game.nexusTraitors?.pending;
  const disabled = busy || game.status !== 'playing' || game.phase !== 3 || priorityBlocked ||
    !!game.roomControl?.paused || !!game.roomControl?.closed || !!own?.autopilot;
  const ownMode = game.nexusCards?.card === 'ixians' && own
    ? nexusCardMode('ixians', own.faction, game.players.map((player) => player.faction))
    : undefined;
  const advantage = reaction.kind === 'bidding' ? 'Bidding' : 'Technology';

  return (
    <section aria-label="Native Ixian advantage acknowledgement" data-testid="nexus-ixian-betrayal" className="notice min-w-0 space-y-3">
      <h3>Native Ixian advantage acknowledgement · {advantage}</h3>
      <p>{provider?.name ?? 'The Ixian player'} has a pending native {advantage} attempt.
        {reaction.kind === 'bidding'
          ? ' The extra-card draw and inspection have not happened.'
          : ' The declared exchange has not happened.'}</p>
      <p className="fine">Every publicly possible unallied responder acknowledges this boundary, regardless of their secret Nexus identity.
        After all acknowledgements, the original advantage continues once. Preventing it closes only this attempt, not the whole phase.
        The native Karama response finishes first; this acknowledgement is not another Karama counter window.</p>
      {game.nexusCards?.card === 'ixians' && <>
        <NexusCardFace card="ixians" mode={ownMode} />
        {ownMode === 'betrayal' && <p className="fine">Spend your own Ixian Nexus to prevent this one native {advantage} advantage.
          {' '}<a href="/rules?topic=nexus-ixian-betrayal#nexus-ixian-betrayal">Betrayal timing and preview limits</a>
        </p>}
      </>}
      {!canRespond ? (
        <p aria-live="polite">{reaction.hasPassed ? 'You have passed. Waiting for the remaining acknowledgements.' : 'Waiting for the required acknowledgements.'}</p>
      ) : <>
        {reaction.blocked && <p className="fine">{reaction.blocked}</p>}
        <Button data-testid="nexus-ixian-betrayal-pass" className="game-action min-h-11 whitespace-normal" disabled={disabled}
          onClick={() => { if (!disabled) act({ type: 'nexusIxianBetrayalPass', event: reaction.event }); }}>
          Pass · allow the original advantage
        </Button>
        {canUse && <Button data-testid="nexus-ixian-betrayal-use" className="game-action min-h-11 whitespace-normal" disabled={disabled}
          onClick={() => { if (!disabled) act({ type: 'nexusIxianBetrayalUse', event: reaction.event }); }}>
          Use Ixian Nexus · prevent this {advantage} advantage
        </Button>}
      </>}
    </section>
  );
}
