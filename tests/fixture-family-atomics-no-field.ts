import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { treacheryDeck } from '../game/cards';
import { richeseCards } from '../game/richese-cards';
import { traitorDeck } from '../game/traitors';
import type { NoFieldValue } from '../game/richese-no-field';
import { actFamilyAtomics, familyAtomicsPlayer, familyAtomicsReload } from './fixture-family-atomics';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';
import type { StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type FamilyAtomicsNoFieldStep = StrongholdFactionsNativeStep;
export const actFamilyAtomicsNoField = actFamilyAtomics;
export const familyAtomicsNoFieldPlayer = familyAtomicsPlayer;
export const familyAtomicsNoFieldReload = familyAtomicsReload;
export const familyAtomicsNoFieldClean = (game: Game) => !game.phaseOpening && !game.response &&
  !game.decision && !game.truthtrance && !game.pendingTreacheryDiscard && !game.pendingShipment;
export const nextFamilyAtomicsNoFieldStep = nextRicheseStrongholdsNativeStep;
export function advanceFamilyAtomicsNoField(game: Game, until: (state: Game) => boolean,
  actions: FamilyAtomicsNoFieldStep[] = []): Game {
  for (let count = 0; count < 1500; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original marker chronology ended before its requested boundary');
    const step = nextFamilyAtomicsNoFieldStep(game); assert.ok(step, 'Complete the actual native pending control');
    game = actFamilyAtomicsNoField(game, step.actor, step.action, actions);
  }
  throw Error('The original Atomics/No-Field source did not reach its finite boundary');
}
export function finishFamilyAtomicsNoFieldStorm(game: Game, actions: FamilyAtomicsNoFieldStep[] = []): Game {
  return advanceFamilyAtomicsNoField(game, state => state.phase !== 0 && familyAtomicsNoFieldClean(state), actions);
}
export function familyAtomicsNoFieldInventory(game: Game) {
  const cards = [...game.deck, ...game.discard, ...(game.removedTreachery ?? []), ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...game.players.flatMap(player => player.hand),
    ...(game.auction?.cards.slice(game.auction.index + Number(game.currentAuctionSale?.origin === 'normal')) ?? [])]
    .map(card => card.id).sort();
  assert.deepEqual(cards, [...treacheryDeck(game.expansions), ...richeseCards()].map(card => card.id).sort());
  const traitors = [...(game.traitorReserve ?? []), ...game.players.flatMap(player =>
    [...player.traitors, ...player.traitorChoices])].sort();
  assert.deepEqual(traitors, traitorDeck(game.players, false).sort());
  const spice = [...game.spiceDeck, ...game.spiceDiscard.flat()].map(card => JSON.stringify(card)).sort();
  for (const player of game.players)
    assert.equal(player.reserves + player.tanks + Object.values(player.forces).reduce((sum, amount) => sum + amount, 0), 20);
  return { cards, traitors, spice };
}

/** Fresh public Richese/classics with no optional modules. A real single-token
 * shipment supplies the only Richese Arrakis presence. The hidden denomination
 * is selected through the owned native packet, never installed into a marker.
 */
export function createFamilyAtomicsNoFieldFixture(options: {
  advanced?: boolean; value?: NoFieldValue; geometry?: 'wall' | 'adjacent' | 'blocked'; foreignOwner?: boolean;
} = {}) {
  const advanced = options.advanced ?? true, value = options.value ?? 0;
  const geometry = options.geometry ?? 'wall', foreignOwner = options.foreignOwner ?? false;
  assert.ok(!foreignOwner || geometry === 'wall', 'The bounded foreign-cost source destroys a Wall marker');
  const richese = 'richese', owner = foreignOwner ? 'emperor' : richese;
  let game = createGame('ATOMICSNOFIELD', newPlayer(richese, 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('atreides', 'Atreides', 'atreides'));
  joinGame(game, newPlayer('emperor', 'Emperor', 'emperor'));
  const initial = structuredClone(game), actions: FamilyAtomicsNoFieldStep[] = [];
  const act = (actor: string, action: Action) => { game = actFamilyAtomicsNoField(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceFamilyAtomicsNoField(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  act(game.host, advanced ? { type: 'start', advancedPreview: true } : { type: 'start' });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.ok(game.players.every(player => !player.hand.length));
  const atomics = game.deck.find(card => card.effect === 'atomics');
  const weather = game.deck.find(card => card.effect === 'weather');
  const ordinary = game.deck.find(card => card.kind === 'projectile'); assert.ok(atomics && weather && ordinary);
  const deal = foreignOwner ? [weather, ordinary, atomics] : [atomics, ordinary, weather];
  const dealOrder = deal.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), setupActions = structuredClone(actions);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), deal.map(card => card.id));
  assert.deepEqual(familyAtomicsNoFieldPlayer(game, richese).forces, {});
  const original = familyAtomicsNoFieldInventory(game);
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const [card] = game.spiceDeck.splice(from, 1); game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  const firstDialsFrom = actions.length;
  for (const [index, actor] of game.stormDialers.entries())
    act(actor, { type: 'stormDial', amount: geometry === 'blocked' && index === 0 ? 9 : 0 });
  const firstDials = structuredClone(actions.slice(firstDialsFrom));
  reach(state => state.turn === 1 && state.phase === 5 && familyAtomicsNoFieldClean(state));
  const destination = geometry === 'wall' ? { territory: 'shield_wall', sector: 9 }
    : { territory: 'imperial_basin', sector: 11 };
  let shipment: { before: Game; steps: FamilyAtomicsNoFieldStep[]; after: Game } | null = null;
  let physicalShipment: { before: Game; steps: FamilyAtomicsNoFieldStep[]; after: Game } | null = null;
  let token = '', shipmentEvent = '';
  for (let count = 0; game.phase === 5 && count < 80; count++) {
    if (familyAtomicsNoFieldClean(game) && game.active === richese && !familyAtomicsNoFieldPlayer(game, richese).shipped) {
      const own = familyAtomicsNoFieldPlayer(game, richese), selected = own.noField!.tokens.find(token => token.value === value);
      assert.ok(selected && own.noFieldEvent); token = selected.id; shipmentEvent = own.noFieldEvent;
      const before = structuredClone(game), from = actions.length;
      act(richese, { type: 'ship', noField: token, event: shipmentEvent, ...destination }); reach(familyAtomicsNoFieldClean);
      shipment = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
      assert.equal(familyAtomicsNoFieldPlayer(before, richese).spice - familyAtomicsNoFieldPlayer(game, richese).spice, 2);
      assert.equal(familyAtomicsNoFieldPlayer(before, richese).reserves, familyAtomicsNoFieldPlayer(game, richese).reserves);
      continue;
    }
    if (foreignOwner && familyAtomicsNoFieldClean(game) && game.active === owner && !familyAtomicsNoFieldPlayer(game, owner).shipped) {
      const before = structuredClone(game), from = actions.length;
      act(owner, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 1, elite: 0, allyPayment: 0 });
      reach(familyAtomicsNoFieldClean);
      physicalShipment = { before, steps: structuredClone(actions.slice(from)), after: structuredClone(game) };
      assert.equal(familyAtomicsNoFieldPlayer(before, owner).spice - familyAtomicsNoFieldPlayer(game, owner).spice, 2);
      continue;
    }
    const step = nextFamilyAtomicsNoFieldStep(game); assert.ok(step); act(step.actor, step.action);
  }
  assert.ok(shipment); assert.ok(!foreignOwner || physicalShipment);
  reach(state => state.turn === 2 && state.phase === 0 && familyAtomicsNoFieldClean(state));
  assert.equal(game.storm, geometry === 'blocked' ? 10 : 1);
  assert.equal(game.stormPending, advanced ? 1 : null);
  const own = familyAtomicsNoFieldPlayer(game, richese);
  assert.deepEqual(own.forces, {}); assert.equal(own.tanks, 0);
  assert.equal(own.noField!.deployed!.tokenId, token);
  assert.deepEqual(own.noField!.deployed!.location, destination);
  const deployedEvent = familyAtomicsNoFieldPlayer(shipment.after, richese).noFieldEvent;
  assert.notEqual(deployedEvent, shipmentEvent, 'The accepted native shipment rotates its consumed offer event');
  assert.equal(own.noFieldEvent, deployedEvent, 'Native intervening phases retain the accepted concealed deployment event');
  assert.ok(familyAtomicsNoFieldPlayer(game, owner).hand.some(card => card.id === atomics.id));
  assert.deepEqual(familyAtomicsNoFieldInventory(game), original);
  return { game, sourceGame: structuredClone(game), initial, lobby, setup, afterSetup, advanced, value, geometry,
    foreignOwner, owner, richese, card: atomics.id, weather: weather.id, token, event: own.noFieldEvent,
    destination, marker: structuredClone(own.noField), action: { type: 'card', card: atomics.id } satisfies Action,
    shipment, physicalShipment, original, dealOrder, spiceOrder, firstDials, setupActions, actions,
    sourceActions: actions, sourceActionCount: actions.length,
    sourceCounts: { setup: setupActions.length, firstDials: firstDials.length, shipment: shipment.steps.length,
      physicalShipment: physicalShipment?.steps.length ?? 0, source: actions.length },
    sourceDisclosure: `Actual public ${advanced ? 'Advanced preview' : 'Basic'} Richese/Atreides/Emperor +CHOAM-deck setup, original private Traitors and original three No-Field tokens. ` +
      'No Skills, Homeworlds, Nexus Cards or other optional modules. Only original unopened starting-card/land-Spice positions and scalar lotteries selected. ' +
      `Richese actually ships its owned ${value} marker for two spice to ${destination.territory}:${destination.sector}; all physical reserves stay in supply while concealed. ` +
      (foreignOwner ? 'Emperor separately ships an actual one-counter adjacent Basin9 qualifier for two spice and holds the originally dealt Atomics. ' : 'Richese itself holds the originally dealt Atomics; the marker is its only Arrakis presence. ') +
      `Native first dials ${geometry === 'blocked' ? '9+0 earn Storm10' : '0+0 retain Storm1'}, then actual auctions/turns/phases reach original Storm2. ` +
      (advanced ? 'Its calculated card1 is automatically revealed by the actual turn opening. ' : 'The original Basic second dial window remains uncalculated. ') +
      'Every count derives from recorded actions. No held hand, purse, physical force, phase, queue, token deployment, marker event, wall state or casualty is installed.' };
}
export type FamilyAtomicsNoFieldFixture = ReturnType<typeof createFamilyAtomicsNoFieldFixture>;
