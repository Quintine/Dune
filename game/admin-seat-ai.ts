import { adminSeatAiCoreShape } from './admin-seat-ai-shape';
import { applyAction, type Game } from './engine';
import { FACTIONS } from './catalog';
import { DIFFICULTIES, type Difficulty } from './bot-profiles';
import type { AdminSeatAiView } from '../lib/admin-seat-ai';

export const seatAiUnavailable = 'This saved game needs inspection before changing participant control.';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const counter = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < Number.MAX_SAFE_INTEGER;
const difficulty = (v: unknown) => v === undefined || DIFFICULTIES.some(d => d === v);
/** Guard the public envelope before projecting it; engine integrity guards run again on mutation. */
export function seatAiGame(value: unknown, code: string): value is Game {
  if (!adminSeatAiCoreShape(value) || !record(value) || value.code !== code || !['lobby','setup','playing','finished'].includes(String(value.status)) ||
    typeof value.advanced !== 'boolean' || !counter(value.version) || !Array.isArray(value.players) || value.players.length < 1 || value.players.length > 6 ||
    !Array.isArray(value.log) || value.log.length > 250 || !value.log.every((entry, index, log) => record(entry) && counter(entry.seq) && Number(entry.seq) > 0 && typeof entry.text === 'string' && (index === 0 || Number(entry.seq) > Number(log[index - 1].seq))) ||
    (value.botsPending !== undefined && typeof value.botsPending !== 'boolean') || (value.botNextActionAt !== undefined && !counter(value.botNextActionAt))) return false;
  return value.players.every(p => record(p) && typeof p.id === 'string' && !!p.id.trim() && p.id.length <= 80 && typeof p.name === 'string' && p.name.length <= 80 &&
    FACTIONS.some(f => f.id === p.faction) && difficulty(p.bot) && difficulty(p.autopilot) && !(p.bot && p.autopilot)) &&
    new Set(value.players.map(p => p.id)).size === value.players.length && new Set(value.players.map(p => p.faction)).size === value.players.length;
}
export function projectAdminSeatAi(base: Omit<AdminSeatAiView, 'status'|'players'|'editable'|'blockedReason'>, value: unknown, activeHumans: Set<string>): AdminSeatAiView {
  if (!seatAiGame(value, base.code)) return { ...base, status: 'unreadable', players: [], editable: false, blockedReason: seatAiUnavailable };
  const blockedReason = base.removed ? 'Restore this removed room first.' : base.archived ? 'Unarchive and reopen this room first.' : base.closed ? 'Reopen this room first.' :
    !['setup','playing'].includes(value.status) ? 'Participant AI is available only after the game starts and before it ends.' : !base.paused ? 'Pause this room before changing participant control.' : null;
  return { ...base, status: value.status, blockedReason, editable: blockedReason === null, players: value.players.map(p => ({
    id: p.id, name: p.name, faction: p.faction, control: p.bot ? 'ai' : p.autopilot ? 'autopilot' : 'human', difficulty: p.bot ?? p.autopilot ?? null,
    eligible: !p.bot && !p.autopilot && activeHumans.has(p.id),
  })) };
}
/** Uses the ordinary legal controller change, without room-worker scheduling or private projection. */
export function enableAdminSeatAi(game: Game, target: string, difficulty: Difficulty): Game {
  if (!seatAiGame(game, game.code)) throw new Error(seatAiUnavailable);
  const owner = game.players.find(p => p.id === target);
  if (!owner || owner.bot || owner.autopilot) throw new Error(seatAiUnavailable);
  const next = applyAction(game, target, { type: 'setAutopilot', difficulty });
  // setAutopilot appends one event, dropping the oldest at the 250-entry cap.
  const event = next.log.at(-1), seq = (game.log.at(-1)?.seq ?? 0) + 1;
  if (!event || event.seq !== seq || event.text !== `${owner.name} enabled ${difficulty} AI control for their seat.`) throw new Error(seatAiUnavailable);
  const expected = structuredClone(game);
  expected.players.find(p => p.id === target)!.autopilot = difficulty;
  expected.log.push({ seq, text: event.text }); if (expected.log.length > 250) expected.log.shift();
  if (JSON.stringify(next) !== JSON.stringify(expected)) throw new Error(seatAiUnavailable);
  event.text = `An administrator enabled ${difficulty} AI for ${owner.name}. The room remains paused; this player retains their seat and can take back control.`;
  return next;
}
