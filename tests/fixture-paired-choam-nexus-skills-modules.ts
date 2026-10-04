import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { strongholdControllers } from '../game/stronghold-cards';
import {
  advancePairedChoamSkills, advancePairedChoamSkillsToPhase, allowPairedChoamSkills,
  assertPairedChoamSkillsCustody, completePairedChoamSkillsSetup, initializePairedChoamNexusSkills,
  nextPairedChoamSkillsStep, pairedSkillsClean, pairedSkillsPlayer, pairedSkillsSnapshot,
  placePairedSkillsForce, revealPairedSkillsRichese, stepPairedChoamSkills,
  type PairedChoamNexusSkillsFixture, type PairedChoamNexusSkillsOptions, type PairedChoamNexusSkillsStep,
} from './fixture-paired-choam-nexus-skills';

/** Source composition, not a new ruling:
 * docs/NEXUS_CARD_RULES.md, "Paired E1/E2 Nexus and Leader Skills composition"
 * (signed Richese pair and original CHOAM Special fuel),
 * docs/LEADER_SKILLS_RUNTIME.md, "Paired E1/E2 Nexus composition" and
 * "Advanced Stronghold composition"; original module custody/timing in
 * fixture-paired-choam-nexus-modules.ts and fixture-native-skills-stronghold.ts.
 * No borrowed Smuggler, pair companion, mixed No-Field plan or preview is added.
 */
export type PairedChoamNexusSkillsModulesOptions = PairedChoamNexusSkillsOptions & {
  tech?: boolean;
  strongholds?: boolean;
  /** Conserved pre-END-Mentat occupant; the engine, never this fixture, earns custody. */
  arrakeenOwner?: 'richese' | 'choam' | 'guild';
};
export type PairedChoamNexusSkillsModulesFixture = PairedChoamNexusSkillsFixture & {
  tech: boolean;
  strongholds: boolean;
};
export type PairedChoamNexusSkillsModulesStep = PairedChoamNexusSkillsStep;

// Keep the original legal native policies and human plan/posture boundaries.
export {
  nextPairedChoamSkillsStep as nextPairedChoamSkillsModulesStep,
  stepPairedChoamSkills as stepPairedChoamSkillsModules,
  advancePairedChoamSkills as advancePairedChoamSkillsModules,
  advancePairedChoamSkillsToPhase as advancePairedChoamSkillsModulesToPhase,
  completePairedChoamSkillsSetup as completePairedChoamSkillsModulesSetup,
  allowPairedChoamSkills as allowPairedChoamSkillsModules,
  revealPairedSkillsRichese as revealPairedModulesRichese,
  openPairedSkillsBattle as openPairedModulesSkillsBattle,
  pairedSkillsBattlePlans as pairedModulesSkillsBattlePlans,
  finishPairedSkillsBattle as finishPairedModulesSkillsBattle,
  quotePairedSkillsBattle as quotePairedModulesSkillsBattle,
  pairedSkillsRicheseCunningRequest as pairedModulesSkillsRicheseCunningRequest,
  pairedSkillsChoamCunningRequest as pairedModulesSkillsChoamCunningRequest,
  stagePairedSkillsPlanetologistRoute as stagePairedModulesSkillsPlanetologistRoute,
  holdPairedSkillsCard as holdPairedModulesSkillsCard,
  placePairedSkillsForce as placePairedModulesSkillsForce,
  pairedSkillsClean as pairedModulesSkillsClean,
  pairedSkillsPlayer as pairedModulesSkillsPlayer,
  pairedSkillsSnapshot as pairedModulesSkillsSnapshot,
  assertPairedChoamSkillsCustody as assertPairedChoamSkillsModulesCustody,
} from './fixture-paired-choam-nexus-skills';

/** Lobby options use real module actions before the original all14 initializer.
 * Supplied setup offers, first-dealt hands and authenticated IDs are authoritative.
 * An existing module selection is retained unless an explicit lobby option changes it.
 */
export function initializePairedChoamNexusSkillsModules(options: PairedChoamNexusSkillsModulesOptions = {}): Game {
  const advanced = options.advanced ?? options.initial?.advanced ?? true;
  const factions = options.factions ?? ['richese', 'choam', 'guild', 'atreides'] as const;
  let game = options.initial ? pairedSkillsSnapshot(options.initial)
    : createGame('PAIREDCHOAMNEXUSSKILLSMODULES', newPlayer(options.seatIds?.[0] ?? factions[0], factions[0], factions[0]), advanced, ['choam']);
  if (!options.initial) for (const faction of factions.slice(1))
    joinGame(game, newPlayer(options.seatIds?.[game.players.length] ?? faction, faction, faction));
  const tech = options.tech ?? (options.initial ? !!game.techTokens : true);
  const strongholds = options.strongholds ?? (options.initial ? !!game.strongholdCards : advanced);
  assert.ok(tech || strongholds, 'Select original Tech and/or Stronghold Cards');
  assert.equal(game.advanced, advanced);
  assert.ok(!strongholds || advanced, 'Original Stronghold Cards require Advanced');
  assert.ok(game.players.length >= (tech ? 3 : 2) && game.players.length <= 6);
  if (game.status === 'lobby') {
    if (!!game.techTokens !== tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: tech });
    if (!!game.strongholdCards !== strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: strongholds });
  } else {
    assert.equal(!!game.techTokens, tech, 'A saved setup cannot change its original Tech selection');
    assert.equal(!!game.strongholdCards, strongholds, 'A saved setup cannot change its original Stronghold selection');
  }
  return initializePairedChoamNexusSkills({ ...options, initial: game, advanced });
}

/** Labeled rule-position control: every original counter stays in native custody. */
function reserveBoard(game: Game, staging: string[]): void {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((sum, amount) => sum + amount, 0);
    p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((sum, amount) => sum + amount, 0);
      p.elites.forces = {};
    }
    if (p.advisors) p.advisors = {};
  }
  staging.push('Conserved original board counters into their own reserves; no wallet, phase, turn, module owner, skill or earned receipt is assigned.');
}
function orderSpice(game: Game, kinds: ('worm' | 'land')[], staging: string[]): void {
  const front = kinds.map(kind => {
    const index = game.spiceDeck.findIndex(card => kind === 'worm' ? 'worm' in card : 'territory' in card);
    assert.ok(index >= 0, 'Only genuine still-undealt Spice Cards can be ordered');
    return game.spiceDeck.splice(index, 1)[0];
  });
  game.spiceDeck.unshift(...front);
  staging.push(`Conserved original undealt Spice order: ${kinds.join(', ')}; played discards are unchanged.`);
}

/** Actual native starts/skill-first setup, first Storm, previous zero-marker,
 * END Mentat, worm, reciprocal classic alliance and closing Cunning draws.
 * Four seats are necessary for BOTH unallied draws; a two-seat SH game can use
 * initialize/complete/step/advance exports but never receives fabricated Nexus.
 */
export function createPairedChoamNexusSkillsModulesFixture(options: PairedChoamNexusSkillsModulesOptions = {}): PairedChoamNexusSkillsModulesFixture {
  const actions: PairedChoamNexusSkillsStep[] = [], staging: string[] = [];
  let game = initializePairedChoamNexusSkillsModules(options);
  const initial = pairedSkillsSnapshot(game);
  game = completePairedChoamSkillsSetup(game, options, actions);
  const afterSetup = pairedSkillsSnapshot(game);
  const richese = game.players.find(p => p.faction === 'richese')!.id;
  const choam = game.players.find(p => p.faction === 'choam')!.id;
  const guild = game.players.find(p => p.faction === 'guild')?.id;
  const observer = game.players.find(p => p.faction !== 'richese' && p.faction !== 'choam' && p.faction !== 'guild')?.id;
  assert.ok(guild && observer, 'Both own Cunning draws require two other real alliance seats including native Guild');
  const location = `habbanya_ridge_sietch:${territory('habbanya_ridge_sietch').sectors[0]}`;
  game = advancePairedChoamSkillsToPhase(game, 1, actions);
  const afterFirstStorm = pairedSkillsSnapshot(game);
  orderSpice(game, ['land', 'land'], staging);
  game = advancePairedChoamSkills(game, g => g.phase === 5 && g.active === richese && pairedSkillsClean(g), actions);
  reserveBoard(game, staging);
  const before = pairedSkillsSnapshot(game), p = pairedSkillsPlayer(game, richese);
  const shipmentStep: PairedChoamNexusSkillsStep = { actor: richese, action: { type: 'ship',
    noField: p.noField!.tokens.find(t => t.value === 0)!.id, event: p.noFieldEvent,
    territory: 'habbanya_ridge_sietch', sector: territory('habbanya_ridge_sietch').sectors[0] } };
  game = stepPairedChoamSkills(game, shipmentStep, actions);
  game = allowPairedChoamSkills(game, actions);
  const firstShipment = { before, step: shipmentStep, after: pairedSkillsSnapshot(game) };
  game = revealPairedSkillsRichese(game, richese, actions);
  game = advancePairedChoamSkillsToPhase(game, 8, actions);
  reserveBoard(game, staging);
  placePairedSkillsForce(game, richese, location, 1, staging);
  const actors: Record<'richese' | 'choam' | 'guild', string> = { richese, choam, guild };
  placePairedSkillsForce(game, actors[options.arrakeenOwner ?? 'choam'], `arrakeen:${territory('arrakeen').sectors[0]}`, 1, staging);
  let beforeFirstMentat: Game | undefined, firstMentatStep: PairedChoamNexusSkillsStep | undefined;
  for (let count = 0; game.turn === 1 && count < 200; count++) {
    const previous = pairedSkillsSnapshot(game), next = nextPairedChoamSkillsStep(game);
    assert.ok(next);
    game = stepPairedChoamSkills(game, next, actions);
    if (game.turn === 2) { beforeFirstMentat = previous; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  const afterFirstMentat = pairedSkillsSnapshot(game);
  game = advancePairedChoamSkillsToPhase(game, 1, actions);
  orderSpice(game, ['worm', 'land', 'land'], staging);
  game = advancePairedChoamSkills(game, g => g.nexus === true && !g.spiceWindow && !g.spiceResolution && pairedSkillsClean(g), actions);
  const beforeAlliance = pairedSkillsSnapshot(game), allianceActions: PairedChoamNexusSkillsStep[] = [
    { actor: guild, action: { type: 'alliance', target: observer } },
    { actor: observer, action: { type: 'alliance', target: guild } },
  ];
  for (const next of allianceActions) game = stepPairedChoamSkills(game, next, actions);
  game = advancePairedChoamSkills(game, g => g.nexusCards?.phase?.stage === 'drawing' && pairedSkillsClean(g), actions);
  const beforeClosingDraw = pairedSkillsSnapshot(game), closingDraws: PairedChoamNexusSkillsFixture['closingDraws'] = [];
  for (const [actor, card] of [[richese, 'richese'], [choam, 'choam']] as const) {
    const cards = game.nexusCards!.cards!, index = cards.deck.indexOf(card);
    assert.ok(index >= 0);
    cards.deck.unshift(cards.deck.splice(index, 1)[0]);
    staging.push(`Conserved unused original ${card} Nexus singleton placed first before its actual closing draw.`);
    const drawBefore = pairedSkillsSnapshot(game);
    const next: PairedChoamNexusSkillsStep = { actor, action: { type: 'nexusCardChoice', turn: game.turn, card: null, choice: 'draw', ownRedraws: 0 } };
    game = stepPairedChoamSkills(game, next, actions);
    closingDraws.push({ before: drawBefore, step: next, after: pairedSkillsSnapshot(game) });
  }
  game = advancePairedChoamSkillsToPhase(game, 5, actions);
  reserveBoard(game, staging);
  const movementStart = pairedSkillsSnapshot(game);
  game = advancePairedChoamSkills(game, g => g.phase === 5 && g.active === richese && pairedSkillsClean(g), actions);
  if (options.reserveCap !== undefined) {
    const p = pairedSkillsPlayer(game, richese);
    assert.ok(Number.isSafeInteger(options.reserveCap) && options.reserveCap >= 0 && options.reserveCap <= p.reserves);
    placePairedSkillsForce(game, richese, 'polar_sink:0', p.reserves - options.reserveCap, staging);
  }
  assertPairedChoamSkillsCustody(game);
  const trainers = { richese: game.leaderSkills!.assignments.find(a => a.owner === richese)!.leader,
    choam: game.leaderSkills!.assignments.find(a => a.owner === choam)!.leader };
  return { initial, afterSetup, afterFirstStorm, firstShipment, beforeFirstMentat, firstMentatStep, afterFirstMentat,
    beforeAlliance, allianceActions, beforeClosingDraw, closingDraws, movementStart, game, richese, choam, guild, observer,
    location, trainers, actions, staging, tech: !!game.techTokens, strongholds: !!game.strongholdCards };
}

/** Preserve the original response boundary before the actual Guild allowance. */
export function advancePairedModulesRicheseToGuild(game: Game, actions?: PairedChoamNexusSkillsStep[]): Game {
  return advancePairedChoamSkills(game, g => g.decision?.kind === 'guildShipment' || pairedSkillsClean(g), actions);
}
export function pairedModulesRicheseGuildStep(game: Game, allow = true): PairedChoamNexusSkillsStep {
  const decision = game.decision;
  assert.ok(decision?.kind === 'guildShipment', 'Use the actual native Guild interception decision');
  return { actor: decision.player, action: { type: 'decision', allow } };
}
export function advancePairedModulesBattleToDecision(game: Game, kind: 'sukRescue' | 'battleCards' | 'techToken', actions?: PairedChoamNexusSkillsStep[]): Game {
  return advancePairedChoamSkills(game, g => g.decision?.kind === kind || !g.battle && pairedSkillsClean(g), actions);
}
export function finishPairedChoamSkillsModulesMovement(game: Game, actions?: PairedChoamNexusSkillsStep[]): Game {
  return advancePairedChoamSkillsToPhase(game, 6, actions);
}
/** Current physical control is not held-card custody; only real END Mentat updates owners. */
export function pairedModulesSkillsStrongholdControls(game: Game) {
  return strongholdControllers(game.players, false);
}
/** Native human declaration stays an Action, not a fixture-invented proof or frame. */
export function declarePairedModulesSkills(game: Game, actor: string, action: Action, actions?: PairedChoamNexusSkillsStep[]): Game {
  return stepPairedChoamSkills(game, { actor, action }, actions);
}

/** Stop before a real human visibility choice; do not silently choose its band. */
export function openPairedModulesSkillsBattlePosture(game: Game, owner: string, opponent: string,
  options: { territory?: string; actions?: PairedChoamNexusSkillsStep[] } = {}): Game {
  game = advancePairedChoamSkillsToPhase(game, 6, options.actions);
  assert.equal(game.phase, 6, 'The real ordinary battle requires conserved opposing forces');
  assert.ok(game.active === owner || game.active === opponent);
  game = stepPairedChoamSkills(game, { actor: game.active!, action: { type: 'chooseBattle',
    territory: options.territory ?? 'habbanya_ridge_sietch', target: game.active === owner ? opponent : owner } }, options.actions);
  return advancePairedChoamSkills(game, g => g.decision?.kind === 'leaderSkillVisibility' ||
    pairedSkillsClean(g) && !!g.battle && (!g.battle.preLeader || g.battle.preLeader.closed) && !g.battle.preparation, options.actions);
}
/** Continue actual preparation after the caller's human posture action. */
export function advancePairedModulesSkillsToPlans(game: Game, actions?: PairedChoamNexusSkillsStep[]): Game {
  assert.ok(game.battle && !game.battle.revealed, 'Continue the current ordinary unsealed battle');
  return advancePairedChoamSkills(game, g => pairedSkillsClean(g) && !!g.battle &&
    (!g.battle.preLeader || g.battle.preLeader.closed) && !g.battle.preparation, actions);
}
/** The original two plans reveal before traitor calls, physical losses or rewards. */
export function revealPairedModulesSkillsBattle(game: Game, plans: readonly PairedChoamNexusSkillsStep[],
  actions?: PairedChoamNexusSkillsStep[]): Game {
  for (const plan of plans) {
    assert.equal(plan.action.type, 'battlePlan');
    game = stepPairedChoamSkills(game, plan, actions);
    game = allowPairedChoamSkills(game, actions);
  }
  assert.ok(game.battle?.revealed, 'Both original plans must actually reveal');
  return game;
}
