import assert from 'node:assert/strict';
import { applyAction, createGame, handLimit, joinGame, newPlayer, viewGame, type Action, type Game, type Player } from '../game/engine';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, territory } from '../game/board';
import { isAuditorLeader, type Card } from '../game/cards';
import type { FactionId } from '../game/catalog';
import { validateLeaderSkills } from '../game/leader-skills';
import { strongholdControllers, type StrongholdId } from '../game/stronghold-cards';
import { initializeAdvancedNativeSkillsSetup, type AdvancedNativeSkillsOptions } from './fixture-advanced-native-skills';
import { nextStrongholdFactionsNativeStep, quoteStrongholdFactionsBattle, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';
import { nextRicheseStrongholdsNativeStep } from './fixture-richese-strongholds';

export type NativeSkillsStrongholdCase = 'ix-copy-suk' | 'choam-support' | 'choam-auditor' |
  'tleilaxu-tabr' | 'tleilaxu-tuek' | 'richese-marker' | 'richese-stone';
export type NativeSkillsStrongholdOptions = {
  /** A fresh authenticated Advanced lobby; retain IDs, order and selected native decks. */
  initial?: Game;
  kind?: NativeSkillsStrongholdCase;
  optionalTech?: boolean;
};
export type NativeSkillsStrongholdFixture = {
  initial: Game;
  offered: Game;
  afterSetup: Game;
  beforeFirstMentat: Game;
  firstMentatStep: StrongholdFactionsNativeStep;
  afterFirstMentat: Game;
  beforeBattle: Game;
  game: Game;
  kind: NativeSkillsStrongholdCase;
  owner: string;
  opponent: string;
  choam?: string;
  tleilaxu?: string;
  trainer: string;
  territory: StrongholdId;
  location: string;
  boardSource: string;
  copyAction: Action | null;
  plans: StrongholdFactionsNativeStep[];
  acquisition: { before: Game; after: Game; steps: StrongholdFactionsNativeStep[] } | null;
  shipment: { before: Game; after: Game; step: StrongholdFactionsNativeStep } | null;
  actions: StrongholdFactionsNativeStep[];
  staging: string[];
};

export function nativeSkillsStrongholdPlayer(game: Game, id: string): Player {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, `Missing original native seat ${id}`);
  return player;
}
export function assertNativeSkillsStrongholdCustody(game: Game): void {
  validateLeaderSkills(game.leaderSkills!, game.players);
  for (const p of game.players) {
    assert.equal(p.reserves + p.tanks + Object.values(p.forces).reduce((a, b) => a + b, 0), 20, p.faction);
    if (p.elites) {
      const inventory = p.faction === 'ixians' ? 7 : p.faction === 'fremen' ? 3 : 5;
      assert.equal(p.elites.reserves + p.elites.tanks + Object.values(p.elites.forces).reduce((a, b) => a + b, 0), inventory, p.faction);
      for (const [key, count] of Object.entries(p.elites.forces)) assert.ok(count <= (p.forces[key] ?? 0));
    }
  }
  const cards = [...game.deck, ...game.discard, ...game.players.flatMap(p => p.hand),
    ...(game.richeseCache ?? []), ...(game.richeseRemoved ?? [])];
  assert.equal(new Set(cards.map(c => c.id)).size, cards.length, 'Canonical treachery/cache cards retain single physical custody');
}
const clean = (g: Game) => !g.phaseOpening && !g.response && !g.decision;
const key = (id: StrongholdId) => id === MOBILE_STRONGHOLD ? MOBILE_LOCATION : `${id}:${territory(id).sectors[0]}`;

/** Existing native policies, with deliberate no-call/no-spend skill choices.
 * Stop before human plans and HMS declarations; never fabricate a window. */
export function nextNativeSkillsStrongholdStep(game: Game): StrongholdFactionsNativeStep | null {
  if (game.decision?.kind === 'richeseCache') {
    const card = game.richeseCache!.find(c => c.id !== 'richese-stone-burner'); assert.ok(card);
    return { actor: game.decision.player, action: { type: 'decision', event: game.richeseBidding!.event,
      card: card.id, method: 'onceAround', direction: 'counterclockwise' } };
  }
  if (game.decision?.kind === 'richeseUnbid') return { actor: game.decision.player,
    action: { type: 'decision', event: game.richeseBidding!.event, keep: false } };
  if (game.decision?.kind === 'leaderSkillVisibility') return { actor: game.decision.player,
    action: { type: 'leaderSkillVisibility', event: game.decision.event, hide: true } };
  if (game.decision?.kind === 'mentatQuestion') return { actor: game.decision.player,
    action: { type: 'decision', event: game.decision.event, decline: true } };
  if (game.decision?.kind === 'rihani') return { actor: game.decision.player,
    action: { type: 'decision', event: game.decision.event, draw: false } };
  if (game.decision?.kind === 'battleLosses') {
    const decision = game.decision;
    const elite = Math.max(...decision.options.map(option => option.elite));
    return { actor: decision.player, action: { type: 'decision',
      choice: decision.options.findIndex(option => option.elite === elite) } };
  }
  if (game.decision?.kind === 'sukRescue') {
    const decision = game.decision;
    const maximum = Math.max(...decision.options.map(o => o.normal + o.elite));
    const choice = decision.options.findIndex(o => o.normal + o.elite === maximum && o.kept?.kind === 'normal');
    return { actor: decision.player, action: { type: 'decision', event: decision.event,
      choice: choice >= 0 ? choice : decision.options.findIndex(o => o.normal + o.elite === maximum) } };
  }
  if (game.decision?.kind === 'techToken') return { actor: game.decision.player,
    action: { type: 'decision', token: game.decision.choices[0] } };
  if (game.decision?.kind === 'strongholdCopy' || game.decision?.kind === 'faceDance') return null;
  return game.players.some(p => p.faction === 'richese')
    ? nextRicheseStrongholdsNativeStep(game) : nextStrongholdFactionsNativeStep(game);
}
/** Scope the original initializer remainder and later native shuffles alike. */
function nativeScalarEntropy<T>(run: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = <V extends ArrayBufferView | null>(array: V): V => {
    if (array instanceof Uint32Array) array.fill(0xffffffff);
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  try { return run(); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
}
function act(game: Game, next: StrongholdFactionsNativeStep, actions?: StrongholdFactionsNativeStep[]): Game {
  actions?.push(structuredClone(next));
  return nativeScalarEntropy(() => applyAction(game, next.actor, next.action));
}
export function advanceNativeSkillsStronghold(state: Game, until: (g: Game) => boolean,
  actions?: StrongholdFactionsNativeStep[], firstDial = 0): Game {
  let game = state;
  for (let i = 0; i < 1800; i++) {
    if (until(game)) return game;
    assert.equal(game.status, 'playing');
    const next = nextNativeSkillsStrongholdStep(game);
    assert.ok(next, `Real human choice required at ${game.decision?.kind ?? 'battle plans'}`);
    if (game.turn === 1 && next.action.type === 'stormDial') next.action.amount = firstDial;
    game = act(game, next, actions);
  }
  throw Error('Native Skills/Stronghold continuation did not reach its requested boundary');
}
function reserveBoard(game: Game): void {
  for (const p of game.players) {
    p.reserves += Object.values(p.forces).reduce((a, b) => a + b, 0); p.forces = {};
    if (p.elites) {
      p.elites.reserves += Object.values(p.elites.forces).reduce((a, b) => a + b, 0); p.elites.forces = {};
    }
    if (p.advisors) p.advisors = {};
  }
}
function place(game: Game, actor: string, location: string, count: number, elite = 0): void {
  const p = nativeSkillsStrongholdPlayer(game, actor);
  assert.ok(p.reserves >= count && count >= elite && (p.elites?.reserves ?? 0) >= elite);
  p.reserves -= count; p.forces[location] = (p.forces[location] ?? 0) + count;
  if (elite) { p.elites!.reserves -= elite; p.elites!.forces[location] = (p.elites!.forces[location] ?? 0) + elite; }
}
function held(game: Game, actor: string, predicate: (c: Card) => boolean, staging: string[], excluded: string[] = []): string {
  const p = nativeSkillsStrongholdPlayer(game, actor);
  const owned = p.hand.find(c => predicate(c) && !excluded.includes(c.id));
  if (owned) return owned.id;
  const index = game.deck.findIndex(c => predicate(c) && !excluded.includes(c.id));
  assert.ok(index >= 0 && p.hand.length < handLimit(p), 'A canonical native card and real hand capacity are required');
  const card = game.deck.splice(index, 1)[0]; p.hand.push(card);
  staging.push(`Conserved ${card.id}: remaining native deck → ${actor}'s hand`);
  return card.id;
}
function untrained(game: Game, id: string, strongest = false): string {
  const p = nativeSkillsStrongholdPlayer(game, id);
  const trained = new Set(game.leaderSkills!.assignments.map(a => a.leader));
  const leader = p.leaders.filter(l => !l.dead && !isAuditorLeader(l) && !trained.has(l.id))
    .sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength)[0];
  assert.ok(leader); return leader.id;
}
/** Same conserved Traitor/Face Dancer exchange as the native Skills/Tech fixture.
 * Label this rule position explicitly; never claim it was the random draw. */
function matchingDancer(game: Game, actor: string, leader: string, staging: string[]): void {
  const dancer = nativeSkillsStrongholdPlayer(game, actor).faceDancers!.find(c => !c.revealed);
  assert.ok(dancer);
  if (nativeSkillsStrongholdPlayer(game, actor).faceDancers!.some(c => c.leader === leader && !c.revealed)) return;
  const index = game.traitorReserve!.indexOf(leader);
  if (index >= 0) game.traitorReserve![index] = dancer.leader;
  else {
    const donor = game.players.find(p => p.traitors.includes(leader));
    assert.ok(donor, 'Matching physical Traitor has a native custodian');
    donor.traitors[donor.traitors.indexOf(leader)] = dancer.leader;
  }
  staging.push(`Conserved matching Face Dancer ${leader}: native Traitor custody exchanged with ${dancer.leader}`);
  dancer.leader = leader;
}

/** Genuine Advanced native setup, first Storm (optional original Tech assignment),
 * and actual first END Mentat. Only initial physical skill offers, unplayed Spice
 * Card order and labeled conserved board/card positions are controlled. Wallets,
 * phases, turns, owners, quotes and earned receipts are never assigned. */
export function createNativeSkillsStrongholdFixture(options: NativeSkillsStrongholdOptions = {}): NativeSkillsStrongholdFixture {
  const kind = options.kind ?? 'ix-copy-suk';
  const ix = kind === 'ix-copy-suk';
  const tleilaxuCase = kind === 'tleilaxu-tabr' || kind === 'tleilaxu-tuek';
  const richese = kind === 'richese-marker' || kind === 'richese-stone';
  const family = ix ? 'ixians' : tleilaxuCase ? 'tleilaxu' : richese ? 'richese' : 'choam';
  const ownerFaction: FactionId = tleilaxuCase || kind === 'choam-support' ? 'guild' : family;
  const factions: FactionId[] = ix ? ['ixians', 'emperor', 'choam', 'fremen'] :
    tleilaxuCase ? ['guild', 'tleilaxu', 'emperor'] : richese ? ['richese', 'choam', 'guild'] :
      kind === 'choam-support' ? ['guild', 'choam', 'emperor'] : ['choam', 'guild', 'emperor'];
  const decks = ix ? ['ix', 'choam'] : [tleilaxuCase ? 'ix' : 'choam'];
  let game = options.initial ? structuredClone(options.initial)
    : createGame('NATIVESKILLSSTRONGHOLD', newPlayer(factions[0], factions[0], factions[0]), true, decks);
  if (!options.initial) for (const faction of factions.slice(1)) joinGame(game, newPlayer(faction, faction, faction));
  assert.equal(game.status, 'lobby', 'Continue only a fresh authenticated undealt lobby');
  assert.equal(game.advanced, true);
  assert.ok(game.players.length >= 2 && game.players.length <= 6);
  assert.ok(game.expansions.every(deck => deck === 'ix' || deck === 'choam'));
  const owner = game.players.find(p => p.faction === ownerFaction)?.id;
  const opponent = game.players.find(p => p.faction === (tleilaxuCase ? 'tleilaxu' : richese ? 'guild' :
    ix || kind === 'choam-support' ? 'emperor' : 'guild'))?.id;
  assert.ok(owner && opponent);
  const choam = game.players.find(p => p.faction === 'choam')?.id;
  const tleilaxu = game.players.find(p => p.faction === 'tleilaxu')?.id;
  if (!game.strongholdCards) game = applyAction(game, game.host, { type: 'strongholdCards', enabled: true });
  if (options.optionalTech && !game.techTokens) game = applyAction(game, game.host, { type: 'techTokens', enabled: true });
  if (game.techTokens) assert.ok(game.players.length >= 3);
  const initial = structuredClone(game), actions: StrongholdFactionsNativeStep[] = [],
    staging: string[] = ['Scoped original initializer and scalar action entropy keeps native source programs reproducible; UUID byte arrays remain native.'];
  const native: AdvancedNativeSkillsOptions = { family, skillOwner: ownerFaction, requestedSkill: 'suk-graduate', initial: game };
  game = nativeScalarEntropy(() => initializeAdvancedNativeSkillsSetup(native));
  const offered = structuredClone(game);
  for (let i = 0; game.status === 'setup' && i < 200; i++) {
    if (game.setupStage === 'leaderSkills') {
      const actor = Object.keys(game.leaderSkills!.offers)[0];
      const offer = game.leaderSkills!.offers[actor], view = viewGame(game, actor).leaderSkills!;
      const skill = actor === owner ? 'suk-graduate' : offer.cards.find(c => !view.unavailableSkills?.[c]);
      const eligible = new Set(view.eligibleLeaders.map(l => l.id));
      const leader = nativeSkillsStrongholdPlayer(game, actor).leaders.filter(l => eligible.has(l.id)).sort((a, b) => b.strength - a.strength)[0];
      assert.ok(skill && offer.cards.includes(skill) && leader);
      game = act(game, { actor, action: { type: 'leaderSkill', event: offer.event, skill, leader: leader.id } }, actions);
    } else {
      const next = nextNativeSkillsStrongholdStep(game); assert.ok(next); game = act(game, next, actions);
    }
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const trainer = game.leaderSkills!.assignments.find(a => a.owner === owner && a.skill === 'suk-graduate')!.leader;
  // Genuine non-worm cards stay in their native deck. No piles or phase receipts are injected.
  const blows = game.spiceDeck.filter(c => 'territory' in c).slice(0, 6);
  for (const [position, card] of blows.entries()) game.spiceDeck.splice(position, 0, game.spiceDeck.splice(game.spiceDeck.indexOf(card), 1)[0]);
  staging.push('Conserved first six unplayed non-worm Spice Cards moved to the front of the native Spice Deck; not a natural shuffle history.');
  const stronghold: StrongholdId = ix ? MOBILE_STRONGHOLD : kind === 'tleilaxu-tabr' ? 'sietch_tabr' :
    kind === 'tleilaxu-tuek' ? 'tueks_sietch' : kind === 'richese-stone' ? 'habbanya_ridge_sietch' : 'arrakeen';
  const location = key(stronghold), firstDial = kind === 'tleilaxu-tuek' || kind === 'richese-stone' ? 4 : 0;
  let acquisition: NativeSkillsStrongholdFixture['acquisition'] = null;
  if (kind === 'richese-stone') {
    game = advanceNativeSkillsStronghold(game, g => g.decision?.kind === 'richeseCache', actions, firstDial);
    const before = structuredClone(game), steps: StrongholdFactionsNativeStep[] = [];
    for (let i = 0; !nativeSkillsStrongholdPlayer(game, owner).hand.some(c => c.id === 'richese-stone-burner') && i < 100; i++) {
      const next = game.decision?.kind === 'richeseCache' ? { actor: owner, action: {
        type: 'decision' as const, event: game.richeseBidding!.event, card: 'richese-stone-burner',
        method: 'onceAround', direction: 'counterclockwise' } } :
        game.decision?.kind === 'richeseUnbid' ? { actor: owner, action: {
          type: 'decision' as const, event: game.richeseBidding!.event, keep: true } } : nextNativeSkillsStrongholdStep(game);
      assert.ok(next); game = act(game, next, steps);
    }
    assert.ok(nativeSkillsStrongholdPlayer(game, owner).hand.some(c => c.id === 'richese-stone-burner'));
    actions.push(...steps); acquisition = { before, after: structuredClone(game), steps };
  }
  let shipment: NativeSkillsStrongholdFixture['shipment'] = null;
  if (kind === 'richese-marker') {
    game = advanceNativeSkillsStronghold(game, g => g.phase === 5 && clean(g) && g.active === owner, actions, firstDial);
    reserveBoard(game);
    const p = nativeSkillsStrongholdPlayer(game, owner), token = p.noField!.tokens.find(t => t.value === 5)!;
    const before = structuredClone(game), step: StrongholdFactionsNativeStep = { actor: owner,
      action: { type: 'ship', territory: stronghold, sector: territory(stronghold).sectors[0], noField: token.id, event: p.noFieldEvent } };
    game = act(game, step, actions);
    game = advanceNativeSkillsStronghold(game, clean, actions, firstDial);
    shipment = { before, after: structuredClone(game), step };
    staging.push('Actual native No-Field five shipment: no marker is assigned or materialized by the fixture.');
  }
  game = advanceNativeSkillsStronghold(game, g => g.phase === 8 && clean(g), actions, firstDial);
  reserveBoard(game);
  if (kind !== 'richese-marker') place(game, owner, location, 1, ix ? 1 : 0);
  if (ix) place(game, owner, key('arrakeen'), 1);
  staging.push('Before actual first END Mentat: conserve original board counters through native reserves; owner controls only the requested Stronghold (Ix also Arrakeen), no three-hold victory.');
  let beforeFirstMentat: Game | undefined, firstMentatStep: StrongholdFactionsNativeStep | undefined;
  while (game.turn === 1) {
    const before = structuredClone(game), next = nextNativeSkillsStrongholdStep(game); assert.ok(next);
    game = act(game, next, actions);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = next; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  assert.equal(game.strongholdCards!.owners[stronghold], owner);
  const afterFirstMentat = structuredClone(game);
  game = advanceNativeSkillsStronghold(game, g => g.phase === 5 && clean(g), actions);
  reserveBoard(game);
  const boardSource = 'polar_sink:0';
  if (kind === 'richese-marker') {
    const p = nativeSkillsStrongholdPlayer(game, owner);
    assert.ok(p.noField!.deployed && p.reserves >= 3);
    place(game, owner, boardSource, p.reserves - 3);
    place(game, opponent, location, 6);
    staging.push('Conserved marker-only battle: Richese has exactly three reserves; every other surviving Richese physical counter is in Polar Sink, not alongside the concealed marker.');
  } else {
    for (const actor of [owner, opponent]) place(game, actor, location, 8, ix && actor === owner ? 2 : 0);
    if (ix) {
      place(game, owner, key('arrakeen'), 1);
      place(game, owner, key('sietch_tabr'), 1);
    }
    if (tleilaxuCase) {
      place(game, opponent, boardSource, 3);
      matchingDancer(game, opponent, trainer, staging);
    }
    staging.push('Before actual turn-two Movement completion: conserve eight battle counters per combatant (Ix six Suboids/two cyborgs); keep real first-Mentat card custody and all native wallets.');
    if (ix) staging.push('The second copy-control counter (Tabr) is staged only in real turn-two Movement, after the first genuine two-hold END Mentat claim. This three-hold battle position is controlled, not natural history; no later Ix Mentat continuation or victory is suppressed.');
  }
  let weapon: string | null = null, defense: string | null = null, enemyWeapon: string | null = null;
  if (tleilaxuCase || kind === 'choam-auditor') weapon = held(game, owner, c => c.kind === 'projectile', staging);
  if (tleilaxuCase) {
    defense = held(game, owner, c => c.kind === (kind === 'tleilaxu-tuek' ? 'worthless' : 'shield'), staging, weapon ? [weapon] : []);
    enemyWeapon = held(game, opponent, c => c.kind === 'worthless', staging, defense ? [defense] : []);
  }
  if (ix) defense = held(game, owner, c => c.kind === 'shield', staging);
  if (kind === 'richese-stone') weapon = 'richese-stone-burner';
  const ownerLeader = kind === 'choam-auditor' ? nativeSkillsStrongholdPlayer(game, owner).leaders.find(isAuditorLeader)!.id :
    kind === 'richese-stone' ? untrained(game, owner) : trainer;
  const opponentLeader = untrained(game, opponent);
  game = advanceNativeSkillsStronghold(game, g => g.phase === 6 && clean(g), actions);
  const beforeBattle = structuredClone(game);
  assert.ok(game.active === owner || game.active === opponent);
  game = act(game, { actor: game.active!, action: { type: 'chooseBattle', territory: stronghold, target: game.active === owner ? opponent : owner } }, actions);
  game = advanceNativeSkillsStronghold(game, g => g.decision?.kind === 'strongholdCopy' ||
    !!g.battle && clean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false, actions);
  const copyAction: Action | null = game.decision?.kind === 'strongholdCopy'
    ? { type: 'decision', event: game.decision.event, stronghold: 'arrakeen' } : null;
  const ownerDial = ix ? 5 : kind === 'richese-marker' ? 3 : kind === 'richese-stone' ? 2 : 4;
  const support = ix ? 1 : ownerDial;
  const opponentDial = tleilaxuCase || kind === 'richese-stone' || kind === 'choam-auditor' ? 2 : 0;
  const plans: StrongholdFactionsNativeStep[] = [
    { actor: owner, action: { type: 'battlePlan', dial: ownerDial, support, leader: ownerLeader, weapon, defense } },
    { actor: opponent, action: { type: 'battlePlan', dial: opponentDial, support: opponentDial, leader: opponentLeader, weapon: enemyWeapon } },
  ];
  assertNativeSkillsStrongholdCustody(game);
  return { initial, offered, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeBattle, game,
    kind, owner, opponent, choam, tleilaxu, trainer, territory: stronghold, location, boardSource,
    copyAction, plans, acquisition, shipment, actions, staging };
}

export function revealNativeSkillsStrongholdBattle(fixture: NativeSkillsStrongholdFixture): Game {
  let game = structuredClone(fixture.game);
  if (fixture.copyAction) {
    game = applyAction(game, fixture.owner, fixture.copyAction);
    game = advanceNativeSkillsStronghold(game, g => !!g.battle && clean(g) && !g.battle.preparation && g.battle.preLeader?.closed !== false);
  }
  for (const plan of fixture.plans) {
    game = applyAction(game, plan.actor, plan.action);
    if (!game.battle?.revealed) game = advanceNativeSkillsStronghold(game, g => clean(g) && !g.battle?.preparation && g.battle?.preLeader?.closed !== false);
  }
  assert.ok(game.battle?.revealed);
  return game;
}
/** Stop at consumer-visible choices; fully resolved means this battle, not a made-up phase. */
export function settleNativeSkillsStrongholdBattle(state: Game, stop: 'suk' | 'cards' | 'faceDance' | 'complete' = 'complete'): Game {
  return advanceNativeSkillsStronghold(state, g =>
    stop === 'suk' && g.decision?.kind === 'sukRescue' ||
    stop === 'cards' && g.decision?.kind === 'battleCards' ||
    stop === 'faceDance' && g.decision?.kind === 'faceDance' ||
    !g.battle && clean(g) && !g.pendingTreacheryDiscard);
}
export function finishNativeSkillsStrongholdTurn(state: Game): Game {
  return advanceNativeSkillsStronghold(state, g => g.turn > state.turn);
}
export function nativeSkillsStrongholdControllers(game: Game) {
  return strongholdControllers(game.players, !!game.mobileStronghold?.location);
}
/** The shared quote is authoritative for native typed forces/payment/income.
 * These cases deliberately choose Suk (no strength bonus) or no active skill. */
export const quoteNativeSkillsStrongholdBattle = quoteStrongholdFactionsBattle;
