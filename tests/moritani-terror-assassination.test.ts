import assert from 'node:assert/strict';
import test from 'node:test';
import {
  battleLeaderStrength,
  createAuditorLeader,
  leaders,
  type Leader,
} from '../game/cards';
import type { FactionId } from '../game/catalog';
import { acquireDuke, captureDuke, createDukeVidal, type DukeState } from '../game/duke-vidal';
import {
  moritaniTerrorAssassinationPool,
  moritaniTerrorAssassinationValue,
} from '../game/moritani-terror-assassination';

type TerrorFixture = {
  advanced: boolean;
  players: { id: string; faction: FactionId; leaders: Leader[] }[];
  dukeVidal: DukeState;
};
function fixture(): TerrorFixture {
  return {
    advanced: true,
    players: (['atreides', 'harkonnen', 'tleilaxu', 'ecaz', 'moritani', 'choam'] as const)
      .map((faction) => ({ id: faction, faction, leaders: leaders(faction) })),
    dukeVidal: createDukeVidal(),
  };
}
const seat = (g: TerrorFixture, id: string) =>
  g.players.find((player) => player.id === id)!;
const ids = (pool: readonly Leader[]) => pool.map((leader) => leader.id);

void test('ordinary eligibility retains all five living native discs without mutating custody', () => {
  const g = fixture();
  g.advanced = false;
  const owner = seat(g, 'atreides');
  const before = structuredClone(g);
  const first = moritaniTerrorAssassinationPool(g, owner.id);
  assert.deepEqual(ids(first), ['atreides-0', 'atreides-1', 'atreides-2', 'atreides-3', 'atreides-4']);
  assert.deepEqual(g, before);
});

void test('native discs controlled elsewhere are excluded and the captor receives the actual foreign disc', () => {
  const g = fixture();
  const native = seat(g, 'atreides').leaders;
  native[0].capturedBy = 'harkonnen';
  native[1].gholaBy = 'tleilaxu';
  const before = structuredClone(g);
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'atreides')), ['atreides-2', 'atreides-3', 'atreides-4']);
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'harkonnen')), [
    'atreides-0', 'harkonnen-0', 'harkonnen-1', 'harkonnen-2', 'harkonnen-3', 'harkonnen-4',
  ]);
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'tleilaxu')), [
    'atreides-1', 'tleilaxu-0', 'tleilaxu-1', 'tleilaxu-2', 'tleilaxu-3', 'tleilaxu-4',
  ]);
  assert.deepEqual(g, before);
});

void test('capture overrides foreign-Ghola control without moving or copying the native physical disc', () => {
  const g = fixture();
  const ghola = seat(g, 'atreides').leaders[2];
  ghola.gholaBy = 'tleilaxu';
  ghola.capturedBy = 'harkonnen';
  ghola.concealed = { captor: 'harkonnen', controller: 'tleilaxu', dead: false, deaths: 1 };
  ghola.deaths = 1;
  ghola.usedAt = 'carthag';
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'tleilaxu')), ids(seat(g, 'tleilaxu').leaders));
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'harkonnen')), [ghola.id, ...ids(seat(g, 'harkonnen').leaders)]);
});

void test('used living discs remain eligible while dead native and foreign discs do not', () => {
  const g = fixture();
  const native = seat(g, 'harkonnen').leaders;
  native.forEach((leader) => { leader.dead = true; leader.deaths = 2; });
  native[3].dead = false;
  native[3].usedAt = 'arrakeen';
  const foreign = seat(g, 'atreides').leaders[0];
  foreign.capturedBy = 'harkonnen';
  foreign.dead = true;
  foreign.deaths = 1;
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'harkonnen')), [native[3].id]);
  foreign.dead = false;
  foreign.usedAt = 'carthag';
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'harkonnen')), [foreign.id, native[3].id]);
});

void test('the shared Duke is included once for actual server control, never merely for Ecaz identity', () => {
  const g = fixture();
  g.dukeVidal = acquireDuke(g.dukeVidal, 'moritani', 2, 'moritani');
  g.dukeVidal.leader.usedAt = 'arrakeen';
  const before = structuredClone(g);
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'moritani')),
    [...ids(seat(g, 'moritani').leaders), g.dukeVidal.leader.id]);
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'ecaz')), ids(seat(g, 'ecaz').leaders));
  assert.deepEqual(g, before);
});

void test('a genuinely captured shared Duke follows the native captor rather than his original tenure', () => {
  const g = fixture();
  g.dukeVidal = captureDuke(acquireDuke(g.dukeVidal, 'moritani', 2, 'moritani'),
    'harkonnen', 'moritani', 2, 'arrakeen');
  const before = structuredClone(g);
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'moritani')), ids(seat(g, 'moritani').leaders));
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'harkonnen')),
    [...ids(seat(g, 'harkonnen').leaders), g.dukeVidal.leader.id]);
  assert.deepEqual(g, before, 'quoting does not reveal the captive or change tenure');
});

void test('empty actual control returns an empty array without changing hidden custody or requiring a victim', () => {
  const g = fixture();
  for (const leader of seat(g, 'atreides').leaders) {
    leader.dead = true;
    leader.deaths = 1;
  }
  const concealed = seat(g, 'atreides').leaders[0];
  concealed.dead = false;
  concealed.capturedBy = 'harkonnen';
  concealed.concealed = { captor: 'harkonnen', controller: 'atreides', dead: false, deaths: 1 };
  const before = structuredClone(g);
  assert.deepEqual(moritaniTerrorAssassinationPool(g, 'atreides'), []);
  assert.deepEqual(g, before);
});

void test('set-aside and dead Duke do not receive faction fallback control', () => {
  const g = fixture();
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'ecaz')), ids(seat(g, 'ecaz').leaders));
  g.dukeVidal = acquireDuke(g.dukeVidal, 'ecaz', 1, 'ecaz');
  g.dukeVidal.leader.dead = true;
  g.dukeVidal.leader.deaths = 1;
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'ecaz')), ids(seat(g, 'ecaz').leaders));
});

void test('the actual optional Auditor participates without replacing any of the native five', () => {
  const g = fixture();
  const choam = seat(g, 'choam');
  const ordinary = [...choam.leaders];
  const auditor = createAuditorLeader();
  auditor.usedAt = 'sietch_tabr';
  choam.leaders.push(auditor);
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'choam')), [...ids(ordinary), auditor.id]);
  assert.equal(moritaniTerrorAssassinationValue(auditor), 2);
  auditor.dead = true;
  auditor.deaths = 1;
  assert.deepEqual(ids(moritaniTerrorAssassinationPool(g, 'choam')), ids(ordinary));
  g.advanced = false;
  assert.throws(() => moritaniTerrorAssassinationPool(g, 'choam'));
});

void test('printed bounty preserves Zoal three and shared Duke six, not copied battle values', () => {
  const zoal = leaders('tleilaxu')[0];
  const opponent = leaders('fremen')[0];
  assert.equal(battleLeaderStrength(zoal, opponent), 7);
  assert.equal(moritaniTerrorAssassinationValue(zoal), 3);
  assert.equal(moritaniTerrorAssassinationValue(createDukeVidal().leader), 6);
  assert.throws(() => moritaniTerrorAssassinationValue({ ...zoal, strength: 7 }));
});

void test('missing, duplicated, extra and altered physical native discs reject rather than distort probability', () => {
  const changes: ((g: TerrorFixture) => void)[] = [
    (g) => { seat(g, 'atreides').leaders.pop(); },
    (g) => { seat(g, 'atreides').leaders[1] = { ...seat(g, 'atreides').leaders[0] }; },
    (g) => { seat(g, 'atreides').leaders.push({ ...seat(g, 'atreides').leaders[0] }); },
    (g) => { seat(g, 'atreides').leaders[0].strength = 99; },
    (g) => { seat(g, 'atreides').leaders[0].name = 'Invented disc'; },
    (g) => { seat(g, 'atreides').leaders[0].faction = 'ecaz'; },
    (g) => { seat(g, 'atreides').leaders[0].id = 'atreides-invented'; },
    (g) => { seat(g, 'atreides').leaders[0].controller = 'ecaz'; },
    (g) => { seat(g, 'atreides').leaders[0].capturedBy = 'missing-seat'; },
    (g) => { seat(g, 'atreides').leaders[0].gholaBy = 'ecaz'; },
    (g) => { g.players[1].id = g.players[0].id; },
  ];
  for (const change of changes) {
    const g = fixture();
    change(g);
    const before = structuredClone(g);
    assert.throws(() => moritaniTerrorAssassinationPool(g, 'atreides'));
    assert.deepEqual(g, before);
  }
});

void test('shared-Duke roster copies, altered identity and forbidden foreign-Ghola sources reject', () => {
  const changes: ((g: TerrorFixture) => void)[] = [
    (g) => { seat(g, 'ecaz').leaders.push(g.dukeVidal.leader); },
    (g) => { seat(g, 'ecaz').leaders[0] = { ...g.dukeVidal.leader }; },
    (g) => { g.dukeVidal.leader.id = 'fake-duke'; },
    (g) => { g.dukeVidal.leader.strength = 7; },
    (g) => { g.dukeVidal.leader.gholaBy = 'tleilaxu'; },
    (g) => { g.dukeVidal.controller = 'missing-seat'; },
  ];
  for (const change of changes) {
    const g = fixture();
    change(g);
    const before = structuredClone(g);
    assert.throws(() => moritaniTerrorAssassinationPool(g, 'ecaz'));
    assert.deepEqual(g, before);
  }
});
