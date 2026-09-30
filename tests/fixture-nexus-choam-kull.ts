import { applyAction, battles, createGame, initializeNexusKullGameForAudit, joinGame, newPlayer, viewGame, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { takeKullCard } from './fixture-choam-kull';
import { orderNexusSpice } from './fixture-nexus-cards';
import type { FactionId } from '../game/catalog';

export function createNexusChoamKullFixture(options: {
  advanced?: boolean; bg?: boolean; seatIds?: string[]; nexusFace?: 'choam' | 'richese';
  actorFaction?: Extract<FactionId, 'atreides' | 'emperor' | 'beneGesserit' | 'guild' | 'fremen'>;
  fuel?: 'karama' | 'worthless' | 'weapon'; counter?: boolean;
} = {}): { game: Game; choam: string; actor: string; other: string | null; event: string;
  original: string; fuel: string; counter: string | null } {
  const ids = options.seatIds ?? ['c', 'e', 'h'];
  if (ids.length !== 3 || new Set(ids).size !== 3) throw new Error('Nexus Kull fixture requires three distinct seats.');
  const [choam, actor, other] = ids;
  const needsSubstitute = options.fuel === 'karama' && !options.bg;
  const substitute = needsSubstitute && (options.advanced ?? true);
  if (needsSubstitute && options.advanced === false && options.counter === true)
    throw new Error('Basic has only two physical Karama cards: original and fuel leave no distinct counter.');
  let game = createGame('NXKULL01', newPlayer(choam, 'CHOAM', 'choam'), options.advanced ?? true, ['choam', 'ix']);
  joinGame(game, newPlayer(actor, 'Actor', options.actorFaction ?? (options.bg ? 'beneGesserit' : 'emperor')));
  joinGame(game, newPlayer(other, 'Other', substitute ? 'beneGesserit' : 'harkonnen'));
  for (const p of game.players) { p.bot = 'Medium'; p.ready = true; }
  game.nexusCards = { cards: null, phase: null };
  game = initializeNexusKullGameForAudit(game);
  for (let step = 0; game.status === 'setup' && step < 100; step++) {
    let next: Game | undefined;
    for (const p of game.players) {
      const action = botActions(viewGame(game, p.id))[0];
      if (action) { next = applyAction(game, p.id, action); break; }
    }
    if (!next) throw new Error('Genuine Nexus Kull setup has no legal action.');
    game = next;
  }
  if (game.status !== 'playing') throw new Error('Genuine Nexus Kull setup did not complete.');
  for (const phase of [0, 1]) {
    if (phase === 1) orderNexusSpice(game, ['land', 'land']);
    for (let step = 0; game.phase === phase && step < 80; step++) {
      let next: Game | undefined;
      for (const p of game.players) {
        const view = viewGame(game, p.id);
        view.players.find(seat => seat.id === p.id)!.bot = 'Easy';
        const action = botActions(view)[0];
        if (action) { next = applyAction(game, p.id, action); break; }
      }
      if (!next) throw new Error('Genuine CHOAM/Ix Nexus phase has no legal continuation.');
      game = next;
    }
    if (game.phase !== phase + 1) throw new Error('Genuine CHOAM/Ix Nexus phase did not finish.');
  }
  game.deck.push(...game.players.flatMap(p => p.hand));
  for (const p of game.players) { p.hand = []; delete p.bot; }
  const original = takeKullCard(game, options.bg ? 'Baliset' : 'karama');
  game.players[1].hand.push(original);
  const fuel = takeKullCard(game, options.fuel === 'karama' ? 'karama' : options.fuel === 'weapon' ? 'ix-hunter-seeker' : 'La La La');
  game.players[0].hand.push(fuel);
  const counter = options.counter === false || (needsSubstitute && !substitute)
    ? null : takeKullCard(game, substitute ? 'Jubba Cloak' : 'karama');
  if (counter) game.players[2].hand.push(counter);
  const cards = game.nexusCards!.cards!;
  const face = options.nexusFace ?? 'choam';
  const old = cards.hands[choam];
  const holder = game.players.find(p => cards.hands[p.id] === face);
  if (holder) cards.hands[holder.id] = old;
  else {
    const zone = cards.deck.includes(face) ? cards.deck : cards.discard;
    const index = zone.indexOf(face);
    if (index < 0) throw new Error('Missing physical Nexus fixture face.');
    zone.splice(index, 1);
    if (old) cards.deck.push(old);
  }
  cards.hands[choam] = face;
  Object.assign(game, { turn: 2, phase: 5, active: actor, storm: 18, ready: [], decision: null,
    response: null, pendingKarama: null, phaseOpening: null, stormPending: null,
    stormResolution: null, movementRemaining: [...ids] });
  game = applyAction(game, actor, { type: 'card', mode: 'shipment', card: original.id, target: actor });
  if (!game.pendingKull) throw new Error('Genuine Karama attempt did not create the Kull opportunity.');
  return { game, choam, actor, other, event: game.pendingKull.event,
    original: original.id, fuel: fuel.id, counter: counter?.id ?? null };
}

/** A native declaration is produced by actions before its Karama/Kull parent
 * is suspended. The final faction roster is fixed before genuine setup. */
export function createNexusKullNativeParent(kind: 'inspection' | 'sardaukar' | 'advisors' | 'guild',
  seatIds?: string[]) {
  const actorFaction = { inspection: 'atreides', sardaukar: 'emperor',
    advisors: 'beneGesserit', guild: 'guild' } as const;
  const f = createNexusChoamKullFixture({ actorFaction: actorFaction[kind], fuel: 'weapon', counter: false, seatIds });
  let game = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, decline: true });
  game.players[1].hand.push(takeKullCard(game, f.original));
  const counter = takeKullCard(game, 'karama');
  game.players[2].hand.push(counter);
  const face = actorFaction[kind], cards = game.nexusCards!.cards!;
  const old = cards.hands[f.actor];
  const holder = game.players.find(p => cards.hands[p.id] === face);
  if (holder) cards.hands[holder.id] = old;
  else {
    const zone = cards.deck.includes(face) ? cards.deck : cards.discard;
    const index = zone.indexOf(face);
    if (index < 0) throw new Error(`Missing native ${face} Nexus.`);
    zone.splice(index, 1);
    if (old) cards.deck.push(old);
  }
  cards.hands[f.actor] = face;
  Object.assign(game, { phase: kind === 'inspection' || kind === 'sardaukar' ? 6 : 5,
    active: f.actor, karamaShipping: null, movementRemaining: null, ready: [] });
  for (const p of game.players) {
    p.forces = {}; p.reserves = 20; p.tanks = 0; p.spice = 20; p.shipped = false; p.moved = 0;
    if (p.elites) { p.elites.forces = {}; p.elites.tanks = 0; p.elites.reserves = p.faction === 'emperor' ? 5 : 3; }
    if (p.advisors) p.advisors = {};
  }
  if (kind === 'inspection' || kind === 'sardaukar') {
    for (const p of game.players.slice(1)) { p.forces = { 'pasty_mesa:5': 7 }; p.reserves = 13; }
    const choice = battles(game).find(battle => battle.territory === 'pasty_mesa');
    if (!choice) throw new Error('Native parent setup has no contested battle.');
    game.active = choice.chooser;
    game = applyAction(game, choice.chooser, { type: 'chooseBattle', territory: choice.territory,
      target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
    for (const id of [f.actor, f.other!]) if (game.battle!.preLeader && !game.battle!.preLeader.closed)
      game = applyAction(game, id, { type: 'battlePreparationReady', event: game.battle!.event });
    if (kind === 'inspection') {
      if (game.response) game = allowNativeParent(game);
      game = applyAction(game, f.actor, { type: 'prescience', field: 'dial' });
      game = allowNativeParent(game);
      game = applyAction(game, f.other!, { type: 'prescienceAnswer', value: 0 });
      if (game.decision?.kind === 'fullPlanOffer')
        game = applyAction(game, game.decision.player, { type: 'decision', decline: true });
      game = applyAction(game, f.actor, { type: 'nexusAtreides', event: game.battle!.event, mode: 'cunning', field: 'weapon' });
    } else {
      while (game.battle!.preparation)
        game = applyAction(game, game.battle!.preparation.owner, { type: 'declineBattlePower' });
      if (game.decision?.kind === 'fullPlanOffer')
        game = applyAction(game, game.decision.player, { type: 'decision', decline: true });
      game = applyAction(game, f.actor, { type: 'nexusSardaukar', event: viewGame(game, f.actor).nexusSardaukar!.offer!.event });
    }
  } else if (kind === 'advisors') {
    game.players[1].forces = { 'pasty_mesa:5': 2 }; game.players[1].reserves = 18;
    game.players[1].advisors = { pasty_mesa: {} };
    game.players[2].forces = { 'pasty_mesa:5': 1 }; game.players[2].reserves = 19;
    game = applyAction(game, f.actor, { type: 'nexusAdvisors',
      event: viewGame(game, f.actor).nexusAdvisors!.offer!.event, territories: ['pasty_mesa'] });
  } else {
    game = applyAction(game, f.actor, { type: 'ship', territory: 'arrakeen', sector: 10, amount: 1 });
    if (game.decision?.kind === 'guildShipment')
      game = applyAction(game, game.decision.player, { type: 'decision', allow: true });
    game = allowNativeParent(game);
    game = applyAction(game, f.actor, { type: 'move', from: 'arrakeen:10', territory: 'hagga_basin', sector: 12, amount: 1 });
    game = applyAction(game, f.actor, { type: 'endMovement', nexus: viewGame(game, f.actor).nexusGuildCunning!.offer!.event });
  }
  return { ...f, game, reactor: f.other!, reaction: counter.id };
}

function allowNativeParent(game: Game): Game {
  for (let step = 0; game.response && step < 20; step++) {
    const responder = game.players.find(p => {
      const controls = viewGame(game, p.id).responseControls;
      return controls && !controls.hasPassed && controls.cancelCards.length > 0;
    });
    if (!responder) throw new Error('Native response has no explicit responder.');
    game = applyAction(game, responder.id, { type: 'passResponse' });
  }
  return game;
}

export function createNexusKullNestedParent(seatIds?: string[]) {
  const f = createNexusChoamKullFixture({ bg: true, fuel: 'karama', seatIds });
  let game = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, decline: true });
  game = allowNativeParent(game);
  game.players[1].hand.push(takeKullCard(game, f.original));
  const printed = takeKullCard(game, 'ix-kull-wahad');
  game.players[0].hand.push(printed);
  const bgCounter = takeKullCard(game, 'Jubba Cloak');
  game.players[1].hand.push(bgCounter);
  Object.assign(game, { phase: 4, karamaShipping: null });
  const play = viewGame(game, f.choam).choamWorthless!.plays.find(play =>
    play.source === 'nexus' && play.effect === 'laLaLa' && play.card.id === f.fuel);
  if (!play || !('event' in play)) throw new Error('Missing genuine Nexus parent quote.');
  game = applyAction(game, f.choam, { type: 'card', mode: 'choam', card: f.fuel,
    nexus: play.event, effect: 'laLaLa', target: f.actor });
  return { ...f, game, printed: printed.id, bgCounter: bgCounter.id, nexusEvent: play.event };
}

export function createNexusKullAuctionParent(seatIds?: string[]) {
  const f = createNexusChoamKullFixture({ fuel: 'weapon', counter: false, seatIds });
  let game = applyAction(f.game, f.choam, { type: 'kullDecision', event: f.event, decline: true });
  const payment = takeKullCard(game, f.original);
  game.players[0].hand.push(payment);
  const printed = takeKullCard(game, 'ix-kull-wahad');
  game.players[0].hand.push(printed);
  const reaction = takeKullCard(game, 'karama');
  game.players[2].hand.push(reaction);
  game.players[1].hand.push(takeKullCard(game, 'Shield'));
  const lot = takeKullCard(game, 'ix-snooper');
  Object.assign(game, { phase: 3, active: f.choam, karamaShipping: null, movementRemaining: [],
    auction: { cards: [lot], index: 0, bid: 0, bidder: null, active: f.choam, passed: [], opener: 0 } });
  game.players[0].spice = 1;
  game = applyAction(game, f.choam, { type: 'bid', amount: 2 });
  for (let step = 0; game.auction && !game.decision && step < 12; step++)
    game = applyAction(game, game.auction.active!, { type: 'passBid' });
  if (game.decision?.kind !== 'auctionPayment') throw new Error('CHOAM did not reach genuine winning payment.');
  return { ...f, game, payment: payment.id, printed: printed.id, reactor: f.other!,
    reaction: reaction.id, lot: lot.id };
}
