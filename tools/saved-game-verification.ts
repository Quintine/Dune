import * as sqlite from 'node:sqlite';
import { createHash } from 'node:crypto';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { privateOutputDirectory } from './verification';

type RoomProof = { code: string; version: number; hash: string };
export type SavedGameSnapshot = {
  format: 1;
  capturedAt: string;
  rooms: RoomProof[];
};
export function readSavedGames(path: string): SavedGameSnapshot {
  const db = new sqlite.DatabaseSync(path, { readOnly: true });
  try {
    const rows = db
      .prepare('SELECT code, version, state FROM rooms ORDER BY code')
      .all();
    const rooms = rows.map((row) => {
      if (
        typeof row.code !== 'string' ||
        !Number.isSafeInteger(row.version) ||
        typeof row.state !== 'string'
      )
        throw new Error('Unexpected saved-game schema.');
      return {
        code: row.code,
        version: row.version as number,
        hash: createHash('sha256').update(row.state).digest('hex'),
      };
    });
    return { format: 1, capturedAt: new Date().toISOString(), rooms };
  } finally {
    db.close();
  }
}
export function compareSavedGames(
  baseline: SavedGameSnapshot,
  current: SavedGameSnapshot,
) {
  for (const snapshot of [baseline, current]) {
    if (
      snapshot?.format !== 1 ||
      !Array.isArray(snapshot.rooms) ||
      snapshot.rooms.some(
        (r) =>
          !r ||
          typeof r.code !== 'string' ||
          !Number.isSafeInteger(r.version) ||
          !/^[0-9a-f]{64}$/.test(r.hash),
      ) ||
      new Set(snapshot.rooms.map((r) => r.code)).size !== snapshot.rooms.length
    )
      throw new Error('Invalid saved-game baseline.');
  }
  const now = new Map(current.rooms.map((r) => [r.code, r])),
    before = new Set(baseline.rooms.map((r) => r.code));
  const missing = baseline.rooms
    .filter((r) => !now.has(r.code))
    .map((r) => r.code);
  const changed = baseline.rooms
    .filter(
      (r) =>
        now.has(r.code) &&
        (now.get(r.code)!.version !== r.version ||
          now.get(r.code)!.hash !== r.hash),
    )
    .map((r) => r.code);
  return {
    original: baseline.rooms.length,
    current: current.rooms.length,
    added: current.rooms.filter((r) => !before.has(r.code)).length,
    missing,
    changed,
    preserved: !missing.length && !changed.length,
  };
}
export async function captureSavedGames(
  root: string,
  database: string,
  output: string,
  withBackup = false,
) {
  // Validate without creating a missing database or destination directory.
  readSavedGames(database);
  if (withBackup && typeof sqlite.backup !== 'function')
    throw new Error('Online backup requires Node.js 22.16 or newer.');
  const directory = privateOutputDirectory(root, output);
  let snapshot: SavedGameSnapshot;
  if (withBackup) {
    const db = new sqlite.DatabaseSync(database, { readOnly: true });
    const destination = resolve(directory, 'games.sqlite');
    try {
      await sqlite.backup(db, destination);
    } finally {
      db.close();
    }
    chmodSync(destination, 0o600);
    snapshot = readSavedGames(destination); // Bind the baseline to the actual consistent backup.
  } else snapshot = readSavedGames(database);
  writeFileSync(
    resolve(directory, 'snapshot.json'),
    JSON.stringify(snapshot, null, 2) + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  return snapshot;
}
export function loadSavedGameSnapshot(path: string): SavedGameSnapshot {
  const snapshot = JSON.parse(readFileSync(path, 'utf8')) as SavedGameSnapshot;
  compareSavedGames(snapshot, snapshot);
  return snapshot;
}
