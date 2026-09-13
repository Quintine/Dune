import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import {
  leaderSkillBattle,
  resolveLeaderSkillBattle,
} from './leader-skill-battle-fixture';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === 'next/image' ? 'vinext/shims/image' : specifier,
      context,
    );
  },
});
const { RihaniChoice, RihaniHistory } =
  await import('../components/rihani-decipherer');
aliases.deregister();

function choiceHtml(game: GameView, busy = false) {
  return renderToStaticMarkup(
    createElement(RihaniChoice, { game, busy, act() {} }),
  );
}
function historyHtml(game: GameView) {
  return renderToStaticMarkup(createElement(RihaniHistory, { game }));
}
function identityName(game: GameView, id: string) {
  return game.allLeaders.find((leader) => leader.id === id)?.name ?? id;
}

void test('Rihani offer and private inspection render only for the owning seat', () => {
  const pending = resolveLeaderSkillBattle(
    leaderSkillBattle({ skill: 'rihani-decipherer' }),
  );
  const owner = viewGame(pending, 'a');
  const observer = viewGame(pending, 'd');
  const receipt = pending.rihaniHistory![0];
  const offer = choiceHtml(owner);

  assert.match(offer, /aria-label="Rihani draw offer"/);
  assert.match(offer, /Once drawn, you must keep one new card/);
  assert.match(offer, />Draw two Traitors<\/button>/);
  assert.match(offer, />Decline exchange<\/button>/);
  assert.equal(choiceHtml(observer), '');
  assert.deepEqual(observer.rihani?.history, []);
  assert.equal('drawn' in observer.rihani!.pending!, false);
  assert.equal('eligible' in observer.rihani!.pending!, false);

  const privateHistory = historyHtml(owner);
  assert.match(privateHistory, /Your private Rihani inspections/);
  assert.match(
    privateHistory,
    /Normal inspection — returned to the shuffled deck/,
  );
  for (const id of receipt.peeked) {
    assert.ok(privateHistory.includes(identityName(owner, id)));
    assert.ok(
      privateHistory.includes(`Inspect traitor: ${identityName(owner, id)}`),
    );
  }
  assert.equal(historyHtml(observer), '');
  assert.equal(
    (choiceHtml(owner, true).match(/<button[^>]*disabled=""/g) ?? []).length,
    2,
  );
});

void test('Rihani return controls separate new-card keeps from unused old-card reveals and require both selections', () => {
  const offered = resolveLeaderSkillBattle(
    leaderSkillBattle({ skill: 'rihani-decipherer' }),
  );
  const event = offered.rihaniHistory![0].event;
  const drawn = applyAction(offered, 'a', {
    type: 'decision',
    event,
    draw: true,
  });
  const receipt = drawn.rihaniHistory![0];
  const owner = viewGame(drawn, 'a');
  const observer = viewGame(drawn, 'd');
  const controls = choiceHtml(owner);

  assert.match(controls, /aria-label="Rihani Traitor exchange"/);
  assert.equal(
    (controls.match(/name="rihani-keep"/g) ?? []).length,
    receipt.drawn.length,
  );
  assert.equal(
    (controls.match(/name="rihani-give"/g) ?? []).length,
    receipt.eligible.length,
  );
  assert.doesNotMatch(controls, /checked=""/);
  assert.match(
    controls,
    /<button[^>]*disabled=""[^>]*>Keep and reveal selected cards<\/button>/,
  );
  for (const id of receipt.drawn) {
    assert.ok(controls.includes(`value="${id}"`));
    assert.ok(controls.includes(`Keep ${identityName(owner, id)}`));
  }
  for (const id of receipt.eligible) {
    assert.ok(controls.includes(`value="${id}"`));
    assert.ok(controls.includes(`Reveal ${identityName(owner, id)}`));
  }
  assert.equal(choiceHtml(observer), '');
  assert.equal('drawn' in observer.rihani!.pending!, false);
  assert.equal('eligible' in observer.rihani!.pending!, false);

  const busy = choiceHtml(owner, true);
  assert.equal(
    (busy.match(/<input[^>]*disabled=""/g) ?? []).length,
    receipt.drawn.length + receipt.eligible.length,
  );
  assert.match(
    busy,
    /<button[^>]*disabled=""[^>]*>Keep and reveal selected cards<\/button>/,
  );

  const kept = receipt.drawn[1];
  const given = receipt.eligible[0];
  const done = applyAction(drawn, 'a', {
    type: 'decision',
    event,
    cards: [kept, given],
  });
  const completed = historyHtml(viewGame(done, 'a'));
  assert.ok(completed.includes(`Kept ${identityName(owner, kept)}`));
  assert.ok(completed.includes(`returned ${identityName(owner, given)}`));
  assert.equal(historyHtml(viewGame(done, 'd')), '');
});
