import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { nativeShipmentSources } from '../game/homeworld-options';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD } from '../game/harass-withdraw';
import {
  createIndependentCardModulesFixture, type IndependentCardModulesOptions,
  type IndependentCardModulesStep,
} from './fixture-independent-card-modules';
import {
  applyClassicDiscoveryNexusStep, nextClassicDiscoveryNexusStep, withClassicDiscoveryNexusLottery,
} from './fixture-discovery-classic-nexus';

export type SelectedIndependentNexusBattleStep = IndependentCardModulesStep;
export type SelectedIndependentNexusBattleOptions = Pick<IndependentCardModulesOptions,
  'advanced' | 'expansions' | 'homeworlds' | 'skills' | 'tech' | 'strongholds'> & {
  program?: 'mixed-return' | 'substitution' | 'faceDance';
};
export const selectedIndependentNexusPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};
export const selectedIndependentNexusClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard &&
  !game.pendingGuildBetrayal && !game.pendingNexusIxianBetrayal && !game.pendingNexusHarkonnenBetrayal;

/** Original native windows only. Sealed plans and the selected typed Harass
 * allocation remain explicit, and a Face Dance is declined unless requested. */
export function nextSelectedIndependentNexusBattleStep(game: Game): SelectedIndependentNexusBattleStep | null {
  if (game.pendingGuildBetrayal) {
    const frame = game.pendingGuildBetrayal;
    const actor = frame.required.find(id => !frame.passed.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'guildBetrayalPass', event: frame.invoice.event } };
  }
  if (!game.response && !game.phaseOpening) {
    if (game.decision?.kind === 'harassWithdraw') return null;
    if (game.pendingNexusIxianBetrayal) {
      const offer = game.pendingNexusIxianBetrayal;
      const actor = offer.required.find(id => !offer.passed.includes(id)); assert.ok(actor);
      return { actor, action: { type: 'nexusIxianBetrayalPass', event: offer.source.event } };
    }
  }
  // The nine-Suboid first shipment legitimately spends the final nine spice
  // after its paid opening bid. Basic has no later stronghold income: claim
  // the real next-turn charity before acknowledgement closes that phase.
  if (selectedIndependentNexusClean(game) && game.phase === 2) {
    const view = viewGame(game, 'ixians');
    const own = view.players.find(player => player.id === 'ixians')!;
    if (!own.charityClaimed && !view.charity.incomePending && view.charity.amount > 0)
      return { actor: 'ixians', action: { type: 'charity' } };
  }
  return nextClassicDiscoveryNexusStep(game);
}
export function actSelectedIndependentNexusBattle(game: Game, step: SelectedIndependentNexusBattleStep,
  actions?: SelectedIndependentNexusBattleStep[]): Game {
  return applyClassicDiscoveryNexusStep(game, step, actions);
}
export function advanceSelectedIndependentNexusBattle(game: Game, until: (state: Game) => boolean,
  actions: SelectedIndependentNexusBattleStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'Original selected-family game ended before its requested rule window');
    const step = nextSelectedIndependentNexusBattleStep(game);
    assert.ok(step, `A real plan/allocation is required at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSelectedIndependentNexusBattle(game, step, actions);
  }
  throw Error('Selected independent Nexus programme did not reach its native boundary');
}

/** Reorder only the still-unopened physical Treachery deck. The Ixian native
 * pool returns a different card, then the owner buys the real desired lot. */
function purchaseOriginalCard(game: Game, desired: string, actions: SelectedIndependentNexusBattleStep[], staging: string[]) {
  assert.equal(game.phase, 2);
  const at = game.deck.findIndex(card => card.id === desired);
  assert.ok(at >= 0, 'The targeted purchase must still be an undealt original card');
  game.deck.unshift(game.deck.splice(at, 1)[0]);
  staging.push(`Order unopened ${desired} before the original turn-${game.turn} Ixian auction pool; acquire it only through the printed auction and payment.`);
  let bid: { before: Game; step: SelectedIndependentNexusBattleStep; after: Game } | undefined;
  for (let count = 0; count < 350; count++) {
    if (selectedIndependentNexusPlayer(game, 'ixians').hand.some(card => card.id === desired)) {
      assert.ok(bid, 'The native hand must acquire its target by an actual paid bid');
      return { game, bid };
    }
    let step: SelectedIndependentNexusBattleStep | null = null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'ixAuction') {
      const returned = game.ixAuction!.cards.find(card => card.id !== desired); assert.ok(returned);
      assert.ok(game.ixAuction!.cards.some(card => card.id === desired));
      step = { actor: 'ixians', action: { type: 'decision', card: returned.id, position: 'bottom' } };
    } else if (selectedIndependentNexusClean(game) && game.auction?.active === 'ixians' &&
      game.auction.cards[game.auction.index].id === desired && game.auction.bid === 0) {
      const before = structuredClone(game);
      step = { actor: 'ixians', action: { type: 'bid', amount: 1, allyPayment: 0 } };
      game = actSelectedIndependentNexusBattle(game, step, actions);
      bid = { before, step, after: structuredClone(game) };
      continue;
    }
    step ??= nextSelectedIndependentNexusBattleStep(game); assert.ok(step);
    game = actSelectedIndependentNexusBattle(game, step, actions);
  }
  throw Error('Original selected-family auction did not deliver its physical card');
}

/** Fresh selected E1/E2 setup, original paid auctions and shipments, real
 * reciprocal alliance, closing draw and native battle. No dealt hand, board
 * counter, wallet, phase, Face Dancer, receipt or module flag is rewritten. */
export function createSelectedIndependentNexusBattleFixture(options: SelectedIndependentNexusBattleOptions = {}) {
  const program = options.program ?? 'substitution', advanced = options.advanced ?? true;
  const initialize = () => createIndependentCardModulesFixture({ ...options, advanced,
    expansions: options.expansions ?? ['ix'], factions: ['ixians', 'tleilaxu', 'guild', 'emperor'],
    independent: true, nexus: true, tech: options.tech ?? false });
  // The constructor restores the caller's entropy method after its initializer;
  // retain the original scalar lottery through later setup actions as well.
  // finishSetup then shuffles the unopened native stock and deals its actual
  // Face Dancers; no already-dealt identity is exchanged for a desired one.
  const source = program === 'faceDance' ? withClassicDiscoveryNexusLottery(initialize) : initialize();
  let game = structuredClone(source.game);
  const afterSetup = structuredClone(game), actions = [...source.steps], staging: string[] = [];
  if (program === 'faceDance') staging.push('Select the original unopened final setup Face Dancer shuffle through the scalar lottery; retain the three genuinely dealt identities.');
  const act = (actor: string, action: Action) => {
    game = actSelectedIndependentNexusBattle(game, { actor, action }, actions);
  };
  const reach = (until: (state: Game) => boolean) => {
    game = advanceSelectedIndependentNexusBattle(game, until, actions);
  };
  // First turn has no worm. The ordinary second-turn worm opens the actual
  // alliance Nexus before the existing native closing-draw controller.
  const takeLand = () => {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
    assert.ok(at >= 0); return game.spiceDeck.splice(at, 1)[0];
  };
  game.spiceDeck.unshift(takeLand(), ...(advanced ? [takeLand()] : []));
  staging.push('Position unopened first-turn ordinary land Spice Cards; later choose one original second-turn worm before it is drawn.');
  reach(state => state.phase === 2 && selectedIndependentNexusClean(state));
  const purchase = purchaseOriginalCard(game, REINFORCEMENTS_CARD, actions, staging); game = purchase.game;
  const purchases = [purchase.bid];
  const kind = 'arrakeen', sector = territory(kind).sectors[0], location = `${kind}:${sector}`;
  reach(state => state.phase === 5 && state.active === 'ixians' && selectedIndependentNexusClean(state));
  const amount = program === 'mixed-return' ? 9 : 6, elite = program === 'mixed-return' ? 0 : 3;
  const homeworldSources = game.homeworlds ? nativeShipmentSources(viewGame(game, 'ixians'), amount, elite) : undefined;
  assert.ok(!game.homeworlds || homeworldSources);
  const beforeShipment = structuredClone(game);
  const ownShipment: SelectedIndependentNexusBattleStep = { actor: 'ixians', action: {
    type: 'ship', territory: kind, sector, amount, elite, allyPayment: 0,
    ...(homeworldSources ? { homeworldSources } : {}),
  } };
  game = actSelectedIndependentNexusBattle(game, ownShipment, actions);
  reach(state => selectedIndependentNexusClean(state));
  const afterShipment = structuredClone(game);
  reach(state => state.turn === 2 && state.phase === 1 && selectedIndependentNexusClean(state));
  const afterFirstMentat = structuredClone(game);
  const worm = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed);
  assert.ok(worm >= 0); game.spiceDeck.unshift(game.spiceDeck.splice(worm, 1)[0]);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && selectedIndependentNexusClean(state));
  act('guild', { type: 'alliance', target: 'emperor' });
  act('emperor', { type: 'alliance', target: 'guild' });
  reach(state => state.nexusCards?.phase?.stage === 'drawing');
  const cards = game.nexusCards!.cards!, next = cards.deck.indexOf('ixians'); assert.ok(next >= 0);
  cards.deck.unshift(cards.deck.splice(next, 1)[0]);
  staging.push('Order only the still-undealt Ixian Nexus singleton; the unallied native receives it through its original closing draw.');
  const beforeNexusDraw = structuredClone(game);
  const drawStep: SelectedIndependentNexusBattleStep = { actor: 'ixians', action: {
    type: 'nexusCardChoice', turn: game.turn, card: cards.hands.ixians, choice: 'draw', ownRedraws: 0,
  } };
  game = actSelectedIndependentNexusBattle(game, drawStep, actions);
  const afterNexusDraw = structuredClone(game);
  if (program === 'mixed-return') {
    reach(state => state.phase === 2 && selectedIndependentNexusClean(state));
    const purchase = purchaseOriginalCard(game, HARASS_WITHDRAW_CARD, actions, staging);
    game = purchase.game; purchases.push(purchase.bid);
  }
  reach(state => state.phase === 5 && state.active === 'guild' && selectedIndependentNexusClean(state));
  const enemySources = game.homeworlds ? nativeShipmentSources(viewGame(game, 'guild'), 3, 0) : undefined;
  assert.ok(!game.homeworlds || enemySources);
  const enemyShipment: SelectedIndependentNexusBattleStep = { actor: 'guild', action: {
    type: 'ship', territory: kind, sector, amount: 3, elite: 0, allyPayment: 0,
    ...(enemySources ? { homeworldSources: enemySources } : {}),
  } };
  game = actSelectedIndependentNexusBattle(game, enemyShipment, actions);
  reach(state => state.phase === 6 && selectedIndependentNexusClean(state));
  const beforeBattle = structuredClone(game), choices = viewGame(game, game.active!).battleChoices;
  const choice = choices.find(battle => battle.territory === kind); assert.ok(choice);
  const battleStep: SelectedIndependentNexusBattleStep = { actor: choice.chooser, action: {
    type: 'chooseBattle', territory: kind, target: choice.chooser === 'ixians' ? 'guild' : 'ixians',
  } };
  game = actSelectedIndependentNexusBattle(game, battleStep, actions);
  reach(state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed !== false && selectedIndependentNexusClean(state));
  const ix = selectedIndependentNexusPlayer(game, 'ixians'), tleilaxu = selectedIndependentNexusPlayer(game, 'tleilaxu');
  const leaders = ix.leaders.filter(leader => !leader.dead && !leader.usedAt &&
    !game.leaderSkills?.assignments.some(assignment => assignment.leader === leader.id));
  const leader = (program === 'faceDance' ? leaders.filter(leader =>
    tleilaxu.faceDancers!.some(dancer => !dancer.revealed && dancer.leader === leader.id)) : leaders)
    .sort((one, two) => two.strength - one.strength)[0];
  assert.ok(leader, 'Use an actually dealt matching native Face Dancer; never exchange identities');
  const enemy = selectedIndependentNexusPlayer(game, 'guild').leaders.filter(leader => !leader.dead && !leader.usedAt &&
    !game.leaderSkills?.assignments.some(assignment => assignment.leader === leader.id))
    .sort((one, two) => one.strength - two.strength)[0]; assert.ok(enemy);
  const sources = viewGame(game, 'ixians').battle!.reinforcements!.homeworldSources?.[0];
  const plans: SelectedIndependentNexusBattleStep[] = [
    { actor: 'ixians', action: { type: 'battlePlan', leader: leader.id,
      dial: program === 'mixed-return' ? 1 : 3, support: advanced && program !== 'mixed-return' ? 1 : 0,
      weapon: REINFORCEMENTS_CARD, defense: program === 'mixed-return' ? HARASS_WITHDRAW_CARD : null,
      ...(sources ? { reinforcementsSources: sources } : {}),
    } },
    { actor: 'guild', action: { type: 'battlePlan', leader: enemy.id, dial: 0, support: 0 } },
  ];
  const normal = Math.min(3, ix.reserves - (ix.elites?.reserves ?? 0));
  return { ...source, afterSetup, afterFirstMentat, beforeShipment, ownShipment, afterShipment,
    beforeNexusDraw, drawStep, afterNexusDraw, enemyShipment, beforeBattle, battleStep,
    game, program, kind, sector, location, plans, actions, staging, purchases,
    leader: leader.id, fee: { normal, elite: 3 - normal },
    returns: program === 'mixed-return' ? { [location]: { normal: 8, elite: 0 } } : null };
}

export function activateSelectedIndependentSuboids(game: Game, actions: SelectedIndependentNexusBattleStep[] = []): Game {
  const offer = viewGame(game, 'ixians').nexusSuboids!.offer!; assert.ok(offer && !offer.blocked);
  game = actSelectedIndependentNexusBattle(game, { actor: 'ixians', action: { type: 'nexusSuboids', event: offer.event } }, actions);
  return advanceSelectedIndependentNexusBattle(game, selectedIndependentNexusClean, actions);
}
export function revealSelectedIndependentNexusPlans(game: Game, plans: readonly SelectedIndependentNexusBattleStep[],
  actions: SelectedIndependentNexusBattleStep[] = []): Game {
  for (const step of plans) {
    game = actSelectedIndependentNexusBattle(game, step, actions);
    game = advanceSelectedIndependentNexusBattle(game, state => !state.response && !state.phaseOpening &&
      (!state.decision || state.decision.kind === 'harassWithdraw') &&
      !state.pendingNexusIxianBetrayal && !state.pendingGuildBetrayal, actions);
  }
  assert.ok(game.battle?.revealed); return game;
}
