import test from 'node:test';
import assert from 'node:assert/strict';
import { botActions } from '../game/bots';
import { orderNexusSpice } from './fixture-nexus-cards';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
  type Action,
} from '../game/engine';
import {
  nexusRicheseFixture,
  nexusRicheseRequest,
  nexusRicheseAllow,
  nexusRicheseReload,
  nexusRicheseInventory,
  holdNexusRicheseCard,
} from './fixture-nexus-richese';

function reject(g: Game, id: string, action: Action) {
  const before = nexusRicheseReload(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}
function stable(g: Game) {
  nexusRicheseInventory(g);
  for (const p of g.players)
    assert.deepEqual(viewGame(nexusRicheseReload(g), p.id), viewGame(g, p.id));
  assert.deepEqual(
    normalizeAutomaticGame(nexusRicheseReload(g)),
    nexusRicheseReload(g),
  );
}

void test('Richese Secret Ally ships five actual counters at one-counter cost for ordinary, Guild and Fremen factions', () => {
  for (const ownerFaction of ['atreides', 'guild', 'fremen'] as const)
    for (const amount of [1, 5]) {
      const f = nexusRicheseFixture({ ownerFaction, spice: 2 });
      const territory =
        ownerFaction === 'fremen' ? 'the_great_flat' : 'red_chasm';
      const sector = ownerFaction === 'fremen' ? 15 : 7;
      const action = nexusRicheseRequest(f, amount, territory, sector);
      const g = nexusRicheseAllow(applyAction(f.g, f.owner, action));
      const p = g.players[0];
      assert.equal(
        p.spice,
        ownerFaction === 'fremen' ? 2 : ownerFaction === 'guild' ? 1 : 0,
      );
      assert.equal(p.reserves, 20 - amount);
      assert.equal(p.forces[`${territory}:${sector}`], amount);
      assert.equal(p.shipped, true);
      assert.equal(p.moved, 0);
      assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
      assert.equal(
        g.nexusCards!.cards!.discard.filter((c) => c === 'richese').length,
        1,
      );
      reject(g, f.owner, action);
      stable(g);
    }
});

void test('Richese declaration rejects excess forces, stale events, foreign seats, wrong ranges and insufficient payment immutably', () => {
  const f = nexusRicheseFixture({ spice: 1 });
  const action = nexusRicheseRequest(f);
  for (const bad of [
    { ...action, amount: 0 },
    { ...action, amount: 6 },
    { ...action, nexus: 'old' },
    { ...action, territory: 'red_chasm', sector: 7 },
    { ...action, territory: 'arrakeen', sector: 9 },
    { ...action, homeworldSources: { unknown: { normal: 5, elite: 0 } } },
  ])
    reject(f.g, f.owner, bad);
  reject(f.g, f.target, action);
  for (const type of ['guildShip', 'homeworldShip', 'guildHomeworldShip'])
    reject(f.g, f.owner, { ...action, type });
  const fremen = nexusRicheseFixture({ ownerFaction: 'fremen' });
  reject(
    fremen.g,
    fremen.owner,
    nexusRicheseRequest(fremen, 5, 'arrakeen', 10),
  );
  const storm = nexusRicheseReload(f.g);
  storm.storm = 10;
  reject(storm, f.owner, action);
});

void test('five typed Emperor forces withdraw from Kaitain and Salusa once while their single-force price stays one', () => {
  const f = nexusRicheseFixture({
    ownerFaction: 'emperor',
    advanced: true,
    homeworlds: true,
    spice: 1,
  });
  const action = {
    ...nexusRicheseRequest(f),
    elite: 2,
    homeworldSources: {
      'homeworld:emperor': { normal: 3, elite: 0 },
      'homeworld:emperor:salusa': { normal: 0, elite: 2 },
    },
  };
  const g = applyAction(f.g, f.owner, action);
  assert.equal(g.players[0].spice, 0);
  assert.equal(g.players[0].forces['arrakeen:10'], 5);
  assert.equal(g.players[0].elites!.forces['arrakeen:10'], 2);
  assert.equal(g.players[0].reserves, 15);
  assert.equal(g.homeworlds!.custody!.salusa!.elite, 3);
  stable(g);
});

void test('Guild interception preserves the complete five-force declaration and spends Nexus on either allowance or stop', () => {
  for (const stop of [false, true]) {
    const f = nexusRicheseFixture({
      advanced: true,
      guild: true,
      karama: true,
      spice: 1,
    });
    const action = nexusRicheseRequest(f);
    let g = applyAction(f.g, f.owner, action);
    assert.equal(g.decision?.kind, 'guildShipment');
    assert.equal(g.pendingShipment!.amount, 5);
    assert.equal(g.pendingShipment!.cost, 1);
    assert.equal(g.players[0].reserves, 20);
    assert.equal(g.players[0].spice, 1);
    assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
    stable(g);
    g = applyAction(
      nexusRicheseReload(g),
      f.target,
      stop
        ? { type: 'card', mode: 'special', card: f.karama }
        : { type: 'decision', allow: true },
    );
    g = nexusRicheseAllow(g);
    assert.equal(g.players[0].reserves, stop ? 20 : 15);
    assert.equal(g.players[0].spice, stop ? 1 : 0);
    assert.equal(g.players[1].spice, stop ? 20 : 21);
    assert.equal(
      g.nexusCards!.cards!.discard.filter((c) => c === 'richese').length,
      1,
    );
    reject(g, f.owner, action);
    stable(g);
  }
});

void test('independent Karama discounts the one-force price, routes payment to bank and preserves actual force count', () => {
  const f = nexusRicheseFixture({ guild: true, spice: 1 });
  const card = holdNexusRicheseCard(f.g, f.owner, 'karama');
  let g = applyAction(f.g, f.owner, {
    type: 'card',
    card: card.id,
    mode: 'shipment',
    target: f.owner,
  });
  g = applyAction(g, f.owner, nexusRicheseRequest(f, 5, 'red_chasm', 7, g));
  assert.equal(g.players[0].spice, 0);
  assert.equal(g.players[0].forces['red_chasm:7'], 5);
  assert.equal(g.players[1].spice, 20);
  assert.equal(g.response, null);
  assert.equal(g.discard.filter((c) => c.id === card.id).length, 1);
  stable(g);
});

void test('the real shipment opens BG accompaniment with all five arrivals and leaves normal movement available afterward', () => {
  const f = nexusRicheseFixture({
    advanced: true,
    opponentFaction: 'beneGesserit',
  });
  let g = applyAction(f.g, f.owner, nexusRicheseRequest(f));
  assert.equal(g.decision?.kind, 'advisor');
  assert.equal(g.players[0].forces['arrakeen:10'], 5);
  g = applyAction(nexusRicheseReload(g), f.target, {
    type: 'decision',
    accept: true,
    accompany: true,
  });
  g = nexusRicheseAllow(g);
  assert.equal(g.players[1].forces['arrakeen:10'], 1);
  assert.equal(g.players[1].reserves, 19);
  assert.equal(g.players[0].moved, 0);
  assert.equal(g.active, f.owner);
  stable(g);
});

void test('Richese held-card availability and original shipment evidence remain private across other seats and reload', () => {
  const f = nexusRicheseFixture({ advanced: true, guild: true });
  for (const id of [f.target, f.observer])
    assert.equal(viewGame(f.g, id).nexusRichese, null);
  let g = applyAction(f.g, f.owner, nexusRicheseRequest(f));
  for (const id of [f.target, f.observer]) {
    const view = viewGame(g, id);
    assert.equal(Object.hasOwn(view, 'nexusRicheseHistory'), false);
    assert.equal(view.nexusRichese, null);
    assert.equal(view.decision?.kind, 'guildShipment');
    if (view.decision?.kind === 'guildShipment')
      assert.equal(view.decision.amount, 5);
  }
  g = applyAction(nexusRicheseReload(g), f.target, {
    type: 'decision',
    allow: true,
  });
  g = nexusRicheseAllow(g);
  stable(g);
});

void test('Richese pending source rejects event/history deletion, original decision edits and valid-looking typed reallocations', () => {
  const f = nexusRicheseFixture({
    ownerFaction: 'emperor',
    advanced: true,
    homeworlds: true,
    guild: true,
  });
  const pending = applyAction(f.g, f.owner, {
    ...nexusRicheseRequest(f),
    elite: 2,
    homeworldSources: {
      'homeworld:emperor': { normal: 3, elite: 0 },
      'homeworld:emperor:salusa': { normal: 0, elite: 2 },
    },
  });
  for (const edit of [
    (g: Game) => {
      delete g.pendingShipment!.nexusEvent;
    },
    (g: Game) => {
      delete g.nexusRicheseHistory;
    },
    (g: Game) => {
      delete g.nexusRicheseLast;
    },
    (g: Game) => {
      g.nexusRicheseHistory![0].signature = 'changed';
    },
    (g: Game) => {
      g.nexusRicheseHistory![0].frame = '{}';
    },
    (g: Game) => {
      g.pendingShipment!.elite = 1;
      g.pendingShipment!.homeworldSources!['homeworld:emperor'].normal = 4;
      g.pendingShipment!.homeworldSources!['homeworld:emperor:salusa'].elite =
        1;
    },
    (g: Game) => {
      if (g.decision?.kind === 'guildShipment') g.decision.amount = 4;
    },
    (g: Game) => {
      if (g.decision?.kind === 'guildShipment') g.decision.shipper = f.observer;
    },
    (g: Game) => {
      g.nexusRicheseLast!.stage = 'shipped';
    },
  ]) {
    const bad = nexusRicheseReload(pending);
    edit(bad);
    const before = nexusRicheseReload(bad);
    for (const p of bad.players) assert.throws(() => viewGame(bad, p.id));
    assert.throws(() => normalizeAutomaticGame(bad));
    assert.throws(() =>
      applyAction(bad, f.target, { type: 'decision', allow: true }),
    );
    assert.deepEqual(bad, before);
  }
});

void test('a genuine Truthtrance interruption preserves Richese pending shipment, paid quote and Guild interception', () => {
  const f = nexusRicheseFixture({ advanced: true, guild: true, spice: 1 });
  const truth = holdNexusRicheseCard(f.g, f.observer, 'truthtrance');
  let g = applyAction(f.g, f.owner, nexusRicheseRequest(f));
  const shipment = structuredClone(g.pendingShipment),
    decision = structuredClone(g.decision),
    history = structuredClone(g.nexusRicheseHistory);
  g = applyAction(g, f.observer, { type: 'card', card: truth.id });
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = applyAction(g, f.observer, {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: f.owner,
      fact: { kind: 'hand', name: 'Shield' },
    },
  });
  g = applyAction(nexusRicheseReload(g), f.owner, {
    type: 'truthAnswer',
    answer: 'no',
  });
  assert.deepEqual(g.pendingShipment, shipment);
  assert.deepEqual(g.decision, decision);
  assert.deepEqual(g.nexusRicheseHistory, history);
  g = applyAction(g, f.target, { type: 'decision', allow: true });
  g = nexusRicheseAllow(g);
  assert.equal(g.players[0].reserves, 15);
  assert.equal(g.players[0].spice, 0);
  assert.equal(g.discard.filter((c) => c.id === truth.id).length, 1);
  stable(g);
});

void test('completed Richese history survives ordinary movement, genuine next-turn phases and a later full-price shipment', () => {
  const f = nexusRicheseFixture();
  let g = applyAction(f.g, f.owner, nexusRicheseRequest(f));
  const history = structuredClone(g.nexusRicheseHistory);
  g = applyAction(g, f.owner, {
    type: 'move',
    from: 'arrakeen:10',
    territory: 'hagga_basin',
    sector: 12,
    amount: 5,
  });
  assert.equal(g.players[0].forces['hagga_basin:12'], 5);
  while (g.phase === 5) g = applyAction(g, g.active!, { type: 'endMovement' });
  let ordered = false;
  for (
    let step = 0;
    !(
      g.turn === 2 &&
      g.phase === 5 &&
      !g.response &&
      !g.decision &&
      !g.phaseOpening
    ) && step < 180;
    step++
  ) {
    if (g.turn === 2 && g.phase === 1 && !ordered) {
      orderNexusSpice(g, ['land', 'land']);
      ordered = true;
    }
    let next: Game | undefined;
    for (const p of g.players) {
      const v = viewGame(g, p.id);
      v.players.find((s) => s.id === p.id)!.bot = 'Easy';
      const action = botActions(v)[0];
      if (action) {
        next = applyAction(g, p.id, action);
        break;
      }
    }
    assert.ok(
      next,
      `Next turn stalled at ${g.turn}/${g.phase}/${g.decision?.kind}`,
    );
    g = next;
  }
  assert.equal(g.turn, 2);
  assert.equal(g.phase, 5);
  while (g.active !== f.owner)
    g = applyAction(g, g.active!, { type: 'endMovement' });
  assert.deepEqual(g.nexusRicheseHistory, history);
  assert.equal(g.nexusCards!.cards!.hands[f.owner], null);
  const before = g.players[0].spice,
    reserves = g.players[0].reserves;
  g = applyAction(g, f.owner, {
    type: 'ship',
    territory: 'red_chasm',
    sector: 7,
    amount: 1,
  });
  assert.equal(g.players[0].spice, before - 2);
  assert.equal(g.players[0].reserves, reserves - 1);
  assert.deepEqual(g.nexusRicheseHistory, history);
  stable(g);
});

void test('native Ixians may ship five typed counters into their real mobile stronghold but another faction cannot', () => {
  for (const advanced of [false, true]) {
    const f = nexusRicheseFixture({
      ownerFaction: 'ixians',
      advanced,
      spice: 1,
    });
    assert.ok(f.g.mobileStronghold?.location);
    const g = applyAction(f.g, f.owner, {
      ...nexusRicheseRequest(f, 5, 'hidden_mobile_stronghold', 0),
      elite: 2,
    });
    assert.equal(g.players[0].forces['hidden_mobile_stronghold:0'], 5);
    assert.equal(g.players[0].elites!.forces['hidden_mobile_stronghold:0'], 2);
    assert.equal(g.players[0].spice, 0);
    stable(g);
  }
  const other = nexusRicheseFixture({ opponentFaction: 'ixians' });
  assert.ok(other.g.mobileStronghold?.location);
  reject(
    other.g,
    other.owner,
    nexusRicheseRequest(other, 5, 'hidden_mobile_stronghold', 0),
  );
});

void test('a genuinely placed Terror token sees five arriving Richese-discounted counters under low Grumman', () => {
  const f = nexusRicheseFixture({
    opponentFaction: 'moritani',
    homeworlds: true,
  });
  let g = f.g;
  g.players[1].reserves = 7;
  g.players[1].forces = { 'polar_sink:0': 13 };
  while (g.phase === 5) g = applyAction(g, g.active!, { type: 'endMovement' });
  assert.equal(g.phase, 7);
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.decision?.kind, 'moritaniPlacement');
  const token = g.moritaniTerror!.tokens.find((t) => t.kind === 'robbery')!;
  g = nexusRicheseAllow(
    applyAction(g, f.target, {
      type: 'decision',
      token: token.id,
      territory: 'arrakeen',
    }),
  );
  let ordered = false;
  for (
    let step = 0;
    !(
      g.turn === 2 &&
      g.phase === 5 &&
      !g.response &&
      !g.decision &&
      !g.phaseOpening
    ) && step < 180;
    step++
  ) {
    if (g.turn === 2 && g.phase === 1 && !ordered) {
      orderNexusSpice(g, ['land', 'land']);
      ordered = true;
    }
    let next: Game | undefined;
    for (const p of g.players) {
      const v = viewGame(g, p.id);
      v.players.find((s) => s.id === p.id)!.bot = 'Easy';
      const action = botActions(v)[0];
      if (action) {
        next = applyAction(g, p.id, action);
        break;
      }
    }
    assert.ok(
      next,
      `Terror progression stalled at ${g.turn}/${g.phase}/${g.decision?.kind}`,
    );
    g = next;
  }
  assert.equal(g.turn, 2);
  assert.equal(g.phase, 5);
  while (g.active !== f.owner)
    g = applyAction(g, g.active!, { type: 'endMovement' });
  assert.equal(g.players[1].reserves, 7);
  const spice = g.players[0].spice;
  g = applyAction(g, f.owner, nexusRicheseRequest(f, 5, 'arrakeen', 10, g));
  assert.equal(g.players[0].spice, spice - 1);
  assert.equal(g.pendingTerrorEntry?.amount, 5);
  assert.equal(g.players[0].forces['arrakeen:10'], 5);
  const beforeRobbery = g.players[0].spice;
  g = applyAction(nexusRicheseReload(g), f.target, {
    type: 'decision',
    reveal: true,
  });
  g = applyAction(g, f.target, { type: 'decision', choice: 'spice' });
  assert.equal(
    g.players[0].spice,
    beforeRobbery - Math.ceil(beforeRobbery / 2),
  );
  assert.equal(
    g.moritaniTerror!.tokens.find((t) => t.id === token.id)!.status,
    'removed',
  );
  stable(g);
});
