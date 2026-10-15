import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game } from '../game/engine';
import { splitLocation } from '../game/board';
import { DUKE_VIDAL_ID, dukeController } from '../game/duke-vidal';
import { moritaniTerrorAssassinationPool } from '../game/moritani-terror-assassination';
import { createMoritaniNexusSetup } from './fixture-e3-nexus-moritani';
import {
  advanceNexusDuke, assertNexusDukeCustody, emptyNexusDukePlan, nextNexusDukeStep,
  nexusDukeClean, nexusDukePlayer, openNexusDukeBattle, sealNexusDukeBattle, stepNexusDuke,
  type NexusDukePlan, type NexusDukeStep,
} from './fixture-nexus-duke-capture';

type Frame = { before: Game; after: Game };
export type MoritaniDukeCaptureFixture = {
  game: Game; owner: string; captor: string; guild: string; target: string; home: string;
  plan: NexusDukePlan; actions: NexusDukeStep[]; acquisition: Frame; capture: Frame;
  terrorToken?: string;
};
function nativeLeader(game: Game, actor: string, territory: string, strong: boolean): string {
  const pool = nexusDukePlayer(game, actor).leaders
    .filter(l => !l.dead && !l.capturedBy && !l.gholaBy && (!l.usedAt || l.usedAt === territory))
    .sort((a, b) => strong ? b.strength - a.strength : a.strength - b.strength);
  assert.ok(pool[0]);
  return pool[0].id;
}
function winGuildStronghold(game: Game, owner: string, guild: string, plan: NexusDukePlan,
  actions: NexusDukeStep[]): Game {
  const battle = openNexusDukeBattle(game, plan, actions,
    { territory: 'tueks_sietch', first: owner, second: guild });
  const sealed = sealNexusDukeBattle(battle.game, plan, actions, [
    { actor: owner, leader: nativeLeader(battle.game, owner, 'tueks_sietch', true), dial: 0, support: 0 },
    { actor: guild, leader: nativeLeader(battle.game, guild, 'tueks_sietch', false), dial: 0, support: 0 },
  ]);
  return advanceNexusDuke(sealed, g => !g.battle && nexusDukeClean(g), plan, actions);
}

/** Real native setup, two prospective stronghold battles, original Moritani
 * acquisition, an actual Harkonnen victory/lottery and original Keep/Execute.
 * Returns before final movement completion, or at an actual optional Terror entry. */
export function createMoritaniDukeCaptureFixture(options: {
  karama?: boolean; execute?: boolean; terror?: boolean; terrorEntrant?: 'harkonnen' | 'guild';
} = {}): MoritaniDukeCaptureFixture {
  const setup = createMoritaniNexusSetup({ roster: ['moritani', 'harkonnen', 'guild'],
    opponentFaction: 'harkonnen', harkonnenKarama: options.karama });
  const owner = setup.owner, captor = setup.opponent, guild = 'guild';
  const home = splitLocation(Object.keys(nexusDukePlayer(setup.afterSetup, owner).forces)[0]).territory;
  const plan: NexusDukePlan = { ...emptyNexusDukePlan(), owner, captor, entrant: guild,
    others: [captor, guild], capture: 'accept', mode: options.execute ? 'execute' : 'keep' };
  const actions = setup.actions;
  plan.ship = { [owner]: { territory: 'tueks_sietch', amount: 1 },
    [captor]: { territory: home, amount: 1 } };
  const acquisitionBefore = advanceNexusDuke(setup.afterSetup,
    g => g.phase === 5 && nexusDukeClean(g), plan, actions);
  let game = advanceNexusDuke(acquisitionBefore,
    g => !!g.dukeVidal && dukeController(g.dukeVidal) === owner, plan, actions);
  const acquisition = { before: acquisitionBefore, after: structuredClone(game) };
  const battle = openNexusDukeBattle(game, plan, actions,
    { territory: home, first: owner, second: captor });
  const sealed = sealNexusDukeBattle(battle.game, plan, actions, [
    { actor: owner, leader: nativeLeader(battle.game, owner, home, false), dial: 0, support: 0 },
    { actor: captor, leader: nativeLeader(battle.game, captor, home, true), dial: 0, support: 0 },
  ]);
  game = advanceNexusDuke(sealed, g => g.decision?.kind === 'capturedLeader', plan, actions);
  assert.equal(game.decision?.kind === 'capturedLeader' && game.decision.leader, DUKE_VIDAL_ID);
  const before = structuredClone(game);
  game = stepNexusDuke(game, plan, { actor: captor,
    action: { type: 'decision', mode: options.execute ? 'execute' : 'keep' } }, actions);
  const capture = { before, after: structuredClone(game) };
  plan.capture = 'decline';
  game = winGuildStronghold(game, owner, guild, plan, actions);
  let terrorToken: string | undefined;
  const terrorEntrant = options.terrorEntrant === 'guild' ? guild : captor;
  const terrorLocation = terrorEntrant === guild ? 'arrakeen' : 'tueks_sietch';
  if (options.terror) {
    game = advanceNexusDuke(game, g => g.decision?.kind === 'moritaniPlacement', plan, actions);
    const token = game.moritaniTerror!.tokens.find(t => t.kind === 'assassination' && t.status === 'available');
    assert.ok(token);
    terrorToken = token.id;
    game = stepNexusDuke(game, plan, { actor: owner,
      action: { type: 'decision', token: token.id, territory: terrorLocation } }, actions);
  }
  plan.ship = { [owner]: { territory: 'carthag', amount: 1 },
    [captor]: { territory: 'tueks_sietch', amount: 1 } };
  if (options.terrorEntrant === 'guild') plan.ship[guild] = { territory: terrorLocation, amount: 1 };
  game = advanceNexusDuke(game, g => options.terror
    ? g.decision?.kind === 'moritaniTerror' && g.pendingTerrorEntry?.token === terrorToken
    : g.turn === 2 && g.phase === 5 && nexusDukeClean(g) &&
      !!g.active && g.movementRemaining?.length === 1 &&
      plan.shipped[owner] === String(g.turn) && plan.shipped[captor] === String(g.turn), plan, actions);
  assertNexusDukeCustody(game);
  return { game, owner, captor, guild, target: setup.target, home, plan, actions, acquisition, capture, terrorToken };
}

export function reclaimMoritaniDuke(f: MoritaniDukeCaptureFixture): Frame {
  const before = structuredClone(f.game);
  const last = nextNexusDukeStep(f.game, f.plan);
  assert.ok(last && last.action.type === 'endMovement');
  let game = stepNexusDuke(f.game, f.plan, last, f.actions);
  game = advanceNexusDuke(game, g => g.phase === 6 && nexusDukeClean(g), f.plan, f.actions);
  assertNexusDukeCustody(game);
  return { before, after: game };
}

export function cancelMoritaniDukeReclaim(f: MoritaniDukeCaptureFixture): Frame {
  const before = structuredClone(f.game), last = nextNexusDukeStep(f.game, f.plan);
  assert.ok(last && last.action.type === 'endMovement');
  let game = stepNexusDuke(f.game, f.plan, last, f.actions);
  game = advanceNexusDuke(game, g => g.response?.kind === 'moritaniDuke', f.plan, f.actions);
  const karama = nexusDukePlayer(game, f.captor).hand.find(c => c.effect === 'karama');
  assert.ok(karama);
  game = stepNexusDuke(game, f.plan, { actor: f.captor,
    action: { type: 'card', card: karama.id, mode: 'cancel' } }, f.actions);
  game = advanceNexusDuke(game, g => g.phase === 6 && nexusDukeClean(g), f.plan, f.actions);
  assertNexusDukeCustody(game);
  return { before, after: game };
}

/** The native captor really uses Duke; its returned disc cannot erase the
 * surviving battle identity before Moritani's distinct printed-faction choice. */
export function openCapturedDukeAssassinateWindow(game: Game, f: MoritaniDukeCaptureFixture): Game {
  const carthag = openNexusDukeBattle(game, f.plan, f.actions,
    { territory: 'carthag', first: f.owner, second: f.captor });
  const sealed = sealNexusDukeBattle(carthag.game, f.plan, f.actions, [
    { actor: f.owner, leader: nativeLeader(carthag.game, f.owner, 'carthag', false), dial: 0, support: 0 },
    { actor: f.captor, leader: DUKE_VIDAL_ID, dial: 0, support: 0 },
  ]);
  game = advanceNexusDuke(sealed, g => g.decision?.kind === 'moritaniAssassinate', f.plan, f.actions);
  return game;
}

export function assassinateAfterCapturedDukeUse(game: Game, f: MoritaniDukeCaptureFixture): {
  window: Game; after: Game; replaced: Game;
} {
  game = openCapturedDukeAssassinateWindow(game, f);
  const offer = viewGame(game, f.owner).moritaniAssassinate?.pending;
  assert.ok(offer);
  assert.ok(offer.cards.some(c => c.card === f.target), 'The actual held native Harkonnen Traitor remains a legal different-disc target.');
  const window = structuredClone(game);
  game = stepNexusDuke(game, f.plan, { actor: f.owner,
    action: { type: 'decision', event: offer.event, card: f.target } }, f.actions);
  const after = structuredClone(game);
  game = advanceNexusDuke(game, g => !g.battle && nexusDukeClean(g), f.plan, f.actions);
  const tueks = openNexusDukeBattle(game, f.plan, f.actions,
    { territory: 'tueks_sietch', first: f.owner, second: f.captor });
  const rest = sealNexusDukeBattle(tueks.game, f.plan, f.actions, [
    { actor: f.owner, leader: nativeLeader(tueks.game, f.owner, 'tueks_sietch', true), dial: 0, support: 0 },
    { actor: f.captor, leader: nativeLeader(tueks.game, f.captor, 'tueks_sietch', false), dial: 0, support: 0 },
  ]);
  game = advanceNexusDuke(rest, g => g.phase === 8 && nexusDukeClean(g), f.plan, f.actions);
  assertNexusDukeCustody(game);
  return { window, after, replaced: game };
}

export function useMoritaniReclaimedDuke(game: Game, f: MoritaniDukeCaptureFixture, use = true): Game {
  const carthag = openNexusDukeBattle(game, f.plan, f.actions,
    { territory: 'carthag', first: f.owner, second: f.captor });
  let sealed = sealNexusDukeBattle(carthag.game, f.plan, f.actions, [
    { actor: f.owner, leader: use ? DUKE_VIDAL_ID : nativeLeader(carthag.game, f.owner, 'carthag', true), dial: 0, support: 0 },
    { actor: f.captor, leader: nativeLeader(carthag.game, f.captor, 'carthag', false), dial: 0, support: 0 },
  ]);
  game = advanceNexusDuke(sealed, g => !g.battle && nexusDukeClean(g), f.plan, f.actions);
  const tueks = openNexusDukeBattle(game, f.plan, f.actions,
    { territory: 'tueks_sietch', first: f.owner, second: f.captor });
  sealed = sealNexusDukeBattle(tueks.game, f.plan, f.actions, [
    { actor: f.owner, leader: nativeLeader(tueks.game, f.owner, 'tueks_sietch', true), dial: 0, support: 0 },
    { actor: f.captor, leader: nativeLeader(tueks.game, f.captor, 'tueks_sietch', false), dial: 0, support: 0 },
  ]);
  game = advanceNexusDuke(sealed, g => !g.battle && nexusDukeClean(g), f.plan, f.actions);
  if (!use) game = advanceNexusDuke(game, g => g.turn > 2, f.plan, f.actions);
  assertNexusDukeCustody(game);
  return game;
}

/** Controls only the original random permutation, never the effect, candidate
 * body or assigned leader state. UUID and non-scalar entropy remain native. */
export function revealMoritaniTerrorVictim(f: MoritaniDukeCaptureFixture, victim?: string): Frame {
  const before = structuredClone(f.game);
  const entry = f.game.pendingTerrorEntry!;
  assert.ok(f.game.decision?.kind === 'moritaniTerror' && entry.token === f.terrorToken);
  const pool = moritaniTerrorAssassinationPool(f.game, entry.entrant).map(l => l.id);
  const desired = victim ? [victim, ...pool.filter(id => id !== victim)] : pool;
  assert.deepEqual(pool.slice().sort(), desired.slice().sort());
  const working = pool.slice(), rolls: number[] = [];
  for (let i = working.length - 1; i > 0; i--) {
    const j = working.indexOf(desired[i]);
    assert.ok(j >= 0 && j <= i);
    rolls.push(Math.floor((j + 0.5) * 0x100000000 / (i + 1)));
    [working[i], working[j]] = [working[j], working[i]];
  }
  const descriptor = Object.getOwnPropertyDescriptor(crypto, 'getRandomValues');
  const native = crypto.getRandomValues.bind(crypto);
  let index = 0;
  crypto.getRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
    if (array instanceof Uint32Array && array.length === 1) array[0] = rolls[index++] ?? 0xffffffff;
    else Reflect.apply(native, crypto, [array]);
    return array;
  };
  const action = { type: 'decision' as const, reveal: true };
  f.actions.push({ actor: f.owner, action });
  let after: Game;
  try { after = applyAction(structuredClone(f.game), f.owner, action); }
  finally {
    if (descriptor) Object.defineProperty(crypto, 'getRandomValues', descriptor);
    else Reflect.deleteProperty(crypto, 'getRandomValues');
  }
  assertNexusDukeCustody(after);
  return { before, after };
}
