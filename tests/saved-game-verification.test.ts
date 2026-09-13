import test from 'node:test';
import assert from 'node:assert/strict';
import * as sqlite from 'node:sqlite';
import { mkdtempSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  captureSavedGames,
  compareSavedGames,
  loadSavedGameSnapshot,
  readSavedGames,
} from '../tools/saved-game-verification';

function fixture(t: test.TestContext) {
  const area = mkdtempSync(join(tmpdir(), 'dune-preservation-'));
  const root = join(area, 'repo');
  mkdirSync(root);
  const path = join(root, 'games.sqlite'),
    db = new sqlite.DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE rooms(code TEXT PRIMARY KEY, version INTEGER, state TEXT); INSERT INTO rooms VALUES('ABCDEFGH', 2, '{\"privateHand\":[1]}')",
  );
  t.after(() => {
    db.close();
    rmSync(area, { recursive: true, force: true });
  });
  return { area, root, path, db };
}

void test('preservation allows new rooms but detects changed state, versions and missing originals', (t) => {
  const { path, db } = fixture(t),
    baseline = readSavedGames(path);
  db.exec("INSERT INTO rooms VALUES('BCDEFGHJ', 0, '{}')");
  const added = compareSavedGames(baseline, readSavedGames(path));
  assert.equal(added.preserved, true);
  assert.equal(added.added, 1);
  db.exec("UPDATE rooms SET version=3 WHERE code='ABCDEFGH'");
  assert.equal(
    compareSavedGames(baseline, readSavedGames(path)).preserved,
    false,
  );
  db.exec("UPDATE rooms SET version=2, state='{}' WHERE code='ABCDEFGH'");
  assert.deepEqual(compareSavedGames(baseline, readSavedGames(path)).changed, [
    'ABCDEFGH',
  ]);
  db.exec("DELETE FROM rooms WHERE code='ABCDEFGH'");
  assert.deepEqual(compareSavedGames(baseline, readSavedGames(path)).missing, [
    'ABCDEFGH',
  ]);
});

void test('private snapshot stores hashes and cannot overwrite an earlier baseline', async (t) => {
  const { area, root, path } = fixture(t),
    out = join(area, 'snapshot');
  const result = await captureSavedGames(root, path, out);
  assert.deepEqual(loadSavedGameSnapshot(join(out, 'snapshot.json')), result);
  assert.equal(JSON.stringify(result).includes('privateHand'), false);
  assert.equal(statSync(join(out, 'snapshot.json')).mode & 0o777, 0o600);
  await assert.rejects(captureSavedGames(root, path, out));
  assert.deepEqual(loadSavedGameSnapshot(join(out, 'snapshot.json')), result);
  assert.throws(
    () =>
      compareSavedGames(
        { ...result, rooms: [...result.rooms, ...result.rooms] },
        result,
      ),
    /Invalid/,
  );
});

void test('missing source never creates a database or output', async (t) => {
  const { area, root } = fixture(t),
    missing = join(area, 'missing.sqlite'),
    out = join(area, 'out');
  await assert.rejects(captureSavedGames(root, missing, out));
  assert.equal(existsSync(missing), false);
  assert.equal(existsSync(out), false);
});

void test(
  'online backup includes WAL state and leaves the live database untouched',
  { skip: typeof sqlite.backup !== 'function' },
  async (t) => {
    const { area, root, path, db } = fixture(t),
      out = join(area, 'backup');
    db.exec("INSERT INTO rooms VALUES('CDEFGHJK', 4, '{\"pending\":true}')");
    const before = readSavedGames(path),
      snapshot = await captureSavedGames(root, path, out, true);
    assert.equal(compareSavedGames(before, snapshot).preserved, true);
    assert.equal(snapshot.rooms.length, 2);
    assert.equal(
      compareSavedGames(snapshot, readSavedGames(join(out, 'games.sqlite')))
        .preserved,
      true,
    );
    assert.equal(
      compareSavedGames(before, readSavedGames(path)).preserved,
      true,
    );
    assert.equal(statSync(join(out, 'games.sqlite')).mode & 0o777, 0o600);
  },
);
