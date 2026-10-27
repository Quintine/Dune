import assert from 'node:assert/strict';
import test from 'node:test';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';
import {
  mobileStrongholdCollectionCapacity as capacity,
  type MobileCollectionPlayer,
} from '../game/mobile-stronghold-collection';

const ix: MobileCollectionPlayer = {
  id: 'ix', faction: 'ixians', forces: { [MOBILE_LOCATION]: 2, arrakeen: 4 },
};
const fremen: MobileCollectionPlayer = {
  id: 'fremen', faction: 'fremen', forces: { [MOBILE_LOCATION]: 3 },
};
const bg: MobileCollectionPlayer = {
  id: 'bg', faction: 'beneGesserit', forces: { [MOBILE_LOCATION]: 4 },
  advisors: { [MOBILE_STRONGHOLD]: {} },
};

void test('mobile spice capacity includes foreign fighters and excludes advisors', () => {
  assert.equal(capacity([ix, fremen, bg]), 10);
  assert.equal(capacity([ix, fremen, { ...bg, advisors: {} }]), 18);
  assert.equal(capacity([]), 0);
});

void test('mobile spice capacity treats a concealed No-Field as one without reading its identity or value', () => {
  const deployed = {
    controller: 'fremen',
    location: { territory: MOBILE_STRONGHOLD, sector: 0 },
    get tokenId(): string { throw new Error('concealed token read'); },
    get value(): number { throw new Error('concealed value read'); },
  };
  const richese: MobileCollectionPlayer = {
    id: 'richese', faction: 'richese', forces: {}, noField: { deployed },
  };
  assert.equal(capacity([ix, fremen, richese]), 12);
  assert.equal(capacity([ix, fremen, { ...richese, noField: { deployed: null } }]), 10);
  assert.equal(capacity([ix, fremen, {
    ...richese,
    noField: { deployed: { controller: 'richese', location: { territory: 'arrakeen', sector: 9 } } },
  }]), 10);
});

void test('allied No-Field uses the controlling faction advisor stance', () => {
  const richese: MobileCollectionPlayer = {
    id: 'richese', faction: 'richese', forces: {},
    noField: { deployed: { controller: 'bg', location: { territory: MOBILE_STRONGHOLD, sector: 0 } } },
  };
  assert.equal(capacity([ix, bg, richese]), 4);
  assert.equal(capacity([ix, { ...bg, advisors: {} }, richese]), 14);
});
