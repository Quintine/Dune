import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game, type Player } from '../game/engine';
import {
  ecazOccupyFixture, chooseEcazOccupyLead, cancelEcazOccupy, openEcazOccupyPlans,
  allowEcazOccupyResponses, stageEcazOccupyCard, type EcazOccupyFixture,
} from './fixture-ecaz-occupy';

export type NativeOccupyLead = 'ecaz' | 'ally';
export const nativeOccupyPlayer = (game: Game, id: string): Player => {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, 'The original native roster must contain this player.');
  return player;
};

function availableLeader(game: Game, id: string, strongest: boolean): string {
  const available = nativeOccupyPlayer(game, id).leaders.filter(l => !l.dead && !l.usedAt);
  available.sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength);
  assert.ok(available[0], 'The native roster must supply an available physical leader.');
  return available[0].id;
}

function prepare(fixture: EcazOccupyFixture, lead: NativeOccupyLead,
  canceled: boolean, funding = 0): Game {
  let game = canceled ? cancelEcazOccupy(fixture, lead) : chooseEcazOccupyLead(fixture, lead);
  game = allowEcazOccupyResponses(game);
  if (game.decision?.kind === 'choamBattleFunding')
    game = applyAction(game, game.decision.player, { type: 'decision', amount: funding });
  else assert.equal(funding, 0, 'Donor spice requires the original native CHOAM funding offer.');
  return openEcazOccupyPlans(game);
}

function reveal(state: Game, actor: string, caller?: string): Game {
  let game = state;
  for (let attempt = 0; attempt < 10 && game.battle; attempt++) {
    const battle = viewGame(game, actor).battle;
    assert.ok(battle);
    const voter = battle.traitorVoters.find(id => !battle.traitorSubmitted.includes(id));
    if (!voter) break;
    game = applyAction(game, voter, { type: 'traitorCall', call: voter === caller });
  }
  return game;
}

/** Only consume real aftermath windows. Never install a decision, plan or phase. */
export function finishNativeOccupyAftermath(state: Game, discardCard?: string): Game {
  let game = state;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (game.pendingTreacheryDiscard) {
      game = applyAction(game, game.players[0].id, { type: 'advanceBots' });
    } else if (game.response) {
      game = allowEcazOccupyResponses(game);
    } else if (game.decision?.kind === 'battleCards') {
      const discard = discardCard && game.decision.cards.includes(discardCard) ? [discardCard] : [];
      game = applyAction(game, game.decision.player, { type: 'decision', discard });
    } else if (game.decision?.kind === 'choamMarket') {
      game = applyAction(game, game.decision.player, { type: 'decision', done: true });
    } else {
      assert.equal(game.battle, null, 'Native plans and traitor voting must have resolved.');
      assert.equal(game.decision, null, 'Native typed losses/substitution must precede continuation.');
      assert.ok(game.phase >= 7, 'The actual coalition battle must reach native Collection.');
      return game;
    }
  }
  throw new Error('The native Occupy battle aftermath did not finish.');
}

export type NativeIxOccupyOptions = {
  initial?: Game;
  lead?: NativeOccupyLead;
  canceled?: boolean;
  commitment?: 'funded' | 'half' | 'zero';
};
export type NativeIxOccupyCase = {
  fixture: EcazOccupyFixture;
  actor: string;
  shield: string;
  variableDial: number;
  support: number;
  before: Game;
  afterReveal: Game;
  afterLosses: Game;
  afterSubstitution: Game;
  game: Game;
};

/** Original Ix setup, real Nexus and mixed shipment (six Suboids, two Cyborgs).
 * Only conserved original hand-card staging is added to the common fixture. */
export function nativeIxOccupyCase(options: NativeIxOccupyOptions = {}): NativeIxOccupyCase {
  const lead = options.lead ?? 'ecaz';
  const canceled = options.canceled ?? false;
  const commitment = options.commitment ?? 'funded';
  const fixture = ecazOccupyFixture({ initial: options.initial, allyFaction: 'ixians',
    expansions: options.initial?.expansions ?? ['ecaz', 'ix'], ecazForces: 5, allyForces: 8, allyElite: 2 });
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  const shield = stageEcazOccupyCard(fixture.game, actor, card => card.kind === 'shield');
  let game = prepare(fixture, lead, canceled);
  const before = structuredClone(game);
  const profile = viewGame(game, actor).battle?.ecazOccupy?.profile;
  assert.ok(profile);
  const ecazOwn = canceled && lead === 'ecaz';
  const variableDial = ecazOwn ? 2 : commitment === 'funded' ? 4 : commitment === 'half' ? 3 : 0;
  const support = ecazOwn ? 2 : commitment === 'funded' ? 1 : 0;
  game = applyAction(game, actor, { type: 'battlePlan', dial: profile.fixedEcazDial + variableDial,
    support, leader: availableLeader(game, actor, true), defense: shield });
  game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: 0, support: 0,
    leader: availableLeader(game, fixture.opponent, false) });
  game = reveal(game, actor);
  const afterReveal = structuredClone(game);
  const normal = ecazOwn ? 2 : commitment === 'funded' ? 2 : commitment === 'half' ? 4 : 0;
  const elite = ecazOwn || commitment === 'zero' ? 0 : commitment === 'funded' ? 2 : 1;
  if (game.decision?.kind === 'battleLosses') {
    const choice = game.decision.options.findIndex(loss => loss.normal === normal && loss.elite === elite);
    assert.ok(choice >= 0, 'The actual Ix dial must offer the requested native typed allocation.');
    game = applyAction(game, game.decision.player, { type: 'decision', choice });
  }
  const afterLosses = structuredClone(game);
  if (elite > 0) {
    assert.ok(game.decision?.kind === 'ixSubstitution');
    assert.equal(game.decision.player, fixture.ally, 'Only the actual Ixian chooses surviving Suboids.');
    game = applyAction(game, fixture.ally, { type: 'decision',
      sources: { [fixture.location]: elite }, recover: { [fixture.location]: elite } });
    game = allowEcazOccupyResponses(game);
  } else assert.notEqual(game.decision?.kind, 'ixSubstitution');
  const afterSubstitution = structuredClone(game);
  game = finishNativeOccupyAftermath(game, shield);
  return { fixture, actor, shield, variableDial, support, before, afterReveal,
    afterLosses, afterSubstitution, game };
}

export type NativeChoamOccupyOptions = {
  initial?: Game;
  lead?: NativeOccupyLead;
  relationship?: 'coside' | 'opposing';
  support?: number;
  opponentSupport?: number;
  donorPayment?: number;
  traitor?: boolean;
};
export type NativeChoamOccupyCase = {
  fixture: EcazOccupyFixture;
  actor: string;
  choam: string;
  support: number;
  opponentSupport: number;
  donorPayment: number;
  beforeFunding: Game;
  before: Game;
  revealed: Game;
  afterReveal: Game;
  game: Game;
};

/** Labelled physical Traitor Card exchange after original setup. Preserve the
 * original deal and reserve; never synthesize a traitor identity or dead leader. */
function holdPhysicalTraitor(game: Game, owner: string, identity: string): void {
  const player = nativeOccupyPlayer(game, owner);
  if (player.traitors.includes(identity)) return;
  assert.ok(player.traitors[0], 'An original held Traitor Card must fund this physical exchange.');
  const reserve = game.traitorReserve;
  const index = reserve?.indexOf(identity) ?? -1;
  if (reserve && index >= 0) {
    reserve[index] = player.traitors[0];
    player.traitors[0] = identity;
  } else {
    const donor = game.players.find(p => p.traitors.includes(identity));
    assert.ok(donor, 'The original source must contain the requested physical Traitor Card.');
    const donorIndex = donor.traitors.indexOf(identity);
    donor.traitors[donorIndex] = player.traitors[0];
    player.traitors[0] = identity;
  }
}

/** Native CHOAM original family setup and actual opposing/coside armies.
 * Any donor payment is offered and escrowed by the existing CHOAM decision. */
export function nativeChoamOccupyCase(options: NativeChoamOccupyOptions = {}): NativeChoamOccupyCase {
  const lead = options.lead ?? 'ecaz';
  const relationship = options.relationship ?? 'coside';
  const support = options.support ?? 3;
  const opponentSupport = options.opponentSupport ?? 3;
  const donorPayment = options.donorPayment ?? 0;
  const fixture = ecazOccupyFixture({ initial: options.initial,
    allyFaction: relationship === 'coside' ? 'choam' : 'guild',
    opponentFaction: relationship === 'coside' ? 'guild' : 'choam',
    expansions: options.initial?.expansions ?? ['ecaz', 'choam'], ecazForces: 5, allyForces: 8 });
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  const choam = relationship === 'coside' ? fixture.ally : fixture.opponent;
  const beforeFunding = structuredClone(fixture.game);
  let game = prepare(fixture, lead, false, donorPayment);
  let opponentLeader = availableLeader(game, fixture.opponent, false);
  if (options.traitor) {
    const physical = [...(game.traitorReserve ?? []), ...game.players.flatMap(p => p.traitors)];
    const leader = nativeOccupyPlayer(game, fixture.opponent).leaders.find(l =>
      !l.dead && !l.usedAt && physical.includes(l.id));
    assert.ok(leader, 'The actual opposing roster must supply a physical non-loyal Traitor Card.');
    opponentLeader = leader.id;
    holdPhysicalTraitor(game, actor, opponentLeader);
  }
  const before = structuredClone(game);
  const profile = viewGame(game, actor).battle?.ecazOccupy?.profile;
  assert.ok(profile);
  game = applyAction(game, actor, { type: 'battlePlan', dial: profile.fixedEcazDial + support,
    support, allyPayment: donorPayment, leader: availableLeader(game, actor, true) });
  game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: opponentSupport,
    support: opponentSupport, leader: opponentLeader });
  const revealed = structuredClone(game);
  game = reveal(game, actor, options.traitor ? actor : undefined);
  const afterReveal = structuredClone(game);
  game = finishNativeOccupyAftermath(game);
  return { fixture, actor, choam, support, opponentSupport, donorPayment,
    beforeFunding, before, revealed, afterReveal, game };
}
