import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES } from '../game/bot-profiles';
import { FACTIONS, type FactionId } from '../game/catalog';
import {
  applyAction,
  createGame,
  joinGame,
  newPlayer,
  type Game,
} from '../game/engine';
import { quoteLobbyBotConfiguration } from '../game/lobby-bot-configuration';

const allExpansions = ['ix', 'choam', 'ecaz'];

function lobby() {
  const game = createGame(
    'BOTCONFIG',
    newPlayer('host', 'Host', 'atreides'),
    false,
    allExpansions,
  );
  const bot = newPlayer('bot', 'Harkonnen AI', 'harkonnen');
  bot.bot = 'Easy';
  joinGame(game, bot);
  const human = newPlayer('human', 'Human', 'emperor');
  joinGame(game, human);
  const otherBot = newPlayer('other-bot', 'Fremen AI', 'fremen');
  otherBot.bot = 'Medium';
  joinGame(game, otherBot);
  return game;
}

function action(
  overrides: Partial<{
    type: string;
    target: string;
    difficulty: string;
    faction: string;
    position: number;
  }> = {},
) {
  return {
    type: 'configureBot',
    target: 'bot',
    difficulty: 'Hard',
    faction: 'harkonnen',
    position: 2,
    ...overrides,
  };
}

function context(game: Game) {
  return {
    status: game.status,
    host: game.host,
    players: game.players,
    expansions: game.expansions,
    positions: game.playerPositions!,
  };
}

void test('quote admits every faction with its expansion and all four current AI profiles', () => {
  for (const [index, entry] of FACTIONS.entries()) {
    const target = {
      id: 'bot',
      faction: entry.id,
      bot: DIFFICULTIES[index % DIFFICULTIES.length],
    };
    const quote = quoteLobbyBotConfiguration(
      {
        status: 'lobby',
        host: 'host',
        players: [
          {
            id: 'host',
            faction: entry.id === 'atreides' ? 'guild' : 'atreides',
          },
          target,
        ],
        expansions: allExpansions,
        positions: { host: 1, bot: 2 },
      },
      'host',
      action({
        difficulty: DIFFICULTIES[(index + 1) % DIFFICULTIES.length],
        faction: entry.id,
      }),
    );
    assert.equal(quote.ok, true, entry.id);
    if (quote.ok) {
      assert.equal(quote.configuration.faction, entry.id);
      assert.equal(quote.changed, true);
    }
  }
});

void test('quote is strict, host-only, lobby-only and requires a permanent bot', () => {
  const game = lobby();
  const valid = action();
  const checks: Array<[unknown, string, string]> = [
    [valid, 'human', 'Only the host'],
    [{ ...valid, extra: true }, 'host', 'only the AI seat'],
    [{ ...valid, type: 'ready' }, 'host', 'only the AI seat'],
    [{ ...valid, target: 'human' }, 'host', 'permanent AI'],
    [{ ...valid, target: 'missing' }, 'host', 'permanent AI'],
    [{ ...valid, difficulty: 'Impossible' }, 'host', 'valid AI difficulty'],
    [{ ...valid, faction: 'unknown' }, 'host', 'valid faction'],
    [{ ...valid, position: 2.5 }, 'host', 'integer'],
    [{ ...valid, position: 7 }, 'host', 'integer'],
  ];
  for (const [input, actor, reason] of checks) {
    const quote = quoteLobbyBotConfiguration(context(game), actor, input);
    assert.equal(quote.ok, false);
    if (!quote.ok) assert.match(quote.reason, new RegExp(reason, 'i'));
  }
  for (const status of ['setup', 'playing', 'finished']) {
    const quote = quoteLobbyBotConfiguration(
      { ...context(game), status },
      'host',
      valid,
    );
    assert.deepEqual(quote, {
      ok: false,
      reason: 'AI seats can be configured only in the lobby.',
    });
  }
});

void test('quote permits the bot current faction and circle but rejects occupied or disabled choices', () => {
  const game = lobby();
  const same = quoteLobbyBotConfiguration(
    context(game),
    'host',
    action({ difficulty: 'Easy' }),
  );
  assert.deepEqual(same, {
    ok: true,
    configuration: {
      target: 'bot',
      difficulty: 'Easy',
      faction: 'harkonnen',
      position: 2,
    },
    changed: false,
  });
  for (const [input, reason] of [
    [action({ faction: 'emperor' }), 'taken'],
    [action({ position: 3 }), 'occupied'],
  ] as const) {
    const quote = quoteLobbyBotConfiguration(context(game), 'host', input);
    assert.equal(quote.ok, false);
    if (!quote.ok) assert.match(quote.reason, new RegExp(reason, 'i'));
  }
  const disabled = quoteLobbyBotConfiguration(
    { ...context(game), expansions: [] },
    'host',
    action({ faction: 'ixians' }),
  );
  assert.equal(disabled.ok, false);
  if (!disabled.ok) assert.match(disabled.reason, /disabled/i);
});

void test('engine applies all configured fields, preserves custody and records readiness publicly', () => {
  const game = lobby();
  const target = game.players.find((player) => player.id === 'bot')!;
  target.spice = 17;
  target.reserves = 13;
  target.tanks = 2;
  target.forces = { 'arrakeen:9': 5 };
  target.traitors = ['atreides-0'];
  target.ready = false;
  game.players.find((player) => player.id === 'host')!.ready = true;
  game.players.find((player) => player.id === 'human')!.ready = true;
  game.players.find((player) => player.id === 'other-bot')!.ready = false;
  const beforeOtherBot = structuredClone(
    game.players.find((player) => player.id === 'other-bot')!,
  );
  const configured = applyAction(
    game,
    'host',
    action({ difficulty: 'Brutal', faction: 'ixians', position: 5 }),
  );
  const changed = configured.players.find((player) => player.id === 'bot')!;
  assert.equal(changed.id, target.id);
  assert.equal(changed.name, 'Ixians AI');
  assert.equal(changed.bot, 'Brutal');
  assert.equal(changed.faction, 'ixians');
  assert.equal(configured.playerPositions![changed.id], 5);
  assert.deepEqual(
    {
      spice: changed.spice,
      reserves: changed.reserves,
      tanks: changed.tanks,
      forces: changed.forces,
      traitors: changed.traitors,
    },
    {
      spice: 17,
      reserves: 13,
      tanks: 2,
      forces: { 'arrakeen:9': 5 },
      traitors: ['atreides-0'],
    },
  );
  assert.equal(
    configured.players.find((player) => player.id === 'host')!.ready,
    false,
  );
  assert.equal(
    configured.players.find((player) => player.id === 'human')!.ready,
    false,
  );
  assert.equal(changed.ready, true);
  assert.deepEqual(
    configured.players.find((player) => player.id === 'other-bot'),
    { ...beforeOtherBot, ready: true },
  );
  assert.match(
    configured.log.at(-1)!.text,
    /Host configured Harkonnen AI: difficulty Easy to Brutal; faction Harkonnen to Ixians; player circle 2 to 5\. Human readiness was cleared; AI seats remain ready\./,
  );
  assert.notDeepEqual(configured, game);
  assert.equal(target.faction, 'harkonnen');
  assert.equal(target.bot, 'Easy');
});

void test('every faction change installs the same physical leader and elite roster as a new seat', () => {
  for (const entry of FACTIONS) {
    const hostFaction: FactionId =
      entry.id === 'atreides' ? 'harkonnen' : 'atreides';
    const initialFaction: FactionId =
      entry.id === 'emperor' ? 'fremen' : 'emperor';
    const game = createGame(
      `ROSTER${entry.id}`,
      newPlayer('host', 'Host', hostFaction),
      false,
      allExpansions,
    );
    const bot = newPlayer('bot', `${initialFaction} AI`, initialFaction);
    bot.bot = 'Medium';
    joinGame(game, bot);
    const configured = applyAction(
      game,
      'host',
      action({ faction: entry.id, difficulty: 'Medium' }),
    );
    const changed = configured.players.find((player) => player.id === 'bot')!;
    const fresh = newPlayer('fresh', 'Fresh', entry.id);
    assert.deepEqual(changed.leaders, fresh.leaders, entry.id);
    assert.deepEqual(changed.elites, fresh.elites, entry.id);
  }
});

void test('difficulty or circle changes preserve the bot name until its faction changes', () => {
  const game = lobby();
  game.players.find((player) => player.id === 'bot')!.name = 'Custom AI name';
  const configured = applyAction(
    game,
    'host',
    action({ difficulty: 'Brutal', position: 5 }),
  );
  const bot = configured.players.find((player) => player.id === 'bot')!;
  assert.equal(bot.name, 'Custom AI name');
  assert.match(
    configured.log.at(-1)!.text,
    /difficulty Easy to Brutal; player circle 2 to 5/,
  );
  assert.doesNotMatch(configured.log.at(-1)!.text, /faction/i);
});

void test('identical configuration is a clone-only no-op and rejected engine actions are immutable', () => {
  const game = lobby();
  game.players.find((player) => player.id === 'host')!.ready = true;
  game.players.find((player) => player.id === 'bot')!.ready = false;
  const same = applyAction(
    game,
    'host',
    action({ difficulty: 'Easy', faction: 'harkonnen', position: 2 }),
  );
  assert.notEqual(same, game);
  assert.deepEqual(same, game);

  for (const [actor, attempted] of [
    ['human', action()],
    ['host', action({ target: 'human' })],
    ['host', { ...action(), extra: true }],
  ] as const) {
    const before = JSON.stringify(game);
    assert.throws(
      () => applyAction(game, actor, attempted),
      /host|permanent|only/i,
    );
    assert.equal(JSON.stringify(game), before);
  }
  for (const status of ['setup', 'playing', 'finished'] as const) {
    const outside = structuredClone(game);
    outside.status = status;
    const before = JSON.stringify(outside);
    assert.throws(() => applyAction(outside, 'host', action()));
    assert.equal(JSON.stringify(outside), before);
  }
});
