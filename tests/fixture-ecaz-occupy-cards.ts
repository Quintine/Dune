import assert from 'node:assert/strict';
import { applyAction, viewGame, type Game, type Player } from '../game/engine';
import type { EcazTreacheryCardId } from '../game/ecaz-cards';
import { defaultHarassWithdrawAllocation, type HarassWithdrawForces, type HarassWithdrawSelection } from '../game/harass-withdraw';
import {
  ecazOccupyFixture, chooseEcazOccupyLead, cancelEcazOccupy, openEcazOccupyPlans,
  allowEcazOccupyResponses, stageEcazOccupyCard, type EcazOccupyFixture,
  type EcazOccupyFixtureOptions,
} from './fixture-ecaz-occupy';

export const occupyCardsPlayer = (game: Game, id: string): Player => {
  const player = game.players.find(p => p.id === id);
  assert.ok(player, 'The original roster must contain the physical owner.');
  return player;
};

function stageCard(game: Game, owner: string, predicate: (card: Player['hand'][number]) => boolean): string {
  const id = stageEcazOccupyCard(game, owner, predicate);
  const hand = occupyCardsPlayer(game, owner).hand;
  // Keep the selected physical face when the second conserved slot is staged.
  const index = hand.findIndex(card => card.id === id);
  hand.push(hand.splice(index, 1)[0]);
  return id;
}

/** Exchange one original held Traitor Card for a physical reserve/held identity. */
export function holdOccupyCardsTraitor(game: Game, owner: string, identity: string): void {
  const player = occupyCardsPlayer(game, owner);
  if (player.traitors.includes(identity)) return;
  assert.ok(player.traitors[0], 'An original Traitor Card must fund this exchange.');
  const reserve = game.traitorReserve;
  const index = reserve?.indexOf(identity) ?? -1;
  if (reserve && index >= 0) {
    reserve[index] = player.traitors[0];
    player.traitors[0] = identity;
  } else {
    const donor = game.players.find(p => p.traitors.includes(identity));
    assert.ok(donor, 'A real non-loyal Traitor Card must exist in the original source.');
    const donorIndex = donor.traitors.indexOf(identity);
    donor.traitors[donorIndex] = player.traitors[0];
    player.traitors[0] = identity;
  }
}

function leader(game: Game, owner: string, strongest: boolean, traitorable = false): string {
  const physical = new Set([...(game.traitorReserve ?? []), ...game.players.flatMap(p => p.traitors)]);
  const available = occupyCardsPlayer(game, owner).leaders.filter(l =>
    !l.dead && !l.usedAt && (!traitorable || physical.has(l.id)));
  available.sort((a, b) => strongest ? b.strength - a.strength : a.strength - b.strength);
  assert.ok(available[0], 'Use an available original physical leader.');
  return available[0].id;
}

export type OccupyCardsOutcome = 'win' | 'loss' | 'soleTraitor' | 'opposingTraitor' |
  'mutualTraitors' | 'explosion';
export type OccupyCardsOptions = EcazOccupyFixtureOptions & {
  lead?: 'ecaz' | 'ally';
  holder?: 'lead' | 'opponent';
  card?: Extract<EcazTreacheryCardId, 'ecaz-reinforcements' | 'ecaz-harass-withdraw'>;
  opponentCard?: Extract<EcazTreacheryCardId, 'ecaz-reinforcements'>;
  slot?: 'weapon' | 'defense';
  outcome?: OccupyCardsOutcome;
  canceled?: boolean;
  variableDial?: number;
  support?: number;
  opponentDial?: number;
  opponentSupport?: number;
  /** Find real equal-strength leaders for a decisive +2 score comparison. */
  equalLeaders?: boolean;
  actorLeader?: string;
  returns?: HarassWithdrawSelection;
  /** One native battle location, selected only after the fixture chooses its storm-safe sector. */
  returnedForces?: HarassWithdrawForces;
  losses?: { normal: number; elite: number };
  substitute?: number;
  funding?: number;
  cleanupShield?: boolean;
  /** Return at the actual Face Dance offer, after ordinary cleanup. */
  stopAtFaceDance?: boolean;
};
export type OccupyCardsCase = {
  fixture: EcazOccupyFixture;
  actor: string;
  holder: string;
  card: string;
  shield?: string;
  actorLeader: string;
  opponentLeader: string;
  before: Game;
  revealed: Game;
  afterVotes: Game;
  game: Game;
};

/** Consume native aftermath offers only; never manufacture a phase or receipt. */
export function finishOccupyCardsAftermath(state: Game, options: Pick<OccupyCardsOptions,
  'losses' | 'substitute' | 'stopAtFaceDance'> = {}, discardCard?: string): Game {
  let game = state;
  for (let attempt = 0; attempt < 100; attempt++) {
    const decision = game.decision;
    if (game.response) game = allowEcazOccupyResponses(game);
    else if (decision?.kind === 'battleLosses') {
      const choice = options.losses ? decision.options.findIndex(loss =>
        loss.normal === options.losses!.normal && loss.elite === options.losses!.elite) : 0;
      assert.ok(choice >= 0, 'The original typed commitment must offer this physical loss allocation.');
      game = applyAction(game, decision.player, { type: 'decision', choice });
    } else if (decision?.kind === 'ixSubstitution') {
      const count = options.substitute ?? 0;
      const key = Object.keys(decision.losses).find(location => decision.losses[location] >= count);
      if (count) {
        assert.ok(key, 'A real lost Cyborg sector must fund substitution.');
        game = applyAction(game, decision.player, { type: 'decision',
          sources: { [key]: count }, recover: { [key]: count } });
      } else game = applyAction(game, decision.player, { type: 'decision', decline: true });
    } else if (decision?.kind === 'battleCards') {
      const discard = discardCard && decision.cards.includes(discardCard) ? [discardCard] : [];
      game = applyAction(game, decision.player, { type: 'decision', discard });
    } else if (decision?.kind === 'choamMarket') {
      game = applyAction(game, decision.player, { type: 'decision', done: true });
    } else if (game.pendingTreacheryDiscard) {
      game = applyAction(game, game.players[0].id, { type: 'advanceBots' });
    } else if (decision?.kind === 'faceDance' && options.stopAtFaceDance) return game;
    else {
      assert.equal(game.battle, null, 'The original sealed plans and votes must resolve.');
      assert.equal(game.decision, null, 'Every required native aftermath offer must finish.');
      return game;
    }
  }
  throw new Error('The original card battle aftermath did not finish.');
}

/** Original family deal, real Nexus alliance, shared entry and actual lead choice.
 * Only conserved physical hand/Traitor Card exchanges expose each printed rule. */
export function ecazOccupyCardsCase(options: OccupyCardsOptions = {}): OccupyCardsCase {
  const lead = options.lead ?? 'ecaz';
  const outcome = options.outcome ?? 'win';
  const slot = options.slot ?? 'weapon';
  const cardId = options.card ?? 'ecaz-harass-withdraw';
  const fixture = ecazOccupyFixture({ ...options,
    ecazTreachery: options.initial ? options.initial.ecazTreachery === true : true,
    ecazForces: options.ecazForces ?? 5, allyFaction: options.allyFaction ?? 'guild',
    opponentFaction: options.opponentFaction ?? 'emperor' });
  const actor = lead === 'ecaz' ? fixture.ecaz : fixture.ally;
  const holder = options.holder === 'opponent' ? fixture.opponent : actor;
  assert.equal(fixture.initial.ecazTreachery, true, 'This case requires an originally selected physical card variant.');
  const card = stageCard(fixture.game, holder, c => c.id === cardId);
  let game = options.canceled ? cancelEcazOccupy(fixture, lead) : chooseEcazOccupyLead(fixture, lead);
  game = allowEcazOccupyResponses(game);
  if (game.decision?.kind === 'choamBattleFunding')
    game = applyAction(game, game.decision.player, { type: 'decision', amount: options.funding ?? 0 });
  else assert.equal(options.funding ?? 0, 0, 'Funding requires the genuine CHOAM offer.');
  game = openEcazOccupyPlans(game);
  const profile = viewGame(game, actor).battle?.ecazOccupy?.profile;
  assert.ok(profile);
  let actorLeader = options.actorLeader ?? leader(game, actor, outcome !== 'loss',
    outcome === 'opposingTraitor' || outcome === 'mutualTraitors');
  let opponentLeader = leader(game, fixture.opponent, outcome === 'loss',
    outcome === 'soleTraitor' || outcome === 'mutualTraitors');
  if (options.stopAtFaceDance && !options.actorLeader) {
    const dancers = game.players.find(p => p.faction === 'tleilaxu')?.faceDancers;
    const candidate = occupyCardsPlayer(game, actor).leaders.find(l => !l.dead && !l.usedAt &&
      dancers?.some(c => !c.revealed && c.leader === l.id));
    assert.ok(candidate, 'Use the original first-draw Face Dancer of the real selected leader.');
    actorLeader = candidate.id;
  }
  if (options.equalLeaders) {
    const own = occupyCardsPlayer(game, actor).leaders.find(l => !l.dead && !l.usedAt &&
      occupyCardsPlayer(game, fixture.opponent).leaders.some(other =>
        !other.dead && !other.usedAt && other.strength === l.strength));
    assert.ok(own, 'The actual faction rosters must supply equal-strength leaders.');
    actorLeader = own.id;
    opponentLeader = occupyCardsPlayer(game, fixture.opponent).leaders.find(l =>
      !l.dead && !l.usedAt && l.strength === own.strength)!.id;
  }
  const voter = actor === fixture.ecaz ? fixture.ally : fixture.ecaz;
  if (outcome === 'soleTraitor' || outcome === 'mutualTraitors')
    holdOccupyCardsTraitor(game, voter, opponentLeader);
  if (outcome === 'opposingTraitor' || outcome === 'mutualTraitors')
    holdOccupyCardsTraitor(game, fixture.opponent, actorLeader);
  const ownCards: { weapon?: string; defense?: string } = {};
  const enemyCards: { weapon?: string; defense?: string } = {};
  (holder === actor ? ownCards : enemyCards)[slot] = card;
  if (options.opponentCard)
    enemyCards.weapon = stageCard(game, fixture.opponent, c => c.id === options.opponentCard);
  let shield: string | undefined;
  if (options.cleanupShield) {
    assert.equal(slot, 'weapon', 'The actual shield occupies the other legal slot.');
    shield = stageCard(game, actor, c => c.kind === 'shield');
    ownCards.defense = shield;
  }
  if (outcome === 'explosion') {
    const lasgunOwner = slot === 'defense' ? holder : holder === actor ? fixture.opponent : actor;
    const shieldOwner = lasgunOwner === actor ? fixture.opponent : actor;
    (lasgunOwner === actor ? ownCards : enemyCards).weapon =
      stageCard(game, lasgunOwner, c => c.kind === 'lasgun');
    (shieldOwner === actor ? ownCards : enemyCards).defense =
      stageCard(game, shieldOwner, c => c.kind === 'shield');
  }
  const variable = options.variableDial ?? 2;
  const free = occupyCardsPlayer(game, profile.forceOwner).faction === 'fremen';
  const support = options.support ?? (free ? 0 : variable);
  const opponentDial = options.opponentDial ?? (outcome === 'loss' ? 8 : 0);
  const before = structuredClone(game);
  game = applyAction(game, actor, { type: 'battlePlan', dial: profile.fixedEcazDial + variable,
    support, allyPayment: options.funding ?? 0, leader: actorLeader, ...ownCards });
  game = applyAction(game, fixture.opponent, { type: 'battlePlan', dial: opponentDial,
    support: options.opponentSupport ?? opponentDial, leader: opponentLeader, ...enemyCards });
  const revealed = structuredClone(game);
  if (game.decision?.kind === 'harassWithdraw') {
    const decision = game.decision;
    const offer = viewGame(game, decision.player).battle?.harassAllocation;
    assert.ok(offer, 'Use only the actual revealed physical allocation offer.');
    const returns = options.returns ?? (options.returnedForces ?
      { [fixture.location]: options.returnedForces } :
      defaultHarassWithdrawAllocation(offer.context, offer.dial, offer.support));
    game = applyAction(game, decision.player, { type: 'decision', event: decision.event, returns });
  }
  for (let attempt = 0; attempt < 10 && game.battle; attempt++) {
    const battle = viewGame(game, actor).battle;
    assert.ok(battle);
    const next = battle.traitorVoters.find(id => !battle.traitorSubmitted.includes(id));
    if (!next) break;
    const call = next === voter && (outcome === 'soleTraitor' || outcome === 'mutualTraitors') ||
      next === fixture.opponent && (outcome === 'opposingTraitor' || outcome === 'mutualTraitors');
    game = applyAction(game, next, { type: 'traitorCall', call });
  }
  const afterVotes = structuredClone(game);
  game = finishOccupyCardsAftermath(game, options, shield);
  return { fixture, actor, holder, card, shield, actorLeader, opponentLeader,
    before, revealed, afterVotes, game };
}
