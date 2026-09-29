import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { clearAdminAccountRecord, completeAdminAccountRequest, newAdminAccountRequest, readAdminAccountRecord, saveAdminAccountRequest, validAdminAccountResult } from '../lib/admin-accounts-client';
import type { AdminAccountRow } from '../lib/admin-accounts';

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

const account = (id: string, role: AdminAccountRow['role'] = 'viewer'): AdminAccountRow =>
  ({ id, name: 'QA only', role, enabled: true, createdAt: 1700000000000, updatedAt: 1700000000000 });

void test('SSR exposes no account directory or private key before owner session verification', async () => {
  // Node's test loader does not handle the page's stylesheet imports; the browser build does.
  register('data:text/javascript,export async function load(url,context,nextLoad){if(url.endsWith(%22.css%22))return {format:%22module%22,source:%22export {}%22,shortCircuit:true};return nextLoad(url,context)}', import.meta.url);
  const { default: AccountsPage } = await import('../app/admin/accounts/page');
  const html = renderToStaticMarkup(createElement(AccountsPage));
  assert.match(html, /Checking owner access and account directory/);
  assert.doesNotMatch(html, /One-time account access key|Change role ·|Disable ·|dune-admin\./);
});

void test('provisioned key is generated only in the browser, saved exactly before sending, and recoverable from its original tab', () => {
  const owner = crypto.randomUUID();
  const tab = storage();
  const input = newAdminAccountRequest({ action: 'provision', name: '  QA colleague  ', role: 'operator', reason: '  QA access  ' });
  assert.equal(input.action, 'provision');
  if (input.action !== 'provision') return;
  assert.equal(new RegExp(`^dune-admin\\.${input.id}\\.[0-9a-f]{64}$`).test(input.key), true);
  assert.equal(input.name, 'QA colleague'); assert.equal(input.reason, 'QA access');
  saveAdminAccountRequest(tab, owner, input);
  const pending = readAdminAccountRecord(tab, owner);
  assert.ok(pending?.kind === 'pending' && pending.input.action === 'provision' &&
    pending.input.operationId === input.operationId && pending.input.key === input.key);
  assert.equal(readAdminAccountRecord(tab, crypto.randomUUID()), null);
  assert.throws(() => saveAdminAccountRequest(tab, owner, newAdminAccountRequest({ action: 'provision', name: 'Other', role: 'viewer', reason: 'QA' })));
  assert.equal(JSON.stringify(readAdminAccountRecord(tab, owner)) === JSON.stringify(pending), true);
  saveAdminAccountRequest(tab, owner, input);
  const receipt = { operationId: input.operationId, replayed: true, account: { ...account(input.id, 'operator'), name: input.name } };
  assert.equal(validAdminAccountResult({ ...receipt, account: { ...receipt.account, role: 'viewer' } }, input), false);
  completeAdminAccountRequest(tab, owner, input, receipt);
  const completed = readAdminAccountRecord(tab, owner);
  assert.ok(completed?.kind === 'completed' && completed.input.key === input.key && completed.account.id === input.id);
  assert.throws(() => saveAdminAccountRequest(tab, owner, input));
  assert.equal(JSON.stringify(readAdminAccountRecord(tab, owner)) === JSON.stringify(completed), true);
  const savedKey = [...tab.values.keys()][0], savedRecord = tab.values.get(savedKey)!;
  tab.values.set(savedKey, JSON.stringify({ kind: 'completed', input, account: { ...receipt.account, role: 'viewer' } }));
  assert.throws(() => readAdminAccountRecord(tab, owner));
  tab.values.set(savedKey, savedRecord);
  clearAdminAccountRecord(tab, owner);
  assert.equal(readAdminAccountRecord(tab, owner), null);
});

void test('role and disable requests retain exact target version and reason until a matching receipt is persisted', () => {
  const owner = crypto.randomUUID(), target = crypto.randomUUID();
  for (const input of [
    newAdminAccountRequest({ action: 'role', target, expectedUpdatedAt: 1700000000000, role: 'owner', reason: 'QA rotation' }),
    newAdminAccountRequest({ action: 'disable', target, expectedUpdatedAt: 1700000000000, reason: 'QA departure' }),
  ]) {
    if (input.action === 'provision') throw new Error('This fixture must change an existing account.');
    const tab = storage();
    saveAdminAccountRequest(tab, owner, input);
    assert.deepEqual(readAdminAccountRecord(tab, owner), { kind: 'pending', input });
    assert.throws(() => saveAdminAccountRequest(tab, owner, { ...input, expectedUpdatedAt: 1700000000001 }));
    assert.deepEqual(readAdminAccountRecord(tab, owner), { kind: 'pending', input });
    assert.equal(validAdminAccountResult({ operationId: crypto.randomUUID(), replayed: true, account: account(target) }, input), false);
    assert.equal(validAdminAccountResult({ operationId: input.operationId, replayed: true, account: { ...account(target), key: 'private' } }, input), false);
    const next = { ...account(target, input.action === 'role' ? 'owner' : 'viewer'),
      enabled: input.action === 'role', updatedAt: 1700000000001 };
    assert.equal(validAdminAccountResult({ operationId: input.operationId, replayed: true,
      account: { ...next, enabled: !next.enabled } }, input), false);
    const receipt = { operationId: input.operationId, replayed: true, account: next };
    completeAdminAccountRequest(tab, owner, input, receipt);
    assert.equal(readAdminAccountRecord(tab, owner), null);
    assert.equal([...tab.values.values()].join('').includes(input.reason), false);
  }
});

void test('unavailable, corrupt or changed storage fails closed and never replaces an uncertain credential', () => {
  const tab = storage(), owner = crypto.randomUUID();
  const input = newAdminAccountRequest({ action: 'provision', name: 'QA colleague', role: 'viewer', reason: 'QA' });
  assert.throws(() => saveAdminAccountRequest({ ...tab, setItem() {} }, owner, input));
  assert.equal(tab.values.size, 0);
  saveAdminAccountRequest(tab, owner, input);
  const key = [...tab.values.keys()][0];
  tab.values.set(key, '{broken');
  assert.throws(() => readAdminAccountRecord(tab, owner));
  assert.throws(() => saveAdminAccountRequest(tab, owner, input));
  assert.equal(tab.values.get(key), '{broken');
  tab.values.set(key, JSON.stringify({ kind: 'pending', input: { ...input, operationId: crypto.randomUUID() } }));
  const unchanged = readAdminAccountRecord(tab, owner);
  assert.throws(() => completeAdminAccountRequest(tab, owner, input, { operationId: input.operationId, replayed: false, account: account(input.action === 'provision' ? input.id : '') }));
  assert.equal(JSON.stringify(readAdminAccountRecord(tab, owner)) === JSON.stringify(unchanged), true);
  assert.throws(() => newAdminAccountRequest({ action: 'provision', name: 'QA', role: 'viewer', reason: 'dune-admin.secret' }));
});
