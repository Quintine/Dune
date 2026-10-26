import assert from 'node:assert/strict';
import {
  applyAction, createGame, handLimit, initializeSemutaGameForAudit, joinGame, newPlayer,
  viewGame, type Action, type Game, type Player,
} from '../game/engine';
import { TERRITORIES } from '../game/board';
import { botEntryAllowed, botGroundMoveAllowed, groundMoveRouteDistance } from '../game/bot-mobility';
import { reserveShipmentCost } from '../game/shipment-price';
import { SEMUTA_DRUG_ID } from '../game/semuta-drug';
import type { Card } from '../game/cards';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import { nextRicheseSkillsTechNativeStep, type RicheseSkillsTechStep } from './fixture-richese-skills-tech';

export type BankerOverlayKind = 'bank' | 'below' | 'player';
export type BankerOverlaySemuta = 'claim' | 'pass';
export type BankerOverlayOptions = {
  /** Basic by default; Advanced adds the Guild's own native shipment stop. */
  advanced?: boolean;
  /** Optional original Tech Tokens in the same ordinary Skills setup. */
  tech?: boolean;
  /** Optional original Advanced Stronghold Cards. */
  strongholds?: boolean;
  /** Which real native shipment actually funds the Bank. */
  kind?: BankerOverlayKind;
  /** Conserved normal reserve forces; the printed desert price follows the payer's rate. */
  amount?: number;
  /** Conserved printed Semuta reaction at the real Hajr discard. */
  semuta?: BankerOverlaySemuta;
};
export type BankerOverlayPlan = {
  /** Basic plays at own movement; Advanced first completes an actual movement. */
  hajr?: boolean;
  /** Seat committing its own printed Semuta Drug at that fresh discard; null passes. */
  claim?: string | null;
};
export type BankerOverlayFixture = {
  /** Real phase 5 position: the payer is active and has not shipped yet. */
  game: Game;
  /** Fresh ready lobby before the ordinary Semuta Skills initializer. */
  initial: Game;
  /** Immediately after that initializer: ledger stamped, overlays undealt. */
  setup: Game;
  /** Same position as `game`, before any conserved printed-card staging. */
  beforePayment: Game;
  actions: RicheseSkillsTechStep[];
  staging: string[];
  owner: string;
  trainer: string;
  payer: string;
  payerFaction: Player['faction'];
  holder: string;
  semuta: string;
  hajr: string;
  territory: string;
  sector: number;
  key: string;
  amount: number;
  cost: number;
  /** Actual printed recipient of the real shipment price. */
  payee: 'bank' | 'guild';
  /** Printed entitlement of this exact payment. */
  grant: boolean;
  kind: BankerOverlayKind;
  advanced: boolean;
  tech: boolean;
  strongholds: boolean;
  shipment: Action;
  /** Original Advanced Guild stop, acknowledged before any payment. */
  allow: RicheseSkillsTechStep | null;
  plan: BankerOverlayPlan;
};

export function bankerOverlayPlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, `Missing original ${id} seat`);
  return player;
}
/** No pending opening, response, decision or committed fresh discard. */
export const bankerOverlayClean = (game: Game): boolean =>
  !game.phaseOpening && !game.response && !game.decision && !game.pendingTreacheryDiscard;
/** One physical slot per original Treachery identity, including the Richese cache. */
export function bankerOverlayInventory(game: Game): string[] {
  const ids = [...game.deck, ...game.discard, ...(game.richeseCache ?? []),
    ...(game.richeseRemoved ?? []), ...(game.auction?.cards.slice(game.auction.index) ?? []),
    ...game.players.flatMap(player => player.hand)].map(card => card.id).sort();
  assert.equal(new Set(ids).size, ids.length, 'One physical slot per original Treachery identity');
  return ids;
}
/** Wallets, counters, clocks, flags and skill custody; original hands excluded. */
export function bankerOverlayPosition(game: Game) {
  return structuredClone({
    status: game.status, turn: game.turn, phase: game.phase, active: game.active,
    order: game.order, ready: game.ready, movementRemaining: game.movementRemaining,
    storm: game.storm, hajr: game.hajr, pendingShipment: game.pendingShipment,
    karamaShipping: game.karamaShipping, guildRateBlocked: game.guildRateBlocked,
    response: game.response, decision: game.decision, leaderSkills: game.leaderSkills,
    players: game.players.map(player => ({
      id: player.id, faction: player.faction, ally: player.ally, spice: player.spice,
      bribes: player.bribes, forces: player.forces, reserves: player.reserves, tanks: player.tanks,
      elites: player.elites, leaders: player.leaders, shipped: player.shipped, moved: player.moved,
      revived: player.revived, traitors: player.traitors,
    })),
  });
}
export function bankerOverlayWallets(game: Game) {
  return game.players.map(player => ({
    id: player.id, faction: player.faction, spice: player.spice, bribes: player.bribes,
    reserves: player.reserves, tanks: player.tanks, shipped: player.shipped, moved: player.moved,
    hand: player.hand.map(card => card.id),
  }));
}
/** Own-view ledger projection plus the committed history, for exact comparisons. */
export function bankerOverlayLedger(game: Game, owner: string) {
  const projection = viewGame(game, owner).spiceBankerIncome;
  assert.ok(projection, `The ordinary Skills overlay must keep ${owner}'s Spice Banker income projection.`);
  return {
    preview: game.spiceBankerIncomePreview === true,
    state: structuredClone(game.spiceBankerIncome ?? null),
    deferred: projection.deferred,
    usedThisPhase: projection.usedThisPhase,
  };
}
export function bankerOverlayDeferred(game: Game, owner: string): number {
  return bankerOverlayLedger(game, owner).deferred.find(row => row.owner === owner)?.amount ?? 0;
}

/** Existing ordinary native policy plus the two genuine overlay continuations:
 * the original Advanced Guild timing choice and the printed Semuta reaction. */
export function nextBankerOverlayNativeStep(
  game: Game, plan: BankerOverlayPlan = {},
): RicheseSkillsTechStep {
  const pending = game.pendingTreacheryDiscard, reaction = pending?.reaction;
  if (pending && reaction?.stage === 'offer') {
    const event = pending.batch.event;
    const claim = plan.claim ?? null;
    if (claim && !reaction.passed.includes(claim)) {
      const own = viewGame(game, claim).semutaReaction;
      if (own?.stage === 'offer' && own.canCommit) return { actor: claim, action: { type: 'semutaCommit', event } };
    }
    const actor = game.players.find(player => !reaction.passed.includes(player.id));
    assert.ok(actor, 'The neutral Semuta offer must keep one original waiting seat.');
    return { actor: actor.id, action: { type: 'semutaPass', event } };
  }
  if (pending && reaction?.stage === 'select') {
    const card = reaction.candidates[0];
    assert.ok(card, 'A committed Semuta claim must keep one private fresh candidate.');
    return { actor: reaction.player, action: { type: 'semutaSelect', event: pending.batch.event, card } };
  }
  // Conserved own movement: the Guild may take the current combined turn; the
  // ordinary order then resumes with the same physical queue.
  if (!game.response && !game.phaseOpening && game.decision?.kind === 'guildTiming')
    return { actor: game.decision.player, action: { type: 'decision', take: true } };
  if (plan.hajr && game.status === 'playing' && game.phase === 5 && bankerOverlayClean(game)) {
    const holder = game.players.find(player => player.id === 'a' && player.id === game.active &&
      !game.hajr.includes(player.id) && player.hand.some(card => card.effect === 'hajr'));
    if (holder) {
      if (game.advanced && (holder.hajrWindow?.turn !== game.turn || holder.hajrWindow.move !== holder.moved)) {
        assert.equal(holder.moved, 0,
          'Earn the original immediate Hajr opportunity with the still-unused first Force Movement.');
        const own = viewGame(game, holder.id), seat = own.players.find(player => player.id === holder.id)!;
        const movement = Object.entries(holder.forces).filter(([key, count]) => count > (holder.elites?.forces[key] ?? 0))
          .flatMap(([from]) => TERRITORIES.filter(destination => destination.type === 'sand' &&
            !game.players.some(player => Object.keys(player.forces).some(key => key.startsWith(`${destination.id}:`))) &&
            !Object.keys(game.spice).some(key => key.startsWith(`${destination.id}:`) && game.spice[key] > 0))
            .flatMap(destination => destination.sectors.map(sector => ({ from, territory: destination.id, sector }))))
          .find(move => groundMoveRouteDistance(own, seat, move.from, `${move.territory}:${move.sector}`) === 1 &&
            botGroundMoveAllowed(own, seat, move.from, `${move.territory}:${move.sector}`, 0));
        assert.ok(movement, 'The original Atreides army must have a clear adjacent empty sand destination.');
        return { actor: holder.id, action: { type: 'move', ...movement, amount: 1, elite: 0 } };
      }
      const card = holder.hand.find(candidate => candidate.effect === 'hajr')!;
      return { actor: holder.id, action: { type: 'card', card: card.id } };
    }
  }
  return nextRicheseSkillsTechNativeStep(game);
}
function step(game: Game, plan: BankerOverlayPlan, actions?: RicheseSkillsTechStep[]): Game {
  const next = nextBankerOverlayNativeStep(game, plan);
  actions?.push(next);
  return applyAction(game, next.actor, next.action);
}
/** Apply only original native actions until the requested boundary holds. */
export function advanceBankerOverlay(
  state: Game, until: (game: Game) => boolean, plan: BankerOverlayPlan = {},
  actions?: RicheseSkillsTechStep[],
): Game {
  let game = state;
  for (let n = 0; !until(game) && n < 1500; n++) {
    assert.notEqual(game.status, 'finished', 'The genuine native path must reach its requested boundary');
    game = step(game, plan, actions);
  }
  assert.ok(until(game), 'The genuine native path must reach its requested boundary');
  return game;
}
export function advanceBankerOverlayToPhase(
  state: Game, phase: number, plan: BankerOverlayPlan = {}, actions?: RicheseSkillsTechStep[],
): Game {
  let game = state;
  const turn = state.turn;
  for (let n = 0; (game.phase !== phase || !bankerOverlayClean(game)) &&
    game.turn === turn && game.status === 'playing' && n < 1500; n++) game = step(game, plan, actions);
  assert.equal(game.turn, turn);
  assert.equal(game.phase, phase);
  assert.ok(bankerOverlayClean(game));
  return game;
}
/** Stop at the real native Mentat Pause entry; its own opening has already collected. */
export function advanceBankerOverlayToMentat(
  state: Game, plan: BankerOverlayPlan = {}, actions?: RicheseSkillsTechStep[],
): Game {
  let game = state;
  const turn = state.turn;
  for (let n = 0; (game.phase !== 8 || game.phaseOpening) &&
    game.turn === turn && game.status === 'playing' && n < 1500; n++) game = step(game, plan, actions);
  assert.equal(game.turn, turn);
  assert.equal(game.phase, 8);
  return game;
}

/** Fix the initial all14 offer and native setup scalar entropy; leave UUIDs native.
 * The printed Spice Banker lands in the first seat's own two-card offer. */
export function withBankerOverlaySkillOffer<T>(initialize: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const original = crypto.getRandomValues.bind(crypto);
  const target = LEADER_SKILL_CARDS.findIndex(card => card.id === 'spice-banker');
  assert.ok(target >= 0, 'The original all14 deck must keep the Spice Banker card.');
  let index = LEADER_SKILL_CARDS.length - 1;
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (!(array instanceof Uint32Array)) return Reflect.apply(original, crypto, [array]) as V;
    array.fill(0xffffffff);
    if (index > 0) {
      assert.equal(array.length, 1, 'The initial all14 shuffle uses single scalar draws.');
      array[0] = index === target ? 0 : 0xffffffff;
      index--;
    }
    return array;
  };
  try { return initialize(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
/** Conserve one canonical printed card into its owner's hand from the first
 * original slot already holding it; never mint a second identity. */
function takePrintedCard(
  game: Game, actor: string, matches: (card: Card) => boolean, staging: string[],
): string {
  const holder = bankerOverlayPlayer(game, actor);
  const held = holder.hand.find(matches);
  if (held) return held.id;
  assert.ok(holder.hand.length < handLimit(holder),
    'The conserved hand must keep room for its own printed overlay card.');
  const zones: [Card[], string][] = [
    [game.deck, 'undealt Treachery deck'],
    [game.discard, 'discard pile'],
    [game.richeseCache ?? [], 'Richese cache'],
  ];
  for (const [zone, name] of zones) {
    const index = zone.findIndex(matches);
    if (index < 0) continue;
    const card = zone.splice(index, 1)[0];
    holder.hand.push(card);
    staging.push(`Conserved canonical ${card.id} from the ${name} into ${actor}'s hand.`);
    return card.id;
  }
  const donor = game.players.find(player => player.id !== actor && player.hand.some(matches));
  assert.ok(donor, 'The requested printed overlay card must keep one original custody slot.');
  const index = donor.hand.findIndex(matches);
  const card = donor.hand.splice(index, 1)[0];
  holder.hand.push(card);
  staging.push(`Conserved canonical ${card.id} from ${donor.id}'s original dealt hand into ${actor}'s hand.`);
  return card.id;
}

/** Genuine Basic/Advanced Semuta + Skills setup, first turn and the payer's own
 * Movement turn. Initial setup scalar entropy, the first two unplayed Spice Cards
 * and two conserved printed overlay cards are controlled and explicitly disclosed.
 * Wallets, counters, clocks, turns, phases, skills, receipts and assignments stay native. */
export function createBankerOverlayFixture(options: BankerOverlayOptions = {}): BankerOverlayFixture {
  const kind = options.kind ?? 'bank';
  const advanced = options.advanced ?? false;
  const tech = options.tech ?? false;
  const strongholds = options.strongholds ?? false;
  const semuta = options.semuta ?? 'claim';
  const payee = kind === 'player' ? 'guild' as const : 'bank' as const;
  assert.ok(advanced || !strongholds, 'Original Stronghold Cards require Advanced rules.');
  let game = createGame('BANKEROVERLAY', newPlayer('r', 'Richese', 'richese'), advanced, ['choam']);
  joinGame(game, newPlayer('g', 'Guild', 'guild'));
  joinGame(game, newPlayer('a', 'Atreides', 'atreides'));
  if (tech) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  if (strongholds) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  for (const player of game.players) game = applyAction(game, player.id, { type: 'ready' });
  const initial = structuredClone(game);
  // The ordinary Semuta Skills delegate stamps the mandatory income ledger first,
  // then sets its own original overlay flag.
  game = withBankerOverlaySkillOffer(() => initializeSemutaGameForAudit(game, true));
  assert.equal(game.semutaPreview, true, 'The original Semuta overlay flag must remain set.');
  assert.equal(game.spiceBankerIncomePreview, true,
    'Ordinary Leader Skills setup must stamp the income ledger before the overlay flag.');
  assert.ok(game.spiceBankerIncome, 'The fresh ordinary setup must commit one income ledger.');
  assert.ok(viewGame(game, 'r').spiceBankerIncome, 'Each own seat must project that ledger.');
  assert.ok(game.leaderSkills?.offers['r']?.cards.includes('spice-banker'),
    'The controlled original all14 shuffle must offer the Spice Banker to the first seat.');
  const setup = structuredClone(game);
  const actions: RicheseSkillsTechStep[] = [], staging: string[] = [];
  staging.push('Initial all14 offers and native setup scalar entropy are controlled; UUIDs remain native. Components are not replaced.');
  const plan: BankerOverlayPlan = { hajr: false, claim: null };
  for (let n = 0; game.status === 'setup' && n < 250; n++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor];
      const own = viewGame(game, actor).leaderSkills!;
      const skill = offer.cards.includes('spice-banker') ? 'spice-banker'
        : offer.cards.find(card => !own.unavailableSkills?.[card]);
      assert.ok(skill && offer.cards.includes(skill) && !own.unavailableSkills?.[skill],
        'The actual original offer must supply one legal skill.');
      const eligible = new Set(own.eligibleLeaders.map(leader => leader.id));
      const leader = bankerOverlayPlayer(game, actor).leaders.filter(disc => eligible.has(disc.id))
        .sort((a, b) => b.strength - a.strength)[0];
      assert.ok(leader, 'The actual original living eligible disc must supply training.');
      const action: Action = { type: 'leaderSkill', event: offer.event, skill, leader: leader.id };
      actions.push({ actor, action });
      game = applyAction(game, actor, action);
    } else game = step(game, plan, actions);
  }
  assert.equal(game.status, 'playing');
  const assignment = game.leaderSkills!.assignments.find(entry => entry.skill === 'spice-banker');
  assert.ok(assignment, 'The ordinary native setup must assign the real Spice Banker skill.');
  const owner = assignment.owner;
  assert.equal(owner, 'r', 'The real Spice Banker must be trained by the first offered Richese seat.');
  assert.equal(bankerOverlayPlayer(game, owner).leaders.find(leader => leader.id === assignment.leader)!.dead, false,
    'The actual Banker trainer must still be alive.');
  // Prevent an incidental first-turn worm by conserving the first two unplayed blows.
  for (const position of [0, 1]) {
    const index = game.spiceDeck.findIndex((card, i) => i >= position && 'territory' in card);
    assert.ok(index >= position, 'One original unplayed Spice Card must remain');
    game.spiceDeck.splice(position, 0, game.spiceDeck.splice(index, 1)[0]);
  }
  staging.push('Conserved only the first two original unplayed Spice Cards as ordinary land blows.');
  const payer = kind === 'player' ? 'a' : 'g';
  const amount = options.amount ?? (kind === 'below' ? 3 : kind === 'player' ? 2 : 4);
  game = advanceBankerOverlay(game, candidate => candidate.phase === 5 && candidate.turn === 1 &&
    bankerOverlayClean(candidate) && candidate.active === payer &&
    !bankerOverlayPlayer(candidate, payer).shipped, plan, actions);
  const seat = bankerOverlayPlayer(game, payer);
  const halfRate = seat.faction === 'guild';
  const own = viewGame(game, payer);
  // Empty ordinary sand isolates this paid shipment from battle and arrival parents;
  // the real consumer entry helpers still choose the exact legal action.
  const destination = TERRITORIES.find(t => t.type === 'sand' && !t.sectors.includes(game.storm) &&
    !game.players.some(player => Object.keys(player.forces).some(key => key.startsWith(`${t.id}:`))) &&
    botEntryAllowed(own, own.players.find(player => player.id === payer)!, t.id, t.sectors[0], 'ship'));
  assert.ok(destination, 'One original legal empty sand destination must remain');
  const sector = destination.sectors[0];
  const cost = reserveShipmentCost({ faction: seat.faction, halfRate }, destination.type, amount);
  assert.equal(cost, halfRate ? amount : amount * 2,
    'The printed shipment price must follow the payer’s own ordinary rate.');
  assert.ok(seat.reserves >= amount, 'The payer must hold that many ordinary reserves.');
  assert.ok((seat.spice ?? 0) >= cost, 'The payer must hold the printed shipment price.');
  const shipment: Action = { type: 'ship', territory: destination.id, sector, amount, elite: 0, allyPayment: 0 };
  const beforePayment = structuredClone(game);
  // The two conserved printed overlay cards: Richese's own Semuta and the printed Hajr.
  const semutaId = takePrintedCard(game, owner, card => card.id === SEMUTA_DRUG_ID, staging);
  const hajrId = takePrintedCard(game, 'a', card => card.effect === 'hajr', staging);
  assert.deepEqual(bankerOverlayPosition(game), bankerOverlayPosition(beforePayment),
    'Conserved printed-card staging must not move wallets, counters, clocks or skills.');
  assert.deepEqual(bankerOverlayInventory(game), bankerOverlayInventory(beforePayment),
    'Conserved printed-card staging must not duplicate or replace a physical identity.');
  return {
    game, initial, setup, beforePayment, actions, staging,
    owner, trainer: assignment.leader, payer, payerFaction: seat.faction, holder: 'a',
    semuta: semutaId, hajr: hajrId, territory: destination.id, sector,
    key: `${destination.id}:${sector}`, amount, cost, payee, grant: payee === 'bank' && cost >= 4,
    kind, advanced, tech, strongholds, shipment,
    allow: advanced ? { actor: 'g', action: { type: 'decision', allow: true } } : null,
    plan: { hajr: true, claim: semuta === 'claim' ? owner : null },
  };
}

/** Apply the payer's own real declaration, its original Advanced Guild stop and
 * any ordinary suffix. No receipt, leg or authority is ever supplied here. */
export function shipBankerOverlayIncome(fixture: BankerOverlayFixture): Game {
  let game = applyAction(fixture.game, fixture.payer, fixture.shipment);
  if (fixture.allow) {
    assert.equal(game.decision?.kind, 'guildShipment',
      'Advanced Shipment and Movement must open the original Guild stop first.');
    assert.equal(game.decision?.player, fixture.allow.actor);
    assert.equal(game.pendingShipment?.player, fixture.payer);
    game = applyAction(game, fixture.allow.actor, fixture.allow.action);
  }
  return advanceBankerOverlay(game, bankerOverlayClean, { hajr: false, claim: null });
}

/** Reach the holder's own movement turn, complete the first real movement in
 * Advanced, then play Hajr immediately after its original arrival finishes.
 * Basic retains its original timing. No immediate-use window is installed. */
export function openBankerOverlayHajr(state: Game, fixture: BankerOverlayFixture,
  actions?: RicheseSkillsTechStep[]): Game {
  const game = advanceBankerOverlay(state, candidate => !!candidate.pendingTreacheryDiscard,
    { hajr: true, claim: null }, actions);
  const pending = game.pendingTreacheryDiscard;
  assert.ok(pending, 'The conserved printed Hajr must produce one real fresh discard.');
  assert.equal(pending.continuation.kind, 'ordinaryCardDiscard');
  assert.equal(pending.batch.cause, 'ordinary:hajr');
  assert.equal(pending.batch.turn, game.turn);
  assert.equal(pending.batch.phase, 5);
  assert.deepEqual(pending.batch.entries.map(entry =>
    ({ id: entry.card.id, actor: entry.discardedBy, publicFace: entry.publicFace })),
  [{ id: fixture.hajr, actor: fixture.holder, publicFace: true }]);
  assert.equal(pending.reaction?.stage, 'offer',
    'The original Semuta overlay must offer its neutral reaction before the printed continuation resumes.');
  assert.ok(!bankerOverlayPlayer(game, fixture.holder).hand.some(card => card.id === fixture.hajr));
  assert.equal(game.discard.filter(card => card.id === fixture.hajr).length, 1);
  assert.deepEqual(game.hajr, [fixture.holder]);
  return game;
}

/** Commit the owner's own printed Semuta at the open offer. The single freshly
 * discarded card resolves the private selection atomically and resumes the
 * original ordinary-card continuation without touching Banker income. */
export function claimBankerOverlaySemuta(state: Game, fixture: BankerOverlayFixture): Game {
  const pending = state.pendingTreacheryDiscard;
  assert.equal(pending?.reaction?.stage, 'offer', 'The printed Semuta offer must still be open.');
  const own = viewGame(state, fixture.owner).semutaReaction;
  assert.ok(own?.stage === 'offer' && own.canCommit, own?.blocked ?? 'The printed Semuta claim must be legally available.');
  const inventory = bankerOverlayInventory(state), position = bankerOverlayPosition(state);
  const ledger = bankerOverlayLedger(state, fixture.owner);
  const game = applyAction(state, fixture.owner, { type: 'semutaCommit', event: pending!.batch.event });
  assert.equal(game.pendingTreacheryDiscard, null,
    'One fresh card resolves the private Semuta claim atomically.');
  assert.equal(game.discard.filter(card => card.id === fixture.semuta).length, 1,
    'The spent Semuta Drug must be discarded exactly once.');
  assert.equal(bankerOverlayPlayer(game, fixture.owner).hand.filter(card => card.id === fixture.hajr).length, 1,
    'The claimed fresh card must stay privately with its claimant.');
  assert.deepEqual(bankerOverlayInventory(game), inventory);
  assert.deepEqual(bankerOverlayPosition(game), position,
    'The overlay continuation must not move wallets, counters, clocks or skills.');
  assert.deepEqual(bankerOverlayLedger(game, fixture.owner), ledger,
    'The overlay continuation must not add, move or duplicate Banker income.');
  return game;
}
/** Decline the printed offer at every remaining seat and resume the same
 * original continuation; no claim, income or refund is invented. */
export function passBankerOverlaySemuta(state: Game, fixture: BankerOverlayFixture): Game {
  const inventory = bankerOverlayInventory(state);
  const game = advanceBankerOverlay(state, candidate => !candidate.pendingTreacheryDiscard, fixture.plan);
  assert.equal(game.discard.filter(card => card.id === fixture.semuta).length, 0);
  assert.equal(bankerOverlayPlayer(game, fixture.owner).hand.filter(card => card.id === fixture.semuta).length, 1);
  assert.equal(game.discard.filter(card => card.id === fixture.hajr).length, 1);
  assert.deepEqual(bankerOverlayInventory(game), inventory);
  assert.deepEqual(game.spiceBankerIncome, state.spiceBankerIncome,
    'Declining the neutral overlay must not create Banker income.');
  return game;
}
