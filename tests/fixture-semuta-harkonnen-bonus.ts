import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { AMBASSADOR_EFFECTS } from '../game/ecaz-ambassadors';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaRicheseCacheKarama, nextSemutaRicheseCacheKarama,
  semutaRicheseCacheKaramaClean, semutaRicheseCacheKaramaInventory, semutaRicheseCacheKaramaPlayer,
} from './fixture-semuta-richese-cache-karama';
import { passSemutaFremenGuildMovement, claimSemutaFremenGuildMovement } from './fixture-semuta-fremen-guild-movement';

export type SemutaHarkonnenBonusKind = 'normal' | 'blackMarket' | 'ambassador';
export type SemutaHarkonnenBonusStep = { actor: string; action: Action };
export const actSemutaHarkonnenBonus = actSemutaRicheseCacheKarama;
export const passSemutaHarkonnenBonus = passSemutaFremenGuildMovement;
export const claimSemutaHarkonnenBonus = claimSemutaFremenGuildMovement;
export const semutaHarkonnenBonusPlayer = semutaRicheseCacheKaramaPlayer;
export const semutaHarkonnenBonusInventory = semutaRicheseCacheKaramaInventory;
export const semutaHarkonnenBonusClean = semutaRicheseCacheKaramaClean;

/** Bonus/entry choices stay explicit; normal setup and no-spending native
 * controls retain their existing owners and priorities. */
export function nextSemutaHarkonnenBonus(game: Game): SemutaHarkonnenBonusStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.response?.kind === 'harkonnenBonus') return null;
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'ecazAmbassador') return null;
  const step = nextSemutaRicheseCacheKarama(game);
  if (step?.action.type === 'stormDial' && game.turn === 1)
    return { actor: step.actor, action: { ...step.action, amount: 0 } };
  return step;
}
export function advanceSemutaHarkonnenBonus(game: Game, until: (state: Game) => boolean,
  actions: SemutaHarkonnenBonusStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaHarkonnenBonus(game); assert.ok(step, 'Choose the actual paid bonus, Ambassador or fresh-cost control');
    game = actSemutaHarkonnenBonus(game, step.actor, step.action, actions);
  }
  throw Error('The genuine Harkonnen bonus source did not reach its finite boundary');
}
/** Allow the original bonus and its one native suffix, never buy another card. */
export function allowSemutaHarkonnenBonus(game: Game, actions: SemutaHarkonnenBonusStep[] = []): Game {
  assert.equal(game.response?.kind, 'harkonnenBonus');
  for (let count = 0; count < game.players.length && game.response?.kind === 'harkonnenBonus'; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaHarkonnenBonus(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, 'harkonnenBonus'); return game;
}
/** The native bonus callback already retires its sale/entry. Preserve the next
 * normal lot, compulsory Richese declaration or entrant's unfinished turn. */
export function finishSemutaHarkonnenBonus(game: Game, kind: SemutaHarkonnenBonusKind,
  _actions: SemutaHarkonnenBonusStep[] = []): Game {
  void _actions; // This boundary deliberately submits no additional action.
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.notEqual(game.response?.kind, 'harkonnenBonus');
  assert.equal(game.currentAuctionSale ?? null, null);
  if (kind === 'normal') {
    assert.equal(game.phase, 3); assert.ok(game.auction); assert.equal(game.auction.index, 1);
  } else if (kind === 'blackMarket') {
    assert.equal(game.phase, 3); assert.equal(game.richeseAuction ?? null, null);
    assert.equal(game.decision?.kind, 'richeseDeclaration');
  } else {
    assert.equal(game.phase, 5); assert.equal(game.pendingAmbassador ?? null, null);
    assert.equal(game.pendingArrivalReaction?.length ?? 0, 0);
    assert.equal(game.active, 'emperor');
  }
  return game;
}

/** Select only the nine native Fisher–Yates packet draws at original force
 * initialization. The Richese marker is actually dealt, never installed. */
function withOriginalRichesePacket<T>(run: () => T): T {
  const pool = AMBASSADOR_EFFECTS.filter(effect => effect !== 'ecaz');
  const desired = ['richese', ...pool.filter(effect => effect !== 'richese')], current: string[] = [...pool];
  const rolls: number[] = [];
  for (let index = current.length - 1; index > 0; index--) {
    const selected = current.indexOf(desired[index]); assert.ok(selected >= 0 && selected <= index);
    rolls.push(Math.floor((selected + 0.5) * 0x100000000 / (index + 1)));
    [current[index], current[selected]] = [current[selected], current[index]];
  }
  assert.deepEqual(current, desired);
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Real starting Harkonnen two-card deal and paid acquisition. Basic Ambassador
 * uses actual Ecaz alliance consent before an independent entrant triggers a
 * Richese purchase for allied Harkonnen; Advanced E3 admission stays closed. */
export function createSemutaHarkonnenBonusFixture(options: {
  kind: SemutaHarkonnenBonusKind; advanced?: boolean;
}) {
  const kind = options.kind, advanced = options.advanced ?? kind === 'blackMarket';
  assert.ok(kind !== 'blackMarket' || advanced, 'The native Black Market is Advanced');
  assert.ok(kind !== 'ambassador' || !advanced, 'Advanced Ecaz Semuta starts remain outside the original preview gate');
  const richese = 'richese', holder = 'choam', owner = 'harkonnen', spender = 'emperor', ecaz = 'ecaz';
  let game = createGame('SEMUTAHARKONNENBONUS', newPlayer(richese, 'Richese', 'richese'), advanced,
    kind === 'ambassador' ? ['choam', 'ecaz'] : ['choam']);
  const roster = kind === 'ambassador' ? [holder, ecaz, owner, spender] as const : [holder, owner, spender] as const;
  for (const faction of roster) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaHarkonnenBonusStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaHarkonnenBonus(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaHarkonnenBonus(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'original-undealt-semuta-preview' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaHarkonnenBonusInventory(game); assert.equal(originalInventory.length, 45);
  assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const projectile = game.deck.find(card => card.kind === 'projectile' && !card.effect); assert.ok(projectile);
  const ordinary = [projectile, ...game.deck.filter(card => card.id !== projectile.id && !card.effect &&
    ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind))].slice(0, game.players.length);
  assert.equal(ordinary.length, game.players.length);
  const deal = [...ordinary.map(card => card.id), printed.id], cost = printed.id;
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card, from, position };
  });
  const beforeStartingDeal = structuredClone(game);
  let packetCreation: ReturnType<typeof transition> | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const step = nextSemutaHarkonnenBonus(game); assert.ok(step);
    const lastTraitor = kind === 'ambassador' && game.setupStage === 'traitors' && step.action.type === 'traitor' &&
      game.players.filter(player => player.traitorChoices.length > 0).length === 1;
    if (lastTraitor) packetCreation = transition(() => {
      game = withOriginalRichesePacket(() => applyAction(game, step.actor, step.action));
      actions.push(structuredClone(step));
    });
    else act(step.actor, step.action);
  }
  assert.equal(game.status, 'playing'); const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal);
  assert.equal(semutaHarkonnenBonusPlayer(game, owner).hand.length, 2);
  assert.ok(semutaHarkonnenBonusPlayer(game, spender).hand.some(card => card.id === cost));
  if (kind === 'ambassador') {
    assert.ok(packetCreation);
    assert.equal(game.ecazAmbassadors?.tokens.find(token => token.effect === 'richese')?.zone, 'supply');
  }
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced && kind === 'blackMarket' ? 4 : advanced ? 2 : 1); position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      ['hagga_basin', 'rock_outcroppings', 'broken_land', 'oh_gap'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaHarkonnenBonusStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaHarkonnenBonusPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaHarkonnenBonus(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaHarkonnenBonusPlayer(beforeBid, holder).spice - semutaHarkonnenBonusPlayer(game, holder).spice, 1);
  assert.equal(semutaHarkonnenBonusPlayer(game, richese).spice - semutaHarkonnenBonusPlayer(beforeBid, richese).spice, 1);
  let blackMarket: ReturnType<typeof transition> | null = null;
  let placements: ReturnType<typeof transition> | null = null;
  let alliance: ReturnType<typeof transition> | null = null;
  let arrival: ReturnType<typeof transition> | null = null;
  let nativeAction: Action, purchase: ReturnType<typeof transition>, purchased: string;
  if (kind === 'ambassador') {
    reach(state => state.phase === 4 && !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
    placements = transition(() => {
      for (const [effect, territory] of [['ecaz', 'sietch_tabr'], ['richese', 'habbanya_ridge_sietch']] as const) {
        const token = game.ecazAmbassadors!.tokens.find(token => token.effect === effect && token.zone === 'supply'); assert.ok(token);
        act(ecaz, { type: 'decision', token: token.id, territory });
        assert.equal(game.response?.kind, 'ecazPlacement');
        const quotedCost = game.pendingEcazPlacement?.cost; assert.ok(quotedCost !== undefined);
        const balance = semutaHarkonnenBonusPlayer(game, ecaz).spice;
        for (let count = 0; game.response?.kind === 'ecazPlacement' && count < game.players.length; count++) {
          const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
          act(actor.id, { type: 'passResponse' });
        }
        assert.equal(game.response ?? null, null);
        assert.equal(game.decision?.kind, 'ecazPlacement');
        assert.equal(semutaHarkonnenBonusPlayer(game, ecaz).spice, balance - quotedCost);
        assert.equal(game.ecazAmbassadors!.tokens.find(candidate => candidate.id === token.id)?.location, territory);
      }
      act(ecaz, { type: 'decision', decline: true });
    });
    reach(state => state.phase === 5 && state.active === owner && semutaHarkonnenBonusClean(state));
    alliance = transition(() => {
      act(owner, { type: 'ship', territory: 'sietch_tabr', sector: 14, amount: 1, elite: 0, allyPayment: 0 });
      assert.equal(game.pendingAmbassador?.stage, 'offer');
      act(ecaz, { type: 'decision', event: game.pendingAmbassador!.event, trigger: true, choice: 'alliance', beneficiary: ecaz });
      assert.equal(game.pendingAmbassador?.stage, 'allianceReply');
      act(owner, { type: 'decision', event: game.pendingAmbassador!.event, accept: true });
      if (game.pendingAmbassador?.stage === 'loan')
        act(ecaz, { type: 'decision', event: game.pendingAmbassador.event, loan: false });
      assert.equal(game.pendingAmbassador ?? null, null);
    });
    assert.equal(semutaHarkonnenBonusPlayer(game, owner).ally, ecaz);
    assert.equal(semutaHarkonnenBonusPlayer(game, ecaz).ally, owner);
    act(owner, { type: 'endMovement' });
    reach(state => state.phase === 5 && state.active === spender && semutaHarkonnenBonusClean(state));
    arrival = transition(() => { act(spender, { type: 'ship', territory: 'habbanya_ridge_sietch', sector: 17,
      amount: 1, elite: 0, allyPayment: 0 }); });
    assert.equal(game.pendingAmbassador?.stage, 'offer');
    purchased = game.deck[0].id;
    nativeAction = { type: 'decision', event: game.pendingAmbassador!.event, trigger: true, beneficiary: owner };
    purchase = transition(() => {
      act(ecaz, nativeAction);
      reach(state => state.response?.kind === 'harkonnenBonus');
    });
  } else {
    if (kind === 'blackMarket') {
      reach(state => state.turn === 2 && state.phase === 3 && !state.response && !state.phaseOpening &&
        state.decision?.kind === 'richeseBlackMarket');
      const card = semutaHarkonnenBonusPlayer(game, richese).hand.find(card => card.kind === 'projectile'); assert.ok(card);
      blackMarket = transition(() => { act(richese, { type: 'decision', event: game.richeseBidding!.event,
        card: card.id, method: 'normal', direction: 'clockwise' }); });
      reach(state => semutaHarkonnenBonusClean(state) && state.richeseAuction?.source === 'blackMarket' &&
        state.richeseAuction.active === owner && state.richeseAuction.bid === 0);
      purchased = game.richeseAuction!.cardId;
      nativeAction = { type: 'richeseBid', event: game.richeseAuction!.event, amount: 1, allyPayment: 0 };
    } else {
      reach(state => semutaHarkonnenBonusClean(state) && !!state.auction && state.auction.active === owner && state.auction.bid === 0);
      assert.equal(game.auction!.index, 0); assert.ok(game.auction!.cards.length >= 2);
      purchased = game.auction!.cards[0].id;
      nativeAction = { type: 'bid', amount: 1, allyPayment: 0 };
    }
    purchase = transition(() => {
      act(owner, nativeAction);
      reach(state => state.response?.kind === 'harkonnenBonus');
    });
  }
  const paid = kind === 'ambassador' ? 3 : 1;
  assert.equal(game.response?.kind, 'harkonnenBonus'); assert.equal(game.response?.owner, owner);
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.equal(semutaHarkonnenBonusPlayer(purchase.before, owner).spice - semutaHarkonnenBonusPlayer(game, owner).spice, paid);
  assert.equal(semutaHarkonnenBonusPlayer(game, owner).hand.length, semutaHarkonnenBonusPlayer(purchase.before, owner).hand.length + 1);
  assert.equal(semutaHarkonnenBonusPlayer(game, owner).hand.filter(card => card.id === purchased).length, 1);
  assert.notEqual(purchased, cost);
  const purchasedCard = structuredClone(semutaHarkonnenBonusPlayer(game, owner).hand.find(card => card.id === purchased)!);
  const source = structuredClone(game), originalResponse = structuredClone(game.response!);
  const originalSale = structuredClone(game.currentAuctionSale ?? null), originalAuction = structuredClone(game.auction ?? null);
  const originalEntry = structuredClone(game.pendingAmbassador ?? null), originalLot = structuredClone(game.richeseAuction ?? null);
  const originalRound = structuredClone(game.richeseBidding ?? null), originalDeck = game.deck.map(card => card.id);
  const bonus = game.deck[0]; assert.ok(bonus);
  assert.ok(semutaHarkonnenBonusPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaHarkonnenBonusPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaHarkonnenBonusInventory(game), originalInventory);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, kind, advanced, richese, holder, spender, owner, buyer: owner, ecaz,
    cost, semuta: SEMUTA_DRUG_ID, action, nativeAction, originalResponse,
    paid, purchased, purchasedCard, bonus: structuredClone(bonus), originalDeck,
    originalSale, originalAuction, originalEntry, originalLot, originalRound,
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, deal, dealOrder, packetCreation,
    originalSpice, spiceOrder, acquired, acquisition, blackMarket, placements, alliance, arrival, purchase,
    originalInventory, actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Public Basic start or original Advanced Semuta initializer on a ready undealt R/C/H/E lobby; Basic Ambassador additionally seats Ecaz under its existing native gate. Original main35/cache10 remain physical. Only unopened original deal/Spice positions and scalar lotteries are selected. Harkonnen really receives two starting cards, Emperor printed Karama, and CHOAM buys cache Semuta for1.',
      kind === 'normal' ? 'Harkonnen makes a real positive bid1 on the first native normal lot. Other seats pass; native delivery/debit and Emperor income settle before the original Harkonnen bonus response. The bonus has not drawn.' :
        kind === 'blackMarket' ? 'After actual first-turn completion, Richese offers its original dealt projectile at the real turn2 Advanced Black Market. Harkonnen bids1; the native seller/payment/income continuations finish before bonus. No purchase or auction frame is installed.' :
          'The original nine-roll Ambassador packet genuinely includes Richese. At first Revival Ecaz declares reusable Ecaz at Tabr14, actually passes its native counter, pays1, and regains its placement chooser. It declares Richese at Habbanya17, actually passes that counter and pays the next native price2 before finishing placement. Harkonnen ships1 to Tabr, actually accepts Ecaz’s printed alliance and declines any real optional Duke loan. Independent non-ally Emperor next ships1 to Habbanya; Ecaz triggers Richese for allied Harkonnen. Harkonnen pays3 and draws its paid card; original Emperor income settles before bonus. Advanced E3 Semuta admission remains unchanged.',
      'Stop before the separate original printed cancellation cost. The purchased card and native wallets already committed, and the exact next deck card is still undrawn. Claim/pass resumes denial plus the original sale/entry tail once; normal allowance alone draws its one physical bonus.',
    ] };
}
export type SemutaHarkonnenBonusFixture = ReturnType<typeof createSemutaHarkonnenBonusFixture>;
