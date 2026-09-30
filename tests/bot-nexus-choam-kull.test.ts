import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame } from '../game/engine';
import type { Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { choamPowerAction } from '../game/choam-power-options';
import { createNexusChoamKullFixture } from './fixture-nexus-choam-kull';

void test('all four profiles settle saved Basic and Advanced Nexus Kull with only their own projected physical fuel', () => {
  for (const profile of DIFFICULTIES) {
    for (const advanced of [false, true]) {
      for (const fuel of ['karama', 'worthless', 'weapon'] as const) {
        const fixture = createNexusChoamKullFixture({ advanced, fuel, counter: false });
        const saved: Game = JSON.parse(JSON.stringify(fixture.game));
        saved.players.find(player => player.id === fixture.choam)!.bot = profile;
        saved.players.find(player => player.id === fixture.other)!.bot = profile;
        const own = viewGame(saved, fixture.choam);
        for (const player of own.players) {
          if (player.id === own.me) continue;
          for (const key of ['hand', 'traitors', 'spice']) {
            Object.defineProperty(player, key, { get() { throw new Error(`Read rival ${key}`); } });
          }
        }
        const actions = botActions(own);
        assert.equal(actions.length, 1);
        assert.deepEqual(botActions(viewGame(saved, fixture.other!)), []);
        const settled = applyAction(saved, fixture.choam, actions[0]);
        assert.equal(settled.pendingKull, null);
        assert.equal(settled.karamaShipping, null);
        assert.equal(settled.discard.filter(card => card.id === fixture.fuel).length, 1);
        assert.ok(settled.players.find(player => player.id === fixture.actor)!.hand.some(card => card.id === fixture.original));
        assert.ok(viewGame(settled, fixture.actor).karamaBlocked);
        assert.equal(settled.nexusCards!.cards!.hands[fixture.choam], null);
        assert.equal(settled.nexusCards!.cards!.discard.filter(face => face === 'choam').length, 1);
        assert.equal(settled.nexusChoamHistory!.at(-1)!.stage, 'complete');
      }
    }
  }
});

void test('all profiles decline unavailable Nexus costs rather than falling through to proactive powers or consuming fuel', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createNexusChoamKullFixture({ nexusFace: 'richese', counter: false });
    fixture.game.players.find(player => player.id === fixture.choam)!.bot = profile;
    const actions = botActions(viewGame(fixture.game, fixture.choam));
    assert.equal(actions.length, 1);
    const resumed = applyAction(fixture.game, fixture.choam, actions[0]);
    assert.equal(resumed.pendingKull, null);
    assert.equal(resumed.karamaShipping?.owner, fixture.actor);
    assert.equal(resumed.discard.filter(card => card.id === fixture.original).length, 1);
    assert.ok(resumed.players.find(player => player.id === fixture.choam)!.hand.some(card => card.id === fixture.fuel));
    assert.equal(resumed.nexusCards!.cards!.hands[fixture.choam], 'richese');
    assert.equal(resumed.nexusChoamHistory, undefined);
  }
});

void test('every profile can prevent Nexus Kull for an ally using a distinct legal counter, retaining fuel but not refunding Nexus', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createNexusChoamKullFixture({ fuel: 'weapon' });
    const other = fixture.game.players.find(player => player.id === fixture.other)!;
    const actor = fixture.game.players.find(player => player.id === fixture.actor)!;
    other.bot = profile;
    other.ally = actor.id;
    actor.ally = other.id;
    const declared = applyAction(fixture.game, fixture.choam, {
      type: 'kullDecision', event: fixture.event, source: 'nexus', card: fixture.fuel,
    });
    const actions = botActions(viewGame(JSON.parse(JSON.stringify(declared)), other.id));
    assert.equal(actions.length, 1);
    const resumed = applyAction(declared, other.id, actions[0]);
    assert.equal(resumed.pendingKull, null);
    assert.equal(resumed.karamaShipping?.owner, actor.id);
    assert.equal(resumed.discard.filter(card => card.id === fixture.counter).length, 1);
    assert.equal(resumed.discard.filter(card => card.id === fixture.original).length, 1);
    assert.ok(resumed.players.find(player => player.id === fixture.choam)!.hand.some(card => card.id === fixture.fuel));
    assert.equal(viewGame(resumed, actor.id).karamaBlocked, null);
    assert.equal(resumed.nexusCards!.cards!.hands[fixture.choam], null);
    assert.equal(resumed.nexusChoamHistory!.at(-1)!.stage, 'canceled');
  }
});

void test('all profiles leave the interrupted BG Worthless card unconverted when Nexus Kull succeeds', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createNexusChoamKullFixture({ advanced: true, bg: true, fuel: 'weapon', counter: false });
    fixture.game.players.find(player => player.id === fixture.choam)!.autopilot = profile;
    const action = botActions(viewGame(JSON.parse(JSON.stringify(fixture.game)), fixture.choam))[0];
    assert.ok(action);
    const settled = applyAction(fixture.game, fixture.choam, action);
    assert.equal(settled.pendingKull, null);
    const original = settled.players.find(player => player.id === fixture.actor)!.hand.find(card => card.id === fixture.original);
    assert.equal(original?.kind, 'worthless');
    assert.ok(!settled.discard.some(card => card.id === fixture.original));
    assert.ok(viewGame(settled, fixture.actor).karamaBlocked);
  }
});

void test('a blocked projected Nexus cost is declined and cannot be submitted through the generic proactive CHOAM path', () => {
  for (const profile of DIFFICULTIES) {
    const fixture = createNexusChoamKullFixture({ fuel: 'weapon', counter: false });
    fixture.game.players.find(player => player.id === fixture.choam)!.bot = profile;
    const own = viewGame(fixture.game, fixture.choam);
    const play = own.kullReaction!.plays[0];
    assert.equal(choamPowerAction(own, play), null);
    play.blocked = 'Reserved by another commitment.';
    const action = botActions(own)[0];
    assert.ok(action);
    const resumed = applyAction(fixture.game, fixture.choam, action);
    assert.equal(resumed.pendingKull, null);
    assert.equal(resumed.karamaShipping?.owner, fixture.actor);
    assert.ok(resumed.players.find(player => player.id === fixture.choam)!.hand.some(card => card.id === fixture.fuel));
    assert.equal(resumed.nexusCards!.cards!.hands[fixture.choam], 'choam');
  }
});
