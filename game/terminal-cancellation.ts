import {
  validateGuildAmbassadorArrivalContext,
  GuildAmbassadorContinuationError,
} from './guild-ambassador-continuation';
import type { Game, ResponseWindow } from './engine';
import {
  homeworldMovementForesightBlock,
  homeworldSpiritualAdvisorAllowance,
} from './homeworld-mobility';
import {
  gameTerritories,
  location,
  splitLocation,
  validLocation,
} from './board';

export class TerminalCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TerminalCancellationError';
  }
}
export type TerminalCancellationKind =
  | 'advisor'
  | 'emperorGift'
  | 'emperorRevival'
  | 'guildIncome'
  | 'revivalIncome'
  | 'bgCharity'
  | 'choamCharity'
  | 'choamInflation'
  | 'stormPeek'
  | 'atreidesSpice'
  | 'atreidesAuction'
  | 'faceDancerReplacement';
type NoEffectKind = Exclude<
  TerminalCancellationKind,
  'stormPeek' | 'atreidesSpice' | 'atreidesAuction' | 'choamCharity' | 'advisor'
>;
export type TerminalCancellationQuote =
  | { kind: NoEffectKind; owner: string }
  | { kind: 'advisor'; owner: string; successor?: 'ambassador' }
  | {
      kind: 'stormPeek' | 'atreidesSpice' | 'atreidesAuction';
      owner: string;
      known: false;
    }
  | {
      kind: 'choamCharity';
      owner: string;
      receipt: { turn: number; canceled: true };
    };
export type TerminalCancellationContext = Pick<
  Game,
  | 'status'
  | 'phase'
  | 'turn'
  | 'advanced'
  | 'players'
  | 'auction'
  | 'richeseAuction'
  | 'stormCard'
  | 'spiceDeck'
  | 'mobileStronghold'
  | 'inflationAttemptTurn'
  | 'inflation'
  | 'inflationUsed'
  | 'choamCharity'
  | 'pendingAmbassador'
  | 'ecazAmbassadors'
  | 'homeworlds'
  | 'homeworldRevivalReturn'
  | 'homeworldRevivalProgress'
  | 'homeworldVictoryReinforcement'
  | 'lastBattleContext'
>;
const positive = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) > 0;
const nonnegative = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) >= 0;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function requireTerminal(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new TerminalCancellationError(message);
}
/** Only the immediate canceled branch is proved. No denied transfer, revival,
 * placement, replacement, future choice, automatic continuation or random draw
 * is executed or required. Results contain no private card or leader identity. */
export function validateTerminalCancellation(
  g: TerminalCancellationContext,
  response: ResponseWindow,
): TerminalCancellationQuote | null {
  if (
    ![
      'advisor',
      'emperorGift',
      'emperorRevival',
      'guildIncome',
      'revivalIncome',
      'bgCharity',
      'choamCharity',
      'choamInflation',
      'stormPeek',
      'atreidesSpice',
      'atreidesAuction',
      'faceDancerReplacement',
    ].includes(response.kind)
  )
    return null;
  // This response resumes settlement in the separate Richese auction contract.
  if (response.kind === 'atreidesAuction' && g.richeseAuction) return null;
  requireTerminal(
    g.status === 'playing' &&
      positive(g.turn) &&
      nonnegative(g.phase) &&
      g.phase <= 8 &&
      Array.isArray(g.players),
    'This canceled power needs its current active game.',
  );
  const owner = g.players.find((p) => p.id === response.owner);
  requireTerminal(owner, 'This canceled power has no seated owner.');
  const recipient = () => g.players.find((p) => p.id === response.recipient);
  const faction = (expected: string) =>
    requireTerminal(
      owner.faction === expected,
      'This faction does not own the canceled power.',
    );
  const amount = () =>
    requireTerminal(
      positive(response.amount),
      'The canceled power needs its declared positive whole amount.',
    );
  switch (response.kind) {
    case 'emperorGift':
    case 'emperorRevival': {
      faction('emperor');
      amount();
      requireTerminal(
        recipient() &&
          response.recipient !== owner.id &&
          owner.ally === response.recipient,
        'The canceled Emperor power needs its originally declared ally.',
      );
      const elite = response.elite ?? 0;
      requireTerminal(
        nonnegative(elite) && elite <= response.amount!,
        'The canceled Emperor power has invalid declared force types.',
      );
      if (response.kind === 'emperorRevival')
        requireTerminal(
          g.phase === 4 && response.amount! <= 3,
          'Canceled extra revival requires its Revival-phase declaration.',
        );
      else
        requireTerminal(
          elite === 0,
          'A spice gift has no elite force allocation.',
        );
      return { kind: response.kind, owner: owner.id };
    }
    case 'guildIncome':
      faction('guild');
      amount();
      requireTerminal(
        g.phase === 5,
        'Canceled Guild shipment income requires Shipment and Movement.',
      );
      return { kind: response.kind, owner: owner.id };
    case 'revivalIncome':
      faction('tleilaxu');
      amount();
      requireTerminal(
        recipient(),
        'Canceled revival income needs its original payer.',
      );
      // Ghola produces the same receipt outside Revival, including Tleilaxu's
      // own free/card-return reward: owner and recipient may be the same seat.
      return { kind: response.kind, owner: owner.id };
    case 'bgCharity':
      faction('beneGesserit');
      amount();
      requireTerminal(
        g.advanced && g.phase === 2 && owner.charityTurn === g.turn,
        'Canceled Bene Gesserit charity needs its current Advanced claim.',
      );
      return { kind: response.kind, owner: owner.id };
    case 'choamCharity':
      faction('choam');
      requireTerminal(
        g.phase === 2 && g.choamCharity?.turn !== g.turn,
        'Canceled CHOAM charity income needs its unresolved phase opening.',
      );
      return {
        kind: response.kind,
        owner: owner.id,
        receipt: { turn: g.turn, canceled: true },
      };
    case 'choamInflation':
      faction('choam');
      requireTerminal(
        g.phase === 8 &&
          g.inflationAttemptTurn === g.turn &&
          !g.inflation &&
          !g.inflationUsed &&
          (response.intent === 'double' || response.intent === 'cancel'),
        'Canceled Inflation needs its current unused token and declared side.',
      );
      return { kind: response.kind, owner: owner.id };
    case 'stormPeek':
      faction('fremen');
      requireTerminal(
        g.advanced &&
          g.phase === 1 &&
          positive(g.stormCard) &&
          g.stormCard <= 6,
        'Canceled storm knowledge needs its next-storm card after Storm.',
      );
      return { kind: response.kind, owner: owner.id, known: false };
    case 'atreidesSpice':
      faction('atreides');
      requireTerminal(
        !homeworldMovementForesightBlock(g, owner.id),
        'Low-population Caladan has no Movement foresight opportunity to cancel.',
      );
      requireTerminal(
        g.phase === 5 && Array.isArray(g.spiceDeck) && g.spiceDeck.length > 0,
        'Canceled spice knowledge needs its existing lookahead opportunity.',
      );
      return { kind: response.kind, owner: owner.id, known: false };
    case 'atreidesAuction': {
      faction('atreides');
      const a = g.auction;
      requireTerminal(
        g.phase === 3 &&
          a &&
          Array.isArray(a.cards) &&
          nonnegative(a.index) &&
          a.index < a.cards.length &&
          object(a.cards[a.index]) &&
          typeof a.cards[a.index].id === 'string' &&
          !!a.cards[a.index].id,
        'Canceled auction knowledge needs its existing normal auction card.',
      );
      return { kind: response.kind, owner: owner.id, known: false };
    }
    case 'faceDancerReplacement':
      faction('tleilaxu');
      requireTerminal(
        g.phase === 8 &&
          owner.faceDancerReplacedTurn === g.turn &&
          typeof response.intent === 'string' &&
          !!response.intent &&
          Array.isArray(owner.faceDancers) &&
          owner.faceDancers.every(
            (d) =>
              object(d) &&
              typeof d.leader === 'string' &&
              typeof d.revealed === 'boolean',
          ),
        'Canceled Face Dancer replacement needs its declared attempt and readable pool.',
      );
      // The runtime computes an index even when canceled. An absent or revealed
      // original candidate is harmless because cancellation replaces nothing.
      return { kind: response.kind, owner: owner.id };
    case 'advisor': {
      faction('beneGesserit');
      const destination = splitLocation(
        response.location ?? 'polar_sink:0',
      ).territory;
      const advisorAmount = response.amount === undefined ? 1 : response.amount;
      requireTerminal(
        positive(advisorAmount) &&
          advisorAmount <=
            homeworldSpiritualAdvisorAllowance(g, owner.id, destination),
        'This spiritual advisor amount is unavailable at the current Homeworld population.',
      );
      if (response.advisorResume === 'ambassador') {
        try {
          const { order } = validateGuildAmbassadorArrivalContext(
            g,
            response.advisorAmbassadorEvent,
            'advisor',
          );
          const key = response.location;
          requireTerminal(
            typeof key === 'string',
            'The canceled Ambassador accompaniment needs its selected destination.',
          );
          const to = splitLocation(key);
          requireTerminal(
            owner.id !== order.player &&
              g.players.find((p) => p.id === order.player)?.faction !==
                'fremen' &&
              location(to.territory, to.sector) === key &&
              validLocation(to.territory, to.sector) &&
              (to.territory === order.territory || key === 'polar_sink:0') &&
              (g.advanced || key === 'polar_sink:0') &&
              response.advisorFollowup === undefined &&
              response.advisorRemaining === undefined,
            'The canceled accompaniment does not match its Guild Ambassador shipment.',
          );
          return { kind: 'advisor', owner: owner.id, successor: 'ambassador' };
        } catch (error) {
          if (error instanceof GuildAmbassadorContinuationError)
            throw new TerminalCancellationError(error.message);
          throw error;
        }
      }
      requireTerminal(
        response.advisorAmbassadorEvent === undefined,
        'Only Ambassador accompaniment may carry its parent event.',
      );
      const key = response.location ?? 'polar_sink:0';
      requireTerminal(
        g.phase === 5 && typeof key === 'string',
        'Canceled advisor shipment needs its movement-phase destination.',
      );
      const to = splitLocation(key);
      requireTerminal(
        location(to.territory, to.sector) === key &&
          validLocation(to.territory, to.sector) &&
          gameTerritories(g).some((t) => t.id === to.territory) &&
          (g.advanced || key === 'polar_sink:0'),
        'Canceled advisor shipment has an invalid declared destination.',
      );
      return { kind: response.kind, owner: owner.id };
    }
    default:
      return null;
  }
}
