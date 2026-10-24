import test from 'node:test';
import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import {
  actGuildAmbassadorNoField as act, advanceGuildAmbassadorNoField as advance,
  createGuildAmbassadorNoFieldFixture as fixture, guildAmbassadorNoFieldClean as clean,
  guildAmbassadorNoFieldInventory as inventory, guildAmbassadorNoFieldPlayer as player,
  passGuildAmbassadorNoFieldResponses as passResponses,
  type GuildAmbassadorNoFieldFixture,
} from './fixture-guild-ambassador-no-field';

function allowances(game: Game) {
  return { active: game.active, order: game.order, remaining: game.movementRemaining,
    players: game.players.map(p => ({ id: p.id, shipped: p.shipped, moved: p.moved })) };
}
function material(game: Game) {
  return game.players.map(p => ({ id: p.id, spice: p.spice, reserves: p.reserves, forces: p.forces,
    noField: p.noField, noFieldEvent: p.noFieldEvent, noFieldBlockedTurn: p.noFieldBlockedTurn }));
}
function nativeAction(f: GuildAmbassadorNoFieldFixture, value: 0 | 3 | 5, extra: Partial<Action> = {}): Action {
  const token = f.tokens.find(token => token.value === value)!;
  return { type: 'decision', event: f.event, amount: 1, noField: token.id,
    noFieldEvent: player(f.game, f.richese).noFieldEvent,
    territory: f.territory, sector: f.sector, ...extra };
}
function reject(game: Game, actor: string, action: Action, reason?: RegExp) {
  const before = structuredClone(game), submitted = structuredClone(action);
  if (reason) assert.throws(() => act(game, actor, action), reason);
  else assert.throws(() => act(game, actor, action));
  assert.deepEqual(game, before); assert.deepEqual(action, submitted);
}
function finishEntrant(f: GuildAmbassadorNoFieldFixture, game: Game) {
  game = advance(game, clean);
  assert.equal(game.pendingAmbassador, null);
  assert.equal(game.active, f.entrantHark);
  assert.equal(player(game, f.entrantHark).forces['habbanya_ridge_sietch:17'], 1);
  game = act(game, f.entrantHark, { type: 'move', from: 'habbanya_ridge_sietch:17', amount: 1,
    territory: f.desert, sector: f.desertSector });
  game = advance(game, clean);
  assert.equal(player(game, f.entrantHark).forces[`${f.desert}:${f.desertSector}`], 1);
  game = act(game, f.entrantHark, { type: 'endMovement' });
  game = advance(game, state => state.active === f.guild && clean(state));
  assert.deepEqual(inventory(game), f.originalInventory);
  return game;
}

void test('genuine Basic Guild marker source uses native deal, paid placements, accepted Ecaz alliance and paid entrant', () => {
  for (const beneficiary of ['own', 'allied'] as const) {
    const f = fixture({ beneficiary }), g = f.game;
    assert.deepEqual(f.staging, []);
    assert.equal(g.advanced, false); assert.deepEqual(g.expansions, ['ecaz', 'choam']);
    assert.ok(!g.homeworlds && !g.nexusCards && !g.leaderSkills && !g.techTokens &&
      !g.strongholdCards && !g.discoveryEnabled && !g.ecazTreachery);
    assert.equal(g.status, 'playing'); assert.equal(g.turn, 1); assert.equal(g.phase, 5);
    assert.ok(g.pendingAmbassador); assert.equal(g.pendingAmbassador.stage, 'ship');
    assert.equal(g.pendingAmbassador.effect, 'guild');
    assert.equal(g.pendingAmbassador.entrant, f.entrantHark);
    assert.equal(g.pendingAmbassador.beneficiary, f.beneficiaryID);
    assert.equal(g.decision?.player, f.beneficiaryID);
    assert.deepEqual(g.order, [f.ownerEcaz, f.richese, f.entrantHark, f.guild]);
    assert.equal(player(g, f.ownerEcaz).ally, f.richese); assert.equal(player(g, f.richese).ally, f.ownerEcaz);
    assert.equal(player(g, f.ownerEcaz).shipped, true); assert.equal(player(g, f.richese).shipped, true);
    assert.equal(player(g, f.entrantHark).shipped, true); assert.equal(player(g, f.guild).shipped, false);
    assert.equal(player(g, f.richese).forces['carthag:11'], 1);
    assert.equal(player(g, f.ownerEcaz).forces['polar_sink:0'], 1);
    assert.equal(player(g, f.entrantHark).forces['habbanya_ridge_sietch:17'], 1);
    assert.equal(g.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz')!.zone, 'supply');
    assert.equal(g.ecazAmbassadors!.tokens.find(token => token.effect === 'guild')!.zone, 'used');
    assert.ok(f.alliance.steps.some(step => step.actor === f.richese && step.action.accept === true));
    assert.ok(f.alliance.steps.some(step => step.actor === f.ownerEcaz && step.action.loan === false));
    assert.deepEqual(inventory(g), f.originalInventory);
  }
});

for (const value of [0, 3, 5] as const) {
  void test(`native Basic Richese Guild grant conceals original ${value} for free without spending its ordinary allowance`, () => {
    const f = fixture({ beneficiary: 'own', karama: true }), before = structuredClone(f.game);
    const token = f.tokens.find(token => token.value === value)!;
    let game = act(f.game, f.richese, nativeAction(f, value));
    assert.equal(game.response?.kind, 'richeseNoField');
    assert.deepEqual(material(game), material(before));
    game = passResponses(game);
    assert.deepEqual(player(game, f.richese).noField!.deployed, {
      tokenId: token.id, controller: f.richese, location: { territory: f.territory, sector: f.sector },
    });
    assert.equal(player(game, f.richese).noField!.lastShipped, token.id);
    assert.equal(player(game, f.richese).reserves, player(before, f.richese).reserves);
    assert.equal(player(game, f.richese).forces[`${f.territory}:${f.sector}`] ?? 0, 0);
    for (const p of game.players) assert.equal(p.spice, player(before, p.id).spice);
    assert.deepEqual(allowances(game), allowances(before));
    const publicMarker = viewGame(game, f.entrantHark).players.find(p => p.id === f.richese)!.noField!.deployed!;
    assert.equal(publicMarker.effectiveForces, 1);
    assert.deepEqual(inventory(game), f.originalInventory);
    finishEntrant(f, game);
  });
}

function requestAllied(f: GuildAmbassadorNoFieldFixture, game = f.game, desert = false) {
  return act(game, f.beneficiaryID, { type: 'decision', event: f.event, requestNoField: true,
    territory: desert ? f.desert : f.territory, sector: desert ? f.desertSector : f.sector });
}
function offerAllied(f: GuildAmbassadorNoFieldFixture, game: Game, value: 0 | 3 | 5,
  payer = f.richese) {
  return act(game, f.richese, { type: 'decision', event: f.event,
    offerNoField: f.tokens.find(token => token.value === value)!.id,
    noFieldEvent: player(game, f.richese).noFieldEvent, payer, elite: 0 });
}

void test('a five-marker materializes four available allied counters without inventing the missing fifth', () => {
  const f = fixture({ beneficiary: 'allied' });
  // Controlled prior reserve shortage after the genuine grant: move existing
  // Ecaz counters to its original setup location, without changing total custody.
  const source = structuredClone(f.game), recipient = player(source,f.beneficiaryID);
  recipient.forces['imperial_basin:9'] += recipient.reserves - 4;
  recipient.reserves = 4;
  const before = structuredClone(source);
  let game = requestAllied(f,source);
  game = offerAllied(f,game,5,f.richese);
  game = act(game,f.beneficiaryID,{type:'decision',event:f.event,acceptNoField:true});
  game = passResponses(game);
  assert.equal(player(game,f.beneficiaryID).reserves,0);
  assert.equal(player(game,f.beneficiaryID).forces[`${f.territory}:${f.sector}`],4);
  assert.equal(player(game,f.richese).noField!.lastShipped,f.tokens.find(token => token.value === 5)!.id);
  assert.deepEqual(allowances(game),allowances(before));
  for (const p of game.players) assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((sum,n) => sum+n,0),20);
  finishEntrant(f,game);
});

void test('native No-Field remains available when the physical four-force grant has no reserve counter', () => {
  const f = fixture({ beneficiary: 'own' });
  // Controlled prior deployment conserves all original counters; the new
  // concealed marker itself withdraws none and may later reveal zero.
  const source = structuredClone(f.game), richese = player(source,f.richese);
  richese.forces['carthag:11'] += richese.reserves;
  richese.reserves = 0;
  const view = viewGame(source,f.richese);
  assert.equal(view.ambassadorEntry?.shipment?.maximum,0);
  assert.ok(view.ambassadorEntry?.noField?.options.some(option => option.action.noField === f.tokens.find(token => token.value === 5)!.id));
  let game = act(source,f.richese,nativeAction(f,5));
  game = passResponses(game);
  assert.equal(player(game,f.richese).reserves,0);
  assert.equal(player(game,f.richese).forces['carthag:11'],20);
  assert.equal(player(game,f.richese).noField!.deployed!.tokenId,f.tokens.find(token => token.value === 5)!.id);
  finishEntrant(f,game);
});

void test('original ordinary starting hands automatically allow both Guild marker declarations without a pending Karama responder', () => {
  for (const beneficiary of ['own', 'allied'] as const) {
    const f = fixture({ beneficiary }), before = structuredClone(f.game);
    assert.ok(f.game.players.every(p => p.hand.every(card => card.effect !== 'karama')));
    let game = beneficiary === 'own' ? act(f.game, f.richese, nativeAction(f, 3)) : requestAllied(f);
    if (beneficiary === 'allied') {
      game = offerAllied(f, game, 3, f.beneficiaryID);
      game = act(game, f.beneficiaryID, { type: 'decision', event: f.event, acceptNoField: true });
      assert.equal(player(game, f.beneficiaryID).forces[`${f.territory}:${f.sector}`], 3);
      assert.equal(player(game, f.beneficiaryID).reserves, player(before, f.beneficiaryID).reserves - 3);
      assert.equal(player(game, f.richese).noField!.deployed, null);
    } else {
      assert.equal(player(game, f.richese).noField!.deployed!.tokenId, f.tokens.find(token => token.value === 3)!.id);
      assert.equal(player(game, f.richese).reserves, player(before, f.richese).reserves);
    }
    assert.equal(game.response, null);
    assert.deepEqual(allowances(game), allowances(before));
    finishEntrant(f, game);
  }
});

for (const desert of [false, true]) {
  for (const payee of ['supplier', 'recipient', ...(desert ? ['both'] : [])]) {
    void test(`allied Basic three-marker ${desert ? 'desert' : 'stronghold'} grant charges the printed fee to ${payee}`, () => {
      const f = fixture({ beneficiary: 'allied', karama: true }), before = structuredClone(f.game);
      const payer = payee === 'supplier' ? f.richese : payee === 'recipient' ? f.beneficiaryID : 'both';
      let game = requestAllied(f, f.game, desert);
      assert.equal(game.decision?.player, f.richese);
      assert.deepEqual(material(game), material(before));
      game = offerAllied(f, game, 3, payer);
      assert.equal(game.decision?.player, f.beneficiaryID);
      assert.deepEqual(material(game), material(before));
      game = act(game, f.beneficiaryID, { type: 'decision', event: f.event, acceptNoField: true });
      assert.equal(game.response?.kind, 'richeseNoField');
      assert.deepEqual(material(game), material(before));
      game = passResponses(game);
      const cost = desert ? 2 : 1, ownerPayment = payee === 'supplier' ? cost : payee === 'both' ? 1 : 0;
      const recipientPayment = cost - ownerPayment;
      const target = desert ? `${f.desert}:${f.desertSector}` : `${f.territory}:${f.sector}`;
      assert.equal(player(game, f.beneficiaryID).forces[target], 3);
      assert.equal(player(game, f.beneficiaryID).reserves, player(before, f.beneficiaryID).reserves - 3);
      assert.equal(player(game, f.richese).reserves, player(before, f.richese).reserves);
      assert.equal(player(game, f.richese).noField!.deployed, null);
      assert.equal(player(game, f.richese).noField!.lastShipped, f.tokens.find(token => token.value === 3)!.id);
      assert.equal(player(game, f.richese).spice, player(before, f.richese).spice - ownerPayment);
      assert.equal(player(game, f.beneficiaryID).spice, player(before, f.beneficiaryID).spice - recipientPayment);
      assert.equal(player(game, f.guild).spice, player(before, f.guild).spice + cost);
      assert.deepEqual(allowances(game), allowances(before));
      assert.deepEqual(inventory(game), f.originalInventory);
      finishEntrant(f, game);
    });
  }
}

void test('actual prior native three-marker must be explicitly revealed before a different Guild marker is declared', () => {
  const f = fixture({ beneficiary: 'own', priorMarker: true });
  const original = structuredClone(f.game), richese = player(original, f.richese);
  assert.deepEqual(richese.noField!.deployed, {
    tokenId: f.priorToken.id, controller: f.richese, location: { territory: 'carthag', sector: 11 },
  });
  reject(f.game, f.richese, nativeAction(f, 5), /reveal/i);
  let game = act(f.game, f.richese, { type: 'decision', event: f.event, revealNoField: true });
  assert.equal(game.pendingAmbassador?.stage, 'ship'); assert.equal(game.decision?.player, f.richese);
  assert.equal(player(game, f.richese).noField!.deployed, null);
  assert.equal(player(game, f.richese).forces['carthag:11'], 3);
  assert.equal(player(game, f.richese).reserves, richese.reserves - 3);
  assert.equal(player(game, f.richese).noField!.lastShipped, f.priorToken.id);
  assert.notEqual(player(game, f.richese).noFieldEvent, richese.noFieldEvent);
  assert.deepEqual(allowances(game), allowances(original));
  reject(game, f.richese, nativeAction(f, 5), /event|stale/i);
  reject(game, f.richese, nativeAction(f, 3, { noFieldEvent: player(game, f.richese).noFieldEvent }), /twice|same|row/i);
  const revealed = structuredClone(game);
  game = act(game, f.richese, nativeAction(f, 5, { noFieldEvent: player(game, f.richese).noFieldEvent }));
  game = passResponses(game);
  assert.equal(player(game, f.richese).noField!.deployed!.tokenId, f.tokens.find(token => token.value === 5)!.id);
  assert.equal(player(game, f.richese).reserves, player(revealed, f.richese).reserves);
  assert.equal(player(game, f.richese).spice, richese.spice);
  assert.deepEqual(allowances(game), allowances(original));
  finishEntrant(f, game);
});

void test('allied zero grant reveals the actual older supplier marker only after recipient consent and neutral prevention passes', () => {
  const f = fixture({ beneficiary: 'allied', priorMarker: true, karama: true }), before = structuredClone(f.game);
  let game = requestAllied(f);
  game = offerAllied(f, game, 0, f.beneficiaryID);
  assert.deepEqual(material(game), material(before));
  game = act(game, f.beneficiaryID, { type: 'decision', event: f.event, acceptNoField: true });
  assert.equal(game.response?.kind, 'richeseNoField');
  assert.deepEqual(material(game), material(before));
  game = passResponses(game);
  assert.equal(player(game, f.richese).forces['carthag:11'], 3);
  assert.equal(player(game, f.richese).reserves, player(before, f.richese).reserves - 3);
  assert.equal(player(game, f.richese).noField!.deployed, null);
  assert.equal(player(game, f.richese).noField!.lastShipped, f.tokens.find(token => token.value === 0)!.id);
  assert.equal(player(game, f.beneficiaryID).reserves, player(before, f.beneficiaryID).reserves);
  assert.equal(player(game, f.beneficiaryID).forces[`${f.territory}:${f.sector}`] ?? 0, 0);
  assert.equal(player(game, f.beneficiaryID).spice, player(before, f.beneficiaryID).spice - 1);
  assert.equal(player(game, f.guild).spice, player(before, f.guild).spice + 1);
  assert.deepEqual(allowances(game), allowances(before));
  finishEntrant(f, game);
});

for (const who of ['supplier', 'recipient'] as const) {
  void test(`allied Guild substitution ${who} refusal returns the same free physical grant without payment or token changes`, () => {
    const f = fixture({ beneficiary: 'allied' }), before = structuredClone(f.game);
    let game = requestAllied(f);
    if (who === 'recipient') game = offerAllied(f, game, 3);
    game = act(game, who === 'supplier' ? f.richese : f.beneficiaryID,
      { type: 'decision', event: f.event, declineNoField: true });
    assert.equal(game.decision?.player, f.beneficiaryID);
    assert.ok(game.pendingAmbassador); assert.equal(game.pendingAmbassador.event, f.event);
    assert.equal(game.pendingAmbassador.stage, 'ship');
    assert.deepEqual(material(game), material(before)); assert.deepEqual(allowances(game), allowances(before));
    game = act(game, f.beneficiaryID, { type: 'decision', event: f.event, amount: 4,
      territory: f.territory, sector: f.sector, elite: 0 });
    game = advance(game, clean);
    assert.equal(player(game, f.beneficiaryID).forces[`${f.territory}:${f.sector}`], 4);
    assert.equal(player(game, f.beneficiaryID).reserves, player(before, f.beneficiaryID).reserves - 4);
    for (const p of game.players) assert.equal(p.spice, player(before, p.id).spice);
    assert.deepEqual(player(game, f.richese).noField, player(before, f.richese).noField);
    assert.deepEqual(allowances(game), allowances(before)); finishEntrant(f, game);
  });
}

void test('allied five cannot enlarge the four-force grant and malformed native mixtures preserve the live opportunity', () => {
  const allied = fixture({ beneficiary: 'allied' });
  const requested = requestAllied(allied);
  assert.ok(player(requested, allied.beneficiaryID).reserves > 4);
  reject(requested, allied.richese, { type: 'decision', event: allied.event,
    offerNoField: allied.tokens.find(token => token.value === 5)!.id,
    noFieldEvent: player(requested, allied.richese).noFieldEvent, payer: allied.richese, elite: 0 }, /four|4/i);
  const own = fixture({ beneficiary: 'own' });
  for (const extra of [{ amount: 4 }, { elite: 1 }, { allyPayment: 1 }, { noFieldEvent: 'stale-selection' },
    { event: 'stale-parent' }, { alliedNoField: true }])
    reject(own.game, own.richese, nativeAction(own, 3, extra));
  reject(own.game, own.entrantHark, nativeAction(own, 3));
  let game = act(own.game, own.richese, nativeAction(own, 3));
  game = passResponses(game); finishEntrant(own, game);
});

for (const beneficiary of ['own', 'allied'] as const) {
  void test(`actual held Karama prevents the ${beneficiary} Guild marker only, preserving ordinary shipment state and physical fallback`, () => {
    const f = fixture({ beneficiary, karama: true }), before = structuredClone(f.game);
    assert.ok(f.karama); assert.ok(player(f.game, f.entrantHark).hand.some(card => card.id === f.karama));
    let game = beneficiary === 'own' ? act(f.game, f.richese, nativeAction(f, 3)) : requestAllied(f);
    if (beneficiary === 'allied') {
      game = offerAllied(f, game, 3, f.beneficiaryID);
      game = act(game, f.beneficiaryID, { type: 'decision', event: f.event, acceptNoField: true });
    }
    assert.equal(game.response?.kind, 'richeseNoField');
    assert.deepEqual(material(game), material(before));
    game = act(game, f.entrantHark, { type: 'card', mode: 'cancel', card: f.karama });
    game = advance(game, state => !state.response && !state.pendingTreacheryDiscard);
    assert.deepEqual(material(game), material(before)); assert.deepEqual(allowances(game), allowances(before));
    assert.ok(game.pendingAmbassador); assert.equal(game.pendingAmbassador.event, f.event);
    assert.equal(game.pendingAmbassador.stage, 'ship');
    assert.equal(game.decision?.player, f.beneficiaryID);
    assert.equal(game.discard.filter(card => card.id === f.karama).length, 1);
    assert.equal(player(game, f.richese).noFieldBlockedTurn, player(before, f.richese).noFieldBlockedTurn);
    assert.deepEqual(game.richeseAllyBlocked, before.richeseAllyBlocked);
    if (beneficiary === 'own') reject(game, f.richese, nativeAction(f, 3));
    else reject(game, f.beneficiaryID, { type: 'decision', event: f.event, requestNoField: true,
      territory: f.territory, sector: f.sector });
    game = act(game, f.beneficiaryID, { type: 'decision', event: f.event, amount: 1,
      territory: f.territory, sector: f.sector, elite: 0 });
    game = advance(game, clean);
    assert.equal(player(game, f.beneficiaryID).forces[`${f.territory}:${f.sector}`], 1);
    assert.equal(player(game, f.beneficiaryID).reserves, player(before, f.beneficiaryID).reserves - 1);
    assert.deepEqual(allowances(game), allowances(before)); finishEntrant(f, game);
  });
}
