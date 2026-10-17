import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { territory } from '../game/board';
import { nativeShipmentSources } from '../game/homeworld-options';
import { REINFORCEMENTS_CARD } from '../game/reinforcements';
import { HARASS_WITHDRAW_CARD, type HarassWithdrawSelection } from '../game/harass-withdraw';
import { quoteBattleResolution, type ResolutionCombatant } from '../game/battle-resolution-quote';
import {
  createIndependentCardModulesFixture, type IndependentCardModulesOptions,
  type IndependentCardModulesStep,
} from './fixture-independent-card-modules';
import {
  actSelectedIndependentNexusBattle, selectedIndependentNexusClean,
} from './fixture-selected-independent-nexus-battles';
import { nextClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export type E3IndependentNexusOccupyStep = IndependentCardModulesStep;
export type E3IndependentNexusOccupyOptions = Pick<IndependentCardModulesOptions,
  'expansions' | 'homeworlds' | 'skills' | 'tech' | 'strongholds'> & { lead?: 'ecaz' | 'ally' };
export const e3IndependentNexusOccupyClean = selectedIndependentNexusClean;
export const e3IndependentNexusOccupyPlayer = (game: Game, actor: string) => {
  const player = game.players.find(player => player.id === actor); assert.ok(player); return player;
};

/** Quiet printed optional placement and original reaction windows; the actual
 * coalition owner still chooses its lead, sealed plan and typed withdrawal. */
export function nextE3IndependentNexusOccupyStep(game: Game): E3IndependentNexusOccupyStep | null {
  if (game.pendingGuildBetrayal) {
    const frame = game.pendingGuildBetrayal;
    const actor = frame.required.find(id => !frame.passed.includes(id)); assert.ok(actor);
    return { actor, action: { type: 'guildBetrayalPass', event: frame.invoice.event } };
  }
  if (!game.response && !game.phaseOpening) {
    if (game.pendingNexusIxianBetrayal) {
      const frame = game.pendingNexusIxianBetrayal;
      const actor = frame.required.find(id => !frame.passed.includes(id)); assert.ok(actor);
      return { actor, action: { type: 'nexusIxianBetrayalPass', event: frame.source.event } };
    }
    const decision = game.decision;
    if (decision?.kind === 'ecazPlacement' || decision?.kind === 'moritaniPlacement')
      return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision && ['ecazBattleLead', 'harassWithdraw', 'battleLosses'].includes(decision.kind)) return null;
  }
  return nextClassicDiscoveryNexusStep(game);
}
export function actE3IndependentNexusOccupy(game: Game, step: E3IndependentNexusOccupyStep,
  actions?: E3IndependentNexusOccupyStep[]): Game {
  return actSelectedIndependentNexusBattle(game, step, actions);
}
export function advanceE3IndependentNexusOccupy(game: Game, until: (game: Game) => boolean,
  actions: E3IndependentNexusOccupyStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'Original Occupy game ended before its requested card window');
    const step = nextE3IndependentNexusOccupyStep(game);
    assert.ok(step, `Choose the real plan/allocation at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actE3IndependentNexusOccupy(game, step, actions);
  }
  throw Error('Original independent Nexus Occupy programme did not reach its boundary');
}

/** Select an unopened singleton, then buy it with the real native auction.
 * The roster has no Ixian provider; selected family cards alone create no pool. */
function buyCard(game: Game, owner: string, desired: string, actions: E3IndependentNexusOccupyStep[], staging: string[]) {
  assert.equal(game.phase, 2);
  const at = game.deck.findIndex(card => card.id === desired); assert.ok(at >= 0);
  game.deck.unshift(game.deck.splice(at, 1)[0]);
  staging.push(`Position unopened ${desired} before the actual turn-${game.turn} ordinary auction; ${owner} acquires it only by its paid one-spice bid.`);
  let bid: { before: Game; step: E3IndependentNexusOccupyStep } | undefined;
  for (let count = 0; count < 280; count++) {
    if (e3IndependentNexusOccupyPlayer(game, owner).hand.some(card => card.id === desired)) {
      assert.ok(bid, 'The actual auction must have accepted its owner bid');
      return { game, bid };
    }
    let step: E3IndependentNexusOccupyStep | null = null;
    if (e3IndependentNexusOccupyClean(game) && game.auction?.active === owner &&
      game.auction.cards[game.auction.index].id === desired && game.auction.bid === 0) {
      step = { actor: owner, action: { type: 'bid', amount: 1, allyPayment: 0 } };
      bid = { before: structuredClone(game), step: structuredClone(step) };
    }
    step ??= nextE3IndependentNexusOccupyStep(game); assert.ok(step);
    game = actE3IndependentNexusOccupy(game, step, actions);
  }
  throw Error('Original Occupy auction did not deliver its selected physical card');
}

/** Original native Ecaz setup and first Mentat, two funded auctions, real worm
 * alliance/closing Nexus draw, paid typed arrivals and actual lead selection.
 * Only unopened physical deck positions are chosen; original six Imperial
 * Basin counters, hands, purses, receipts and module owners are never assigned. */
export function createE3IndependentNexusOccupyFixture(options: E3IndependentNexusOccupyOptions = {}) {
  const lead = options.lead ?? 'ecaz', cardUser = lead === 'ecaz' ? 'ecaz' : 'emperor';
  const source = createIndependentCardModulesFixture({ ...options, advanced: true,
    expansions: options.expansions ?? ['ecaz'], factions: ['ecaz', 'emperor', 'guild'],
    independent: true, nexus: true, tech: options.tech ?? false });
  let game = structuredClone(source.game);
  const afterSetup = structuredClone(game), actions = [...source.steps], staging: string[] = [];
  const act = (actor: string, action: Action) => {
    game = actE3IndependentNexusOccupy(game, { actor, action }, actions);
  };
  const reach = (until: (game: Game) => boolean) => {
    game = advanceE3IndependentNexusOccupy(game, until, actions);
  };
  const takeLand = () => {
    const at = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(at >= 0);
    return game.spiceDeck.splice(at, 1)[0];
  };
  game.spiceDeck.unshift(takeLand(), takeLand());
  staging.push('Order unopened first-turn land Spice Cards; later order one original ordinary worm before the second-turn Blow.');
  reach(state => state.phase === 2 && e3IndependentNexusOccupyClean(state));
  const firstPurchase = buyCard(game, cardUser, REINFORCEMENTS_CARD, actions, staging); game = firstPurchase.game;
  const purchases = [firstPurchase.bid];
  const kind = 'arrakeen', sector = territory(kind).sectors[0], location = `${kind}:${sector}`;
  const shipments: { before: Game; step: E3IndependentNexusOccupyStep; after: Game }[] = [];
  const ship = (actor: string, amount: number, elite: number) => {
    const homeworldSources = game.homeworlds ? nativeShipmentSources(viewGame(game, actor), amount, elite) : undefined;
    assert.ok(!game.homeworlds || homeworldSources);
    const before = structuredClone(game), step: E3IndependentNexusOccupyStep = { actor, action: {
      type: 'ship', territory: kind, sector, amount, elite, allyPayment: 0,
      ...(homeworldSources ? { homeworldSources } : {}),
    } };
    game = actE3IndependentNexusOccupy(game, step, actions);
    reach(e3IndependentNexusOccupyClean);
    shipments.push({ before, step, after: structuredClone(game) });
  };
  reach(state => state.phase === 5 && state.active === 'ecaz' && e3IndependentNexusOccupyClean(state));
  ship('ecaz', 5, 0);
  reach(state => state.turn === 2 && state.phase === 1 && e3IndependentNexusOccupyClean(state));
  const afterFirstMentat = structuredClone(game);
  const worm = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed);
  assert.ok(worm >= 0); game.spiceDeck.unshift(game.spiceDeck.splice(worm, 1)[0]);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && e3IndependentNexusOccupyClean(state));
  const beforeAlliance = structuredClone(game);
  act('ecaz', { type: 'alliance', target: 'emperor' });
  act('emperor', { type: 'alliance', target: 'ecaz' });
  reach(state => state.nexusCards?.phase?.stage === 'drawing');
  const cards = game.nexusCards!.cards!, next = cards.deck.indexOf('guild'); assert.ok(next >= 0);
  cards.deck.unshift(cards.deck.splice(next, 1)[0]);
  staging.push('Order the unopened Guild Nexus singleton; the unallied Guild receives its own card through the real closing draw while the coalition is already allied.');
  const beforeNexusDraw = structuredClone(game), drawStep: E3IndependentNexusOccupyStep = { actor: 'guild', action: {
    type: 'nexusCardChoice', turn: game.turn, card: cards.hands.guild, choice: 'draw', ownRedraws: 0,
  } };
  game = actE3IndependentNexusOccupy(game, drawStep, actions);
  const afterNexusDraw = structuredClone(game);
  reach(state => state.phase === 2 && e3IndependentNexusOccupyClean(state));
  const secondPurchase = buyCard(game, cardUser, HARASS_WITHDRAW_CARD, actions, staging);
  game = secondPurchase.game; purchases.push(secondPurchase.bid);
  reach(state => state.phase === 5 && e3IndependentNexusOccupyClean(state));
  const waiting = new Set(['emperor', 'guild']);
  while (game.phase === 5) {
    if (e3IndependentNexusOccupyClean(game) && waiting.has(game.active!)) {
      const actor = game.active!; ship(actor, actor === 'emperor' ? 5 : 3, actor === 'emperor' ? 2 : 0);
      waiting.delete(actor);
    } else {
      const step = nextE3IndependentNexusOccupyStep(game); assert.ok(step);
      game = actE3IndependentNexusOccupy(game, step, actions);
    }
  }
  assert.equal(waiting.size, 0);
  reach(state => state.phase === 6 && e3IndependentNexusOccupyClean(state));
  const beforeBattle = structuredClone(game), choice = viewGame(game, game.active!).battleChoices.find(choice => choice.territory === kind);
  assert.ok(choice);
  const battleStep: E3IndependentNexusOccupyStep = { actor: choice.chooser, action: { type: 'chooseBattle', territory: kind,
    target: choice.attacker === choice.chooser ? choice.defender : choice.attacker } };
  game = actE3IndependentNexusOccupy(game, battleStep, actions);
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'ecazBattleLead');
  const beforeLead = structuredClone(game);
  assert.ok(game.decision?.kind === 'ecazBattleLead');
  const leadStep: E3IndependentNexusOccupyStep = { actor: 'ecaz', action: { type: 'decision', event: game.decision.event, lead: cardUser } };
  game = actE3IndependentNexusOccupy(game, leadStep, actions);
  reach(state => !!state.battle && !state.battle.preparation && state.battle.preLeader?.closed !== false && e3IndependentNexusOccupyClean(state));
  const own = viewGame(game, cardUser).battle!, profile = own.ecazOccupy?.profile; assert.ok(profile);
  const leaders = (actor: string) => e3IndependentNexusOccupyPlayer(game, actor).leaders.filter(leader => !leader.dead && !leader.usedAt &&
    !game.leaderSkills?.assignments.some(assignment => assignment.leader === leader.id));
  const leader = leaders(cardUser).sort((one, two) => two.strength - one.strength)[0]; assert.ok(leader);
  const enemy = leaders('guild').sort((one, two) => one.strength - two.strength)[0]; assert.ok(enemy);
  const support = profile.forces.eliteFreeSupport || profile.forces.freeSupport ? 0 : 1;
  const feeSources = own.reinforcements!.homeworldSources?.[0];
  const plans: E3IndependentNexusOccupyStep[] = [
    { actor: cardUser, action: { type: 'battlePlan', dial: profile.fixedEcazDial + 2, support, leader: leader.id,
      weapon: REINFORCEMENTS_CARD, defense: HARASS_WITHDRAW_CARD, allyPayment: 0,
      ...(feeSources ? { reinforcementsSources: feeSources } : {}),
    } },
    { actor: 'guild', action: { type: 'battlePlan', dial: 0, support: 0, leader: enemy.id } },
  ];
  const returns: HarassWithdrawSelection = { [location]: cardUser === 'ecaz'
    ? { normal: 2, elite: 0 } : { normal: 3, elite: 1 } };
  return { ...source, afterSetup, afterFirstMentat, beforeAlliance, beforeNexusDraw, drawStep, afterNexusDraw,
    beforeBattle, battleStep, beforeLead, leadStep, game, lead, cardUser, kind, sector, location,
    profile, support, plans, returns, actions, staging, purchases, shipments };
}

export function revealE3IndependentNexusOccupy(game: Game, plans: readonly E3IndependentNexusOccupyStep[],
  actions: E3IndependentNexusOccupyStep[] = []): Game {
  for (const step of plans) {
    game = actE3IndependentNexusOccupy(game, step, actions);
    game = advanceE3IndependentNexusOccupy(game, state => !state.response && !state.phaseOpening &&
      (!state.decision || state.decision.kind === 'harassWithdraw') && !state.pendingGuildBetrayal &&
      !state.battle?.preparation && state.battle?.preLeader?.closed !== false, actions);
  }
  assert.ok(game.battle?.revealed); return game;
}
export function settleE3IndependentNexusOccupy(game: Game, returns: HarassWithdrawSelection,
  actions: E3IndependentNexusOccupyStep[] = []): Game {
  for (let count = 0; count < 360; count++) {
    if (game.phase === 7 && !game.battle && e3IndependentNexusOccupyClean(game)) return game;
    let step: E3IndependentNexusOccupyStep | null = null;
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'harassWithdraw')
      step = { actor: game.decision.player, action: { type: 'decision', event: game.decision.event, returns } };
    if (!game.response && !game.phaseOpening && game.decision?.kind === 'battleLosses') {
      const choice = game.decision.options.findIndex(loss => loss.normal === 0 && loss.elite === 1); assert.ok(choice >= 0);
      step = { actor: game.decision.player, action: { type: 'decision', choice } };
    }
    step ??= nextE3IndependentNexusOccupyStep(game); assert.ok(step);
    game = actE3IndependentNexusOccupy(game, step, actions);
  }
  throw Error('Original combined card costs/returns/losses did not finish into Collection');
}

/** Project the genuinely revealed normal-outcome plans with explicit original
 * owner allocations; the programme subsequently declines every real Traitor. */
export function quoteE3IndependentNexusOccupy(game: Game, cardUser: string, returns: HarassWithdrawSelection) {
  const battle = game.battle; assert.ok(battle?.revealed);
  const own = viewGame(game, cardUser).battle!, profile = own.ecazOccupy?.profile; assert.ok(profile);
  const combatant = (actor: string): ResolutionCombatant => {
    const player = e3IndependentNexusOccupyPlayer(game, actor), view = viewGame(game, actor).battle!;
    const plan = battle.plans[actor]; assert.ok(plan);
    return { id: actor, faction: player.faction, spice: player.spice, hand: player.hand, plan,
      leader: player.leaders.find(leader => leader.id === plan.leader), forces: view.ownForces!,
      stronghold: view.strongholdEffects[actor],
      leaderSkills: (game.leaderSkills?.assignments ?? []).filter(assignment => assignment.owner === actor)
        .map(assignment => ({ skill: assignment.skill, leader: assignment.leader,
          faceUp: battle.leaderSkillHidden?.[actor] !== true, captured: false })),
      ...(view.reinforcements ? { reinforcementsReserves: {
        normal: player.reserves - (player.elites?.reserves ?? 0), elite: player.elites?.reserves ?? 0 } } : {}),
      ...(view.harassWithdraw ? { harassWithdraw: { blocked: null, forces: view.harassWithdraw.forces,
        locations: view.harassWithdraw.locations,
        ...(view.harassWithdraw.occupy ? { occupy: view.harassWithdraw.occupy } : {}) }, harassSelection: returns } : {}),
    };
  };
  return quoteBattleResolution({ advanced: game.advanced, turn: game.turn, territory: battle.territory,
    aggressor: viewGame(game, game.host).battle!.aggressor, ecazOccupy: profile,
    attacker: combatant(battle.attacker), defender: combatant(battle.defender),
    voters: viewGame(game, game.host).battle!.traitorVoters.map(actor => ({ id: actor,
      beneficiary: [profile.ecaz, profile.ally].includes(actor) ? profile.lead : actor,
      called: false, traitors: e3IndependentNexusOccupyPlayer(game, actor).traitors })),
    participants: game.players,
    physicalCards: [...game.deck, ...game.discard, ...game.players.flatMap(player => player.hand)],
    pendingAuditorPresent: false, pendingRetentionPresent: false,
  });
}
