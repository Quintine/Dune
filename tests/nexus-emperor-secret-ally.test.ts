import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import {
  emperorNexusPools,
  emperorNexusSignature,
} from '../game/nexus-emperor-secret-ally';
import { forceRevivalRemaining, freeRevivalRemaining } from '../game/revival';
import {
  nexusEmperorSecretAllyFixture,
  emperorNexusPhysical,
} from './nexus-emperor-secret-ally-fixture';
import { nexusReject, nexusReload, nexusReady } from './fixture-nexus-cards';
import { nexusTraitorFixture } from './fixture-nexus-traitors';

void test('a later real Ghola return and phase advance preserve historical Nexus proof without replaying its physical grant', () => {
  const f = nexusEmperorSecretAllyFixture();
  const card = f.g.deck.find((c) => c.effect === 'ghola')!;
  f.g.deck = f.g.deck.filter((c) => c.id !== card.id);
  f.g.players.find((p) => p.id === f.owner)!.hand.push(card);
  f.g.players.find((p) => p.id === f.owner)!.spice = 0;
  const physical = emperorNexusPhysical(f.g);
  let g = applyAction(f.g, f.owner, f.action);
  const receipt = nexusReload(g).nexusEmperorSecretHistory;
  g = applyAction(nexusReload(g), f.owner, {
    type: 'card',
    card: card.id,
    amount: 3,
    elite: 0,
  });
  assert.equal(g.players.find((p) => p.id === f.owner)!.tanks, 0);
  assert.equal(g.players.find((p) => p.id === f.owner)!.revived, 0);
  assert.equal(g.players.find((p) => p.id === f.owner)!.spice, 0);
  assert.deepEqual(g.nexusEmperorSecretHistory, receipt);
  assert.deepEqual(emperorNexusPhysical(g), physical);
  g = nexusReload(nexusReady(g));
  assert.equal(g.phase, 5);
  assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), g);
  nexusReject(g, f.owner, f.action);
});

for (const advanced of [false, true])
  void test(`${advanced ? 'Advanced' : 'Basic'} Emperor Secret Ally revives exactly three physical forces without ordinary payment or quota usage`, () => {
    const f = nexusEmperorSecretAllyFixture({ advanced }),
      before = nexusReload(f.g),
      p = before.players.find((p) => p.id === f.owner)!;
    const physical = emperorNexusPhysical(before),
      quota = forceRevivalRemaining(before, p),
      free = freeRevivalRemaining(before, p);
    const g = applyAction(f.g, f.owner, f.action),
      after = g.players.find((p) => p.id === f.owner)!;
    assert.deepEqual(f.g, before);
    assert.deepEqual(emperorNexusPools(after), {
      ...emperorNexusPools(p),
      reserves: p.reserves + 3,
      tanks: p.tanks - 3,
    });
    assert.equal(forceRevivalRemaining(g, after), quota);
    assert.equal(freeRevivalRemaining(g, after), free);
    assert.deepEqual(
      g.players.filter((p) => p.id !== f.owner),
      before.players.filter((p) => p.id !== f.owner),
    );
    assert.deepEqual(after.hand, p.hand);
    assert.deepEqual(after.leaders, p.leaders);
    assert.deepEqual(emperorNexusPhysical(g), physical);
    assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
    assert.equal(
      g.nexusCards!.cards!.discard.filter((c) => c === 'emperor').length,
      1,
    );
    assert.equal(g.nexusEmperorSecretHistory!.length, 1);
    assert.equal(g.phase, 4);
    assert.equal(g.response, null);
    assert.equal(g.decision, null);
    const ordinary = applyAction(g, f.owner, {
      type: 'revive',
      amount: 3,
      elite: 0,
    });
    const revived = ordinary.players.find((p) => p.id === f.owner)!;
    assert.equal(revived.tanks, 0);
    assert.equal(revived.revived, 3);
    assert.equal(revived.spice, p.spice - 2);
    assert.deepEqual(emperorNexusPhysical(ordinary), physical);
    nexusReject(ordinary, f.owner, f.action);
    assert.deepEqual(normalizeAutomaticGame(nexusReload(ordinary)), ordinary);
  });

void test('Emperor additional return still works after the ordinary three-force and free allowances are exhausted', () => {
  const f = nexusEmperorSecretAllyFixture();
  const paid = applyAction(f.g, f.owner, {
    type: 'revive',
    amount: 3,
    elite: 0,
  });
  const before = emperorNexusPools(paid.players.find((p) => p.id === f.owner)!);
  const done = applyAction(paid, f.owner, f.action);
  assert.deepEqual(
    emperorNexusPools(done.players.find((p) => p.id === f.owner)!),
    { ...before, reserves: before.reserves + 3, tanks: before.tanks - 3 },
  );
});

void test('Advanced Fedaykin use typed Tanks and share the actual one-per-turn cap with ordinary revival', () => {
  for (const nexusFirst of [false, true]) {
    const f = nexusEmperorSecretAllyFixture({
      advanced: true,
      owner: 'p',
      tanks: 7,
      eliteTanks: 2,
    });
    const before = emperorNexusPhysical(f.g);
    assert.deepEqual(
      viewGame(f.g, f.owner).nexusEmperorSecretAlly!.revival.eliteOptions,
      [0, 1],
    );
    nexusReject(f.g, f.owner, { ...f.action, elite: 2 });
    let g: Game;
    if (nexusFirst) {
      g = applyAction(f.g, f.owner, f.action);
      nexusReject(
        g,
        f.owner,
        { type: 'revive', amount: 1, elite: 1 },
        /one elite/,
      );
      g = applyAction(g, f.owner, { type: 'revive', amount: 3, elite: 0 });
    } else {
      g = applyAction(f.g, f.owner, { type: 'revive', amount: 3, elite: 1 });
      assert.deepEqual(
        viewGame(g, f.owner).nexusEmperorSecretAlly!.revival.eliteOptions,
        [0],
      );
      nexusReject(g, f.owner, f.action);
      g = applyAction(g, f.owner, { ...f.action, elite: 0 });
    }
    assert.equal(g.players[0].elites!.revived, 1);
    assert.equal(g.players[0].elites!.tanks, 1);
    assert.deepEqual(emperorNexusPhysical(g), before);
  }
});

void test('short total or typed groups are explicitly unavailable without spending a card or fabricating partial forces', () => {
  for (const options of [
    { tanks: 2 },
    { advanced: true, owner: 'p' as const, tanks: 3, eliteTanks: 2 },
  ]) {
    const f = nexusEmperorSecretAllyFixture(options);
    assert.deepEqual(
      viewGame(f.g, f.owner).nexusEmperorSecretAlly!.revival.eliteOptions,
      [],
    );
    assert.match(
      viewGame(f.g, f.owner).nexusEmperorSecretAlly!.revival.blocked!,
      /exactly three/,
    );
    nexusReject(f.g, f.owner, f.action, /exactly three/);
    assert.equal(f.g.nexusCards!.cards!.hands[f.owner], 'emperor');
  }
});

void test('only the private absent-Emperor holder gets revival choices; nonholders retain ordinary phase progress', () => {
  const f = nexusEmperorSecretAllyFixture();
  assert.equal(viewGame(f.g, f.owner).nexusEmperorSecretAlly!.purchase, null);
  for (const id of [f.target, f.observer]) {
    const v = viewGame(f.g, id);
    assert.equal(v.nexusEmperorSecretAlly, null);
    assert.equal(v.nexusCards!.card, null);
    assert.equal(v.decision, null);
    assert.equal(Object.hasOwn(v, 'nexusEmperorSecretHistory'), false);
  }
  const next = nexusReady(f.g);
  assert.equal(next.phase, 5);
  assert.equal(next.nexusCards!.cards!.hands[f.owner], 'emperor');
  nexusReject(next, f.owner, f.action, /Revival/);
  const ready = applyAction(f.g, f.owner, { type: 'ready' });
  // As with ordinary revival, a Ready vote does not end the printed phase
  // while other players are still acting; the existing timing remains valid.
  assert.equal(
    viewGame(ready, f.owner).nexusEmperorSecretAlly!.revival.blocked,
    null,
  );
  assert.equal(
    applyAction(ready, f.owner, f.action).nexusEmperorSecretHistory!.length,
    1,
  );
});

void test('stale, wrong-owner, malformed and leader-revival requests reject before any resource or random commitment', () => {
  const f = nexusEmperorSecretAllyFixture(),
    before = nexusReload(f.g);
  for (const action of [
    { ...f.action, event: 'stale' },
    { ...f.action, elite: -1 },
    { ...f.action, elite: 0.5 },
    { ...f.action, amount: 2 },
    { ...f.action, leader: f.g.players[0].leaders[0].id },
    { type: f.action.type, event: f.action.event },
  ])
    nexusReject(f.g, f.owner, action);
  nexusReject(f.g, f.target, f.action);
  assert.deepEqual(f.g, before);
  const card = f.g.deck.find((c) => c.effect === 'truthtrance')!;
  f.g.deck = f.g.deck.filter((c) => c.id !== card.id);
  f.g.players.find((p) => p.id === f.target)!.hand.push(card);
  const pending = applyAction(f.g, f.target, { type: 'card', card: card.id });
  assert.ok(pending.truthtrance);
  nexusReject(pending, f.owner, f.action, /current interaction/);
});

void test('ordinary Fremen aid to the other allied seat does not suppress this unallied owner', () => {
  const f = nexusEmperorSecretAllyFixture();
  const granted = applyAction(f.g, 'p', { type: 'grantRevival' });
  assert.ok(granted.freeRevival.includes('r'));
  assert.equal(
    viewGame(granted, f.owner).nexusEmperorSecretAlly!.revival.blocked,
    null,
  );
  const done = applyAction(granted, f.owner, f.action);
  assert.deepEqual(done.freeRevival, granted.freeRevival);
});

void test('combined modules and applicable revival suppression stay explicit, while native and Betrayal modes never expose Secret Ally', () => {
  const f = nexusEmperorSecretAllyFixture();
  for (const damage of [
    (g: Game) => {
      g.expansions = ['ix'];
    },
    (g: Game) => {
      g.discoveryEnabled = true;
    },
    (g: Game) => {
      g.revivalRules!.expanded = [f.owner];
    },
    (g: Game) => {
      g.revivalRules!.freeBlocked = [f.owner];
    },
    (g: Game) => {
      g.revivalPrevention = { player: f.owner, turn: g.turn };
    },
  ]) {
    const g = nexusReload(f.g);
    damage(g);
    nexusReject(g, f.owner, f.action, /Nexus|Discover|revival/);
  }
  for (const native of [false, true]) {
    const g = nexusTraitorFixture({
      ownerFaction: native ? 'emperor' : 'atreides',
      opponentFaction: native ? 'guild' : 'emperor',
      phase: 4,
    });
    const cards = g.nexusCards!.cards!,
      old = cards.hands.p!;
    cards.deck[cards.deck.indexOf('emperor')] = old;
    cards.hands.p = 'emperor';
    assert.equal(viewGame(g, 'p').nexusEmperorSecretAlly, null);
    nexusReject(g, 'p', f.action);
  }
});

void test('JSON restoration keeps signed source history private and rejects missing markers, duplicate uses and changed physical quotes', () => {
  const f = nexusEmperorSecretAllyFixture(),
    done = applyAction(f.g, f.owner, f.action);
  for (const p of done.players)
    assert.deepEqual(viewGame(nexusReload(done), p.id), viewGame(done, p.id));
  assert.deepEqual(normalizeAutomaticGame(nexusReload(done)), done);
  nexusReject(done, f.owner, f.action);
  for (const damage of [
    (g: Game) => {
      delete g.nexusEmperorSecretHistory;
    },
    (g: Game) => {
      delete g.nexusEmperorSecretEvents;
    },
    (g: Game) => {
      g.nexusEmperorSecretEvents![0] = 'forged';
    },
    (g: Game) => {
      g.nexusEmperorSecretHistory!.push(g.nexusEmperorSecretHistory![0]);
      g.nexusEmperorSecretEvents!.push(g.nexusEmperorSecretEvents![0]);
    },
    (g: Game) => {
      g.nexusEmperorSecretHistory![0].after.reserves++;
    },
    (g: Game) => {
      const r = g.nexusEmperorSecretHistory![0];
      r.elite = 1;
      r.signature = emperorNexusSignature(r);
    },
    (g: Game) => {
      const cards = g.nexusCards!.cards!;
      cards.discard = cards.discard.filter((c) => c !== 'emperor');
      cards.hands[f.owner] = 'emperor';
    },
  ]) {
    const g = nexusReload(done);
    damage(g);
    const before = nexusReload(g);
    assert.throws(() => viewGame(g, f.owner), /Emperor Nexus/);
    assert.throws(() => normalizeAutomaticGame(g), /Emperor Nexus/);
    assert.throws(
      () => applyAction(g, f.owner, { type: 'ready' }),
      /Emperor Nexus/,
    );
    assert.deepEqual(g, before);
  }
});
