import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import {
  FOREIGN_GHOLA_DISC,
  createMoritaniForeignGholaWinnerFixture,
} from './fixture-moritani-foreign-ghola-winner';
import {
  advanceMixedE3Moritani,
  assertMixedE3MoritaniPhysical,
  mixedE3MoritaniClean,
  mixedE3MoritaniPlayer,
  mixedE3MoritaniReload,
  mixedE3MoritaniTraitorCustody,
  openMixedE3MoritaniBattle,
  revealMixedE3MoritaniPlans,
  settleMixedE3MoritaniBoundary,
  type MixedE3MoritaniStep,
} from './fixture-mixed-e3-moritani-nexus';

/** Stocks survive the explicitly controlled later position and its real loss. */
export function moritaniAssassinateGholaTargetInventory(g: Game) {
  return {
    cards: [...g.deck, ...g.discard, ...g.players.flatMap(player => player.hand)]
      .map(card => card.id).sort(),
    traitors: mixedE3MoritaniTraitorCustody(g),
    forces: g.players.map(player => ({
      id: player.id,
      total: player.reserves + player.tanks +
        Object.values(player.forces).reduce((sum, count) => sum + count, 0),
      elite: (player.elites?.reserves ?? 0) + (player.elites?.tanks ?? 0) +
        Object.values(player.elites?.forces ?? {}).reduce((sum, count) => sum + count, 0),
    })),
  };
}

/** One disclosed physical swap, including a possible original Face Dancer slot. */
function swapHeldTraitor(g: Game, owner: string, target: string) {
  const player = mixedE3MoritaniPlayer(g, owner);
  const previous = player.traitors[0];
  assert.ok(previous, 'Moritani needs one actual held card for the conserved swap.');
  if (player.traitors.includes(target)) return { previous: target, zone: 'already held' };
  const before = mixedE3MoritaniTraitorCustody(g);
  const reserve = g.traitorReserve?.indexOf(target) ?? -1;
  let zone: string;
  if (reserve >= 0) {
    g.traitorReserve![reserve] = previous;
    zone = 'original Traitor reserve';
  } else {
    const holder = g.players.find(seat => seat.id !== owner && seat.traitors.includes(target));
    if (holder) {
      holder.traitors[holder.traitors.indexOf(target)] = previous;
      zone = `${holder.faction} held Traitor Card`;
    } else {
      const dancerOwner = g.players.find(seat => seat.faceDancers?.some(card => card.leader === target));
      const dancer = dancerOwner?.faceDancers?.find(card => card.leader === target);
      assert.ok(dancer && !dancer.revealed,
        'The selected card must exist in one original unrevealed physical zone.');
      dancer.leader = previous;
      zone = `${dancerOwner!.faction} unrevealed Face Dancer slot`;
    }
  }
  player.traitors[0] = target;
  assert.deepEqual(mixedE3MoritaniTraitorCustody(g), before,
    'The controlled swap must conserve every physical Traitor Card.');
  return { previous, zone };
}

/**
 * Genuine native death and paid foreign revival, followed by a deliberately
 * controlled conserved later battle. This is not a complete unstaged game.
 * The target remains the engine-produced Guild disc in its original roster;
 * no target life, death history, capture or Ghola field is assigned here.
 */
export function createMoritaniAssassinateGholaTargetFixture() {
  const source = createMoritaniForeignGholaWinnerFixture();
  const prefix = mixedE3MoritaniReload(source.revival.after);
  const owner = source.moritani, opponent = source.guild, target = FOREIGN_GHOLA_DISC;
  const originalTarget = structuredClone(mixedE3MoritaniPlayer(prefix, opponent)
    .leaders.find(leader => leader.id === target)!);
  assert.equal(originalTarget.dead, false);
  assert.equal(originalTarget.gholaBy, source.tleilaxu);
  assert.equal(originalTarget.faction, 'guild');
  assert.ok(prefix.advanced && prefix.nexusCards && !prefix.leaderSkills);
  assert.equal(prefix.phase, 4);
  assert.ok(mixedE3MoritaniClean(prefix) && !prefix.pendingRevival && !prefix.battle);
  assert.equal(prefix.moritaniAssassinate!.opportunities.length, 0);
  assertMixedE3MoritaniPhysical(prefix);
  const originalInventory = moritaniAssassinateGholaTargetInventory(prefix);

  // The source factory continues farther for its own winning-disc witness.
  // Keep only its actual action prefix through this paid revival and the
  // immediately following native response passes, before later phase readiness.
  const revivalIndex = source.actions.findIndex(step => step.actor === source.tleilaxu &&
    step.action.type === 'reviveForeignGhola' && step.action.leader === target);
  assert.ok(revivalIndex >= 0);
  let sourceActionCount = revivalIndex + 1;
  while (source.actions[sourceActionCount]?.action.type === 'passResponse') sourceActionCount++;
  const sourceActions = structuredClone(source.actions.slice(0, sourceActionCount));

  let game = mixedE3MoritaniReload(prefix);
  const swap = swapHeldTraitor(game, owner, target);
  game.phase = 6;
  game.ready = [];
  game.order = [opponent, owner, ...game.order.filter(id => id !== opponent && id !== owner)];
  game.active = opponent;
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((sum, count) => sum + count, 0);
    player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((sum, count) => sum + count, 0);
      player.elites.forces = {};
    }
  }
  const destination = ['arrakeen', 'carthag', 'sietch_tabr']
    .map(id => ({ id, sector: territory(id).sectors.find(sector => sector !== game.storm) }))
    .find(candidate => candidate.sector !== undefined);
  assert.ok(destination);
  const location = `${destination.id}:${destination.sector}`;
  for (const actor of [opponent, owner]) {
    const player = mixedE3MoritaniPlayer(game, actor);
    assert.ok(player.reserves >= 3);
    player.reserves -= 3;
    player.forces[location] = 3;
  }
  assert.deepEqual(moritaniAssassinateGholaTargetInventory(game), originalInventory);
  assertMixedE3MoritaniPhysical(game);
  const arranged = mixedE3MoritaniReload(game);

  const winningDisc = mixedE3MoritaniPlayer(game, opponent).leaders
    .filter(leader => leader.id !== target && !leader.dead && !leader.capturedBy &&
      !leader.gholaBy && !leader.usedAt)
    .sort((first, second) => second.strength - first.strength)[0];
  const losingDisc = mixedE3MoritaniPlayer(game, owner).leaders
    .filter(leader => !leader.dead && !leader.capturedBy && !leader.gholaBy && !leader.usedAt)
    .sort((first, second) => first.strength - second.strength)[0];
  assert.ok(winningDisc && losingDisc && winningDisc.strength > losingDisc.strength,
    'Different living native Guild and Moritani discs must produce the unarmed loss.');
  const actions: MixedE3MoritaniStep[] = [];
  game = openMixedE3MoritaniBattle(game, opponent, owner, actions);
  game = advanceMixedE3Moritani(game, state => !!state.battle && mixedE3MoritaniClean(state) &&
    !state.battle.preparation && state.battle.preLeader?.closed !== false, actions);
  const plans: MixedE3MoritaniStep[] = [
    { actor: opponent, action: { type: 'battlePlan', leader: winningDisc.id, dial: 0, support: 0 } },
    { actor: owner, action: { type: 'battlePlan', leader: losingDisc.id, dial: 0, support: 0 } },
  ];
  game = revealMixedE3MoritaniPlans(game, plans, actions);
  const boundary = settleMixedE3MoritaniBoundary(game, null, actions);
  assert.equal(boundary.kind, 'assassination',
    'The real different-Guild-disc victory must open the original native target choice.');
  game = boundary.game;
  const decision = game.decision;
  assert.ok(decision?.kind === 'moritaniAssassinate' && decision.player === owner);
  const event = decision.event;
  const receipt = game.moritaniAssassinate!.opportunities.find(candidate => candidate.event === event)!;
  assert.equal(receipt.opponent, opponent);
  assert.equal(receipt.faction, 'guild');
  assert.equal(receipt.opposingLeader, winningDisc.id);
  assert.notEqual(receipt.opposingLeader, target);
  assert.deepEqual(mixedE3MoritaniPlayer(game, opponent).leaders.find(leader => leader.id === target),
    originalTarget, 'The genuinely revived target must remain untouched through the later battle.');
  const choice = viewGame(game, owner).moritaniAssassinate!.pending!.cards
    .find(candidate => candidate.card === target);
  assert.ok(choice, 'The actual held foreign-Ghola native identity must be selectable.');
  assert.equal(choice.potentialBounty, originalTarget.strength);
  assert.deepEqual(moritaniAssassinateGholaTargetInventory(game), originalInventory);
  assertMixedE3MoritaniPhysical(game);
  const action: Action = { type: 'decision', event, card: target };
  const staging = [
    ...source.staging,
    'Reuse only the source fixture’s genuine native Guild death and paid Tleilaxu foreign-revival prefix. The later source winning-Ghola battle is not used as this target witness.',
    `Explicitly swap Moritani’s physical ${swap.previous} Traitor Card with ${target} from the ${swap.zone}; preserve the complete original Traitor/Face Dancer census. This is controlled card positioning, not a new deal or a natural draw.`,
    'Explicitly stage the later phase-six/order/army position: return every current board counter to its own reserves, retain all Tanks and elite stocks, then place three normal Guild and three normal Moritani counters together outside the unchanged storm. No wallet, hand, mode, target disc or custody field is assigned.',
    'Use actual chooseBattle, ordinary preparation, two unarmed private Battle Plans and normal Traitor declines. A different living native Guild disc wins; the original paid foreign Ghola remains unchanged in the Guild roster with Tleilaxu custody. Stop at the real Moritani Assassinate Leaders decision.',
  ];
  return { game, owner, opponent, target, event, potentialBounty: choice.potentialBounty,
    action, originalInventory, sourceActions, sourceActionCount, actions,
    actionCount: sourceActions.length + actions.length, staging,
    source, prefix, arranged, originalTarget, tleilaxu: source.tleilaxu,
    location, plans, winningDisc: winningDisc.id, losingDisc: losingDisc.id };
}
