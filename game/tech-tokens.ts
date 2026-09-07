export const TECH_TOKENS = [
  {
    id: 'axlotl',
    name: 'Axlotl Tanks',
    faction: 'tleilaxu',
    except: 'tleilaxu',
    phase: 4,
  },
  {
    id: 'heighliners',
    name: 'Heighliners',
    faction: 'ixians',
    except: 'guild',
    phase: 5,
  },
  {
    id: 'production',
    name: 'Spice Production',
    faction: 'fremen',
    except: 'beneGesserit',
    phase: 2,
  },
] as const;
export type TechId = (typeof TECH_TOKENS)[number]['id'];
export type TechState = Record<
  TechId,
  { owner: string | null; spice: number; triggeredTurn?: number }
>;
export function createTechTokens(
  players: { id: string; faction: string }[] = [],
): TechState {
  return Object.fromEntries(
    TECH_TOKENS.map((token) => [
      token.id,
      {
        owner: players.find((p) => p.faction === token.faction)?.id ?? null,
        spice: 0,
      },
    ]),
  ) as TechState;
}
export function ownedTech(
  state: TechState | null | undefined,
  player: string,
): TechId[] {
  return state
    ? TECH_TOKENS.filter((t) => state[t.id].owner === player).map((t) => t.id)
    : [];
}
export function techStronghold(
  state: TechState | null | undefined,
  player: string,
) {
  return ownedTech(state, player).length === 3 ? 1 : 0;
}
