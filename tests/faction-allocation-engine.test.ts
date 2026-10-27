import test from 'node:test';
import assert from 'node:assert/strict';
import { FACTIONS, type FactionId } from '../game/catalog';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';

function lobby(): Game {
  const game = createGame('ALLOCATE', newPlayer('host', 'Host', 'atreides'));
  joinGame(game, newPlayer('guest', 'Guest', 'harkonnen'));
  joinGame(game, newPlayer('other', 'Other', 'emperor'));
  return game;
}
function rejectUnchanged(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, before, 'Rejected allocation cannot mutate the shared lobby');
}
function identity(game: Game) {
  return game.players.map(player => ({ id: player.id, name: player.name, bot: player.bot }));
}
function selected(game: Game) {
  return game.players.map(player => ({ id: player.id, faction: player.faction,
    leaders: player.leaders.map(leader => ({ id: leader.id, faction: leader.faction })) }));
}
function nextFaction(used: readonly string[]): FactionId {
  return FACTIONS.find(faction => faction.expansion === 'base' && !used.includes(faction.id))!.id;
}

void test('host random allocation assigns distinct enabled factions while preserving seat identity and clearing readiness', () => {
  let game = lobby();
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  const beforeSeats = identity(game), beforeHost = game.host, beforePositions = structuredClone(game.playerPositions);
  rejectUnchanged(game, 'guest', { type: 'factionAllocation', mode: 'random' });
  rejectUnchanged(game, 'host', { type: 'factionAllocation', mode: 'invalid' });
  const next = applyAction(game, 'host', { type: 'factionAllocation', mode: 'random' });
  assert.equal(next.status, 'lobby');
  assert.equal(next.host, beforeHost);
  assert.deepEqual(identity(next), beforeSeats);
  assert.deepEqual(next.playerPositions, beforePositions);
  assert.equal(new Set(next.players.map(player => player.faction)).size, next.players.length);
  assert.ok(next.players.every(player => FACTIONS.some(faction => faction.id === player.faction && faction.expansion === 'base')));
  assert.ok(next.players.every(player => !player.ready));
  assert.ok(next.players.every(player => player.leaders.every(leader => leader.faction === player.faction)));
  assert.ok(!next.factionDraft);
  let ready = next;
  for (const player of ready.players) ready = applyAction(ready, player.id, { type: 'ready' });
  const started = applyAction(ready, 'host', { type: 'start' });
  assert.equal(started.status, 'setup');
});

void test('draft gives distinct descending order cards and commits faction choices only after the last pick', () => {
  let game = lobby();
  const original = selected(game), seats = identity(game), positions = structuredClone(game.playerPositions);
  game = applyAction(game, 'host', { type: 'factionAllocation', mode: 'draft' });
  const draft = game.factionDraft!;
  assert.ok(draft && typeof draft.event === 'string' && draft.event.length);
  assert.equal(draft.order.length, game.players.length);
  assert.deepEqual(new Set(draft.order.map(item => item.player)), new Set(game.players.map(player => player.id)));
  assert.equal(new Set(draft.order.map(item => item.card)).size, draft.order.length);
  assert.ok(draft.order.every(item => Number.isInteger(item.card) && item.card >= 1 && item.card <= 10));
  assert.deepEqual(draft.order.map(item => item.card), draft.order.map(item => item.card).sort((a, b) => b - a));
  assert.deepEqual(draft.picks, []);
  assert.deepEqual(selected(game), original);
  assert.ok(game.players.every(player => !player.ready));
  assert.equal(game.host, 'host');
  assert.deepEqual(identity(game), seats);
  assert.deepEqual(game.playerPositions, positions);
  const current = draft.order[0].player;
  const other = draft.order.find(item => item.player !== current)!.player;
  rejectUnchanged(game, other, { type: 'factionDraftPick', event: draft.event, faction: 'guild' });
  rejectUnchanged(game, current, { type: 'factionDraftPick', event: `${draft.event}:stale`, faction: 'guild' });
  rejectUnchanged(game, current, { type: 'factionDraftPick', event: draft.event, faction: 'ixians' });
  rejectUnchanged(game, 'host', { type: 'faction', faction: 'guild' });
  rejectUnchanged(game, 'host', { type: 'start' });
  rejectUnchanged(game, 'host', { type: 'rules', advanced: true });
  const beforeJoin = structuredClone(game);
  assert.throws(() => joinGame(game, newPlayer('late', 'Late', 'guild')));
  assert.deepEqual(game, beforeJoin);

  let used: FactionId[] = [];
  for (let index = 0; index < draft.order.length; index++) {
    const state = game.factionDraft!;
    const actor = draft.order[index].player;
    const chosen = nextFaction(used);
    game = applyAction(game, actor, { type: 'factionDraftPick', event: state.event, faction: chosen });
    used = [...used, chosen];
    if (index + 1 < draft.order.length) {
      assert.deepEqual(selected(game), original, 'An incomplete draft cannot partly change factions');
      assert.deepEqual(game.factionDraft!.picks.map(pick => pick.faction), used);
      const next = draft.order[index + 1].player;
      rejectUnchanged(game, next, { type: 'factionDraftPick', event: state.event, faction: chosen });
    }
  }
  assert.ok(!game.factionDraft);
  assert.deepEqual(identity(game), seats);
  assert.deepEqual(game.playerPositions, positions);
  for (let index = 0; index < draft.order.length; index++)
    assert.equal(game.players.find(player => player.id === draft.order[index].player)!.faction, used[index]);
  assert.ok(game.players.every(player => !player.ready));
  assert.ok(game.players.every(player => player.leaders.every(leader => leader.faction === player.faction)));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  assert.equal(applyAction(game, 'host', { type: 'start' }).status, 'setup');
});

void test('host can cancel an in-progress draft without changing factions or transferring seats', () => {
  let game = lobby();
  const original = selected(game), seats = identity(game);
  game = applyAction(game, 'host', { type: 'factionAllocation', mode: 'draft' });
  const event = game.factionDraft!.event;
  const actor = game.factionDraft!.order[0].player;
  game = applyAction(game, actor, { type: 'factionDraftPick', event, faction: 'guild' });
  rejectUnchanged(game, 'guest', { type: 'factionDraftCancel', event });
  rejectUnchanged(game, 'host', { type: 'factionDraftCancel', event: `${event}:stale` });
  const canceled = applyAction(game, 'host', { type: 'factionDraftCancel', event });
  assert.ok(!canceled.factionDraft);
  assert.deepEqual(selected(canceled), original);
  assert.deepEqual(identity(canceled), seats);
  rejectUnchanged(canceled, actor, { type: 'factionDraftPick', event, faction: 'guild' });
});

void test('bots choose a legal available faction during the same draft and remain ready', () => {
  let game = createGame('ALLOCBOT', newPlayer('host', 'Host', 'atreides'));
  game = applyAction(game, 'host', { type: 'addBot', faction: 'harkonnen', difficulty: 'Easy' });
  joinGame(game, newPlayer('guest', 'Guest', 'emperor'));
  const bot = game.players.find(player => player.bot)!.id;
  const seats = game.players.map(player => player.id);
  game = applyAction(game, 'host', { type: 'factionAllocation', mode: 'draft' });
  let botPicked = game.factionDraft!.picks.some(pick => pick.player === bot);
  for (let n = 0; game.factionDraft && n < seats.length; n++) {
    const draft = game.factionDraft!;
    const actor = draft.order[draft.picks.length].player;
    assert.notEqual(actor, bot, 'A pending draft must advance past every automatic AI turn');
    const botNext = draft.order[draft.picks.length + 1]?.player === bot;
    const used = draft.picks.map(pick => pick.faction);
    game = applyAction(game, actor, { type: 'factionDraftPick', event: draft.event, faction: nextFaction(used) });
    if (botNext) {
      if (game.factionDraft) assert.ok(game.factionDraft.picks.some(pick => pick.player === bot));
      botPicked = true;
    }
  }
  assert.equal(botPicked, true);
  assert.ok(!game.factionDraft);
  assert.deepEqual(game.players.map(player => player.id), seats);
  assert.equal(new Set(game.players.map(player => player.faction)).size, game.players.length);
  assert.equal(game.players.find(player => player.id === bot)!.ready, true);
  assert.equal(viewGame(game, 'host').players.find(player => player.id === bot)!.bot, 'Easy');
});
