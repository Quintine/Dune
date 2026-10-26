import assert from 'node:assert/strict';
import { applyAction, createGame, initializeIxGameForAudit, initializeLeaderSkillsGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { traitorDeck } from '../game/traitors';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type IxStartingPoolStep = { actor: string; action: Action };
export type IxStartingPoolOptions = { advanced?: boolean; skills?: boolean; harkonnen?: boolean };
export const ixStartingPoolPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const ixStartingPoolReload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;

function permutation<T>(source: readonly T[], desired: readonly T[]): number[] {
  const working = [...source], rolls: number[] = [];
  for (let index = working.length - 1; index > 0; index--) {
    const from = working.indexOf(desired[index]); assert.ok(from >= 0 && from <= index);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (index + 1)));
    [working[index], working[from]] = [working[from], working[index]];
  }
  assert.deepEqual(working, desired); return rolls;
}
/** Only original shuffle draws are selected. UUID and byte entropy remain native. */
function entropy<T>(rolls: readonly number[], run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[cursor++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
export function actIxStartingPool(game: Game, actor: string, action: Action,
  actions: IxStartingPoolStep[] = []): Game {
  const next = entropy([], () => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}

/** Includes the still-private native draft; historical references are not slots. */
export function ixStartingPoolInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...(game.ixSetupCards ?? []),
    ...game.players.flatMap(player => player.hand), ...(game.auction?.cards.slice(game.auction.index) ?? [])]
    .map(card => card.id).sort();
  assert.deepEqual(cards, treacheryDeck(game.expansions).map(card => card.id).sort());
  const traitors = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices])].sort();
  if (traitors.length) assert.deepEqual(traitors, traitorDeck(game.players, true).sort());
  const skills = game.leaderSkills ? [...game.leaderSkills.deck,
    ...game.leaderSkills.assignments.map(row => row.skill),
    ...Object.values(game.leaderSkills.offers).flatMap(offer => offer.cards)].sort() : [];
  if (game.leaderSkills) {
    validateLeaderSkills(game.leaderSkills, game.players);
    assert.deepEqual(skills, LEADER_SKILL_CARDS.map(card => card.id).sort());
  }
  for (const player of game.players) {
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, amount) => sum + amount, 0), player.faction === 'ixians' ? 7 : 5);
  }
  return { cards, traitors, skills };
}

/** The original Ix packet is deliberately caller-owned; no draft choice is guessed. */
export function nextIxStartingPoolStep(game: Game): IxStartingPoolStep | null {
  if (game.decision?.kind === 'ixSetup') return null;
  if (game.status === 'setup' && game.setupStage === 'leaderSkills') {
    const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
    const skill = own.offer!.cards.find(card => !own.unavailableSkills?.[card]);
    const leader = own.eligibleLeaders[0]; assert.ok(skill && leader);
    return { actor, action: { type: 'leaderSkill', event: own.offer!.event, skill, leader: leader.id } };
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceIxStartingPool(game: Game, until: (state: Game) => boolean,
  actions: IxStartingPoolStep[] = []): Game {
  for (let count = 0; count < 200; count++) {
    if (until(game)) return game;
    const step = nextIxStartingPoolStep(game); assert.ok(step, 'Choose the actual private Ix starting card before setup continues');
    game = actIxStartingPool(game, step.actor, step.action, actions);
  }
  throw Error('Original Ix starting-card setup did not reach its finite boundary');
}
export function ixStartingPoolChoice(game: Game, card: string): Action {
  const own = viewGame(game, 'ixians');
  assert.equal(game.decision?.kind, 'ixSetup');
  assert.ok(own.ixTechnology?.setup?.some(candidate => candidate.id === card));
  return { type: 'decision', card };
}
export function finishIxStartingPool(game: Game, actions: IxStartingPoolStep[] = []): Game {
  return advanceIxStartingPool(game, state => state.status === 'playing', actions);
}

/** Original fresh Ix/Hark/Atreides setup, or Emperor in the no-Hark control.
 * The supported Ix or all14 preview initializer is used, not a public start.
 * Only initial shuffle entropy is selected. No dealt hand, phase, force, purse,
 * pending receipt or module flag is installed after initialization.
 */
export function createIxStartingPoolFixture(options: IxStartingPoolOptions = {}) {
  const advanced = options.advanced ?? true, skills = options.skills ?? false, harkonnen = options.harkonnen ?? true;
  const second = harkonnen ? 'harkonnen' : 'emperor';
  let game = createGame('IXSTARTINGPOOL', newPlayer('ixians', 'Ixians', 'ixians'), advanced, ['ix']);
  joinGame(game, newPlayer(second, second, second));
  joinGame(game, newPlayer('atreides', 'Atreides', 'atreides'));
  const initial = structuredClone(game), actions: IxStartingPoolStep[] = [];
  for (const player of game.players) game = actIxStartingPool(game, player.id, { type: 'ready' }, actions);
  const lobby = structuredClone(game), original = treacheryDeck(['ix']);
  const prefix = [original.find(card => card.kind === 'projectile')!, original.find(card => card.kind === 'shield')!,
    original.find(card => card.kind === 'snooper')!, original.find(card => card.effect === 'karama')!];
  const deckOrder = [...prefix.map(card => card.id), ...original.filter(card => !prefix.some(first => first.id === card.id)).map(card => card.id)];
  const rolls = [...(skills ? Array<number>(LEADER_SKILL_CARDS.length - 1).fill(0xffffffff) : []),
    ...permutation(original.map(card => card.id), deckOrder)];
  game = entropy(rolls, () => skills ? initializeLeaderSkillsGameForAudit(game) : initializeIxGameForAudit(game));
  const initialized = structuredClone(game);
  game = advanceIxStartingPool(game, state => state.decision?.kind === 'ixSetup', actions);
  assert.equal(game.status, 'setup'); assert.equal(game.decision?.player, 'ixians');
  assert.ok(game.players.every(player => !player.hand.length));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.discoveryEnabled && !game.techTokens && !game.strongholdCards && !game.ecazTreachery);
  assert.equal(!!game.leaderSkills, skills);
  assert.deepEqual(game.ixSetupCards!.map(card => card.id), deckOrder.slice(0, game.ixSetupCards!.length));
  const stock = ixStartingPoolInventory(game);
  return { initial, lobby, initialized, game, advanced, skills, harkonnen, second,
    pool: structuredClone(game.ixSetupCards!), prefix: prefix.map(card => card.id), extra: prefix[3].id,
    nextAfterFour: deckOrder[4], deckOrder, stock, actions,
    readyActions: actions.filter(step => step.action.type === 'ready'),
    setupActions: actions.filter(step => step.action.type !== 'ready'),
    sourceCounts: { ready: actions.filter(step => step.action.type === 'ready').length,
      beforeDraft: actions.filter(step => step.action.type !== 'ready').length, source: actions.length },
    sourceDisclosure: 'Genuine fresh Ix/Harkonnen/Atreides (or Emperor control) preview initialization, with optional original all14 Skills. Actual Ready/setup actions are recorded; initializer is not an action or public-start acceptance. Only original initial skill/Treachery shuffle entropy selected. Source stops before the actual Ix choice; no hand, army, purse, phase or receipt is installed.' };
}

/** Conserved old-count UNIT supplement, not a native historical save claim.
 * Move only the untouched extra fourth card back to the undealt top, restoring
 * the old Advanced N-card boundary without minting/dropping any physical card.
 */
export function createLegacyIxStartingPoolSupplement(skills = false) {
  const base = createIxStartingPoolFixture({ advanced: true, skills });
  const game = ixStartingPoolReload(base.game);
  assert.equal(game.ixSetupCards!.length, game.players.length + 1);
  const extra = game.ixSetupCards!.pop()!;
  game.deck.unshift(extra);
  assert.deepEqual(ixStartingPoolInventory(game), base.stock);
  return { ...base, game, pool: structuredClone(game.ixSetupCards!),
    sourceDisclosure: `${base.sourceDisclosure} Controlled conserved old-count unit supplement: the untouched fourth pool card returns to the undealt top to represent the earlier pending N-card contract. This is not claimed native old setup history.` };
}
