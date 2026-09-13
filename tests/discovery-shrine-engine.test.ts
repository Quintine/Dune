import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Action,
  type Game,
} from '../game/engine';
import { baseDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { createDiscoveryState } from '../game/discoveries';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { truthFactAnswer } from '../game/truthtrance';

const aliases = registerHooks({
  resolve(specifier, context, next) {
    return next(
      specifier === 'next/link'
        ? 'vinext/shims/link'
        : specifier === 'next/image'
          ? 'vinext/shims/image'
          : specifier,
      context,
    );
  },
  load(url, context, next) {
    if (!url.endsWith('.module.css')) return next(url, context);
    const css = readFileSync(new URL(url), 'utf8');
    const classes = Object.fromEntries(
      [...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((match) => [
        match[1],
        match[1],
      ]),
    );
    return {
      format: 'module',
      source: `export default ${JSON.stringify(classes)}`,
      shortCircuit: true,
    };
  },
});
const { Truthtrance } = await import('../components/truthtrance');
const { GameTable } = await import('../components/game-table');
aliases.deregister();

const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function fixture(advanced = true) {
  const game = createGame('SHRINE01', newPlayer('a', 'Atreides', 'atreides'));
  game.players.push(
    newPlayer('e', 'Emperor', 'emperor'),
    newPlayer('g', 'Guild', 'guild'),
  );
  Object.assign(game, {
    status: 'playing',
    phase: 4,
    turn: 2,
    active: 'a',
    advanced,
    discoveryEnabled: true,
    discoveries: createDiscoveryState(() => 0),
    order: ['a', 'e', 'g'],
    deck: baseDeck(),
    response: null,
    decision: null,
    phaseOpening: null,
  });
  for (const player of game.players) {
    player.hand = [];
    player.forces = {};
    player.traitorChoices = [];
  }
  const shrine = game.discoveries!.tokens.find(
    (token) => token.face === 'shrine',
  )!;
  Object.assign(shrine, {
    status: 'placed',
    territory: 'gara_kulon',
    sector: 8,
    revealedTurn: 1,
  });
  game.players[0].forces['shrine:0'] = 1;
  game.players[0].reserves--;
  return game;
}

function hold(game: Game, player: string, effect: 'karama' | 'truthtrance') {
  const index = game.deck.findIndex((card) => card.effect === effect);
  assert.ok(index >= 0, effect);
  const card = game.deck.splice(index, 1)[0];
  game.players.find((candidate) => candidate.id === player)!.hand.push(card);
  return card;
}

function rejectUnchanged(game: Game, player: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, player, action));
  assert.deepEqual(game, before);
}

function finishPriority(state: Game) {
  let game = state;
  while (game.truthtrance?.stage === 'priority') {
    const player = game.players.find(
      (candidate) => !game.truthtrance!.passed.includes(candidate.id),
    )!;
    game = applyAction(game, player.id, { type: 'truthPass' });
  }
  return game;
}

void test('a current Shrine occupant spends physical Truthtrance through ordinary Karama cancellation, shipment and purchase paths', () => {
  for (const advanced of [false, true]) {
    const cancellation = fixture(advanced);
    const card = hold(cancellation, 'a', 'truthtrance');
    cancellation.players[1].ally = 'g';
    cancellation.players[2].ally = 'e';
    cancellation.response = {
      kind: 'emperorGift',
      owner: 'e',
      recipient: 'g',
      amount: 5,
      passed: [],
    };
    const beforeView = viewGame(cancellation, 'a');
    assert.equal(beforeView.players[0].hand![0].effect, 'truthtrance');
    assert.ok(beforeView.responseControls!.cancelCards.includes(card.id));
    assert.equal(
      truthFactAnswer(cancellation.players[0], {
        kind: 'handInventory',
        category: 'special',
        compare: 'eq',
        value: 1,
      }),
      'yes',
    );
    const canceled = applyAction(reload(cancellation), 'a', {
      type: 'card',
      card: card.id,
      mode: 'cancel',
    });
    assert.equal(canceled.response, null);
    assert.equal(canceled.pendingKarama ?? null, null);
    assert.equal(canceled.discard.at(-1)?.id, card.id);
    assert.equal(canceled.discard.at(-1)?.effect, 'truthtrance');
    assert.ok(
      canceled.log.some((entry) =>
        entry.text.includes('used Truthtrance as Karama'),
      ),
    );

    const shipment = fixture(advanced);
    const shippingCard = hold(shipment, 'a', 'truthtrance');
    shipment.phase = 5;
    const shipped = applyAction(shipment, 'a', {
      type: 'card',
      card: shippingCard.id,
      mode: 'shipment',
      target: 'a',
    });
    assert.deepEqual(shipped.karamaShipping, {
      player: 'a',
      owner: 'a',
      card: shippingCard.id,
    });
    assert.equal(shipped.discard.at(-1)?.effect, 'truthtrance');

    const purchase = fixture(advanced);
    const purchaseCard = hold(purchase, 'a', 'truthtrance');
    purchase.phase = 3;
    const lot = purchase.deck.shift()!;
    purchase.auction = {
      cards: [lot],
      index: 0,
      bid: 0,
      bidder: null,
      active: 'a',
      passed: [],
      opener: 0,
    };
    const bought = applyAction(purchase, 'a', {
      type: 'card',
      card: purchaseCard.id,
      mode: 'purchase',
    });
    assert.ok(bought.players[0].hand.some((card) => card.id === lot.id));
    assert.equal(bought.discard.at(-1)?.id, purchaseCard.id);
    assert.equal(bought.discard.at(-1)?.effect, 'truthtrance');
  }
});

void test('hidden Shrine, nonoccupants, advisors, and departed occupants cannot start a converted use', () => {
  const cases: [string, (game: Game) => void][] = [
    ['hidden', (game: Game) => {
      game.discoveries!.tokens.find((token) => token.face === 'shrine')!.revealedTurn =
        null;
    }],
    ['departed', (game: Game) => {
      game.players[0].forces = {};
    }],
    ['advisor', (game: Game) => {
      game.players[0].faction = 'beneGesserit';
      game.players[0].advisors = { shrine: {} };
      game.players[1].forces['shrine:0'] = 1;
      game.players[1].reserves--;
    }],
  ];
  for (const [label, alter] of cases) {
    const game = fixture();
    const card = hold(game, 'a', 'truthtrance');
    alter(game);
    game.players[1].ally = 'g';
    game.players[2].ally = 'e';
    game.response = {
      kind: 'emperorGift',
      owner: 'e',
      recipient: 'g',
      amount: 5,
      passed: [],
    };
    assert.ok(
      !viewGame(game, 'a').responseControls!.cancelCards.includes(card.id),
      label,
    );
    rejectUnchanged(game, 'a', {
      type: 'card',
      card: card.id,
      mode: 'cancel',
    });
  }
});

void test('a physical card reserved for a pending Richese gift cannot also enter the Truthtrance queue', () => {
  let game = fixture();
  const owner = game.players[0];
  owner.faction = 'richese';
  owner.ally = 'e';
  game.players[1].ally = owner.id;
  const karama = richeseCards().find((card) => card.effect === 'karama')!;
  owner.hand = [karama];
  hold(game, 'g', 'karama');
  game = applyAction(game, owner.id, { type: 'richeseGift', card: karama.id });
  assert.equal(game.pendingRicheseGift?.intent.cardId, karama.id);
  rejectUnchanged(game, owner.id, {
    type: 'card',
    card: karama.id,
    shrineTruthtrance: [karama.id],
  });
});

void test('a Shrine occupant can spend physical Truthtrance on an implemented special Karama power', () => {
  const game = fixture();
  const emperor = game.players[0];
  emperor.faction = 'emperor';
  emperor.hand = [];
  emperor.tanks = 3;
  emperor.reserves = 17;
  const truthtrance = hold(game, emperor.id, 'truthtrance');
  const markup = renderToStaticMarkup(
    createElement(GameTable, {
      game: viewGame(game, emperor.id),
      send: async () => {},
      onExit() {},
      busy: false,
    }),
  );
  assert.match(markup, /Use special Karama · forces/);
  const done = applyAction(game, emperor.id, {
    type: 'card',
    mode: 'special',
    card: truthtrance.id,
    amount: 3,
    elite: 0,
  });
  assert.equal(done.players[0].specialKaramaUsed, true);
  assert.equal(done.players[0].tanks, 0);
  assert.equal(done.players[0].reserves, 20);
  assert.equal(done.discard.at(-1)?.id, truthtrance.id);
  assert.equal(done.discard.at(-1)?.effect, 'truthtrance');
  assert.ok(
    done.log.some((entry) =>
      entry.text.includes('physical Truthtrance as Karama'),
    ),
  );
});

void test('Karama committed as Truthtrance keeps its Shrine receipt through JSON, departure, answer, and discard continuation', () => {
  let game = fixture();
  const karama = hold(game, 'a', 'karama');
  hold(game, 'e', 'truthtrance');
  game.players[1].ally = 'g';
  game.players[2].ally = 'e';
  const suspended = {
    kind: 'emperorGift' as const,
    owner: 'e',
    recipient: 'g',
    amount: 5,
    passed: [] as string[],
  };
  game.response = suspended;
  game = applyAction(game, 'a', {
    type: 'card',
    card: karama.id,
    shrineTruthtrance: [karama.id],
  });
  assert.deepEqual(game.truthtrance!.queue[0], {
    player: 'a',
    card: karama.id,
    source: 'shrine',
  });
  const pending = reload(game);
  assert.deepEqual(pending.response, suspended);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), pending);
  pending.players[0].forces = { 'arrakeen:10': 1 };
  game = finishPriority(pending);
  game = applyAction(game, 'a', {
    type: 'truthAsk',
    question: {
      kind: 'fact',
      target: 'e',
      fact: { kind: 'hand', name: 'Truthtrance' },
    },
  });
  assert.deepEqual(game.response, suspended);
  assert.equal(viewGame(reload(game), 'e').truthAnswer, 'yes');
  game = applyAction(reload(game), 'e', {
    type: 'truthAnswer',
    answer: 'yes',
  });
  assert.equal(game.truthtrance, null);
  assert.equal(game.truthHistory!.at(-1)?.answer, 'yes');
  assert.equal(game.discard.at(-1)?.id, karama.id);
  assert.equal(game.discard.at(-1)?.effect, 'karama');

  const forged = reload(pending);
  delete forged.truthtrance!.queue[0].source;
  assert.throws(() => viewGame(forged, 'a'), /committed physical card/);
});

void test('an unknown converted question may save the same Karama, but departure revokes a fresh conversion', () => {
  let game = fixture();
  const karama = hold(game, 'a', 'karama');
  game = finishPriority(
    applyAction(game, 'a', {
      type: 'card',
      card: karama.id,
      shrineTruthtrance: [karama.id],
    }),
  );
  game = applyAction(game, 'a', {
    type: 'truthAsk',
    question: {
      kind: 'freeform',
      target: 'e',
      text: 'Will the next battle be won by a traitor?',
      scope: 'currentTurn',
    },
  });
  game = applyAction(game, 'e', { type: 'truthAnswer', answer: 'unknown' });
  game = applyAction(reload(game), 'a', { type: 'truthSave' });
  assert.equal(game.truthtrance, null);
  assert.equal(game.players[0].hand[0].id, karama.id);
  game.players[0].forces = {};
  rejectUnchanged(game, 'a', {
    type: 'card',
    card: karama.id,
    shrineTruthtrance: [karama.id],
  });
});

void test('all four AI profiles use the converted Truthtrance control and complete the existing question path', () => {
  for (const difficulty of DIFFICULTIES) {
    let game = fixture();
    const karama = hold(game, 'a', 'karama');
    game.phase = 6;
    game.battle = {
      territory: 'arrakeen',
      attacker: 'a',
      defender: 'e',
      prepared: true,
      plans: {},
      revealed: false,
      traitorCalls: {},
    };
    for (const player of game.players) player.bot = difficulty;
    const action = botActions(viewGame(game, 'a'))[0];
    assert.deepEqual(action, {
      type: 'card',
      card: karama.id,
      shrineTruthtrance: [karama.id],
    });
    game = applyAction(game, 'a', action);
    while (game.truthtrance?.stage === 'priority') {
      const next = game.players.find(
        (player) => !game.truthtrance!.passed.includes(player.id),
      )!;
      const pass = botActions(viewGame(game, next.id))[0];
      assert.deepEqual(pass, { type: 'truthPass' });
      game = applyAction(game, next.id, pass);
    }
    const question = botActions(viewGame(game, 'a'))[0];
    assert.equal(question.type, 'truthAsk');
    game = applyAction(game, 'a', question);
    const target = game.truthtrance!.question!.target;
    game.players.find((player) => player.id === target)!.bot = difficulty;
    const answer = botActions(viewGame(game, target))[0];
    assert.equal(answer.type, 'truthAnswer');
    game = applyAction(game, target, answer);
    assert.equal(game.truthtrance, null);
    assert.equal(game.discard.at(-1)?.id, karama.id);
  }
});

void test('Truthtrance priority renders the owner conversion without exposing another hand', () => {
  let game = fixture();
  const initiator = hold(game, 'a', 'truthtrance');
  const karama = hold(game, 'e', 'karama');
  const truthtrance = hold(game, 'e', 'truthtrance');
  game.players[1].forces['shrine:0'] = 1;
  game.players[1].reserves--;
  game = applyAction(game, 'a', { type: 'card', card: initiator.id });
  const view = viewGame(game, 'e');
  const markup = renderToStaticMarkup(
    createElement(Truthtrance, { game: view, busy: false, act() {} }),
  );
  assert.match(markup, /Use my Karama as Truthtrance/);
  assert.match(markup, /Declare my Truthtrance/);
  assert.match(markup, /Declare all 2 as Truthtrance/);
  assert.deepEqual(
    view.players[1].hand!.map((card) => card.id),
    [karama.id, truthtrance.id],
  );
  assert.equal(view.players[0].hand, undefined);
});
