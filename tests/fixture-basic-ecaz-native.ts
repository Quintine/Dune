import assert from 'node:assert/strict';
import { applyAction, viewGame, type Action, type Game } from '../game/engine';
import { botActions } from '../game/bots';
import type { Difficulty } from '../game/bot-profiles';
import { quoteEcazOccupyDial } from '../game/ecaz-occupy-battle';
import { ecazOccupyRicheseFixture, occupyRicheseSeat,
  type EcazOccupyRicheseFixture, type EcazOccupyRicheseOptions } from './fixture-ecaz-occupy-richese';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type BasicEcazNativeStep = { actor: string; action: Action };
export type BasicEcazNativeLead = 'ecaz' | 'ally';
export type BasicEcazNativeOptions = Omit<EcazOccupyRicheseOptions,
  'advanced' | 'publicStart' | 'omitPreview'> & {
  /** Labelled conserved eight-counter Ix army, including two original Cyborgs. */
  mixedIxians?: boolean;
};
export type BasicEcazNativeFixture = EcazOccupyRicheseFixture & { source: Game };
export const basicEcazNativeClean = (game: Game) =>
  !game.response && !game.phaseOpening && !game.decision;

/** Live native windows only; plans remain an explicit action by their real owner. */
export function nextBasicEcazNativeStep(game: Game): BasicEcazNativeStep | null {
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'richeseAllyOpportunity')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'faceDance')
    return { actor: game.decision.player, action: { type: 'decision', reveal: false } };
  return nextRicheseStrongholdsNativeStep(game);
}

/** Genuine public Basic ready/start/setup, original native components, real Nexus
 * alliance and actual No-Field shipment from the shared fixture. Its conserved
 * board, thirty-spice budget and Karama staging are explicit controlled inputs;
 * this is not an unstaged game or a played Advanced game with a changed flag. */
export function basicEcazNativeFixture(options: BasicEcazNativeOptions = {}): BasicEcazNativeFixture {
  const { mixedIxians, ...nativeOptions } = options;
  const fixture = ecazOccupyRicheseFixture({ ...nativeOptions, advanced: false, publicStart: true });
  assert.equal(fixture.initial.advanced, false);
  assert.equal(fixture.initial.status, 'setup');
  assert.equal(fixture.initial.ecazOccupyPreview, true);
  assert.ok(!fixture.initial.ecazTreachery && !fixture.initial.homeworlds &&
    !fixture.initial.nexusCards && !fixture.initial.leaderSkills &&
    !fixture.initial.strongholdCards && !fixture.initial.techTokens &&
    !fixture.initial.discoveryEnabled && !fixture.initial.greatMaker);
  if (mixedIxians) {
    // Stage before admission, so the original chooseBattle sees actual native
    // types. The first shared-fixture admission is discarded with its branch.
    let game = structuredClone(fixture.beforeBattle);
    const ix = occupyRicheseSeat(game, fixture.ally);
    assert.equal(ix.faction, 'ixians');
    assert.ok(ix.elites && ix.elites.reserves >= 2 && ix.reserves >= 4);
    assert.equal(ix.forces[fixture.location], 4);
    ix.reserves -= 4;
    ix.forces[fixture.location] += 4;
    ix.elites.reserves -= 2;
    ix.elites.forces[fixture.location] = 2;
    fixture.staging.push('Before real battle admission: conserve eight actual Ixian counters at Carthag, including two original reserve Cyborgs; no typed casualty or substitution is installed.');
    fixture.beforeBattle = structuredClone(game);
    const choice = viewGame(game, game.active!).battleChoices.find(b => b.territory === fixture.territory);
    assert.ok(choice);
    game = applyAction(game, choice.chooser, { type: 'chooseBattle', territory: fixture.territory,
      target: choice.attacker === choice.chooser ? choice.defender : choice.attacker });
    fixture.game = game;
  }
  return { ...fixture, source: fixture.initial };
}

export type BasicEcazNativeResolveOptions = {
  /** Choose the live allocation; omitted cases consume its first legal option. */
  losses?: { normal: number; elite: number };
  substitute?: boolean;
  canceled?: boolean;
  variableDial?: number;
  /** Uses the existing projected legal policy for the lead and plain plan. */
  difficulty?: Difficulty;
};

function leader(game: Game, actor: string, strongest: boolean): string {
  const available = occupyRicheseSeat(game, actor).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength);
  assert.ok(available[0]);
  return available[0].id;
}
function policyActions(game: Game, actor: string, difficulty: Difficulty): Action[] {
  const view = viewGame(game, actor);
  view.players.find(p => p.id === actor)!.bot = difficulty;
  return botActions(view);
}

/** Select, seal, reveal and settle one original Basic native coalition battle.
 * Captured stages and actions are available for bounded runtime/control proof. */
export function resolveBasicEcazNative(fixture: BasicEcazNativeFixture, lead: BasicEcazNativeLead,
  options: BasicEcazNativeResolveOptions = {}) {
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  let game = structuredClone(fixture.game);
  const actions: BasicEcazNativeStep[] = [];
  const act = (player: string, action: Action) => {
    game = applyAction(game, player, action);
    actions.push({ actor: player, action: structuredClone(action) });
  };
  const next = () => {
    const step = nextBasicEcazNativeStep(game);
    assert.ok(step, 'The actual native continuation must retain a legal action.');
    act(step.actor, step.action);
  };
  assert.equal(game.decision?.kind, 'ecazBattleLead');
  const selectedLead = options.difficulty
    ? policyActions(game, fixture.ecaz, options.difficulty).find(a => a.type === 'decision' && a.lead === actor)
    : { type: 'decision', event: game.decision!.event, lead: actor } satisfies Action;
  assert.ok(selectedLead, 'The policy must retain this actual native lead choice.');
  act(fixture.ecaz, selectedLead);
  if (options.canceled) {
    assert.equal(game.response?.kind, 'ecazOccupy');
    const card = occupyRicheseSeat(game, fixture.opponent).hand.find(c => c.effect === 'karama');
    assert.ok(card);
    act(fixture.opponent, { type: 'card', mode: 'cancel', card: card.id });
  }
  for (let count = 0; count < 100; count++) {
    if (game.battle && !game.battle.preparation &&
      (!game.battle.preLeader || game.battle.preLeader.closed) && basicEcazNativeClean(game)) break;
    next();
  }
  assert.ok(game.battle && basicEcazNativeClean(game));
  const before = structuredClone(game);
  const profile = viewGame(game, actor).battle!.ecazOccupy!.profile!;
  assert.ok(profile);
  assert.equal(profile.advanced, false);
  assert.equal(profile.maxSupport, 0);
  const variable = options.variableDial ?? Math.min(2, profile.maxDial - profile.fixedEcazDial);
  const dial = profile.fixedEcazDial + variable;
  quoteEcazOccupyDial(profile, dial, 0);
  const plan = options.difficulty
    ? policyActions(game, actor, options.difficulty).find(a => a.type === 'battlePlan' &&
      a.dial === dial && Number(a.support ?? 0) === 0 && !a.weapon && !a.defense &&
      a.leader === leader(game, actor, true))
    : { type: 'battlePlan', dial, support: 0, leader: leader(game, actor, true) } satisfies Action;
  assert.ok(plan, 'Every profile must offer a legal plain actual-owner plan.');
  const concealed = structuredClone(occupyRicheseSeat(game, fixture.richese).noField!.deployed);
  act(actor, plan);
  const firstSeal = structuredClone(game);
  assert.equal(game.battle!.revealed, false);
  assert.deepEqual(occupyRicheseSeat(game, fixture.richese).noField!.deployed, concealed);
  assert.equal(viewGame(game, fixture.opponent).battle!.plans[actor], undefined);
  act(fixture.opponent, { type: 'battlePlan', dial: 0, support: 0,
    leader: leader(game, fixture.opponent, false) });
  assert.equal(game.battle!.revealed, true);
  const revealed = structuredClone(game);
  let typedDecision: Game | null = null;
  let afterLosses: Game | null = null;
  let substitutionDecision: Game | null = null;
  let afterSubstitution: Game | null = null;
  for (let count = 0; count < 200; count++) {
    if (!game.battle && basicEcazNativeClean(game) && !game.pendingTreacheryDiscard) break;
    // Actions replace this game inside the local closure. Read each current
    // decision afresh instead of retaining the initial lead-choice narrowing.
    const decision = (game as Game).decision;
    if (!game.response && !game.phaseOpening && decision?.kind === 'battleLosses') {
      typedDecision = structuredClone(game);
      const choice = options.losses ? decision.options.findIndex(loss =>
        loss.normal === options.losses!.normal && loss.elite === options.losses!.elite) : 0;
      assert.ok(choice >= 0, 'The original native decision must offer the requested typed loss.');
      act(decision.player, { type: 'decision', choice });
      afterLosses = structuredClone(game);
    } else if (!game.response && !game.phaseOpening && decision?.kind === 'ixSubstitution') {
      substitutionDecision = structuredClone(game);
      assert.equal(decision.player, fixture.ally, 'The physical Ixian owns substitution.');
      if (options.substitute) {
        const lost = decision.losses[fixture.location];
        assert.ok(lost > 0);
        act(decision.player, { type: 'decision', sources: { [fixture.location]: lost },
          recover: { [fixture.location]: lost } });
      } else act(decision.player, { type: 'decision', decline: true });
      while (game.response) next();
      afterSubstitution = structuredClone(game);
    } else next();
  }
  assert.equal(game.battle, null);
  assert.equal(game.decision, null);
  assert.equal(game.lastBattleContext?.result, 'normal');
  assert.equal(game.lastBattleContext?.winner, actor);
  assert.equal(game.phase, 7, 'The original coalition battle continues to native Basic Collection.');
  return { fixture, source: fixture.source, actor, selectedLead, before, firstSeal, revealed,
    typedDecision, afterLosses, substitutionDecision, afterSubstitution,
    profile, variable, plan, actions, staging: fixture.staging, result: game, game };
}
