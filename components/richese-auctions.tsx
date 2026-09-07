'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import type { RicheseAuctionMethod } from '@/game/richese-auction';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { CardInspector, CardRules } from './card-inspector';

type Props = { game: GameView; act: (action: Action) => void; busy: boolean };
const buttonClass = 'min-h-11 whitespace-normal motion-reduce:transition-none';
const methodName = {
  normal: 'Normal auction',
  onceAround: 'Once Around',
  silent: 'Silent auction',
};

/** Only supplied owner-projected hand/cache identities are selectable. */
export function RicheseAuctionDecision({ game, act, busy }: Props) {
  const id = useId();
  const [cardId, setCardId] = useState('');
  const [method, setMethod] = useState<RicheseAuctionMethod>('onceAround');
  const [direction, setDirection] = useState<'clockwise' | 'counterclockwise'>(
    'clockwise',
  );
  const [claim, setClaim] = useState('');
  const bidding = game.richeseBidding;
  const decision = game.decision;
  const me = game.players.find((player) => player.id === game.me);
  if (
    !bidding ||
    !me ||
    decision?.player !== game.me ||
    bidding.owner !== game.me ||
    ![
      'richeseBlackMarket',
      'richeseDeclaration',
      'richeseCache',
      'richeseUnbid',
    ].includes(decision.kind)
  )
    return null;
  const send = (fields: Omit<Action, 'type'>) => {
    if (!busy) act({ type: 'decision', event: bidding.event, ...fields });
  };
  if (decision.kind === 'richeseDeclaration')
    return (
      <section
        className="flex flex-col gap-4"
        aria-label="Richese auction position"
      >
        <p>
          Choose whether your face-up cache card is auctioned before or after
          the ordinary cards. This declaration precedes Ixian auction
          inspection.
        </p>
        <Button
          className={buttonClass}
          disabled={busy}
          onClick={() => send({ position: 'first' })}
        >
          Auction cache card first
        </Button>
        <Button
          className={buttonClass}
          variant="outline"
          disabled={busy}
          onClick={() => send({ position: 'last' })}
        >
          Auction cache card last
        </Button>
      </section>
    );
  if (decision.kind === 'richeseUnbid') {
    const room = (me.hand?.length ?? 0) < me.handLimit;
    return (
      <section
        className="flex flex-col gap-4"
        aria-label="Unsold Richese cache card"
      >
        <p>
          No player offered spice. Keep the cache card for free if your hand has
          room, or remove it from this game.
        </p>
        {game.richeseAuction?.card && (
          <>
            <CardRules card={game.richeseAuction.card} />
            <CardInspector card={game.richeseAuction.card} />
          </>
        )}
        {!room && (
          <p className="fine">Your hand is full; the card cannot be added.</p>
        )}
        <Button
          className={buttonClass}
          disabled={busy || !room}
          onClick={() => send({ keep: true })}
        >
          Keep card for free
        </Button>
        <Button
          className={buttonClass}
          variant="outline"
          disabled={busy}
          onClick={() => send({ keep: false })}
        >
          Remove card from game
        </Button>
      </section>
    );
  }
  const blackMarket = decision.kind === 'richeseBlackMarket';
  const cards = blackMarket ? (me.hand ?? []) : (bidding.cache ?? []);
  const selected = cards.find((card) => card.id === cardId) ?? cards[0];
  const chosenMethod =
    !blackMarket && method === 'normal' ? 'onceAround' : method;
  return (
    <section
      className="flex min-w-0 flex-col gap-4"
      aria-label={blackMarket ? 'Black Market offer' : 'Richese cache offer'}
    >
      <p className="m-0 text-sm leading-6">
        {blackMarket
          ? 'Offer a card from your hand without showing its face. Atreides may inspect it. An optional public claim may be truthful or a bluff. If no one pays spice, you keep the card.'
          : 'Choose one card from your separate cache. Its face is revealed to everyone when offered. Cache cards do not count toward your hand limit.'}
      </p>
      {bidding.offerBlocked && (
        <p id={`${id}-offer-blocked`} className="notice">
          {bidding.offerBlocked}
        </p>
      )}
      {cards.length ? (
        <>
          <label htmlFor={`${id}-card`}>Card to auction</label>
          <select
            id={`${id}-card`}
            value={selected?.id ?? ''}
            disabled={busy}
            className="min-h-11 max-w-full"
            onChange={(event) => setCardId(event.target.value)}
          >
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
          {selected && (
            <>
              <CardRules card={selected} />
              <CardInspector card={selected} />
            </>
          )}
          <label htmlFor={`${id}-method`}>Auction method</label>
          <select
            id={`${id}-method`}
            value={chosenMethod}
            disabled={busy}
            className="min-h-11 max-w-full"
            onChange={(event) =>
              setMethod(event.target.value as RicheseAuctionMethod)
            }
          >
            {blackMarket && <option value="normal">Normal auction</option>}
            <option value="onceAround">Once Around</option>
            <option value="silent">Silent auction</option>
          </select>
          {chosenMethod === 'onceAround' && (
            <>
              <label htmlFor={`${id}-direction`}>Bidding direction</label>
              <select
                id={`${id}-direction`}
                value={direction}
                disabled={busy}
                className="min-h-11"
                onChange={(event) =>
                  setDirection(event.target.value as typeof direction)
                }
              >
                <option value="clockwise">Clockwise</option>
                <option value="counterclockwise">Counterclockwise</option>
              </select>
            </>
          )}
          {blackMarket && (
            <>
              <label htmlFor={`${id}-claim`}>Public claim (optional)</label>
              <Input
                id={`${id}-claim`}
                value={claim}
                maxLength={300}
                disabled={busy}
                onChange={(event) => setClaim(event.target.value)}
                placeholder="What you say you are selling"
              />
            </>
          )}
          <p className="fine">
            Karama cannot acquire this auction’s card.{' '}
            {chosenMethod === 'silent'
              ? 'Every eligible player submits once; zero is allowed. Equal positive bids use storm order.'
              : chosenMethod === 'onceAround'
                ? 'Each eligible player has one bidding opportunity, normally ending with Richese.'
                : 'Bidding continues in order until the other bidders pass.'}
          </p>
          <Button
            className={buttonClass}
            aria-describedby={
              bidding.offerBlocked ? `${id}-offer-blocked` : undefined
            }
            disabled={busy || !selected || !!bidding.offerBlocked}
            onClick={() =>
              send({
                card: selected!.id,
                method: chosenMethod,
                direction,
                ...(blackMarket && claim.trim() ? { claim } : {}),
              })
            }
          >
            Offer {blackMarket ? 'Black Market' : 'cache'} card
          </Button>
        </>
      ) : (
        <p>No card is available to offer.</p>
      )}
      {blackMarket && (
        <Button
          className={buttonClass}
          variant="outline"
          disabled={busy}
          onClick={() => send({ decline: true })}
        >
          Skip Black Market
        </Button>
      )}
    </section>
  );
}

/** Only projected public bids and this viewer's own sealed submission are rendered. */
export function RicheseAuctionLot({ game, act, busy }: Props) {
  const id = useId();
  const auction = game.richeseAuction;
  const [draft, setDraft] = useState({ event: '', amount: '', ally: '0' });
  if (!auction) return null;
  const me = game.me;
  const silent = auction.method === 'silent';
  const minimum = silent ? 0 : auction.bid + 1;
  const amount =
    draft.event === auction.event && draft.amount !== ''
      ? Number(draft.amount)
      : minimum;
  const allyPayment = draft.event === auction.event ? Number(draft.ally) : 0;
  const update = (part: Partial<typeof draft>) =>
    setDraft({
      event: auction.event,
      amount: String(amount),
      ally: String(allyPayment),
      ...part,
    });
  const ownPayment = amount - allyPayment;
  const sellerBlocked =
    auction.source === 'blackMarket' && auction.owner === me;
  const allowedTurn =
    !auction.outcome &&
    auction.eligible.includes(me) &&
    (silent ? !auction.submitted.includes(me) : auction.active === me);
  const canBid =
    allowedTurn &&
    Number.isSafeInteger(amount) &&
    amount >= minimum &&
    Number.isSafeInteger(allyPayment) &&
    allyPayment >= 0 &&
    allyPayment <= auction.allyAvailable &&
    ownPayment >= 0 &&
    ownPayment <= auction.ownAvailable &&
    (!sellerBlocked || amount === 0);
  const name = (player: string | null) =>
    game.players.find((p) => p.id === player)?.name ?? 'Player';
  const send = (bid: number | null, ally: number) => {
    if (!busy)
      act({
        type: 'richeseBid',
        event: auction.event,
        amount: bid,
        allyPayment: ally,
      });
  };
  return (
    <section
      className="flex min-w-0 flex-col gap-4"
      aria-label="Richese auction"
    >
      <h3 className="m-0 font-serif text-xl">
        {auction.source === 'cache' ? 'Richese cache' : 'Black Market'} ·{' '}
        {methodName[auction.method]}
      </h3>
      {auction.card ? (
        <>
          <p className="m-0 font-semibold">{auction.card.name}</p>
          {auction.source === 'blackMarket' && (
            <p className="fine">
              This face is private to you through ownership or authorized
              inspection.
            </p>
          )}
          <CardRules card={auction.card} />
          <CardInspector card={auction.card} />
        </>
      ) : (
        <p>The Black Market card remains face down.</p>
      )}
      <p className="fine">
        {name(auction.owner)} is selling. Karama cannot acquire this card.
      </p>
      {auction.claim && (
        <p className="notice">Seller’s public claim: {auction.claim}</p>
      )}
      {silent ? (
        <>
          <p className="m-0">
            {auction.submitted.length} of {auction.eligible.length} bids
            submitted.
          </p>
          {auction.ownBid !== null && (
            <p className="notice">
              Your sealed bid: {auction.ownBid} spice, including{' '}
              {auction.ownAllyPayment} pledged by your ally.
            </p>
          )}
          {auction.revealedBids && (
            <ul>
              {Object.entries(auction.revealedBids).map(([player, bid]) => (
                <li key={player}>
                  {name(player)}: {bid} spice
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="m-0">
          Highest bid: {auction.bid} spice
          {auction.bidder ? ` from ${name(auction.bidder)}` : ''}.
        </p>
      )}
      {allowedTurn ? (
        <>
          <p className="fine">
            Available funding: {auction.ownAvailable} own spice and{' '}
            {auction.allyAvailable} pledged spice.
          </p>
          {sellerBlocked && (
            <p className="notice">
              Positive Black Market bids by the seller are not supported.{' '}
              {silent ? 'Submit zero to continue.' : 'Pass to continue.'}
            </p>
          )}
          {!sellerBlocked && (
            <>
              <label htmlFor={`${id}-bid`}>
                {silent ? 'Sealed bid' : 'Your bid'} (minimum {minimum})
              </label>
              <Input
                id={`${id}-bid`}
                type="number"
                min={minimum}
                step={1}
                max={auction.ownAvailable + auction.allyAvailable}
                value={amount}
                disabled={busy}
                onChange={(event) => update({ amount: event.target.value })}
              />
              {auction.allyAvailable > 0 && (
                <>
                  <label htmlFor={`${id}-ally`}>Pay from ally’s pledge</label>
                  <Input
                    id={`${id}-ally`}
                    type="number"
                    min={0}
                    step={1}
                    max={Math.min(amount, auction.allyAvailable)}
                    value={allyPayment}
                    disabled={busy}
                    onChange={(event) => update({ ally: event.target.value })}
                  />
                </>
              )}
              <p className="fine">
                {canBid
                  ? `Payment if you win: ${ownPayment} own spice + ${allyPayment} ally spice.`
                  : 'Choose a valid bid and funding split within the available spice.'}{' '}
                {silent
                  ? 'Your submitted amount stays private until all bids are in and cannot be changed.'
                  : 'Raise the current bid or pass.'}
              </p>
              <Button
                className={buttonClass}
                disabled={busy || !canBid}
                onClick={() => send(amount, allyPayment)}
              >
                {silent ? 'Seal bid' : 'Raise bid'}
              </Button>
            </>
          )}
          <Button
            className={buttonClass}
            variant="outline"
            disabled={busy}
            onClick={() => send(silent ? 0 : null, 0)}
          >
            {silent ? 'Submit zero' : 'Pass this bid'}
          </Button>
        </>
      ) : (
        <p className="muted">
          {auction.outcome
            ? 'The auction result is being resolved.'
            : silent && auction.submitted.includes(me)
              ? 'Your bid is sealed. Waiting for the other bidders.'
              : !auction.eligible.includes(me)
                ? 'You are not eligible to bid on this card.'
                : `Waiting for ${name(auction.active)} to bid.`}
        </p>
      )}
    </section>
  );
}
