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
const config: MixedActionConfig<TurnActionLeaf> = {
  prefix: 'turn-action',
  legend: 'Future payments, shipment and ground movements, with optional current facts',
  actionLabel: 'payment, shipment or ground-movement condition',
  actionTiming: 'Future ordinary payment, reserve shipment or ground move · this turn',
  actionHelp: <>Ordinary payment conditions sum future real bribes to the same recipient after the answer this turn.
    Earlier payments, gifts and ally aid do not count. The sender pays immediately; the recipient collects at the next Mentat opening.
    Payments made during Mentat Pause wait until next turn&apos;s Mentat opening; collection never counts twice.
    Shipment conditions concern the single future original reserve shipment after the answer.
    Ground-movement conditions use the maximum physical forces in one actual future move to that destination; smaller moves never add together.
    Shipment and movement close at your own Movement turn end, while payment conditions last until the actual turn ends.
    AND requires every condition; OR keeps legal alternatives. No makes the whole expression false, not every condition separately.
    Original costs, timing, cards, preparation and action rights still apply; this claim grants no extra action.</>,
  fallbackError: 'Choose a future ordinary payment, reserve shipment or ground-movement condition, with optional current facts.',
  maxLeaves: TURN_ACTION_MAX_LEAVES,
  maxDepth: TURN_ACTION_MAX_DEPTH,
  requireFact: false,
  newAction: () => ({ kind: 'ship', territory: 'carthag', minimum: 1 }),
  parseAction: (input, game, target) => {
    const action = parseTurnActionLeaf(input);
    if (action.kind === 'payment' && !recipients(game, target).some(recipient => recipient.id === action.recipient))
      throw new Error('Choose a public non-allied recipient for the future ordinary payment.');
    return action;
  },
  renderAction: ({ value, id, game, target, disabled, onChange }) => {
    const choices = recipients(game, target);
    return <>
      <label htmlFor={`${id}-action`}>Future action</label>
      <select id={`${id}-action`} value={value.kind} disabled={disabled} onChange={event => {
        const kind = event.currentTarget.value;
        if (kind === value.kind) return;
        if (kind === 'payment') onChange({ kind, recipient: '', minimum: value.minimum });
        if (kind === 'ship' || kind === 'move') onChange({ kind,
          territory: value.kind === 'payment' ? 'carthag' : value.territory, minimum: value.minimum });
      }}>
        <option value="payment">Make an ordinary payment</option>
        <option value="ship">Ship from reserves</option>
        <option value="move">Make ground movement</option>
      </select>
      {value.kind === 'payment' ? <>
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
      <label htmlFor={`${id}-minimum`}>{value.kind === 'payment' ? 'Minimum future ordinary payments in spice'
        : `Minimum physical forces in one ${value.kind === 'ship' ? 'reserve shipment' : 'ground move'}`}</label>
      <Input id={`${id}-minimum`} type="number" min={1} max={value.kind === 'payment' ? Number.MAX_SAFE_INTEGER : 20}
        step={1} required disabled={disabled} value={Number.isFinite(value.minimum) ? value.minimum : ''}
        aria-invalid={!Number.isSafeInteger(value.minimum) || value.minimum < 1 || value.kind !== 'payment' && value.minimum > 20}
        onChange={event => onChange({ ...value, minimum: event.currentTarget.valueAsNumber })} />
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
