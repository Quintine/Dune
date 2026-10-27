import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction, createGame, joinControlledFaction, joinGame, newPlayer, viewGame,
  type Action, type Game,
} from '../game/engine';
import { knowledgeGame } from './truthtrance-knowledge-fixture';

/** Genuine two-controller/four-faction Basic setup. Each faction keeps its own seat. */
function playing(): Game {
  let game = createGame('DEALMANY', newPlayer('a', 'First', 'atreides'));
  game = applyAction(game, 'a', { type: 'twoPlayerMode', enabled: true });
  joinControlledFaction(game, newPlayer('b', 'First', 'emperor'), 'a');
  joinGame(game, newPlayer('c', 'Second', 'guild'));
  joinControlledFaction(game, newPlayer('d', 'Second', 'harkonnen'), 'c');
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  game = applyAction(game, 'a', { type: 'start' });
  for (const player of game.players) if (player.traitorChoices.length)
    game = applyAction(game, player.id, { type: 'traitor', leader: player.traitorChoices[0] });
  assert.equal(game.status, 'playing');
  return game;
}

function reject(game: Game, actor: string, action: Action): void {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action), `${action.type} must reject`);
  assert.deepEqual(game, before, `${action.type} must not mutate a rejected input`);
}

function proposal(game: Game, targets = ['b', 'c']) {
  const next = applyAction(game, 'a', { type: 'dealOffer', targets, terms: 'All three will share information.' });
  const deal = next.deals?.at(-1);
  assert.ok(deal);
  return { game: next, deal };
}

function preserved(game: Game) {
  const { players, playerPositions, twoPlayerControllers, phase, turn, active, response, decision,
    phaseOpening, auction, deck, discard } = game;
  return structuredClone({ players, playerPositions, twoPlayerControllers, phase, turn, active, response,
    decision, phaseOpening, auction, deck, discard });
}

void test('every named faction accepts and releases a three-party deal independently', () => {
  const initial = playing();
  const baseline = preserved(initial);
  const offered = proposal(initial);
  let game = offered.game;
  const id = offered.deal.id;
  assert.deepEqual(offered.deal.participants, ['a', 'b', 'c']);
  assert.deepEqual(offered.deal.acceptVotes, ['a']);
  assert.equal(offered.deal.status, 'offered');
  for (const player of game.players)
    assert.deepEqual(viewGame(game, player.id).deals.find(deal => deal.id === id), offered.deal);
  assert.deepEqual(viewGame(game, 'b').controlledFactionSeats.map(seat => seat.id), ['a', 'b']);
  reject(game, 'd', { type: 'dealRespond', deal: id, accept: true });
  reject(game, 'a', { type: 'dealRespond', deal: id, accept: true });
  game = applyAction(game, 'c', { type: 'dealRespond', deal: id, accept: true });
  assert.equal(game.deals!.at(-1)!.status, 'offered');
  assert.deepEqual([...game.deals!.at(-1)!.acceptVotes!].sort(), ['a', 'c']);
  reject(game, 'c', { type: 'dealRespond', deal: id, accept: true });
  game = applyAction(game, 'b', { type: 'dealRespond', deal: id, accept: true });
  assert.equal(game.deals!.at(-1)!.status, 'active');
  assert.deepEqual([...game.deals!.at(-1)!.acceptVotes!].sort(), ['a', 'b', 'c']);
  assert.deepEqual(preserved(game), baseline);

  reject(game, 'd', { type: 'dealRelease', deal: id, agree: true });
  game = applyAction(game, 'a', { type: 'dealRelease', deal: id, agree: true });
  game = applyAction(game, 'b', { type: 'dealRelease', deal: id, agree: true });
  assert.equal(game.deals!.at(-1)!.status, 'active');
  game = applyAction(game, 'b', { type: 'dealRelease', deal: id, agree: false });
  assert.deepEqual(game.deals!.at(-1)!.releaseVotes, ['a']);
  game = applyAction(game, 'c', { type: 'dealRelease', deal: id, agree: true });
  assert.equal(game.deals!.at(-1)!.status, 'active');
  game = applyAction(game, 'b', { type: 'dealRelease', deal: id, agree: true });
  assert.equal(game.deals!.at(-1)!.status, 'released');
  assert.deepEqual([...game.deals!.at(-1)!.releaseVotes].sort(), ['a', 'b', 'c']);
  assert.deepEqual(preserved(game), baseline);
  reject(game, 'a', { type: 'dealRelease', deal: id, agree: true });

  // The agreement never consumes or replays the original native Storm choice.
  const dialer = game.stormDialers[0];
  assert.ok(dialer);
  game = applyAction(game, dialer, { type: 'stormDial', amount: 0 });
  assert.ok(game.phase !== initial.phase || game.stormDials[dialer] === 0);
});

void test('a recipient may decline while other votes are pending and only the proposer may withdraw', () => {
  let { game, deal } = proposal(playing());
  const id = deal.id;
  game = applyAction(game, 'b', { type: 'dealRespond', deal: id, accept: true });
  game = applyAction(game, 'c', { type: 'dealRespond', deal: id, accept: false });
  assert.equal(game.deals!.at(-1)!.status, 'declined');
  reject(game, 'b', { type: 'dealRespond', deal: id, accept: true });
  ({ game, deal } = proposal(game));
  reject(game, 'c', { type: 'dealWithdraw', deal: deal.id });
  game = applyAction(game, 'a', { type: 'dealWithdraw', deal: deal.id });
  assert.equal(game.deals!.at(-1)!.status, 'withdrawn');
});

void test('every participant pair must be nonallied at offer and acceptance, while existing deals remain releasable', () => {
  const initial = playing();
  const pairAllied = structuredClone(initial);
  pairAllied.players.find(player => player.id === 'b')!.ally = 'c';
  pairAllied.players.find(player => player.id === 'c')!.ally = 'b';
  reject(pairAllied, 'a', { type: 'dealOffer', targets: ['b', 'c'], terms: 'Terms' });
  const offered = proposal(initial);
  const changed = structuredClone(offered.game);
  changed.players.find(player => player.id === 'b')!.ally = 'c';
  changed.players.find(player => player.id === 'c')!.ally = 'b';
  reject(changed, 'b', { type: 'dealRespond', deal: offered.deal.id, accept: true });
  const declined = applyAction(changed, 'b', { type: 'dealRespond', deal: offered.deal.id, accept: false });
  assert.equal(declined.deals!.at(-1)!.status, 'declined');

  let game = applyAction(offered.game, 'b', { type: 'dealRespond', deal: offered.deal.id, accept: true });
  game = applyAction(game, 'c', { type: 'dealRespond', deal: offered.deal.id, accept: true });
  game.players.find(player => player.id === 'b')!.ally = 'c';
  game.players.find(player => player.id === 'c')!.ally = 'b';
  for (const id of ['a', 'b', 'c']) game = applyAction(game, id, { type: 'dealRelease', deal: offered.deal.id, agree: true });
  assert.equal(game.deals!.at(-1)!.status, 'released');
});

void test('multiparty packets reject empty, duplicate, forged and incompatible targets', () => {
  const game = playing();
  for (const action of [
    { type: 'dealOffer', targets: [], terms: 'Terms' },
    { type: 'dealOffer', targets: ['a', 'b'], terms: 'Terms' },
    { type: 'dealOffer', targets: ['b', 'b'], terms: 'Terms' },
    { type: 'dealOffer', targets: ['b', 'unknown'], terms: 'Terms' },
    { type: 'dealOffer', targets: 'b', terms: 'Terms' },
    { type: 'dealOffer', target: 'b', targets: ['b', 'c'], terms: 'Terms' },
    { type: 'dealOffer', targets: ['b', 'c'], terms: 'Terms', from: 'd' },
  ] as Action[]) reject(game, 'a', action);
});

void test('multiparty negotiation preserves and resumes a pending Truthtrance priority response', () => {
  const initial = knowledgeGame();
  const card = initial.players[0].hand.find(item => item.effect === 'truthtrance');
  assert.ok(card);
  const paused = applyAction(initial, 'a', { type: 'card', card: card.id });
  assert.equal(paused.truthtrance?.stage, 'priority');
  const before = structuredClone(paused.truthtrance);
  const offered = applyAction(paused, 'b', { type: 'dealOffer', targets: ['f', 'o'], terms: 'We will disclose our intentions.' });
  const deal = offered.deals!.at(-1)!;
  const acceptedOne = applyAction(offered, 'f', { type: 'dealRespond', deal: deal.id, accept: true });
  const acceptedAll = applyAction(acceptedOne, 'o', { type: 'dealRespond', deal: deal.id, accept: true });
  assert.equal(acceptedAll.deals!.at(-1)!.status, 'active');
  assert.deepEqual(acceptedAll.truthtrance, before);
  const passer = acceptedAll.players.find(player => !acceptedAll.truthtrance!.passed.includes(player.id));
  assert.ok(passer);
  const resumed = applyAction(acceptedAll, passer.id, { type: 'truthPass' });
  assert.ok(resumed.truthtrance?.passed.includes(passer.id));
});
