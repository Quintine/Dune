'use client';

import { useId, type ReactElement } from 'react';
import type { GameView } from '@/game/engine';
import type { MixedShipmentExpression } from '@/game/mixed-shipment-question';
import { TRUTH_CARD_NAMES, type TruthFact } from '@/game/truthtrance';
import { SHIPMENT_EXPRESSION_MAX_DEPTH, SHIPMENT_EXPRESSION_MAX_LEAVES } from '@/game/shipment-promises';
import { isKnowledgeFact, knowledgeFactInputError } from '@/game/truthtrance-knowledge';
import { CHEAP_HERO_TRAITOR } from '@/game/traitors';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { CardCountFields } from './truthtrance-card-count';
import { KnowledgeFactFields } from './truthtrance-knowledge';
import { ForceCountFields, forceCountInputError } from './truthtrance-force-count';
import { ShipmentClauseFields, invalidShipmentClause } from './shipment-claim-fields';

export function invalidTruthFact(fact: TruthFact, game: GameView, target: string): boolean {
  if (fact.kind === 'and' || fact.kind === 'or') {
    return fact.terms.some(term => invalidTruthFact(term, game, target));
  }
  if (fact.kind === 'spice' || fact.kind === 'handCount' || fact.kind === 'handInventory') {
    return !Number.isSafeInteger(fact.value) || fact.value < 0;
  }
  if (isKnowledgeFact(fact)) return !!knowledgeFactInputError(fact);
  if (fact.kind === 'forceCount') {
    return !!forceCountInputError(fact, game, game.players.find(player => player.id === target)!);
  }
  return false;
}

/** The same current-fact fields serve standalone and mixed questions. */
export function TruthFactFields({ value: fact, game, target, onChange }: {
  value: TruthFact;
  game: GameView;
  target: string;
  onChange: (fact: TruthFact) => void;
}) {
  const id = useId();
  const defaults: Record<string, TruthFact> = {
    hand: { kind: 'hand', name: 'Shield' },
    handCount: { kind: 'handCount', name: 'Shield', compare: 'gte', value: 2 },
    handInventory: { kind: 'handInventory', category: 'all', compare: 'gte', value: 2 },
    traitor: { kind: 'traitor', leader: game.allLeaders[0].id },
    predictionFaction: { kind: 'prediction', field: 'faction', faction: 'atreides' },
    predictionTurn: { kind: 'prediction', field: 'turn', compare: 'gte', value: 1 },
    stormDial: { kind: 'stormDial', compare: 'gte', value: 0 },
    stormForecast: { kind: 'stormForecast', compare: 'gte', value: 1 },
    spice: { kind: 'spice', compare: 'gte', value: 6 },
    forceCount: { kind: 'forceCount', zone: { kind: 'reserves' }, counter: 'total', compare: 'gte', value: 6 },
  };
  return <>
    <label>
      Current fact type
      <select value={fact.kind === 'prediction' ? fact.field === 'faction' ? 'predictionFaction' : 'predictionTurn' : fact.kind}
        onChange={event => onChange(defaults[event.target.value])}>
        <option value="hand">Holds a named card now</option>
        <option value="handCount">Current number of a named card</option>
        <option value="handInventory">Current hand size or primary card role</option>
        <option value="traitor">Selected a traitor</option>
        <option value="predictionFaction">Stored faction prediction</option>
        <option value="predictionTurn">Stored turn prediction</option>
        <option value="stormDial">Known storm dial</option>
        <option value="stormForecast">Known storm forecast</option>
        <option value="spice">Current personal spice</option>
        <option value="forceCount">Current physical forces</option>
      </select>
    </label>
    {fact.kind === 'hand' ? <label>
      Card name
      <select value={fact.name} onChange={event => onChange({ kind: 'hand', name: event.target.value })}>
        {TRUTH_CARD_NAMES.map(name => <option key={name}>{name}</option>)}
      </select>
    </label> : fact.kind === 'handCount' || fact.kind === 'handInventory' ?
      <CardCountFields value={fact} onChange={onChange} /> : fact.kind === 'forceCount' ?
        <ForceCountFields value={fact} game={game} player={game.players.find(player => player.id === target)!} onChange={onChange} /> :
        fact.kind === 'prediction' || fact.kind === 'stormDial' || fact.kind === 'stormForecast' ?
          <KnowledgeFactFields value={fact} onChange={onChange} /> : fact.kind === 'spice' ? <>
            <label>
              Compare current personal spice
              <select value={fact.compare} onChange={event => onChange({ ...fact, compare: event.target.value as typeof fact.compare })}>
                <option value="eq">Exactly</option>
                <option value="gte">At least</option>
                <option value="lte">At most</option>
              </select>
            </label>
            <label htmlFor={`${id}-spice-amount`}>Spice amount</label>
            <Input id={`${id}-spice-amount`} type="number" min={0} max={Number.MAX_SAFE_INTEGER} step={1} required
              value={Number.isNaN(fact.value) ? '' : fact.value}
              aria-invalid={invalidTruthFact(fact, game, target)}
              aria-describedby={`${id}-spice-help${invalidTruthFact(fact, game, target) ? ` ${id}-spice-error` : ''}`}
              onChange={event => onChange({ ...fact, value: event.currentTarget.valueAsNumber })} />
            <p className="fine" id={`${id}-spice-help`}>
              Counts spice the player personally holds now. Excludes pledged aid and incoming payments.
              This asks about the current balance; it does not promise future holdings or spending.
            </p>
            {invalidTruthFact(fact, game, target) && <p className="notice" role="alert" id={`${id}-spice-error`}>
              {Number.isInteger(fact.value) && fact.value > Number.MAX_SAFE_INTEGER
                ? 'That spice amount is too large.' : 'Enter a whole spice amount of zero or more.'}
            </p>}
          </> : fact.kind === 'traitor' ? <label>
            Leader
            <select value={fact.leader} onChange={event => onChange({ kind: 'traitor', leader: event.target.value })}>
              {game.allLeaders.map(leader => <option key={leader.id} value={leader.id}>{leader.name}</option>)}
              <option value={CHEAP_HERO_TRAITOR}>Cheap Hero / Heroine</option>
            </select>
          </label> : null}
  </>;
}

const newFact = (): MixedShipmentExpression => ({ kind: 'fact', fact: { kind: 'hand', name: 'Shield' } });
const newShipment = (): MixedShipmentExpression => ({ kind: 'shipment', territory: 'carthag', minimum: 6 });
function factSize(fact: TruthFact): { leaves: number; depth: number } {
  if (fact.kind !== 'and' && fact.kind !== 'or') return { leaves: 1, depth: 0 };
  const children = fact.terms.map(factSize);
  return { leaves: children.reduce((sum, child) => sum + child.leaves, 0), depth: 1 + Math.max(...children.map(child => child.depth)) };
}
function expressionSize(expression: MixedShipmentExpression): { leaves: number; depth: number } {
  if (expression.kind === 'fact') return factSize(expression.fact);
  if (expression.kind === 'shipment') return { leaves: 1, depth: 0 };
  const children = expression.terms.map(expressionSize);
  return { leaves: children.reduce((sum, child) => sum + child.leaves, 0), depth: 1 + Math.max(...children.map(child => child.depth)) };
}

export function mixedShipmentInputError(expression: MixedShipmentExpression, game: GameView, target: string): string | null {
  const size = expressionSize(expression);
  if (size.leaves > SHIPMENT_EXPRESSION_MAX_LEAVES || size.depth > SHIPMENT_EXPRESSION_MAX_DEPTH) {
    return 'Use at most sixteen conditions and four nested groups.';
  }
  let facts = 0;
  let shipments = 0;
  let invalid = false;
  const visit = (node: MixedShipmentExpression) => {
    if (node.kind === 'fact') {
      facts++;
      invalid ||= invalidTruthFact(node.fact, game, target);
    } else if (node.kind === 'shipment') {
      shipments++;
      invalid ||= invalidShipmentClause(node);
    } else {
      invalid ||= node.terms.length < 2;
      node.terms.forEach(visit);
    }
  };
  visit(expression);
  if (!facts || !shipments) return 'Include both a current fact and a shipment-from-reserves condition.';
  return invalid ? 'Resolve the marked fields; shipment minima must be whole numbers from one to twenty.' : null;
}

export function MixedShipmentFields({ id, value, game, target, disabled, onChange }: {
  id: string;
  value: MixedShipmentExpression;
  game: GameView;
  target: string;
  disabled: boolean;
  onChange: (expression: MixedShipmentExpression) => void;
}) {
  const size = expressionSize(value);
  const render = (node: MixedShipmentExpression, path: string, depth: number,
    update: (next: MixedShipmentExpression) => void, remove?: () => void): ReactElement => {
    const group = node.kind === 'and' || node.kind === 'or';
    const wrapAllowed = size.leaves < SHIPMENT_EXPRESSION_MAX_LEAVES &&
      depth + expressionSize(node).depth < SHIPMENT_EXPRESSION_MAX_DEPTH;
    return <fieldset key={path} className="grid min-w-0 gap-2" style={{ padding: depth ? 6 : 10 }}>
      <legend>{group ? `Group ${path} · ${node.kind.toUpperCase()}` : `Condition ${path}`}</legend>
      {group ? <>
        <label>
          Group meaning
          <select value={node.kind} onChange={event => update({ ...node, kind: event.target.value as 'and' | 'or' })}>
            <option value="and">All conditions · AND</option>
            <option value="or">At least one condition · OR</option>
          </select>
        </label>
        {node.terms.map((term, index) => render(term, `${path}.${index + 1}`, depth + 1,
          next => update({ ...node, terms: node.terms.map((old, i) => i === index ? next : old) }),
          () => {
            const terms = node.terms.filter((_, i) => i !== index);
            update(terms.length === 1 ? terms[0] : { ...node, terms });
          }))}
        <div className="flex flex-wrap gap-2">
          <Button disabled={disabled || size.leaves >= SHIPMENT_EXPRESSION_MAX_LEAVES}
            onClick={() => update({ ...node, terms: [...node.terms, newFact()] })}>Add current fact</Button>
          <Button disabled={disabled || size.leaves >= SHIPMENT_EXPRESSION_MAX_LEAVES}
            onClick={() => update({ ...node, terms: [...node.terms, newShipment()] })}>Add shipment condition</Button>
          <Button disabled={disabled || size.leaves + 2 > SHIPMENT_EXPRESSION_MAX_LEAVES || depth + 2 > SHIPMENT_EXPRESSION_MAX_DEPTH}
            onClick={() => update({ ...node, terms: [...node.terms, { kind: 'and', terms: [newFact(), newShipment()] }] })}>Add nested group</Button>
        </div>
      </> : <>
        <label>
          Condition timing
          <select value={node.kind} onChange={event => update(event.target.value === 'fact' ? newFact() : newShipment())}>
            <option value="fact">Current fact · at the answer</option>
            <option value="shipment">Shipment from reserves · this turn</option>
          </select>
        </label>
        {node.kind === 'fact' ? <TruthFactFields value={node.fact} game={game} target={target}
          onChange={fact => update({ kind: 'fact', fact })} /> : node.kind === 'shipment' ?
          <ShipmentClauseFields id={`${id}-${path}`} value={node}
            onChange={clause => update({ kind: 'shipment', ...clause })} /> : null}
      </>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled || !wrapAllowed} onClick={() => update({ kind: 'and', terms: [node, newShipment()] })}>Group with AND</Button>
        <Button disabled={disabled || !wrapAllowed} onClick={() => update({ kind: 'or', terms: [node, newShipment()] })}>Group with OR</Button>
        {remove && <Button disabled={disabled} onClick={remove}>Remove {group ? 'group' : 'condition'}</Button>}
      </div>
    </fieldset>;
  };
  return <fieldset disabled={disabled} className="grid min-w-0 gap-2 [&_select]:min-w-0 [&_select]:max-w-full [&_button]:max-w-full [&_button]:min-h-11 [&_button]:h-auto [&_button]:py-2 [&_button]:whitespace-normal">
    <legend>Mixed current-fact / this-turn shipment claim</legend>
    <p className="fine">
      Current facts are evaluated when the player answers, not after shipment. They do not require keeping
      a card, spice or forces later. Every shipment condition refers to the same shipment from reserves this turn.
      No makes the whole grouped claim false, not necessarily every condition.
    </p>
    <p className="fine">{size.leaves} / {SHIPMENT_EXPRESSION_MAX_LEAVES} conditions · {size.depth} / {SHIPMENT_EXPRESSION_MAX_DEPTH} nested groups</p>
    {render(value, '1', 0, onChange)}
  </fieldset>;
}
