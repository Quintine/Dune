import test from 'node:test';
import assert from 'node:assert/strict';
import { requestOrigin } from '../lib/request-origin';

void test('HTTP upstream can explicitly use its HTTPS public origin without trusting forwarded headers', () => {
  const request = new Request('http://192.168.2.251:33046/api/rooms', {
    headers: { 'x-forwarded-host': 'attacker.invalid', 'x-forwarded-proto': 'https' },
  });
  assert.equal(requestOrigin(request), 'http://192.168.2.251:33046');
  assert.equal(requestOrigin(request, 'https://dune.example.test/'), 'https://dune.example.test');
  for (const invalid of ['https://dune.example.test/path', 'https://user:secret@dune.example.test', 'https://dune.example.test/?x=1', 'https://dune.example.test/#x', 'file:///tmp', 'invalid']) {
    assert.throws(() => requestOrigin(request, invalid));
  }
});
