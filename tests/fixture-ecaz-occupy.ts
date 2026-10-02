import assert from 'node:assert/strict';
import { applyAction, createGame, initializeEcazOccupyGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player } from '../game/engine';
import { botActions } from '../game/bots';
import { TERRITORIES, location as locationKey, splitLocation } from '../game/board';
import { createAdvancedSourceFixture, finishToMovement, advanceToNextStorm } from './fixture-advanced-source';
import type { FactionId } from '../game/catalog';
import { baseDeck } from '../game/cards';

export type EcazOccupyFixtureOptions = {
  initial?: Game;
  ecazForces?: number;
  allyFaction?: 'fremen' | 'emperor' | 'beneGesserit' | 'guild';
  order?: 'ecaz-first' | 'ally-first' | 'opponent-first';
  opponentFaction?: 'guild' | 'emperor' | 'beneGesserit' | 'fremen';
  advisorAlly?: boolean;
};
export type EcazOccupyFixture = {
  game: Game; ecaz: string; ally: string; opponent: string;
  territory: string; location: string; ecazForces: number;
};

function step(game: Game): Game {
  if (game.response) return applyAction(game,
    game.players.find(p => !game.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  if (game.phaseOpening) return applyAction(game,
    game.players.find(p => !game.phaseOpening!.passed.includes(p.id))!.id, { type: 'ready' });
  if (game.phase === 3 && game.auction && !game.decision)
    return applyAction(game, game.auction.active, { type: 'passBid' });
  if (game.decision?.kind === 'wormRide')
    return applyAction(game, game.decision.player, { type: 'decision', accept: false });
  if (game.decision && ['advisor', 'intrusion', 'advisorBattle'].includes(game.decision.kind))
    return applyAction(game, game.decision.player, { type: 'decision', accept: false });
  if (game.decision?.kind === 'guildShipment')
    return applyAction(game, game.decision.player, { type: 'decision', allow: true });
  for (const player of game.players) {
    const view = viewGame(game, player.id);
    view.players.find(p => p.id === player.id)!.bot = 'Easy';
    const actions = botActions(view);
    const action = actions.find(a => a.type === 'ready') ?? actions[0];
    if (action) return applyAction(game, player.id, action);
  }
  throw new Error(`No native fixture action at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
}

export function settleEcazOccupyArrival(state: Game, accompany = false): Game {
  let game = state;
  for (let attempt = 0; attempt < 50 && (game.response || game.decision); attempt++) {
    if (accompany && game.decision?.kind === 'advisor')
      game = applyAction(game, game.decision.player,
        { type: 'decision', accept: true, accompany: true, amount: 1 });
    else game = step(game);
  }
  assert.ok(!game.response && !game.decision, 'Native shipment reactions must complete.');
  return game;
}

/** Conserved physical board staging AFTER genuine faction setup. No faction,
 * alliance, phase, plan, force identity or battle receipt is manufactured. */
function returnBoardToReserves(game: Game): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
    // The Spice Bank supplies a labelled test budget, not alliance credit.
    player.spice = 30;
  }
}
function orderBlow(game: Game, worm: boolean, position: number): void {
  const index = game.spiceDeck.findIndex((card, i) => i >= position &&
    (worm ? 'worm' in card && !card.greatMaker && !card.suppressed :
      'territory' in card && card.territory !== 'the_great_flat'));
  assert.ok(index >= position, 'The actual unplayed Spice Card must remain available.');
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
}

/** Conserved physical card exchange after real setup; retains the native draw
 * and every original identity. Used only to expose a named rule case. */
export function stageEcazOccupyCard(game: Game, owner: string,
  predicate: (card: Player['hand'][number]) => boolean): string {
  const player = game.players.find(p => p.id === owner)!;
  const held = player.hand.find(predicate);
  if (held) return held.id;
  const index = game.deck.findIndex(predicate);
  let card: Player['hand'][number];
  if (index >= 0) {
    card = game.deck.splice(index, 1)[0];
    if (player.hand.length >= 4) game.deck.push(player.hand.shift()!);
  } else {
    const donor = game.players.find(p => p.id !== owner && p.hand.some(predicate));
    assert.ok(donor, 'A conserved original physical card must supply this rule case.');
    const donorIndex = donor.hand.findIndex(predicate);
    card = donor.hand[donorIndex];
    const replacement = player.hand.shift() ?? game.deck.shift();
    assert.ok(replacement, 'A conserved physical face must preserve the donor hand.');
    donor.hand[donorIndex] = replacement;
  }
  player.hand.push(card);
  return card.id;
}

/** Genuine fresh E3 faction setup, a natural worm Nexus, reciprocal alliance,
 * accepted shared shipment and actual chooseBattle. Returns BEFORE lead choice.
 * A supplied fresh setup retains its original deal and printed seat positions. */
export function ecazOccupyFixture(options: EcazOccupyFixtureOptions = {}): EcazOccupyFixture {
  const allyFaction = options.allyFaction ?? 'fremen';
  const opponentFaction = options.opponentFaction ?? (allyFaction === 'guild' ? 'emperor' : 'guild');
  assert.notEqual(allyFaction, opponentFaction);
  const ecazForces = options.ecazForces ?? 3;
  assert.ok(Number.isInteger(ecazForces) && ecazForces >= 1 && ecazForces <= 5);
  let setup: Game;
  if (options.initial) {
    setup = structuredClone(options.initial);
    assert.equal(setup.status, 'setup', 'Captured input must be its original admitted fresh setup.');
    assert.equal(setup.ecazOccupyPreview, true);
    assert.equal(setup.advanced, true);
    assert.deepEqual(setup.expansions, ['ecaz']);
    assert.equal(setup.turn, 1, 'Captured Occupy input is never a started-game retrofit.');
    assert.ok(!setup.ecazTreachery && !setup.homeworlds && !setup.nexusCards &&
      !setup.leaderSkills && !setup.strongholdCards && !setup.techTokens &&
      !setup.discoveryEnabled && !setup.discoveries && !setup.discoveryStash &&
      !setup.greatMaker && !setup.moritaniAssassinatePreview,
    'Captured Occupy inputs admit the explicit ordinary Advanced profile only.');
    assert.deepEqual([...setup.deck, ...setup.discard, ...setup.players.flatMap(p => p.hand)]
      .map(card => card.id).sort(), baseDeck().map(card => card.id).sort(),
    'The original captured deal must retain the ordinary 33-card source.');
  } else {
    const roster: FactionId[] = ['ecaz', allyFaction, opponentFaction];
    setup = createGame('ECAZOCCUPY', newPlayer('ecaz', 'Ecaz', 'ecaz'), true, ['ecaz']);
    for (const faction of roster.slice(1)) joinGame(setup, newPlayer(faction, faction, faction));
    const desired = options.order === 'ally-first' ? [allyFaction, opponentFaction, 'ecaz'] :
      options.order === 'opponent-first' || opponentFaction === 'beneGesserit' ?
        [opponentFaction, 'ecaz', allyFaction] : ['ecaz', allyFaction, opponentFaction];
    // Circles 3..5 remain in this order for every genuine second-turn Storm
    // distance (1..6); the occupied initial circles are vacated via real actions.
    for (let i = desired.length - 1; i >= 0; i--)
      if (viewGame(setup, desired[i]).playerPositions[desired[i]] !== i + 3)
        setup = applyAction(setup, desired[i], { type: 'seatPosition', position: i + 3 });
    for (const player of setup.players) setup = applyAction(setup, player.id, { type: 'ready' });
    setup = initializeEcazOccupyGameForAudit(setup);
  }
  assert.ok(setup.players.some(p => p.faction === 'ecaz') &&
    setup.players.some(p => p.faction === allyFaction) &&
    setup.players.some(p => p.faction === opponentFaction),
  'The original source roster must contain the three actual factions for this rule case.');
  const ecaz = setup.players.find(p => p.faction === 'ecaz')!.id;
  const ally = setup.players.find(p => p.faction === allyFaction)!.id;
  const opponent = setup.players.find(p => p.faction === opponentFaction)!.id;
  let game = createAdvancedSourceFixture({ initial: setup }).game;
  assert.equal(game.status, 'playing');
  returnBoardToReserves(game);
  orderBlow(game, false, 0);
  orderBlow(game, false, 1);
  game = finishToMovement(game);
  while (game.phase === 5) game = applyAction(game, game.active!, { type: 'endMovement' });
  game = advanceToNextStorm(game);
  orderBlow(game, true, 0);
  orderBlow(game, false, 1);
  orderBlow(game, false, 2);
  let allied = false;
  for (let attempt = 0; attempt < 500; attempt++) {
    if (!allied && game.phase === 1 && game.nexus && !game.spiceWindow &&
      !game.spiceResolution && !game.phaseOpening && !game.response && !game.decision) {
      game = applyAction(game, ecaz, { type: 'alliance', target: ally });
      game = applyAction(game, ally, { type: 'alliance', target: ecaz });
      allied = true;
    }
    if (game.phase === 5 && !game.phaseOpening && !game.response && !game.decision) break;
    game = step(game);
  }
  assert.ok(allied && game.phase === 5, 'Real Nexus formation must reach native Shipment and Movement.');
  assert.equal(game.players.find(p => p.id === ecaz)!.ally, ally);
  const territory = 'the_great_flat';
  const sector = TERRITORIES.find(t => t.id === territory)!.sectors.find(s => s !== game.storm)!;
  assert.ok(sector !== undefined);
  const location = locationKey(territory, sector);
  stageEcazOccupyCard(game, opponent, card => card.effect === 'karama');
  while (game.phase === 5) {
    const actor = game.active!;
    if (![ecaz, ally, opponent].includes(actor)) {
      game = applyAction(game, actor, { type: 'endMovement' });
      continue;
    }
    const player = game.players.find(p => p.id === actor)!;
    const amount = actor === ecaz ? ecazForces : actor === ally ? 4 : 8;
    const elite = actor === ally && player.elites ? 2 : 0;
    const action: Action = { type: 'ship', territory, sector, amount, ...(elite ? { elite } : {}) };
    game = settleEcazOccupyArrival(applyAction(game, actor, action), !!options.advisorAlly && actor === ecaz);
    if (actor === ally && options.advisorAlly) {
      assert.equal(player.faction, 'beneGesserit');
      assert.ok(game.players.find(p => p.id === ally)!.advisors?.[territory]);
    }
    game = applyAction(game, actor, { type: 'endMovement' });
  }
  while (game.phaseOpening || game.response || game.decision) game = step(game);
  assert.equal(game.phase, 6);
  const choices = viewGame(game, game.active!).battleChoices;
  const choice = choices.find(b => b.territory === territory)!;
  assert.ok(choice, 'The real three-army territory must quote a native battle.');
  const chooser = choice.chooser;
  game = applyAction(game, chooser, { type: 'chooseBattle', territory,
    target: choice.attacker === chooser ? choice.defender : choice.attacker });
  if (!options.advisorAlly) assert.equal(game.decision?.kind, 'ecazBattleLead');
  return { game, ecaz, ally, opponent, territory, location, ecazForces };
}

/** Resolve only existing native counter windows, never create one. */
export function allowEcazOccupyResponses(state: Game): Game {
  let game = state;
  for (let attempt = 0; attempt < 100 && game.response; attempt++)
    game = applyAction(game, game.players.find(p => !game.response!.passed.includes(p.id))!.id,
      { type: 'passResponse' });
  assert.equal(game.response, null);
  return game;
}
export function chooseEcazOccupyLead(fixture: EcazOccupyFixture, lead: 'ecaz' | 'ally'): Game {
  const decision = fixture.game.decision;
  assert.ok(decision?.kind === 'ecazBattleLead', 'Only the native Ecaz lead decision may select this plan owner.');
  return applyAction(fixture.game, fixture.ecaz,
    { type: 'decision', event: decision.event, lead: lead === 'ecaz' ? fixture.ecaz : fixture.ally });
}
export function cancelEcazOccupy(fixture: EcazOccupyFixture, lead: 'ecaz' | 'ally', bg = false): Game {
  let game = fixture.game;
  const card = stageEcazOccupyCard(game, fixture.opponent,
    c => bg ? c.kind === 'worthless' : c.effect === 'karama');
  game = chooseEcazOccupyLead({ ...fixture, game }, lead);
  assert.equal(game.response?.kind, 'ecazOccupy');
  return applyAction(game, fixture.opponent, { type: 'card', mode: 'cancel', card });
}
export function openEcazOccupyPlans(state: Game): Game {
  let game = allowEcazOccupyResponses(state);
  for (let attempt = 0; attempt < 20 && game.battle?.preparation; attempt++) {
    game = applyAction(game, game.battle.preparation.owner, { type: 'declineBattlePower' });
    game = allowEcazOccupyResponses(game);
  }
  assert.ok(game.battle && !game.battle.preparation && !game.decision);
  return game;
}
export function ecazOccupyTerritoryForces(game: Game, player: string, territory: string): number {
  return Object.entries(game.players.find(p => p.id === player)!.forces)
    .filter(([key]) => splitLocation(key).territory === territory).reduce((sum, [, n]) => sum + n, 0);
}
