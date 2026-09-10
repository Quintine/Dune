import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { viewGame, type GameView } from '../game/engine';
import {
  nexusTraitorDrawAction,
  nexusTraitorReturnAction,
} from '../game/nexus-traitor-options';
import {
  nexusTraitorFixture,
  nexusTraitorDraw,
} from './fixture-nexus-traitors';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === 'next/image' ? 'vinext/shims/image' : specifier,
      context,
    );
  },
});
const { NexusTraitors } = await import('../components/nexus-traitors');
aliases.deregister();

function html(game: GameView, busy = false) {
  return renderToStaticMarkup(
    createElement(NexusTraitors, { game, busy, act() {} }),
  );
}

void test('Nexus draw control uses the private current offer and keeps human Cunning available over preserved controls', () => {
  const v = viewGame(nexusTraitorFixture(), 'p');
  const offer = v.nexusTraitors!.offer!;
  const expected = {
    type: 'nexusTraitorDraw',
    event: offer.event,
    mode: 'cunning',
  };
  assert.deepEqual(nexusTraitorDrawAction(v, offer.event, 'cunning'), expected);
  v.decision = { kind: 'nullentropy', player: 'p' };
  v.automaticContinuationPending = true;
  assert.deepEqual(nexusTraitorDrawAction(v, offer.event, 'cunning'), expected);
  assert.match(html(v), /Draw 1 Traitor card/);
  assert.match(html(v, true), /disabled/);
  assert.equal(nexusTraitorDrawAction(v, 'stale', 'cunning'), null);
  assert.equal(nexusTraitorDrawAction(v, offer.event, 'secretAlly'), null);
  offer.blocked = 'Finish the current Nexus card draw.';
  assert.equal(nexusTraitorDrawAction(v, offer.event, 'cunning'), null);
  assert.match(html(v), /Finish the current Nexus card draw/);
  offer.blocked = null;
  v.nexusCards!.card = 'atreides';
  assert.equal(nexusTraitorDrawAction(v, offer.event, 'cunning'), null);
});

void test('owner exchange renders real identities and explicit choice without automatic confirmation', () => {
  const v = viewGame(nexusTraitorDraw(nexusTraitorFixture()), 'p');
  const pending = v.nexusTraitors!.pending!;
  const rendered = html(v);
  assert.equal(
    (rendered.match(/type="checkbox"/g) ?? []).length,
    pending.choices.length,
  );
  assert.doesNotMatch(rendered, /checked=""/);
  assert.match(rendered, /0 of 1 selected/);
  assert.match(rendered, /previous game action is paused/);
  assert.match(rendered, /disabled=""[^>]*>Return selected card/);
  for (const choice of pending.choices) {
    const identity = v.allLeaders.find((leader) => leader.id === choice.id)!;
    assert.ok(rendered.includes(identity.name));
    assert.ok(rendered.includes(`Inspect traitor: ${identity.name}`));
    assert.ok(rendered.includes(`Strength ${identity.strength}`));
  }
  const drawn = pending.choices.find((choice) => choice.drawn)!.id;
  assert.deepEqual(nexusTraitorReturnAction(v, pending.event, [drawn]), {
    type: 'nexusTraitorReturn',
    event: pending.event,
    cards: [drawn],
  });
});

void test('Face Dancer exchange requires exactly two projected choices and excludes previously revealed dancers', () => {
  const g = nexusTraitorFixture({ ownerFaction: 'tleilaxu' });
  g.players[0].faceDancers![0].revealed = true;
  const excluded = g.players[0].faceDancers![0].leader;
  const v = viewGame(nexusTraitorDraw(g), 'p');
  const pending = v.nexusTraitors!.pending!;
  const selected = pending.choices.slice(0, 2).map((choice) => choice.id);
  assert.equal(pending.count, 2);
  assert.ok(!pending.choices.some((choice) => choice.id === excluded));
  assert.match(html(v), /Inspect Face Dancer:/);
  assert.match(html(v), /Previously revealed Face Dancers are not available/);
  assert.ok(nexusTraitorReturnAction(v, pending.event, selected));
  for (const cards of [
    [],
    selected.slice(0, 1),
    [selected[0], selected[0]],
    [selected[0], excluded],
    [...selected, excluded],
  ])
    assert.equal(nexusTraitorReturnAction(v, pending.event, cards), null);
  assert.equal(nexusTraitorReturnAction(v, 'old-exchange', selected), null);
  v.decision = { kind: 'nullentropy', player: 'p' };
  v.automaticContinuationPending = true;
  assert.ok(nexusTraitorReturnAction(v, pending.event, selected));
  v.truthtrance = { stage: 'priority', queue: [], passed: [], question: null };
  assert.equal(nexusTraitorReturnAction(v, pending.event, selected), null);
  assert.match(html(v), /Finish Truthtrance before returning/);
});

void test('observer exchange controls never read private card choices', () => {
  const g = nexusTraitorDraw(nexusTraitorFixture());
  for (const id of ['q', 'r']) {
    const v = viewGame(g, id);
    const pending = v.nexusTraitors!.pending!;
    assert.deepEqual(pending.choices, []);
    Object.defineProperty(pending, 'choices', {
      get() {
        throw new Error('Read another seat’s choices');
      },
    });
    const rendered = html(v);
    assert.match(rendered, /Waiting for Owner to return 1 card privately/);
    assert.doesNotMatch(
      rendered,
      /checkbox|Inspect traitor|Strength|Newly drawn/,
    );
    assert.equal(
      nexusTraitorReturnAction(v, pending.event, ['anything']),
      null,
    );
  }
});
