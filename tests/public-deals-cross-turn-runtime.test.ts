import assert from 'node:assert/strict';
import test from 'node:test';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actMentatBribe as act, advanceMentatBribe as advance,
  createMentatBribeFixture as fixture, finishMentatBribe as finish,
  mentatBribeClean as clean, mentatBribeInventory as inventory,
  mentatBribePlayer as player,
} from './fixture-mentat-bribes';

function createDeal(game: Game, proposer: string, payer: string, recipient: string,
  amount: number, dueTurn: number) {
  const offered = act(game, proposer, { type: 'dealOffer', target: payer,
    terms: 'Pay the agreed spice by the stated turn.',
    payment: { kind: 'deferredBribe', payer, recipient, amount, dueTurn } });
  const deal = offered.deals?.at(-1); assert.ok(deal);
  const accepted = act(offered, payer, { type: 'dealRespond', deal: deal.id, accept: true });
  assert.equal(accepted.deals?.find(row => row.id === deal.id)?.paymentStatus, 'pending');
  return { game: accepted, id: deal.id };
}
function status(game: Game, id: string) {
  const deal = game.deals?.find(row => row.id === id); assert.ok(deal);
  return deal.paymentStatus;
}
function reject(game: Game, actor: string, action: Action) {
  const before = structuredClone(game);
  assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before, 'A rejected payment leaves the original game intact.');
}

/** Each route begins at the original H/A/E Basic turn-one Mentat, earned by
 * native setup, bidding and collection. The shared fixture selects only
 * unopened physical card/Spice positions; no hand or wallet is installed. */
void test('an accepted next-turn deal survives the real turn boundary and may be paid at its due turn', () => {
  const f = fixture(), payer = f.target, recipient = f.asker;
  const initialSpice = player(f.game, payer).spice;
  const { game: accepted, id } = createDeal(f.game, recipient, payer, recipient, 3, f.game.turn + 1);
  assert.equal(player(accepted,payer).spice,initialSpice);
  const next = finish(accepted);
  assert.equal(next.turn,f.game.turn + 1); assert.equal(status(next,id),'pending');
  assert.equal(player(next,payer).spice,initialSpice);
  assert.equal(viewGame(next,payer).deferredDealPaymentOptions[id]?.blocked,null);
  const paid = act(next,payer,{type:'dealPay',deal:id});
  assert.equal(status(paid,id),'paid');
  assert.equal(player(paid,payer).spice,initialSpice - 3);
  assert.equal(player(paid,recipient).bribes,3);
  reject(paid,payer,{type:'dealPay',deal:id});
  const beforeOpening = advance(paid, game => game.turn === next.turn && game.phase === 7 && clean(game));
  const recipientBefore = player(beforeOpening,recipient).spice;
  const opening = advance(beforeOpening, game => game.turn === next.turn && game.phase === 8 && clean(game));
  assert.equal(player(opening,recipient).spice,recipientBefore + 3);
  assert.equal(player(opening,recipient).bribes,0);
  assert.equal(status(opening,id),'paid');
  assert.deepEqual(inventory(opening),f.originalCards);
});

void test('a future-due deal can be paid early, and its actual late Mentat receipt waits until the next opening', () => {
  const f = fixture(), payer = f.target, recipient = f.asker;
  const { game: accepted, id } = createDeal(f.game,recipient,payer,recipient,3,f.game.turn + 1);
  const recipientSpice = player(accepted,recipient).spice;
  const paid = act(accepted,payer,{type:'dealPay',deal:id});
  assert.equal(status(paid,id),'paid');
  assert.equal(player(paid,recipient).bribes,3);
  assert.equal(player(paid,recipient).spice,recipientSpice);
  const beforeOpening = advance(paid, game => game.turn === f.game.turn + 1 && game.phase === 7 && clean(game));
  const priorSpice = player(beforeOpening,recipient).spice;
  const opening = advance(beforeOpening, game => game.turn === f.game.turn + 1 && game.phase === 8 && clean(game));
  assert.equal(player(opening,recipient).spice,priorSpice + 3);
  assert.equal(player(opening,recipient).bribes,0);
  assert.equal(status(opening,id),'paid');
  assert.deepEqual(inventory(opening),f.originalCards);
});

void test('before the due turn an accepted debt neither reserves current spice nor blocks ending the turn', () => {
  const f = fixture(), payer = f.target, recipient = f.asker;
  const { game: accepted, id } = createDeal(f.game,recipient,payer,recipient,6,f.game.turn + 1);
  const spent = act(accepted,payer,{type:'bribe',target:f.opponent,amount:8});
  assert.equal(player(spent,payer).spice,2);
  assert.equal(status(spent,id),'pending');
  const next = finish(spent);
  assert.equal(next.turn,f.game.turn + 1);
  assert.equal(status(next,id),'pending', 'Future funding is unknown, not automatically impossible.');
  assert.deepEqual(inventory(next),f.originalCards);
});

void test('a payable debt blocks its payer from ending the actual due-turn Mentat', () => {
  const f = fixture(), payer = f.target, recipient = f.asker;
  const { game: accepted, id } = createDeal(f.game,recipient,payer,recipient,3,f.game.turn + 1);
  const due = advance(accepted, game => game.turn === f.game.turn + 1 && game.phase === 8 && clean(game));
  assert.equal(status(due,id),'pending');
  reject(due,payer,{type:'ready'});
  const paid = act(due,payer,{type:'dealPay',deal:id});
  const ready = act(paid,payer,{type:'ready'});
  const next = finish(ready);
  assert.equal(next.turn,f.game.turn + 2);
  assert.equal(status(next,id),'paid');
  assert.deepEqual(inventory(next),f.originalCards);
});

void test('unanimous early release cancels only the future unpaid term', () => {
  const f = fixture(), payer = f.target, recipient = f.asker;
  const { game: accepted, id } = createDeal(f.game,recipient,payer,recipient,3,f.game.turn + 1);
  const requested = act(accepted,recipient,{type:'dealRelease',deal:id,agree:true});
  assert.equal(status(requested,id),'pending');
  const released = act(requested,payer,{type:'dealRelease',deal:id,agree:true});
  assert.equal(status(released,id),'released');
  reject(released,payer,{type:'dealPay',deal:id});
  const next = finish(released);
  assert.equal(status(next,id),'released');
  assert.equal(player(next,payer).spice,player(f.game,payer).spice);
  assert.deepEqual(inventory(next),f.originalCards);
});

void test('different due turns remain separate and may be settled in either order', () => {
  const f = fixture(), payer = f.target, recipient = f.asker, turn = f.game.turn;
  const first = createDeal(f.game,recipient,payer,recipient,3,turn + 1);
  const second = createDeal(first.game,recipient,payer,recipient,4,turn + 2);
  const next = finish(second.game);
  assert.equal(status(next,first.id),'pending'); assert.equal(status(next,second.id),'pending');
  const paidSecond = act(next,payer,{type:'dealPay',deal:second.id});
  assert.equal(status(paidSecond,first.id),'pending'); assert.equal(status(paidSecond,second.id),'paid');
  assert.equal(player(paidSecond,recipient).bribes,4);
  const paidFirst = act(paidSecond,payer,{type:'dealPay',deal:first.id});
  assert.equal(status(paidFirst,first.id),'paid');
  assert.equal(player(paidFirst,recipient).bribes,7);
  assert.deepEqual(inventory(paidFirst),f.originalCards);
});
