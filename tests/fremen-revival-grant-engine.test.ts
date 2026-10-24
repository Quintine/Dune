import test from 'node:test';
import assert from 'node:assert/strict';
import { viewGame } from '../game/engine';
import {
  createFremenRevivalGrantFixture as fixture,
  actFremenRevivalGrant as act,
  passFremenRevivalGrantResponses as pass,
  advanceFremenRevivalGrant as advance,
  fremenRevivalGrantClean as clean,
  fremenRevivalGrantPlayer as player,
  fremenRevivalGrantInventory as inventory,
} from './fixture-fremen-revival-grant';

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} original allied grant waits for its native Karama response then permits three free`, () => {
    const f = fixture({ advanced }), before = structuredClone(f.game);
    let g = act(f.game, f.fremen, f.grant);
    assert.equal(g.response?.kind, 'fremenRevivalGrant');
    assert.deepEqual(g.response?.fremenGrant, { turn: 2, owner: f.fremen, recipient: f.ally });
    assert.equal(g.freeRevival.includes(f.ally), false);
    assert.ok(viewGame(g, f.observer).responseControls?.cancelCards.includes(f.karama));
    assert.throws(() => act(g, f.ally, { type: 'revive', amount: 3, elite: 0 }), /response|power|interaction/i);
    g = pass(g);
    assert.equal(g.freeRevival.filter(id => id === f.ally).length, 1);
    const spice = player(g, f.ally).spice;
    g = advance(act(g, f.ally, { type: 'revive', amount: 3, elite: 0 }), clean);
    assert.equal(player(g, f.ally).spice, spice);
    assert.equal(player(g, f.ally).revived, 3);
    assert.equal(player(g, f.ally).freeForcesRevived, 3);
    assert.deepEqual(inventory(g), f.originalInventory);
    assert.deepEqual(f.game, before);
    assert.throws(() => act(g, f.fremen, f.grant), /already been granted/);
  });
  void test(`${advanced ? 'Advanced' : 'Basic'} real Karama denies only the original allied grant and cannot be bypassed by redeclaring`, () => {
    const f = fixture({ advanced });
    let g = act(f.game, f.fremen, f.grant);
    g = act(g, f.observer, { type: 'card', card: f.karama, mode: 'cancel' });
    assert.ok(!g.response);
    assert.equal(g.freeRevival.includes(f.ally), false);
    assert.deepEqual(g.revivalRules?.fremenGrantBlocked, [f.ally]);
    assert.equal(g.revivalRules?.freeBlocked?.includes(f.ally) ?? false, false);
    assert.equal(viewGame(g, f.ally).revival.freeRemaining, 2);
    assert.equal(g.discard.filter(c => c.id === f.karama).length, 1);
    const before = structuredClone(g);
    assert.throws(() => act(g, f.fremen, f.grant), /Karama prevented/);
    assert.deepEqual(g, before);
    g = advance(act(g, f.ally, { type: 'revive', amount: 2, elite: 0 }), clean);
    assert.equal(player(g, f.ally).freeForcesRevived, 2);
    assert.deepEqual(inventory(g), f.originalInventory);
  });
  void test(`${advanced ? 'Advanced' : 'Basic'} grant prevention expires through the next actual Revival opening`, () => {
    const f = fixture({ advanced });
    let g = act(f.game, f.fremen, f.grant);
    g = act(g, f.observer, { type: 'card', card: f.karama, mode: 'cancel' });
    g = advance(g, state => state.turn === 3 && state.phase === 4 && clean(state));
    assert.equal(player(g, f.fremen).ally, f.ally);
    assert.equal(g.revivalRules?.fremenGrantBlocked?.includes(f.ally) ?? false, false);
    assert.equal(viewGame(g, f.fremen).fremenRevivalGrant?.blocked, null);
    g = pass(act(g, f.fremen, f.grant));
    assert.equal(g.freeRevival.filter(id => id === f.ally).length, 1);
    assert.deepEqual(inventory(g), f.originalInventory);
  });
  void test(`${advanced ? 'Advanced' : 'Basic'} later Recruits grant preserves earned paid/free history and increases the current allowance`, () => {
    const f = fixture({ advanced, recruits: true, priorRevival: true });
    assert.ok(f.recruitsPlay);
    let g = act(f.game, f.fremen, f.recruitsPlay);
    const spice = player(g, f.ally).spice;
    assert.equal(viewGame(g, f.ally).revival.freeRemaining, 2);
    assert.equal(viewGame(g, f.fremen).fremenRevivalGrant?.blocked, null);
    g = pass(act(g, f.fremen, f.grant));
    assert.equal(viewGame(g, f.ally).revival.freeRemaining, 4);
    assert.equal(player(g, f.ally).spice, spice);
    assert.equal(player(g, f.ally).revived, 3);
    assert.equal(player(g, f.ally).freeForcesRevived, 2);
    g = advance(act(g, f.ally, { type: 'revive', amount: 3, elite: 0 }), clean);
    assert.equal(player(g, f.ally).spice, spice);
    assert.equal(player(g, f.ally).revived, 6);
    assert.equal(player(g, f.ally).freeForcesRevived, 5);
    assert.equal(player(g, f.ally).tanks, 0);
    assert.equal(g.discard.filter(c => c.id === f.recruits).length, 1);
    assert.deepEqual(inventory(g), f.originalInventory);
  });
  void test(`${advanced ? 'Advanced' : 'Basic'} prevention after Recruits leaves intrinsic doubled free returns usable`, () => {
    const f = fixture({ advanced, recruits: true });
    assert.ok(f.recruitsPlay);
    let g = act(f.game, f.fremen, f.recruitsPlay);
    g = act(g, f.fremen, f.grant);
    g = act(g, f.observer, { type: 'card', card: f.karama, mode: 'cancel' });
    assert.ok(!g.response);
    assert.equal(viewGame(g, f.ally).revival.freeRemaining, 4);
    const spice = player(g, f.ally).spice;
    g = advance(act(g, f.ally, { type: 'revive', amount: 4, elite: 0 }), clean);
    assert.equal(player(g, f.ally).spice, spice);
    assert.equal(player(g, f.ally).freeForcesRevived, 4);
    assert.equal(g.freeRevival.includes(f.ally), false);
    assert.deepEqual(inventory(g), f.originalInventory);
  });
}
