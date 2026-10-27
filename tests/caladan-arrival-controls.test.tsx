import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type Game } from '../game/engine';
import { CaladanReinforcement } from '../components/caladan-reinforcement';
import { caladanReinforcementCanAct, caladanReinforcementChoice } from '../game/caladan-reinforcement-options';
import {
  caladanVictoryFixture, prepareVictoryBattle, commitVictoryPlans, finishVictoryCalls,
  victoryPlayer,
} from './fixture-caladan-victory';

// Existing controlled victory source: genuine Homeworld setup/deal, staged
// later phase/armies/wallets and storm position, then real battle packets yield
// the choice. This is not original-game progression or an HMS entry programme.
// SSR and shared-adapter checks do not operate the stateful React chooser.
const sources = new Map<boolean, Game>();
function choiceGame(advanced = true): Game {
  let source = sources.get(advanced);
  if (!source) {
    const initial = caladanVictoryFixture({ advanced });
    initial.storm = 13;
    source = finishVictoryCalls(commitVictoryPlans(prepareVictoryBattle(initial)));
    assert.equal(source.decision?.kind, 'caladanReinforcement');
    assert.equal(source.lastBattleContext?.winner, 'a');
    sources.set(advanced, source);
  }
  return structuredClone(source);
}
function html(game: Game, owner = 'a', busy = false) {
  return renderToStaticMarkup(createElement(CaladanReinforcement, { game: viewGame(game, owner), busy,
    act() { assert.fail('Rendering the chooser must not submit a decision.'); } }));
}

void test('the engine-owned Caladan choice keeps its default target and original exact one-force adapter packet', () => {
  const game = choiceGame(), view = viewGame(game, 'a'), offer = view.caladanReinforcement;
  assert.ok(offer);
  const target = offer.destinations.find(destination => !destination.blocked); assert.ok(target);
  assert.ok(target.id.startsWith('hagga_basin:'));
  const markup = html(game);
  assert.ok(markup.includes(`<option value="${target.id}" selected="">`));
  const choice = caladanReinforcementChoice(view, target.id);
  assert.deepEqual(choice, { blocked: null, action: { type: 'decision', event: offer.event,
    destination: target.id, amount: 1 } });
  assert.ok(choice.action);
  const before = victoryPlayer(game, 'a');
  const after = applyAction(game, 'a', choice.action), placed = victoryPlayer(after, 'a');
  assert.equal(placed.reserves, before.reserves - 1);
  assert.equal(placed.forces[target.id], (before.forces[target.id] ?? 0) + 1);
});

void test('arrival guidance distinguishes placement from shipment and preserves the original Face Dance explanation', () => {
  const game = choiceGame(), before = structuredClone(game);
  for (let render = 0; render < 2; render++) {
    const markup = html(game);
    assert.match(markup, /original surviving winner at the original battle location/);
    assert.match(markup, /including inside the Hidden Mobile Stronghold/);
    assert.match(markup, /direct-shipment ban does not block this placement/);
    assert.match(markup, /No spice, shipment, movement or revival allowance is spent/);
    assert.match(markup, /no Spiritual Advisor opportunity is created/);
    assert.match(markup, /Storm-sector entry remains unavailable/);
    assert.match(markup, /Advanced Bene Gesserit Intrusion resolves first/);
    assert.match(markup, /Provisional arrival classification: eligible Ambassador and Terror reactions then follow their original arrival order/);
    assert.match(markup, /aria-label="Provisional Face Dance order"/);
    assert.match(markup, /joins the original victorious army before any later Face Dance/);
    assert.match(markup, /does not create another victory or grant another Caladan reinforcement/);
  }
  assert.deepEqual(game, before);
});

void test('actual storm and foreign targets stay unavailable and another viewer receives no owned chooser', () => {
  const game = choiceGame(), view = viewGame(game, 'a'), offer = view.caladanReinforcement;
  assert.ok(offer);
  const storm = offer.destinations.find(destination => destination.id === 'hagga_basin:13'); assert.ok(storm);
  assert.match(storm.blocked ?? '', /storm/i);
  assert.equal(caladanReinforcementChoice(view, storm.id).action, null);
  assert.equal(caladanReinforcementChoice(view, 'carthag:11').action, null);
  assert.match(html(game), /<option[^>]*value="hagga_basin:13"[^>]*disabled=""/);
  const rival = viewGame(game, 'g');
  assert.equal(caladanReinforcementCanAct(rival), false);
  assert.equal(caladanReinforcementChoice(rival, 'hagga_basin:12').action, null);
  assert.equal(html(game, 'g'), '');
});

void test('busy disables the existing chooser while Basic keeps the placement guidance without an Advanced Intrusion claim', () => {
  const game = choiceGame(), busy = html(game, 'a', true);
  assert.match(busy, /<select[^>]*disabled=""/);
  assert.equal((busy.match(/<button[^>]*disabled=""/g) ?? []).length, 2);
  assert.match(busy, /Provisional arrival classification/);
  const basic = choiceGame(false), markup = html(basic);
  assert.match(markup, /no Spiritual Advisor opportunity is created/);
  assert.match(markup, /Provisional arrival classification/);
  assert.doesNotMatch(markup, /Advanced Bene Gesserit Intrusion resolves first/);
  const view = viewGame(basic, 'a');
  assert.ok(caladanReinforcementChoice(view, 'hagga_basin:12').action);
});
