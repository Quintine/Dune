'use client';

import { useEffect, useRef, useState } from 'react';
import { faction } from '@/game/catalog';
import type { Action, GameView } from '@/game/engine';
import { Button } from '@/components/ui/button';

type Deal = GameView['deals'][number];

/** The whole table can read an offer and its history; only its parties act. */
export function PublicDealList({ game, act, disabled }: {
  game: GameView;
  act: (action: Action) => void;
  disabled: boolean;
}) {
  const name = (id: string) => {
    const player = game.players.find(candidate => candidate.id === id);
    return player ? `${player.name} (${faction(player.faction).name})` : 'Unknown player';
  };
  const canAct = game.status === 'playing' && !game.players.find(player => player.id === game.me)?.bot;
  const deals: Deal[] = game.deals ?? [];
  if (!deals.length) return <p>No public deals have been proposed.</p>;
  return <ol>
    {deals.map(deal => {
      const party = game.me === deal.from || game.me === deal.to;
      const voted = deal.releaseVotes.includes(game.me);
      const partner = game.me === deal.from ? deal.to : deal.from;
      return <li key={deal.id}>
        <p><strong>{name(deal.from)} → {name(deal.to)}</strong> · Turn {deal.turn} · {deal.status}</p>
        <p>{deal.terms}</p>
        {deal.status === 'active' && deal.releaseVotes.length > 0 && <p>
          Release requested by {deal.releaseVotes.map(name).join(', ')}. Both parties must agree to release the deal.
        </p>}
        {canAct && deal.status === 'offered' && deal.to === game.me && <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={disabled} onClick={() => act({ type: 'dealRespond', deal: deal.id, accept: true })}>Accept deal</Button>
          <Button type="button" variant="outline" disabled={disabled} onClick={() => act({ type: 'dealRespond', deal: deal.id, accept: false })}>Decline deal</Button>
        </div>}
        {canAct && deal.status === 'offered' && deal.from === game.me && <Button type="button" variant="outline" disabled={disabled}
          onClick={() => act({ type: 'dealWithdraw', deal: deal.id })}>Withdraw offer</Button>}
        {canAct && deal.status === 'active' && party && <Button type="button" variant="outline" disabled={disabled}
          onClick={() => act({ type: 'dealRelease', deal: deal.id, agree: !voted })}>
          {voted ? 'Withdraw release request' : deal.releaseVotes.includes(partner) ? 'Agree to release deal' : 'Request release of deal'}
        </Button>}
      </li>;
    })}
  </ol>;
}

export function PublicDeals({ game, act, busy }: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const [target, setTarget] = useState('');
  const [terms, setTerms] = useState('');
  const needsResponse = game.status === 'playing' && game.deals.some(deal =>
    deal.status === 'offered' && deal.to === game.me ||
    deal.status === 'active' && (deal.from === game.me || deal.to === game.me) &&
      !deal.releaseVotes.includes(game.me) && deal.releaseVotes.length > 0);
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (needsResponse && panel.current) panel.current.open = true; }, [needsResponse]);
  if (game.status !== 'playing' && game.status !== 'finished') return null;
  const me = game.players.find(player => player.id === game.me);
  const targets = game.players.filter(player => me && player.id !== me.id && !player.bot &&
    player.id !== me.ally && player.ally !== me.id);
  const recipient = targets.find(player => player.id === target);
  const disabled = busy || !!game.roomControl?.paused || !!game.roomControl?.closed || !!me?.autopilot;
  const mayOffer = game.status === 'playing' && me && !me.bot;
  return <details ref={panel} className="notice public-deals-panel">
    <summary>Public deals{needsResponse ? ' · your response requested' : game.deals?.some(deal => deal.status === 'offered' || deal.status === 'active') ? ' · proposals or active deals' : ''}</summary>
    <p>Deals are public. A recipient must accept an offer. Players must honor valid terms; an impossible part is void, and both parties can agree to release a deal. The game records the terms but cannot automatically enforce free-text promises or determine when they become impossible.</p>
    <p>Do not trade cards, forces, leaders or faction powers, or make terms that contradict the rules or faction powers. A deal does not automatically transfer spice; use the Bribes control to make an eligible payment. <a href="/rules?topic=bribes#bribes">Bribe rules</a></p>
    {mayOffer && <form onSubmit={event => {
      event.preventDefault();
      const text = terms.trim();
      if (!disabled && recipient && text && text.length <= 500) act({ type: 'dealOffer', target: recipient.id, terms: text });
    }}>
      <label>Deal recipient
        <select value={recipient ? target : ''} onChange={event => setTarget(event.target.value)} disabled={disabled}>
          <option value="">Choose a faction</option>
          {targets.map(player => <option key={player.id} value={player.id}>{player.name} · {faction(player.faction).name}</option>)}
        </select>
      </label>
      <label>Public deal terms
        <textarea rows={3} maxLength={500} value={terms} onChange={event => setTerms(event.target.value)} disabled={disabled}
          placeholder="Describe the agreement for the table" />
      </label>
      <p className="fine">Up to 500 characters. Offers are available to human non-allied players; AI negotiation is unfinished.</p>
      <Button type="submit" disabled={disabled || !recipient || !terms.trim()}>Offer public deal</Button>
      {targets.length === 0 && <p>No eligible human recipient is available.</p>}
    </form>}
    <h3>Deal history</h3>
    <PublicDealList game={game} act={act} disabled={disabled} />
  </details>;
}
