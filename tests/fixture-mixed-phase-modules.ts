import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { TERRITORIES, MOBILE_STRONGHOLD, location, territory } from '../game/board';
import type { FactionId } from '../game/catalog';
import { withNativeShipmentSources } from '../game/homeworld-options';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { actAdvisorPreparation } from './fixture-advisor-preparation';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import { skillOfferRolls } from './fixture-independent-card-modules';

export type MixedPhaseModulesStep = { actor: string; action: Action };
export type MixedPhaseModulesTransition = { before: Game; steps: MixedPhaseModulesStep[]; after: Game };
export type MixedPhaseModulesOptions = {
  factions: readonly FactionId[];
  expansions: Game['expansions'];
  advanced?: boolean;
  tech?: boolean;
  strongholds?: boolean;
  independent?: boolean;
  homeworlds?: boolean;
  skills?: boolean;
  training?: Partial<Record<FactionId, LeaderSkillId>>;
};
export const MIXED_PHASE_NATIVE_FACTIONS = ['ixians', 'tleilaxu', 'choam', 'richese', 'ecaz', 'moritani'] as const;
export const actMixedPhaseModules = actAdvisorPreparation;
export const mixedPhaseModulesPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const mixedPhaseModulesClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.pendingTreacheryDiscard && !game.pendingRevival && !game.truthtrance &&
  !game.pendingShipment && !game.pendingKarama && !game.currentAuctionSale;

/** Current physical zones, excluding the ordinary auction's historical aliases. */
export function mixedPhaseModulesInventory(game: Game): string[] {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? []),
    ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Each original physical Treachery Card has one current slot');
  return ids;
}

/** Native decisions only. Optional Terror placement is declined so the positive
 * shipment source does not depend on a separately selected Terror effect. */
export function nextMixedPhaseModules(game: Game): MixedPhaseModulesStep | null {
  if (!game.phaseOpening && !game.response && !game.pendingTreacheryDiscard && game.decision) {
    const d = game.decision;
    if (d.kind === 'moritaniSetup') return { actor: d.player,
      action: { type: 'decision', territory: 'carthag', sector: territory('carthag').sectors[0] } };
    if (d.kind === 'moritaniPlacement' || d.kind === 'choamStorm' || d.kind === 'choamMovement' ||
      d.kind === 'revivalStop') return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d.kind === 'guildTiming') return { actor: d.player, action: { type: 'decision', take: false } };
    if (d.kind === 'techToken') return { actor: d.player, action: { type: 'decision', token: d.choices[0] } };
    if (d.kind === 'richeseUnbid') return { actor: d.player,
      action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  }
  return nextRicheseStrongholdsNativeStep(game);
}
export function advanceMixedPhaseModules(game: Game, until: (state: Game) => boolean,
  actions: MixedPhaseModulesStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original phase-module source ended before its requested boundary');
    const step = nextMixedPhaseModules(game);
    assert.ok(step, `Original continuation required at ${game.status}/${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actMixedPhaseModules(game, step.actor, step.action, actions);
  }
  throw Error('The original phase-module source did not reach its finite boundary');
}
export function finishMixedPhaseModules(game: Game, actions: MixedPhaseModulesStep[] = []): Game {
  const phase = game.phase, turn = game.turn;
  return advanceMixedPhaseModules(game, state => (state.phase !== phase || state.turn !== turn) && mixedPhaseModulesClean(state), actions);
}

/** Choose only the original undealt skill lottery. Native UUID/byte entropy
 * stays native, and later scalar draws retain the existing source policy. */
function startWithSkillOffers(game: Game, actor: string, action: Action,
  training: Partial<Record<FactionId, LeaderSkillId>>, actions: MixedPhaseModulesStep[]): Game {
  const rolls = skillOfferRolls(game, training), descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(original, crypto, [array]);
    return array;
  };
  try {
    const next = applyAction(game, actor, action);
    actions.push({ actor, action: structuredClone(action) }); return next;
  } finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}

/** Public module selections, ready/start and every original setup decision.
 * Only scalar lotteries and unopened Spice positions are selected. No played
 * card, force, wallet, Tanks, phase, token or Stronghold owner is installed. */
export function createMixedPhaseModulesFixture(options: MixedPhaseModulesOptions) {
  const [host, ...others] = options.factions; assert.ok(host);
  let game = createGame('MIXEDPHASEMODULES', newPlayer(host, host, host), options.advanced ?? false, options.expansions);
  for (const faction of others) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: MixedPhaseModulesStep[] = [];
  const act = (actor: string, action: Action) => { game = actMixedPhaseModules(game, actor, action, actions); };
  if (options.homeworlds) act(host, { type: 'homeworlds', enabled: true });
  if (options.skills) act(host, { type: 'moduleOption', module: 'leaderSkills', enabled: true });
  if (options.independent) act(host, { type: 'moduleOption', module: 'ecazTreachery', enabled: true });
  if (options.tech) act(host, { type: 'techTokens', enabled: true });
  if (options.strongholds) act(host, { type: 'strongholdCards', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  // Fill unspecified seats without consuming a role requested for a later
  // seat. The resulting full map still selects only the original lottery.
  let training: Partial<Record<FactionId, LeaderSkillId>> | undefined;
  if (options.skills && options.training) {
    training = {};
    const requested = game.players.flatMap(player => options.training?.[player.faction] ?? []);
    const chosen = new Set<LeaderSkillId>();
    for (const player of game.players) {
      const skill = options.training[player.faction] ?? LEADER_SKILL_CARDS.find(card =>
        !requested.includes(card.id) && !chosen.has(card.id))?.id;
      assert.ok(skill && !chosen.has(skill), 'Choose distinct original skill offers');
      training[player.faction] = skill; chosen.add(skill);
    }
  }
  const start: Action = options.advanced ? { type: 'start', advancedPreview: true } : { type: 'start' };
  if (training) game = startWithSkillOffers(game, host, start, training, actions);
  else act(host, start);
  const setup = structuredClone(game); assert.equal(game.status, 'setup');
  if (!options.skills) assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = mixedPhaseModulesInventory(game);
  if (options.skills) {
    for (let count = 0; game.status === 'setup' && count < 300; count++) {
      if (!game.decision && !game.response && !game.phaseOpening && game.setupStage === 'leaderSkills') {
        const actor = Object.keys(game.leaderSkills!.offers)[0]; assert.ok(actor);
        const own = viewGame(game, actor).leaderSkills!;
        const player = mixedPhaseModulesPlayer(game, actor);
        const skill = training?.[player.faction] ?? own.offer?.cards.find(card => !own.unavailableSkills?.[card]);
        const leader = own.eligibleLeaders[0];
        assert.ok(own.offer && skill && own.offer.cards.includes(skill) && !own.unavailableSkills?.[skill] && leader,
          'Choose one currently offered original skill and an eligible own leader');
        act(actor, { type: 'leaderSkill', event: own.offer.event, skill, leader: leader.id });
      } else {
        const next = nextMixedPhaseModules(game); assert.ok(next); act(next.actor, next.action);
      }
    }
    assert.equal(game.status, 'playing');
  } else game = advanceMixedPhaseModules(game, state => state.status === 'playing', actions);
  const afterSetup = structuredClone(game);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1, 2, 3].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position);
    const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  game = advanceMixedPhaseModules(game, state => state.phase === 1 && mixedPhaseModulesClean(state), actions);
  const firstStorm = structuredClone(game);
  assert.deepEqual(mixedPhaseModulesInventory(game), originalInventory);
  return { game, sourceGame: structuredClone(game), independent: options.independent ?? false,
    homeworlds: options.homeworlds ?? false,
    skills: options.skills ?? false,
    initial, lobby, setup, afterSetup, firstStorm,
    originalInventory, originalSpice, spiceOrder, actions, sourceActions: structuredClone(actions),
    sourceActionCount: actions.length, staging: [] as string[] };
}

/** Actual all-six-native two-turn programme. The first two positive shipments
 * accrue Heighliners once; native first Mentat claims precede a real later
 * Storm casualty (Basic dials2 / Advanced card1) and that owner's free return. Sources remain ordinary public
 * entry plus original native choices, with no played-state installation. */
export function createMixedPhaseModulesProgramme(options: {
  advanced?: boolean; strongholds?: boolean; independent?: boolean; homeworlds?: boolean;
  skills?: boolean; training?: Partial<Record<FactionId, LeaderSkillId>>;
} = {}) {
  const advanced = options.advanced ?? false, strongholds = options.strongholds ?? advanced;
  const source = createMixedPhaseModulesFixture({ factions: MIXED_PHASE_NATIVE_FACTIONS,
    expansions: ['ix', 'choam', 'ecaz'], advanced, tech: true, strongholds,
    independent: options.independent, homeworlds: options.homeworlds,
    skills: options.skills, training: options.training });
  let game = source.game;
  const actions = [...source.actions];
  const act = (actor: string, action: Action) => { game = actMixedPhaseModules(game, actor, action, actions); };
  const ship = (actor: string, action: Action) => {
    const selected = game.homeworlds ? withNativeShipmentSources(viewGame(game, actor), action) : action;
    assert.ok(selected, 'The current native World pools must fund the exact typed shipment');
    act(actor, selected);
  };
  const reach = (until: (state: Game) => boolean) => { game = advanceMixedPhaseModules(game, until, actions); };
  const transition = (run: () => void): MixedPhaseModulesTransition => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  reach(state => state.turn === 1 && state.phase === 5 && state.active === 'choam' && mixedPhaseModulesClean(state));
  const tabr = territory('sietch_tabr').sectors[0], choamLocation = location('sietch_tabr', tabr);
  assert.ok(game.players.every(player => !player.forces[choamLocation]));
  const choamShipment = transition(() => {
    ship('choam', { type: 'ship', territory: 'sietch_tabr', sector: tabr, amount: 1, elite: 0, allyPayment: 0 });
    reach(mixedPhaseModulesClean);
  });
  reach(state => state.turn === 1 && state.phase === 5 && state.active === 'moritani' && mixedPhaseModulesClean(state));
  const sector = game.storm % 18 + 1;
  const target = TERRITORIES.find(t => t.type === 'sand' && t.id !== 'imperial_basin' && t.sectors.includes(sector) &&
    game.players.every(player => !Object.entries(player.forces).some(([key, count]) => count > 0 && key.startsWith(`${t.id}:`))));
  assert.ok(target, 'The next original Storm sector has an empty desert shipment destination');
  const casualtyLocation = location(target.id, sector);
  const moritaniShipment = transition(() => {
    ship('moritani', { type: 'ship', territory: target.id, sector, amount: 1, elite: 0, allyPayment: 0 });
    reach(mixedPhaseModulesClean);
  });
  // Capture the actual phase-closing action, rather than folding later income
  // into the Heighliners receipt.
  reach(state => state.phase === 5 && mixedPhaseModulesClean(state) &&
    state.order.at(-1) === state.active);
  const shipmentPayout = transition(() => {
    act(game.active!, { type: 'endMovement' });
    reach(state => state.phase !== 5);
  });
  reach(state => state.turn === 1 && state.phase === 8 && mixedPhaseModulesClean(state));
  const mentat = transition(() => {
    reach(state => state.turn === 2 && state.phase === 0 && state.stormPending !== null && mixedPhaseModulesClean(state));
  });
  assert.equal(game.stormMovementSource?.kind, advanced ? 'card' : 'dials'); assert.equal(game.stormPending, advanced ? 1 : 2);
  const storm = transition(() => { reach(state => state.turn === 2 && state.phase === 1 && mixedPhaseModulesClean(state)); });
  assert.equal(mixedPhaseModulesPlayer(game, 'moritani').forces[casualtyLocation], undefined);
  assert.equal(mixedPhaseModulesPlayer(game, 'moritani').tanks, 1);
  reach(state => state.turn === 2 && state.phase === 4 && mixedPhaseModulesClean(state) &&
    (!state.revivalOrder || state.revivalOrder.remaining[0] === 'moritani'));
  const revival = transition(() => {
    act('moritani', { type: 'revive', amount: 1, elite: 0 }); reach(mixedPhaseModulesClean);
  });
  // Complete earlier/remaining owned opportunities with the original ready
  // controls, and expose only the final phase-end token payout as its receipt.
  reach(state => state.phase === 4 && mixedPhaseModulesClean(state) && (state.revivalOrder
    ? state.revivalOrder.remaining.length === 1 : state.ready.length === state.players.length - 1));
  const revivalPayout = transition(() => {
    const step = nextMixedPhaseModules(game); assert.ok(step); act(step.actor, step.action);
    reach(state => state.phase === 5 && mixedPhaseModulesClean(state));
  });
  assert.equal(game.phase, 5);
  reach(state => state.phase === 5 && mixedPhaseModulesClean(state));
  assert.deepEqual(mixedPhaseModulesInventory(game), source.originalInventory);
  if (strongholds) {
    assert.equal(mentat.after.strongholdCards?.owners.carthag, 'moritani');
    assert.equal(mentat.after.strongholdCards?.owners.sietch_tabr, 'choam');
    assert.equal(mentat.after.strongholdCards?.owners[MOBILE_STRONGHOLD], 'ixians');
  }
  return { ...source, game, sourceGame: structuredClone(game), advanced, strongholds,
    choamLocation, casualtyLocation, choamShipment, moritaniShipment, shipmentPayout, mentat, storm,
    revival, revivalPayout, actions, sourceActions: structuredClone(actions), sourceActionCount: actions.length };
}
