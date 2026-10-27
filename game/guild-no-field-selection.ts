import type { Action, GameView } from './engine';

/** Entitled identity and public location only. Native transport owns legality;
 * the concealed denomination and reserve population do not grant permission. */
export function guildNoFieldSelection(g: GameView, action: Action) {
  const info = g.richeseNoField;
  const marker = info?.public.deployed;
  const owned = info?.private?.deployed;
  if (action.type !== 'guildShip' || typeof action.noField !== 'string' ||
      !info || info.owner !== g.me || action.event !== info.event ||
      !marker || marker.controller !== g.me || !owned ||
      owned.controller !== g.me || owned.tokenId !== action.noField)
    return null;
  return { token: owned.tokenId, event: info.event, location: { ...marker.location } };
}
