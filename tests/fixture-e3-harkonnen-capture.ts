import assert from 'node:assert/strict';
import { applyAction, captureCandidates, createGame, initializeLeaderSkillsGameForAudit, joinGame,
  newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { baseDeck } from '../game/cards';
import { LEADER_SKILL_CARDS, type LeaderSkillId } from '../game/leader-skill-cards';
import { validateLeaderSkills } from '../game/leader-skills';
import { skillOfferRolls } from './fixture-independent-card-modules';
import { nextStrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type E3CaptureNative = 'ecaz' | 'moritani';
export type E3CaptureStep = { actor: string; action: Action };
export const e3CapturePlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const e3CaptureReload = (game: Game): Game => JSON.parse(JSON.stringify(game)) as Game;
export const e3CaptureClean = (game: Game) => !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard;

function permutation<T>(source: readonly T[], desired: readonly T[]): number[] {
  const working = [...source], rolls: number[] = [];
  for (let index = working.length - 1; index > 0; index--) {
    const from = working.indexOf(desired[index]); assert.ok(from >= 0 && from <= index);
    rolls.push(Math.floor((from + 0.5) * 0x100000000 / (index + 1)));
    [working[index], working[from]] = [working[from], working[index]];
  }
  assert.deepEqual(working, desired); return rolls;
}
/** Select real shuffle draws only; no live card, capture or declaration is installed. */
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
export function actE3Capture(game: Game, actor: string, action: Action,
  actions: E3CaptureStep[] = [], captive?: string): Game {
  const pending = game.pendingCapture;
  const pool = captive && pending && (game.response?.kind === 'capture' ||
    game.decision?.kind === 'captureOffer' && action.accept === true)
    ? captureCandidates(game, pending.loser, pending.territory) : [];
  const selected = pool.find(leader => leader.id === captive);
  if (pool.length) assert.ok(selected, 'Select only a leader in the actual emitted native capture pool');
  const rolls = selected ? permutation(pool.map(leader => leader.id),
    [selected.id, ...pool.filter(leader => leader.id !== selected.id).map(leader => leader.id)]) : [];
  const next = entropy(rolls, () => applyAction(game, actor, action));
  actions.push({ actor, action: structuredClone(action) }); return next;
}
export function e3CaptureInventory(game: Game) {
  validateLeaderSkills(game.leaderSkills!, game.players);
  const skills = [...game.leaderSkills!.deck, ...game.leaderSkills!.assignments.map(row => row.skill),
    ...Object.values(game.leaderSkills!.offers).flatMap(offer => offer.cards)].sort();
  assert.deepEqual(skills, LEADER_SKILL_CARDS.map(card => card.id).sort());
  for (const player of game.players)
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + (game.currentAuctionSale ? 1 : 0)) ?? [])]
    .map(card => card.id).sort();
  const traitors = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices]), ...(game.ecazLoyalty?.card ? [game.ecazLoyalty.card] : [])].sort();
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort();
  assert.equal(new Set(cards).size, cards.length); assert.equal(new Set(traitors).size, traitors.length);
  return { cards, traitors, skills, spice };
}
export function nextE3CaptureStep(game: Game): E3CaptureStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const d = game.decision;
    if (d?.kind === 'guildTiming') return { actor: d.player, action: { type: 'decision', take: false } };
    if (d?.kind === 'moritaniSetup') return { actor: d.player,
      action: { type: 'decision', territory: 'imperial_basin', sector: 9 } };
    if (d?.kind === 'moritaniAssassinate') return { actor: d.player,
      action: { type: 'decision', event: d.event, decline: true } };
    if (d?.kind === 'ecazPlacement' || d?.kind === 'moritaniPlacement')
      return { actor: d.player, action: { type: 'decision', decline: true } };
    if (d?.kind === 'captureOffer') return { actor: d.player, action: { type: 'decision', accept: false } };
    if (d?.kind === 'capturedLeader') return null;
    if (d?.kind === 'leaderSkillVisibility') return { actor: d.player,
      action: { type: 'leaderSkillVisibility', event: d.event, hide: false } };
    if (game.status === 'playing' && game.turn === 1 && game.phase === 0 && game.stormPending === null) {
      const actor = game.stormDialers.find(actor => game.stormDials[actor] === undefined);
      if (actor) return { actor, action: { type: 'stormDial', amount: game.stormDialers.indexOf(actor) === 0 ? 1 : 0 } };
    }
    if (game.status === 'setup' && game.setupStage === 'forces') {
      const ecaz = game.players.find(player => player.faction === 'ecaz' && player.reserves === 20);
      if (ecaz) return { actor: ecaz.id, action: { type: 'ecazSetup', placements: { 'imperial_basin:9': 6 } } };
    }
  }
  return nextStrongholdFactionsNativeStep(game);
}
export function advanceE3Capture(game: Game, until: (state: Game) => boolean,
  actions: E3CaptureStep[] = [], captive?: string): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The genuine capture chronology ended before its next requested control');
    const next = nextE3CaptureStep(game); assert.ok(next, 'Seal the original human plans or choose the actual captive disposition');
    game = actE3Capture(game, next.actor, next.action, actions, captive);
  }
  throw Error('The finite native E3 capture chronology did not reach its requested boundary');
}
function prepared(game: Game) {
  return !!game.battle && !game.battle.preparation && game.battle.preLeader?.closed !== false && e3CaptureClean(game);
}
function openBattle(game: Game, territory: string, actions: E3CaptureStep[]) {
  const choice = viewGame(game, game.active!).battleChoices.find(choice => choice.territory === territory); assert.ok(choice);
  game = actE3Capture(game, choice.chooser, { type: 'chooseBattle', territory,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker }, actions);
  return advanceE3Capture(game, prepared, actions);
}

/** Fresh bare Advanced all14 preview initializer, original selected E3 deck,
 * genuine setup/training, a paid Harkonnen invasion, one real board move and
 * paid Guild shipment earn both first-turn battles. No played state is assigned.
 */
export function createE3HarkonnenCaptureFixture(native: E3CaptureNative) {
  let game = createGame('E3HARKONNENCAPTURE', newPlayer('guild', 'Guild', 'guild'), true, ['ecaz']);
  joinGame(game, newPlayer('harkonnen', 'Harkonnen', 'harkonnen'));
  joinGame(game, newPlayer(native, native, native));
  const initial = structuredClone(game), actions: E3CaptureStep[] = [];
  for (const player of game.players) game = actE3Capture(game, player.id, { type: 'ready' }, actions);
  const lobby = structuredClone(game);
  const training: Record<string, LeaderSkillId> = { guild: 'killer-medic', harkonnen: 'prana-bindu-adept', [native]: 'warmaster' };
  const cards = baseDeck(), prefix = [cards.find(card => card.kind === 'poison')!,
    cards.find(card => card.kind === 'worthless')!, cards.find(card => card.kind === 'shield')!,
    cards.find(card => card.effect === 'karama')!];
  const deckOrder = [...prefix.map(card => card.id), ...cards.filter(card => !prefix.some(first => first.id === card.id)).map(card => card.id)];
  const rolls = [...skillOfferRolls(game, training), ...permutation(cards.map(card => card.id), deckOrder)];
  game = entropy(rolls, () => initializeLeaderSkillsGameForAudit(game));
  const offered = structuredClone(game);
  for (let count = 0; game.status === 'setup' && count < 150; count++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0], own = viewGame(game, actor).leaderSkills!;
      const skill = training[actor]; assert.ok(own.offer?.cards.includes(skill));
      const leaders = e3CapturePlayer(game, actor).leaders.filter(leader => own.eligibleLeaders.some(row => row.id === leader.id));
      const leader = actor === native ? leaders.find(leader => leader.id === `${native}-0`)
        : leaders.sort((a, b) => actor === 'harkonnen' ? a.strength - b.strength : b.strength - a.strength)[0];
      assert.ok(leader);
      game = actE3Capture(game, actor, { type: 'leaderSkill', event: own.offer!.event, skill, leader: leader.id }, actions);
    } else {
      const next = nextE3CaptureStep(game); assert.ok(next);
      game = actE3Capture(game, next.actor, next.action, actions);
    }
  }
  assert.equal(game.status, 'playing'); assert.equal(game.advanced, true);
  assert.ok(!game.homeworlds && !game.nexusCards && !game.ecazTreachery && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.semutaPreview);
  const afterSetup = structuredClone(game), setupActions = structuredClone(actions), original = e3CaptureInventory(game);
  assert.deepEqual(e3CapturePlayer(game, native).forces, { 'imperial_basin:9': 6 });
  assert.deepEqual(e3CapturePlayer(game, 'harkonnen').hand.map(card => card.id), [prefix[1].id, prefix[2].id]);
  assert.deepEqual(e3CapturePlayer(game, 'guild').hand.map(card => card.id), [prefix[0].id]);
  assert.deepEqual(e3CapturePlayer(game, native).hand.map(card => card.id), [prefix[3].id]);
  const assignment = game.leaderSkills!.assignments.find(row => row.owner === native)!;
  const captive = assignment.leader;
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card); assert.ok(from >= position);
    const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  const reach = (until: (state: Game) => boolean) => { game = advanceE3Capture(game, until, actions); };
  reach(state => state.phase === 5 && state.active === 'harkonnen' && e3CaptureClean(state));
  assert.equal(game.storm, 2, 'Actual first Storm1+0 reaches the first Guild circle');
  assert.equal(game.order[0], 'harkonnen');
  assert.ok(actions.some(step => step.actor === 'guild' && step.action.type === 'decision' && step.action.take === false));
  const shipments: { actor: string; before: Game; action: Action; after: Game; cost: number }[] = [];
  const ship = (actor: string, territory: string, sector: number) => {
    const before = structuredClone(game), action: Action = { type: 'ship', territory, sector, amount: 1, elite: 0, allyPayment: 0 };
    game = actE3Capture(game, actor, action, actions); reach(e3CaptureClean);
    shipments.push({ actor, before, action, after: structuredClone(game),
      cost: e3CapturePlayer(before, actor).spice - e3CapturePlayer(game, actor).spice });
  };
  ship('harkonnen', 'imperial_basin', 9);
  assert.equal(shipments[0].cost, 2);
  const movement: E3CaptureStep = { actor: 'harkonnen', action: {
    type: 'move', from: 'carthag:11', territory: 'tsimpo', sector: 11, amount: 1, elite: 0 } };
  game = actE3Capture(game, movement.actor, movement.action, actions); reach(e3CaptureClean);
  reach(state => state.phase === 5 && state.active === 'guild' && e3CaptureClean(state));
  ship('guild', 'tsimpo', 11); assert.equal(shipments[1].cost, 1);
  reach(state => state.phase === 6 && !state.battle && e3CaptureClean(state));
  const beforeFirstBattle = structuredClone(game), firstStart = actions.length;
  assert.equal(game.active, 'harkonnen');
  game = openBattle(game, 'imperial_basin', actions);
  const loser = e3CapturePlayer(game, native).leaders.filter(leader => leader.id !== captive && !leader.dead)
    .sort((a, b) => a.strength - b.strength)[0];
  const winner = e3CapturePlayer(game, 'harkonnen').leaders.filter(leader => !leader.dead &&
    !game.leaderSkills!.assignments.some(row => row.leader === leader.id)).sort((a, b) => b.strength - a.strength)[0];
  assert.ok(loser && winner && winner.strength > loser.strength);
  const firstPlans: E3CaptureStep[] = [
    { actor: 'harkonnen', action: { type: 'battlePlan', dial: 0, support: 0, leader: winner.id } },
    { actor: native, action: { type: 'battlePlan', dial: 0, support: 0, leader: loser.id } },
  ];
  for (const step of firstPlans) game = actE3Capture(game, step.actor, step.action, actions);
  reach(state => state.decision?.kind === 'captureOffer');
  assert.equal(game.decision?.player, 'harkonnen');
  assert.ok(captureCandidates(game, native, 'imperial_basin').some(leader => leader.id === captive));
  assert.deepEqual(e3CaptureInventory(game), original);
  const firstBattleActions = structuredClone(actions.slice(firstStart));
  return { native, initial, lobby, offered, afterSetup, beforeFirstBattle, game,
    assignment: structuredClone(assignment), captive, winner: winner.id, loser: loser.id,
    poison: prefix[0].id, worthless: prefix[1].id, shield: prefix[2].id, karama: prefix[3].id,
    original, shipments, movement, spiceOrder, firstPlans, actions, setupActions, firstBattleActions,
    sourceCounts: { setup: setupActions.length, firstBattle: firstBattleActions.length, source: actions.length },
    sourceDisclosure: 'Fresh bare Advanced all14 initializeLeaderSkillsGameForAudit preview, not public-start acceptance. Original skill and starting-card shuffle entropy selected; native training/deals/Traitors/force choices retained. Two unopened land Spice positions selected. Actual first Storm dials1+0 reach the Guild circle, putting Harkonnen first in printed Storm/Battle order; actual Guild Wait preserves its later shipment. Actual Harkonnen ship1 costs2, original Carthag move1 and Guild ship1 costs1 earn two first-turn battles. Actual capture selection uses only a permutation of the emitted native candidate pool. No played hand, army, purse, phase, leader death, capture or receipt is installed.' };
}
export type E3HarkonnenCaptureFixture = ReturnType<typeof createE3HarkonnenCaptureFixture>;

export function acceptE3HarkonnenCapture(f: E3HarkonnenCaptureFixture, mode: 'keep' | 'execute' = 'keep',
  state = f.game, actions: E3CaptureStep[] = []): Game {
  let game = actE3Capture(e3CaptureReload(state), 'harkonnen', { type: 'decision', accept: true }, actions, f.captive);
  game = advanceE3Capture(game, next => next.decision?.kind === 'capturedLeader', actions, f.captive);
  assert.equal(game.decision?.kind === 'capturedLeader' && game.decision.leader, f.captive);
  game = actE3Capture(game, 'harkonnen', { type: 'decision', mode }, actions);
  return advanceE3Capture(game, next => !next.battle && e3CaptureClean(next), actions);
}
export function declineE3HarkonnenCapture(f: E3HarkonnenCaptureFixture, actions: E3CaptureStep[] = []): Game {
  const game = actE3Capture(e3CaptureReload(f.game), 'harkonnen', { type: 'decision', accept: false }, actions);
  return advanceE3Capture(game, next => !next.battle && e3CaptureClean(next), actions);
}
export function cancelE3HarkonnenCapture(f: E3HarkonnenCaptureFixture, actions: E3CaptureStep[] = []): Game {
  let game = actE3Capture(e3CaptureReload(f.game), 'harkonnen', { type: 'decision', accept: true }, actions);
  assert.equal(game.response?.kind, 'capture');
  game = actE3Capture(game, f.native, { type: 'card', card: f.karama, mode: 'cancel' }, actions);
  return advanceE3Capture(game, next => !next.battle && e3CaptureClean(next), actions);
}
export function openE3HarkonnenCaptiveBattle(f: E3HarkonnenCaptureFixture, state: Game,
  actions: E3CaptureStep[] = []): Game {
  assert.equal(e3CapturePlayer(state, f.native).leaders.find(leader => leader.id === f.captive)?.capturedBy, 'harkonnen');
  return openBattle(e3CaptureReload(state), 'tsimpo', actions);
}
export function continueE3HarkonnenCaptiveBattle(f: E3HarkonnenCaptureFixture, state: Game,
  outcome: 'alive' | 'death' = 'alive', actions: E3CaptureStep[] = []) {
  const beforeBattle = e3CaptureReload(state), preparedGame = openE3HarkonnenCaptiveBattle(f, state, actions);
  const opponent = e3CapturePlayer(preparedGame, 'guild').leaders.filter(leader => !leader.dead &&
    !preparedGame.leaderSkills!.assignments.some(row => row.leader === leader.id)).sort((a, b) => a.strength - b.strength)[0];
  assert.ok(opponent);
  const plans: E3CaptureStep[] = [
    { actor: 'harkonnen', action: { type: 'battlePlan', dial: 0, support: 0, leader: f.captive,
      weapon: f.worthless, defense: null } },
    { actor: 'guild', action: { type: 'battlePlan', dial: 0, support: 0, leader: opponent.id,
      weapon: outcome === 'death' ? f.poison : null, defense: null } },
  ];
  let game = preparedGame;
  for (const step of plans) game = actE3Capture(game, step.actor, step.action, actions);
  const revealed = structuredClone(game); assert.equal(game.battle?.revealed, true);
  game = advanceE3Capture(game, next => !next.battle && e3CaptureClean(next), actions);
  assert.deepEqual(e3CaptureInventory(game), f.original);
  return { game, beforeBattle, prepared: preparedGame, plans, revealed, actions };
}
