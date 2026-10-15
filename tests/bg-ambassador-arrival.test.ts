import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, viewGame, type Game } from '../game/engine';
import {
  applyBgAmbassadorArrivalStep, beginBgAmbassadorArrival,
  bgAmbassadorAccompanimentAction, bgAmbassadorArrivalPlayer,
  bgAmbassadorIntrusionAction, bgAmbassadorOfferAction,
  createBgAmbassadorArrivalFixture, finishBgAmbassadorArrival,
  settleBgAmbassadorArrivalControls, type BgAmbassadorArrivalFixture,
} from './fixture-bg-ambassador-arrival';

function assertStock(game: Game) {
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, count) => sum + count, 0), 20);
    if (player.elites) {
      assert.equal(player.elites.reserves + player.elites.tanks + Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0), 5);
      for (const [key, count] of Object.entries(player.elites.forces)) assert.ok(count <= (player.forces[key] ?? 0));
    }
  }
}
function assertPaidOnce(fixture: BgAmbassadorArrivalFixture, game: Game) {
  const before = bgAmbassadorArrivalPlayer(fixture.beforeShipment, fixture.entrant);
  const entrant = bgAmbassadorArrivalPlayer(game, fixture.entrant);
  assert.equal(entrant.spice, before.spice - 1);
  assert.equal(entrant.reserves, before.reserves - 1);
  assert.equal(entrant.forces[fixture.location], 1);
  assert.equal(entrant.shipped, true);
  assert.equal(entrant.moved, before.moved);
  assert.deepEqual(entrant.elites, before.elites);
  assert.equal(game.active, fixture.entrant);
  assert.equal(game.turn, fixture.beforeShipment.turn);
  assert.equal(game.phase, fixture.beforeShipment.phase);
  assertStock(game);
}
function assertMainQueue(fixture: BgAmbassadorArrivalFixture, game: Game) {
  assert.deepEqual(game.pendingArrivalReaction, [{
    entrant: fixture.entrant, territory: fixture.territory, sector: 11,
    amount: 1, elite: 0, cause: 'shipment', resume: 'none',
    turn: fixture.beforeShipment.turn, phase: fixture.beforeShipment.phase,
  }]);
  assert.equal(game.pendingAmbassador ?? null, null);
  assertPaidOnce(fixture, game);
}
function assertMainOffer(fixture: BgAmbassadorArrivalFixture, game: Game) {
  const entry = game.pendingAmbassador;
  assert.ok(entry);
  assert.equal(game.decision?.kind, 'ecazAmbassador');
  assert.equal(game.decision?.player, fixture.owner);
  assert.equal(entry.owner, fixture.owner);
  assert.equal(entry.entrant, fixture.entrant, 'The BG advisor arrival must not replace the committed main entrant');
  assert.equal(entry.token, fixture.token);
  assert.equal(entry.territory, fixture.territory);
  assert.equal(entry.sector, 11);
  assert.equal(entry.stage, 'offer');
  assert.equal(game.pendingArrivalReaction?.length ?? 0, 0);
  assertPaidOnce(fixture, game);
}
function assertOriginalMovementResumes(fixture: BgAmbassadorArrivalFixture, game: Game, trigger: boolean) {
  assert.equal(game.decision ?? null, null);
  assert.equal(game.response ?? null, null);
  assert.equal(game.pendingAmbassador ?? null, null);
  assert.equal(game.pendingArrivalReaction?.length ?? 0, 0);
  assertPaidOnce(fixture, game);
  const token = game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)!;
  assert.equal(token.zone, trigger ? 'supply' : 'placed');
  assert.equal(token.location, trigger ? null : fixture.territory);
  if (trigger) {
    assert.equal(game.dukeVidal?.controller, fixture.owner);
    assert.equal(game.dukeVidal?.leader.strength, 6);
  } else assert.equal(game.dukeVidal?.controller ?? null, null);
  const before = bgAmbassadorArrivalPlayer(game, fixture.entrant);
  const bgBefore = bgAmbassadorArrivalPlayer(game, fixture.advisor);
  const moved = applyBgAmbassadorArrivalStep(game, { actor: fixture.entrant, action: fixture.movementAction });
  const entrant = bgAmbassadorArrivalPlayer(moved, fixture.entrant);
  assert.equal(entrant.forces[fixture.location] ?? 0, 0);
  assert.equal(entrant.forces['arsunt:11'], 1);
  assert.equal(entrant.spice, before.spice);
  assert.equal(entrant.reserves, before.reserves);
  assert.equal(entrant.moved, before.moved + 1);
  assert.equal(entrant.shipped, true);
  assert.equal(moved.active, fixture.entrant);
  assert.equal(moved.phase, game.phase);
  assert.equal(moved.turn, game.turn);
  assert.equal(moved.pendingAmbassador ?? null, null);
  assert.equal(moved.pendingArrivalReaction?.length ?? 0, 0);
  assert.deepEqual(bgAmbassadorArrivalPlayer(moved, fixture.advisor).forces, bgBefore.forces);
  assert.equal(bgAmbassadorArrivalPlayer(moved, fixture.advisor).reserves, bgBefore.reserves);
  // If BG remains alone after the original entrant moves out, its stance changes
  // automatically without another entry event or another Ambassador prompt.
  if (bgBefore.forces[fixture.location])
    assert.equal(bgAmbassadorArrivalPlayer(moved, fixture.advisor).advisors?.[fixture.territory], undefined);
  assertStock(moved);
}

for (const accept of [true, false]) {
  void test(`original paid stronghold entry waits for BG's own ${accept ? 'accepted' : 'declined'} advisor before one Ecaz offer`, () => {
    const fixture = createBgAmbassadorArrivalFixture();
    assertStock(fixture.afterSetup);
    assertStock(fixture.beforeShipment);
    const bgBefore = bgAmbassadorArrivalPlayer(fixture.beforeShipment, fixture.advisor);
    const cohort = structuredClone(fixture.beforeShipment.ecazAmbassadors!.cohort);
    let game = beginBgAmbassadorArrival(fixture);
    assert.equal(game.decision?.kind, 'advisor');
    assert.equal(game.decision?.player, fixture.advisor);
    assert.equal(viewGame(game, fixture.advisor).decision?.player, fixture.advisor);
    assertMainQueue(fixture, game);
    assert.throws(() => applyAction(game, fixture.entrant, { type: 'endMovement' }));
    assert.throws(() => applyAction(game, fixture.owner, bgAmbassadorAccompanimentAction(accept)));
    game = applyBgAmbassadorArrivalStep(game, { actor: fixture.advisor, action: bgAmbassadorAccompanimentAction(accept) });
    if (accept) {
      assert.equal(game.response?.kind, 'advisor', 'The actual original Karama holder keeps the native cancellation response open');
      assertMainQueue(fixture, game);
    }
    game = settleBgAmbassadorArrivalControls(game);
    const bg = bgAmbassadorArrivalPlayer(game, fixture.advisor);
    assert.equal(bg.reserves, bgBefore.reserves - (accept ? 1 : 0));
    assert.equal(bg.forces[fixture.location] ?? 0, accept ? 1 : 0);
    assert.equal(bg.spice, bgBefore.spice);
    assert.equal(bg.forces['imperial_basin:10'], 1);
    if (accept) assert.equal(bg.advisors?.[fixture.territory]?.lockedTurn, game.turn);
    else assert.equal(bg.advisors?.[fixture.territory], undefined);
    assertMainOffer(fixture, game);
    const spentOffer = bgAmbassadorOfferAction(game, accept);
    game = finishBgAmbassadorArrival(game, accept);
    assert.deepEqual(game.ecazAmbassadors!.cohort, cohort);
    assert.throws(() => applyAction(game, fixture.owner, spentOffer), 'The single original offer cannot be replayed');
    assertOriginalMovementResumes(fixture, game, accept);
  });
}

for (const becomeAdvisors of [true, false]) {
  void test(`original moved BG fighter ${becomeAdvisors ? 'accepts' : 'declines'} Intrusion before accompaniment and the main Ambassador entry`, () => {
    const fixture = createBgAmbassadorArrivalFixture({ fighters: true });
    assert.equal(fixture.afterSetup.turn, 1);
    assert.equal(fixture.beforeShipment.turn, 2);
    assert.ok(fixture.actions.some(step => step.actor === fixture.advisor && step.action.type === 'move' && step.action.from === 'imperial_basin:10'));
    const bgBefore = bgAmbassadorArrivalPlayer(fixture.beforeShipment, fixture.advisor);
    assert.equal(bgBefore.forces[fixture.location], 1);
    assert.equal(bgBefore.forces['imperial_basin:10'] ?? 0, 0);
    assert.equal(bgBefore.advisors?.[fixture.territory], undefined);
    let game = beginBgAmbassadorArrival(fixture);
    assert.equal(game.decision?.kind, 'intrusion');
    assert.equal(game.decision?.player, fixture.advisor);
    assertMainQueue(fixture, game);
    assert.throws(() => applyAction(game, fixture.entrant, bgAmbassadorIntrusionAction(becomeAdvisors)));
    game = applyBgAmbassadorArrivalStep(game, { actor: fixture.advisor, action: bgAmbassadorIntrusionAction(becomeAdvisors) });
    if (becomeAdvisors) {
      assert.equal(game.response?.kind, 'advisorFlip');
      assert.equal(game.response?.owner, fixture.advisor);
      assertMainQueue(fixture, game);
    }
    game = settleBgAmbassadorArrivalControls(game);
    assert.equal(game.decision?.kind, 'advisor');
    assert.equal(game.decision?.player, fixture.advisor);
    assert.equal(!!bgAmbassadorArrivalPlayer(game, fixture.advisor).advisors?.[fixture.territory], becomeAdvisors);
    assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).reserves, bgBefore.reserves);
    assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).forces[fixture.location], 1);
    assertMainQueue(fixture, game);
    // Keeping fighters and accepting accompaniment would join that fighter
    // group, not manufacture an advisor. Here that branch legitimately declines
    // the reserve transfer; the accepted branch joins the newly peaceful group.
    game = applyBgAmbassadorArrivalStep(game, { actor: fixture.advisor, action: bgAmbassadorAccompanimentAction(becomeAdvisors) });
    if (becomeAdvisors) {
      assert.equal(game.response?.kind, 'advisor');
      assertMainQueue(fixture, game);
    }
    game = settleBgAmbassadorArrivalControls(game);
    const bg = bgAmbassadorArrivalPlayer(game, fixture.advisor);
    assert.equal(bg.forces[fixture.location], becomeAdvisors ? 2 : 1);
    assert.equal(bg.reserves, bgBefore.reserves - (becomeAdvisors ? 1 : 0));
    assert.equal(bg.spice, bgBefore.spice);
    if (becomeAdvisors) assert.equal(bg.advisors?.[fixture.territory]?.lockedTurn, game.turn);
    else assert.equal(bg.advisors?.[fixture.territory], undefined);
    assertMainOffer(fixture, game);
    game = finishBgAmbassadorArrival(game, !becomeAdvisors);
    assertOriginalMovementResumes(fixture, game, !becomeAdvisors);
  });
}

void test('declining Intrusion and accepting accompaniment preserves fighters: one BG child offer then one original shipper offer', () => {
  const fixture = createBgAmbassadorArrivalFixture({ fighters: true });
  const bgBefore = bgAmbassadorArrivalPlayer(fixture.beforeShipment, fixture.advisor);
  let game = beginBgAmbassadorArrival(fixture);
  assert.equal(game.decision?.kind, 'intrusion');
  assertMainQueue(fixture, game);
  const mainQueue = structuredClone(game.pendingArrivalReaction);
  game = applyBgAmbassadorArrivalStep(game, {
    actor: fixture.advisor, action: bgAmbassadorIntrusionAction(false),
  });
  assert.equal(game.decision?.kind, 'advisor');
  assertMainQueue(fixture, game);
  game = applyBgAmbassadorArrivalStep(game, {
    actor: fixture.advisor, action: bgAmbassadorAccompanimentAction(true),
  });
  assert.equal(game.response?.kind, 'advisor');
  assertMainQueue(fixture, game);
  game = settleBgAmbassadorArrivalControls(game);
  const bg = bgAmbassadorArrivalPlayer(game, fixture.advisor);
  assert.equal(bg.forces[fixture.location], 2);
  assert.equal(bg.reserves, bgBefore.reserves - 1);
  assert.equal(bg.spice, bgBefore.spice);
  assert.equal(bg.advisors?.[fixture.territory], undefined, 'Accompaniment must match the existing fighter group');
  const child = game.pendingAmbassador;
  assert.ok(child);
  assert.equal(game.decision?.kind, 'ecazAmbassador');
  assert.equal(game.decision?.player, fixture.owner);
  assert.equal(child.entrant, fixture.advisor, 'This physical BG fighter arrival is independently eligible');
  assert.equal(child.owner, fixture.owner);
  assert.equal(child.token, fixture.token);
  assert.equal(child.territory, fixture.territory);
  assert.deepEqual(game.pendingArrivalReaction, mainQueue, 'The original paid arrival waits while the eligible BG child resolves');
  assertPaidOnce(fixture, game);
  const childEvent = child.event;
  // Existing callback order is child-first, not an invented FIFO priority.
  // Keeping the token in place lets the queued original entry open its own
  // single offer without pretending the fighter child was an advisor.
  game = finishBgAmbassadorArrival(game, false);
  assertMainOffer(fixture, game);
  assert.notEqual(game.pendingAmbassador!.event, childEvent);
  assert.equal(game.ecazAmbassadors!.tokens.find(token => token.id === fixture.token)!.zone, 'placed');
  assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).forces[fixture.location], 2);
  assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).reserves, bgBefore.reserves - 1);
  game = finishBgAmbassadorArrival(game, true);
  assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).advisors?.[fixture.territory], undefined);
  assertOriginalMovementResumes(fixture, game, true);
});

void test('triggering the genuine BG fighter child returns the live Ecaz token before the queued shipper entry resumes', () => {
  const fixture = createBgAmbassadorArrivalFixture({ fighters: true });
  const bgBefore = bgAmbassadorArrivalPlayer(fixture.beforeShipment, fixture.advisor);
  let game = beginBgAmbassadorArrival(fixture);
  game = applyBgAmbassadorArrivalStep(game, {
    actor: fixture.advisor, action: bgAmbassadorIntrusionAction(false),
  });
  assert.equal(game.decision?.kind, 'advisor');
  game = settleBgAmbassadorArrivalControls(applyBgAmbassadorArrivalStep(game, {
    actor: fixture.advisor, action: bgAmbassadorAccompanimentAction(true),
  }));
  assert.equal(game.pendingAmbassador?.entrant, fixture.advisor);
  assert.equal(game.pendingArrivalReaction?.[0]?.entrant, fixture.entrant);
  const spentChild = bgAmbassadorOfferAction(game, true);
  // This pins the existing provisional child-first/live-token composition,
  // not a publisher priority: triggering returns the reusable token to supply,
  // so processing the original committed entry cannot trigger that token again.
  game = finishBgAmbassadorArrival(game, true);
  assert.equal(game.pendingAmbassador ?? null, null);
  assert.equal(game.pendingArrivalReaction?.length ?? 0, 0);
  assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).forces[fixture.location], 2);
  assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).reserves, bgBefore.reserves - 1);
  assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).advisors?.[fixture.territory], undefined);
  assert.throws(() => applyAction(game, fixture.owner, spentChild));
  assertOriginalMovementResumes(fixture, game, true);
});

void test('canceling the real accepted accompaniment preserves the original paid Ambassador entry without a reserve transfer', () => {
  const fixture = createBgAmbassadorArrivalFixture();
  const before = bgAmbassadorArrivalPlayer(fixture.beforeShipment, fixture.advisor);
  let game = beginBgAmbassadorArrival(fixture);
  game = applyBgAmbassadorArrivalStep(game, { actor: fixture.advisor, action: bgAmbassadorAccompanimentAction(true) });
  const card = viewGame(game, fixture.owner).responseControls?.cancelCards[0];
  assert.ok(card);
  game = applyBgAmbassadorArrivalStep(game, { actor: fixture.owner, action: { type: 'card', mode: 'cancel', card } });
  assertMainOffer(fixture, game);
  assert.deepEqual(bgAmbassadorArrivalPlayer(game, fixture.advisor).forces, before.forces);
  assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).reserves, before.reserves);
  assert.equal(game.discard.filter(c => c.id === card).length, 1);
  assertOriginalMovementResumes(fixture, finishBgAmbassadorArrival(game, false), false);
});

void test('canceling the real Intrusion flip retains fighters and the followup before the original Ambassador entry', () => {
  const fixture = createBgAmbassadorArrivalFixture({ fighters: true });
  let game = beginBgAmbassadorArrival(fixture);
  game = applyBgAmbassadorArrivalStep(game, { actor: fixture.advisor, action: bgAmbassadorIntrusionAction(true) });
  const card = viewGame(game, fixture.owner).responseControls?.cancelCards[0];
  assert.ok(card);
  game = applyBgAmbassadorArrivalStep(game, { actor: fixture.owner, action: { type: 'card', mode: 'cancel', card } });
  assert.equal(game.decision?.kind, 'advisor');
  assertMainQueue(fixture, game);
  assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).advisors?.[fixture.territory], undefined);
  assert.equal(bgAmbassadorArrivalPlayer(game, fixture.advisor).forces[fixture.location], 1);
  game = applyBgAmbassadorArrivalStep(game, { actor: fixture.advisor, action: bgAmbassadorAccompanimentAction(false) });
  assertMainOffer(fixture, game);
  assert.equal(game.discard.filter(c => c.id === card).length, 1);
  assertOriginalMovementResumes(fixture, finishBgAmbassadorArrival(game, false), false);
});
