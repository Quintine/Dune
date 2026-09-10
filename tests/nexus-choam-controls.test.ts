import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, viewGame, type GameView } from '../game/engine';
import { ChoamWorthless } from '../components/choam-worthless';
import { ChoamBaliset } from '../components/choam-baliset';
import { ChoamStorm } from '../components/choam-storm';
import { ChoamGamont } from '../components/choam-gamont';
import {
  CHOAM_POWER_NAMES,
  choamPowerAction,
  choamPowerPlays,
} from '../game/choam-power-options';
import {
  NEXUS_CHOAM_EFFECTS,
  nexusChoamFixture,
  nexusChoamInventory,
  nexusChoamRequest,
  holdNexusChoamCard,
  type NexusChoamEffect,
} from './fixture-nexus-choam';

function html(game: GameView, effect: NexusChoamEffect, busy = false) {
  const component =
    effect === 'jubba'
      ? ChoamStorm
      : effect === 'baliset'
        ? ChoamBaliset
        : effect === 'gamont'
          ? ChoamGamont
          : ChoamWorthless;
  return renderToStaticMarkup(
    createElement(component, { game, busy, act() {} }),
  );
}

void test('five actual CHOAM windows show physical weapon fuel separately from the chosen Worthless effect and submit the real source action', () => {
  for (const effect of NEXUS_CHOAM_EFFECTS) {
    const f = nexusChoamFixture(effect);
    const view = viewGame(f.g, f.owner),
      before = structuredClone(view);
    const play = choamPowerPlays(view, effect).find(
      (candidate) =>
        candidate.source === 'nexus' && candidate.card.id === f.cost.id,
    )!;
    assert.ok(play, effect);
    assert.equal(play.blocked, null, effect);
    const markup = html(view, effect);
    assert.ok(markup.includes(f.cost.name), effect);
    assert.ok(markup.includes(CHOAM_POWER_NAMES[effect]), effect);
    assert.match(markup, /Inspect card/);
    assert.match(markup, /spends CHOAM Nexus Cunning once/);
    assert.match(markup, /the Nexus stays spent/);
    assert.match(html(view, effect, true), /disabled=""/);
    const action = choamPowerAction(view, play, f.selection);
    assert.deepEqual(action, nexusChoamRequest(f));
    const pending = applyAction(f.g, f.owner, action!);
    assert.equal(pending.response?.intent, CHOAM_POWER_NAMES[effect]);
    assert.notEqual(pending.response?.intent, f.cost.name);
    assert.deepEqual(view, before);
    nexusChoamInventory(pending);
  }
});

void test('CHOAM cost selection keeps printed powers unchanged and exposes explicit source blocks including Kull', () => {
  const f = nexusChoamFixture('kulon');
  const printed = holdNexusChoamCard(f.g, f.owner, 'Kulon');
  const view = viewGame(f.g, f.owner);
  const regular = choamPowerPlays(view, 'kulon').find(
    (play) => play.source === 'printed',
  )!;
  assert.deepEqual(choamPowerAction(view, regular), {
    type: 'card',
    mode: 'choam',
    card: printed.id,
  });
  assert.equal(
    choamPowerAction(view, regular, { nexus: 'forged', effect: 'jubba' }),
    null,
  );
  assert.match(html(view, 'kulon'), /Card to use for Kulon/);
  assert.match(html(view, 'kulon'), /printed power/);
  const blocked = structuredClone(view);
  for (const play of blocked.choamWorthless!.plays)
    if (play.effect === 'kulon')
      play.blocked = 'This card is reserved for another committed action.';
  assert.match(html(blocked, 'kulon'), /reserved for another committed action/);
  assert.match(html(blocked, 'kulon'), /disabled=""[^>]*>Use Kulon/);
  for (const play of choamPowerPlays(blocked, 'kulon'))
    assert.equal(choamPowerAction(blocked, { ...play, blocked: null }), null);
  const kull = choamPowerPlays(view, 'kull').find(
    (play) => play.source === 'nexus',
  )!;
  assert.ok(kull.blocked);
  assert.equal(choamPowerAction(view, kull), null);
  assert.match(html(view, 'kulon'), /Kull Wahad.*not implemented/);
});

void test('CHOAM shared actions fence stale source events, actors and interruption windows without reading outsider private choices', () => {
  const f = nexusChoamFixture('kulon');
  const view = viewGame(f.g, f.owner);
  const play = choamPowerPlays(view, 'kulon').find(
    (candidate) => candidate.source === 'nexus',
  )!;
  assert.equal(choamPowerAction(view, { ...play, event: 'stale' }), null);
  for (const change of [
    (v: GameView) => {
      v.phase = 4;
    },
    (v: GameView) => {
      v.active = f.target;
    },
    (v: GameView) => {
      v.automaticContinuationPending = true;
    },
    (v: GameView) => {
      v.decision = { kind: 'choamMentat', player: f.owner };
    },
    (v: GameView) => {
      v.players.find((p) => p.id === f.owner)!.ally = f.target;
    },
    (v: GameView) => {
      v.nexusCards!.card = null;
    },
  ]) {
    const blocked = structuredClone(view);
    change(blocked);
    assert.equal(choamPowerAction(blocked, play), null);
  }
  for (const id of [f.target, f.observer]) {
    const other = viewGame(f.g, id);
    assert.equal(other.choamWorthless, null);
    Object.defineProperty(other, 'choamWorthless', {
      get() {
        throw new Error('Opponent cost choices read');
      },
    });
    assert.deepEqual(choamPowerPlays(other, 'kulon'), []);
    assert.equal(choamPowerAction(other, play), null);
  }
});
