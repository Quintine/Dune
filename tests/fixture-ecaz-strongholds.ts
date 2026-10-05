import assert from 'node:assert/strict';
import { applyAction, createGame, initializeDiscoveryGameForAudit, initializeStrongholdFactionsGameForAudit, joinGame, newPlayer,
  viewGame, type Game } from '../game/engine';
import { territory } from '../game/board';
import { createStrongholdCards, STRONGHOLD_CARDS, type StrongholdId } from '../game/stronghold-cards';
import { finishEcazOccupySetup, stageEcazOccupyCard } from './fixture-ecaz-occupy';
import { nextStrongholdFactionsNativeStep, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { createTechTokens } from '../game/tech-tokens';

export type EcazStrongholdOptions = {
  /** Ready authenticated lobby, or its original fresh native setup. Seats are never replaced. */
  initial?: Game;
  kind?: Exclude<StrongholdId, 'hidden_mobile_stronghold'>;
  ecazForces?: number;
  allyForces?: number;
  opponentForces?: number;
  discoveries?: boolean;
  tech?: boolean;
};
export type EcazStrongholdFixture = {
  initial: Game; afterSetup: Game; beforeMentat: Game; mentatStep: StrongholdFactionsNativeStep;
  afterMentat: Game; beforeBattle: Game; game: Game;
  ecaz: string; ally: string; opponent: string; territory: EcazStrongholdOptions['kind'] & string;
  location: string; ecazForces: number; allyForces: number; staging: string[];
};
export const ecazStrongholdSeat = (game: Game, actor: string) => {
  const player = game.players.find(p => p.id === actor);
  assert.ok(player, 'Every actor retains its originally admitted identity.');
  return player;
};
const clean = (game: Game) => !game.response && !game.phaseOpening && !game.decision;
export function nextEcazStronghold(game: Game): Game {
  const next = nextStrongholdFactionsNativeStep(game);
  assert.ok(next, 'A native pending plan requires the actual selected plan owner.');
  return applyAction(game, next.actor, next.action);
}
export function advanceEcazStronghold(game: Game, predicate: (game: Game) => boolean): Game {
  for (let attempt = 0; attempt < 1800; attempt++) {
    if (predicate(game)) return game;
    assert.equal(game.status, 'playing');
    game = nextEcazStronghold(game);
  }
  throw Error('Original Ecaz/Stronghold chronology did not reach its boundary.');
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
  }
}
function place(game: Game, owner: string, location: string, count: number): void {
  const player = ecazStrongholdSeat(game, owner);
  assert.ok(Number.isSafeInteger(count) && count >= 0 && count <= player.reserves);
  player.reserves -= count;
  if (count) player.forces[location] = (player.forces[location] ?? 0) + count;
}
function orderBlow(game: Game, worm: boolean, position: number): void {
  const at = game.spiceDeck.findIndex((card, i) => i >= position && (worm
    ? 'worm' in card && !card.greatMaker && !card.suppressed
    : 'territory' in card));
  assert.ok(at >= position, 'Only an actual unplayed Spice Card may be ordered.');
  game.spiceDeck.splice(position, 0, game.spiceDeck.splice(at, 1)[0]);
}
/** Determinism is limited to the original native shuffle, never a saved deal. */
function initialize(game: Game, discoveries: boolean): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array);
    new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try {
    if (discoveries) {
      game.discoveryEnabled = true;
      game.strongholdCards ??= createStrongholdCards();
      return initializeDiscoveryGameForAudit(game);
    }
    return initializeStrongholdFactionsGameForAudit(game);
  }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Genuine Advanced E3 setup and reciprocal Nexus alliance. Controlled physical
 * board relocations follow setup; no bank grants, phase assignments, ownership
 * assignments, replaced seats, manufactured plans or battle receipts. */
export function ecazStrongholdFixture(options: EcazStrongholdOptions = {}): EcazStrongholdFixture {
  const kind = options.kind ?? 'arrakeen';
  const location = `${kind}:${territory(kind).sectors[0]}`;
  const ecazForces = options.ecazForces ?? 5, allyForces = options.allyForces ?? 4;
  const staging: string[] = [];
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0);
    assert.equal(game.advanced, true);
    assert.deepEqual(game.expansions, ['ecaz']);
  } else {
    game = createGame('ECAZSTRONGHOLDS', newPlayer('ecaz', 'Ecaz', 'ecaz'), true, ['ecaz']);
    joinGame(game, newPlayer('guild', 'Guild', 'guild'));
    joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
    // Original printed seats put the opposing Emperor first at the later storm.
    for (const [actor, position] of [['ecaz', 6], ['guild', 4], ['emperor', 5]] as const)
      if (viewGame(game, actor).playerPositions[actor] !== position)
        game = applyAction(game, actor, { type: 'seatPosition', position });
  }
  const ecaz = game.players.find(p => p.faction === 'ecaz')?.id;
  const ally = game.players.find(p => p.faction === 'guild')?.id;
  const opponent = game.players.find(p => p.faction === 'emperor')?.id;
  assert.ok(ecaz && ally && opponent && game.players.length === 3,
    'The original native seats must be Ecaz, Guild and Emperor.');
  if (game.status === 'lobby') {
    for (const player of game.players) if (!player.ready) game = applyAction(game, player.id, { type: 'ready' });
    if (options.tech && !game.techTokens) game.techTokens = createTechTokens();
    game = initialize(game, options.discoveries === true);
  }
  const initial = structuredClone(game);
  assert.equal(game.strongholdCards!.claimedTurn, 0);
  assert.deepEqual(Object.keys(game.strongholdCards!.owners).sort(), STRONGHOLD_CARDS.map(c => c.id).sort());
  assert.ok(Object.values(game.strongholdCards!.owners).every(owner => owner === null));
  game = finishEcazOccupySetup(game);
  const afterSetup = structuredClone(game);
  reserveBoard(game);
  staging.push('After genuine setup: return every physical board counter to its own reserves; preserve native wallets, cards, leaders and identities.');
  orderBlow(game, false, 0); orderBlow(game, false, 1);
  staging.push('Order only remaining physical Spice Cards: no turn-one worm, then a turn-two worm followed by real blows.');
  // Native first Storm dials keep both subsequent 1..6 Storm Cards away from
  // this printed battle sector, without replacing a storm field or source.
  const sector = territory(kind).sectors[0];
  const distance = sector <= 11 ? sector + 1 : 0;
  const dials = new Map(game.stormDialers.map((id, index) => [id, index === 0 ? Math.min(6, distance) : Math.max(0, distance - 6)]));
  for (let attempt = 0; !(game.turn === 2 && game.phase === 0 && clean(game)) && attempt < 1800; attempt++) {
    const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
    if (next.action.type === 'stormDial') next.action.amount = dials.get(next.actor) ?? 0;
    game = applyAction(game, next.actor, next.action);
  }
  assert.equal(game.turn, 2);
  orderBlow(game, true, 0); orderBlow(game, false, 1); orderBlow(game, false, 2);
  game = advanceEcazStronghold(game, g => g.phase === 1 && !!g.nexus && clean(g) && !g.spiceWindow && !g.spiceResolution);
  game = applyAction(game, ecaz, { type: 'alliance', target: ally });
  game = applyAction(game, ally, { type: 'alliance', target: ecaz });
  assert.equal(ecazStrongholdSeat(game, ecaz).ally, ally);
  assert.equal(ecazStrongholdSeat(game, ally).ally, ecaz);
  game = advanceEcazStronghold(game, g => g.phase === 8 && clean(g));
  reserveBoard(game);
  place(game, ecaz, location, 1); place(game, ally, location, 1);
  staging.push(`Before real turn-two END Mentat: conserve one Ecaz and one reciprocal allied Guild counter in ${kind}; leave every other stronghold uncontrolled.`);
  let beforeMentat: Game | undefined, mentatStep: StrongholdFactionsNativeStep | undefined;
  for (let attempt = 0; game.turn === 2 && attempt < 200; attempt++) {
    const next = nextStrongholdFactionsNativeStep(game); assert.ok(next);
    const before = structuredClone(game);
    game = applyAction(game, next.actor, next.action);
    if (game.turn === 3) { beforeMentat = before; mentatStep = next; }
  }
  assert.ok(beforeMentat && mentatStep);
  assert.equal(game.strongholdCards!.owners[kind], ecaz);
  assert.equal(game.strongholdCards!.claimedTurn, 2);
  const afterMentat = structuredClone(game);
  orderBlow(game, false, 0); orderBlow(game, false, 1);
  game = advanceEcazStronghold(game, g => g.phase === 5 && clean(g));
  reserveBoard(game);
  place(game, ecaz, location, ecazForces); place(game, ally, location, allyForces);
  place(game, opponent, location, options.opponentForces ?? 8);
  staging.push(`Before original movement completion: conserved ${ecazForces} Ecaz, ${allyForces} Guild and ${options.opponentForces ?? 8} Emperor counters at ${kind}; no shipment fee or bank income is fabricated.`);
  const beforeCards = new Set([...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)].map(c => c.id));
  stageEcazOccupyCard(game, opponent, c => c.effect === 'karama');
  staging.push('Conserved canonical Karama transfer from existing physical deck/hand custody to Emperor, exposing the actual Occupy counter window.');
  assert.deepEqual(new Set([...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand)].map(c => c.id)), beforeCards);
  game = advanceEcazStronghold(game, g => g.phase === 6 && clean(g));
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === kind);
  assert.ok(choice, 'Actual combined armies must be admitted by original chooseBattle.');
  game = applyAction(game, choice.chooser, { type: 'chooseBattle', territory: kind,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
  assert.equal(game.decision?.kind, 'ecazBattleLead');
  return { initial, afterSetup, beforeMentat, mentatStep, afterMentat, beforeBattle, game,
    ecaz, ally, opponent, territory: kind, location, ecazForces, allyForces, staging };
}
export function openEcazStronghold(fixture: EcazStrongholdFixture, lead: 'ecaz' | 'ally'): Game {
  let game = fixture.game;
  const decision = game.decision;
  assert.ok(decision?.kind === 'ecazBattleLead');
  game = applyAction(game, fixture.ecaz, { type: 'decision', event: decision.event,
    lead: lead === 'ecaz' ? fixture.ecaz : fixture.ally });
  return advanceEcazStronghold(game, g => !!g.battle && !g.battle.preparation &&
    (!g.battle.preLeader || g.battle.preLeader.closed) && clean(g));
}
export function finishEcazStronghold(game: Game): Game {
  return advanceEcazStronghold(game, g => !g.battle && clean(g) && !g.pendingTreacheryDiscard);
}
