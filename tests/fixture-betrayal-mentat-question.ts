import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { splitLocation } from '../game/board';
import { drawNexusCard, validateNexusCards } from '../game/nexus-cards';
import { createGuildBetrayalSkillsSetup } from './fixture-bureaucrat-betrayal-funding';

export const betrayalMentatSeat = (game: Game, id: string) => game.players.find(p => p.id === id)!;
export const reloadBetrayalMentat = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;

/** Native obligations only; pass ordinary bidding so original starting wallets
 * remain available for the paid trainer deployment. No optional card is played. */
export function stepBetrayalMentat(game: Game): Game {
  if (game.pendingGuildBetrayal) {
    const frame = game.pendingGuildBetrayal;
    const actor = frame.required.find(id => !frame.passed.includes(id))!;
    return applyAction(game, actor, { type: 'guildBetrayalPass', event: frame.invoice.event });
  }
  if (game.decision?.kind === 'guildShipment')
    return applyAction(game, game.decision.player, { type: 'decision', allow: true });
  if (game.decision?.kind === 'advisor' || game.decision?.kind === 'intrusion')
    return applyAction(game, game.decision.player, { type: 'decision', accept: false });
  if (game.response) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id))!.id;
    return applyAction(game, actor, { type: 'passResponse' });
  }
  if (game.status === 'playing' && game.phase === 0 && !game.phaseOpening &&
      !game.decision && game.stormPending === null) {
    const actor = game.stormDialers.find(id => game.stormDials[id] === undefined);
    if (actor) return applyAction(game, actor, { type: 'stormDial', amount: 0 });
  }
  if (game.auction && !game.decision && !game.phaseOpening)
    return applyAction(game, game.auction.active!, { type: 'passBid' });
  if (game.status === 'setup' && game.setupStage === 'traitors') {
    const player = game.players.find(p => p.traitorChoices.length)!;
    return applyAction(game, player.id, { type: 'traitor', leader: player.traitorChoices[0] });
  }
  for (const player of game.players) {
    const view = viewGame(game, player.id);
    view.players.find(p => p.id === player.id)!.bot = 'Easy';
    const action = botActions(view)[0];
    if (action) return applyAction(game, player.id, action);
  }
  throw Error(`Native Mentat continuation stalled at ${game.status}/${game.phase}/${game.decision?.kind}`);
}

export function betrayalMentatResources(game: Game) {
  return structuredClone({ players: game.players, deck: game.deck, discard: game.discard,
    nexus: game.nexusCards?.cards, betrayal: game.guildBetrayal, pending: game.pendingGuildBetrayal });
}

export interface BetrayalMentatFixture {
  initial: Game;
  beforeShipment: Game;
  shipment: Action;
  paid: Game;
  battle: Game;
  owner: string;
  target: string;
  observer: string;
  leader: string;
  cardCustody: { card: string; from: string; to: string }[];
  shipmentGateEvents: string[];
}

/** Actual all14 assignment, original traitors/cards/storm and native readiness.
 * Only original unplayed Treachery custody is controlled, with each exchange
 * recorded. Armies, wallets, order, phases and battle plans are never assigned. */
export function createBetrayalMentatQuestionFixture(): BetrayalMentatFixture {
  const setup = createGuildBetrayalSkillsSetup(false, false, 'mentat');
  let game = setup.trained;
  for (let n = 0; n < 300 && !(game.status === 'playing' && game.phase === 5 &&
    !game.phaseOpening && !game.response && !game.decision); n++) game = stepBetrayalMentat(game);
  assert.equal(game.phase, 5);
  assert.equal(game.turn, 1);
  const owner = setup.trainer, target = 'holder', observer = 'guild';
  const holder = betrayalMentatSeat(game, target);
  const cardCustody: BetrayalMentatFixture['cardCustody'] = [];
  // Arrange the original singleton Guild Nexus in its real non-Guild holder.
  // Existing held faces are exchanged, not copied or newly invented.
  let nexus = game.nexusCards!.cards!;
  const former = nexus.hands[target];
  const heldBy = Object.keys(nexus.hands).find(id => nexus.hands[id] === 'guild');
  if (heldBy && heldBy !== target) {
    nexus.hands[heldBy] = former;
    nexus.hands[target] = 'guild';
    cardCustody.push({ card: 'nexus:guild', from: heldBy, to: target });
  } else if (!heldBy) {
    if (former !== null) { nexus.deck.push(former); nexus.hands[target] = null; }
    const index = nexus.deck.indexOf('guild');
    assert.ok(index >= 0, 'Original unplayed Guild Nexus remains in its deck.');
    nexus.deck.unshift(nexus.deck.splice(index, 1)[0]);
    nexus = drawNexusCard(nexus, target, game.players, () => 0);
    cardCustody.push({ card: 'nexus:guild', from: 'nexusDeck', to: target });
  }
  game.nexusCards!.cards = nexus;
  validateNexusCards(nexus, game.players);
  const shipper = betrayalMentatSeat(game, 'shipper');
  assert.ok(shipper.hand.length, 'Native Emperor starting card remains unplayed.');
  const extra = shipper.hand.shift()!;
  holder.hand.push(extra);
  cardCustody.push({ card: extra.id, from: 'shipper', to: target });
  const inventory = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)]
    .map(card => card.id).sort();
  // The two target slots contain original physical Crysknife and Snooper.
  // Exchange only unplayed cards, including any already dealt desired card.
  for (const [slot, name] of ['Crysknife', 'Snooper'].entries()) {
    if (holder.hand[slot].name === name) continue;
    const pools = [{ id: 'deck', cards: game.deck },
      ...game.players.map(p => ({ id: p.id, cards: p.hand }))];
    const pool = pools.find(p => p.cards.some(card => card.name === name))!;
    assert.ok(pool, `Original unplayed ${name} must still exist.`);
    const index = pool.cards.findIndex(card => card.name === name);
    const original = holder.hand[slot], selected = pool.cards[index];
    pool.cards[index] = original;
    holder.hand[slot] = selected;
    cardCustody.push({ card: original.id, from: target, to: pool.id },
      { card: selected.id, from: pool.id, to: target });
  }
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)]
    .map(card => card.id).sort(), inventory);
  const source = Object.entries(holder.forces).find(([key, amount]) =>
    amount > 0 && splitLocation(key).sector !== game.storm)!;
  assert.ok(source, 'The original Atreides army has a storm-safe occupied location.');
  const { territory, sector } = splitLocation(source[0]);
  while (game.active !== owner) game = applyAction(game, game.active!, { type: 'endMovement' });
  const beforeShipment = structuredClone(game);
  const shipment: Action = { type: 'ship', territory, sector, amount: 2, allyPayment: 0 };
  game = applyAction(game, owner, shipment);
  const shipmentGateEvents: string[] = [];
  for (let n = 0; n < 100 && (game.pendingGuildBetrayal || game.response || game.decision); n++) {
    if (game.pendingGuildBetrayal) shipmentGateEvents.push(game.pendingGuildBetrayal.invoice.event);
    game = stepBetrayalMentat(game);
  }
  const paid = structuredClone(game);
  assert.equal(betrayalMentatSeat(paid, owner).forces[source[0]], 2);
  assert.equal(betrayalMentatSeat(paid, owner).spice,
    betrayalMentatSeat(beforeShipment, owner).spice - 2);
  assert.ok(shipmentGateEvents.length, 'Ordinary Mentat must not suppress the original Betrayal gate.');
  while (game.phase === 5 && !game.phaseOpening && !game.decision && !game.response)
    game = applyAction(game, game.active!, { type: 'endMovement' });
  for (let n = 0; n < 100 && (game.phaseOpening || game.response || game.decision); n++)
    game = stepBetrayalMentat(game);
  assert.equal(game.phase, 6);
  assert.ok(game.active === owner || game.active === target);
  game = applyAction(game, game.active!, { type: 'chooseBattle', territory,
    target: game.active === owner ? target : owner });
  const assignment = game.leaderSkills!.assignments.find(a => a.owner === owner)!;
  assert.equal(assignment.skill, 'mentat');
  assert.equal(betrayalMentatSeat(game, owner).leaders.find(l => l.id === assignment.leader)!.dead, false);
  return { initial: setup.initial, beforeShipment, shipment, paid, battle: game,
    owner, target, observer, leader: assignment.leader, cardCustody, shipmentGateEvents };
}

/** Finish original posture/power steps, without convenience plan assignments. */
export function prepareBetrayalMentatPlans(state: Game): Game {
  let game = state;
  for (let n = 0; n < 60; n++) {
    if (game.decision?.kind === 'leaderSkillVisibility')
      game = applyAction(game, game.decision.player, { type: 'leaderSkillVisibility',
        event: game.decision.event, hide: game.decision.player === 'trainer' });
    else if (game.decision?.kind === 'fullPlanOffer')
      game = applyAction(game, game.decision.player, { type: 'decision', decline: true });
    else if (game.battle?.preparation)
      game = applyAction(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
    else if (game.response) game = stepBetrayalMentat(game);
    else return game;
  }
  throw Error('Original Mentat preparation did not complete.');
}
