import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { registerHooks } from 'node:module';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { createAmbassadors, validateAmbassadors } from '../game/ecaz-ambassadors';
import { homeworldRevivalFixture, revivalInventory, revivalPlayer } from './fixture-homeworld-revival';

/** Real Homeworld setup, with a controlled and conserved phase-5 position,
 * token placement, alliance, and Emperor casualties. The arrival and Ambassador
 * entry/acceptance themselves run through the normal engine actions. */
function source(stars: 1 | 2, ordinaryTanks: 0 | 2) {
  let g = homeworldRevivalFixture({ advanced: true, extraSeats: [
    { id: 'ec', faction: 'ecaz' }, { id: 'a', faction: 'atreides' },
  ] });
  g.expansions.push('ecaz');
  const emperor = revivalPlayer(g, 'e');
  const deadStars = 5 - stars;
  emperor.reserves -= deadStars + ordinaryTanks;
  emperor.tanks += deadStars + ordinaryTanks;
  emperor.elites!.reserves -= deadStars;
  emperor.elites!.tanks += deadStars;
  g.homeworlds!.custody!.salusa!.elite = stars;
  revivalPlayer(g, 'f').forces = { 'sietch_tabr:14': 12 };
  revivalPlayer(g, 'ec').ally = 'e';
  emperor.ally = 'ec';
  const ambassadors = createAmbassadors(() => 0);
  const token = ambassadors.tokens.find(candidate => candidate.effect === 'tleilaxu')!;
  const otherIds = ambassadors.tokens.filter(candidate => candidate.effect !== 'ecaz' && candidate.id !== token.id)
    .slice(0, 4).map(candidate => candidate.id);
  ambassadors.cohort = [token.id, ...otherIds];
  for (const candidate of ambassadors.tokens) {
    candidate.zone = candidate.effect === 'ecaz' || ambassadors.cohort.includes(candidate.id) ? 'supply' : 'pool';
    candidate.location = null;
  }
  token.zone = 'placed';
  token.location = 'arrakeen';
  validateAmbassadors(ambassadors);
  g.ecazAmbassadors = ambassadors;
  Object.assign(g, { phase: 5, active: 'a', ready: [], phaseOpening: null, response: null, decision: null });
  g.movementRemaining = [...g.order];
  revivalInventory(g);
  g = applyAction(g, 'a', { type: 'ship', amount: 1, territory: 'arrakeen', sector: 10 });
  assert.equal(g.pendingAmbassador?.stage, 'offer');
  g = applyAction(g, 'ec', { type: 'decision', event: g.pendingAmbassador!.event,
    trigger: true, beneficiary: 'e', choice: 'effect' });
  assert.equal(g.pendingAmbassador?.stage, 'revival');
  assert.equal(g.decision?.player, 'e');
  return g;
}

void test('Low Salusa blocks a free Ambassador star and returns normal forces to Kaitain', () => {
  const g = source(1, 2);
  const offer = viewGame(g, 'e').ambassadorEntry!.revival!;
  assert.equal(offer.maximum, 2);
  assert.equal(offer.eliteMaximum, 0);
  assert.match(offer.eliteBlock!, /Salusa/i);
  assert.equal(offer.blocked, null);
  const original = structuredClone(g);
  assert.throws(() => applyAction(g, 'e', { type: 'decision', event: g.pendingAmbassador!.event,
    forces: 1, elite: 1 }), /Salusa/i);
  assert.deepEqual(g, original);
  const next = applyAction(g, 'e', { type: 'decision', event: g.pendingAmbassador!.event,
    forces: 2, elite: 0 });
  const before = revivalPlayer(g, 'e'), after = revivalPlayer(next, 'e');
  assert.equal(after.reserves, before.reserves + 2);
  assert.equal(after.tanks, before.tanks - 2);
  assert.equal(after.elites!.tanks, before.elites!.tanks);
  assert.equal(next.homeworlds!.custody!.salusa!.elite, 1);
  assert.equal(after.spice, before.spice);
  revivalInventory(next);
});

void test('High Salusa permits one free Ambassador star and physically returns it to Salusa', () => {
  const g = source(2, 2);
  const offer = viewGame(g, 'e').ambassadorEntry!.revival!;
  assert.equal(offer.maximum, 3);
  assert.equal(offer.eliteMaximum, 1);
  assert.equal(offer.eliteBlock, null);
  const next = applyAction(g, 'e', { type: 'decision', event: g.pendingAmbassador!.event,
    forces: 2, elite: 1 });
  const before = revivalPlayer(g, 'e'), after = revivalPlayer(next, 'e');
  assert.equal(after.reserves, before.reserves + 2);
  assert.equal(after.tanks, before.tanks - 2);
  assert.equal(after.elites!.tanks, before.elites!.tanks - 1);
  assert.equal(after.elites!.revived, before.elites!.revived + 1);
  assert.equal(next.homeworlds!.custody!.salusa!.elite, 3);
  assert.equal(after.spice, before.spice);
  revivalInventory(next);
});

void test('Low with only stars shows no return button and all bot profiles choose a legal alternative', async () => {
  const g = source(1, 0);
  const view = viewGame(g, 'e');
  assert.equal(view.ambassadorEntry!.revival!.maximum, 0);
  assert.equal(view.ambassadorEntry!.revival!.eliteMaximum, 0);
  const hooks = registerHooks({ resolve(specifier, context, next) {
    return next(specifier === 'next/image' ? 'vinext/shims/image' : specifier, context);
  } });
  const { EcazEntry } = await import('../components/ecaz-entry');
  hooks.deregister();
  const markup = renderToStaticMarkup(createElement(EcazEntry, {
    game: view as unknown as Parameters<typeof EcazEntry>[0]['game'],
    act: () => {}, busy: false,
  }));
  assert.match(markup, /Salusa/);
  assert.doesNotMatch(markup, /Return 1 force/);
  assert.match(markup, /Return no forces/);
  for (const difficulty of DIFFICULTIES) {
    const choiceView = viewGame(g, 'e');
    choiceView.players.find(player => player.id === 'e')!.bot = difficulty;
    const actions = botActions(choiceView);
    assert.ok(actions.length, difficulty);
    for (const action of actions) {
      assert.notEqual(action.elite, 1, difficulty);
      assert.doesNotThrow(() => applyAction(g, 'e', action), `${difficulty}: ${JSON.stringify(action)}`);
    }
  }
});
