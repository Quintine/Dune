import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { createGuildAmbassadorIncomeArrival } from './fixture-guild-ambassador-income-arrival';
import { createNativeGuildHomeworldRate } from './fixture-native-guild-homeworld-rate';
import { advancePairedE3Nexus, pairedE3NexusClean, pairedE3NexusReload,
  pairedE3NexusPlayer, quietPairedE3NexusChoice, stepPairedE3Nexus,
  type PairedE3NexusStep } from './fixture-paired-e3-nexus-modules';
export type NativeGuildPermissionRoute = 'allyCross' | 'guildReturn' | 'homeworldReturn';

/** Original native setup/actions only. The typed return also retains its real
 * pledge; no wallet, force, phase, card, alliance or pending state is staged. */
export function createNativeGuildTransportPermission(route: NativeGuildPermissionRoute = 'allyCross',
  options: { amount?: number; homeworlds?: boolean } = {}) {
  if (route === 'homeworldReturn') {
    const f = createNativeGuildHomeworldRate('return');
    return { ...f, route, shipper: f.guild, cancelor: f.ecaz,
      provenance: [...f.provenance, 'Original typed return requests native transport permission before its separate rate.'] };
  }
  const f = createGuildAmbassadorIncomeArrival({ homeworlds: options.homeworlds ?? false });
  const actions = [...f.actions], amount = options.amount ?? 3;
  let beforeAction = pairedE3NexusReload(f.beforeAction), shipper = f.entrant, source = f.source;
  let action: Action = { ...f.action, amount };
  if (route === 'guildReturn') {
    beforeAction = advancePairedE3Nexus(beforeAction,
      g => g.phase === 5 && g.active === f.guild && pairedE3NexusClean(g), actions, quietPairedE3NexusChoice);
    shipper = f.guild;
    const selected = Object.keys(pairedE3NexusPlayer(beforeAction, shipper).forces)
      .find(key => pairedE3NexusPlayer(beforeAction, shipper).forces[key] >= amount && Number(key.split(':')[1]) !== beforeAction.storm);
    assert.ok(selected); source = selected;
    action = { type: 'guildShip', from: source, territory: 'reserves', amount, elite: 0, allyPayment: 0 };
  }
  return { ...f, actions, beforeAction, route, shipper, source, action, cancelor: f.ecaz,
    provenance: [...f.provenance, 'Original native cross/return permission is independent of its tariff.'] };
}
export function declareNativeGuildTransportPermission(f: {
  beforeAction: Game; shipper: string; guild: string; cancelor: string; karama: string; action: Action;
}) {
  const actions: PairedE3NexusStep[] = [];
  let game = stepPairedE3Nexus(f.beforeAction, { actor: f.shipper, action: f.action }, actions);
  if (game.decision?.kind === 'homeworldShipmentGuild')
    game = stepPairedE3Nexus(game, { actor: f.guild,
      action: { type: 'decision', event: game.decision.event, allow: true } }, actions);
  assert.equal(game.response?.kind, 'guildTransportPermission');
  assert.ok(viewGame(game, f.cancelor).responseControls?.cancelCards.includes(f.karama));
  return { game, actions };
}
export function createNativeGuildTransportPermissionScene(route: NativeGuildPermissionRoute = 'allyCross',
  options: { amount?: number; homeworlds?: boolean } = {}) {
  const fixture = createNativeGuildTransportPermission(route, options);
  const declaration = declareNativeGuildTransportPermission(fixture);
  return { ...fixture, game: declaration.game, declarationActions: declaration.actions,
    cancel: { actor: fixture.cancelor, action: { type: 'card', mode: 'cancel', card: fixture.karama } as Action } };
}
