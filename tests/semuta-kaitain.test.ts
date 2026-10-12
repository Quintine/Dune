import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { biddingEndDiscardChoice } from '../game/bidding-end-options';
import { homeworldCardEconomyPopulation } from '../game/homeworld-card-economy';
import {
  createSemutaKaitainFixture, reactSemutaKaitain, type SemutaKaitainFixture,
} from './fixture-semuta-kaitain';
import { moveSemutaEmperorCard, semutaEmperorPlayer as semutaKaitainPlayer } from './fixture-semuta-emperor-share';
import { biddingPhysicalIds as semutaKaitainStock } from './fixture-homeworld-occupied-bidding';
import { nextRicheseSkillsTechNativeStep } from './fixture-richese-skills-tech';

const wallets = (game: Game) => game.players.map(p => ({ id: p.id, spice: p.spice }));
const held = (game: Game, id: string) => semutaKaitainPlayer(game, id).hand.map(card => card.id);

function assertPaidSource(f: SemutaKaitainFixture): void {
  const population = homeworldCardEconomyPopulation(f.game, f.owner, 'kaitain');
  assert.equal(population?.side, 'high');
  assert.deepEqual(population, homeworldCardEconomyPopulation(f.setup, f.owner, 'kaitain'),
    'Kaitain uses its original setup reserve population, not manufactured forces');
  assert.equal(semutaKaitainPlayer(f.game, f.owner).spice, 10);
  const pending = f.paid.pendingTreacheryDiscard!;
  assert.ok(pending);
  assert.equal(pending.batch.cause, 'kaitain');
  assert.deepEqual(pending.batch.entries, f.cards.map(card => ({ card, discardedBy: f.owner, publicFace: false })));
  assert.equal(pending.reaction?.stage, 'offer');
  assert.deepEqual(f.paid.deck, f.game.deck, 'Paid disposal neither auctions nor draws a card');
  assert.deepEqual(f.paid.richeseCache, f.game.richeseCache);
  assert.equal(f.paid.phase, 3);
  assert.equal(f.paid.turn, 1);
  assert.ok(!f.paid.response && !f.paid.pendingKarama && !f.paid.battle,
    'Discarded Karama/Poison Tooth are not played');
  assert.deepEqual(held(f.paid, f.owner), held(f.game, f.owner).filter(id => !f.cardIds.includes(id)));
  assert.deepEqual(wallets(f.paid), wallets(f.game).map(p => p.id === f.owner
    ? { ...p, spice: p.spice - 2 * f.cardIds.length } : p));
  assert.deepEqual(semutaKaitainStock(f.paid), f.stock);
}

function assertResumed(f: SemutaKaitainFixture, game: Game, selected?: string): void {
  assert.equal(game.resolvedTreacheryDiscardSequence, f.paid.pendingTreacheryDiscard!.sequence);
  assert.equal(game.turn, 1);
  assert.equal(game.phase, 3);
  assert.deepEqual(game.deck, f.game.deck);
  assert.deepEqual(game.richeseCache, f.game.richeseCache);
  assert.deepEqual(wallets(game), wallets(f.paid), 'Semuta never refunds or repeats the printed debit');
  assert.deepEqual(held(game, f.owner), held(f.paid, f.owner));
  assert.deepEqual(held(game, f.holder), selected
    ? [...held(f.game, f.holder).filter(id => id !== f.semuta), selected]
    : held(f.game, f.holder));
  for (const id of f.cardIds) assert.equal(game.discard.filter(card => card.id === id).length, Number(id !== selected));
  assert.equal(game.discard.filter(card => card.id === f.semuta).length, Number(!!selected));
  assert.deepEqual(semutaKaitainStock(game), f.stock);
}

for (const advanced of [false, true]) {
  const mode = advanced ? 'Advanced' : 'Basic';
  for (const claim of [false, true]) void test(`${mode} original high Kaitain singleton ${claim ? 'claim' : 'pass'} keeps its paid owner finish`, () => {
    const f = createSemutaKaitainFixture({ advanced, count: 1, choamReady: true });
    assertPaidSource(f);
    const event = f.paid.pendingTreacheryDiscard!.batch.event;
    assert.equal(viewGame(f.paid, f.holder).semutaReaction?.canCommit, true);
    assert.deepEqual(viewGame(f.paid, f.holder).semutaReaction?.candidates, []);
    assert.throws(() => applyAction(f.paid, f.owner, { type: 'biddingEnd', event: f.event, mode: 'ready' }));
    assert.throws(() => applyAction(f.paid, f.holder, { type: 'semutaSelect', event, card: f.cardIds[0] }));
    const resumed = reactSemutaKaitain(f.paid, f, claim);
    assertResumed(f, resumed, claim ? f.cardIds[0] : undefined);
    assert.equal(resumed.biddingEnd!.ready.includes(f.owner), false);
    assert.throws(() => applyAction(resumed, f.holder, { type: 'biddingEnd', event: f.event, mode: 'ready' }));
    assert.throws(() => applyAction(resumed, f.holder, { type: 'semutaCommit', event }));
    const emperorFinished = applyAction(resumed, f.owner, { type: 'biddingEnd', event: f.event, mode: 'ready' });
    assert.equal(emperorFinished.phase, 3, 'The paid action requires CHOAM to acknowledge again');
    const finished = applyAction(emperorFinished, f.choam, { type: 'biddingEnd', event: f.event, mode: 'ready' });
    assert.equal(finished.phase, 4);
    assert.deepEqual(finished.deck, f.game.deck);
    assert.deepEqual(wallets(finished), wallets(f.paid));
  });

  for (const selectedIndex of [0, 1]) void test(`${mode} simultaneous private Kaitain group allows actual post-commit choice ${selectedIndex + 1} at full four-card capacity`, () => {
    const f = createSemutaKaitainFixture({ advanced, count: 2, fullHolder: true });
    assertPaidSource(f);
    assert.equal(held(f.game, f.holder).length, 4);
    const event = f.paid.pendingTreacheryDiscard!.batch.event;
    const offered = viewGame(f.paid, f.holder).semutaReaction!;
    assert.equal(offered.canCommit, true, 'Exchanging Semuta needs no fifth slot');
    assert.deepEqual(offered.candidates, []);
    assert.equal(viewGame(f.paid, f.owner).biddingEnd?.canAct, false);
    const committed = applyAction(f.paid, f.holder, { type: 'semutaCommit', event });
    assert.equal(committed.pendingTreacheryDiscard?.reaction?.stage, 'select');
    assert.deepEqual(viewGame(committed, f.holder).semutaReaction?.candidates, f.cards);
    assert.deepEqual(viewGame(committed, f.owner).semutaReaction?.candidates, []);
    assert.deepEqual(held(committed, f.holder), held(f.game, f.holder), 'Commit alone has not chosen a physical card');
    assert.deepEqual(wallets(committed), wallets(f.paid));
    assert.throws(() => applyAction(committed, f.owner, { type: 'semutaSelect', event, card: f.cardIds[0] }));
    assert.throws(() => applyAction(committed, f.holder, { type: 'semutaSelect', event, card: f.semuta }));
    assert.throws(() => applyAction(committed, f.holder, { type: 'semutaPass', event }));
    const selected = f.cardIds[selectedIndex];
    const resumed = applyAction(committed, f.holder, { type: 'semutaSelect', event, card: selected });
    assertResumed(f, resumed, selected);
    assert.equal(held(resumed, f.holder).length, 4);
    assert.equal(viewGame(resumed, f.owner).biddingEnd?.canAct, true);
    // CHOAM shares this same native window; neither owner's finish substitutes for the other.
    const emperorReady = applyAction(resumed, f.owner, { type: 'biddingEnd', event: f.event, mode: 'ready' });
    assert.equal(emperorReady.phase, 3);
    assert.equal(viewGame(emperorReady, f.choam).biddingEnd?.canAct, true);
    const finished = applyAction(emperorReady, f.choam, { type: 'biddingEnd', event: f.event, mode: 'ready' });
    assert.equal(finished.phase, 4);
    assert.deepEqual(finished.deck, f.game.deck);
    assert.deepEqual(wallets(finished), wallets(f.paid));
  });

  void test(`${mode} a new paid Kaitain action requires both original owners to acknowledge again`, () => {
    const f = createSemutaKaitainFixture({ advanced, count: 2, ownerReady: true });
    assertPaidSource(f);
    const resumed = reactSemutaKaitain(f.paid, f, false);
    assertResumed(f, resumed);
    assert.equal(resumed.choamMarket?.owner, f.choam);
    assert.equal(resumed.choamMarket?.resume, 'phase');
    assert.equal(viewGame(resumed, f.choam).biddingEnd?.canAct, true);
    const choamFinished = applyAction(resumed, f.choam, { type: 'biddingEnd', event: f.event, mode: 'ready' });
    assert.equal(choamFinished.phase, 3, 'Earlier Emperor readiness cannot finish a changed closing window');
    const finished = applyAction(choamFinished, f.owner, { type: 'biddingEnd', event: f.event, mode: 'ready' });
    assert.equal(finished.phase, 4);
    assert.deepEqual(wallets(finished), wallets(f.paid));
  });

  void test(`${mode} original CHOAM duplicate sale coexists with the paid Kaitain owner finish`, () => {
    const f = createSemutaKaitainFixture({ advanced, count: 1 });
    let game = reactSemutaKaitain(f.paid, f, true);
    const spice = semutaKaitainPlayer(game, f.choam).spice;
    // Explicit later conserved position: two original Shields enter CHOAM's hand,
    // not an auction purchase, played card or replacement stock.
    while (semutaKaitainPlayer(game, f.choam).hand.filter(card => card.name === 'Shield').length < 2) {
      const card = [...game.deck, ...game.discard,
        ...game.players.filter(p => p.id !== f.choam && p.id !== f.owner).flatMap(p => p.hand)]
        .find(card => card.name === 'Shield');
      assert.ok(card);
      moveSemutaEmperorCard(game, card.id, f.choam);
    }
    const deck = structuredClone(game.deck);
    const sale = viewGame(game, f.choam).choamMarket?.sales?.find(sale => sale.price === 3);
    assert.ok(sale);
    game = applyAction(game, f.choam, { type: 'biddingEnd', event: f.event,
      mode: 'sell', card: sale.card, witness: sale.witness });
    assert.equal(game.response?.kind, 'choamSale');
    assert.throws(() => applyAction(game, f.owner, { type: 'biddingEnd', event: f.event, mode: 'ready' }));
    while (game.response?.kind === 'choamSale') {
      const next = nextRicheseSkillsTechNativeStep(game);
      game = applyAction(game, next.actor, next.action);
    }
    assert.equal(semutaKaitainPlayer(game, f.choam).spice, spice + 3, 'Original exact-duplicate sale price');
    assert.equal(semutaKaitainPlayer(game, f.owner).spice, 8, 'Independent Kaitain debit remains paid exactly once');
    assert.ok(game.discard.some(card => card.id === sale.card));
    assert.ok(held(game, f.choam).includes(sale.witness!));
    assert.equal(game.biddingEnd!.event, f.event);
    assert.equal(game.phase, 3);
    assert.deepEqual(semutaKaitainStock(game), f.stock);
    game = applyAction(game, f.choam, { type: 'biddingEnd', event: f.event, mode: 'ready' });
    assert.equal(game.phase, 3);
    game = applyAction(game, f.owner, { type: 'biddingEnd', event: f.event, mode: 'ready' });
    assert.equal(game.phase, 4);
    assert.deepEqual(game.deck, deck);
  });

  void test(`${mode} native closing controls reject nonowner, stale and duplicate paid selections`, () => {
    const f = createSemutaKaitainFixture({ advanced });
    assert.equal(biddingEndDiscardChoice(viewGame(f.game, f.owner), f.cardIds).cost, 4);
    assert.equal(biddingEndDiscardChoice(viewGame(f.game, f.holder), f.cardIds).action, null);
    assert.throws(() => applyAction(f.game, f.holder, f.action));
    assert.throws(() => applyAction(f.game, f.choam, f.action));
    assert.throws(() => applyAction(f.game, f.owner, { ...f.action, event: `${f.event}:stale` }));
    assert.throws(() => applyAction(f.game, f.owner, { ...f.action, cards: [f.cardIds[0], f.cardIds[0]] }));
    assert.throws(() => applyAction(f.game, f.owner, { ...f.action, cards: [f.semuta] }));
    const resumed = reactSemutaKaitain(f.paid, f, false);
    assert.throws(() => applyAction(resumed, f.owner, f.action), 'Original selected cards cannot be charged again');
    assert.deepEqual(wallets(resumed), wallets(f.paid));
  });
}

void test('every minimal legal Semuta bot resolves native paid Kaitain without replaying the debit', () => {
  for (const difficulty of ['Easy', 'Medium', 'Hard', 'Brutal'] as const) {
    const f = createSemutaKaitainFixture({ count: 2, fullHolder: true });
    let game = f.paid;
    const own = viewGame(game, f.holder);
    own.players.find(p => p.id === f.holder)!.bot = difficulty;
    const commit = botActions(own)[0];
    assert.ok(commit);
    assert.equal(commit.type, 'semutaCommit');
    game = applyAction(game, f.holder, commit);
    assert.equal(game.pendingTreacheryDiscard?.reaction?.stage, 'select');
    const selectionView = viewGame(game, f.holder);
    selectionView.players.find(p => p.id === f.holder)!.bot = difficulty;
    const select = botActions(selectionView)[0];
    assert.ok(select);
    assert.equal(select.type, 'semutaSelect');
    assert.ok(f.cardIds.includes(select.card as string));
    game = applyAction(game, f.holder, select);
    assertResumed(f, game, select.card as string);
  }
});
