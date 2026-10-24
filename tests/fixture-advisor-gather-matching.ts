import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { distance } from '../game/board';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { planetologistLeader } from '../game/planetologist-movement';
import {
  actAdvisorPreparation, advisorPreparationClean, advisorPreparationInventory,
  advisorPreparationPlayer, nextAdvisorPreparationStep,
} from './fixture-advisor-preparation';

export type AdvisorGatherMatchingStep = { actor: string; action: Action };
export type AdvisorGatherMatchingTransition = { before: Game; steps: AdvisorGatherMatchingStep[]; after: Game };
export const actAdvisorGatherMatching = actAdvisorPreparation;
export const advisorGatherMatchingPlayer = advisorPreparationPlayer;
export const advisorGatherMatchingInventory = advisorPreparationInventory;
export const advisorGatherMatchingClean = advisorPreparationClean;
export const advisorGatherMatchingSkillInventory = (game: Game) => {
  const state = game.leaderSkills!;
  const ids = [...state.deck, ...Object.values(state.offers).flatMap(offer => offer.cards),
    ...state.assignments.map(assignment => assignment.skill)].sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original Leader Skill has one physical slot'); return ids;
};
const training: Record<string, LeaderSkillId> = {
  beneGesserit: 'planetologist', atreides: 'killer-medic', emperor: 'swordmaster-of-ginaz',
};

/** All technique confirmation is through original owned offers. Intrusion and
 * later matching flips stay caller-owned; ordinary preparation is declined. */
export function nextAdvisorGatherMatching(game: Game): AdvisorGatherMatchingStep | null {
  if (game.response?.kind === 'advisorFlip') return null;
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
      const skill = training[actor], offer=own.offer; assert.ok(offer && offer.cards.includes(skill) && !own.unavailableSkills?.[skill]);
      const leader = own.eligibleLeaders.sort((a, b) => {
        const player = advisorGatherMatchingPlayer(game, actor);
        return player.leaders.find(disc => disc.id === b.id)!.strength - player.leaders.find(disc => disc.id === a.id)!.strength || a.id.localeCompare(b.id);
      })[0]; assert.ok(leader);
      return { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } };
    }
    if (game.decision?.kind === 'intrusion') return null;
    if (game.decision?.kind === 'advisorBattle')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  }
  return nextAdvisorPreparationStep(game);
}
export function advanceAdvisorGatherMatching(game: Game, until: (state: Game) => boolean,
  steps: AdvisorGatherMatchingStep[] = []): Game {
  for (let count = 0; count < 2000; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original gather chronology ended before its requested boundary');
    const next = nextAdvisorGatherMatching(game);
    assert.ok(next, `Choose the original Intrusion/matching control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actAdvisorGatherMatching(game, next.actor, next.action, steps);
  }
  throw Error('The native advisor gather matching source did not reach its finite boundary');
}
export function passAdvisorGatherMatching(game: Game, steps: AdvisorGatherMatchingStep[] = []): Game {
  for (let count = 0; game.response && game.response.kind !== 'advisorFlip' && count < 60; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actAdvisorGatherMatching(game, actor.id, { type: 'passResponse' }, steps);
  }
  assert.ok(!game.response || game.response.kind === 'advisorFlip'); return game;
}

/** Actual public Advanced classic/all14 Skills source. The initial untouched
 * Skill Deck is ordered before real offers, then Planetologist is really
 * assigned. Two paid shipments and optional real Intrusion earn both origins. */
export function createAdvisorGatherMatchingFixture(options: { kind?: 'mixed' | 'double' } = {}) {
  const kind = options.kind ?? 'mixed', bg = 'beneGesserit', holder = 'atreides', emperor = 'emperor';
  let game = createGame('ADVISORGATHERMATCHING', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true);
  joinGame(game, newPlayer(holder, 'Atreides', 'atreides')); joinGame(game, newPlayer(emperor, 'Emperor', 'emperor'));
  const initial = structuredClone(game), steps: AdvisorGatherMatchingStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorGatherMatching(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorGatherMatching(game, until, steps); };
  const transition = (run: () => void): AdvisorGatherMatchingTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  const enableSkills = transition(() => { act(game.host, { type: 'moduleOption', module: 'leaderSkills', enabled: true }); });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.setupStage, 'prediction');
  assert.deepEqual(game.expansions, []); assert.ok(game.leaderSkills);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  assert.ok(!Object.keys(game.leaderSkills.offers).length && !game.leaderSkills.assignments.length);
  const originalInventory = advisorGatherMatchingInventory(game); assert.equal(originalInventory.length, 33);
  const originalSkillInventory = advisorGatherMatchingSkillInventory(game);
  assert.deepEqual(originalSkillInventory, LEADER_SKILL_CARDS.map(card => card.id).sort());
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = [ordinary[0], karama, ordinary[1]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeSkillOrder = structuredClone(game), originalSkillOrder = [...game.leaderSkills.deck];
  const wanted = game.players.map(player => training[player.id]);
  const rest = game.leaderSkills.deck.filter(skill => !wanted.includes(skill));
  const skillOrder = wanted.flatMap(skill => [skill, rest.shift()!]).concat(rest);
  game.leaderSkills.deck.splice(0, game.leaderSkills.deck.length, ...skillOrder);
  assert.deepEqual(advisorGatherMatchingSkillInventory(game), originalSkillInventory);
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: AdvisorGatherMatchingTransition | null = null;
  let skillOffers: Game | null = null;
  const skillChoices: AdvisorGatherMatchingTransition[] = [];
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorGatherMatching(game); assert.ok(next);
    const before = structuredClone(game), start = steps.length;
    if (before.setupStage === 'leaderSkills' && !skillOffers) skillOffers = structuredClone(game);
    act(next.actor, next.action);
    const record = { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
    if (next.action.type === 'leaderSkill') skillChoices.push(record);
    if (next.action.type === 'advisorSetup') advisorSetup = record;
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup && skillOffers); assert.equal(skillChoices.length, 3);
  const afterSetup = structuredClone(game), trainer = planetologistLeader(game, bg); assert.ok(trainer);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorGatherMatchingPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorGatherMatchingPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorGatherMatchingPlayer(game, holder).forces['arrakeen:10'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['imperial_basin', 'oh_gap', 'arrakeen'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === bg && advisorGatherMatchingClean(state));
  const fundingAction: Action = { type: 'bribe', target: bg, amount: 1 };
  const funding = transition(() => { act(emperor, fundingAction); });
  const firstShipment = transition(() => {
    act(bg, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 2, elite: 0, allyPayment: 0 });
    reach(advisorGatherMatchingClean);
  });
  assert.equal(advisorGatherMatchingPlayer(firstShipment.before, bg).spice - advisorGatherMatchingPlayer(game, bg).spice, 4);
  let outsiderShipment: AdvisorGatherMatchingTransition | null = null;
  let intrusion: AdvisorGatherMatchingTransition | null = null;
  if (kind === 'mixed') {
    reach(state => state.turn === 1 && state.phase === 5 && state.active === emperor && advisorGatherMatchingClean(state));
    outsiderShipment = transition(() => {
      act(emperor, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 1, elite: 0, allyPayment: 0 });
      reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'intrusion');
    });
    intrusion = transition(() => {
      act(bg, { type: 'decision', accept: true });
      for (let count = 0; game.response && count < 60; count++) {
        assert.equal(game.response.kind, 'advisorFlip'); assert.equal(game.response.advisors, true);
        assert.ok(!game.response.automaticAdvisorFlip, 'Only the original Intrusion response is allowed in the source');
        const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
        act(actor.id, { type: 'passResponse' });
      }
      reach(advisorGatherMatchingClean);
    });
    assert.ok(advisorGatherMatchingPlayer(game, bg).advisors?.imperial_basin);
  }
  reach(state => state.turn === 2 && state.phase === 5 && state.active === bg && advisorGatherMatchingClean(state));
  const beforeSecondShipment = structuredClone(game);
  const secondShipment = transition(() => {
    act(bg, { type: 'ship', territory: 'oh_gap', sector: 9, amount: 1, elite: 0, allyPayment: 0 });
    reach(advisorGatherMatchingClean);
  });
  assert.equal(advisorGatherMatchingPlayer(secondShipment.before, bg).spice - advisorGatherMatchingPlayer(game, bg).spice, 2);
  const resident = 'arrakeen', location = 'arrakeen:10', sourceLocations = ['imperial_basin:9', 'oh_gap:9'];
  const player = advisorGatherMatchingPlayer(game, bg);
  assert.equal(player.forces[sourceLocations[0]], 2); assert.equal(player.forces[sourceLocations[1]], 1);
  assert.equal(!!player.advisors?.imperial_basin, kind === 'mixed'); assert.ok(!player.advisors?.oh_gap);
  assert.equal(player.forces[location], 1); assert.ok(player.advisors?.[resident]);
  assert.equal(player.shipped, true); assert.equal(player.moved, 0);
  assert.equal(planetologistLeader(game, bg), trainer);
  assert.ok(advisorGatherMatchingPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(sourceLocations.map(source => distance(source, location)), [1, 1]);
  assert.deepEqual(advisorGatherMatchingInventory(game), originalInventory);
  assert.deepEqual(advisorGatherMatchingSkillInventory(game), originalSkillInventory);
  const forces = { 'imperial_basin:9': 1, 'oh_gap:9': 1 };
  const action: Action = { type: 'move', planetologist: 'gather', forces, territory: resident, sector: 10 };
  const largerPacket: Action = { type: 'move', planetologist: 'gather',
    forces: { 'imperial_basin:9': 2, 'oh_gap:9': 1 }, territory: resident, sector: 10 };
  const emptyReplacement: Action = { type: 'move', planetologist: 'gather', forces,
    territory: 'rim_wall_west', sector: 9 };
  const ordinaryReplacement: Action = { type: 'move', from: 'imperial_basin:9', territory: resident, sector: 10, amount: 1 };
  const sameTypeReplacement: Action = kind === 'mixed'
    ? ordinaryReplacement
    : { type: 'move', from: 'imperial_basin:9', territory: 'oh_gap', sector: 9, amount: 1 };
  const sourceGroups = sourceLocations.map(source => ({ source, available: player.forces[source],
    selected: forces[source as keyof typeof forces], advisors: source.startsWith('imperial_basin:') && kind === 'mixed' }));
  return { game, source: structuredClone(game), beforeAction: structuredClone(game), initial, enableSkills, lobby, setup,
    beforeStartingDeal, beforeSkillOrder, originalSkillOrder, skillOrder, skillOffers, skillChoices, afterSetup, advisorSetup,
    funding, fundingAction, fundingStep: { actor: emperor, action: fundingAction } satisfies AdvisorGatherMatchingStep,
    firstShipment, outsiderShipment, intrusion, beforeSecondShipment, secondShipment,
    kind, bg, owner: bg, holder, atreides: holder, emperor, karama: karama.id, card: karama.id,
    skill: 'planetologist' as const, trainer, resident, territory: resident, location, destination: resident, destinationLocation: location,
    sourceLocations, sourceGroups, sourceCounts: { 'imperial_basin:9': 2, 'oh_gap:9': 1 }, residentCount: player.forces[location],
    actor: bg, forces, group: forces, cost: 0, action,
    largerPacket, largerBasinPacket: largerPacket, replacement: largerPacket,
    replacements: [largerPacket, emptyReplacement, ordinaryReplacement, sameTypeReplacement],
    emptyReplacement, ordinaryReplacement, ordinaryBasinToArrakeen: ordinaryReplacement, sameTypeReplacement,
    incomingStances: { imperial_basin: kind === 'mixed' ? 'advisors' : 'fighters', oh_gap: 'fighters' },
    matchingCount: kind === 'mixed' ? 1 : 2,
    gatherStep: { actor: bg, action } satisfies AdvisorGatherMatchingStep,
    steps, actions: steps, sourceActionCount: steps.length, originalInventory, originalSkillInventory,
    originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced BG/Atreides/Emperor lobby selects only all14 Leader Skills through moduleOption, then ready/startPreview with original base33. No Homeworld, Nexus, Tech, Stronghold, Discovery or independent-card module is selected.',
      'Before BG’s actual prediction and the original Skill/Treachery deals, reorder only the untouched all14 Skill Deck and three original unopened Treachery positions. The native two-card offer really contains Planetologist; BG assigns it through its real leaderSkill action to a living eligible native trainer. The other two original skill offers are actually confirmed too, and Atreides retains its originally dealt Karama.',
      'Actual advisorSetup places BG’s original advisor beside Atreides’ native ten Arrakeen10 counters. Select four safe original ordinary Spice draws, then run native Storm/dual Spice/Charity/Bidding/Revival and decline original preparation. No advisor ornithopter range is claimed.',
      'Emperor actually bribes one spice to BG. BG really pays four on turn1 to ship two reserves to empty Basin9, then pays two on turn2 to ship one reserve to empty Oh Gap9. The genuine one-spice transfer funds the six-spice programme without installing a wallet; both origins are physically one graph step from Arrakeen10.',
      kind === 'mixed'
        ? 'During its original turn1 movement Emperor really pays to ship one reserve into BG’s Basin group. BG actually accepts Intrusion and all original advisorFlip responses allow the change; separate Spiritual accompaniment is declined. On turn2 this earned incoming advisor group is no longer fresh, while Oh Gap remains a fighter origin.'
        : 'Emperor skips its normal turn without entering Basin. Both earned incoming groups remain fighters; the single originally held Atreides Karama can prevent a later matching check after an earlier check is allowed.',
      'Stop at BG’s real turn2 movement with the original resident Arrakeen advisor, live Planetologist, paid second shipment and unused ordinary move. Return the two-origin gather, a larger original Basin packet, an empty-target alternative and a same-type ordinary replacement; no matching response is installed or answered.',
      'No played phase, force, wallet, hand, Skill assignment, alliance, stance, prevention or movement receipt is installed. Every Skill assignment, source group and advisor lock follows actual original setup or gameplay actions.',
    ] };
}
export type AdvisorGatherMatchingFixture = ReturnType<typeof createAdvisorGatherMatchingFixture>;

export function commitAdvisorGatherMatching(source: Game, fixture: AdvisorGatherMatchingFixture,
  action: Action = fixture.action, steps: AdvisorGatherMatchingStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  const game = actAdvisorGatherMatching(source, fixture.bg, action, steps);
  return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)) };
}
export function finishAdvisorGatherMatching(source: Game, steps: AdvisorGatherMatchingStep[] = []): Game {
  return advanceAdvisorGatherMatching(source, game => advisorGatherMatchingClean(game), steps);
}
