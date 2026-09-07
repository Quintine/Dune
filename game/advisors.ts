import type { Game, Player } from './engine';
import { presenceAt, type ForcePresence } from './force-presence';

/** Effective presence includes a concealed No-Field; physical units stay in forces. */
export const forceCount = presenceAt;
export const isAdvisor = (
  p: Pick<Player, 'faction' | 'advisors'>,
  territory: string,
) => p.faction === 'beneGesserit' && !!p.advisors?.[territory];
export const fighterCount = (
  p: Pick<Player, 'faction' | 'advisors'> & ForcePresence,
  territory: string,
) => (isAdvisor(p, territory) ? 0 : forceCount(p, territory));

/** One stance per territory, regardless of how many sectors contain tokens. */
export function settleAdvisors(g: Game) {
  if (!g.advanced) return;
  const bg = g.players.find((p) => p.faction === 'beneGesserit');
  if (!bg?.advisors) return;
  for (const t of Object.keys(bg.advisors)) {
    if (
      !forceCount(bg, t) ||
      !g.players.some((p) => p.id !== bg.id && forceCount(p, t))
    )
      delete bg.advisors[t];
  }
}

/** Direct shipments are fighters unless joining existing advisors. */
export function arrivalAsAdvisor(
  g: Game,
  p: Player,
  to: string,
  source?: string,
  accompanying = false,
) {
  if (!g.advanced || p.faction !== 'beneGesserit') return false;
  if (!g.players.some((other) => other.id !== p.id && forceCount(other, to)))
    return false;
  if (forceCount(p, to)) return isAdvisor(p, to);
  return accompanying || (!!source && isAdvisor(p, source));
}
