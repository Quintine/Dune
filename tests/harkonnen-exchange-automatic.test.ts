import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, initializeBaseGameForAudit, joinGame, newPlayer,
  normalizeAutomaticGame, viewGame, type Action, type Game,
} from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
const player = (game: Game, id: string) => game.players.find(candidate => candidate.id === id)!;
const inventory = (game: Game) => [
  ...game.deck, ...game.discard, ...game.players.flatMap(candidate => candidate.hand),
  ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? []),
].map(card => card.id).sort();
function act(game: Game, owner: string, action: Action) {
  const before = structuredClone(game), cards = inventory(game);
  const next = reload(applyAction(game, owner, action));
  assert.deepEqual(game, before);
  assert.deepEqual(inventory(next), cards);
  assert.equal(new Set(cards).size, cards.length);
  return next;
}
function hold(game: Game, owner: string, kind: string) {
  const index = game.deck.findIndex(card => card.effect === kind || card.kind === kind);
  assert.ok(index >= 0, kind);
  const card = game.deck.splice(index, 1)[0];
  player(game, owner).hand.push(card);
  return card.id;
}
/** Genuine Advanced setup followed by a conserved later Bidding position. */
function fixture(extra: string[] = [], count = 4) {
  let game = createGame('HARKAUTO', newPlayer('h', 'Harkonnen', 'harkonnen'), true);
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  game = initializeBaseGameForAudit(game);
  for (const p of game.players)
    if (player(game, p.id).traitorChoices.length)
      game = applyAction(game, p.id, { type: 'traitor', leader: player(game, p.id).traitorChoices[0] });
  assert.equal(game.status, 'playing');
  Object.assign(game, { phase: 3, active: 'e', storm: 18, phaseOpening: null,
    response: null, decision: null, ready: [] });
  for (const p of game.players) {
    game.deck.push(...p.hand); p.hand = []; p.spice = 20;
  }
  const karama = hold(game, 'h', 'karama');
  const blocker = hold(game, 'g', 'karama');
  const extras = extra.map(kind => hold(game, 'h', kind));
  for (let index = 0; index < count; index++) hold(game, 'e', index % 2 ? 'poison' : 'projectile');
  game.auction = { cards: [game.deck.shift()!], index: 0, bid: 0, bidder: null,
    active: 'e', passed: [], opener: game.order.indexOf('e') };
  assert.equal(inventory(game).length, 33);
  return { game, karama, blocker, extras };
}
const exchange = (game: Game, karama: string, amount: number) =>
  act(game, 'h', { type: 'card', mode: 'special', card: karama, target: 'e', amount });
const exchangeNotices = (game: Game) => game.log.filter(entry => entry.automatic?.name === 'Harkonnen exchange');
function stable(game: Game) {
  assert.deepEqual(reload(normalizeAutomaticGame(reload(game))), game);
  assert.equal(new Set(inventory(game)).size, inventory(game).length);
}
function privateInspection(game: Game) {
  assert.ok(game.harkonnenExchangeInspection);
  const { signature, ...inspection } = game.harkonnenExchangeInspection;
  assert.equal(typeof signature, 'string');
  assert.ok(signature.length);
  assert.deepEqual(viewGame(game, 'h').harkonnenExchangeInspection, inspection);
  for (const id of ['e', 'g']) {
    const view = viewGame(game, id);
    assert.equal(view.harkonnenExchangeInspection, null);
    assert.equal(view.players.find(p => p.id === 'h')!.hand, undefined);
    assert.equal('pendingExchange' in view, false);
  }
  for (const card of game.harkonnenExchangeInspection.cards)
    for (const entry of game.log.filter(line => /unseen cards|returned .*cards/.test(line.text))) {
      assert.equal(entry.text.includes(card.id), false);
      assert.equal(entry.text.includes(card.name), false);
    }
}
function reject(game: Game, owner: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, owner, action));
  assert.deepEqual(game, before);
}
function rejectSaved(game: Game) {
  const before = structuredClone(game);
  for (const check of [
    () => applyAction(game, 'h', { type: 'advanceBots' }),
    () => normalizeAutomaticGame(game),
    () => viewGame(game, 'h'),
    () => viewGame(game, 'g'),
  ]) { assert.throws(check); assert.deepEqual(game, before); }
}

void test('one to four forced cards return automatically and their actual blind draw remains private after JSON restore', t => {
  for (const count of [1, 2, 3, 4]) {
    const { game, karama } = fixture([], count);
    const target = player(game, 'e').hand.map(card => card.id).sort();
    const done = exchange(game, karama, count);
    assert.equal(done.pendingExchange, null);
    assert.equal(done.decision, null);
    assert.equal(player(done, 'h').hand.length, 0);
    assert.deepEqual(player(done, 'e').hand.map(card => card.id).sort(), target);
    assert.equal(done.discard.filter(card => card.id === karama).length, 1);
    assert.deepEqual(done.harkonnenExchangeInspection, {
      owner: 'h', target: 'e', turn: game.turn, phase: 3, kind: 'draw',
      cards: done.harkonnenExchangeInspection!.cards,
      signature: done.harkonnenExchangeInspection!.signature,
    });
    assert.deepEqual(done.harkonnenExchangeInspection!.cards.map(card => card.id).sort(), target);
    assert.deepEqual(exchangeNotices(done).map(entry => entry.automatic), [{ faction: 'harkonnen', name: 'Harkonnen exchange' }]);
    privateInspection(done);
    const ownView = viewGame(done, 'h');
    ownView.harkonnenExchangeInspection!.cards[0].name = 'Changed view copy';
    assert.notEqual(done.harkonnenExchangeInspection!.cards[0].name, 'Changed view copy');
    const noDraw = t.mock.method(globalThis.crypto, 'getRandomValues', () => { throw new Error('A saved exchange must not draw again.'); });
    stable(done);
    privateInspection(reload(done));
    noDraw.mock.restore();
    const later = reload(done);
    later.turn++; later.phase = 4; later.auction = null;
    later.deck.push(...done.auction!.cards);
    later.discard.push(player(later, 'e').hand.shift()!);
    assert.deepEqual(later.harkonnenExchangeInspection, done.harkonnenExchangeInspection,
      'Historical knowledge does not freeze a card in the hand it returned to.');
    privateInspection(later);
    stable(later);
  }
});

void test('a real partial draw keeps the return choice and its inspection records drawn cards rather than selected returns', () => {
  const { game, karama, extras } = fixture(['shield', 'snooper']);
  const pending = exchange(game, karama, 2);
  assert.equal(pending.decision?.kind, 'handExchange');
  assert.equal(player(pending, 'h').hand.length, 4);
  assert.equal(player(pending, 'e').hand.length, 2);
  assert.equal(exchangeNotices(pending).length, 0);
  const inspection = structuredClone(pending.harkonnenExchangeInspection!);
  assert.ok(inspection.cards.every(card => player(game, 'e').hand.some(original => original.id === card.id)));
  privateInspection(pending);
  stable(pending);
  reject(pending, 'e', { type: 'decision', returnCards: extras });
  reject(pending, 'h', { type: 'decision', returnCards: [extras[0], extras[0]] });
  const done = act(pending, 'h', { type: 'decision', returnCards: [extras[0], inspection.cards[0].id] });
  assert.equal(done.pendingExchange, null);
  assert.deepEqual(done.harkonnenExchangeInspection, inspection);
  assert.equal(exchangeNotices(done).length, 1);
  assert.equal(exchangeNotices(done)[0].text.includes('automatically'), false);
  privateInspection(done);
  stable(done);
});

void test('automatic return restores a real private gift response with its prior passes and spends its income only once', () => {
  const fixtureState = fixture([], 2);
  let game = fixtureState.game;
  player(game, 'e').ally = 'h'; player(game, 'h').ally = 'e';
  game = act(game, 'e', { type: 'emperorGift', amount: 7 });
  game = act(game, 'h', { type: 'passResponse' });
  const saved = structuredClone(game.response);
  assert.equal(saved?.kind, 'emperorGift');
  const done = exchange(game, fixtureState.karama, 2);
  assert.deepEqual(done.response, saved);
  assert.equal(player(done, 'h').spice, 20);
  assert.equal(viewGame(done, 'g').response!.amount, undefined);
  assert.equal(exchangeNotices(done).length, 1);
  privateInspection(done);
  stable(done);
  const paid = act(done, 'g', { type: 'passResponse' });
  assert.equal(player(paid, 'h').spice, 27);
  assert.equal(player(paid, 'e').spice, 13);
  assert.equal(exchangeNotices(paid).length, 1);
  stable(paid);
  const canceled = act(done, 'g', { type: 'card', mode: 'cancel', card: fixtureState.blocker });
  assert.equal(player(canceled, 'h').spice, 20);
  assert.equal(player(canceled, 'e').spice, 20);
  assert.equal(exchangeNotices(canceled).length, 1);
  stable(canceled);
});

void test('automatic return restores an actually won unfunded auction payment after giving its Karama back', () => {
  const fixtureState = fixture([], 1);
  let game = fixtureState.game;
  const [targetCard] = player(game, 'e').hand.splice(0);
  game.deck.push(targetCard);
  player(game, 'e').hand.push(player(game, 'g').hand.splice(0)[0]);
  player(game, 'e').spice = 0;
  game = act(game, 'e', { type: 'bid', amount: 30 });
  for (let step = 0; game.auction?.active && !game.decision && step < 8; step++)
    game = act(game, game.auction.active, { type: 'passBid' });
  assert.deepEqual(game.decision, { kind: 'auctionPayment', player: 'e' });
  const auction = structuredClone(game.auction);
  const done = exchange(game, fixtureState.karama, 1);
  assert.deepEqual(done.decision, game.decision);
  assert.deepEqual(done.auction, auction);
  assert.equal(player(done, 'e').hand[0].effect, 'karama');
  assert.equal(exchangeNotices(done).length, 1);
  stable(done);
});

void test('Truthtrance keeps priority when its spend makes a real pending exchange forced, then the return finishes once', () => {
  const { game, karama, extras } = fixture(['truthtrance'], 2);
  let pending = exchange(game, karama, 2);
  const inspection = structuredClone(pending.harkonnenExchangeInspection);
  pending = act(pending, 'h', { type: 'card', card: extras[0] });
  assert.equal(player(pending, 'h').hand.length, 3, 'The committed Truthtrance stays physically held until its answer completes.');
  assert.ok(pending.truthtrance);
  assert.equal(pending.decision?.kind, 'handExchange');
  assert.equal(exchangeNotices(pending).length, 0);
  stable(pending);
  privateInspection(pending);
  reject(pending, 'h', { type: 'decision', returnCards: player(pending, 'h').hand.map(card => card.id) });
  for (let step = 0; pending.truthtrance?.stage === 'priority' && step < 8; step++) {
    const voter = pending.players.find(p => !pending.truthtrance!.passed.includes(p.id))!;
    pending = act(pending, voter.id, { type: 'truthPass' });
  }
  pending = act(pending, 'h', { type: 'truthAsk', question: { kind: 'fact', target: 'e',
    fact: { kind: 'spice', compare: 'eq', value: 20 } } });
  assert.equal(exchangeNotices(pending).length, 0);
  const done = act(pending, 'e', { type: 'truthAnswer', answer: 'yes' });
  assert.equal(done.truthtrance, null);
  assert.equal(done.pendingExchange, null);
  assert.deepEqual(done.harkonnenExchangeInspection, inspection);
  assert.equal(exchangeNotices(done).length, 1);
  assert.equal(done.discard.filter(card => card.id === extras[0]).length, 1);
  stable(done);
});

void test('a legacy forced save records the known returned hand without claiming to reconstruct its original blind draw', t => {
  const { game, karama, extras } = fixture(['shield'], 2);
  const legacy = exchange(game, karama, 2);
  // Conserved old saved position: only the mandatory return remains, with no historical inspection field.
  const other = player(legacy, 'h').hand.find(card => card.id === extras[0])!;
  player(legacy, 'h').hand = player(legacy, 'h').hand.filter(card => card.id !== other.id);
  legacy.deck.push(other);
  delete legacy.harkonnenExchangeInspection;
  const known = structuredClone(player(legacy, 'h').hand);
  const before = structuredClone(legacy);
  t.mock.method(globalThis.crypto, 'getRandomValues', () => { throw new Error('Legacy return must not reroll the draw.'); });
  const done = reload(normalizeAutomaticGame(legacy));
  assert.deepEqual(legacy, before);
  assert.deepEqual(done.harkonnenExchangeInspection, {
    owner: 'h', target: 'e', turn: game.turn, phase: 3, kind: 'return', cards: known,
    signature: done.harkonnenExchangeInspection!.signature,
  });
  assert.deepEqual(inventory(done), inventory(legacy));
  assert.equal(done.pendingExchange, null);
  assert.equal(exchangeNotices(done).length, 1);
  privateInspection(done);
  stable(done);
});

void test('all four legal AI paths retain real choices and can continue after an automatic forced return', () => {
  for (const difficulty of DIFFICULTIES) {
    const f = fixture(['shield'], 2);
    player(f.game, 'h').bot = difficulty;
    const pending = exchange(f.game, f.karama, 2);
    const actions = botActions(viewGame(pending, 'h'));
    assert.equal(actions.length, 1);
    assert.equal(actions[0].type, 'decision');
    assert.equal(act(pending, 'h', actions[0]).pendingExchange, null);
    const forced = fixture([], 2);
    player(forced.game, 'e').bot = difficulty;
    const done = exchange(forced.game, forced.karama, 2);
    const next = botActions(viewGame(done, 'e'));
    assert.ok(next.length);
    assert.ok(next.every(action => action.type !== 'decision'));
    act(done, 'e', next[0]);
  }
});

void test('malformed saved counts, custody, inspection and continuation reject actions, views and normalization immutably', () => {
  const f = fixture(['shield'], 2);
  const pending = exchange(f.game, f.karama, 2);
  const changes: ((game: Game) => void)[] = [
    game => { if (game.decision?.kind === 'handExchange') game.decision.count = 0; },
    game => { if (game.decision?.kind === 'handExchange') game.decision.count = 1.5; },
    game => { if (game.decision?.kind === 'handExchange') game.decision.count = 1; },
    game => { if (game.decision?.kind === 'handExchange') game.decision.target = 'h'; },
    game => { if (game.decision?.kind === 'handExchange') game.decision.player = 'e'; },
    game => { game.pendingExchange = null; },
    game => { game.pendingExchange!.decision = structuredClone(game.decision); },
    game => { delete (game.pendingExchange as Partial<NonNullable<Game['pendingExchange']>>).response; },
    game => { game.decision = null; },
    game => { game.phase = 4; },
    game => { game.turn++; },
    game => { player(game, 'h').specialKaramaUsed = false; },
    game => { player(game, 'h').hand.push(structuredClone(player(game, 'h').hand[0])); },
    game => { game.deck.push(structuredClone(player(game, 'e').hand[0])); },
    game => { game.harkonnenExchangeInspection!.owner = 'e'; },
    game => { game.harkonnenExchangeInspection!.target = 'g'; },
    game => { game.harkonnenExchangeInspection!.cards[0].name = 'Invented'; },
    game => { game.harkonnenExchangeInspection!.cards[1] = structuredClone(game.harkonnenExchangeInspection!.cards[0]); },
  ];
  for (const change of changes) { const malformed = reload(pending); change(malformed); rejectSaved(malformed); }
  const duplicateDraw = fixture([], 2);
  player(duplicateDraw.game, 'e').hand.push(structuredClone(player(duplicateDraw.game, 'e').hand[0]));
  reject(duplicateDraw.game, 'h', { type: 'card', mode: 'special', card: duplicateDraw.karama, target: 'e', amount: 1 });
});

void test('completed inspection binds its original canonical faces, order, target, turn and draw provenance', () => {
  const f = fixture([], 2);
  const completed = exchange(f.game, f.karama, 2);
  completed.turn++;
  stable(completed);
  const changes: ((game: Game) => void)[] = [
    game => { game.harkonnenExchangeInspection!.cards[0] = structuredClone(game.deck[0]); },
    game => { game.harkonnenExchangeInspection!.cards.reverse(); },
    game => { game.harkonnenExchangeInspection!.target = 'g'; },
    game => { game.harkonnenExchangeInspection!.turn = game.turn; },
    game => { game.harkonnenExchangeInspection!.kind = 'return'; },
    game => { game.harkonnenExchangeInspection!.signature += 'changed'; },
    game => { delete (game.harkonnenExchangeInspection as Partial<NonNullable<Game['harkonnenExchangeInspection']>>).signature; },
  ];
  for (const change of changes) {
    const malformed = reload(completed);
    change(malformed);
    assert.deepEqual(inventory(malformed), inventory(completed), 'Only the historical knowledge payload changed.');
    rejectSaved(malformed);
  }
  privateInspection(completed);
});
