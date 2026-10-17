import assert from 'node:assert/strict';
import { viewGame, type Action, type Game } from '../game/engine';
import { nativeShipmentSources } from '../game/homeworld-options';
import { createSelectedIndependentEntry, type SelectedIndependentEntryOptions } from './fixture-selected-independent-nexus-entry';
import { applyClassicDiscoveryNexusStep, nextClassicDiscoveryNexusStep } from './fixture-discovery-classic-nexus';

export type E3IndependentArrivalStep = {actor:string; action:Action};
export function nextE3IndependentArrivalStep(game: Game): E3IndependentArrivalStep | null {
  if (game.pendingGuildBetrayal) {
    const frame = game.pendingGuildBetrayal;
    const actor = frame.required.find(id => !frame.passed.includes(id)); assert.ok(actor);
    return {actor, action:{type:'guildBetrayalPass', event:frame.invoice.event}};
  }
  if (!game.response && !game.phaseOpening && game.decision &&
    ['ecazPlacement','moritaniPlacement'].includes(game.decision.kind))
    return {actor:game.decision.player, action:{type:'decision', decline:true}};
  const step = nextClassicDiscoveryNexusStep(game);
  if (step?.action.type === 'stormDial') step.action.amount = game.turn === 1 ? 0 : 1;
  return step;
}
export function advanceE3IndependentArrival(game: Game, until: (game:Game) => boolean,
  actions: E3IndependentArrivalStep[] = []): Game {
  for (let count = 0; count < 900; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextE3IndependentArrivalStep(game); assert.ok(step, `Choose the original ${game.decision?.kind} window`);
    game = applyClassicDiscoveryNexusStep(game, step, actions);
  }
  throw Error('Original E3 entry did not reach its requested continuation');
}
const clean = (game:Game) => !game.phaseOpening && !game.response && !game.decision && !game.pendingGuildBetrayal;
/** Native tokens are placed through the original paid/response opportunities.
 * Only unopened land-card positions are chosen; no token, army or wallet is moved by a fixture. */
export function createE3IndependentArrival(options: Omit<SelectedIndependentEntryOptions, 'factions'>) {
  const source = createSelectedIndependentEntry({...options, factions:['ecaz','moritani','guild']});
  let game = source.game;
  const actions = [...source.actions];
  const act = (actor:string, action:Action) => { game = applyClassicDiscoveryNexusStep(game, {actor,action}, actions); };
  const reach = (until:(game:Game)=>boolean) => { game = advanceE3IndependentArrival(game, until, actions); };
  const land = () => {
    const chosen: Game['spiceDeck'] = [];
    for (let count = 0; count < (game.advanced ? 2 : 1); count++) {
      const index = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery);
      assert.ok(index >= 0); chosen.push(game.spiceDeck.splice(index,1)[0]);
    }
    game.spiceDeck.unshift(...chosen);
  };
  land();
  reach(state => !state.response && !state.phaseOpening && state.decision?.kind === 'ecazPlacement');
  const ambassador = game.ecazAmbassadors!.tokens.find(token => token.effect === 'ecaz' && token.zone === 'supply');
  assert.ok(ambassador);
  const beforePlacement = structuredClone(game);
  act('ecaz', {type:'decision', token:ambassador.id, territory:'arrakeen'});
  reach(state => state.ecazAmbassadors!.tokens.some(token => token.id === ambassador.id && token.location === 'arrakeen') &&
    !state.response && !state.phaseOpening);
  reach(state => state.phase === 8 && !state.response && !state.phaseOpening && state.decision?.kind === 'moritaniPlacement');
  const terror = game.moritaniTerror!.tokens.find(token => token.kind === 'robbery' && token.location === null);
  assert.ok(terror);
  act('moritani', {type:'decision', token:terror.id, territory:'arrakeen'});
  reach(state => state.turn === 2 && state.phase === 0);
  land();
  reach(state => state.phase === 5 && state.active === 'guild' && clean(state));
  const homeworldSources = game.homeworlds ? nativeShipmentSources(viewGame(game,'guild'),2,0) : undefined;
  assert.ok(!game.homeworlds || homeworldSources);
  const beforeShipment = structuredClone(game);
  act('guild', {type:'ship', territory:'arrakeen', sector:10, amount:2, elite:0,
    ...(homeworldSources ? {homeworldSources} : {})});
  reach(state => !!state.pendingArrivalOverlap && !state.response && !state.phaseOpening);
  return {source, beforePlacement, beforeShipment, game, actions, ambassador:ambassador.id, terror:terror.id};
}
