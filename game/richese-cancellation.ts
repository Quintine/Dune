import type { Decision, Game, ResponseWindow } from './engine';
import { RICHESE_CARD_DEFINITIONS } from './richese-cards';

// Exhaustive typed discriminants for the existing engine control unions. These
// are envelope checks, not a duplicate implementation of each future choice.
const DECISIONS = {
  choamAudit: true,
  choamAuditPayment: true,
  strongholdCopy: true,
  richeseBlackMarket: true,
  richeseDeclaration: true,
  richeseCache: true,
  richeseUnbid: true,
  richeseAllyShipment: true,
  richeseAllyOpportunity: true,
  ecazAmbassador: true,
  moritaniTerror: true,
  moritaniSetup: true,
  moritaniPlacement: true,
  ecazPlacement: true,
  ecazSpice: true,
  homeworldRevivalDeployment: true,
  caladanReinforcement: true,
  grummanCollection: true,
  choamStorm: true,
  choamMovement: true,
  choamMentat: true,
  choamFreeRevival: true,
  choamBattleFunding: true,
  choamMarket: true,
  choamTradeReply: true,
  choamTradeConfirm: true,
  ixSetup: true,
  ixAuction: true,
  ixTechnology: true,
  ixAllyCard: true,
  mobileStronghold: true,
  ixSubstitution: true,
  revivalStop: true,
  faceDance: true,
  techToken: true,
  poisonTooth: true,
  stoneBurner: true,
  fullPlanOffer: true,
  fullPlanRead: true,
  guildShipment: true,
  homeworldShipmentGuild: true,
  nullentropy: true,
  handExchange: true,
  battleLosses: true,
  homeworldExplosion: true,
  homeworldDefense: true,
  captureOffer: true,
  capturedLeader: true,
  guildTiming: true,
  auctionPayment: true,
  advisor: true,
  intrusion: true,
  advisorBattle: true,
  stormLosses: true,
  wormPlacement: true,
  wormProtection: true,
  wormRide: true,
  moritaniRetention: true,
  battleCards: true,
} satisfies Record<Decision['kind'], true>;
const RESPONSES = {
  moritaniPlacement: true,
  ecazPlacement: true,
  ecazCollection: true,
  moritaniAlliance: true,
  moritaniDuke: true,
  moritaniRetention: true,
  voice: true,
  prescience: true,
  nexusPrescience: true,
  advisor: true,
  emperorIncome: true,
  richesePurchaseIncome: true,
  richeseGift: true,
  richeseNoField: true,
  harkonnenBonus: true,
  harkonnenTraitor: true,
  guildIncome: true,
  emperorGift: true,
  emperorRevival: true,
  stormPeek: true,
  stormProtection: true,
  wormPlacement: true,
  wormSurvival: true,
  wormAllyProtection: true,
  atreidesAuction: true,
  atreidesSpice: true,
  guildTiming: true,
  kwisatz: true,
  capture: true,
  eliteStrength: true,
  fremenSupport: true,
  advisorFlip: true,
  bgCharity: true,
  choamCharity: true,
  choamInflation: true,
  choamSale: true,
  choamWorthless: true,
  choamBattleIncome: true,
  choamAudit: true,
  choamBattleAid: true,
  worthlessKarama: true,
  faceDancerReplacement: true,
  choamRevival: true,
  revivalLimit: true,
  revivalDiscount: true,
  earlyRevival: true,
  revivalIncome: true,
  foreignGhola: true,
  ixSubstitution: true,
  ixMovement: true,
  fremenMovement: true,
  mobileStronghold: true,
  richeseAuction: true,
  richeseBlackMarket: true,
  ixAuction: true,
  ixTechnology: true,
  ixAllyCard: true,
} satisfies Record<ResponseWindow['kind'], true>;
export type RicheseCancellationContext = Pick<
  Game,
  | 'status'
  | 'turn'
  | 'phase'
  | 'advanced'
  | 'players'
  | 'pendingRicheseGift'
  | 'richeseGiftBlocked'
  | 'pendingRichesePurchaseIncome'
  | 'pendingExchange'
  | 'pendingNullentropy'
>;
type GiftResume = NonNullable<Game['pendingRicheseGift']>['resume'];
type IncomeResume = NonNullable<Game['pendingRichesePurchaseIncome']>['resume'];
export type RicheseCancellationQuote =
  | {
      kind: 'richeseGift';
      blocked: NonNullable<Game['richeseGiftBlocked']>;
      resume: GiftResume;
    }
  | { kind: 'richesePurchaseIncome'; resume: IncomeResume };
export class RicheseCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RicheseCancellationError';
  }
}
function requireRichese(value: unknown, message: string): asserts value {
  if (!value) throw new RicheseCancellationError(message);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function string(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function uniqueStrings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every(string) &&
    new Set(value).size === value.length
  );
}
/** Pure declaration and saved-control envelope only. The engine validates the
 * restored shadow's existing parent integrities; future auto-allowing, gifts,
 * purchase payments, draws and decisions are not executed by this quote. */
export function quoteRicheseCancellation(
  g: RicheseCancellationContext,
  response: ResponseWindow,
): RicheseCancellationQuote | null {
  if (
    response.kind !== 'richeseGift' &&
    response.kind !== 'richesePurchaseIncome'
  )
    return null;
  try {
    return calculate(g, response);
  } catch (error) {
    if (error instanceof RicheseCancellationError) throw error;
    throw new RicheseCancellationError(
      error instanceof Error
        ? error.message
        : 'Malformed Richese cancellation.',
    );
  }
}
function calculate(
  g: RicheseCancellationContext,
  response: ResponseWindow,
): RicheseCancellationQuote {
  requireRichese(
    g.status === 'playing' &&
      Number.isSafeInteger(g.turn) &&
      g.turn > 0 &&
      Number.isSafeInteger(g.phase) &&
      g.phase >= 0 &&
      g.phase <= 8,
    'Richese cancellation needs a current active turn and phase.',
  );
  requireRichese(
    Array.isArray(g.players) && uniqueStrings(g.players.map((p) => p.id)),
    'Richese cancellation seats are malformed.',
  );
  const seated = (id: unknown) =>
    string(id) && g.players.some((p) => p.id === id);
  const passes = (value: unknown) =>
    uniqueStrings(value) && value.every(seated);
  function responseEnvelope(value: unknown): asserts value is ResponseWindow {
    requireRichese(
      object(value) &&
        string(value.kind) &&
        Object.hasOwn(RESPONSES, value.kind) &&
        seated(value.owner) &&
        passes(value.passed) &&
        (value.recipient === undefined || seated(value.recipient)),
      'A suspended response has an invalid kind, owner, recipient or passes.',
    );
  }
  responseEnvelope(response);
  const pending =
    response.kind === 'richeseGift'
      ? g.pendingRicheseGift
      : g.pendingRichesePurchaseIncome;
  requireRichese(
    object(pending) && pending.turn === g.turn && pending.phase === g.phase,
    'This Richese cancellation receipt is no longer current.',
  );
  const root = pending;
  const receipt = (r: ResponseWindow, value: unknown) => {
    requireRichese(
      object(value) && value.turn === g.turn && value.phase === g.phase,
      'A restored Richese parent belongs to an earlier turn or phase.',
    );
    if (r.kind === 'richeseGift') {
      const intent = value.intent;
      requireRichese(
        string(value.event) &&
          object(intent) &&
          intent.owner === r.owner &&
          intent.recipient === r.recipient &&
          seated(intent.recipient) &&
          intent.recipient !== intent.owner &&
          g.players.find((p) => p.id === intent.owner)?.faction === 'richese' &&
          RICHESE_CARD_DEFINITIONS.some((d) => d.card.id === intent.cardId),
        'The canceled gift has an invalid Richese owner, recipient, event or canonical card.',
      );
    } else {
      requireRichese(
        g.advanced &&
          value.owner === r.owner &&
          r.amount === 3 &&
          g.players.find((p) => p.id === r.owner)?.faction === 'emperor' &&
          g.players.some((p) => p.faction === 'richese'),
        'The canceled purchase income needs its original Emperor and three-spice receipt.',
      );
    }
  };
  receipt(response, pending);
  // Follow only actual control parent edges. A restored parent must not point
  // back to the receipt that this cancellation clears, even after JSON reload.
  const controls = (
    value: unknown,
    includePhase: boolean,
    path: Set<object>,
    inheritedKarama?: unknown,
  ) => {
    requireRichese(
      object(value) && !path.has(value),
      'Richese suspended controls contain a recursive parent.',
    );
    const nextPath = new Set(path);
    nextPath.add(value);
    requireRichese(
      Object.keys(value).every((k) =>
        [
          'response',
          'decision',
          'pendingKarama',
          ...(includePhase ? ['phaseOpening'] : []),
        ].includes(k),
      ),
      'The Richese receipt contains unrelated restored state.',
    );
    const followResponse = (r: unknown) => {
      if (r === undefined || r === null) return;
      responseEnvelope(r);
      const parent =
        r.kind === 'richeseGift'
          ? g.pendingRicheseGift
          : r.kind === 'richesePurchaseIncome'
            ? g.pendingRichesePurchaseIncome
            : null;
      if (r.kind === 'richeseGift' || r.kind === 'richesePurchaseIncome') {
        requireRichese(
          parent && parent !== root && !nextPath.has(parent),
          'Richese suspended controls refer to a cleared or recursive parent.',
        );
        receipt(r, parent);
        const nested = new Set(nextPath);
        nested.add(parent);
        controls(parent.resume, r.kind === 'richeseGift', nested);
      }
    };
    followResponse(value.response);
    if (value.decision !== undefined && value.decision !== null) {
      const d = value.decision;
      requireRichese(
        object(d) &&
          string(d.kind) &&
          Object.hasOwn(DECISIONS, d.kind) &&
          seated(d.player) &&
          d.kind !== 'nullentropy',
        'A suspended Richese decision has an invalid kind or owner.',
      );
      if (d.kind === 'handExchange') {
        requireRichese(
          seated(d.target) &&
            d.target !== d.player &&
            Number.isSafeInteger(d.count) &&
            (d.count as number) > 0 &&
            object(g.pendingExchange),
          'The suspended hand exchange has no valid original parent.',
        );
        controls(
          g.pendingExchange,
          false,
          nextPath,
          value.pendingKarama ?? inheritedKarama,
        );
      }
    }
    if (value.phaseOpening !== undefined && value.phaseOpening !== null) {
      const phase = value.phaseOpening;
      requireRichese(
        object(phase) &&
          typeof phase.initialize === 'boolean' &&
          passes(phase.passed),
        'The suspended phase opening is malformed.',
      );
    }
    if (value.pendingKarama !== undefined && value.pendingKarama !== null) {
      const k = value.pendingKarama;
      requireRichese(
        object(k) &&
          seated(k.owner) &&
          object(k.use) &&
          ['cancel', 'shipment', 'purchase', 'auctionPayment'].includes(
            String(k.use.kind),
          ),
        'The suspended Karama use is malformed.',
      );
      if (k.use.kind === 'cancel') followResponse(k.use.response);
      if (k.use.kind === 'shipment')
        requireRichese(
          seated(k.use.recipient) &&
            (k.use.card === undefined || string(k.use.card)),
          'The suspended Karama shipment is malformed.',
        );
      if (k.opportunity !== undefined)
        requireRichese(
          object(k.opportunity) &&
            ['cancel', 'shipment', 'auction'].includes(
              String(k.opportunity.kind),
            ) &&
            string(k.opportunity.signature),
          'The suspended Karama source stamp is malformed.',
        );
    }
    requireRichese(
      !object(value.response) ||
        value.response.kind !== 'worthlessKarama' ||
        !!(value.pendingKarama ?? inheritedKarama),
      'The suspended BG response has no conversion declaration.',
    );
  };
  controls(pending.resume, response.kind === 'richeseGift', new Set([pending]));
  if (response.kind === 'richeseGift') {
    const gift = g.pendingRicheseGift!;
    const current =
      g.richeseGiftBlocked?.turn === g.turn &&
      g.richeseGiftBlocked.phase === g.phase
        ? g.richeseGiftBlocked
        : null;
    requireRichese(
      !current ||
        (uniqueStrings(current.cards) &&
          current.cards.every((id) =>
            RICHESE_CARD_DEFINITIONS.some((d) => d.card.id === id),
          ) &&
          !current.cards.includes(gift.intent.cardId)),
      'The canceled gift card was already blocked or its current blocked list is malformed.',
    );
    return {
      kind: 'richeseGift',
      blocked: {
        turn: g.turn,
        phase: g.phase,
        cards: [...(current?.cards ?? []), gift.intent.cardId],
      },
      resume: structuredClone(gift.resume),
    };
  }
  const income = g.pendingRichesePurchaseIncome!;
  return {
    kind: 'richesePurchaseIncome',
    resume: structuredClone(income.resume),
  };
}
