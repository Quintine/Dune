import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { treacheryDeck } from '../game/cards';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import { ownedTech } from '../game/tech-tokens';
import { stageEcazOccupyCard } from './fixture-ecaz-occupy';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { actAdvisorPreparation } from './fixture-advisor-preparation';

export type PhaseModuleEcazStep = { actor: string; action: Action };
export const phaseModuleEcazClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.pendingTreacheryDiscard;
export function phaseModuleEcazPlayer(game: Game, actor: string) {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
}
export function phaseModuleEcazInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(!!game.currentAuctionSale)) ?? [])]
    .map(card => card.id).sort();
  assert.deepEqual(cards, treacheryDeck(game.expansions).map(card => card.id).sort());
  assert.equal(new Set(cards).size, cards.length);
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, count) => sum + count, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0), player.faction === 'ixians' ? 7 : 5);
  }
  return cards;
}
export function actPhaseModuleEcaz(game: Game, actor: string, action: Action, actions: PhaseModuleEcazStep[] = []): Game {
  return actAdvisorPreparation(game, actor, action, actions);
}
export function nextPhaseModuleEcazStep(game: Game): PhaseModuleEcazStep | null {
  const next = nextRicheseStrongholdsNativeStep(game);
  if (next?.action.type === 'stormDial' && game.turn === 1) next.action.amount = 0;
  return next;
}
export function advancePhaseModuleEcaz(game: Game, until: (state: Game) => boolean, actions: PhaseModuleEcazStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextPhaseModuleEcazStep(game);
    assert.ok(next, `Supply the actual plan or owned choice at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actPhaseModuleEcaz(game, next.actor, next.action, actions);
  }
  throw Error('The native selected phase-module coalition did not reach its bounded continuation');
}
/** CONTROLLED physical redistribution only; keep original wallets, phases,
 * alliances, native printed subtypes, Tech owners and held-card receipts. */
function reserveBoard(game: Game) {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, count) => sum + count, 0); player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0);
      player.elites.forces = {};
    }
  }
}
function place(game: Game, actor: string, key: string, count: number, elite = 0) {
  const player = phaseModuleEcazPlayer(game, actor);
  assert.ok(player.reserves >= count && (player.elites?.reserves ?? 0) >= elite &&
    player.reserves - (player.elites?.reserves ?? 0) >= count - elite);
  player.reserves -= count; player.forces[key] = count;
  if (elite) { player.elites!.reserves -= elite; player.elites!.forces[key] = elite; }
}
function orderBlow(game: Game, worm: boolean, position: number) {
  const index = game.spiceDeck.findIndex((card, index) => index >= position && (worm
    ? 'worm' in card && !card.greatMaker && !card.suppressed : 'territory' in card && !card.discovery));
  assert.ok(index >= position); game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
}

/** Actual public Ecaz/Ixians/Emperor setup selects all three family decks and
 * Tech, plus Advanced Strongholds. A real worm Nexus forms the alliance; the
 * real end-Mentat checkpoint earns Ecaz's Tabr card. Explicit conserved board
 * and Shield staging is a later coalition supplement, not natural invasion or
 * acquisition evidence. Never stage a wallet, phase, token owner or outcome. */
export function createPhaseModuleEcazFixture(options: { advanced?: boolean; lead?: 'ecaz' | 'ally' } = {}) {
  const advanced = options.advanced ?? false, lead = options.lead ?? 'ecaz';
  const ecaz = 'ecaz', ally = 'ixians', opponent = 'emperor', actor = lead === 'ecaz' ? ecaz : ally;
  let game = createGame('PHASEMODULEECAZ', newPlayer(ecaz, 'Ecaz', 'ecaz'), advanced, ['ix', 'choam', 'ecaz']);
  joinGame(game, newPlayer(ally, 'Ixians', 'ixians')); joinGame(game, newPlayer(opponent, 'Emperor', 'emperor'));
  const actions: PhaseModuleEcazStep[] = [], initial = structuredClone(game);
  const act = (owner: string, action: Action) => { game = actPhaseModuleEcaz(game, owner, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advancePhaseModuleEcaz(game, until, actions); };
  act(ecaz, { type: 'techTokens', enabled: true });
  if (advanced) act(ecaz, { type: 'strongholdCards', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const ready = structuredClone(game);
  act(ecaz, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const started = structuredClone(game);
  reach(state => state.status === 'playing'); const afterSetup = structuredClone(game);
  const originalInventory = phaseModuleEcazInventory(game);
  orderBlow(game, false, 0); orderBlow(game, false, 1);
  reach(state => state.turn === 1 && state.phase === 5 && phaseModuleEcazClean(state));
  const afterFirstStorm = structuredClone(game);
  reserveBoard(game); phaseModuleEcazInventory(game);
  reach(state => state.turn === 2 && state.phase === 0 && phaseModuleEcazClean(state));
  orderBlow(game, true, 0); orderBlow(game, false, 1); orderBlow(game, false, 2);
  reach(state => state.phase === 1 && !!state.nexus && !state.spiceWindow && !state.spiceResolution && phaseModuleEcazClean(state));
  const beforeAlliance = structuredClone(game);
  act(ecaz, { type: 'alliance', target: ally }); act(ally, { type: 'alliance', target: ecaz });
  const afterAlliance = structuredClone(game);
  reach(state => state.turn === 2 && state.phase === 8 && phaseModuleEcazClean(state));
  const kind = 'sietch_tabr', location = `${kind}:${territory(kind).sectors[0]}`;
  reserveBoard(game); place(game, ecaz, location, 1); place(game, ally, location, 1);
  phaseModuleEcazInventory(game);
  let beforeMentat: Game | null = null, mentatStep: PhaseModuleEcazStep | null = null;
  for (let count = 0; game.turn === 2 && count < 200; count++) {
    const next = nextPhaseModuleEcazStep(game); assert.ok(next);
    const before = structuredClone(game);
    game = actPhaseModuleEcaz(game, next.actor, next.action, actions);
    if (game.turn === 3) { beforeMentat = before; mentatStep = next; }
  }
  assert.ok(beforeMentat && mentatStep); const afterMentat = structuredClone(game);
  if (advanced) { assert.equal(game.strongholdCards!.owners[kind], ecaz); assert.equal(game.strongholdCards!.claimedTurn, 2); }
  orderBlow(game, false, 0); orderBlow(game, false, 1);
  reach(state => state.turn === 3 && state.phase === 5 && phaseModuleEcazClean(state));
  reserveBoard(game);
  const ecazForces = advanced ? 5 : 4, allyForces = 6, allyElite = 3, opponentForces = 8;
  place(game, ecaz, location, ecazForces); place(game, ally, location, allyForces, allyElite);
  place(game, opponent, location, opponentForces);
  const shield = stageEcazOccupyCard(game, actor, card => card.kind === 'shield');
  phaseModuleEcazInventory(game);
  reach(state => state.turn === 3 && state.phase === 6 && phaseModuleEcazClean(state));
  const beforeBattle = structuredClone(game);
  const choice = viewGame(game, game.active!).battleChoices.find(choice => choice.territory === kind); assert.ok(choice);
  const battleStep: PhaseModuleEcazStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory: kind,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  act(battleStep.actor, battleStep.action);
  assert.ok(game.decision?.kind === 'ecazBattleLead'); const beforeLead = structuredClone(game);
  const leadAction: Action = { type: 'decision', event: game.decision.event, lead: actor };
  act(ecaz, leadAction);
  reach(state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed !== false && phaseModuleEcazClean(state));
  const profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
  const winnerLeader = phaseModuleEcazPlayer(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => b.strength - a.strength)[0];
  const loserLeader = phaseModuleEcazPlayer(game, opponent).leaders.filter(leader => !leader.dead && !leader.usedAt)
    .sort((a, b) => a.strength - b.strength)[0]; assert.ok(winnerLeader && loserLeader);
  const planActions: PhaseModuleEcazStep[] = [
    { actor, action: { type: 'battlePlan', leader: winnerLeader.id, dial: profile.fixedEcazDial + 0.5,
      support: 0, weapon: null, defense: shield } },
    { actor: opponent, action: { type: 'battlePlan', leader: loserLeader.id, dial: 1, support: 0, weapon: null, defense: null } },
  ];
  const originalTech = structuredClone(game.techTokens!), enemyTokens = ownedTech(game.techTokens, opponent);
  assert.equal(enemyTokens.length, 1);
  return { game, rawGame: structuredClone(game), sourceGame: structuredClone(game), advanced, lead, actor,
    ecaz, ally, opponent, kind, territory: kind, location, ecazForces, allyForces, allyElite, opponentForces,
    initial, ready, started, afterSetup, afterFirstStorm, beforeAlliance, afterAlliance,
    beforeMentat, mentatStep, afterMentat, beforeBattle, beforeLead, battleStep, leadAction, profile,
    shield, winnerLeader: winnerLeader.id, loserLeader: loserLeader.id, planActions,
    originalInventory, originalTech, enemyToken: enemyTokens[0], actions, publicActions: actions, sourceActionCount: actions.length,
    staging: [
      'Actual public Ecaz/Ixians/Emperor lobby selects ix+choam+ecaz decks and original Tech; Advanced additionally selects Stronghold Cards before readiness and explicit preview start. Actual private traitors, Ecaz six-force allocation and Ix starting-card/HMS choices complete setup. The existing original scalar lottery is selected throughout (Advanced Storm cards draw1); UUID and other byte entropy remain native.',
      'CONTROLLED conserved positions follow the actual first Storm: return existing counters to their own normal/special reserves, retaining every wallet, phase, card and originally assigned Tech owner. Only remaining original Spice Cards are ordered to cause the actual turn-two worm Nexus; reciprocal alliance actions form Ecaz/Ixians.',
      'CONTROLLED one-counter-per-native co-occupation of Tabr precedes the actual turn-two end-Mentat action. Advanced earns the original Tabr card for Ecaz through shared control; no Stronghold owner or claim turn is installed.',
      'CONTROLLED later phase-five position conserves Ecaz4 Basic/5 Advanced, Ix3 Suboids+3 Cyborgs and opposing Emperor8 normals at Tabr. One original Shield is moved through real card custody to the selected lead. No shipment, native wallet, phase, Tech owner, plan or victory receipt is installed.',
      'Actual chooseBattle, Ecaz lead choice and native preparation stop at unsealed plans. The original fixed Ecaz2/3 and variable0.5/support0 represent one actual Suboid casualty; original winner cleanup precedes the selected winner’s original enemy Tech award. This is a bounded controlled coalition supplement, not complete combination or mode acceptance.',
    ] };
}
export type PhaseModuleEcazFixture = ReturnType<typeof createPhaseModuleEcazFixture>;

export function quotePhaseModuleEcazBattle(game: Game) {
  const battle = game.battle; assert.ok(battle?.revealed);
  const view = viewGame(game, game.host).battle!, profile = view.ecazOccupy!.profile!;
  const side = (actor: string): ResolutionCombatant => {
    const player = phaseModuleEcazPlayer(game, actor), own = viewGame(game, actor).battle!; assert.ok(own.ownForces);
    return { id: actor, faction: player.faction, ally: player.ally, spice: player.spice, hand: player.hand,
      plan: battle.plans[actor], leader: player.leaders.find(leader => leader.id === battle.plans[actor].leader),
      forces: own.ownForces, stronghold: own.strongholdEffects[actor] };
  };
  return quoteBattleResolution({ advanced: game.advanced, turn: game.turn, territory: battle.territory,
    ecazOccupy: profile, aggressor: view.aggressor, attacker: side(battle.attacker), defender: side(battle.defender),
    voters: view.traitorVoters.map(actor => ({ id: actor, called: false, traitors: phaseModuleEcazPlayer(game, actor).traitors,
      beneficiary: [battle.attacker, battle.defender].includes(actor) ? actor : phaseModuleEcazPlayer(game, actor).ally! })),
    participants: game.players, physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false });
}
/** Caller may replay these exact original steps through GameTable callbacks.
 * Return the earned cleanup boundary as well as the completed battle. */
export function resolvePhaseModuleEcazFixture(fixture: PhaseModuleEcazFixture, state = structuredClone(fixture.game),
  actions: PhaseModuleEcazStep[] = []) {
  let game = state;
  for (const step of fixture.planActions) game = actPhaseModuleEcaz(game, step.actor, step.action, actions);
  const revealed = structuredClone(game), quote = quotePhaseModuleEcazBattle(game);
  game = advancePhaseModuleEcaz(game, state => state.decision?.kind === 'battleCards' && phaseModuleEcazCleanExceptDecision(state), actions);
  const beforeCleanup = structuredClone(game), cleanupAction: Action = { type: 'decision', discard: [] };
  assert.equal(game.decision!.player, fixture.actor); assert.equal(game.techTokens![fixture.enemyToken].owner, fixture.opponent);
  game = actPhaseModuleEcaz(game, fixture.actor, cleanupAction, actions);
  const afterCleanup = structuredClone(game);
  game = advancePhaseModuleEcaz(game, state => !state.battle && phaseModuleEcazClean(state), actions);
  return { game, revealed, quote, beforeCleanup, cleanupAction, afterCleanup, actions };
}
function phaseModuleEcazCleanExceptDecision(game: Game) {
  return !game.phaseOpening && !game.response && !game.pendingTreacheryDiscard;
}
