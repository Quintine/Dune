import assert from 'node:assert/strict';
import { createGame, joinGame, newPlayer, viewGame, type Action, type Game } from '../game/engine';
import { splitLocation } from '../game/board';
import {
  nexusGuildSecretAllyAction, nexusGuildSecretAllyCanAct, nexusGuildSecretAllyQuote,
} from '../game/nexus-guild-secret-ally-options';
import { NEXUS_FACTIONS } from '../game/nexus-cards';
import {
  actAdvisorTransportMatching, advanceAdvisorTransportMatching, nextAdvisorTransportMatching,
  passAdvisorTransportMatching, finishAdvisorTransportMatching,
  advisorTransportMatchingPlayer, advisorTransportMatchingInventory, advisorTransportMatchingClean,
  type AdvisorTransportMatchingDirection, type AdvisorTransportMatchingStep,
} from './fixture-advisor-transport-matching';

export type AdvisorSecretTransportMatchingStep = AdvisorTransportMatchingStep;
export type AdvisorSecretTransportMatchingTransition = { before: Game; steps: AdvisorSecretTransportMatchingStep[]; after: Game };
export const actAdvisorSecretTransportMatching = actAdvisorTransportMatching;
export const nextAdvisorSecretTransportMatching = nextAdvisorTransportMatching;
export const advanceAdvisorSecretTransportMatching = advanceAdvisorTransportMatching;
export const passAdvisorSecretTransportMatching = passAdvisorTransportMatching;
export const finishAdvisorSecretTransportMatching = finishAdvisorTransportMatching;
export const advisorSecretTransportMatchingPlayer = advisorTransportMatchingPlayer;
export const advisorSecretTransportMatchingInventory = advisorTransportMatchingInventory;
export const advisorSecretTransportMatchingClean = advisorTransportMatchingClean;
export const advisorSecretTransportNexusInventory = (game: Game) => {
  const cards = game.nexusCards!.cards!;
  const identities = [...cards.deck, ...cards.discard, ...Object.values(cards.hands).filter(card => card !== null)].sort();
  assert.equal(new Set(identities).size, identities.length, 'Every original physical Nexus singleton retains one current slot');
  return identities;
};

/** Public Advanced BG/Atreides/Emperor with actual original Nexus setup. BG
 * stays unallied; a real A/Emperor alliance permits BG's native closing draw.
 * Only the still-unopened Guild singleton is selected before that real draw. */
export function createAdvisorSecretTransportMatchingFixture(options: { direction?: AdvisorTransportMatchingDirection } = {}) {
  const direction = options.direction ?? 'fightersToAdvisors';
  const bg = 'beneGesserit', holder = 'atreides', emperor = 'emperor';
  let game = createGame('ADVISORSECRETTRANSPORTMATCHING', newPlayer(bg, 'Bene Gesserit', 'beneGesserit'), true);
  joinGame(game, newPlayer(holder, 'Atreides', 'atreides')); joinGame(game, newPlayer(emperor, 'Emperor', 'emperor'));
  const initial = structuredClone(game), steps: AdvisorSecretTransportMatchingStep[] = [];
  const act = (actor: string, action: Action) => { game = actAdvisorSecretTransportMatching(game, actor, action, steps); };
  const reach = (until: (state: Game) => boolean) => { game = advanceAdvisorSecretTransportMatching(game, until, steps); };
  const transition = (run: () => void): AdvisorSecretTransportMatchingTransition => {
    const before = structuredClone(game), start = steps.length; run();
    return { before, steps: structuredClone(steps.slice(start)), after: structuredClone(game) };
  };
  const enableNexus = transition(() => { act(game.host, { type: 'moduleOption', module: 'nexusCards', enabled: true }); });
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game); act(game.host, { type: 'start', advancedPreview: true });
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.deepEqual(game.expansions, []);
  assert.ok(game.nexusCards?.cards);
  assert.ok(!game.homeworlds && !game.leaderSkills && !game.techTokens && !game.strongholdCards &&
    !game.discoveryEnabled && !game.ecazTreachery);
  assert.ok(game.players.every(player => !player.hand.length));
  const originalInventory = advisorSecretTransportMatchingInventory(game); assert.equal(originalInventory.length, 33);
  const originalNexusInventory = advisorSecretTransportNexusInventory(game);
  assert.deepEqual(originalNexusInventory, [...NEXUS_FACTIONS].sort());
  const karama = game.deck.find(card => card.effect === 'karama'); assert.ok(karama);
  const ordinary = game.deck.filter(card => ['projectile', 'poison', 'shield', 'snooper'].includes(card.kind)).slice(0, 2);
  assert.equal(ordinary.length, 2);
  const selected = [ordinary[0], karama, ordinary[1]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  let advisorSetup: AdvisorSecretTransportMatchingTransition | null = null;
  for (let count = 0; game.status === 'setup' && count < 100; count++) {
    const next = nextAdvisorSecretTransportMatching(game); assert.ok(next);
    const before = next.action.type === 'advisorSetup' ? structuredClone(game) : null;
    act(next.actor, next.action);
    if (before) advisorSetup = { before, steps: [structuredClone(next)], after: structuredClone(game) };
  }
  assert.equal(game.status, 'playing'); assert.ok(advisorSetup);
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(advisorSecretTransportMatchingPlayer(game, bg).forces['arrakeen:10'], 1);
  assert.ok(advisorSecretTransportMatchingPlayer(game, bg).advisors?.arrakeen);
  assert.equal(advisorSecretTransportMatchingPlayer(game, holder).forces['arrakeen:10'], 10);
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['imperial_basin', 'arrakeen'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  reach(state => state.turn === 1 && state.phase === 5 && state.active === bg && advisorSecretTransportMatchingClean(state));
  const fighterShipment = transition(() => {
    act(bg, { type: 'ship', territory: 'imperial_basin', sector: 9, amount: 2, elite: 0, allyPayment: 0 });
    reach(advisorSecretTransportMatchingClean);
  });
  assert.equal(advisorSecretTransportMatchingPlayer(fighterShipment.before, bg).spice - advisorSecretTransportMatchingPlayer(game, bg).spice, 4);
  reach(state => state.turn === 2 && state.phase === 1 && advisorSecretTransportMatchingClean(state) &&
    !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0);
  const beforeWorm = structuredClone(game), beforeWormInventory = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const from = game.spiceDeck.findIndex(card => 'worm' in card && !card.greatMaker && !card.suppressed && !card.thumper);
  assert.ok(from >= 0); const worm = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.unshift(worm);
  const wormOrder = { position: 0, from, card: structuredClone(worm) };
  const wormFollowupOrder = [1, 2].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery &&
      !['imperial_basin', 'arrakeen'].includes(card.territory));
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), beforeWormInventory);
  reach(state => state.nexus && !state.spiceWindow && !state.spiceResolution && advisorSecretTransportMatchingClean(state));
  const nexus = structuredClone(game);
  const alliance = transition(() => {
    act(holder, { type: 'alliance', target: emperor }); act(emperor, { type: 'alliance', target: holder });
  });
  assert.equal(advisorSecretTransportMatchingPlayer(game, holder).ally, emperor);
  assert.equal(advisorSecretTransportMatchingPlayer(game, emperor).ally, holder);
  assert.equal(advisorSecretTransportMatchingPlayer(game, bg).ally, null);
  reach(state => state.nexusCards?.phase?.stage === 'drawing' && advisorSecretTransportMatchingClean(state));
  const beforeNexusOrder = structuredClone(game), cards = game.nexusCards!.cards!;
  assert.equal(cards.hands[bg], null);
  const guildIndex = cards.deck.indexOf('guild'); assert.ok(guildIndex >= 0);
  cards.deck.unshift(cards.deck.splice(guildIndex, 1)[0]);
  const nexusOrder = { card: 'guild', from: guildIndex, position: 0 };
  assert.deepEqual(advisorSecretTransportNexusInventory(game), originalNexusInventory);
  const beforeNexusDraw = structuredClone(game);
  const drawStep: AdvisorSecretTransportMatchingStep = { actor: bg, action: {
    type: 'nexusCardChoice', turn: game.turn, card: cards.hands[bg], choice: 'draw', ownRedraws: 0,
  } };
  const nexusDraw = transition(() => { act(drawStep.actor, drawStep.action); });
  assert.equal(game.nexusCards!.cards!.hands[bg], 'guild');
  reach(state => state.turn === 2 && state.phase === 5 && state.active === bg && advisorSecretTransportMatchingClean(state));
  const view = viewGame(game, bg), offer = view.nexusGuildSecretAlly;
  assert.ok(offer && !offer.blocked && nexusGuildSecretAllyCanAct(view));
  const declaration = (source: string, destination: string, amount: number) => {
    const to = splitLocation(destination);
    const ordinary: Action = { type: 'guildShip', from: source, territory: to.territory,
      sector: to.sector, amount, elite: 0, allyPayment: 0 };
    const action = nexusGuildSecretAllyAction(view, offer.event, ordinary); assert.ok(action);
    const quote = nexusGuildSecretAllyQuote(view, to.territory, amount); assert.ok(quote);
    return { action, cost: quote.cost, sources: { [source]: { normal: amount, elite: 0 } } };
  };
  const fighterQuote = declaration('imperial_basin:9', 'arrakeen:10', 1);
  const advisorQuote = declaration('arrakeen:10', 'imperial_basin:9', 1);
  const largerQuote = declaration('imperial_basin:9', 'arrakeen:10', 2);
  const emptyQuote = declaration('imperial_basin:9', 'polar_sink:0', 1);
  const quote = direction === 'fightersToAdvisors' ? fighterQuote : advisorQuote;
  const sourceLocation = direction === 'fightersToAdvisors' ? 'imperial_basin:9' : 'arrakeen:10';
  const destinationLocation = direction === 'fightersToAdvisors' ? 'arrakeen:10' : 'imperial_basin:9';
  const player = advisorSecretTransportMatchingPlayer(game, bg);
  assert.equal(player.ally, null); assert.ok(!game.players.some(player => player.faction === 'guild'));
  assert.equal(player.forces['imperial_basin:9'], 2); assert.ok(!player.advisors?.imperial_basin);
  assert.equal(player.forces['arrakeen:10'], 1); assert.ok(player.advisors?.arrakeen);
  assert.equal(player.shipped, false); assert.equal(player.moved, 0);
  assert.equal(quote.cost, 1); assert.ok(quote.cost <= player.spice);
  assert.equal(game.nexusCards!.cards!.hands[bg], 'guild');
  assert.ok(advisorSecretTransportMatchingPlayer(game, holder).hand.some(card => card.id === karama.id));
  assert.deepEqual(advisorSecretTransportMatchingInventory(game), originalInventory);
  assert.deepEqual(advisorSecretTransportNexusInventory(game), originalNexusInventory);
  return { game, source: structuredClone(game), beforeAction: structuredClone(game), initial, enableNexus,
    lobby, setup, beforeStartingDeal, afterSetup, advisorSetup, fighterShipment,
    beforeWorm, wormOrder, wormFollowupOrder, nexus, alliance, beforeNexusOrder, nexusOrder,
    beforeNexusDraw, drawStep, nexusDraw, afterNexusDraw: nexusDraw.after,
    kind: 'secret' as const, direction, bg, owner: bg, holder, atreides: holder, emperor, guild: null,
    karama: karama.id, card: karama.id, nexusCard: 'guild' as const, event: offer.event, offer: structuredClone(offer),
    actor: bg, shipper: bg, action: quote.action, sources: quote.sources, amount: 1, cost: quote.cost,
    origin: splitLocation(sourceLocation).territory, destination: splitLocation(destinationLocation).territory,
    sourceLocation, destinationLocation, from: sourceLocation, to: destinationLocation,
    fightersToAdvisors: fighterQuote.action, advisorsToFighters: advisorQuote.action,
    largerPacket: largerQuote.action, noMatch: emptyQuote.action, replacement: largerQuote.action,
    replacements: [largerQuote.action, emptyQuote.action], matchingActions: [fighterQuote.action, advisorQuote.action],
    actionQuotes: { fighter: fighterQuote, advisor: advisorQuote, larger: largerQuote, empty: emptyQuote },
    transportStep: { actor: bg, action: quote.action } satisfies AdvisorSecretTransportMatchingStep,
    steps, actions: steps, sourceActionCount: steps.length, originalInventory, originalNexusInventory,
    originalSpice, dealOrder, spiceOrder,
    staging: [
      'Actual public Advanced BG/Atreides/Emperor lobby enables Nexus through its original moduleOption action, then ready/startPreview and native base33/all12 Nexus setup. Guild is absent; no Homeworld, Discovery, Skills, Tech or Stronghold module is selected.',
      'Original prediction/private Traitors and actual advisorSetup place one BG advisor beside Atreides’ native ten Arrakeen10 counters. Only original scalar shuffles, three unopened Treachery positions and safe unopened Spice positions are chosen; Atreides actually receives and retains its printed Karama.',
      'During its real first turn BG pays four to ship two original reserves into empty Basin9 as fighters. Native Storm/dual Spice/Charity/Bidding/Revival, original preparation decline and peaceful remaining turns preserve both groups without a force, wallet, hand, phase or stance installation.',
      'At actual turn-two Shai-Hulud Nexus, Atreides really proposes alliance and Emperor really accepts. BG stays unallied. This separate native alliance supplies printed closing-draw eligibility; no BG alliance is created and no Nexus Card can be drawn at an entirely unallied table.',
      'Only the original still-unopened Guild Nexus singleton is moved to the next original deck position before BG’s real nexusCardChoice draw. The actual hand/phase history and all12 physical singletons are preserved; no held card, draw receipt or history is installed.',
      'Stop at BG’s real unused turn with the live absent-Guild Secret Ally offer. Both original guildShip directions carry its real event, plus packet2/empty replacements. The original Guild Nexus remains held; matching, physical transport, bank payment and recordGuildSecretShipment consumption remain caller-owned outcomes.',
    ] };
}
export type AdvisorSecretTransportMatchingFixture = ReturnType<typeof createAdvisorSecretTransportMatchingFixture>;

export function commitAdvisorSecretTransportMatching(source: Game, fixture: AdvisorSecretTransportMatchingFixture,
  action: Action = fixture.action, steps: AdvisorSecretTransportMatchingStep[] = []) {
  const before = structuredClone(source), start = steps.length;
  const game = actAdvisorSecretTransportMatching(source, fixture.bg, action, steps);
  return { game, before, after: structuredClone(game), steps: structuredClone(steps.slice(start)) };
}
