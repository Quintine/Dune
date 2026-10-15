import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeSemutaGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import type { FactionId } from '../game/catalog';
import { TERRITORIES, MOBILE_LOCATION, mobileRoutes } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { createSemutaGuildTransport } from './fixture-semuta-guild-transport';
import { nextSemutaGuildIncomeNativeStep } from './fixture-semuta-guild-income';
import { moveSemutaEmperorCard, passSemutaSpecialDiscards } from './fixture-semuta-emperor-share';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';

export type SemutaSpecialStep = { actor: string; action: Action };
const player = (game: Game, actor: string) => game.players.find(p => p.id === actor)!;
const clean = (game: Game) => !game.response && !game.decision && !game.phaseOpening && !game.pendingTreacheryDiscard;

/** Two original paid auctions deliberately give Semuta to the shipper and the
 * printed Karama to native Guild. No played hand, wallet, force or phase is assigned. */
export function createOriginalSemutaSpecialGuild(homeworlds = false) {
  const original = createSemutaGuildTransport({ route: homeworlds ? 'world' : 'reserve' });
  let game = structuredClone(original.setup);
  const actions: SemutaSpecialStep[] = [];
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  };
  const reach = (until: (state: Game) => boolean) => {
    for (let n = 0; !until(game) && n < 1600; n++) {
      const next = nextSemutaGuildIncomeNativeStep(game); act(next.actor, next.action);
    }
    assert.ok(until(game));
  };
  const at = game.deck.findIndex(c => c.effect === 'karama'); assert.ok(at >= 0);
  const card = game.deck.splice(at, 1)[0]; game.deck.unshift(card);
  for (const position of [0, 1]) {
    const index = game.spiceDeck.findIndex((c, i) => i >= position && 'territory' in c);
    assert.ok(index >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  reach(state => state.decision?.kind === 'richeseCache');
  act('r', { type: 'decision', event: game.richeseBidding!.event, card: SEMUTA_DRUG_ID,
    method: 'onceAround', direction: 'counterclockwise' });
  reach(state => !!state.richeseAuction && !state.richeseAuction.outcome &&
    state.richeseAuction.active === 'a' && clean(state));
  act('a', { type: 'richeseBid', event: game.richeseAuction!.event, amount: 1 });
  reach(state => player(state, 'a').hand.some(c => c.id === SEMUTA_DRUG_ID) && clean(state));
  const boughtSemuta = structuredClone(game);
  reach(state => !!state.auction && state.auction.index === 0 && state.auction.active === 'g' && clean(state));
  act('g', { type: 'bid', amount: 1 });
  reach(state => player(state, 'g').hand.some(c => c.id === card.id) && clean(state));
  const boughtKarama = structuredClone(game);
  reach(state => state.phase === 5 && state.active === 'a' && clean(state));
  const beforeShipment = structuredClone(game);
  let shipment: Action, target: string;
  if (homeworlds) {
    const quote = homeworldShipmentChoice(viewGame(game, 'a'), 'homeworld:emperor',
      { 'homeworld:atreides': { normal: 2, elite: 0 } });
    assert.ok(quote.action, quote.blocked ?? undefined); shipment = quote.action; target = 'homeworld:emperor';
  } else {
    const destination = TERRITORIES.find(t => t.type === 'sand' &&
      t.sectors.some(s => s !== game.storm) && game.players.every(p => presenceAt(p, t.id) === 0));
    assert.ok(destination); const sector = destination.sectors.find(s => s !== game.storm)!;
    shipment = { type: 'ship', territory: destination.id, sector, amount: 2, elite: 0, allyPayment: 0 };
    target = `${destination.id}:${sector}`;
  }
  act('a', shipment);
  assert.equal(game.decision?.kind, homeworlds ? 'homeworldShipmentGuild' : 'guildShipment');
  return { original, actions, beforeShipment, beforeCost: structuredClone(game), game,
    boughtSemuta, boughtKarama, homeworlds, shipment, target,
    owner: 'g', holder: 'a', shipper: 'a', karama: card.id, semuta: SEMUTA_DRUG_ID,
    action: { type: 'card', mode: 'special', card: card.id } as Action,
    provenance: [
      'Original printed Semuta setup; only original undealt lottery and conserved unplayed deck order selected.',
      'Atreides pays1 for the actual public cache Semuta; Guild pays1 for the actual normal Karama auction.',
      'Original Atreides shipment and actual native interception; no played cards/forces/wallets/phase staged.',
    ] };
}

export function reactSemutaSpecial(game: Game, holder: string, claim: boolean, card?: string): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending);
  assert.ok(pending.reaction?.stage === 'offer'); const event = pending.batch.event;
  if (!claim) {
    const reaction = pending.reaction;
    for (const seat of game.players.filter(p => !reaction.passed.includes(p.id)))
      game = applyAction(game, seat.id, { type: 'semutaPass', event });
    return game;
  }
  game = applyAction(game, holder, { type: 'semutaCommit', event });
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select') {
    assert.ok(card, 'Private multi-card recovery needs the caller’s actual selection.');
    assert.ok(viewGame(game, holder).semutaReaction!.candidates.some(c => c.id === card));
    game = applyAction(game, holder, { type: 'semutaSelect', event, card });
  }
  return game;
}

export type ControlledSemutaSpecialKind = 'emperorForces' | 'emperorLeader' | 'choam' |
  'richese' | 'ixians' | 'tleilaxu' | 'fremen' | 'atreides' | 'harkonnen';

/** CONTROLLED native-effect fixture: genuine native Semuta setup, then conserved
 * later hands/armies/wallets and phase are staged to isolate each printed boundary.
 * These are not original-action acquisition or full-game claims. */
export function createControlledSemutaSpecial(kind: ControlledSemutaSpecialKind) {
  const faction: FactionId = kind === 'emperorForces' || kind === 'emperorLeader' ? 'emperor' : kind;
  let game = createGame('CONTROLLEDSPECIALSEMUTA', newPlayer('p', 'Owner', faction), true,
    ['choam', ...(['ixians', 'tleilaxu'].includes(faction) ? ['ix' as const] : [])]);
  joinGame(game, newPlayer('r', faction === 'richese' ? 'Guild' : 'Richese', faction === 'richese' ? 'guild' : 'richese'));
  joinGame(game, newPlayer('h', 'Holder', faction === 'atreides' ? 'guild' : 'atreides'));
  for (const seat of game.players) game = applyAction(game, seat.id, { type: 'ready' });
  game = initializeSemutaGameForAudit(game);
  for (let n = 0; game.status === 'setup' && n < 300; n++) {
    const next = nextSemutaGuildIncomeNativeStep(game); game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.status, 'playing');
  for (const p of game.players) {
    game.deck.push(...p.hand.splice(0));
    p.forces = {}; p.reserves = 20; p.tanks = 0; p.spice = 20; p.shipped = false; p.moved = 0;
    if (p.elites) {
      p.elites.reserves += p.elites.tanks + Object.values(p.elites.forces).reduce((sum, n) => sum + n, 0);
      p.elites.forces = {}; p.elites.tanks = 0; p.elites.revived = 0;
    }
  }
  const karama = game.deck.find(c => c.effect === 'karama'); assert.ok(karama);
  moveSemutaEmperorCard(game, karama.id, 'p'); moveSemutaEmperorCard(game, SEMUTA_DRUG_ID, 'h');
  game.phase = 4; game.active = 'p'; game.order = ['p', 'r', 'h'];
  game.movementRemaining = ['p', 'r', 'h']; game.ready = [];
  game.response = null; game.decision = null; game.phaseOpening = null;
  game.storm = 18; game.spiceWindow = null; game.spiceResolution = null; game.spice = {};
  const owner = player(game, 'p'), holder = player(game, 'h');
  const action: Action = { type: 'card', mode: 'special', card: karama.id };
  let selected: string[] = [], acquired: string | undefined, target: string | undefined;
  if (kind === 'emperorForces') {
    owner.reserves = 17; owner.tanks = 3; action.amount = 2; action.elite = 0;
  } else if (kind === 'emperorLeader') {
    owner.leaders[0].dead = true; action.leader = owner.leaders[0].id;
  } else if (kind === 'choam') {
    game.phase = 3;
    const cards = game.deck.filter(c => c.effect !== 'karama' && c.id !== SEMUTA_DRUG_ID).slice(0, 2);
    for (const card of cards) moveSemutaEmperorCard(game, card.id, 'p');
    selected = cards.map(c => c.id); action.cards = selected;
  } else if (kind === 'richese') {
    game.phase = 3; acquired = game.richeseCache![0].id; action.acquire = acquired;
  } else if (kind === 'ixians') {
    game.phase = 5; game.mobileStronghold = { location: 'polar_sink:0' };
    owner.forces = { [MOBILE_LOCATION]: 1 }; owner.reserves = 19;
    action.route = mobileRoutes(game, 2)[0]; action.collect = false;
  } else if (kind === 'tleilaxu') {
    holder.reserves = 18; holder.tanks = 2; game.active = 'h';
    game = applyAction(game, 'h', { type: 'revive', amount: 2, elite: 0 });
    assert.equal(game.decision?.kind, 'revivalStop');
  } else if (kind === 'fremen') {
    game.phase = 1;
    const destination = TERRITORIES.find(t => t.type === 'sand' && t.sectors.some(s => s !== game.storm));
    assert.ok(destination); const sector = destination.sectors.find(s => s !== game.storm)!;
    target = `${destination.id}:${sector}`; holder.forces[target] = 2; holder.reserves = 18;
    action.territory = destination.id;
  } else if (kind === 'atreides') {
    game.phase = 6; owner.forces = { 'arrakeen:10': 2 }; owner.reserves = 18;
    holder.forces = { 'arrakeen:10': 2 }; holder.reserves = 18;
    game = applyAction(game, 'p', { type: 'chooseBattle', territory: 'arrakeen', target: 'h' });
    for (let n = 0; n < 40 && (game.response || game.battle?.preparation); n++) {
      if (game.response) game = applyAction(game,
        game.players.find(p => !game.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
      else game = applyAction(game, game.battle!.preparation!.owner, { type: 'declineBattlePower' });
    }
    assert.equal(game.decision?.kind, 'fullPlanOffer'); action.target = 'h';
  } else {
    game.phase = 3; target = 'h'; action.target = target; action.amount = 1;
    const cards = game.deck.filter(c => c.effect !== 'karama' && c.id !== SEMUTA_DRUG_ID).slice(0, 2);
    assert.equal(cards.length, 2);
    moveSemutaEmperorCard(game, cards[0].id, 'p'); selected = [cards[0].id];
    moveSemutaEmperorCard(game, cards[1].id, 'h');
  }
  return { kind, beforeCost: structuredClone(game), game, action, owner: 'p', holder: 'h',
    karama: karama.id, semuta: SEMUTA_DRUG_ID, selected, acquired, target,
    provenance: ['CONTROLLED genuine native Semuta setup, then conserved later hands/armies/wallets/phase.',
      'Actual native battle/revival declarations where needed; actual printed activation and Semuta reactions thereafter.'] };
}

export { passSemutaSpecialDiscards };
