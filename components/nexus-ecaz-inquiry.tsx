'use client';

import { useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { ecazInquiryAction } from '@/game/nexus-ecaz-inquiry-options';
import { Button } from './ui/button';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };

export function NexusEcazInquiry({ game, act, busy }: Props) {
  const [selected, select] = useState('');
  const { offer, history } = game.nexusEcazInquiry;
  if (!offer && !history.length) return null;
  const target = offer?.targets.find(player => player.id === selected) ??
    offer?.targets.find(player => player.id !== game.me) ?? offer?.targets[0];
  const action = target ? ecazInquiryAction(game, target.id) : null;
  return (
    <section aria-label="Your Ecaz Nexus inquiry" className="space-y-3 rounded-lg border border-[#a88b60]/50 p-3">
      <h3>Ecaz Nexus · Secret Ally inquiry</h3>
      {offer && <>
        <p>Spend the Ecaz Nexus card to learn whether one player holds any of your native leaders as Traitor Cards. You receive only yes or no, not a name or count. The answer is saved at the time of use.</p>
        <label className="block space-y-1"><span>Ask about player</span>
          <select className="min-h-11 w-full" value={target?.id ?? ''} disabled={busy || !!offer.blocked}
            onChange={event => select(event.target.value)}>
            {offer.targets.map(player => <option key={player.id} value={player.id}>{player.name}{player.id === game.me ? ' · yourself' : ''}</option>)}
          </select>
        </label>
        {offer.blocked && <p className="notice">{offer.blocked}</p>}
        <Button className="game-action min-h-11 whitespace-normal" disabled={busy || !action}
          onClick={() => { if (!busy && action) act(action); }}>
          Spend Ecaz Nexus · ask privately
        </Button>
      </>}
      {!!history.length && <div aria-label="Your earlier Ecaz inquiries" className="space-y-2">
        <h4>Earlier answers</h4>
        <ol className="list-decimal space-y-1 pl-5">
          {history.map(receipt => <li key={receipt.event}>
            Turn {receipt.turn}, phase {receipt.phase} · {game.players.find(player => player.id === receipt.target)?.name ?? 'Player'} held one of your native leaders: {receipt.answer ? 'Yes' : 'No'}.
          </li>)}
        </ol>
      </div>}
    </section>
  );
}
