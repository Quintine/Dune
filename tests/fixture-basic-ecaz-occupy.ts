import assert from 'node:assert/strict';
import { applyAction, createGame, initializeEcazOccupyGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import { TERRITORIES, location as locationKey } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { advanceToNextStorm } from './fixture-advanced-source';
import { finishEcazOccupySetup, settleEcazOccupyArrival, stageEcazOccupyCard,
  type EcazOccupyFixture } from './fixture-ecaz-occupy';

export type BasicEcazOccupyOptions = {
  /** Existing authenticated ready lobby; never recreate seats or ready it again. */
  initial?: Game;
  ecazForces?: number;
  allyFaction?: 'guild' | 'emperor' | 'fremen';
  opponentFaction?: 'guild' | 'emperor' | 'fremen';
  allyForces?: number;
  territory?: string;
  /** Odd rule probes stop before the native chooseBattle commitment. */
  chooseBattle?: boolean;
};

function step(game: Game): Game {
  if (game.response) return applyAction(game,
    game.players.find(p => !game.response!.passed.includes(p.id))!.id, { type: 'passResponse' });
  if (game.phaseOpening) return applyAction(game,
    game.players.find(p => !game.phaseOpening!.passed.includes(p.id))!.id, { type: 'ready' });
  if (game.decision?.kind === 'ecazPlacement')
    return applyAction(game, game.decision.player, { type: 'decision', decline: true });
  if (game.phase === 0 && !game.decision && game.stormPending === null) {
    const dialer = game.stormDialers.find(id => game.stormDials[id] === undefined)!;
    return applyAction(game, dialer, { type: 'stormDial', amount: game.turn === 1 ? 0 : 1 });
  }
  if (game.phase === 3 && game.auction && !game.decision)
    return applyAction(game, game.auction.active, { type: 'passBid' });
  if (game.decision?.kind === 'wormRide')
    return applyAction(game, game.decision.player, { type: 'decision', accept: false });
  if (game.decision?.kind === 'guildShipment')
    return applyAction(game, game.decision.player, { type: 'decision', allow: true });
  for (const player of game.players) {
    const view = viewGame(game, player.id);
    view.players.find(p => p.id === player.id)!.bot = 'Easy';
    const candidates = botActions(view);
    const action = candidates.find(a => a.type === 'ready') ?? candidates[0];
    if (action) return applyAction(game, player.id, action);
  }
  throw new Error(`No native Basic action at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
}

function orderBlow(game: Game, worm: boolean, position: number): void {
  const index = game.spiceDeck.findIndex((card, i) => i >= position &&
    (worm ? 'worm' in card && !card.greatMaker && !card.suppressed :
      'territory' in card && !['the_great_flat', 'arrakeen'].includes(card.territory)));
  assert.ok(index >= position, 'Reorder only original unplayed Spice Cards.');
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
}

export function basicEcazOccupyBattleAction(fixture: EcazOccupyFixture): { actor: string; action: Action } {
  const game = fixture.game;
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === fixture.territory);
  assert.ok(choice, 'The physical coalition and rival must produce one native battle choice.');
  return { actor: choice.chooser, action: { type: 'chooseBattle', territory: fixture.territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
}

/** Genuine Basic native deal, original Storm/Blow/Nexus/alliance and shipments.
 * Only physical board forces and unplayed card order are controlled after setup.
 * Native wallets, phases, reciprocal alliance, plans and receipts remain original. */
export function basicEcazOccupyFixture(options: BasicEcazOccupyOptions = {}): EcazOccupyFixture {
  const allyFaction = options.allyFaction ?? 'guild';
  const opponentFaction = options.opponentFaction ?? (allyFaction === 'guild' ? 'emperor' : 'guild');
  assert.notEqual(allyFaction, opponentFaction);
  let setup: Game;
  if (options.initial) {
    setup = structuredClone(options.initial);
  } else {
    const roster = ['ecaz', allyFaction, opponentFaction] as const;
    setup = createGame('BASICECAZOCCUPY', newPlayer('ecaz', 'ecaz', 'ecaz'), false, ['ecaz']);
    for (const faction of roster.slice(1)) joinGame(setup, newPlayer(faction, faction, faction));
    for (let i = roster.length - 1; i >= 0; i--)
      if (viewGame(setup, roster[i]).playerPositions[roster[i]] !== i + 3)
        setup = applyAction(setup, roster[i], { type: 'seatPosition', position: i + 3 });
    for (const player of setup.players) setup = applyAction(setup, player.id, { type: 'ready' });
  }
  setup = initializeEcazOccupyGameForAudit(setup);
  assert.equal(setup.advanced, false);
  assert.deepEqual(setup.expansions, ['ecaz']);
  assert.ok(!setup.ecazTreachery && !setup.leaderSkills && !setup.homeworlds && !setup.nexusCards &&
    !setup.strongholdCards && !setup.techTokens && !setup.discoveryEnabled);
  const ecazSeat = setup.players.find(player => player.faction === 'ecaz');
  const allySeat = setup.players.find(player => player.faction === allyFaction);
  const opponentSeat = setup.players.find(player => player.faction === opponentFaction);
  assert.ok(ecazSeat && allySeat && opponentSeat, 'The actual lobby must contain the requested native factions.');
  const ecaz = ecazSeat.id, ally = allySeat.id, opponent = opponentSeat.id;
  const initial = structuredClone(setup);
  let game = finishEcazOccupySetup(setup);
  const afterSetup = structuredClone(game);
  assert.deepEqual([...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)]
    .map(c => c.id).sort(), treacheryDeck(['ecaz']).map(c => c.id).sort(),
  'The original Basic deal retains the exact Ecaz family deck.');
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0);
      player.elites.forces = {};
    }
  }
  orderBlow(game, false, 0);
  orderBlow(game, false, 1);
  for (let attempt = 0; attempt < 800 && !(game.phase === 5 &&
    !game.phaseOpening && !game.response && !game.decision); attempt++) game = step(game);
  assert.equal(game.phase, 5, 'The first original Basic movement must open.');
  while (game.phase === 5) game = game.response || game.phaseOpening || game.decision
    ? step(game) : applyAction(game, game.active!, { type: 'endMovement' });
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
  assert.ok(allied && game.phase === 5, 'A genuine Basic worm Nexus must form the reciprocal alliance.');
  assert.equal(game.players.find(p => p.id === ecaz)!.ally, ally);
  assert.equal(game.players.find(p => p.id === ally)!.ally, ecaz);
  const territory = options.territory ?? 'the_great_flat';
  const sector = TERRITORIES.find(t => t.id === territory)!.sectors.find(s => s !== game.storm)!;
  assert.ok(sector !== undefined);
  const location = locationKey(territory, sector);
  const ecazForces = options.ecazForces ?? 4;
  // Controlled rival position after the genuine Nexus. Transfer eight original
  // reserve counters without claiming an unaffordable played shipment history.
  const rival = game.players.find(player => player.id === opponent)!;
  assert.ok(rival.reserves >= 8);
  rival.reserves -= 8;
  rival.forces[location] = 8;
  stageEcazOccupyCard(game, opponent, card => card.effect === 'karama');
  while (game.phase === 5) {
    if (game.response || game.phaseOpening || game.decision) { game = step(game); continue; }
    const actor = game.active!;
    if (actor === ecaz || actor === ally) {
      const amount = actor === ecaz ? ecazForces : options.allyForces ?? 4;
      game = settleEcazOccupyArrival(applyAction(game, actor,
        { type: 'ship', territory, sector, amount }));
    }
    game = applyAction(game, actor, { type: 'endMovement' });
  }
  while (game.phaseOpening || game.response || game.decision) game = step(game);
  assert.equal(game.phase, 6);
  const fixture: EcazOccupyFixture = { game, initial, afterSetup, ecaz, ally,
    opponent, territory, location, ecazForces };
  if (options.chooseBattle !== false) {
    const { actor, action } = basicEcazOccupyBattleAction(fixture);
    fixture.game = applyAction(game, actor, action);
    assert.equal(fixture.game.decision?.kind, 'ecazBattleLead');
  }
  return fixture;
}
