import assert from 'node:assert/strict';
import { applyAction, createGame, initializeEcazOccupyGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import type { FactionId } from '../game/catalog';
import type { NoFieldValue } from '../game/richese-no-field';
import { finishEcazOccupySetup, stageEcazOccupyCard } from './fixture-ecaz-occupy';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type EcazOccupyRicheseOptions = {
  allyFaction?: 'richese' | 'ixians' | 'guild';
  opponentFaction?: 'richese' | 'choam' | 'atreides' | 'guild';
  marker?: NoFieldValue;
  richeseReserves?: number;
  mixedRicheseForces?: number;
  ecazForces?: number;
  omitPreview?: boolean;
  /** Original admitted fresh setup with its real authenticated seat identities. */
  initial?: Game;
};
export type EcazOccupyRicheseFixture = {
  initial: Game; afterSetup: Game; beforeBattle: Game; game: Game;
  ecaz: string; ally: string; opponent: string; richese: string;
  territory: string; location: string; ecazForces: number; materialized: number | null;
  staging: string[];
};
export const occupyRicheseSeat = (game: Game, actor: string) => {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player);
  return player;
};
const clean = (game: Game) => !game.response && !game.phaseOpening && !game.decision;
export function nextOccupyRichese(game: Game): Game {
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'richeseAllyOpportunity')
    return applyAction(game, game.decision.player, { type: 'decision', decline: true });
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'faceDance')
    return applyAction(game, game.decision.player, { type: 'decision', reveal: false });
  const next = nextRicheseStrongholdsNativeStep(game);
  assert.ok(next, 'Native continuation must not manufacture a sealed plan.');
  return applyAction(game, next.actor, next.action);
}
function advance(game: Game, predicate: (game: Game) => boolean): Game {
  for (let attempt = 0; attempt < 1600; attempt++) {
    if (predicate(game)) return game;
    game = nextOccupyRichese(game);
  }
  throw Error('Native Occupy/Richese continuation did not reach its boundary.');
}
function orderBlow(game: Game, worm: boolean, position: number): void {
  const at = game.spiceDeck.findIndex((card, i) => i >= position && (worm
    ? 'worm' in card && !card.greatMaker && !card.suppressed
    : 'territory' in card && card.territory !== 'carthag'));
  assert.ok(at >= position);
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
}
function reserveBoard(game: Game): void {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, n) => sum + n, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0);
      player.elites.forces = {};
    }
    if (player.advisors) player.advisors = {};
    player.spice = 30;
  }
}
function place(game: Game, owner: string, location: string, count: number): void {
  const player = occupyRicheseSeat(game, owner);
  assert.ok(Number.isSafeInteger(count) && count >= 0 && count <= player.reserves);
  player.reserves -= count;
  if (count) player.forces[location] = (player.forces[location] ?? 0) + count;
}

/** Real fresh Advanced family deal and natural Nexus alliance. Explicitly
 * controlled conserved board/bank/card staging follows original setup; only
 * native shipment creates the concealed marker, and actual chooseBattle admits
 * the coalition. No phase, faction, alliance, plan or marker is assigned. */
export function ecazOccupyRicheseFixture(options: EcazOccupyRicheseOptions = {}): EcazOccupyRicheseFixture {
  const allyFaction = options.allyFaction ?? 'richese';
  const opponentFaction = options.opponentFaction ?? 'guild';
  assert.notEqual(allyFaction, opponentFaction);
  const roster: FactionId[] = allyFaction === 'ixians' && opponentFaction === 'choam'
    ? ['ecaz', 'ixians', 'choam', 'richese', 'moritani', 'tleilaxu']
    : [...new Set<FactionId>(['ecaz', allyFaction, opponentFaction, 'richese', 'choam'])];
  const expansions: Game['expansions'] = ['ecaz', 'choam', ...(roster.includes('ixians') ? ['ix'] as const : [])];
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.equal(game.status, 'setup');
    assert.equal(game.turn, 1);
    assert.equal(game.advanced, true);
    assert.equal(game.ecazOccupyPreview, true);
    assert.deepEqual(game.players.map(p => p.faction), roster);
    assert.deepEqual(game.expansions, expansions);
  } else {
    game = createGame('ECAZOCCUPYRICHESE', newPlayer(roster[0], roster[0], roster[0]), true, expansions);
    for (const faction of roster.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
    for (let i = roster.length - 1; i >= 0; i--) {
      const position = i + 1;
      if (viewGame(game, roster[i]).playerPositions[roster[i]] !== position)
        game = applyAction(game, roster[i], { type: 'seatPosition', position });
    }
    for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
    game = initializeEcazOccupyGameForAudit(game);
  }
  const initial = structuredClone(game);
  game = finishEcazOccupySetup(game);
  const afterSetup = structuredClone(game);
  const factionSeat = (faction: FactionId) => {
    const player = game.players.find(p => p.faction === faction);
    assert.ok(player);
    return player.id;
  };
  const ecaz = factionSeat('ecaz'), ally = factionSeat(allyFaction);
  const opponent = factionSeat(opponentFaction), richese = factionSeat('richese');
  reserveBoard(game);
  const staging = ['After original faction setup: return each physical board counter to its own reserves and stage thirty-spice bank balances.'];
  orderBlow(game, false, 0); orderBlow(game, false, 1);
  game = advance(game, g => g.turn === 2 && g.phase === 0 && clean(g));
  orderBlow(game, true, 0); orderBlow(game, false, 1); orderBlow(game, false, 2);
  game = advance(game, g => g.phase === 1 && !!g.nexus && !g.spiceWindow && !g.spiceResolution && clean(g));
  game = applyAction(game, ecaz, { type: 'alliance', target: ally });
  game = applyAction(game, ally, { type: 'alliance', target: ecaz });
  game = advance(game, g => g.phase === 5 && clean(g));
  reserveBoard(game);
  const battleTerritory = 'carthag';
  const sector = territory(battleTerritory).sectors[0];
  const location = `${battleTerritory}:${sector}`;
  const ecazForces = options.ecazForces ?? 5;
  for (const token of game.ecazAmbassadors?.tokens ?? []) {
    if (token.zone !== 'placed' || token.location !== battleTerritory) continue;
    token.zone = 'supply';
    token.location = null;
    staging.push('Return the actual Carthag Ambassador to its existing supply for this clean controlled battle position.');
  }
  place(game, ecaz, location, ecazForces);
  if (ally !== richese || options.marker === undefined) place(game, ally, location, 4);
  if (opponent !== richese || options.marker === undefined) place(game, opponent, location, 8);
  const mixed = options.mixedRicheseForces ?? 0;
  if (options.marker !== undefined) {
    assert.ok(ally === richese || opponent === richese);
    const reserves = options.richeseReserves ?? 20;
    assert.ok(Number.isSafeInteger(reserves) && reserves >= 0 && reserves + mixed <= 20);
    place(game, richese, 'polar_sink:0', occupyRicheseSeat(game, richese).reserves - reserves - mixed);
    place(game, richese, location, mixed);
    staging.push(`Conserve Richese counters: ${mixed} ordinary battle counters, ${reserves} reserves, remainder in Polar Sink; native No-Field ${options.marker} shipment remains concealed.`);
  }
  staging.push(`Conserve ${ecazForces} Ecaz counters and ordinary allied/opposing counters in Carthag; original Nexus alliance is unchanged.`);
  stageEcazOccupyCard(game, opponent, card => card.effect === 'karama');
  let shipped = false;
  while (game.phase === 5) {
    if (!clean(game)) { game = nextOccupyRichese(game); continue; }
    const actor = game.active!;
    if (actor === richese && options.marker !== undefined && !shipped) {
      const player = occupyRicheseSeat(game, richese);
      const token = player.noField!.tokens.find(t => t.value === options.marker)!;
      assert.ok(token);
      const action: Action = { type: 'ship', territory: battleTerritory, sector,
        noField: token.id, event: player.noFieldEvent };
      game = applyAction(game, richese, action);
      game = advance(game, clean);
      shipped = true;
    }
    game = applyAction(game, actor, { type: 'endMovement' });
  }
  game = advance(game, clean);
  if (options.omitPreview) {
    delete game.ecazOccupyPreview;
    staging.push('Before actual battle admission: omit the audit label; keep the native original setup inventory and rule composition unchanged.');
  }
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === battleTerritory);
  assert.ok(choice, 'Concealed zero remains actual native battle presence.');
  // Mixed ownership fixtures stop before admission so rejection is testable.
  if (!mixed) game = applyAction(game, choice.chooser, { type: 'chooseBattle', territory: battleTerritory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
  return { initial, afterSetup, beforeBattle, game, ecaz, ally, opponent, richese,
    territory: battleTerritory, location, ecazForces,
    materialized: options.marker === undefined ? null : Math.min(options.marker, options.richeseReserves ?? 20), staging };
}
export function openOccupyRichese(fixture: EcazOccupyRicheseFixture, lead: 'ecaz' | 'ally', cancel = false): Game {
  let game = fixture.game;
  assert.equal(game.decision?.kind, 'ecazBattleLead');
  game = applyAction(game, fixture.ecaz, { type: 'decision', event: game.decision!.event,
    lead: lead === 'ecaz' ? fixture.ecaz : fixture.ally });
  if (cancel) {
    assert.equal(game.response?.kind, 'ecazOccupy');
    const card = occupyRicheseSeat(game, fixture.opponent).hand.find(c => c.effect === 'karama')!;
    game = applyAction(game, fixture.opponent, { type: 'card', mode: 'cancel', card: card.id });
  }
  for (let attempt = 0; attempt < 100; attempt++) {
    if (game.battle && !game.battle.preparation && (!game.battle.preLeader || game.battle.preLeader.closed) && clean(game)) return game;
    game = nextOccupyRichese(game);
  }
  throw Error('Original Richese preleader and Occupy responses did not finish.');
}
export function finishOccupyRichese(state: Game): Game {
  let game = state;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (!game.battle && clean(game) && !game.pendingTreacheryDiscard) return game;
    game = nextOccupyRichese(game);
  }
  throw Error('Native Occupy/Richese reveal aftermath did not finish.');
}
