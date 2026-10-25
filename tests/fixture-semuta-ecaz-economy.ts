import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { quoteEcazOccupyBattle, type EcazOccupyBattleProfile } from '../game/ecaz-occupy-battle';
import { quoteSpiceCollection } from '../game/board-resolution-quote';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaDisasterWorm, nextSemutaDisasterWorm, passSemutaDisasterWorm, claimSemutaDisasterWorm,
  semutaDisasterWormPlayer, semutaDisasterWormInventory, semutaDisasterWormClean,
} from './fixture-semuta-disaster-worm';

export type SemutaEcazEconomyKind = 'ecazCollection' | 'ecazOccupy';
export type SemutaEcazEconomyStep = { actor: string; action: Action };
export const actSemutaEcazEconomy = actSemutaDisasterWorm;
export const passSemutaEcazEconomy = passSemutaDisasterWorm;
export const claimSemutaEcazEconomy = claimSemutaDisasterWorm;
export const semutaEcazEconomyPlayer = semutaDisasterWormPlayer;
export const semutaEcazEconomyInventory = semutaDisasterWormInventory;
export const semutaEcazEconomyClean = semutaDisasterWormClean;
export const semutaEcazEconomyPhysical = (game: Game) => ({
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, elites: p.elites,
    reserves: p.reserves, tanks: p.tanks, shipped: p.shipped, moved: p.moved, ally: p.ally })),
  spice: game.spice, aid: game.aid, ambassadors: game.ecazAmbassadors,
});

/** Original declarations and private plans remain caller-owned. */
export function nextSemutaEcazEconomy(game: Game): SemutaEcazEconomyStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance) return null;
  if (!game.response && !game.phaseOpening) {
    const ecaz = game.players.find(p => p.faction === 'ecaz');
    if (game.status === 'setup' && game.setupStage === 'forces' && ecaz?.reserves === 20 &&
        viewGame(game, ecaz.id).setupPending.includes(ecaz.id))
      return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:9': 6 } } };
    const decision = game.decision;
    if (decision?.kind === 'richeseAllyOpportunity')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision?.kind === 'ecazPlacement' || decision?.kind === 'ecazAmbassador' ||
        decision?.kind === 'ecazBattleLead' || decision?.kind === 'ecazSpice') return null;
  }
  return nextSemutaDisasterWorm(game);
}
export const nextSemutaEcazEconomyStep = nextSemutaEcazEconomy;
export function advanceSemutaEcazEconomy(game: Game, until: (state: Game) => boolean,
  actions: SemutaEcazEconomyStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaEcazEconomy(game);
    assert.ok(step, `Choose the original Ecaz/private control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaEcazEconomy(game, step.actor, step.action, actions);
  }
  throw Error('The native Ecaz economy programme did not reach its finite boundary');
}
export function allowSemutaEcazEconomy(game: Game, actions: SemutaEcazEconomyStep[] = []): Game {
  const kind = game.response?.kind; assert.ok(kind === 'ecazOccupy' || kind === 'ecazCollection');
  for (let count = 0; game.response?.kind === kind && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaEcazEconomy(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, kind); return game;
}
/** Finish only original checks/preparation; no private plan is sealed. A
 * Collection caller must explicitly settle any earned shared allocation. */
export function finishSemutaEcazEconomy(game: Game, actions: SemutaEcazEconomyStep[] = []): Game {
  return advanceSemutaEcazEconomy(game, state => state.phase === 6 && !!state.battle &&
    !state.battle.revealed && semutaEcazEconomyClean(state) && !state.battle.preparation &&
    state.battle.preLeader?.closed !== false || state.phase === 7 && semutaEcazEconomyClean(state) &&
      state.ecazCollection?.stage === 'complete', actions);
}

/** Native physical profile for this fixed single-sector, untyped Basic source.
 * It reads the earned original groups, never merges or installs an army. */
export function semutaEcazEconomyProfile(game: Game): EcazOccupyBattleProfile {
  const b = game.battle, occupy = b?.ecazOccupy; assert.ok(b && occupy?.lead);
  const forces = (id: string) => ({ normal: Object.entries(semutaEcazEconomyPlayer(game, id).forces)
    .filter(([key]) => key.startsWith(`${b.territory}:`)).reduce((sum, [, amount]) => sum + amount, 0),
  elite: 0, eliteStrength: 1 as const, freeSupport: true });
  const ecaz = semutaEcazEconomyPlayer(game, occupy.ecaz), ally = semutaEcazEconomyPlayer(game, occupy.ally);
  return quoteEcazOccupyBattle({ advanced: false, battleOrderActor: b.chooser ?? b.attacker,
    ecaz: { id: ecaz.id, faction: 'ecaz', ally: ecaz.ally, forces: forces(ecaz.id) },
    ally: { id: ally.id, faction: ally.faction, ally: ally.ally, forces: forces(ally.id) },
    lead: occupy.lead, canceled: occupy.canceled });
}

/** Actual Basic Ecaz/Richese shared stronghold and chosen Occupy lead. The
 * Advanced-only Collection bonus cannot produce a Basic cancellation source. */
export function createSemutaEcazOccupyFixture(options: {
  lead?: 'ecaz' | 'ally';
} = {}) {
  const kind = 'ecazOccupy' as const, leadChoice = options.lead ?? 'ecaz';
  const owner = 'ecaz', ally = 'richese', holder = 'choam', opponent = 'emperor', spender = 'guild';
  const lead = leadChoice === 'ecaz' ? owner : ally, territory = 'carthag', sector = 11, location = `${territory}:${sector}`;
  let game = createGame('SEMUTAECAZECONOMY', newPlayer(owner, 'Ecaz', 'ecaz'), false, ['ecaz', 'choam']);
  for (const faction of ['richese', 'choam', 'emperor', 'guild'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaEcazEconomyStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaEcazEconomy(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaEcazEconomy(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start' });
  const setup = structuredClone(game); assert.equal(game.status, 'setup'); assert.equal(game.advanced, false);
  assert.equal(game.semutaPreview, true); assert.equal(game.ecazOccupyPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaEcazEconomyInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'), shield = game.deck.find(card => card.kind === 'shield');
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 3);
  assert.ok(printed && shield); assert.equal(ordinary.length, 3);
  const selected = [...ordinary, shield, printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game); reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), cost = printed.id;
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.deepEqual(semutaEcazEconomyPlayer(game, owner).forces, { 'imperial_basin:9': 6 });
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const from = game.spiceDeck.findIndex(card => 'territory' in card && card.territory === 'funeral_plain' && !card.discovery);
  assert.ok(from >= 0); const spiceCard = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.unshift(spiceCard);
  const spiceOrder = [{ position: 0, from, card: structuredClone(spiceCard) }];
  let beforeBid: Game | undefined, bid: SemutaEcazEconomyStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaEcazEconomyPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaEcazEconomy(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaEcazEconomyPlayer(beforeBid, holder).spice - semutaEcazEconomyPlayer(game, holder).spice, 1);
  reach(state => state.phase === 4 && state.decision?.kind === 'ecazPlacement' && !state.response && !state.phaseOpening);
  const selfToken = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz')!;
  const placement = transition(() => {
    act(owner, { type: 'decision', token: selfToken.id, territory });
    reach(state => state.decision?.kind === 'ecazPlacement' && !state.response && !state.phaseOpening);
    act(owner, { type: 'decision', decline: true });
  });
  reach(state => state.phase === 5 && state.active === owner && semutaEcazEconomyClean(state));
  assert.equal(game.storm, 1);
  const ecazShipment = transition(() => {
    act(owner, { type: 'ship', territory, sector, amount: 2, elite: 0, allyPayment: 0 });
    reach(semutaEcazEconomyClean); act(owner, { type: 'endMovement' });
  });
  reach(state => state.phase === 5 && state.active === ally && semutaEcazEconomyClean(state));
  const alliance = transition(() => {
    act(ally, { type: 'ship', territory, sector, amount: 2, elite: 0, allyPayment: 0 });
    reach(state => !state.response && state.pendingAmbassador?.stage === 'offer');
    act(owner, { type: 'decision', event: game.pendingAmbassador!.event, trigger: true, beneficiary: owner, choice: 'alliance' });
    assert.equal(game.pendingAmbassador?.stage, 'allianceReply');
    act(ally, { type: 'decision', event: game.pendingAmbassador!.event, accept: true });
    assert.equal(game.pendingAmbassador?.stage, 'loan');
    act(owner, { type: 'decision', event: game.pendingAmbassador!.event, loan: false });
    reach(semutaEcazEconomyClean);
  });
  assert.equal(semutaEcazEconomyPlayer(game, owner).ally, ally); assert.equal(semutaEcazEconomyPlayer(game, ally).ally, owner);
  assert.equal(semutaEcazEconomyPlayer(game, owner).forces[location], 2); assert.equal(semutaEcazEconomyPlayer(game, ally).forces[location], 2);
  const sharedStronghold = structuredClone(game), basicCollectionQuote = quoteSpiceCollection(game);
  assert.equal(basicCollectionQuote.collectionBonus, null, 'Native Basic has no Advanced shared-stronghold bank income');
  act(ally, { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === opponent && semutaEcazEconomyClean(state));
  const opponentShipment = transition(() => {
    act(opponent, { type: 'ship', territory, sector, amount: 1, elite: 0, allyPayment: 0 });
    reach(semutaEcazEconomyClean); act(opponent, { type: 'endMovement' });
  });
  reach(state => state.phase === 6 && semutaEcazEconomyClean(state) && !!state.active);
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices.find(choice =>
    choice.territory === territory && [choice.attacker, choice.defender].includes(opponent)); assert.ok(choice);
  const battleAction: Action = { type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker };
  act(choice.chooser, battleAction);
  assert.equal(game.decision?.kind, 'ecazBattleLead'); assert.equal(game.decision.player, owner);
  const beforeLead = structuredClone(game), leadAction: Action = { type: 'decision', event: game.decision.event, lead };
  act(game.decision.player, leadAction);
  assert.ok(game.response && game.battle); assert.equal(game.response.kind, 'ecazOccupy');
  assert.equal(game.battle.ecazOccupy?.lead, lead); assert.equal(game.battle.ecazOccupy?.canceled, false);
  assert.deepEqual(game.battle.plans, {}); assert.equal(game.battle.revealed, false);
  const allowedProfile = semutaEcazEconomyProfile(game), canceledProfile = quoteEcazOccupyBattle({
    advanced: false, battleOrderActor: allowedProfile.battleOrderActor,
    ecaz: { id: owner, faction: 'ecaz', ally, forces: allowedProfile.ecazForces },
    ally: { id: ally, faction: 'richese', ally: owner, forces: allowedProfile.allyForces }, lead, canceled: true });
  const ownLeader = semutaEcazEconomyPlayer(game, lead).leaders.filter(l => !l.dead).sort((a, b) => b.strength - a.strength)[0];
  const otherLeader = semutaEcazEconomyPlayer(game, opponent).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(ownLeader && otherLeader);
  const allowedPlan: Action = { type: 'battlePlan', leader: ownLeader.id, dial: allowedProfile.maxDial, support: 0, weapon: null, defense: null };
  const canceledPlan: Action = { ...allowedPlan, dial: canceledProfile.maxDial };
  const opponentPlan: Action = { type: 'battlePlan', leader: otherLeader.id, dial: 0, support: 0, weapon: null, defense: null };
  const source = structuredClone(game), originalBattle = structuredClone(game.battle), originalResponse = structuredClone(game.response);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  assert.deepEqual(semutaEcazEconomyInventory(game), originalInventory);
  return { game, source, beforeCost: source, kind, advanced: false as const, owner, ecaz: owner, ally, richese: ally,
    holder, spender, guild: spender, opponent, recipient: lead, lead, leadChoice, cost, karama: cost, semuta: SEMUTA_DRUG_ID,
    action, originalResponse, originalBattle, collection: structuredClone(game.ecazCollection ?? null),
    originalPhysical: structuredClone(semutaEcazEconomyPhysical(game)), allowedProfile, canceledProfile,
    allowedPlan, canceledPlan, opponentPlan, territory, sector, location, basicCollectionQuote,
    initial, lobby, setup, beforeStartingDeal, afterSetup, deal: selected.map(card => card.id), dealOrder,
    originalInventory, originalSpice, spiceOrder, acquisition, acquired, placement, selfToken: selfToken.id,
    ecazShipment, alliance, sharedStronghold, opponentShipment, beforeBattle, choice, battleAction, beforeLead, leadAction,
    quoteHistory: [{ stage: 'shared-stronghold-basic', quote: basicCollectionQuote },
      { stage: 'occupy-allowed', quote: allowedProfile }, { stage: 'occupy-canceled', quote: canceledProfile }],
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Actual public Basic Ecaz/Richese/CHOAM/Emperor/Guild ready/start with original main35/cache10 and no modules. Only unopened starting-card/Spice positions and scalar lotteries are selected. Guild really receives printed Karama; CHOAM really buys cache Semuta for one.',
      'Ecaz really places its native six in Imperial Basin9, pays for its reusable self-Ambassador at Carthag, then pays two to ship two original reserves to Carthag11. Richese really pays two for its own two-counter entry. Ecaz triggers its printed alliance option, Richese actually accepts, and Ecaz declines the optional Duke loan. The real alliance leaves both native groups in the shared stronghold.',
      'Emperor really pays one to enter that shared coalition stronghold. Original chooseBattle creates the native lead chooser; Ecaz actually selects the requested Ecaz/Richese lead. Stop at its original Occupy counter before Guild spends printed Karama; no plan is sealed and no combined dial is pre-applied.',
      'No played hand, wallet, forces, alliance, token, battle, clock or response is installed. The native Basic Collection quote has no Advanced bank bonus. The separate Advanced Collection source uses its explicit original fresh development entry; this Basic source gains no Advanced income.',
    ],
  };
}
export type SemutaEcazOccupyFixture = ReturnType<typeof createSemutaEcazOccupyFixture>;

/** Explicit fresh Advanced development source, never a public Semuta start or
 * played Basic conversion. Original R/C/Ecaz/E setup, paid cache, paid city
 * entries and Ambassador alliance earn the actual shared bank-income source. */
export function createSemutaEcazCollectionFixture() {
  const owner = 'ecaz', ally = 'richese', holder = 'choam', spender = 'emperor';
  const territory = 'carthag', sector = 11, location = `${territory}:${sector}`;
  let game = createGame('SEMUTAECAZCOLLECTION', newPlayer(ally, 'Richese', 'richese'), true, ['choam', 'ecaz']);
  for (const faction of ['choam', 'ecaz', 'emperor'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaEcazEconomyStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaEcazEconomy(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaEcazEconomy(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: 'explicit-original-advanced-ecaz-semuta-initializer' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.equal(game.ecazOccupyPreview, true); assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaEcazEconomyInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama');
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 3);
  assert.ok(printed); assert.equal(ordinary.length, 3);
  const selected = [...ordinary, printed], dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game); reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), cost = printed.id;
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (const [position, face] of ['funeral_plain', 'hagga_basin'].entries()) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && card.territory === face && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  let beforeBid: Game | undefined, bid: SemutaEcazEconomyStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaEcazEconomyPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaEcazEconomy(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaEcazEconomyPlayer(beforeBid, holder).spice - semutaEcazEconomyPlayer(game, holder).spice, 1);
  reach(state => state.phase === 4 && state.decision?.kind === 'ecazPlacement' && !state.response && !state.phaseOpening);
  const selfToken = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz')!;
  const placement = transition(() => {
    act(owner, { type: 'decision', token: selfToken.id, territory });
    reach(state => state.decision?.kind === 'ecazPlacement' && !state.response && !state.phaseOpening);
    act(owner, { type: 'decision', decline: true });
  });
  reach(state => state.phase === 5 && state.active === ally && semutaEcazEconomyClean(state));
  const alliance = transition(() => {
    act(ally, { type: 'ship', territory, sector, amount: 2, elite: 0, allyPayment: 0 });
    reach(state => !state.response && state.pendingAmbassador?.stage === 'offer');
    act(owner, { type: 'decision', event: game.pendingAmbassador!.event, trigger: true, beneficiary: owner, choice: 'alliance' });
    assert.equal(game.pendingAmbassador?.stage, 'allianceReply');
    act(ally, { type: 'decision', event: game.pendingAmbassador!.event, accept: true });
    reach(semutaEcazEconomyClean);
  });
  assert.equal(semutaEcazEconomyPlayer(game, owner).ally, ally); assert.equal(semutaEcazEconomyPlayer(game, ally).ally, owner);
  const afterAlliance = structuredClone(game); act(ally, { type: 'endMovement' });
  reach(state => state.phase === 5 && state.active === holder && semutaEcazEconomyClean(state));
  const ordinaryShipment = transition(() => {
    act(holder, { type: 'ship', territory: 'funeral_plain', sector: 15, amount: 1, elite: 0, allyPayment: 0 });
    reach(semutaEcazEconomyClean); act(holder, { type: 'endMovement' });
  });
  assert.equal(semutaEcazEconomyPlayer(ordinaryShipment.before, holder).spice - semutaEcazEconomyPlayer(game, holder).spice, 2);
  reach(state => state.phase === 5 && state.active === owner && semutaEcazEconomyClean(state));
  const ecazShipment = transition(() => {
    act(owner, { type: 'ship', territory, sector, amount: 2, elite: 0, allyPayment: 0 });
    reach(semutaEcazEconomyClean); act(owner, { type: 'endMovement' });
  });
  const sharedStronghold = structuredClone(game);
  assert.equal(semutaEcazEconomyPlayer(game, owner).forces[location], 2); assert.equal(semutaEcazEconomyPlayer(game, ally).forces[location], 2);
  reach(state => state.phase === 7 && state.response?.kind === 'ecazCollection');
  assert.ok(game.ecazCollection && game.response); assert.equal(game.ecazCollection.stage, 'response');
  assert.equal(game.response.owner, owner); assert.ok(!game.battle && !game.pendingAmbassador && !game.decision && !game.phaseOpening);
  const allowedQuote = quoteSpiceCollection(game), canceledQuote = quoteSpiceCollection(game, true);
  assert.ok(allowedQuote.collectionBonus); assert.equal(allowedQuote.collectionBonus.owner, owner);
  assert.equal(allowedQuote.collectionBonus.ally, ally);
  assert.ok(allowedQuote.collectionBonus.amount > 0); assert.deepEqual(allowedQuote.collectionBonus.strongholds, [territory]);
  assert.deepEqual(allowedQuote.shared, []); assert.deepEqual(canceledQuote.shared, []);
  assert.ok(canceledQuote.receipts.find(receipt => receipt.player === holder)!.desert > 0);
  const source = structuredClone(game), originalResponse = structuredClone(game.response), collection = structuredClone(game.ecazCollection);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  assert.deepEqual(semutaEcazEconomyInventory(game), originalInventory);
  return { game, source, beforeCost: source, kind: 'ecazCollection' as const, advanced: true as const, owner, ecaz: owner,
    ally, richese: ally, holder, spender, opponent: spender, recipient: owner, cost, karama: cost, semuta: SEMUTA_DRUG_ID,
    action, originalResponse, originalBattle: null, collection, originalCollection: collection,
    originalPhysical: structuredClone(semutaEcazEconomyPhysical(game)), allowedQuote, canceledQuote,
    territory, sector, location, initial, lobby, setup, initialization, beforeStartingDeal, afterSetup,
    deal: selected.map(card => card.id), dealOrder, originalInventory, originalSpice, spiceOrder, acquisition, acquired,
    placement, selfToken: selfToken.id, alliance, afterAlliance, ordinaryShipment, ecazShipment, sharedStronghold,
    quoteHistory: [{ stage: 'collection-allowed', quote: allowedQuote }, { stage: 'collection-canceled', quote: canceledQuote }],
    actions, steps: actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Explicit original fresh Advanced Ecaz Semuta development initializer on the ready undealt R/C/Ecaz/E lobby, exact CHOAM+Ecaz, original main35/cache10 and no modules. Public start/publication gates remain separate; no played Basic conversion occurs.',
      'Only unopened original starting-card/Spice positions and scalar lotteries are selected. Emperor really receives printed Karama; CHOAM really purchases cache Semuta for one. Ecaz actually places native six in Basin9 and pays for its self-Ambassador at Carthag.',
      'Richese really pays two for two original counters entering Carthag11. Ecaz actually triggers its alliance option and Richese accepts; native Advanced logic automatically grants the available Duke without a fabricated Basic loan reply. CHOAM really pays two for one counter at the original Funeral Plain15 spice blow, then Ecaz really pays two for its own two-counter city entry. Their actual shared stronghold earns the special bonus; CHOAM’s real desert cohort separately earns positive ordinary Collection.',
      'Other real movement and empty Battle controls complete. The native Advanced Collection quote opens its positive shared-stronghold response before credit. Both allowed/canceled quotes are read from that original source; ordinary Collection receipts stay native. No hand, wallet, force, token, ally, leader, phase, income or pending frame is installed.',
    ],
  };
}
export type SemutaEcazCollectionFixture = ReturnType<typeof createSemutaEcazCollectionFixture>;
export type SemutaEcazEconomyFixture = SemutaEcazOccupyFixture | SemutaEcazCollectionFixture;
export function createSemutaEcazEconomyFixture(options: { kind: 'ecazCollection'; lead?: 'ecaz' | 'ally' }): SemutaEcazCollectionFixture;
export function createSemutaEcazEconomyFixture(options?: { kind?: 'ecazOccupy'; lead?: 'ecaz' | 'ally' }): SemutaEcazOccupyFixture;
export function createSemutaEcazEconomyFixture(options: { kind?: SemutaEcazEconomyKind; lead?: 'ecaz' | 'ally' }): SemutaEcazEconomyFixture;
export function createSemutaEcazEconomyFixture(options: { kind?: SemutaEcazEconomyKind; lead?: 'ecaz' | 'ally' } = {}): SemutaEcazEconomyFixture {
  return options.kind === 'ecazCollection' ? createSemutaEcazCollectionFixture() : createSemutaEcazOccupyFixture(options);
}
