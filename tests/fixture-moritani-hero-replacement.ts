import assert from 'node:assert/strict';
import type { Action, Game } from '../game/engine';
import { CHEAP_HERO_TRAITOR } from '../game/traitors';
import {
  advanceMixedE3Moritani, createMixedE3MoritaniProgramme, mixedE3MoritaniClean,
  mixedE3MoritaniReload, nextMixedE3MoritaniStep, settleMixedE3MoritaniBoundary,
  stageMixedE3MoritaniLoss, stepMixedE3Moritani,
} from './fixture-mixed-e3-moritani-nexus';
import type {
  MixedE3MoritaniBattle, MixedE3MoritaniProgramme, MixedE3MoritaniStep, MixedE3MoritaniTransition,
} from './fixture-mixed-e3-moritani-nexus';

export type MoritaniHeroReplacementFixture = MixedE3MoritaniProgramme & {
  battle: MixedE3MoritaniBattle;
  pending: Game;
  reveal: MixedE3MoritaniTransition;
  /** Immediately after the actual native target reveal, before battle cleanup. */
  revealed: Game;
  /** Original Collection boundary, before the automatic Mentat replacement. */
  preMentat: Game;
};

/** Fixed own-seat aftermath choices: retain used cards and choose a legal
 * physical casualty option. Never calls a normal Traitor or stages custody. */
export function nextMoritaniHeroReplacementStep(g: Game): MixedE3MoritaniStep | null {
  if (!g.response && !g.phaseOpening && !g.pendingTreacheryDiscard) {
    const d = g.decision;
    if (d?.kind === 'battleLosses') {
      const elite = Math.max(...d.options.map(option => option.elite));
      return { actor: d.player, action: { type: 'decision',
        choice: d.options.findIndex(option => option.elite === elite) } };
    }
    if (d?.kind === 'battleCards')
      return { actor: d.player, action: { type: 'decision', discard: [] } };
  }
  const next = nextMixedE3MoritaniStep(g);
  if (next?.action.type === 'traitorCall') next.action.call = false;
  return next;
}

export function moritaniHeroTargetAction(f: Pick<MoritaniHeroReplacementFixture, 'moritani' | 'target'>,
  pending: Game): Action {
  const d = pending.decision;
  assert.ok(d?.kind === 'moritaniAssassinate' && d.player === f.moritani);
  return { type: 'decision', event: d.event, card: f.target };
}

/** Original no-Skills Advanced E1/E3 play with native Ixians and classic seats.
 * The shared producer selects only original undealt shuffle entropy, placing
 * the single physical Ix Hero Traitor first in the original remaining reserve.
 * There is no Tleilaxu seat or final Face Dancer reshuffle. Shared programme
 * Spice/Nexus ordering conserves unplayed cards; no played Traitor reserve,
 * hand, leader, wallet, army, battle or phase is edited here.
 *
 * Deliberately stops BEFORE the formerly failing Mentat transition, so the
 * same builder supports failing-before API proof and actual GameTable play. */
export function createMoritaniHeroReplacementFixture(
  options: { seatIds?: readonly string[] } = {},
): MoritaniHeroReplacementFixture {
  const f = createMixedE3MoritaniProgramme({
    rules: 'advanced', families: ['ix'], natives: { ix: 'ixians' }, skills: false,
    homeworlds: false, discovery: false, tech: false, strongholds: false,
    initialReserveTraitors: [CHEAP_HERO_TRAITOR], ...options,
  });
  assert.equal(f.nativeFaction, 'ixians');
  assert.equal(f.afterSetup.traitorReserve![0], CHEAP_HERO_TRAITOR);
  f.staging.push('Original undealt Traitor shuffle entropy places the canonical Ix Cheap Hero Traitor first in the remaining reserve; no played reserve reorder.');
  const battle = stageMixedE3MoritaniLoss(f, f.game);
  const boundary = settleMixedE3MoritaniBoundary(battle.revealed, null, f.actions);
  assert.equal(boundary.kind, 'assassination');
  const pending = mixedE3MoritaniReload(boundary.game);
  const step = { actor: f.moritani, action: moritaniHeroTargetAction(f, pending) };
  const revealed = stepMixedE3Moritani(mixedE3MoritaniReload(pending), step, f.actions);
  const reveal = { before: mixedE3MoritaniReload(pending), step,
    after: mixedE3MoritaniReload(revealed) };
  let g = mixedE3MoritaniReload(revealed);
  for (let n = 0; n < 240; n++) {
    if (!g.battle && mixedE3MoritaniClean(g)) break;
    const next = nextMoritaniHeroReplacementStep(g);
    assert.ok(next, `Choose the original Ixians aftermath ${g.decision?.kind ?? g.phase}.`);
    g = stepMixedE3Moritani(g, next, f.actions);
  }
  assert.ok(!g.battle && mixedE3MoritaniClean(g));
  const preMentat = advanceMixedE3Moritani(g,
    state => state.phase === 7 && mixedE3MoritaniClean(state), f.actions);
  assert.equal(preMentat.moritaniAssassinate!.opportunities.at(-1)!.stage, 'revealed');
  assert.equal(preMentat.traitorReserve![0], CHEAP_HERO_TRAITOR);
  return { ...f, battle, pending, reveal, revealed, preMentat };
}

/** Runs the original phase transition and automatic replacement, stopping at
 * the first genuine Mentat Terror-placement control. May also start directly
 * after the target reveal for GameTable/API continuation. */
export function finishMoritaniHeroReplacement(f: MoritaniHeroReplacementFixture,
  state: Game = f.preMentat): Game {
  let g = mixedE3MoritaniReload(state);
  for (let n = 0; n < 500; n++) {
    if (!g.response && !g.phaseOpening && g.decision?.kind === 'moritaniPlacement') return g;
    const next = nextMoritaniHeroReplacementStep(g);
    assert.ok(next, `Choose the original Hero-replacement continuation ${g.decision?.kind ?? g.phase}.`);
    g = stepMixedE3Moritani(g, next, f.actions);
  }
  throw Error('The original Ixians battle did not reach Mentat replacement.');
}
