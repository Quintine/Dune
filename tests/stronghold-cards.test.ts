import test from 'node:test';
import assert from 'node:assert/strict';
import { MOBILE_STRONGHOLD, territory } from '../game/board';
import {
  STRONGHOLD_CARDS,
  createStrongholdCards,
  ownedStrongholdCards,
  strongholdBenefit,
  strongholdControllers,
  settleStrongholdCards,
  strongholdSupportCost,
  strongholdBattleIncome,
  type StrongholdId,
  type StrongholdState,
} from '../game/stronghold-cards';
type Player = Parameters<typeof strongholdControllers>[0][number];
const key = (id: StrongholdId) => `${id}:${territory(id).sectors[0]}`;
const player = (
  id: string,
  faction: Player['faction'],
  forces: Record<string, number> = {},
): Player => ({ id, faction, ally: null, forces });
const stateWith = (...entries: [StrongholdId, string][]) => {
  const state = createStrongholdCards();
  for (const [id, owner] of entries) state.owners[id] = owner;
  state.claimedTurn = 1;
  return state;
};
void test('six verified Stronghold Cards have canonical board identities and start set aside', () => {
  assert.deepEqual(
    STRONGHOLD_CARDS.map((c) => c.id).sort(),
    [
      'arrakeen',
      'carthag',
      'habbanya_ridge_sietch',
      'sietch_tabr',
      'tueks_sietch',
      MOBILE_STRONGHOLD,
    ].sort(),
  );
  for (const card of STRONGHOLD_CARDS) {
    assert.ok(territory(card.id));
    assert.ok(card.name && card.summary && card.gameplay.length > 0);
    assert.ok(card.gameplay.every((text) => text.length > 0));
  }
  const a = createStrongholdCards(),
    b = createStrongholdCards();
  assert.deepEqual(a, {
    claimedTurn: 0,
    owners: Object.fromEntries(STRONGHOLD_CARDS.map((c) => [c.id, null])),
  });
  a.owners.arrakeen = 'p';
  assert.equal(b.owners.arrakeen, null);
  assert.deepEqual(ownedStrongholdCards(b, 'p'), []);
});

void test('ownership and benefit depend on recorded card custody rather than changing live occupation', () => {
  const state = stateWith(['arrakeen', 'p'], ['carthag', 'q']);
  const before = structuredClone(state);
  assert.deepEqual(
    ownedStrongholdCards(state, 'p').map((c) => c.id),
    ['arrakeen'],
  );
  assert.equal(strongholdBenefit(state, 'p', 'arrakeen'), 'arrakeen');
  assert.equal(strongholdBenefit(state, 'p', 'carthag'), null);
  assert.equal(strongholdBenefit(state, 'q', 'arrakeen'), null);
  assert.equal(strongholdBenefit(state, 'p', 'polar_sink'), null);
  assert.equal(strongholdBenefit(null, 'p', 'arrakeen'), null);
  assert.deepEqual(ownedStrongholdCards(undefined, 'p'), []);
  const cards = ownedStrongholdCards(state, 'p');
  cards[0].gameplay.push('mutated output');
  assert.notDeepEqual(cards, ownedStrongholdCards(state, 'p'));
  assert.deepEqual(state, before);
});

void test('mobile benefit requires its own retained card and explicit nonmobile copy but does not require owning the copied card', () => {
  const state = stateWith([MOBILE_STRONGHOLD, 'p'], ['arrakeen', 'q']);
  for (const copy of STRONGHOLD_CARDS.map((c) => c.id)) {
    assert.equal(
      strongholdBenefit(state, 'p', MOBILE_STRONGHOLD, copy),
      copy === MOBILE_STRONGHOLD ? null : copy,
    );
    assert.equal(strongholdBenefit(state, 'q', MOBILE_STRONGHOLD, copy), null);
  }
  for (const copy of [undefined, null, 'missing' as StrongholdId])
    assert.equal(strongholdBenefit(state, 'p', MOBILE_STRONGHOLD, copy), null);
  assert.equal(
    strongholdBenefit(state, 'q', 'arrakeen', 'carthag'),
    'arrakeen',
  );
});

void test('control counts sole individual fighters across sectors and does not pool ordinary allies', () => {
  for (const id of STRONGHOLD_CARDS.map((c) => c.id)) {
    const p = player('p', 'atreides', { [key(id)]: 1 });
    assert.equal(strongholdControllers([p], true)[id], 'p');
    const q = player('q', 'guild', { [key(id)]: 1 });
    assert.equal(strongholdControllers([p, q], true)[id], null);
    p.ally = 'q';
    q.ally = 'p';
    assert.equal(strongholdControllers([p, q], true)[id], null);
    q.forces = { [key(id)]: 0 };
    assert.equal(strongholdControllers([p, q], true)[id], 'p');
  }
  assert.deepEqual(
    strongholdControllers([], true),
    createStrongholdCards().owners,
  );
  // No storm parameter or exclusion exists: surviving sole occupancy is sufficient.
  assert.equal(
    strongholdControllers([player('p', 'guild', { 'arrakeen:10': 1 })], true)
      .arrakeen,
    'p',
  );
});

void test('Bene Gesserit advisors neither claim nor contest a card and the control query never mutates stance', () => {
  const advisor = player('b', 'beneGesserit', { 'arrakeen:10': 2 });
  advisor.advisors = { arrakeen: { lockedTurn: 2 } };
  const p = player('p', 'atreides', { 'arrakeen:10': 1 });
  const before = structuredClone([p, advisor]);
  assert.equal(strongholdControllers([p, advisor], true).arrakeen, 'p');
  assert.equal(strongholdControllers([advisor], true).arrakeen, null);
  assert.deepEqual([p, advisor], before);
  // Engine settles an obsolete sole-advisor stance before its control checkpoint.
  const settled = structuredClone(advisor);
  settled.advisors = {};
  assert.equal(strongholdControllers([settled], true).arrakeen, 'b');
  assert.equal(strongholdControllers([p, settled], true).arrakeen, null);
});

void test('a concealed No-Field is one public presence regardless of hidden physical value', () => {
  const richese = player('r', 'richese');
  richese.noField = {
    deployed: { location: { territory: 'arrakeen', sector: 10 } },
  };
  const before = structuredClone(richese);
  assert.equal(strongholdControllers([richese], true).arrakeen, 'r');
  assert.equal(
    strongholdControllers(
      [richese, player('p', 'guild', { 'arrakeen:10': 1 })],
      true,
    ).arrakeen,
    null,
  );
  for (const value of [0, 3, 5]) {
    const hiddenMarker = {
      deployed: richese.noField!.deployed,
      tokens: [{ tokenId: 'private', value }],
    };
    const hiddenVariant: Player = { ...richese, noField: hiddenMarker };
    assert.deepEqual(
      strongholdControllers([hiddenVariant], true),
      strongholdControllers([richese], true),
    );
  }
  assert.deepEqual(richese, before);
});

void test('Ecaz controls a stronghold shared only with its reciprocal ally, including No-Fields, but never with a third combatant', () => {
  const ecaz = player('e', 'ecaz', { 'arrakeen:10': 1 });
  const ally = player('r', 'richese');
  ally.noField = {
    deployed: { location: { territory: 'arrakeen', sector: 10 } },
  };
  ecaz.ally = 'r';
  ally.ally = 'e';
  assert.equal(strongholdControllers([ecaz, ally], true).arrakeen, 'e');
  assert.equal(strongholdControllers([ally, ecaz], true).arrakeen, 'e');
  const third = player('b', 'beneGesserit', { 'arrakeen:10': 1 });
  assert.equal(strongholdControllers([ecaz, ally, third], true).arrakeen, null);
  third.advisors = { arrakeen: {} };
  assert.equal(strongholdControllers([ecaz, ally, third], true).arrakeen, 'e');
  ally.ally = null;
  assert.equal(strongholdControllers([ecaz, ally], true).arrakeen, null);
  ecaz.forces = {};
  assert.equal(strongholdControllers([ecaz, ally], true).arrakeen, 'r');
});

void test('unplaced mobile interior has no owner and its occupants never become occupants of its pointing territory', () => {
  const ix = player('i', 'ixians', { [key(MOBILE_STRONGHOLD)]: 6 });
  const p = player('p', 'atreides', { 'arrakeen:10': 1 });
  assert.equal(strongholdControllers([ix, p], false)[MOBILE_STRONGHOLD], null);
  const placed = strongholdControllers([ix, p], true);
  assert.equal(placed[MOBILE_STRONGHOLD], 'i');
  assert.equal(placed.arrakeen, 'p');
});

void test('end-turn settlement transfers or sets aside once, survives JSON, and leaves all input records unchanged', () => {
  const initial = createStrongholdCards();
  const firstControl = strongholdControllers(
    [player('p', 'atreides', { 'arrakeen:10': 1 })],
    false,
  );
  const first = settleStrongholdCards(initial, 1, firstControl);
  assert.equal(initial.claimedTurn, 0);
  assert.equal(initial.owners.arrakeen, null);
  assert.equal(first.owners.arrakeen, 'p');
  const secondControl = strongholdControllers(
    [player('q', 'guild', { 'carthag:11': 1 })],
    false,
  );
  const duplicate = settleStrongholdCards(first, 1, secondControl);
  assert.deepEqual(duplicate, first);
  assert.notEqual(duplicate, first);
  assert.notEqual(duplicate.owners, first.owners);
  const next = settleStrongholdCards(
    JSON.parse(JSON.stringify(first)),
    2,
    secondControl,
  );
  assert.equal(next.owners.arrakeen, null);
  assert.equal(next.owners.carthag, 'q');
  assert.equal(first.owners.arrakeen, 'p');
  next.owners.carthag = 'changed';
  assert.equal(secondControl.carthag, 'q');
  assert.throws(
    () => settleStrongholdCards(next, 1, firstControl),
    /non-stale/,
  );
});

void test('invalid control, owner-map, and settlement inputs reject without mutation', () => {
  const state = createStrongholdCards(),
    before = structuredClone(state);
  for (const turn of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => settleStrongholdCards(state, turn, state.owners));
  for (const amount of [-1, 0.5, NaN, Infinity])
    assert.throws(() =>
      strongholdControllers(
        [player('p', 'guild', { 'arrakeen:10': amount })],
        true,
      ),
    );
  assert.throws(() =>
    strongholdControllers([player('p', 'guild', { 'arrakeen:7': 1 })], true),
  );
  assert.throws(() =>
    strongholdControllers(
      [player('p', 'guild'), player('p', 'atreides')],
      true,
    ),
  );
  const malformed = structuredClone(state);
  delete (malformed.owners as Partial<StrongholdState['owners']>).arrakeen;
  assert.throws(() => settleStrongholdCards(malformed, 1, state.owners));
  assert.throws(() => settleStrongholdCards(state, 1, malformed.owners));
  assert.throws(() => ownedStrongholdCards(malformed, 'p'));
  assert.throws(() => strongholdBenefit(malformed, 'p', 'carthag'));
  assert.deepEqual(state, before);
});

void test('Arrakeen subtracts only actual bank-covered support without minting spice', () => {
  for (const support of [0, 0.5, 1, 1.5, 2, 2.5, 3, 20]) {
    assert.equal(
      strongholdSupportCost('arrakeen', support),
      Math.max(0, support - 2),
    );
    for (const effect of [
      null,
      ...STRONGHOLD_CARDS.map((c) => c.id).filter((id) => id !== 'arrakeen'),
    ])
      assert.equal(strongholdSupportCost(effect, support), support);
  }
  for (const bad of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => strongholdSupportCost('arrakeen', bad));
});

void test('Tabr returns the winning opposing dial rounded down while Tuek pays each Worthless regardless of victory', () => {
  for (const won of [false, true])
    for (const dial of [0, 0.5, 1, 1.5, 2.5, 20])
      for (const count of [0, 1, 2]) {
        assert.equal(
          strongholdBattleIncome('sietch_tabr', won, dial, count),
          won ? Math.floor(dial) : 0,
        );
        assert.equal(
          strongholdBattleIncome('tueks_sietch', won, dial, count),
          2 * count,
        );
        for (const effect of [
          null,
          'arrakeen',
          'carthag',
          'habbanya_ridge_sietch',
          MOBILE_STRONGHOLD,
        ] as const)
          assert.equal(strongholdBattleIncome(effect, won, dial, count), 0);
      }
  for (const dial of [-1, NaN, Infinity])
    assert.throws(() => strongholdBattleIncome('sietch_tabr', true, dial, 0));
  for (const count of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER])
    assert.throws(() =>
      strongholdBattleIncome('tueks_sietch', false, 0, count),
    );
});
