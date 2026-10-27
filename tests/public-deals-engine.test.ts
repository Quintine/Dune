import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { knowledgeGame } from './truthtrance-knowledge-fixture';

/** Complete a genuine Basic setup with distinct nonallied human factions. */
function playing(withBot = false): Game {
  let game = createGame('DEALS', newPlayer('a', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('h', 'Harkonnen', 'harkonnen'));
  joinGame(game, newPlayer('e', 'Emperor', 'emperor'));
  if (withBot) game = applyAction(game, 'a', { type: 'addBot', faction: 'guild', difficulty: 'Easy' });
  for (const p of game.players.filter(player => !player.bot)) game = applyAction(game, p.id, { type: 'ready' });
  game = applyAction(game, 'a', { type: 'start' });
  for (const p of game.players) if (p.traitorChoices.length)
    game = applyAction(game, p.id, { type: 'traitor', leader: p.traitorChoices[0] });
  assert.equal(game.status, 'playing');
  return game;
}

function reject(game: Game, actor: string, action: Action) {
  const original = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action), `${action.type} must reject`);
  assert.deepEqual(game, original, `${action.type} must not mutate rejected input`);
}

function offer(game: Game, from = 'a', to = 'h') {
  const terms = 'I will not attack your forces this turn.';
  const next = applyAction(game, from, { type: 'dealOffer', target: to, terms });
  const deal = next.deals?.at(-1);
  assert.ok(deal);
  assert.equal(deal.from, from);
  assert.equal(deal.to, to);
  assert.equal(deal.terms, terms);
  assert.equal(deal.turn, game.turn);
  assert.equal(deal.status, 'offered');
  assert.deepEqual(deal.releaseVotes, []);
  return { game: next, deal };
}

function preservedRules(game: Game) {
  const { players, phase, turn, active, response, decision, phaseOpening, auction, deck, discard } = game;
  return structuredClone({ players, phase, turn, active, response, decision, phaseOpening, auction, deck, discard });
}

void test('public offer, consent and mutual release preserve the native game', () => {
  const original = playing();
  const baseline = preservedRules(original);
  const offered = offer(original);
  let game = offered.game;
  const deal = offered.deal;
  assert.ok(deal.id);
  for (const player of game.players)
    assert.deepEqual(viewGame(game, player.id).deals.find(item => item.id === deal.id), deal);
  assert.deepEqual(preservedRules(game), baseline);

  reject(game, 'a', { type: 'dealRespond', deal: deal.id, accept: true });
  reject(game, 'e', { type: 'dealRespond', deal: deal.id, accept: true });
  game = applyAction(game, 'h', { type: 'dealRespond', deal: deal.id, accept: true });
  assert.equal(game.deals!.find(item => item.id === deal.id)!.status, 'active');
  assert.deepEqual(preservedRules(game), baseline);
  reject(game, 'a', { type: 'dealWithdraw', deal: deal.id });
  reject(game, 'e', { type: 'dealRelease', deal: deal.id, agree: true });

  game = applyAction(game, 'a', { type: 'dealRelease', deal: deal.id, agree: true });
  let active = game.deals!.find(item => item.id === deal.id)!;
  assert.equal(active.status, 'active');
  assert.deepEqual(active.releaseVotes, ['a']);
  game = applyAction(game, 'a', { type: 'dealRelease', deal: deal.id, agree: false });
  active = game.deals!.find(item => item.id === deal.id)!;
  assert.equal(active.status, 'active');
  assert.deepEqual(active.releaseVotes, []);
  game = applyAction(game, 'h', { type: 'dealRelease', deal: deal.id, agree: true });
  assert.equal(game.deals!.find(item => item.id === deal.id)!.status, 'active');
  game = applyAction(game, 'a', { type: 'dealRelease', deal: deal.id, agree: true });
  assert.equal(game.deals!.find(item => item.id === deal.id)!.status, 'released');
  assert.deepEqual(preservedRules(game), baseline);
  reject(game, 'h', { type: 'dealRelease', deal: deal.id, agree: true });
});

void test('declined and withdrawn offers remain public without changing game pieces', () => {
  const original = playing();
  const baseline = preservedRules(original);
  let { game, deal } = offer(original);
  reject(game, 'h', { type: 'dealWithdraw', deal: deal.id });
  game = applyAction(game, 'h', { type: 'dealRespond', deal: deal.id, accept: false });
  assert.equal(game.deals!.find(item => item.id === deal.id)!.status, 'declined');
  reject(game, 'h', { type: 'dealRespond', deal: deal.id, accept: true });
  ({ game, deal } = offer(game));
  game = applyAction(game, 'a', { type: 'dealWithdraw', deal: deal.id });
  assert.equal(game.deals!.find(item => item.id === deal.id)!.status, 'withdrawn');
  reject(game, 'h', { type: 'dealRespond', deal: deal.id, accept: true });
  assert.deepEqual(preservedRules(game), baseline);
});

void test('deals reject self, ally, bot, unknown and malformed parties or packets', () => {
  const game = playing(true);
  const bot = game.players.find(player => player.bot)!;
  for (const [actor, action] of [
    ['a', { type: 'dealOffer', target: 'a', terms: 'Self' }],
    ['a', { type: 'dealOffer', target: bot.id, terms: 'Bot' }],
    [bot.id, { type: 'dealOffer', target: 'a', terms: 'Bot' }],
    ['missing', { type: 'dealOffer', target: 'a', terms: 'Forged' }],
    ['a', { type: 'dealOffer', target: 'missing', terms: 'Forged' }],
    ['a', { type: 'dealOffer', target: 'h', terms: '' }],
    ['a', { type: 'dealOffer', target: 'h', terms: '   ' }],
    ['a', { type: 'dealOffer', target: 'h', terms: null }],
    ['a', { type: 'dealOffer', target: 'h', terms: 'Terms', from: 'e' }],
    ['h', { type: 'dealRespond', deal: 'stale', accept: true }],
  ] as Array<[string, Action]>) reject(game, actor, action);

  const allied = structuredClone(game);
  allied.players.find(player => player.id === 'a')!.ally = 'h';
  allied.players.find(player => player.id === 'h')!.ally = 'a';
  reject(allied, 'a', { type: 'dealOffer', target: 'h', terms: 'Agreement' });
  const separatelyAllied = structuredClone(game);
  separatelyAllied.players.find(player => player.id === 'a')!.ally = 'e';
  separatelyAllied.players.find(player => player.id === 'e')!.ally = 'a';
  const allowed = offer(separatelyAllied, 'a', 'h');
  assert.equal(allowed.deal.status, 'offered');
  const proposed = offer(game);
  const formed = structuredClone(proposed.game);
  formed.players.find(player => player.id === 'a')!.ally = 'h';
  formed.players.find(player => player.id === 'h')!.ally = 'a';
  reject(formed, 'h', { type: 'dealRespond', deal: proposed.deal.id, accept: true });
  reject(proposed.game, 'h', { type: 'dealRespond', deal: proposed.deal.id, accept: 'yes' });
  reject(proposed.game, 'h', { type: 'dealRespond', deal: proposed.deal.id, accept: true, from: 'e' });
  reject(proposed.game, 'a', { type: 'dealWithdraw', deal: proposed.deal.id, extra: true });
});

void test('public deal negotiation leaves a native Truthtrance priority response resumable', () => {
  const initial = knowledgeGame();
  const card = initial.players[0].hand.find(item => item.effect === 'truthtrance');
  assert.ok(card);
  const paused = applyAction(initial, 'a', { type: 'card', card: card.id });
  assert.equal(paused.truthtrance?.stage, 'priority');
  const original = structuredClone(paused.truthtrance);
  const before = preservedRules(paused);
  const proposal = offer(paused, 'b', 'f');
  assert.deepEqual(proposal.game.truthtrance, original);
  assert.deepEqual(preservedRules(proposal.game), before);
  const declined = applyAction(proposal.game, 'f', { type: 'dealRespond', deal: proposal.deal.id, accept: false });
  assert.deepEqual(declined.truthtrance, original);
  const passer = declined.players.find(player => !declined.truthtrance!.passed.includes(player.id));
  assert.ok(passer);
  const resumed = applyAction(declined, passer.id, { type: 'truthPass' });
  assert.ok(resumed.truthtrance);
  assert.ok(resumed.truthtrance.passed.includes(passer.id));
});
