import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, initializeNexusKullGameForAudit, joinGame, newPlayer, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { createNexusChoamKullFixture, createNexusKullNativeParent, createNexusKullNestedParent,
  createNexusKullAuctionParent } from './fixture-nexus-choam-kull';
import { choamKullGame, kullShipmentAttempt, takeKullCard } from './fixture-choam-kull';
import { spiceDeck } from '../game/cards';
import { createNexusCardPhase } from '../game/nexus-card-phase';

const reload = (game: Game): Game => JSON.parse(JSON.stringify(game));
const held = (game: Game, owner: string, card: string) => game.players.find(p => p.id === owner)!.hand.some(c => c.id === card);
function inventory(game: Game) {
  return [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.auction?.cards.slice(game.auction.index) ?? [])].map(card => card.id).sort();
}
function finish(game: Game): Game {
  for (let step = 0; game.pendingKull && step < 20; step++) {
    const responder = game.players.find(p => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    game = responder ? applyAction(reload(game), responder.id, { type: 'passResponse' }) : normalizeAutomaticGame(reload(game));
  }
  assert.equal(game.pendingKull, null);
  return game;
}
function reject(game: Game, owner: string, action: Action) {
  const before = JSON.stringify(game);
  assert.throws(() => applyAction(game, owner, action));
  assert.equal(JSON.stringify(game), before);
}

void test('fresh admission accepts exactly native classic CHOAM, physical CHOAM/Ix and only Nexus', () => {
  const lobby = () => {
    const game = createGame('NXKULL01', newPlayer('c', 'CHOAM', 'choam'), false, ['choam', 'ix']);
    joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
    for (const p of game.players) p.ready = true;
    game.nexusCards = { cards: null, phase: null };
    return game;
  };
  const valid = lobby(), before = JSON.stringify(valid);
  const initialized = initializeNexusKullGameForAudit(valid);
  assert.equal(JSON.stringify(valid), before);
  assert.equal(initialized.kullPreview, true);
  assert.equal(initialized.nexusKullPreview, true);
  assert.ok(initialized.deck.some(card => card.id === 'ix-kull-wahad'));
  assert.deepEqual(initialized.spiceDeck.map(card => JSON.stringify(card)).sort(),
    spiceDeck().map(card => JSON.stringify(card)).sort());
  assert.equal(initialized.spiceDeck.some(card => 'sandtrout' in card), false);
  for (const corrupt of [
    (g: Game) => { g.expansions = ['choam']; },
    (g: Game) => { g.nexusCards = undefined; },
    (g: Game) => { g.players[1] = newPlayer('e', 'Richese', 'richese'); g.players[1].ready = true; },
    (g: Game) => { g.semutaPreview = true; },
    (g: Game) => { g.kullSequence = 1; },
    (g: Game) => { g.turn = 2; },
    (g: Game) => { g.response = { kind: 'eliteStrength', owner: 'e', passed: [] }; },
    (g: Game) => { g.sandtrout = true; },
    (g: Game) => { g.discoveryEnabled = true; },
  ]) {
    const game = lobby(); corrupt(game);
    const saved = JSON.stringify(game);
    assert.throws(() => initializeNexusKullGameForAudit(game));
    assert.equal(JSON.stringify(game), saved);
  }
});

for (const advanced of [false, true]) for (const fuel of ['karama', 'worthless', 'weapon'] as const)
  void test(`Nexus Kull succeeds once with ${fuel} fuel in ${advanced ? 'Advanced' : 'Basic'}`, () => {
    const f = createNexusChoamKullFixture({ advanced, fuel });
    const physical = inventory(f.game);
    const declared = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, source: 'nexus', card: f.fuel });
    assert.equal(held(declared, f.choam, f.fuel), f.counter !== null);
    assert.ok(held(declared, f.actor, f.original));
    assert.equal(declared.nexusCards!.cards!.hands[f.choam], null);
    assert.equal(declared.nexusChoamHistory!.at(-1)!.stage, f.counter ? 'pending' : 'complete');
    const done = finish(declared);
    assert.deepEqual(inventory(done), physical);
    assert.ok(held(done, f.actor, f.original));
    assert.equal(held(done, f.choam, f.fuel), false);
    assert.equal(done.discard.filter(card => card.id === f.fuel).length, 1);
    assert.equal(done.nexusCards!.cards!.discard.filter(face => face === 'choam').length, 1);
    assert.equal(done.nexusChoamHistory!.at(-1)!.stage, 'complete');
    assert.equal(done.karamaShipping, null);
    reject(done, f.actor, { type: 'card', mode: 'shipment', card: f.original, target: f.actor });
    reject(done, f.choam, { type: 'kullDecision', event: f.event, source: 'nexus', card: f.fuel });
  });

void test('distinct prevention retains fuel, spends accepted Nexus, and resumes original exactly once', () => {
  const f = createNexusChoamKullFixture({ fuel: 'weapon' });
  const declared = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, source: 'nexus', card: f.fuel });
  reject(declared, f.actor, { type: 'card', mode: 'cancel', card: f.original });
  const done = applyAction(reload(declared), f.other!, { type: 'card', mode: 'cancel', card: f.counter! });
  assert.equal(done.pendingKull, null);
  assert.ok(held(done, f.choam, f.fuel));
  assert.equal(done.discard.filter(card => card.id === f.original).length, 1);
  assert.equal(done.discard.filter(card => card.id === f.counter).length, 1);
  assert.deepEqual(done.karamaShipping, { player: f.actor, owner: f.actor, card: f.original });
  assert.equal(done.nexusChoamHistory!.at(-1)!.stage, 'canceled');
  assert.equal(done.nexusCards!.cards!.discard.filter(face => face === 'choam').length, 1);
  assert.equal(viewGame(done, f.actor).karamaBlocked, null);
  reject(done, f.other!, { type: 'card', mode: 'cancel', card: f.counter! });
});

void test('BG interception precedes conversion; successful Kull keeps original while decline converts once', () => {
  const f = createNexusChoamKullFixture({ bg: true, fuel: 'worthless' });
  assert.equal(f.game.pendingKarama, null);
  assert.ok(held(f.game, f.actor, f.original));
  const success = finish(applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, source: 'nexus', card: f.fuel }));
  assert.ok(held(success, f.actor, f.original));
  assert.equal(success.pendingKarama, null);
  const decline = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, decline: true });
  assert.equal(decline.response?.kind, 'worthlessKarama');
  assert.equal(decline.discard.filter(card => card.id === f.original).length, 1);
  assert.equal(decline.nexusCards!.cards!.hands[f.choam], 'choam');
  assert.equal(decline.nexusChoamHistory, undefined);
});

void test('source-required actions reject foreign, stale, malformed and source aliases immutably', () => {
  const f = createNexusChoamKullFixture();
  for (const action of [
    { type: 'kullDecision', event: f.event, card: f.fuel },
    { type: 'kullDecision', event: f.event, source: 'printed', card: f.fuel },
    { type: 'kullDecision', event: f.event, source: 'nexus', card: f.original },
    { type: 'kullDecision', event: 'stale', source: 'nexus', card: f.fuel },
    { type: 'kullDecision', event: f.event, decline: true, source: 'nexus' },
    { type: 'kullDecision', event: f.event, source: 'nexus', card: f.fuel, effect: 'kull' },
  ]) reject(f.game, f.choam, action);
  reject(f.game, f.actor, { type: 'kullDecision', event: f.event, source: 'nexus', card: f.fuel });
});

void test('offer timing and other-player views are independent of hidden Nexus face and costs', () => {
  const f = createNexusChoamKullFixture();
  const other = reload(f.game);
  const cards = other.nexusCards!.cards!;
  const richeseHolder = other.players.find(p => cards.hands[p.id] === 'richese');
  if (richeseHolder) cards.hands[richeseHolder.id] = 'choam';
  else { const index = cards.deck.indexOf('richese'); cards.deck[index] = 'choam'; }
  cards.hands[f.choam] = 'richese';
  for (const viewer of [f.actor, f.other!]) {
    assert.deepEqual(viewGame(f.game, viewer), viewGame(other, viewer));
    assert.deepEqual(viewGame(f.game, viewer).kullReaction!.plays, []);
  }
  // Change hidden fuel availability without changing the public draw-pile size.
  // Only the third seat compares this transfer: the recipient knows its own hand.
  other.players.find(p => p.id === f.actor)!.hand.push(...other.players.find(p => p.id === f.choam)!.hand.splice(0));
  assert.deepEqual(inventory(other), inventory(f.game));
  assert.deepEqual(viewGame(f.game, f.other!), viewGame(other, f.other!));
  assert.deepEqual(viewGame(other, f.choam).kullReaction!.plays, []);
  assert.deepEqual(viewGame(f.game, f.choam).kullReaction!.plays.map(play => [play.source, play.card.id]), [['nexus', f.fuel]]);
});

void test('printed choice in new profile does not spend Nexus and cannot alias another printed cost', () => {
  const f = createNexusChoamKullFixture();
  const original = reload(f.game);
  original.players[0].hand.push(takeKullCard(original, 'ix-kull-wahad'));
  const declared = applyAction(original, f.choam, { type: 'kullDecision', event: f.event, source: 'printed', card: 'ix-kull-wahad' });
  const done = finish(declared);
  assert.equal(done.nexusCards!.cards!.hands[f.choam], 'choam');
  assert.equal(done.nexusChoamHistory, undefined);
  assert.ok(held(done, f.choam, f.fuel));
  assert.equal(done.discard.filter(card => card.id === 'ix-kull-wahad').length, 1);
});

void test('deleted source, receipt, history, cost and original frame reject before projection or automatic settlement', () => {
  const f = createNexusChoamKullFixture();
  const declared = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, source: 'nexus', card: f.fuel });
  for (const corrupt of [
    (g: Game) => { delete g.pendingKull!.selection; },
    (g: Game) => { delete g.pendingKull; },
    (g: Game) => { delete g.nexusChoamHistory; },
    (g: Game) => { delete g.pendingChoamWorthless!.nexusEvent; },
    (g: Game) => { g.players[0].hand = []; },
    (g: Game) => { g.players[1].hand = []; },
    (g: Game) => { g.pendingKull!.resume.response = { kind: 'eliteStrength', owner: f.actor, passed: [] }; },
  ]) {
    const game = reload(declared); corrupt(game);
    const before = JSON.stringify(game);
    assert.throws(() => viewGame(game, f.other!));
    assert.throws(() => normalizeAutomaticGame(game));
    reject(game, f.other!, { type: 'passResponse' });
    assert.equal(JSON.stringify(game), before);
  }
});

void test('Nexus Kull reserves a suspended printed parent cost and restores that exact response after success', () => {
  const f = createNexusChoamKullFixture();
  let game = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, decline: true });
  const original = takeKullCard(game, f.original);
  game.players[1].hand.push(original);
  const fuel = takeKullCard(game, 'ix-hunter-seeker');
  game.players[0].hand.push(fuel);
  Object.assign(game, { phase: 4, karamaShipping: null });
  game = applyAction(game, f.choam, { type: 'card', mode: 'choam', card: f.fuel, target: f.actor });
  const response = reload(game).response;
  const offered = applyAction(game, f.actor, { type: 'card', mode: 'cancel', card: original.id });
  const event = offered.pendingKull!.event;
  assert.equal(viewGame(offered, f.choam).kullReaction!.plays.some(play => play.card.id === f.fuel), false);
  reject(offered, f.choam, { type: 'kullDecision', event, source: 'nexus', card: f.fuel });
  const done = finish(applyAction(offered, f.choam, { type: 'kullDecision', event, source: 'nexus', card: fuel.id }));
  assert.deepEqual(done.response, response);
  assert.equal(done.pendingChoamWorthless!.card, f.fuel);
  assert.ok(held(done, f.choam, f.fuel));
  assert.ok(held(done, f.actor, original.id));
  assert.equal(done.nexusChoamHistory!.at(-1)!.stage, 'complete');
});

void test('printed Kull discovers a suspended Nexus parent through direct and BG counter overlays', () => {
  const f = createNexusChoamKullFixture({ bg: true });
  let game = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, decline: true });
  for (let step = 0; game.response?.kind === 'worthlessKarama' && step < 20; step++) {
    const p = game.players.find(p => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    game = p ? applyAction(game, p.id, { type: 'passResponse' }) : normalizeAutomaticGame(game);
  }
  game.players[1].hand.push(takeKullCard(game, f.original));
  game.players[0].hand.push(takeKullCard(game, 'ix-kull-wahad'));
  const bgCounter = takeKullCard(game, 'Jubba Cloak');
  game.players[1].hand.push(bgCounter);
  Object.assign(game, { phase: 4, karamaShipping: null });
  const play = viewGame(game, f.choam).choamWorthless!.plays.find(play =>
    play.source === 'nexus' && play.effect === 'laLaLa' && play.card.id === f.fuel);
  assert.ok(play && 'event' in play);
  const nexusEvent = play.event;
  const parent = applyAction(game, f.choam, { type: 'card', mode: 'choam', card: f.fuel, nexus: nexusEvent, effect: 'laLaLa', target: f.actor });
  const offered = applyAction(parent, f.actor, { type: 'card', mode: 'cancel', card: f.original });
  const declaration = applyAction(offered, f.choam, { type: 'kullDecision', event: offered.pendingKull!.event, source: 'printed', card: 'ix-kull-wahad' });
  assert.equal(declaration.nexusChoamHistory!.at(-1)!.stage, 'pending');
  assert.equal(viewGame(declaration, f.actor).response?.kind, 'choamWorthless');
  const converted = applyAction(declaration, f.actor, { type: 'card', mode: 'cancel', card: bgCounter.id });
  assert.equal(converted.response?.kind, 'worthlessKarama');
  assert.equal(viewGame(reload(converted), f.other!).response?.kind, 'worthlessKarama');
  assert.equal(normalizeAutomaticGame(reload(converted)).pendingKull?.stage, 'counter');
  const success = finish(declaration);
  assert.equal(success.pendingChoamWorthless?.nexusEvent, nexusEvent);
  assert.equal(success.nexusChoamHistory!.at(-1)!.stage, 'pending');
  const orphan = reload(declaration);
  delete orphan.nexusChoamHistory;
  assert.throws(() => viewGame(orphan, f.other!));
  assert.throws(() => normalizeAutomaticGame(orphan));
});

void test('Nexus fuel needed by a live own Truthtrance battle promise cannot be accepted', () => {
  const f = createNexusChoamKullFixture({ fuel: 'weapon' });
  let game = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, decline: true });
  Object.assign(game, { phase: 6, active: f.choam, karamaShipping: null });
  for (const p of game.players) { p.forces = {}; p.reserves = 20; }
  for (const p of game.players.slice(0, 2)) { p.forces = { 'arrakeen:10': 3 }; p.reserves = 17; }
  game = applyAction(game, f.choam, { type: 'chooseBattle', territory: 'arrakeen', target: f.actor });
  for (let step = 0; game.response && step < 20; step++) {
    const p = game.players.find(p => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    game = p ? applyAction(game, p.id, { type: 'passResponse' }) : normalizeAutomaticGame(game);
  }
  game.battle!.preparation = undefined;
  game.battle!.truthPromises = [{ player: f.choam, asker: f.other!, claim: { kind: 'weapon', name: 'Hunter Seeker' }, answer: true }];
  game.response = { kind: 'eliteStrength', owner: f.actor, passed: [] };
  const offered = applyAction(game, f.other!, { type: 'card', mode: 'cancel', card: f.counter! });
  assert.equal(viewGame(offered, f.choam).kullReaction!.plays.some(play => play.card.id === f.fuel), false);
  reject(offered, f.choam, { type: 'kullDecision', event: offered.pendingKull!.event, source: 'nexus', card: f.fuel });
  assert.equal(offered.nexusCards!.cards!.hands[f.choam], 'choam');
  assert.ok(held(offered, f.choam, f.fuel));
});

void test('generic any-time CHOAM Cunning cannot bypass the canonical reactive opportunity', () => {
  const f = createNexusChoamKullFixture();
  const game = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, decline: true });
  const play = viewGame(game, f.choam).choamWorthless!.plays.find(play =>
    play.source === 'nexus' && play.effect === 'kull' && play.card.id === f.fuel);
  assert.ok(play && 'event' in play && play.blocked);
  reject(game, f.choam, { type: 'card', mode: 'choam', card: f.fuel, nexus: play.event, effect: 'kull' });
  assert.equal(game.nexusCards!.cards!.hands[f.choam], 'choam');
});

void test('verified pre-source printed counters migrate without mutating saves or loosening new actions', () => {
  const base = choamKullGame();
  const offer = applyAction(base, 'e', kullShipmentAttempt(base));
  const declaration = applyAction(offer, 'c', { type: 'kullDecision',
    event: offer.pendingKull!.event, source: 'printed', card: 'ix-kull-wahad' });
  const old = reload(declaration);
  delete old.pendingKull!.selection;
  const signature = JSON.parse(old.pendingKull!.signature) as Record<string, unknown>;
  delete signature.selection;
  old.pendingKull!.signature = JSON.stringify(signature);
  const saved = JSON.stringify(old);
  assert.equal(viewGame(old, 'h').response?.kind, 'choamWorthless');
  const normalized = normalizeAutomaticGame(old);
  assert.deepEqual(normalized.pendingKull!.selection, { source: 'printed', card: 'ix-kull-wahad' });
  assert.equal(JSON.stringify(old), saved);
  const resumed = applyAction(old, 'h', { type: 'card', mode: 'cancel', card: base.players[3].hand[0].id });
  assert.equal(resumed.pendingKull, null);
  assert.deepEqual(resumed.karamaShipping, { player: 'e', owner: 'e', card: base.players[1].hand[0].id });
  assert.ok(held(resumed, 'c', 'ix-kull-wahad'));
  const success = finish(normalized);
  assert.ok(held(success, 'e', base.players[1].hand[0].id));
  assert.equal(held(success, 'c', 'ix-kull-wahad'), false);
  const corrupt = reload(old);
  corrupt.pendingKull!.resume.response = { kind: 'eliteStrength', owner: 'e', passed: [] };
  const before = JSON.stringify(corrupt);
  assert.throws(() => viewGame(corrupt, 'c'));
  assert.throws(() => normalizeAutomaticGame(corrupt));
  reject(corrupt, 'h', { type: 'passResponse' });
  assert.equal(JSON.stringify(corrupt), before);
  reject(offer, 'c', { type: 'kullDecision', event: offer.pendingKull!.event, card: 'ix-kull-wahad' });
});

void test('independent canonical descriptors and unique live custody govern fuel before and after JSON restore', () => {
  const f = createNexusChoamKullFixture({ fuel: 'weapon' });
  for (const change of [
    (g: Game) => { g.players[0].hand[0].id = 'invented-treachery'; },
    (g: Game) => { g.players[0].hand[0].name = 'Invented Weapon'; },
    (g: Game) => { g.players[0].hand[0].kind = 'worthless'; },
    (g: Game) => { g.players[0].hand[0].effect = 'karama'; },
    (g: Game) => { g.deck.push({ ...g.players[0].hand[0] }); },
  ]) {
    const offer = reload(f.game); change(offer);
    const card = offer.players[0].hand[0].id;
    assert.equal(viewGame(offer, f.choam).kullReaction!.plays.some(play => play.card.id === card), false);
    reject(offer, f.choam, { type: 'kullDecision', event: f.event, source: 'nexus', card });
    const declared = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, source: 'nexus', card: f.fuel });
    const corrupt = reload(declared); change(corrupt);
    const before = JSON.stringify(corrupt);
    assert.throws(() => viewGame(corrupt, f.other!));
    assert.throws(() => normalizeAutomaticGame(corrupt));
    reject(corrupt, f.other!, { type: 'passResponse' });
    assert.equal(JSON.stringify(corrupt), before);
  }
});

for (const kind of ['inspection', 'sardaukar', 'advisors', 'guild'] as const)
  void test(`native ${kind} parent remains readable and resolves its saved response through Nexus Kull`, () => {
    const f = createNexusKullNativeParent(kind);
    const physical = inventory(f.game), parent = reload(f.game).response;
    const before = JSON.stringify(f.game);
    const offered = applyAction(f.game, f.reactor, { type: 'card', mode: 'cancel', card: f.reaction });
    assert.equal(JSON.stringify(f.game), before);
    assert.deepEqual(offered.pendingKull!.resume.response, parent);
    const declared = applyAction(offered, f.choam, { type: 'kullDecision',
      event: offered.pendingKull!.event, source: 'nexus', card: f.fuel });
    assert.equal(viewGame(reload(declared), f.reactor).response?.kind, 'choamWorthless');
    assert.equal(normalizeAutomaticGame(reload(declared)).pendingKull?.stage, 'counter');
    const result = finish(reload(declared));
    assert.deepEqual(inventory(result), physical);
    assert.ok(held(result, f.reactor, f.reaction));
    assert.equal(result.nexusChoamHistory!.at(-1)!.stage, 'complete');
    if (kind === 'inspection') {
      assert.equal(result.battle!.nexusInspection!.stage, 'answer');
      assert.equal(result.battle!.preparation!.kind, 'nexusPrescienceAnswer');
      const answered = applyAction(reload(result), f.reactor, { type: 'nexusPrescienceAnswer',
        event: result.battle!.event, value: null });
      assert.equal(answered.battle!.nexusInspection!.stage, 'answered');
    } else if (kind === 'sardaukar') assert.equal(result.nexusSardaukarHistory!.at(-1)!.stage, 'active');
    else if (kind === 'advisors') {
      assert.equal(result.nexusAdvisorHistory!.at(-1)!.stage, 'completed');
      assert.equal(Object.hasOwn(result.players[1].advisors ?? {}, 'pasty_mesa'), false);
    } else assert.equal(result.nexusGuildCunningHistory!.at(-1)!.stage, 'secondShipment');
    const canceled = applyAction(reload(declared), f.actor, { type: 'card', mode: 'cancel', card: f.original });
    assert.equal(canceled.pendingKull, null);
    assert.equal(canceled.nexusChoamHistory!.at(-1)!.stage, 'canceled');
    assert.equal(canceled.discard.filter(card => card.id === f.reaction).length, 1);
    if (kind === 'inspection') assert.equal(canceled.battle!.nexusInspection!.stage, 'canceled');
    else if (kind === 'sardaukar') assert.equal(canceled.nexusSardaukarHistory!.at(-1)!.stage, 'canceled');
    else if (kind === 'advisors') assert.equal(canceled.nexusAdvisorHistory!.at(-1)!.stage, 'canceled');
    else assert.equal(canceled.nexusGuildCunningHistory!.at(-1)!.stage, 'canceled');
    viewGame(reload(canceled), f.choam);
  });

void test('a Karama-funded Nexus parent stays reserved in authoritative and projected BG counter overlays', () => {
  const f = createNexusKullNestedParent();
  const offered = applyAction(f.game, f.actor, { type: 'card', mode: 'cancel', card: f.original });
  const declared = applyAction(offered, f.choam, { type: 'kullDecision',
    event: offered.pendingKull!.event, source: 'printed', card: f.printed });
  const converted = applyAction(reload(declared), f.actor, { type: 'card', mode: 'cancel', card: f.bgCounter });
  assert.equal(converted.response?.kind, 'worthlessKarama');
  assert.equal(viewGame(reload(converted), f.choam).responseControls!.cancelCards.includes(f.fuel), false);
  reject(converted, f.choam, { type: 'card', mode: 'cancel', card: f.fuel });
  const restored = normalizeAutomaticGame(reload(converted));
  assert.ok(held(restored, f.choam, f.fuel));
  assert.equal(restored.pendingKull!.worthless!.card, f.fuel);
  const success = finish(reload(declared));
  assert.equal(success.pendingChoamWorthless?.nexusEvent, f.nexusEvent);
  assert.deepEqual(success.response, f.game.response);
});

for (const source of ['printed', 'nexus'] as const)
  void test(`${source} Kull keeps CHOAM's own winning payment covered while admitting other legitimate fuel`, () => {
    const f = createNexusKullAuctionParent();
    const before = JSON.stringify(f.game);
    const offered = applyAction(f.game, f.reactor, { type: 'card', mode: 'special',
      card: f.reaction, target: f.actor, amount: 1 });
    assert.equal(JSON.stringify(f.game), before);
    assert.equal(offered.pendingKull!.resume.decision?.kind, 'auctionPayment');
    const plays = viewGame(reload(offered), f.choam).kullReaction!.plays;
    assert.equal(plays.some(play => play.card.id === f.payment), false);
    assert.ok(plays.some(play => play.source === 'printed' && play.card.id === f.printed));
    assert.ok(plays.some(play => play.source === 'nexus' && play.card.id === f.fuel));
    reject(offered, f.choam, { type: 'kullDecision', event: offered.pendingKull!.event,
      source: 'nexus', card: f.payment });
    const declared = applyAction(offered, f.choam, { type: 'kullDecision', event: offered.pendingKull!.event,
      source, card: source === 'printed' ? f.printed : f.fuel });
    const success = finish(reload(declared));
    assert.equal(success.decision?.kind, 'auctionPayment');
    assert.ok(held(success, f.choam, f.payment));
    const paid = applyAction(reload(success), f.choam, { type: 'decision', karama: true, card: f.payment });
    assert.ok(held(paid, f.choam, f.lot));
    assert.equal(paid.discard.filter(card => card.id === f.payment).length, 1);
    assert.equal(paid.players[0].spice, 1);
  });

void test('the Nexus-only Kull profile keeps unsupported Fremen remote Cunning behind its existing pre-offer guard', () => {
  const f = createNexusChoamKullFixture({ actorFaction: 'fremen', fuel: 'weapon', counter: false });
  const game = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, decline: true });
  game.players[1].hand.push(takeKullCard(game, f.original));
  const counter = takeKullCard(game, 'karama');
  game.players[2].hand.push(counter);
  const cards = game.nexusCards!.cards!, old = cards.hands[f.actor];
  const holder = game.players.find(p => cards.hands[p.id] === 'fremen');
  if (holder) cards.hands[holder.id] = old;
  else {
    const zone = cards.deck.includes('fremen') ? cards.deck : cards.discard;
    const index = zone.indexOf('fremen');
    assert.ok(index >= 0);
    zone.splice(index, 1);
    if (old) cards.deck.push(old);
  }
  cards.hands[f.actor] = 'fremen';
  for (const p of game.players) {
    p.forces = {}; p.reserves = 20;
    if (p.elites) { p.elites.forces = {}; p.elites.reserves = 3; }
  }
  game.players[1].forces = { 'wind_pass:14': 2 }; game.players[1].reserves = 18;
  Object.assign(game, { phase: 1, karamaShipping: null });
  game.nexusCards!.phase = createNexusCardPhase(game.turn);
  const before = JSON.stringify(game);
  const offered = applyAction(game, f.actor, { type: 'card', mode: 'special',
    card: f.original, territory: 'hagga_basin' });
  assert.equal(JSON.stringify(game), before);
  const summoned = applyAction(reload(offered), f.choam, {
    type: 'kullDecision', event: offered.pendingKull!.event, decline: true });
  assert.equal(summoned.players[1].specialKaramaUsed, true);
  assert.equal(summoned.nexusFremenCunningOffer ?? null, null);
  assert.equal(summoned.nexusFremenCunningRides ?? null, null);
  assert.equal(summoned.nexusCards!.cards!.hands[f.actor], 'fremen');
  assert.equal(summoned.discard.filter(card => card.id === f.original).length, 1);
  reject(summoned, f.actor, { type: 'decision', event: 'unsupported-remote-ride', accept: true });
  viewGame(reload(summoned), f.actor);
});

void test('a canceled CHOAM-effect block does not remove ordinary Karama auction-payment coverage', () => {
  const f = createNexusKullAuctionParent();
  f.game.choamWorthlessBlocked = { turn: f.game.turn, phase: f.game.phase, cards: [f.payment] };
  const offered = applyAction(f.game, f.reactor, { type: 'card', mode: 'special',
    card: f.reaction, target: f.actor, amount: 1 });
  const plays = viewGame(reload(offered), f.choam).kullReaction!.plays;
  assert.ok(plays.some(play => play.source === 'printed' && play.card.id === f.printed));
  assert.equal(plays.some(play => play.card.id === f.payment), false);
  const declared = applyAction(offered, f.choam, { type: 'kullDecision',
    event: offered.pendingKull!.event, source: 'printed', card: f.printed });
  const done = finish(reload(declared));
  assert.ok(held(done, f.choam, f.payment));
  const paid = applyAction(reload(done), f.choam, { type: 'decision', karama: true, card: f.payment });
  assert.ok(held(paid, f.choam, f.lot));
  assert.equal(paid.discard.filter(card => card.id === f.payment).length, 1);
  assert.equal(paid.players[0].spice, 1);
});
