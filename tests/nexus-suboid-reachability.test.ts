import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { boostSuboids, suboidFixture } from './fixture-nexus-cunning';
import { nexusAllow, nexusReload } from './fixture-nexus-cards';

function finishPreparation(state: Game): Game {
  let g = state;
  while (g.battle!.preparation)
    g = applyAction(g, g.battle!.preparation.owner, {
      type: 'declineBattlePower',
    });
  if (g.decision?.kind === 'fullPlanOffer')
    g = applyAction(g, g.decision.player, { type: 'decision', decline: true });
  return g;
}

function submitPromisedDial(state: Game): Game {
  let g = finishPreparation(boostSuboids(nexusReload(state)));
  g = applyAction(g, 'p', {
    type: 'battlePlan',
    dial: 6,
    support: 2,
    leader: g.players.find((p) => p.id === 'p')!.leaders[0].id,
  });
  assert.equal(g.battle!.plans.p.dial, 6);
  assert.equal(g.nexusSuboidHistory!.length, 1);
  return g;
}

void test('Truthtrance can promise a dial reachable through the held Ixian Cunning after the answer', () => {
  let g = suboidFixture();
  const index = g.deck.findIndex((card) => card.effect === 'truthtrance');
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === 'q')!.hand.push(card);
  g = applyAction(g, 'q', { type: 'card', card: card.id });
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = applyAction(g, 'q', {
    type: 'truthAsk',
    question: {
      kind: 'battlePlan',
      target: 'p',
      territory: 'pasty_mesa',
      claim: { kind: 'dial', compare: 'gte', value: 6 },
    },
  });
  assert.equal(g.nexusCards!.cards!.hands.p, 'ixians');
  assert.equal(g.nexusSuboidHistory, undefined);
  g = applyAction(g, 'p', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(
    g.nexusSuboidHistory,
    undefined,
    'Reachability must not spend the real card',
  );
  const done = submitPromisedDial(g);
  assert.equal(done.battle!.truthPromises![0].answer, true);
  assert.ok(!done.battle!.truthPromises![0].released);
});

void test('Prescience can bind a future full-strength Suboid dial without applying the grant during its search', () => {
  let g = suboidFixture(true, true);
  g = applyAction(g, 'q', { type: 'prescience', field: 'dial' });
  g = nexusAllow(g);
  g = applyAction(g, 'p', { type: 'prescienceAnswer', value: 6 });
  assert.equal(g.battle!.prescience!.value, 6);
  assert.equal(g.nexusSuboidHistory, undefined);
  assert.equal(viewGame(g, 'p').nexusSuboids!.active, false);
  const done = submitPromisedDial(g);
  assert.equal(done.battle!.prescience!.value, 6);
});
