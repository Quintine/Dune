import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import {
  MoritaniPlacement,
  MoritaniTerrorSupply,
} from '../components/moritani-terror';
import {
  moritaniPlacementChoices,
  nexusMoritaniAction,
  nexusMoritaniCanAct,
} from '../game/nexus-moritani-options';
import {
  nexusMoritaniFixture,
  nexusMoritaniToken,
  nexusMoritaniInventory,
} from './fixture-nexus-moritani';

const html = (game: GameView, busy = false) =>
  renderToStaticMarkup(
    createElement(MoritaniPlacement, { game, busy, act() {} }),
  );

void test('genuine Basic and Advanced Mentat keeps native relocation choices and offers explicit Cunning supply placement into Arrakis or a stack', () => {
  for (const advanced of [false, true]) {
    const f = nexusMoritaniFixture({ advanced, stack: true });
    const v = viewGame(f.g, f.owner),
      before = structuredClone(v);
    const token = nexusMoritaniToken(f.g, 'robbery').id;
    const native = moritaniPlacementChoices(v, false, token);
    const cunning = moritaniPlacementChoices(v, true, token);
    assert.ok(native.tokens.some((candidate) => candidate.status === 'placed'));
    assert.ok(
      cunning.tokens.every((candidate) => candidate.status === 'available'),
    );
    for (const destination of ['red_chasm', 'polar_sink', 'arrakeen']) {
      assert.equal(native.destinations.includes(destination), false);
      assert.ok(cunning.destinations.includes(destination));
      const action = nexusMoritaniAction(
        v,
        v.nexusMoritani!.event,
        token,
        destination,
      );
      assert.deepEqual(action, {
        type: 'decision',
        token,
        territory: destination,
        nexus: v.nexusMoritani!.event,
      });
      const pending = applyAction(f.g, f.owner, action!);
      assert.equal(pending.response?.kind, 'moritaniPlacement');
      assert.equal(nexusMoritaniToken(pending, 'robbery').status, 'available');
      nexusMoritaniInventory(pending);
    }
    assert.ok(!cunning.destinations.includes('hidden_mobile_stronghold'));
    assert.ok(
      !cunning.destinations.some((destination) =>
        destination.startsWith('homeworld:'),
      ),
    );
    const markup = html(v);
    assert.match(markup, /type="checkbox"/);
    assert.doesNotMatch(markup, /checked=""/);
    assert.match(markup, /decision-checkbox min-h-11/);
    assert.match(markup, /Use Moritani Nexus Cunning/);
    assert.match(
      markup,
      /Relocation, Grumman use, Homeworlds and the Hidden Mobile Stronghold are unavailable/,
    );
    assert.match(markup, /Destination stronghold/);
    assert.match(html(v, true), /disabled=""/);
    assert.match(
      renderToStaticMarkup(createElement(MoritaniTerrorSupply, { game: v })),
      /Inspect Robbery/,
    );
    assert.deepEqual(v, before);
  }
});

void test('Moritani shared Cunning action binds current private offer, available token and destination without accepting relocation or stale events', () => {
  const f = nexusMoritaniFixture({ stack: true });
  const v = viewGame(f.g, f.owner),
    offer = v.nexusMoritani!;
  const token = nexusMoritaniToken(f.g, 'robbery').id;
  assert.ok(nexusMoritaniCanAct(v));
  assert.equal(nexusMoritaniAction(v, 'stale', token, 'red_chasm'), null);
  assert.equal(
    nexusMoritaniAction(
      v,
      offer.event,
      nexusMoritaniToken(f.g, 'sabotage').id,
      'red_chasm',
    ),
    null,
  );
  assert.equal(
    nexusMoritaniAction(v, offer.event, 'missing', 'red_chasm'),
    null,
  );
  assert.equal(
    nexusMoritaniAction(v, offer.event, token, 'hidden_mobile_stronghold'),
    null,
  );
  for (const edit of [
    (g: GameView) => {
      g.phase = 7;
    },
    (g: GameView) => {
      g.turn++;
    },
    (g: GameView) => {
      g.decision = null;
    },
    (g: GameView) => {
      g.decision = { kind: 'moritaniPlacement', player: f.target };
    },
    (g: GameView) => {
      g.nexusCards!.card = null;
    },
    (g: GameView) => {
      g.players.find((p) => p.id === f.owner)!.ally = f.target;
    },
    (g: GameView) => {
      g.automaticContinuationPending = true;
    },
    (g: GameView) => {
      g.nexusMoritani!.blocked = 'Finish the current interaction.';
    },
  ]) {
    const blocked = structuredClone(v);
    edit(blocked);
    assert.equal(
      nexusMoritaniAction(blocked, offer.event, token, 'red_chasm'),
      null,
    );
  }
  const blocked = structuredClone(v);
  blocked.nexusMoritani!.blocked =
    'This combination awaits its placement ruling.';
  assert.match(html(blocked), /combination awaits its placement ruling/);
});

void test('nonowners cannot render or read private Cunning supply even from an accidentally broad view', () => {
  const f = nexusMoritaniFixture({ stack: true });
  for (const id of [f.target, f.observer]) {
    const v = viewGame(f.g, id);
    assert.equal(v.nexusMoritani, null);
    assert.equal(html(v), '');
    Object.defineProperty(v, 'nexusMoritani', {
      get() {
        throw new Error('Opponent Nexus offer read');
      },
    });
    assert.equal(nexusMoritaniCanAct(v), false);
    assert.deepEqual(moritaniPlacementChoices(v, true).tokens, []);
    assert.equal(nexusMoritaniAction(v, 'event', 'token', 'red_chasm'), null);
    const markup = renderToStaticMarkup(
      createElement(MoritaniTerrorSupply, { game: v }),
    );
    assert.match(markup, /Hidden Terror/);
    assert.doesNotMatch(markup, /Inspect Sabotage/);
  }
});
