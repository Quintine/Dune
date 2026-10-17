import assert from 'node:assert/strict';
import {
  applyAction, createGame, initializeEcazTreacheryGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game,
} from '../game/engine';
import { MOBILE_LOCATION, territory } from '../game/board';
import { isAuditorLeader, treacheryDeck } from '../game/cards';
import { ecazTreacheryCards } from '../game/ecaz-cards';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { traitorDeck } from '../game/traitors';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type NativeFamilyReinforcementsStep = { actor: string; action: Action };
export type NativeFamilyReinforcementsOptions = {
  faction?: 'ixians' | 'tleilaxu' | 'choam';
  advanced?: boolean;
  expansions?: ('ix' | 'choam' | 'ecaz')[];
  slot?: 'weapon' | 'defense';
  outcome?: 'winner' | 'loser' | 'traitor' | 'explosion';
  /** Nine legally paid suboids leave one suboid and four cyborgs in reserve. */
  mixedFee?: boolean;
  initial?: Game;
  seatIds?: [string, string];
};
export type NativeFamilyReinforcementsFixture = {
  initial: Game;
  afterSetup: Game;
  beforeBattle: Game;
  game: Game;
  owner: string;
  opponent: string;
  territory: string;
  location: string;
  shipments: { before: Game; step: NativeFamilyReinforcementsStep; after: Game }[];
  battleStep: NativeFamilyReinforcementsStep;
  planActions: [NativeFamilyReinforcementsStep, NativeFamilyReinforcementsStep];
  nativeSteps: NativeFamilyReinforcementsStep[];
  staging: string[];
  fee: { normal: number; elite: number };
};
export function nativeFamilyReinforcementsPlayer(game: Game, actor: string) {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
}
export const nativeFamilyReinforcementsClean = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;

/** Original native controls are consumed, not removed: HMS placement, Face
 * Dancers, cyborg substitution and Auditor inspection remain ordinary decisions. */
export function nextNativeFamilyReinforcementsStep(game: Game): NativeFamilyReinforcementsStep | null {
  if (!game.phaseOpening && !game.response && game.decision?.kind === 'faceDance')
    return { actor: game.decision.player, action: { type: 'decision', reveal: false } };
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceNativeFamilyReinforcements(state: Game, until: (game: Game) => boolean,
  actions: NativeFamilyReinforcementsStep[] = []): Game {
  let game = state;
  for (let n = 0; n < 600; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextNativeFamilyReinforcementsStep(game);
    assert.ok(step, 'Seal the actual human Battle Plans before continuing');
    actions.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  throw Error('Native family programme did not reach its requested boundary');
}
function initialize(game: Game): Game {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    assert.ok(array); new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255); return array;
  };
  try { return initializeEcazTreacheryGameForAudit(game); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function exchangeTraitor(game: Game, actor: string, leader: string, staging: string[]) {
  const player = nativeFamilyReinforcementsPlayer(game, actor);
  if (player.traitors.includes(leader)) return;
  const returned = player.traitors[0]; assert.ok(returned);
  const at = game.traitorReserve!.indexOf(leader);
  const donor = game.players.find(p => p.traitors.includes(leader));
  const dancer = game.players.flatMap(p => p.faceDancers ?? []).find(c => c.leader === leader && !c.revealed);
  assert.ok(at >= 0 || donor || dancer);
  if (at >= 0) game.traitorReserve![at] = returned;
  else if (donor) donor.traitors[donor.traitors.indexOf(leader)] = returned;
  else dancer!.leader = returned;
  player.traitors[0] = leader;
  staging.push(`Conserved original Traitor ${leader} exchanged for ${returned} into ${actor}'s hand.`);
}

/** Fresh selected-family lobby → independent-card initializer → every original
 * setup choice → real phase readiness → paid native shipments → chooseBattle.
 * Only conserved hands/Traitors and unopened first-Blow card positions are
 * staged. No force, wallet, phase, history or preview marker is assigned. */
export function createNativeFamilyReinforcementsFixture(
  options: NativeFamilyReinforcementsOptions = {},
): NativeFamilyReinforcementsFixture {
  const faction = options.faction ?? 'ixians', advanced = options.advanced ?? options.initial?.advanced ?? false;
  const expansions = options.expansions ?? options.initial?.expansions ?? [faction === 'choam' ? 'choam' : 'ix'];
  assert.ok(expansions.length > 0 && expansions.every(id => id === 'ix' || id === 'choam' || id === 'ecaz'));
  assert.equal(new Set(expansions).size, expansions.length);
  assert.ok(expansions.includes(faction === 'choam' ? 'choam' : 'ix'));
  assert.ok(!options.mixedFee || faction === 'ixians');
  const ids = options.seatIds ?? [faction, 'guild'];
  let game = options.initial ? structuredClone(options.initial) :
    createGame('NATIVEFAMILYREINFORCEMENTS', newPlayer(ids[0], faction, faction), advanced, expansions);
  if (!options.initial) joinGame(game, newPlayer(ids[1], 'Guild', 'guild'));
  assert.equal(game.status, 'lobby', 'Supply the original undealt native lobby');
  assert.equal(game.advanced, advanced);
  assert.deepEqual([...game.expansions].sort(), [...expansions].sort());
  assert.deepEqual(game.players.map(p => p.faction).sort(), [faction, 'guild'].sort());
  assert.ok(!game.ecazTreachery && !game.homeworlds && !game.nexusCards && !game.leaderSkills &&
    !game.techTokens && !game.strongholdCards && !game.discoveryEnabled && !game.discoveries);
  const owner = game.players.find(p => p.faction === faction)!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  const nativeSteps: NativeFamilyReinforcementsStep[] = [];
  const act = (step: NativeFamilyReinforcementsStep) => {
    nativeSteps.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  };
  for (const p of game.players) if (!p.ready) act({ actor: p.id, action: { type: 'ready' } });
  const initial = structuredClone(game);
  // This initializer selects independent cards before native setup and deals
  // exactly the selected physical inventory; never retrofit a module flag.
  game = initialize(game);
  game = advanceNativeFamilyReinforcements(game, g => g.status === 'playing', nativeSteps);
  const afterSetup = structuredClone(game);
  const staging = ['Independent cards selected by the original initializer before native setup; original HMS army, Face Dancers and Advanced Auditor retained.'];
  for (let i = 0; i < (advanced ? 4 : 2); i++) {
    const at = game.spiceDeck.findIndex((c, index) => index >= i && 'territory' in c && !c.discovery);
    assert.ok(at >= i); game.spiceDeck.splice(i, 0, game.spiceDeck.splice(at, 1)[0]);
  }
  staging.push('Position unopened original non-worm first-Blow cards; no phase or draw is assigned.');
  const reach = (until: (g: Game) => boolean) => {
    game = advanceNativeFamilyReinforcements(game, until, nativeSteps);
  };
  const kind = 'arrakeen', sector = territory(kind).sectors[0], location = `${kind}:${sector}`;
  const shipments: NativeFamilyReinforcementsFixture['shipments'] = [];
  const waiting = new Set([owner, opponent]);
  reach(g => g.phase === 5 && nativeFamilyReinforcementsClean(g));
  while (waiting.size) {
    const actor = game.active!; assert.ok(waiting.has(actor));
    const amount = actor === owner && options.mixedFee ? 9 : 3;
    const elite = actor === owner && faction === 'ixians' && !options.mixedFee ? 2 : 0;
    const step: NativeFamilyReinforcementsStep = { actor, action: {
      type: 'ship', territory: kind, sector, amount, elite, allyPayment: 0,
    } };
    const before = structuredClone(game); act(step); reach(nativeFamilyReinforcementsClean);
    shipments.push({ before, step, after: structuredClone(game) });
    waiting.delete(actor); act({ actor, action: { type: 'endMovement' } });
    reach(g => (g.phase === 5 || g.phase === 6) && nativeFamilyReinforcementsClean(g));
  }
  reach(g => g.phase === 6 && nativeFamilyReinforcementsClean(g));
  for (const p of game.players) game.deck.push(...p.hand.splice(0));
  const take = (actor: string, id: string) => {
    const at = game.deck.findIndex(c => c.id === id); assert.ok(at >= 0);
    const player = nativeFamilyReinforcementsPlayer(game, actor);
    assert.ok(player.hand.length < (player.faction === 'choam' ? 5 : 4));
    player.hand.push(game.deck.splice(at, 1)[0]); return id;
  };
  take(owner, REINFORCEMENTS_CARD);
  if (faction === 'choam' && advanced) {
    take(opponent, game.deck.find(c => c.kind === 'projectile')!.id);
    staging.push('Conserve one unused opposing projectile card so the original Advanced Auditor inspection control has a real target.');
  }
  const outcome = options.outcome ?? 'winner';
  let laser: string | null = null, shield: string | null = null;
  if (outcome === 'explosion') {
    laser = take(opponent, game.deck.find(c => c.kind === 'lasgun')!.id);
    shield = take(opponent, game.deck.find(c => c.kind === 'shield')!.id);
  }
  staging.push('Return original hands to undealt stock and conserve physical Reinforcements (plus opposing Lasgun/Shield only for explosion) into legal hands.');
  const own = nativeFamilyReinforcementsPlayer(game, owner);
  const ownLeader = faction === 'ixians' ? own.leaders.find(l => l.strength === (options.mixedFee ? 4 : 1))!
    : faction === 'choam' && advanced ? own.leaders.find(isAuditorLeader)!
    : own.leaders.find(l => l.strength === 2)!;
  const otherLeader = nativeFamilyReinforcementsPlayer(game, opponent).leaders.find(l => l.strength === 5)!;
  assert.ok(ownLeader && otherLeader);
  if (faction === 'tleilaxu' && outcome === 'loser' &&
    !own.faceDancers!.some(c => c.leader === otherLeader.id)) {
    const dancer = own.faceDancers![0], returned = dancer.leader;
    const at = game.traitorReserve!.indexOf(otherLeader.id);
    const donor = game.players.find(p => p.traitors.includes(otherLeader.id));
    assert.ok(at >= 0 || donor);
    if (at >= 0) game.traitorReserve![at] = returned;
    else donor!.traitors[donor!.traitors.indexOf(otherLeader.id)] = returned;
    dancer.leader = otherLeader.id;
    staging.push(`Conserved original Face Dancer ${otherLeader.id} exchanged for ${returned}; the actual post-victory native window remains available.`);
  }
  if (outcome === 'traitor') exchangeTraitor(game, opponent, ownLeader.id, staging);
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(c => c.territory === kind); assert.ok(choice);
  const battleStep: NativeFamilyReinforcementsStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: kind,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker,
  } };
  act(battleStep);
  reach(g => !!g.battle && nativeFamilyReinforcementsClean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false);
  const slot = options.slot ?? 'weapon';
  const dial = faction === 'ixians' ? options.mixedFee ? 0.5 : 2.5 : 2;
  const support = advanced ? faction === 'ixians' ? options.mixedFee ? 0 : 1 : 2 : 0;
  const planActions: NativeFamilyReinforcementsFixture['planActions'] = [
    { actor: owner, action: { type: 'battlePlan', dial, support, leader: ownLeader.id,
      weapon: slot === 'weapon' ? REINFORCEMENTS_CARD : null,
      defense: slot === 'defense' ? REINFORCEMENTS_CARD : null } },
    { actor: opponent, action: { type: 'battlePlan', dial: outcome === 'loser' ? 3 : 0,
      support: outcome === 'loser' && advanced ? 3 : 0, leader: otherLeader.id,
      weapon: laser, defense: shield } },
  ];
  const normal = Math.min(3, own.reserves - (own.elites?.reserves ?? 0));
  const fee = { normal, elite: 3 - normal };
  assertNativeFamilyReinforcementsInventory(game);
  return { initial, afterSetup, beforeBattle, game, owner, opponent, territory: kind, location,
    shipments, battleStep, planActions, nativeSteps, staging, fee };
}
export function sealNativeFamilyReinforcementsPlan(state: Game, step: NativeFamilyReinforcementsStep): Game {
  return advanceNativeFamilyReinforcements(applyAction(state, step.actor, step.action), g =>
    !g.response && !g.phaseOpening && (!g.decision || g.decision.kind !== 'fullPlanOffer'));
}
export function revealNativeFamilyReinforcementsBattle(fixture: NativeFamilyReinforcementsFixture): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.planActions) game = sealNativeFamilyReinforcementsPlan(game, step);
  assert.ok(game.battle?.revealed); return game;
}
export function finishNativeFamilyReinforcementsBattle(state: Game, options: {
  callers?: string[];
  actions?: NativeFamilyReinforcementsStep[];
} = {}): Game {
  let game = state;
  for (let n = 0; n < 240; n++) {
    if (!game.battle && nativeFamilyReinforcementsClean(game)) return game;
    const step = nextNativeFamilyReinforcementsStep(game); assert.ok(step);
    if (step.action.type === 'traitorCall') step.action.call = options.callers?.includes(step.actor) ?? false;
    options.actions?.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  throw Error('Native Reinforcements aftermath did not finish');
}
export function assertNativeFamilyReinforcementsInventory(game: Game): void {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? [])];
  assert.deepEqual(cards.map(c => c.id).sort(),
    [...treacheryDeck(game.expansions), ...ecazTreacheryCards()].map(c => c.id).sort());
  assert.equal(cards.length, game.expansions.includes('ix') ? 50 : 38);
  assert.deepEqual([...game.traitorReserve!, ...game.players.flatMap(p =>
    [...p.traitors, ...p.traitorChoices, ...(p.faceDancers ?? []).map(c => c.leader)])].sort(),
  traitorDeck(game.players, game.expansions.includes('ix')).sort());
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20);
    assert.ok(p.hand.length <= (p.faction === 'choam' ? 5 : 4));
    if (p.elites) assert.equal(p.elites.reserves + p.elites.tanks +
      Object.values(p.elites.forces).reduce((a, b) => a + b, 0), p.faction === 'ixians' ? 7 : p.faction === 'emperor' ? 5 : 3);
    if (p.faction === 'ixians') {
      assert.equal(p.forces[MOBILE_LOCATION], 6, 'Original HMS army is never repositioned by the fixture');
      assert.equal(p.elites!.forces[MOBILE_LOCATION], 3);
    }
    if (p.faction === 'tleilaxu') assert.equal(p.faceDancers!.length, 3);
    if (p.faction === 'choam' && game.advanced) assert.ok(p.leaders.some(isAuditorLeader));
  }
}
