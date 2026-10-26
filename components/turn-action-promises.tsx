'use client';

import type { Action, GameView } from '@/game/engine';
import { bribeAction } from '@/game/bribe-options';
import { alliancePromiseModeSupported } from '@/game/alliance-promises';
import { nativePromiseScopeSupported } from '@/game/native-promise-scope';
import { quoteNexusAlliance } from '@/game/nexus-alliance';
import { truthQuestionText, type TruthAnswer } from '@/game/truthtrance';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { Button } from './ui/button';

type TurnActionProps = { game: GameView; busy: boolean; act: (action: Action) => void };
const publicAllianceContext = (game: GameView) => ({
  players: game.players.map(player => ({ id: player.id, ally: player.ally })), offers: game.allianceOffers,
});

/** One projected native packet; no client branch selection or completion solver. */
export function TurnActionGuideButton(props: TurnActionProps) {
  const game = props.game, guide = game.turnActionGuide;
  if (!guide) return null;
  const actor = game.me, turn = game.turn, phase = game.phase, event = guide.event, action = guide.action;
  const signature = JSON.stringify(action), auction = game.auction, decision = game.decision;
  const native = game.richeseAuction, order = game.revivalOrder, revival = game.revival;
  const auctionSource = (current: GameView) => current.auction && JSON.stringify({
    bid: current.auction.bid, bidder: current.auction.bidder, active: current.auction.active,
    remaining: current.auction.remaining, allyPayment: current.auction.allyPayment, lot: current.bidPromiseLot,
  });
  const nativeSource = (current: GameView) => current.richeseAuction && JSON.stringify({
    event: current.richeseAuction.event, method: current.richeseAuction.method,
    eligible: current.richeseAuction.eligible, submitted: current.richeseAuction.submitted,
    active: current.richeseAuction.active, outcome: current.richeseAuction.outcome,
    bid: current.richeseAuction.bid, bidder: current.richeseAuction.bidder,
    passed: current.richeseAuction.passed, acted: current.richeseAuction.acted,
  });
  const auctionSignature = auctionSource(game), nativeSignature = nativeSource(game), orderSignature = JSON.stringify(order);
  const nexus = game.alliancePromiseNexus, nexusOpen = game.nexus, nexusSpiceWindow = game.spiceWindow;
  const nexusSignature = JSON.stringify({ ...publicAllianceContext(game), ready: game.ready });
  const box = game.nullentropy, search = box?.search;
  const canAct = () => {
    const current = props.game, me = current.players.find(player => player.id === actor);
    const options = current.bribeOptions;
    const target = action.type === 'bribe' && typeof action.target === 'string'
      ? current.players.find(player => player.id === action.target) : undefined;
    const limit = options.targets.find(recipient => recipient.id === action.target);
    // Ordinary bribes can remain legal during another player's native turn or
    // after this payer has readied. The projected native timing stays decisive.
    const payment = action.type === 'bribe' && !!me && !!target && target.id !== actor && target.id !== me.ally &&
      options.blocked === null && Number.isSafeInteger(options.available) &&
      typeof action.amount === 'number' && action.amount <= options.available &&
      !!limit && Number.isSafeInteger(limit.maximum) && action.amount <= limit.maximum &&
      !!bribeAction(options, target.id, action.amount);
    const paidBox = action.type === 'decision' && current.decision === decision &&
      current.decision?.kind === 'nullentropy' && current.nullentropy === box && current.nullentropy?.search === search &&
      current.decision.player === actor && !!current.nullentropy?.search &&
      current.nullentropy.search.event === action.event && !current.nullentropy.blocked;
    const currentAuction = current.auction === auction && auctionSource(current) === auctionSignature && !!auction;
    const invoice = phase === 3 && action.type === 'decision' && typeof action.karama === 'boolean' &&
      (!action.karama || typeof action.card === 'string') &&
      current.decision === decision && current.decision?.kind === 'auctionPayment' && current.decision.player === actor &&
      !current.richeseAuction && currentAuction && current.auction?.bidder === actor;
    const nativePass = phase === 3 && action.type === 'richeseBid' && current.richeseAuction === native &&
      nativeSource(current) === nativeSignature && native && native.event === action.event && !native.outcome &&
      native.eligible.includes(actor) && (native.method === 'silent'
        ? !native.submitted.includes(actor) && action.amount === 0
        : native.active === actor && action.amount === null) && action.allyPayment === 0;
    const requiredBid = phase === 3 && action.type === 'bid' && !current.richeseAuction && currentAuction &&
      current.auction?.active === actor && typeof action.amount === 'number' && Number.isSafeInteger(action.amount) && action.amount > 0;
    const revivalTurn = current.revival === revival && !current.revival.pending && !current.revival.orderBlocked &&
      current.revivalOrder === order && JSON.stringify(current.revivalOrder) === orderSignature &&
      (!order || order.turn === turn && order.remaining[0] === actor && current.active === actor);
    const nexusWindow = phase === 1 && nexusOpen && current.nexus === nexusOpen && !nexusSpiceWindow &&
      current.spiceWindow === nexusSpiceWindow && !!nexus &&
      current.alliancePromiseNexus === nexus && nexus.turn === turn && !current.ready.includes(actor) &&
      alliancePromiseModeSupported(current) && JSON.stringify({ ...publicAllianceContext(current), ready: current.ready }) === nexusSignature;
    let ownedAlliance = action.type === 'alliance' && action.target === null;
    if (action.type === 'alliance' && typeof action.target === 'string') {
      try { ownedAlliance = !!quoteNexusAlliance({ ...publicAllianceContext(current), actor, target: action.target }).formed; }
      catch { ownedAlliance = false; }
    }
    const opportunity = payment || paidBox || nexusWindow && (ownedAlliance || action.type === 'ready') || (phase === 2
      ? !current.ready.includes(actor) && ['charity', 'ready', 'card'].includes(action.type)
      : phase === 3
        ? invoice || nativePass || requiredBid || action.type === 'passBid' && !current.richeseAuction && currentAuction && current.auction?.active === actor
        : phase === 4
          ? !current.ready.includes(actor) && revivalTurn && ['revive', 'reviveLeader', 'reviveKwisatz', 'acceptLeaderRevival', 'ready', 'card'].includes(action.type)
          : phase === 5
            ? current.active === actor && (action.type === 'guildShip' && action.from === 'reserves' ||
              ['ship', 'move', 'endMovement', 'card', 'prepareAdvisors', 'revealNoField'].includes(action.type))
            : (phase === 7 || phase === 8) &&
              action.type === 'ready' && !current.ready.includes(actor));
    return !props.busy && current === game && nativePromiseScopeSupported(current) && current.status === 'playing' &&
      Number.isSafeInteger(phase) && phase >= 0 && phase <= 8 && current.phase === phase && current.turn === turn && current.me === actor &&
      current.turnActionGuide === guide && guide.event === event && guide.action === action &&
      action.turnActionPromiseEvent === event && action.turnActionPromisePhase === phase && JSON.stringify(action) === signature && opportunity &&
      current.turnActionPromises.some(promise => promise.event === event && promise.player === actor && promise.turn === turn &&
        !promise.fulfilled && !promise.released) &&
      !!me && !me.autopilot && !current.truthtrance && !current.response && (!current.decision || paidBox || invoice) &&
      !current.phaseOpening && !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  const amount = action.forces && typeof action.forces === 'object'
    ? Object.values(action.forces as Record<string, number>).reduce((sum, count) => sum + count, 0)
    : typeof action.amount === 'number' ? action.amount : 0;
  const destination = game.combatLocations.find(location => location.id === action.territory)?.name ?? 'the quoted destination';
  const recipient = game.players.find(player => player.id === action.target)?.name ?? 'the quoted recipient';
  const sector = typeof action.sector === 'number' ? `, sector ${action.sector}` : '';
  const label = action.type === 'bribe' ? `Pay ${amount} spice to ${recipient} while honoring your whole answer`
    : action.type === 'alliance' ? action.target === null
      ? game.players.find(player => player.id === actor)?.ally ? 'Break your current alliance while preserving your whole answer'
        : 'Withdraw your alliance offer while preserving your whole answer'
      : `Accept ${recipient}’s alliance invitation while preserving your whole answer`
    : action.type === 'charity' ? 'Claim Charity while preserving your whole answer'
    : action.type === 'ready' ? phase === 8 ? 'Ready to end this turn while honoring your whole answer'
      : phase === 1 ? 'Confirm Ready for this Nexus while preserving your whole answer'
        : 'Finish this preparation phase while preserving your whole answer'
    : action.type === 'passBid' ? 'Pass this bid while preserving your whole answer'
    : action.type === 'bid' ? `Place the required bid of ${amount} while preserving your whole answer`
    : action.type === 'richeseBid' ? action.amount === 0 ? 'Submit zero in this Silent auction while preserving your whole answer'
      : 'Pass this Richese bid while preserving your whole answer'
    : action.type === 'revive' ? `Revive ${amount} forces while preserving your whole answer`
    : action.type === 'reviveLeader' ? 'Revive the quoted leader while preserving your whole answer'
    : action.type === 'acceptLeaderRevival' ? 'Accept the quoted leader revival while preserving your whole answer'
    : action.type === 'reviveKwisatz' ? 'Revive your Kwisatz Haderach while preserving your whole answer'
    : action.type === 'ship' || action.type === 'guildShip' ? `Ship ${amount} physical forces from reserves to ${destination}${sector}${action.type === 'guildShip' ? ' using Guild transport' : ''} while honoring your whole answer`
    : action.type === 'move' ? `Move ${amount} physical forces to ${destination}${sector} while honoring your whole answer`
    : action.type === 'endMovement' ? 'Finish movement while preserving any later payment conditions'
    : action.type === 'decision' ? game.decision?.kind === 'auctionPayment'
      ? action.karama === true ? 'Use the quoted Karama for the current auction payment while preserving your whole answer'
        : 'Pay the current auction price while preserving your whole answer'
      : 'Complete your paid Box search while preserving your whole answer'
    : action.type === 'prepareAdvisors' ? `Prepare advisors in ${destination} while preserving your whole answer`
    : action.type === 'revealNoField' ? 'Reveal your No-Field while preserving your whole answer'
    : 'Use the offered native card preparation while preserving your whole answer';
  return <Button className="game-action min-h-11 whitespace-normal" data-testid="turn-action-promise-guide"
    disabled={!canAct()} onClick={() => { if (canAct()) props.act(action); }}>{label}</Button>;
}

/** Own original whole questions and aggregate status only. */
export function TurnActionPromises(props: TurnActionProps) {
  const game = props.game, own = game.turnActionPromises.filter(promise => promise.player === game.me);
  if (!own.length) return null;
  const live = own.some(promise => promise.turn === game.turn && !promise.fulfilled && !promise.released);
  return <section className="notice space-y-3" aria-label="Your Truthtrance turn-action promises" id="turn-action-promise-guidance">
    <h3>Your alliance, bid, Revival, payment, shipment and movement promises</h3>
    <ul>{own.map(promise => <li key={promise.event}>
      Turn {promise.turn}: You answered {promise.answer ? 'Yes' : 'No'} to {truthQuestionText({ kind: 'turnActions', target: promise.player,
        turn: promise.turn, mixed: promise.mixed }, id => id === 'kwisatz' ? 'Kwisatz Haderach' : id === CHEAP_HERO_TRAITOR ? 'Cheap Hero / Heroine'
        : game.allLeaders.find(leader => leader.id === id)?.name ?? id,
      id => game.combatLocations.find(location => location.id === id)?.name ?? id,
      id => game.players.find(player => player.id === id)?.name ?? id)}.
      {promise.released ? ' Released: this whole commitment is no longer possible.'
        : promise.fulfilled ? ' Fulfilled: this whole commitment is complete.' : ' This whole answer is binding until its remaining conditions close this turn.'}
    </li>)}</ul>
    <p>AND requires every condition; OR requires at least one. No negates the whole expression, not each condition separately.
      Separate No answers each create their own restriction. Legal alternatives remain available; no fixed branch is selected for you.
      Current facts freeze at the answer and create no promise to keep cards, spice or forces afterward.
      Only the aggregate answer is shared. Individual fact answers and any reduced future branch remain private.</p>
    <p className="fine">Count the sum of future real ordinary payments to each named recipient after the answer.
      Earlier payments, gifts and ally aid do not count. The sender pays immediately; the recipient collects at the next Mentat opening.
      Payments made during Mentat Pause wait until next turn&apos;s Mentat opening; collection never counts twice.
      Bid conditions count the highest accepted future declaration in the named current ordinary lot, never the sum of smaller bids.
      A qualifying bid counts even when another player wins; winning still requires the original payment.
      Force Revival conditions count cumulative future ordinary returns; normal and elite physical counters each count once.
      Named leader conditions require an actual future ordinary native return. Earlier returns, requests alone, Ghola,
      foreign leaders and special card returns do not count.
      Alliance conditions concern final actual membership at this Nexus close. Offers alone are not alliances.
      A remaining alliance condition settles only at the actual close; forming an alliance does not fulfill it early.
      No can allow temporary membership followed by a break before the close. Neither answer promises another player’s consent.
      Shipment conditions concern one future original reserve shipment. Ground-movement conditions count the maximum physical forces in one actual future move,
      never the sum of smaller moves. Earlier shipment and movement do not count.
      Bid conditions close with their named ordinary lot; Revival conditions close with your native Revival opportunity.
      Shipment and movement close at your own Movement turn end; ordinary payments remain possible until the actual turn ends.
      Original costs, timing, cards, preparation and action rights still apply. This claim grants no extra action.</p>
    {live && <p>{game.phase === 8 ? 'Complete any remaining ordinary payment before the actual turn ends. Late recipients collect next turn.'
      : game.phase < 5 ? 'Your Movement turn is still ahead. Preserve the needed forces, spice and cards and complete any offered native preparation.'
        : 'Use the current native controls to honor your whole answer. Payment conditions can remain after your Movement turn ends.'}</p>}
    {live && <TurnActionGuideButton {...props} />}
  </section>;
}

/** Render only the current respondent's private native whole-answer choices. */
export function TurnActionAnswers(props: TurnActionProps) {
  const game = props.game, window = game.truthtrance, question = window?.question;
  if (window?.stage !== 'answer' || question?.kind !== 'turnActions' || question.target !== game.me || !game.truthTurnActionAnswers) return null;
  const actor = game.me, turn = game.turn, phase = game.phase, source = window.queue[0], answers = game.truthTurnActionAnswers;
  const signature = JSON.stringify(question), sourceSignature = JSON.stringify(source);
  const canAnswer = (answer: TruthAnswer) => {
    const current = props.game, me = current.players.find(player => player.id === actor);
    return !props.busy && current === game && current.status === 'playing' &&
      Number.isSafeInteger(phase) && phase >= 0 && phase <= 8 && current.phase === phase && current.turn === turn &&
      current.me === actor && question.turn === turn && current.truthtrance === window && window.stage === 'answer' &&
      window.question === question && question.target === actor && JSON.stringify(question) === signature &&
      !!source && window.queue[0] === source && JSON.stringify(source) === sourceSignature &&
      current.truthTurnActionAnswers === answers && answers.includes(answer) &&
      !!me && !me.autopilot && !current.response && !current.decision && !current.phaseOpening &&
      !current.automaticContinuationPending && !current.roomControl?.paused && !current.roomControl?.closed;
  };
  return <section aria-label="Answer the whole alliance, bid, Revival, payment, shipment and movement question" className="space-y-3">
    <p className="notice">Answer the whole expression. Current facts freeze now; OR keeps legal alternatives and No keeps the whole expression false.
      Future real ordinary payments add together per recipient. Only one future original reserve shipment and actual future ground-movement groups count.
      Ordinary bids use the maximum future accepted declaration in the named current lot; ordinary force returns add together,
      while named leaders must actually return through ordinary native Revival.
      Alliance conditions use actual final membership when the current Nexus closes; offers alone do not count.
      A remaining alliance condition stays open through temporary membership until that close. Neither answer promises another player’s consent.
      Bids close with their lot; Revival closes with your native Revival opportunity.
      Shipment and movement close at your own Movement turn end; payment conditions last until the actual turn ends.
      Original rights, preparation, timing and costs still apply. Only your whole answer is shared.</p>
    {answers.map(answer => {
      const action: Action = { type: 'truthAnswer', answer };
      return <Button key={answer} className="game-action min-h-11 whitespace-normal" data-turn-action-answer={answer}
        disabled={!canAnswer(answer)} onClick={() => { if (canAnswer(answer)) props.act(action); }}>
        {answer === 'unknown' ? 'I don’t know yet' : `Answer ${answer === 'yes' ? 'Yes' : 'No'}`}
      </Button>;
    })}
  </section>;
}
