import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, newPlayer, normalizeAutomaticGame, viewGame, type Action, type Game } from '../game/engine';
import { gameDistance, gameTerritories, splitLocation } from '../game/board';
import { discoveryFlightMove, discoveryFlightBotActions } from '../game/discovery-flight-options';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { richeseCards } from '../game/richese-cards';
import { createRicheseNoField, deployRicheseNoField } from '../game/richese-no-field';
import { discoveryFlightFixture, flightDestination, flightOrigin } from './fixture-discovery-flight';

const reload = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const held = (game: Game) => game.discoveries!.tokens.find(token => token.face === 'ornithopter')!;
const declaration = (game: Game, extra: Partial<Action> = {}): Action => ({
  type: 'move', from: flightOrigin, amount: 2, ...splitLocation(flightDestination(game)),
  discoveryOrnithopter: held(game).id, ...extra,
});
function rejectsUnchanged(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before);
}
function choamFixture() {
  const fixture = discoveryFlightFixture(true, 'f');
  const choam = newPlayer('c', 'CHOAM', 'choam');
  fixture.game.players.push(choam);
  fixture.game.order.push(choam.id);
  const destination = flightDestination(fixture.game);
  choam.forces = { [destination]: 1 };
  choam.reserves--;
  const baliset = fixture.game.deck.findIndex(card => card.name === 'Baliset');
  assert.ok(baliset >= 0);
  choam.hand.push(fixture.game.deck.splice(baliset, 1)[0]);
  const pilot = fixture.game.players.find(player => player.id === 'f')!;
  pilot.elites!.reserves -= 2;
  pilot.elites!.forces[flightOrigin] = 2;
  return { ...fixture, destination };
}

void test('real Collection acquisition grants one later-turn three-territory movement in Basic and Advanced', () => {
  for (const advanced of [false, true]) {
    const { game, owner, acquiredTurn } = discoveryFlightFixture(advanced);
    const action = declaration(game), destination = `${String(action.territory)}:${Number(action.sector)}`;
    const before = structuredClone(game), ordinary = { ...action };
    delete ordinary.discoveryOrnithopter;
    rejectsUnchanged(game, owner, ordinary);
    const view = viewGame(game, owner);
    assert.equal(view.discoveryOrnithopter!.blocked, null);
    assert.equal(viewGame(game, 'g').discoveryOrnithopter, null);
    assert.ok(discoveryFlightMove(view, ordinary).action);
    const done = applyAction(game, owner, action);
    assert.deepEqual(game, before);
    assert.equal(done.players[0].forces[destination], 2);
    assert.equal(done.players[0].moved, 1);
    assert.equal(done.players[0].reserves, game.players[0].reserves);
    assert.equal(done.players[0].spice, game.players[0].spice);
    assert.equal(held(done).status, 'removed');
    assert.equal(held(done).owner, null);
    assert.equal(held(done).acquiredTurn, acquiredTurn);
    assert.equal(viewGame(done, owner).discoveryOrnithopter, null);
    assert.deepEqual(normalizeAutomaticGame(reload(done)), reload(done));
  }
});

void test('same-turn use, nonowner, false token, invalid group, storm, overrange and receipt injection reject immutably', () => {
  const { game, owner } = discoveryFlightFixture();
  const sameTurn = reload(game); sameTurn.turn = held(game).acquiredTurn!;
  assert.match(viewGame(sameTurn, owner).discoveryOrnithopter!.blocked!, /after/);
  rejectsUnchanged(sameTurn, owner, declaration(sameTurn));
  for (const extra of [
    { discoveryOrnithopter: 'discovery-token-99' },
    { discoveryOrnithopter: game.discoveries!.tokens.find(token => token.face === 'cistern')!.id },
    { amount: 6 }, { amount: 0 }, { elite: 1 },
    { ...splitLocation(flightDestination(game, 4)) },
    { discoveryFlight: { token: held(game).id } },
  ]) rejectsUnchanged(game, owner, declaration(game, extra));
  const storm = reload(game), action = declaration(storm);
  storm.storm = Number(action.sector);
  rejectsUnchanged(storm, owner, action);
  const foreign = reload(game); foreign.active = 'g';
  foreign.players[1].forces[flightOrigin] = 2; foreign.players[1].reserves -= 2;
  rejectsUnchanged(foreign, 'g', declaration(foreign));
  const used = applyAction(game, owner, declaration(game));
  used.hajr = [owner];
  rejectsUnchanged(used, owner, declaration(used));
});

void test('one selected multi-sector typed group moves at fixed range without a native Fremen speed response', () => {
  const { game, owner } = discoveryFlightFixture(true, 'f');
  const pilot = game.players.find(player => player.id === owner)!;
  const source = gameTerritories(game).find(t => t.sectors.length >= 2 && !t.sectors.includes(game.storm))!;
  const [first, second] = source.sectors.map(sector => `${source.id}:${sector}`);
  pilot.forces = { [first]: 3, [second]: 2 };
  pilot.elites!.reserves -= 2; pilot.elites!.forces = { [first]: 1, [second]: 1 };
  const to = gameTerritories(game).flatMap(t => t.sectors.map(sector => `${t.id}:${sector}`))
    .find(key => [first, second].every(from => gameDistance(game, from, key,
      key => splitLocation(key).sector === game.storm) === 3))!;
  assert.ok(to);
  const move: Action = { type: 'move', forces: { [first]: 2, [second]: 1 },
    eliteForces: { [first]: 1, [second]: 1 }, ...splitLocation(to) };
  const quote = discoveryFlightMove(viewGame(game, owner), move);
  assert.equal(quote.blocked, null);
  const done = applyAction(game, owner, quote.action!);
  assert.equal(done.response, null);
  const next = done.players.find(player => player.id === owner)!;
  assert.equal(next.forces[to], 3); assert.equal(next.elites!.forces[to], 2);
  assert.equal(next.moved, 1); assert.equal(held(done).status, 'removed');
});

void test('pending CHOAM decision preserves the exact owned token and typed group across JSON; allowing resumes once', () => {
  const { game, owner, destination } = choamFixture();
  const pending = applyAction(game, owner, declaration(game, { elite: 1 }));
  assert.equal(pending.decision?.kind, 'choamMovement');
  assert.equal(held(pending).status, 'carried');
  assert.equal(pending.players.find(p => p.id === owner)!.moved, 0);
  assert.ok(pending.pendingChoamMove!.discoveryFlight);
  assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
  assert.match(viewGame(pending, owner).discoveryOrnithopter!.blocked!, /response or decision/);
  assert.equal(JSON.stringify(viewGame(pending, 'c')).includes('discoveryFlight'), false);
  const done = applyAction(reload(pending), 'c', { type: 'decision', decline: true });
  const pilot = done.players.find(p => p.id === owner)!;
  assert.equal(pilot.forces[destination], 2); assert.equal(pilot.elites!.forces[destination], 1);
  assert.equal(pilot.moved, 1); assert.equal(held(done).status, 'removed');
  assert.equal(done.pendingChoamMove, null);
  rejectsUnchanged(done, 'c', { type: 'decision', decline: true });
});

void test('altered pending movement receipt fails closed on normalize, view and answer', () => {
  const { game, owner } = choamFixture();
  const pending = applyAction(game, owner, declaration(game, { elite: 1 }));
  for (const alter of [
    (g: Game) => { g.pendingChoamMove!.to = 'hagga_basin'; },
    (g: Game) => { g.pendingChoamMove!.eliteGroup[flightOrigin] = 0; },
    (g: Game) => { g.pendingChoamMove!.discoveryFlight!.move++; },
    (g: Game) => { g.turn++; },
    (g: Game) => { held(g).owner = 'g'; },
    (g: Game) => { g.pendingIxMove = reload(g.pendingChoamMove); },
  ]) {
    const changed = reload(pending); alter(changed);
    const before = structuredClone(changed);
    assert.throws(() => normalizeAutomaticGame(changed));
    assert.throws(() => viewGame(changed, owner));
    rejectsUnchanged(changed, 'c', { type: 'decision', decline: true });
    assert.deepEqual(changed, before);
  }
});

void test('Baliset prevents the pending move without spending its token; a different route can still use it', () => {
  const { game, owner, destination } = choamFixture();
  let pending = applyAction(game, owner, declaration(game, { elite: 1 }));
  const choam = pending.players.find(player => player.id === 'c')!;
  pending = applyAction(reload(pending), 'c', { type: 'card', mode: 'choam',
    card: choam.hand.find(card => card.name === 'Baliset')!.id, target: owner,
    territory: splitLocation(destination).territory });
  assert.equal(pending.pendingChoamMove, null);
  assert.equal(held(pending).status, 'carried');
  assert.equal(pending.players.find(player => player.id === owner)!.moved, 0);
  const alternate = discoveryFlightBotActions(viewGame(pending, owner))[0];
  assert.ok(alternate);
  assert.equal(held(applyAction(pending, owner, alternate)).status, 'removed');
});

void test('actual Baliset cancellation response restores the same flight and either allows or abandons its one movement', () => {
  for (const cancel of [false, true]) {
    const { game, owner, destination } = choamFixture();
    const cardIndex = game.deck.findIndex(card => card.effect === 'karama');
    const karama = game.deck.splice(cardIndex, 1)[0];
    game.players.find(player => player.id === owner)!.hand.push(karama);
    let pending = applyAction(game, owner, declaration(game, { elite: 1 }));
    const choam = pending.players.find(player => player.id === 'c')!;
    pending = applyAction(pending, 'c', { type: 'card', mode: 'choam',
      card: choam.hand.find(card => card.name === 'Baliset')!.id, target: owner,
      territory: splitLocation(destination).territory });
    assert.equal(pending.response?.kind, 'choamWorthless');
    assert.equal(held(pending).status, 'carried');
    assert.deepEqual(normalizeAutomaticGame(reload(pending)), reload(pending));
    const done = applyAction(reload(pending), owner, cancel
      ? { type: 'card', card: karama.id, mode: 'cancel' } : { type: 'passResponse' });
    assert.equal(done.pendingChoamMove, null);
    assert.equal(done.players.find(player => player.id === owner)!.moved, Number(cancel));
    assert.equal(held(done).status, cancel ? 'removed' : 'carried');
  }
});

void test('Discovery flight replaces a Kulon-enhanced normal range with exactly three', () => {
  const { game, owner } = discoveryFlightFixture();
  game.players[0].faction = 'choam';
  game.players[0].forces['arrakeen:10'] = 1; game.players[0].reserves--;
  game.choamMovement = { turn: game.turn, bonus: 1 };
  const four = declaration(game, splitLocation(flightDestination(game, 4)));
  rejectsUnchanged(game, owner, four);
  assert.equal(discoveryFlightMove(viewGame(game, owner), four).action, null);
  const ordinary = { ...four }; delete ordinary.discoveryOrnithopter;
  assert.equal(held(applyAction(game, owner, ordinary)).status, 'carried');
  assert.equal(held(applyAction(game, owner, declaration(game))).status, 'removed');
});

void test('a selected concealed marker flies with physical companions and retains its private denomination', () => {
  const { game, owner } = discoveryFlightFixture();
  const pilot = game.players[0]; pilot.faction = 'richese';
  const ids = ['flight-zero', 'flight-three', 'flight-five'];
  pilot.noField = deployRicheseNoField(createRicheseNoField(ids),
    { tokenId: ids[1], controller: owner, location: splitLocation(flightOrigin) });
  pilot.noFieldEvent = 'flight-marker';
  const action: Action = { type: 'move', forces: { [flightOrigin]: 2 }, noField: ids[1],
    event: pilot.noFieldEvent, ...splitLocation(flightDestination(game)) };
  const quote = discoveryFlightMove(viewGame(game, owner), action);
  assert.equal(quote.blocked, null);
  const done = applyAction(game, owner, quote.action!);
  assert.deepEqual(done.players[0].noField!.deployed!.location, splitLocation(flightDestination(game)));
  assert.equal(done.players[0].noField!.deployed!.tokenId, ids[1]);
  assert.equal(done.players[0].reserves, pilot.reserves);
  assert.equal(held(done).status, 'removed');
  assert.equal(JSON.stringify(viewGame(done, 'g')).includes(ids[1]), false);
});

void test('Discovery flight can serve one group of an active Treachery card without spending its second original group', () => {
  const { game, owner } = discoveryFlightFixture();
  game.richeseCache = richeseCards();
  const index = game.richeseCache.findIndex(card => card.id === 'richese-ornithopter');
  const card = game.richeseCache.splice(index, 1)[0]; game.players[0].hand.push(card);
  const first = applyAction(game, owner, declaration(game,
    { movementCard: card.id, ornithopter: 'twoGroups' }));
  assert.equal(held(first).status, 'removed');
  assert.equal(first.ornithopter!.completed, 1);
  assert.equal(first.ornithopter!.cohort!.forces[flightOrigin], 3);
  assert.equal(first.discard.some(candidate => candidate.id === card.id), false);
  const done = applyAction(reload(first), owner, { type: 'move', from: flightOrigin, amount: 2,
    ...splitLocation(flightDestination(first, 1)), ornithopterEvent: first.ornithopter!.event });
  assert.equal(done.players[0].moved, 2);
  assert.equal(done.ornithopter, null);
  assert.equal(done.discard.filter(candidate => candidate.id === card.id).length, 1);
});

void test('all AI profiles quote usable owned flight routes and conserve tokens when normal range already suffices', () => {
  const { game, owner } = discoveryFlightFixture();
  for (const difficulty of DIFFICULTIES) {
    const g = reload(game), pilot = g.players.find(player => player.id === owner)!;
    pilot.bot = difficulty;
    const view = viewGame(g, owner), actions = botActions(view);
    assert.ok(actions.length);
    assert.equal(actions[0].discoveryOrnithopter, held(g).id);
    assert.equal(held(applyAction(g, owner, actions[0])).status, 'removed');
    pilot.forces['arrakeen:10'] = 1; pilot.reserves--;
    assert.deepEqual(discoveryFlightBotActions(viewGame(g, owner)), []);
  }
});

void test('a physical Treachery Ornithopter remains independently owned after spending the Discovery token', () => {
  const { game, owner } = discoveryFlightFixture();
  game.richeseCache = richeseCards();
  const index = game.richeseCache.findIndex(card => card.id === 'richese-ornithopter');
  const card = game.richeseCache.splice(index, 1)[0];
  game.players[0].hand.push(card);
  const done = applyAction(game, owner, declaration(game));
  assert.deepEqual(done.players[0].hand, [card]);
  assert.equal(done.ornithopter, game.ornithopter);
  assert.equal(done.discard.some(candidate => candidate.id === card.id), false);
  assert.equal(held(done).status, 'removed');
});
