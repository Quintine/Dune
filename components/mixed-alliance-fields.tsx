'use client';

import type { GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import { ALLIANCE_EXPRESSION_MAX_DEPTH, ALLIANCE_EXPRESSION_MAX_LEAVES } from '@/game/alliance-expression-promises';
import { parseAllianceActionClaim, type AllianceActionClaim } from '@/game/mixed-alliance-question';
import { MixedActionFields, mixedActionInputError, type MixedActionConfig } from './mixed-action-fields';

const partners = (game: GameView, target: string) => game.players.some(player => player.id === target)
  ? game.players.filter(player => player.id !== target) : [];
const config: MixedActionConfig<AllianceActionClaim> = {
  prefix: 'mixed-alliance',
  legend: 'Mixed current-fact / final alliance claim · Current Nexus',
  actionLabel: 'final alliance condition',
  actionTiming: 'Final alliance · this Nexus close',
  actionHelp: <>The future condition concerns actual membership when this Nexus closes. Offers alone are not alliances.
    Any remaining alliance obligation settles at the actual Nexus close; forming an alliance does not fulfill it early.
    A constant whole answer can already be complete without an alliance obligation.
    You cannot promise the other player’s consent. If no owned route exists, unknown may apply; ask again or save the card.
    Legal alternatives remain available; the question does not pin a fixed branch. Original alliance and payment rules still apply.</>,
  fallbackError: 'Choose a current fact and a final alliance condition.',
  maxLeaves: ALLIANCE_EXPRESSION_MAX_LEAVES,
  maxDepth: ALLIANCE_EXPRESSION_MAX_DEPTH,
  newAction: () => ({ partner: '' }),
  parseAction: (value, game, target) => {
    const action = parseAllianceActionClaim(value);
    if (!partners(game, target).some(partner => partner.id === action.partner))
      throw new Error('Choose a current named other alliance partner.');
    return action;
  },
  renderAction: ({ value, id, game, target, disabled, onChange }) => {
    const choices = partners(game, target), valid = choices.some(partner => partner.id === value.partner);
    return <>
      <label htmlFor={`${id}-partner`}>Named alliance partner</label>
      <select id={`${id}-partner`} value={valid ? value.partner : ''} disabled={disabled} aria-invalid={!valid}
        onChange={event => {
          const partner = event.currentTarget.value;
          if (partner === '' || choices.some(choice => choice.id === partner)) onChange({ ...value, partner });
        }}>
        <option value="">Choose a partner</option>
        {choices.map(partner => <option key={partner.id} value={partner.id}>{partner.name}</option>)}
      </select>
    </>;
  },
};

export function mixedAllianceInputError(value: unknown, game: GameView, target: string): string | null {
  return mixedActionInputError(value, game, target, config);
}
export function MixedAllianceFields(props: {
  value: MixedActionExpression<AllianceActionClaim>;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: MixedActionExpression<AllianceActionClaim>) => void;
}) {
  return MixedActionFields({ ...props, config });
}
