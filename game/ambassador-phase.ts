import type { Game } from './engine';
import { location } from './board';
import { validAmbassadorResume } from './ambassador-resume';
import { validateHomeworldRevivalReturn } from './homeworld-revival-return';
import { validateHomeworldVictoryReturn } from './homeworld-victory-return';
import {
  validateHomeworldArrival,
  type HomeworldArrivalFrame,
  type HomeworldArrivalTag,
} from './homeworld-arrival';

export type AmbassadorPhaseContext = Pick<
  Game,
  | 'turn'
  | 'phase'
  | 'players'
  | 'homeworlds'
  | 'homeworldRevivalReturn'
  | 'homeworldRevivalProgress'
  | 'homeworldVictoryReinforcement'
  | 'lastBattleContext'
  | 'pendingAmbassador'
>;

/** Extra phases belong only to the recorded arrival and its actual BG suffixes. */
export function ambassadorPhaseAllowed(g: AmbassadorPhaseContext): boolean {
  const entry = g.pendingAmbassador;
  const candidates: {
    tag: HomeworldArrivalTag;
    frame: HomeworldArrivalFrame | undefined;
  }[] = [
    { tag: 'revivalEvent', frame: g.homeworldRevivalReturn },
    { tag: 'victoryEvent', frame: g.homeworldVictoryReinforcement },
  ];
  const matching = candidates.filter(
    ({ tag, frame }) =>
      entry &&
      (entry[tag] !== undefined ||
        (Array.isArray(frame?.ambassadors) &&
          frame.ambassadors.some((record) => record?.event === entry.event))),
  );
  if (!matching.length) return g.phase === 1 || g.phase === 5;
  if (matching.length !== 1) return false;
  const { tag, frame } = matching[0];
  if (
    !entry ||
    !frame ||
    entry[tag] !== frame.event ||
    frame.stage !== 'arrival' ||
    frame.turn !== g.turn ||
    frame.phase !== g.phase ||
    entry.turn !== g.turn ||
    entry.phase !== g.phase ||
    entry.resume !== 'none' ||
    !validAmbassadorResume(g, entry)
  )
    return false;
  try {
    if (tag === 'revivalEvent')
      validateHomeworldRevivalReturn(g, g.homeworldRevivalReturn);
    else validateHomeworldVictoryReturn(g);
    validateHomeworldArrival(g, frame, tag);
  } catch {
    return false;
  }
  const record = frame.ambassadors!.at(-1);
  if (
    !record ||
    record.completed ||
    record.event !== entry.event ||
    record.entrant !== entry.entrant ||
    record.destination !== location(entry.territory, entry.sector)
  )
    return false;
  return record.parent === undefined
    ? entry.guildAdvisorOrigin === undefined
    : entry.guildAdvisorOrigin?.event === record.parent;
}
