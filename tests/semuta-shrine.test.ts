import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, initializeSemutaGameForAudit, viewGame, type Game } from '../game/engine';
import { TERRITORIES } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { createControlledSemutaShrine, semutaShrineLobby, shrinePlayer, startShrineTruth } from './fixture-semuta-shrine';
import { reactSemutaSpecial } from './fixture-semuta-special-karama';
import { settleSemutaBgNative } from './fixture-semuta-bg-karama';

for (const advanced of [false, true]) {
  void test(`Shrine ${advanced ? 'Advanced' : 'Basic'} recovered Truthtrance retains one original bank-paid shipment`, () => {
    for (const claim of [false, true]) {
      const f = createControlledSemutaShrine(advanced);
      const original = shrinePlayer(f.game, f.owner).hand.find(c => c.id === f.truth)!;
      let game = applyAction(f.game, f.owner, { type: 'card', card: f.truth, mode: 'shipment', target: 'g' });
      assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'karama:shipment');
      assert.equal(game.karamaShipping, null);
      game = reactSemutaSpecial(game, f.holder, claim);
      assert.equal(game.karamaShipping?.owner, f.owner);
      assert.equal(!!game.karamaShipping?.costClaimed, claim);
      assert.deepEqual(claim ? shrinePlayer(game, f.holder).hand.find(c => c.id === f.truth) : game.discard.find(c => c.id === f.truth), original);
      assert.equal(game.pendingKarama ?? null, null, 'Shrine use is not the BG counterable conversion');
      const destination = TERRITORIES.find(t => t.type === 'sand' && t.sectors.some(s => s !== game.storm) &&
        game.players.every(p => presenceAt(p, t.id) === 0))!;
      const sector = destination.sectors.find(s => s !== game.storm)!;
      const before = structuredClone(shrinePlayer(game, 'g'));
      game = applyAction(game, 'g', { type: 'ship', territory: destination.id, sector, amount: 3, elite: 0, allyPayment: 0 });
      game = settleSemutaBgNative(game);
      assert.equal(shrinePlayer(game, 'g').spice, before.spice - 3);
      assert.equal(shrinePlayer(game, 'g').reserves, before.reserves - 3);
      assert.equal(shrinePlayer(game, 'g').forces[`${destination.id}:${sector}`], 3);
      assert.equal(game.karamaShipping, null);
    }
  });

  void test(`Shrine ${advanced ? 'Advanced' : 'Basic'} physical Karama is fresh after its committed answer`, () => {
    for (const claim of [false, true]) {
      const f = createControlledSemutaShrine(advanced);
      let game = startShrineTruth(f.game, f.karama);
      assert.equal(game.truthHistory!.at(-1)?.answer, 'yes');
      assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'truthtrance');
      const history = structuredClone(game.truthHistory);
      game = reactSemutaSpecial(game, f.holder, claim);
      assert.deepEqual(game.truthHistory, history);
      assert.equal(game.truthtrance, null);
      const physical = claim ? shrinePlayer(game, f.holder).hand.find(c => c.id === f.karama) : game.discard.find(c => c.id === f.karama);
      assert.equal(physical?.effect, 'karama');
      assert.equal(physical?.name, 'Karama');
      assert.equal(game.pendingTreacheryDiscard, null);
    }
  });
}

void test('Shrine special Emperor recovery never repeats already-completed revival', () => {
  for (const claim of [false, true]) {
    const f = createControlledSemutaShrine();
    f.game.phase = 4; // CONTROLLED Revival clock and two conserved Tank counters.
    const owner = shrinePlayer(f.game, f.owner);
    owner.reserves -= 2; owner.tanks += 2;
    const before = owner.reserves;
    let game = applyAction(f.game, f.owner, { type: 'card', card: f.truth, mode: 'special', amount: 2, elite: 0 });
    assert.equal(shrinePlayer(game, f.owner).reserves, before + 2);
    assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'specialKarama:emperorForces');
    game = reactSemutaSpecial(game, f.holder, claim);
    assert.equal(shrinePlayer(game, f.owner).reserves, before + 2);
    assert.equal(shrinePlayer(game, f.owner).tanks, 0);
    assert.equal(shrinePlayer(game, f.owner).specialKaramaUsed, true);
  }
});

void test('Shrine purchase recovery preserves the physical auction lot and spends no spice', () => {
  for (const mode of ['purchase', 'auctionPayment'] as const) for (const claim of [false, true]) {
    const f = createControlledSemutaShrine();
    // CONTROLLED auction phase/lot, conserving the original physical deck.
    const game = f.game; game.phase = 3;
    game.richeseBidding = null;
    const lot = game.deck.shift()!;
    game.auction = { cards: [lot], index: 0, bid: mode === 'purchase' ? 0 : 2,
      bidder: mode === 'purchase' ? null : f.owner, active: f.owner, passed: [], opener: 0 };
    if (mode === 'auctionPayment') game.decision = { kind: 'auctionPayment', player: f.owner };
    const spice = shrinePlayer(game, f.owner).spice;
    let done = applyAction(game, f.owner, mode === 'purchase'
      ? { type: 'card', mode, card: f.truth }
      : { type: 'decision', karama: true, card: f.truth });
    assert.equal(done.pendingTreacheryDiscard?.batch.cause, `karama:${mode}`);
    assert.equal(shrinePlayer(done, f.owner).hand.some(c => c.id === lot.id), false);
    done = reactSemutaSpecial(done, f.holder, claim);
    assert.equal(shrinePlayer(done, f.owner).hand.filter(c => c.id === lot.id).length, 1);
    assert.equal(shrinePlayer(done, f.owner).spice, spice);
    assert.equal(shrinePlayer(done, f.holder).hand.some(c => c.id === f.truth), claim);
  }
});

void test('Shrine cancellation recovery still denies the original unpaid Guild discount', () => {
  for (const claim of [false, true]) {
    const f = createControlledSemutaShrine();
    const destination = TERRITORIES.find(t => t.type === 'sand' && t.sectors.some(s => s !== f.game.storm) &&
      f.game.players.every(p => presenceAt(p, t.id) === 0))!;
    const sector = destination.sectors.find(s => s !== f.game.storm)!;
    const before = structuredClone(shrinePlayer(f.game, 'g'));
    let game = applyAction(f.game, 'g', { type: 'ship', territory: destination.id, sector, amount: 2, elite: 0, allyPayment: 0 });
    if (game.decision?.kind === 'guildShipment')
      game = applyAction(game, 'g', { type: 'decision', allow: true });
    assert.equal(game.response?.kind, 'guildRate');
    game = applyAction(game, f.owner, { type: 'card', card: f.truth, mode: 'cancel' });
    assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'karama:guildRate');
    assert.equal(shrinePlayer(game, 'g').spice, before.spice);
    game = settleSemutaBgNative(reactSemutaSpecial(game, f.holder, claim));
    assert.equal(shrinePlayer(game, 'g').spice, before.spice - 4);
    assert.equal(shrinePlayer(game, 'g').reserves, before.reserves - 2);
    assert.equal(shrinePlayer(game, 'g').forces[`${destination.id}:${sector}`], 2);
    assert.equal(shrinePlayer(game, f.holder).hand.some(c => c.id === f.truth), claim);
  }
});

void test('fresh Discovery setup retains original modules and rejects unsupported Semuta overlays', () => {
  for (const advanced of [false, true]) {
    let lobby = semutaShrineLobby(advanced);
    lobby = applyAction(lobby, lobby.host, { type: 'techTokens', enabled: true });
    if (advanced) lobby = applyAction(lobby, lobby.host, { type: 'strongholdCards', enabled: true });
    for (const player of lobby.players) if (!player.ready) lobby = applyAction(lobby, player.id, { type: 'ready' });
    const setup = initializeSemutaGameForAudit(lobby);
    assert.equal(setup.discoveries!.tokens.length, 8);
    assert.ok(setup.techTokens);
    assert.equal(!!setup.strongholdCards, advanced);
    assert.equal(viewGame(setup, 'r').status, 'setup');
    const alterations: ((g: Game) => void)[] = [g => { g.homeworlds = { custody: null }; },
      g => { g.nexusCards = { cards: null, phase: null }; }];
    for (const alter of alterations) {
      const invalid = structuredClone(lobby); alter(invalid);
      assert.throws(() => initializeSemutaGameForAudit(invalid), /Semuta Discovery/);
    }
  }
});
