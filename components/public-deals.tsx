'use client';

import { useEffect, useRef, useState } from 'react';
import { faction } from '@/game/catalog';
import { publicDealAcceptVotes, publicDealParticipants } from '@/game/public-deals';
import type { Action, GameView } from '@/game/engine';
import { Button } from '@/components/ui/button';

type Deal = GameView['deals'][number];
type ImmediateBribe = { kind: 'immediateBribe'; payer: string; recipient: string; amount: number };

/** Keep the legacy single-recipient wire packet when only one seat is chosen. */
export function publicDealOfferAction(targets: readonly string[], terms: string, payment?: ImmediateBribe, proposer?: string): Action | null {
  const text = terms.trim();
  if (!targets.length || targets.length > 5 || new Set(targets).size !== targets.length || !text || text.length > 500) return null;
  if (payment && (!proposer || payment.kind !== 'immediateBribe' || payment.payer === payment.recipient ||
      ![proposer, ...targets].includes(payment.payer) || ![proposer, ...targets].includes(payment.recipient) ||
      !Number.isSafeInteger(payment.amount) || payment.amount < 1)) return null;
  const offeredPayment = payment ? { payment } : {};
  return targets.length === 1
    ? { type: 'dealOffer', target: targets[0], terms: text, ...offeredPayment }
    : { type: 'dealOffer', targets: [...targets], terms: text, ...offeredPayment };
}

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
      const participants = publicDealParticipants(deal);
      const accepted = publicDealAcceptVotes(deal);
      const party = participants.includes(game.me);
      const voted = deal.releaseVotes.includes(game.me);
      const recipient = party && game.me !== deal.from;
      const seats = participants.map(id => game.players.find(player => player.id === id));
      const eligible = seats.every((player, index) => player && seats.slice(index + 1).every(other =>
        other && player.ally !== other.id && other.ally !== player.id));
      const payment = (deal as Deal & { payment?: ImmediateBribe }).payment;
      const finalAcceptance = recipient && !accepted.includes(game.me) && accepted.length === participants.length - 1;
      const paymentBlocked = payment && finalAcceptance ? game.bribeOptions?.blocked : null;
      return <li key={deal.id}>
        <p><strong>{name(deal.from)} → {participants.filter(id => id !== deal.from).map(name).join(', ')}</strong> · Turn {deal.turn} · {deal.status}</p>
        <p>{deal.terms}</p>
        {payment && <p><strong>Immediate payment term:</strong> {name(payment.payer)} pays {payment.amount} spice to {name(payment.recipient)} on final acceptance. The payer loses the gross amount immediately; the recipient collects their share at the next Mentat opening. A Bureaucrat may divert two spice to the bank before that share is allocated. Releasing the deal later does not refund the payment.</p>}
        {deal.status === 'offered' && <p>
          Accepted by {accepted.map(name).join(', ')}. Waiting for {participants.filter(id => !accepted.includes(id)).map(name).join(', ')}.
        </p>}
        {deal.status === 'offered' && !eligible && <p>Acceptance is unavailable while any participants are allied; the offer may still be declined or withdrawn.</p>}
        {deal.status === 'offered' && paymentBlocked && <p>Final acceptance must wait: {paymentBlocked} The offer may still be declined or withdrawn.</p>}
        {deal.status === 'active' && deal.releaseVotes.length > 0 && <p>
          Release requested by {deal.releaseVotes.map(name).join(', ')}. All parties must agree to release the deal.
        </p>}
        {canAct && deal.status === 'offered' && recipient && <div className="flex flex-wrap gap-2">
          {!accepted.includes(game.me) && <Button type="button" disabled={disabled || !eligible || !!paymentBlocked} onClick={() => act({ type: 'dealRespond', deal: deal.id, accept: true })}>Accept deal</Button>}
          <Button type="button" variant="outline" disabled={disabled} onClick={() => act({ type: 'dealRespond', deal: deal.id, accept: false })}>Decline deal</Button>
        </div>}
        {canAct && deal.status === 'offered' && deal.from === game.me && <Button type="button" variant="outline" disabled={disabled}
          onClick={() => act({ type: 'dealWithdraw', deal: deal.id })}>Withdraw offer</Button>}
        {canAct && deal.status === 'active' && party && <Button type="button" variant="outline" disabled={disabled}
          onClick={() => act({ type: 'dealRelease', deal: deal.id, agree: !voted })}>
          {voted ? 'Withdraw release request' : deal.releaseVotes.length > 0 ? 'Agree to release deal' : 'Request release of deal'}
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
  const [selected, setSelected] = useState<string[]>([]);
  const [terms, setTerms] = useState('');
  const [includePayment, setIncludePayment] = useState(false);
  const [payer, setPayer] = useState('');
  const [paymentRecipient, setPaymentRecipient] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('1');
  const requests = game.status === 'playing' ? game.deals.flatMap(deal => {
    const participant = publicDealParticipants(deal).includes(game.me);
    if (deal.status === 'offered' && participant && deal.from !== game.me && !publicDealAcceptVotes(deal).includes(game.me))
      return [['offer', deal.id]];
    if (deal.status === 'active' && participant && !deal.releaseVotes.includes(game.me) && deal.releaseVotes.length > 0)
      return [['release', deal.id, ...deal.releaseVotes]];
    return [];
  }) : [];
  const needsResponse = requests.length > 0;
  const requestKey = JSON.stringify(requests);
  const panel = useRef<HTMLDetailsElement>(null);
  useEffect(() => { if (requestKey !== '[]' && panel.current) panel.current.open = true; }, [requestKey]);
  if (game.status !== 'playing' && game.status !== 'finished') return null;
  const me = game.players.find(player => player.id === game.me);
  const targets = game.players.filter(player => me && player.id !== me.id && !player.bot);
  const selectedPlayers = targets.filter(player => selected.includes(player.id));
  const allied = (a: typeof game.players[number], b: typeof game.players[number]) =>
    a.ally === b.id || b.ally === a.id;
  const legalSelection = !!me && selected.length > 0 && selected.length === selectedPlayers.length &&
    selectedPlayers.every((player, index) => !allied(me, player) &&
      selectedPlayers.slice(index + 1).every(other => !allied(player, other)));
  const parties = me ? [me, ...selectedPlayers] : [];
  const amount = Number(paymentAmount);
  const payment: ImmediateBribe | undefined = includePayment
    ? { kind: 'immediateBribe', payer, recipient: paymentRecipient, amount } : undefined;
  const paymentValid = !includePayment || !!me && payer !== paymentRecipient &&
    parties.some(player => player.id === payer) && parties.some(player => player.id === paymentRecipient) &&
    Number.isSafeInteger(amount) && amount > 0;
  const offer = legalSelection && paymentValid ? publicDealOfferAction(selected, terms, payment, me?.id) : null;
  const disabled = busy || !!game.roomControl?.paused || !!game.roomControl?.closed || !!me?.autopilot;
  const mayOffer = game.status === 'playing' && me && !me.bot;
  return <details ref={panel} className="notice public-deals-panel">
    <summary>Public deals{needsResponse ? ' · your response requested' : game.deals?.some(deal => deal.status === 'offered' || deal.status === 'active') ? ' · proposals or active deals' : ''}</summary>
    <p>Deals are public. Every recipient must accept an offer. Players must honor valid terms; an impossible part is void, and all parties can agree to release a deal. The game records the terms but cannot automatically enforce free-text promises or determine when they become impossible.</p>
    <p>Do not trade cards, forces, leaders or faction powers, or make terms that contradict the rules or faction powers. An optional immediate payment uses the ordinary bribe rules; free-text terms do not automatically transfer spice. <a href="/rules?topic=bribes#bribes">Bribe rules</a></p>
    {mayOffer && <form onSubmit={event => {
      event.preventDefault();
      if (!disabled && offer) act(offer);
    }}>
      <fieldset>
        <legend>Deal recipients</legend>
        {targets.map(player => {
          const checked = selected.includes(player.id);
          const conflicts = !!me && (allied(me, player) || selectedPlayers.some(other => other.id !== player.id && allied(other, player)));
          return <label key={player.id} className="checkbox-row">
            <input type="checkbox" checked={checked} disabled={disabled || (!checked && conflicts)}
              onChange={event => {
                const nextChecked = event.target.checked;
                setSelected(current => nextChecked
                  ? current.includes(player.id) ? current : [...current, player.id] : current.filter(id => id !== player.id));
              }} />
            {player.name} · {faction(player.faction).name}{conflicts ? ' (allied with a selected party)' : ''}
          </label>;
        })}
      </fieldset>
      <label className="checkbox-row">
        <input type="checkbox" checked={includePayment} disabled={disabled}
          onChange={event => setIncludePayment(event.target.checked)} />
        Include an immediate spice payment
      </label>
      {includePayment && <fieldset>
        <legend>Payment on final acceptance</legend>
        <label>Paying participant
          <select value={parties.some(player => player.id === payer) ? payer : ''} disabled={disabled}
            onChange={event => setPayer(event.target.value)}>
            <option value="">Choose a payer</option>
            {parties.map(player => <option key={player.id} value={player.id}>{player.name} · {faction(player.faction).name}</option>)}
          </select>
        </label>
        <label>Receiving participant
          <select value={parties.some(player => player.id === paymentRecipient) ? paymentRecipient : ''} disabled={disabled}
            onChange={event => setPaymentRecipient(event.target.value)}>
            <option value="">Choose a recipient</option>
            {parties.filter(player => player.id !== payer).map(player => <option key={player.id} value={player.id}>{player.name} · {faction(player.faction).name}</option>)}
          </select>
        </label>
        <label>Gross spice amount
          <input type="number" inputMode="numeric" min={1} step={1} value={paymentAmount} disabled={disabled}
            onChange={event => setPaymentAmount(event.target.value)} />
        </label>
        <p className="fine">No spice is reserved before final acceptance. The payer loses the full amount immediately; the recipient collects their share at the next Mentat opening. A Bureaucrat may divert two spice to the bank before the share is allocated. Native payment timing and available funds are checked at final acceptance.</p>
        {legalSelection && !paymentValid && <p>Choose two different participants and a positive whole spice amount.</p>}
      </fieldset>}
      <label>Public deal terms
        <textarea rows={3} maxLength={500} value={terms} onChange={event => setTerms(event.target.value)} disabled={disabled}
          placeholder="Describe the agreement for the table" />
      </label>
      <p className="fine">Up to 500 characters. Select human recipients who are not allied with each other or with you; AI negotiation is unfinished.</p>
      <Button type="submit" disabled={disabled || !offer}>Offer public deal</Button>
      {targets.length === 0 && <p>No human recipient is available.</p>}
      {selected.length > 0 && !legalSelection && <p>Clear or change any recipient whose seat or alliance is no longer eligible.</p>}
      {selected.length > 0 && <Button type="button" variant="outline" disabled={disabled} onClick={() => setSelected([])}>Clear recipients</Button>}
    </form>}
    <h3>Deal history</h3>
    <PublicDealList game={game} act={act} disabled={disabled} />
  </details>;
}
