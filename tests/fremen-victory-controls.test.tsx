import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VictoryProgress } from '../components/victory-progress';
import { viewGame } from '../game/engine';
import { fremenEcazFinalTurn } from './fixture-fremen-ecaz-victory';

void test('public final-turn guide explains shared Tabr and keeps the victory checkpoint explicit', () => {
  const g = fremenEcazFinalTurn();
  const views = g.players.map((p) => viewGame(g, p.id));
  const html = views.map((v) => renderToStaticMarkup(<VictoryProgress progress={v.victoryProgress} players={v.players} fremen={v.fremenVictory} />));
  assert.ok(html.every((page) => page === html[0]));
  assert.match(html[0], /permitted allied Ecaz and Fremen co-occupation/);
  assert.match(html[0], /only at the final-turn check/);
  assert.match(html[0], /A Bene Gesserit prediction cannot replace/);
  assert.doesNotMatch(html[0], /<button/);
});

void test('public guide identifies a blocking faction without presenting an ineligible board as a win', () => {
  const g = fremenEcazFinalTurn();
  g.players[2].forces = { 'habbanya_ridge_sietch:17': 1 }; g.players[2].reserves--;
  const v = viewGame(g, 'ec');
  const html = renderToStaticMarkup(<VictoryProgress progress={v.victoryProgress} players={v.players} fremen={v.fremenVictory} />);
  assert.match(html, /blocked by Spacing Guild/);
  assert.match(html, /special conditions are not met/);
});
