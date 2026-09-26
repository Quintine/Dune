import type { Decision, ResponseWindow } from './engine';
import type { Card } from './cards';
import { FACTIONS, PHASES } from './catalog';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < Number.MAX_SAFE_INTEGER;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const counts = (value: unknown) => record(value) && Object.values(value).every(count);
const sector = (value: unknown): value is number => count(value) && value >= 1 && value <= 18;
const elites = (value: unknown) => record(value) &&
  ['reserves','tanks','revived'].every(key => count(value[key])) && counts(value.forces);
const cardKinds = { projectile:true, poison:true, lasgun:true, shield:true, snooper:true, poisonBlade:true, shieldSnooper:true,
  weirdingWay:true, chemistry:true, poisonTooth:true, artillery:true, worthless:true, hero:true, special:true } satisfies Record<Card['kind'], true>;
const card = (value: unknown) => record(value) && text(value.id) && text(value.name) && typeof value.kind === 'string' && Object.hasOwn(cardKinds, value.kind) && (value.effect === undefined || typeof value.effect === 'string');
const cards = (value: unknown) => Array.isArray(value) && value.every(card);
const leader = (value: unknown) => record(value) && text(value.id) && text(value.name) && count(value.strength) &&
  FACTIONS.some(faction => faction.id === value.faction) && typeof value.dead === 'boolean' && count(value.deaths);
const spiceCard = (value: unknown) => record(value) && (value.worm === true || value.sandtrout === true ||
  (text(value.territory) && count(value.amount) && sector(value.sector)));
const spiceCards = (value: unknown) => Array.isArray(value) && value.every(spiceCard);
const optionalCount = (value: unknown) => value === undefined || count(value);
const nullableCount = (value: unknown) => value === null || count(value);

const decisions = {
  harassWithdraw: true,
  diplomatDefense: true,
  leaderSkillVisibility: true,
  leaderSkillRevival: true,
  homeworldRevivalDeployment: true,
  grummanCollection: true,
  caladanReinforcement: true,
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
  ixRicheseTechnology: true,
  ixAllyCard: true,
  mobileStronghold: true,
  ixSubstitution: true,
  revivalStop: true,
  faceDance: true,
  techToken: true,
  poisonTooth: true,
  stoneBurner: true,
  sukRescue: true,
  rihani: true,
  fullPlanOffer: true,
  bureaucratPayment: true,
  moritaniAssassinate: true,
  mentatQuestion: true,
  fullPlanRead: true,
  homeworldShipmentGuild: true,
  guildShipment: true,
  nullentropy: true,
  handExchange: true,
  battleLosses: true,
  homeworldDefense: true,
  homeworldExplosion: true,
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
  discoveryDiscard: true,
  discoveryEntry: true,
  ecologicalStorm: true,
  greatMakerVote: true,
  greatMakerRide: true,
  wormRide: true,
  moritaniRetention: true,
  battleCards: true,
} satisfies Record<Decision['kind'], true>;
const responses = {
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
  nexusAdvisorFlip: true,
  nexusSardaukar: true,
  nexusGuildCunning: true,
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

/** Bounded core/continuation shape check, not a complete save or rules certification.
 * Optional modules retain their own engine validators; do not assume fixed inventories. */
export function adminSeatAiCoreShape(value: unknown): boolean {
  if (!record(value) || value.schema !== 1 || !count(value.turn) || value.turn < 1 || value.turn > 10 ||
      !count(value.phase) || value.phase >= PHASES.length || !sector(value.storm) ||
      !Array.isArray(value.players) || value.players.length < 1 || value.players.length > 6 ||
      (['setup', 'playing'].includes(String(value.status)) && value.players.length < 2)) return false;
  const players = value.players;
  if (!players.every(p => record(p) && text(p.id))) return false;
  const ids = new Set(players.map(p => p.id));
  const seated = (id: unknown) => typeof id === 'string' && ids.has(id);
  const seats = (list: unknown) => strings(list) && list.every(seated) && new Set(list).size === list.length;
  if (!seated(value.host) || !(value.active === null || seated(value.active)) || !seats(value.order) || !seats(value.ready) ||
      !(value.movementRemaining === null || seats(value.movementRemaining)) || !seats(value.stormDialers) ||
      !seats(value.hajr) || !strings(value.wormRides) || !seats(value.freeRevival) || !seats(value.winner) ||
      !strings(value.expansions) || !value.expansions.every(expansion => ['ix','choam','ecaz'].includes(expansion)) ||
      !cards(value.deck) || !cards(value.discard) || !counts(value.spice) || !counts(value.stormDials) ||
      !Array.isArray(value.spiceDeck) || !value.spiceDeck.every(spiceCard) ||
      !Array.isArray(value.spiceDiscard) || value.spiceDiscard.length !== 2 || !value.spiceDiscard.every(pile => Array.isArray(pile) && pile.every(spiceCard)) ||
      !['guildTimingGranted','guildTimingLocked','spicePeekKnown','stormCardKnown','nexus','shieldWallDestroyed'].every(key => typeof value[key] === 'boolean') ||
      !record(value.allianceOffers) || !Object.entries(value.allianceOffers).every(([owner, recipient]) => seated(owner) && seated(recipient)) ||
      !counts(value.emperorExtra) || !record(value.aid) ||
      !Object.entries(value.aid).every(([owner, offer]) => seated(owner) && record(offer) && seated(offer.recipient) && count(offer.amount))) return false;
  const auction = value.auction, storm = value.stormResolution, blow = value.spiceWindow;
  if (auction !== null && (!record(auction) || !cards(auction.cards) || !count(auction.index) || !count(auction.bid) ||
      !(auction.bidder === null || seated(auction.bidder)) || !seated(auction.active) || !seats(auction.passed) || !count(auction.opener) || !optionalCount(auction.allyPayment))) return false;
  if (!nullableCount(value.stormPending) || !nullableCount(value.stormCard) ||
      (storm !== null && (!record(storm) || !sector(storm.from) || !count(storm.distance) || !count(storm.traversed) || !strings(storm.pending)))) return false;
  if (blow !== null && (!record(blow) || !text(blow.territory) || !sector(blow.sector) || !count(blow.amount) ||
      typeof blow.harvested !== 'boolean' || !optionalCount(blow.harvesters))) return false;
  if (value.spiceResolution !== null && (!record(value.spiceResolution) || !spiceCards(value.spiceResolution.skipped))) return false;
  if (value.spiceSequence !== null && (!record(value.spiceSequence) || ![0, 1].includes(Number(value.spiceSequence.pile)) ||
      typeof value.spiceSequence.pile !== 'number' || !spiceCards(value.spiceSequence.skipped))) return false;
  if (value.karamaShipping !== null && (!record(value.karamaShipping) || !seated(value.karamaShipping.player) || !seated(value.karamaShipping.owner))) return false;
  if (value.pendingCapture !== null && (!record(value.pendingCapture) || !seated(value.pendingCapture.player) || !seated(value.pendingCapture.loser) || !text(value.pendingCapture.territory))) return false;
  if (!players.every(p => record(p) && ['spice','reserves','tanks','bribes','revived','revivalCycle','moved','battleLosses'].every(key => count(p[key])) &&
      ['ready','leaderRevived','shipped'].every(key => typeof p[key] === 'boolean') && counts(p.forces) && cards(p.hand) &&
      Array.isArray(p.leaders) && p.leaders.every(leader) && strings(p.traitors) && strings(p.traitorChoices) &&
      (p.ally === null || seated(p.ally)) && (p.elites === undefined || elites(p.elites)))) return false;
  if (value.decision !== null && (!record(value.decision) || typeof value.decision.kind !== 'string' ||
      !Object.hasOwn(decisions, value.decision.kind) || !seated(value.decision.player))) return false;
  if (value.response !== null && (!record(value.response) || typeof value.response.kind !== 'string' ||
      !Object.hasOwn(responses, value.response.kind) || !seated(value.response.owner) || !seats(value.response.passed))) return false;
  return true;
}
