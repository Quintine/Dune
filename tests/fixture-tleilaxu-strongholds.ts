import assert from 'node:assert/strict';
import { applyAction, createGame, initializeStrongholdFactionsGameForAudit, joinGame, newPlayer, type Game } from '../game/engine';
import { MOBILE_LOCATION, MOBILE_STRONGHOLD, territory } from '../game/board';
import type { Card } from '../game/cards';
import { strongholdControllers, type StrongholdId } from '../game/stronghold-cards';
import { nextStrongholdFactionsNativeStep, quoteStrongholdFactionsBattle, type StrongholdFactionsNativeStep } from './fixture-stronghold-factions';

export type TleilaxuStrongholdsOptions = { initial?: Game; kind?: 'sietch_tabr' | typeof MOBILE_STRONGHOLD };
export type TleilaxuStrongholdsFixture = {
  initial: Game; afterSetup: Game; beforeFirstMentat: Game; firstMentatStep: StrongholdFactionsNativeStep;
  afterFirstMentat: Game; beforeBattle: Game; game: Game; revealed: Game; faceDance: Game;
  ix: string; tleilaxu: string; opponent: string; kind: StrongholdId; location: string;
  pointer: string; winnerLeader: string; loserLeader: string; weapon: string; defense: string;
  battleAction: StrongholdFactionsNativeStep; planActions: StrongholdFactionsNativeStep[];
  sourceActions: StrongholdFactionsNativeStep[]; staging: string[];
};
export const tleilaxuStrongholdsPlayer = (game: Game, id: string) => {
  const player = game.players.find(p => p.id === id); assert.ok(player); return player;
};
const clean = (game: Game) => !game.phaseOpening && !game.response && !game.decision;
const key = (id: StrongholdId) => id === MOBILE_STRONGHOLD ? MOBILE_LOCATION : `${id}:${territory(id).sectors[0]}`;
function run(game: Game, action: StrongholdFactionsNativeStep, actions: StrongholdFactionsNativeStep[]): Game {
  actions.push(structuredClone(action)); return applyAction(game, action.actor, action.action);
}
function advance(game: Game, until: (state: Game) => boolean, actions: StrongholdFactionsNativeStep[]): Game {
  for (let n = 0; n < 1800; n++) {
    if (until(game)) return game;
    assert.notEqual(game.status, 'finished');
    const action = nextStrongholdFactionsNativeStep(game); assert.ok(action, 'A real human battle plan is required');
    game = run(game, action, actions);
  }
  throw Error('Native Tleilaxu Stronghold boundary did not open');
}
function reserveBoard(game: Game) {
  for (const player of game.players) {
    player.reserves += Object.values(player.forces).reduce((a, b) => a + b, 0); player.forces = {};
    if (player.elites) {
      player.elites.reserves += Object.values(player.elites.forces).reduce((a, b) => a + b, 0); player.elites.forces = {};
    }
  }
}
function place(game: Game, actor: string, location: string, count: number, elite = 0) {
  const player = tleilaxuStrongholdsPlayer(game, actor);
  assert.ok(player.reserves >= count && count >= elite && (player.elites?.reserves ?? 0) >= elite);
  player.reserves -= count; player.forces[location] = (player.forces[location] ?? 0) + count;
  if (elite) { player.elites!.reserves -= elite; player.elites!.forces[location] = (player.elites!.forces[location] ?? 0) + elite; }
}
function heldCard(game: Game, actor: string, kind: Card['kind'], staging: string[]) {
  const player = tleilaxuStrongholdsPlayer(game, actor), held = player.hand.find(c => c.kind === kind);
  if (held) return held.id;
  const index = game.deck.findIndex(c => c.kind === kind); assert.ok(index >= 0);
  assert.ok(player.hand.length < 4);
  const card = game.deck.splice(index, 1)[0]; player.hand.push(card);
  staging.push(`Conserved ${card.id}: remaining native deck → ${actor}'s hand`); return card.id;
}
function matchingLeader(game: Game, ix: string, tleilaxu: string) {
  const held = tleilaxuStrongholdsPlayer(game, tleilaxu).faceDancers!;
  return tleilaxuStrongholdsPlayer(game, ix).leaders.filter(l => !l.dead && held.some(c => !c.revealed && c.leader === l.id)).sort((a, b) => b.strength - a.strength)[0];
}

/** Root Advanced PDF logical p38, lines 1066–1075: actual native draw, original
 * winner's rewards, no second bounty, and zero/up-to-army replacement. Only
 * the actual first native Face Dancer shuffle uses test entropy, scoped to
 * its source setup action. Provided original CLI setup is cloned, never
 * redealt; saved choices, deck and offers remain untouched. Conserved
 * board/card staging is labeled; no owners, phase, plans or opportunities are
 * assigned. This intentionally excludes foreign gholas, capture and overlays. */
export function createTleilaxuStrongholdsFixture(options: TleilaxuStrongholdsOptions = {}): TleilaxuStrongholdsFixture {
  const actions: StrongholdFactionsNativeStep[] = [], staging: string[] = [];
  const kind = options.kind ?? 'sietch_tabr';
  let game: Game;
  if (options.initial) {
    game = structuredClone(options.initial);
    assert.ok(game.status === 'lobby' || game.status === 'setup' && game.turn === 1 && game.phase === 0 && game.players.every(p => p.hand.length === 0));
    assert.equal(game.advanced, true);
    assert.ok(game.expansions.includes('ix') && game.expansions.every(deck => deck === 'ix' || deck === 'choam') &&
      new Set(game.expansions).size === game.expansions.length, 'Use the selected native Ix deck, optionally with CHOAM');
  } else {
    game = createGame('TLEILAXUSTRONGHOLDS', newPlayer('ix', 'Ixians', 'ixians'), true, ['ix']);
    joinGame(game, newPlayer('tleilaxu', 'Tleilaxu', 'tleilaxu'));
    joinGame(game, newPlayer('guild', 'Guild', 'guild'));
  }
  assert.deepEqual(game.players.map(p => p.faction).sort(), ['guild', 'ixians', 'tleilaxu']);
  if (game.status === 'lobby') {
    for (const player of game.players) if (!player.ready) game = run(game, { actor: player.id, action: { type: 'ready' } }, actions);
    game = initializeStrongholdFactionsGameForAudit(game);
  }
  const initial = structuredClone(game);
  for (let setup = 0; game.status === 'setup' && setup < 200; setup++) {
    const action = nextStrongholdFactionsNativeStep(game); assert.ok(action);
    if (game.decision?.kind !== 'ixSetup') {
      game = run(game, action, actions); continue;
    }
    assert.equal(game.turn, 1); assert.equal(game.phase, 0);
    assert.equal(game.setupStage, undefined);
    assert.ok(game.players.every(p => p.faceDancers === undefined));
    // Ix first shuffles the unchosen starting Treachery Cards. Preserve that
    // genuine shuffle; seed only the subsequent native Traitor Deck shuffle.
    const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
    const originalRandom = crypto.getRandomValues.bind(crypto);
    let remainderCalls = Math.max(0, game.ixSetupCards!.length - 2);
    let faceCalls = game.players.reduce((sum, p) => sum + p.leaders.length, 0) + 1 -
      new Set(game.players.flatMap(p => p.traitors)).size - 1;
    crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
      assert.ok(array);
      assert.ok(array instanceof Uint32Array, 'Native setup entropy uses integer random words');
      if (remainderCalls > 0) { remainderCalls--; originalRandom(array); return array; }
      if (faceCalls <= 0) { originalRandom(array); return array; }
      faceCalls--;
      new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(255); return array;
    };
    try { game = run(game, action, actions); }
    finally {
      if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
      else Reflect.deleteProperty(crypto, 'getRandomValues');
    }
    assert.equal(game.status, 'playing');
    staging.push('First-draw test entropy: only native Face Dancer Traitor Deck shuffle in the original Ix starting-card decision; restore immediately; no redeal, saved-choice rewrite or later draw override.');
  }
  assert.equal(game.status, 'playing');
  const afterSetup = structuredClone(game);
  const ix = game.players.find(p => p.faction === 'ixians')!.id;
  const tleilaxu = game.players.find(p => p.faction === 'tleilaxu')!.id;
  const opponent = game.players.find(p => p.faction === 'guild')!.id;
  game = advance(game, state => state.phase === 8 && clean(state), actions);
  reserveBoard(game);
  place(game, ix, MOBILE_LOCATION, 6, 3); place(game, ix, key('sietch_tabr'), 1);
  place(game, tleilaxu, key('arrakeen'), 1); place(game, opponent, key('carthag'), 1);
  staging.push('Before real first END Mentat: redistribute original counters through their own reserves; Ix controls HMS and Tabr, Tleilaxu Arrakeen, Guild Carthag; no three-hold victory.');
  let beforeFirstMentat: Game | undefined, firstMentatStep: StrongholdFactionsNativeStep | undefined;
  while (game.turn === 1) {
    const action = nextStrongholdFactionsNativeStep(game); assert.ok(action);
    const before = structuredClone(game); game = run(game, action, actions);
    if (game.turn === 2) { beforeFirstMentat = before; firstMentatStep = action; }
  }
  assert.ok(beforeFirstMentat && firstMentatStep);
  const afterFirstMentat = structuredClone(game);
  assert.equal(game.strongholdCards!.owners[kind], ix);
  const winnerLeader = matchingLeader(game, ix, tleilaxu);
  assert.ok(winnerLeader, 'Actual first native Face Dancer draw must provide an Ix leader');
  game = advance(game, state => state.phase === 5 && clean(state), actions);
  const pointer = game.mobileStronghold!.location; assert.ok(pointer && pointer !== MOBILE_LOCATION);
  reserveBoard(game);
  const location = key(kind);
  place(game, ix, location, 6, 3); place(game, opponent, location, 6);
  if (kind !== MOBILE_STRONGHOLD) place(game, ix, MOBILE_LOCATION, 1, 1);
  else place(game, ix, key('sietch_tabr'), 1);
  place(game, ix, pointer, 2, 1); place(game, tleilaxu, key('arrakeen'), 3);
  staging.push('Before native movement completion: conserve six counters per combatant (Ix three suboids/three cyborgs), two Ix outside the HMS pointer (one cyborg), real Tleilaxu board sources in Arrakeen; retain first-Mentat cards.');
  for (const player of game.players) player.spice = 20;
  staging.push('Explicit bank-balance staging: original three seats each start this battle with twenty spice; no bounty, support or Stronghold receipt injected.');
  const weapon = heldCard(game, ix, 'projectile', staging), defense = heldCard(game, ix, 'shield', staging);
  const loserLeader = tleilaxuStrongholdsPlayer(game, opponent).leaders.filter(l => !l.dead).sort((a, b) => a.strength - b.strength)[0]; assert.ok(loserLeader);
  game = advance(game, state => state.phase === 6 && clean(state), actions);
  const beforeBattle = structuredClone(game), actor = game.active!; assert.ok([ix, opponent].includes(actor));
  const battleAction: StrongholdFactionsNativeStep = { actor, action: { type: 'chooseBattle', territory: kind, target: actor === ix ? opponent : ix } };
  game = run(game, battleAction, actions);
  if (kind === MOBILE_STRONGHOLD) {
    game = advance(game, state => state.decision?.kind === 'strongholdCopy' || !!state.battle?.strongholdCopy, actions);
    assert.equal(strongholdControllers(game.players, true).sietch_tabr, ix);
    if (game.decision?.kind === 'strongholdCopy')
      game = run(game, { actor: ix, action: { type: 'decision', event: game.decision.event, stronghold: 'sietch_tabr' } }, actions);
    else assert.equal(game.battle!.strongholdCopy, 'sietch_tabr', 'Native sole-copy declaration is automatic');
  }
  game = advance(game, state => !!state.battle && !state.battle.revealed && !nextStrongholdFactionsNativeStep(state), actions);
  const planActions: StrongholdFactionsNativeStep[] = [
    { actor: ix, action: { type: 'battlePlan', dial: 2, support: 1, leader: winnerLeader.id, weapon, defense } },
    { actor: opponent, action: { type: 'battlePlan', dial: 1.5, support: 1, leader: loserLeader.id, weapon: null, defense: null } },
  ];
  const fixture = { initial, afterSetup, beforeFirstMentat, firstMentatStep, afterFirstMentat, beforeBattle, game: structuredClone(game), ix, tleilaxu, opponent, kind, location, pointer, winnerLeader: winnerLeader.id, loserLeader: loserLeader.id, weapon, defense, battleAction, planActions, sourceActions: actions, staging };
  const revealed = revealTleilaxuStrongholdsBattle(fixture, actions);
  const faceDance = resolveTleilaxuStrongholdsBattle({ ...fixture, revealed }, actions);
  return { ...fixture, revealed, faceDance };
}
export function revealTleilaxuStrongholdsBattle(fixture: Pick<TleilaxuStrongholdsFixture, 'game' | 'planActions'>, sourceActions: StrongholdFactionsNativeStep[] = []): Game {
  let game = structuredClone(fixture.game);
  for (const plan of fixture.planActions) {
    game = run(game, plan, sourceActions);
    while (game.response || game.decision?.kind === 'fullPlanOffer') {
      const action = nextStrongholdFactionsNativeStep(game); assert.ok(action); game = run(game, action, sourceActions);
    }
  }
  assert.ok(game.battle?.revealed); return game;
}
export function resolveTleilaxuStrongholdsBattle(fixture: Pick<TleilaxuStrongholdsFixture, 'revealed' | 'ix'>, sourceActions: StrongholdFactionsNativeStep[] = []): Game {
  const quote = quoteStrongholdFactionsBattle(fixture.revealed); assert.equal(quote.winner, fixture.ix);
  let game = structuredClone(fixture.revealed);
  for (let n = 0; n < 160; n++) {
    if (game.decision?.kind === 'faceDance') return game;
    const action = nextStrongholdFactionsNativeStep(game); assert.ok(action); game = run(game, action, sourceActions);
  }
  throw Error('Original winner aftermath did not reach native Face Dance');
}
export function finishTleilaxuStrongholdsTurn(state: Game): Game {
  const turn = state.turn; return advance(structuredClone(state), game => game.turn > turn, []);
}
