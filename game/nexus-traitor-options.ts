import type { Action, GameView } from './engine';
import { nexusCardMode } from './nexus-cards';
import { CHEAP_HERO_TRAITOR, matchingTraitor } from './traitors';

function quiet(game: GameView): boolean {
  return (
    game.status === 'playing' &&
    !game.automaticContinuationPending &&
    !game.truthtrance &&
    !game.response &&
    !game.decision &&
    !game.phaseOpening &&
    !game.nexusCards?.waiting.length
  );
}

/** The private server offer, not another player's hand, authorizes a draw. */
export function nexusTraitorDrawAction(
  game: GameView,
  event: string,
  mode: 'cunning' | 'secretAlly' | 'betrayal',
): Action | null {
  const offer = game.nexusTraitors?.offer;
  const owner = game.players.find((player) => player.id === game.me);
  if (
    game.status !== 'playing' ||
    game.truthtrance ||
    game.nexusCards?.waiting.length ||
    game.nexusTraitors?.pending ||
    !owner ||
    !event ||
    !offer ||
    offer.event !== event ||
    offer.mode !== mode ||
    offer.blocked ||
    mode === 'betrayal' ||
    game.nexusCards?.card !== 'harkonnen' ||
    owner.ally ||
    nexusCardMode(
      'harkonnen',
      owner.faction,
      game.players.map((player) => player.faction),
    ) !== mode ||
    offer.draw !== (mode === 'cunning' ? 1 : 2) ||
    (mode === 'secretAlly' && game.phase !== 8)
  )
    return null;
  return { type: 'nexusTraitorDraw', event, mode };
}

/** Return only the explicitly projected physical choices, never a reconstructed
 * traitor/Face Dancer hand. A returned new draw is as legal as an old identity. */
export function nexusTraitorReturnAction(
  game: GameView,
  event: string,
  cards: readonly string[],
): Action | null {
  const pending = game.nexusTraitors?.pending;
  if (
    game.status !== 'playing' ||
    game.truthtrance ||
    !pending ||
    pending.owner !== game.me ||
    !event ||
    pending.event !== event ||
    !game.players.some((player) => player.id === game.me) ||
    !['cunning', 'secretAlly'].includes(pending.mode) ||
    pending.count !== (pending.mode === 'cunning' ? 1 : 2) ||
    (pending.mode === 'secretAlly' && game.phase !== 8) ||
    cards.length !== pending.count ||
    new Set(cards).size !== cards.length ||
    !cards.every((id) => pending.choices.some((choice) => choice.id === id))
  )
    return null;
  return { type: 'nexusTraitorReturn', event, cards: [...cards] };
}

function returnPreference(game: GameView, id: string): number {
  const owner = game.players.find((player) => player.id === game.me)!;
  const battle = game.battle;
  if (
    battle?.revealed &&
    [battle.attacker, battle.defender].includes(owner.id)
  ) {
    const target =
      battle.attacker === owner.id ? battle.defender : battle.attacker;
    const leader = battle.plans[target]?.leader;
    if (
      leader &&
      matchingTraitor(
        [id],
        leader,
        battle.cards.find((card) => card.id === leader),
      )
    )
      return 1000;
  }
  if (id === CHEAP_HERO_TRAITOR) return 0;
  const identity = game.allLeaders.find((leader) => leader.id === id);
  const publicLeader = game.players
    .flatMap((player) => player.leaders)
    .find((leader) => leader.id === id);
  return (
    (identity?.faction === owner.faction ? -100 : 0) +
    (publicLeader?.dead ? -20 : 0) +
    (identity?.strength ?? 0)
  );
}

/** Shared legal policy only; ranking uses public leaders and this viewer's
 * authorized choices. It makes no claim of calibrated faction strategy. */
export function nexusTraitorBotActions(game: GameView): Action[] {
  const pending = game.nexusTraitors?.pending;
  if (pending) {
    if (
      pending.owner !== game.me ||
      game.truthtrance ||
      game.status !== 'playing'
    )
      return [];
    const cards = [...pending.choices]
      .sort(
        (one, two) =>
          returnPreference(game, one.id) - returnPreference(game, two.id),
      )
      .slice(0, pending.count)
      .map((choice) => choice.id);
    const action = nexusTraitorReturnAction(game, pending.event, cards);
    return action ? [action] : [];
  }
  const offer = game.nexusTraitors?.offer;
  if (!offer || !quiet(game)) return [];
  if (offer.mode === 'cunning') {
    const battle = game.battle;
    const beforeCall =
      game.phase === 6 &&
      battle?.revealed &&
      [battle.attacker, battle.defender].includes(game.me) &&
      battle.traitorVoters.includes(game.me) &&
      !battle.traitorSubmitted.includes(game.me);
    if (!beforeCall && game.phase !== 8) return [];
  }
  const action = nexusTraitorDrawAction(game, offer.event, offer.mode);
  return action ? [action] : [];
}
