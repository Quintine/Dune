export type SaphoAggressorUse = { event: string; player: string };
export type SaphoAggressorState = {
  version: 1;
  battle: string;
  turn: number;
  attacker: string;
  defender: string;
  uses: SaphoAggressorUse[];
};
type BattleIdentity = { event?: string; attacker: string; defender: string };
export class SaphoAggressorError extends Error {}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new SaphoAggressorError(message);
}
/** Habbanya's printed exception applies to either stable combat slot. */
export function battleTieOwner(attacker: string, defender: string, aggressor: string,
  habbanyaOwners: readonly string[]): string {
  check(attacker !== defender && [attacker, defender].includes(aggressor) &&
    habbanyaOwners.length <= 1 && habbanyaOwners.every(id => [attacker, defender].includes(id)),
  'The battle tie priority needs distinct combatants and at most one Habbanya owner.');
  return habbanyaOwners[0] ?? aggressor;
}
export function saphoAggressorEvent(battle: string, turn: number, revision: number) {
  return `saphoAggressor:${JSON.stringify([battle, turn, revision])}`;
}
/** Preserve physical slots. Only explicit, battle-bound uses change tie priority. */
export function validateSaphoAggressor(
  state: SaphoAggressorState | undefined,
  events: readonly string[] | undefined,
  battle: BattleIdentity,
  turn: number,
): string {
  check(!!state === !!events, 'The saved Sapho aggressor needs its independent use events.');
  if (!state) return battle.attacker;
  check(state && typeof state === 'object' && !Array.isArray(state) &&
    Object.keys(state).sort().join(',') === 'attacker,battle,defender,turn,uses,version' &&
    state.version === 1 && state.battle === battle.event &&
    typeof state.battle === 'string' && state.battle.length > 0 &&
    Number.isSafeInteger(turn) && turn >= 1 && state.turn === turn &&
    state.attacker === battle.attacker && state.defender === battle.defender &&
    typeof state.attacker === 'string' && state.attacker.length > 0 &&
    typeof state.defender === 'string' && state.defender.length > 0 &&
    state.attacker !== state.defender && Array.isArray(state.uses) && state.uses.length > 0 &&
    Array.isArray(events) && events.length === state.uses.length,
  'The saved Sapho aggressor does not match this battle.');
  let aggressor = state.attacker;
  for (const [index, use] of state.uses.entries()) {
    check(use && typeof use === 'object' && !Array.isArray(use) &&
      Object.keys(use).sort().join(',') === 'event,player' &&
      use.event === saphoAggressorEvent(state.battle, turn, index) && events[index] === use.event &&
      [state.attacker, state.defender].includes(use.player) && use.player !== aggressor,
    'The saved Sapho aggressor use is stale or invalid.');
    aggressor = use.player;
  }
  return aggressor;
}
export function changeSaphoAggressor(
  state: SaphoAggressorState | undefined,
  events: readonly string[] | undefined,
  battle: BattleIdentity,
  turn: number,
  player: string,
  event: string,
): SaphoAggressorState {
  const aggressor = validateSaphoAggressor(state, events, battle, turn);
  check(typeof battle.event === 'string' && battle.event.length > 0 &&
    [battle.attacker, battle.defender].includes(player) && player !== aggressor &&
    event === saphoAggressorEvent(battle.event, turn, state?.uses.length ?? 0),
  'This Sapho aggressor opportunity is unavailable or expired.');
  return { version: 1, battle: battle.event, turn, attacker: battle.attacker,
    defender: battle.defender, uses: [...(state?.uses ?? []), { event, player }] };
}
