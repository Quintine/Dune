'use client';

import { TERRITORIES } from '@/game/board';
import type { GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import { parseTurnActionLeaf, TURN_ACTION_MAX_DEPTH, TURN_ACTION_MAX_LEAVES, type TurnActionLeaf } from '@/game/turn-action-promises';
import { MixedActionFields, mixedActionInputError, type MixedActionConfig } from './mixed-action-fields';
import { Input } from './ui/input';

type TurnActionExpression = MixedActionExpression<TurnActionLeaf>;
const recipients = (game: GameView, target: string) => {
  const player = game.players.find(player => player.id === target);
  return player ? game.players.filter(recipient => recipient.id !== target && recipient.id !== player.ally) : [];
};
/** Public faction names only; casualties, custody and native eligibility stay
 * on the server. Advanced Atreides may name their Kwisatz Haderach. */
const leaders = (game: GameView, target: string) => {
  const faction = game.players.find(player => player.id === target)?.faction;
  return [...game.allLeaders.filter(leader => !!faction && leader.faction === faction),
    ...(game.advanced && faction === 'atreides' ? [{ id: 'kwisatz', name: 'Kwisatz Haderach' }] : [])];
};
const currentLot = (game: GameView) => game.bidPromiseLot?.turn === game.turn ? game.bidPromiseLot : null;
const partners = (game: GameView, target: string) => game.players.some(player => player.id === target)
  ? game.players.filter(player => player.id !== target) : [];
const currentNexus = (game: GameView, target: string) => game.status === 'playing' && game.phase === 1 && game.nexus && !game.spiceWindow &&
  game.alliancePromiseNexus?.turn === game.turn && game.truthMixedAllianceTargets.includes(target) &&
  !game.response && !game.decision && !game.phaseOpening && !game.automaticContinuationPending;
const config: MixedActionConfig<TurnActionLeaf> = {
  prefix: 'turn-action',
  legend: 'Future alliances, bids, Revival, payments, shipment and ground movements, with optional current facts',
  actionLabel: 'alliance, bid, Revival, payment, shipment or ground-movement condition',
  actionTiming: 'Future alliance, ordinary bid, Revival, payment, reserve shipment or ground move · this turn',
  actionHelp: <>Ordinary payment conditions sum future real bribes to the same recipient after the answer this turn.
    Earlier payments, gifts and ally aid do not count. The sender pays immediately; the recipient collects at the next Mentat opening.
    Payments made during Mentat Pause wait until next turn&apos;s Mentat opening; collection never counts twice.
    Ordinary bid conditions use the highest accepted future bid declaration in the named current lot, never the sum of smaller bids.
    A qualifying bid counts even if another player wins; it does not promise a purchase. Winning still requires the original payment.
    Ordinary Revival conditions count cumulative future normal and elite physical force returns, with each counter counted once,
    or an actual future return of a named native leader. Smaller ordinary force returns add together.
    Earlier returns, requests alone, Ghola, foreign leaders and special card returns do not count.
    Alliance conditions concern actual final membership when this current Nexus closes. Offers alone are not alliances.
    A remaining alliance condition settles at the actual close; forming an alliance does not fulfill it early.
    No can allow temporary membership followed by a break before the close. You cannot promise another player&apos;s consent.
    Shipment conditions concern the single future original reserve shipment after the answer.
    Ground-movement conditions use the maximum physical forces in one actual future move to that destination; smaller moves never add together.
    Bid conditions close with their named ordinary lot; Revival conditions close with your native Revival opportunity.
    Shipment and movement close at your own Movement turn end, while payment conditions last until the actual turn ends.
    AND requires every condition; OR keeps legal alternatives. No makes the whole expression false, not every condition separately.
    Original costs, timing, cards, preparation and action rights still apply; this claim grants no extra action.</>,
  fallbackError: 'Choose a future alliance, ordinary bid, Revival, payment, reserve shipment or ground-movement condition, with optional current facts.',
  maxLeaves: TURN_ACTION_MAX_LEAVES,
  maxDepth: TURN_ACTION_MAX_DEPTH,
  requireFact: false,
  newAction: () => ({ kind: 'ship', territory: 'carthag', minimum: 1 }),
  parseAction: (input, game, target) => {
    const action = parseTurnActionLeaf(input);
    if (action.kind === 'payment' && !recipients(game, target).some(recipient => recipient.id === action.recipient))
      throw new Error('Choose a public non-allied recipient for the future ordinary payment.');
    if (action.kind === 'bid' && currentLot(game)?.lot !== action.lot)
      throw new Error('Choose the current public ordinary lot for the future bid.');
    if (action.kind === 'leader' && !leaders(game, target).some(leader => leader.id === action.leader))
      throw new Error('Choose a public native leader for the respondent’s faction.');
    if (action.kind === 'alliance' && (!currentNexus(game, target) || !partners(game, target).some(partner => partner.id === action.partner)))
      throw new Error('Choose a public other partner during the current open Nexus.');
    return action;
  },
  renderAction: ({ value, id, game, target, disabled, onChange }) => {
    const choices = recipients(game, target), leaderChoices = leaders(game, target), lot = currentLot(game), partnerChoices = partners(game, target);
    return <>
      <label htmlFor={`${id}-action`}>Future action</label>
      <select id={`${id}-action`} value={value.kind} disabled={disabled} onChange={event => {
        const kind = event.currentTarget.value;
        if (kind === value.kind) return;
        const minimum = value.kind === 'leader' || value.kind === 'alliance' ? 1 : value.minimum;
        if (kind === 'alliance') onChange({ kind, partner: '' });
        if (kind === 'payment') onChange({ kind, recipient: '', minimum });
        if (kind === 'bid') onChange({ kind, lot: lot?.lot ?? NaN, minimum });
        if (kind === 'forces') onChange({ kind, counter: 'total', minimum });
        if (kind === 'leader') onChange({ kind, leader: leaderChoices[0]?.id ?? '' });
        if (kind === 'ship' || kind === 'move') onChange({ kind,
          territory: value.kind === 'ship' || value.kind === 'move' ? value.territory : 'carthag', minimum });
      }}>
        <option value="alliance">End this Nexus allied with a named partner</option>
        <option value="bid">Place an ordinary-lot bid</option>
        <option value="forces">Revive ordinary physical forces</option>
        <option value="leader">Revive a named ordinary leader</option>
        <option value="payment">Make an ordinary payment</option>
        <option value="ship">Ship from reserves</option>
        <option value="move">Make ground movement</option>
      </select>
      {value.kind === 'alliance' ? <>
        <label htmlFor={`${id}-partner`}>Final Nexus alliance partner</label>
        <select id={`${id}-partner`} value={partnerChoices.some(partner => partner.id === value.partner) ? value.partner : ''}
          disabled={disabled} aria-invalid={!partnerChoices.some(partner => partner.id === value.partner)} onChange={event => {
            const partner = event.currentTarget.value;
            if (partner === '' || partnerChoices.some(choice => choice.id === partner)) onChange({ ...value, partner });
          }}>
          <option value="">Choose a partner</option>
          {partnerChoices.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
        </select>
        {!currentNexus(game, target) && <p className="fine">Alliance conditions require the current open Nexus.</p>}
      </> : value.kind === 'bid' ? <>
        <label htmlFor={`${id}-lot`}>Current ordinary lot</label>
        <select id={`${id}-lot`} value={lot?.lot === value.lot ? String(value.lot) : ''} disabled={disabled}
          aria-invalid={lot?.lot !== value.lot} onChange={event => {
            const selected = event.currentTarget.value;
            if (selected === '' || lot && selected === String(lot.lot))
              onChange({ ...value, lot: selected === '' ? NaN : Number(selected) });
          }}>
          <option value="">Choose the current ordinary lot</option>
          {lot && <option value={lot.lot}>Turn {lot.turn} · Ordinary lot {lot.lot}</option>}
        </select>
        {!lot && <p className="fine">No public ordinary lot is currently available. Special auctions do not count.</p>}
      </> : value.kind === 'forces' ? <>
        <label htmlFor={`${id}-counter`}>Physical force counters</label>
        <select id={`${id}-counter`} value={value.counter} disabled={disabled} onChange={event => {
          const counter = event.currentTarget.value;
          if (counter === 'total' || counter === 'normal' || counter === 'elite') onChange({ ...value, counter });
        }}>
          <option value="total">All physical forces</option>
          <option value="normal">Normal forces</option>
          <option value="elite">Elite forces</option>
        </select>
      </> : value.kind === 'leader' ? <>
        <label htmlFor={`${id}-leader`}>Named ordinary leader</label>
        <select id={`${id}-leader`} value={leaderChoices.some(leader => leader.id === value.leader) ? value.leader : ''}
          disabled={disabled} aria-invalid={!leaderChoices.some(leader => leader.id === value.leader)} onChange={event => {
            const leader = event.currentTarget.value;
            if (leader === '' || leaderChoices.some(choice => choice.id === leader)) onChange({ ...value, leader });
          }}>
          <option value="">Choose a named leader</option>
          {leaderChoices.map(leader => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
        </select>
      </> : value.kind === 'payment' ? <>
        <label htmlFor={`${id}-recipient`}>Ordinary payment recipient</label>
        <select id={`${id}-recipient`} value={choices.some(recipient => recipient.id === value.recipient) ? value.recipient : ''}
          disabled={disabled} aria-invalid={!choices.some(recipient => recipient.id === value.recipient)}
          onChange={event => {
            const recipient = event.currentTarget.value;
            if (recipient === '' || choices.some(choice => choice.id === recipient)) onChange({ ...value, recipient });
          }}>
          <option value="">Choose a recipient</option>
          {choices.map(recipient => <option key={recipient.id} value={recipient.id}>{recipient.name}</option>)}
        </select>
      </> : <>
        <label htmlFor={`${id}-territory`}>{value.kind === 'ship' ? 'Reserve-shipment destination' : 'Ground-movement destination'}</label>
        <select id={`${id}-territory`} value={TERRITORIES.some(destination => destination.id === value.territory) ? value.territory : ''}
          disabled={disabled} aria-invalid={!TERRITORIES.some(destination => destination.id === value.territory)}
          onChange={event => onChange({ ...value, territory: event.currentTarget.value })}>
          <option value="">Choose a printed Arrakis territory</option>
          {TERRITORIES.map(destination => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
        </select>
      </>}
      {value.kind !== 'leader' && value.kind !== 'alliance' && <>
        <label htmlFor={`${id}-minimum`}>{value.kind === 'payment' ? 'Minimum future ordinary payments in spice'
          : value.kind === 'bid' ? 'Minimum future accepted bid in spice'
            : value.kind === 'forces' ? 'Minimum future ordinary force returns'
              : `Minimum physical forces in one ${value.kind === 'ship' ? 'reserve shipment' : 'ground move'}`}</label>
        <Input id={`${id}-minimum`} type="number" min={1} max={value.kind === 'payment' || value.kind === 'bid' ? Number.MAX_SAFE_INTEGER : 20}
          step={1} required disabled={disabled} value={Number.isFinite(value.minimum) ? value.minimum : ''}
          aria-invalid={!Number.isSafeInteger(value.minimum) || value.minimum < 1 ||
            value.kind !== 'payment' && value.kind !== 'bid' && value.minimum > 20}
          onChange={event => onChange({ ...value, minimum: event.currentTarget.valueAsNumber })} />
      </>}
    </>;
  },
};

/** Public schema choices only; the native engine owns eligibility and funding. */
export function turnActionInputError(value: unknown, game: GameView, target: string): string | null {
  return mixedActionInputError(value, game, target, config);
}

export function TurnActionFields(props: {
  value: TurnActionExpression;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: TurnActionExpression) => void;
}) {
  return MixedActionFields({ ...props, config });
}
