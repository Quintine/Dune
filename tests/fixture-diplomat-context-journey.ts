import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { type Card } from '../game/cards';
import { homeworldContext, homeworldGameIntegrity } from '../game/homeworld-game';
import { homeworldForceGroups } from '../game/homeworld-custody';
import { homeworldShipmentChoice } from '../game/homeworld-shipment-options';
import { validateLeaderSkills } from '../game/leader-skills';
import { initializeAdvancedNativeSkillsSetup } from './fixture-advanced-native-skills';
import { nextNativeSkillsStrongholdStep } from './fixture-native-skills-stronghold';

export type DiplomatContextStep = { actor: string; action: Action };
export type DiplomatContextTransition = { before: Game; step: DiplomatContextStep; after: Game };
export type DiplomatContextKind = 'homeworld' | 'held-carthag' | 'empty-carthag';
export type DiplomatContextFixture = {
  initial: Game;
  offered: Game;
  afterSetup: Game;
  training: DiplomatContextTransition[];
  shipments: DiplomatContextTransition[];
  firstMentat: DiplomatContextTransition | null;
  game: Game;
  owner: string;
  opponent: string;
  trainer: string;
  enemyLeader: string;
  territory: string;
  kind: DiplomatContextKind;
  worthless: string;
  source: string | null;
  ownWeapon: string;
  enemyWeapon: string;
  plans: [DiplomatContextStep, DiplomatContextStep];
  steps: DiplomatContextStep[];
  staging: string[];
};

export const diplomatContextQuiet = (game: Game) =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
const plansReady = (game: Game) => diplomatContextQuiet(game) && !!game.battle &&
  !game.battle.preparation && game.battle.preLeader?.closed !== false;
export const diplomatContextPlayer = (game: Game, actor: string) => {
  const player = game.players.find(p => p.id === actor); assert.ok(player); return player;
};

/** Scalar shuffle/Storm draws only; UUID byte arrays retain native entropy.
 * The original all14 skill shuffle is still controlled by its existing helper. */
function scalarEntropy<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function applyDiplomatContextStep(game: Game, step: DiplomatContextStep): Game {
  return scalarEntropy(() => applyAction(game, step.actor, step.action));
}
export function nextDiplomatContextStep(game: Game): DiplomatContextStep {
  const decision = game.decision;
  if (decision?.kind === 'homeworldShipmentGuild') return { actor: decision.player,
    action: { type: 'decision', event: decision.event, allow: true } };
  if (decision?.kind === 'homeworldDefense' || decision?.kind === 'diplomatDefense')
    throw Error('Stop at the original human late-defense/copy choice.');
  const next = nextNativeSkillsStrongholdStep(game);
  assert.ok(next, 'A genuine contextual programme needs a native continuation.'); return next;
}
export function advanceDiplomatContext(
  state: Game, until: (game: Game) => boolean, steps: DiplomatContextStep[] = [],
): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1800; n++) {
    assert.equal(game.status, 'playing');
    const step = nextDiplomatContextStep(game); steps.push(structuredClone(step));
    game = applyDiplomatContextStep(game, step);
  }
  assert.ok(until(game), 'Original contextual programme did not reach its requested boundary.'); return game;
}

/** All physical counters, including foreign Homeworld visitors, retain custody. */
export function assertDiplomatContextCustody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  if (game.homeworlds) homeworldGameIntegrity(game);
  const homes = game.homeworlds?.custody
    ? homeworldForceGroups(homeworldContext(game), game.homeworlds.custody) : [];
  for (const player of game.players) {
    const visitors = homes.filter(home => home.native !== player.id)
      .map(home => home.forces[player.id] ?? { normal: 0, elite: 0 });
    const sum = (groups: Record<string, number>) => Object.values(groups).reduce((a, b) => a + b, 0);
    assert.equal(player.reserves + player.tanks + sum(player.forces) +
      visitors.reduce((n, pool) => n + pool.normal + pool.elite, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks + sum(player.elites.forces) +
      visitors.reduce((n, pool) => n + pool.elite, 0), 5);
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? [])];
  assert.equal(new Set(cards.map(card => card.id)).size, cards.length);
}

/** Genuine Emperor/Richese/Guild setup, original paid shipment and original
 * END Mentat. No army, wallet, clock, initiative, owner or receipt is assigned.
 * Conserved physical card staging below is deliberately NOT an acquisition. */
export function createDiplomatContextJourney(options: { initial?: Game; kind?: DiplomatContextKind } = {}): DiplomatContextFixture {
  const kind = options.kind ?? 'homeworld';
  let game = options.initial ? structuredClone(options.initial)
    : createGame('DIPLOMATCONTEXT', newPlayer('emperor', 'Emperor', 'emperor'), true, ['choam']);
  if (!options.initial) for (const faction of ['richese', 'guild'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  assert.equal(game.status, 'lobby'); assert.equal(game.advanced, true);
  assert.deepEqual(game.players.map(p => p.faction).sort(), ['emperor', 'guild', 'richese']);
  if (kind === 'homeworld' && !game.homeworlds)
    game = applyAction(game, game.host, { type: 'homeworlds', enabled: true });
  if (kind !== 'homeworld' && !game.strongholdCards)
    game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  assert.equal(!!game.homeworlds, kind === 'homeworld');
  assert.equal(!!game.strongholdCards, kind !== 'homeworld');
  const initial = structuredClone(game), steps: DiplomatContextStep[] = [];
  const owner = game.players.find(p => p.faction === 'emperor')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  game = scalarEntropy(() => initializeAdvancedNativeSkillsSetup({ family: 'richese',
    requestedSkill: 'diplomat', skillOwner: 'emperor', opponents: ['guild'], initial: game }));
  const offered = structuredClone(game), training: DiplomatContextTransition[] = [];
  const act = (step: DiplomatContextStep) => {
    steps.push(structuredClone(step)); game = applyDiplomatContextStep(game, step); return game;
  };
  for (let n = 0; game.status === 'setup' && n < 200; n++) {
    let step: DiplomatContextStep;
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor], view = viewGame(game, actor).leaderSkills!;
      const skill = actor === owner ? 'diplomat' : offer.cards.find(card => !view.unavailableSkills?.[card]);
      const leaders = diplomatContextPlayer(game, actor).leaders
        .filter(leader => view.eligibleLeaders.some(candidate => candidate.id === leader.id))
        .sort((a, b) => b.strength - a.strength);
      assert.ok(skill && offer.cards.includes(skill) && leaders[0]);
      step = { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leaders[0].id } };
    } else step = nextDiplomatContextStep(game);
    const before = structuredClone(game); act(step);
    if (step.action.type === 'leaderSkill') training.push({ before, step, after: structuredClone(game) });
  }
  assert.equal(game.status, 'playing'); const afterSetup = structuredClone(game);
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === owner && a.skill === 'diplomat')!.leader;
  const staging = [
    'Original fresh native all14 shuffle offers Diplomat to Emperor; real setup actions select the strongest eligible trainer. Scalar native shuffle and Storm draws are controlled, UUID entropy is untouched.',
    'Move six original unopened non-worm Spice Cards to the deck front; no spice pile, phase, force, wallet, owner or battle receipt is staged.',
  ];
  const land = game.spiceDeck.filter(card => 'territory' in card).slice(0, 6);
  for (const [position, card] of land.entries())
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  const reach = (until: (state: Game) => boolean) => {
    game = advanceDiplomatContext(game, until, steps); return game;
  };
  const shipments: DiplomatContextTransition[] = [];
  const ship = (actor: string, action: Action) => {
    const before = structuredClone(game), step = { actor, action }; act(step);
    reach(state => diplomatContextQuiet(state) && !state.pendingShipment && !state.pendingHomeworldShipment);
    shipments.push({ before, step, after: structuredClone(game) });
  };
  let firstMentat: DiplomatContextTransition | null = null;
  if (kind !== 'homeworld') {
    reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && diplomatContextQuiet(state));
    ship(owner, { type: 'ship', territory: 'carthag', sector: 11, amount: 1, allyPayment: 0 });
    reach(state => state.phase === 8 && diplomatContextQuiet(state));
    assert.equal(game.strongholdCards!.owners.carthag, null);
    while (game.turn === 1) {
      const before = structuredClone(game), step = nextDiplomatContextStep(game), after = act(step);
      if (after.turn === 2) firstMentat = { before, step, after: structuredClone(after) };
    }
    assert.ok(firstMentat); assert.equal(game.strongholdCards!.owners.carthag, owner);
    reach(state => state.turn === 2 && state.phase === 5 && state.active === opponent && diplomatContextQuiet(state));
    ship(opponent, { type: 'ship', territory: 'carthag', sector: 11, amount: 1, allyPayment: 0 });
  } else {
    reach(state => state.turn === 1 && state.phase === 5 && state.active === opponent && diplomatContextQuiet(state));
    const choice = homeworldShipmentChoice(viewGame(game, opponent), 'homeworld:emperor',
      { 'homeworld:guild': { normal: 3, elite: 0 } });
    assert.ok(choice.action, choice.blocked ?? undefined); assert.ok(choice.cost > 0);
    ship(opponent, choice.action);
  }
  reach(state => state.phase === 6 && diplomatContextQuiet(state));
  // Deliberately exchange custody, never duplicate cards or claim a purchase.
  // Keep hand capacity independent of random original starting-card ownership.
  for (const player of game.players) { game.deck.push(...player.hand); player.hand = []; }
  const held = (actor: string, predicate: (card: Card) => boolean): string => {
    for (const pool of [game.deck, game.richeseCache ?? []]) {
      const index = pool.findIndex(predicate);
      if (index >= 0) {
        const card = pool.splice(index, 1)[0]; diplomatContextPlayer(game, actor).hand.push(card);
        staging.push(`Conserved physical ${card.id}: native stock/cache → ${actor}'s hand; not an acquired or paid card.`);
        return card.id;
      }
    }
    throw Error('Missing original physical card for labelled conserved custody staging.');
  };
  staging.push('At quiet Battle entry return original held Treachery to undealt stock before the labelled stock/cache transfers; all physical IDs and total deck/cache inventory are conserved.');
  const worthless = held(owner, card => card.kind === 'worthless');
  const ownWeapon = kind === 'homeworld' ? held(owner, card => card.kind === 'poison') : worthless;
  const enemyWeapon = held(opponent, card => card.kind === 'poison');
  const source = kind === 'empty-carthag' ? null : held(opponent, card => kind === 'homeworld'
    ? card.effect === 'portableSnooper' : card.kind === 'shield');
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const enemyLeader = diplomatContextPlayer(game, opponent).leaders
    .filter(leader => !leader.dead && !trained.has(leader.id)).sort((a, b) => a.strength - b.strength)[0].id;
  const territory = kind === 'homeworld' ? 'homeworld:emperor' : 'carthag';
  const actor = game.active!;
  const choice = viewGame(game, actor).battleChoices.find(battle => battle.territory === territory &&
    [battle.attacker, battle.defender].includes(owner) && [battle.attacker, battle.defender].includes(opponent));
  assert.ok(choice && choice.chooser === actor);
  act({ actor, action: { type: 'chooseBattle', territory, target: actor === owner ? opponent : owner } });
  reach(plansReady); assert.deepEqual(game.battle!.plans, {});
  const plans: DiplomatContextFixture['plans'] = [
    { actor: owner, action: { type: 'battlePlan', leader: trainer, dial: 0, support: 0,
      weapon: ownWeapon, ...(kind === 'homeworld' ? { defense: worthless } : {}) } },
    { actor: opponent, action: { type: 'battlePlan', leader: enemyLeader, dial: 0, support: 0,
      weapon: enemyWeapon, ...(kind === 'held-carthag' ? { defense: source } : {}) } },
  ];
  assertDiplomatContextCustody(game);
  return { initial, offered, afterSetup, training, shipments, firstMentat, game, owner, opponent,
    trainer, enemyLeader, territory, kind, worthless, source, ownWeapon, enemyWeapon, plans, steps, staging };
}

export function revealDiplomatContextJourney(fixture: DiplomatContextFixture, steps: DiplomatContextStep[] = []): Game {
  let game = structuredClone(fixture.game);
  for (const step of fixture.plans) {
    steps.push(step); game = applyDiplomatContextStep(game, step);
    if (!game.battle?.revealed) game = advanceDiplomatContext(game, plansReady, steps);
  }
  assert.ok(game.battle?.revealed); return game;
}
export function copyDiplomatContextJourney(state: Game, card: string): Game {
  assert.ok(state.decision?.kind === 'diplomatDefense');
  return applyDiplomatContextStep(state, { actor: state.decision.player,
    action: { type: 'decision', event: state.decision.event, card } });
}
export function settleDiplomatContextJourney(state: Game, steps: DiplomatContextStep[] = []): Game {
  return advanceDiplomatContext(state, game => !game.battle && diplomatContextQuiet(game), steps);
}
/** Finish original Battle cleanup and stop at the next original Collection phase. */
export function finishDiplomatContextJourney(state: Game, steps: DiplomatContextStep[] = []): Game {
  return advanceDiplomatContext(state, game => game.phase === 7 && diplomatContextQuiet(game), steps);
}
