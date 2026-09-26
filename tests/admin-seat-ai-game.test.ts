import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { DIFFICULTIES } from '../game/bot-profiles';
import { enableAdminSeatAi, projectAdminSeatAi, seatAiGame, seatAiUnavailable } from '../game/admin-seat-ai';
import { adminSeatAiCoreShape } from '../game/admin-seat-ai-shape';
import type { FactionId } from '../game/catalog';

const restore = (game: Game): Game => JSON.parse(JSON.stringify(game));
const base = { code: 'SEATQAAB', version: 2, controlRevision: 1, paused: true, closed: false, removed: false, archived: false };
const factions: FactionId[] = ['atreides','harkonnen','emperor','fremen','guild','beneGesserit'];
function start(roster: FactionId[] = ['atreides','emperor'], advanced = false) {
  let game = createGame(base.code, newPlayer(roster[0], roster[0], roster[0]), advanced);
  for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  return applyAction(game, game.host, { type: 'start', ...(advanced ? { advancedPreview: true } : {}) });
}

void test('participant AI preserves genuine Basic and Advanced preview setup and saved continuation', () => {
  for (const advanced of [false, true]) for (const roster of [['atreides','emperor'], factions] as FactionId[][]) {
    let game = start(roster, advanced), steps = 0;
    do {
      assert.ok(seatAiGame(restore(game), base.code), `${advanced}: ${game.setupStage}`);
      for (const difficulty of DIFFICULTIES) {
        const snapshot = restore(game), before = restore(snapshot);
        snapshot.botsPending = true; snapshot.botNextActionAt = 50_000;
        const next = enableAdminSeatAi(snapshot, game.host, difficulty);
        assert.equal(next.players[0].autopilot, difficulty);
        assert.equal(next.botsPending, true); assert.equal(next.botNextActionAt, 50_000);
        const expected = restore(snapshot);
        expected.players[0].autopilot = difficulty;
        expected.log.push(next.log.at(-1)!);
        assert.deepEqual(next, expected, 'Only the chosen controller and truthful event change');
        assert.deepEqual(snapshot, { ...before, botsPending: true, botNextActionAt: 50_000 }, 'Source stays immutable');
        assert.match(next.log.at(-1)!.text, /administrator enabled.*room remains paused/);
        assert.doesNotThrow(() => viewGame(restore(next), game.host));
      }
      if (game.status !== 'setup') break;
      const owner = viewGame(game, game.host).setupPending[0];
      assert.ok(owner);
      const view = viewGame(game, owner);
      view.players.find(player => player.id === owner)!.bot = 'Easy';
      let next: Game | undefined;
      for (const action of botActions(view)) { try { next = applyAction(game, owner, action); break; } catch { /* Choose a legal setup action. */ } }
      assert.ok(next, 'Every setup obligation has a legal continuation');
      game = restore(next);
    } while (++steps < 30);
    assert.equal(game.status, 'playing');
  }
});

void test('malformed saved core and continuation fail closed without exposing or repairing private state', () => {
  const genuine = start();
  const cases: [string, (game: Record<string, unknown>) => void][] = [
    ['deck', game => { delete game.deck; }], ['private hand', game => { delete (game.players as Record<string, unknown>[])[0].hand; }],
    ['negative reserves', game => { (game.players as Record<string, unknown>[])[0].reserves = -5; }],
    ['phase', game => { game.phase = 999; }], ['storm 0', game => { game.storm = 0; }], ['storm 19', game => { game.storm = 19; }],
    ['unknown decision', game => { game.decision = { kind: 'private-invalid', player: genuine.host }; }],
    ...['auction','stormResolution','spiceWindow','spiceSequence','spiceResolution','pendingCapture','karamaShipping'].map(key => [key, (game: Record<string, unknown>) => { game[key] = {}; }] as [string, (game: Record<string, unknown>) => void]),
    ['aid', game => { game.aid = { [genuine.host]: null }; }],
  ];
  for (const [name, corrupt] of cases) {
    const game = restore(genuine); corrupt(game as unknown as Record<string, unknown>);
    const before = restore(game);
    assert.equal(seatAiGame(game, base.code), false, name);
    assert.throws(() => enableAdminSeatAi(game, game.host, 'Easy'), { message: seatAiUnavailable }, name);
    assert.deepEqual(game, before, name);
    assert.deepEqual(projectAdminSeatAi(base, game, new Set([game.host])), { ...base, status: 'unreadable', players: [], editable: false, blockedReason: seatAiUnavailable });
  }
});

void test('core domain permits sector 18 and repeated territory ride destinations and storm force locations', () => {
  const game = start(); game.storm = 18;
  assert.ok(game.spiceDeck.some(card => 'sector' in card && card.sector === 18));
  game.wormRides = ['red_chasm','red_chasm'];
  game.stormResolution = { from: 18, distance: 3, traversed: 1, pending: ['red_chasm:1'] };
  assert.equal(adminSeatAiCoreShape(restore(game)), true);
});

void test('admin projection includes only public participant fields and eligibility requires current access', () => {
  const game = start(); game.players[1].autopilot = 'Medium';
  const view = projectAdminSeatAi(base, game, new Set([game.host]));
  assert.equal(view.editable, true);
  assert.deepEqual(view.players[0], { id: game.host, name: game.players[0].name, faction: game.players[0].faction, control: 'human', difficulty: null, eligible: true });
  assert.equal(view.players[1].eligible, false);
  assert.deepEqual(Object.keys(view.players[1]).sort(), ['control','difficulty','eligible','faction','id','name']);
  assert.equal(projectAdminSeatAi(base, game, new Set()).players[0].eligible, false);
  for (const flags of [{ paused: false }, { removed: true }, { closed: true }, { archived: true }]) {
    const blocked = projectAdminSeatAi({ ...base, ...flags }, game, new Set([game.host]));
    assert.equal(blocked.editable, false); assert.ok(blocked.blockedReason);
  }
  for (const status of ['lobby','finished'] as const) {
    const blocked = projectAdminSeatAi(base, { ...game, status }, new Set([game.host]));
    assert.equal(blocked.editable, false);
  }
});

void test('participant controller change preserves capped chronicle sequence and cannot replace an existing controller', () => {
  const game = start(); game.log = Array.from({ length: 250 }, (_, index) => ({ seq: index + 20, text: `Saved event ${index}` }));
  const next = enableAdminSeatAi(game, game.host, 'Brutal');
  assert.equal(next.log.length, 250); assert.deepEqual(next.log.slice(0, -1), game.log.slice(1));
  assert.equal(next.log.at(-1)!.seq, 270);
  assert.throws(() => enableAdminSeatAi(next, game.host, 'Easy'), { message: seatAiUnavailable });
  const bot = restore(game); bot.players[0].bot = 'Easy';
  assert.throws(() => enableAdminSeatAi(bot, game.host, 'Easy'), { message: seatAiUnavailable });
});
