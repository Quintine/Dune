'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { nexusChoamTradeAction } from '@/game/nexus-choam-trade-options';
import { CardInspector, CardRules } from './card-inspector';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
export function NexusChoamTrade({ game, act, busy }: Props) {
  const [selected, select] = useState('');
  const offer = game.nexusChoamTrade;
  if (!offer) return null;
  const card = offer.cards.find(choice => choice.id === selected) ?? offer.cards[0];
  const action = card ? nexusChoamTradeAction(game, card.id) : null;
  return (
    <section aria-label="CHOAM Nexus Secret Ally trade" className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
      <h3>CHOAM Nexus · Secret Ally</h3>
      <p>During Spice Collection, discard one Worthless card to receive two spice from the bank. This also spends your CHOAM Nexus card.</p>
      {offer.cards.length > 1 && (
        <label className="block">Worthless card to trade
          <select value={card.id} disabled={busy || !!offer.blocked} onChange={event => select(event.target.value)}>
            {offer.cards.map(choice => <option key={choice.id} value={choice.id}>{choice.name}</option>)}
          </select>
        </label>
      )}
      {card && <div className="flex flex-wrap items-center gap-2"><span>{card.name}</span><CardInspector card={card} /></div>}
      {offer.blocked && <p className="notice">{offer.blocked}</p>}
      <Button className="game-action min-h-11 whitespace-normal" disabled={busy || !action}
        onClick={() => { if (!busy && action) act(action); }}>
        Trade {card?.name ?? 'a Worthless card'} for 2 spice
      </Button>
      <p className="fine">Optional: keep both cards by continuing the phase. The same card can instead be spent after a battle victory to inspect one unused opposing card.</p>
    </section>
  );
}

export function NexusChoamInspectionDecision({ game, act, busy }: Props) {
  const offer = game.nexusChoamInspection;
  if (!offer) return null;
  const opponent = game.players.find(player => player.id === offer.opponent);
  return (
    <section aria-label="Postbattle CHOAM Nexus choice" className="min-w-0 space-y-3">
      <h3 className="font-serif text-xl">After victory · CHOAM Secret Ally</h3>
      <p className="text-base leading-7">
        Every winner receives this private choice. If you hold the CHOAM Nexus
        card while unallied, you may spend it to inspect one random unused card
        held by {opponent?.name ?? 'your opponent'}. Otherwise continue.
      </p>
      <div className="flex flex-wrap gap-2">
        {offer.canInspect && (
          <Button disabled={busy} onClick={() =>
            act({ type: 'decision', event: offer.event, inspect: true })}>
            Spend CHOAM Nexus · inspect one card
          </Button>
        )}
        <Button variant="outline" disabled={busy} onClick={() =>
          act({ type: 'decision', event: offer.event, inspect: false })}>
          Continue without inspection
        </Button>
      </div>
    </section>
  );
}

export function NexusChoamInspectionInsight({ game }: { game: GameView }) {
  const insight = game.nexusChoamInsight;
  if (!insight) return null;
  const opponent = game.players.find(player => player.id === insight.target);
  return (
    <section aria-label="Your private CHOAM Nexus inspection" className="notice min-w-0 space-y-3">
      <h3 className="font-serif text-xl">Your CHOAM Nexus inspection · {opponent?.name}</h3>
      <p className="text-base leading-7">
        Only you see this card. It was in the opposing hand when the battle
        ended; it may move afterward. This snapshot remains until the next
        battle or turn.
      </p>
      <article className="min-w-0 space-y-3 rounded-lg border border-[#485542] p-4">
        <h4 className="font-serif text-xl">{insight.card.name}</h4>
        <CardRules card={insight.card} />
        <CardInspector card={insight.card} />
      </article>
    </section>
  );
}
