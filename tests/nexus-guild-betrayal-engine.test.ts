import assert from 'node:assert/strict';
import test from 'node:test';
import {applyAction, initializeGuildBetrayalGameForAudit, normalizeAutomaticGame, viewGame,
  type Action, type Game} from '../game/engine';
import {validateNexusCards} from '../game/nexus-cards';
import {homeworldGameIntegrity} from '../game/homeworld-game';
import {signGuildBetrayalInvoice} from '../game/nexus-guild-betrayal';
import {createGuildBetrayalFixture, settleGuildBetrayalFixture,
  type GuildBetrayalFixture, type GuildBetrayalFixtureOptions} from './fixture-nexus-guild-betrayal';

function physicalShipment(game: Game) {
  return {custody: game.homeworlds?.custody,
    forces: game.players.map(p => ({id: p.id, forces: p.forces, reserves: p.reserves,
      tanks: p.tanks, elites: p.elites, advisors: p.advisors, shipped: p.shipped, moved: p.moved})),
    active: game.active, remaining: game.movementRemaining};
}
function rejects(game: Game, actor: string, action: Action) {
  const saved = structuredClone(game);
  assert.throws(() => applyAction(game, actor, action));
  assert.deepEqual(game, saved, 'Rejected actions cannot alter the saved funded declaration.');
}
function take(fixture: GuildBetrayalFixture): Game {
  return applyAction(JSON.parse(JSON.stringify(fixture.game)) as Game, fixture.holder,
    {type: 'guildBetrayalUse', event: fixture.event});
}
function proveFullPayment(fixture: GuildBetrayalFixture): void {
  const done = take(fixture);
  assert.deepEqual(physicalShipment(done), physicalShipment(fixture.original), 'The same native source/delivery suffix runs exactly once.');
  assert.equal(done.pendingGuildBetrayal, null);
  const invoice = fixture.game.pendingGuildBetrayal!.invoice;
  for (const p of done.players) {
    const prior = fixture.before.players.find(seat => seat.id === p.id)!;
    assert.equal(p.spice, prior.spice - (p.id === fixture.shipper ? invoice.ownPayment : 0) +
      (p.id === fixture.holder ? fixture.price : 0), `Full fee has exactly one receiver: ${p.id}`);
  }
  if (fixture.donor) assert.equal(done.aid[fixture.donor].amount,
    fixture.before.aid[fixture.donor].amount - invoice.allyPayment);
  validateNexusCards(done.nexusCards!.cards!, done.players);
  assert.equal(done.nexusCards!.cards!.hands[fixture.holder], null);
  assert.equal(done.nexusCards!.cards!.discard.at(-1), 'guild');
  assert.equal(done.guildBetrayal!.status, 'completed');
  const receipt = done.nexusGuildBetrayalHistory!.at(-1)!;
  assert.equal(receipt.invoice.price, fixture.price);
  assert.equal(receipt.recipient, fixture.holder);
  assert.equal(receipt.mode, 'betrayal');
  assert.equal(done.guildBetrayalSourceReceipts!.at(-1)!.receipt, receipt.sourceReceipt);
  if (done.homeworlds) homeworldGameIntegrity(done);
  rejects(done, fixture.holder, {type: 'guildBetrayalUse', event: fixture.event});
  rejects(done, fixture.shipper, fixture.declaration);
}

for (const advanced of [false, true]) {
  for (const source of ['reserve', 'guildTransport', 'homeworld', 'junction'] as const) {
    void test(`${advanced ? 'Advanced' : 'Basic'} ${source}: full original funded fee replaces native bank/Guild income and preserves native custody`, () => {
      proveFullPayment(createGuildBetrayalFixture({advanced, source}));
    });
  }
  for (const source of ['reserve', 'homeworld', 'junction'] as const) {
    void test(`${advanced ? 'Advanced' : 'Basic'} ${source}: own payment is funded upfront and then fully refunded`, () => {
      const fixture = createGuildBetrayalFixture({advanced, source, payer: 'holder'});
      proveFullPayment(fixture);
      const prior = fixture.before.players.find(p => p.id === fixture.holder)!.spice;
      assert.equal(take(fixture).players.find(p => p.id === fixture.holder)!.spice, prior);
    });
  }
  void test(`${advanced ? 'Advanced' : 'Basic'} all-pass preserves the actual default payment and keeps every Nexus card`, () => {
    const fixture = createGuildBetrayalFixture({advanced, source: 'reserve'});
    let done = fixture.game;
    const hands = structuredClone(done.nexusCards!.cards!.hands);
    for (const id of fixture.game.pendingGuildBetrayal!.required)
      done = applyAction(done, id, {type: 'guildBetrayalPass', event: fixture.event});
    done = settleGuildBetrayalFixture(done);
    assert.deepEqual(physicalShipment(done), physicalShipment(fixture.original));
    assert.deepEqual(done.players.map(p => p.spice), fixture.original.players.map(p => p.spice));
    assert.deepEqual(done.nexusCards!.cards!.hands, hands);
    assert.equal(done.nexusGuildBetrayalHistory!.at(-1)!.recipient, null);
    assert.equal(done.players.find(p => p.id === fixture.guild)!.spice,
      fixture.before.players.find(p => p.id === fixture.guild)!.spice + fixture.price);
  });
}

for (const options of [
  {source: 'reserve', allyPayment: 1},
  {source: 'homeworld', allyPayment: 1},
  {source: 'junction', allyPayment: 1},
  {source: 'guildTransport', allyPayment: 1},
  {source: 'reserve', homeworlds: true, occupiedJunction: true},
  {source: 'reserve', homeworlds: true, occupiedJunction: true, allyPayment: 1},
  {source: 'guildTransport', homeworlds: true},
] satisfies GuildBetrayalFixtureOptions[]) {
  void test(`Funded native ${options.source} preserves ally escrow/low-Junction full fee ${JSON.stringify(options)}`, () => {
    const fixture = createGuildBetrayalFixture(options);
    proveFullPayment(fixture);
    if ('occupiedJunction' in options) {
      const oldGuild = fixture.before.players.find(p => p.id === fixture.guild)!.spice;
      assert.equal(fixture.original.players.find(p => p.id === fixture.guild)!.spice - oldGuild,
        Math.ceil(fixture.price / 2));
      assert.equal(fixture.game.homeworlds!.custody!.visitors['homeworld:guild'][fixture.holder].normal, 1);
    }
  });
}

void test('Own refund cannot supply missing upfront spice; zero Fremen reinforcement has no payment gate or Nexus cost', () => {
  const own = createGuildBetrayalFixture({payer: 'holder'});
  const unfunded = structuredClone(own.before);
  unfunded.players.find(p => p.id === own.holder)!.spice = 0;
  rejects(unfunded, own.holder, own.declaration);
  assert.equal(unfunded.nexusCards!.cards!.hands[own.holder], 'guild');
  for (const advanced of [false, true]) {
    const free = createGuildBetrayalFixture({advanced, zero: true});
    assert.equal(free.price, 0);
    assert.equal(free.game.pendingGuildBetrayal, null);
    assert.equal(free.game.nexusCards!.cards!.hands[free.holder], 'guild');
    assert.equal(free.game.players.find(p => p.id === free.shipper)!.spice,
      free.before.players.find(p => p.id === free.shipper)!.spice);
    const destination = `${String(free.declaration.territory)}:${Number(free.declaration.sector)}`;
    assert.notEqual(Number(free.declaration.sector), free.before.storm);
    assert.equal(free.game.players.find(p => p.id === free.shipper)!.forces[destination],
      (free.before.players.find(p => p.id === free.shipper)!.forces[destination] ?? 0) + 2);
  }
});

void test('Advanced Guild special Karama stops before any positive invoice, refund or Nexus cost', () => {
  const fixture = createGuildBetrayalFixture({advanced: true});
  let game = structuredClone(fixture.before);
  const index = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0);
  const card = game.deck.splice(index, 1)[0];
  game.players.find(p => p.id === fixture.guild)!.hand.push(card);
  const originalSpice = game.players.map(p => p.spice);
  const originalForces = game.players.map(p => ({forces: p.forces, reserves: p.reserves}));
  game = applyAction(game, fixture.shipper, fixture.declaration);
  assert.equal(game.decision?.kind, 'guildShipment');
  game = applyAction(game, fixture.guild, {type: 'card', mode: 'special', card: card.id});
  game = settleGuildBetrayalFixture(game);
  assert.equal(game.pendingGuildBetrayal, null);
  assert.equal(game.nexusCards!.cards!.hands[fixture.holder], 'guild');
  assert.deepEqual(game.players.map(p => p.spice), originalSpice);
  assert.deepEqual(game.players.map(p => ({forces: p.forces, reserves: p.reserves})), originalForces);
});

void test('A purchased native Karama rate binds its actual bank-funded fee, not the ordinary tariff', () => {
  const fixture = createGuildBetrayalFixture({payer: 'other'});
  let game = structuredClone(fixture.before);
  const index = game.deck.findIndex(card => card.effect === 'karama');
  assert.ok(index >= 0);
  const card = game.deck.splice(index, 1)[0];
  game.players.find(p => p.id === fixture.shipper)!.hand.push(card);
  game = applyAction(game, fixture.shipper, {type: 'card', mode: 'shipment', card: card.id, target: fixture.shipper});
  game = settleGuildBetrayalFixture(game);
  const before = structuredClone(game);
  game = applyAction(game, fixture.shipper, {...fixture.declaration, amount: 3});
  game = applyAction(game, fixture.holder,
    {type: 'guildBetrayalUse', event: game.pendingGuildBetrayal!.invoice.event});
  assert.equal(game.players.find(p => p.id === fixture.shipper)!.spice,
    before.players.find(p => p.id === fixture.shipper)!.spice - 2);
  assert.equal(game.players.find(p => p.id === fixture.holder)!.spice,
    before.players.find(p => p.id === fixture.holder)!.spice + 2);
  assert.equal(game.players.find(p => p.id === fixture.guild)!.spice,
    before.players.find(p => p.id === fixture.guild)!.spice);
  assert.equal(game.karamaShipping, null);
});

void test('The fixed neutral projection exposes only event/shipper and private legal choices; pending payment preempts every underlying action', () => {
  const fixture = createGuildBetrayalFixture({payer: 'holder'});
  const otherFace = structuredClone(fixture.before);
  const cards = otherFace.nexusCards!.cards!;
  const index = cards.deck.indexOf('choam');
  assert.ok(index >= 0);
  cards.deck[index] = 'guild'; cards.hands[fixture.holder] = 'choam';
  const hidden = applyAction(otherFace, fixture.shipper, fixture.declaration);
  for (const p of fixture.game.players) {
    const left = viewGame(fixture.game, p.id).guildBetrayalReaction!;
    const right = viewGame(hidden, p.id).guildBetrayalReaction!;
    assert.deepEqual(Object.keys(left).sort(), ['blocked', 'canPass', 'canUse', 'event', 'hasPassed', 'shipper']);
    assert.deepEqual({event: left.event, shipper: left.shipper, canPass: left.canPass, hasPassed: left.hasPassed},
      {event: right.event, shipper: right.shipper, canPass: right.canPass, hasPassed: right.hasPassed});
    if (p.id !== fixture.holder) assert.deepEqual(left, right);
  }
  assert.equal(viewGame(fixture.game, fixture.holder).guildBetrayalReaction!.canUse, true);
  assert.equal(viewGame(hidden, fixture.holder).guildBetrayalReaction!.canUse, false);
  for (const action of [fixture.declaration, {type: 'endMovement'}, {type: 'ready'},
    {type: 'pledgeAid', amount: 0}, {type: 'nexusGuildCunning'}, {type: 'guildBetrayalUse', event: 'old'},
    {type: 'guildBetrayalUse', event: fixture.event, recipient: fixture.holder},
    {type: 'guildBetrayalUse', event: fixture.event, amount: fixture.price}])
    rejects(fixture.game, fixture.holder, action);
  const passed = applyAction(fixture.game, fixture.holder, {type: 'guildBetrayalPass', event: fixture.event});
  assert.equal(viewGame(passed, fixture.holder).guildBetrayalReaction!.hasPassed, true);
  rejects(passed, fixture.holder, {type: 'guildBetrayalUse', event: fixture.event});
  assert.deepEqual(normalizeAutomaticGame(passed), passed);
});

void test('Malformed, stale, orphaned and suspended native parents reject before apply, projection or automatic normalization', () => {
  const fixture = createGuildBetrayalFixture();
  const mutations: ((game: Game) => void)[] = [
    game => {delete game.pendingGuildBetrayal;},
    game => {delete game.guildBetrayal;},
    game => {game.guildBetrayal!.event = 'foreign';},
    game => {game.pendingGuildBetrayal!.invoice.price += 1;},
    game => {game.pendingGuildBetrayal!.invoice.ownPayment = 0;},
    game => {game.pendingGuildBetrayal!.passed.push(fixture.holder);},
    game => {game.pendingGuildBetrayal!.required = [fixture.holder];},
    game => {game.pendingGuildBetrayal!.signature = 'forged';},
    game => {game.players.find(p => p.id === fixture.shipper)!.spice = 0;},
    game => {game.players.find(p => p.id === fixture.shipper)!.reserves -= 1;},
    game => {game.active = fixture.guild;},
    game => {game.turn += 1;},
    game => {game.decision = {kind: 'guildShipment', player: fixture.guild,
      shipper: fixture.shipper, territory: 'arrakeen', sector: 10, amount: 2};},
  ];
  for (const mutate of mutations) {
    const game = structuredClone(fixture.game);
    mutate(game);
    const saved = structuredClone(game);
    assert.throws(() => viewGame(game, fixture.holder));
    assert.throws(() => normalizeAutomaticGame(game));
    rejects(game, fixture.holder, {type: 'guildBetrayalUse', event: fixture.event});
    assert.deepEqual(game, saved);
  }
  const completed = take(fixture);
  for (const mutate of [
    (game: Game) => {game.nexusGuildBetrayalHistory!.pop();},
    (game: Game) => {game.guildBetrayalSourceReceipts!.pop();},
    (game: Game) => {game.nexusGuildBetrayalHistory![0].signature = 'forged';},
    (game: Game) => {game.players.find(p => p.id === fixture.shipper)!.shipped = false;},
  ]) {
    const game = structuredClone(completed); mutate(game);
    assert.throws(() => viewGame(game, fixture.holder));
    assert.throws(() => normalizeAutomaticGame(game));
  }
  assert.throws(() => initializeGuildBetrayalGameForAudit(fixture.game), /fresh/);
});

void test('No publicly possible holder auto-settles the native fee without a fabricated Nexus payment window', () => {
  const fixture = createGuildBetrayalFixture();
  const before = structuredClone(fixture.before);
  const cards = before.nexusCards!.cards!;
  for (const p of before.players) {
    const face = cards.hands[p.id];
    if (face !== null) {cards.deck.push(face); cards.hands[p.id] = null;}
  }
  const done = settleGuildBetrayalFixture(applyAction(before, fixture.shipper, fixture.declaration));
  assert.equal(done.pendingGuildBetrayal, null);
  assert.equal(done.players.find(p => p.id === fixture.guild)!.spice,
    before.players.find(p => p.id === fixture.guild)!.spice + fixture.price);
  assert.equal(done.players.find(p => p.id === fixture.holder)!.spice,
    before.players.find(p => p.id === fixture.holder)!.spice);
  assert.deepEqual(physicalShipment(done), physicalShipment(fixture.original));
  validateNexusCards(done.nexusCards!.cards!, done.players);
});

void test('Unsupported Cunning producer is visibly blocked before its singleton is spent in the bounded payment profile', () => {
  const fixture = createGuildBetrayalFixture({payer: 'guild'});
  const before = structuredClone(fixture.before);
  const cards = before.nexusCards!.cards!;
  cards.hands[fixture.holder] = cards.hands[fixture.guild];
  cards.hands[fixture.guild] = 'guild';
  const offer = viewGame(before, fixture.guild).nexusGuildCunning!.offer!;
  assert.match(offer.blocked!, /second-shipment overlay/);
  rejects(before, fixture.guild, {type: 'endMovement', nexus: offer.event});
  assert.equal(before.nexusCards!.cards!.hands[fixture.guild], 'guild');
  assert.equal(before.nexusGuildCunningHistory, undefined);
});

function outsidePaymentProfile(game: Game): Game {
  const native = structuredClone(game);
  delete native.guildBetrayalPreview;
  delete native.guildBetrayal;
  delete native.pendingGuildBetrayal;
  delete native.nexusGuildBetrayalHistory;
  delete native.guildBetrayalSourceReceipts;
  return native;
}

for (const advanced of [false, true]) {
  void test(`${advanced ? 'Advanced' : 'Basic'} Richese overlay rejects before spend while ordinary and outside-profile shipments finish`, () => {
    const fixture = createGuildBetrayalFixture({advanced, payer: 'holder'});
    const before = structuredClone(fixture.before);
    const cards = before.nexusCards!.cards!;
    const index = cards.deck.indexOf('richese');
    assert.ok(index >= 0);
    cards.deck[index] = cards.hands[fixture.holder]!;
    cards.hands[fixture.holder] = 'richese';
    validateNexusCards(cards, before.players);
    const offer = viewGame(before, fixture.holder).nexusRichese!;
    assert.match(offer.blocked!, /Richese Secret Ally shipment overlay/);
    const action: Action = {...fixture.declaration, amount: 3, nexus: offer.event};
    const saved = structuredClone(before);
    assert.throws(() => applyAction(before, fixture.holder, action), /Richese Secret Ally shipment overlay/);
    assert.deepEqual(before, saved, 'No singleton spend, parent, history, fee or forces change on rejection.');
    assert.equal(before.nexusRicheseHistory, undefined);

    const ordinary = settleGuildBetrayalFixture(applyAction(before, fixture.holder,
      {...fixture.declaration, amount: 3}));
    const prior = before.players.find(p => p.id === fixture.holder)!;
    const shipped = ordinary.players.find(p => p.id === fixture.holder)!;
    assert.equal(shipped.reserves, prior.reserves - 3);
    assert.equal(shipped.spice, prior.spice - 3);
    assert.equal(shipped.shipped, true);
    assert.equal(ordinary.nexusCards!.cards!.hands[fixture.holder], 'richese');

    const native = outsidePaymentProfile(before);
    const nativeOffer = viewGame(native, fixture.holder).nexusRichese!;
    assert.equal(nativeOffer.blocked, null);
    const done = settleGuildBetrayalFixture(applyAction(native, fixture.holder,
      {...action, nexus: nativeOffer.event}));
    const recipient = done.players.find(p => p.id === fixture.holder)!;
    assert.equal(recipient.reserves, prior.reserves - 3);
    assert.equal(recipient.spice, prior.spice - 1);
    assert.equal(recipient.shipped, true);
    assert.equal(done.nexusCards!.cards!.hands[fixture.holder], null);
    assert.equal(done.nexusRicheseHistory!.at(-1)!.stage, 'shipped');
    assert.equal(done.nexusCards!.cards!.discard.filter(face => face === 'richese').length, 1);
  });
}

void test('Saved native cross permission is independently required even for a self-consistent paid frame or purchased Karama rate', () => {
  for (const purchasedRate of [false, true]) {
    const fixture = createGuildBetrayalFixture({source: 'guildTransport', payer: 'other'});
    let game = structuredClone(fixture.game);
    if (purchasedRate) {
      game = structuredClone(fixture.before);
      const index = game.deck.findIndex(card => card.effect === 'karama');
      assert.ok(index >= 0);
      const card = game.deck.splice(index, 1)[0];
      game.players.find(p => p.id === fixture.shipper)!.hand.push(card);
      game = settleGuildBetrayalFixture(applyAction(game, fixture.shipper,
        {type: 'card', mode: 'shipment', card: card.id, target: fixture.shipper}));
      game = applyAction(game, fixture.shipper, fixture.declaration);
    }
    // Re-sign only the changed saved alliance facts, not a copied native quote.
    // All counters, source, destination, tariff and full funding remain genuine.
    game.players.find(p => p.id === fixture.shipper)!.ally = null;
    game.players.find(p => p.id === fixture.guild)!.ally = null;
    const frame = game.pendingGuildBetrayal!;
    const proof = JSON.parse(frame.invoice.sourceSignature) as {players: {id: string; ally: string | null}[]};
    for (const seat of proof.players) seat.ally = game.players.find(p => p.id === seat.id)!.ally;
    frame.invoice.sourceSignature = JSON.stringify(proof);
    frame.invoice.originalReceiver = purchasedRate ? null : fixture.guild;
    frame.invoice.signature = signGuildBetrayalInvoice(frame.invoice);
    frame.signature = JSON.stringify([frame.invoice.signature, frame.invoice.sourceSignature, frame.required, frame.passed]);
    game.guildBetrayal!.sourceSignature = frame.invoice.sourceSignature;
    const saved = structuredClone(game);
    for (const operation of [
      () => viewGame(game, fixture.holder),
      () => normalizeAutomaticGame(game),
      () => applyAction(game, fixture.holder, {type: 'guildBetrayalUse', event: frame.invoice.event}),
    ]) {
      assert.throws(operation, /Native Guild transport requires the Guild or its reciprocal ally/);
      assert.deepEqual(game, saved, 'A saved paid rate cannot self-authorize native cross transport or move resources.');
    }
  }
});

void test('Native Guild and reciprocal Guild ally cross shipments remain legal outside the bounded profile', () => {
  for (const payer of ['guild', 'other'] as const) {
    const fixture = createGuildBetrayalFixture({source: 'guildTransport', payer});
    proveFullPayment(fixture);
    const before = outsidePaymentProfile(fixture.before);
    const done = settleGuildBetrayalFixture(applyAction(before, fixture.shipper, fixture.declaration));
    const prior = before.players.find(p => p.id === fixture.shipper)!;
    const shipper = done.players.find(p => p.id === fixture.shipper)!;
    assert.equal(shipper.shipped, true);
    assert.deepEqual(physicalShipment(done), physicalShipment(fixture.original));
    assert.equal(shipper.spice, prior.spice - fixture.price);
    assert.equal(done.nexusCards!.cards!.hands[fixture.holder], 'guild');
  }
});
