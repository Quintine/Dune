import { MOBILE_STRONGHOLD, validLocation, splitLocation } from './board';
import type { FactionId } from './catalog';
import { fighterCount } from './advisors';
import type { ForcePresence } from './force-presence';

export type StrongholdId =
  | 'arrakeen'
  | 'carthag'
  | 'habbanya_ridge_sietch'
  | 'sietch_tabr'
  | 'tueks_sietch'
  | typeof MOBILE_STRONGHOLD;
export type StrongholdState = {
  owners: Record<StrongholdId, string | null>;
  claimedTurn: number;
};
export type StrongholdCard = {
  id: StrongholdId;
  name: string;
  summary: string;
  gameplay: string[];
};
/** Original guidance from the six verified physical faces in
 * docs/STRONGHOLD_CARDS.md. Ownership lifecycle: publisher
 * CHOAM & Richese rulebook p9; Ecaz co-occupation: Ecaz & Moritani p8.
 * These are separate public module cards, never Treachery hand/deck cards.
 */
export const STRONGHOLD_CARDS: readonly StrongholdCard[] = [
  {
    id: 'arrakeen',
    name: 'Arrakeen',
    summary: 'The bank covers up to two spice of battle force support here.',
    gameplay: [
      'When you pay spice to support forces in a battle in Arrakeen, the bank pays the first two spice, up to the support actually required.',
      'This contribution reduces your support payment; it does not put two spice in your personal supply.',
    ],
  },
  {
    id: 'carthag',
    name: 'Carthag',
    summary: 'A non-poison defense can also protect against poison here.',
    gameplay: [
      'In a battle in Carthag where you do not use a poison weapon, a non-poison defense you play also provides Snooper protection.',
      'The benefit requires a played defense; it does not create a defense card in an empty slot.',
    ],
  },
  {
    id: 'habbanya_ridge_sietch',
    name: 'Habbanya Sietch',
    summary: 'Win tied battles here regardless of normal battle priority.',
    gameplay: [
      'When a battle in Habbanya Sietch is tied, you win the tie.',
      'This takes precedence over storm order and the battle priority granted by Juice of Sapho.',
    ],
  },
  {
    id: 'sietch_tabr',
    name: 'Sietch Tabr',
    summary: 'A battle win here earns spice based on the opposing dial.',
    gameplay: [
      'After winning a battle in Sietch Tabr, collect spice from the bank equal to your opponent’s dial, rounded down.',
      'Losing the battle does not earn this payment.',
    ],
  },
  {
    id: 'tueks_sietch',
    name: 'Tuek’s Sietch',
    summary: 'Played Worthless cards earn two spice each in battles here.',
    gameplay: [
      'Collect two spice from the bank for each Worthless card you play in a battle in Tuek’s Sietch.',
      'You receive this payment even if you lose the battle, except when both leaders are revealed as traitors.',
    ],
  },
  {
    id: MOBILE_STRONGHOLD,
    name: 'Ixian Hidden Mobile Stronghold',
    summary:
      'Before plans, announce another controlled stronghold advantage to copy.',
    gameplay: [
      'For a battle in the Hidden Mobile Stronghold, choose the advantage of another stronghold you control.',
      'Announce the copied stronghold before Battle Plans are made. The mobile card does not copy itself.',
    ],
  },
];
const ids = STRONGHOLD_CARDS.map((card) => card.id);
const validId = (value: unknown): value is StrongholdId =>
  typeof value === 'string' && ids.includes(value as StrongholdId);
const requireValid = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
};
function validateOwners(owners: Record<StrongholdId, string | null>) {
  requireValid(
    owners && typeof owners === 'object' && !Array.isArray(owners),
    'Stronghold owners must be a complete card map.',
  );
  requireValid(
    Object.keys(owners).length === ids.length &&
      Object.keys(owners).every(validId) &&
      ids.every(
        (id) =>
          owners[id] === null ||
          (typeof owners[id] === 'string' && owners[id].length > 0),
      ),
    'Each Stronghold Card needs one player ID or a null owner.',
  );
}
function validateState(state: StrongholdState) {
  requireValid(
    state && typeof state === 'object',
    'A Stronghold Card state is required.',
  );
  validateOwners(state.owners);
  requireValid(
    Number.isSafeInteger(state.claimedTurn) && state.claimedTurn >= 0,
    'Stronghold acquisition turn must be a nonnegative whole number.',
  );
}
export function createStrongholdCards(): StrongholdState {
  return {
    owners: Object.fromEntries(
      ids.map((id) => [id, null]),
    ) as StrongholdState['owners'],
    claimedTurn: 0,
  };
}
export function ownedStrongholdCards(
  state: StrongholdState | null | undefined,
  player: string,
): StrongholdCard[] {
  if (!state) return [];
  validateState(state);
  return STRONGHOLD_CARDS.filter(
    (card) => state.owners[card.id] === player,
  ).map((card) => ({ ...card, gameplay: [...card.gameplay] }));
}
/** Retained physical card custody determines the benefit in its own territory.
 * The caller validates a mobile copy against CURRENT physical control at its
 * public pre-plan declaration. The copy does not require owning that other card.
 * This distinguishes the face's 'control' wording from end-turn card custody;
 * combined timing remains an explicit source-composition interpretation.
 */
export function strongholdBenefit(
  state: StrongholdState | null | undefined,
  player: string,
  territory: string,
  copy?: StrongholdId | null,
): StrongholdId | null {
  if (!state) return null;
  validateState(state);
  if (!validId(territory) || state.owners[territory] !== player) return null;
  if (territory !== MOBILE_STRONGHOLD) return territory;
  return validId(copy) && copy !== MOBILE_STRONGHOLD ? copy : null;
}
type ControlPlayer = ForcePresence & {
  id: string;
  faction: FactionId;
  ally: string | null;
  advisors?: Record<string, { lockedTurn?: number }>;
};
/** Caller settles obsolete BG advisor stances before taking this pure snapshot.
 * No storm exclusion: sole surviving occupants can control a storm-covered site.
 */
export function strongholdControllers(
  players: readonly ControlPlayer[],
  mobileAvailable: boolean,
): StrongholdState['owners'] {
  requireValid(
    typeof mobileAvailable === 'boolean',
    'Specify whether the mobile stronghold is placed.',
  );
  requireValid(
    Array.isArray(players) &&
      new Set(players.map((p) => p.id)).size === players.length,
    'Stronghold control needs distinct player IDs.',
  );
  for (const p of players) {
    requireValid(
      typeof p.id === 'string' && p.id.length > 0,
      'A controller needs a player ID.',
    );
    for (const [key, amount] of Object.entries(p.forces)) {
      const at = splitLocation(key);
      requireValid(
        validLocation(at.territory, at.sector) &&
          Number.isSafeInteger(amount) &&
          amount >= 0,
        'Stronghold control requires valid physical force locations and counts.',
      );
    }
    const marker = p.noField?.deployed?.location;
    requireValid(
      !marker || validLocation(marker.territory, marker.sector),
      'The No-Field must occupy a valid location.',
    );
  }
  const owners = createStrongholdCards().owners;
  for (const id of ids) {
    if (id === MOBILE_STRONGHOLD && !mobileAvailable) continue;
    const occupants = players.filter((p) => fighterCount(p, id) > 0);
    if (occupants.length === 1) owners[id] = occupants[0].id;
    else if (occupants.length === 2) {
      const ecaz = occupants.find((p) => p.faction === 'ecaz');
      const ally =
        ecaz && occupants.find((p) => p.id === ecaz.ally && p.ally === ecaz.id);
      if (ecaz && ally) owners[id] = ecaz.id;
    }
  }
  return owners;
}
/** Once per end-Mentat checkpoint. Never transfer custody during ordinary play. */
export function settleStrongholdCards(
  state: StrongholdState,
  turn: number,
  controllers: StrongholdState['owners'],
): StrongholdState {
  validateState(state);
  validateOwners(controllers);
  requireValid(
    Number.isSafeInteger(turn) && turn >= 1 && turn >= state.claimedTurn,
    'Stronghold settlement requires a current non-stale positive turn.',
  );
  return {
    owners: { ...(turn === state.claimedTurn ? state.owners : controllers) },
    claimedTurn: turn,
  };
}
function quantity(value: number, label: string) {
  requireValid(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= Number.MAX_SAFE_INTEGER,
    `${label} must be a finite nonnegative quantity.`,
  );
}
export function strongholdSupportCost(
  effect: StrongholdId | null | undefined,
  support: number,
): number {
  quantity(support, 'Battle support');
  requireValid(
    effect == null || validId(effect),
    'Unknown Stronghold Card effect.',
  );
  return effect === 'arrakeen' ? Math.max(0, support - 2) : support;
}
/** Returns a bank-payment amount only; the authoritative outcome commits it once. */
export function strongholdBattleIncome(
  effect: StrongholdId | null | undefined,
  won: boolean,
  opponentDial: number,
  worthlessCount: number,
): number {
  requireValid(
    effect == null || validId(effect),
    'Unknown Stronghold Card effect.',
  );
  requireValid(typeof won === 'boolean', 'Battle victory must be known.');
  quantity(opponentDial, 'Opposing dial');
  requireValid(
    Number.isSafeInteger(worthlessCount) &&
      worthlessCount >= 0 &&
      worthlessCount <= Math.floor(Number.MAX_SAFE_INTEGER / 2),
    'Played Worthless count must be a nonnegative safe whole number.',
  );
  if (effect === 'sietch_tabr') return won ? Math.floor(opponentDial) : 0;
  if (effect === 'tueks_sietch') return 2 * worthlessCount;
  return 0;
}
