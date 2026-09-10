import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import {
  nexusAdvisorFixture,
  nexusAdvisorPlayer,
  nexusAdvisorInventory,
  holdAdvisorKarama,
  beginNexusAdvisorFlip,
  allowNexusAdvisorFlip,
} from './fixture-nexus-advisors';
import { nexusReload, nexusReject } from './fixture-nexus-cards';
import { drawNexusCard } from '../game/nexus-cards';

function action(g: Game, territories = ['arrakeen', 'pasty_mesa']) {
  const owner = nexusAdvisorPlayer(g);
  return {
    type: 'nexusAdvisors',
    event: viewGame(g, owner.id).nexusAdvisors!.offer!.event,
    territories,
  };
}
function resources(g: Game) {
  return g.players.map((p) => ({
    id: p.id,
    forces: p.forces,
    reserves: p.reserves,
    tanks: p.tanks,
    elites: p.elites,
    spice: p.spice,
    hand: p.hand,
    shipped: p.shipped,
    moved: p.moved,
  }));
}

void test('Cunning converts every counter in selected multi-sector groups without consuming movement, shipment or spice', () => {
  let g = nexusAdvisorFixture();
  holdAdvisorKarama(g);
  const original = nexusReload(g);
  const offer = viewGame(g, 'p').nexusAdvisors!.offer!;
  assert.deepEqual(
    [...offer.territories]
      .sort((a, b) => a.territory.localeCompare(b.territory))
      .map((t) => [t.territory, t.count]),
    [
      ['arrakeen', 2],
      ['carthag', 1],
      ['pasty_mesa', 3],
    ],
  );
  g = beginNexusAdvisorFlip(g, ['arrakeen', 'pasty_mesa']);
  assert.equal(g.response?.kind, 'nexusAdvisorFlip');
  assert.deepEqual(
    nexusAdvisorPlayer(g).advisors,
    nexusAdvisorPlayer(original).advisors,
  );
  assert.equal(g.nexusCards!.cards!.hands.p, null);
  g = allowNexusAdvisorFlip(g);
  assert.deepEqual(nexusAdvisorPlayer(g).advisors, { carthag: {} });
  assert.deepEqual(resources(g), resources(original));
  assert.equal(g.phase, 5);
  assert.equal(g.active, 'p');
  assert.equal(g.movementRemaining, original.movementRemaining);
  assert.equal(g.pendingTerrorEntry, original.pendingTerrorEntry);
  assert.equal(g.pendingAmbassador, original.pendingAmbassador);
  assert.equal(
    g.nexusCards!.cards!.discard.filter((c) => c === 'beneGesserit').length,
    1,
  );
  nexusAdvisorInventory(g);
});

void test('one Karama cancels the entire announced advisor batch and spends both physical cards once', () => {
  let g = nexusAdvisorFixture();
  const karama = holdAdvisorKarama(g);
  const advisors = structuredClone(nexusAdvisorPlayer(g).advisors);
  g = beginNexusAdvisorFlip(g, ['arrakeen', 'pasty_mesa', 'carthag']);
  g = applyAction(g, 'q', { type: 'card', card: karama, mode: 'cancel' });
  g = allowNexusAdvisorFlip(g);
  assert.deepEqual(nexusAdvisorPlayer(g).advisors, advisors);
  assert.equal(g.discard.filter((c) => c.id === karama).length, 1);
  assert.equal(
    g.nexusCards!.cards!.discard.filter((c) => c === 'beneGesserit').length,
    1,
  );
  assert.equal(viewGame(g, 'p').nexusAdvisors!.pending, null);
  nexusAdvisorInventory(g);
});

void test('saved live response exposes only its public selected groups and resumes exactly once', () => {
  let g = nexusAdvisorFixture({
    seatIds: ['bg-seat', 'guild-seat', 'fremen-seat'],
  });
  holdAdvisorKarama(g, 'guild-seat');
  const request = action(g);
  g = beginNexusAdvisorFlip(g, request.territories);
  const saved = nexusReload(g);
  const expected = viewGame(saved, 'bg-seat').nexusAdvisors!.pending;
  assert.ok(expected);
  for (const id of ['bg-seat', 'guild-seat', 'fremen-seat']) {
    const view = viewGame(saved, id);
    assert.deepEqual(view.nexusAdvisors!.pending, expected);
    for (const p of view.players)
      if (p.id !== id) assert.equal(p.hand, undefined);
  }
  assert.deepEqual(normalizeAutomaticGame(saved), saved);
  g = allowNexusAdvisorFlip(nexusReload(saved));
  assert.deepEqual(nexusAdvisorPlayer(g).advisors, { carthag: {} });
  const done = nexusReload(g);
  assert.deepEqual(normalizeAutomaticGame(done), done);
  nexusReject(g, 'bg-seat', request);
  nexusAdvisorInventory(g);
});

void test('foreign, stale, empty, duplicate, partial and non-advisor selections reject before any spend', () => {
  const g = nexusAdvisorFixture();
  const request = action(g);
  nexusReject(g, 'q', request);
  nexusReject(g, 'p', { ...request, event: 'old' });
  for (const territories of [
    [],
    ['arrakeen', 'arrakeen'],
    ['polar_sink'],
    ['pasty_mesa:5'],
    ['homeworld:beneGesserit'],
  ])
    nexusReject(
      g,
      'p',
      { ...request, territories },
      /advisor|territor|Homeworld/i,
    );
  nexusReject(g, 'p', { ...request, amount: 1 });
  assert.equal(g.nexusCards!.cards!.hands.p, 'beneGesserit');
});

void test('Cunning belongs to the current native Advanced shipment and movement action', () => {
  for (const mutate of [
    (g: Game) => {
      g.active = 'q';
    },
    (g: Game) => {
      g.phase = 6;
    },
    (g: Game) => {
      g.phase = 8;
    },
  ]) {
    const g = nexusAdvisorFixture();
    mutate(g);
    assert.ok(viewGame(g, 'p').nexusAdvisors!.offer!.blocked);
    nexusReject(g, 'p', action(g), /own Shipment and Movement/);
  }
  const basic = nexusAdvisorFixture({ advanced: false });
  const offer = viewGame(basic, 'p').nexusAdvisors!.offer;
  assert.ok(!offer || offer.blocked || !offer.territories.length);
  nexusReject(
    basic,
    'p',
    {
      type: 'nexusAdvisors',
      event: offer?.event ?? 'none',
      territories: ['arrakeen'],
    },
    /Advanced/,
  );
});

void test('fresh advisor locks and storm-locked strongholds remain guarded without partially converting an allowed group', () => {
  for (const scenario of ['lock', 'storm']) {
    const g = nexusAdvisorFixture();
    if (scenario === 'lock')
      nexusAdvisorPlayer(g).advisors!.arrakeen.lockedTurn = g.turn;
    else g.storm = 10;
    const offer = viewGame(g, 'p').nexusAdvisors!.offer!;
    assert.ok(
      offer.territories.find((t) => t.territory === 'arrakeen')!.blocked,
    );
    assert.equal(
      offer.territories.find((t) => t.territory === 'pasty_mesa')!.blocked,
      null,
    );
    nexusReject(g, 'p', action(g));
    assert.ok(nexusAdvisorPlayer(g).advisors!.pasty_mesa);
  }
});

void test('a third occupying faction blocks stronghold conversion while leaving other advisor groups available', () => {
  const g = nexusAdvisorFixture();
  const observer = g.players.find((p) => p.id === 'r')!;
  observer.forces['arrakeen:10'] = 1;
  observer.reserves--;
  const offer = viewGame(g, 'p').nexusAdvisors!.offer!;
  assert.ok(offer.territories.find((t) => t.territory === 'arrakeen')!.blocked);
  assert.equal(
    offer.territories.find((t) => t.territory === 'pasty_mesa')!.blocked,
    null,
  );
  nexusReject(g, 'p', action(g), /three occupying factions/);
  nexusAdvisorInventory(g);
});

void test('already completed shipping and moving remain completed after a legal conversion before ending the action', () => {
  let g = nexusAdvisorFixture();
  nexusAdvisorPlayer(g).shipped = true;
  nexusAdvisorPlayer(g).moved = 1;
  const before = nexusReload(g);
  g = allowNexusAdvisorFlip(beginNexusAdvisorFlip(g, ['pasty_mesa']));
  assert.deepEqual(resources(g), resources(before));
  assert.equal(g.active, 'p');
  assert.equal(g.phase, 5);
  assert.deepEqual(nexusAdvisorPlayer(g).advisors, {
    arrakeen: {},
    carthag: {},
  });
});

void test('missing response, edited original groups and altered movement-frame evidence reject reads and actions unchanged', () => {
  let g = nexusAdvisorFixture();
  holdAdvisorKarama(g);
  g = beginNexusAdvisorFlip(g, ['arrakeen', 'pasty_mesa']);
  for (const mutate of [
    (bad: Game) => {
      bad.response = null;
    },
    (bad: Game) => {
      bad.response!.owner = 'q';
    },
    (bad: Game) => {
      bad.response!.intent = 'other-event';
    },
    (bad: Game) => {
      delete bad.nexusAdvisorHistory;
    },
    (bad: Game) => {
      delete bad.nexusAdvisorLast;
    },
    (bad: Game) => {
      bad.nexusAdvisorHistory![0].receipt.selections[0].count++;
    },
    (bad: Game) => {
      bad.nexusAdvisorHistory![0].stage = 'completed';
    },
    (bad: Game) => {
      nexusAdvisorPlayer(bad).moved++;
    },
    (bad: Game) => {
      nexusAdvisorPlayer(bad).forces['arrakeen:10']++;
      nexusAdvisorPlayer(bad).reserves--;
    },
  ]) {
    const bad = nexusReload(g);
    mutate(bad);
    const saved = JSON.stringify(bad);
    for (const p of bad.players) assert.throws(() => viewGame(bad, p.id));
    assert.throws(() => normalizeAutomaticGame(bad));
    assert.throws(() => applyAction(bad, 'q', { type: 'passResponse' }));
    assert.equal(JSON.stringify(bad), saved);
  }
});

void test('a real Truthtrance interruption preserves the pending advisor batch and its original cancellation response', () => {
  let g = nexusAdvisorFixture();
  holdAdvisorKarama(g);
  const index = g.deck.findIndex((card) => card.effect === 'truthtrance');
  assert.ok(index >= 0);
  const truth = g.deck.splice(index, 1)[0];
  g.players.find((p) => p.id === 'r')!.hand.push(truth);
  g = beginNexusAdvisorFlip(g, ['arrakeen', 'pasty_mesa']);
  const response = structuredClone(g.response);
  const record = structuredClone(g.nexusAdvisorHistory);
  g = applyAction(g, 'r', { type: 'card', card: truth.id });
  while (g.truthtrance?.stage === 'priority')
    g = applyAction(
      g,
      g.players.find((p) => !g.truthtrance!.passed.includes(p.id))!.id,
      { type: 'truthPass' },
    );
  g = applyAction(g, 'r', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'p',
      fact: { kind: 'hand', name: 'Shield' },
    },
  });
  g = applyAction(nexusReload(g), 'p', { type: 'truthAnswer', answer: 'no' });
  assert.equal(g.truthtrance, null);
  assert.deepEqual(g.response, response);
  assert.deepEqual(g.nexusAdvisorHistory, record);
  g = allowNexusAdvisorFlip(g);
  assert.deepEqual(nexusAdvisorPlayer(g).advisors, { carthag: {} });
  assert.equal(g.discard.filter((card) => card.id === truth.id).length, 1);
  nexusAdvisorInventory(g);
});

void test('Harkonnen private Nexus exchange cannot consume or alter a pending advisor conversion', () => {
  let g = nexusAdvisorFixture({ opponentFaction: 'harkonnen' });
  const cards = g.nexusCards!.cards!;
  cards.deck = [
    'harkonnen',
    ...cards.deck.filter((card) => card !== 'harkonnen'),
  ];
  g.nexusCards!.cards = drawNexusCard(cards, 'q', g.players, () => 0);
  holdAdvisorKarama(g, 'r');
  g = beginNexusAdvisorFlip(g, ['pasty_mesa']);
  const response = structuredClone(g.response);
  const record = structuredClone(g.nexusAdvisorHistory);
  const offer = viewGame(g, 'q').nexusTraitors!.offer!;
  assert.equal(offer.blocked, null);
  g = applyAction(g, 'q', {
    type: 'nexusTraitorDraw',
    event: offer.event,
    mode: offer.mode,
  });
  assert.deepEqual(g.nexusAdvisorHistory, record);
  nexusReject(g, 'r', { type: 'passResponse' }, /private Nexus card return/);
  const pending = g.nexusTraitorExchanges!.at(-1)!;
  g = applyAction(normalizeAutomaticGame(nexusReload(g)), 'q', {
    type: 'nexusTraitorReturn',
    event: pending.event,
    cards: [...pending.drawn],
  });
  assert.deepEqual(g.response, response);
  assert.deepEqual(g.nexusAdvisorHistory, record);
  g = allowNexusAdvisorFlip(g);
  assert.deepEqual(nexusAdvisorPlayer(g).advisors, {
    arrakeen: {},
    carthag: {},
  });
  assert.equal(g.nexusTraitorExchanges!.length, 1);
  assert.equal(g.nexusAdvisorHistory!.length, 1);
  nexusAdvisorInventory(g);
});
