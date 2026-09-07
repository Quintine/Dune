import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createDukeVidal } from '../game/duke-vidal';
import { LEADER_ART, leaderArt } from '../game/leader-art';
import {
  SPECIAL_LEADER_ART,
  specialLeaderArt,
} from '../game/special-leader-art';

const duke = createDukeVidal().leader;
const manifest = JSON.parse(
  readFileSync(
    new URL('../public/art/leaders/special-generation.json', import.meta.url),
    'utf8',
  ),
) as {
  tool: string;
  assets: {
    id: string;
    name: string;
    strength: number;
    path: string;
    prompt: string;
    sourcePath: string;
    styleReference: string;
  }[];
};

void test('Duke portrait resolves the canonical shared identity without entering ordinary rosters', () => {
  const art = specialLeaderArt(duke.id, duke.name);
  assert.ok(art);
  assert.equal(art.id, duke.id);
  assert.equal(art.name, duke.name);
  assert.equal(duke.strength, 6);
  assert.deepEqual(
    Object.keys(SPECIAL_LEADER_ART).sort(),
    ['choam-auditor', duke.id].sort(),
  );
  assert.equal(leaderArt(duke.id, duke.name), undefined);
  for (const ordinary of Object.values(LEADER_ART))
    assert.equal(specialLeaderArt(ordinary.id, ordinary.name), undefined);
});

void test('special portrait lookup rejects missing mismatched hidden and inherited identities', () => {
  for (const id of [
    undefined,
    '',
    'ecaz-5',
    'constructor',
    '__proto__',
    'toString',
  ])
    assert.equal(specialLeaderArt(id, duke.name), undefined);
  for (const name of [
    '',
    'Hidden identity',
    'Duke Vidal',
    'duke prad vidal',
    `${duke.name} `,
  ])
    assert.equal(specialLeaderArt(duke.id, name), undefined);
  assert.equal(
    specialLeaderArt('choam-auditor', 'Auditor')?.src,
    '/art/leaders/choam-auditor-v1.png',
  );
  assert.equal(specialLeaderArt('kwisatz', 'Kwisatz Haderach'), undefined);
});

void test('special portrait provenance matches its canonical disc and separate selected asset', () => {
  assert.equal(manifest.tool, 'Built-in image_gen');
  assert.equal(manifest.assets.length, 1);
  const record = manifest.assets[0];
  const art = specialLeaderArt(duke.id, duke.name)!;
  assert.equal(record.id, duke.id);
  assert.equal(record.name, duke.name);
  assert.equal(record.strength, duke.strength);
  assert.equal(record.path, art.src);
  assert.ok(record.prompt.includes(duke.name));
  assert.ok(record.styleReference.includes('only'));
  assert.match(record.sourcePath, /\/generated_images\/.+\.png$/);
  const ordinary = JSON.parse(
    readFileSync(
      new URL('../public/art/leaders/generation.json', import.meta.url),
      'utf8',
    ),
  ) as { assets: { id: string; path: string }[] };
  assert.equal(
    ordinary.assets.some(
      (entry) => entry.id === record.id || entry.path === record.path,
    ),
    false,
  );
});

void test('Duke is a distinct local opaque1254px RGB portrait with valid circular crop coordinates', () => {
  const art = specialLeaderArt(duke.id, duke.name)!;
  assert.equal(art.src, '/art/leaders/duke-vidal-v1.png');
  const position = /^(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/.exec(
    art.objectPosition,
  );
  assert.ok(position);
  assert.ok(
    position
      .slice(1)
      .every((value) => Number(value) >= 0 && Number(value) <= 100),
  );
  const png = readFileSync(new URL(`../public${art.src}`, import.meta.url));
  assert.deepEqual(
    png.subarray(0, 8),
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  assert.equal(png.toString('ascii', 12, 16), 'IHDR');
  assert.equal(png.readUInt32BE(16), 1254);
  assert.equal(png.readUInt32BE(20), 1254);
  assert.equal(png[24], 8);
  assert.equal(png[25], 2);
  assert.equal(png.toString('ascii', png.length - 8, png.length - 4), 'IEND');
  const hash = createHash('sha256').update(png).digest('hex');
  for (const ordinary of Object.values(LEADER_ART)) {
    const old = readFileSync(
      new URL(`../public${ordinary.src}`, import.meta.url),
    );
    assert.notEqual(
      hash,
      createHash('sha256').update(old).digest('hex'),
      ordinary.id,
    );
  }
});
