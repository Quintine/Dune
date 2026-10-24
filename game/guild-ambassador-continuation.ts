import { validAmbassadorResume } from './ambassador-resume';
import { ambassadorPhaseAllowed } from './ambassador-phase';
import type { Game } from './engine';
import type { GuildAmbassadorShipment } from './guild-ambassador';
import { validLocation, territory } from './board';
import { validateAmbassadors } from './ecaz-ambassadors';

export class GuildAmbassadorContinuationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GuildAmbassadorContinuationError';
  }
}
export type GuildAmbassadorArrivalContext = Pick<
  Game,
  | 'status'
  | 'turn'
  | 'phase'
  | 'players'
  | 'pendingAmbassador'
  | 'ecazAmbassadors'
  | 'homeworlds'
  | 'homeworldRevivalReturn'
  | 'homeworldRevivalProgress'
  | 'homeworldVictoryReinforcement'
  | 'lastBattleContext'
>;
export type GuildAmbassadorArrivalNext =
  | 'income'
  | 'intrusion'
  | 'terror'
  | 'accompany'
  | 'advisor'
  | 'finish';
type AdvisorArrival = NonNullable<
  NonNullable<
    NonNullable<Game['pendingAmbassador']>['shipmentReceipt']
  >['advisorArrival']
>;
function requireArrival(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new GuildAmbassadorContinuationError(message);
}
const whole = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const boardLocation = (name: unknown, sector: unknown): name is string =>
  id(name) && whole(sector) && validLocation(name, sector);

/** Prove only the already committed shipment and the next saved child boundary.
 * Alliances, forces, reserves, storm and mobile pointer may change afterward.
 * Returned receipt references are read-only; this function never mutates them. */
export function validateGuildAmbassadorArrivalContext(
  g: GuildAmbassadorArrivalContext,
  event: unknown,
  next: GuildAmbassadorArrivalNext,
): {
  order: Readonly<GuildAmbassadorShipment>;
  advisorArrival?: Readonly<AdvisorArrival>;
} {
  const entry = g.pendingAmbassador;
  requireArrival(
    g.status === 'playing' &&
      whole(g.turn) &&
      g.turn > 0 &&
      ambassadorPhaseAllowed(g) &&
      Array.isArray(g.players) &&
      g.players.every((p) => id(p.id)) &&
      new Set(g.players.map((p) => p.id)).size === g.players.length &&
      entry &&
      entry.stage === 'arrival' &&
      entry.effect === 'guild' &&
      entry.turn === g.turn &&
      entry.phase === g.phase &&
      id(event) &&
      entry.event === event &&
      ['income', 'intrusion', 'terror', 'accompany', 'advisor', 'finish'].includes(
        next,
      ) &&
      record(entry.shipmentReceipt) &&
      entry.shipmentReceipt.next === next &&
      entry.relocation === undefined &&
      entry.purchaseReceipt === undefined,
    'The saved Guild Ambassador arrival has no matching shipment event or continuation.',
  );
  const owner = g.players.find((p) => p.id === entry.owner);
  const entrant = g.players.find((p) => p.id === entry.entrant);
  const beneficiary = g.players.find((p) => p.id === entry.beneficiary);
  requireArrival(
    owner?.faction === 'ecaz' &&
      g.players.filter((p) => p.faction === 'ecaz').length === 1 &&
      entrant &&
      beneficiary &&
      entrant.id !== owner.id &&
      entrant.id !== beneficiary.id &&
      boardLocation(entry.territory, entry.sector) &&
      territory(entry.territory).type === 'stronghold' &&
      validAmbassadorResume(g, entry),
    'The saved Guild Ambassador arrival has an invalid original entry or seated beneficiary.',
  );
  requireArrival(
    g.ecazAmbassadors,
    'The shipment has no Ambassador token inventory.',
  );
  try {
    validateAmbassadors(g.ecazAmbassadors);
  } catch {
    throw new GuildAmbassadorContinuationError(
      'The shipment has invalid Ambassador token custody.',
    );
  }
  const token = g.ecazAmbassadors.tokens.find((t) => t.id === entry.token);
  requireArrival(
    token &&
      token.effect !== entrant.faction &&
      ((token.effect === 'guild' && token.zone === 'used') ||
        (token.effect === 'beneGesserit' &&
          token.zone === 'removed' &&
          Array.isArray(entry.copyChoices) &&
          entry.copyChoices.includes('guild') &&
          !g.ecazAmbassadors.cohort.some((tokenId) =>
            g.ecazAmbassadors!.tokens.some(
              (t) => t.id === tokenId && t.effect === 'guild',
            ),
          ))),
    'The shipment does not belong to its consumed Guild Ambassador or valid BG copy.',
  );
  const order = entry.shipmentReceipt.order;
  requireArrival(
    record(order) &&
      order.player === beneficiary.id &&
      whole(order.amount) &&
      (order.amount >= 1 || !!order.marker) &&
      order.amount <= 4 &&
      whole(order.elite) &&
      order.elite <= order.amount &&
      (order.marker ? [0,1,2].includes(order.cost) : order.cost === 0) &&
      order.allyPayment === 0 &&
      typeof order.advisors === 'boolean' &&
      boardLocation(order.territory, order.sector) &&
      !Object.hasOwn(order, 'noField') &&
      !Object.hasOwn(order, 'alliedNoField'),
    'The saved Guild Ambassador receipt is not a physical free reserve shipment.',
  );
  if (order.marker) {
    const marker = order.marker, supplier = g.players.find(p => p.id === marker.owner);
    requireArrival(entry.shipmentReceipt.markerCommitSignature === JSON.stringify(order) &&
      supplier?.faction === 'richese' && id(marker.tokenEvent) && id(marker.stateSignature) &&
      supplier.noField?.tokens.some(token => token.id === marker.tokenId && token.value === marker.value) &&
      (marker.mode === 'own' ? marker.owner === beneficiary.id && order.amount === 1 && order.elite === 0 &&
        order.cost === 0 && marker.ownerPayment === 0 && marker.recipientPayment === 0 :
        marker.mode === 'allied' && marker.owner !== beneficiary.id &&
        order.amount <= marker.value && order.cost === (territory(order.territory).type === 'stronghold' ? 1 : 2) &&
        whole(marker.ownerPayment) && whole(marker.recipientPayment) &&
        marker.ownerPayment + marker.recipientPayment === order.cost) &&
      (next !== 'income' || marker.mode === 'allied' && order.cost > 0),
      'The committed independent marker shipment has lost its original receipt.');
  } else requireArrival(next !== 'income' && entry.shipmentReceipt.markerCommitSignature === undefined,
    'An ordinary free shipment has no marker payment continuation.');
  const advisorArrival = entry.shipmentReceipt.advisorArrival;
  requireArrival(
    next === 'finish' ? record(advisorArrival) : advisorArrival === undefined,
    'The Guild Ambassador advisor arrival does not match its continuation stage.',
  );
  if (advisorArrival) {
    const bg = g.players.find((p) => p.id === advisorArrival.player);
    requireArrival(
      bg?.faction === 'beneGesserit' &&
        bg.id !== order.player &&
        g.players.filter((p) => p.faction === 'beneGesserit').length === 1 &&
        (advisorArrival.amount === 1 ||
          (advisorArrival.amount === 2 &&
            !!g.homeworlds?.custody &&
            advisorArrival.territory === 'polar_sink' &&
            advisorArrival.sector === 0)) &&
        advisorArrival.elite === 0 &&
        boardLocation(advisorArrival.territory, advisorArrival.sector) &&
        (advisorArrival.territory === order.territory ||
          (advisorArrival.territory === 'polar_sink' &&
            advisorArrival.sector === 0)),
      'The saved accompanying advisor does not match this shipment destination and owner.',
    );
    // This is a committed arrival: the batch itself or later child effects can
    // lower Wallach below high. Rechecking today's allowance would invalidate
    // legal historical receipts. Declaration/commit prove the original limit.
  }
  return { order, ...(advisorArrival ? { advisorArrival } : {}) };
}
