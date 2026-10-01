'use client';

import type { Action, GameView } from '@/game/engine';
import { nexusCardMode } from '@/game/nexus-cards';
import { faction } from '@/game/catalog';
import { leaderStrengthLabel } from '@/game/cards';
import { LeaderInspector } from './leader-inspector';
import { NexusCardFace } from './nexus-cards';
import { Button } from './ui/button';

export function NexusHarkonnenBetrayal({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const reaction = game.nexusHarkonnenBetrayalReaction;
  if (!reaction) return null;
  const own = game.players.find((player) => player.id === game.me);
  const name = (id: string) => game.players.find((player) => player.id === id)?.name ?? id;
  const declaredTraitor = game.allLeaders.find((leader) => leader.id === reaction.identity);
  const traitor = declaredTraitor?.name ?? reaction.identity;
  const declaredLeader = game.allLeaders.find((leader) => leader.id === reaction.leader)?.name ?? reaction.leader;
  const canRespond = !!reaction.event && reaction.canPass && !reaction.hasPassed;
  const canUse = canRespond && reaction.canUse && !reaction.blocked;
  const priorityBlocked = game.automaticContinuationPending || !!game.truthtrance ||
    !!game.response || !!game.decision || !!game.phaseOpening ||
    !!game.nexusCards?.waiting.length || !!game.nexusTraitors?.pending;
  const disabled = busy || game.status !== 'playing' || game.phase !== 6 || priorityBlocked ||
    !!game.roomControl?.paused || !!game.roomControl?.closed || !!own?.autopilot;
  const card = game.nexusCards?.card;
  const ownMode = card && own
    ? nexusCardMode(card, own.faction, game.players.map((player) => player.faction))
    : undefined;

  return (
    <section aria-label="Declared Harkonnen traitor acknowledgement" data-testid="nexus-harkonnen-betrayal" className="notice min-w-0 space-y-3 break-words">
      <h3>Declared Harkonnen traitor acknowledgement</h3>
      <p>{name(reaction.provider)} has declared the {traitor} Traitor Card for {name(reaction.beneficiary)}
        {' '}against {name(reaction.target)}’s {declaredLeader}. The traitor battle outcome has not happened.</p>
      {declaredTraitor && (
        <LeaderInspector
          kind="traitor"
          identity={{
            id: declaredTraitor.id,
            name: declaredTraitor.name,
            factionName: faction(declaredTraitor.faction).name,
            strength: leaderStrengthLabel(declaredTraitor),
          }}
        />
      )}
      <p className="fine">Every publicly possible unallied responder acknowledges this declaration, regardless of their secret Nexus identity.
        After all passes, the original traitor call continues once. Any native Karama counter finishes first;
        this acknowledgement is not another Karama counter window.</p>
      {card && <NexusCardFace card={card} mode={ownMode} />}
      {canUse && <p className="fine">Spend your own Harkonnen Nexus to cancel this declared traitor call.
        The declared Traitor Card is shuffled into the Traitor Deck immediately; Harkonnen draws one private
        replacement automatically during this turn’s Mentat Pause. No replacement selection or confirmation is needed.
        {' '}<a href="/rules?topic=nexus-harkonnen-betrayal#nexus-harkonnen-betrayal">Betrayal timing and preview limits</a>
      </p>}
      {!canRespond ? (
        <p aria-live="polite">{reaction.hasPassed ? 'You have passed. Waiting for the remaining acknowledgements.' : 'Waiting for the required acknowledgements.'}</p>
      ) : <>
        {reaction.blocked && <output className="fine block">{reaction.blocked}</output>}
        <Button data-testid="nexus-harkonnen-betrayal-pass" className="game-action min-h-11 whitespace-normal" disabled={disabled}
          onClick={() => { if (!disabled) act({ type: 'nexusHarkonnenBetrayalPass', event: reaction.event }); }}>
          Pass · allow the declared traitor call
        </Button>
        {canUse && <Button data-testid="nexus-harkonnen-betrayal-use" className="game-action min-h-11 whitespace-normal" disabled={disabled}
          onClick={() => { if (!disabled) act({ type: 'nexusHarkonnenBetrayalUse', event: reaction.event }); }}>
          Use Harkonnen Nexus · cancel this traitor call
        </Button>}
      </>}
    </section>
  );
}
