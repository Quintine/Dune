import type { DatabaseSync } from 'node:sqlite';
import { initializeIxGameForAudit, viewGame, type Game } from '../game/engine';

/** Local development only. This cannot create a seat, change its owner, or
 * redeal a started game. The caller backs up the database before invoking it. */
export function startIxPrototypeRoom(
  db: DatabaseSync,
  code: string,
  expectedVersion: number,
) {
  if (
    !/^[A-Z0-9]{8}$/.test(code) ||
    !Number.isSafeInteger(expectedVersion) ||
    expectedVersion < 0
  )
    throw new Error('Provide an eight-character room and its current version.');
  const row = db
    .prepare('SELECT state, version FROM rooms WHERE code = ?')
    .get(code);
  if (!row || typeof row.state !== 'string' || row.version !== expectedVersion)
    throw new Error(
      'The room is missing or changed. Refresh before starting the prototype.',
    );
  const initial = JSON.parse(row.state) as Game;
  if (initial.code !== code)
    throw new Error('The room identity is inconsistent.');
  const game = initializeIxGameForAudit(initial);
  // Exercise the same player projection before accepting the new saved state.
  for (const player of game.players) viewGame(game, player.id);
  const version = expectedVersion + 1;
  game.version = version;
  const result = db
    .prepare(
      'UPDATE rooms SET state = ?, version = ?, updated_at = ? WHERE code = ? AND version = ? AND state = ?',
    )
    .run(
      JSON.stringify(game),
      version,
      Date.now(),
      code,
      expectedVersion,
      row.state,
    );
  if (result.changes !== 1)
    throw new Error('The lobby changed during setup. No prototype was saved.');
  return {
    code,
    version,
    status: game.status,
    advanced: game.advanced,
    players: game.players.length,
  };
}
