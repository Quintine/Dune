import assert from 'node:assert/strict';
import test from 'node:test';
import { quoteTleilaxuSpecialKarama as quote, type TleilaxuSpecialKaramaContext } from '../game/tleilaxu-special-karama';

function context(): TleilaxuSpecialKaramaContext {
  return { status: 'playing', phase: 4, advanced: true, owner: { id: 't', faction: 'tleilaxu' },
    players: [{ id: 't' }, { id: 'a' }, { id: 'e' }], cards: ['original-karama'],
    pendingPlayer: null, blocked: null };
}
void test('quiet targets use only seated identities and preserve independent target restrictions', () => {
  const source = context(), before = structuredClone(source);
  source.targetBlocks = { e: 'Unresolved low-population Homeworld overlap.' };
  const offered = quote(source);
  assert.equal(offered.blocked, null);
  assert.deepEqual(offered.targets, [{ player: 't', blocked: null }, { player: 'a', blocked: null },
    { player: 'e', blocked: source.targetBlocks.e }]);
  offered.cards.pop();
  assert.deepEqual(source.cards, before.cards);
});
void test('pending original recipient is the only target, and an absent recipient cannot silently retarget', () => {
  assert.deepEqual(quote({ ...context(), pendingPlayer: 'a' }).targets, [{ player: 'a', blocked: null }]);
  assert.match(quote({ ...context(), pendingPlayer: 'missing' }).blocked!, /Choose a player/);
});
void test('mode, native owner, phase, use, priority and spendable card each gate permission', () => {
  const source = context();
  for (const change of [
    { advanced: false }, { owner: { id: 't', faction: 'guild' as const } },
    { status: 'finished' }, { phase: 5 }, { owner: { ...source.owner, specialKaramaUsed: true } },
    { blocked: 'Finish the response first.' }, { cards: [] },
  ]) assert.ok(quote({ ...source, ...change }).blocked);
  assert.equal(quote(source).blocked, null);
});
