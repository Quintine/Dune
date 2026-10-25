import assert from 'node:assert/strict';
import { createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game } from '../game/engine';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaCombatCapabilities, nextSemutaCombatCapabilities,
  semutaCombatCapabilitiesPlayer, semutaCombatCapabilitiesInventory, semutaCombatCapabilitiesClean,
  passSemutaCombatCapabilities, claimSemutaCombatCapabilities,
} from './fixture-semuta-combat-capabilities';

export type SemutaAdvisorAloneStep = { actor: string; action: Action };
export const actSemutaAdvisorAlone = actSemutaCombatCapabilities;
export const semutaAdvisorAlonePlayer = semutaCombatCapabilitiesPlayer;
export const semutaAdvisorAloneInventory = semutaCombatCapabilitiesInventory;
export const semutaAdvisorAloneClean = semutaCombatCapabilitiesClean;
export const passSemutaAdvisorAlone = passSemutaCombatCapabilities;
export const claimSemutaAdvisorAlone = claimSemutaCombatCapabilities;
export const semutaAdvisorAlonePhysical = (game: Game) => ({
  turn: game.turn, phase: game.phase, storm: game.storm, active: game.active, order: game.order,
  ready: game.ready, movementRemaining: game.movementRemaining, spice: game.spice,
  players: game.players.map(p => ({ id: p.id, spice: p.spice, forces: p.forces, reserves: p.reserves,
    tanks: p.tanks, elites: p.elites, leaders: p.leaders, ally: p.ally, shipped: p.shipped, moved: p.moved })),
});

/** Original setup and native quiet controls only. The BG start choice declines
 * preparation, keeping the actual setup advisor beside Atreides' garrison. */
export function nextSemutaAdvisorAlone(game: Game): SemutaAdvisorAloneStep | null {
  if (!game.response && !game.phaseOpening && !game.pendingTreacheryDiscard) {
    if (game.status === 'setup' && game.setupStage === 'prediction')
      return { actor: 'beneGesserit', action: { type: 'predict', faction: 'atreides', turn: 10 } };
    const bg = game.players.find(p => p.faction === 'beneGesserit');
    if (game.status === 'setup' && game.setupStage === 'forces' && bg && !bg.advisorSetup)
      return { actor: bg.id, action: { type: 'advisorSetup', territory: 'arrakeen', sector: 10 } };
    const d = game.decision;
    if (d?.kind === 'advisorBattle' || d?.kind === 'advisor' || d?.kind === 'intrusion')
      return { actor: d.player, action: { type: 'decision', accept: false } };
  }
  return nextSemutaCombatCapabilities(game);
}
export const nextSemutaAdvisorAloneStep = nextSemutaAdvisorAlone;
export function advanceSemutaAdvisorAlone(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorAloneStep[] = []): Game {
  for (let count = 0; count < 2200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const next = nextSemutaAdvisorAlone(game);
    assert.ok(next, `Supply the real advisor control at ${game.turn}/${game.phase}/${game.decision?.kind}`);
    game = actSemutaAdvisorAlone(game, next.actor, next.action, actions);
  }
  throw Error('The native alone-advisor source did not reach its finite boundary');
}
export function allowSemutaAdvisorAlone(game: Game, actions: SemutaAdvisorAloneStep[] = []): Game {
  assert.ok(game.response?.kind === 'advisorFlip');
  assert.equal(game.response.automaticAdvisorFlip?.producer, 'groundMovement');
  for (let count = 0; game.response?.kind === 'advisorFlip' && count < game.players.length; count++) {
    const actor = game.players.find(p => !game.response!.passed.includes(p.id)); assert.ok(actor);
    game = actSemutaAdvisorAlone(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.notEqual(game.response?.kind, 'advisorFlip'); return game;
}
/** Finish the original automatic-conversion suffix only. Leave Atreides'
 * current combined turn, shipment and later endMovement to the caller. */
export function finishSemutaAdvisorAlone(game: Game, actions: SemutaAdvisorAloneStep[] = []): Game {
  assert.ok(!game.pendingTreacheryDiscard);
  return advanceSemutaAdvisorAlone(game, state => semutaAdvisorAloneClean(state) &&
    !state.pendingAutomaticAdvisorFlips?.length && !state.pendingArrivalReaction?.length, actions);
}

/** Original Advanced R/C/BG/A/E setup, paid cache1 and a real ten-counter
 * Atreides departure. No played army, stance, hold or response is installed. */
export function createSemutaAdvisorAloneFixture() {
  const richese = 'richese', holder = 'choam', owner = 'beneGesserit', mover = 'atreides', spender = 'emperor';
  const territory = 'arrakeen', sector = 10, from = 'arrakeen:10', to = 'imperial_basin:10', amount = 10;
  let game = createGame('SEMUTAADVISORALONE', newPlayer(richese, 'Richese', 'richese'), true, ['choam']);
  for (const faction of ['choam', 'beneGesserit', 'atreides', 'emperor'] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorAloneStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorAlone(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorAlone(game, until, actions); };
  const transition = (run: () => void) => {
    const before = structuredClone(game), at = actions.length; run();
    return { before, steps: structuredClone(actions.slice(at)), after: structuredClone(game) };
  };
  for (const p of game.players) act(p.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game);
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(p => p.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAdvisorAloneInventory(game); assert.equal(originalInventory.length, 45);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' || card.kind === 'poison').slice(0, 4);
  assert.equal(ordinary.length, 4); const selected = [...ordinary, printed];
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { card: card.id, position, from };
  });
  const beforeStartingDeal = structuredClone(game), cost = printed.id;
  const setupChoices = transition(() => { reach(state => state.status === 'playing'); });
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(p => p.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorAlonePlayer(game, mover).forces[from], amount);
  assert.equal(semutaAdvisorAlonePlayer(game, owner).forces[from], 1);
  assert.ok(semutaAdvisorAlonePlayer(game, owner).advisors?.[territory]);
  assert.ok(semutaAdvisorAlonePlayer(game, spender).hand.some(card => card.id === cost));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder = [0, 1].map(position => {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0]; game.spiceDeck.splice(position, 0, card);
    return { position, from, card: structuredClone(card) };
  });
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaAdvisorAloneStep | undefined, bidAt = -1;
  for (let count = 0; count < 1000 && !semutaAdvisorAlonePlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const next = nextSemutaAdvisorAlone(game); assert.ok(next);
    if (next.actor === holder && next.action.type === 'richeseBid' && next.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(next); bidAt = actions.length;
    }
    act(next.actor, next.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0);
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorAlonePlayer(beforeBid, holder).spice - semutaAdvisorAlonePlayer(game, holder).spice, 1);
  const beforeMovement = structuredClone(game), movementAt = actions.length;
  reach(state => state.turn === 1 && state.phase === 5 && state.active === mover && semutaAdvisorAloneClean(state));
  const movementOpening = { before: beforeMovement, steps: structuredClone(actions.slice(movementAt)), after: structuredClone(game) };
  assert.equal(semutaAdvisorAlonePlayer(game, mover).forces[from], amount);
  assert.equal(semutaAdvisorAlonePlayer(game, mover).moved, 0);
  assert.ok(semutaAdvisorAlonePlayer(game, owner).advisors?.[territory]);
  const moveAction: Action = { type: 'move', from, amount, elite: 0, territory: 'imperial_basin', sector };
  const departure = transition(() => { act(mover, moveAction); });
  assert.ok(game.response?.kind === 'advisorFlip');
  const automatic = game.response.automaticAdvisorFlip; assert.ok(automatic?.producer === 'groundMovement');
  assert.equal(automatic.owner, owner); assert.equal(automatic.mover, mover); assert.equal(automatic.move, 1);
  assert.deepEqual(automatic.forces, { [from]: 1 }); assert.equal(automatic.territory, territory);
  assert.equal(semutaAdvisorAlonePlayer(game, owner).advisors?.[territory]?.aloneFlipHold, automatic.event);
  assert.equal(semutaAdvisorAlonePlayer(game, mover).forces[from] ?? 0, 0);
  assert.equal(semutaAdvisorAlonePlayer(game, mover).forces[to], amount);
  assert.equal(semutaAdvisorAlonePlayer(game, mover).moved, 1);
  assert.deepEqual(semutaAdvisorAloneInventory(game), originalInventory);
  return { game, kind: 'advisorFlip' as const, advanced: true as const, richese, holder, owner, mover, spender,
    cost, karama: cost, semuta: SEMUTA_DRUG_ID,
    action: { type: 'card', card: cost, mode: 'cancel' } as Action,
    originalResponse: structuredClone(game.response), originalAutomaticSource: structuredClone(automatic),
    originalQueue: structuredClone(game.pendingAutomaticAdvisorFlips!),
    originalPhysical: structuredClone(semutaAdvisorAlonePhysical(game)),
    originalStance: structuredClone(semutaAdvisorAlonePlayer(game, owner).advisors!),
    originalMovement: { active: game.active, moved: semutaAdvisorAlonePlayer(game, mover).moved,
      shipped: semutaAdvisorAlonePlayer(game, mover).shipped, forces: structuredClone(semutaAdvisorAlonePlayer(game, mover).forces) },
    territory, sector, from, to, amount, moveAction, initial, lobby, setup, setupChoices, beforeStartingDeal,
    afterSetup, dealOrder, deal: selected.map(card => card.id), originalInventory, originalSpice, spiceOrder,
    acquisition, acquired, cache: acquisition, movementOpening, departure,
    actions, steps: actions, sourceActionCount: actions.length,
    staging: [
      'Original undealt Advanced Semuta initializer on genuine ready R/C/BG/A/E with CHOAM only and no optional modules. Original setup predicts, selects private Traitors and actually places BG’s one advisor in Arrakeen10 beside Atreides’ original ten.',
      'Only unopened starting-card/Spice positions and scoped native scalar lotteries are selected. Emperor receives the original printed Karama, and CHOAM really pays cache1 for Semuta. Native BG preparation is declined; unused movement turns end through actual controls.',
      'Atreides actually moves all ten original Arrakeen counters to empty Imperial Basin10. The completed move index1 leaves BG alone and opens the original mandatory groundMovement conversion with an actual UUID hold and exact one-counter footprint.',
      'Stop before the real cancellation cost. No played force, stance, hold, hand, wallet, clock, movement, source queue or response is installed. Only the original automatic outcome and movement suffix are tested.',
    ] };
}
export type SemutaAdvisorAloneFixture = ReturnType<typeof createSemutaAdvisorAloneFixture>;
