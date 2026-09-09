import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyAction,
  createGame,
  newPlayer,
  normalizeAutomaticGame,
  viewGame,
  type Game,
} from '../game/engine';
import { baseDeck, treacheryDeck, spiceDeck, type Card } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { cashInCards } from '../game/choam-karama';
import { createHomeworldCustody } from '../game/homeworld-custody';
import { createTerrorState } from '../game/moritani-terror';
import {
  homeworldContext,
  homeworldGameIntegrity,
} from '../game/homeworld-game';

const reload = (g: Game): Game => JSON.parse(JSON.stringify(g));
const player = (g: Game, id: string) => g.players.find((p) => p.id === id)!;
function hold(g: Game, id: string, match: (card: Card) => boolean) {
  const at = g.deck.findIndex(match);
  assert.ok(at >= 0);
  const card = g.deck.splice(at, 1)[0];
  player(g, id).hand.push(card);
  return card;
}
/** Explicit Ecaz module scenario; no complete Ecaz expansion setup claim.
 * Cards move from the real deck and all native/board/Tanks counters conserve. */
function fixture(reserves = 7, battle = false) {
  const g = createGame(
    'ECAZPOISON',
    newPlayer(
      'owner',
      battle ? 'Guild' : 'Emperor',
      battle ? 'guild' : 'emperor',
    ),
    false,
  );
  g.players.push(
    newPlayer('other', 'Atreides', 'atreides'),
    newPlayer('ec', 'Ecaz', 'ecaz'),
  );
  Object.assign(g, {
    status: 'playing',
    phase: battle ? 6 : 2,
    turn: 2,
    storm: 18,
    active: battle ? 'owner' : null,
    order: ['owner', 'other', 'ec'],
    deck: battle ? treacheryDeck(['ix']) : baseDeck(),
    spiceDeck: spiceDeck(),
    phaseOpening: null,
    response: null,
    decision: null,
    ready: [],
  });
  for (const p of g.players)
    Object.assign(p, {
      spice: 20,
      reserves: 20,
      tanks: 0,
      forces: {},
      hand: [],
      traitors: [],
      traitorChoices: [],
    });
  if (!battle)
    player(g, 'owner').elites = {
      reserves: 5,
      tanks: 0,
      forces: {},
      revived: 0,
    };
  player(g, 'ec').reserves = reserves;
  player(g, 'ec').forces = { 'polar_sink:0': 20 - reserves };
  if (battle) {
    player(g, 'owner').reserves = 14;
    player(g, 'owner').forces = { 'arrakeen:10': 6 };
    player(g, 'other').reserves = 18;
    player(g, 'other').forces = { 'arrakeen:10': 2 };
  }
  g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
  return g;
}
function inventory(g: Game, expected: readonly string[]) {
  homeworldGameIntegrity(g);
  for (const p of g.players)
    assert.equal(
      p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0),
      20,
    );
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap((p) => p.hand)]
    .map((card) => card.id)
    .sort();
  assert.deepEqual(ids, [...expected].sort());
  assert.equal(new Set(ids).size, ids.length);
}
const baseIds = baseDeck().map((card) => card.id);
function endBidding(g: Game) {
  for (const p of g.players) g = applyAction(g, p.id, { type: 'ready' });
  assert.equal(g.phase, 3);
  for (let n = 0; g.auction && n < 40; n++)
    g = applyAction(g, g.auction.active, { type: 'passBid' });
  assert.ok(g.biddingEnd);
  return g;
}
function dispose(g: Game, ids: string[]) {
  return applyAction(g, 'owner', {
    type: 'biddingEnd',
    event: g.biddingEnd!.event,
    mode: 'discard',
    cards: ids,
  });
}
function readyBattle(
  g: Game,
  weapon?: string,
  defense?: string,
  enemyWeapon?: string,
  enemyDefense?: string,
  expectedDecision = 'battleCards',
) {
  g = applyAction(g, 'owner', {
    type: 'chooseBattle',
    territory: 'arrakeen',
    target: 'other',
  });
  for (let n = 0; n < 30; n++) {
    if (g.response) {
      const id = g.players.find((p) => !g.response!.passed.includes(p.id))!.id;
      g = applyAction(g, id, { type: 'passResponse' });
    } else if (g.decision?.kind === 'fullPlanOffer')
      g = applyAction(g, g.decision.player, {
        type: 'decision',
        decline: true,
      });
    else if (g.battle?.preparation)
      g = applyAction(g, g.battle.preparation.owner, {
        type: 'declineBattlePower',
      });
    else break;
  }
  assert.equal(g.decision, null, JSON.stringify(g.decision));
  const leader = [...player(g, 'owner').leaders].sort(
    (a, b) => b.strength - a.strength,
  )[0].id;
  const enemy = [...player(g, 'other').leaders].sort(
    (a, b) => a.strength - b.strength,
  )[0].id;
  g = applyAction(g, 'owner', {
    type: 'battlePlan',
    dial: 3,
    leader,
    weapon,
    defense,
  });
  g = applyAction(g, 'other', {
    type: 'battlePlan',
    dial: 0,
    leader: enemy,
    ...(enemyWeapon ? { weapon: enemyWeapon } : {}),
    ...(enemyDefense ? { defense: enemyDefense } : {}),
  });
  if (g.decision?.kind === 'poisonTooth')
    g = applyAction(g, g.decision.player, { type: 'decision', activate: true });
  g = applyAction(g, 'owner', { type: 'traitorCall', call: false });
  g = applyAction(g, 'other', { type: 'traitorCall', call: false });
  assert.equal(g.decision?.kind, expectedDecision);
  assert.equal(g.decision?.player, 'owner');
  return g;
}

void test('actual Kaitain batch pays Ecaz once per physical poison discard while Emperor pays the full cost first', () => {
  let g = fixture();
  const first = hold(g, 'owner', (card) => card.kind === 'poison');
  const second = hold(g, 'owner', (card) => card.kind === 'poison');
  hold(g, 'owner', (card) => card.kind === 'shield');
  g = dispose(endBidding(g), [first.id, second.id]);
  assert.equal(player(g, 'owner').spice, 16);
  assert.equal(player(g, 'ec').spice, 26);
  assert.equal(
    viewGame(g, 'ec').ecazPoisonIncome.reduce(
      (sum, income) => sum + income.amount,
      0,
    ),
    6,
  );
  assert.equal(
    viewGame(g, 'ec').ecazPoisonIncome.reduce(
      (sum, income) => sum + income.count,
      0,
    ),
    2,
  );
  assert.deepEqual(viewGame(g, 'other').ecazPoisonIncome, []);
  assert.deepEqual(viewGame(g, 'owner').ecazPoisonIncome, []);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
  inventory(g, baseIds);
});

void test('current low Ecaz earns nothing; a real Ghola return reaching seven enables only later poison discards', () => {
  let g = fixture(6);
  player(g, 'ec').forces['polar_sink:0']--;
  player(g, 'ec').tanks = 1;
  const first = hold(g, 'owner', (card) => card.kind === 'poison');
  const second = hold(g, 'owner', (card) => card.kind === 'poison');
  hold(g, 'owner', (card) => card.kind === 'shield');
  const ghola = hold(g, 'ec', (card) => card.effect === 'ghola');
  g = dispose(endBidding(g), [first.id]);
  assert.equal(player(g, 'ec').spice, 20);
  assert.deepEqual(viewGame(g, 'ec').ecazPoisonIncome, []);
  g = applyAction(reload(g), 'ec', {
    type: 'card',
    card: ghola.id,
    amount: 1,
    elite: 0,
  });
  assert.equal(player(g, 'ec').reserves, 7);
  g = dispose(g, [second.id]);
  assert.equal(player(g, 'ec').spice, 23);
  assert.equal(viewGame(g, 'ec').ecazPoisonIncome.length, 1);
  inventory(g, baseIds);
});

void test('hidden Kaitain poison versus non-poison disposal leaves an uninvolved observer’s complete view equivalent', () => {
  let g = fixture();
  const poison = hold(g, 'owner', (card) => card.kind === 'poison');
  const shield = hold(g, 'owner', (card) => card.kind === 'shield');
  hold(g, 'owner', (card) => card.kind === 'worthless');
  g = endBidding(g);
  const poisonResult = dispose(reload(g), [poison.id]);
  const plainResult = dispose(reload(g), [shield.id]);
  assert.equal(player(poisonResult, 'ec').spice, 23);
  assert.equal(player(plainResult, 'ec').spice, 20);
  assert.deepEqual(
    viewGame(poisonResult, 'other'),
    viewGame(plainResult, 'other'),
  );
  assert.deepEqual(poisonResult.log, plainResult.log);
  assert.equal(
    viewGame(poisonResult, 'other').players.find((p) => p.id === 'ec')!.spice,
    undefined,
  );
  inventory(poisonResult, baseIds);
  inventory(plainResult, baseIds);
});

void test('an unused Chemistry discarded from a hand does not earn poison income', () => {
  let g = fixture();
  const chemistry = treacheryDeck(['ix']).find(
    (card) => card.kind === 'chemistry',
  )!;
  g.deck.push(chemistry);
  hold(g, 'owner', (card) => card.id === chemistry.id);
  hold(g, 'owner', (card) => card.kind === 'shield');
  g = dispose(endBidding(g), [chemistry.id]);
  assert.equal(player(g, 'ec').spice, 20);
  assert.deepEqual(viewGame(g, 'ec').ecazPoisonIncome, []);
  inventory(g, [...baseIds, chemistry.id]);
});

void test('Chemistry pays only when discarded after its actual winning weapon role, including refreshed delayed cleanup', () => {
  for (const slot of ['weapon', 'defense'] as const) {
    let g = fixture(7, true);
    const chemistry = hold(g, 'owner', (card) => card.kind === 'chemistry');
    const complement = hold(
      g,
      'owner',
      (card) => card.kind === (slot === 'weapon' ? 'shield' : 'projectile'),
    );
    g = readyBattle(
      g,
      slot === 'weapon' ? chemistry.id : complement.id,
      slot === 'defense' ? chemistry.id : complement.id,
    );
    assert.equal(
      player(g, 'ec').spice,
      20,
      'Keeping a revealed winning card does not discard it.',
    );
    assert.equal(
      g.lastBattleContext!.cardRoles!.owner[chemistry.id].battleSlot,
      slot,
    );
    const saved = reload(g);
    g = applyAction(saved, 'owner', {
      type: 'decision',
      discard: [chemistry.id],
    });
    assert.equal(player(g, 'ec').spice, slot === 'weapon' ? 23 : 20);
    assert.equal(
      g.discard.filter((card) => card.id === chemistry.id).length,
      1,
    );
    assert.ok(
      player(g, 'owner').hand.some((card) => card.id === complement.id),
    );
    assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
    inventory(
      g,
      treacheryDeck(['ix']).map((card) => card.id),
    );
  }
});

void test('Mirror remains gated at actual plan selection and cannot award income without a committed battle role', () => {
  const g = fixture(7, true);
  const mirror = richeseCards().find((card) => card.effect === 'mirrorWeapon')!;
  g.deck.push(mirror);
  hold(g, 'owner', (card) => card.id === mirror.id);
  const defense = hold(g, 'owner', (card) => card.kind === 'snooper');
  const poison = hold(g, 'other', (card) => card.kind === 'poison');
  const before = reload(g);
  assert.throws(
    () => readyBattle(g, mirror.id, defense.id, poison.id),
    /Choose a weapon/,
  );
  assert.deepEqual(g, before);
  assert.equal(player(g, 'ec').spice, 20);
  assert.deepEqual(viewGame(g, 'ec').ecazPoisonIncome, []);
  inventory(g, [...treacheryDeck(['ix']).map((card) => card.id), mirror.id]);
});

void test('mandatory losing Chemistry disposal uses the original battle slot before the hand is cleared', () => {
  for (const slot of ['weapon', 'defense'] as const) {
    let g = fixture(7, true);
    const weapon = hold(g, 'owner', (card) => card.kind === 'projectile');
    const shield = hold(g, 'owner', (card) => card.kind === 'shield');
    const chemistry = hold(g, 'other', (card) => card.kind === 'chemistry');
    const complement = hold(
      g,
      'other',
      (card) => card.kind === (slot === 'weapon' ? 'snooper' : 'projectile'),
    );
    g = readyBattle(
      g,
      weapon.id,
      shield.id,
      slot === 'weapon' ? chemistry.id : complement.id,
      slot === 'defense' ? chemistry.id : complement.id,
    );
    assert.equal(player(g, 'ec').spice, slot === 'weapon' ? 23 : 20);
    assert.equal(
      g.discard.filter((card) => card.id === chemistry.id).length,
      1,
    );
    assert.equal(player(g, 'other').hand.length, 0);
    g = applyAction(reload(g), 'owner', { type: 'decision', discard: [] });
    assert.equal(player(g, 'ec').spice, slot === 'weapon' ? 23 : 20);
    inventory(
      g,
      treacheryDeck(['ix']).map((card) => card.id),
    );
  }
});

void test('saved delayed Chemistry cleanup rejects a corrupted defense-to-weapon role before minting Ecaz income', () => {
  let g = fixture(7, true);
  const chemistry = hold(g, 'owner', (card) => card.kind === 'chemistry');
  const weapon = hold(g, 'owner', (card) => card.kind === 'projectile');
  g = readyBattle(g, weapon.id, chemistry.id);
  g.lastBattleContext!.cardRoles!.owner[chemistry.id].battleSlot = 'weapon';
  const before = reload(g);
  assert.throws(() => viewGame(g, 'ec'));
  assert.throws(() =>
    applyAction(g, 'owner', { type: 'decision', discard: [chemistry.id] }),
  );
  assert.deepEqual(g, before);
});

void test('native Ecaz earns losing poison income at seven before winner losses lower population, then earns none for its own later discard', () => {
  let g = fixture(7, true);
  const ecaz = player(g, 'ec');
  const visitor = player(g, 'owner');
  visitor.reserves = 18;
  visitor.forces = {};
  g.homeworlds!.custody!.visitors['homeworld:ecaz'] = {
    owner: { normal: 2, elite: 0 },
  };
  g.active = 'ec';
  g.order = ['ec', 'owner', 'other'];
  const nativePoison = hold(g, 'ec', (card) => card.kind === 'poison');
  const nativeDefense = hold(g, 'ec', (card) => card.kind === 'snooper');
  const invadingPoison = hold(g, 'owner', (card) => card.kind === 'poison');
  const invadingDefense = hold(g, 'owner', (card) => card.kind === 'snooper');
  const nativeLeader = [...ecaz.leaders].sort(
    (a, b) => b.strength - a.strength,
  )[0].id;
  const invadingLeader = [...visitor.leaders].sort(
    (a, b) => a.strength - b.strength,
  )[0].id;
  g = applyAction(g, 'ec', {
    type: 'chooseBattle',
    territory: 'homeworld:ecaz',
    target: 'owner',
  });
  for (let n = 0; g.battle?.preparation && n < 20; n++)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  assert.equal(g.decision, null, JSON.stringify(g.decision));
  g = applyAction(g, 'ec', {
    type: 'battlePlan',
    dial: 1,
    leader: nativeLeader,
    weapon: nativePoison.id,
    defense: nativeDefense.id,
  });
  g = applyAction(g, 'owner', {
    type: 'battlePlan',
    dial: 0,
    leader: invadingLeader,
    weapon: invadingPoison.id,
    defense: invadingDefense.id,
  });
  g = applyAction(g, 'ec', { type: 'traitorCall', call: false });
  // Only the native faction may call a traitor in a Homeworld battle.
  assert.equal(g.decision?.kind, 'battleCards');
  assert.equal(player(g, 'ec').reserves, 6);
  assert.equal(player(g, 'ec').tanks, 1);
  assert.equal(player(g, 'ec').spice, 23);
  assert.equal(
    g.discard.filter((card) => card.id === invadingPoison.id).length,
    1,
  );
  assert.equal(g.decision?.kind, 'battleCards');
  assert.equal(g.decision?.player, 'ec');
  assert.ok(player(g, 'ec').hand.some((card) => card.id === nativePoison.id));
  assert.equal(
    viewGame(g, 'ec').ecazPoisonIncome.reduce(
      (sum, income) => sum + income.amount,
      0,
    ),
    3,
  );
  g = applyAction(reload(g), 'ec', {
    type: 'decision',
    discard: [nativePoison.id],
  });
  assert.equal(player(g, 'ec').spice, 23);
  assert.equal(
    g.discard.filter((card) => card.id === nativePoison.id).length,
    1,
  );
  assert.equal(
    viewGame(g, 'ec').ecazPoisonIncome.reduce(
      (sum, income) => sum + income.count,
      0,
    ),
    1,
  );
  inventory(
    g,
    treacheryDeck(['ix']).map((card) => card.id),
  );
});

void test('Moritani delayed Chemistry cleanup preserves its actual weapon or defense role and pays only if discarded', () => {
  for (const slot of ['weapon', 'defense'] as const)
    for (const keepChemistry of [false, true]) {
      let g = fixture(7, true);
      g.advanced = true;
      const moritani = newPlayer('mo', 'Moritani', 'moritani');
      moritani.spice = 20;
      g.players.push(moritani);
      g.moritaniTerror = createTerrorState(() => 0);
      g.order.push('mo');
      player(g, 'other').ally = 'mo';
      moritani.ally = 'other';
      g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
      const weapon = hold(g, 'owner', (card) => card.kind === 'projectile');
      const defense = hold(g, 'owner', (card) => card.kind === 'shield');
      const chemistry = hold(g, 'other', (card) => card.kind === 'chemistry');
      const complement = hold(
        g,
        'other',
        (card) => card.kind === (slot === 'weapon' ? 'snooper' : 'projectile'),
      );
      g = readyBattle(
        g,
        weapon.id,
        defense.id,
        slot === 'weapon' ? chemistry.id : complement.id,
        slot === 'defense' ? chemistry.id : complement.id,
      );
      assert.equal(player(g, 'ec').spice, 20);
      assert.ok(
        player(g, 'other').hand.some((card) => card.id === chemistry.id),
      );
      g = applyAction(g, 'owner', { type: 'decision', discard: [] });
      assert.equal(g.decision?.kind, 'moritaniRetention');
      assert.equal(g.decision?.player, 'other');
      assert.equal(
        g.lastBattleContext!.cardRoles!.other[chemistry.id].battleSlot,
        slot,
      );
      g = applyAction(reload(g), 'other', {
        type: 'decision',
        keep: keepChemistry ? chemistry.id : null,
      });
      assert.equal(
        player(g, 'ec').spice,
        slot === 'weapon' && !keepChemistry ? 23 : 20,
      );
      assert.equal(
        g.discard.filter((card) => card.id === chemistry.id).length,
        keepChemistry ? 0 : 1,
      );
      assert.equal(
        player(g, 'other').hand.some((card) => card.id === chemistry.id),
        keepChemistry,
      );
      assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
      inventory(
        g,
        treacheryDeck(['ix']).map((card) => card.id),
      );
    }
});

void test('winning used Poison Tooth is discarded after native Ecaz losses lower seven to six, while losing poison pays before those losses', () => {
  let g = fixture(7, true);
  const ecaz = player(g, 'ec');
  const visitor = player(g, 'owner');
  visitor.reserves = 18;
  visitor.forces = {};
  g.homeworlds!.custody!.visitors['homeworld:ecaz'] = {
    owner: { normal: 2, elite: 0 },
  };
  g.active = 'ec';
  g.order = ['ec', 'owner', 'other'];
  const tooth = hold(g, 'ec', (card) => card.kind === 'poisonTooth');
  const nativeDefense = hold(g, 'ec', (card) => card.kind === 'snooper');
  const invadingPoison = hold(g, 'owner', (card) => card.kind === 'poison');
  const invadingDefense = hold(g, 'owner', (card) => card.kind === 'snooper');
  const nativeLeader = [...ecaz.leaders].sort(
    (a, b) => b.strength - a.strength,
  )[0];
  const invadingLeader = [...visitor.leaders].sort(
    (a, b) => a.strength - b.strength,
  )[0];
  g = applyAction(g, 'ec', {
    type: 'chooseBattle',
    territory: 'homeworld:ecaz',
    target: 'owner',
  });
  for (let n = 0; g.battle?.preparation && n < 20; n++)
    g = applyAction(g, g.battle.preparation.owner, {
      type: 'declineBattlePower',
    });
  g = applyAction(g, 'ec', {
    type: 'battlePlan',
    dial: 1,
    leader: nativeLeader.id,
    weapon: tooth.id,
    defense: nativeDefense.id,
  });
  g = applyAction(g, 'owner', {
    type: 'battlePlan',
    dial: 0,
    leader: invadingLeader.id,
    weapon: invadingPoison.id,
    defense: invadingDefense.id,
  });
  assert.equal(g.decision?.kind, 'poisonTooth');
  assert.equal(g.decision?.player, 'ec');
  assert.equal(player(g, 'ec').reserves, 7);
  assert.equal(player(g, 'ec').spice, 20);
  g = applyAction(reload(g), 'ec', { type: 'decision', activate: true });
  g = applyAction(reload(g), 'ec', { type: 'traitorCall', call: false });
  assert.equal(g.lastBattleContext!.winner, 'ec');
  assert.equal(player(g, 'ec').reserves, 6);
  assert.equal(player(g, 'ec').tanks, 1);
  assert.equal(g.discard.filter((card) => card.id === tooth.id).length, 1);
  assert.equal(
    g.discard.filter((card) => card.id === invadingPoison.id).length,
    1,
  );
  const income = viewGame(g, 'ec').ecazPoisonIncome;
  assert.equal(
    income.reduce((sum, entry) => sum + entry.amount, 0),
    3,
  );
  assert.equal(
    income.reduce((sum, entry) => sum + entry.count, 0),
    1,
  );
  assert.equal(g.decision?.kind, 'battleCards');
  assert.equal(g.decision?.player, 'ec');
  const afterBattleSpice = player(g, 'ec').spice;
  g = applyAction(reload(g), 'ec', { type: 'decision', discard: [] });
  assert.equal(player(g, 'ec').spice, afterBattleSpice);
  assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
  inventory(
    g,
    treacheryDeck(['ix']).map((card) => card.id),
  );
});

void test('used winning Poison Tooth stays reserved through real Ixian substitution and is discarded exactly once afterward', () => {
  for (const substitute of [false, true]) {
    let g = fixture(7, true);
    g.advanced = true;
    const ix = newPlayer('owner', 'Ixians', 'ixians');
    Object.assign(ix, {
      spice: 20,
      reserves: 12,
      forces: { 'arrakeen:10': 8 },
      elites: {
        reserves: 5,
        tanks: 0,
        forces: { 'arrakeen:10': 2 },
        revived: 0,
      },
    });
    g.players[0] = ix;
    g.homeworlds = { custody: createHomeworldCustody(homeworldContext(g)) };
    const tooth = hold(g, 'owner', (card) => card.kind === 'poisonTooth');
    const shield = hold(g, 'owner', (card) => card.kind === 'shield');
    const distrans = richeseCards().find((card) => card.effect === 'distrans')!;
    g.deck.push(distrans);
    hold(g, 'owner', (card) => card.id === distrans.id);
    g = readyBattle(
      g,
      tooth.id,
      shield.id,
      undefined,
      undefined,
      'battleLosses',
    );
    assert.equal(player(g, 'ec').spice, 20);
    if (g.decision?.kind !== 'battleLosses')
      throw new Error('Missing typed Ixian casualty choice');
    const choice = g.decision.options.findIndex((loss) => loss.elite === 1);
    assert.ok(choice >= 0);
    assert.ok(player(g, 'owner').hand.some((card) => card.id === tooth.id));
    assert.equal(g.discard.filter((card) => card.id === tooth.id).length, 0);
    g = applyAction(reload(g), 'owner', { type: 'decision', choice });
    assert.equal(g.decision?.kind, 'ixSubstitution');
    assert.deepEqual(g.pendingWinnerDiscards!.cards, [tooth.id]);
    for (const corrupt of [
      (saved: Game) => {
        saved.pendingWinnerDiscards = null;
      },
      (saved: Game) => {
        delete saved.pendingWinnerDiscards;
      },
      (saved: Game) => {
        delete saved.lastBattleContext!.winnerDiscards;
      },
    ]) {
      const broken = reload(g);
      corrupt(broken);
      const before = reload(broken);
      assert.throws(() => viewGame(broken, 'owner'), /winner|winning|discard/i);
      assert.throws(
        () => normalizeAutomaticGame(broken),
        /winner|winning|discard/i,
      );
      assert.throws(
        () => applyAction(broken, 'owner', { type: 'decision', decline: true }),
        /winner|winning|discard/i,
      );
      assert.deepEqual(broken, before);
    }
    assert.ok(player(g, 'owner').hand.some((card) => card.id === tooth.id));
    assert.equal(player(g, 'ec').spice, 20);
    assert.deepEqual(g.pendingWinnerDiscards!.optional, [shield.id]);
    for (const reserved of [tooth.id, shield.id]) {
      assert.ok(
        !cashInCards(g, player(g, 'owner')).some(
          (card) => card.id === reserved,
        ),
        'Both mandatory and optional winner cards remain reserved through casualties.',
      );
      const before = reload(g);
      assert.throws(
        () =>
          applyAction(g, 'owner', {
            type: 'card',
            card: distrans.id,
            target: 'other',
            give: reserved,
          }),
        /committed|discard|reserved/i,
      );
      assert.deepEqual(g, before);
    }
    g = substitute
      ? applyAction(reload(g), 'owner', {
          type: 'decision',
          sources: { 'arrakeen:10': 1 },
          recover: { 'arrakeen:10': 1 },
        })
      : applyAction(reload(g), 'owner', { type: 'decision', decline: true });
    assert.equal(g.pendingWinnerDiscards, null);
    assert.equal(g.pendingIxSubstitution, null);
    assert.equal(g.discard.filter((card) => card.id === tooth.id).length, 1);
    assert.equal(player(g, 'ec').spice, 23);
    assert.equal(g.decision?.kind, 'battleCards');
    assert.ok(!player(g, 'owner').hand.some((card) => card.id === tooth.id));
    assert.equal(player(g, 'owner').elites!.tanks, substitute ? 0 : 1);
    assert.deepEqual(normalizeAutomaticGame(reload(g)), g);
    g = applyAction(g, 'owner', { type: 'decision', discard: [] });
    assert.equal(player(g, 'ec').spice, 23);
    inventory(g, [
      ...treacheryDeck(['ix']).map((card) => card.id),
      distrans.id,
    ]);
  }
});
