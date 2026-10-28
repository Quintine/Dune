import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { NEXUS_FACTIONS, validateNexusCards } from '../game/nexus-cards';
import type { NoFieldValue } from '../game/richese-no-field';
import { actFamilyAtomicsNoField, familyAtomicsNoFieldPlayer, familyAtomicsNoFieldReload,
  familyAtomicsNoFieldInventory, familyAtomicsNoFieldClean, nextFamilyAtomicsNoFieldStep,
  type FamilyAtomicsNoFieldStep } from './fixture-family-atomics-no-field';

export type GuildNoFieldTransportStep = FamilyAtomicsNoFieldStep;
export const actGuildNoFieldTransport = actFamilyAtomicsNoField;
export const guildNoFieldTransportPlayer = familyAtomicsNoFieldPlayer;
export const guildNoFieldTransportReload = familyAtomicsNoFieldReload;
export const guildNoFieldTransportClean = (game: Game) => familyAtomicsNoFieldClean(game) &&
  !game.pendingGuildTransport && !game.pendingGuildBetrayal;
export function guildNoFieldTransportInventory(game: Game) {
  const original = familyAtomicsNoFieldInventory(game), cards = game.nexusCards?.cards;
  if (cards) {
    validateNexusCards(cards, game.players);
    assert.deepEqual([...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(card => card !== null)].sort(),
      [...NEXUS_FACTIONS].sort());
  }
  return original;
}
/** Quiet native decisions preserve the original shipment opportunity and held
 * Nexus. No optional future transport, redraw or allied token offer is chosen.
 */
export function nextGuildNoFieldTransport(game: Game): GuildNoFieldTransportStep | null {
  const betrayal = game.pendingGuildBetrayal;
  if (betrayal) {
    const actor = betrayal.required.find(actor => !betrayal.passed.includes(actor)); assert.ok(actor);
    return { actor, action: { type: 'guildBetrayalPass', event: betrayal.invoice.event } };
  }
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const decision = game.decision;
    if (decision?.kind === 'guildTiming') return { actor: decision.player, action: { type: 'decision', take: false } };
    if (decision?.kind === 'richeseAllyOpportunity') return { actor: decision.player, action: { type: 'decision', decline: true } };
    if (decision?.kind === 'nexusIxianReplacement')
      return { actor: decision.player, action: { type: 'nexusIxianReplacementPass', event: decision.event } };
    const phase = game.nexusCards?.phase, cards = game.nexusCards?.cards;
    if (phase?.stage === 'drawing' && cards) {
      const actor = phase.eligible.find(actor => !phase.done.includes(actor)); assert.ok(actor);
      return { actor, action: { type: 'nexusCardChoice', turn: phase.turn, card: cards.hands[actor], choice: 'keep', ownRedraws: 0 } };
    }
  }
  return nextFamilyAtomicsNoFieldStep(game);
}
export function advanceGuildNoFieldTransport(game: Game, until: (state: Game) => boolean,
  actions: GuildNoFieldTransportStep[] = []): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original transport chronology ended before its requested boundary');
    const next = nextGuildNoFieldTransport(game); assert.ok(next, 'Finish the actual native pending control');
    game = actGuildNoFieldTransport(game, next.actor, next.action, actions);
  }
  throw Error('The original Guild/No-Field chronology did not reach its finite boundary');
}
export function settleGuildNoFieldTransport(game: Game, actions: GuildNoFieldTransportStep[] = []): Game {
  return advanceGuildNoFieldTransport(game, guildNoFieldTransportClean, actions);
}
export function passGuildNoFieldPermission(game: Game, actions: GuildNoFieldTransportStep[] = []): Game {
  assert.equal(game.response?.kind, 'guildTransportPermission');
  while (game.response?.kind === 'guildTransportPermission') {
    const next = nextGuildNoFieldTransport(game); assert.ok(next); assert.equal(next.action.type, 'passResponse');
    game = actGuildNoFieldTransport(game, next.actor, next.action, actions);
  }
  return game;
}
type SpiceSelection = { position: number; from: number; card: Game['spiceDeck'][number] };
function selectSpice(game: Game, position: number, worm = false): SpiceSelection {
  const from = game.spiceDeck.findIndex((card, index) => index >= position && (worm
    ? 'worm' in card && !card.greatMaker && !card.suppressed
    : 'territory' in card && !card.discovery && card.sector !== game.storm &&
      !['imperial_basin', 'arrakeen', 'tueks_sietch'].includes(card.territory)));
  assert.ok(from >= position); const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
  return { position, from, card: structuredClone(card) };
}
export function guildNoFieldTransportAction(game: Game, route: 'cross' | 'return' = 'cross'): Action {
  const own = guildNoFieldTransportPlayer(game, 'richese'), marker = own.noField?.deployed; assert.ok(marker && own.noFieldEvent);
  const markerLocation = marker.location;
  assert.ok('territory' in markerLocation);
  const forces = Object.fromEntries(Object.entries(own.forces).filter(([key, amount]) =>
    amount > 0 && key.startsWith(`${markerLocation.territory}:`)));
  const nexus = viewGame(game, own.id).nexusGuildSecretAlly;
  return { type: 'guildShip', noField: marker.tokenId, event: own.noFieldEvent, forces,
    territory: route === 'return' ? 'reserves' : 'polar_sink', sector: 0, allyPayment: 0,
    ...(nexus && !nexus.blocked ? { nexus: nexus.event } : {}) };
}

/** Fresh public setup, original dealt Karama, real marker/army shipment and a
 * real next worm. Secret selects the original Guild face BEFORE its native
 * closing draw; no held hand is exchanged or direct draw helper invoked.
 */
export function createGuildNoFieldTransportFixture(options: {
  source?: 'native' | 'secret'; value?: NoFieldValue; companions?: boolean;
} = {}) {
  const source = options.source ?? 'native', value = options.value ?? 0, companions = options.companions ?? false;
  const owner = 'richese', guild = source === 'native' ? 'guild' : null, canceler = 'atreides';
  let game = createGame('GUILDNFTRANSPORT', newPlayer(owner, 'Richese', 'richese'), true, ['choam']);
  joinGame(game, newPlayer(canceler, 'Atreides', 'atreides'));
  joinGame(game, newPlayer(guild ?? 'emperor', guild ? 'Guild' : 'Emperor', guild ? 'guild' : 'emperor'));
  const initial = structuredClone(game), actions: GuildNoFieldTransportStep[] = [];
  const act = (actor: string, action: Action) => { game = actGuildNoFieldTransport(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceGuildNoFieldTransport(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), from = actions.length; run();
    return { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
  };
  if (source === 'secret') act(game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game); assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => !player.hand.length));
  const karama = game.deck.find(card => card.effect === 'karama');
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 2); assert.ok(karama); assert.equal(ordinary.length, 2);
  const deal = [ordinary[0], karama, ordinary[1]];
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), setupActions = structuredClone(actions);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal.map(card => card.id));
  const original = guildNoFieldTransportInventory(game), firstSpiceOrder = [selectSpice(game, 0), selectSpice(game, 1)];
  reach(state => state.turn === 1 && state.phase === 5 && state.active === owner && guildNoFieldTransportClean(state));
  let physicalShipment: ReturnType<typeof transition> | null = null;
  let markerShipment: ReturnType<typeof transition> | null = null;
  let token = '';
  const shipMarker = () => {
    const own = guildNoFieldTransportPlayer(game, owner), selected = own.noField!.tokens.find(token => token.value === value);
    assert.ok(selected && own.noFieldEvent); token = selected.id;
    markerShipment = transition(() => {
      act(owner, { type: 'ship', noField: token, event: own.noFieldEvent, territory: 'imperial_basin', sector: 9 });
      reach(guildNoFieldTransportClean);
    });
    assert.equal(guildNoFieldTransportPlayer(game, owner).reserves, guildNoFieldTransportPlayer(markerShipment.before, owner).reserves);
  };
  if (companions) {
    physicalShipment = transition(() => {
      act(owner, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 1, elite: 0, allyPayment: 0 });
      reach(guildNoFieldTransportClean);
    });
    assert.equal(guildNoFieldTransportPlayer(game, owner).forces['imperial_basin:9'], 1);
  } else shipMarker();
  reach(state => state.turn === 2 && state.phase === 0 && guildNoFieldTransportClean(state));
  const beforeWorm = structuredClone(game), nexusSpiceOrder = [selectSpice(game, 0, true), selectSpice(game, 1), selectSpice(game, 2)];
  let alliance: ReturnType<typeof transition> | null = null;
  let draw: ReturnType<typeof transition> | null = null;
  let nexusSelection: { from: number; card: 'guild' } | null = null;
  if (source === 'native') {
    reach(state => state.turn === 2 && state.phase === 1 && !!state.nexus && !state.spiceWindow &&
      !state.spiceResolution && guildNoFieldTransportClean(state));
    alliance = transition(() => {
      act(owner, { type: 'alliance', target: guild! }); act(guild!, { type: 'alliance', target: owner });
    });
  } else {
    reach(state => state.turn === 2 && state.phase === 1 && !!state.nexus && !state.spiceWindow &&
      !state.spiceResolution && guildNoFieldTransportClean(state));
    alliance = transition(() => {
      act(canceler, { type: 'alliance', target: 'emperor' }); act('emperor', { type: 'alliance', target: canceler });
    });
    assert.equal(guildNoFieldTransportPlayer(game, owner).ally, null);
    reach(state => state.turn === 2 && (state.phase > 1 || state.nexusCards?.phase?.stage === 'drawing'));
    assert.equal(game.phase, 1, 'The actual closing Nexus must offer unallied Richese its draw');
    const cards = game.nexusCards!.cards!, from = cards.deck.indexOf('guild'); assert.ok(from >= 0);
    cards.deck.unshift(cards.deck.splice(from, 1)[0]); nexusSelection = { from, card: 'guild' };
    draw = transition(() => act(owner, { type: 'nexusCardChoice', turn: game.turn,
      card: cards.hands[owner], choice: 'draw', ownRedraws: 0 }));
    assert.equal(game.nexusCards!.cards!.hands[owner], 'guild');
  }
  reach(state => state.turn === 2 && state.phase === 5 && state.active === owner && guildNoFieldTransportClean(state));
  const secondMovement = structuredClone(game);
  let thirdSpiceOrder: SpiceSelection[] = [];
  if (companions) {
    shipMarker();
    reach(state => state.turn === 3 && state.phase === 0 && guildNoFieldTransportClean(state));
    thirdSpiceOrder = [selectSpice(game, 0), selectSpice(game, 1)];
    reach(state => state.turn === 3 && state.phase === 5 && state.active === owner && guildNoFieldTransportClean(state));
  }
  assert.ok(markerShipment);
  const shipment = markerShipment as { before: Game; steps: GuildNoFieldTransportStep[]; after: Game };
  const own = guildNoFieldTransportPlayer(game, owner), event = own.noFieldEvent; assert.ok(event);
  assert.equal(own.noField!.deployed!.tokenId, token); assert.equal(own.shipped, false);
  assert.equal(own.noFieldEvent, guildNoFieldTransportPlayer(shipment.after, owner).noFieldEvent);
  assert.equal(own.forces['imperial_basin:9'] ?? 0, companions ? 1 : 0);
  assert.equal(own.tanks, 0); assert.equal(own.ally, guild);
  assert.equal(guildNoFieldTransportPlayer(game, canceler).hand.some(card => card.id === karama.id), true);
  if (source === 'secret') assert.equal(game.nexusCards!.cards!.hands[owner], 'guild');
  assert.deepEqual(guildNoFieldTransportInventory(game), original);
  return { game, sourceGame: structuredClone(game), initial, lobby, setup, afterSetup, source, value, companions,
    owner, actor: owner, guild, canceler, karama: karama.id, token, event, marker: structuredClone(own.noField),
    action: guildNoFieldTransportAction(game), returnAction: guildNoFieldTransportAction(game, 'return'),
    markerShipment: shipment, physicalShipment, beforeWorm, alliance, draw, nexusSelection, secondMovement,
    original, dealOrder, firstSpiceOrder, nexusSpiceOrder, thirdSpiceOrder, setupActions, actions,
    sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { setup: setupActions.length, markerShipment: shipment.steps.length,
      physicalShipment: physicalShipment?.steps.length ?? 0, alliance: alliance?.steps.length ?? 0,
      draw: draw?.steps.length ?? 0, source: actions.length },
    sourceDisclosure: `Actual public Advanced preview Richese/Atreides/${guild ? 'Guild' : 'Emperor'} +CHOAM-deck setup; ` +
      (source === 'secret' ? 'Nexus Cards is actually opted in before readiness/start. At the actual turn2 worm Nexus, Atreides and Emperor mutually ally while Richese remains unallied; this real settled alliance enables its native closing draw. The original Guild card is selected in the unopened Nexus deck before that actual draw; no held-card exchange or direct draw helper is used. '
        : 'The actual turn2 worm opens a Nexus and Richese/Guild both consent to their ordinary alliance; native Guild timing always WAITs. ') +
      'Only original unopened starting-card/Spice/Nexus positions and scalar lotteries are chosen. Atreides receives original Karama; all counters, cards, income and windows remain native. ' +
      (companions ? 'Actual ordinary1 shipment on turn1 precedes actual marker shipment on turn2 into the same Basin9; the original marker and physical companion remain until the unused turn3 shipment. '
        : 'Actual paid original marker shipment to empty Basin9 on turn1 remains until the unused turn2 shipment. ') +
      'Counts derive from recorded arrays. No hand, purse, army, phase, alliance, marker, source, receipt or transport is installed.' };
}
export type GuildNoFieldTransportFixture = ReturnType<typeof createGuildNoFieldTransportFixture>;
