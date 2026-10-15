import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { distance, TERRITORIES } from '../game/board';
import { presenceAt } from '../game/force-presence';
import { quoteSmugglerShipment } from '../game/smuggler-shipment';
import { createGuildAmbassadorIncomeArrival } from './fixture-guild-ambassador-income-arrival';
import {
  nextPairedE3NexusStep, pairedE3NexusClean, pairedE3NexusPlayer,
  pairedE3NexusReload, quietPairedE3NexusChoice, stepPairedE3Nexus,
  type PairedE3NexusStep,
} from './fixture-paired-e3-nexus-modules';
import { smugglerNoFieldAction, smugglerNoFieldGame } from './smuggler-no-field-fixture';

/** Deliberately selected standalone modules and one composition, not a matrix. */
export const NATIVE_GUILD_RATE_MODULE_SELECTIONS = {
  skills: { skills: true },
  discovery: { discovery: true },
  tech: { tech: true },
  strongholds: { strongholds: true },
  composed: { skills: true, discovery: true, tech: true, strongholds: true },
} as const;
export type NativeGuildRateModuleSelection = keyof typeof NATIVE_GUILD_RATE_MODULE_SELECTIONS;
export type NativeGuildRateRoute = 'reserve' | 'transport';

/** Original setup choices flow through the shared lobby/setup; modules are never
 * grafted onto a played game. Original undealt entropy, the paid Karama auction,
 * the real Nexus alliance and paid Ambassador retain the shared provenance. */
export function createNativeGuildRateModules(
  selection: NativeGuildRateModuleSelection = 'composed',
  route: NativeGuildRateRoute = 'reserve',
  amount = 3,
) {
  const original = createGuildAmbassadorIncomeArrival(NATIVE_GUILD_RATE_MODULE_SELECTIONS[selection]);
  const action: Action = route === 'transport' ? { ...original.action, amount } : {
    type: 'ship', territory: original.destination, sector: original.sector,
    amount, elite: 0, allyPayment: 0,
  };
  return { ...original, selection, route, amount, action,
    provenance: [...original.provenance,
      `Original setup selection: ${selection}; ${route} declaration is an actual owner action.`] };
}

/** Stop before paying or moving anything. Advanced reserve permission is a
 * separate real Guild choice, never a synthesized or cleared decision. */
export function declareNativeGuildRateModules(fixture: {
  beforeAction: Game; entrant: string; guild: string; action: Action;
}) {
  const before = pairedE3NexusReload(fixture.beforeAction), actions: PairedE3NexusStep[] = [];
  let game = stepPairedE3Nexus(before, { actor: fixture.entrant, action: fixture.action }, actions);
  if (game.decision?.kind === 'guildShipment')
    game = stepPairedE3Nexus(game, { actor: fixture.guild,
      action: { type: 'decision', allow: true } }, actions);
  assert.equal(game.response?.kind, 'guildRate');
  return { before, actions, game };
}

/** Pass only this rate window; the independent income response stays visible. */
export function allowNativeGuildRateModules(state: Game) {
  let game = pairedE3NexusReload(state);
  const actions: PairedE3NexusStep[] = [];
  for (let n = 0; game.response?.kind === 'guildRate' && n < 20; n++) {
    const next = nextPairedE3NexusStep(game); assert.ok(next);
    assert.equal(next.action.type, 'passResponse');
    game = stepPairedE3Nexus(game, next, actions);
  }
  assert.notEqual(game.response?.kind, 'guildRate');
  return { game, actions };
}
export function cancelNativeGuildRateModules(state: Game, actor: string, card: string) {
  assert.equal(state.response?.kind, 'guildRate');
  assert.ok(viewGame(state, actor).responseControls?.cancelCards.includes(card));
  const step: PairedE3NexusStep = { actor, action: { type: 'card', mode: 'cancel', card } };
  return { game: stepPairedE3Nexus(state, step), actions: [step] };
}

/** Drain the actual payment/arrival suffix, declining optional entry effects.
 * No second shipment, move, phase advancement or physical repair is issued. */
export function settleNativeGuildRateModules(state: Game) {
  let game = pairedE3NexusReload(state);
  const actions: PairedE3NexusStep[] = [];
  for (let n = 0; n < 100; n++) {
    if (pairedE3NexusClean(game) && !game.pendingShipment && !game.pendingGuildTransport)
      return { game, actions };
    const next = nextPairedE3NexusStep(game) ?? quietPairedE3NexusChoice(game);
    assert.ok(next, 'The original payment/arrival owner must have a real continuation.');
    game = stepPairedE3Nexus(game, next, actions);
  }
  throw Error('Original native Guild module arrival did not settle.');
}

/** A real one-force ordinary ground move after shipping proves that neither
 * rate choice consumes or replays the native movement allowance. */
export function moveAfterNativeGuildRateModules(fixture: {
  entrant: string; source: string; destination: string;
}, state: Game) {
  assert.ok(pairedE3NexusClean(state));
  const player = pairedE3NexusPlayer(state, fixture.entrant);
  assert.ok(player.forces[fixture.source] > 0);
  const destination = TERRITORIES.filter(t => t.type !== 'stronghold' &&
    t.id !== fixture.source.split(':')[0] && t.id !== fixture.destination &&
    state.players.every(p => presenceAt(p, t.id) === 0))
    .flatMap(t => t.sectors.map(sector => ({ territory: t.id, sector })))
    .find(to => to.sector !== state.storm &&
      distance(fixture.source, `${to.territory}:${to.sector}`,
        key => Number(key.split(':')[1]) === state.storm) <= 1);
  assert.ok(destination, 'The original Polar Sink source must have an empty adjacent terrain.');
  const step: PairedE3NexusStep = { actor: fixture.entrant,
    action: { type: 'move', from: fixture.source, amount: 1, elite: 0, ...destination } };
  const before = pairedE3NexusReload(state);
  const afterMove = stepPairedE3Nexus(before, step);
  const settled = settleNativeGuildRateModules(afterMove);
  return { before, step, game: settled.game, actions: [step, ...settled.actions],
    target: `${destination.territory}:${destination.sector}` };
}

/** Original Moritani actually accepts an originally offered Smuggler disc.
 * Empty ordinary terrain keeps the printed free counter independent of Guild's
 * cancelable rate. The entire group is physical; amount - 1 is priced. */
export function createNativeGuildRateSmugglerShipment(composed = false, amount = 3) {
  const original = createGuildAmbassadorIncomeArrival({
    ...(composed ? NATIVE_GUILD_RATE_MODULE_SELECTIONS.composed : {}),
    skills: true, training: { moritani: 'smuggler' },
  });
  const game = original.beforeAction;
  const destination = TERRITORIES.find(t => t.type === 'sand' &&
    t.sectors.some(sector => sector !== game.storm) &&
    game.players.every(p => presenceAt(p, t.id) === 0));
  assert.ok(destination, 'The original board must retain empty ordinary desert.');
  const sector = destination.sectors.find(s => s !== game.storm)!;
  assert.ok(quoteSmugglerShipment(game, original.entrant, destination.id, amount));
  const action: Action = { type: 'ship', territory: destination.id, sector,
    amount, elite: 0, allyPayment: 0, smuggler: true };
  return { ...original, destination: destination.id, sector,
    target: `${destination.id}:${sector}`, action, amount, route: 'reserve' as const,
    provenance: [...original.provenance,
      'Original undealt training order offers Smuggler; Moritani accepts through leaderSkill.',
      'Ordinary reserve shipment into actual empty desert; one printed free physical counter.'] };
}

export interface ControlledGuildRateNoFieldCompanion {
  beforeAction: Game; entrant: string; guild: string; canceler: string;
  karama: string; action: Action; destination: string; sector: number;
  target: string; value: 0 | 3 | 5; provenance: string[];
}

/** Explicitly CONTROLLED regression, NOT an original action-only producer.
 * Existing source performs genuine Richese/Skills training, then conserves and
 * stages turn/armies/wallets. Here mutual alliance is also staged and one
 * original deck Karama is conserved into Harkonnen custody. The original E3
 * producer cannot include Richese: its original roster/expansion is Ecaz-only.
 * No new training, card identity or force is invented. */
export function createControlledGuildRateNoFieldCompanion(
  value: 0 | 3 | 5 = 5,
): ControlledGuildRateNoFieldCompanion {
  const game = smugglerNoFieldGame(false);
  const entrant = 'r', guild = 'g', canceler = 'h';
  pairedE3NexusPlayer(game, entrant).ally = guild;
  pairedE3NexusPlayer(game, guild).ally = entrant;
  const index = game.deck.findIndex(card => card.effect === 'karama'); assert.ok(index >= 0);
  const card = game.deck.splice(index, 1)[0];
  pairedE3NexusPlayer(game, canceler).hand.push(card);
  const destination = 'wind_pass', sector = 14;
  const action: Action = { ...smugglerNoFieldAction(game, value), territory: destination, sector };
  return { beforeAction: pairedE3NexusReload(game), entrant, guild, canceler,
    karama: card.id, action, destination, sector, target: `${destination}:${sector}`, value,
    provenance: [
      'CONTROLLED existing smugglerNoFieldGame: genuine training, staged shipment turn/forces/wallets.',
      'CONTROLLED mutual Richese/Guild alliance; physical deck Karama transferred to Harkonnen.',
      'Actual No-Field declaration, response choices, native rate choice and reveal thereafter.',
    ] };
}

export function declareControlledGuildRateNoFieldCompanion(
  fixture: ControlledGuildRateNoFieldCompanion,
) {
  const actions: PairedE3NexusStep[] = [];
  let game = stepPairedE3Nexus(fixture.beforeAction,
    { actor: fixture.entrant, action: fixture.action }, actions);
  for (let n = 0; game.response?.kind === 'richeseNoField' && n < 20; n++) {
    const next = nextPairedE3NexusStep(game); assert.ok(next);
    assert.equal(next.action.type, 'passResponse');
    game = stepPairedE3Nexus(game, next, actions);
  }
  assert.equal(game.response?.kind, 'guildRate');
  return { game, actions };
}
