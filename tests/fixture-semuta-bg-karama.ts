import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer,
  type Action, type Game,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { nextSemutaGuildIncomeNativeStep } from './fixture-semuta-guild-income';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import { moveSemutaEmperorCard } from './fixture-semuta-emperor-share';

export type SemutaBgUse = 'shipment' | 'cancel' | 'purchase' | 'auctionPayment';
export type SemutaBgStep = { actor: string; action: Action };
const player = (game: Game, actor: string) => game.players.find(p => p.id === actor)!;
const clean = (game: Game) => !game.response && !game.decision && !game.phaseOpening && !game.pendingTreacheryDiscard;

/** Original native BG/Richese/classic setup, actual paid Semuta, Karama and
 * Worthless auctions. Only original undealt lotteries/deck order are selected;
 * no played hand/army/wallet/phase/response is staged. */
export function createOriginalSemutaBg(use: SemutaBgUse = 'shipment', homeworlds = false) {
  let game = createGame('SEMUTABGCONVERSION', newPlayer('r', 'Richese', 'richese'), true, ['choam']);
  for (const [id, name, faction] of [['b', 'Bene Gesserit', 'beneGesserit'], ['a', 'Atreides', 'atreides'],
    ['e', 'Emperor', 'emperor'], ['g', 'Guild', 'guild']] as const) joinGame(game, newPlayer(id, name, faction));
  if (homeworlds) game = applyAction(game, 'r', { type: 'homeworlds', enabled: true });
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const actions: SemutaBgStep[] = [];
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  };
  const reach = (until: (state: Game) => boolean) => {
    for (let n = 0; !until(game) && n < 1800; n++) {
      assert.notEqual(game.status, 'finished');
      const next = nextSemutaGuildIncomeNativeStep(game); act(next.actor, next.action);
    }
    assert.ok(until(game), `Original BG source stalled at ${game.turn}/${game.phase}/${game.decision?.kind}`);
  };
  reach(state => state.status === 'playing');
  const setup = structuredClone(game);
  const ki = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(ki >= 0);
  const karama = game.deck.splice(ki, 1)[0];
  const wi = game.deck.findIndex(card => card.kind === 'worthless'); assert.ok(wi >= 0);
  const worthless = game.deck.splice(wi, 1)[0]; game.deck.unshift(karama, worthless);
  for (const position of [0, 1]) {
    const at = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card);
    assert.ok(at >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  reach(state => state.decision?.kind === 'richeseCache');
  act('r', { type: 'decision', event: game.richeseBidding!.event, card: 'richese-semuta-drug',
    method: 'onceAround', direction: 'counterclockwise' });
  reach(state => !!state.richeseAuction && !state.richeseAuction.outcome &&
    state.richeseAuction.active === 'a' && clean(state));
  act('a', { type: 'richeseBid', event: game.richeseAuction!.event, amount: 1 });
  reach(state => player(state, 'a').hand.some(card => card.id === 'richese-semuta-drug') && clean(state));
  const boughtSemuta = structuredClone(game);
  reach(state => !!state.auction && state.auction.index === 0 && state.auction.active === 'e' && clean(state));
  act('e', { type: 'bid', amount: 1 });
  reach(state => player(state, 'e').hand.some(card => card.id === karama.id) && clean(state));
  const boughtKarama = structuredClone(game);
  reach(state => !!state.auction && state.auction.index === 1 && state.auction.active === 'b' && clean(state));
  act('b', { type: 'bid', amount: 1 });
  reach(state => player(state, 'b').hand.some(card => card.id === worthless.id) && clean(state));
  const boughtWorthless = structuredClone(game);
  let action: Action, lot: string | undefined, originalResponse: Game['response'] = null;
  let target: string | undefined;
  if (use === 'purchase' || use === 'auctionPayment') {
    reach(state => !!state.auction && state.auction.index === 2 && state.auction.active === 'b' && clean(state));
    lot = game.auction!.cards[game.auction!.index].id;
    if (use === 'purchase') action = { type: 'card', card: worthless.id, mode: 'purchase' };
    else {
      act('b', { type: 'bid', amount: player(game, 'b').spice + 1 });
      reach(state => state.decision?.kind === 'auctionPayment' && state.decision.player === 'b' && !state.response && !state.phaseOpening);
      action = { type: 'decision', karama: true, card: worthless.id };
    }
  } else {
    reach(state => state.phase === 5 && state.active === (use === 'cancel' ? 'g' : 'a') && clean(state));
    if (use === 'shipment') action = { type: 'card', card: worthless.id, mode: 'shipment', target: 'a' };
    else {
      const destination = TERRITORIES.find(t => t.type === 'sand' && t.sectors.some(s => s !== game.storm) &&
        game.players.every(p => presenceAt(p, t.id) === 0));
      assert.ok(destination); const sector = destination.sectors.find(s => s !== game.storm)!;
      target = `${destination.id}:${sector}`;
      act('g', { type: 'ship', territory: destination.id, sector, amount: 2, elite: 0, allyPayment: 0 });
      if (game.decision?.kind === 'guildShipment') act('g', { type: 'decision', allow: true });
      assert.equal(game.response?.kind, 'guildRate'); originalResponse = structuredClone(game.response);
      action = { type: 'card', card: worthless.id, mode: 'cancel' };
    }
  }
  const beforeCost = structuredClone(game);
  act('b', action);
  assert.equal(game.pendingTreacheryDiscard?.batch.cause, 'karama:conversion');
  assert.equal(game.pendingKarama, null);
  return { setup, boughtSemuta, boughtKarama, boughtWorthless, actions, beforeCost,
    game, action, use, homeworlds, lot, target, originalResponse,
    owner: 'b', holder: 'a', counter: 'e', beneficiary: 'a', guild: 'g',
    worthless, karama, semuta: 'richese-semuta-drug',
    provenance: [
      'Original five-faction Semuta setup and native BG choices; only original undealt entropy/deck order selected.',
      'Atreides pays1 for public Semuta; Emperor pays1 for normal Karama; BG pays1 for the actual normal Worthless.',
      'Real native phase/lot progression and optional native Guild declaration or actual BG overbid; no played state staged.',
    ] };
}

export function passSemutaBgResponse(state: Game, kind = 'worthlessKarama') {
  let game = state;
  for (let n = 0; game.response?.kind === kind && n < 30; n++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = applyAction(game, actor.id, { type: 'passResponse' });
  }
  assert.notEqual(game.response?.kind, kind);
  return game;
}

/** Only native already-earned arrival/inspection continuations, never another
 * shipment, bid, card spend or invented controller. */
export function settleSemutaBgNative(state: Game) {
  let game = state;
  for (let n = 0; n < 80; n++) {
    if (!game.response && !game.decision && !game.phaseOpening && !game.pendingTreacheryDiscard) return game;
    if (game.pendingTreacheryDiscard) throw Error('Resolve the actual fresh Semuta event first.');
    if (game.response) {
      const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
      game = applyAction(game, actor.id, { type: 'passResponse' });
    } else if (game.decision?.kind === 'advisor' || game.decision?.kind === 'intrusion')
      game = applyAction(game, game.decision.player, { type: 'decision', accept: false });
    else if (game.decision?.kind === 'guildShipment') game = applyAction(game, game.decision.player, { type: 'decision', allow: true });
    else if (game.decision?.kind === 'homeworldShipmentGuild') game = applyAction(game, game.decision.player,
      { type: 'decision', event: game.decision.event, allow: true });
    else throw Error(`Finish only the original native suffix: ${game.decision?.kind ?? 'phase opening'}`);
  }
  throw Error('Original BG native suffix did not settle.');
}

/** CONTROLLED acquisition/phase fixture for a real subsequent CHOAM rediscard,
 * not a synthetic discard or an original-action acquisition claim. Native
 * roles/setup/stocks/wallets are genuine and are never replaced after setup. */
export function createControlledBgClaimedPriceRefund() {
  let game = createGame('BGCLAIMEDCASHOUT', newPlayer('r', 'Richese', 'richese'), true, ['choam']);
  for (const [id, faction] of [['b', 'beneGesserit'], ['c', 'choam'], ['g', 'guild'], ['a', 'atreides']] as const)
    joinGame(game, newPlayer(id, faction, faction));
  for (const p of game.players) game = applyAction(game, p.id, { type: 'ready' });
  game = initializeSemutaGameForAudit(game);
  for (let n = 0; game.status === 'setup' && n < 300; n++) {
    const next = nextSemutaGuildIncomeNativeStep(game); game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.status, 'playing');
  for (const p of game.players) game.deck.push(...p.hand.splice(0));
  const worthless = game.deck.find(card => card.kind === 'worthless'); assert.ok(worthless);
  const karamas = game.deck.filter(card => card.effect === 'karama').slice(0, 2);
  assert.equal(karamas.length, 2);
  moveSemutaEmperorCard(game, worthless.id, 'b');
  moveSemutaEmperorCard(game, karamas[0].id, 'c');
  moveSemutaEmperorCard(game, karamas[1].id, 'g');
  moveSemutaEmperorCard(game, 'richese-semuta-drug', 'c');
  game.phase = 5; game.active = 'a'; game.order = ['a', 'b', 'c', 'g', 'r'];
  game.movementRemaining = ['a', 'b', 'c', 'g', 'r']; game.ready = [];
  game.response = null; game.decision = null; game.phaseOpening = null;
  return { game, worthless, cashout: karamas[0], stop: karamas[1], holder: 'c',
    owner: 'b', beneficiary: 'a', guild: 'g', semuta: 'richese-semuta-drug',
    provenance: ['CONTROLLED conserved later acquisition and phase after genuine native BG/CHOAM/Richese/classic setup.',
      'Original native armies/wallets retained; actual BG conversion, Semuta recovery, CHOAM cashout and Guild stop thereafter.'] };
}
