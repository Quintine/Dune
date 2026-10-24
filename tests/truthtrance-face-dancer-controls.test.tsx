import assert from 'node:assert/strict';
import test from 'node:test';
import { Children, createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FaceDancerFactFields } from '../components/truthtrance-face-dancer';
import {
  invalidTruthFact,
  mixedShipmentInputError,
  MixedShipmentFields,
  TruthFactFields,
} from '../components/mixed-shipment-fields';
import { createDukeVidal, DUKE_VIDAL_ID } from '../game/duke-vidal';
import { createGame, newPlayer, viewGame, type GameView } from '../game/engine';
import type { MixedShipmentExpression } from '../game/mixed-shipment-question';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import type { FaceDancerFact } from '../game/truthtrance-face-dancer';
import type { TruthFact } from '../game/truthtrance';

function projected(): GameView {
  const game = createGame('TRUTHFACEDANCERCONTROLS', newPlayer('a', 'Asker', 'atreides'), false, ['ix']);
  game.players.push(newPlayer('t', 'Respondent', 'tleilaxu'));
  Object.assign(game, { status: 'playing', phase: 3, turn: 3, order: ['a', 't'] });
  const view = viewGame(game, 'a');
  // The public registry can contain Duke, who has no physical identity card.
  view.allLeaders = [createDukeVidal().leader, ...view.allLeaders];
  return view;
}

const fact = (leader = 'atreides-0'): FaceDancerFact => ({ kind: 'faceDancer', leader });

function markup(game = projected(), value = fact()) {
  return renderToStaticMarkup(createElement(FaceDancerFactFields, {
    value, leaders: game.allLeaders, onChange() {},
  }));
}

function select(node: ReactNode, identity: string): boolean {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{
      children?: ReactNode;
      onChange?: (event: { currentTarget: { value: string } }) => void;
      'aria-label'?: string;
    }>(child)) continue;
    if (child.props['aria-label'] === 'Face Dancer identity' && child.props.onChange) {
      child.props.onChange({ currentTarget: { value: identity } });
      return true;
    }
    if (select(child.props.children, identity)) return true;
  }
  return false;
}

function choose(game: GameView, identity: string): FaceDancerFact[] {
  const selected: FaceDancerFact[] = [];
  const tree = FaceDancerFactFields({
    value: fact(), leaders: game.allLeaders, onChange(value) { selected.push(value); },
  });
  select(tree, identity);
  return selected;
}

void test('the actual identity selector uses public printed names, excludes Duke and shares one Hero/Heroine option', () => {
  const game = projected();
  const html = markup(game);
  for (const leader of game.allLeaders.filter((leader) => leader.id !== DUKE_VIDAL_ID)) {
    assert.ok(html.includes(`value="${leader.id}"`));
    assert.ok(html.includes(leader.name));
  }
  assert.doesNotMatch(html, /value="duke-vidal"/);
  assert.equal((html.match(new RegExp(`value="${CHEAP_HERO_TRAITOR}"`, 'g')) ?? []).length, 1);
  assert.match(html, /Cheap Hero \/ Heroine/);
  assert.deepEqual(choose(game, 'atreides-0'), [fact('atreides-0')]);
  assert.deepEqual(choose(game, 'tleilaxu-0'), [fact('tleilaxu-0')]);
  assert.deepEqual(choose(game, CHEAP_HERO_TRAITOR), [fact(CHEAP_HERO_TRAITOR)]);
  assert.deepEqual(choose(game, DUKE_VIDAL_ID), []);
  assert.deepEqual(choose(game, 'not-a-printed-identity'), []);
});

void test('persistent guidance asks about current unrevealed custody and publishes only the aggregate answer', () => {
  const html = markup();
  assert.match(html, /respondent currently holds an unrevealed Face Dancer for this printed identity/);
  assert.match(html, /A revealed, absent or returned card means No/);
  assert.match(html, /current fact at the answer, not a promise to reveal a Face Dancer later/);
  assert.match(html, /Ordinary traitor questions still ask only about ordinary Traitor Cards/);
  assert.match(html, /Only the aggregate Truthtrance answer is published/);
  assert.match(html, /does not physically reveal a Face Dancer/);
  assert.match(html, /or identify which part of an AND\/OR claim is true/);
});

void test('TruthFactFields exposes the standalone Face Dancer option without changing ordinary traitor fields', () => {
  const game = projected();
  const html = renderToStaticMarkup(createElement(TruthFactFields, {
    value: fact(), game, target: 't', onChange() {},
  }));
  assert.match(html, /value="faceDancer" selected="">Currently unrevealed Face Dancer/);
  assert.match(html, /aria-label="Face Dancer identity"/);
  assert.doesNotMatch(html, /value="duke-vidal"/);
  const ordinary = renderToStaticMarkup(createElement(TruthFactFields, {
    value: { kind: 'traitor', leader: 'atreides-0' }, game, target: 't', onChange() {},
  }));
  assert.match(ordinary, /value="traitor" selected="">Selected a traitor/);
  assert.doesNotMatch(ordinary, /aria-label="Face Dancer identity"/);
});

void test('standalone AND/OR and mixed shipment validation accept the same current fact and reject unavailable identities', () => {
  const game = projected();
  const grouped: TruthFact = {
    kind: 'and', terms: [fact(), { kind: 'or', terms: [fact(CHEAP_HERO_TRAITOR), { kind: 'spice', compare: 'gte', value: 2 }] }],
  };
  assert.equal(invalidTruthFact(grouped, game, 't'), false);
  assert.equal(invalidTruthFact(fact(DUKE_VIDAL_ID), game, 't'), true);
  assert.equal(invalidTruthFact(fact('not-a-printed-identity'), game, 't'), true);
  const mixed: MixedShipmentExpression = {
    kind: 'and', terms: [
      { kind: 'fact', fact: fact() },
      { kind: 'or', terms: [
        { kind: 'fact', fact: fact(CHEAP_HERO_TRAITOR) },
        { kind: 'shipment', territory: 'carthag', minimum: 1 },
      ] },
    ],
  };
  assert.equal(mixedShipmentInputError(mixed, game, 't'), null);
  const html = renderToStaticMarkup(createElement(MixedShipmentFields, {
    id: 'face-dancer-mixed', value: mixed, game, target: 't', disabled: false, onChange() {},
  }));
  assert.equal((html.match(/aria-label="Face Dancer identity"/g) ?? []).length, 2);
  assert.match(html, /Shipment from reserves · this turn/);
  assert.match(html, /Current fact · at the answer/);
  const invalid: MixedShipmentExpression = {
    kind: 'and', terms: [{ kind: 'fact', fact: fact(DUKE_VIDAL_ID) }, { kind: 'shipment', territory: 'carthag', minimum: 1 }],
  };
  assert.match(mixedShipmentInputError(invalid, game, 't')!, /Resolve the marked fields/);
});

void test('invalid identity input stays visibly marked while the shared Hero/Heroine choice remains available', () => {
  const game = projected();
  const invalid = markup(game, fact(DUKE_VIDAL_ID));
  assert.match(invalid, /aria-invalid="true"/);
  assert.match(invalid, /role="alert"/);
  game.allLeaders = [createDukeVidal().leader];
  const heroOnly = markup(game, fact(CHEAP_HERO_TRAITOR));
  assert.match(heroOnly, /Cheap Hero \/ Heroine/);
  assert.match(heroOnly, /aria-invalid="false"/);
  assert.doesNotMatch(heroOnly, /value="duke-vidal"/);
  assert.deepEqual(choose(game, CHEAP_HERO_TRAITOR), [fact(CHEAP_HERO_TRAITOR)]);
});

void test('selector and mixed validation never inspect target Face Dancers, private hands or wallets', () => {
  const game = projected();
  for (const player of game.players) {
    for (const field of ['faceDancers', 'hand', 'traitors', 'spice']) {
      Object.defineProperty(player, field, {
        get() { throw new Error(`Current fact UI read ${player.id} private ${field}`); },
      });
    }
  }
  const html = renderToStaticMarkup(createElement(TruthFactFields, {
    value: fact(), game, target: 't', onChange() {},
  }));
  assert.match(html, /Currently unrevealed Face Dancer/);
  assert.match(html, /value="atreides-0"/);
  assert.equal(invalidTruthFact(fact(), game, 't'), false);
  assert.deepEqual(choose(game, CHEAP_HERO_TRAITOR), [fact(CHEAP_HERO_TRAITOR)]);
});
