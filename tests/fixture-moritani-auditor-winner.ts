import assert from 'node:assert/strict';
import { CHOAM_AUDITOR_ID } from '../game/choam-auditor';
import { type Action, type Game } from '../game/engine';
import {
  advanceMixedE3Moritani, createMixedE3MoritaniProgramme, mixedE3MoritaniClean,
  mixedE3MoritaniPlayer, mixedE3MoritaniReload, nextMixedE3MoritaniStep,
  openMixedE3MoritaniBattle, revealMixedE3MoritaniPlans, settleMixedE3MoritaniBoundary,
  shipMixedE3Moritani, stepMixedE3Moritani,
  type MixedE3MoritaniProgramme, type MixedE3MoritaniStep, type MixedE3MoritaniTransition,
} from './fixture-mixed-e3-moritani-nexus';

export type MoritaniAuditorWinnerFixture = MixedE3MoritaniProgramme & {
  readyBattle: Game;
  arrival: MixedE3MoritaniTransition;
  plans: MixedE3MoritaniStep[];
  ownLeader: string;
};

/** Original Advanced E2/E3 Nexus, without Skills or optional modules. The shared
 * programme scopes only original undealt shuffles and unplayed Spice/Nexus
 * positions. Setup, first Mentat, alliance, closing draw, paid shipment and
 * battle selection are actual actions; no disc, card, wallet or army is staged.
 * Auditor2 beats Vando1 at dial0, so its one genuinely shipped force survives. */
export function createMoritaniAuditorWinnerFixture(
  options: { seatIds?: readonly string[]; auditorTarget?: boolean } = {},
): MoritaniAuditorWinnerFixture {
  const f = createMixedE3MoritaniProgramme({
    rules: 'advanced', families: ['choam'], skills: false,
    homeworlds: false, discovery: false, tech: false, strongholds: false,
    traitorTarget: options.auditorTarget ? CHOAM_AUDITOR_ID : undefined,
    ...options,
  });
  assert.equal(f.nativeFaction, 'choam');
  const arrival = shipMixedE3Moritani(mixedE3MoritaniReload(f.game), f.native, f.location, 1, 0, f.actions);
  let g = openMixedE3MoritaniBattle(arrival.settled, f.moritani, f.native, f.actions);
  g = advanceMixedE3Moritani(g, s => !!s.battle && mixedE3MoritaniClean(s) &&
    !s.battle.preparation && s.battle.preLeader?.closed !== false, f.actions);
  const ownLeader = 'moritani-4';
  assert.equal(mixedE3MoritaniPlayer(g, f.moritani).leaders.find(l => l.id === ownLeader)?.dead, false);
  const auditor = mixedE3MoritaniPlayer(g, f.native).leaders.find(l => l.id === CHOAM_AUDITOR_ID);
  assert.ok(auditor && !auditor.dead && auditor.strength === 2,
    'Advanced setup must supply the actual optional Auditor disc.');
  const winningDisc = options.auditorTarget ? 'choam-0' : CHOAM_AUDITOR_ID;
  const plans: MixedE3MoritaniStep[] = [
    { actor: f.moritani, action: { type: 'battlePlan', leader: ownLeader, dial: 0, support: 0 } },
    { actor: f.native, action: { type: 'battlePlan', leader: winningDisc, dial: 0, support: 0 } },
  ];
  return { ...f, readyBattle: mixedE3MoritaniReload(g), arrival, plans, ownLeader };
}

export function revealMoritaniAuditorWinner(
  f: MoritaniAuditorWinnerFixture, state: Game = f.readyBattle,
): Game {
  return revealMixedE3MoritaniPlans(mixedE3MoritaniReload(state), f.plans, f.actions);
}

/** Stops at the genuine owner-only opportunity, before choosing any Traitor.
 * A missing opportunity is a production failure, never a fixture repair. */
export function pendingMoritaniAuditorAssassination(
  f: MoritaniAuditorWinnerFixture, revealed: Game = revealMoritaniAuditorWinner(f),
): Game {
  const boundary = settleMixedE3MoritaniBoundary(revealed, null, f.actions);
  assert.equal(boundary.kind, 'assassination',
    'A real surviving CHOAM disc win must offer its original printed-faction assassination choice.');
  assert.equal(boundary.game.decision?.kind, 'moritaniAssassinate');
  return boundary.game;
}

export function moritaniAuditorTargetAction(f: MoritaniAuditorWinnerFixture, pending: Game): Action {
  const d = pending.decision;
  assert.ok(d?.kind === 'moritaniAssassinate' && d.player === f.moritani);
  return { type: 'decision', event: d.event, card: f.target };
}

export function revealMoritaniAuditorTarget(
  f: MoritaniAuditorWinnerFixture, pending: Game,
): MixedE3MoritaniTransition {
  const step = { actor: f.moritani, action: moritaniAuditorTargetAction(f, pending) };
  return { before: mixedE3MoritaniReload(pending), step,
    after: stepMixedE3Moritani(pending, step, f.actions) };
}

/** Fixed own-seat choices only: no normal Traitor calls, no optional inspection,
 * and retain any used cards. All response and phase scheduling stays original. */
export function nextMoritaniAuditorWinnerStep(g: Game): MixedE3MoritaniStep | null {
  if (!g.response && !g.phaseOpening && !g.pendingTreacheryDiscard) {
    const d = g.decision;
    if (d?.kind === 'choamAudit') return { actor: d.player,
      action: { type: 'decision', event: d.event, audit: false } };
    if (d?.kind === 'battleCards') return { actor: d.player,
      action: { type: 'decision', discard: [] } };
  }
  const next = nextMixedE3MoritaniStep(g);
  if (next?.action.type === 'traitorCall') next.action.call = false;
  return next;
}

/** Completes original aftermath and stops at the first original Mentat Terror
 * placement, after automatic face-up retirement and private replacement. */
export function finishMoritaniAuditorReplacement(f: MoritaniAuditorWinnerFixture, state: Game): Game {
  let g = mixedE3MoritaniReload(state);
  for (let n = 0; n < 500; n++) {
    if (!g.response && !g.phaseOpening && g.decision?.kind === 'moritaniPlacement') return g;
    const next = nextMoritaniAuditorWinnerStep(g);
    assert.ok(next, `Choose the original Auditor aftermath ${g.decision?.kind ?? g.phase}.`);
    g = stepMixedE3Moritani(g, next, f.actions);
  }
  throw Error('The original Auditor battle did not reach Mentat replacement.');
}
