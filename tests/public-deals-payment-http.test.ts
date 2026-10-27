// @dune-suite integration
import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameView } from '../game/engine';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
async function request(path: string, cookie?: string, body?: unknown, selected?: string) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(selected ? { 'X-Dune-Seat': selected } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return {
    status: response.status,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    data: await response.json() as GameView & { error?: string },
  };
}

void test('three authenticated human seats settle a public deal payment only on final consent', async () => {
  const host = await request('/api/rooms', undefined, {
    name: 'Deal payment recipient', faction: 'atreides', advanced: false, expansions: [],
  });
  assert.equal(host.status, 201, JSON.stringify(host.data));
  assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const payer = await request(path, undefined, { type: 'join', name: 'Deal payer', faction: 'harkonnen' });
  assert.equal(payer.status, 200, JSON.stringify(payer.data));
  assert.ok(payer.cookie);
  const finalVoter = await request(path, undefined, { type: 'join', name: 'Deal final voter', faction: 'emperor' });
  assert.equal(finalVoter.status, 200, JSON.stringify(finalVoter.data));
  assert.ok(finalVoter.cookie);
  const seats = [
    { id: host.data.me, cookie: host.cookie },
    { id: payer.data.me, cookie: payer.cookie },
    { id: finalVoter.data.me, cookie: finalVoter.cookie },
  ];
  let view = finalVoter.data;
  const act = async (cookie: string, action: object) => {
    const next = await request(path, cookie, { version: view.version, action });
    assert.equal(next.status, 200, JSON.stringify(next.data));
    view = next.data;
    return next.data;
  };
  for (const seat of seats) await act(seat.cookie, { type: 'ready' });
  await act(host.cookie, { type: 'start' });
  for (const seat of seats) {
    const own = await request(path, seat.cookie);
    assert.equal(own.status, 200, JSON.stringify(own.data));
    view = own.data;
    const choices = own.data.players.find(player => player.id === seat.id)?.traitorChoices;
    if (choices?.length) await act(seat.cookie, { type: 'traitor', leader: choices[0] });
  }
  assert.equal(view.status, 'playing');
  assert.equal(view.phase, 0);
  const payerBefore = await request(path, payer.cookie);
  const recipientBefore = await request(path, host.cookie);
  assert.equal(payerBefore.status, 200);
  assert.equal(recipientBefore.status, 200);
  const payerSpice = payerBefore.data.players.find(player => player.id === payer.data.me)!.spice;
  const recipientSpice = recipientBefore.data.players.find(player => player.id === host.data.me)!.spice;
  const recipientIncoming = recipientBefore.data.bribeOptions.incoming;
  assert.equal(typeof payerSpice, 'number');
  assert.ok(payerSpice! >= 3);

  const payment = { kind: 'immediateBribe', payer: payer.data.me, recipient: host.data.me, amount: 3 };
  await act(host.cookie, {
    type: 'dealOffer', targets: [payer.data.me, finalVoter.data.me],
    terms: 'Information for spice.', payment,
  });
  const deal = view.deals.at(-1);
  assert.ok(deal);
  assert.equal(deal.status, 'offered');
  assert.deepEqual((deal as unknown as { payment?: unknown }).payment, payment);
  for (const seat of seats) {
    const read = await request(path, seat.cookie);
    assert.equal(read.status, 200, JSON.stringify(read.data));
    assert.deepEqual(read.data.deals.find(item => item.id === deal.id), deal);
  }
  assert.equal((await request(path, payer.cookie)).data.players.find(player => player.id === payer.data.me)!.spice, payerSpice);
  assert.equal((await request(path, host.cookie)).data.bribeOptions.incoming, recipientIncoming);

  const payerAccept = { type: 'dealRespond', deal: deal.id, accept: true };
  const forged = await request(path, host.cookie, { version: view.version, action: payerAccept }, payer.data.me);
  assert.equal(forged.status, 409, JSON.stringify(forged.data));
  const beforeFirstVote = view.version;
  await act(payer.cookie, payerAccept);
  assert.equal(view.deals.find(item => item.id === deal.id)?.status, 'offered');
  assert.equal((await request(path, payer.cookie)).data.players.find(player => player.id === payer.data.me)!.spice, payerSpice);
  assert.equal((await request(path, host.cookie)).data.bribeOptions.incoming, recipientIncoming);

  const finalAccept = { type: 'dealRespond', deal: deal.id, accept: true };
  const stale = await request(path, finalVoter.cookie, { version: beforeFirstVote, action: finalAccept });
  assert.equal(stale.status, 409, JSON.stringify(stale.data));
  assert.equal((await request(path, payer.cookie)).data.players.find(player => player.id === payer.data.me)!.spice, payerSpice);
  const preFinalVersion = view.version;
  await act(finalVoter.cookie, finalAccept);
  assert.equal(view.deals.find(item => item.id === deal.id)?.status, 'active');
  assert.match(view.log.map(item => item.text).join('\n'), /paid a 3-spice bribe/i);

  const afterPayer = await request(path, payer.cookie);
  const afterRecipient = await request(path, host.cookie);
  assert.equal(afterPayer.status, 200);
  assert.equal(afterRecipient.status, 200);
  assert.equal(afterPayer.data.players.find(player => player.id === payer.data.me)!.spice, payerSpice! - 3);
  assert.equal(afterRecipient.data.players.find(player => player.id === host.data.me)!.spice, recipientSpice);
  assert.equal(afterRecipient.data.bribeOptions.incoming, recipientIncoming + 3);
  for (const seat of seats) {
    const read = await request(path, seat.cookie);
    assert.equal(read.status, 200, JSON.stringify(read.data));
    assert.equal(read.data.deals.find(item => item.id === deal.id)?.status, 'active');
    assert.deepEqual((read.data.deals.find(item => item.id === deal.id) as unknown as { payment?: unknown }).payment, payment);
  }

  const staleReplay = await request(path, finalVoter.cookie, { version: preFinalVersion, action: finalAccept });
  assert.equal(staleReplay.status, 409, JSON.stringify(staleReplay.data));
  const replay = await request(path, finalVoter.cookie, { version: view.version, action: finalAccept });
  assert.equal(replay.status, 409, JSON.stringify(replay.data));
  const finalPayer = await request(path, payer.cookie);
  const finalRecipient = await request(path, host.cookie);
  assert.equal(finalPayer.data.players.find(player => player.id === payer.data.me)!.spice, payerSpice! - 3);
  assert.equal(finalRecipient.data.bribeOptions.incoming, recipientIncoming + 3);
  assert.equal(finalPayer.data.version, view.version);
});
