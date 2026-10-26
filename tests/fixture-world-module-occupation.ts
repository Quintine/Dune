import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { distance } from '../game/board';
import { DISCOVERY_CARD_PLACEMENTS } from '../game/discoveries';
import { discoveryAction } from '../game/discovery-options';
import { discoveryEntryMoveAction } from '../game/discovery-entry-options';
import { nativeShipmentSources } from '../game/homeworld-options';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { quoteStableHomeworldOccupation } from '../game/homeworld-stable-occupation';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import { ownedTech } from '../game/tech-tokens';
import { withClassicDiscoveryNexusToken } from './fixture-discovery-classic-nexus';
import {
  actMixedPhaseModules, createMixedPhaseModulesFixture, mixedPhaseModulesClean,
  mixedPhaseModulesInventory, mixedPhaseModulesPlayer, nextMixedPhaseModules,
  type MixedPhaseModulesStep, type MixedPhaseModulesTransition,
} from './fixture-mixed-phase-modules';

export type WorldModuleOccupationOptions = {
  advanced?: boolean; nexus?: boolean; discoveries?: boolean; skills?: boolean;
  tech?: boolean; strongholds?: boolean;
};
export type WorldModuleOccupationStep = MixedPhaseModulesStep;
export type WorldModuleOccupationTransition = MixedPhaseModulesTransition;
export const WORLD_MODULE_OCCUPATION_TRAINING = {
  atreides: 'warmaster', emperor: 'spice-banker', fremen: 'mentat',
} as const;
export const actWorldModuleOccupation = actMixedPhaseModules;
export const worldModuleOccupationClean = mixedPhaseModulesClean;
export const worldModuleOccupationPlayer = mixedPhaseModulesPlayer;
export const worldModuleOccupationInventory = mixedPhaseModulesInventory;

export function nextWorldModuleOccupation(game: Game): WorldModuleOccupationStep | null {
  return nextMixedPhaseModules(game);
}
export function advanceWorldModuleOccupation(game: Game, until: (state: Game) => boolean,
  actions: WorldModuleOccupationStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original World/module source ended before its owned control');
    const next = nextWorldModuleOccupation(game); assert.ok(next);
    game = actWorldModuleOccupation(game, next.actor, next.action, actions);
  }
  throw Error('The original World/module source did not reach its finite boundary');
}
export function finishWorldModuleOccupation(game: Game, actions: WorldModuleOccupationStep[] = []): Game {
  return advanceWorldModuleOccupation(game, state => state.turn === 2 && state.phase === 0 &&
    (worldModuleOccupationClean(state) || state.decision?.kind === 'discoveryEntry'), actions);
}
export function worldModuleOccupationDeferred(game: Game, owner = 'emperor') {
  return viewGame(game, owner).spiceBankerIncome?.deferred.find(row => row.owner === owner)?.amount ?? 0;
}

/** Original physical inventories at the source/settled boundaries only. This
 * does not manufacture hidden deals or assert complete module certification. */
export function worldModuleOccupationComponents(game: Game) {
  const skills = game.leaderSkills ? [...game.leaderSkills.deck,
    ...game.leaderSkills.assignments.map(assignment => assignment.skill),
    ...Object.values(game.leaderSkills.offers).flatMap(offer => offer.cards)].sort() : [];
  if (game.leaderSkills) assert.deepEqual(skills, LEADER_SKILL_CARDS.map(card => card.id).sort());
  const nexus = game.nexusCards?.cards ? [...game.nexusCards.cards.deck, ...game.nexusCards.cards.discard,
    ...Object.values(game.nexusCards.cards.hands).filter(card => card !== null)].sort() : [];
  if (game.nexusCards?.cards) assert.deepEqual(nexus, [...NEXUS_FACTIONS].sort());
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat(), ...(game.spiceResolution?.skipped ?? []),
    ...(game.spiceSequence?.skipped ?? [])].map(card => JSON.stringify(card)).sort();
  const tokens = game.discoveries?.tokens.map(token => `${token.id}:${token.face}`).sort() ?? [];
  if (game.discoveries) assert.equal(tokens.length, 8);
  return { cards: worldModuleOccupationInventory(game), skills, nexus, spice, tokens };
}

/** Public classic A/E/F original33 Worlds, optionally all14, Nexus12,
 * Discovery7/8, Tech and Advanced Strongholds. Actual A Bank10 evacuates all10
 * Caladan normals into held Arrakeen; actual E Bank1 sends an original native
 * normal into empty Caladan. No played army, hand, wallet, skill, qualification,
 * owner, income ledger or clock is installed. Only original unopened scalar,
 * Skill/Spice and supply-token lotteries are selected and disclosed. */
export function createWorldModuleOccupationFixture(options: WorldModuleOccupationOptions = {}) {
  const advanced = options.advanced ?? false, nexus = options.nexus ?? true;
  const discoveries = options.discoveries ?? false, skills = options.skills ?? false;
  const tech = options.tech ?? true, strongholds = options.strongholds ?? advanced;
  const native = 'atreides', owner = 'emperor', last = 'fremen';
  const world = 'homeworld:atreides', card = 'caladan' as const;
  const source = createMixedPhaseModulesFixture({ factions: [native, owner, last], expansions: [],
    advanced, homeworlds: true, nexus, discoveries, skills, tech, strongholds,
    training: skills ? WORLD_MODULE_OCCUPATION_TRAINING : undefined });
  let game = structuredClone(source.game);
  const actions = [...source.actions];
  const act = (actor: string, action: Action) => { game = actWorldModuleOccupation(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceWorldModuleOccupation(game, until, actions); };
  const transition = (run: () => void): WorldModuleOccupationTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  const originalComponents = worldModuleOccupationComponents(source.setup);
  assert.equal(originalComponents.cards.length, 33);
  assert.ok(game.homeworldOccupationPreview && game.homeworldOccupationHistory);
  assert.equal(game.homeworldOccupationHistory.qualifications.length, 0);
  const moduleSpiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  let discoveryPlacement: WorldModuleOccupationTransition | null = null;
  let token: NonNullable<Game['discoveries']>['tokens'][number] | null = null;
  const placement = DISCOVERY_CARD_PLACEMENTS['discovery-hagga-basin'];
  if (discoveries) {
    // This is still the original unopened first blow, after the real first
    // Storm. Its printed token destination is separate from its Spice pile.
    assert.equal(game.turn, 1); assert.equal(game.phase, 1);
    const from = game.spiceDeck.findIndex(card => 'territory' in card && card.discovery === 'discovery-hagga-basin');
    assert.ok(from >= 0);
    const selected = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.unshift(selected);
    moduleSpiceOrder.push({ position: 0, from, card: structuredClone(selected) });
    discoveryPlacement = transition(() => {
      for (let count = 0; count < 100 && !game.discoveries!.tokens.some(candidate => candidate.face === 'cistern' && candidate.status === 'placed'); count++) {
        const next = nextWorldModuleOccupation(game); assert.ok(next);
        // Wrap the actual native action directly: the generic source act's
        // scalar policy must not override this original physical supply draw.
        game = withClassicDiscoveryNexusToken(game, 'cistern', () => applyAction(game, next.actor, next.action));
        actions.push(structuredClone(next));
      }
    });
    token = game.discoveries!.tokens.find(candidate => candidate.face === 'cistern' && candidate.status === 'placed') ?? null;
    assert.ok(token); assert.equal(token.territory, placement.territory); assert.equal(token.sector, placement.sector);
    assert.equal(token.revealedTurn, null);
  }
  reach(state => state.turn === 1 && state.phase === 5 && state.active === native && worldModuleOccupationClean(state));
  const evacuationSources = nativeShipmentSources(viewGame(game, native), 10, 0); assert.ok(evacuationSources);
  const evacuationAction: Action = { type: 'ship', territory: 'arrakeen', sector: 10,
    amount: 10, elite: 0, allyPayment: 0, homeworldSources: evacuationSources };
  const evacuation = transition(() => { act(native, evacuationAction); reach(worldModuleOccupationClean); });
  assert.equal(worldModuleOccupationPlayer(game, native).reserves, 0);
  assert.equal(worldModuleOccupationPlayer(game, native).forces['arrakeen:10'], 20);
  assert.equal(worldModuleOccupationPlayer(evacuation.before, native).spice - worldModuleOccupationPlayer(game, native).spice, 10);
  assert.equal(quoteStableHomeworldOccupation(game, card).entitlement, null);
  let discoveryMovement: WorldModuleOccupationTransition | null = null;
  if (discoveries) {
    assert.equal(distance('arrakeen:10', `${placement.territory}:${placement.sector}`), 3);
    const movement: Action = { type: 'move', from: 'arrakeen:10', amount: 1, elite: 0,
      territory: placement.territory, sector: placement.sector };
    discoveryMovement = transition(() => { act(native, movement); reach(worldModuleOccupationClean); });
    assert.equal(worldModuleOccupationPlayer(game, native).forces['arrakeen:10'], 19);
    assert.equal(worldModuleOccupationPlayer(game, native).forces[`${placement.territory}:${placement.sector}`], 1);
  }
  reach(state => state.phase === 5 && state.active === owner && worldModuleOccupationClean(state));
  const incomingReserveSources = nativeShipmentSources(viewGame(game, owner), 1, 0); assert.ok(incomingReserveSources);
  // Native withdrawal quotes enumerate both Emperor Worlds, including a
  // zero Salusa allocation. Cross-World shipment selects only positive groups,
  // just as the ordinary Homeworld Shipment control does.
  const incomingSources = Object.fromEntries(Object.entries(incomingReserveSources)
    .filter(([, group]) => group.normal + group.elite > 0));
  const invasionQuote = homeworldShipmentChoice(viewGame(game, owner), world, incomingSources);
  assert.equal(invasionQuote.blocked, null); assert.ok(invasionQuote.action);
  const invasionAction = invasionQuote.action;
  const invasion = transition(() => { act(owner, invasionAction); reach(worldModuleOccupationClean); });
  assert.equal(worldModuleOccupationPlayer(invasion.before, owner).spice - worldModuleOccupationPlayer(game, owner).spice, 1);
  assert.deepEqual(game.homeworlds?.custody?.visitors[world]?.[owner], { normal: 1, elite: 0 });
  const qualification = game.homeworldOccupationHistory!.qualifications.find(row => row.world === world && row.player === owner);
  assert.ok(qualification, 'The accepted sole arrival earns the original qualification');
  const stable = quoteStableHomeworldOccupation(game, card);
  assert.equal(stable.blocked, null); assert.ok(stable.entitlement);
  assert.equal(stable.entitlement.qualification, qualification.event);
  assert.equal(stable.entitlement.occupier, owner); assert.equal(stable.entitlement.spice, 2);
  assert.equal(stable.entitlement.ally, null);
  reach(state => state.phase === 5 && state.active === last && worldModuleOccupationClean(state));
  assert.equal(game.order.at(-1), last);
  const techOwner = game.techTokens?.heighliners.owner ?? null;
  const techAmount = game.techTokens?.heighliners.spice ?? 0;
  if (techOwner) assert.equal(techAmount, ownedTech(game.techTokens, techOwner).length);
  const bankerSource = game.spiceBankerIncome?.sources.find(receipt => receipt.source.kind === 'shipment' &&
    receipt.source.bankLegs.some(leg => leg.payer === native && leg.amount === 10)) ?? null;
  if (skills) {
    assert.ok(bankerSource?.grant); assert.equal(bankerSource.grant.owner, owner);
    assert.equal(worldModuleOccupationDeferred(game, owner), 1);
  }
  const trainingActions = actions.filter(step => step.action.type === 'leaderSkill');
  assert.deepEqual(worldModuleOccupationComponents(game), originalComponents);
  homeworldGameIntegrity(game);
  return { ...source, game, sourceGame: structuredClone(game), advanced, nexus, discoveries, skills, tech, strongholds,
    native, owner, banker: skills ? owner : null, world, card, current: last, actor: last,
    action: { type: 'endMovement' } as Action, techOwner, techAmount,
    evacuationSources, evacuationAction, evacuation, incomingReserveSources, incomingSources, invasionQuote, invasionAction, invasion,
    qualification: structuredClone(qualification), entitlement: structuredClone(stable.entitlement),
    moduleSpiceOrder, discoveryPlacement, token: structuredClone(token), discoveryMovement,
    bankerSource: structuredClone(bankerSource), training: skills ? WORLD_MODULE_OCCUPATION_TRAINING : null,
    trainingActions, originalComponents, actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length,
    staging: [] as string[], sourceDisclosure: 'Original public A/E/F base33 setup and optional module controls; unopened Skill/scalar/Spice lotteries only. Discovery selects original Hagga card and Cistern supply lottery, then earns ordinary city-range3 movement, Collection reveal and next-Storm entry. All payments, native counters and occupation events are actual actions.' };
}
export type WorldModuleOccupationFixture = ReturnType<typeof createWorldModuleOccupationFixture>;

/** Original End Movement, automatic occupied Collection2, actual optional
 * inspect/reveal, Mentat Banker and first Stronghold claims. Discovery's next
 * Storm entry is captured as its own genuine control, not a quiet-phase claim. */
export function completeWorldModuleOccupation(f: WorldModuleOccupationFixture, state = f.game) {
  let game = state;
  const actions: WorldModuleOccupationStep[] = [];
  const act = (actor: string, action: Action) => { game = actWorldModuleOccupation(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceWorldModuleOccupation(game, until, actions); };
  const transition = (run: () => void): WorldModuleOccupationTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  const collection = transition(() => { act(f.current, f.action); reach(state => state.phase === 7 && worldModuleOccupationClean(state)); });
  const incomeHistory = game.homeworldOccupiedIncomeHistory?.find(history => history.turn === game.turn &&
    history.queue.some(row => row.world === f.world)); assert.ok(incomeHistory);
  const incomeReceipt = incomeHistory.receipts.find(receipt => receipt.world === f.world); assert.ok(incomeReceipt);
  let revelation: WorldModuleOccupationTransition | null = null;
  if (f.token) revelation = transition(() => {
    const inspect = discoveryAction(viewGame(game, f.native), f.token!.id, false); assert.ok(inspect); act(f.native, inspect);
    const reveal = discoveryAction(viewGame(game, f.native), f.token!.id, true); assert.ok(reveal); act(f.native, reveal);
    assert.equal(game.discoveries!.tokens.find(token => token.id === f.token!.id)!.revealedTurn, 1);
  });
  const mentat = transition(() => { game = finishWorldModuleOccupation(game, actions); });
  const bankerCollection = f.bankerSource ? game.spiceBankerIncome?.collections.find(receipt =>
    receipt.turn === 1 && receipt.grants.includes(f.bankerSource!.cursor)) ?? null : null;
  if (f.skills) assert.ok(bankerCollection);
  let entryAction: Action | null = null, entry: WorldModuleOccupationTransition | null = null;
  const beforeEntry = f.token ? structuredClone(game) : null;
  if (f.token) {
    assert.equal(game.decision?.kind, 'discoveryEntry'); assert.equal(game.decision!.player, f.native);
    const offer = viewGame(game, f.native).discoveryEntry; assert.ok(offer);
    entryAction = discoveryEntryMoveAction(viewGame(game, f.native), offer.sources); assert.ok(entryAction);
    const selected = entryAction;
    entry = transition(() => { act(f.native, selected); });
    assert.equal(worldModuleOccupationPlayer(game, f.native).forces['cistern:0'], 1);
  }
  assert.equal(game.turn, 2); assert.equal(game.phase, 0);
  homeworldGameIntegrity(game);
  assert.deepEqual(worldModuleOccupationComponents(game), f.originalComponents);
  return { game, collection, incomeHistory: structuredClone(incomeHistory), incomeReceipt: structuredClone(incomeReceipt),
    revelation, mentat, bankerCollection: structuredClone(bankerCollection), beforeEntry, entryAction, entry,
    actions, actionCount: actions.length };
}
