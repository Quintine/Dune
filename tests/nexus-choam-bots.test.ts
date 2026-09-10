import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame } from '../game/engine';
import { botActions } from '../game/bots';
import {
  choamPowerAction,
  choamPowerBotPlay,
  choamPowerPlays,
} from '../game/choam-power-options';
import {
  NEXUS_CHOAM_EFFECTS,
  nexusChoamFixture,
  nexusChoamInventory,
  holdNexusChoamCard,
} from './fixture-nexus-choam';

void test('all four CHOAM profiles use projected Cunning fuel at existing effect timing and preserve the Easy revival policy', () => {
  for (const effect of NEXUS_CHOAM_EFFECTS)
    for (const profile of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
      const f = nexusChoamFixture(effect);
      const view = viewGame(f.g, f.owner);
      view.players.find((player) => player.id === f.owner)!.bot = profile;
      const before = structuredClone(view);
      const action = botActions(view)[0];
      assert.ok(action, `${profile}/${effect}`);
      if (effect === 'laLaLa' && profile === 'Easy')
        assert.deepEqual(action, { type: 'decision', decline: true });
      else {
        assert.equal(
          action.nexus,
          choamPowerPlays(view, effect).find(
            (play) => play.card.id === f.cost.id && play.source === 'nexus',
          )!.event,
        );
        assert.equal(action.card, f.cost.id);
        assert.equal(action.effect, effect);
      }
      const result = applyAction(f.g, f.owner, action);
      nexusChoamInventory(result);
      assert.deepEqual(view, before);
    }
});

void test('CHOAM fuel ranking favors printed powers then low-value private costs and never consumes blocked cards', () => {
  const f = nexusChoamFixture('kulon');
  const fuel = holdNexusChoamCard(f.g, f.owner, 'Baliset');
  const value = (card: { id: string }) => (card.id === fuel.id ? 0 : 10);
  const view = viewGame(f.g, f.owner);
  const selected = choamPowerBotPlay(view, 'kulon', value)!;
  assert.equal(selected.source, 'nexus');
  assert.equal(selected.card.id, fuel.id);
  for (const p of view.players.filter((player) => player.id !== f.owner))
    for (const key of ['hand', 'spice', 'traitors'])
      Object.defineProperty(p, key, {
        get() {
          throw new Error('Private opponent field read');
        },
      });
  assert.equal(choamPowerBotPlay(view, 'kulon', value)!.card.id, fuel.id);
  for (const play of view.choamWorthless!.plays)
    if (play.card.id === fuel.id) play.blocked = 'Reserved';
  assert.equal(choamPowerBotPlay(view, 'kulon', value)!.card.id, f.cost.id);
  assert.equal(choamPowerAction(view, selected), null);
  const printed = holdNexusChoamCard(f.g, f.owner, 'Kulon');
  const regular = choamPowerBotPlay(viewGame(f.g, f.owner), 'kulon', (card) =>
    card.id === printed.id ? 100 : 0,
  )!;
  assert.equal(regular.source, 'printed');
  assert.deepEqual(choamPowerAction(viewGame(f.g, f.owner), regular), {
    type: 'card',
    mode: 'choam',
    card: printed.id,
  });
});
