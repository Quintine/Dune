import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyAction, normalizeAutomaticGame, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { ecazInquiryAction } from '../game/nexus-ecaz-inquiry-options';
import { ecazInquiryAnswer } from '../game/nexus-ecaz-inquiry';
import { drawNexusCard } from '../game/nexus-cards';
import { NexusEcazInquiry } from '../components/nexus-ecaz-inquiry';
import { nexusTraitorFixture, nexusTraitorInventory } from './fixture-nexus-traitors';
import { unitStore } from './fixture-nexus-room-store';
import type { RoomsClock } from '../db/rooms';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g)) as Game;
const seat = (g: Game, id: string) => g.players.find(player => player.id === id)!;

function setAnswer(g: Game, positive: boolean) {
  const [owner, target] = g.players;
  const native = new Set(owner.leaders.map(leader => leader.id));
  const reserve = g.traitorReserve!;
  if (positive) {
    if (target.traitors.some(id => native.has(id))) return;
    const wanted = owner.leaders[0].id;
    const other = g.players.find(player => player.id !== target.id && player.traitors.includes(wanted));
    if (other) {
      const index = other.traitors.indexOf(wanted);
      other.traitors[index] = target.traitors[0];
    } else {
      const index = reserve.indexOf(wanted);
      assert.ok(index >= 0);
      reserve[index] = target.traitors[0];
    }
    target.traitors[0] = wanted;
  } else {
    for (let i = 0; i < target.traitors.length; i++) {
      if (!native.has(target.traitors[i])) continue;
      const index = reserve.findIndex(id => !native.has(id));
      assert.ok(index >= 0);
      [target.traitors[i], reserve[index]] = [reserve[index], target.traitors[i]];
    }
  }
  nexusTraitorInventory(g);
}

function position(positive: boolean, advanced = false,
  ids: [string,string,string] = ['p','q','r']) {
  const [ownerId, targetId] = ids;
  const g = nexusTraitorFixture({ ownerFaction: 'atreides', opponentFaction: 'guild',
    advanced, phase: 2, seatIds: ids });
  const cards = g.nexusCards!.cards!;
  const index = cards.deck.indexOf('ecaz');
  assert.ok(index >= 0);
  cards.deck[index] = cards.hands[ownerId]!;
  cards.hands[ownerId] = 'ecaz';
  setAnswer(g, positive);
  nexusTraitorInventory(g);
  const action = ecazInquiryAction(viewGame(g, ownerId), targetId);
  assert.ok(action);
  return { g, action };
}

function reject(g: Game, id: string, action: {type: string;[key: string]: unknown}) {
  const before = reload(g);
  assert.throws(() => applyAction(g, id, action));
  assert.deepEqual(g, before);
}

void test('Basic and Advanced inquiries spend one physical card and preserve only the owner’s historical yes/no', () => {
  for (const advanced of [false, true]) for (const positive of [false, true]) {
    const { g, action } = position(positive, advanced);
    const offer = viewGame(g, 'p').nexusEcazInquiry.offer!;
    assert.equal(offer.blocked, null);
    assert.deepEqual(offer.targets.map(target => target.id), ['p', 'q', 'r']);
    assert.equal(viewGame(g, 'q').nexusEcazInquiry.offer, null);
    assert.equal(JSON.stringify(offer).includes(seat(g, 'q').traitors[0]), false);
    const before = reload(g), beforeLog = g.log.length;
    const done = applyAction(g, 'p', action);
    assert.deepEqual(g, before);
    assert.equal(done.nexusCards!.cards!.hands.p, null);
    assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
    assert.equal(done.nexusEcazInquiries?.length, 1);
    assert.equal(done.nexusEcazInquiries![0].answer, positive);
    assert.equal(done.log.slice(beforeLog).some(row => /\b(?:Yes|No)\b/.test(row.text)), false);
    assert.equal(viewGame(done, 'p').nexusEcazInquiry.history[0].answer, positive);
    assert.deepEqual(viewGame(done, 'q').nexusEcazInquiry.history, []);
    assert.deepEqual(viewGame(done, 'r').nexusEcazInquiry.history, []);
    assert.equal(JSON.stringify(viewGame(done, 'q')).includes(done.nexusEcazInquiries![0].signature), false);
    assert.deepEqual(normalizeAutomaticGame(reload(done)), done);
    reject(done, 'p', action);
    nexusTraitorInventory(done);
    const changed = reload(done);
    setAnswer(changed, !positive);
    assert.equal(viewGame(changed, 'p').nexusEcazInquiry.history[0].answer, positive);
  }
});

void test('self-targeting and later Nexus discard recycling preserve the recorded answer', () => {
  const { g } = position(false);
  const expected = ecazInquiryAnswer(seat(g, 'p'), seat(g, 'p'));
  const action = ecazInquiryAction(viewGame(g, 'p'), 'p');
  assert.ok(action);
  const done = applyAction(g, 'p', action);
  assert.deepEqual(viewGame(done, 'p').nexusEcazInquiry.history[0],
    { event: action.event, target: 'p', turn: done.turn, phase: done.phase, answer: expected });
  const recycled = reload(done), cards = recycled.nexusCards!.cards!;
  cards.discard.push(...cards.deck.splice(0));
  recycled.nexusCards!.cards = drawNexusCard(cards, 'p', recycled.players, () => 0);
  assert.equal(recycled.nexusCards!.cards!.discard.includes('ecaz'), false);
  assert.equal(viewGame(recycled, 'p').nexusEcazInquiry.history[0].answer, expected);
  assert.deepEqual(normalizeAutomaticGame(reload(recycled)), recycled);
});

void test('inquiry counts dead or captured native leaders but not foreign discs, Duke or Face Dancers', () => {
  const { g } = position(false);
  const owner = seat(g, 'p'), target = seat(g, 'q');
  assert.equal(ecazInquiryAnswer(owner, target), false);
  const native = owner.leaders[0];
  native.dead = true;
  native.capturedBy = 'r';
  target.traitors.push(native.id);
  assert.equal(ecazInquiryAnswer(owner, target), true);
  target.traitors.pop();
  owner.leaders.push({ ...native, id: 'duke-vidal' });
  target.traitors.push('duke-vidal');
  assert.equal(ecazInquiryAnswer(owner, target), false);
  target.traitors.pop();
  target.faceDancers = [{ leader: native.id, revealed: false }];
  assert.equal(ecazInquiryAnswer(owner, target), false);
});

void test('stale, forged, foreign, interrupted and damaged saved inquiry rejects without changing a game', () => {
  const { g, action } = position(true);
  reject(g, 'q', action);
  reject(g, 'p', { ...action, event: 'stale' });
  reject(g, 'p', { ...action, target: 'foreign' });
  reject(g, 'p', { ...action, answer: true });
  const busy = reload(g);
  busy.decision = { kind: 'choamMarket', player: 'q' };
  assert.ok(viewGame(busy, 'p').nexusEcazInquiry.offer?.blocked);
  reject(busy, 'p', action);
  const done = applyAction(g, 'p', action);
  for (const damage of [
    (state: Game) => { state.nexusEcazInquiries![0].answer = false; },
    (state: Game) => { state.nexusEcazInquiries![0].target = 'r'; },
    (state: Game) => { state.nexusEcazInquiryLast!.event = 'stale'; },
    (state: Game) => { delete state.nexusEcazInquiries; },
  ]) {
    const corrupt = reload(done); damage(corrupt); const before = reload(corrupt);
    assert.throws(() => viewGame(corrupt, 'p'));
    assert.deepEqual(corrupt, before);
  }
});

void test('all four AI profiles inquire legally and the table keeps prior answers private after spending', () => {
  const { g, action } = position(true);
  for (const difficulty of ['Easy','Medium','Hard','Brutal'] as const) {
    const view = viewGame(g, 'p');
    view.players.find(player => player.id === 'p')!.bot = difficulty;
    assert.deepEqual(botActions(view)[0], action);
  }
  const offerMarkup = renderToStaticMarkup(createElement(NexusEcazInquiry, {
    game: viewGame(g, 'p'), busy: false, act() {},
  }));
  assert.match(offerMarkup, /Spend Ecaz Nexus · ask privately/);
  assert.equal(renderToStaticMarkup(createElement(NexusEcazInquiry, {
    game: viewGame(g, 'q'), busy: false, act() {},
  })), '');
  const done = applyAction(g, 'p', action);
  const historyMarkup = renderToStaticMarkup(createElement(NexusEcazInquiry, {
    game: viewGame(done, 'p'), busy: false, act() {},
  }));
  assert.match(historyMarkup, /held one of your native leaders: Yes/);
  assert.equal(renderToStaticMarkup(createElement(NexusEcazInquiry, {
    game: viewGame(done, 'q'), busy: false, act() {},
  })), '');
});

const clock: RoomsClock = {now: () => 10000, sleep: async () => {}};
void test('simultaneous saved inquiries commit once and keep answer private after authenticated recovery', async () => {
  const store = unitStore();
  try {
    const made = await store.rooms.createRoom('Ecaz inquiry SQL', 'atreides', false, []);
    const code = made.view.code;
    const tokens = [made.token];
    for (const faction of ['guild', 'fremen'] as const)
      tokens.push((await store.rooms.joinRoom(code, faction, faction)).token!);
    const auths = await Promise.all(tokens.map(token => store.rooms.authenticate(code, token)));
    const ids = auths.map(auth => auth.playerId) as [string,string,string];
    const { g } = position(true, false, ids);
    g.code = code;
    g.version = (await store.rooms.readRoom(code)).version;
    store.sqlite.prepare('UPDATE rooms SET state = ?, version = ? WHERE code = ?')
      .run(JSON.stringify(g), g.version, code);
    const action = ecazInquiryAction(viewGame(g, ids[0]), ids[1])!;
    let arrivals = 0, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    store.hooks.beforeWrite = async () => { if (++arrivals === 2) release(); await gate; };
    const timer = setTimeout(release, 2000);
    let results: PromiseSettledResult<unknown>[];
    try {
      results = await Promise.allSettled([
        store.restart().act(code, auths[0], g.version, action, clock),
        store.restart().act(code, auths[0], g.version, action, clock),
      ]);
    } finally { clearTimeout(timer); delete store.hooks.beforeWrite; }
    assert.equal(arrivals, 2);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const done = await store.restart().readRoom(code);
    assert.equal(done.version, g.version + 1);
    assert.equal(done.nexusEcazInquiries?.length, 1);
    assert.equal(done.nexusCards!.cards!.discard.filter(card => card === 'ecaz').length, 1);
    assert.equal((await store.restart().readSeatView(code, auths[0])).nexusEcazInquiry.history[0].answer, true);
    for (const auth of auths.slice(1))
      assert.deepEqual((await store.restart().readSeatView(code, auth)).nexusEcazInquiry.history, []);
    reject(done, ids[0], action);
  } finally { store.sqlite.close(); }
});
