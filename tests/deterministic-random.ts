import type { TestContext } from 'node:test';

/** A deterministic byte source for `crypto.getRandomValues`.
 *
 * Tests that build genuine games otherwise inherit the process's real entropy:
 * a random storm can place a fixture's chosen sector in the storm, and a random
 * deal can seal a Lasgun-shield explosion or empty the Traitor Deck reserve.
 * Pinning the source makes those tests reproducible without weakening what they
 * assert. `t.mock` restores the original at the end of the test. */
export function pinDeterministicRandom(t: TestContext, seed = 0x2f6e2b1): void {
  let state = seed;
  t.mock.method(crypto, 'getRandomValues', <T extends ArrayBufferView | null>(array: T): T => {
    if (array) {
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (let i = 0; i < bytes.length; i++) {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        bytes[i] = (state >>> 16) & 0xff;
      }
    }
    return array;
  });
}
