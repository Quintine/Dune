import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KnowledgeFactFields } from '../components/truthtrance-knowledge';
import { TruthFactFields } from '../components/mixed-shipment-fields';
import { TruthFactExpressionFields } from '../components/truth-fact-expression-fields';
import { knowledgeFactInputError } from '../game/truthtrance-knowledge';
import { createGame, joinGame, newPlayer, viewGame } from '../game/engine';
import type { TruthFact } from '../game/truthtrance';

function markup(value: Extract<TruthFact, { kind: 'prediction' | 'stormDial' | 'stormForecast' | 'spicePeek' | 'auctionPeek' }>) {
  return renderToStaticMarkup(createElement(KnowledgeFactFields, { value, onChange() {} }));
}

void test('knowledge controls expose full public faction registry and bounded stored predicates', () => {
  const faction = markup({ kind: 'prediction', field: 'faction', faction: 'atreides' });
  assert.match(faction, /value="atreides"/);
  assert.match(faction, /value="emperor"/);
  assert.match(faction, /already recorded faction choice/);
  const turn = markup({ kind: 'prediction', field: 'turn', compare: 'gte', value: 1 });
  assert.match(turn, /min="1"/);
  assert.match(turn, /max="10"/);
  const dial = markup({ kind: 'stormDial', compare: 'lte', value: 20 });
  assert.match(dial, /min="0"/);
  assert.match(dial, /max="20"/);
  assert.match(dial, /value="eq"/);
  assert.match(dial, /value="gte"/);
  assert.match(dial, /value="lte"/);
  const forecast = markup({ kind: 'stormForecast', compare: 'eq', value: 6 });
  assert.match(forecast, /min="1"/);
  assert.match(forecast, /max="6"/);
  assert.match(forecast, /value="eq"/);
  assert.match(forecast, /value="gte"/);
  assert.match(forecast, /value="lte"/);
  assert.match(forecast, /If no such value is available/);
});

void test('auction peek selector is available in single and compound current-fact questions', () => {
  const game = createGame('AUCTIONCONTROLS', newPlayer('a', 'Asker', 'emperor'));
  joinGame(game, newPlayer('b', 'Target', 'atreides'));
  const view = viewGame(game, 'a');
  const fact: TruthFact = { kind: 'auctionPeek', name: 'Shield' };
  const single = renderToStaticMarkup(createElement(TruthFactFields, { value: fact, game: view, target: 'b', onChange() {} }));
  assert.match(single, /value="auctionPeek" selected/);
  assert.match(single, /value="Shield" selected/);
  assert.match(single, /current ordinary auction card/);
  assert.match(single, /If no current card is known/);
  const compound: TruthFact = { kind: 'or', terms: [fact, { kind: 'spice', compare: 'gte', value: 3 }] };
  const grouped = renderToStaticMarkup(createElement(TruthFactExpressionFields, { value: compound, game: view, target: 'b', disabled: false, onChange() {} }));
  assert.match(grouped, /Inspected ordinary auction card/);
  assert.match(grouped, /value="Shield" selected/);
});

void test('spice peek controls offer public card identities with private-knowledge guidance', () => {
  const markupText = markup({ kind: 'spicePeek', value: 'worm' });
  assert.match(markupText, /value="worm"/);
  assert.match(markupText, /Sandworm/);
  assert.match(markupText, /value="sandtrout"/);
  assert.match(markupText, /value="the_great_flat"/);
  assert.match(markupText, /private Spice Blow peek/);
  assert.match(markupText, /Only the answer is published/);
});

void test('standalone and compound fact editors both expose the spice peek question', () => {
  const game = createGame('PEEKCONTROLS', newPlayer('a', 'Asker', 'emperor'));
  joinGame(game, newPlayer('b', 'Target', 'atreides'));
  const view = viewGame(game, 'a');
  const fact: TruthFact = { kind: 'spicePeek', value: 'broken_land' };
  const single = renderToStaticMarkup(createElement(TruthFactFields, { value: fact, game: view, target: 'b', onChange() {} }));
  assert.match(single, /value="spicePeek" selected/);
  assert.match(single, /value="broken_land" selected/);
  const compound: TruthFact = { kind: 'and', terms: [fact, { kind: 'spice', compare: 'gte', value: 3 }] };
  const grouped = renderToStaticMarkup(createElement(TruthFactExpressionFields, { value: compound, game: view, target: 'b', disabled: false, onChange() {} }));
  assert.match(grouped, /Known next Spice Blow card/);
  assert.match(grouped, /value="broken_land" selected/);
});

void test('knowledge helper rejects invalid stored bounds', () => {
  assert.ok(knowledgeFactInputError({ kind: 'prediction', field: 'turn', compare: 'eq', value: 0 }));
  assert.ok(knowledgeFactInputError({ kind: 'prediction', field: 'turn', compare: 'eq', value: 11 }));
  assert.ok(knowledgeFactInputError({ kind: 'stormDial', compare: 'gte', value: 21 }));
  assert.ok(knowledgeFactInputError({ kind: 'stormForecast', compare: 'lte', value: 0 }));
  assert.equal(knowledgeFactInputError({ kind: 'stormDial', compare: 'eq', value: 20 }), null);
});
