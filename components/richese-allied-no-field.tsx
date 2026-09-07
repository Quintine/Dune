'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import { territory, MOBILE_STRONGHOLD } from '@/game/board';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function RicheseAlliedNoFieldControls({
  game,
  act,
  busy,
  destination,
  sector,
  onSectorChange,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
  destination: string;
  sector: number;
  onSectorChange: (sector: number) => void;
}) {
  const id = useId();
  const [token, setToken] = useState('');
  const [payer, setPayer] = useState('');
  const info = game.richeseNoField;
  const me = game.players.find((player) => player.id === game.me);
  const ally = game.players.find((player) => player.id === me?.ally);
  if (!info || info.owner !== game.me || !info.private || !me || !ally)
    return null;
  const offer = info.allyOffer;
  if (offer?.blocked)
    return (
      <p className="notice">
        This allied shipment offer is no longer available: {offer.blocked} Your
        ally may decline it without payment or token changes.
      </p>
    );
  if (offer)
    return (
      <p className="notice">
        Your private No-Field {offer.value} offer to {ally.name}: {offer.amount}{' '}
        forces in {territory(offer.territory).name}, sector {offer.sector}.{' '}
        {offer.payer === 'both'
          ? 'Each ally pays 1 spice'
          : `${game.players.find((player) => player.id === offer.payer)?.name} pays ${offer.cost} spice`}{' '}
        if the shipment completes. Declining costs nothing.
      </p>
    );
  if (game.phase !== 5 || game.active !== ally.id || ally.shipped) return null;
  const available = info.private.tokens.filter(
    (candidate) => candidate.id !== info.private!.lastShipped,
  );
  const selected =
    available.find((candidate) => candidate.id === token) ?? available[0];
  const target = territory(destination);
  const cost = target.type === 'stronghold' ? 1 : 2;
  const selectedPayer =
    payer === 'both' && cost === 2
      ? 'both'
      : payer === ally.id
        ? ally.id
        : me.id;
  const reasons: string[] = [];
  if (!info.canOfferAlly)
    reasons.push(
      info.allyOfferBlock ?? 'An allied No-Field offer is unavailable now.',
    );
  if (!selected)
    reasons.push('Choose a token different from the last one used.');
  if (destination === MOBILE_STRONGHOLD)
    reasons.push('Direct shipment into the mobile stronghold is unavailable.');
  if (!target.sectors.includes(sector))
    reasons.push('Choose a sector in this territory.');
  if (sector === game.storm)
    reasons.push('You cannot ship into the storm sector.');
  const ownCost =
    selectedPayer === 'both' ? 1 : selectedPayer === me.id ? cost : 0;
  if ((me.spice ?? 0) < ownCost)
    reasons.push('You do not have enough spice to pay for this shipment.');
  return (
    <details className="my-4" open>
      <summary className="min-h-11 cursor-pointer py-3 font-semibold">
        Offer {ally.name} a No-Field shipment
      </summary>
      <div className="flex flex-col gap-3 py-3">
        <p className="fine">
          This replaces your ally’s normal shipment if accepted. The chosen
          value and exact force count are shared privately with your ally. The
          token reveals when the shipment resolves. No payment or existing
          marker changes occur on decline.
        </p>
        {info.private.deployed && (
          <p className="fine">
            If accepted and allowed, your existing concealed No-Field must
            reveal before your ally’s shipment.
          </p>
        )}
        <label htmlFor={`${id}-token`}>Private token</label>
        <select
          id={`${id}-token`}
          className="min-h-11"
          value={selected?.id ?? ''}
          disabled={busy}
          onChange={(event) => setToken(event.target.value)}
        >
          {info.private.tokens.map((candidate) => (
            <option
              key={candidate.id}
              value={candidate.id}
              disabled={candidate.id === info.private!.lastShipped}
            >
              No-Field {candidate.value}
              {candidate.id === info.private!.lastShipped
                ? ' · cannot repeat'
                : ''}
            </option>
          ))}
        </select>
        <p>Destination: {target.name}. Select another territory on the map.</p>
        <label htmlFor={`${id}-sector`}>Sector</label>
        <select
          id={`${id}-sector`}
          className="min-h-11"
          value={sector}
          disabled={busy}
          onChange={(event) => onSectorChange(Number(event.target.value))}
        >
          {target.sectors.map((value) => (
            <option key={value} value={value}>
              {value}
              {value === game.storm ? ' · storm' : ''}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-payer`}>Pay the {cost} spice cost from</label>
        <select
          id={`${id}-payer`}
          className="min-h-11"
          value={selectedPayer}
          disabled={busy}
          onChange={(event) => setPayer(event.target.value)}
        >
          <option value={me.id}>{me.name} · you</option>
          <option value={ally.id}>{ally.name} · your ally</option>
          {cost === 2 && <option value="both">Each ally pays 1 spice</option>}
        </select>
        <p className="fine">
          {cost === 2
            ? 'Either player can pay the full price, or each ally can pay 1 spice.'
            : 'One player pays the full price.'}{' '}
          Each payer’s funds are checked before acceptance and commitment; your
          ally’s private balance stays hidden.
        </p>
        {reasons.length > 0 && (
          <ul id={`${id}-reasons`} className="fine">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        )}
        <Button
          className="min-h-11 whitespace-normal"
          disabled={busy || reasons.length > 0}
          aria-describedby={reasons.length ? `${id}-reasons` : undefined}
          onClick={() => {
            if (!busy && !reasons.length && selected)
              act({
                type: 'offerRicheseNoField',
                token: selected.id,
                event: info.event,
                territory: destination,
                sector,
                payer: selectedPayer,
              });
          }}
        >
          Offer No-Field {selected?.value ?? ''} shipment
        </Button>
      </div>
    </details>
  );
}

export function RicheseAlliedNoFieldDecision({
  game,
  act,
  busy,
}: {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
}) {
  const id = useId();
  const [elite, setElite] = useState(0);
  const offer = game.richeseNoField?.allyOffer;
  if (
    !offer ||
    offer.recipient !== game.me ||
    game.decision?.kind !== 'richeseAllyShipment'
  )
    return null;
  const owner = game.players.find((player) => player.id === offer.owner)!;
  const payer = game.players.find((player) => player.id === offer.payer);
  const selectedElite = Math.max(
    offer.eliteMin,
    Math.min(
      offer.eliteMax,
      Number.isFinite(elite) ? Math.trunc(elite) : offer.eliteMin,
    ),
  );
  return (
    <div className="flex flex-col gap-3">
      {!offer.blocked && (
        <p>
          {owner.name} offers No-Field {offer.value} to ship {offer.amount} of
          your forces to {territory(offer.territory).name}, sector{' '}
          {offer.sector}.{' '}
          {offer.payer === 'both'
            ? `You and ${owner.name} each pay 1 spice`
            : `${payer?.id === game.me ? 'You pay' : `${payer?.name} pays`} ${offer.cost} spice`}{' '}
          if the shipment completes.
        </p>
      )}
      <p className="fine">
        The chosen token and force count are private to this alliance until the
        shipment reveals them. Accepting uses your normal shipment opportunity;
        declining costs nothing. Any earlier concealed No-Field reveals only if
        the accepted shipment proceeds.
      </p>
      {offer.blocked && (
        <p className="notice" id={`${id}-blocked`}>
          {offer.blocked} You can decline without cost.
        </p>
      )}
      {!offer.blocked && offer.eliteMax > 0 && (
        <label htmlFor={`${id}-elite`}>
          Elite forces included ({offer.eliteMin}–{offer.eliteMax})
          <Input
            id={`${id}-elite`}
            type="number"
            min={offer.eliteMin}
            max={offer.eliteMax}
            value={selectedElite}
            disabled={busy}
            onChange={(event) => setElite(Number(event.target.value))}
          />
        </label>
      )}
      <Button
        className="min-h-11 whitespace-normal"
        disabled={busy || !!offer.blocked}
        aria-describedby={offer.blocked ? `${id}-blocked` : undefined}
        onClick={() => {
          if (!busy && !offer.blocked)
            act({
              type: 'decision',
              event: offer.event,
              accept: true,
              elite: selectedElite,
            });
        }}
      >
        Accept allied No-Field shipment
      </Button>
      <Button
        className="min-h-11"
        disabled={busy}
        onClick={() => {
          if (!busy)
            act({ type: 'decision', event: offer.event, decline: true });
        }}
      >
        Decline offer · no cost
      </Button>
    </div>
  );
}
