import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, viewGame, type Action, type Game,
} from '../game/engine';
import { validateWormCancellation } from '../game/disaster-preflight';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import { actTruthMovement } from './fixture-truth-movement';
import {
  nextSemutaRicheseCacheKarama, semutaRicheseCacheKaramaInventory,
  semutaRicheseCacheKaramaPlayer, semutaRicheseCacheKaramaClean,
} from './fixture-semuta-richese-cache-karama';

export type SemutaDisasterWormKind = 'wormSurvival' | 'wormAllyProtection' | 'wormPlacement';
export type SemutaDisasterWormStep = { actor: string; action: Action };
export const actSemutaDisasterWorm = actTruthMovement;
export const semutaDisasterWormPlayer = semutaRicheseCacheKaramaPlayer;
export const semutaDisasterWormInventory = semutaRicheseCacheKaramaInventory;
export const semutaDisasterWormClean = semutaRicheseCacheKaramaClean;
export const semutaDisasterWormPhysical = (game: Game) => ({
  players: game.players.map(p => ({ id: p.id, forces: p.forces, elites: p.elites, reserves: p.reserves,
    tanks: p.tanks, spice: p.spice, shipped: p.shipped, moved: p.moved, ally: p.ally })),
  spice: game.spice,
});

/** Original controls only. Fresh disposal is caller-owned; no new worm or
 * optional replacement is requested by this continuation driver. */
export function nextSemutaDisasterWorm(game: Game): SemutaDisasterWormStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance) return null;
  if (!game.phaseOpening && !game.response) {
    const fremen = game.players.find(p => p.faction === 'fremen');
    if (game.status === 'setup' && game.setupStage === 'forces' && fremen?.reserves === 20 &&
        viewGame(game, fremen.id).setupPending.includes(fremen.id))
      return { actor: fremen.id, action: { type: 'fremenSetup', placements: { 'sietch_tabr:14': 10 } } };
    const decision = game.decision;
    if (decision?.kind === 'guildTiming')
      return { actor: decision.player, action: { type: 'decision', take: false } };
    if (decision?.kind === 'wormRide' || decision?.kind === 'wormPlacement')
      return { actor: decision.player, action: { type: 'decision', accept: false } };
    if (decision?.kind === 'wormProtection')
      return { actor: decision.player, action: { type: 'decision', accept: true } };
  }
  return nextSemutaRicheseCacheKarama(game);
}
export const nextSemutaDisasterWormStep = nextSemutaDisasterWorm;
export function advanceSemutaDisasterWorm(game: Game, until: (state: Game) => boolean,
  actions: SemutaDisasterWormStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaDisasterWorm(game);
    assert.ok(step, `Choose the original fresh reaction at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaDisasterWorm(game, step.actor, step.action, actions);
  }
  throw Error('The native worm source did not reach its finite boundary');
}
export function passSemutaDisasterWorm(game: Game, actions: SemutaDisasterWormStep[] = []): Game {
  const event = game.pendingTreacheryDiscard?.batch.event; assert.ok(event);
  for (let count = 0; game.pendingTreacheryDiscard?.batch.event === event && count < game.players.length; count++) {
    const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
    const reaction = pending.reaction; assert.ok(reaction?.stage === 'offer');
    const actor = game.players.find(p => !reaction.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaDisasterWorm(game, actor.id, { type: 'semutaPass', event }, actions);
  }
  assert.notEqual(game.pendingTreacheryDiscard?.batch.event, event); return game;
}
export function claimSemutaDisasterWorm(game: Game, holder: string,
  actions: SemutaDisasterWormStep[] = []): Game {
  const pending: NonNullable<Game['pendingTreacheryDiscard']> = game.pendingTreacheryDiscard!;
  assert.ok(pending && pending.batch.entries.length === 1);
  const event = pending.batch.event, card = pending.batch.entries[0].card.id;
  game = actSemutaDisasterWorm(game, holder, { type: 'semutaCommit', event }, actions);
  if (game.pendingTreacheryDiscard?.reaction?.stage === 'select')
    game = actSemutaDisasterWorm(game, holder, { type: 'semutaSelect', event, card }, actions);
  return game;
}
/** Pass only this original response. A subsequent independent survival
 * response, additional placement or ride remains a real later control. */
export function allowSemutaDisasterWorm(game: Game, actions: SemutaDisasterWormStep[] = []): Game {
  const kind = game.response?.kind;
  assert.ok(kind === 'wormSurvival' || kind === 'wormAllyProtection' || kind === 'wormPlacement');
  for (let count = 0; game.response?.kind === kind && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaDisasterWorm(game, actor.id, { type: 'passResponse' }, actions);
    if (game.response?.kind !== kind || game.response.passed.length === 0) break;
  }
  return game;
}
/** Resolve actual remaining survival/ride/Nexus controls to quiet Charity.
 * Never bypass a new fresh batch or request another producer. */
export function finishSemutaDisasterWorm(game: Game, actions: SemutaDisasterWormStep[] = []): Game {
  const turn = game.turn;
  return advanceSemutaDisasterWorm(game, state => state.turn === turn && state.phase === 2 &&
    semutaDisasterWormClean(state), actions);
}

/** Genuine paid Semuta, original printed costs and natural Spice sequence.
 * Unopened positions are selected before the corresponding native draws.
 * No played hand, wallet, force, alliance, phase or pending frame is installed. */
export function createSemutaDisasterWormFixture(options: {
  kind?: SemutaDisasterWormKind; advanced?: boolean; summoned?: boolean;
} = {}) {
  const kind = options.kind ?? 'wormSurvival', advanced = options.advanced ?? kind === 'wormPlacement';
  const summoned = options.summoned ?? false;
  assert.ok(kind !== 'wormPlacement' || advanced, 'Additional worm placement is Advanced only');
  assert.ok(!summoned || advanced && kind === 'wormSurvival', 'The bounded summoned source is Advanced survival only');
  const richese = 'richese', holder = 'choam', owner = 'fremen', guild = 'guild', spender = 'emperor';
  const location = 'funeral_plain:15', allyLocation = 'the_great_flat:15';
  let game = createGame('SEMUTADISASTERWORM', newPlayer(richese, 'Richese', 'richese'), advanced, ['choam']);
  for (const faction of ['choam', 'fremen', 'guild', 'emperor'] as const) joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaDisasterWormStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaDisasterWorm(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaDisasterWorm(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  if (advanced) game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  else act(game.host, { type: 'start' });
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: advanced ? 'original-undealt-semuta-preview' : 'public-basic-start' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, advanced); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaDisasterWormInventory(game); assert.equal(originalInventory.length, 45);
  const karamas = game.deck.filter(card => card.effect === 'karama'); assert.equal(karamas.length, 2);
  const ordinary = game.deck.filter(card => card.kind === 'projectile').slice(0, 3); assert.equal(ordinary.length, 3);
  const selected = [ordinary[0], ordinary[1], karamas[0], ordinary[2], karamas[1]];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game), cost = karamas[1].id, summonCost = karamas[0].id;
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { turn: number; position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  const orderSpice = (faces: string[]) => {
    for (let position = 0; position < faces.length; position++) {
      const face = faces[position];
      const from = game.spiceDeck.findIndex((card, index) => index >= position &&
        (face === 'worm' ? 'worm' in card && !card.suppressed && !card.thumper && !card.greatMaker
          : 'territory' in card && card.territory === face && !card.discovery));
      assert.ok(from >= position, `The unopened native Spice stock needs ${face}`);
      const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
      spiceOrder.push({ turn: game.turn, position, from, card: structuredClone(card) });
    }
  };
  orderSpice(advanced ? ['funeral_plain', 'hagga_basin'] : ['funeral_plain']);
  let beforeBid: Game | undefined, bid: SemutaDisasterWormStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaDisasterWormPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaDisasterWorm(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaDisasterWormPlayer(beforeBid, holder).spice - semutaDisasterWormPlayer(game, holder).spice, 1);
  reach(state => state.turn === 1 && state.phase === 5 && semutaDisasterWormClean(state));
  assert.equal(game.storm, 1);
  const shipments: { actor: string; location: string; cost: number; before: Game; steps: SemutaDisasterWormStep[]; after: Game }[] = [];
  for (let count = 0; game.turn === 1 && game.phase === 5 && count < 160; count++) {
    if (semutaDisasterWormClean(game) && (game.active === holder || game.active === owner) &&
        !semutaDisasterWormPlayer(game, game.active!).shipped) {
      const actor = game.active!, destination = actor === holder ? 'the_great_flat' : 'funeral_plain';
      const paid = actor === holder ? 2 : 0;
      const shipment = transition(() => {
        act(actor, { type: 'ship', territory: destination, sector: 15, amount: 1, elite: 0, allyPayment: 0 });
        reach(state => semutaDisasterWormClean(state));
      });
      assert.equal(semutaDisasterWormPlayer(shipment.before, actor).spice - semutaDisasterWormPlayer(game, actor).spice, paid);
      shipments.push({ actor, location: `${destination}:15`, cost: paid, ...shipment });
    } else {
      const step = nextSemutaDisasterWorm(game); assert.ok(step); act(step.actor, step.action);
    }
  }
  assert.equal(shipments.length, 2); assert.equal(semutaDisasterWormPlayer(game, owner).forces[location], 1);
  assert.equal(semutaDisasterWormPlayer(game, holder).forces[allyLocation], 1);
  const beforeBlow = (state: Game, turn: number) => state.turn === turn && state.phase === 1 &&
    semutaDisasterWormClean(state) && !state.spiceSequence && !state.spiceResolution && !state.spiceWindow && !state.nexus && state.ready.length === 0;
  reach(state => beforeBlow(state, 2));
  const beforeSecondBlow = structuredClone(game);
  orderSpice(summoned ? ['the_great_flat', 'broken_land']
    : [...(kind === 'wormPlacement' ? ['worm', 'worm'] : ['worm']), 'the_great_flat', ...(advanced ? ['broken_land'] : [])]);
  const priorSurvivals: { before: Game; steps: SemutaDisasterWormStep[]; after: Game }[] = [];
  let nativeAction: Action | null = null, beforeDeclaration: Game | null = null;
  let summonDiscard: { before: Game; steps: SemutaDisasterWormStep[]; after: Game } | null = null;
  let alliance: { before: Game; steps: SemutaDisasterWormStep[]; after: Game } | null = null;
  if (summoned) {
    beforeDeclaration = structuredClone(game);
    nativeAction = { type: 'card', mode: 'special', card: summonCost, territory: 'funeral_plain' };
    act(owner, nativeAction);
    if (game.pendingTreacheryDiscard) summonDiscard = transition(() => { game = passSemutaDisasterWorm(game, actions); });
    reach(state => state.response?.kind === 'wormSurvival');
    assert.ok(game.summonedWorm); assert.ok(game.summonedWorm.resume);
  } else {
    reach(state => state.response?.kind === 'wormSurvival');
    if (kind !== 'wormSurvival') priorSurvivals.push(transition(() => { game = allowSemutaDisasterWorm(game, actions); }));
    if (kind === 'wormPlacement') {
      reach(state => state.decision?.kind === 'wormPlacement' && !state.response && !state.phaseOpening);
      beforeDeclaration = structuredClone(game); nativeAction = { type: 'decision', accept: true, territory: 'funeral_plain' };
      act(owner, nativeAction);
    } else if (kind === 'wormAllyProtection') {
      reach(state => state.turn === 2 && state.phase === 1 && state.nexus && !state.spiceWindow &&
        !state.spiceResolution && semutaDisasterWormClean(state));
      alliance = transition(() => {
        act(holder, { type: 'alliance', target: owner }); act(owner, { type: 'alliance', target: holder });
      });
      assert.equal(semutaDisasterWormPlayer(game, holder).ally, owner);
      assert.equal(semutaDisasterWormPlayer(game, owner).ally, holder);
      reach(state => beforeBlow(state, 3));
      orderSpice(['worm', 'rock_outcroppings', ...(advanced ? ['oh_gap'] : [])]);
      reach(state => state.decision?.kind === 'wormProtection' && !state.response && !state.phaseOpening);
      beforeDeclaration = structuredClone(game); nativeAction = { type: 'decision', accept: true };
      act(owner, nativeAction);
    }
  }
  assert.ok(game.response); assert.equal(game.response.kind, kind); assert.equal(game.response.owner, owner);
  assert.ok(!game.phaseOpening && !game.decision && !game.pendingTreacheryDiscard && !game.battle);
  validateWormCancellation(game, game.response);
  assert.ok(semutaDisasterWormPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaDisasterWormPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaDisasterWormInventory(game), originalInventory);
  const source = structuredClone(game), originalResponse = structuredClone(game.response), territory = game.response.location!;
  const recipient = game.response.recipient ?? null, targetLocation = `${territory}:15`;
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, kind, advanced, summoned, holder, spender, owner, recipient, richese, guild,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID, summonCost, action, nativeAction, beforeDeclaration,
    territory, target: territory, location: targetLocation, fremenLocation: location, allyLocation,
    originalResponse, originalPhysical: structuredClone(semutaDisasterWormPhysical(game)),
    originalSequence: structuredClone(game.spiceSequence ?? null), originalResolution: structuredClone(game.spiceResolution ?? null),
    originalRides: [...game.wormRides], originalSummoned: structuredClone(game.summonedWorm ?? null),
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, deal: selected.map(card => card.id), dealOrder,
    originalInventory, originalSpice, spiceOrder, acquired, acquisition, shipments, beforeSecondBlow,
    priorSurvivals, alliance, summonDiscard, actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      advanced ? 'Original Advanced Semuta preview initializer runs on the ready undealt R/C/F/G/E lobby, preserving main35/cache10. No Basic-to-Advanced conversion.' : 'Actual public Basic R/C/F/G/E ready/start preserves original main35/cache10.',
      'Only original unopened starting-card/Spice positions and scalar lotteries are selected. Fremen and Emperor each receive a distinct original printed Karama. Fremen actually places ten starting normals at Sietch Tabr; CHOAM actually purchases cache Semuta for one.',
      'CHOAM actually pays two to ship one normal to Great Flat15; Fremen actually freely ships one normal to Funeral Plain15. First native Storm dials are zero. Real Collection and subsequent Storm controls occur; neither cohort is installed or protected artificially.',
      kind === 'wormAllyProtection' ? 'Turn2 natural worm protects the separate Funeral cohort through real passes, then CHOAM and Fremen actually propose/accept their Nexus alliance. Turn3 natural worm hits the real Great Flat pile and CHOAM cohort. Fremen is absent there: this proves native ally protection without claiming a co-present independent survival branch.' : kind === 'wormPlacement' ? 'Two consecutive original turn2 worms create the actual Advanced additional-placement chooser. Fremen really chooses Funeral Plain, after the earlier survival was allowed; the additional native response is unpaid and unresolved.' : summoned ? 'Advanced Fremen actually spends its separately dealt original Karama to summon at Funeral before the turn2 blow. Every earlier fresh-discard participant really passes, retaining CHOAM Semuta. The full original summoned resume remains native.' : 'The original turn2 natural worm hits the real first-turn Funeral pile and Fremen cohort; stop at its native survival response.',
      'Stop before Emperor spends its originally dealt printed Karama. No played custody, wallet, forces, ally, Spice, clock, queued ride or pending response is assigned.',
    ],
  };
}
export type SemutaDisasterWormFixture = ReturnType<typeof createSemutaDisasterWormFixture>;
