import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import type { NoFieldValue } from '../game/richese-no-field';
import { actFamilyAtomicsNoField, familyAtomicsNoFieldPlayer, familyAtomicsNoFieldReload,
  familyAtomicsNoFieldInventory, familyAtomicsNoFieldClean, nextFamilyAtomicsNoFieldStep,
  type FamilyAtomicsNoFieldStep } from './fixture-family-atomics-no-field';

export type NoFieldAlliedSeparationStep = FamilyAtomicsNoFieldStep;
export const actNoFieldAlliedSeparation = actFamilyAtomicsNoField;
export const noFieldAlliedSeparationPlayer = familyAtomicsNoFieldPlayer;
export const noFieldAlliedSeparationReload = familyAtomicsNoFieldReload;
export const noFieldAlliedSeparationInventory = familyAtomicsNoFieldInventory;
export const noFieldAlliedSeparationClean = familyAtomicsNoFieldClean;
/** Consume the native optional ally-shipment offer by passing. The source
 * never starts a new token shipment after the measured separation ending. */
export function nextNoFieldAlliedSeparation(game: Game): NoFieldAlliedSeparationStep | null {
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'richeseAllyOpportunity')
    return { actor: game.decision.player, action: { type: 'decision', decline: true } };
  return nextFamilyAtomicsNoFieldStep(game);
}
export function advanceNoFieldAlliedSeparation(game: Game, until: (state: Game) => boolean,
  actions: NoFieldAlliedSeparationStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original allied-marker chronology ended before its requested boundary');
    const next = nextNoFieldAlliedSeparation(game); assert.ok(next, 'Complete the actual native pending control');
    game = actNoFieldAlliedSeparation(game, next.actor, next.action, actions);
  }
  throw Error('The original allied-marker chronology did not reach its finite boundary');
}
export function finishNoFieldAlliedSeparationMovement(game: Game, actions: NoFieldAlliedSeparationStep[] = []): Game {
  return advanceNoFieldAlliedSeparation(game, state => state.phase !== 5 && noFieldAlliedSeparationClean(state), actions);
}

type SpiceSelection = { position: number; from: number; card: Game['spiceDeck'][number] };
function selectOriginalSpice(game: Game, position: number, worm: boolean): SpiceSelection {
  const from = game.spiceDeck.findIndex((card, index) => index >= position && (worm
    ? 'worm' in card && !card.greatMaker && !card.suppressed
    : 'territory' in card && !card.discovery && card.territory !== 'imperial_basin' && card.sector !== game.storm &&
      game.players.every(player => !Object.entries(player.forces).some(([key, count]) => count > 0 && key.startsWith(`${card.territory}:`)))));
  assert.ok(from >= position, 'Select an actual remaining original safe Spice face');
  const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
  return { position, from, card: structuredClone(card) };
}

/** Real unallied Basin9 marker and Basin11 two-counter army are separated by
 * actual Storm10 in turn1. A real next-turn worm supplies the Nexus where both
 * owners consent. Advanced Richese is first; Basic Emperor is first and Richese
 * is later, retaining both the formation grace and actual later-player rule.
 */
export function createNoFieldAlliedSeparationFixture(options: { advanced?: boolean; value?: NoFieldValue } = {}) {
  const advanced = options.advanced ?? true, value = options.value ?? 0;
  const actor = 'richese', ally = 'emperor', other = 'atreides';
  let game = createGame('NOFIELDALLIEDSEPARATION', newPlayer(actor, 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer(ally, 'Emperor', 'emperor')); joinGame(game, newPlayer(other, 'Atreides', 'atreides'));
  const initial = structuredClone(game), actions: NoFieldAlliedSeparationStep[] = [];
  const act = (id: string, action: Action) => { game = actNoFieldAlliedSeparation(game, id, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceNoFieldAlliedSeparation(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  const circlesFrom = actions.length;
  if (!advanced) {
    for (const [index, player] of game.players.entries()) act(player.id, { type: 'seatPosition', position: index + 4 });
    act(ally, { type: 'seatPosition', position: 1 }); act(actor, { type: 'seatPosition', position: 2 });
    act(other, { type: 'seatPosition', position: 3 });
  }
  const circles = structuredClone(actions.slice(circlesFrom));
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => !player.hand.length));
  const ordinary = ['projectile', 'shield', 'snooper'].map(kind => game.deck.find(card => card.kind === kind));
  assert.ok(ordinary.every(card => card));
  const dealOrder = ordinary.map((card, position) => {
    assert.ok(card); const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), setupActions = structuredClone(actions);
  assert.deepEqual(noFieldAlliedSeparationPlayer(game, actor).forces, {});
  const original = noFieldAlliedSeparationInventory(game);
  const firstSpiceOrder = [selectOriginalSpice(game, 0, false),
    ...(advanced ? [selectOriginalSpice(game, 1, false)] : [])];
  const firstDials = transition(() => {
    for (const [index, dialer] of game.stormDialers.entries()) act(dialer, { type: 'stormDial', amount: index === 0 ? 4 : 5 });
  });
  reach(state => state.turn === 1 && state.phase === 5 && noFieldAlliedSeparationClean(state));
  assert.equal(game.storm, 10);
  let markerShipment: ReturnType<typeof transition> | null = null;
  let allyShipment: ReturnType<typeof transition> | null = null;
  let token = '';
  for (let count = 0; game.phase === 5 && count < 100; count++) {
    if (noFieldAlliedSeparationClean(game) && game.active === actor && !noFieldAlliedSeparationPlayer(game, actor).shipped) {
      const own = noFieldAlliedSeparationPlayer(game, actor), selected = own.noField!.tokens.find(token => token.value === value);
      assert.ok(selected && own.noFieldEvent); token = selected.id;
      markerShipment = transition(() => {
        act(actor, { type: 'ship', noField: token, event: own.noFieldEvent, territory: 'imperial_basin', sector: 9 });
        reach(noFieldAlliedSeparationClean);
      });
      assert.equal(noFieldAlliedSeparationPlayer(markerShipment.before, actor).spice - noFieldAlliedSeparationPlayer(game, actor).spice, 2);
      assert.equal(noFieldAlliedSeparationPlayer(game, actor).reserves, noFieldAlliedSeparationPlayer(markerShipment.before, actor).reserves);
      continue;
    }
    if (noFieldAlliedSeparationClean(game) && game.active === ally && !noFieldAlliedSeparationPlayer(game, ally).shipped) {
      allyShipment = transition(() => {
        act(ally, { type: 'ship', territory: 'imperial_basin', sector: 11, amount: 2, elite: 0, allyPayment: 0 });
        reach(noFieldAlliedSeparationClean);
      });
      assert.equal(noFieldAlliedSeparationPlayer(allyShipment.before, ally).spice - noFieldAlliedSeparationPlayer(game, ally).spice, 4);
      continue;
    }
    const next = nextNoFieldAlliedSeparation(game); assert.ok(next); act(next.actor, next.action);
  }
  assert.ok(markerShipment && allyShipment);
  const deployedEvent = noFieldAlliedSeparationPlayer(markerShipment.after, actor).noFieldEvent; assert.ok(deployedEvent);
  assert.notEqual(deployedEvent, noFieldAlliedSeparationPlayer(markerShipment.before, actor).noFieldEvent);
  reach(state => state.turn === 2 && state.phase === 0 && noFieldAlliedSeparationClean(state));
  const beforeNexusStorm = structuredClone(game);
  const nexusSpiceOrder = [selectOriginalSpice(game, 0, true), selectOriginalSpice(game, 1, false),
    ...(advanced ? [selectOriginalSpice(game, 2, false)] : [])];
  reach(state => state.turn === 2 && state.phase === 1 && !!state.nexus && !state.spiceWindow &&
    !state.spiceResolution && noFieldAlliedSeparationClean(state));
  const alliance = transition(() => {
    act(actor, { type: 'alliance', target: ally }); act(ally, { type: 'alliance', target: actor });
  });
  assert.equal(noFieldAlliedSeparationPlayer(game, actor).ally, ally);
  assert.equal(noFieldAlliedSeparationPlayer(game, ally).ally, actor);
  assert.equal(noFieldAlliedSeparationPlayer(game, actor).allySinceTurn, 2);
  reach(state => state.turn === 2 && state.phase === 5 && noFieldAlliedSeparationClean(state));
  const formationMovement = structuredClone(game), formationMovementActions = structuredClone(actions);
  let formationEnds: ReturnType<typeof transition> | null = null;
  let thirdSpiceOrder: SpiceSelection[] = [];
  if (!advanced) {
    formationEnds = transition(() => { reach(state => state.phase !== 5 && noFieldAlliedSeparationClean(state)); });
    assert.ok(noFieldAlliedSeparationPlayer(game, actor).noField!.deployed);
    assert.equal(noFieldAlliedSeparationPlayer(game, ally).forces['imperial_basin:11'], 2);
    reach(state => state.turn === 3 && state.phase === 0 && noFieldAlliedSeparationClean(state));
    thirdSpiceOrder = [selectOriginalSpice(game, 0, false)];
    reach(state => state.turn === 3 && state.phase === 5 && noFieldAlliedSeparationClean(state));
  }
  const beforeEarlierEnd = structuredClone(game), earlierFrom = actions.length;
  reach(state => state.phase === 5 && state.active === actor && noFieldAlliedSeparationClean(state));
  const earlierEnds = structuredClone(actions.slice(earlierFrom));
  const own = noFieldAlliedSeparationPlayer(game, actor);
  assert.equal(game.turn, advanced ? 2 : 3); assert.equal(game.active, actor);
  assert.deepEqual(own.forces, {}); assert.equal(own.tanks, 0);
  assert.equal(own.noFieldEvent, deployedEvent); assert.equal(own.noField!.deployed!.tokenId, token);
  assert.deepEqual(own.noField!.deployed!.location, { territory: 'imperial_basin', sector: 9 });
  assert.equal(noFieldAlliedSeparationPlayer(game, ally).forces['imperial_basin:11'], 2);
  assert.ok(advanced || !(game.movementRemaining ?? []).includes(ally));
  assert.deepEqual(noFieldAlliedSeparationInventory(game), original);
  return { game, sourceGame: structuredClone(game), initial, lobby, setup, afterSetup, advanced, value,
    actor, owner: actor, ally, other, token, event: deployedEvent, marker: structuredClone(own.noField),
    action: { type: 'endMovement' } satisfies Action,
    markerShipment, allyShipment, alliance, beforeNexusStorm, formationMovement, formationMovementActions,
    formationEnds, beforeEarlierEnd, earlierEnds, original, circles, dealOrder, firstSpiceOrder, nexusSpiceOrder,
    thirdSpiceOrder, firstDials, setupActions, actions, sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { setup: setupActions.length, circles: circles.length, firstDials: firstDials.steps.length,
      markerShipment: markerShipment.steps.length, allyShipment: allyShipment.steps.length, alliance: alliance.steps.length,
      formationMovement: formationMovementActions.length, formationEnds: formationEnds?.steps.length ?? 0,
      earlierEnds: earlierEnds.length, source: actions.length },
    sourceDisclosure: `Actual public ${advanced ? 'Advanced preview' : 'Basic'} Richese/Emperor/Atreides +CHOAM-deck setup, original Treachery/Traitors and three real tokens, no optional modules. ` +
      'Only actual lobby circle actions, original unopened deal/Spice faces and scalar lotteries selected. Real first dials4+5 earn Storm10. Richese pays2 to deploy the original concealed marker in Basin9; Emperor separately pays4 for two original normal reserves in Basin11, separated by that real storm before alliance. ' +
      'The next actual original worm opens a real Nexus; both owners actually consent. Marker9 stays outside the next Advanced card1 path through11. ' +
      (advanced ? 'Richese is the actual first turn2 ending player, with its new ally still pending. '
        : 'Actual lobby circles put Emperor first and Richese later. Both native turn2 ends retain the new-alliance grace; actual next Storm/Spice/phase controls reach turn3, then Emperor really ends first before the Richese deadline. ') +
      'The destructive reveal at a due end is the explicitly provisional recommended composition, not a special publisher FAQ. Counts derive from recorded arrays; no hand, purse, force, phase, alliance, marker, event or receipt is installed.' };
}
export type NoFieldAlliedSeparationFixture = ReturnType<typeof createNoFieldAlliedSeparationFixture>;
