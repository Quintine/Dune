'use client';

import type { GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import { parseRevivalActionClaim, type RevivalActionClaim } from '@/game/mixed-revival-question';
import { REVIVAL_EXPRESSION_MAX_DEPTH, REVIVAL_EXPRESSION_MAX_LEAVES } from '@/game/revival-expression-promises';
import { MixedActionFields, mixedActionInputError, type MixedActionConfig } from './mixed-action-fields';
import { Input } from './ui/input';

/** Names depend only on the respondent's public faction. Current casualties,
 * custody and eligibility never determine which questions can be authored. */
const leaders = (game: GameView, target: string) => {
  const faction = game.players.find(player => player.id === target)?.faction;
  return [...game.allLeaders.filter(leader => !!faction && leader.faction === faction),
    ...(game.advanced && faction === 'atreides' ? [{ id: 'kwisatz', name: 'Kwisatz Haderach' }] : [])];
};
const newForces = (): RevivalActionClaim => ({ kind: 'forces', counter: 'total', minimum: 1 });
const config: MixedActionConfig<RevivalActionClaim> = {
  prefix: 'mixed-revival',
  legend: 'Mixed current-fact / future ordinary Revival claim',
  actionLabel: 'ordinary Revival condition',
  actionTiming: 'Future ordinary Revival · this turn',
  actionHelp: <>Count cumulative future ordinary native force and named-leader returns after the answer this turn.
    Smaller force returns add together; each normal or elite physical counter counts once.
    Prior returns, requests alone, Ghola, foreign leaders and special card returns do not count.
    Original costs, revival cycles, limits and turn order still apply. The claim grants no extra Revival opportunity.
    An unknown current fact uses the conservative future commitment that guarantees the whole answer.
    If no such value is available, the answer is I don’t know.</>,
  fallbackError: 'Choose a current fact and a future ordinary Revival condition.',
  maxLeaves: REVIVAL_EXPRESSION_MAX_LEAVES,
  maxDepth: REVIVAL_EXPRESSION_MAX_DEPTH,
  newAction: newForces,
  parseAction: (value, game, target) => {
    const action = parseRevivalActionClaim(value);
    if (action.kind === 'leader' && !leaders(game, target).some(leader => leader.id === action.leader))
      throw new Error('Choose a public native leader for the respondent’s faction.');
    return action;
  },
  renderAction: ({ value, id, game, target, disabled, onChange }) => {
    const choices = leaders(game, target);
    return <>
      <label htmlFor={`${id}-kind`}>Revival condition type</label>
      <select id={`${id}-kind`} value={value.kind} disabled={disabled} onChange={event => {
        if (event.currentTarget.value === 'forces') onChange(newForces());
        if (event.currentTarget.value === 'leader' && choices.length) onChange({ kind: 'leader', leader: choices[0].id });
      }}>
        <option value="forces">Cumulative physical forces</option>
        <option value="leader" disabled={!choices.length}>Named ordinary leader</option>
      </select>
      {value.kind === 'forces' ? <>
        <label htmlFor={`${id}-counter`}>Physical force counters</label>
        <select id={`${id}-counter`} value={value.counter} disabled={disabled} onChange={event => {
          const counter = event.currentTarget.value;
          if (counter === 'total' || counter === 'normal' || counter === 'elite') onChange({ ...value, counter });
        }}>
          <option value="total">All physical forces</option>
          <option value="normal">Normal forces</option>
          <option value="elite">Elite forces</option>
        </select>
        <label htmlFor={`${id}-minimum`}>Minimum future ordinary returns</label>
        <Input id={`${id}-minimum`} type="number" min={1} max={20} step={1} required disabled={disabled}
          value={Number.isFinite(value.minimum) ? value.minimum : ''}
          aria-invalid={!Number.isSafeInteger(value.minimum) || value.minimum < 1 || value.minimum > 20}
          onChange={event => onChange({ ...value, minimum: event.currentTarget.valueAsNumber })} />
      </> : <>
        <label htmlFor={`${id}-leader`}>Named leader</label>
        <select id={`${id}-leader`} value={choices.some(leader => leader.id === value.leader) ? value.leader : ''}
          disabled={disabled} aria-invalid={!choices.some(leader => leader.id === value.leader)} onChange={event => {
            const leader = event.currentTarget.value;
            if (leader === '' || choices.some(choice => choice.id === leader)) onChange({ ...value, leader });
          }}>
          <option value="">Choose a named leader</option>
          {choices.map(leader => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
        </select>
      </>}
    </>;
  },
};

export function mixedRevivalInputError(value: unknown, game: GameView, target: string): string | null {
  return mixedActionInputError(value, game, target, config);
}
export function MixedRevivalFields(props: {
  value: MixedActionExpression<RevivalActionClaim>;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: MixedActionExpression<RevivalActionClaim>) => void;
}) {
  return MixedActionFields({ ...props, config });
}
