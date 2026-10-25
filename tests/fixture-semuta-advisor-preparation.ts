import assert from 'node:assert/strict';
import {
  createGame, initializeSemutaGameForAudit, joinGame, newPlayer, type Action, type Game,
} from '../game/engine';
import { isAdvisor } from '../game/advisors';
import { quoteAdvisorPreparation } from '../game/advisor-preparation-window';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import { withClassicDiscoveryNexusLottery } from './fixture-discovery-classic-nexus';
import {
  actSemutaSpiritualForesight, nextSemutaSpiritualForesight,
  semutaSpiritualForesightClean, semutaSpiritualForesightInventory, semutaSpiritualForesightPlayer,
} from './fixture-semuta-spiritual-foresight';
import {
  passSemutaFremenGuildMovement, claimSemutaFremenGuildMovement,
} from './fixture-semuta-fremen-guild-movement';

export type SemutaAdvisorPreparationStep = { actor: string; action: Action };
export const actSemutaAdvisorPreparation = actSemutaSpiritualForesight;
export const passSemutaAdvisorPreparation = passSemutaFremenGuildMovement;
export const claimSemutaAdvisorPreparation = claimSemutaFremenGuildMovement;
export const semutaAdvisorPreparationPlayer = semutaSpiritualForesightPlayer;
export const semutaAdvisorPreparationInventory = semutaSpiritualForesightInventory;
export const semutaAdvisorPreparationClean = semutaSpiritualForesightClean;

/** Resolve native setup/auction controls, retaining the actual occupied
 * Arrakeen setup choice. A declared flip or its fresh cost stays caller-owned. */
export function nextSemutaAdvisorPreparation(game: Game): SemutaAdvisorPreparationStep | null {
  if (game.pendingTreacheryDiscard || game.truthtrance || game.response?.kind === 'advisorFlip') return null;
  return nextSemutaSpiritualForesight(game, 'advisorBattle');
}
export function advanceSemutaAdvisorPreparation(game: Game, until: (state: Game) => boolean,
  actions: SemutaAdvisorPreparationStep[] = []): Game {
  for (let count = 0; count < 1200; count++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const step = nextSemutaAdvisorPreparation(game);
    assert.ok(step, 'Choose the original advisor declaration or fresh discard before continuing');
    game = actSemutaAdvisorPreparation(game, step.actor, step.action, actions);
  }
  throw Error('The original advisor-preparation programme did not reach its finite boundary');
}
/** Allow only this original whole-territory declaration. No auction bid,
 * readiness acknowledgment, shipment or future movement is submitted. */
export function allowSemutaAdvisorPreparation(game: Game,
  actions: SemutaAdvisorPreparationStep[] = []): Game {
  assert.equal(game.response?.kind, 'advisorFlip');
  assert.ok(game.response?.advisorPreparationSource);
  for (let count = 0; game.response?.kind === 'advisorFlip' && count < game.players.length; count++) {
    const actor = game.players.find(player => !game.response!.passed.includes(player.id)); assert.ok(actor);
    game = actSemutaAdvisorPreparation(game, actor.id, { type: 'passResponse' }, actions);
  }
  assert.equal(game.response ?? null, null);
  return finishSemutaAdvisorPreparation(game);
}
/** Native direct preparation has no movement tail. Its original auction is
 * already the next control; do not advance it merely to manufacture a suffix. */
export function finishSemutaAdvisorPreparation(game: Game,
  _actions: SemutaAdvisorPreparationStep[] = []): Game {
  assert.equal(game.phase, 3); assert.ok(game.auction);
  assert.equal(game.pendingTreacheryDiscard ?? null, null);
  assert.equal(game.pendingKarama ?? null, null);
  assert.equal(game.response ?? null, null); assert.equal(game.decision ?? null, null);
  assert.equal(game.phaseOpening ?? null, null);
  return game;
}

/** Original undealt Advanced Semuta initializer, actual BG Arrakeen setup,
 * native first Storm/Spice, and paid cache1 acquisition. Only unopened card/
 * Spice positions and the existing scalar lottery are selected; no played
 * hand, board counter, stance, wallet, clock or control is installed. */
export function createSemutaAdvisorPreparationFixture() {
  const richese = 'richese', holder = 'choam', owner = 'beneGesserit', atreides = 'atreides', spender = 'emperor';
  let game = createGame('SEMUTAADVISORPREPARATION', newPlayer(richese, 'Richese', 'richese'), true, ['choam']);
  for (const faction of [holder, owner, atreides, spender] as const)
    joinGame(game, newPlayer(faction, faction, faction));
  const initial = structuredClone(game), actions: SemutaAdvisorPreparationStep[] = [];
  const act = (actor: string, action: Action) => { game = actSemutaAdvisorPreparation(game, actor, action, actions); };
  const reach = (until: (state: Game) => boolean) => { game = advanceSemutaAdvisorPreparation(game, until, actions); };
  for (const player of game.players) act(player.id, { type: 'ready' });
  const lobby = structuredClone(game);
  game = withClassicDiscoveryNexusLottery(() => initializeSemutaGameForAudit(game));
  const setup = structuredClone(game), initialization = { before: lobby, after: setup,
    entry: 'original-undealt-semuta-preview' };
  assert.equal(game.status, 'setup'); assert.equal(game.advanced, true); assert.equal(game.semutaPreview, true);
  assert.ok(game.players.every(player => player.hand.length === 0));
  assert.ok(!game.homeworlds && !game.nexusCards && !game.leaderSkills && !game.techTokens &&
    !game.strongholdCards && !game.discoveryEnabled && !game.ecazTreachery);
  const originalInventory = semutaAdvisorPreparationInventory(game);
  assert.equal(originalInventory.length, 45); assert.equal(game.deck.length, 35); assert.equal(game.richeseCache!.length, 10);
  const printed = game.deck.find(card => card.effect === 'karama'); assert.ok(printed);
  const ordinary = game.deck.filter(card => card.kind === 'projectile' && !card.effect).slice(0, 4);
  assert.equal(ordinary.length, 4);
  const selected = [...ordinary, printed], cost = printed.id;
  const dealOrder = selected.map((card, position) => {
    const from = game.deck.findIndex(candidate => candidate.id === card.id); assert.ok(from >= position);
    [game.deck[position], game.deck[from]] = [game.deck[from], game.deck[position]];
    return { position, from, card: card.id };
  });
  const beforeStartingDeal = structuredClone(game);
  reach(state => state.status === 'playing');
  const afterSetup = structuredClone(game);
  assert.deepEqual(game.players.flatMap(player => player.hand.map(card => card.id)), selected.map(card => card.id));
  assert.equal(semutaAdvisorPreparationPlayer(game, owner).forces['arrakeen:10'], 1);
  assert.equal(isAdvisor(semutaAdvisorPreparationPlayer(game, owner), 'arrakeen'), true);
  assert.equal(semutaAdvisorPreparationPlayer(game, atreides).forces['arrakeen:10'], 10);
  assert.ok(semutaAdvisorPreparationPlayer(game, spender).hand.some(card => card.id === cost));
  const originalSpice = game.spiceDeck.map(card => JSON.stringify(card)).sort();
  const spiceOrder: { position: number; from: number; card: Game['spiceDeck'][number] }[] = [];
  for (let position = 0; position < 2; position++) {
    const from = game.spiceDeck.findIndex((card, index) => index >= position && 'territory' in card && !card.discovery);
    assert.ok(from >= position); const card = game.spiceDeck.splice(from, 1)[0];
    game.spiceDeck.splice(position, 0, card); spiceOrder.push({ position, from, card: structuredClone(card) });
  }
  assert.deepEqual(game.spiceDeck.map(card => JSON.stringify(card)).sort(), originalSpice);
  let beforeBid: Game | undefined, bid: SemutaAdvisorPreparationStep | undefined, bidAt = -1;
  for (let count = 0; count < 900 && !semutaAdvisorPreparationPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID); count++) {
    const step = nextSemutaAdvisorPreparation(game); assert.ok(step);
    if (step.actor === holder && step.action.type === 'richeseBid' && step.action.amount === 1) {
      beforeBid = structuredClone(game); bid = structuredClone(step); bidAt = actions.length;
    }
    act(step.actor, step.action);
  }
  assert.ok(beforeBid && bid && bidAt >= 0, 'CHOAM really buys the original cache Semuta for one spice');
  const acquired = structuredClone(game), acquisition = { before: beforeBid, bid,
    steps: structuredClone(actions.slice(bidAt)), after: acquired, price: 1 };
  assert.equal(semutaAdvisorPreparationPlayer(beforeBid, holder).spice - semutaAdvisorPreparationPlayer(game, holder).spice, 1);
  assert.equal(semutaAdvisorPreparationPlayer(game, richese).spice - semutaAdvisorPreparationPlayer(beforeBid, richese).spice, 1);
  reach(state => state.turn === 1 && state.phase === 3 && semutaAdvisorPreparationClean(state) && !!state.auction);
  assert.equal(game.advisorPreparation?.firstShipment, null);
  assert.deepEqual(game.advisorPreparation?.deniedTerritories, []);
  assert.ok(game.players.every(player => !player.shipped && player.moved === 0));
  const beforeDeclaration = structuredClone(game), nativeAction: Action = { type: 'prepareAdvisors', territory: 'arrakeen' };
  const preparation = quoteAdvisorPreparation(game, owner, 'arrakeen'), start = actions.length;
  act(owner, nativeAction);
  const source = structuredClone(game), declaration = { before: beforeDeclaration,
    action: nativeAction, steps: structuredClone(actions.slice(start)), after: source };
  assert.equal(game.response?.kind, 'advisorFlip'); assert.equal(game.response?.owner, owner);
  assert.equal(game.response?.advisorResume, 'preparation');
  assert.deepEqual(game.response?.advisorPreparationSource, preparation);
  assert.equal(game.response?.advisors, false); assert.equal(game.response?.location, 'arrakeen');
  assert.equal(isAdvisor(semutaAdvisorPreparationPlayer(game, owner), 'arrakeen'), true);
  assert.equal(game.pendingTreacheryDiscard ?? null, null); assert.equal(game.phaseOpening ?? null, null);
  assert.equal(game.decision ?? null, null); assert.equal(game.pendingKarama ?? null, null);
  assert.ok(semutaAdvisorPreparationPlayer(game, holder).hand.some(card => card.id === SEMUTA_DRUG_ID));
  assert.ok(semutaAdvisorPreparationPlayer(game, spender).hand.some(card => card.id === cost));
  assert.deepEqual(semutaAdvisorPreparationInventory(game), originalInventory);
  const action: Action = { type: 'card', card: cost, mode: 'cancel' };
  return { game, source, beforeCost: source, advanced: true as const, kind: 'advisorFlip' as const,
    richese, holder, owner, bg: owner, atreides, spender, cost, semuta: SEMUTA_DRUG_ID, action, nativeAction,
    originalResponse: structuredClone(game.response!), preparation,
    originalPreparation: structuredClone(game.advisorPreparation!), originalHistory: structuredClone(game.log),
    territory: 'arrakeen', sector: 10, location: 'arrakeen:10',
    initial, lobby, setup, initialization, beforeStartingDeal, afterSetup, dealOrder, spiceOrder, originalSpice,
    beforeDeclaration, declaration, acquired, acquisition, originalInventory,
    actions, sourceActions: actions, sourceActionCount: actions.length,
    staging: [
      'Original Advanced Semuta initializer on a ready, undealt Richese/CHOAM/BG/Atreides/Emperor lobby, with only CHOAM expansion and no optional modules.',
      'Select original unopened main-card positions so Emperor is dealt its actual printed Karama, and original unopened ordinary first-Spice positions. Physical inventory is unchanged.',
      'Actually predict, choose private Traitors, and place the native Advanced starting BG advisor in Arrakeen10 alongside the original Atreides10. First Storm, both Spice blows and all Charity/auction controls are real actions.',
      'CHOAM actually buys original cache Semuta for one spice. After its original responses reach a clean normal auction, BG declares whole-territory preparation before any shipment. No played hand, force, stance, wallet, clock or pending control is installed.',
      'Stop at the live native advisorFlip preparation response before the Emperor spends its original printed Karama; finish helpers leave the interrupted auction untouched.',
    ],
  };
}
export type SemutaAdvisorPreparationFixture = ReturnType<typeof createSemutaAdvisorPreparationFixture>;
