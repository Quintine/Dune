import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { distance } from '../game/board';
import { isAdvisor } from '../game/advisors';
import { advisorMatchingKey } from '../game/advisor-matching';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { planetologistLeader } from '../game/planetologist-movement';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaRicheseCacheKarama, nextSemutaRicheseCacheKarama,
  semutaRicheseCacheKaramaClean, semutaRicheseCacheKaramaInventory, semutaRicheseCacheKaramaPlayer,
} from './fixture-semuta-richese-cache-karama';
import {
  passSemutaFremenGuildMovement, claimSemutaFremenGuildMovement,
} from './fixture-semuta-fremen-guild-movement';

export type SemutaAdvisorGatherPosition = 'first' | 'second';
export type SemutaAdvisorGatherStep = { actor: string; action: Action };
export const actSemutaAdvisorGather = actSemutaRicheseCacheKarama;
export const passSemutaAdvisorGather = passSemutaFremenGuildMovement;
export const claimSemutaAdvisorGather = claimSemutaFremenGuildMovement;
export const semutaAdvisorGatherPlayer = semutaRicheseCacheKaramaPlayer;
export const semutaAdvisorGatherInventory = semutaRicheseCacheKaramaInventory;
export const semutaAdvisorGatherClean = semutaRicheseCacheKaramaClean;
export const semutaAdvisorGatherPhysical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, order: game.order, active: game.active,
  ready: game.ready, movementRemaining: game.movementRemaining,
  spice: game.spice, spiceDeck: game.spiceDeck, spiceDiscard: game.spiceDiscard, skills: game.leaderSkills,
  players: game.players.map(player => ({ id: player.id, spice: player.spice, forces: player.forces,
    advisors: player.advisors, reserves: player.reserves, tanks: player.tanks, elites: player.elites,
    leaders: player.leaders, shipped: player.shipped, moved: player.moved, ally: player.ally })),
});
export function semutaAdvisorGatherSkillInventory(game: Game) {
  const state = game.leaderSkills!;
  const ids = [...state.deck, ...Object.values(state.offers).flatMap(offer => offer.cards),
    ...state.assignments.map(assignment => assignment.skill)].sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original all14 Skill retains one physical slot'); return ids;
}
const training: Record<string, LeaderSkillId> = {
  richese: 'killer-medic', choam: 'swordmaster-of-ginaz', beneGesserit: 'planetologist',
  atreides: 'prana-bindu-adept', emperor: 'master-of-assassins',
};

/** Original two-card offers are really selected and assigned. Fresh matching
 * declarations and their costs remain caller-owned, while optional preparation
 * and accompaniment are declined through their actual original controls. */
export function nextSemutaAdvisorGather(game: Game): SemutaAdvisorGatherStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.response?.kind === 'advisorFlip') return null;
  if (!game.phaseOpening && !game.response) {
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'atreides', turn: 10 } };
    if (game.status === 'setup' && game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
      const offer = own.offer, skill = training[actor];
      assert.ok(offer && offer.cards.includes(skill) && !own.unavailableSkills?.[skill]);
      const player = semutaAdvisorGatherPlayer(game, actor);
      const leader = own.eligibleLeaders.sort((a, b) =>
        player.leaders.find(disc => disc.id === b.id)!.strength - player.leaders.find(disc => disc.id === a.id)!.strength ||
        a.id.localeCompare(b.id))[0]; assert.ok(leader);
      return { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    }
    if (game.status === 'setup' && game.setupStage === 'forces' &&
        !semutaAdvisorGatherPlayer(game, 'beneGesserit').advisorSetup)
      return { actor: 'beneGesserit', action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
    if (game.decision?.kind === 'advisorBattle' || game.decision?.kind === 'advisor')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
    if (game.decision?.kind === 'intrusion') return null;
  }
  return nextSemutaRicheseCacheKarama(game);
}
export function advanceSemutaAdvisorGather(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorGatherStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaAdvisorGather(game);
    assert.ok(step, 'Choose the original matching counter or fresh cost before continuing');
    game = actSemutaAdvisorGather(game, step.actor, step.action, actions);
  }
  throw Error('The original Semuta gather programme did not reach its finite boundary');
}
function allowOneGatherSource(game: Game, actions: SemutaAdvisorGatherStep[] = []): Game {
  const source = game.response?.advisorGatherMatchingSource; assert.ok(source);
  for (let count = 0; game.response?.advisorGatherMatchingSource?.event === source.event && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaAdvisorGather(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.advisorGatherMatchingSource?.event, source.event); return game;
}
/** Allow the actual remaining origin counters, then only their original
 * movement suffix. The first approval alone never flips or transfers a force. */
export function allowSemutaAdvisorGather(game: Game, actions: SemutaAdvisorGatherStep[] = []): Game {
  assert.ok(game.response?.advisorGatherMatchingSource);
  for (let count = 0; game.response?.advisorGatherMatchingSource && count < 2; count++)
    game = allowOneGatherSource(game, actions);
  assert.equal(game.pendingAdvisorGatherMatching, undefined);
  return finishSemutaAdvisorGather(game, actions);
}
export function finishSemutaAdvisorGather(game: Game, actions: SemutaAdvisorGatherStep[] = []): Game {
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.equal(game.pendingAdvisorGatherMatching, undefined);
  return advanceSemutaAdvisorGather(game, semutaAdvisorGatherClean, actions);
}

/** Fresh original Advanced Semuta+all14 Skills development entry. BG's real
 * selected Planetologist and two paid fighter shipments supply the packet;
 * only untouched original Skill/Treachery/Spice orders are selected. */
export function createSemutaAdvisorGatherFixture(options: { position?: SemutaAdvisorGatherPosition } = {}) {
  const position = options.position ?? 'first', richese = 'richese', holder = 'choam', owner = 'beneGesserit',
    spender = 'atreides', emperor = 'emperor';
  let game = createGame('SEMUTAADVISORGATHER', newPlayer(richese, 'Richese', 'richese'), true, ['choam']);
  for (const faction of [holder, owner, spender, emperor] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorGatherStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorGather(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorGather(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), start = actions.length; run();
    return { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  // Existing explicit Skills entry requires an undealt lobby with no already
  // allocated Skill state; it creates the original deck instead of redealing.
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game, true));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: 'original-undealt-semuta-all14-skills', skills: true };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.ok(game.leaderSkills); assert.deepEqual(game.expansions, ['choam']);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(!Object.keys(game.leaderSkills.offers).length && !game.leaderSkills.assignments.length);
  const originalInventory = semutaAdvisorGatherInventory(game), originalSkillInventory = semutaAdvisorGatherSkillInventory(game);
  assert.equal(originalInventory.length, 45); assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  assert.deepEqual(originalSkillInventory, LEADER_SKILL_CARDS.map(card => card.id).sort());
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 4); assert.equal(ordinary.length, 4);
  const selected = [ordinary[0], ordinary[1], ordinary[2], printed, ordinary[3]], cost = printed.id;
  const dealOrder = selected.map((card, index) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= index);
    [game.deck[index], game.deck[from]] = [game.deck[from], game.deck[index]];
    return { position: index, from, card: card.id };
  });
  const beforeSkillOrder = structuredClone(game), originalSkillOrder = [...game.leaderSkills.deck];
  const wanted = game.players.map(player => training[player.id]), rest = game.leaderSkills.deck.filter(skill => !wanted.includes(skill));
  const skillOrder = wanted.flatMap(skill => [skill, rest.shift()!]).concat(rest);
  game.leaderSkills.deck.splice(0, game.leaderSkills.deck.length, ...skillOrder);
  assert.deepEqual(semutaAdvisorGatherSkillInventory(game), originalSkillInventory);
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: ReturnType<typeof transition> | null = null, skillOffers: Game | null = null;
  const skillChoices: ReturnType<typeof transition>[] = [];
  for (let count = 0; game.status === 'setup' && count < 120; count++) {
    const step = nextSemutaAdvisorGather(game); assert.ok(step);
    const before = structuredClone(game), start = actions.length;
    if (before.setupStage === 'leaderSkills' && !skillOffers) skillOffers = structuredClone(game);
    act(step.actor, step.action);
    const record = { before, steps: structuredClone(actions.slice(start)), after: structuredClone(game) };
    if (step.action.type === 'leaderSkill') skillChoices.push(record);
    if (step.action.type === 'advisorSetup') advisorSetup = record;
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup && skillOffers); assert.equal(skillChoices.length, 5);
  const afterSetup = structuredClone(game), trainer = planetologistLeader(game, owner); assert.ok(trainer);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorGatherPlayer(game, owner).forces['arrakeen:10'], 1);
  assert.equal(isAdvisor(semutaAdvisorGatherPlayer(game, owner), 'arrakeen'), true);
  assert.equal(semutaAdvisorGatherPlayer(game, spender).forces['arrakeen:10'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(index => {
    const from = game.spiceDeck.findIndex((card, cardIndex) => cardIndex >= index && 'territory' in card && !card.discovery &&
      !['imperial_basin', 'oh_gap', 'arrakeen'].includes(card.territory));
    assert.ok(from >= index); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(index, 0, card); return { position: index, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaAdvisorGatherStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaAdvisorGatherPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaAdvisorGather(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0, 'CHOAM genuinely buys the original cache Semuta for one spice');
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorGatherPlayer(beforeBid, holder).spice - semutaAdvisorGatherPlayer(game, holder).spice, 1);
  assert.equal(semutaAdvisorGatherPlayer(game, richese).spice - semutaAdvisorGatherPlayer(beforeBid, richese).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && semutaAdvisorGatherClean(state));
  const fundingAction: Action = { type: 'bribe', target: owner, amount: 1 };
  const funding = transition(() => { act(emperor, fundingAction); });
  const firstShipment = transition(() => {
    act(owner, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 2, elite: 0, allyPayment: 0 });
    reach(semutaAdvisorGatherClean);
  });
  assert.equal(semutaAdvisorGatherPlayer(firstShipment.before, owner).spice - semutaAdvisorGatherPlayer(game, owner).spice, 4);
  reach(state => state.turn === 2 && state.phase === 5 && state.active === owner && semutaAdvisorGatherClean(state));
  const beforeSecondShipment = structuredClone(game);
  const secondShipment = transition(() => {
    act(owner, { type: 'ship', territory: 'oh_gap', sector: 9, amount: 1, elite: 0, allyPayment: 0 });
    reach(semutaAdvisorGatherClean);
  });
  assert.equal(semutaAdvisorGatherPlayer(secondShipment.before, owner).spice - semutaAdvisorGatherPlayer(game, owner).spice, 2);
  const territory = 'arrakeen', location = 'arrakeen:10', sourceLocations = ['imperial_basin:9', 'oh_gap:9'];
  const player = semutaAdvisorGatherPlayer(game, owner);
  assert.equal(player.forces[sourceLocations[0]], 2); assert.equal(player.forces[sourceLocations[1]], 1);
  assert.equal(isAdvisor(player, 'imperial_basin'), false); assert.equal(isAdvisor(player, 'oh_gap'), false);
  assert.equal(player.forces[location], 1); assert.equal(isAdvisor(player, territory), true);
  assert.equal(player.shipped, true); assert.equal(player.moved, 0); assert.equal(planetologistLeader(game, owner), trainer);
  assert.deepEqual(sourceLocations.map(source => distance(source, location)), [1, 1]);
  const forces = { 'imperial_basin:9': 1, 'oh_gap:9': 1 };
  const nativeAction: Action = { type: 'move', planetologist: 'gather', forces, territory, sector: 10 };
  const largerPacket: Action = { ...nativeAction, forces: { 'imperial_basin:9': 2, 'oh_gap:9': 1 } };
  const replacement: Action = { type: 'move', from: 'imperial_basin:9', territory: 'oh_gap', sector: 9, amount: 1 };
  const beforeDeclaration = structuredClone(game), beforePhysical = structuredClone(semutaAdvisorGatherPhysical(game));
  const declaration = transition(() => { act(owner, nativeAction); });
  const firstSource = structuredClone(game.response?.advisorGatherMatchingSource); assert.ok(firstSource);
  assert.equal(firstSource.origin, 'imperial_basin'); assert.equal(game.pendingAdvisorGatherMatching?.receipts.length, 2);
  assert.deepEqual(semutaAdvisorGatherPhysical(game), beforePhysical);
  let firstAllowance: ReturnType<typeof transition> | null = null;
  if (position === 'second') firstAllowance = transition(() => {
    game = allowOneGatherSource(game, actions);
    assert.deepEqual(semutaAdvisorGatherPhysical(game), beforePhysical);
  });
  const parent = game.pendingAdvisorGatherMatching, matching = game.response?.advisorGatherMatchingSource;
  assert.ok(parent && matching); assert.equal(parent.index, position === 'first' ? 0 : 1);
  assert.equal(parent.approved.length, parent.index);
  assert.equal(matching.origin, position === 'first' ? 'imperial_basin' : 'oh_gap');
  assert.equal(game.response?.kind, 'advisorFlip'); assert.equal(game.response?.owner, owner);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.equal(game.phaseOpening ?? null, null); assert.equal(game.decision ?? null, null);
  assert.ok(semutaAdvisorGatherPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaAdvisorGatherPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaAdvisorGatherInventory(game), originalInventory);
  assert.deepEqual(semutaAdvisorGatherSkillInventory(game), originalSkillInventory);
  const source = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, position, kind: 'advisorGatherMatching' as const, advanced: true as const,
    richese, holder, owner, bg: owner, spender, atreides: spender, emperor, cost, semuta: SEMUTA_DRUG_ID, action, nativeAction,
    territory, resident: territory, location, destination: territory, destinationLocation: location, forces,
    sourceLocations, sourceCounts: { 'imperial_basin:9': 2, 'oh_gap:9': 1 }, trainer, skill: 'planetologist' as const,
    replacement, sameTypeReplacement: replacement, largerPacket,
    originalResponse: structuredClone(game.response!), originalParent: structuredClone(parent),
    originalSource: structuredClone(matching), originalGatherSource: structuredClone(matching),
    originalPhysical: structuredClone(semutaAdvisorGatherPhysical(game)), originalHistory: structuredClone(game.log),
    originalDenials: structuredClone(game.advisorMatchingDenied ?? []), expectedDenial: advisorMatchingKey(matching),
    initial, lobby, setup, initialization, beforeStartingDeal, beforeSkillOrder, originalSkillOrder, skillOrder,
    skillOffers, skillChoices, advisorSetup, afterSetup, dealOrder, spiceOrder, originalSpice,
    acquired, acquisition, funding, fundingAction, firstShipment, beforeSecondShipment, secondShipment,
    beforeDeclaration, declaration, firstSource, firstAllowance, originalInventory, originalSkillInventory,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original explicit Advanced Semuta all14 Skills initializer acts on the ready undealt R/C/BG/A/E exact-CHOAM lobby. It creates the original Skill deck once; no preexisting Skill state is redealt and no Basic game is converted.',
      'Reorder only the untouched original all14 Skill deck and unopened starting Treachery positions. Each of five actual two-card offers is really selected on a living eligible native disc; BG earns Planetologist and A is genuinely dealt printed Karama.',
      'Actual advisorSetup places BG beside original A10 Arrakeen. Four safe original ordinary Spice positions are selected; actual first/second Storm, dual Spice, Charity, native auctions and Revival execute. CHOAM really buys original cache Semuta for one spice.',
      'E actually bribes one spice. BG pays four for Basin2 in turn1 and two for OhGap1 in turn2; both groups remain fighters and are graph-distance1 from its original resident Arrakeen advisor. No played wallet, force, stance, trainer, clock or response is installed.',
      position === 'second'
        ? 'Submit the real two-origin gather, then actually allow the first Basin matching counter. All physical counters, stances, payments and movement use remain unchanged; stop at the original second OhGap counter with one approved event.'
        : 'Submit the real two-origin gather and stop at the original first Basin matching counter, before any physical transfer or movement use.',
      'Fresh cost targets A original printed Karama. Denial keeps the whole move unused and permits the real same-type Basin→OhGap alternative; native allowance completes all remaining origin controls before one actual gather commit.',
    ],
  };
}
export type SemutaAdvisorGatherFixture = ReturnType<typeof createSemutaAdvisorGatherFixture>;
