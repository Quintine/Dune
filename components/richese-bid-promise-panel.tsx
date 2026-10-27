'use client';

import type { Action } from '@/game/engine';
import { Button } from './ui/button';

export type RicheseBidPromiseReceipt = {
  id: string;
  turn: number;
  event: string;
  minimum: number;
  answer: boolean;
  fulfilled?: boolean;
  released?: boolean;
};
export type RicheseBidPromisePanelProps = {
  promises: RicheseBidPromiseReceipt[];
  guide: { action: Action } | null;
  game: { turn: number; richeseAuction: { event: string } | null };
  act: (action: Action) => void;
  busy: boolean;
};

/** The auction owns the physical card, actor, funding and final legality. */
export function RicheseBidPromiseGuide(props: RicheseBidPromisePanelProps) {
  const { game, guide } = props;
  if (!guide) return null;
  const auction = game.richeseAuction, turn = game.turn, action = guide.action;
  const auctionEvent = action.event, id = action.richeseBidPromiseId;
  const signature = JSON.stringify(action);
  const isCurrent = () => props.game === game && props.guide === guide &&
    props.guide.action === action && JSON.stringify(action) === signature &&
    game.turn === turn && !!auction && game.richeseAuction === auction &&
    typeof auctionEvent === 'string' && auction.event === auctionEvent &&
    typeof id === 'string' && action.type === 'richeseBid' &&
    props.promises.some(promise => promise.id === id && promise.turn === turn &&
      promise.event === auctionEvent && !promise.fulfilled && !promise.released);
  const canAct = () => !props.busy && isCurrent();
  if (!isCurrent()) return null;
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="richese-bid-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.act(action); }}>
    {typeof action.amount === 'number' && action.amount > 0
      ? `Bid ${action.amount} spice while honoring your answer`
      : 'Pass this lot while honoring your answer'}
  </Button>;
}

/** The server supplies only this player's own receipts and a legal guide. */
export function RicheseBidPromisePanel(props: RicheseBidPromisePanelProps) {
  if (!props.promises.length) return null;
  const waiting = props.promises.some(promise => promise.turn === props.game.turn &&
    promise.event === props.game.richeseAuction?.event && !promise.fulfilled && !promise.released);
  return <section className="notice space-y-3" aria-label="Your Richese Once Around bid promises">
    <h3>Your Once Around bid promises</h3>
    <ul>{props.promises.map(promise => <li key={promise.id}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to bidding at least {promise.minimum} spice in this Once Around lot.
      {promise.released ? ' Released: this commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this commitment is complete.' : ' This answer is binding for your remaining opportunity.'}
    </li>)}</ul>
    <p>Yes requires a qualifying bid while possible. No forbids a qualifying bid.
      The original auction order and payment rules still apply.</p>
    {waiting && <RicheseBidPromiseGuide {...props} />}
  </section>;
}
