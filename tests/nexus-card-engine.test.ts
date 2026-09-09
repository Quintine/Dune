import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import type { FactionId } from '../game/catalog';
import { placeAmbassador } from '../game/ecaz-ambassadors';
import { placeTerror } from '../game/moritani-terror';
import {
  enterNexusSpice,
  finishNexusSpice,
  nexusFixture,
  nexusAllow,
  nexusInventory,
  nexusPlayer,
  nexusReady,
  nexusReject,
  nexusReload,
  nexusTurnTwo,
  orderNexusSpice,
} from './fixture-nexus-cards';

function alliance(g: Game, one = 'f', two = 'a'): Game {
  g = applyAction(g, one, { type: 'alliance', target: two });
  return applyAction(g, two, { type: 'alliance', target: one });
}
function negotiations(g: Game): Game {
  g = nexusReady(g);
  assert.ok(g.spiceWindow);
  g = nexusReady(g);
  assert.equal(g.nexus, true);
  assert.equal(g.spiceWindow, null);
  return g;
}
function choice(g: Game, id: string, value: string): Action {
  return {
    type: 'nexusCardChoice',
    turn: g.turn,
    card: g.nexusCards!.cards!.hands[id],
    choice: value,
    ownRedraws: 0,
  };
}
function top(g: Game, ...cards: FactionId[]): void {
  const deck = g.nexusCards!.cards!.deck;
  assert.ok(cards.every((card) => deck.includes(card)));
  g.nexusCards!.cards!.deck = [
    ...cards,
    ...deck.filter((card) => !cards.includes(card)),
  ];
}
function closing(advanced = false): Game {
  let g = nexusTurnTwo({ advanced });
  orderNexusSpice(g, ['worm', 'land', 'land']);
  g = alliance(negotiations(g));
  return finishNexusSpice(g);
}

for (const advanced of [false, true])
  void test(`${advanced ? 'Advanced A/B' : 'Basic'} real phase draws once only after all spice passes and settled alliances`, () => {
    let g = nexusTurnTwo({ advanced });
    assert.equal(g.nexusCards!.cards!.deck.length, 12);
    orderNexusSpice(g, ['worm', 'land', 'land']);
    g = alliance(negotiations(g));
    assert.equal(g.nexusCards!.phase!.occurred, true);
    assert.deepEqual(viewGame(g, 'h').nexusCards!.choices, []);
    g = nexusReady(g);
    if (advanced) {
      assert.equal(g.spiceSequence!.pile, 1);
      assert.ok(g.spiceWindow);
      assert.equal(g.nexusCards!.cards!.deck.length, 12);
      assert.deepEqual(viewGame(g, 'h').nexusCards!.choices, []);
    }
    g = finishNexusSpice(g);
    assert.equal(g.phase, 1);
    assert.equal(g.nexusCards!.phase!.stage, 'drawing');
    assert.equal(viewGame(g, 'h').beforeSpiceDraw, false);
    top(g, 'ecaz');
    const draw = choice(g, 'h', 'draw');
    g = applyAction(nexusReload(g), 'h', draw);
    assert.equal(g.phase, 2);
    assert.equal(g.nexusCards!.phase!.stage, 'complete');
    assert.equal(g.nexusCards!.cards!.hands.h, 'ecaz');
    assert.equal(g.nexusCards!.cards!.deck.length, 11);
    nexusReject(g, 'h', draw);
    assert.deepEqual(normalizeAutomaticGame(nexusReload(g)), g);
    nexusInventory(g);
  });

void test('first-turn skipped worm, no worm, and actual Nexus without any alliance do not grant a card', () => {
  let first = enterNexusSpice(nexusFixture());
  orderNexusSpice(first, ['worm', 'land']);
  first = finishNexusSpice(first);
  assert.equal(first.nexusCards!.phase!.occurred, false);
  assert.equal(first.phase, 2);
  let noWorm = enterNexusSpice(first, true);
  orderNexusSpice(noWorm, ['land']);
  noWorm = finishNexusSpice(noWorm);
  assert.deepEqual(noWorm.nexusCards!.phase!.eligible, []);
  let noAlliance = enterNexusSpice(noWorm, true);
  orderNexusSpice(noAlliance, ['worm', 'land']);
  noAlliance = finishNexusSpice(noAlliance);
  assert.equal(noAlliance.nexusCards!.phase!.occurred, true);
  assert.deepEqual(noAlliance.nexusCards!.phase!.eligible, []);
  assert.equal(noAlliance.nexusCards!.cards!.deck.length, 12);
  nexusInventory(noAlliance);
});

void test('a real before-blow Fremen summoned Nexus resumes both Advanced piles and offers one final draw', () => {
  let g = nexusTurnTwo({ advanced: true });
  orderNexusSpice(g, ['land', 'land']);
  const index = g.deck.findIndex((card) => card.effect === 'karama');
  assert.ok(index >= 0);
  const card = g.deck.splice(index, 1)[0];
  nexusPlayer(g, 'f').hand.push(card);
  const beforeSpice = nexusReload(g).spiceDeck;
  g = nexusAllow(
    applyAction(g, 'f', {
      type: 'card',
      mode: 'special',
      card: card.id,
      territory: 'the_great_flat',
    }),
  );
  assert.equal(g.summonedBeforeBlow, true);
  assert.equal(g.nexusCards!.phase!.occurred, true);
  assert.deepEqual(g.spiceDeck, beforeSpice);
  assert.equal(g.discard.filter((item) => item.id === card.id).length, 1);
  g = alliance(negotiations(nexusReload(g)));
  g = finishNexusSpice(g);
  assert.equal(
    g.spiceDiscard[0].filter((item) => 'territory' in item).length,
    1,
  );
  assert.equal(
    g.spiceDiscard[1].filter((item) => 'territory' in item).length,
    1,
  );
  assert.equal(g.nexusCards!.phase!.stage, 'drawing');
  top(g, 'ecaz');
  g = applyAction(nexusReload(g), 'h', choice(g, 'h', 'draw'));
  assert.equal(g.phase, 2);
  assert.equal(g.nexusCards!.cards!.deck.length, 11);
  assert.equal(g.nexusCards!.cards!.hands.h, 'ecaz');
  nexusInventory(g);
});

void test('precommitted own-faction policy completes privately and later replacement discards once', () => {
  const initial = closing();
  top(initial, 'harkonnen', 'ecaz', 'moritani');
  const keptOwn = applyAction(initial, 'h', choice(initial, 'h', 'draw'));
  assert.equal(keptOwn.phase, 2);
  assert.equal(keptOwn.nexusCards!.cards!.hands.h, 'harkonnen');
  assert.deepEqual(viewGame(keptOwn, 'a').nexusCards!.waiting, []);
  let g = applyAction(nexusReload(initial), 'h', {
    ...choice(initial, 'h', 'draw'),
    ownRedraws: 1,
  });
  assert.equal(g.phase, 2);
  assert.equal(g.nexusCards!.cards!.hands.h, 'ecaz');
  assert.deepEqual(g.nexusCards!.cards!.discard, ['harkonnen']);
  assert.deepEqual(viewGame(g, 'a').nexusCards!.waiting, []);
  nexusReject(g, 'h', choice(initial, 'h', 'draw'));
  const repeatedPolicy = applyAction(initial, 'h', {
    ...choice(initial, 'h', 'draw'),
    ownRedraws: 2,
  });
  assert.deepEqual(repeatedPolicy.nexusCards, g.nexusCards);
  g = enterNexusSpice(g, true);
  orderNexusSpice(g, ['worm', 'land']);
  g = finishNexusSpice(g);
  assert.deepEqual(viewGame(g, 'h').nexusCards!.choices, ['keep', 'replace']);
  const replace = choice(g, 'h', 'replace');
  g = applyAction(nexusReload(g), 'h', replace);
  assert.equal(g.nexusCards!.cards!.hands.h, 'moritani');
  assert.deepEqual(g.nexusCards!.cards!.discard, ['harkonnen', 'ecaz']);
  nexusReject(g, 'h', replace);
  nexusInventory(g);
});

void test('closing choices fence stale owners/cards/turns and every other action; all four bots emit a legal choice', () => {
  const g = closing();
  for (const action of [
    { type: 'ready' },
    { type: 'alliance', target: 'f' },
    { type: 'card', card: 'invented' },
    { type: 'ship', amount: 1 },
    { type: 'decision', decline: true },
    { ...choice(g, 'h', 'draw'), turn: g.turn - 1 },
    { ...choice(g, 'h', 'draw'), card: 'atreides' },
    { ...choice(g, 'h', 'draw'), injected: true },
  ])
    nexusReject(g, 'h', action);
  nexusReject(g, 'f', choice(g, 'f', 'draw'));
  for (const difficulty of DIFFICULTIES) {
    const view = viewGame(g, 'h');
    view.players.find((p) => p.id === 'h')!.bot = difficulty;
    const action = botActions(view)[0];
    assert.equal(action?.type, 'nexusCardChoice');
    assert.doesNotThrow(() => applyAction(g, 'h', action!));
  }
  const kept = applyAction(g, 'h', choice(g, 'h', 'keep'));
  assert.equal(kept.phase, 2);
  assert.equal(kept.nexusCards!.cards!.deck.length, 12);
});

void test('private card projection exposes only own identity; a real reciprocal Nexus join forfeits held card exactly once', () => {
  let g = closing();
  top(g, 'ecaz');
  g = applyAction(g, 'h', choice(g, 'h', 'draw'));
  for (const id of ['f', 'a', 'h']) {
    const projected = viewGame(nexusReload(g), id).nexusCards!;
    assert.equal(projected.card, id === 'h' ? 'ecaz' : null);
    assert.deepEqual(projected.held, { f: false, a: false, h: true });
    assert.deepEqual(Object.keys(projected).sort(), [
      'card',
      'choices',
      'deckCount',
      'discardCount',
      'held',
      'turn',
      'waiting',
    ]);
    if (id !== 'h')
      assert.equal(JSON.stringify(projected).includes('ecaz'), false);
  }
  assert.equal(JSON.stringify(g.log).includes('ecaz'), false);
  g = enterNexusSpice(g, true);
  orderNexusSpice(g, ['worm', 'land']);
  g = negotiations(g);
  g = applyAction(g, 'a', { type: 'alliance' });
  g = applyAction(g, 'h', { type: 'alliance', target: 'a' });
  assert.equal(g.nexusCards!.cards!.hands.h, 'ecaz', 'offer is not acceptance');
  g = applyAction(nexusReload(g), 'a', { type: 'alliance', target: 'h' });
  assert.equal(g.nexusCards!.cards!.hands.h, null);
  assert.deepEqual(g.nexusCards!.cards!.discard, ['ecaz']);
  assert.equal(nexusPlayer(g, 'h').ally, 'a');
  nexusInventory(g);
});

void test('malformed inventory and closing state reject all views, normalization and action without repair', () => {
  const g = closing();
  const corruptions: ((g: Game) => void)[] = [
    (x) => {
      x.nexusCards!.cards!.deck.pop();
    },
    (x) => {
      x.nexusCards!.cards!.hands.h = x.nexusCards!.cards!.deck[0];
    },
    (x) => {
      x.nexusCards!.phase!.done = ['f'];
    },
    (x) => {
      x.nexusCards!.phase!.occurred = false;
    },
    (x) => {
      x.nexusCards!.phase!.turn--;
    },
    (x) => {
      x.nexusCards!.phase = null;
    },
  ];
  for (const corrupt of corruptions) {
    const bad = nexusReload(g);
    corrupt(bad);
    const before = nexusReload(bad);
    for (const p of bad.players)
      assert.throws(() => viewGame(bad, p.id), /Nexus/);
    assert.throws(() => normalizeAutomaticGame(bad), /Nexus/);
    assert.throws(() => applyAction(bad, 'h', choice(g, 'h', 'draw')), /Nexus/);
    assert.deepEqual(bad, before);
  }
});

for (const hostFaction of ['moritani', 'ecaz'] as const)
  void test(`${hostFaction} actual accepted entry alliance forfeits a genuinely drawn card, but declaration and refusal retain it`, () => {
    // This explicit expansion roster enters the same genuine audit setup before
    // any Nexus custody exists. Base Treachery inventory remains unchanged.
    let g = nexusTurnTwo({ hostFaction });
    orderNexusSpice(g, ['worm', 'land']);
    g = alliance(negotiations(g), 'a', 'h');
    g = finishNexusSpice(g);
    top(g, 'richese');
    g = applyAction(g, 'f', choice(g, 'f', 'draw'));
    // Stage a later unused shipment, retaining the completed real phase receipt.
    // The entrant first ends its old alliance in the next genuine Nexus.
    g = enterNexusSpice(g, true);
    orderNexusSpice(g, ['worm', 'land']);
    g = negotiations(g);
    g = applyAction(g, 'a', { type: 'alliance' });
    g = finishNexusSpice(g);
    Object.assign(g, {
      phase: 5,
      active: 'a',
      order: ['a', 'f', 'h'],
      movementRemaining: ['a', 'f', 'h'],
      ready: [],
      storm: 18,
    });
    for (const p of g.players) {
      p.reserves += Object.values(p.forces).reduce((sum, n) => sum + n, 0);
      p.forces = {};
      Object.assign(p, { spice: 20, shipped: false, moved: 0 });
    }
    if (hostFaction === 'moritani') {
      const token = g.moritaniTerror!.tokens.find((t) => t.kind === 'robbery')!;
      g.moritaniTerror = placeTerror(
        g.moritaniTerror!,
        token.id,
        'arrakeen',
        g.turn,
      );
    } else {
      const token = g.ecazAmbassadors!.tokens.find((t) => t.effect === 'ecaz')!;
      g.ecazAmbassadors = placeAmbassador(g.ecazAmbassadors!, token.id, {
        turn: g.turn,
        availableSpice: 20,
        destination: {
          id: 'arrakeen',
          stronghold: true,
          inStorm: false,
          allowed: true,
        },
      }).state;
    }
    g = applyAction(g, 'a', {
      type: 'ship',
      amount: 2,
      territory: 'arrakeen',
      sector: 10,
    });
    const declare: Action =
      hostFaction === 'moritani'
        ? { type: 'decision', alliance: true }
        : {
            type: 'decision',
            event: g.pendingAmbassador!.event,
            trigger: true,
            choice: 'alliance',
            beneficiary: 'f',
          };
    g = applyAction(g, 'f', declare);
    assert.equal(g.nexusCards!.cards!.hands.f, 'richese');
    assert.equal(
      g.response,
      null,
      'empty Treachery hands need no Karama response',
    );
    const reply: Action =
      hostFaction === 'moritani'
        ? { type: 'decision', accept: true }
        : { type: 'decision', event: g.pendingAmbassador!.event, accept: true };
    const refused = applyAction(nexusReload(g), 'a', {
      ...reply,
      accept: false,
    });
    assert.equal(refused.nexusCards!.cards!.hands.f, 'richese');
    const accepted = applyAction(nexusReload(g), 'a', reply);
    assert.equal(accepted.nexusCards!.cards!.hands.f, null);
    assert.deepEqual(accepted.nexusCards!.cards!.discard, ['richese']);
    assert.equal(nexusPlayer(accepted, 'f').ally, 'a');
    assert.equal(nexusPlayer(accepted, 'a').shipped, true);
    assert.equal(accepted.pendingTerrorEntry ?? null, null);
    assert.equal(accepted.pendingAmbassador ?? null, null);
    nexusInventory(accepted);
  });
