import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { type Card } from '../game/cards';
import { basicEcazNativeFixture, nextBasicEcazNativeStep } from './fixture-basic-ecaz-native';
import { stageEcazOccupyCard } from './fixture-ecaz-occupy';

export type BasicNativeMirrorOptions = {
  owner?: 'ecaz' | 'ally' | 'moritani';
  weapon?: 'poisonTooth' | 'stoneBurner' | 'projectile' | 'artillery';
};
export type BasicNativeMirrorStep = { actor: string; action: Action };
export const BASIC_NATIVE_MIRROR = 'richese-mirror-weapon';
export const basicNativeMirrorPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor);
  assert.ok(player); return player;
};
export const basicNativeMirrorClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision &&
  !game.truthtrance && !game.pendingTreacheryDiscard;
export const basicNativeMirrorPlansOpen = (game: Game) =>
  !!game.battle && !game.battle.preparation &&
  (!game.battle.preLeader || game.battle.preLeader.closed) && basicNativeMirrorClean(game);

/** Physical inventory, including native cache/retired cards. No duplicated
 * original identity may be introduced by the explicitly controlled staging. */
export function basicNativeMirrorInventory(game: Game): string[] {
  const ids = [...game.deck, ...game.discard, ...(game.ixSetupCards ?? []),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? []),
    ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'Every original physical card has exactly one current location');
  return ids;
}
export function actBasicNativeMirror(game: Game, actor: string, action: Action,
  actions: BasicNativeMirrorStep[] = []): Game {
  const next = applyAction(game, actor, action);
  actions.push({ actor, action: structuredClone(action) }); return next;
}

/** Only actual native continuations. A plan, copied/original weapon choice,
 * typed physical allocation or casualty remains an explicit caller action. */
export function advanceBasicNativeMirror(game: Game, until: (state: Game) => boolean,
  actions: BasicNativeMirrorStep[] = []): Game {
  for (let count = 0; count < 250; count++) {
    if (until(game)) return game;
    const decision = game.decision;
    assert.ok(!decision || !['poisonTooth', 'stoneBurner', 'stoneAllocation', 'battleLosses']
      .includes(decision.kind), 'Choose the actual weapon/allocation/loss explicitly');
    const step = nextBasicEcazNativeStep(game);
    assert.ok(step, 'The native battle continuation must retain a real control');
    assert.ok(!['battlePlan', 'chooseBattle'].includes(step.action.type),
      'The caller owns real battle admission and sealed plans');
    game = actBasicNativeMirror(game, step.actor, step.action, actions);
  }
  throw Error('The native Mirror continuation did not reach its finite boundary');
}

function stagedPhysicalCard(game: Game, owner: string, predicate: (card: Card) => boolean): string {
  const before = basicNativeMirrorInventory(game), player = basicNativeMirrorPlayer(game, owner);
  const cache = game.richeseCache?.findIndex(predicate) ?? -1;
  let id: string;
  if (cache >= 0) {
    const card = game.richeseCache!.splice(cache, 1)[0];
    if (player.hand.length >= 4) game.deck.push(player.hand.shift()!);
    player.hand.push(card); id = card.id;
  } else id = stageEcazOccupyCard(game, owner, predicate);
  assert.ok(player.hand.length <= 4, 'Controlled rule hands retain an actual legal capacity');
  assert.deepEqual(basicNativeMirrorInventory(game), before);
  return id;
}

/** Original public Basic native setup/alliance and actual battle admission.
 * The shared fixture explicitly stages a conserved board, thirty-spice bank
 * budget and original cards. This adds named physical weapon transfers, not
 * an unstaged acquisition or complete-game certificate. */
export function createBasicNativeMirrorFixture(options: BasicNativeMirrorOptions = {}) {
  const role = options.owner ?? 'ecaz', weapon = options.weapon ?? 'poisonTooth';
  const fixture = basicEcazNativeFixture({ allyFaction: 'ixians', opponentFaction: 'choam', mixedIxians: true });
  const actions: BasicNativeMirrorStep[] = [], staging = [...fixture.staging];
  const originalInventory = basicNativeMirrorInventory(fixture.source);
  let game = structuredClone(role === 'moritani' ? fixture.beforeBattle : fixture.game);
  let beforeBattle = structuredClone(fixture.beforeBattle);
  if (role === 'moritani') {
    const previous = basicNativeMirrorPlayer(game, fixture.opponent);
    previous.reserves += previous.forces[fixture.location] ?? 0;
    delete previous.forces[fixture.location];
    if (previous.elites) {
      previous.elites.reserves += previous.elites.forces[fixture.location] ?? 0;
      delete previous.elites.forces[fixture.location];
    }
    const moritani = basicNativeMirrorPlayer(game, 'moritani');
    assert.equal(moritani.forces[fixture.location] ?? 0, 0);
    assert.ok(moritani.reserves >= 5);
    moritani.reserves -= 5; moritani.forces[fixture.location] = 5;
    staging.push('Before actual admission, return the original CHOAM Carthag counters to their own reserves and place five conserved Moritani reserves there; preserve the actual Ecaz/Ixian Nexus alliance, native phase and battle order.');
    beforeBattle = structuredClone(game);
    const choice = viewGame(game, game.active!).battleChoices.find(choice =>
      choice.territory === fixture.territory && [choice.attacker, choice.defender].includes('moritani'));
    assert.ok(choice, 'The conserved Moritani army creates a real native battle choice');
    game = actBasicNativeMirror(game, choice.chooser, { type: 'chooseBattle', territory: fixture.territory,
      target: choice.attacker === choice.chooser ? choice.defender : choice.attacker }, actions);
  }
  assert.equal(game.decision?.kind, 'ecazBattleLead');
  const lead = role === 'ecaz' ? fixture.ecaz : fixture.ally;
  game = actBasicNativeMirror(game, fixture.ecaz,
    { type: 'decision', event: game.decision!.event, lead }, actions);
  game = advanceBasicNativeMirror(game, basicNativeMirrorPlansOpen, actions);
  assert.ok(game.battle && !game.battle.revealed && Object.keys(game.battle.plans).length === 0);
  const owner = role === 'moritani' ? 'moritani' : lead;
  const opponent = game.battle.attacker === owner ? game.battle.defender : game.battle.attacker;
  assert.ok([game.battle.attacker, game.battle.defender].includes(owner));
  const mirror = stagedPhysicalCard(game, owner, card => card.id === BASIC_NATIVE_MIRROR);
  const original = stagedPhysicalCard(game, opponent,
    card => weapon === 'stoneBurner' ? card.id === 'richese-stone-burner' : card.kind === weapon);
  staging.push(`At the actual clean unsealed-plan boundary, conserve the original physical Mirror into ${owner}'s hand and the original ${weapon} into ${opponent}'s hand, exchanging an original held card with the deck only when capacity requires it. These are labelled rule-case acquisitions, not a played cache purchase or newly manufactured cards.`);
  assert.equal(game.advanced, false);
  assert.deepEqual(game.players.map(player => player.faction), ['ecaz', 'ixians', 'choam', 'richese', 'moritani', 'tleilaxu']);
  assert.deepEqual(basicNativeMirrorInventory(game), originalInventory);
  return { source: fixture.source, afterSetup: fixture.afterSetup, beforeBattle, game,
    owner, opponent, ecaz: fixture.ecaz, ally: fixture.ally, richese: fixture.richese,
    territory: fixture.territory, location: fixture.location, mirror, original, weapon, role,
    originalInventory, actions, staging };
}
export type BasicNativeMirrorFixture = ReturnType<typeof createBasicNativeMirrorFixture>;
