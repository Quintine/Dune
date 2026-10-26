'use client';

import type { GameView } from '@/game/engine';
import type { MixedActionExpression } from '@/game/mixed-action-question';
import {
  MIXED_BATTLE_MAX_DEPTH, MIXED_BATTLE_MAX_LEAVES, MIXED_BATTLE_MAX_NODES, MIXED_BATTLE_MAX_TERMS,
  parseBattleActionClaim, type MixedBattleActionClaim,
} from '@/game/mixed-battle-question';
import { TRUTH_CARD_NAMES } from '@/game/truthtrance-card-names';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { MixedActionFields, mixedActionInputError, type MixedActionConfig } from './mixed-action-fields';
import { Input } from './ui/input';

const dial = (): MixedBattleActionClaim => ({ kind: 'dial', compare: 'eq', value: 0 });

/** The original plan-element vocabulary is public. Authoring a question never
 * inspects either player's cards, available leaders, forces or ability to pay. */
const config: MixedActionConfig<MixedBattleActionClaim> = {
  prefix: 'mixed-battle',
  legend: 'Mixed current-fact / actual battle-plan claim',
  actionLabel: 'battle-plan condition',
  actionTiming: 'Actual battle plan · this battle',
  actionHelp: <>Battle conditions concern the respondent’s actual plan in this battle, including a plan already fixed, sealed or revealed.
    Current facts are snapshotted at the answer. An unknown current fact uses the conservative plan commitment that guarantees the whole answer;
    if no such answer is possible, the answer is I don’t know. No alternate route is forced.
    Native Voice, Prescience, card, leader, force and payment rules still apply.</>,
  fallbackError: 'Choose a current fact and an actual battle-plan condition.',
  maxLeaves: MIXED_BATTLE_MAX_LEAVES,
  maxDepth: MIXED_BATTLE_MAX_DEPTH,
  maxNodes: MIXED_BATTLE_MAX_NODES,
  maxTerms: MIXED_BATTLE_MAX_TERMS,
  newAction: dial,
  parseAction: (value, game) => parseBattleActionClaim(value, game.allLeaders.map(leader => leader.id)),
  renderAction: ({ value, id, game, disabled, onChange }) => <>
    <label htmlFor={`${id}-kind`}>Plan element</label>
    <select id={`${id}-kind`} value={value.kind} disabled={disabled} onChange={event => {
      const kind = event.currentTarget.value;
      if (kind === 'dial' || kind === 'support') onChange({ kind, compare: 'eq', value: 0 });
      else if (kind === 'weapon' || kind === 'defense') onChange({ kind, name: null });
      else if (kind === 'leader') onChange({ kind, leader: game.allLeaders[0]?.id ?? null });
      else if (kind === 'kwisatz') onChange({ kind, use: true });
    }}>
      <option value="dial">Dial</option>
      <option value="leader">Leader or hero</option>
      <option value="weapon">Weapon slot</option>
      <option value="defense">Defense slot</option>
      <option value="support">Spice support</option>
      <option value="kwisatz">Kwisatz Haderach</option>
    </select>
    {(value.kind === 'dial' || value.kind === 'support') && <>
      <label htmlFor={`${id}-compare`}>Comparison</label>
      <select id={`${id}-compare`} value={value.compare} disabled={disabled} onChange={event => {
        const compare = event.currentTarget.value;
        if (compare === 'eq' || compare === 'gte' || compare === 'lte') onChange({ ...value, compare });
      }}>
        <option value="eq">Exactly</option>
        <option value="gte">At least</option>
        <option value="lte">At most</option>
      </select>
      <label htmlFor={`${id}-amount`}>Amount</label>
      <Input id={`${id}-amount`} type="number" min={0} max={40} step={value.kind === 'dial' ? 0.5 : 1}
        required disabled={disabled} value={Number.isFinite(value.value) ? value.value : ''}
        aria-invalid={!Number.isFinite(value.value) || value.value < 0 || value.value > 40 ||
          !Number.isInteger(value.value * (value.kind === 'dial' ? 2 : 1))}
        onChange={event => onChange({ ...value, value: event.currentTarget.valueAsNumber })} />
    </>}
    {(value.kind === 'weapon' || value.kind === 'defense') && <>
      <label htmlFor={`${id}-card`}>Card name</label>
      <select id={`${id}-card`} value={value.name ?? ''} disabled={disabled}
        aria-invalid={value.name !== null && !TRUTH_CARD_NAMES.includes(value.name)}
        onChange={event => onChange({ ...value, name: event.currentTarget.value || null })}>
        <option value="">Empty slot</option>
        {TRUTH_CARD_NAMES.map(name => <option key={name}>{name}</option>)}
      </select>
    </>}
    {value.kind === 'leader' && <>
      <label htmlFor={`${id}-leader`}>Leader</label>
      <select id={`${id}-leader`} value={value.leader ?? ''} disabled={disabled}
        aria-invalid={value.leader !== null && value.leader !== CHEAP_HERO_TRAITOR && !game.allLeaders.some(leader => leader.id === value.leader)}
        onChange={event => onChange({ ...value, leader: event.currentTarget.value || null })}>
        <option value="">No leader or hero</option>
        {game.allLeaders.map(leader => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
        <option value={CHEAP_HERO_TRAITOR}>Cheap Hero / Heroine</option>
      </select>
    </>}
    {value.kind === 'kwisatz' && <>
      <label htmlFor={`${id}-kwisatz`}>Kwisatz use</label>
      <select id={`${id}-kwisatz`} value={value.use ? 'yes' : 'no'} disabled={disabled}
        onChange={event => onChange({ ...value, use: event.currentTarget.value === 'yes' })}>
        <option value="yes">Included</option>
        <option value="no">Not included</option>
      </select>
    </>}
  </>,
};

export function mixedBattleInputError(value: unknown, game: GameView, target: string): string | null {
  return mixedActionInputError(value, game, target, config);
}

export function MixedBattleFields(props: {
  value: MixedActionExpression<MixedBattleActionClaim>;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: MixedActionExpression<MixedBattleActionClaim>) => void;
}) {
  return MixedActionFields({ ...props, config });
}
