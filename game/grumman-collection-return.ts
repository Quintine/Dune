import type { Game } from './engine';
import { HomeworldCustodyError } from './homeworld-custody';
import { TERROR_STRONGHOLDS } from './moritani-terror';
import { terrorLocationAllowed, type TerrorLocationContext } from './terror-location';

export type GrummanCollection = {
  event: string;
  turn: number;
  player: string;
  stage: 'waiting' | 'choice' | 'complete';
  outcome?: 'add' | 'remove' | 'decline' | 'expired';
  token?: string;
  territory?: string;
  /** Earned Grumman Cunning receipt, never a removal or Mentat source. */
  nexusEvent?: string;
  signature: string;
};

/** Bind phase progress so a completed operation cannot rewind to a choice. */
export function grummanCollectionSignature(frame: Omit<GrummanCollection, 'signature'>): string {
  return JSON.stringify(['grummanCollection', frame.event, frame.turn, frame.player,
    frame.stage, frame.outcome ?? null, frame.token ?? null, frame.territory ?? null,
    ...(frame.nexusEvent === undefined ? [] : [frame.nexusEvent])]);
}

export function validateGrummanCollection(g: Pick<Game, 'turn' | 'phase' | 'players' | 'homeworlds' | 'grummanCollection'> & TerrorLocationContext): void {
  const frame = g.grummanCollection;
  if (frame === undefined) return;
  const text = (s: unknown): s is string => typeof s === 'string' && !!s;
  if (!frame || typeof frame !== 'object' || Array.isArray(frame) ||
    Object.keys(frame).some((key) => !['event', 'turn', 'player', 'stage', 'outcome', 'token', 'territory', 'nexusEvent', 'signature'].includes(key)) ||
    !text(frame.event) || !text(frame.player) || !Number.isSafeInteger(frame.turn) || frame.turn < 1 || frame.turn > g.turn ||
    !g.homeworlds?.custody || g.players.filter((p) => p.id === frame.player && p.faction === 'moritani').length !== 1 ||
    !['waiting', 'choice', 'complete'].includes(frame.stage) ||
    (frame.stage !== 'complete' && (frame.turn !== g.turn || g.phase !== 7)) ||
    (frame.stage === 'complete' ? !['add', 'remove', 'decline', 'expired'].includes(frame.outcome ?? '') : frame.outcome !== undefined) ||
    (frame.outcome === 'add' || frame.outcome === 'remove'
      ? !text(frame.token) || !text(frame.territory) ||
        (frame.outcome === 'add' && frame.nexusEvent !== undefined
          ? !text(frame.nexusEvent) || !terrorLocationAllowed(g, frame.token, frame.territory, frame.nexusEvent, false, true)
          : frame.outcome === 'add'
            ? !TERROR_STRONGHOLDS.includes(frame.territory)
            : !terrorLocationAllowed(g, frame.token, frame.territory, undefined, false, true))
      : frame.token !== undefined || frame.territory !== undefined) ||
    (frame.nexusEvent !== undefined && frame.outcome !== 'add') ||
    frame.signature !== grummanCollectionSignature(frame))
    throw new HomeworldCustodyError('The saved Grumman Collection opportunity no longer matches its original phase and completion.');
}
