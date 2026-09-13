import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KnowledgeFactFields } from '../components/truthtrance-knowledge';
import { knowledgeFactInputError } from '../game/truthtrance-knowledge';
import type { TruthFact } from '../game/truthtrance';

function markup(value: Extract<TruthFact, { kind: 'prediction' | 'stormDial' | 'stormForecast' }>) {
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

void test('knowledge helper rejects invalid stored bounds', () => {
  assert.ok(knowledgeFactInputError({ kind: 'prediction', field: 'turn', compare: 'eq', value: 0 }));
  assert.ok(knowledgeFactInputError({ kind: 'prediction', field: 'turn', compare: 'eq', value: 11 }));
  assert.ok(knowledgeFactInputError({ kind: 'stormDial', compare: 'gte', value: 21 }));
  assert.ok(knowledgeFactInputError({ kind: 'stormForecast', compare: 'lte', value: 0 }));
  assert.equal(knowledgeFactInputError({ kind: 'stormDial', compare: 'eq', value: 20 }), null);
});
