import assert from 'node:assert/strict';
import { viewGame, type Game } from '../game/engine';
import { leaders } from '../game/cards';
import { territory } from '../game/board';
import { DUKE_VIDAL_ID } from '../game/duke-vidal';
import {
  advancePairedE3Nexus, createPairedE3NexusSetup, nextPairedE3NexusStep,
  pairedE3NexusClean, pairedE3NexusInventory, pairedE3NexusPlayer,
  pairedE3NexusReload, quietPairedE3NexusChoice, revealPairedE3Nexus,
  stepPairedE3Nexus,
  type PairedE3NexusStep, type PairedE3NexusTransition,
} from './fixture-paired-e3-nexus-modules';
import { quietPlan } from './fixture-nexus-duke-capture';

/** Original Advanced paired Ecaz/Moritani/Guild Nexus, without Skills or optional
 * modules. The paired fixture selects only original undealt setup entropy,
 * including the Ecaz Traitor Card Moritani actually keeps. No played hand,
 * wallet, force, leader, battle, phase or custody field is assigned here.
 *
 * Ecaz pays for its original reusable Ambassador; Moritani's actual paid
 * shipment triggers its acquisition. Ecaz's own paid shipment makes the real
 * battle in that same stronghold. This is not a synthetic Duke controller. */
export interface MoritaniEcazDukeWinner {
  initial: Game;
  offered: Game;
  afterSetup: Game;
  ecaz: string;
  moritani: string;
  token: string;
  location: string;
  sector: number;
  target: string;
  placement: PairedE3NexusTransition;
  acquisition: PairedE3NexusTransition;
  shipments: PairedE3NexusTransition[];
  beforeBattle: Game;
  choice: PairedE3NexusStep;
  plans: PairedE3NexusStep[];
  /** Both real sealed plans revealed; original traitor declarations still due. */
  ready: Game;
  /** The real missing-before-fix private Assassinate Leaders opportunity. */
  pending: Game;
  actions: PairedE3NexusStep[];
}

function settlementChoice(g: Game): PairedE3NexusStep | null {
  const d = g.decision;
  if (!d || g.response || g.phaseOpening) return null;
  if (d.kind === 'battleLosses') return { actor: d.player, action: { type: 'decision', choice: 0 } };
  if (d.kind === 'battleCards') return { actor: d.player, action: { type: 'decision', discard: [] } };
  if (d.kind === 'moritaniRetention') return { actor: d.player, action: { type: 'decision', keep: null,
    ...(d.source === 'nexus' ? { event: d.event } : {}) } };
  return quietPairedE3NexusChoice(g);
}

/** Original cleanup only; no forged resolution or erased saved continuation. */
export function settleMoritaniEcazDukeWinner(g: Game, stopAtChoice = false,
  actions?: PairedE3NexusStep[]): Game {
  for (let n = 0; n < 400; n++) {
    if (!g.response && !g.phaseOpening &&
      (stopAtChoice && g.decision?.kind === 'moritaniAssassinate' ||
        !g.battle && pairedE3NexusClean(g))) return g;
    const next = nextPairedE3NexusStep(g) ?? settlementChoice(g);
    assert.ok(next, `Original Ecaz/Duke cleanup needs its owner at ${g.decision?.kind ?? g.phase}`);
    g = stepPairedE3Nexus(g, next, actions);
  }
  throw Error('Original Ecaz/Duke battle cleanup did not finish');
}

export function createMoritaniEcazDukeWinner(): MoritaniEcazDukeWinner {
  const f = createPairedE3NexusSetup({ roster: ['ecaz', 'moritani', 'guild'],
    advanced: true, skills: false, homeworlds: false, discovery: false,
    tech: false, strongholds: false, assassinationFaction: 'ecaz' });
  const actions = f.actions;
  let g = pairedE3NexusReload(f.afterSetup);
  // Reuse the native Duke fixture's original supply/empty-stronghold selection.
  const native = quietPlan(g), token = native.token, location = native.destination;
  const sector = territory(location).sectors.find(s => s !== g.storm)!;
  assert.ok(Number.isInteger(sector));
  const target = leaders('ecaz').find(l => pairedE3NexusPlayer(g, f.moritani).traitors.includes(l.id))!.id;
  assert.ok(target);

  g = advancePairedE3Nexus(g, s => !s.response && !s.phaseOpening &&
    s.decision?.kind === 'ecazPlacement', actions, quietPairedE3NexusChoice);
  const placementBefore = pairedE3NexusReload(g);
  const placementStep: PairedE3NexusStep = { actor: f.ecaz,
    action: { type: 'decision', token, territory: location } };
  g = stepPairedE3Nexus(g, placementStep, actions);
  g = advancePairedE3Nexus(g, s => !s.response &&
    s.ecazAmbassadors!.tokens.find(t => t.id === token)!.zone === 'placed', actions, quietPairedE3NexusChoice);
  const placement = { before: placementBefore, step: placementStep, after: pairedE3NexusReload(g) };

  const remaining = new Set([f.ecaz, f.moritani]);
  const shipments: PairedE3NexusTransition[] = [];
  let acquisition: PairedE3NexusTransition | null = null;
  while (remaining.size) {
    g = advancePairedE3Nexus(g, s => s.phase === 5 && pairedE3NexusClean(s) &&
      remaining.has(s.active!), actions, quietPairedE3NexusChoice);
    const actor = g.active!, before = pairedE3NexusReload(g);
    const step: PairedE3NexusStep = { actor, action: { type: 'ship', territory: location,
      sector, amount: 1, elite: 0, allyPayment: 0 } };
    g = stepPairedE3Nexus(g, step, actions);
    g = advancePairedE3Nexus(g, s => !s.response && !s.phaseOpening &&
      (s.decision?.kind === 'ecazAmbassador' || pairedE3NexusClean(s) && !s.pendingShipment),
      actions, quietPairedE3NexusChoice);
    if (actor === f.moritani) {
      assert.equal(g.decision?.kind, 'ecazAmbassador');
      const entry = g.pendingAmbassador!;
      assert.equal(entry.token, token);
      assert.equal(entry.stage, 'offer');
      assert.equal(entry.entrant, f.moritani);
      const acquire: PairedE3NexusStep = { actor: f.ecaz, action: { type: 'decision',
        event: entry.event, trigger: true, beneficiary: f.ecaz, choice: 'duke' } };
      const acquisitionBefore = pairedE3NexusReload(g);
      g = stepPairedE3Nexus(g, acquire, actions);
      acquisition = { before: acquisitionBefore, step: acquire, after: pairedE3NexusReload(g) };
    }
    g = advancePairedE3Nexus(g, s => pairedE3NexusClean(s) && !s.pendingShipment,
      actions, quietPairedE3NexusChoice);
    shipments.push({ before, step, after: pairedE3NexusReload(g) });
    remaining.delete(actor);
    if (remaining.size) g = stepPairedE3Nexus(g, { actor, action: { type: 'endMovement' } }, actions);
  }
  assert.ok(acquisition);
  assert.equal(g.dukeVidal!.controller, f.ecaz);
  assert.equal(g.dukeVidal!.source, 'ecaz');
  g = advancePairedE3Nexus(g, s => s.phase === 6 && pairedE3NexusClean(s), actions, quietPairedE3NexusChoice);
  const beforeBattle = pairedE3NexusReload(g);
  const physical = viewGame(g, g.active!).battleChoices.find(c => c.territory === location);
  assert.ok(physical);
  const choice: PairedE3NexusStep = { actor: physical.chooser, action: { type: 'chooseBattle',
    territory: location, target: physical.attacker === physical.chooser ? physical.defender : physical.attacker } };
  g = stepPairedE3Nexus(g, choice, actions);
  const losing = pairedE3NexusPlayer(g, f.moritani).leaders.filter(l => !l.dead && !l.usedAt)
    .sort((a, b) => a.strength - b.strength)[0];
  assert.ok(losing && losing.strength < 6);
  const plans: PairedE3NexusStep[] = [
    { actor: f.ecaz, action: { type: 'battlePlan', leader: DUKE_VIDAL_ID, dial: 0, support: 0 } },
    { actor: f.moritani, action: { type: 'battlePlan', leader: losing.id, dial: 0, support: 0 } },
  ];
  const ready = revealPairedE3Nexus(g, plans, actions);
  const pending = settleMoritaniEcazDukeWinner(ready, true, actions);
  assert.equal(pending.decision?.kind, 'moritaniAssassinate',
    'A real normal Moritani loss to Ecaz using surviving Duke6 must open the private opportunity');
  pairedE3NexusInventory(pending);
  return { initial: f.initial, offered: f.offered, afterSetup: f.afterSetup,
    ecaz: f.ecaz, moritani: f.moritani, token, location, sector, target,
    placement, acquisition, shipments, beforeBattle, choice, plans, ready, pending, actions };
}
