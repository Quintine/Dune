import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, newPlayer } from '../game/engine';
import { createHomeworldCustody, homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldContext } from '../game/homeworld-game';
import { homeworldRevivalDestinations, quoteHomeworldRevivalDestination } from '../game/homeworld-revival-destinations';
import type { HomeworldRevivalDeploymentQuote } from '../game/homeworld-revival-deployment';
import { createTerrorState, placeTerror } from '../game/moritani-terror';
import { createRicheseNoField, deployRicheseNoField } from '../game/richese-no-field';

function fixture(faction: 'fremen' | 'tleilaxu', advanced = true) {
  const g = createGame('REVIVALDESTINATIONS', newPlayer('p', 'Reviver', faction), advanced);
  g.players.push(newPlayer('b', 'BG', 'beneGesserit'), newPlayer('m', 'Moritani', 'moritani'),
    newPlayer('v', 'Visitor', 'harkonnen'));
  for (const p of g.players) Object.assign(p, { reserves: 10, forces: {}, tanks: 10 });
  if (faction === 'tleilaxu') g.players[0].reserves = 11;
  g.players[1].reserves = 0;
  if (faction === 'fremen') {
    g.players[0].elites = { reserves: 2, tanks: 1, forces: {}, revived: 0 };
    g.players[0].forces = { 'arrakeen:10': 1, 'polar_sink:0': 1 };
  }
  g.storm = 18;
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  const grant: HomeworldRevivalDeploymentQuote = { kind: faction === 'fremen' ? 'fedaykin' : 'tleilax',
    normal: faction === 'tleilaxu' ? 2 : 0, elite: faction === 'fremen' ? 2 : 0,
    beforePopulation: faction === 'tleilaxu' ? 9 : 3, afterPopulation: faction === 'tleilaxu' ? 11 : 10, blocked: null };
  return { g, grant };
}

void test('Southern lists existing territories only and withdraws the entire typed star group without mutation', () => {
  const { g, grant } = fixture('fremen', false);
  const before = structuredClone(g);
  const choices = homeworldRevivalDestinations(g, 'p', grant);
  assert.deepEqual(new Set(choices.map((c) => c.territory)), new Set(['arrakeen', 'polar_sink']));
  assert.ok(choices.every((c) => !c.homeworld));
  const quote = quoteHomeworldRevivalDestination(g, 'p', grant, 'polar_sink:0');
  const native = quote.transfer.players.find((p) => p.id === 'p')!;
  assert.equal(native.reserves, 8);
  assert.equal(native.eliteReserves, 0);
  assert.deepEqual(g, before);
});

void test('BG accompaniment uncertainty applies to Tleilax arrival on Arrakis, never Homeworld destinations', () => {
  const { g, grant } = fixture('tleilaxu');
  g.players[1].reserves = 20;
  const choices = homeworldRevivalDestinations(g, 'p', grant);
  assert.match(choices.find((c) => c.id === 'polar_sink:0')!.blocked!, /Spiritual Advisors/);
  const home = choices.filter((c) => c.homeworld);
  assert.ok(home.length > 0);
  assert.ok(home.every((c) => c.blocked === null));
  assert.doesNotThrow(() => quoteHomeworldRevivalDestination(g, 'p', grant, 'homeworld:tleilaxu'));
  g.players[1].reserves = 1;
  assert.equal(homeworldRevivalDestinations(g, 'p', grant).find((c) => c.id === 'polar_sink:0')!.blocked, null);
});

void test('Southern on-planet placement has no off-planet BG accompaniment gate', () => {
  const { g, grant } = fixture('fremen');
  g.players[1].reserves = 20;
  assert.equal(homeworldRevivalDestinations(g, 'p', grant).find((c) => c.id === 'polar_sink:0')!.blocked, null);
});

void test('Tleilax Homeworld transfers preserve exact custody, permit own-world no-op and reject ally destinations', () => {
  const { g, grant } = fixture('tleilaxu');
  const before = structuredClone(g);
  const own = quoteHomeworldRevivalDestination(g, 'p', grant, 'homeworld:tleilaxu');
  assert.equal(own.transfer.players.find((p) => p.id === 'p')!.reserves, 11);
  assert.deepEqual(own.transfer.state, g.homeworlds!.custody);
  const foreign = quoteHomeworldRevivalDestination(g, 'p', grant, 'homeworld:harkonnen');
  const home = homeworldForceGroups({ advanced: g.advanced, players: foreign.transfer.players }, foreign.transfer.state)
    .find((h) => h.native === 'v')!;
  assert.deepEqual(home.forces.p, { normal: 2, elite: 0 });
  assert.equal(foreign.transfer.players.find((p) => p.id === 'p')!.reserves, 9);
  assert.deepEqual(g, before);
  g.players[0].ally = 'v'; g.players[3].ally = 'p';
  const allied = structuredClone(g);
  assert.throws(() => quoteHomeworldRevivalDestination(g, 'p', grant, 'homeworld:harkonnen'), /ally/);
  assert.deepEqual(g, allied);
});

void test('storm uses the selected actual sector and mobile stronghold pointer; its classification remains gated', () => {
  for (const faction of ['fremen', 'tleilaxu'] as const) {
    const { g, grant } = fixture(faction);
    g.storm = 10;
    g.mobileStronghold = { location: 'arrakeen:10' } as NonNullable<typeof g.mobileStronghold>;
    g.players[0].forces['hidden_mobile_stronghold:0'] = 1;
    let choices = homeworldRevivalDestinations(g, 'p', grant);
    assert.match(choices.find((c) => c.id === 'arrakeen:10')!.blocked!, /storm/);
    assert.match(choices.find((c) => c.id === 'hidden_mobile_stronghold:0')!.blocked!, /storm/);
    assert.equal(choices.find((c) => c.id === 'polar_sink:0')!.blocked, null);
    g.storm = 18;
    choices = homeworldRevivalDestinations(g, 'p', grant);
    assert.match(choices.find((c) => c.id === 'hidden_mobile_stronghold:0')!.blocked!, /classification|ruling/);
  }
});

void test('BG Intrusion gate requires Advanced fighters at the destination, not advisors or another location', () => {
  const { g, grant } = fixture('fremen');
  g.players[1].forces = { 'arrakeen:10': 1 };
  const target = () => homeworldRevivalDestinations(g, 'p', grant).find((c) => c.id === 'arrakeen:10')!;
  assert.match(target().blocked!, /Intrusion/);
  g.advanced = false;
  assert.equal(target().blocked, null);
  g.advanced = true;
  g.players[1].advisors = { arrakeen: {} };
  assert.equal(target().blocked, null);
});

void test('Terror boundary reads public placement and original physical count, never a secret token face', () => {
  const { g, grant } = fixture('tleilaxu');
  g.moritaniTerror = createTerrorState(() => 0);
  const token = g.moritaniTerror.tokens[0];
  g.moritaniTerror = placeTerror(g.moritaniTerror, token.id, 'arrakeen', 1);
  for (const t of g.moritaniTerror.tokens) Object.defineProperty(t, 'kind', { get() { throw new Error('private Terror face read'); } });
  const target = () => homeworldRevivalDestinations(g, 'p', grant).find((c) => c.id === 'arrakeen:10')!;
  assert.match(target().blocked!, /Terror/);
  g.players[2].reserves = 7;
  assert.equal(target().blocked, null);
  grant.normal = 3;
  assert.match(target().blocked!, /Terror/);
  g.players[2].ally = 'p'; g.players[0].ally = 'm';
  assert.equal(target().blocked, null);
});

void test('destination quotes do not inspect opposing private cards or spice', () => {
  const { g, grant } = fixture('fremen');
  for (const p of g.players) for (const field of ['hand', 'spice', 'traitors'])
    Object.defineProperty(p, field, { get() { throw new Error(`private ${field} read`); } });
  assert.doesNotThrow(() => quoteHomeworldRevivalDestination(g, 'p', grant, 'polar_sink:0'));
});

void test('a concealed No-Field fills a stronghold without exposing its denomination', () => {
  const { g, grant } = fixture('tleilaxu', false);
  g.players[3] = newPlayer('v', 'Richese', 'richese');
  g.players[3].reserves = 20;
  g.players[3].noField = deployRicheseNoField(createRicheseNoField(['zero', 'three', 'five']),
    { tokenId: 'zero', controller: 'v', location: { territory: 'arrakeen', sector: 10 } });
  g.players[2].forces = { 'arrakeen:10': 1 };
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  for (const token of g.players[3].noField.tokens)
    Object.defineProperty(token, 'value', { get() { throw new Error('private denomination read'); } });
  assert.throws(() => quoteHomeworldRevivalDestination(g, 'p', grant, 'arrakeen:10'), /three occupying factions/);
  g.players[2].forces = {};
  assert.doesNotThrow(() => quoteHomeworldRevivalDestination(g, 'p', grant, 'arrakeen:10'));
});
