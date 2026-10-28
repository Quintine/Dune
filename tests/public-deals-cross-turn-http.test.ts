// @dune-suite integration
import assert from 'node:assert/strict';
import test from 'node:test';
import type { GameView } from '../game/engine';

const base = process.env.DUNE_TEST_URL ?? 'http://localhost:3000';
async function request(path: string, cookie?: string, body?: unknown, selected?: string) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(15_000),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { cookie } : {}),
      ...(selected ? { 'X-Dune-Seat': selected } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0],
    data: await response.json() as GameView & { error?: string } };
}

/** This test creates only its own room on the isolated integration server. */
void test('authenticated participants consent to a future-due deal and its payer settles early once', async () => {
  const host = await request('/api/rooms', undefined, {
    name: 'Future deal recipient', faction: 'atreides', advanced: false, expansions: [],
  });
  assert.equal(host.status, 201, JSON.stringify(host.data)); assert.ok(host.cookie);
  const path = `/api/rooms/${host.data.code}`;
  const payer = await request(path, undefined, { type: 'join', name: 'Future deal payer', faction: 'harkonnen' });
  assert.equal(payer.status, 200, JSON.stringify(payer.data)); assert.ok(payer.cookie);
  const third = await request(path, undefined, { type: 'join', name: 'Future deal witness', faction: 'emperor' });
  assert.equal(third.status, 200, JSON.stringify(third.data)); assert.ok(third.cookie);
  const seats = [
    { id: host.data.me, cookie: host.cookie },
    { id: payer.data.me, cookie: payer.cookie },
    { id: third.data.me, cookie: third.cookie },
  ];
  let view = third.data;
  const act = async (cookie: string, action: object) => {
    const next = await request(path, cookie, { version: view.version, action });
    assert.equal(next.status, 200, JSON.stringify(next.data)); view = next.data; return next.data;
  };
  for (const seat of seats) await act(seat.cookie, { type: 'ready' });
  await act(host.cookie, { type: 'start' });
  for (const seat of seats) {
    const own = await request(path, seat.cookie);
    assert.equal(own.status, 200, JSON.stringify(own.data)); view = own.data;
    const choices = own.data.players.find(player => player.id === seat.id)?.traitorChoices;
    if (choices?.length) await act(seat.cookie, { type: 'traitor', leader: choices[0] });
  }
  assert.equal(view.status, 'playing'); assert.equal(view.phase, 0);
  const offerTurn = view.turn;
  const payerBefore = await request(path, payer.cookie);
  const recipientBefore = await request(path, host.cookie);
  assert.equal(payerBefore.status, 200); assert.equal(recipientBefore.status, 200);
  const payerSpice = payerBefore.data.players.find(player => player.id === payer.data.me)!.spice;
  const recipientSpice = recipientBefore.data.players.find(player => player.id === host.data.me)!.spice;
  const recipientIncoming = recipientBefore.data.bribeOptions.incoming;
  assert.ok(typeof payerSpice === 'number' && payerSpice >= 3);

  const payment = { kind: 'deferredBribe', payer: payer.data.me, recipient: host.data.me,
    amount: 3, dueTurn: offerTurn + 1 };
  await act(host.cookie, { type: 'dealOffer', targets: [payer.data.me, third.data.me],
    terms: 'Pay the agreed spice by next turn.', payment });
  const deal = view.deals.at(-1); assert.ok(deal); assert.equal(deal.status, 'offered');
  assert.deepEqual(deal.payment, payment);
  const pay = { type: 'dealPay', deal: deal.id };
  const premature = await request(path, payer.cookie, { version: view.version, action: pay });
  assert.equal(premature.status, 409, JSON.stringify(premature.data));
  await act(payer.cookie, { type: 'dealRespond', deal: deal.id, accept: true });
  assert.equal(view.deals.find(row => row.id === deal.id)?.status, 'offered');
  await act(third.cookie, { type: 'dealRespond', deal: deal.id, accept: true });
  assert.equal(view.deals.find(row => row.id === deal.id)?.status, 'active');
  assert.equal(view.deals.find(row => row.id === deal.id)?.paymentStatus, 'pending');
  for (const seat of seats) {
    const read = await request(path, seat.cookie); assert.equal(read.status, 200, JSON.stringify(read.data));
    const visible: GameView['deals'][number] | undefined = read.data.deals.find(row => row.id === deal.id);
    assert.deepEqual(visible?.payment, payment); assert.equal(visible?.paymentStatus, 'pending');
  }
  const pendingPayer = await request(path, payer.cookie);
  const pendingRecipient = await request(path, host.cookie);
  assert.equal(pendingPayer.data.players.find(player => player.id === payer.data.me)!.spice, payerSpice);
  assert.equal(pendingRecipient.data.bribeOptions.incoming, recipientIncoming);
  assert.equal(pendingPayer.data.deferredDealPaymentOptions[deal.id]?.blocked, null);
  assert.equal(pendingRecipient.data.deferredDealPaymentOptions[deal.id], undefined);

  const otherSeat = await request(path, host.cookie, { version: view.version, action: pay });
  assert.equal(otherSeat.status, 409, JSON.stringify(otherSeat.data));
  const forged = await request(path, host.cookie, { version: view.version, action: pay }, payer.data.me);
  assert.equal(forged.status, 409, JSON.stringify(forged.data));
  const previousVersion = view.version;
  await act(payer.cookie, pay);
  assert.equal(view.turn, offerTurn); assert.ok(view.turn < payment.dueTurn);
  assert.equal(view.deals.find(row => row.id === deal.id)?.paymentStatus, 'paid');
  const paidPayer = await request(path, payer.cookie);
  const paidRecipient = await request(path, host.cookie);
  assert.equal(paidPayer.data.players.find(player => player.id === payer.data.me)!.spice, payerSpice - 3);
  assert.equal(paidRecipient.data.players.find(player => player.id === host.data.me)!.spice, recipientSpice);
  assert.equal(paidRecipient.data.bribeOptions.incoming, recipientIncoming + 3);
  const stale = await request(path, payer.cookie, { version: previousVersion, action: pay });
  assert.equal(stale.status, 409, JSON.stringify(stale.data));
  const replay = await request(path, payer.cookie, { version: view.version, action: pay });
  assert.equal(replay.status, 409, JSON.stringify(replay.data));
  assert.equal((await request(path, host.cookie)).data.bribeOptions.incoming, recipientIncoming + 3);
});
