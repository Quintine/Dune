'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { nexusChoamTradeAction } from '@/game/nexus-choam-trade-options';
import { CardInspector } from './card-inspector';
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
      <p className="fine">Optional: keep both cards by continuing the phase. This Nexus card’s battle inspection alternative is still in development.</p>
    </section>
  );
}
