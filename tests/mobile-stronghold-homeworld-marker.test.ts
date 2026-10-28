import assert from 'node:assert/strict';
import test from 'node:test';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD } from '../game/board';
import { mobileStrongholdCollectionCapacity, type MobileCollectionPlayer } from '../game/mobile-stronghold-collection';

void test('a Homeworld No-Field contributes nothing to a Mobile Stronghold collection', () => {
  const ix: MobileCollectionPlayer = { id: 'i', faction: 'ixians', advisors: {}, forces: { [MOBILE_LOCATION]: 2 } };
  const richese: MobileCollectionPlayer = { id: 'r', faction: 'richese', advisors: {}, forces: {},
    noField: { deployed: { controller: 'r', location: { homeworld: 'homeworld:atreides' } } } };
  assert.equal(mobileStrongholdCollectionCapacity([ix, richese]), 4);
  assert.equal(mobileStrongholdCollectionCapacity([richese]), 0);
});

void test('an aboard No-Field continues to contribute one without reading its hidden face', () => {
  const hidden = { deployed: { controller: 'r', location: { territory: MOBILE_STRONGHOLD, sector: 0 } },
    get tokens(): never { throw new Error('The concealed No-Field face was read.'); } };
  const richese: MobileCollectionPlayer = { id: 'r', faction: 'richese', advisors: {}, forces: {}, noField: hidden };
  assert.equal(mobileStrongholdCollectionCapacity([richese]), 2);
});
