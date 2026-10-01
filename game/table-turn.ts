import type { GameView } from './engine';

type TurnView = Pick<
  GameView,
  | 'status'
  | 'active'
  | 'players'
  | 'decision'
  | 'battle'
  | 'response'
  | 'truthtrance'
  | 'phaseOpening'
  | 'automaticContinuationPending'
> &
  Partial<Pick<GameView, 'biddingEnd' | 'kullReaction' | 'richeseBetrayalReaction' | 'guildBetrayalReaction' | 'nexusIxianReplacement' | 'nexusIxianBetrayalReaction'>>;

/** The single current decision owner for the table banner and seat highlight.
 * Shared response windows have no single acting seat. Only public view fields
 * participate; this does not decide which gameplay actions are legal. */
export function tableActionOwner(g: TurnView): string | null {
  if (g.richeseBetrayalReaction || g.guildBetrayalReaction) return null;
  if (g.kullReaction && g.status === 'playing')
    return g.players.some(p => p.id === g.kullReaction!.player)
      ? g.kullReaction.player : null;
  if (
    g.status !== 'playing' ||
    g.automaticContinuationPending ||
    g.truthtrance ||
    g.phaseOpening ||
    g.response
  )
    return null;
  const seated = (id: string | null | undefined) =>
    g.players.some((p) => p.id === id) ? id! : null;
  // active is the runtime's public sole unfinished acknowledgement seat,
  // never the private card holder or native advantage provider.
  if (g.nexusIxianBetrayalReaction) return seated(g.active);
  if (g.nexusIxianReplacement) return seated(g.nexusIxianReplacement.buyer);
  if (g.decision) return seated(g.decision.player);
  if (g.biddingEnd) {
    const pending = g.biddingEnd.owners.filter(
      (id) => !g.biddingEnd!.ready.includes(id),
    );
    return pending.length === 1 ? seated(pending[0]) : null;
  }
  const b = g.battle;
  if (!b) return seated(g.active);
  const combatants = [b.attacker, b.defender];
  const sole = (ids: string[]) => (ids.length === 1 ? seated(ids[0]) : null);
  if (b.preLeader && !b.preLeader.closed)
    return sole(combatants.filter((id) => !b.preLeader!.ready.includes(id)));
  if (b.preparation) return seated(b.preparation.owner);
  if (!b.revealed) {
    if (b.fullPlan && !b.submitted.includes(b.fullPlan.target))
      return seated(b.fullPlan.target);
    return sole(combatants.filter((id) => !b.submitted.includes(id)));
  }
  return sole(b.traitorVoters.filter((id) => !b.traitorSubmitted.includes(id)));
}
