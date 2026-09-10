import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame } from '../game/engine';
import { BattlePromises } from '../components/battle-promises';
import { suboidFixture } from './fixture-nexus-cunning';
import { nexusAllow, nexusReload } from './fixture-nexus-cards';

void test('a real future-strength Prescience commitment names Ixian Cunning in its private reachable preparation', () => {
  let g = suboidFixture(true, true);
  g = applyAction(g, 'q', { type: 'prescience', field: 'dial' });
  g = nexusAllow(g);
  g = applyAction(g, 'p', { type: 'prescienceAnswer', value: 6 });
  while (g.battle!.preparation)
    g = applyAction(g, g.battle!.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  g = nexusReload(g);
  const before = JSON.stringify(g);
  const v = viewGame(g, 'p');
  const actions = v.battle!.compliantPreparation!.actions;
  assert.equal(actions[0].type, 'nexusSuboids');
  assert.equal(g.nexusSuboidHistory, undefined);
  assert.equal(g.nexusCards!.cards!.hands.p, 'ixians');
  const text = renderToStaticMarkup(
    createElement(BattlePromises, {
      game: v,
      fill() {},
      act() {},
      busy: false,
    }),
  );
  assert.match(
    text,
    /Use Ixian Cunning to give Suboids full strength without spice support/,
  );
  assert.match(text, /Complete next preparation/);
  assert.doesNotMatch(text, /Ghola|NaN/);
  assert.equal(JSON.stringify(g), before);
  for (const id of ['q', 'r'])
    assert.equal(viewGame(g, id).battle!.compliantPreparation, null);
  const boosted = applyAction(g, 'p', actions[0]);
  assert.equal(boosted.battle!.prescience!.value, 6);
  assert.equal(viewGame(boosted, 'p').nexusSuboids!.active, true);
  assert.equal(viewGame(boosted, 'p').battle!.compliantPreparation, null);
});
