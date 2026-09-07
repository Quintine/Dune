import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { leaders } from '../game/cards';
import { FACTIONS } from '../game/catalog';
import { LEADER_ART, leaderArt } from '../game/leader-art';

type GenerationEntry = {
  id: string;
  path: string;
  prompt: string;
  name?: string;
  strength?: number;
  correctionPrompt?: string;
};
const manifest = JSON.parse(
  readFileSync(
    new URL('../public/art/leaders/generation.json', import.meta.url),
    'utf8',
  ),
) as { tool: string; assets: GenerationEntry[] };
const canonical = new Map(
  FACTIONS.flatMap((f) => leaders(f.id)).map((leader) => [leader.id, leader]),
);

void test('portrait registry identities agree with all sixty canonical ordinary leaders across twelve factions', () => {
  for (const [id, art] of Object.entries(LEADER_ART)) {
    assert.equal(art.id, id);
    assert.equal(art.name, canonical.get(id)?.name, id);
    assert.equal(leaderArt(id, art.name), art);
  }
  for (const faction of [
    'atreides',
    'harkonnen',
    'emperor',
    'fremen',
    'guild',
    'beneGesserit',
    'ixians',
    'tleilaxu',
    'choam',
    'richese',
    'ecaz',
    'moritani',
  ] as const)
    for (const leader of leaders(faction))
      assert.ok(leaderArt(leader.id, leader.name), leader.id);
  assert.ok(leaderArt('beneGesserit-2', 'Princess Irulan'));
});

void test('portrait lookup requires an exact supplied identity and does not resolve hidden or inherited names', () => {
  for (const art of Object.values(LEADER_ART)) {
    assert.equal(leaderArt(undefined, art.name), undefined);
    assert.equal(leaderArt(art.id, 'Hidden identity'), undefined);
    assert.equal(leaderArt(art.id, art.name + ' '), undefined);
    assert.equal(leaderArt(art.id, art.name.toLowerCase()), undefined);
  }
  for (const id of [
    '',
    'unknown-leader',
    '__proto__',
    'constructor',
    'toString',
  ])
    assert.equal(leaderArt(id, 'Staban Tuek'), undefined);
  assert.equal(leaderArt('duke-vidal', 'Duke Prad Vidal'), undefined);
  assert.equal(leaderArt('choam-auditor', 'Auditor'), undefined);
});

void test('each selected portrait has one matching generation record with canonical optional metadata', () => {
  assert.equal(manifest.tool, 'Built-in image_gen');
  assert.equal(
    new Set(manifest.assets.map((a) => a.id)).size,
    manifest.assets.length,
  );
  assert.equal(
    new Set(manifest.assets.map((a) => a.path)).size,
    manifest.assets.length,
  );
  assert.deepEqual(
    manifest.assets.map((a) => a.id).sort(),
    Object.keys(LEADER_ART).sort(),
  );
  for (const record of manifest.assets) {
    assert.equal(record.path, LEADER_ART[record.id].src);
    assert.ok(record.prompt.trim().length > 0, record.id);
    if (record.correctionPrompt !== undefined)
      assert.ok(record.correctionPrompt.trim().length > 0);
    if (record.name !== undefined)
      assert.equal(record.name, canonical.get(record.id)!.name);
    if (record.strength !== undefined)
      assert.equal(record.strength, canonical.get(record.id)!.strength);
  }
});

void test('selected portrait assets are distinct local 1254px RGB PNGs with valid circular crop positions', () => {
  const hashes = new Set<string>();
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  for (const [id, art] of Object.entries(LEADER_ART)) {
    assert.match(art.src, /^\/art\/leaders\/[A-Za-z0-9-]+-v[1-9][0-9]*\.png$/);
    assert.ok(art.src.startsWith(`/art/leaders/${id}-v`));
    const position = /^(\d+(?:\.\d+)?)% (\d+(?:\.\d+)?)%$/.exec(
      art.objectPosition,
    );
    assert.ok(position, id);
    assert.ok(
      position
        .slice(1)
        .every((value) => Number(value) >= 0 && Number(value) <= 100),
    );
    const png = readFileSync(new URL(`../public${art.src}`, import.meta.url));
    assert.deepEqual(png.subarray(0, 8), signature, id);
    assert.equal(png.toString('ascii', 12, 16), 'IHDR', id);
    assert.equal(png.readUInt32BE(16), 1254, id);
    assert.equal(png.readUInt32BE(20), 1254, id);
    assert.equal(png[24], 8, 'Eight bits per color channel');
    assert.equal(png[25], 2, 'Opaque RGB, without a palette or alpha channel');
    assert.equal(
      png.toString('ascii', png.length - 8, png.length - 4),
      'IEND',
      id,
    );
    const hash = createHash('sha256').update(png).digest('hex');
    assert.equal(
      hashes.has(hash),
      false,
      `${id} duplicates another leader's portrait`,
    );
    hashes.add(hash);
  }
});
