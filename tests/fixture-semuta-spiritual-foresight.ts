import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaRicheseCacheKarama, nextSemutaRicheseCacheKarama,
  semutaRicheseCacheKaramaClean, semutaRicheseCacheKaramaInventory,
  semutaRicheseCacheKaramaPlayer,
} from './fixture-semuta-richese-cache-karama';

export type SemutaSpiritualForesightStep = { actor: string; action: Action };
export const actSemutaSpiritualForesight = actSemutaRicheseCacheKarama;
export const semutaSpiritualForesightInventory = semutaRicheseCacheKaramaInventory;
export const semutaSpiritualForesightPlayer = semutaRicheseCacheKaramaPlayer;
export const semutaSpiritualForesightClean = semutaRicheseCacheKaramaClean;

/** Native setup chooses either the quiet Polar source or the real Arrakeen
 * advisor-battle opportunity. No force, stance or decision is installed. */
export function nextSemutaSpiritualForesight(game: Game,
  openingDecision?: 'advisorBattle' | 'guildTiming'): SemutaSpiritualForesightStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    const bg = game.players.find(player => player.faction === 'beneGesserit');
    if (game.status === 'setup' && game.setupStage === 'prediction') {
      assert.ok(bg);
      return { actor: bg.id, action: { type: 'predict', faction: 'emperor', turn: 10 } };
    }
    if (game.status === 'setup' && game.setupStage === 'forces' && game.advanced && bg && !bg.advisorSetup)
      return { actor: bg.id, action: { type: 'advisorSetup',
        territory: openingDecision === 'advisorBattle' ? 'arrakeen' : 'polar_sink',
        sector: openingDecision === 'advisorBattle' ? 10 : 0 } };
    if (game.decision?.kind === 'advisor' || game.decision?.kind === 'advisorBattle' || game.decision?.kind === 'intrusion')
      return { actor: game.decision.player, action: { type: 'decision', accept: false } };
  }
  return nextSemutaRicheseCacheKarama(game);
}
export function advanceSemutaSpiritualForesight(game: Game, until: (state: Game) => boolean,
  actions: SemutaSpiritualForesightStep[] = [], openingDecision?: 'advisorBattle' | 'guildTiming'): Game {
  for (let count = 0; count < 1800; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished', 'The original terminal source must reach its next native control');
    const next = nextSemutaSpiritualForesight(game, openingDecision);
    assert.ok(next, `Supply the original owned control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaSpiritualForesight(game, next.actor, next.action, actions);
  }
  throw Error('The original Spiritual/foresight programme did not reach its finite boundary');
}

/** Real first-turn Semuta purchase precedes both terminal sources. The Basic
 * advisor path retains a committed Emperor shipment; foresight stops at the
 * native phase-five opening before a card can be inspected or drawn. */
export function createSemutaSpiritualForesightFixture(options: {
  kind: 'advisor' | 'atreidesSpice'; advanced?: boolean; openingDecision?: 'advisorBattle' | 'guildTiming';
}) {
  const { kind, openingDecision } = options, advanced = options.advanced ?? false;
  assert.ok(kind !== 'advisor' || !advanced,
    'This source is the ordinary Basic bare advisor response, not a new or legacy Advanced Spiritual frame');
  assert.ok(!openingDecision || advanced && kind === 'atreidesSpice',
    'Only actual Advanced foresight shares these native opening decisions');
  const richese = 'richese', holder = 'choam', bg = 'beneGesserit', atreides = 'atreides', spender = 'emperor';
  const fifthFaction = openingDecision === 'guildTiming' ? 'guild' as const : bg;
  const owner = kind === 'advisor' ? bg : atreides;
  let game = createGame('SEMUTASPIRITUALFORESIGHT', newPlayer(richese, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of [holder, fifthFaction, atreides, spender] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaSpiritualForesightStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaSpiritualForesight(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => {
    game = advanceSemutaSpiritualForesight(game, until, actions, openingDecision);
  };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'original-undealt-semuta-preview' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaSpiritualForesightInventory(game);
  assert.equal(originalInventory.length, 45); assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 4); assert.equal(ordinary.length, 4);
  const selected = [...ordinary, printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), cost = printed.id;
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.ok(semutaSpiritualForesightPlayer(game, spender).hand.some(card => card.id === cost));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const front: Game['spiceDeck'] = [], spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < (advanced ? 2 : 1); position++) {
    const from = game.spiceDeck.findIndex(card => 'territory' in card && !card.discovery); assert.ok(from >= 0);
    const card = game.spiceDeck.splice(from, 1)[0]; front.push(card);
    spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  game.spiceDeck.unshift(...front);
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bidStep: SemutaSpiritualForesightStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaSpiritualForesightPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaSpiritualForesight(game, openingDecision); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bidStep = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bidStep && bidAt >= 0, 'CHOAM must actually buy the original Semuta from cache');
  const acquired = structuredClone(game), acquisition = {
    before: beforeBid, bid: bidStep, steps: structuredClone(actions.slice(bidAt)), after: acquired,
  };
  assert.equal(semutaSpiritualForesightPlayer(beforeBid, holder).spice - semutaSpiritualForesightPlayer(game, holder).spice, 1);
  assert.equal(semutaSpiritualForesightPlayer(game, richese).spice - semutaSpiritualForesightPlayer(beforeBid, richese).spice, 1);
  reach(state => state.phase === 4 && semutaSpiritualForesightClean(state));
  const beforeMovement = structuredClone(game);
  let beforeShipment: Game | null = null;
  let shipment: { before: Game; action: Action; after: Game; steps: SemutaSpiritualForesightStep[] } | null = null;
  let advisorChoice: { before: Game; action: Action; after: Game } | null = null;
  if (kind === 'advisor') {
    reach(state => state.phase === 5 && state.active === spender && semutaSpiritualForesightClean(state));
    beforeShipment = structuredClone(game);
    const action: Action = { type: 'ship', territory: 'polar_sink', sector: 0, amount: 1, elite: 0, allyPayment: 0 };
    const start = actions.length;
    act(spender, action);
    reach(state => state.phase === 5 && !state.response && !state.phaseOpening && state.decision?.kind === 'advisor');
    assert.ok(game.decision?.kind === 'advisor');
    assert.equal(game.decision?.player, bg);
    assert.equal(game.decision?.shipment, spender);
    const after = structuredClone(game);
    shipment = { before: beforeShipment, action, after, steps: structuredClone(actions.slice(start)) };
    assert.equal(semutaSpiritualForesightPlayer(beforeShipment, spender).spice - semutaSpiritualForesightPlayer(game, spender).spice, 2);
    assert.equal(semutaSpiritualForesightPlayer(beforeShipment, spender).reserves - semutaSpiritualForesightPlayer(game, spender).reserves, 1);
    assert.equal(semutaSpiritualForesightPlayer(game, spender).forces['polar_sink:0'], 1);
    const accept: Action = { type: 'decision', accept: true, amount: 1 };
    act(bg, accept);
    advisorChoice = { before: after, action: accept, after: structuredClone(game) };
    assert.equal(game.response?.kind, 'advisor');
    assert.equal(game.response?.spiritualAdvisorSource, undefined);
    assert.equal(game.response?.advisorAmbassadorEvent, undefined);
    assert.equal(game.response?.advisorRevivalEvent, undefined);
    assert.ok(!game.pendingSpiritualAdvisor);
  } else {
    reach(state => state.phase === 5 && state.response?.kind === 'atreidesSpice');
    assert.equal(game.spicePeekKnown, false);
    assert.deepEqual(game.spiceDeck, beforeMovement.spiceDeck);
    assert.deepEqual(game.spiceDiscard, beforeMovement.spiceDiscard);
  }
  assert.equal(game.response?.kind, kind); assert.equal(game.response?.owner, owner);
  assert.equal(game.phaseOpening ?? null, null, 'The actual phase opening is complete, never cleared by staging');
  if (openingDecision) {
    assert.equal(game.decision?.kind, openingDecision, 'The original phase-five quote must genuinely create this decision');
    assert.equal(game.decision?.player, openingDecision === 'advisorBattle' ? bg : 'guild');
    if (game.decision?.kind === 'advisorBattle') assert.ok(game.decision.territories.includes('arrakeen'));
  } else assert.equal(game.decision, null, 'This actual source has no other owned decision parked alongside it');
  assert.ok(semutaSpiritualForesightPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaSpiritualForesightPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaSpiritualForesightInventory(game), originalInventory);
  const source = structuredClone(game), action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return {
    game, source, gameBeforeCost: source, action, kind, advanced, openingDecision,
    owner, holder, spender, richese, bg, atreides, cost, karama: cost, semuta: SEMUTA_DRUG_ID,
    originalResponse: structuredClone(game.response), originalDecision: structuredClone(game.decision),
    beforeMovement, beforeShipment, shipment, advisorChoice,
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, dealOrder, spiceOrder,
    acquired, acquisition, originalInventory, inventory: originalInventory, originalSpice,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      advanced
        ? openingDecision === 'guildTiming'
          ? 'Existing Advanced Semuta initializer on the original ready undealt R/CHOAM/Guild/Atreides/Emperor lobby. Original Guild membership naturally creates the phase-five Guild timing decision alongside Atreides foresight.'
          : openingDecision === 'advisorBattle'
            ? 'Existing Advanced Semuta initializer on the original ready undealt R/CHOAM/BG/Atreides/Emperor lobby; BG really predicts Emperor turn10 and places its initial advisor in Arrakeen10 alongside native Atreides, naturally earning the phase-five advisorBattle decision.'
            : 'Existing Advanced Semuta initializer on the original ready undealt R/CHOAM/BG/Atreides/Emperor lobby; actual BG predicts Emperor turn10 and chooses native Polar Sink setup, avoiding an unrelated advisorBattle chooser.'
        : 'Actual public bare Basic R/CHOAM/BG/Atreides/Emperor ready/start, original prediction and force setup, with existing Semuta preview initialized before play.',
      'Only unopened original starting-card positions (Emperor genuinely receives printed Karama), one Basic/two Advanced unplayed land Spice positions and original scalar lotteries are selected. CHOAM really buys Semuta in the native first cache auction for one spice paid to Richese.',
      kind === 'advisor'
        ? 'Actual original phase-five foresight is allowed, earlier combined turns end, then Emperor pays two spice to send one real reserve force to Polar Sink. BG accepts its genuine free accompaniment, opening the ordinary bare Basic advisor response. The original paid shipment remains committed; no newer Advanced Spiritual/Ambassador/revival source is manufactured.'
        : 'After the paid Semuta acquisition and original Revival, stop at the genuine phase-five Atreides Spice foresight response. Native phase-opening passes complete normally. No Spice Card is drawn, revealed, reordered or refilled between the prior Revival snapshot and this offered foresight.',
      openingDecision
        ? `The actual ${openingDecision} decision remains unanswered alongside the native Atreides response. Its owner, counters, territories/order and complete saved decision are captured, never manufactured or cleared by the fixture.`
        : 'The default source retains its original null opening decision.',
      'No played hand, balance, force, stance, phase, readiness, queue, response or receipt is installed.',
    ],
  };
}
export type SemutaSpiritualForesightFixture = ReturnType<typeof createSemutaSpiritualForesightFixture>;

export function passSemutaSpiritualForesight(game: Game, actions: SemutaSpiritualForesightStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const player = game.players.find(player => !reaction.passed.includes(player.id)); assert.ok(player);
    game = actSemutaSpiritualForesight(game, player.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaSpiritualForesight(game: Game, fixture: Pick<SemutaSpiritualForesightFixture, 'holder' | 'cost'>,
  actions: SemutaSpiritualForesightStep[] = []): Game {
  const pending = game.pendingTreacheryDiscard; assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event; assert.equal(pending.batch.entries[0].card.id, fixture.cost);
  game = actSemutaSpiritualForesight(game, fixture.holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaSpiritualForesight(game, fixture.holder, { type: 'semutaSelect', event, card: fixture.cost }, actions);
  return game;
}
