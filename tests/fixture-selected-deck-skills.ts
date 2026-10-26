import assert from 'node:assert/strict';
import { applyAction, createGame, joinGame, nativeHandLimit, newPlayer, viewGame,
  type Action, type Game } from '../game/engine';
import type { FactionId } from '../game/catalog';
import { treacheryDeck, type Card } from '../game/cards';
import type { LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { richeseCards } from '../game/richese-cards';
import { traitorDeck } from '../game/traitors';
import { homeworldGameIntegrity } from '../game/homeworld-game';
import { nextChoamIndependentSkillsStep } from './fixture-choam-independent-skills';
import { singleNexusE1Clean, singleNexusE1Player, shipSingleNexusE1,
  openSingleNexusE1Battle, revealSingleNexusE1Plans, quoteSingleNexusE1Battle } from './fixture-single-nexus-e1';
import { skillOfferRolls } from './fixture-independent-card-modules';

export type SelectedDeckSkillsStep = { actor: string; action: Action };
export type SelectedDeckSkillsOptions = {
  advanced?: boolean;
  homeworlds?: boolean;
  factions?: readonly FactionId[];
  expansions?: Game['expansions'];
  /** The first seat's confirmed module technique; later seats share the rest. */
  skill?: LeaderSkillId;
  /** Play conserved original poison weapons: only the attacker's, or both. */
  poison?: 'attacker' | 'both';
};
export const selectedDeckSkillsPlayer = singleNexusE1Player;
export const selectedDeckSkillsClean = singleNexusE1Clean;
export const selectedDeckSkillsQuote = quoteSingleNexusE1Battle;
/** Ordinary techniques that need no card of their own to change a battle. */
const OTHER_SKILLS: readonly LeaderSkillId[] = ['killer-medic', 'swordmaster-of-ginaz',
  'prana-bindu-adept', 'sandmaster', 'warmaster'];

/** Entropy selection is confined to the original setup lottery. */
function originalLottery<T>(draws: readonly number[], run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues'); let cursor = 0;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = draws[cursor++] ?? 0xffffffff;
    else if (array) new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
/** Move one conserved physical face out of the real remaining deck. No face is
 * ever minted, purchased or replaced, and the printed hand limit still binds. */
function conserveCard(game: Game, actor: string, matches: (card: Card) => boolean,
  staging: string[]): Card {
  const player = selectedDeckSkillsPlayer(game, actor);
  const index = game.deck.findIndex(matches);
  assert.ok(index >= 0, 'The conserved original face must still wait in the real deck');
  while (player.hand.length >= nativeHandLimit(player)) {
    const at = player.hand.findIndex(card => !card.id.startsWith('richese-'));
    assert.ok(at >= 0, `${actor}'s conserved cache faces leave no deckable hand room`);
    const [card] = player.hand.splice(at, 1);
    game.deck.push(card);
    staging.push(`Conserved ${card.id}: ${actor}'s hand → remaining deck to keep the printed hand limit`);
  }
  const [card] = game.deck.splice(index, 1);
  player.hand.push(card);
  staging.push(`Conserved ${card.id}: remaining deck → ${actor}'s hand (no purchase, payment or replacement)`);
  return card;
}

/** The ordinary lobby controls a real host uses: select the module, ready every
 * seat, start, then confirm the two private offers. No development initializer,
 * no expansion seat beyond the selected decks and no independent card module. */
export function createSelectedDeckSkillsSetup(options: SelectedDeckSkillsOptions = {}) {
  const factions = options.factions ?? ['ixians', 'richese', 'guild'];
  assert.ok(factions.length >= 2 && new Set(factions).size === factions.length);
  let game = createGame('SELECTEDDECKSKILLS', newPlayer(factions[0], factions[0], factions[0]),
    options.advanced ?? false, options.expansions ?? ['ix', 'choam']);
  for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  const actions: SelectedDeckSkillsStep[] = [], staging: string[] = [];
  const act = (actor: string, action: Action) => {
    actions.push({ actor, action }); game = applyAction(game, actor, action);
  };
  const initial = structuredClone(game);
  if (options.homeworlds) act(game.host, { type: 'homeworlds', enabled: true });
  act(game.host, { type: 'moduleOption', module: 'leaderSkills', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const owner = game.players[0].id;
  const chosen: LeaderSkillId[] = [options.skill ?? 'mentat'];
  while (chosen.length < game.players.length)
    chosen.push(OTHER_SKILLS.find(skill => !chosen.includes(skill))!);
  const training = Object.fromEntries(game.players.map((player, index) => [player.faction, chosen[index]]));
  game = originalLottery(skillOfferRolls(game, training), () => {
    const action: Action = game.advanced ? { type: 'start', advancedPreview: true } : { type: 'start' };
    actions.push({ actor: game.host, action }); return applyAction(game, game.host, action);
  });
  const started = structuredClone(game);
  let ixOffer: { before: Game; step: SelectedDeckSkillsStep; after: Game } | null = null;
  if (game.decision?.kind === 'ixSetup') {
    const actor = game.decision.player, before = structuredClone(game);
    const card = viewGame(game, actor).ixTechnology!.setup![0]; assert.ok(card);
    const step: SelectedDeckSkillsStep = { actor, action: { type: 'decision', card: card.id } };
    act(actor, step.action); ixOffer = { before, step, after: structuredClone(game) };
    staging.push('The Ix seat drafted its ordinary Treachery Card before any module technique was confirmed.');
  }
  const offered = structuredClone(game), trainers: Record<string, string> = {};
  for (let count = 0; game.status === 'setup' && count < 300; count++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
      const skill = chosen[game.players.findIndex(player => player.id === actor)];
      assert.ok(own.offer!.cards.includes(skill) && !own.unavailableSkills?.[skill]);
      const eligible = new Set(own.eligibleLeaders.map(leader => leader.id));
      const leader = selectedDeckSkillsPlayer(game, actor).leaders.filter(disc => eligible.has(disc.id))
        .sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id))[0];
      assert.ok(leader, `The ${actor} seat still has an eligible original disc`);
      trainers[actor] = leader.id;
      act(actor, { type: 'leaderSkill', event: own.offer!.event, skill, leader: leader.id });
    } else {
      const step = nextChoamIndependentSkillsStep(game);
      assert.ok(step, `Consume the original ${game.setupStage ?? game.decision?.kind} setup window`);
      act(step.actor, step.action);
    }
  }
  assert.equal(game.status, 'playing');
  const seats: Partial<Record<FactionId, string>> = {};
  for (const player of game.players) seats[player.faction] = player.id;
  return { initial, started, offered, ixOffer, afterSetup: structuredClone(game),
    owner, seats, trainers, skills: chosen, actions, staging };
}

/** Pauses at unsealed plans and typed physical choices; only real native
 * controls advance the chronology. */
export function advanceSelectedDeckSkills(game: Game, until: (g: Game) => boolean,
  actions: SelectedDeckSkillsStep[] = []): Game {
  for (let count = 0; count < 3000; count++) {
    if (until(game)) return game;
    assert.equal(game.status, 'playing');
    const step = nextChoamIndependentSkillsStep(game);
    assert.ok(step, `Supply the real ${game.decision?.kind ?? 'Battle Plan'} at ${game.turn}/${game.phase}`);
    actions.push(structuredClone(step)); game = applyAction(game, step.actor, step.action);
  }
  throw Error('The bare selected-deck chronology did not reach its requested boundary');
}

/** All cards come from the selected ordinary decks plus a seated Richese cache;
 * the Auditor is a leader disc and no Traitor face is minted or dropped. */
export function assertSelectedDeckSkillsInventory(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  if (game.homeworlds) homeworldGameIntegrity(game);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.ixSetupCards ?? []), ...(game.ixAuction?.cards ?? []), ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])];
  const original = [...treacheryDeck(game.expansions),
    ...(game.players.some(player => player.faction === 'richese') ? richeseCards() : [])];
  assert.deepEqual(cards.map(card => card.id).sort(), original.map(card => card.id).sort());
  for (const player of game.players) {
    assert.ok(player.hand.length <= nativeHandLimit(player));
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, n) => sum + n, 0), 20);
    if (player.elites) assert.equal(player.elites.reserves + player.elites.tanks +
      Object.values(player.elites.forces).reduce((sum, n) => sum + n, 0),
    player.faction === 'ixians' ? 7 : player.faction === 'emperor' ? 5 : 3);
  }
  if (game.status !== 'lobby' && game.status !== 'setup') assert.deepEqual([
    ...(game.traitorReserve ?? []), ...game.players.flatMap(player => player.traitors),
    ...game.players.flatMap(player => (player.faceDancers ?? []).map(card => card.leader)),
  ].sort(), traitorDeck(game.players, game.expansions.includes('ix')).sort());
}

/** A paid shipment into the untouched Guild army, real posture choices and both
 * sealed plans. No hand staging beyond conserved faces and no invented spice. */
export function createSelectedDeckSkillsProgramme(options: SelectedDeckSkillsOptions = {}) {
  const setup = createSelectedDeckSkillsSetup(options), actions = setup.actions;
  const guild = setup.seats.guild;
  assert.ok(guild, 'The programme needs a real Guild seat to attack');
  let game = advanceSelectedDeckSkills(setup.afterSetup,
    g => g.phase === 5 && g.active === setup.owner && selectedDeckSkillsClean(g), actions);
  const attacked = options.poison ? conserveCard(game, setup.owner, card => card.kind === 'poison',
    setup.staging) : undefined;
  const defended = options.poison === 'both'
    ? conserveCard(game, guild, card => card.kind === 'poison' && card.id !== attacked!.id, setup.staging)
    : undefined;
  const shipment = shipSingleNexusE1(game, setup.owner, 'tueks_sietch', 2, 0, actions);
  game = openSingleNexusE1Battle(shipment.after, setup.owner, guild, 'tueks_sietch', actions);
  const beforePlans = structuredClone(game);
  const defender = selectedDeckSkillsPlayer(game, guild).leaders
    .filter(disc => !disc.dead && disc.id !== setup.trainers[guild])
    .sort((a, b) => a.strength - b.strength || a.id.localeCompare(b.id))[0];
  assert.ok(defender, 'The Guild seat still holds an untrained original disc');
  game = revealSingleNexusE1Plans(game, [
    { actor: setup.owner, action: { type: 'battlePlan', leader: setup.trainers[setup.owner], dial: 0,
      ...(attacked ? { weapon: attacked.id } : {}) } },
    { actor: guild, action: { type: 'battlePlan', leader: defender.id, dial: 0,
      ...(defended ? { weapon: defended.id } : {}) } },
  ], actions);
  return { ...setup, guild, shipment, beforePlans, game, defender: defender.id,
    weapons: [attacked?.id, defended?.id].filter((id): id is string => !!id) };
}

/** Original poison weapons kill both committed discs for real, then the same
 * bare table continues into its actual native Revival opportunity next turn. */
export function createSelectedDeckSkillsRevivalCase(options: { advanced?: boolean } = {}) {
  const programme = createSelectedDeckSkillsProgramme({ advanced: options.advanced,
    factions: ['tleilaxu', 'guild', 'ixians'], skill: 'mentat', poison: 'both' });
  const tleilaxu = programme.seats.tleilaxu;
  assert.ok(tleilaxu, 'The revival case needs a real Tleilaxu seat');
  const actions = programme.actions;
  let game = advanceSelectedDeckSkills(programme.game,
    g => !g.battle && selectedDeckSkillsClean(g), actions);
  const guild = selectedDeckSkillsPlayer(game, programme.guild);
  const dead = guild.leaders.find(disc => disc.id === programme.defender)!;
  const trainer = selectedDeckSkillsPlayer(game, tleilaxu).leaders
    .find(disc => disc.id === programme.trainers[tleilaxu])!;
  assert.equal(dead.dead, true, 'The attacker’s conserved poison kills the committed Guild disc');
  assert.equal(trainer.dead, true, 'The defender’s conserved poison kills the committed Tleilaxu disc');
  assert.ok(guild.leaders.filter(disc => !disc.dead).length > 0);
  game = advanceSelectedDeckSkills(game,
    g => g.turn === 2 && g.phase === 4 && g.status === 'playing' && selectedDeckSkillsClean(g) &&
      (!g.revivalOrder || g.revivalOrder.remaining[0] === tleilaxu), actions);
  return { ...programme, tleilaxu, actions, game, dead: dead.id, trainer: trainer.id,
    advanced: programme.afterSetup.advanced };
}
