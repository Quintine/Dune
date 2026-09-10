import { createNexusInspection, allowNexusInspection, answerNexusInspection, reopenNexusInspection, cancelNexusInspection, reopenNexusNative, answerNexusNative, validateNexusInspection, committedPlanElements, type NexusInspection, type BattleInspectionContext } from './battle-inspections';
import { beginNexusTraitorExchange, finishNexusTraitorExchange, validateNexusTraitorExchange, validateNexusTraitorHistory, validateNexusTraitorSnapshot, type NexusTraitorExchange, type NexusTraitorSnapshot } from './nexus-traitor-exchange';
import { replaceNexusFaceDancers, validateNexusFaceDancerHistory, type NexusFaceDancerReceipt } from './nexus-face-dancers';
import { createNexusSuboids, validateNexusSuboids, nexusSuboidsActive, type NexusSuboidReceipt } from './nexus-suboids';
import { quoteNexusAdvisors, createNexusAdvisors, validateNexusAdvisors, type NexusAdvisorReceipt } from './nexus-advisors';
import { createNexusSardaukar, validateNexusSardaukar, type NexusSardaukarReceipt } from './nexus-sardaukar';
import { CHOAM_NEXUS_EFFECTS, createNexusChoam, validateNexusChoam, type NexusChoamEffect, type NexusChoamReceipt } from './nexus-choam';
import { createTraitorDeclaration, validateTraitorDeclarations, type TraitorDeclaration, type TraitorDeclarationContext } from './traitor-declarations';
import { createNexusCards, validateNexusCards, drawNexusCard, replaceNexusCard, discardNexusCard, projectNexusCards, nexusCardMode, type NexusState } from './nexus-cards';
import { createNexusCardPhase, markNexusCardOccurred, validateNexusCardPhase, closeNexusCardPhase, nexusCardChoices, finishNexusCardChoice, type NexusCardPhase, type NexusCardChoice } from './nexus-card-phase';
import { createHomeworldOccupationHistory, observeHomeworldOccupation, validateHomeworldOccupationHistory, tupileOccupationStatus, type HomeworldOccupationHistory } from './homeworld-occupation-history';
import { tupileIntelligenceTargets, quoteTupileIntelligenceRequest, type TupileIntelligenceCategory } from './tupile-intelligence';
import { quoteTupileIntelligenceAnswer } from './tupile-intelligence-answer';
import { createTupileIntelligenceState, appendTupileIntelligenceObservation, validateTupileIntelligenceState, type TupileIntelligenceState } from './tupile-intelligence-state';
import { quoteHomeworldCustody } from './homeworld-custody';
import { quoteHomeworldShipment, type HomeworldShipmentIntent } from './homeworld-shipment';
import { quoteGuildHomeworldShipment } from './guild-homeworld-shipment';
import { quoteJunctionTransport } from './junction-transport';
import { homeworldMovementForesightBlock, homeworldSpiritualAdvisorLimit, homeworldMobileStrongholdMovementBlock, homeworldNoFieldMovementBlock } from './homeworld-mobility';
import { currentJunctionOffer, junctionOfferEvent, junctionOfferIntegrity, junctionSponsor, type JunctionOffer } from './junction-offer';
import { homeworldAllianceBlock } from './homeworld-alliance';
import { quoteHomeworldSubstitution } from './homeworld-substitution';
import { combatArmy, combatLocations, combatLocationName, homeworldBattleLocation, quoteCombatBoard, quoteCombatBoardContinuation } from './combat-location';
import { quoteHomeworldCombatLoss } from './homeworld-combat-loss';
import { quoteHomeworldBattleRules } from './homeworld-battle-rules';
import type { HomeworldForces } from './homeworld-custody';
import { nativeReserveSources } from './homeworld-options';
import { HOMEWORLD_CARDS } from './homeworld-cards';
import { lowGrummanRevealBlock } from './homeworld-collection';
import { quoteGrummanCollection, quoteGrummanCollectionAction } from './grumman-collection';
import { grummanCollectionSignature, validateGrummanCollection, type GrummanCollection } from './grumman-collection-return';
import { ambassadorPhaseAllowed } from './ambassador-phase';
import { makeHomeworldVictoryReturn, validateHomeworldVictoryReturn, homeworldVictoryOfferSignature,
  homeworldVictoryObligationSignature, type HomeworldVictoryReturn, type HomeworldVictoryObligation } from './homeworld-victory-return';
import { quoteHomeworldVictoryReinforcement, quoteHomeworldVictoryReinforcementDestination } from './homeworld-victory-reinforcement';
import { homeworldArrivalSignature, appendHomeworldArrivalAmbassador, completeHomeworldArrivalAmbassador, validateHomeworldArrival } from './homeworld-arrival';
import {
  quoteHomeworldRevivalDeployment,
  type HomeworldRevivalDeploymentSource,
  type HomeworldRevivalDeploymentGroup,
} from './homeworld-revival-deployment';
import {
  makeHomeworldRevivalReturn,
  makeHomeworldRevivalProgress,
  type HomeworldRevivalProgress,
  validateHomeworldRevivalReturn,
  homeworldRevivalResumeSignature,
  appendHomeworldRevivalAmbassador,
  homeworldRevivalArrivalSignature,
  type HomeworldRevivalReturn,
} from './homeworld-revival-return';
import { homeworldRevivalDestinations, quoteHomeworldRevivalDestination } from './homeworld-revival-destinations';
import { terrorEntrySignature, terrorSelectionSignature, validateTerrorEntrySignature } from './terror-entry-receipt';
import {
  homeworldLowBonus,
  homeworldRevivalKaramaBlock,
  homeworldSardaukarFreeSupport,
  homeworldSardaukarGholaBlock,
  snapshotHomeworldRevival,
  tleilaxuHomeworldFreeIncomeBlocked,
  HomeworldBenefitError,
  type HomeworldRevivalOpening,
} from './homeworld-benefits';
import {
  quoteEcazAlliance,
  ecazAllianceBlock,
  EcazAllianceError,
} from './ecaz-alliance';
import {
  createHomeworldCustody,
  HomeworldCustodyError,
  type HomeworldCustody,
} from './homeworld-custody';
import {
  quoteGiediCollectionReceipt,
  validateGiediCollection,
  type GiediCollection,
} from './giedi-collection';
import {
  homeworldContext,
  homeworldGameIntegrity,
  homeworldTable,
} from './homeworld-game';
import {
  quoteEmperorHomeworldMove,
  EmperorHomeworldMoveError,
  type EmperorHomeworld,
} from './homeworld-emperor-move';
import {
  quoteNativeReserveWithdrawal,
  quoteNativeRevivalDeposit,
  NativeReserveError,
  type NativeReserveSelections,
} from './homeworld-native-reserves';
import { validAmbassadorResume } from './ambassador-resume';
import { ecazOccupancyRelation } from './ecaz-occupy';
import { territoryEntryBlock, strongholdPathBlocked } from './occupancy';
import {
  validateGuildAmbassadorArrivalContext,
  GuildAmbassadorContinuationError,
} from './guild-ambassador-continuation';
import {
  quoteGuildAmbassadorAdvisor,
  quoteGuildAmbassadorShipment,
  guildAmbassadorShipments,
  GuildAmbassadorShipmentError,
  type GuildAmbassadorShipment,
} from './guild-ambassador';
import {
  quoteFremenAmbassadorMove,
  fremenAmbassadorMovement,
  FremenAmbassadorMoveError,
  type FremenAmbassadorMove,
} from './fremen-ambassador';
import {
  quoteEcazDukeAcquisition,
  ecazDukeAcquisitionBlock,
  EcazDukeAcquisitionError,
} from './ecaz-duke-acquisition';
import {
  quotePlacementCancellation,
  PlacementCancellationError,
} from './placement-cancellation';
import {
  quotePhaseResources,
  PhaseResourceError,
  type PhaseResourceQuote,
} from './phase-resource-quote';
import {
  quoteVictory,
  VictoryQuoteError,
  type VictoryQuote,
} from './victory-quote';
import {
  createSpiceAllocation,
  quoteSpiceAllocation,
  SpiceAllocationError,
  type AllocationState,
  type SpiceAllocationAction,
  type SpiceAllocationReceipt,
} from './ecaz-spice-allocation';
import {
  strongholdProgress,
  VictoryProgressError,
  type StrongholdProgress,
} from './victory-progress';
import {
  quoteMovementPhaseStart,
  quoteAdvisorBattleOffer,
  MovementPhaseQuoteError,
  type MovementPhaseQuote,
} from './movement-phase-quote';
import {
  quoteRevivalResume,
  RevivalResumeError,
  type RevivalResumeQuote,
} from './revival-resume';
import {
  quoteChoamWorthlessCancellation,
  ChoamWorthlessCancellationError,
} from './choam-worthless-cancellation';
import {
  choamStormTerritories,
  quoteChoamStormOffer,
  ChoamStormQuoteError,
  type ChoamStormQuote,
} from './choam-storm-quote';
import {
  quoteAuctionContinuation,
  AuctionContinuationError,
  type AuctionContinuationOperation,
  type AuctionContinuationQuote,
} from './auction-continuation-quote';
import {
  quoteNormalAuctionPeek,
  quoteIxTechnologyCancellation,
  IxTechnologyCancellationError,
} from './ix-technology-cancellation';
import {
  quoteIxAuctionDraw,
  IxAuctionDrawError,
} from './ix-auction-draw-quote';
import {
  quoteMoritaniAllianceCancellation,
  MoritaniAllianceCancellationError,
} from './moritani-alliance-cancellation';
import {
  quoteRicheseCancellation,
  RicheseCancellationError,
} from './richese-cancellation';
import {
  quoteIxSubstitutionCancellation,
  IxSubstitutionCancellationError,
} from './ix-substitution-cancellation';
import {
  quoteCombatResponse,
  isCombatResponseKind,
  CombatResponseQuoteError,
  type CombatResponseOperation,
  type CombatResponseQuote,
} from './combat-response-quote';
import {
  quoteNoFieldCancellation,
  NoFieldCancellationError,
} from './karama-no-field-cancellation';
import {
  validateTerminalCancellation,
  TerminalCancellationError,
} from './terminal-cancellation';
import {
  quoteBattleAftermath,
  BattleAftermathQuoteError,
  type AftermathCancellation,
} from './battle-aftermath-quote';
import {
  quoteSpiceCollection,
  quoteBattlePhaseAdvance,
  BoardResolutionError,
  type AdvisorRelease,
} from './board-resolution-quote';
import {
  quoteMovementCancellation,
  validateAmbassadorRelocationContext,
  MovementCancellationError,
} from './karama-movement-cancellation';
import {
  quoteChoamSaleCancellation,
  ChoamSaleCancellationError,
} from './choam-sale-cancellation';
import {
  validateBattleForceLoss,
  ForceLossPreflightError,
} from './force-loss-preflight';
import {
  quoteBattleResolution,
  BattleResolutionQuoteError,
  type ResolutionCombatant,
} from './battle-resolution-quote';
import {
  quoteRevivalCancellation,
  RevivalCancellationError,
} from './revival-cancellation';
import {
  validateStormTraversal,
  validateStormCancellation,
  validateWormCancellation,
  validateWormDevouring,
  DisasterPreflightError,
} from './disaster-preflight';
import {
  quoteCompletedMovementArrival,
  MovementArrivalError,
} from './karama-movement-preflight';
import {
  validateBattleCleanupContext,
  preflightMoritaniRetentionCancellation,
  KaramaBattlePreflightError,
} from './karama-battle-preflight';
import { canceledResponseSource, KaramaContextError } from './karama-context';
import { validateSavedShipmentQuestion } from './truthtrance';
import {
  reorderOrderedOpportunity,
  protectOrderedOpportunityLast,
  validateOrderedOpportunity,
  type OrderedOpportunity,
} from './ordered-opportunity';
import {
  matchesShipment,
  liveShipmentPromises,
  type ShipmentClaim,
  type ShipmentPromise,
} from './shipment-promises';
import { portableSnooperPlanBlock } from './portable-snooper';
import {
  createAuditorLeader,
  isAuditorLeader,
  auditCount,
  sampleAuditCards,
} from './choam-auditor';
import { stoneBurnerPlanBlock } from './stone-burner';
import {
  STRONGHOLD_CARDS,
  createStrongholdCards,
  strongholdBenefit,
  strongholdControllers,
  settleStrongholdCards,
  strongholdSupportCost,
  type StrongholdId,
  type StrongholdState,
} from './stronghold-cards';
import {
  residualPoisonCandidates,
  residualPoisonDeath,
} from './residual-poison';
import {
  createRemainingCohort,
  validateCohortSelection,
  type MovementCohort,
  type OrnithopterMode,
} from './ornithopter';
import {
  eligibleNullentropyCards,
  resolveNullentropyBox,
} from './nullentropy-box';
import { transferDistrans } from './distrans';
import type { FreshDiscardBatch } from './semuta-drug';
import {
  prepareRicheseGift,
  transferRicheseGift,
  type RicheseGiftIntent,
} from './richese-gift';
import { richeseCards, richeseCardDefinition } from './richese-cards';
import {
  createRicheseNoField,
  deployRicheseNoField,
  moveRicheseNoField,
  revealRicheseNoField,
  shipAlliedRicheseNoField,
  projectRicheseNoField,
  type RicheseNoField,
  type NoFieldRevealCause,
} from './richese-no-field';
import { presenceAt, presenceByLocation } from './force-presence';
import {
  createRicheseAuction,
  submitRicheseBid,
  projectRicheseAuction,
  reorderRicheseBidder,
  type RicheseAuction,
} from './richese-auction';
import {
  richeseOwnCommitment,
  richeseAllyCommitment,
  validateRicheseFunding,
  type RicheseFunding,
} from './richese-funding';
import {
  quoteRicheseSettlement,
  requireRicheseDeclarationCache,
  RicheseSettlementError,
} from './richese-settlement';
import {
  validateAmbassadors,
  createAmbassadors,
  placeAmbassador,
  triggerAmbassador,
  destroyAmbassador,
  replenishAmbassadors,
  copiedAmbassadorEffects,
  canTriggerAmbassador,
  type AmbassadorEffect,
  type AmbassadorState,
} from './ecaz-ambassadors';
import {
  createDukeVidal,
  acquireDuke,
  consumeDuke,
  expireDuke,
  DUKE_VIDAL_ID,
  type DukeState,
} from './duke-vidal';
import {
  retentionReservesCard,
  type MoritaniRetention,
} from './moritani-retention';
import { ordinaryCardAvailability } from './card-availability';
import { ecazDukeRevivalBlock } from './ecaz-duke-revival';
import {
  reserveShipmentCost,
  guildShipmentCost,
  guildShipmentIncome,
  shipmentPaymentBounds,
} from './shipment-price';
import {
  TERROR_DEFINITIONS,
  createTerrorState,
  placeTerror,
  projectTerror,
  revealTerror,
  returnTerror,
  type TerrorKind,
  type TerrorState,
} from './moritani-terror';
import { STORM_START_SECTOR, PLAYER_CIRCLE_SECTORS } from './player-positions';
import { cashInCards } from './choam-karama';
import { saleOptions, quoteSale, type ChoamMarket } from './choam-market';
import { highKaitainDiscardsAvailable, quoteKaitainDiscards, homeworldWorthlessSaleBlock } from './homeworld-card-economy';
import { biddingEndError, biddingEndQuiet, biddingEndPubliclyEmpty, type BiddingEnd } from './bidding-end';
import { quoteHomeworldPaymentIncome, quoteGuildPaymentRounding } from './homeworld-payment-income';
import { quoteEcazPoisonIncome, EcazPoisonIncomeError, type EcazPoisonDiscard } from './ecaz-poison-income';
import { resolveBattleWeapons } from './effective-weapons';
import { choamGholaEvent, choamMarketGholaError, choamSaleGholaTiming, type ChoamMarketGhola } from './choam-market-ghola';
import {
  charityAmount,
  charityQuote,
  charityPayer,
  charityMultiplier,
  type Inflation,
} from './charity';
import {
  PlanClaimError,
  respectsBattlePromises,
  type PlanClaim,
  type BattlePromise,
} from './battle-promises';
import {
  resolveTruthAction,
  validateTruthQuestionReceipt,
  truthFactAnswer,
  TruthError,
  type TruthWindow,
  type TruthRecord,
  type TruthAnswer,
} from './truthtrance';
import { controlsLeader, nativeAvailable } from './leader-control';
import {
  newRevivalRules,
  eliteRevivalRemaining,
  paidForceRevivalCost,
  revivalPrevented,
  normalForceRevivalLimit,
  freeRevivalRate,
  revivalDiscount,
  forceRevivalQuote,
  forceRevivalRemaining,
  freeRevivalRemaining,
  leaderRevivalOptions,
  type RevivalRules,
  type PendingRevival,
} from './revival';
import { traitorDeck, matchingTraitor, CHEAP_HERO_TRAITOR } from './traitors';
import {
  isWeaponCard,
  isStoneBurner,
  isDefenseCard,
  isPortableSnooper,
  VOICE_KINDS,
  validBattleCardPair,
  defaultVoiceMatch,
  playedVoiceMatch,
} from './battle-cards';
import {
  TECH_TOKENS,
  createTechTokens,
  ownedTech,
  type TechId,
  type TechState,
} from './tech-tokens';
import { canUseAsKarama } from './karama';
import {
  isAdvisor,
  fighterCount,
  settleAdvisors,
  arrivalAsAdvisor,
} from './advisors';
import { casualtyOptions, maxCombatDial, maxCombatSupport, validCombatForces, type Casualties, type CombatForces } from './combat';
import { FACTIONS, faction, type FactionId } from './catalog';
import {
  treacheryDeck,
  normalizeLegacyCardNames,
  leaders,
  spiceDeck,
  type Card,
  type Leader,
  type SpiceCard,
} from './cards';
import {
  TERRITORIES,
  MOBILE_STRONGHOLD,
  gameTerritories,
  gameDistance,
  mobileRouteDistance,
  FREMEN_START,
  territory,
  location,
  splitLocation,
  distance,
  validLocation,
} from './board';
export type Player = {
  id: string;
  name: string;
  bot?: 'Easy' | 'Medium' | 'Hard' | 'Brutal';
  autopilot?: 'Easy' | 'Medium' | 'Hard' | 'Brutal';
  faction: FactionId;
  ready: boolean;
  spice: number;
  reserves: number;
  tanks: number;
  forces: Record<string, number>;
  noField?: RicheseNoField;
  noFieldEvent?: string;
  noFieldBlockedTurn?: number;
  advisors?: Record<string, { lockedTurn?: number }>;
  advisorSetup?: boolean;
  charityTurn?: number;
  specialKaramaUsed?: boolean;
  gholaBlocked?: Record<string, number>;
  ixMovementBlocked?: { turn: number; move: number };
  fremenMovementBlocked?: { turn: number; move: number };
  elites?: {
    reserves: number;
    tanks: number;
    forces: Record<string, number>;
    revived: number;
  };
  hand: Card[];
  leaders: Leader[];
  traitors: string[];
  faceDancers?: { leader: string; revealed: boolean }[];
  faceDancerReplacedTurn?: number;
  revealedTraitors?: string[];
  traitorChoices: string[];
  ally: string | null;
  /** Formation turn grants the printed next-turn co-occupation departure deadline. */
  allySinceTurn?: number;
  bribes: number;
  revived: number;
  /** Actual free normal force revivals; absent when an older phase's history is unknown. */
  freeForcesRevived?: number;
  leaderRevived: boolean;
  revivalCycle: number;
  shipped: boolean;
  moved: number;
  battleLosses: number;
  kwisatz?: { dead: boolean; usedAt?: string; revivalCycle?: number };
  prediction?: { faction: FactionId; turn: number };
};
export type Plan = {
  dial: number;
  leader: string | null;
  weapon: string | null;
  defense: string | null;
  support: number;
  allyPayment?: number;
  kwisatz?: boolean;
};
export type PlanField = Exclude<
  keyof Plan,
  'support' | 'kwisatz' | 'allyPayment'
>;
export type Battle = {
  nexusInspection?: NexusInspection;
  /** Independent presence marker: deleting a spent-card record is not a legacy save. */
  nexusInspectionUsed?: string;
  nexusSardaukarUsed?: string;
  traitorDeclarationVersion?: 1;
  traitorDeclarations?: Record<string, TraitorDeclaration>;
  homeworldDefensePassed?: string[];
  event?: string;
  strongholdCopy?: StrongholdId;
  preLeader?: { event: string; ready: string[]; closed: boolean };
  /** Public marker participation persists after a zero-token reveal. */
  noFieldPlayers?: string[];
  truthPromises?: BattlePromise[];
  poisonTooth?: Record<string, boolean>;
  stoneBurner?: Record<string, 'kill' | 'ignore'>;
  /** Supplemental revealed defense; never rewrites the original sealed plan. */
  lateDefense?: Record<string, string>;
  fullPlan?: { owner: string; target: string };
  fullPlanOffered?: boolean;
  eliteBlocked?: string[];
  fremenSupportBlocked?: boolean;
  choamAidBlocked?: boolean;
  powerChecks?: {
    kind: 'kwisatz' | 'eliteStrength' | 'fremenSupport' | 'choamBattleAid';
    owner: string;
  }[];
  kwisatzBlocked?: boolean;
  prepared?: boolean;
  territory: string;
  attacker: string;
  defender: string;
  plans: Record<string, Plan>;
  revealed: boolean;
  traitorCalls: Record<string, boolean>;
  preparation?: {
    kind: 'voice' | 'prescience' | 'prescienceAnswer' | 'nexusPrescienceAnswer';
    owner: string;
    beneficiary: string;
  };
  prescience?: {
    player: string;
    field: PlanField;
    value?: string | number | null;
  };
  voice?: { target: string; kind: Card['kind'] | 'stoneBurner'; must: boolean };
};
export type Auction = {
  peekKnown?: boolean;
  cards: Card[];
  index: number;
  bid: number;
  bidder: string | null;
  active: string;
  passed: string[];
  opener: number;
  allyPayment?: number;
};
export type Decision =
  | { kind: 'homeworldRevivalDeployment'; player: string; event: string }
  | { kind: 'grummanCollection'; player: string; event: string }
  | { kind: 'caladanReinforcement'; player: string; event: string }
  | { kind: 'choamAudit'; player: string; event: string }
  | { kind: 'choamAuditPayment'; player: string; event: string }
  | {
      kind: 'strongholdCopy';
      player: string;
      event: string;
      choices: StrongholdId[];
    }
  | { kind: 'richeseBlackMarket'; player: string }
  | { kind: 'richeseDeclaration'; player: string }
  | { kind: 'richeseCache'; player: string }
  | { kind: 'richeseUnbid'; player: string }
  | { kind: 'richeseAllyShipment'; player: string; owner: string }
  | { kind: 'richeseAllyOpportunity'; player: string; recipient: string }
  | { kind: 'ecazAmbassador'; player: string }
  | {
      kind: 'moritaniTerror';
      player: string;
      entrant: string;
      territory: string;
    }
  | { kind: 'moritaniSetup'; player: string }
  | { kind: 'moritaniPlacement'; player: string }
  | { kind: 'ecazPlacement'; player: string }
  | { kind: 'ecazSpice'; player: string }
  | {
      kind: 'choamStorm';
      player: string;
      territories: { territory: string; amount: number; sectors: number[] }[];
      protected: string[];
    }
  | {
      kind: 'choamMovement';
      player: string;
      mover: string;
      territory: string;
      sector: number;
      amount: number;
    }
  | { kind: 'choamMentat'; player: string }
  | { kind: 'choamFreeRevival'; player: string; recipient: string }
  | { kind: 'choamBattleFunding'; player: string }
  | { kind: 'choamMarket'; player: string }
  | { kind: 'choamTradeReply'; player: string }
  | { kind: 'choamTradeConfirm'; player: string }
  | { kind: 'ixSetup'; player: string }
  | { kind: 'ixAuction'; player: string }
  | { kind: 'ixTechnology'; player: string }
  | { kind: 'ixAllyCard'; player: string }
  | { kind: 'mobileStronghold'; player: string; placement: boolean }
  | {
      kind: 'ixSubstitution';
      player: string;
      territory: string;
      losses: Record<string, number>;
    }
  | {
      kind: 'revivalStop';
      player: string;
      recipient: string;
      revival: 'forces' | 'leader';
    }
  | {
      kind: 'faceDance';
      blocked?: string;
      player: string;
      winner: string;
      leader: string | null;
      identity: string | null;
      territory: string;
    }
  | { kind: 'techToken'; player: string; loser: string; choices: TechId[] }
  | { kind: 'poisonTooth'; player: string }
  | { kind: 'stoneBurner'; player: string; event: string }
  | { kind: 'fullPlanOffer'; player: string }
  | { kind: 'fullPlanRead'; player: string; target: string }
  | { kind: 'homeworldShipmentGuild'; player: string; shipper: string; destination: string; amount: number; event: string }
  | {
      kind: 'guildShipment';
      player: string;
      shipper: string;
      territory: string;
      sector: number;
      amount: number;
    }
  | { kind: 'nullentropy'; player: string }
  | { kind: 'handExchange'; player: string; target: string; count: number }
  | {
      kind: 'battleLosses';
      player: string;
      territory: string;
      options: Casualties[];
      cards: string[];
    }
  | { kind: 'homeworldDefense'; player: string; event: string }
  | { kind: 'homeworldExplosion'; player: string; territory: string; event: string; options: HomeworldForces[]; pool: HomeworldForces }
  | { kind: 'captureOffer'; player: string; loser: string; territory: string }
  | {
      kind: 'capturedLeader';
      player: string;
      owner: string;
      leader: string;
      controller?: string;
    }
  | { kind: 'guildTiming'; player: string; next: string; following: string }
  | { kind: 'auctionPayment'; player: string }
  | {
      kind: 'advisor';
      player: string;
      shipment: string;
      destination?: string;
      ambassadorEvent?: string;
    }
  | {
      kind: 'intrusion';
      player: string;
      territory: string;
      wormRide?: boolean;
      ambassadorEvent?: string;
      followup?: { shipment: string; destination: string };
    }
  | { kind: 'advisorBattle'; player: string; territories: string[] }
  | {
      kind: 'stormLosses';
      player: string;
      key: string;
      amount: number;
      minElite: number;
      maxElite: number;
      resume: 'storm' | 'shipment';
    }
  | { kind: 'wormPlacement'; player: string }
  | { kind: 'wormProtection'; player: string; territory: string; ally: string }
  | { kind: 'wormRide'; player: string; territory: string }
  | {
      kind: 'moritaniRetention';
      owner: string;
      player: string;
      territory: string;
      cards: string[];
    }
  | { kind: 'battleCards'; player: string; territory: string; cards: string[] };
export type ResponseWindow = {
  /** Original eligible contributor amounts; private routing evidence, not a new payment. */
  guildContributions?: number[];
  guildPaymentProof?: string;
  /** Bank-paid portion of a frozen Homeworld charity claim. */
  charityHomeworld?: number;
  source?: 'ambassador';
  intent?: string;
  advisors?: boolean;
  advisorResume?: 'wormRide' | 'declaration' | 'ambassador';
  advisorAmbassadorEvent?: string;
  advisorRemaining?: string[];
  advisorFollowup?: { shipment: string; destination: string };
  amount?: number;
  elite?: number;
  recipient?: string;
  location?: string;
  resume?: 'storm' | 'shipment';
  take?: boolean;
  kind:
    | 'moritaniPlacement'
    | 'ecazPlacement'
    | 'ecazCollection'
    | 'moritaniAlliance'
    | 'moritaniDuke'
    | 'moritaniRetention'
    | 'voice'
    | 'prescience'
    | 'nexusPrescience'
    | 'advisor'
    | 'emperorIncome'
    | 'richesePurchaseIncome'
    | 'richeseGift'
    | 'richeseNoField'
    | 'harkonnenBonus'
    | 'harkonnenTraitor'
    | 'guildIncome'
    | 'emperorGift'
    | 'emperorRevival'
    | 'stormPeek'
    | 'stormProtection'
    | 'wormPlacement'
    | 'wormSurvival'
    | 'wormAllyProtection'
    | 'atreidesAuction'
    | 'atreidesSpice'
    | 'guildTiming'
    | 'kwisatz'
    | 'capture'
    | 'eliteStrength'
    | 'fremenSupport'
    | 'advisorFlip'
    | 'nexusAdvisorFlip'
    | 'nexusSardaukar'
    | 'bgCharity'
    | 'choamCharity'
    | 'choamInflation'
    | 'choamSale'
    | 'choamWorthless'
    | 'choamBattleIncome'
    | 'choamAudit'
    | 'choamBattleAid'
    | 'worthlessKarama'
    | 'faceDancerReplacement'
    | 'choamRevival'
    | 'revivalLimit'
    | 'revivalDiscount'
    | 'earlyRevival'
    | 'revivalIncome'
    | 'foreignGhola'
    | 'ixSubstitution'
    | 'ixMovement'
    | 'fremenMovement'
    | 'mobileStronghold'
    | 'richeseAuction'
    | 'richeseBlackMarket'
    | 'ixAuction'
    | 'ixTechnology'
    | 'ixAllyCard';
  owner: string;
  passed: string[];
};
type KaramaUse =
  | { kind: 'cancel'; response: ResponseWindow }
  | { kind: 'shipment'; recipient: string; card?: string }
  | { kind: 'purchase' }
  | { kind: 'auctionPayment' };
type PendingHomeworldShipment = HomeworldShipmentIntent & {
  /** Absent in older world-to-world declarations. */
  route?: 'arrakis';
  event: string;
  turn: number;
  amount: number;
  elite: number;
  cost: number;
  allyPayment: number;
  pools: ReturnType<typeof quoteHomeworldShipment>['sources'] | ReturnType<typeof quoteGuildHomeworldShipment>['boardSources'];
};
type PendingShipment = {
  homeworldSources?: NativeReserveSelections;
  source?: 'ambassador';
  ambassadorEvent?: string;
  /** Absent in legacy rooms; new declarations cannot resume in a later turn. */
  turn?: number;
  player: string;
  territory: string;
  sector: number;
  amount: number;
  elite: number;
  cost: number;
  allyPayment: number;
  advisors: boolean;
  noField?: { tokenId: string; event: string };
  alliedNoField?: RicheseAllyOffer;
};
type RicheseAllyOffer = {
  event: string;
  owner: string;
  recipient: string;
  tokenId: string;
  tokenEvent: string;
  territory: string;
  sector: number;
  payer: string;
};
export type Game = {
  treacheryDiscardSequence?: number;
  resolvedTreacheryDiscardSequence?: number;
  /** Committed discard receipts are evidence, not additional card custody. */
  pendingTreacheryDiscard?: {
    sequence: number;
    batch: FreshDiscardBatch;
    continuation:
      | { kind: 'ambassador'; entry: NonNullable<Game['pendingAmbassador']> }
      | { kind: 'kaitainDiscard'; owner: string; event: string; cost: number; spiceAfter: number }
      | { kind: 'winnerMandatoryDiscard'; event: string; player: string; territory: string; optional: string[]; commitment: NonNullable<Game['pendingWinnerDiscards']> }
      | {
          kind: 'nullentropyDiscard';
          player: string;
          searchEvent: string;
          box: string;
          selected: Card;
          finalDiscardIds: string[];
          finalDiscardSignature: string;
          resume: NonNullable<Game['pendingNullentropy']>['resume'];
          parentSignature: string;
        }
      | {
          kind: 'ordinaryCardDiscard';
          player: string;
          card: string;
          effect: 'hajr' | 'ghola' | 'harvester' | 'weather' | 'atomics';
          resume: NonNullable<Game['pendingNullentropy']>['resume'];
          stateSignature: string;
        }
      | {
          kind: 'truthtranceDiscard';
          consumed: { player: string; card: string };
          historyIndex: number;
          record: TruthRecord;
          remaining: TruthWindow | null;
          resume: NonNullable<Game['pendingNullentropy']>['resume'];
          promise:
            | { kind: 'shipment'; index: number; value: ShipmentPromise }
            | { kind: 'battle'; index: number; value: BattlePromise }
            | null;
          parentSignature: string;
        }
      | {
          kind: 'ornithopterDiscard';
          source: 'move' | 'end';
          flight: NonNullable<Game['ornithopter']>;
          movement: CompletedMovement | null;
          resume: NonNullable<Game['pendingNullentropy']>['resume'];
          stateSignature: string;
        }
      | {
          kind: 'terrorDiscard';
          source: 'sabotage' | 'robberyOverflow';
          owner: string;
          entry: NonNullable<Game['pendingTerrorEntry']>;
          discardedHandSize: number;
        }
      | {
          kind: 'battleResolved';
          event: string;
          result: 'normal' | 'traitor' | 'mutualTraitors' | 'explosion';
          combatants: string[];
          territory: string;
          winner: string | null;
          cards: string[];
          casualties?: {
            forces: CombatForces;
            dial: number;
            support: number;
            options: Casualties[];
          };
        }
      | {
          kind: 'battleCleanup';
          event: string;
          combatants: string[];
          territory: string;
          player: string;
          source: 'winner' | 'moritani';
          kept: string[];
          played: string[];
          retention?: MoritaniRetention;
        }
      | {
          kind: 'ixAllyCard';
          player: string;
          card: string;
          free: boolean;
          sale: NonNullable<Game['currentAuctionSale']>;
          auctionIndex: number | null;
          auctionEvent: string | null;
        };
  } | null;
  ornithopter?: {
    event: string;
    player: string;
    card: Card;
    turn: number;
    mode: OrnithopterMode;
    startingMove: number;
    completed: number;
    cohort?: MovementCohort;
  } | null;
  pendingNullentropy?: {
    event: string;
    player: string;
    box: string;
    turn: number;
    phase: number;
    discardIds: string[];
    discardSignature: string;
    resume: {
      response: Game['response'];
      decision: Game['decision'];
      pendingKarama: Game['pendingKarama'];
      phaseOpening: Game['phaseOpening'];
    };
  } | null;
  pendingRicheseGift?: {
    event: string;
    intent: RicheseGiftIntent;
    turn: number;
    phase: number;
    resume: {
      response: Game['response'];
      decision: Game['decision'];
      pendingKarama: Game['pendingKarama'];
      phaseOpening: Game['phaseOpening'];
    };
  } | null;
  richeseGiftBlocked?: { turn: number; phase: number; cards: string[] };
  richeseAllyOffer?: RicheseAllyOffer | null;
  richeseAllyOpportunity?: { turn: number; recipient: string };
  richeseAllyBlocked?: { turn: number; recipient: string };
  richeseAllyDeclined?: { turn: number; recipient: string };
  richeseCache?: Card[];
  richeseRemoved?: Card[];
  richeseBidding?: {
    owner: string;
    event: string;
    turn: number;
    stage:
      | 'blackMarketOffer'
      | 'declaration'
      | 'cacheOffer'
      | 'lot'
      | 'normal'
      | 'complete';
    position: 'first' | 'last' | null;
    normalCount: number | null;
    blackMarketSold: boolean;
    cacheCanceled: boolean;
    opener?: number;
  } | null;
  richeseAuction?: RicheseAuction | null;
  richeseFunding?: RicheseFunding;
  richesePeekKnown?: boolean;
  richeseOfferedCard?: Card | null;
  richeseClaim?: string | null;
  currentAuctionSale?: {
    winner: string;
    amount: number;
    free: boolean;
    origin: 'normal' | 'cache' | 'blackMarket';
    seller: string | null;
  } | null;
  pendingAmbassador?: {
    revivalEvent?: string;
    victoryEvent?: string;
    event: string;
    owner: string;
    entrant: string;
    token: string;
    territory: string;
    sector: number;
    turn: number;
    phase: number;
    stage:
      | 'offer'
      | 'allianceReply'
      | 'copy'
      | 'cards'
      | 'income'
      | 'bonus'
      | 'move'
      | 'ship'
      | 'arrival';
    relocation?: {
      order: FremenAmbassadorMove;
      next: 'flip' | 'intrusion' | 'terror' | 'finish';
    };
    shipmentReceipt?: {
      order: GuildAmbassadorShipment;
      next: 'intrusion' | 'terror' | 'accompany' | 'advisor' | 'finish';
      advisorArrival?: {
        player: string;
        territory: string;
        sector: number;
        amount: 1 | 2;
        elite: 0;
      };
    };
    purchaseReceipt?: {
      buyer: string;
      card: string;
      amount: 3;
      emperor: string | null;
      stage: 'income' | 'bonus';
    };
    beneficiary?: string;
    effect?: AmbassadorEffect;
    copyChoices: AmbassadorEffect[];
    resume: 'none' | 'wormRide';
    wormRider?: string;
    guildAdvisorOrigin?: {
      event: string;
      player: string;
      territory: string;
      sector: number;
    };
  } | null;
  ambassadorInsights?: {
    event: string;
    viewer: string;
    target: string;
    turn: number;
    effect: 'atreides' | 'harkonnen';
    cards: Card[];
    traitor: string | null;
  }[];
  ecazAmbassadors?: AmbassadorState;
  ecazPlacementTurn?: number;
  pendingEcazPlacement?: {
    token: string;
    territory: string;
    turn: number;
    cost: number;
  } | null;
  dukeVidal?: DukeState;
  dukeAcquisitionTurn?: number;
  pendingTerrorEntry?: {
    /** Original public arrival, absent only in legacy saves. */
    entrySignature?: string;
    candidates?: string[];
    selectionSignature?: string;
    token: string;
    entrant: string;
    territory: string;
    sector: number;
    amount: number;
    elite: number;
    cause:
      | 'shipment'
      | 'movement'
      | 'guildTransport'
      | 'advisor'
      | 'wormRide'
      | 'homeworldRevival'
      | 'caladanReinforcement'
      | 'ambassador';
    turn: number;
    phase: number;
    stage:
      | 'select'
      | 'offer'
      | 'robbery'
      | 'discard'
      | 'gift'
      | 'sneakAttack'
      | 'allianceResponse'
      | 'allianceReply';
    allianceBlocked?: boolean;
    resume: 'none' | 'wormRide' | 'ambassador';
    ambassadorEvent?: string;
  } | null;
  moritaniTerror?: TerrorState;
  grummanCollection?: GrummanCollection;
  pendingMoritaniPlacement?: {
    token: string;
    territory: string;
    turn: number;
  } | null;
  pendingChoamMove?: MovementOrder | null;
  choamBaliset?: { turn: number; player: string; territory: string }[];
  choamMentatPending?: boolean;
  choamMovement?: { turn: number; bonus: number };
  choamWorthlessBlocked?: { turn: number; phase: number; cards: string[] };
  pendingChoamWorthless?: {
    owner: string;
    card: string;
    effect: 'kulon' | 'laLaLa' | 'gamont' | 'baliset' | 'jubba';
    storm?: boolean;
    movement?: boolean;
    location?: string;
    elite?: number;
    mentat?: boolean;
    noFieldEvent?: string;
    target?: string;
    revival: boolean;
    nexusEvent?: string;
  } | null;
  pendingChoamBattleIncome?: { owner: string; amount: number } | null;
  pendingAuditor?: {
    event: string;
    owner: string;
    opponent: string;
    territory: string;
    turn: number;
    survived: boolean;
    usedCards: string[];
    stage: 'offer' | 'response' | 'payment';
  } | null;
  auditorInsight?: {
    event: string;
    viewer: string;
    target: string;
    turn: number;
    cards: Card[];
  } | null;
  choamMarket?: ChoamMarket | null;
  biddingEnd?: BiddingEnd | null;
  ecazPoisonIncome?: { player: string; turn: number; phase: number; amount: number; count: number }[];
  pendingWinnerDiscards?: { event: string; turn: number; territory: string; player: string; cards: string[]; optional: string[]; signature: string } | null;
  pendingChoamMarketGhola?: ChoamMarketGhola | null;
  choamTradeTurn?: number;
  inflation?: Inflation | null;
  inflationUsed?: boolean;
  inflationAttemptTurn?: number;
  choamCharity?: { turn: number; canceled: boolean };
  homeworldRevival?: HomeworldRevivalOpening | null;
  homeworldRevivalReturn?: HomeworldRevivalReturn;
  homeworldRevivalProgress?: HomeworldRevivalProgress;
  homeworldVictoryReinforcement?: HomeworldVictoryReturn;
  giediCollection?: GiediCollection;
  ecazCollection?: {
    turn: number;
    event: string;
    stage: 'response' | 'allocation' | 'complete';
    canceled: boolean;
    allocation: AllocationState | null;
    settled: SpiceAllocationReceipt[];
    sourceSpice: Record<string, number>;
    boardSignature: string;
  };
  truthtrance?: TruthWindow | null;
  truthHistory?: TruthRecord[];
  shipmentPromises?: ShipmentPromise[];
  ixSetupCards?: Card[] | null;
  ixAuction?: { count: number; cards: Card[] } | null;
  ixAuctionKnown?: { turn: number; cards: Card[] } | null;
  ixTechnologyTurn?: number;
  pendingIxTechnology?: { card: string } | null;
  pendingIxAlly?: { player: string; card: string; free: boolean } | null;
  mobileStronghold?: { location: string | null } | null;
  pendingMobileMove?: {
    player: string;
    route: string[];
    collect: boolean;
  } | null;
  revivalRules?: RevivalRules;
  revivalRequests?: Record<
    string,
    { leader: string; price: number | null; declined?: boolean }
  >;
  revivalFreeIncome?: Record<string, number>;
  pendingRevival?: PendingRevival | null;
  pendingIxMove?: MovementOrder | null;
  pendingFremenMove?: {
    turn: number;
    move: number;
    order: MovementOrder;
  } | null;
  pendingIxSubstitution?: {
    homeworld?: { pool: HomeworldForces; cyborgsLost: number; eliteTanks: number; normalTanks: number; battleLosses: number };
    player: string;
    territory: string;
    losses: Record<string, number>;
    cards: string[];
    sources?: Record<string, number>;
    recover?: Record<string, number>;
  } | null;
  revivalPrevention?: { player: string; turn: number };

  traitorReserve?: string[];
  pendingFaceDance?: {
    player: string;
    winner: string;
    leader: string | null;
    identity: string | null;
    territory: string;
  } | null;
  phaseOpening?: { passed: string[]; initialize: boolean } | null;
  sandtrout?: boolean;
  techTokens?: TechState | null;
  strongholdCards?: StrongholdState | null;
  /** Optional independent module; complete effect coverage is still release-gated. */
  nexusCards?: { cards: NexusState | null; phase: NexusCardPhase | null } | null;
  nexusTraitorExchanges?: NexusTraitorExchange[];
  nexusFaceDancerHistory?: NexusFaceDancerReceipt[];
  nexusSuboidHistory?: NexusSuboidReceipt[];
  nexusSuboidLast?: { event: string; owner: string; turn: number };
  nexusAdvisorHistory?: { receipt: NexusAdvisorReceipt; stage: 'pending' | 'completed' | 'canceled'; frame: string; signature: string }[];
  nexusAdvisorLast?: { event: string; stage: 'pending' | 'completed' | 'canceled' };
  nexusSardaukarHistory?: {receipt: NexusSardaukarReceipt; stage: 'pending' | 'active' | 'canceled'; parent: string; signature: string;
    casualties?: {forces: CombatForces; dial: number; support: number; options: Casualties[]; outcome: 'pending' | 'complete'}}[];
  nexusSardaukarLast?: {event: string; stage: 'pending' | 'active' | 'canceled'};
  nexusChoamHistory?: {receipt: NexusChoamReceipt; stage: 'pending' | 'canceled' | 'complete' | 'fizzled'; frame: string; parent: string; signature: string}[];
  nexusChoamLast?: {event: string; stage: 'pending' | 'canceled' | 'complete' | 'fizzled'};
  nexusTraitorPending?: string | null;
  nexusTraitorParent?: { event: string; signature: string } | null;
  /** Null/absent disables the module; custody is installed at force placement. */
  homeworlds?: { custody: HomeworldCustody | null; historyVersion?: 1 } | null;
  homeworldOccupationHistory?: HomeworldOccupationHistory;
  tupileIntelligence?: TupileIntelligenceState;
  pendingTech?: { player: string; loser: string; choices: TechId[] } | null;
  summonedBeforeBlow?: boolean;
  summonedNexusBeforeRides?: boolean;
  summonedWorm?: {
    territory: string;
    resume: Pick<
      Game,
      | 'response'
      | 'decision'
      | 'pendingKarama'
      | 'spiceWindow'
      | 'spiceResolution'
      | 'spiceSequence'
      | 'nexus'
      | 'wormRides'
      | 'ready'
    >;
  } | null;
  pendingShipment?: PendingShipment | null;
  pendingHomeworldShipment?: PendingHomeworldShipment | null;
  junctionOffer?: JunctionOffer | null;
  pendingExchange?: {
    response: ResponseWindow | null;
    decision: Decision | null;
  } | null;
  /** Purchase is already committed; only the Emperor's receipt remains pending. */
  pendingRichesePurchaseIncome?: {
    owner: string;
    turn: number;
    phase: number;
    resume: Pick<Game, 'response' | 'decision' | 'pendingKarama'>;
  } | null;
  pendingKarama?: {
    owner: string;
    use: KaramaUse;
    /** New conversions bind their original power, shipment or lot. Absent in legacy saves. */
    opportunity?: {
      kind: 'cancel' | 'shipment' | 'auction';
      signature: string;
    };
  } | null;
  schema: 1;
  botsPending?: boolean;
  botNextActionAt?: number;
  code: string;
  version: number;
  host: string;
  status: 'lobby' | 'setup' | 'playing' | 'finished';
  /** Absent on legacy rooms whose starting cards were already dealt. */
  setupStage?: 'prediction' | 'traitors' | 'forces';
  advanced: boolean;
  expansions: string[];
  players: Player[];
  /** Fixed printed player circles; absent only in rooms created before this rule fix. */
  playerPositions?: Record<string, number>;
  turn: number;
  phase: number;
  storm: number;
  order: string[];
  active: string | null;
  movementRemaining: string[] | null;
  /** Juice of Sapho's last position lasts only through this combined-turn queue. */
  saphoMovementLast?: { event: string; turn: number; player: string } | null;
  guildTimingGranted: boolean;
  guildTimingLocked: boolean;
  ready: string[];
  deck: Card[];
  discard: Card[];
  spiceDeck: SpiceCard[];
  spicePeekKnown: boolean;
  spiceDiscard: SpiceCard[][];
  spice: Record<string, number>;
  log: {
    seq: number;
    text: string;
    automatic?: { faction: FactionId; name: string };
  }[];
  stormDials: Record<string, number>;
  stormPending: number | null;
  stormCard: number | null;
  stormCardKnown: boolean;
  stormResolution: {
    from: number;
    distance: number;
    traversed: number;
    pending: string[];
    protected?: boolean;
    choamProtected?: string[];
  } | null;
  karamaShipping: { player: string; owner: string; card?: string } | null;
  stormDialers: string[];
  lastBattle: string[];
  homeworldBattleLoss?: {
    event: string;
    territory: string;
    player: string;
    kind: 'winner' | 'explosion';
    pool: HomeworldForces;
    options: HomeworldForces[];
    commitment?: { forces: CombatForces; dial: number; support: number };
  } | null;
  lastBattleContext?: {
    event: string;
    turn: number;
    territory: string;
    combatants: string[];
    winner: string | null;
    result: 'normal' | 'traitor' | 'mutualTraitors' | 'explosion' | 'legacy';
    cardRoles?: Record<string, Record<string, Omit<EcazPoisonDiscard, 'card'>>>;
    cardRolesSignature?: string;
    winnerDiscards?: { cards: string[]; completed: boolean; signature: string };
    caladanReinforcement?: HomeworldVictoryObligation;
    nexusSardaukarCasualties?: string;
  } | null;
  auction: Auction | null;
  battle: Battle | null;
  nexus: boolean;
  allianceOffers: Record<string, string>;
  winner: string[];
  shieldWallDestroyed: boolean;
  spiceWindow: {
    territory: string;
    sector: number;
    amount: number;
    harvested: boolean;
    harvesters?: number;
    harvesterClosed?: boolean;
  } | null;
  hajr: string[];
  decision: Decision | null;
  pendingCapture: { player: string; loser: string; territory: string } | null;
  moritaniRetention?: MoritaniRetention | null;
  response: ResponseWindow | null;
  wormRides: string[];
  wormPlacementCanceledTurn: number;
  spiceResolution: { skipped: SpiceCard[] } | null;
  spiceSequence: { pile: 0 | 1; skipped: SpiceCard[] } | null;
  freeRevival: string[];
  emperorExtra: Record<string, number>;
  aid: Record<string, { recipient: string; amount: number }>;
};
export class RuleError extends Error {}
function nexusRule<T>(work: () => T): T {
  try { return work(); } catch (error) {
    throw new RuleError(error instanceof Error ? error.message : 'Invalid Nexus card operation.');
  }
}
function nexusCardsIntegrity(g: Game) {
  const nexus = g.nexusCards;
  if (!nexus) return;
  requireRule(Object.keys(nexus).sort().join(',') === 'cards,phase', 'Invalid Nexus module fields.');
  if (g.status === 'lobby') {
    requireRule(nexus.cards === null && nexus.phase === null, 'Nexus cards are dealt only after setup begins.');
    return;
  }
  requireRule(nexus.cards, 'The Nexus inventory is missing.');
  nexusRule(() => validateNexusCards(nexus.cards!, g.players));
  requireRule(g.players.every(p => !p.ally || nexus.cards!.hands[p.id] === null),
    'Allied players cannot retain Nexus cards.');
  const phase = nexus.phase;
  if (!phase) {
    requireRule(g.turn === 1 && g.phase === 0, 'The Nexus phase record is missing.');
    return;
  }
  nexusRule(() => validateNexusCardPhase(phase, g.players, nexus.cards!));
  requireRule(phase.turn <= g.turn && phase.turn >= g.turn - 1 &&
    (phase.stage === 'complete' || (phase.turn === g.turn && g.phase === 1)) &&
    (g.phase !== 1 || phase.turn === g.turn), 'The Nexus record does not match its phase.');
  if (phase.stage === 'drawing')
    requireRule(!g.decision && !g.response && !g.phaseOpening && !g.spiceSequence && !g.spiceWindow &&
      !g.spiceResolution && !g.summonedWorm && !g.wormRides.length && !g.choamMarket &&
      !g.truthtrance && !g.pendingKarama && !g.pendingTreacheryDiscard,
    'Finish the preceding phase interaction before drawing Nexus cards.');
}
function markNexusOccurred(g: Game) {
  if (!g.nexusCards) return;
  const phase = g.nexusCards.phase;
  requireRule(phase?.turn === g.turn && phase.stage === 'spice', 'A Nexus needs an open Spice Blow phase.');
  g.nexusCards.phase = nexusRule(() => markNexusCardOccurred(phase));
}
function discardAllianceNexusCards(g: Game, ...players: Player[]) {
  if (!g.nexusCards?.cards) return;
  for (const player of players) {
    if (!g.nexusCards.cards.hands[player.id]) continue;
    g.nexusCards.cards = nexusRule(() => discardNexusCard(g.nexusCards!.cards!, player.id, g.players));
    log(g, `${player.name} discarded their held Nexus Card to enter the alliance.`,
      { faction: player.faction, name: 'Nexus alliance discard' });
  }
}
function closeNexusCards(g: Game): boolean {
  const nexus = g.nexusCards;
  if (g.phase !== 1 || !nexus) return false;
  requireRule(nexus.phase?.turn === g.turn && nexus.cards, 'The Nexus phase record is missing.');
  if (nexus.phase.stage === 'spice') {
    nexus.phase = nexusRule(() => closeNexusCardPhase(nexus.phase!, g.players));
    if (nexus.phase.stage === 'drawing')
      log(g, 'Spice Blow and Nexus is ending. Unallied factions may draw a secret Nexus Card, replace their held card, or keep their current position. Alliances are settled.');
  }
  return nexus.phase.stage === 'drawing';
}
function decideNexusCard(g: Game, p: Player, action: Action) {
  const nexus = g.nexusCards;
  requireRule(g.status === 'playing' && g.phase === 1 && nexus?.cards && nexus.phase?.stage === 'drawing' &&
    action.turn === nexus.phase.turn && action.card === nexus.cards.hands[p.id] &&
    Object.keys(action).sort().join(',') === 'card,choice,ownRedraws,turn,type' &&
    [0, 1, 2].includes(action.ownRedraws as number), 'Choose your current Nexus card opportunity.');
  const choice = action.choice as NexusCardChoice;
  requireRule(nexusCardChoices(nexus.phase, nexus.cards, p.id).includes(choice), 'That Nexus choice is unavailable.');
  requireRule(choice !== 'keep' || action.ownRedraws === 0, 'Keeping your card does not draw a replacement.');
  if (choice === 'draw') nexus.cards = nexusRule(() => drawNexusCard(nexus.cards!, p.id, g.players, random));
  else if (choice === 'replace')
    nexus.cards = nexusRule(() => replaceNexusCard(nexus.cards!, p.id, g.players, random));
  if (choice !== 'keep') {
    // The player preselects this optional policy knowing their own faction's
    // printed effect. No private redraw prompt leaks its identity through
    // whether the public phase waits or advances. At most two redraws are
    // possible: twelve cards and at most six held cards leave other cards in
    // the recycled deck after drawing the same own card for a second time.
    for (let remaining = action.ownRedraws as number;
      remaining > 0 && nexus.cards.hands[p.id] === p.faction; remaining--)
      nexus.cards = nexusRule(() => replaceNexusCard(nexus.cards!, p.id, g.players, random));
  }
  nexus.phase = nexusRule(() => finishNexusCardChoice(nexus.phase!, g.players, nexus.cards!, p.id, choice));
  log(g, `${p.name} ${choice === 'keep' ? 'finished their Nexus card choice' : choice === 'draw' ? 'drew a secret Nexus Card' : 'discarded a Nexus Card and drew a secret replacement'}.`);
  if (nexus.phase.stage === 'complete') completePhase(g);
}
function projectedNexusCards(g: Game, id: string) {
  const nexus = g.nexusCards;
  if (!nexus?.cards) return null;
  return { ...projectNexusCards(nexus.cards, id, g.players), turn: nexus.phase?.turn ?? null,
    choices: nexusCardChoices(nexus.phase, nexus.cards, id),
    waiting: nexus.phase?.stage === 'drawing' ? nexus.phase.eligible.filter(owner => !nexus.phase!.done.includes(owner)) : [] };
}
function nexusTraitorUniverse(g: Game) {
  // This describes the printed setup inventory; it never regenerates the deck
  // from current hands, captured leaders or Face Dancer custody.
  return traitorDeck(g.players.map(p => ({ leaders: [
    ...leaders(p.faction), ...(g.advanced && p.faction === 'choam' ? [createAuditorLeader()] : []),
  ] })), g.expansions.includes('ix'));
}
function nexusTraitorSnapshot(g: Game): NexusTraitorSnapshot {
  return { reserve: [...(g.traitorReserve ?? [])], players: g.players.map(p => ({
    id: p.id, faction: p.faction, traitors: [...p.traitors],
    ...(p.faceDancers ? { faceDancers: structuredClone(p.faceDancers) } : {}),
  })) };
}
function pendingNexusTraitors(g: Game) {
  return g.nexusTraitorExchanges?.find(exchange => exchange.stage === 'return') ?? null;
}
function nexusTraitorParentSignature(g: Game, event: string) {
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const context = continuation && 'resume' in continuation ? continuation.resume : g;
  const resume = { response: context.response ?? null, decision: context.decision ?? null,
    pendingKarama: 'pendingKarama' in context ? context.pendingKarama as Game['pendingKarama'] ?? null : null,
    phaseOpening: 'phaseOpening' in context ? context.phaseOpening as Game['phaseOpening'] ?? null : null };
  const battle = g.battle ? Object.fromEntries(Object.entries(g.battle).filter(([key]) => key !== 'truthPromises')) : null;
  return JSON.stringify({ event, turn: g.turn, phase: g.phase, status: g.status, active: g.active,
    order: g.order, ready: g.ready, battle, nullentropy: g.pendingNullentropy ?? null,
    controls: nullentropyParentSignature(g, resume, event) });
}
function traitorDeclarationContext(g: Game): TraitorDeclarationContext {
  const b = g.battle!;
  return { event: b.event!, attacker: b.attacker, defender: b.defender, plans: b.plans,
    players: g.players.map(({id,faction,ally,traitors}) => ({id,faction,ally,traitors})),
    heroLeaderIds: physicalTreacheryCards(g).filter(c => c.kind === 'hero').map(c => c.id),
  };
}
function traitorDeclarationIntegrity(g: Game) {
  const b = g.battle;
  if (!b) return;
  if (b.traitorDeclarationVersion === undefined && b.traitorDeclarations === undefined) return;
  nexusRule(() => validateTraitorDeclarations(traitorDeclarationContext(g), b.traitorCalls,
    b.traitorDeclarations, b.traitorDeclarationVersion));
}
function ensureTraitorDeclarations(g: Game) {
  const b = g.battle;
  if (!b?.revealed || b.traitorDeclarationVersion) return;
  requireRule(b.event, 'This battle predates the durable traitor declaration record.');
  b.traitorDeclarationVersion = 1;
  b.traitorDeclarations = {};
  for (const [voter, called] of Object.entries(b.traitorCalls))
    if (called) b.traitorDeclarations[voter] = nexusRule(() => createTraitorDeclaration(traitorDeclarationContext(g), voter));
}
function nexusTraitorIntegrity(g: Game) {
  const history = g.nexusTraitorExchanges;
  if (!history) {
    requireRule(!g.nexusTraitorPending && !g.nexusTraitorParent, 'The pending Nexus exchange has lost its physical draw record.');
    return;
  }
  requireRule(g.nexusCards?.cards && Array.isArray(history), 'Nexus exchanges require the original card module.');
  const universe = nexusTraitorUniverse(g);
  nexusRule(() => validateNexusTraitorSnapshot(nexusTraitorSnapshot(g), universe));
  const events = new Set<string>();
  for (const exchange of history) {
    requireRule(!events.has(exchange.event) && exchange.turn <= g.turn,
      'Nexus exchange history is duplicated or belongs to a future turn.');
    events.add(exchange.event);
    if (exchange.stage === 'complete') nexusRule(() => validateNexusTraitorHistory(universe, exchange));
    else requireRule(exchange.stage === 'return', 'Invalid Nexus exchange progress.');
  }
  const pending = history.filter(exchange => exchange.stage === 'return');
  requireRule(pending.length <= 1 && (pending[0]?.event ?? null) === (g.nexusTraitorPending ?? null),
    'The Nexus exchange pending marker contradicts its draw history.');
  if (pending.length) {
    const exchange = pending[0];
    requireRule(g.status === 'playing' && exchange === history.at(-1) && exchange.turn === g.turn && exchange.phase === g.phase &&
      g.nexusCards.cards.discard.includes('harkonnen'), 'The pending Nexus return has lost its turn, phase or spent card.');
    nexusRule(() => validateNexusTraitorExchange(nexusTraitorSnapshot(g), universe, exchange));
    requireRule(g.nexusTraitorParent?.event === exchange.event &&
      g.nexusTraitorParent.signature === nexusTraitorParentSignature(g, exchange.event),
    'The Nexus exchange has lost or changed its preceding game decision.');
  } else requireRule(!g.nexusTraitorParent, 'A completed Nexus return cannot retain a suspended decision.');
  traitorDeclarationIntegrity(g);
}
function nexusTraitorOffer(g: Game, id: string) {
  if (g.nexusCards?.cards?.hands[id] !== 'harkonnen') return null;
  const player = getPlayer(g, id), mode = nexusCardMode('harkonnen', player.faction, g.players.map(p => p.faction));
  let blocked: string | null = null;
  if (g.status !== 'playing') blocked = 'Nexus effects belong to the started game.';
  else if (player.ally) blocked = 'Allied players cannot retain or play a Nexus card.';
  else if (g.truthtrance) blocked = 'Finish the active Truthtrance first.';
  else if (g.nexusCards.phase?.stage === 'drawing') blocked = 'Finish the closing Nexus draws first.';
  else if (pendingNexusTraitors(g)) blocked = 'Finish the current Nexus return first.';
  else if (mode === 'betrayal') blocked = 'Betrayal reactions await the private response timing decision.';
  else if (mode === 'secretAlly' && g.phase !== 8) blocked = 'Use Secret Ally during Mentat Pause.';
  const draw = mode === 'secretAlly' ? 2 : 1;
  return { event: JSON.stringify(['nexusTraitors', g.turn, g.phase, g.nexusTraitorExchanges?.length ?? 0, id]), mode, draw, blocked };
}
function applyNexusTraitorSnapshot(g: Game, snapshot: NexusTraitorSnapshot) {
  g.traitorReserve = [...snapshot.reserve];
  for (const entry of snapshot.players) {
    const player = getPlayer(g, entry.id);
    player.traitors = [...entry.traitors];
    if (entry.faceDancers) player.faceDancers = structuredClone(entry.faceDancers);
  }
}
function playNexusTraitorDraw(g: Game, p: Player, action: Action) {
  const offer = nexusTraitorOffer(g, p.id);
  requireRule(offer && !offer.blocked && offer.mode !== 'betrayal' &&
    action.event === offer.event && action.mode === offer.mode && Object.keys(action).sort().join(',') === 'event,mode,type',
  offer?.blocked ?? 'This Nexus Traitor draw is stale or belongs to another player.');
  const result = nexusRule(() => beginNexusTraitorExchange(nexusTraitorSnapshot(g), nexusTraitorUniverse(g), {
    event: offer.event, owner: p.id, mode: offer.mode as 'cunning' | 'secretAlly', turn: g.turn, phase: g.phase,
  }));
  ensureTraitorDeclarations(g);
  g.nexusCards!.cards = nexusRule(() => discardNexusCard(g.nexusCards!.cards!, p.id, g.players));
  applyNexusTraitorSnapshot(g, result.state);
  (g.nexusTraitorExchanges ??= []).push(result.exchange);
  g.nexusTraitorPending = result.exchange.event;
  g.nexusTraitorParent = { event: result.exchange.event, signature: nexusTraitorParentSignature(g, result.exchange.event) };
  log(g, `${p.name} played the Harkonnen Nexus Card: ${offer.mode === 'cunning' ? 'Cunning' : 'Secret Ally'}. They drew ${offer.draw} private ${p.faction === 'tleilaxu' ? 'Face Dancer' : 'Traitor'} ${offer.draw === 1 ? 'Card' : 'Cards'} and must choose ${offer.draw} to return before play continues.`,
    { faction: p.faction, name: 'Harkonnen Nexus' });
}
function finishNexusTraitorReturn(g: Game, p: Player, action: Action) {
  const pending = pendingNexusTraitors(g);
  requireRule(pending?.owner === p.id && action.event === pending.event &&
    Object.keys(action).sort().join(',') === 'cards,event,type' && Array.isArray(action.cards),
  'This Nexus return is stale or belongs to another player.');
  const result = nexusRule(() => finishNexusTraitorExchange(nexusTraitorSnapshot(g), nexusTraitorUniverse(g),
    pending, action.cards as string[], random));
  applyNexusTraitorSnapshot(g, result.state);
  g.nexusTraitorExchanges![g.nexusTraitorExchanges!.length - 1] = result.exchange;
  g.nexusTraitorPending = null;
  g.nexusTraitorParent = null;
  log(g, `${p.name} secretly returned ${result.exchange.returned.length} ${p.faction === 'tleilaxu' ? 'Face Dancer' : 'Traitor'} ${result.exchange.returned.length === 1 ? 'Card' : 'Cards'}. The Traitor Deck was shuffled; their other cards and any prior traitor declaration remain unchanged.`);
}
function projectedNexusTraitors(g: Game, id: string) {
  if (!g.nexusCards?.cards) return null;
  const pending = pendingNexusTraitors(g);
  const owner = pending ? getPlayer(g, pending.owner) : null;
  return { offer: nexusTraitorOffer(g, id), pending: pending ? {
    event: pending.event, owner: pending.owner, mode: pending.mode, count: pending.drawn.length,
    choices: pending.owner !== id ? [] : (owner!.faction === 'tleilaxu'
      ? owner!.faceDancers!.filter(card => !card.revealed).map(card => ({id:card.leader, revealed:card.revealed, drawn:pending.drawn.includes(card.leader)}))
      : owner!.traitors.map(card => ({id:card, revealed:false, drawn:pending.drawn.includes(card)}))),
  } : null };
}

function nexusFaceDancerIntegrity(g: Game) {
  if (g.nexusFaceDancerHistory === undefined) return;
  requireRule(g.nexusCards?.cards && Array.isArray(g.nexusFaceDancerHistory),
    'Face Dancer Nexus history requires its original module.');
  const universe = nexusTraitorUniverse(g), events = new Set<string>();
  nexusRule(() => validateNexusTraitorSnapshot(nexusTraitorSnapshot(g), universe));
  for (const receipt of g.nexusFaceDancerHistory) {
    requireRule(!events.has(receipt.event) && receipt.turn <= g.turn &&
      g.players.some(p => p.id === receipt.owner && p.faction === 'tleilaxu'),
      'The Face Dancer replacement has lost its original owner or turn.');
    events.add(receipt.event);
    nexusRule(() => validateNexusFaceDancerHistory(universe, receipt));
  }
}
function projectedNexusTleilaxu(g: Game, id: string) {
  if (!g.nexusCards?.cards) return null;
  if (g.nexusCards.cards.hands[id] !== 'tleilaxu') return { cunning: null };
  const p = getPlayer(g, id);
  if (p.faction !== 'tleilaxu') return { cunning: null };
  const count = p.faceDancers?.filter(card => card.revealed).length ?? 0;
  let blocked: string | null = null;
  if (g.status !== 'playing') blocked = 'Use Cunning during an active game.';
  else if (p.ally) blocked = 'Allied players cannot use a Nexus card.';
  else if (g.truthtrance) blocked = 'Finish Truthtrance before replacing Face Dancers.';
  else if (g.pendingTreacheryDiscard) blocked = 'Finish the automatic card disposal first.';
  else if (g.nexusCards.phase?.stage === 'drawing') blocked = 'Finish the closing Nexus draws first.';
  else if (pendingNexusTraitors(g)) blocked = 'Finish the current private Traitor Deck return first.';
  else if (!count) blocked = 'No revealed Face Dancers are available to replace.';
  else if ((g.traitorReserve?.length ?? 0) < count) blocked = 'The Traitor Deck cannot supply the full replacement draw.';
  return { cunning: { event: JSON.stringify(['nexusFaceDancers', g.turn, g.phase, g.nexusFaceDancerHistory?.length ?? 0, id]), count, blocked } };
}
function playNexusFaceDancers(g: Game, p: Player, action: Action) {
  requireRule(Object.keys(action).every(key => ['type', 'event'].includes(key)),
    'Cunning replaces every revealed Face Dancer; do not select a subset.');
  const offer = projectedNexusTleilaxu(g, p.id)?.cunning;
  requireRule(offer && action.event === offer.event && !offer.blocked,
    offer?.blocked ?? 'Choose the current owned Face Dancer replacement.');
  const result = nexusRule(() => replaceNexusFaceDancers(nexusTraitorSnapshot(g), nexusTraitorUniverse(g),
    { event: offer.event, owner: p.id, turn: g.turn, phase: g.phase }, random));
  g.nexusCards!.cards = nexusRule(() => discardNexusCard(g.nexusCards!.cards!, p.id, g.players));
  applyNexusTraitorSnapshot(g, result.state);
  (g.nexusFaceDancerHistory ??= []).push(result.receipt);
  log(g, `${p.name} set aside ${offer.count} revealed Face Dancer ${offer.count === 1 ? 'Card' : 'Cards'}, secretly drew replacements, then shuffled the set-aside cards into the Traitor Deck. Unrevealed Face Dancers and the normal Mentat replacement allowance are unchanged.`,
    { faction: p.faction, name: 'Nexus Face Dancer replacement' });
}

function nexusSuboidIntegrity(g: Game) {
  if (g.nexusSuboidHistory === undefined) {
    requireRule(!g.nexusSuboidLast, 'The Suboid Nexus effect has lost its saved history.');
    return;
  }
  requireRule(g.nexusCards?.cards, 'Suboid Nexus history requires its original module.');
  nexusRule(() => validateNexusSuboids(g, g.nexusSuboidHistory!));
  const last = g.nexusSuboidHistory.at(-1);
  requireRule(last && JSON.stringify(g.nexusSuboidLast) === JSON.stringify({ event: last.event, owner: last.owner, turn: last.turn }),
    'The Suboid Nexus effect has lost its latest committed play.');
  if (g.nexusSuboidHistory.some(receipt => receipt.turn === g.turn))
    requireRule(g.nexusCards.cards.discard.includes('ixians'), 'The active Suboid effect has lost its spent Nexus card.');
}
function projectedNexusSuboids(g: Game, id: string) {
  if (!g.nexusCards?.cards) return null;
  const ixians = byFaction(g, 'ixians');
  const active = !!ixians && nexusSuboidsActive(g, g.nexusSuboidHistory, ixians.id);
  if (g.nexusCards.cards.hands[id] !== 'ixians' || ixians?.id !== id) return { offer: null, active };
  const b = g.battle;
  let blocked: string | null = null;
  if (g.status !== 'playing' || g.phase !== 6 || !b || ![b.attacker, b.defender].includes(id))
    blocked = 'Use Cunning in your battle before submitting your Battle Plan.';
  else if (ixians.ally) blocked = 'Allied players cannot use a Nexus card.';
  else if (b.revealed || b.plans[id]) blocked = 'Your Battle Plan is already submitted.';
  else if (active) blocked = 'Your Suboids already have full strength this turn.';
  else if (g.truthtrance || g.pendingTreacheryDiscard || pendingNexusTraitors(g)) blocked = 'Finish the current private question or card return first.';
  else if (g.pendingNullentropy) blocked = 'Finish the paid Nullentropy search first.';
  else if (g.nexusCards.phase?.stage === 'drawing') blocked = 'Finish the closing Nexus draws first.';
  const event = b?.event ? JSON.stringify(['nexusSuboids', g.turn, b.event, id]) : '';
  if (!blocked) {
    const trial = structuredClone(g);
    (trial.nexusSuboidHistory ??= []).push(nexusRule(() => createNexusSuboids(trial, id, b!.event!)));
    trial.nexusSuboidLast = { event, owner: id, turn: g.turn };
    trial.nexusCards!.cards = nexusRule(() => discardNexusCard(trial.nexusCards!.cards!, id, trial.players));
    if (!findReachableBattlePlan(trial, getPlayer(trial, id)))
      blocked = 'Full-strength Suboids would prevent you from honoring an existing Battle Plan commitment.';
  }
  return { offer: { event, blocked }, active };
}
function playNexusSuboids(g: Game, p: Player, action: Action) {
  const offer = projectedNexusSuboids(g, p.id)?.offer;
  requireRule(Object.keys(action).every(key => ['type', 'event'].includes(key)) && offer &&
    action.event === offer.event && !offer.blocked, offer?.blocked ?? 'Choose your current Ixian Cunning opportunity.');
  commitNexusSuboids(g, p);
}
function commitNexusSuboids(g: Game, p: Player) {
  const receipt = nexusRule(() => createNexusSuboids(g, p.id, g.battle!.event!));
  g.nexusCards!.cards = nexusRule(() => discardNexusCard(g.nexusCards!.cards!, p.id, g.players));
  (g.nexusSuboidHistory ??= []).push(receipt);
  g.nexusSuboidLast = { event: receipt.event, owner: receipt.owner, turn: receipt.turn };
  log(g, `${p.name} used Ixian Cunning. Every Suboid has full strength without spice support in all battles for the rest of this turn. Cyborg strength, support and physical force counts are unchanged.`,
    { faction: p.faction, name: 'Nexus Suboid strength' });
}

function nexusAdvisorFrame(g: Game, owner: string) {
  const p = getPlayer(g, owner);
  return JSON.stringify([g.status, g.turn, g.phase, g.active, g.movementRemaining,
    p.shipped, p.moved, g.hajr, g.guildTimingGranted, g.guildTimingLocked]);
}
function nexusAdvisorRecordSignature(record: NonNullable<Game['nexusAdvisorHistory']>[number]) {
  return JSON.stringify([record.receipt.signature, record.stage, record.frame]);
}
function pendingNexusAdvisors(g: Game) {
  return g.nexusAdvisorHistory?.find(record => record.stage === 'pending') ?? null;
}
function validateNexusAdvisorResponse(g: Game, response: ResponseWindow) {
  const record = pendingNexusAdvisors(g);
  requireRule(record && response.kind === 'nexusAdvisorFlip' &&
    response.owner === record.receipt.owner && response.intent === record.receipt.event &&
    Object.keys(response).every(key => ['kind', 'owner', 'intent', 'passed'].includes(key)) &&
    Array.isArray(response.passed) && new Set(response.passed).size === response.passed.length &&
    response.passed.every(id => g.players.some(p => p.id === id)),
    'The Nexus advisor conversion has lost its original response.');
  requireRule(g.status === 'playing' && g.phase === 5 && g.active === record.receipt.owner &&
    record.receipt.turn === g.turn && record.frame === nexusAdvisorFrame(g, record.receipt.owner),
    'The Nexus advisor conversion has lost its original Shipment and Movement action.');
  nexusRule(() => validateNexusAdvisors(g, record.receipt, true));
}
function nexusAdvisorIntegrity(g: Game) {
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const contexts = [g, g.pendingExchange, g.pendingNullentropy?.resume, g.pendingRicheseGift?.resume,
    g.pendingRichesePurchaseIncome?.resume, g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null];
  const responses = contexts.flatMap(context => {
    const pending = context && 'pendingKarama' in context ? context.pendingKarama as Game['pendingKarama'] : null;
    return [context?.response, pending?.use.kind === 'cancel' ? pending.use.response : null];
  }).filter(response => response?.kind === 'nexusAdvisorFlip');
  const history = g.nexusAdvisorHistory;
  if (history === undefined) {
    requireRule(!g.nexusAdvisorLast && !responses.length, 'The Nexus advisor conversion has lost its saved history.');
    return;
  }
  requireRule(g.nexusCards?.cards && Array.isArray(history) && history.length > 0,
    'Nexus advisor history requires its original module and played card.');
  const turns = new Set<number>();
  for (const [index, record] of history.entries()) {
    requireRule(record && record.receipt && typeof record.receipt === 'object' &&
      Object.keys(record).sort().join(',') === 'frame,receipt,signature,stage' &&
      ['pending', 'completed', 'canceled'].includes(record.stage) &&
      typeof record.frame === 'string' && record.signature === nexusAdvisorRecordSignature(record) &&
      record.receipt.event === JSON.stringify(['nexusAdvisors', record.receipt.turn, record.receipt.owner, index]) &&
      !turns.has(record.receipt.turn) &&
      (record.stage !== 'pending' || index === history.length - 1),
      'The Nexus advisor conversion history is malformed.');
    nexusRule(() => validateNexusAdvisors(g, record.receipt, record.stage === 'pending'));
    turns.add(record.receipt.turn);
  }
  const last = history.at(-1)!;
  requireRule(JSON.stringify(g.nexusAdvisorLast) === JSON.stringify({event: last.receipt.event, stage: last.stage}),
    'The Nexus advisor conversion has lost its latest outcome.');
  requireRule((last.stage === 'pending') === (responses.length > 0),
    'The Nexus advisor conversion has lost or reopened its cancellation response.');
  if (last.receipt.turn === g.turn) requireRule(g.nexusCards.cards.discard.includes('beneGesserit'),
    'The advisor conversion has lost its spent Nexus card.');
  for (const response of responses) validateNexusAdvisorResponse(g, response!);
}
function projectedNexusAdvisors(g: Game, id: string) {
  if (!g.nexusCards?.cards) return null;
  const record = pendingNexusAdvisors(g);
  const pending = record ? {owner: record.receipt.owner, event: record.receipt.event,
    territories: record.receipt.selections.map(selection => selection.territory)} : null;
  const p = getPlayer(g, id);
  if (p.faction !== 'beneGesserit' || g.nexusCards.cards.hands[id] !== 'beneGesserit') return {offer: null, pending};
  let blocked: string | null = null;
  if (!g.advanced) blocked = 'Advisors are available only in the Advanced game.';
  else if (g.status !== 'playing' || g.phase !== 5 || g.active !== id)
    blocked = 'Use Cunning during your own Shipment and Movement action.';
  else if (p.ally) blocked = 'Allied players cannot use a Nexus card.';
  else if (g.truthtrance || g.response || g.decision || g.phaseOpening || g.pendingKarama ||
    g.pendingTreacheryDiscard || g.pendingNullentropy || pendingNexusTraitors(g) || record)
    blocked = 'Finish the current interaction before converting advisors.';
  else if (g.nexusCards.phase?.stage === 'drawing') blocked = 'Finish the closing Nexus draws first.';
  const territories = nexusRule(() => quoteNexusAdvisors(g, id)).territories;
  if (!blocked && !territories.some(group => !group.blocked)) blocked = 'No advisor group is currently available to convert.';
  return {offer: {event: JSON.stringify(['nexusAdvisors', g.turn, id, g.nexusAdvisorHistory?.length ?? 0]), blocked, territories}, pending};
}
function playNexusAdvisors(g: Game, p: Player, action: Action) {
  const offer = projectedNexusAdvisors(g, p.id)?.offer;
  requireRule(Object.keys(action).every(key => ['type', 'event', 'territories'].includes(key)) &&
    offer && action.event === offer.event && !offer.blocked,
    offer?.blocked ?? 'Choose your current Nexus advisor conversion.');
  requireRule(Array.isArray(action.territories) && action.territories.every(t => typeof t === 'string'),
    'Select whole advisor territories.');
  const receipt = nexusRule(() => createNexusAdvisors(g, p.id, offer.event, action.territories as string[]));
  const record = {receipt, stage: 'pending' as const, frame: nexusAdvisorFrame(g, p.id), signature: ''};
  record.signature = nexusAdvisorRecordSignature(record);
  g.nexusCards!.cards = nexusRule(() => discardNexusCard(g.nexusCards!.cards!, p.id, g.players));
  (g.nexusAdvisorHistory ??= []).push(record);
  g.nexusAdvisorLast = {event: receipt.event, stage: record.stage};
  g.response = {kind: 'nexusAdvisorFlip', owner: p.id, intent: receipt.event, passed: []};
  log(g, `${p.name} spent Bene Gesserit Nexus Cunning to convert all advisors in ${receipt.selections.map(s => territory(s.territory).name).join(', ')}. Karama may prevent this entire conversion.`,
    {faction: p.faction, name: 'Nexus advisor conversion declared'});
}
function finishNexusAdvisors(g: Game, canceled: boolean) {
  const record = pendingNexusAdvisors(g)!;
  const p = getPlayer(g, record.receipt.owner);
  if (!canceled) for (const selection of record.receipt.selections) delete p.advisors![selection.territory];
  record.stage = canceled ? 'canceled' : 'completed';
  record.signature = nexusAdvisorRecordSignature(record);
  g.nexusAdvisorLast = {event: record.receipt.event, stage: record.stage};
  log(g, canceled
    ? 'Karama prevented the entire Nexus advisor conversion. Every selected group remains advisors; the Nexus card stays spent.'
    : `${p.name} converted every advisor in ${record.receipt.selections.map(s => territory(s.territory).name).join(', ')} to fighters. The forces remain in place and no shipment, movement or spice was spent.`,
    {faction: p.faction, name: canceled ? 'Nexus advisor conversion prevented' : 'Nexus advisors become fighters'});
}

function currentNexusSardaukar(g: Game) {
  return g.battle?.event ? g.nexusSardaukarHistory?.find(record => record.receipt.battle === g.battle!.event) ?? null : null;
}
function nexusSardaukarEffective(g: Game, id: string, to: string) {
  const record = currentNexusSardaukar(g);
  return record && record.receipt.owner === id && record.receipt.territory === to && record.stage === 'active' ? record.receipt.count : 0;
}
function nexusSardaukarParent(g: Game) {
  const b = g.battle!;
  return JSON.stringify([b.attacker, b.defender, b.territory, b.preparation ?? null,
    b.powerChecks ?? null, b.preLeader ?? null, b.plans]);
}
function nexusSardaukarSignature(record: NonNullable<Game['nexusSardaukarHistory']>[number]) {
  return JSON.stringify([record.receipt.signature, record.stage, record.parent, record.casualties ?? null]);
}
function validateNexusSardaukarResponse(g: Game, response: ResponseWindow) {
  const record = currentNexusSardaukar(g), b = g.battle;
  requireRule(record?.stage === 'pending' && b && !b.revealed &&
    record.receipt.turn === g.turn && record.receipt.territory === b.territory &&
    response.kind === 'nexusSardaukar' && response.owner === record.receipt.owner && response.intent === record.receipt.event &&
    Object.keys(response).every(key => ['kind', 'owner', 'intent', 'passed'].includes(key)) &&
    Array.isArray(response.passed) && new Set(response.passed).size === response.passed.length &&
    response.passed.every(id => g.players.some(p => p.id === id)) && record.parent === nexusSardaukarParent(g),
    'The Nexus Sardaukar response has lost its original battle and preparation.');
  const p = getPlayer(g, record.receipt.owner), other = getPlayer(g, b.attacker === p.id ? b.defender : b.attacker);
  const forces = combatForces(g, p, b.territory, other);
  requireRule(forces.normal === record.receipt.normal && forces.elite === 0,
    'The pending Nexus Sardaukar declaration has lost its original eligible forces.');
}
function nexusSardaukarIntegrity(g: Game) {
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const contexts = [g, g.pendingExchange, g.pendingNullentropy?.resume, g.pendingRicheseGift?.resume,
    g.pendingRichesePurchaseIncome?.resume, g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null];
  const responses = contexts.flatMap(context => {
    const pending = context && 'pendingKarama' in context ? context.pendingKarama as Game['pendingKarama'] : null;
    return [context?.response, pending?.use.kind === 'cancel' ? pending.use.response : null];
  }).filter(response => response?.kind === 'nexusSardaukar');
  const history = g.nexusSardaukarHistory;
  if (history === undefined) {
    requireRule(!g.nexusSardaukarLast && !g.battle?.nexusSardaukarUsed && !g.lastBattleContext?.nexusSardaukarCasualties && !responses.length,
      'The Nexus Sardaukar use has lost its saved history.');
    return;
  }
  requireRule(g.advanced && g.nexusCards?.cards && Array.isArray(history) && history.length > 0,
    'Nexus Sardaukar history requires its original Advanced module.');
  const battles = new Set<string>(), turns = new Set<number>();
  for (const [index, record] of history.entries()) {
    requireRule(record && record.receipt && typeof record.receipt === 'object' &&
      Object.keys(record).sort().join(',') === (record.casualties ? 'casualties,parent,receipt,signature,stage' : 'parent,receipt,signature,stage') &&
      ['pending', 'active', 'canceled'].includes(record.stage) && typeof record.parent === 'string' &&
      record.signature === nexusSardaukarSignature(record) && !battles.has(record.receipt.battle) &&
      !turns.has(record.receipt.turn) && (record.stage !== 'pending' || index === history.length - 1),
      'The Nexus Sardaukar battle history is malformed.');
    nexusRule(() => validateNexusSardaukar(g, record.receipt));
    const losses = record.casualties;
    if (losses) {
      requireRule(record.stage === 'active' && ['pending','complete'].includes(losses.outcome) &&
        Object.keys(losses).sort().join(',') === 'dial,forces,options,outcome,support' &&
        validCombatForces(losses.forces) && losses.forces.temporaryElite === 5 &&
        Array.isArray(losses.options) && losses.options.length > 0 &&
        JSON.stringify(losses.options) === JSON.stringify(casualtyOptions(losses.forces,losses.dial,losses.support)),
        'The Nexus Sardaukar casualties have lost their committed force allocation.');
      if (losses.outcome === 'pending') {
        const context = g.lastBattleContext;
        requireRule(!g.battle && context?.event === record.receipt.battle && context.result === 'normal' &&
          context.winner === record.receipt.owner && context.nexusSardaukarCasualties === record.receipt.event &&
          context.territory === record.receipt.territory && context.turn === record.receipt.turn,
          'The pending Sardaukar casualties have lost their completed battle.');
        const pool = combatArmy(g,record.receipt.owner,record.receipt.territory);
        requireRule(pool.normal === losses.forces.normal && pool.elite === losses.forces.elite,
          'The pending Sardaukar casualties have lost their exact physical army.');
        const decisions = homeworldSavedDecisions(g).filter(d => d.kind === 'battleLosses' && d.player === record.receipt.owner);
        const committed = continuation?.kind === 'battleResolved' && continuation.event === record.receipt.battle ? continuation.casualties : null;
        requireRule(decisions.length > 0 || committed, 'The Nexus Sardaukar battle has lost its casualty choice.');
        for (const decision of decisions) requireRule(decision.kind === 'battleLosses' &&
          decision.territory === record.receipt.territory && JSON.stringify(decision.options) === JSON.stringify(losses.options),
          'The casualty choices differ from the committed Nexus Sardaukar plan.');
        if (committed) requireRule(JSON.stringify(committed) === JSON.stringify({forces:losses.forces,dial:losses.dial,support:losses.support,options:losses.options}),
          'The suspended Sardaukar casualty allocation was changed.');
        if (g.homeworldBattleLoss) requireRule(JSON.stringify(g.homeworldBattleLoss.commitment) ===
          JSON.stringify({forces:losses.forces,dial:losses.dial,support:losses.support}),
          'The Homeworld Sardaukar casualties have lost their effective combat roles.');
      }
    }
    battles.add(record.receipt.battle); turns.add(record.receipt.turn);
  }
  const last = history.at(-1)!;
  requireRule(JSON.stringify(g.nexusSardaukarLast) === JSON.stringify({event: last.receipt.event, stage: last.stage}),
    'The Nexus Sardaukar use has lost its latest saved outcome.');
  if (last.receipt.turn === g.turn) requireRule(g.nexusCards.cards.discard.includes('emperor'),
    'The Nexus Sardaukar use has lost its spent card.');
  const record = currentNexusSardaukar(g), b = g.battle;
  requireRule((record?.stage === 'pending') === (responses.length > 0) &&
    (last.stage !== 'pending' || record === last), 'The Nexus Sardaukar use has lost or reopened its response.');
  if (b) requireRule(b.nexusSardaukarUsed === record?.receipt.event,
    'The battle has lost its original Nexus Sardaukar marker.');
  if (record) {
    requireRule(g.phase === 6 && record.receipt.turn === g.turn && b!.territory === record.receipt.territory &&
      [b!.attacker, b!.defender].includes(record.receipt.owner), 'The temporary Sardaukar belong to another battle.');
    if (record.stage !== 'canceled') {
      const p = getPlayer(g, record.receipt.owner), other = getPlayer(g, b!.attacker === p.id ? b!.defender : b!.attacker);
      const forces = combatForces(g, p, b!.territory, other);
      requireRule(forces.normal >= 5 && forces.elite === 0, 'The Nexus battle no longer has five eligible ordinary forces.');
    }
  }
  for (const response of responses) validateNexusSardaukarResponse(g, response!);
  const lastLoss = history.find(record => record.receipt.battle === g.lastBattleContext?.event)?.casualties;
  const lossEvent = history.find(record => record.receipt.battle === g.lastBattleContext?.event)?.receipt.event;
  requireRule(g.lastBattleContext?.nexusSardaukarCasualties === (lastLoss ? lossEvent : undefined),
    'The completed battle has lost its Nexus Sardaukar casualty receipt.');
}
function nexusSardaukarEligibility(g: Game, p: Player): string | null {
  const b = g.battle;
  if (!g.advanced) return 'Sardaukar are an Advanced advantage.';
  if (g.status !== 'playing' || g.phase !== 6 || !b?.event || ![b.attacker,b.defender].includes(p.id))
    return 'Use Cunning in your own battle before submitting your Battle Plan.';
  if (p.faction !== 'emperor' || p.ally || g.nexusCards?.cards?.hands[p.id] !== 'emperor')
    return 'Use your own Emperor Nexus card while unallied.';
  if (b.revealed || b.plans[p.id] || b.nexusSardaukarUsed) return 'This battle has already committed your plan or used Emperor Cunning.';
  const other = getPlayer(g, b.attacker === p.id ? b.defender : b.attacker);
  const forces = combatForces(g, p, b.territory, other);
  if (forces.elite) return 'Cunning requires a battle containing none of your actual Sardaukar.';
  if (forces.normal < 5) return 'Using Emperor Cunning with fewer than five eligible forces awaits a ruling.';
  return null;
}
function projectedNexusSardaukar(g: Game, id: string) {
  if (!g.nexusCards?.cards) return null;
  const record = currentNexusSardaukar(g);
  const active = record?.stage === 'active';
  const pending = record?.stage === 'pending' ? {event: record.receipt.event, owner: record.receipt.owner} : null;
  const p = getPlayer(g,id);
  if (p.faction !== 'emperor' || g.nexusCards.cards.hands[id] !== 'emperor') return {offer:null,active,pending};
  let blocked = nexusSardaukarEligibility(g,p);
  if (!blocked && (g.truthtrance || g.response || g.decision || g.phaseOpening || g.pendingKarama ||
    g.pendingTreacheryDiscard || g.pendingNullentropy || pendingNexusTraitors(g) || g.nexusCards.phase?.stage === 'drawing'))
    blocked = 'Finish the current interaction before declaring Nexus Sardaukar.';
  const event = g.battle?.event ? JSON.stringify(['nexusSardaukar',g.turn,g.battle.event,id]) : '';
  if (!blocked) {
    const trial = structuredClone(g);
    commitNexusSardaukar(trial,getPlayer(trial,id),'active');
    if (!findReachableBattlePlan(trial,getPlayer(trial,id)))
      blocked = 'Sardaukar strength would prevent you from honoring an existing Battle Plan commitment.';
  }
  return {offer:{event,blocked},active,pending};
}
function commitNexusSardaukar(g: Game, p: Player, stage: 'pending' | 'active') {
  const blocked = nexusSardaukarEligibility(g,p);
  requireRule(!blocked, blocked ?? 'The Nexus Sardaukar opportunity is unavailable.');
  const b = g.battle!, other = getPlayer(g,b.attacker === p.id ? b.defender : b.attacker);
  const receipt = nexusRule(() => createNexusSardaukar(g,p.id,b.event!,b.territory,combatForces(g,p,b.territory,other).normal));
  const record = {receipt,stage,parent:nexusSardaukarParent(g),signature:''};
  record.signature = nexusSardaukarSignature(record);
  g.nexusCards!.cards = nexusRule(() => discardNexusCard(g.nexusCards!.cards!,p.id,g.players));
  (g.nexusSardaukarHistory ??= []).push(record);
  g.nexusSardaukarLast = {event:receipt.event,stage}; b.nexusSardaukarUsed = receipt.event;
  if (stage === 'pending') g.response = {kind:'nexusSardaukar',owner:p.id,intent:receipt.event,passed:[]};
}
function playNexusSardaukar(g: Game,p: Player,action: Action) {
  const offer = projectedNexusSardaukar(g,p.id)?.offer;
  requireRule(Object.keys(action).every(key => ['type','event'].includes(key)) && offer && !offer.blocked && action.event === offer.event,
    offer?.blocked ?? 'Choose the current Emperor Cunning opportunity.');
  commitNexusSardaukar(g,p,'pending');
  log(g,`${p.name} spent Emperor Nexus Cunning to count five ordinary forces as Sardaukar for this battle. Karama may prevent this use. The physical counters remain ordinary forces.`,
    {faction:p.faction,name:'Nexus Sardaukar declared'});
}
function finishNexusSardaukar(g: Game,canceled: boolean) {
  const record = currentNexusSardaukar(g)!;
  record.stage = canceled ? 'canceled' : 'active'; record.signature = nexusSardaukarSignature(record);
  g.nexusSardaukarLast = {event:record.receipt.event,stage:record.stage};
  if (canceled) reconcileChangedBattleInspections(g, 'the canceled Sardaukar enhancement');
  log(g,canceled ? 'Karama prevented Emperor Cunning. These forces remain ordinary in both strength and physical custody; the Nexus card stays spent.'
    : 'Five ordinary Emperor forces count as Sardaukar in this battle only. They use Sardaukar strength and support, including the Fremen exception, but every casualty remains an ordinary physical counter.',
    {faction:'emperor',name:canceled ? 'Nexus Sardaukar prevented' : 'Nexus Sardaukar active'});
}

function battleInspectionContext(g: Game): BattleInspectionContext {
  const b = g.battle!;
  return { event: b.event!, attacker: b.attacker, defender: b.defender,
    players: g.players.map(({id,faction}) => ({id,faction})), native: b.prescience };
}
function nexusInspectionIntegrity(g: Game) {
  const b = g.battle;
  if (!b) return;
  const record = b.nexusInspection;
  requireRule(!!record === !!b.nexusInspectionUsed, 'The Nexus inspection presence record is missing.');
  if (!record) return;
  requireRule(g.phase === 6 && b.event && b.nexusInspectionUsed === b.event &&
    g.nexusCards?.cards?.discard.includes('atreides'), 'The played Nexus inspection has lost its battle or physical card.');
  nexusRule(() => validateNexusInspection(battleInspectionContext(g), record));
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const contexts = [g, g.pendingExchange, g.pendingNullentropy?.resume, g.pendingRicheseGift?.resume,
    g.pendingRichesePurchaseIncome?.resume, g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null];
  const responses = contexts.flatMap(context => {
    const pending = context && 'pendingKarama' in context ? context.pendingKarama as Game['pendingKarama'] : null;
    return [context?.response, pending?.use.kind === 'cancel' ? pending.use.response : null];
  }).filter(response => response?.kind === 'nexusPrescience');
  requireRule((record.stage === 'response') === (responses.length > 0),
    'The extra inspection has lost or reopened its original cancellation response.');
  for (const response of responses) validateNexusInspectionResponse(g, response!);
  for (const target of [b.attacker, b.defender]) {
    const plan = b.plans[target];
    if (plan) requireRule(committedPlanElements(b, target).every(element => plan[element.field] === element.value),
      'The sealed plan contradicts its inspected commitment.');
  }
  if (record.stage === 'answer' || record.stage === 'response')
    requireRule(!b.revealed && (b.preparation?.kind === 'nexusPrescienceAnswer' ||
      (b.preparation?.kind === 'prescienceAnswer' && b.prescience && !Object.hasOwn(b.prescience, 'value'))),
    'The unanswered Nexus inspection is missing its owned answer.');
  if (b.preparation?.kind === 'nexusPrescienceAnswer')
    requireRule((record.stage === 'answer' || record.stage === 'response') && b.preparation.owner === record.target &&
      b.preparation.beneficiary === record.owner, 'The pending Nexus answer belongs to the wrong player.');
}
function nexusAtreidesOffer(g: Game, id: string) {
  if (g.nexusCards?.cards?.hands[id] !== 'atreides') return null;
  const p = getPlayer(g, id), b = g.battle;
  const mode = nexusCardMode('atreides', p.faction, g.players.map(player => player.faction));
  let blocked: string | null = null;
  if (g.status !== 'playing' || g.phase !== 6 || !b?.event || b.revealed)
    blocked = 'Play this Nexus Card before the current battle plans are revealed.';
  else if (p.ally) blocked = 'Allied players cannot use a Nexus Card.';
  else if (b.nexusInspection || b.nexusInspectionUsed) blocked = 'This battle already used the Atreides Nexus Card.';
  else if (pendingNexusTraitors(g)) blocked = 'Finish the private Nexus card return first.';
  else if (g.truthtrance || g.decision || g.phaseOpening || g.pendingKarama || g.pendingTreacheryDiscard || g.pendingNullentropy)
    blocked = 'Finish the current interaction before playing this Nexus Card.';
  else if (mode === 'betrayal') {
    blocked = 'Betrayal reactions await the private response timing decision.';
  } else if (![b.attacker, b.defender].includes(id) || b.plans[id])
    blocked = 'Use this inspection in your own battle before sealing your plan.';
  else if (g.response || b.preparation || (b.preLeader && !b.preLeader.closed))
    blocked = 'Finish the preceding battle preparation first.';
  else if (mode === 'cunning' && (!b.prescience || b.prescience.player !== id || !Object.hasOwn(b.prescience, 'value')))
    blocked = 'Cunning needs your first completed native inspection.';
  const target = b && (b.attacker === id ? b.defender : b.attacker);
  const fields = mode === 'betrayal' ? [] : (['leader', 'weapon', 'defense', 'dial'] as PlanField[])
    .filter(field => !(mode === 'cunning' && (field === b?.prescience?.field ||
      (field === 'dial' && target && b?.noFieldPlayers?.includes(target)))));
  return { event: b?.event ?? '', mode, fields, blocked };
}
function finishInspectionAnswers(g: Game) {
  const b = g.battle!;
  if (b.prescience && !Object.hasOwn(b.prescience, 'value')) {
    b.preparation = { kind: 'prescienceAnswer', owner: b.prescience.player === b.attacker ? b.defender : b.attacker,
      beneficiary: b.prescience.player };
  } else if (b.nexusInspection?.stage === 'answer') {
    b.preparation = { kind: 'nexusPrescienceAnswer', owner: b.nexusInspection.target, beneficiary: b.nexusInspection.owner };
  } else if (b.nexusInspection && b.nexusInspection.mode !== 'betrayal') delete b.preparation;
  else finishBattlePreparation(g);
}
function answerCurrentNexusInspection(g: Game, value: unknown) {
  const b = g.battle!, record = b.nexusInspection!;
  const target = getPlayer(g, record.target);
  requireRule(feasiblePrescience(g, target, record.field, value),
    'Choose an element that permits a legal battle plan and respects every prior commitment.');
  b.nexusInspection = nexusRule(() => answerNexusInspection(battleInspectionContext(g), record, value as string | number | null));
  log(g, `${target.name} committed the requested ${record.field}. Its value is private to the two combatants.`);
  finishInspectionAnswers(g);
}
function validateNexusInspectionResponse(g: Game, response: ResponseWindow) {
  const b = g.battle, record = b?.nexusInspection;
  requireRule(response.kind === 'nexusPrescience' && record?.mode === 'cunning' && record.stage === 'response' &&
    !record.answers.length && response.owner === record.owner && response.intent === b!.event,
  'The extra Prescience response no longer matches its original attempt.');
  return record;
}
function settleNexusInspectionResponse(g: Game, response: ResponseWindow, canceled: boolean) {
  const b = g.battle!, record = validateNexusInspectionResponse(g, response);
  if (canceled) {
    b!.nexusInspection = nexusRule(() => cancelNexusInspection(battleInspectionContext(g), record));
    log(g, 'Karama canceled the additional Atreides inspection. The first disclosed element remains binding.');
    finishInspectionAnswers(g);
  } else {
    b.nexusInspection = nexusRule(() => allowNexusInspection(battleInspectionContext(g), record));
    if (b.plans[record.target]) answerCurrentNexusInspection(g, b.plans[record.target][record.field]);
  }
}
function playNexusAtreides(g: Game, p: Player, action: Action) {
  const offer = nexusAtreidesOffer(g, p.id);
  requireRule(offer && !offer.blocked && action.event === offer.event && action.mode === offer.mode,
    offer?.blocked ?? 'This Atreides Nexus opportunity is stale.');
  requireRule(Object.keys(action).sort().join(',') === (offer.mode === 'betrayal' ? 'event,mode,type' : 'event,field,mode,type') &&
    (offer.mode === 'betrayal' || offer.fields.includes(action.field as PlanField)), 'Choose a current Nexus inspection field.');
  const b = g.battle!;
  const field = offer.mode === 'betrayal' ? b.prescience!.field : action.field as PlanField;
  const beneficiary = offer.mode === 'betrayal' ? b.prescience!.player : p.id;
  const target = beneficiary === b.attacker ? b.defender : b.attacker;
  const record = nexusRule(() => createNexusInspection(battleInspectionContext(g), { mode: offer.mode, owner: p.id, target, field }));
  g.nexusCards!.cards = nexusRule(() => discardNexusCard(g.nexusCards!.cards!, p.id, g.players));
  b.nexusInspection = record;
  b.nexusInspectionUsed = b.event;
  log(g, `${p.name} played the Atreides Nexus Card: ${offer.mode === 'cunning' ? 'Cunning' : offer.mode === 'secretAlly' ? 'Secret Ally' : 'Betrayal'}.`,
    { faction: p.faction, name: 'Atreides Nexus' });
  if (offer.mode === 'betrayal') {
    g.response = null;
    delete b.prescience;
    finishBattlePreparation(g);
  } else {
    b.preparation = { kind: 'nexusPrescienceAnswer', owner: target, beneficiary: p.id };
    if (offer.mode === 'cunning') g.response = { kind: 'nexusPrescience', owner: p.id, intent: b.event, passed: [] };
    else if (b.plans[target]) answerCurrentNexusInspection(g, b.plans[target][field]);
  }
}
function projectedNexusInsights(g: Game, id: string) {
  const record = g.battle?.nexusInspection;
  if (!record || ![record.owner, record.target].includes(id)) return [];
  return record.answers.map((value, index) => ({ field: record.field, value,
    label: g.players.flatMap(p => [...p.leaders, ...p.hand]).concat(g.dukeVidal ? [g.dukeVidal.leader] : [])
      .find(item => item.id === value)?.name ?? String(value ?? 'None'),
    active: record.stage === 'answered' && index === record.answers.length - 1 }));
}
function homeworldRule<T>(quote: () => T): T {
  try {
    return quote();
  } catch (error) {
    if (
      error instanceof HomeworldCustodyError ||
      error instanceof EmperorHomeworldMoveError ||
      error instanceof NativeReserveError ||
      error instanceof EcazPoisonIncomeError ||
      error instanceof HomeworldBenefitError
    )
      throw new RuleError(error.message);
    throw error;
  }
}
function stringField(value: unknown) {
  requireRule(typeof value === 'string', 'Expected a string.');
  return value;
}
function requireRule(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RuleError(message);
}
export function integer(
  value: unknown,
  min: number,
  max: number,
  label = 'Amount',
): number {
  requireRule(
    typeof value === 'number' &&
      Number.isSafeInteger(value) &&
      value >= min &&
      value <= max,
    `${label} must be an integer from ${min} to ${max}.`,
  );
  return value;
}
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
export function shuffle<T>(items: T[], rng = random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const log = (
  g: Game,
  text: string,
  automatic?: { faction: FactionId; name: string },
) => {
  g.log.push({
    seq: (g.log.at(-1)?.seq ?? 0) + 1,
    text,
    ...(automatic ? { automatic } : {}),
  });
  if (g.log.length > 250) g.log.shift();
};
const getPlayer = (g: Game, id: string) => {
  const p = g.players.find((p) => p.id === id);
  requireRule(p, 'You are not seated at this table.');
  return p;
};
const byFaction = (g: Game, f: string) =>
  g.players.find((p) => p.faction === f);
const at = presenceAt;
function noFieldRule<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    throw new RuleError(
      error instanceof Error ? error.message : 'Invalid No-Field operation.',
    );
  }
}
function revealPlayerNoField(g: Game, p: Player, cause: NoFieldRevealCause) {
  requireRule(
    p.faction === 'richese' && p.noField?.deployed,
    'No concealed No-Field is deployed.',
  );
  const result = noFieldRule(() =>
    revealRicheseNoField(p.noField!, {
      tokenId: p.noField!.deployed!.tokenId,
      reserves: p.reserves,
      cause,
    }),
  );
  requireRule(
    result.controller === p.id,
    'This concealed token has an invalid controller.',
  );
  const cohort =
    g.ornithopter?.player === p.id ? g.ornithopter.cohort : undefined;
  if (
    cohort?.noField?.tokenId === p.noField!.deployed!.tokenId &&
    cohort.noField.event === p.noFieldEvent
  ) {
    const key = location(result.location.territory, result.location.sector);
    cohort.forces[key] = (cohort.forces[key] ?? 0) + result.forces;
    delete cohort.noField;
  }
  p.noField = result.state;
  p.noFieldEvent = crypto.randomUUID();
  p.reserves -= result.forces;
  if (result.forces)
    place(p, result.location.territory, result.location.sector, result.forces);
  observeOccupation(g);
  log(
    g,
    `${p.name} revealed the ${result.value} No-Field in ${territory(result.location.territory).name} (${cause}) and placed ${result.forces} physical forces from reserves.${result.forces < result.value ? ' Only the remaining reserves could be placed.' : ''}`,
    { faction: 'richese', name: 'No-Field revealed' },
  );
  return result;
}
function noFieldShipBlock(g: Game, p: Player): string | null {
  if (g.status !== 'playing' || g.phase !== 5 || g.active !== p.id || p.shipped)
    return 'Use a No-Field during your shipment, before movement.';
  if (g.truthtrance || g.phaseOpening || g.response || g.decision)
    return 'Resolve the pending decision before declaring a No-Field shipment.';
  if (p.noFieldBlockedTurn === g.turn)
    return 'Karama prevented No-Field use for this shipment opportunity. Normal shipment remains available.';
  if (!p.noField || !p.noFieldEvent)
    return 'No-Field inventory is not initialized in this saved table.';
  if (p.noField.deployed)
    return 'Reveal the existing No-Field before shipping another.';
  return null;
}
function noFieldRevealBlock(g: Game, p: Player): string | null {
  if (g.status !== 'playing' || g.phase >= 6)
    return 'Voluntary No-Field reveal is available before the Battle phase.';
  if (!p.noField?.deployed) return 'No concealed No-Field is deployed.';
  if (g.truthtrance || g.phaseOpening || g.response || g.decision)
    return 'Resolve the pending interaction before revealing the No-Field.';
  return null;
}
function noFieldAllyOfferBlock(
  g: Game,
  owner: Player,
  pending = false,
): string | null {
  const ally = g.players.find((p) => p.id === owner.ally);
  if (owner.faction !== 'richese' || !ally || ally.ally !== owner.id)
    return 'Richese must have a current mutual ally.';
  if (
    g.status !== 'playing' ||
    g.phase !== 5 ||
    g.active !== ally.id ||
    ally.shipped
  )
    return 'Offer the token during your ally’s unused shipment turn.';
  if (
    !pending &&
    (g.truthtrance ||
      g.phaseOpening ||
      g.response ||
      (g.decision &&
        !(
          g.decision.kind === 'richeseAllyOpportunity' &&
          g.decision.player === owner.id
        )))
  )
    return 'Resolve the pending interaction before offering allied shipment.';
  if (!owner.noField || !owner.noFieldEvent)
    return 'No-Field inventory is not initialized.';
  if (ally.faction === 'fremen')
    return 'Fremen reserves are on the planet; this ability ships off-planet reserves.';
  if (ally.faction === 'guild' || g.karamaShipping?.player === ally.id)
    return 'Allied No-Field pricing with Guild or Karama discounts awaits a ruling.';
  if (
    g.richeseAllyBlocked?.turn === g.turn &&
    g.richeseAllyBlocked.recipient === ally.id
  )
    return 'Karama prevented No-Field use for this allied shipment opportunity.';
  return null;
}
function alliedNoFieldQuote(
  g: Game,
  offer: RicheseAllyOffer,
  checkFunds = true,
) {
  const owner = getPlayer(g, offer.owner),
    recipient = getPlayer(g, offer.recipient);
  const blocked = noFieldAllyOfferBlock(g, owner, true);
  requireRule(!blocked, blocked ?? 'Allied No-Field shipment is unavailable.');
  requireRule(
    owner.ally === recipient.id && owner.noFieldEvent === offer.tokenEvent,
    'This allied No-Field offer is stale.',
  );
  requireRule(
    offer.payer === owner.id ||
      offer.payer === recipient.id ||
      offer.payer === 'both',
    'Choose an ally payer or split a two-spice shipment equally.',
  );
  requireRule(
    offer.territory !== MOBILE_STRONGHOLD &&
      validLocation(offer.territory, offer.sector),
    'Choose a printed planet sector for the allied No-Field shipment.',
  );
  // Test the compulsory old-marker reveal without exposing or mutating it before acceptance.
  const trial = structuredClone(g),
    trialOwner = getPlayer(trial, owner.id),
    trialRecipient = getPlayer(trial, recipient.id);
  if (trialOwner.noField!.deployed)
    revealPlayerNoField(trial, trialOwner, 'beforeAlly');
  const materialized = noFieldRule(() =>
    shipAlliedRicheseNoField(
      trialOwner.noField!,
      {
        tokenId: offer.tokenId,
        controller: recipient.id,
        location: { territory: offer.territory, sector: offer.sector },
      },
      trialRecipient.reserves,
    ),
  );
  const advisors = arrivalAsAdvisor(trial, trialRecipient, offer.territory);
  allowedEntry(
    trial,
    trialRecipient,
    offer.territory,
    offer.sector,
    false,
    advisors,
  );
  const cost = territory(offer.territory).type === 'stronghold' ? 1 : 2;
  requireRule(
    offer.payer !== 'both' || cost === 2,
    'An equal split requires the two-spice shipment price.',
  );
  const ownerPayment =
    offer.payer === owner.id ? cost : offer.payer === 'both' ? 1 : 0;
  const recipientPayment = cost - ownerPayment;
  // The supplier may authorize only its own spending; recipient funding stays private until consent.
  requireRule(
    uncommittedSpice(g, owner) >= ownerPayment,
    'Richese needs enough uncommitted spice for its payment.',
  );
  if (checkFunds)
    requireRule(
      uncommittedSpice(g, recipient) >= recipientPayment,
      'The recipient needs enough uncommitted spice for its payment.',
    );
  const elites = recipient.elites?.reserves ?? 0;
  return {
    cost,
    ownerPayment,
    recipientPayment,
    amount: materialized.forces,
    value: materialized.value,
    advisors,
    eliteMin: Math.max(0, materialized.forces - (recipient.reserves - elites)),
    eliteMax: Math.min(elites, materialized.forces),
  };
}
function giftReserved(g: Game, owner: string, card: string) {
  return (
    g.pendingRicheseGift?.intent.owner === owner &&
    g.pendingRicheseGift.intent.cardId === card
  );
}
function nullentropyContext(g: Game) {
  const trial = structuredClone(g),
    pending = trial.pendingNullentropy;
  if (pending) {
    trial.response = pending.resume.response;
    trial.decision = pending.resume.decision;
    trial.pendingKarama = pending.resume.pendingKarama;
    trial.phaseOpening = pending.resume.phaseOpening;
    trial.pendingNullentropy = null;
  }
  return trial;
}
function nullentropyIntegrity(g: Game): string | null {
  const pending = g.pendingNullentropy;
  if (
    !pending ||
    pending.turn !== g.turn ||
    pending.phase !== g.phase ||
    g.decision?.kind !== 'nullentropy' ||
    g.decision.player !== pending.player ||
    g.response ||
    g.phaseOpening ||
    g.pendingKarama
  )
    return 'The saved private search is inconsistent; restore its saved table state before continuing.';
  const owner = g.players.find((p) => p.id === pending.player);
  if (
    !owner ||
    owner.hand.filter(
      (c) =>
        c.id === pending.box &&
        richeseCardDefinition(c)?.card.effect === 'nullentropyBox',
    ).length !== 1 ||
    JSON.stringify(g.discard) !== pending.discardSignature ||
    JSON.stringify(g.discard.map((c) => c.id)) !==
      JSON.stringify(pending.discardIds)
  )
    return 'The saved search card custody changed; restore its saved table state before continuing.';
  return null;
}
function validateNullentropyBegin(g: Game, owner: Player, cardId: string) {
  requireRule(
    g.status === 'playing',
    'Nullentropy Box is available during an active game.',
  );
  requireRule(
    !g.pendingNullentropy,
    'Finish the paid Nullentropy Box search first.',
  );
  requireRule(
    !g.truthtrance,
    'Resolve the active Truthtrance question before searching the discard.',
  );
  const card = owner.hand.find((c) => c.id === cardId);
  requireRule(
    card && richeseCardDefinition(card)?.card.effect === 'nullentropyBox',
    'Use the canonical Nullentropy Box physically in your hand.',
  );
  const reserved = transferCardBlock(g, owner, card);
  requireRule(!reserved, reserved ?? 'The Box is already committed.');
  requireRule(
    owner.hand.length < handLimit(owner),
    'Full-hand Nullentropy Box use is unresolved; the current guard requires a pre-existing free hand slot.',
  );
  const guild = byFaction(g, 'guild');
  requireRule(
    !(
      g.karamaShipping?.card &&
      guild &&
      !guild.specialKaramaUsed &&
      g.discard.some((c) => c.id === g.karamaShipping?.card)
    ),
    'Searching while a shipping Karama has a provisional Guild refund claim awaits resolution.',
  );
  // A completed purchase has already paid its bid; it is no longer a reservation.
  const funding = structuredClone(g);
  if (funding.currentAuctionSale) {
    funding.auction = null;
    funding.richeseAuction = null;
  }
  requireRule(
    uncommittedSpice(funding, getPlayer(funding, owner.id)) >= 2,
    'You need two uncommitted spice to pay the bank for this search.',
  );
  const paid = structuredClone(g);
  getPlayer(paid, owner.id).spice -= 2;
  reconcileBattlePromises(paid, {
    actor: owner.id,
    action: { type: 'card', card: cardId },
  });
  let candidates: Card[];
  try {
    candidates = eligibleNullentropyCards(g.discard);
  } catch (error) {
    throw new RuleError(
      error instanceof Error ? error.message : 'Invalid discard custody.',
    );
  }
  requireRule(
    candidates.length > 0,
    'An empty or only-Box discard search is unsupported; no spice has been paid.',
  );
  return { card, candidates };
}
function finishNullentropy(
  g: Game,
  player: string,
  event: string,
  cardId: string,
) {
  const pending = g.pendingNullentropy;
  requireRule(
    pending && pending.player === player,
    'Only the paid search owner can select its card.',
  );
  requireRule(pending.event === event, 'This private search event is stale.');
  const invalid = nullentropyIntegrity(g);
  requireRule(!invalid, invalid ?? 'The search cannot continue.');
  const owner = getPlayer(g, player),
    context = nullentropyContext(g);
  const remaining = g.discard.filter((c) => c.id !== cardId);
  let preview: ReturnType<typeof resolveNullentropyBox>;
  try {
    preview = resolveNullentropyBox(
      owner.hand,
      pending.box,
      g.discard,
      cardId,
      remaining.map((c) => c.id),
      handLimit(owner),
    );
  } catch (error) {
    throw new RuleError(
      error instanceof Error
        ? error.message
        : 'Invalid private search selection.',
    );
  }
  validateTransferCompletion(
    context,
    getPlayer(context, player),
    getPlayer(context, player),
    preview.ownerHand,
    preview.ownerHand,
    { type: 'card', card: pending.box },
  );
  // All rejection paths precede this single server shuffle. The paid record and
  // final shuffled order are each persisted by the room's normal CAS fence.
  const order = shuffle(remaining).map((c) => c.id);
  const result = resolveNullentropyBox(
    owner.hand,
    pending.box,
    g.discard,
    cardId,
    order,
    handLimit(owner),
  );
  owner.hand = result.ownerHand;
  g.discard = result.discard;
  g.pendingNullentropy = null;
  g.decision = null;
  log(
    g,
    `${owner.name} recovered one private card with Nullentropy Box, shuffled the remaining discard pile, and placed the used Box on top. The bank was paid when the search began.`,
    { faction: owner.faction, name: 'Nullentropy Box' },
  );
  stageTreacheryDiscard(
    g,
    'nullentropyBox',
    [{ card: result.discard.at(-1)!, discardedBy: player, publicFace: true }],
    {
      kind: 'nullentropyDiscard',
      player,
      searchEvent: event,
      box: pending.box,
      selected: result.selected,
      finalDiscardIds: g.discard.map((c) => c.id),
      finalDiscardSignature: JSON.stringify(g.discard),
      resume: pending.resume,
      parentSignature: nullentropyParentSignature(g, pending.resume, event),
    },
  );
}
function beginNullentropy(g: Game, owner: Player, cardId: string) {
  const { candidates } = validateNullentropyBegin(g, owner, cardId);
  owner.spice -= 2;
  const event = crypto.randomUUID();
  g.pendingNullentropy = {
    event,
    player: owner.id,
    box: cardId,
    turn: g.turn,
    phase: g.phase,
    discardIds: g.discard.map((c) => c.id),
    discardSignature: JSON.stringify(g.discard),
    resume: {
      response: g.response,
      decision: g.decision,
      pendingKarama: g.pendingKarama,
      phaseOpening: g.phaseOpening,
    },
  };
  g.response = null;
  g.pendingKarama = null;
  g.phaseOpening = null;
  g.decision = { kind: 'nullentropy', player: owner.id };
  log(
    g,
    `${owner.name} paid two spice to the bank to privately search the discard pile with Nullentropy Box. The interrupted decision waits for this search.`,
  );
  if (candidates.length === 1)
    finishNullentropy(g, owner.id, event, candidates[0].id);
}
function nullentropyView(g: Game, owner: Player) {
  const pending = g.pendingNullentropy;
  const card = owner.hand.find(
    (c) => richeseCardDefinition(c)?.card.effect === 'nullentropyBox',
  );
  if (!card) return null;
  if (pending?.player === owner.id) {
    const blocked = nullentropyIntegrity(g);
    return {
      card,
      blocked,
      search: blocked
        ? null
        : {
            event: pending.event,
            cards: eligibleNullentropyCards(g.discard).sort(
              (a, b) =>
                a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
            ),
          },
    };
  }
  let blocked: string | null = null;
  try {
    validateNullentropyBegin(g, owner, card.id);
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    blocked = error.message;
  }
  return { card, blocked, search: null };
}
function savedTransferResponses(g: Game) {
  const canceled = (pending: Game['pendingKarama']) =>
    pending?.use.kind === 'cancel' ? pending.use.response : null;
  return [
    g.response,
    canceled(g.pendingKarama),
    g.pendingExchange?.response,
    g.pendingRicheseGift?.resume.response,
    canceled(g.pendingRicheseGift?.resume.pendingKarama),
  ];
}
function transferCardBlock(g: Game, owner: Player, card: Card) {
  if (isPortableSnooper(card) && homeworldSavedDecisions(g).some((d) => d.kind === 'homeworldDefense' && d.player === owner.id))
    return 'Resolve the Homeworld late-defense choice before transferring its Portable Snooper.';

  if (
    g.pendingNullentropy?.player === owner.id &&
    g.pendingNullentropy.box === card.id
  )
    return 'This Box is reserved for the paid private search.';
  const reserved = ambassadorDiscardBlock(g, owner, card);
  if (reserved) return reserved;
  if (
    g.richeseAuction?.source === 'blackMarket' &&
    !g.currentAuctionSale &&
    g.richeseAuction.owner === owner.id &&
    g.richeseAuction.cardId === card.id
  )
    return 'The card offered for Black Market must remain available.';
  if (
    g.pendingIxAlly?.player === owner.id &&
    g.pendingIxAlly.card === card.id &&
    savedTransferResponses(g).some(
      (response) => response?.kind === 'ixAllyCard',
    )
  )
    return 'The card committed to Ixian replacement must remain available.';
  return null;
}
function validateTransferCompletion(
  g: Game,
  owner: Player,
  recipient: Player,
  ownerHand: Card[],
  recipientHand: Card[],
  action: Action,
) {
  const pendingKaramaPurchase = savedKaramaConversions(g).some(
    (pending) =>
      pending.owner === recipient.id &&
      ['purchase', 'auctionPayment'].includes(pending.use.kind),
  );
  const lot = g.richeseAuction;
  const richeseReserved =
    lot &&
    (lot.outcome
      ? lot.outcome.kind === 'sold' && lot.outcome.winner === recipient.id
      : lot.method === 'silent'
        ? Object.hasOwn(lot.sealed, recipient.id)
        : lot.bidder === recipient.id);
  const auctionSlot = Number(
    !g.currentAuctionSale &&
      !!(
        g.auction?.bidder === recipient.id ||
        pendingKaramaPurchase ||
        richeseReserved
      ),
  );
  if (recipientHand.length >= handLimit(recipient) && !g.currentAuctionSale) {
    requireRule(
      g.auction?.bidder !== recipient.id,
      'Leave room for the recipient’s committed auction purchase.',
    );
    requireRule(
      !pendingKaramaPurchase,
      'Leave room for the recipient’s pending Karama auction purchase.',
    );
    requireRule(
      !richeseReserved,
      'Leave room until the recipient’s auction commitment is resolved; sealed submissions reserve the slot without revealing their bid.',
    );
  }
  const trial = structuredClone(g),
    donor = getPlayer(trial, owner.id);
  donor.hand = ownerHand;
  getPlayer(trial, recipient.id).hand = recipientHand;
  const decisions = [
    g.decision,
    g.pendingExchange?.decision,
    g.pendingRicheseGift?.resume.decision,
  ];
  for (const exchange of decisions)
    if (exchange?.kind === 'handExchange') {
      requireRule(
        exchange.player !== owner.id || ownerHand.length >= exchange.count,
        'Keep enough cards to complete your committed hand exchange.',
      );
      requireRule(
        exchange.target !== recipient.id ||
          recipientHand.length + exchange.count + auctionSlot <=
            handLimit(recipient),
        'Leave room for the cards the recipient must receive from the committed hand exchange and any pending auction purchase.',
      );
    }
  const pending = trial.pendingAmbassador;
  if (pending?.beneficiary === owner.id) {
    const entrant = getPlayer(trial, pending.entrant);
    if (pending.stage === 'cards' && pending.effect === 'ixians')
      requireRule(
        !ambassadorEffectBlock(trial, 'ixians', donor, entrant),
        'Keep a discardable card for the committed Ixian Ambassador exchange.',
      );
    if (pending.stage === 'copy')
      requireRule(
        pending.copyChoices.some(
          (effect) => !ambassadorEffectBlock(trial, effect, donor, entrant),
        ),
        'Keep an available effect for the committed Ambassador copy.',
      );
  }
  reconcileBattlePromises(trial, { actor: owner.id, action });
}
function distransBlock(g: Game, owner: Player, card: Card): string | null {
  if (g.pendingNullentropy)
    return 'Finish the paid Nullentropy Box search first.';
  if (g.status !== 'playing')
    return 'Distrans is available during an active game.';
  if (g.truthtrance)
    return 'Resolve the active Truthtrance question before changing hands.';
  const reserved = transferCardBlock(g, owner, card);
  if (reserved) return reserved;
  // The face excludes a bid, not the complete Bidding phase. A live unpaid lot
  // remains guarded pending the requested ruling; already-paid income is separate.
  if ((g.auction || g.richeseAuction) && !g.currentAuctionSale)
    return 'Distrans during an unresolved auction lot awaits a ruling. It remains available outside that bid.';
  return null;
}
function validateDistrans(
  g: Game,
  owner: Player,
  cardId: string,
  recipientId: string,
  giveId: string,
) {
  const card = owner.hand.find((c) => c.id === cardId);
  requireRule(
    card && richeseCardDefinition(card)?.card.effect === 'distrans',
    'Play the canonical Distrans physically in your hand.',
  );
  const blocked = distransBlock(g, owner, card);
  requireRule(!blocked, blocked ?? 'Distrans is unavailable.');
  const recipient = getPlayer(g, recipientId);
  let result: ReturnType<typeof transferDistrans>;
  try {
    result = transferDistrans(
      owner,
      recipient,
      cardId,
      giveId,
      handLimit(recipient),
    );
  } catch (error) {
    throw new RuleError(
      error instanceof Error ? error.message : 'Invalid Distrans transfer.',
    );
  }
  const reserved = transferCardBlock(g, owner, result.transferred);
  requireRule(!reserved, reserved ?? 'This card is already committed.');
  validateTransferCompletion(
    g,
    owner,
    recipient,
    result.ownerHand,
    result.recipientHand,
    { type: 'card', card: cardId, target: recipientId, give: giveId },
  );
  return { recipient, result };
}
function distransView(g: Game, owner: Player) {
  const card = owner.hand.find(
    (c) => richeseCardDefinition(c)?.card.effect === 'distrans',
  );
  if (!card) return null;
  const blocked = distransBlock(g, owner, card);
  const choices = g.players
    .filter((p) => p.id !== owner.id)
    .map((recipient) => {
      const cards: Card[] = [],
        unavailable: { card: Card; reason: string }[] = [];
      const targetBlock =
        blocked ??
        (recipient.hand.length >= handLimit(recipient)
          ? 'The recipient’s Treachery hand is full.'
          : null);
      for (const given of owner.hand.filter((c) => c.id !== card.id)) {
        if (targetBlock) {
          unavailable.push({ card: given, reason: targetBlock });
          continue;
        }
        try {
          validateDistrans(g, owner, card.id, recipient.id, given.id);
          cards.push(given);
        } catch (error) {
          if (!(error instanceof RuleError)) throw error;
          unavailable.push({ card: given, reason: error.message });
        }
      }
      return {
        recipient: recipient.id,
        blocked: targetBlock,
        cards,
        unavailable,
      };
    });
  return { card, blocked, choices };
}
function richeseGiftBlock(g: Game, owner: Player): string | null {
  if (g.pendingNullentropy)
    return 'Finish the paid Nullentropy Box search first.';
  if (g.status !== 'playing')
    return 'Richese gifts are available during an active game.';
  if (owner.faction !== 'richese')
    return 'Only Richese can give a Richese card to its ally.';
  if (g.truthtrance)
    return 'Resolve the active Truthtrance question before changing hands.';
  if (g.pendingRicheseGift) return 'Resolve the pending Richese gift first.';
  const ally = g.players.find((p) => p.id === owner.ally);
  if (!ally || ally.ally !== owner.id) return 'You need a current mutual ally.';
  if (ally.hand.length >= handLimit(ally))
    return 'Your ally’s Treachery hand is full.';
  return null;
}
function richeseGiftContext(g: Game) {
  const context = structuredClone(g),
    pending = context.pendingRicheseGift;
  if (pending) {
    context.response = pending.resume.response;
    context.decision = pending.resume.decision;
    context.pendingKarama = pending.resume.pendingKarama;
    context.phaseOpening = pending.resume.phaseOpening;
    context.pendingRicheseGift = null;
  }
  return context;
}
function validateRicheseGift(g: Game, owner: Player, cardId: string) {
  const blocked = richeseGiftBlock(g, owner);
  requireRule(!blocked, blocked ?? 'This gift is unavailable.');
  const recipient = getPlayer(g, owner.ally!);
  let intent: RicheseGiftIntent;
  try {
    intent = prepareRicheseGift(owner, recipient, cardId, handLimit(recipient));
  } catch (error) {
    throw new RuleError(
      error instanceof Error ? error.message : 'Invalid Richese gift.',
    );
  }
  const card = owner.hand.find((c) => c.id === cardId)!;
  const reservation = transferCardBlock(g, owner, card);
  requireRule(!reservation, reservation ?? 'This card is already committed.');
  requireRule(
    !(
      g.richeseGiftBlocked?.turn === g.turn &&
      g.richeseGiftBlocked.phase === g.phase &&
      g.richeseGiftBlocked.cards.includes(cardId)
    ),
    'Retrying this canceled card’s gift in the same phase awaits a ruling.',
  );
  const resulting = transferRicheseGift(
    owner,
    recipient,
    intent,
    handLimit(recipient),
  );
  validateTransferCompletion(
    g,
    owner,
    recipient,
    resulting.ownerHand,
    resulting.recipientHand,
    { type: 'richeseGift', card: cardId },
  );
  return { intent, resulting };
}
function richeseGiftView(g: Game, viewer: Player) {
  const owner = byFaction(g, 'richese');
  if (!owner) return null;
  const pending = g.pendingRicheseGift;
  if (viewer.id !== owner.id && pending?.intent.recipient !== viewer.id)
    return null;
  const mine = viewer.id === owner.id;
  const blocked = richeseGiftBlock(g, owner);
  const cards: Card[] = [],
    unavailable: { card: Card; reason: string }[] = [];
  if (mine)
    for (const card of owner.hand.filter((card) =>
      richeseCardDefinition(card),
    )) {
      if (blocked) {
        unavailable.push({ card, reason: blocked });
        continue;
      }
      try {
        validateRicheseGift(g, owner, card.id);
        cards.push(card);
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        unavailable.push({ card, reason: error.message });
      }
    }
  return {
    owner: owner.id,
    recipient: owner.ally,
    blocked,
    cards,
    unavailable,
    pending: pending
      ? {
          event: pending.event,
          owner: pending.intent.owner,
          recipient: pending.intent.recipient,
          card:
            getPlayer(g, pending.intent.owner).hand.find(
              (c) => c.id === pending.intent.cardId,
            ) ?? null,
        }
      : null,
  };
}
export const handLimit = (p: Pick<Player, 'faction'>) =>
  p.faction === 'harkonnen' ? 8 : p.faction === 'choam' ? 5 : 4;
export function newPlayer(id: string, name: string, f: FactionId): Player {
  requireRule(
    name.trim().length > 0 && name.trim().length <= 32,
    'Enter a name of 1–32 characters.',
  );
  requireRule(
    FACTIONS.some((x) => x.id === f),
    'Choose a valid faction.',
  );
  return {
    id,
    name: name.trim(),
    faction: f,
    ready: false,
    spice: 0,
    reserves: 20,
    tanks: 0,
    forces: {},
    ...(f === 'ixians'
      ? { elites: { reserves: 7, tanks: 0, forces: {}, revived: 0 } }
      : {}),
    hand: [],
    leaders: leaders(f),
    traitors: [],
    traitorChoices: [],
    ally: null,
    bribes: 0,
    revived: 0,
    freeForcesRevived: 0,
    leaderRevived: false,
    revivalCycle: 0,
    shipped: false,
    moved: 0,
    battleLosses: 0,
  };
}
export function createGame(
  code: string,
  host: Player,
  advanced = false,
  expansions: string[] = [],
): Game {
  requireRule(
    expansions.every((x) => ['ix', 'choam', 'ecaz'].includes(x)),
    'Unknown expansion.',
  );
  return {
    schema: 1,
    code,
    version: 0,
    host: host.id,
    status: 'lobby',
    advanced,
    expansions: [...new Set(expansions)],
    players: [host],
    playerPositions: { [host.id]: 1 },
    turn: 1,
    phase: 0,
    storm: STORM_START_SECTOR,
    order: [],
    active: null,
    movementRemaining: null,
    guildTimingGranted: false,
    guildTimingLocked: false,
    ready: [],
    deck: [],
    discard: [],
    spiceDeck: [],
    spicePeekKnown: false,
    spiceDiscard: [[], []],
    spice: {},
    log: [{ seq: 1, text: `${host.name} opened the table.` }],
    stormDials: {},
    stormPending: null,
    stormCard: null,
    stormCardKnown: false,
    stormResolution: null,
    karamaShipping: null,
    stormDialers: [],
    lastBattle: [],
    auction: null,
    battle: null,
    nexus: false,
    allianceOffers: {},
    winner: [],
    shieldWallDestroyed: false,
    spiceWindow: null,
    hajr: [],
    decision: null,
    pendingCapture: null,
    response: null,
    wormRides: [],
    wormPlacementCanceledTurn: 0,
    spiceResolution: null,
    spiceSequence: null,
    freeRevival: [],
    emperorExtra: {},
    aid: {},
  };
}
export function joinGame(g: Game, p: Player) {
  requireRule(g.status === 'lobby', 'This game has already started.');
  requireRule(g.players.length < 6, 'This table has six players.');
  requireRule(!g.players.some((x) => x.id === p.id), 'Already seated.');
  requireRule(
    !g.players.some((x) => x.faction === p.faction),
    'That faction is already taken.',
  );
  requireRule(
    faction(p.faction).expansion === 'base' ||
      g.expansions.includes(faction(p.faction).expansion),
    'The host has not enabled that expansion.',
  );
  g.players.push(p);
  g.playerPositions = normalizedPlayerPositions(g);
  g.players.forEach((x) => (x.ready = false));
  log(g, `${p.name} joined as ${faction(p.faction).name}.`);
}
function draw(g: Game) {
  requireRule(
    !g.pendingTreacheryDiscard,
    'Finish the committed discard continuation before drawing cards.',
  );
  requireRule(
    !g.pendingNullentropy,
    'Finish the paid Nullentropy Box search before drawing cards.',
  );
  if (!g.deck.length) {
    g.deck = shuffle(g.discard);
    g.discard = [];
  }
  return g.deck.shift();
}
function discard(g: Game, p: Player, id: string, role?: Omit<EcazPoisonDiscard, 'card'>) {
  requireRule(
    !g.pendingTreacheryDiscard,
    'Finish the committed discard continuation before another discard.',
  );
  requireRule(
    !g.pendingNullentropy,
    'Finish the paid Nullentropy Box search before changing the discard pile.',
  );
  requireRule(
    !giftReserved(g, p.id, id),
    'This card is reserved for the pending Richese gift.',
  );
  const c = p.hand.find((c) => c.id === id);
  requireRule(c, 'Card is not in your hand.');
  const income = homeworldRule(() => quoteEcazPoisonIncome(g, [{ card: c, ...role }]));
  if (income) {
    const ecaz = getPlayer(g, income.player);
    requireRule(Number.isSafeInteger(ecaz.spice + income.amount), 'Ecaz income would exceed a valid spice balance.');
    ecaz.spice += income.amount;
    // Discard category and resulting private spice must not enter the public
    // chronicle. The native owner receives a private income receipt instead.
    (g.ecazPoisonIncome ??= []).push({ ...income, turn: g.turn, phase: g.phase });
  }
  g.discard.push(c);
  p.hand = p.hand.filter((c) => c.id !== id);
  return c;
}
function battleDiscardRoles(g: Game, battle: Battle) {
  const players = [getPlayer(g, battle.attacker), getPlayer(g, battle.defender)];
  const selected = players.map((p) => ({ weapon: cardOf(p, battle.plans[p.id].weapon),
    defense: cardOf(p, battle.plans[p.id].defense) }));
  const weapons = resolveBattleWeapons({ attacker: selected[0], defender: selected[1] });
  requireRule(!weapons.error, weapons.error ?? 'Invalid effective battle weapons.');
  const roles: NonNullable<NonNullable<Game['lastBattleContext']>['cardRoles']> = {};
  for (const [index, p] of players.entries()) {
    roles[p.id] = {};
    for (const slot of ['weapon', 'defense', 'leader'] as const) {
      const id = battle.plans[p.id][slot];
      if (!id || !cardOf(p, id)) continue;
      roles[p.id][id] = { battleSlot: slot,
        ...(slot === 'weapon' ? { effectiveWeapon: index === 0 ? weapons.attacker : weapons.defender } : {}) };
    }
  }
  return roles;
}
function cleanupDiscardRole(g: Game, player: Player, id: string) {
  battleCardRolesIntegrity(g);
  const card = cardOf(player, id)!;
  const context = g.lastBattleContext;
  const role = context?.cardRoles?.[player.id]?.[id];
  if (g.homeworlds?.custody && byFaction(g, 'ecaz') &&
      (card.kind === 'chemistry' || card.effect === 'mirrorWeapon'))
    requireRule(context?.turn === g.turn && context.combatants.includes(player.id) && role,
      'This conditional weapon cleanup needs its original battle role receipt.');
  return role;
}
function battleCardRolesSignature(context: NonNullable<Game['lastBattleContext']>) {
  const { event, turn, territory, combatants, winner, result, cardRoles } = context;
  return JSON.stringify({ event, turn, territory, combatants, winner, result, cardRoles });
}
function battleCardRolesIntegrity(g: Game) {
  const context = g.lastBattleContext;
  if (!context?.cardRoles && !context?.cardRolesSignature) return;
  requireRule(context.cardRoles && context.cardRolesSignature === battleCardRolesSignature(context),
    'The saved battle card roles no longer match their resolved battle receipt.');
  for (const [player, cards] of Object.entries(context.cardRoles)) {
    requireRule(context.combatants.includes(player) && cards && !Array.isArray(cards),
      'The resolved battle has an invalid card-role owner.');
    const slots = Object.values(cards).map((role) => role?.battleSlot);
    requireRule(new Set(slots).size === slots.length &&
      slots.every((slot) => ['weapon', 'defense', 'leader'].includes(slot ?? '')),
      'The resolved battle card slots are missing or duplicated.');
    for (const [card, role] of Object.entries(cards))
      requireRule(role.battleSlot === 'weapon'
        ? role.effectiveWeapon?.physicalId === card
        : role.effectiveWeapon === undefined,
        'The resolved battle weapon descriptor does not match its physical slot.');
  }
}
/** A receipt of suspended controls and live pending obligations; never restored
 * as game state. Player resources, hands, log and seat control are excluded. */
function nullentropyParentSignature(
  g: Game,
  resume: NonNullable<Game['pendingNullentropy']>['resume'],
  searchEvent: string,
) {
  const parents = Object.fromEntries(
    Object.entries(g)
      .filter(
        ([key, value]) =>
          key.startsWith('pending') &&
          ![
            'pendingTreacheryDiscard',
            'pendingNullentropy',
            'pendingKarama',
          ].includes(key) &&
          value != null,
      )
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  return JSON.stringify({ searchEvent, resume, parents });
}
type OrdinaryDiscardContinuation = Extract<
  NonNullable<Game['pendingTreacheryDiscard']>['continuation'],
  { kind: 'ordinaryCardDiscard' }
>;
/** Bind completed effects, not a replacement Game. Seat control and private hands
 * may change independently of these outcomes; neither is restored on recovery. */
function ordinaryDiscardSignature(g: Game, next: OrdinaryDiscardContinuation) {
  return JSON.stringify({
    player: next.player,
    card: next.card,
    effect: next.effect,
    controls: nullentropyParentSignature(
      g,
      next.resume,
      `ordinary:${next.card}`,
    ),
    phase: g.phase,
    turn: g.turn,
    advanced: g.advanced,
    expansions: g.expansions,
    active: g.active,
    order: g.order,
    ready: g.ready,
    movementRemaining: g.movementRemaining,
    hajr: g.hajr,
    ornithopter: g.ornithopter,
    karamaShipping: g.karamaShipping,
    storm: g.storm,
    stormPending: g.stormPending,
    stormDials: g.stormDials,
    stormResolution: g.stormResolution,
    shieldWallDestroyed: g.shieldWallDestroyed,
    spice: g.spice,
    spiceWindow: g.spiceWindow,
    spiceResolution: g.spiceResolution,
    spiceSequence: g.spiceSequence,
    battle: g.battle,
    shipmentPromises: g.shipmentPromises,
    techTokens: g.techTokens,
    homeworlds: g.homeworlds,
    homeworldRevival: g.homeworldRevival,
    homeworldRevivalReturn: g.homeworldRevivalReturn,
    ...(g.homeworldRevivalProgress === undefined ? {} : { homeworldRevivalProgress: g.homeworldRevivalProgress }),
    homeworldVictoryReinforcement: g.homeworldVictoryReinforcement,
    ...(g.grummanCollection === undefined ? {} : { grummanCollection: g.grummanCollection }),
    dukeVidal: g.dukeVidal,
    revivalFreeIncome: g.revivalFreeIncome,
    players: g.players.map((p) => ({
      id: p.id,
      faction: p.faction,
      spice: p.spice,
      forces: p.forces,
      reserves: p.reserves,
      tanks: p.tanks,
      elites: p.elites,
      advisors: p.advisors,
      moved: p.moved,
      shipped: p.shipped,
      revived: p.revived,
      revivalCycle: p.revivalCycle,
      leaderRevived: p.leaderRevived,
      leaders: p.leaders,
      kwisatz: p.kwisatz,
    })),
  });
}
function stageOrdinaryCardDiscard(g: Game, p: Player, card: Card) {
  const resume = {
    response: g.response,
    decision: g.decision,
    pendingKarama: g.pendingKarama,
    phaseOpening: g.phaseOpening,
  };
  g.response = null;
  g.decision = null;
  g.pendingKarama = null;
  g.phaseOpening = null;
  const next: OrdinaryDiscardContinuation = {
    kind: 'ordinaryCardDiscard',
    player: p.id,
    card: card.id,
    effect: card.effect as OrdinaryDiscardContinuation['effect'],
    resume,
    stateSignature: '',
  };
  next.stateSignature = ordinaryDiscardSignature(g, next);
  stageTreacheryDiscard(
    g,
    `ordinary:${next.effect}`,
    [{ card, discardedBy: p.id, publicFace: true }],
    next,
  );
}
type TruthDiscardContinuation = Extract<
  NonNullable<Game['pendingTreacheryDiscard']>['continuation'],
  { kind: 'truthtranceDiscard' }
>;
function truthtranceDiscardSignature(g: Game, next: TruthDiscardContinuation) {
  return JSON.stringify({
    consumed: next.consumed,
    historyIndex: next.historyIndex,
    record: next.record,
    remaining: next.remaining,
    promise: next.promise,
    controls: nullentropyParentSignature(
      g,
      next.resume,
      `truth:${next.historyIndex}`,
    ),
    history: g.truthHistory,
    battle: g.battle,
    shipmentPromises: g.shipmentPromises,
    active: g.active,
    order: g.order,
    status: g.status,
    setupStage: g.setupStage,
    auction: g.auction,
    richeseAuction: g.richeseAuction,
    currentAuctionSale: g.currentAuctionSale,
    ornithopter: g.ornithopter,
    spiceWindow: g.spiceWindow,
    spiceResolution: g.spiceResolution,
    wormRides: g.wormRides,
    summonedWorm: g.summonedWorm,
  });
}
/** Truth validation, promise binding and the public answer have already happened. */
function finishTruthtranceAnswer(g: Game) {
  const window = g.truthtrance!;
  const consumed = window.queue[0];
  const historyIndex = g.truthHistory!.length - 1;
  const record = g.truthHistory![historyIndex];
  const card = discard(g, getPlayer(g, consumed.player), consumed.card);
  let promise: TruthDiscardContinuation['promise'] = null;
  if (record.question.kind === 'shipment')
    promise = {
      kind: 'shipment',
      index: g.shipmentPromises!.length - 1,
      value: g.shipmentPromises!.at(-1)!,
    };
  else if (
    record.question.kind === 'battlePlan' &&
    g.battle &&
    !g.battle.revealed &&
    !g.battle.plans[record.question.target]
  )
    promise = {
      kind: 'battle',
      index: g.battle.truthPromises!.length - 1,
      value: g.battle.truthPromises!.at(-1)!,
    };
  const resume = {
    response: g.response,
    decision: g.decision,
    pendingKarama: g.pendingKarama,
    phaseOpening: g.phaseOpening,
  };
  const remaining: TruthWindow | null =
    window.queue.length > 1
      ? {
          stage: 'ask',
          queue: window.queue.slice(1),
          passed: window.passed,
          question: null,
        }
      : null;
  g.truthtrance = null;
  g.response = null;
  g.decision = null;
  g.pendingKarama = null;
  g.phaseOpening = null;
  const continuation: TruthDiscardContinuation = {
    kind: 'truthtranceDiscard',
    consumed,
    historyIndex,
    record,
    remaining,
    resume,
    promise,
    parentSignature: '',
  };
  continuation.parentSignature = truthtranceDiscardSignature(g, continuation);
  stageTreacheryDiscard(
    g,
    'truthtrance',
    [{ card, discardedBy: consumed.player, publicFace: true }],
    continuation,
  );
}
/** Bind the committed movement and its remaining arrival/turn obligations.
 * This receipt is never restored over live state and excludes seat AI controls. */
function ornithopterDiscardSignature(
  g: Game,
  next: Extract<
    NonNullable<Game['pendingTreacheryDiscard']>['continuation'],
    { kind: 'ornithopterDiscard' }
  >,
) {
  return JSON.stringify({
    source: next.source,
    flight: next.flight,
    movement: next.movement,
    controls: nullentropyParentSignature(g, next.resume, next.flight.event),
    active: g.active,
    order: g.order,
    movementRemaining: g.movementRemaining,
    guildTimingGranted: g.guildTimingGranted,
    guildTimingLocked: g.guildTimingLocked,
    saphoMovementLast: g.saphoMovementLast,
    karamaShipping: g.karamaShipping,
    ambassadors: g.ecazAmbassadors,
    terror: g.moritaniTerror,
    players: g.players.map((p) => ({
      id: p.id,
      faction: p.faction,
      ally: p.ally,
      allySinceTurn: p.allySinceTurn,
      forces: p.forces,
      elites: p.elites,
      reserves: p.reserves,
      tanks: p.tanks,
      advisors: p.advisors,
      noField: p.noField,
      noFieldEvent: p.noFieldEvent,
      moved: p.moved,
      shipped: p.shipped,
    })),
  });
}
function suspendedControlsIntegrity(
  g: Game,
  resume: NonNullable<Game['pendingNullentropy']>['resume'],
) {
  const seated = (id: string) => g.players.some((p) => p.id === id);
  const passes = (ids: string[]) =>
    Array.isArray(ids) && new Set(ids).size === ids.length && ids.every(seated);
  const response = (r: ResponseWindow | null | undefined) =>
    !r || (typeof r.kind === 'string' && seated(r.owner) && passes(r.passed));
  requireRule(
    resume &&
      typeof resume === 'object' &&
      !Array.isArray(resume) &&
      Object.keys(resume).every((key) =>
        ['response', 'decision', 'pendingKarama', 'phaseOpening'].includes(key),
      ) &&
      response(resume.response) &&
      (!resume.decision ||
        (resume.decision.kind !== 'nullentropy' &&
          typeof resume.decision.kind === 'string' &&
          seated(resume.decision.player))) &&
      (!resume.phaseOpening ||
        (typeof resume.phaseOpening.initialize === 'boolean' &&
          passes(resume.phaseOpening.passed))) &&
      (!resume.pendingKarama ||
        (seated(resume.pendingKarama.owner) &&
          resume.pendingKarama.use &&
          ['cancel', 'shipment', 'purchase', 'auctionPayment'].includes(
            resume.pendingKarama.use.kind,
          ) &&
          (resume.pendingKarama.use.kind !== 'cancel' ||
            response(resume.pendingKarama.use.response)))) &&
      (resume.response?.kind !== 'worthlessKarama' || !!resume.pendingKarama),
    'The completed discard does not match its suspended controls and obligations.',
  );
  // Validate restored controls without advancing or replaying their effects.
  const context = structuredClone(g);
  context.pendingTreacheryDiscard = null;
  Object.assign(context, structuredClone(resume));
  karamaConversionIntegrity(context);
  shipmentPromiseIntegrity(context);
  saphoMovementIntegrity(context);
  ornithopterIntegrity(context);
  lateDefenseIntegrity(context);
  stoneBurnerIntegrity(context);
  strongholdIntegrity(context);
  auditorIntegrity(context);
}
function treacheryDiscardIntegrity(g: Game) {
  const pending = g.pendingTreacheryDiscard;
  const sequence = g.treacheryDiscardSequence ?? 0;
  const resolved = g.resolvedTreacheryDiscardSequence ?? 0;
  requireRule(
    Number.isSafeInteger(sequence) &&
      sequence >= 0 &&
      Number.isSafeInteger(resolved) &&
      resolved >= 0 &&
      sequence === resolved + (pending ? 1 : 0),
    'The saved discard sequence is inconsistent or already resolved.',
  );
  if (!pending) return;
  const { batch, continuation } = pending;
  const box = continuation?.kind === 'nullentropyDiscard';
  const truth = continuation?.kind === 'truthtranceDiscard';
  const ambassadorTerror =
    continuation?.kind === 'terrorDiscard' &&
    continuation.entry.cause === 'ambassador';
  requireRule(
    (g.status === 'playing' || (truth && g.status === 'setup')) &&
      pending.sequence === sequence &&
      batch &&
      batch.event === `discard:${g.turn}:${g.phase}:${sequence}` &&
      batch.turn === g.turn &&
      batch.phase === g.phase &&
      Array.isArray(batch.entries) &&
      batch.entries.length > 0 &&
      !g.response &&
      !g.decision &&
      !g.truthtrance &&
      !g.phaseOpening &&
      (!g.pendingRicheseGift || box || truth) &&
      !g.pendingKarama &&
      !g.pendingNullentropy &&
      (!g.pendingAmbassador || box || truth || ambassadorTerror) &&
      (!g.pendingIxAlly || box || truth),
    'The saved discard does not match its current continuation.',
  );
  const ids = new Set<string>();
  // Auction prefixes and Ix knowledge are receipts, not additional custody.
  const outside = [
    ...g.players.flatMap((p) => p.hand),
    ...g.deck,
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...(g.ixSetupCards ?? []),
    ...(g.ixAuction?.cards ?? []),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
    ...(g.auction?.cards.slice(
      g.auction.index + (g.currentAuctionSale ? 1 : 0),
    ) ?? []),
  ];
  for (const entry of Array.from(batch.entries)) {
    const card = entry?.card;
    const actual = card && g.discard.filter((c) => c.id === card.id);
    requireRule(
      entry &&
        card &&
        typeof card.id === 'string' &&
        card.id.length > 0 &&
        !ids.has(card.id) &&
        typeof entry.publicFace === 'boolean' &&
        g.players.some((p) => p.id === entry.discardedBy) &&
        actual?.length === 1 &&
        actual[0].name === card.name &&
        actual[0].kind === card.kind &&
        actual[0].effect === card.effect &&
        !outside.some((c) => c.id === card.id),
      'The fresh discard receipt has conflicting physical custody.',
    );
    ids.add(card.id);
  }
  if (continuation?.kind === 'nullentropyDiscard') {
    const c = continuation;
    const owner = g.players.find((p) => p.id === c.player);
    const selected =
      c.selected && owner?.hand.filter((card) => card.id === c.selected.id);
    requireRule(
      owner &&
        typeof c.searchEvent === 'string' &&
        c.searchEvent.length > 0 &&
        batch.cause === 'nullentropyBox' &&
        batch.entries.length === 1 &&
        batch.entries[0].discardedBy === c.player &&
        batch.entries[0].publicFace &&
        batch.entries[0].card.id === c.box &&
        richeseCardDefinition(batch.entries[0].card)?.card.effect ===
          'nullentropyBox' &&
        g.discard.at(-1)?.id === c.box &&
        Array.isArray(c.finalDiscardIds) &&
        new Set(c.finalDiscardIds).size === c.finalDiscardIds.length &&
        JSON.stringify(c.finalDiscardIds) ===
          JSON.stringify(g.discard.map((card) => card.id)) &&
        c.finalDiscardSignature === JSON.stringify(g.discard) &&
        selected?.length === 1 &&
        c.selected.effect !== 'nullentropyBox' &&
        c.selected.name !== 'Nullentropy Box' &&
        (['id', 'name', 'kind', 'effect'] as const).every(
          (key) => selected[0][key] === c.selected[key],
        ) &&
        outside.filter((card) => card.id === c.selected.id).length === 1 &&
        !g.discard.some((card) => card.id === c.selected.id) &&
        g.discard.every(
          (card) => !outside.some((other) => other.id === card.id),
        ),
      'The completed Box search has inconsistent selected-card or shuffled-pile custody.',
    );
    requireRule(
      c.parentSignature ===
        nullentropyParentSignature(g, c.resume, c.searchEvent),
      'The completed Box search does not match its suspended controls and obligations.',
    );
    suspendedControlsIntegrity(g, c.resume);
  } else if (continuation?.kind === 'ordinaryCardDiscard') {
    const c = continuation,
      entry = batch.entries[0];
    const owner = g.players.find((p) => p.id === c.player);
    requireRule(
      owner &&
        ['hajr', 'ghola', 'harvester', 'weather', 'atomics'].includes(
          c.effect,
        ) &&
        batch.cause === `ordinary:${c.effect}` &&
        batch.entries.length === 1 &&
        entry.publicFace &&
        entry.discardedBy === c.player &&
        entry.card.id === c.card &&
        entry.card.kind === 'special' &&
        entry.card.effect === c.effect &&
        c.stateSignature === ordinaryDiscardSignature(g, c),
      'The consumed ordinary card no longer matches its completed effect.',
    );
    suspendedControlsIntegrity(g, c.resume);
    requireRule(
      !c.resume.decision && !c.resume.pendingKarama && !c.resume.phaseOpening,
      'The ordinary card has an unexpected suspended decision.',
    );
    const income = c.resume.response,
      tleilaxu = byFaction(g, 'tleilaxu');
    requireRule(
      c.effect === 'ghola' && tleilaxu
        ? income?.kind === 'revivalIncome' &&
            income.owner === tleilaxu.id &&
            income.recipient === c.player &&
            income.amount === 1 &&
            income.passed.length === 0
        : !income,
      'The consumed card no longer matches its pending revival income.',
    );
    requireRule(
      c.effect === 'hajr'
        ? g.phase === 5 &&
            g.active === c.player &&
            g.hajr.filter((id) => id === c.player).length === 1
        : c.effect === 'weather'
          ? g.phase === 0 &&
            Number.isSafeInteger(g.stormPending) &&
            g.stormPending! >= 0 &&
            g.stormPending! <= 10 &&
            g.ready.length === 0
          : c.effect === 'atomics'
            ? g.phase === 0 &&
              g.shieldWallDestroyed &&
              g.ready.length === 0 &&
              g.players.every(
                (p) =>
                  !Object.entries(p.forces).some(
                    ([key, n]) => key.startsWith('shield_wall:') && n > 0,
                  ),
              )
            : c.effect === 'harvester'
              ? g.phase === 1 &&
                !!g.spiceWindow?.harvested &&
                Number.isSafeInteger(g.spiceWindow.harvesters) &&
                g.spiceWindow.harvesters! > 0 &&
                g.ready.length === 0
              : true,
      'The completed ordinary-card outcome has changed.',
    );
  } else if (continuation?.kind === 'truthtranceDiscard') {
    const c = continuation,
      entry = batch.entries[0],
      record = c.record;
    requireRule(
      c.consumed &&
        typeof c.consumed.player === 'string' &&
        batch.cause === 'truthtrance' &&
        batch.entries.length === 1 &&
        entry.publicFace &&
        entry.card.effect === 'truthtrance' &&
        entry.card.id === c.consumed.card &&
        entry.discardedBy === c.consumed.player &&
        record &&
        record.asker === c.consumed.player &&
        record.turn === g.turn &&
        record.phase === g.phase &&
        ['yes', 'no'].includes(record.answer) &&
        Array.isArray(g.truthHistory) &&
        Number.isSafeInteger(c.historyIndex) &&
        c.historyIndex >= 0 &&
        c.historyIndex === g.truthHistory.length - 1 &&
        JSON.stringify(g.truthHistory[c.historyIndex]) ===
          JSON.stringify(record),
      'The consumed Truthtrance does not match its completed answer history.',
    );
    const remaining = c.remaining;
    requireRule(
      remaining === null ||
        (remaining &&
          remaining.stage === 'ask' &&
          remaining.question === null &&
          Array.isArray(remaining.queue) &&
          remaining.queue.length > 0 &&
          new Set(remaining.queue.map((e) => e?.card)).size ===
            remaining.queue.length &&
          remaining.queue.every(
            (e) =>
              e &&
              e.card !== c.consumed.card &&
              typeof e.card === 'string' &&
              e.card.length > 0 &&
              typeof e.player === 'string' &&
              g.players
                .find((p) => p.id === e.player)
                ?.hand.filter(
                  (card) => card.id === e.card && card.effect === 'truthtrance',
                ).length === 1 &&
              outside.filter((card) => card.id === e.card).length === 1 &&
              !g.discard.some((card) => card.id === e.card),
          ) &&
          Array.isArray(remaining.passed) &&
          new Set(remaining.passed).size === remaining.passed.length &&
          remaining.passed.every((id) => g.players.some((p) => p.id === id))),
      'The remaining Truthtrance queue no longer matches its held cards and priority.',
    );
    requireRule(
      c.parentSignature === truthtranceDiscardSignature(g, c),
      'The completed Truthtrance no longer matches its recorded promises and parent.',
    );
    suspendedControlsIntegrity(g, c.resume);
    const context = structuredClone(g);
    context.pendingTreacheryDiscard = null;
    Object.assign(context, structuredClone(c.resume));
    try {
      validateTruthQuestionReceipt(context, c.consumed.player, record.question);
    } catch (error) {
      if (error instanceof TruthError || error instanceof PlanClaimError)
        throw new RuleError(error.message);
      throw error;
    }
    const q = record.question,
      promise = c.promise;
    const expectedShipment = q.kind === 'shipment';
    const expectedBattle =
      q.kind === 'battlePlan' &&
      g.battle &&
      !g.battle.revealed &&
      !g.battle.plans[q.target];
    if (expectedShipment || expectedBattle) {
      const actual = expectedShipment
        ? g.shipmentPromises
        : g.battle?.truthPromises;
      requireRule(
        promise &&
          promise.value &&
          typeof promise.value === 'object' &&
          promise.kind === (expectedShipment ? 'shipment' : 'battle') &&
          Array.isArray(actual) &&
          Number.isSafeInteger(promise.index) &&
          promise.index >= 0 &&
          promise.index === (actual?.length ?? 0) - 1 &&
          JSON.stringify(promise.value) ===
            JSON.stringify(actual?.[promise.index]) &&
          promise.value.player === q.target &&
          promise.value.asker === record.asker &&
          promise.value.answer === (record.answer === 'yes') &&
          !promise.value.released,
        'The completed Truthtrance is missing its newly bound promise.',
      );
      if (promise.kind === 'shipment')
        requireRule(
          q.kind === 'shipment' &&
            promise.value.turn === g.turn &&
            !promise.value.fulfilled &&
            promise.value.territory === q.territory &&
            promise.value.minimum === q.minimum,
          'The completed Truthtrance shipment promise differs from its answer.',
        );
      else
        requireRule(
          q.kind === 'battlePlan' &&
            JSON.stringify(promise.value.claim) === JSON.stringify(q.claim),
          'The completed Truthtrance battle promise differs from its answer.',
        );
    } else
      requireRule(
        promise === null,
        'This Truthtrance answer did not create a new promise.',
      );
  } else if (continuation?.kind === 'ornithopterDiscard') {
    const c = continuation,
      flight = c.flight;
    const owner = flight && g.players.find((p) => p.id === flight.player);
    const total = flight?.mode === 'twoGroups' ? 2 : 1;
    requireRule(
      owner &&
        g.phase === 5 &&
        g.active === owner.id &&
        !g.ornithopter &&
        !g.pendingChoamMove &&
        !g.pendingIxMove &&
        !g.pendingFremenMove &&
        !g.pendingTerrorEntry &&
        !g.pendingExchange &&
        !g.battle &&
        flight.turn === g.turn &&
        typeof flight.event === 'string' &&
        flight.event.length > 0 &&
        ['range3', 'twoGroups'].includes(flight.mode) &&
        Number.isSafeInteger(flight.startingMove) &&
        flight.startingMove >= 0 &&
        Number.isSafeInteger(flight.completed) &&
        flight.completed >= 0 &&
        owner.moved === flight.startingMove + flight.completed &&
        ['move', 'end'].includes(c.source) &&
        (c.source === 'move'
          ? flight.completed === total
          : flight.completed < total) &&
        batch.cause === `ornithopter:${c.source}` &&
        batch.entries.length === 1 &&
        batch.entries[0].publicFace &&
        batch.entries[0].discardedBy === owner.id &&
        flight.card &&
        richeseCardDefinition(flight.card)?.card.effect === 'ornithopter' &&
        (['id', 'name', 'kind', 'effect'] as const).every(
          (key) => flight.card[key] === batch.entries[0].card[key],
        ),
      'The retired Ornithopter does not match its completed flight and discard.',
    );
    if (c.source === 'move') {
      const m = c.movement;
      requireRule(
        m &&
          m.player === owner.id &&
          owner.shipped &&
          gameTerritories(g).some((t) => t.id === m.origin) &&
          validLocation(m.to, m.sector) &&
          Number.isSafeInteger(m.total) &&
          m.total > 0 &&
          typeof m.noField === 'boolean' &&
          Number.isSafeInteger(m.elite) &&
          m.elite >= 0 &&
          m.elite <= m.total - (m.noField ? 1 : 0) &&
          (owner.forces[location(m.to, m.sector)] ?? 0) >=
            m.total - (m.noField ? 1 : 0) &&
          (owner.elites?.forces[location(m.to, m.sector)] ?? 0) >= m.elite &&
          (!m.noField ||
            (owner.noField?.deployed?.location.territory === m.to &&
              owner.noField.deployed.location.sector === m.sector)),
        'The retired Ornithopter arrival differs from its committed movement.',
      );
    } else
      requireRule(
        c.movement === null,
        'An ended Ornithopter has no arrival to replay.',
      );
    requireRule(
      c.stateSignature === ornithopterDiscardSignature(g, c),
      'The retired Ornithopter no longer matches its saved movement obligations.',
    );
    suspendedControlsIntegrity(g, c.resume);
  } else if (continuation?.kind === 'ambassador') {
    const entry = continuation.entry;
    const owner = g.players.find((p) => p.id === entry?.owner);
    const beneficiary = g.players.find((p) => p.id === entry?.beneficiary);
    requireRule(
      entry &&
        entry.turn === g.turn &&
        entry.phase === g.phase &&
        typeof entry.event === 'string' &&
        entry.event.length > 0 &&
        entry.stage === 'cards' &&
        ['choam', 'ixians'].includes(entry.effect!) &&
        ['none', 'wormRide'].includes(entry.resume) &&
        validAmbassadorResume(g, entry) &&
        TERRITORIES.some(
          (t) =>
            t.id === entry.territory &&
            t.type === 'stronghold' &&
            t.sectors.includes(entry.sector),
        ) &&
        owner?.faction === 'ecaz' &&
        beneficiary &&
        (beneficiary.id === owner.id ||
          (beneficiary.ally === owner.id && owner.ally === beneficiary.id)) &&
        g.players.some((p) => p.id === entry.entrant) &&
        g.ecazAmbassadors?.tokens.some(
          (token) =>
            token.id === entry.token &&
            ((token.effect === entry.effect && token.zone === 'used') ||
              (token.effect === 'beneGesserit' &&
                token.zone === 'removed' &&
                Array.isArray(entry.copyChoices) &&
                entry.copyChoices.includes(entry.effect!))),
        ) &&
        batch.cause === `ambassador:${entry.effect}` &&
        batch.entries.every(
          (c) => c.discardedBy === entry.beneficiary && !c.publicFace,
        ) &&
        (entry.effect !== 'ixians' || batch.entries.length === 1),
      'The saved Ambassador discard continuation is inconsistent.',
    );
  } else if (continuation?.kind === 'terrorDiscard') {
    const { entry, owner: ownerId, source, discardedHandSize } = continuation;
    const owner = g.players.find((p) => p.id === ownerId);
    const entrant = g.players.find((p) => p.id === entry?.entrant);
    const tokens = g.moritaniTerror?.tokens.filter(
      (t) => t.id === entry?.token,
    );
    if (entry?.cause === 'ambassador') ambassadorRelocationIntegrity(g);
    const sabotage = source === 'sabotage';
    const discarder = sabotage ? entrant : owner;
    requireRule(
      !g.pendingTerrorEntry &&
        !g.pendingExchange &&
        !g.summonedWorm &&
        entry &&
        entry.turn === g.turn &&
        entry.phase === g.phase &&
        ['sabotage', 'robberyOverflow'].includes(source) &&
        owner?.faction === 'moritani' &&
        entrant &&
        entrant.id !== owner.id &&
        TERRITORIES.some(
          (t) =>
            t.id === entry.territory &&
            t.type === 'stronghold' &&
            t.sectors.includes(entry.sector),
        ) &&
        [
          'shipment',
          'movement',
          'guildTransport',
          'advisor',
          'wormRide',
          'ambassador',
        ].includes(entry.cause) &&
        ['none', 'wormRide', 'ambassador'].includes(entry.resume) &&
        (entry.cause === 'ambassador'
          ? ambassadorTerrorEntryMatches(g, entry)
          : entry.cause === 'wormRide'
            ? entry.resume === 'wormRide' &&
              g.phase === 1 &&
              entrant.faction === 'fremen'
            : entry.resume === 'none') &&
        Number.isSafeInteger(entry.amount) &&
        entry.amount >= 0 &&
        Number.isSafeInteger(entry.elite) &&
        entry.elite >= 0 &&
        entry.elite <= entry.amount &&
        tokens?.length === 1 &&
        tokens[0].kind === (sabotage ? 'sabotage' : 'robbery') &&
        tokens[0].status === 'removed' &&
        tokens[0].location === null &&
        entry.stage === (sabotage ? 'offer' : 'discard') &&
        batch.cause === `terror:${source}` &&
        batch.entries.length === 1 &&
        !batch.entries[0].publicFace &&
        discarder &&
        batch.entries[0].discardedBy === discarder?.id &&
        Number.isSafeInteger(discardedHandSize) &&
        discardedHandSize > 0 &&
        discardedHandSize === discarder.hand.length + 1 &&
        (sabotage || discardedHandSize > handLimit(owner)),
      'The saved Terror discard does not match its consumed entry and hand.',
    );
  } else if (continuation?.kind === 'ixAllyCard') {
    const sale = g.currentAuctionSale;
    const buyer = g.players.find((p) => p.id === continuation.player);
    const ixians = byFaction(g, 'ixians');
    const lot = g.richeseAuction;
    requireRule(
      g.phase === 3 &&
        sale &&
        continuation.sale &&
        Number.isSafeInteger(sale.amount) &&
        sale.amount >= 0 &&
        typeof sale.free === 'boolean' &&
        ['normal', 'blackMarket'].includes(sale.origin) &&
        buyer &&
        ixians &&
        buyer.ally === ixians.id &&
        ixians.ally === buyer.id &&
        (['winner', 'amount', 'free', 'origin', 'seller'] as const).every(
          (key) => sale[key] === continuation.sale[key],
        ) &&
        continuation.player === sale.winner &&
        continuation.free === sale.free &&
        continuation.auctionIndex === (g.auction?.index ?? null) &&
        continuation.auctionEvent === (g.richeseAuction?.event ?? null) &&
        batch.cause === 'ixAllyCard' &&
        batch.entries.length === 1 &&
        batch.entries[0].card.id === continuation.card &&
        batch.entries[0].discardedBy === continuation.player &&
        batch.entries[0].publicFace === false &&
        (sale.origin === 'normal'
          ? sale.seller === null &&
            g.auction?.bidder === buyer.id &&
            g.auction.bid === sale.amount &&
            g.auction.cards[g.auction.index]?.id === continuation.card
          : !sale.free &&
            lot?.source === 'blackMarket' &&
            lot.owner === sale.seller &&
            g.players.some((p) => p.id === sale.seller && p.id !== buyer.id) &&
            lot.outcome?.kind === 'sold' &&
            lot.outcome.winner === buyer.id &&
            lot.outcome.amount === sale.amount &&
            lot.cardId === continuation.card),
      'The saved Ixian replacement no longer matches its paid auction.',
    );
  } else if (
    continuation?.kind === 'battleResolved' ||
    continuation?.kind === 'battleCleanup'
  ) {
    const c = continuation;
    const context = g.lastBattleContext;
    requireRule(
      g.phase === 6 &&
        !g.battle &&
        context &&
        context.turn === g.turn &&
        typeof context.event === 'string' &&
        context.event.length > 0 &&
        c.event === context.event &&
        c.territory === context.territory &&
        JSON.stringify(c.combatants) === JSON.stringify(context.combatants) &&
        Array.isArray(c.combatants) &&
        c.combatants.length === 2 &&
        new Set(c.combatants).size === 2 &&
        JSON.stringify(c.combatants) === JSON.stringify(g.lastBattle) &&
        c.combatants.every((id) => g.players.some((p) => p.id === id)) &&
        combatLocations(g).some((t) => t.id === c.territory) &&
        batch.entries.every(
          (e) => e.publicFace && c.combatants.includes(e.discardedBy),
        ),
      'The saved battle discard does not match its resolved combatants.',
    );
    // Projection must validate the private Auditor owner as strictly as actions.
    auditorIntegrity(g);
    const loser = c.combatants.find((id) => id !== context.winner);
    requireRule(
      (!g.pendingAuditor ||
        (g.pendingAuditor.stage === 'offer' &&
          g.pendingAuditor.event === context.event &&
          g.pendingAuditor.territory === c.territory)) &&
        (!g.pendingCapture ||
          (g.advanced &&
            g.pendingCapture.player === context.winner &&
            g.pendingCapture.loser === loser &&
            g.pendingCapture.territory === c.territory &&
            g.players.find((p) => p.id === context.winner)?.faction ===
              'harkonnen')) &&
        (!g.pendingTech ||
          (g.pendingTech.player === context.winner &&
            g.pendingTech.loser === loser &&
            g.pendingTech.choices.length > 0 &&
            new Set(g.pendingTech.choices).size ===
              g.pendingTech.choices.length &&
            g.pendingTech.choices.every((id) =>
              ownedTech(g.techTokens, loser!).includes(id),
            ))) &&
        (!g.pendingFaceDance ||
          (g.pendingFaceDance.winner === context.winner &&
            g.pendingFaceDance.territory === c.territory &&
            g.players.find((p) => p.id === g.pendingFaceDance!.player)
              ?.faction === 'tleilaxu')) &&
        (!g.pendingChoamBattleIncome ||
          (Number.isSafeInteger(g.pendingChoamBattleIncome.amount) &&
            g.pendingChoamBattleIncome.amount > 0 &&
            g.players.find((p) => p.id === g.pendingChoamBattleIncome!.owner)
              ?.faction === 'choam')),
      'The saved battle discard has inconsistent remaining battle effects.',
    );
    const held = c.kind === 'battleResolved' ? c.cards : c.kept;
    const owner = c.kind === 'battleResolved' ? c.winner : c.player;
    requireRule(
      Array.isArray(held) &&
        new Set(held).size === held.length &&
        (owner === null ? held.length === 0 : c.combatants.includes(owner)) &&
        held.every(
          (id) =>
            typeof id === 'string' &&
            !ids.has(id) &&
            outside.filter((card) => card.id === id).length === 1 &&
            !g.discard.some((card) => card.id === id) &&
            g.players
              .find((p) => p.id === owner)
              ?.hand.some((card) => card.id === id),
        ),
      'The cards kept for the battle continuation are inconsistent.',
    );
    if (c.kind === 'battleCleanup') {
      requireRule(
        ['winner', 'moritani'].includes(c.source) &&
          batch.cause === `battle:${c.source}` &&
          Array.isArray(c.played) &&
          new Set(c.played).size === c.played.length &&
          c.played.length === c.kept.length + batch.entries.length &&
          c.played.every(
            (id) =>
              typeof id === 'string' && (ids.has(id) || c.kept.includes(id)),
          ) &&
          (c.source === 'winner'
            ? c.player === context.winner
            : c.player !== context.winner) &&
          batch.entries.every((e) => e.discardedBy === c.player) &&
          (c.source !== 'moritani' ||
            (!g.moritaniRetention && c.kept.length <= 1)),
        'The saved battle card cleanup is inconsistent.',
      );
      if (c.source === 'moritani') {
        const r = c.retention;
        const owner = g.players.find((p) => p.id === r?.owner);
        const loser = g.players.find((p) => p.id === c.player);
        requireRule(
          r &&
            r.turn === g.turn &&
            r.territory === c.territory &&
            r.player === c.player &&
            owner?.faction === 'moritani' &&
            owner.ally === c.player &&
            loser?.ally === owner.id &&
            ['choose', 'response'].includes(r.stage) &&
            JSON.stringify(r.played) === JSON.stringify(c.played) &&
            Array.isArray(r.eligible) &&
            new Set(r.eligible).size === r.eligible.length &&
            r.eligible.every((id) => r.played.includes(id)) &&
            c.kept.every((id) => r.eligible.includes(id)),
          'The consumed Moritani retention record is inconsistent.',
        );
      }
    } else {
      requireRule(
        batch.cause === 'battle:mandatory' &&
          c.result === context.result &&
          c.winner === context.winner &&
          ['normal', 'traitor', 'mutualTraitors', 'explosion'].includes(
            c.result,
          ) &&
          (c.winner === null) ===
            ['mutualTraitors', 'explosion'].includes(c.result) &&
          !!c.casualties ===
            (c.result === 'normal' &&
              (g.advanced ||
                !!g.homeworlds ||
                g.players.find((p) => p.id === c.winner)?.faction ===
                  'ixians')),
        'The mandatory battle discard cause is inconsistent.',
      );
      if (c.casualties) {
        const { forces, dial, support, options } = c.casualties;
        const winner = g.players.find((p) => p.id === c.winner);
        const pool = winner ? combatArmy(g, winner.id, c.territory) : { normal: 0, elite: 0 };
        const total = pool.normal + pool.elite;
        const elites = pool.elite;
        requireRule(
          winner &&
            forces &&
            validCombatForces(forces) &&
            Number.isSafeInteger(forces.normal) &&
            forces.normal >= 0 &&
            Number.isSafeInteger(forces.elite) &&
            forces.elite >= 0 &&
            [1, 2].includes(forces.eliteStrength) &&
            typeof forces.freeSupport === 'boolean' &&
            (forces.eliteFreeSupport === undefined ||
              typeof forces.eliteFreeSupport === 'boolean') &&
            (forces.normalFixedHalf === undefined ||
              typeof forces.normalFixedHalf === 'boolean') &&
            forces.normal === total - elites &&
            forces.elite === elites &&
            Array.isArray(options) &&
            options.length > 0 &&
            JSON.stringify(options) ===
              JSON.stringify(casualtyOptions(forces, dial, support)),
          'The saved battle casualties do not match the committed dial, support and effective forces.',
        );
      }
    }
  } else if (continuation?.kind === 'winnerMandatoryDiscard') {
    const c = continuation;
    requireRule(g.phase === 6 && g.lastBattleContext?.event === c.event &&
      g.lastBattleContext.winner === c.player && g.lastBattleContext.territory === c.territory &&
      batch.cause === 'battle:winnerMandatory' && !g.pendingWinnerDiscards &&
      c.commitment?.signature === winnerDiscardSignature(c.commitment) &&
      c.commitment.event === c.event && c.commitment.player === c.player &&
      c.commitment.turn === g.turn && c.commitment.territory === c.territory &&
      JSON.stringify(c.commitment.optional) === JSON.stringify(c.optional) &&
      JSON.stringify(c.commitment.cards) === JSON.stringify(batch.entries.map((entry) => entry.card.id)) &&
      batch.entries.every((entry) => entry.discardedBy === c.player && entry.publicFace) &&
      Array.isArray(c.optional) && new Set(c.optional).size === c.optional.length &&
      c.optional.every((id) => getPlayer(g, c.player).hand.some((card) => card.id === id)),
      'The mandatory winning card discard no longer matches its resolved battle.');
  } else if (continuation?.kind === 'kaitainDiscard') {
    const c = continuation;
    requireRule(g.phase === 3 && g.biddingEnd?.event === c.event &&
      getPlayer(g, c.owner).faction === 'emperor' && batch.cause === 'kaitain' &&
      batch.entries.length > 0 && c.cost === 2 * batch.entries.length &&
      Number.isSafeInteger(c.spiceAfter) && c.spiceAfter >= 0 &&
      getPlayer(g, c.owner).spice === c.spiceAfter &&
      batch.entries.every((entry) => entry.discardedBy === c.owner && !entry.publicFace),
      'The committed Kaitain discard no longer matches its payment and closing opportunity.');
  } else throw new RuleError('Unknown saved discard continuation.');
}
function stageTreacheryDiscard(
  g: Game,
  cause: string,
  entries: FreshDiscardBatch['entries'],
  continuation: NonNullable<Game['pendingTreacheryDiscard']>['continuation'],
) {
  requireRule(!g.pendingTreacheryDiscard, 'Finish the prior discard first.');
  treacheryDiscardIntegrity(g);
  const sequence = (g.treacheryDiscardSequence ?? 0) + 1;
  g.treacheryDiscardSequence = sequence;
  g.pendingTreacheryDiscard = {
    sequence,
    batch: {
      event: `discard:${g.turn}:${g.phase}:${sequence}`,
      turn: g.turn,
      phase: g.phase,
      cause,
      entries: structuredClone(entries),
    },
    continuation: structuredClone(continuation),
  };
  treacheryDiscardIntegrity(g);
}
/** No reaction policy is selected here. Semuta activation remains unavailable.
 * The existing exchanges resume automatically from their exact committed stage. */
function finishTreacheryDiscard(g: Game) {
  treacheryDiscardIntegrity(g);
  const pending = g.pendingTreacheryDiscard;
  if (!pending) return;
  const next = pending.continuation;
  // Retire before any suffix can draw or create the next semantic discard.
  g.resolvedTreacheryDiscardSequence = pending.sequence;
  g.pendingTreacheryDiscard = null;
  if (next.kind === 'winnerMandatoryDiscard') {
    finishWinner(g, getPlayer(g, next.player), next.territory, next.optional);
    return;
  }
  if (next.kind === 'kaitainDiscard') return;
  if (next.kind === 'ambassador') {
    const p = getPlayer(g, next.entry.beneficiary!);
    if (next.entry.effect === 'ixians') {
      const card = draw(g);
      requireRule(card, 'No replacement card is available.');
      p.hand.push(card);
      log(
        g,
        `${p.name} discarded one Treachery card and drew its replacement through the Ixian Ambassador. The replacement remains private.`,
        { faction: p.faction, name: 'Ixian Ambassador' },
      );
    }
    // CHOAM's selected-count payout was already committed with its discard.
    g.pendingAmbassador = next.entry;
    finishAmbassador(g);
  } else if (next.kind === 'nullentropyDiscard') {
    g.response = next.resume.response;
    g.decision = next.resume.decision;
    g.pendingKarama = next.resume.pendingKarama;
    g.phaseOpening = next.resume.phaseOpening;
  } else if (next.kind === 'ordinaryCardDiscard') {
    g.response = next.resume.response;
    g.decision = next.resume.decision;
    g.pendingKarama = next.resume.pendingKarama;
    g.phaseOpening = next.resume.phaseOpening;
    if (g.pendingChoamMarketGhola?.discardSequence === pending.sequence)
      g.pendingChoamMarketGhola.stage = g.response ? 'income' : 'complete';
  } else if (next.kind === 'truthtranceDiscard') {
    g.response = next.resume.response;
    g.decision = next.resume.decision;
    g.pendingKarama = next.resume.pendingKarama;
    g.phaseOpening = next.resume.phaseOpening;
    g.truthtrance = next.remaining;
  } else if (next.kind === 'ornithopterDiscard') {
    g.response = next.resume.response;
    g.decision = next.resume.decision;
    g.pendingKarama = next.resume.pendingKarama;
    g.phaseOpening = next.resume.phaseOpening;
    if (next.source === 'move') finishMovedGroup(g, next.movement!);
    else finishMovementTurn(g, next.flight.player);
  } else if (next.kind === 'ixAllyCard') {
    const buyer = getPlayer(g, next.player);
    const card = draw(g);
    if (card) buyer.hand.push(card);
    log(
      g,
      `${buyer.name} discarded the purchased card and drew a replacement using the Ixian alliance.`,
    );
    continueAuctionSale(g, next.free);
  } else if (next.kind === 'battleResolved') {
    continueResolvedBattle(g, next);
  } else if (next.kind === 'terrorDiscard') {
    g.pendingTerrorEntry = next.entry;
    continueTerrorDiscard(g, next.source);
  } else {
    finishBattle(g);
  }
}
function place(p: Player, t: string, s: number, n: number, elite = 0) {
  const k = location(t, s);
  p.forces[k] = (p.forces[k] ?? 0) + n;
  if (p.elites && elite) p.elites.forces[k] = (p.elites.forces[k] ?? 0) + elite;
}
function withdrawNativeReserves(
  g: Game,
  p: Player,
  amount: number,
  elite: number,
  selections?: NativeReserveSelections,
) {
  if (!g.homeworlds?.custody) {
    requireRule(
      selections === undefined,
      'Homeworld source selection requires the Homeworld module.',
    );
    p.reserves -= amount;
    if (p.elites) p.elites.reserves -= elite;
    return [];
  }
  const result = homeworldRule(() =>
    quoteNativeReserveWithdrawal(
      homeworldContext(g),
      g.homeworlds!.custody!,
      p.id,
      { normal: amount - elite, elite },
      selections,
    ),
  );
  const changed = result.players.find((seat) => seat.id === p.id)!;
  p.reserves = changed.reserves;
  if (p.elites) p.elites.reserves = changed.eliteReserves;
  g.homeworlds.custody = result.state;
  // All Homeworld changes are committed here; the destination is on Arrakis.
  observeOccupation(g);
  return result.receipts;
}
function addRevivedReserves(g: Game, p: Player, amount: number, elite: number) {
  if (!g.homeworlds?.custody) {
    p.reserves += amount;
    if (p.elites) p.elites.reserves += elite;
    return;
  }
  const result = homeworldRule(() =>
    quoteNativeRevivalDeposit(
      homeworldContext(g),
      g.homeworlds!.custody!,
      p.id,
      { normal: amount - elite, elite },
    ),
  );
  const changed = result.players.find((seat) => seat.id === p.id)!;
  p.reserves = changed.reserves;
  if (p.elites) p.elites.reserves = changed.eliteReserves;
  g.homeworlds.custody = result.state;
  observeOccupation(g);
}
function kill(
  g: Game,
  p: Player,
  key: string,
  n: number,
  battle = false,
  elite?: number,
) {
  const amount = Math.min(n, p.forces[key] ?? 0);
  if (p.elites) {
    const available = p.elites.forces[key] ?? 0;
    const lost =
      elite ?? Math.max(0, amount - ((p.forces[key] ?? 0) - available));
    requireRule(
      lost >= 0 &&
        lost <= available &&
        lost <= amount &&
        amount - lost <= (p.forces[key] ?? 0) - available,
      'Invalid elite casualties.',
    );
    p.elites.forces[key] = available - lost;
    if (!p.elites.forces[key]) delete p.elites.forces[key];
    p.elites.tanks += lost;
  }
  p.forces[key] = (p.forces[key] ?? 0) - amount;
  if (!p.forces[key]) delete p.forces[key];
  p.tanks += amount;
  if (battle) p.battleLosses += amount;
}
function homeworldSavedDecisions(g: Game): Decision[] {
  const continuation = g.pendingTreacheryDiscard?.continuation;
  return [g, g.pendingExchange, g.pendingNullentropy?.resume, g.pendingRicheseGift?.resume,
    g.pendingRichesePurchaseIncome?.resume, g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null,
  ].flatMap((context) => context?.decision ? [context.decision] : []);
}
function spiritualAdvisorMaximum(g: Game, player: string, destination = 'polar_sink') {
  return homeworldRule(() => homeworldSpiritualAdvisorLimit(g, player, destination));
}
function homeworldMobilityIntegrity(g: Game) {
  if (!g.homeworlds?.custody) return;
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const contexts = [g, g.pendingExchange, g.pendingNullentropy?.resume, g.pendingRicheseGift?.resume,
    g.pendingRichesePurchaseIncome?.resume, g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null];
  const responses = contexts.flatMap((context) => {
    if (!context) return [];
    const pending = 'pendingKarama' in context ? context.pendingKarama as Game['pendingKarama'] : null;
    return [context.response, pending?.use?.kind === 'cancel' ? pending.use.response : null];
  });
  for (const response of responses) {
    if (response?.kind === 'advisor') {
      const destination = splitLocation(response.location ?? 'polar_sink:0');
      integer(response.amount === undefined ? 1 : response.amount, 1, spiritualAdvisorMaximum(g, response.owner, destination.territory), 'Saved Spiritual Advisor forces');
    }
    if (response?.kind === 'atreidesSpice') {
      const blocked = homeworldRule(() => homeworldMovementForesightBlock(g, response.owner));
      requireRule(!blocked, blocked ?? 'Caladan prevents the saved foresight response.');
    }
    if (response?.kind === 'mobileStronghold') {
      const blocked = homeworldRule(() => homeworldMobileStrongholdMovementBlock(g, response.owner));
      requireRule(!blocked, blocked ?? 'Ix prevents the saved mobile stronghold response.');
    }
  }
}
function homeworldDefenseIntegrity(g: Game) {
  const b = g.battle;
  const decisions = homeworldSavedDecisions(g).filter((d) => d.kind === 'homeworldDefense');
  if (!decisions.length && b?.homeworldDefensePassed === undefined) return;
  requireRule(g.status === 'playing' && g.phase === 6 && b?.revealed && b.territory.startsWith('homeworld:') && b.event,
    'The Homeworld late-defense frame needs its current revealed battle.');
  const voters = traitorVoters(g, b);
  const passed = b.homeworldDefensePassed ?? [];
  requireRule(Array.isArray(passed) && new Set(passed).size === passed.length &&
    passed.every((id) => [b.attacker, b.defender].includes(id) && !voters.includes(id)),
    'Homeworld late-defense passes must belong to distinct invading combatants.');
  for (const d of decisions) {
    requireRule(d.event === b.event && [b.attacker, b.defender].includes(d.player) && !voters.includes(d.player) &&
      !passed.includes(d.player) && voters.every((id) => b.traitorCalls[id] !== undefined),
      'The saved Homeworld late-defense choice does not match its battle owner and timing.');
    const owner = getPlayer(g, d.player);
    const card = owner.hand.find(isPortableSnooper);
    requireRule(card && !b.lateDefense?.[owner.id] && !portableSnooperPlanBlock(b.plans[owner.id], owner.hand, card,
      b.voice?.target === owner.id ? b.voice : undefined),
      'The saved late-defense opportunity needs its held legal Portable Snooper.');
  }
}
function faceDanceReturnBlock(g: Game, winner: string): string | null {
  return g.advanced && g.homeworlds && getPlayer(g, winner).faction === 'emperor'
    ? 'Face Dance returning the Emperor’s army awaits the Kaitain/Salusa reserve-placement ruling.' : null;
}
function homeworldSubstitutionIntegrity(g: Game) {
  const pending = g.pendingIxSubstitution;
  if (!pending?.territory.startsWith('homeworld:')) {
    requireRule(!pending?.homeworld, 'A native substitution receipt requires a Homeworld battle.');
    return;
  }
  const receipt = pending.homeworld;
  const p = getPlayer(g, pending.player);
  const context = g.lastBattleContext;
  requireRule(receipt && p.faction === 'ixians' && g.phase === 6 && !g.battle &&
    context?.turn === g.turn && context.territory === pending.territory && context.winner === p.id && context.result === 'normal',
    'The Homeworld substitution needs its completed Ixian battle receipt.');
  const pool = combatArmy(g, p.id, pending.territory);
  requireRule(receipt.pool && pool.normal === receipt.pool.normal && pool.elite === receipt.pool.elite &&
    p.elites!.tanks === receipt.eliteTanks && p.tanks - p.elites!.tanks === receipt.normalTanks && p.battleLosses === receipt.battleLosses &&
    Number.isSafeInteger(receipt.cyborgsLost) && receipt.cyborgsLost > 0 &&
    Object.keys(pending.losses).length === 1 && pending.losses[pending.territory] === receipt.cyborgsLost,
    'The Homeworld substitution no longer matches its exact survivors and Tanks.');
  const maps = [pending.sources, pending.recover];
  requireRule(maps.every((map) => map === undefined) || maps.every((map) => map && Object.keys(map).length === 1 && Object.hasOwn(map, pending.territory)),
    'A Homeworld substitution must use its exact battle location.');
  if (pending.sources && pending.recover) {
    const amount = pending.sources[pending.territory];
    requireRule(amount === pending.recover[pending.territory], 'The substitution must exchange matching physical counts.');
    quoteHomeworldSubstitution(homeworldLossContext(g), g.homeworlds!.custody!, {location: pending.territory, player: p.id, amount, cyborgsLost: receipt.cyborgsLost});
  } else quoteHomeworldLoss(g, p.id, pending.territory, {normal: 0, elite: 0});
}
function currentHomeworldBattleRules(g: Game, to: string) {
  const home = homeworldBattleLocation(g, to);
  return home ? { native: home.native, card: home.card, side: home.side,
    nativeForces: { ...home.forces[home.native] } } : null;
}
function quoteHomeworldLoss(g: Game, player: string, to: string, losses: HomeworldForces) {
  requireRule(g.homeworlds?.custody, 'Homeworld casualties require saved custody.');
  return quoteHomeworldCombatLoss(homeworldLossContext(g), g.homeworlds.custody, { location: to, player, losses });
}
function homeworldLossContext(g: Game) {
  return { advanced: g.advanced, players: g.players.map((p) => {
    const total = Object.values(p.forces).reduce((a, b) => a + b, 0);
    const elite = Object.values(p.elites?.forces ?? {}).reduce((a, b) => a + b, 0);
    return { id: p.id, faction: p.faction, reserves: p.reserves, eliteReserves: p.elites?.reserves ?? 0,
      tanks: p.tanks, eliteTanks: p.elites?.tanks ?? 0, battleLosses: p.battleLosses,
      boardForces: { normal: total - elite, elite } };
  }) };
}
function commitHomeworldLoss(g: Game, player: string, to: string, losses: HomeworldForces) {
  const quote = quoteHomeworldLoss(g, player, to, losses);
  commitHomeworldResources(g, quote);
}
function commitHomeworldResources(g: Game, quote: Pick<ReturnType<typeof quoteHomeworldLoss>, 'custody' | 'players'>) {
  g.homeworlds!.custody = quote.custody;
  for (const update of quote.players) {
    const p = getPlayer(g, update.id);
    p.reserves = update.reserves;
    p.tanks = update.tanks;
    p.battleLosses = update.battleLosses;
    if (p.elites) { p.elites.reserves = update.eliteReserves; p.elites.tanks = update.eliteTanks; }
  }
}
/** The location's exact typed pool remains fixed while casualty/card choices
 * wait. No population, support, death or payment is replayed on restoration. */
function homeworldBattleLossIntegrity(g: Game) {
  const pending = g.homeworldBattleLoss;
  const decisions = homeworldSavedDecisions(g).filter((d) => d.kind === 'homeworldExplosion' ||
    (d.kind === 'battleLosses' && d.territory.startsWith('homeworld:')));
  if (!pending) { requireRule(!decisions.length, 'The saved Homeworld casualty receipt is missing.'); return; }
  const context = g.lastBattleContext;
  requireRule(g.phase === 6 && !g.battle && context && context.turn === g.turn &&
    context.event === pending.event && context.territory === pending.territory &&
    pending.territory.startsWith('homeworld:') &&
    ((pending.kind === 'winner' && context.result === 'normal' && context.winner === pending.player) ||
      (pending.kind === 'explosion' && context.result === 'explosion' && context.winner === null)),
    'The Homeworld casualty receipt does not match its resolved battle.');
  const pool = combatArmy(g, pending.player, pending.territory);
  requireRule(pending.pool && Object.keys(pending.pool).length === 2 &&
    pool.normal === pending.pool.normal && pool.elite === pending.pool.elite,
    'The Homeworld casualty receipt does not match its exact physical pool.');
  let options: HomeworldForces[];
  if (pending.kind === 'explosion') {
    const rules = currentHomeworldBattleRules(g, pending.territory)!;
    requireRule(rules.native === pending.player && !pending.commitment,
      'Native explosion casualties belong to this Homeworld’s native faction.');
    options = quoteHomeworldBattleRules(pending.territory, g.players, rules).explosion.options;
  } else {
    const commitment = pending.commitment;
    requireRule(commitment && commitment.forces.normal === pool.normal && commitment.forces.elite === pool.elite,
      'The Homeworld winner needs its committed physical forces.');
    options = casualtyOptions(commitment.forces, commitment.dial, commitment.support).map(({normal, elite}) => ({normal, elite}));
  }
  requireRule(options.length > 0 && JSON.stringify(options) === JSON.stringify(pending.options),
    'The Homeworld casualty choices do not match the committed outcome.');
  for (const choice of options) quoteHomeworldLoss(g, pending.player, pending.territory, choice);
  for (const decision of decisions) {
    if (decision.kind !== 'homeworldExplosion' && decision.kind !== 'battleLosses') continue;
    requireRule(decision.player === pending.player && decision.territory === pending.territory &&
      (decision.kind === 'homeworldExplosion' ? pending.kind === 'explosion' && decision.event === pending.event &&
        JSON.stringify(decision.pool) === JSON.stringify(pending.pool) : pending.kind === 'winner') &&
      JSON.stringify(decision.options.map(({normal, elite}) => ({normal, elite}))) === JSON.stringify(options),
      'The owned Homeworld casualty decision does not match its receipt.');
  }
}
function settleHomeworldExplosion(g: Game, choice: HomeworldForces, automatic: boolean) {
  homeworldBattleLossIntegrity(g);
  homeworldSubstitutionIntegrity(g);
  homeworldDefenseIntegrity(g);
  homeworldShipmentIntegrity(g);
  const pending = g.homeworldBattleLoss!;
  requireRule(pending.kind === 'explosion' && pending.options.some((p) => p.normal === choice.normal && p.elite === choice.elite),
    'Choose a native explosion casualty allocation.');
  commitHomeworldLoss(g, pending.player, pending.territory, choice);
  observeOccupation(g);
  const player = getPlayer(g, pending.player);
  log(g, `${player.name} lost ${choice.normal} normal and ${choice.elite} special forces on ${combatLocationName(g, pending.territory)}. The remaining native forces survived the Lasgun–shield explosion.${automatic ? ' The only physical allocation was applied automatically.' : ''}`,
    automatic ? { faction: player.faction, name: 'Native explosion casualties' } : undefined);
  g.homeworldBattleLoss = null;
  finishBattle(g);
}
function killTerritory(
  g: Game,
  p: Player,
  t: string,
  n = Infinity,
  battle = false,
  noFieldCause?: NoFieldRevealCause,
) {
  if (t.startsWith('homeworld:')) {
    requireRule(battle && n === Infinity, 'Homeworld force removal requires an exact combat casualty allocation.');
    commitHomeworldLoss(g, p.id, t, combatArmy(g, p.id, t));
    return;
  }
  if (p.noField?.deployed?.location.territory === t) {
    requireRule(
      noFieldCause,
      'This removal of a concealed No-Field awaits its specific reveal and casualty rules.',
    );
    revealPlayerNoField(g, p, noFieldCause);
  }
  for (const key of Object.keys(p.forces)) {
    if (splitLocation(key).territory !== t) continue;
    const lost = Math.min(n, p.forces[key]);
    kill(g, p, key, lost, battle);
    n -= lost;
  }
}
function combatForces(
  g: Game,
  p: Player,
  t: string,
  opponent: Player,
): CombatForces {
  const marker = p.noField?.deployed;
  const prospective =
    marker?.location.territory === t
      ? Math.min(
          p.reserves,
          p.noField!.tokens.find((token) => token.id === marker.tokenId)!.value,
        )
      : 0;
  const army = combatArmy(g, p.id, t);
  const physical = army.normal + army.elite;
  const elite = army.elite;
  return {
    normal: physical + prospective - elite,
    ...(nexusSardaukarEffective(g,p.id,t) ? {temporaryElite:nexusSardaukarEffective(g,p.id,t)} : {}),
    ...(homeworldSardaukarFreeSupport(g, p.id)
      ? { eliteFreeSupport: true }
      : {}),
    normalFixedHalf: p.faction === 'ixians' && !nexusSuboidsActive(g, g.nexusSuboidHistory, p.id),
    ...(nexusSuboidsActive(g, g.nexusSuboidHistory, p.id) ? { normalFreeSupport: true } : {}),
    elite,
    eliteStrength:
      (!g.advanced && p.faction !== 'ixians') ||
      (g.battle?.eliteBlocked?.includes(p.id) &&
        !(g.advanced && p.faction === 'ixians')) ||
      (p.faction === 'emperor' && opponent.faction === 'fremen')
        ? 1
        : 2,
    freeSupport:
      !g.advanced ||
      (p.faction === 'fremen' && !g.battle?.fremenSupportBlocked),
  };
}
function takeBattleLosses(g: Game, p: Player, t: string, losses: Casualties) {
  if (t.startsWith('homeworld:')) {
    commitHomeworldLoss(g, p.id, t, { normal: losses.normal, elite: losses.elite });
    return losses.elite ? { [t]: losses.elite } : {};
  }
  const lostCyborgs: Record<string, number> = {};
  let normal = losses.normal,
    elite = losses.elite;
  for (const key of Object.keys(p.forces).filter(
    (key) => splitLocation(key).territory === t,
  )) {
    const e = Math.min(elite, p.elites?.forces[key] ?? 0);
    const n = Math.min(normal, p.forces[key] - (p.elites?.forces[key] ?? 0));
    kill(g, p, key, n + e, true, e);
    if (e) lostCyborgs[key] = e;
    normal -= n;
    elite -= e;
  }
  requireRule(
    normal === 0 && elite === 0,
    'The selected casualties are not available.',
  );
  return lostCyborgs;
}
function start(g: Game) {
  requireRule(g.players.length >= 2, 'At least two players are needed.');
  requireRule(
    g.players.every((p) => p.ready),
    'Every player must be ready.',
  );
  requireRule(!g.advanced, 'Advanced rules are still being implemented.');
  requireRule(!g.homeworlds, 'Homeworld gameplay is still being implemented.');
  requireRule(!g.nexusCards, 'Nexus card effects are still being implemented.');
  requireRule(
    g.players.every((p) => faction(p.faction).expansion === 'base'),
    'Expansion factions are still being implemented.',
  );
  requireRule(
    g.expansions.length === 0,
    'Expansion rules are still being implemented.',
  );
  initializeSetup(g);
}
function initializeSetup(g: Game) {
  if (g.nexusCards) g.nexusCards = { cards: createNexusCards(g.players, random), phase: null };
  const choam = byFaction(g, 'choam');
  if (choam && g.advanced && !choam.leaders.some(isAuditorLeader))
    choam.leaders.push(createAuditorLeader());
  if (g.strongholdCards) {
    requireRule(g.advanced, 'Stronghold Cards require Advanced rules.');
    g.strongholdCards = createStrongholdCards();
  }
  if (g.techTokens) {
    requireRule(
      g.players.length >= 3,
      'Tech tokens currently require at least three players.',
    );
    g.techTokens = createTechTokens(g.players);
  }
  if (byFaction(g, 'richese')) {
    g.richeseCache = richeseCards();
    g.richeseRemoved = [];
  }
  g.playerPositions = normalizedPlayerPositions(g);
  g.storm = STORM_START_SECTOR;
  stormOrder(g);
  g.stormDialers = [g.order[0], g.order.at(-1)!];
  g.lastBattle = [...g.stormDialers];
  g.deck = shuffle(treacheryDeck(g.expansions));
  g.spiceDeck = shuffle(spiceDeck(g.expansions.includes('ix')));
  g.sandtrout = false;
  g.status = 'setup';
  g.setupStage = 'prediction';
  g.ready = [];
  log(
    g,
    byFaction(g, 'beneGesserit')
      ? 'Player positions are fixed. Bene Gesserit must lock its prediction before private cards are dealt.'
      : 'Player positions are fixed. Private traitor selection comes before force placement and starting Treachery Cards.',
  );
}
function initializeStartingForces(g: Game) {
  for (const p of g.players) {
    p.spice = faction(p.faction).spice;
    if (p.faction === 'richese') {
      p.noField = createRicheseNoField([
        crypto.randomUUID(),
        crypto.randomUUID(),
        crypto.randomUUID(),
      ]);
      p.noFieldEvent = crypto.randomUUID();
    }
    if (p.faction === 'moritani') g.moritaniTerror = createTerrorState(random);
    if (p.faction === 'ecaz') g.ecazAmbassadors = createAmbassadors(random);
    if (p.faction === 'moritani' || p.faction === 'ecaz')
      g.dukeVidal ??= createDukeVidal();
    delete p.elites;
    if (p.faction === 'ixians') {
      p.elites = { reserves: 4, tanks: 0, forces: {}, revived: 0 };
      place(p, MOBILE_STRONGHOLD, 0, 6, 3);
      p.reserves -= 6;
      g.mobileStronghold = { location: null };
    }
    if (
      (g.advanced || g.homeworlds) &&
      ['emperor', 'fremen'].includes(p.faction)
    )
      p.elites = {
        reserves: p.faction === 'emperor' ? 5 : 3,
        tanks: 0,
        forces: {},
        revived: 0,
      };
    const pos: Record<string, [string, number, number]> = {
      atreides: ['arrakeen', 10, 10],
      harkonnen: ['carthag', 11, 10],
      guild: ['tueks_sietch', 5, 5],
      beneGesserit: ['polar_sink', 0, 1],
    };
    const t = pos[p.faction];
    if (t && !(g.advanced && p.faction === 'beneGesserit')) {
      place(p, ...t);
      p.reserves -= t[2];
    }
  }
  if (g.homeworlds)
    g.homeworlds.custody = createHomeworldCustody(homeworldContext(g));
}
function dealStartingTreachery(g: Game) {
  const ixians = byFaction(g, 'ixians');
  if (ixians) {
    g.ixSetupCards = [];
    for (const _player of g.players) {
      const card = draw(g);
      if (card) g.ixSetupCards.push(card);
    }
    g.decision = { kind: 'ixSetup', player: ixians.id };
  } else {
    for (const p of g.players) {
      const quantity = p.faction === 'harkonnen' ? 2 : 1;
      for (let i = 0; i < quantity; i++) {
        const card = draw(g);
        if (card) p.hand.push(card);
      }
      log(
        g,
        `${p.name} received ${quantity} starting Treachery Card${quantity === 1 ? '' : 's'} after force placement.`,
        { faction: p.faction, name: 'Starting cards' },
      );
    }
  }
  if (ixians)
    log(
      g,
      'Starting force placement is complete. Ixians must choose their starting card before the remaining cards are dealt.',
    );
}
function setupPending(g: Game): string[] {
  if (g.status !== 'setup' || !g.setupStage) return [];
  if (g.setupStage === 'prediction') {
    const bg = byFaction(g, 'beneGesserit');
    return bg && !bg.prediction ? [bg.id] : [];
  }
  if (g.setupStage === 'traitors')
    return g.players
      .filter((p) => p.traitorChoices.length > 0)
      .map((p) => p.id);
  const fremen = byFaction(g, 'fremen');
  if (fremen?.reserves === 20) return [fremen.id];
  const bg = byFaction(g, 'beneGesserit');
  return g.advanced && bg && !bg.advisorSetup ? [bg.id] : [];
}
function advanceSetup(g: Game) {
  if (!g.setupStage || g.status !== 'setup') return;
  if (g.setupStage === 'prediction') {
    if (setupPending(g).length) return;
    const traitors = shuffle(
      traitorDeck(g.players, g.expansions.includes('ix')),
    );
    for (const p of g.players) {
      p.traitorChoices = p.faction === 'tleilaxu' ? [] : traitors.splice(0, 4);
      if (p.faction === 'harkonnen') {
        p.traitors = p.traitorChoices;
        p.traitorChoices = [];
      }
    }
    g.traitorReserve = traitors;
    g.setupStage = 'traitors';
    log(
      g,
      'Traitor Cards were dealt privately. Choose traitors before starting force placement; Treachery Cards remain undealt.',
    );
  }
  if (g.setupStage === 'traitors') {
    if (setupPending(g).length) return;
    initializeStartingForces(g);
    g.setupStage = 'forces';
    log(
      g,
      'Traitor choices are complete. Starting spice and fixed forces are placed; complete faction force placement before receiving Treachery Cards.',
    );
  }
  if (g.setupStage === 'forces' && !setupPending(g).length) {
    delete g.setupStage;
    dealStartingTreachery(g);
  }
}
/** Offline-only test seam. No player action or room API dispatches this function. */
export function initializeBaseGameForAudit(state: Game): Game {
  return initializeSetupGameForAudit(state, false);
}
/** Offline-only seam through the real setup pipeline. Public Homeworld starts remain gated. */
export function initializeHomeworldGameForAudit(state: Game): Game {
  requireRule(
    !!state.homeworlds,
    'Enable the Homeworld module in the audit lobby first.',
  );
  return initializeSetupGameForAudit(state, true);
}
/** Offline-only seam for the independent Nexus module; public starts remain gated. */
export function initializeNexusGameForAudit(state: Game): Game {
  requireRule(!!state.nexusCards && state.nexusCards.cards === null && state.nexusCards.phase === null,
    'Enable Nexus cards in a fresh audit lobby first.');
  return initializeSetupGameForAudit(state, !!state.homeworlds, true);
}
function initializeSetupGameForAudit(state: Game, homeworlds: boolean, nexus = false): Game {
  nexusCardsIntegrity(state);
  homeworldRule(() => homeworldGameIntegrity(state));
  homeworldBattleLossIntegrity(state);
  homeworldSubstitutionIntegrity(state);
  homeworldDefenseIntegrity(state);
  homeworldShipmentIntegrity(state);
  const g = structuredClone(state);
  requireRule(
    g.status === 'lobby' && !g.setupStage && g.turn === 1 && g.phase === 0,
    'The audit initializer requires a fresh lobby.',
  );
  requireRule(
    g.players.length >= 2 &&
      g.players.length <= 6 &&
      new Set(g.players.map((p) => p.id)).size === g.players.length &&
      new Set(g.players.map((p) => p.faction)).size === g.players.length &&
      g.players.some((p) => p.id === g.host) &&
      g.players.every((p) => p.id && p.ready),
    'The audit initializer requires two through six distinct ready players and an existing host.',
  );
  requireRule(
    (homeworlds || nexus || g.expansions.length === 0) &&
      (nexus || !g.nexusCards) &&
      !g.techTokens &&
      !g.strongholdCards &&
      (homeworlds || !g.homeworlds) &&
      g.players.every((p) =>
        FACTIONS.some(
          (f) => f.id === p.faction && (homeworlds || nexus || f.expansion === 'base'),
        ),
      ),
    homeworlds
      ? 'The Homeworld setup audit supports implemented deck sets without Tech Tokens or Stronghold Cards.'
      : 'The audit initializer supports base factions without expansions or optional modules.',
  );
  requireRule(
    !g.deck.length &&
      !g.discard.length &&
      !g.spiceDeck.length &&
      !g.spiceDiscard.some((pile) => pile.length) &&
      !g.traitorReserve?.length &&
      !g.decision &&
      !g.response &&
      !g.battle &&
      !g.winner.length &&
      g.players.every(
        (p) =>
          !p.hand.length &&
          !p.traitors.length &&
          !p.traitorChoices.length &&
          Object.keys(p.forces).length === 0 &&
          p.reserves === 20 &&
          p.tanks === 0 &&
          p.spice === 0 &&
          p.moved === 0 &&
          !p.shipped &&
          !p.prediction &&
          !p.advisorSetup &&
          (!p.elites ||
            ((homeworlds || nexus) &&
              p.faction === 'ixians' &&
              p.elites.reserves === 7 &&
              p.elites.tanks === 0 &&
              p.elites.revived === 0 &&
              Object.keys(p.elites.forces).length === 0)),
      ),
    'The audit initializer cannot redeal or replace existing game pieces.',
  );
  requireRule(
    Object.keys(g.playerPositions ?? {}).every((id) =>
      g.players.some((p) => p.id === id),
    ),
    'Player circles must belong to seated players.',
  );
  normalizedPlayerPositions(g);
  initializeSetup(g);
  return normalizeAutomaticGame(g);
}
function otherSetupComplete(g: Game) {
  return (
    !g.setupStage &&
    !g.ixSetupCards &&
    g.players.every(
      (p) =>
        (p.faction === 'tleilaxu' || p.traitors.length > 0) &&
        (p.faction !== 'fremen' || p.reserves === 10) &&
        (p.faction !== 'beneGesserit' ||
          (p.prediction && (!g.advanced || p.advisorSetup))),
    )
  );
}
function setupComplete(g: Game) {
  return (
    otherSetupComplete(g) &&
    !g.players.some((p) => p.faction === 'moritani' && p.reserves === 20)
  );
}
function finishMoritaniPlacement(g: Game) {
  if (!byFaction(g, 'choam')) victory(g);
}
function finishSetup(g: Game) {
  const tleilaxu = byFaction(g, 'tleilaxu');
  if (tleilaxu) {
    const held = new Set(g.players.flatMap((player) => player.traitors));
    g.traitorReserve = shuffle(
      traitorDeck(g.players, g.expansions.includes('ix')).filter(
        (card) => !held.has(card),
      ),
    );
    tleilaxu.faceDancers = g.traitorReserve
      .splice(0, 3)
      .map((leader) => ({ leader, revealed: false }));
  }
  g.status = 'playing';
  if (g.homeworlds?.custody) {
    g.homeworldOccupationHistory = homeworldRule(() => createHomeworldOccupationHistory(homeworldContext(g), g.homeworlds!.custody!, g.turn, crypto.randomUUID()));
    g.homeworlds.historyVersion = 1;
    const choam = byFaction(g, 'choam');
    if (choam) g.tupileIntelligence = createTupileIntelligenceState(choam.id);
  }
  log(g, 'Setup complete. The first storm awaits two secret dials.');
  openPhase(g, false);
}

/** Pure legacy/default projection. Existing occupied circles never move on join. */
function normalizedPlayerPositions(g: Game): Record<string, number> {
  const positions: Record<string, number> = {};
  const occupied = new Set<number>();
  for (const p of g.players) {
    const position = g.playerPositions?.[p.id];
    if (position === undefined) continue;
    requireRule(
      Number.isInteger(position) &&
        position >= 1 &&
        position <= 6 &&
        !occupied.has(position),
      'Player circles must be distinct positions from 1 to 6.',
    );
    positions[p.id] = position;
    occupied.add(position);
  }
  for (const p of g.players) {
    if (positions[p.id] !== undefined) continue;
    const position = [1, 2, 3, 4, 5, 6].find(
      (candidate) => !occupied.has(candidate),
    );
    requireRule(position !== undefined, 'There are only six player circles.');
    positions[p.id] = position;
    occupied.add(position);
  }
  return positions;
}
function stormOrder(g: Game) {
  g.playerPositions = normalizedPlayerPositions(g);
  // A marker already under the storm has been reached; the next occupied
  // marker ahead counterclockwise goes first. Empty circles are skipped.
  const distance = (id: string) =>
    (PLAYER_CIRCLE_SECTORS[g.playerPositions![id] - 1] - g.storm + 18) % 18 ||
    18;
  g.order = g.players
    .map((p) => p.id)
    .sort((a, b) => distance(a) - distance(b));
}
function stormExposed(g: Game, key: string) {
  const t = territory(splitLocation(key).territory);
  return (
    (t.type === 'sand' && t.id !== 'imperial_basin') ||
    (g.shieldWallDestroyed &&
      ['arrakeen', 'carthag', 'imperial_basin'].includes(t.id))
  );
}
function moveStorm(g: Game, n: number) {
  g.stormResolution = { from: g.storm, distance: n, traversed: 0, pending: [] };
  offerChoamStorm(g);
}
function choamStormOptions(g: Game) {
  return choamStormTerritories(g);
}
function currentChoamStormQuote(g: Game) {
  try {
    return quoteChoamStormOffer(g);
  } catch (error) {
    if (error instanceof ChoamStormQuoteError)
      throw new RuleError(error.message);
    throw error;
  }
}
function commitChoamStormOffer(g: Game, quote: ChoamStormQuote) {
  if (quote.kind === 'decision') g.decision = quote.decision;
  else beginStormProtection(g);
}
function offerChoamStorm(g: Game) {
  commitChoamStormOffer(g, currentChoamStormQuote(g));
}
function beginStormProtection(g: Game) {
  const n = g.stormResolution!.distance;
  const fremen = byFaction(g, 'fremen');
  const crossed = new Set(
    Array.from({ length: n }, (_, i) => ((g.storm + i) % 18) + 1),
  );
  if (
    g.advanced &&
    fremen &&
    Object.keys(fremen.forces).some(
      (key) => stormExposed(g, key) && crossed.has(splitLocation(key).sector),
    )
  ) {
    g.response = {
      kind: 'stormProtection',
      owner: fremen.id,
      passed: [],
      resume: 'storm',
    };
  } else continueStorm(g);
}
function stormCasualties(
  g: Game,
  p: Player,
  key: string,
  count: number,
  elite: number,
  resume: 'storm' | 'shipment',
) {
  const amount = Math.ceil(count / 2),
    minElite = Math.max(0, amount - (count - elite)),
    maxElite = Math.min(amount, elite);
  if (minElite < maxElite)
    g.decision = {
      kind: 'stormLosses',
      player: p.id,
      key,
      amount,
      minElite,
      maxElite,
      resume,
    };
  else kill(g, p, key, amount, false, minElite);
}
function continueStorm(g: Game) {
  disasterPreflight(() => validateStormTraversal(g));
  normalizedPlayerPositions(g);
  const resolution = g.stormResolution!;
  const fremen = byFaction(g, 'fremen');
  while (true) {
    while (resolution.pending.length) {
      const key = resolution.pending.shift()!;
      if (fremen && (fremen.forces[key] ?? 0) > 0) {
        stormCasualties(
          g,
          fremen,
          key,
          fremen.forces[key],
          fremen.elites?.forces[key] ?? 0,
          'storm',
        );
        if (g.decision) return;
      }
    }
    if (resolution.traversed === resolution.distance) break;
    resolution.traversed++;
    const s = ((resolution.from - 1 + resolution.traversed) % 18) + 1;
    if (g.shieldWallDestroyed)
      for (const city of ['arrakeen', 'carthag'])
        if (territory(city).sectors.includes(s))
          returnAmbassadorsIn(g, city, 'the storm crossed the exposed city');
    for (const p of g.players) {
      const marker = p.noField?.deployed?.location;
      if (marker && marker.sector === s) {
        const t = territory(marker.territory);
        if (
          (t.type === 'sand' && t.id !== 'imperial_basin') ||
          (g.shieldWallDestroyed &&
            ['arrakeen', 'carthag', 'imperial_basin'].includes(t.id))
        )
          revealPlayerNoField(g, p, 'storm');
      }
      for (const key of Object.keys(p.forces)) {
        const loc = splitLocation(key),
          t = territory(loc.territory);
        const exposed =
          (t.type === 'sand' && t.id !== 'imperial_basin') ||
          (g.shieldWallDestroyed &&
            ['arrakeen', 'carthag', 'imperial_basin'].includes(t.id));
        if (loc.sector === s && exposed) {
          if (
            p.faction === 'choam' &&
            resolution.choamProtected?.includes(t.id)
          )
            continue;
          if (
            g.advanced &&
            p.faction === 'fremen' &&
            resolution.protected !== false
          )
            resolution.pending.push(key);
          else kill(g, p, key, p.forces[key]);
        }
      }
    }
    for (const key of Object.keys(g.spice))
      if (splitLocation(key).sector === s) delete g.spice[key];
  }
  g.storm = ((resolution.from - 1 + resolution.distance) % 18) + 1;
  stormOrder(g);
  if (g.turn === 1) assignRemainingTech(g);
  log(g, `Storm moved ${resolution.distance} sectors to sector ${g.storm}.`);
  g.stormDials = {};
  g.stormPending = null;
  g.stormResolution = null;
  const ixians = byFaction(g, 'ixians');
  if (ixians && g.mobileStronghold && !g.mobileStronghold.location) {
    g.decision = {
      kind: 'mobileStronghold',
      player: ixians.id,
      placement: true,
    };
    return;
  }
  finishStorm(g);
}
function finishStorm(g: Game) {
  if (!openChoamMarket(g, 'storm')) advanceAfterStorm(g);
}
function advanceAfterStorm(g: Game) {
  const fremen = byFaction(g, 'fremen');
  g.phase = 1;
  g.ready = [];
  if (g.advanced && fremen) {
    g.stormCard = shuffle([1, 2, 3, 4, 5, 6])[0];
    g.stormCardKnown = false;
    g.response = { kind: 'stormPeek', owner: fremen.id, passed: [] };
  }
  openPhase(g, false);
}
function refillSpice(g: Game) {
  if (!g.spiceDeck.length) {
    g.spiceDeck = shuffle(
      g.spiceDiscard
        .flat()
        .filter((c) => !('worm' in c && c.thumper))
        .map((c) => ('worm' in c ? { worm: true as const } : c)),
    );
    g.spiceDiscard = [[], []];
  }
}
function drawSpice(g: Game) {
  refillSpice(g);
  return g.spiceDeck.shift();
}
function devour(
  g: Game,
  t: string,
  protectedAlly?: string,
  protectFremen = true,
) {
  disasterPreflight(() =>
    validateWormDevouring(g, t, protectedAlly, protectFremen),
  );
  for (const p of g.players)
    if ((!protectFremen || p.faction !== 'fremen') && p.id !== protectedAlly)
      killTerritory(g, p, t, Infinity, false, 'worm');
  for (const k of Object.keys(g.spice))
    if (splitLocation(k).territory === t) delete g.spice[k];
  const fremen = byFaction(g, 'fremen');
  if (fremen && at(fremen, t)) g.wormRides.push(t);
  log(g, `Shai-Hulud appeared in ${territory(t).name}.`);
}
function beginWorm(g: Game, t: string) {
  const fremen = byFaction(g, 'fremen');
  if (fremen?.ally && at(getPlayer(g, fremen.ally), t)) {
    g.decision = {
      kind: 'wormProtection',
      player: fremen.id,
      territory: t,
      ally: fremen.ally,
    };
  } else wormSurvival(g, t);
}
function wormSurvival(g: Game, t: string, protectedAlly?: string) {
  const fremen = byFaction(g, 'fremen');
  if (fremen && at(fremen, t)) {
    g.response = {
      kind: 'wormSurvival',
      owner: fremen.id,
      location: t,
      recipient: protectedAlly,
      passed: [],
    };
  } else {
    devour(g, t, protectedAlly);
    afterWorm(g);
  }
}
function afterWorm(g: Game) {
  const pending = g.summonedWorm;
  if (!pending) {
    continueSpice(g);
    return;
  }
  const rides = g.wormRides;
  Object.assign(g, pending.resume);
  g.summonedWorm = null;
  g.wormRides = [...g.wormRides, ...rides];
  markNexusOccurred(g);
  g.ready = [];
  if (g.spiceWindow?.territory === pending.territory) {
    g.spiceWindow.harvested = true;
    g.spiceWindow.harvesterClosed = true;
  }
  const beforeBlow =
    !g.spiceSequence &&
    !g.spiceResolution &&
    !g.spiceWindow &&
    !pending.resume.nexus;
  if (beforeBlow) {
    g.summonedBeforeBlow = true;
    g.nexus = false;
  } else g.nexus = true;
  // A summon during an already active ride returns that unmade ride to the
  // queue and opens negotiations before it. An intrusion already caused by a
  // completed ride resolves before opening the newly triggered Nexus.
  if (g.decision?.kind === 'wormRide') {
    g.wormRides.unshift(g.decision.territory);
    g.decision = null;
  } else if (
    g.pendingAmbassador?.resume === 'wormRide' ||
    g.pendingTerrorEntry?.resume === 'wormRide' ||
    (g.pendingKarama?.use.kind === 'cancel' &&
      g.pendingKarama.use.response.kind === 'advisorFlip' &&
      g.pendingKarama.use.response.advisorResume === 'wormRide') ||
    (g.decision?.kind === 'intrusion' && g.decision.wormRide) ||
    (g.response?.kind === 'advisorFlip' &&
      g.response.advisorResume === 'wormRide')
  )
    g.summonedNexusBeforeRides = true;
  log(
    g,
    'The summoned worm has resolved. Its Nexus occurs after the spice blow.',
  );
}
function blowSpice(g: Game, thumper = false) {
  g.nexus = !!g.summonedBeforeBlow;
  if (!g.summonedBeforeBlow) g.wormRides = [];
  g.summonedBeforeBlow = false;
  g.spiceResolution = { skipped: [] };
  g.spiceSequence = { pile: 0, skipped: [] };
  continueSpice(g, thumper ? { worm: true, thumper: true } : undefined);
}
function continueSpice(g: Game, injected?: SpiceCard) {
  g.spiceSequence ??= {
    pile: 0,
    skipped: [...(g.spiceResolution?.skipped ?? [])],
  };
  const sequence = g.spiceSequence;
  let previous = g.spiceDiscard[sequence.pile].findLast(
    (c) => !('sandtrout' in c) && !('worm' in c && c.suppressed),
  );
  let doubleNext = false;
  let card = injected ?? drawSpice(g);
  while (card && !('territory' in card)) {
    if ('sandtrout' in card) {
      g.sandtrout = true;
      for (const p of g.players) p.ally = null;
      for (const [donor, credit] of Object.entries(g.aid))
        getPlayer(g, donor).spice += credit.amount;
      g.aid = {};
      g.allianceOffers = {};
      log(
        g,
        'Sandtrout broke all alliances and waits for the next Shai-Hulud.',
      );
      doubleNext = false;
      card = drawSpice(g);
      continue;
    }
    doubleNext = false;
    if (g.turn === 1) {
      if (!card.thumper) sequence.skipped.push(card);
    } else if (g.sandtrout) {
      g.sandtrout = false;
      g.spiceDiscard[sequence.pile].push(
        { sandtrout: true },
        { ...card, suppressed: true },
      );
      doubleNext = true;
      log(
        g,
        'Sandtrout suppressed Shai-Hulud. Only an immediate territory replacement receives double spice.',
      );
    } else {
      g.nexus = true;
      markNexusOccurred(g);
      g.spiceDiscard[sequence.pile].push(card);
      if (previous && 'worm' in previous && g.advanced) {
        const fremen = byFaction(g, 'fremen');
        if (fremen && g.wormPlacementCanceledTurn !== g.turn) {
          g.decision = { kind: 'wormPlacement', player: fremen.id };
          return;
        }
      }
      if (previous && 'territory' in previous) {
        beginWorm(g, previous.territory);
        return;
      }
      previous = card;
    }
    card = drawSpice(g);
  }
  if (card && 'territory' in card) {
    g.spiceDiscard[sequence.pile].push(card);
    const amount = card.amount * (doubleNext ? 2 : 1);
    g.spiceWindow = { ...card, amount, harvested: false };
    if (card.sector !== g.storm) {
      const k = location(card.territory, card.sector);
      g.spice[k] = (g.spice[k] ?? 0) + amount;
      log(g, `${amount} spice appeared in ${territory(card.territory).name}.`);
    } else log(g, 'The spice blow was lost to the storm.');
  }
  g.spiceResolution = null;
  g.ready = [];
  if (g.spiceWindow) return;
  finishSpiceWindow(g);
}
function finishSpiceWindow(g: Game) {
  g.spiceWindow = null;
  if (g.nexus) {
    g.ready = [];
    log(g, 'Nexus: alliances may be formed or broken.');
  } else finishSpicePass(g);
}
function finishSpicePass(g: Game) {
  if (g.advanced && g.spiceSequence?.pile === 0) {
    g.spiceSequence.pile = 1;
    g.spiceResolution = { skipped: [] };
    g.ready = [];
    continueSpice(g);
  } else {
    if (g.spiceSequence?.skipped.length)
      g.spiceDeck = shuffle([...g.spiceDeck, ...g.spiceSequence.skipped]);
    g.spiceSequence = null;
    nextPhase(g);
  }
}
function nextWormRide(g: Game) {
  if (g.summonedNexusBeforeRides) {
    g.summonedNexusBeforeRides = false;
    g.nexus = true;
    g.ready = [];
    return;
  }
  const fremen = byFaction(g, 'fremen');
  while (g.wormRides.length) {
    const t = g.wormRides.shift()!;
    if (
      fremen &&
      Object.entries(fremen.forces).some(
        ([key, count]) =>
          count > 0 &&
          splitLocation(key).territory === t &&
          splitLocation(key).sector !== g.storm,
      )
    ) {
      g.decision = { kind: 'wormRide', player: fremen.id, territory: t };
      return;
    }
  }
  g.nexus = false;
  finishSpicePass(g);
}
function auctionEligible(g: Game) {
  return g.order.filter(
    (id) => getPlayer(g, id).hand.length < handLimit(getPlayer(g, id)),
  );
}
function richeseDecision(
  g: Game,
  kind:
    | 'richeseBlackMarket'
    | 'richeseDeclaration'
    | 'richeseCache'
    | 'richeseUnbid',
) {
  const round = g.richeseBidding!;
  round.event = crypto.randomUUID();
  g.decision = { kind, player: round.owner };
  g.active = round.owner;
}
function beginRicheseBidding(g: Game) {
  const owner = byFaction(g, 'richese')!;
  requireRule(
    g.richeseCache,
    'This saved Richese game needs its verified cache inventory.',
  );
  g.richeseBidding = {
    owner: owner.id,
    event: '',
    turn: g.turn,
    stage: g.advanced && owner.hand.length ? 'blackMarketOffer' : 'declaration',
    position: null,
    normalCount: null,
    blackMarketSold: false,
    cacheCanceled: false,
  };
  g.auction = null;
  g.richeseAuction = null;
  g.richeseFunding = {};
  if (g.richeseBidding.stage === 'blackMarketOffer')
    richeseDecision(g, 'richeseBlackMarket');
  else richeseDeclaration(g);
}
function richeseDeclaration(g: Game) {
  richeseDeclarationCache(g);
  const round = g.richeseBidding!;
  round.stage = 'declaration';
  round.normalCount = Math.max(
    0,
    auctionEligible(g).length - 1 - Number(round.blackMarketSold),
  );
  richeseDecision(g, 'richeseDeclaration');
}
function prepareRicheseNormal(g: Game) {
  g.richeseBidding!.stage = 'normal';
  setAuction(g);
}
function offerRicheseCache(g: Game) {
  g.richeseBidding!.stage = 'cacheOffer';
  richeseDecision(g, 'richeseCache');
}
function finishNormalBidding(g: Game) {
  const round = g.richeseBidding;
  if (round?.turn === g.turn && round.stage === 'normal') {
    if (round.position === 'last' && !round.cacheCanceled) {
      offerRicheseCache(g);
      return;
    }
    round.stage = 'complete';
  }
  nextPhase(g);
}
function richeseLotCard(g: Game): Card | undefined {
  const lot = g.richeseAuction;
  if (!lot) return undefined;
  const cards =
    lot.source === 'cache' ? g.richeseCache : getPlayer(g, lot.owner).hand;
  return cards?.find((card) => card.id === lot.cardId);
}
function richeseDeclarationCache(g: Game) {
  try {
    requireRicheseDeclarationCache(g.richeseCache?.length);
  } catch (error) {
    if (error instanceof RicheseSettlementError)
      throw new RuleError(error.message);
    throw error;
  }
}
function richeseSettlementQuote(
  g: Game,
  lot = g.richeseAuction!,
  spendingOwner?: string,
) {
  const owner = getPlayer(g, lot.owner);
  const winner =
    lot.outcome?.kind === 'sold' ? getPlayer(g, lot.outcome.winner) : null;
  const seat = (p: Player) => ({
    id: p.id,
    handCount: p.hand.length - Number(p.id === spendingOwner),
    handLimit: handLimit(p),
  });
  try {
    return quoteRicheseSettlement({
      lot,
      owner: seat(owner),
      winner: winner ? { ...seat(winner), spice: winner.spice } : null,
      card: richeseLotCard(g),
      funding: winner ? g.richeseFunding?.[winner.id] : null,
      allyCredit: winner ? aidFor(g, winner) : null,
    });
  } catch (error) {
    if (error instanceof RicheseSettlementError)
      throw new RuleError(error.message);
    throw error;
  }
}
function finishRicheseLot(g: Game) {
  const lot = g.richeseAuction!;
  const round = g.richeseBidding!;
  if (lot.source === 'blackMarket') {
    richeseDeclarationCache(g);
    round.blackMarketSold = lot.outcome?.kind === 'sold';
    if (lot.method === 'normal') {
      const opener = lot.order[0];
      round.opener = (g.order.indexOf(opener) + 1) % g.order.length;
    }
  }
  g.richeseAuction = null;
  g.richeseFunding = {};
  g.richesePeekKnown = false;
  g.richeseClaim = null;
  g.richeseOfferedCard = null;
  g.currentAuctionSale = null;
  if (lot.source === 'blackMarket') richeseDeclaration(g);
  else if (round.position === 'first') prepareRicheseNormal(g);
  else {
    round.stage = 'complete';
    nextPhase(g);
  }
}
function settleRicheseLot(g: Game) {
  const lot = g.richeseAuction!;
  const quote = richeseSettlementQuote(g);
  if (quote.kind === 'open') return;
  const owner = getPlayer(g, lot.owner);
  if (quote.kind !== 'sold') {
    g.richeseFunding = {};
    if (quote.kind === 'retainBlackMarket') {
      log(
        g,
        `${owner.name} retained the unbid Black Market card. No sale occurred, so it does not reduce the normal auction pool.`,
      );
      finishRicheseLot(g);
    } else if (quote.kind === 'removeCache') {
      const card = quote.card;
      g.richeseCache = g.richeseCache!.filter((c) => c.id !== card.id);
      (g.richeseRemoved ??= []).push(card);
      log(
        g,
        `${owner.name} removed ${card.name} from the game after no spice was bid; a full hand prevents keeping it.`,
        { faction: 'richese', name: 'Unbid cache card' },
      );
      finishRicheseLot(g);
    } else richeseDecision(g, 'richeseUnbid');
    return;
  }
  const winner = getPlayer(g, quote.winner),
    card = quote.card;
  payWithAlly(g, winner, quote.amount, quote.allyPayment);
  g.richeseFunding = {};
  if (lot.source === 'cache')
    g.richeseCache = g.richeseCache!.filter((c) => c.id !== card.id);
  else owner.hand = owner.hand.filter((c) => c.id !== card.id);
  winner.hand.push(card);
  g.currentAuctionSale = {
    winner: winner.id,
    amount: quote.amount,
    free: false,
    origin: lot.source,
    seller: owner.id,
  };
  log(
    g,
    `${winner.name} bought ${lot.source === 'cache' ? card.name : 'the concealed Black Market card'} for ${quote.amount} spice. The funded bid was paid automatically.`,
    { faction: winner.faction, name: 'Auction payment' },
  );
  const ixians = byFaction(g, 'ixians');
  if (lot.source === 'blackMarket' && ixians && winner.ally === ixians.id) {
    g.pendingIxAlly = { player: winner.id, card: card.id, free: false };
    g.decision = { kind: 'ixAllyCard', player: winner.id };
  } else continueAuctionSale(g, false);
}
function richeseOfferBlock(g: Game): string | null {
  const ixians = byFaction(g, 'ixians');
  return g.advanced && ixians?.hand.length && g.ixTechnologyTurn !== g.turn
    ? 'Ixian Technology on Richese lots is awaiting a ruling on replacement-card custody.'
    : null;
}
function beginRicheseLot(
  g: Game,
  source: 'cache' | 'blackMarket',
  action: Action,
) {
  const round = g.richeseBidding!,
    owner = getPlayer(g, round.owner);
  const card = (source === 'cache' ? g.richeseCache : owner.hand)?.find(
    (c) => c.id === action.card,
  );
  requireRule(card, 'Choose an available card from the correct collection.');
  requireRule(
    typeof action.method === 'string' &&
      ['normal', 'onceAround', 'silent'].includes(action.method),
    'Choose an auction method.',
  );
  requireRule(
    source !== 'cache' || action.method !== 'normal',
    'A Richese cache lot uses Once Around or Silent.',
  );
  requireRule(
    action.direction === undefined ||
      (typeof action.direction === 'string' &&
        ['clockwise', 'counterclockwise'].includes(action.direction)),
    'Choose a physical bidding direction.',
  );
  requireRule(
    action.method !== 'onceAround' || action.direction !== undefined,
    'Choose a physical bidding direction.',
  );
  const blocked = richeseOfferBlock(g);
  requireRule(!blocked, blocked ?? 'This Richese lot is unavailable.');
  const positions = normalizedPlayerPositions(g);
  let order = [...g.order];
  if (action.method === 'onceAround') {
    order.sort((a, b) => positions[a] - positions[b]);
    if (action.direction === 'clockwise') order.reverse();
    const at = order.indexOf(owner.id);
    order = [...order.slice(at + 1), ...order.slice(0, at + 1)];
  }
  const lot = createRicheseAuction({
    event: crypto.randomUUID(),
    cardId: card.id,
    source,
    owner: owner.id,
    method: action.method as RicheseAuction['method'],
    eligible: auctionEligible(g),
    order,
    tieOrder: g.order,
  });
  g.richeseAuction = lot;
  g.richeseOfferedCard = structuredClone(card);
  g.richeseFunding = {};
  g.richesePeekKnown = false;
  g.richeseClaim =
    source === 'blackMarket' && typeof action.claim === 'string'
      ? action.claim.trim().slice(0, 300)
      : null;
  round.stage = 'lot';
  g.active = lot.active;
  log(
    g,
    source === 'cache'
      ? `${owner.name} revealed ${card.name} for a ${lot.method === 'silent' ? 'Silent' : 'Once Around'} cache auction.`
      : `${owner.name} offered a concealed hand card on the Black Market using ${lot.method === 'normal' ? 'normal bidding' : lot.method === 'silent' ? 'Silent bidding' : 'Once Around bidding'}.${g.richeseClaim ? ` Seller’s unverified claim: “${g.richeseClaim}”` : ''}`,
  );
  if (source === 'blackMarket')
    g.response = { kind: 'richeseBlackMarket', owner: owner.id, passed: [] };
  else settleRicheseLot(g);
}
function decideRichese(g: Game, p: Player, decision: Decision, action: Action) {
  const round = g.richeseBidding;
  requireRule(
    g.phase === 3 &&
      round &&
      round.owner === p.id &&
      action.event === round.event,
    'This Richese bidding decision has expired.',
  );
  if (decision.kind === 'richeseBlackMarket') {
    requireRule(
      round.stage === 'blackMarketOffer' && g.advanced,
      'Black Market is not available now.',
    );
    if (action.decline === true) richeseDeclaration(g);
    else beginRicheseLot(g, 'blackMarket', action);
  } else if (decision.kind === 'richeseDeclaration') {
    requireRule(
      round.stage === 'declaration' &&
        typeof action.position === 'string' &&
        ['first', 'last'].includes(action.position),
      'Announce whether the cache auction will be first or last.',
    );
    round.position = action.position as 'first' | 'last';
    log(
      g,
      `${p.name} announced the Richese cache auction ${round.position}, before normal pool preparation. ${round.normalCount} normal lots are scheduled after the cache reduction${round.blackMarketSold ? ' and completed Black Market sale' : ''}.`,
    );
    g.response = { kind: 'richeseAuction', owner: p.id, passed: [] };
  } else if (decision.kind === 'richeseCache') {
    requireRule(
      round.stage === 'cacheOffer',
      'The cache offer is not available now.',
    );
    beginRicheseLot(g, 'cache', action);
  } else if (decision.kind === 'richeseUnbid') {
    requireRule(
      g.richeseAuction?.source === 'cache' &&
        g.richeseAuction.outcome?.kind === 'unbid',
      'There is no unbid cache card to resolve.',
    );
    requireRule(
      typeof action.keep === 'boolean',
      'Keep the card or remove it from the game.',
    );
    const card = richeseLotCard(g)!;
    requireRule(
      !action.keep || p.hand.length < handLimit(p),
      'There is no room in your hand.',
    );
    g.richeseCache = g.richeseCache!.filter((c) => c.id !== card.id);
    if (action.keep) p.hand.push(card);
    else (g.richeseRemoved ??= []).push(card);
    log(
      g,
      `${p.name} ${action.keep ? 'kept' : 'permanently removed'} ${card.name} after all bids were zero. No purchase bonus applies.`,
    );
    finishRicheseLot(g);
  }
}
function setAuction(g: Game, cards?: Card[]) {
  const richese = byFaction(g, 'richese');
  if (!cards && richese && g.richeseBidding?.turn !== g.turn) {
    beginRicheseBidding(g);
    return;
  }
  const eligible = g.order.filter((id) => {
    const p = getPlayer(g, id);
    return p.hand.length < handLimit(p);
  });
  if (!eligible.length) {
    if (cards?.length) g.deck = [...cards, ...g.deck];
    g.auction = null;
    finishNormalBidding(g);
    return;
  }
  const count =
    g.richeseBidding?.turn === g.turn
      ? (g.richeseBidding.normalCount ?? eligible.length)
      : eligible.length;
  const ixians = byFaction(g, 'ixians');
  if (!cards && ixians && eligible.length && count) {
    g.auction = null;
    g.active = null;
    g.ixAuction = { count, cards: [] };
    g.ixAuctionKnown = null;
    g.response = { kind: 'ixAuction', owner: ixians.id, passed: [] };
    return;
  }
  if (!cards) {
    cards = [];
    for (let i = 0; i < count; i++) {
      const c = draw(g);
      if (c) cards.push(c);
    }
  }
  if (!eligible.length || !cards.length) {
    g.auction = null;
    finishNormalBidding(g);
    return;
  }
  const start = g.richeseBidding?.opener ?? 0;
  const opener = [...g.order.slice(start), ...g.order.slice(0, start)].find(
    (id) => eligible.includes(id),
  )!;
  g.auction = {
    cards,
    index: 0,
    bid: 0,
    bidder: null,
    active: opener,
    passed: [],
    opener: g.order.indexOf(opener),
  };
  g.active = opener;
  offerAuctionTechnology(g);
}
function offerAuctionTechnology(g: Game) {
  g.auction!.peekKnown = false;
  const ixians = byFaction(g, 'ixians');
  if (
    g.advanced &&
    ixians &&
    ixians.hand.length &&
    g.ixTechnologyTurn !== g.turn
  )
    g.decision = { kind: 'ixTechnology', player: ixians.id };
  else offerAuctionPeek(g);
}
function auctionTechnologyQuote<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof IxTechnologyCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function offerAuctionPeek(g: Game) {
  const quote = auctionTechnologyQuote(() => quoteNormalAuctionPeek(g));
  g.auction!.peekKnown = quote.peekKnown;
  g.response = quote.response;
}
function aidFor(g: Game, p: Player) {
  return p.ally && g.aid[p.ally]?.recipient === p.id
    ? g.aid[p.ally]
    : undefined;
}
function battleAidFor(g: Game, p: Player) {
  const donor = p.ally
    ? g.players.find((other) => other.id === p.ally)
    : undefined;
  return g.advanced &&
    g.phase === 6 &&
    donor?.faction === 'choam' &&
    donor.ally === p.id &&
    !g.battle?.choamAidBlocked
    ? aidFor(g, p)
    : undefined;
}
function strongholdEffect(g: Game, player: string): StrongholdId | null {
  return g.advanced && g.battle
    ? strongholdBenefit(
        g.strongholdCards,
        player,
        g.battle.territory,
        g.battle.strongholdCopy,
      )
    : null;
}
function battleSupportCost(g: Game, p: Player, support: number) {
  return strongholdSupportCost(strongholdEffect(g, p.id), support);
}
function battleSupportBudget(g: Game, p: Player) {
  return (
    p.spice +
    (battleAidFor(g, p)?.amount ?? 0) +
    (strongholdEffect(g, p.id) === 'arrakeen' ? 2 : 0)
  );
}
function battleTieWinner(g: Game) {
  const b = g.battle!;
  return strongholdEffect(g, b.defender) === 'habbanya_ridge_sietch'
    ? b.defender
    : b.attacker;
}
function strongholdCopyChoices(g: Game, player: string): StrongholdId[] {
  const controllers = strongholdControllers(
    g.players,
    !!g.mobileStronghold?.location,
  );
  return STRONGHOLD_CARDS.filter(
    (card) => card.id !== MOBILE_STRONGHOLD && controllers[card.id] === player,
  ).map((card) => card.id);
}
function beginBattlePowers(g: Game) {
  const b = g.battle!;
  const choam = byFaction(g, 'choam');
  if (
    g.advanced &&
    choam?.ally &&
    [b.attacker, b.defender].includes(choam.ally) &&
    getPlayer(g, choam.ally).ally === choam.id
  )
    g.decision = { kind: 'choamBattleFunding', player: choam.id };
  else {
    battlePreparation(g, 'voice');
    combatResponses(g);
  }
}
function beginStrongholdBattle(g: Game) {
  const b = g.battle!;
  const owner = g.strongholdCards?.owners.hidden_mobile_stronghold;
  if (
    g.advanced &&
    b.territory === MOBILE_STRONGHOLD &&
    owner &&
    [b.attacker, b.defender].includes(owner)
  ) {
    const choices = strongholdCopyChoices(g, owner);
    if (choices.length > 1) {
      g.decision = {
        kind: 'strongholdCopy',
        player: owner,
        event: b.event!,
        choices,
      };
      return;
    }
    if (choices.length === 1) {
      b.strongholdCopy = choices[0];
      log(
        g,
        `${getPlayer(g, owner).name}'s mobile Stronghold Card copies ${STRONGHOLD_CARDS.find((card) => card.id === choices[0])!.name}, their only other controlled stronghold.`,
        { faction: getPlayer(g, owner).faction, name: 'Stronghold advantage' },
      );
    }
  }
  beginBattlePowers(g);
}
function strongholdIntegrity(g: Game) {
  if (!g.strongholdCards) {
    requireRule(
      !g.battle?.strongholdCopy && g.decision?.kind !== 'strongholdCopy',
      'A copied Stronghold advantage requires its module.',
    );
    return;
  }
  const state = g.strongholdCards;
  requireRule(
    g.advanced &&
      Number.isSafeInteger(state.claimedTurn) &&
      state.claimedTurn >= 0 &&
      state.claimedTurn <= g.turn &&
      !!state.owners &&
      Object.keys(state.owners).length === STRONGHOLD_CARDS.length &&
      STRONGHOLD_CARDS.every(
        (card) =>
          state.owners[card.id] === null ||
          g.players.some((p) => p.id === state.owners[card.id]),
      ),
    'The saved Advanced Stronghold Card ownership is invalid.',
  );
  if (g.decision?.kind === 'strongholdCopy') {
    const decision = g.decision,
      b = g.battle;
    const choices = strongholdCopyChoices(g, decision.player);
    requireRule(
      g.status === 'playing' &&
        g.phase === 6 &&
        !!b &&
        b.territory === MOBILE_STRONGHOLD &&
        decision.event === b.event &&
        state.owners.hidden_mobile_stronghold === decision.player &&
        [b.attacker, b.defender].includes(decision.player) &&
        !b.strongholdCopy &&
        Object.keys(b.plans).length === 0 &&
        Array.isArray(decision.choices) &&
        choices.length > 1 &&
        decision.choices.length === choices.length &&
        new Set(decision.choices).size === choices.length &&
        choices.every((choice) => decision.choices.includes(choice)),
      'The saved Stronghold choice must match this battle and current control.',
    );
  }
  if (g.battle?.strongholdCopy) {
    const b = g.battle,
      owner = state.owners.hidden_mobile_stronghold;
    requireRule(
      !!b.event &&
        b.territory === MOBILE_STRONGHOLD &&
        !!owner &&
        [b.attacker, b.defender].includes(owner) &&
        b.strongholdCopy !== MOBILE_STRONGHOLD &&
        STRONGHOLD_CARDS.some((card) => card.id === b.strongholdCopy),
      'The saved copied Stronghold advantage does not belong to this battle.',
    );
  }
}
function settleStrongholdOwnership(g: Game, quoted?: StrongholdState) {
  if (!g.strongholdCards || g.strongholdCards.claimedTurn === g.turn) return;
  requireRule(
    g.advanced && g.phase === 8,
    'Stronghold Cards settle at the end of an Advanced turn.',
  );
  settleAdvisors(g);
  const before = g.strongholdCards;
  g.strongholdCards =
    quoted ??
    settleStrongholdCards(
      before,
      g.turn,
      strongholdControllers(g.players, !!g.mobileStronghold?.location),
    );
  for (const card of STRONGHOLD_CARDS) {
    const owner = g.strongholdCards.owners[card.id];
    if (owner === before.owners[card.id]) continue;
    log(
      g,
      owner
        ? `${getPlayer(g, owner).name} claimed the ${card.name} Stronghold Card for the next turn.`
        : `${card.name} has no controlling faction; its Stronghold Card was set aside.`,
      owner
        ? { faction: getPlayer(g, owner).faction, name: 'Stronghold control' }
        : undefined,
    );
  }
}
function pledgeAid(g: Game, p: Player, requested: unknown) {
  requireRule(
    p.ally && getPlayer(g, p.ally).ally === p.id,
    'Choose a current mutual ally.',
  );
  const current = g.aid[p.id]?.amount ?? 0;
  requireRule(
    !(
      g.richeseAuction?.method === 'silent' &&
      !g.richeseAuction.outcome &&
      Object.hasOwn(g.richeseAuction.sealed, p.ally) &&
      typeof requested === 'number' &&
      requested < current
    ),
    'Ally funding cannot be reduced until the submitted Silent bids are revealed.',
  );
  const committed =
    g.pendingHomeworldShipment?.player === p.ally
      ? g.pendingHomeworldShipment.allyPayment
      : g.phase === 6
      ? (g.battle?.plans[p.ally]?.allyPayment ?? 0)
      : g.auction?.bidder === p.ally
        ? (g.auction.allyPayment ?? 0)
        : 0;
  const amount = integer(
    requested,
    g.richeseAuction?.method === 'silent' &&
      !g.richeseAuction.outcome &&
      Object.hasOwn(g.richeseAuction.sealed, p.ally)
      ? current
      : Math.max(
          committed,
          richeseAllyCommitment(g.richeseAuction, g.richeseFunding ?? {}, p.id),
        ),
    uncommittedSpice(g, p) + current,
    'Ally funding',
  );
  p.spice += current - amount;
  g.aid[p.id] = { recipient: p.ally, amount };
  log(g, `${p.name} updated the spice available to their ally this phase.`);
}
function uncommittedSpice(g: Game, p: Player) {
  return (
    p.spice -
    richeseOwnCommitment(g.richeseAuction, g.richeseFunding ?? {}, p.id) -
    (g.auction?.bidder === p.id
      ? g.auction.bid - (g.auction.allyPayment ?? 0)
      : 0) -
    (battleSupportCost(g, p, g.battle?.plans[p.id]?.support ?? 0) -
      (g.battle?.plans[p.id]?.allyPayment ?? 0)) -
    (g.pendingHomeworldShipment?.player === p.id
      ? g.pendingHomeworldShipment.cost - g.pendingHomeworldShipment.allyPayment : 0)
  );
}
function contribution(g: Game, p: Player, cost: number, requested?: unknown) {
  const available = aidFor(g, p)?.amount ?? 0;
  const { minimum, maximum } = shipmentPaymentBounds(cost, p.spice, available);
  return integer(requested ?? minimum, minimum, maximum, 'Ally payment');
}
function payWithAlly(g: Game, p: Player, cost: number, allyPayment: number) {
  const credit = aidFor(g, p);
  requireRule(
    p.spice >= cost - allyPayment &&
      (!allyPayment || (credit && credit.amount >= allyPayment)),
    'The payment is no longer funded.',
  );
  p.spice -= cost - allyPayment;
  if (credit) credit.amount -= allyPayment;
}
function auctionNext(g: Game) {
  const a = g.auction!;
  const eligible = g.order.filter((id) => {
    const p = getPlayer(g, id);
    return p.hand.length < handLimit(p);
  });
  const others = eligible.filter((id) => id !== a.bidder);
  if (others.every((id) => a.passed.includes(id))) {
    if (!a.bidder) {
      g.deck = [...a.cards.slice(a.index), ...g.deck];
      g.auction = null;
      finishNormalBidding(g);
      return;
    }
    g.decision = { kind: 'auctionPayment', player: a.bidder };
    g.active = a.bidder;
    recoverAuctionPayment(g, getPlayer(g, a.bidder));
    return;
  }
  let i = g.order.indexOf(a.active);
  do {
    i = (i + 1) % g.order.length;
  } while (!eligible.includes(g.order[i]) || g.order[i] === a.bidder);
  a.active = g.order[i];
  g.active = a.active;
}
function settleAuction(g: Game, free = false, automatic = false) {
  const a = g.auction!;
  const winner = getPlayer(g, a.bidder!);
  if (!free) payWithAlly(g, winner, a.bid, a.allyPayment ?? 0);
  winner.hand.push(a.cards[a.index]);
  g.currentAuctionSale = {
    winner: winner.id,
    amount: a.bid,
    free,
    origin: 'normal',
    seller: null,
  };
  log(
    g,
    `${faction(winner.faction).name} won a treachery card for ${free ? 'a Karama' : `${a.bid} spice`}.${automatic ? ' The declared spice payment was the only available payment method.' : ''}`,
    automatic
      ? { faction: winner.faction, name: 'Auction payment' }
      : undefined,
  );
  const ixians = byFaction(g, 'ixians');
  if (ixians && winner.ally === ixians.id) {
    g.pendingIxAlly = { player: winner.id, card: a.cards[a.index].id, free };
    g.decision = { kind: 'ixAllyCard', player: winner.id };
  } else continueAuctionSale(g, free);
}
function currentAuctionContinuationQuote(
  g: Game,
  operation: AuctionContinuationOperation,
  spending?: { player: string; card: string },
) {
  try {
    return quoteAuctionContinuation(
      {
        status: g.status,
        phase: g.phase,
        turn: g.turn,
        advanced: g.advanced,
        order: g.order,
        players: g.players.map((p) => ({
          id: p.id,
          faction: p.faction,
          ally: p.ally,
          spice: p.spice,
          hand: p.hand,
          handLimit: handLimit(p),
        })),
        auction: g.auction,
        sale: g.currentAuctionSale,
        physicalCards: physicalTreacheryCards(g),
        pendingIxAlly: g.pendingIxAlly,
        ixTechnologyTurn: g.ixTechnologyTurn,
        richeseAuction: g.richeseAuction,
        richeseBidding: g.richeseBidding,
        richeseCacheCount: g.richeseCache?.length,
      },
      operation,
      spending,
    );
  } catch (error) {
    if (error instanceof AuctionContinuationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function validateAuctionContinuationCancellation(
  g: Game,
  response: ResponseWindow,
  spending?: { player: string; card: string },
) {
  if (response.source === 'ambassador') {
    validateAmbassadorPurchaseResponse(g, response);
    return null;
  }
  if (['ixAllyCard', 'emperorIncome', 'harkonnenBonus'].includes(response.kind))
    return currentAuctionContinuationQuote(
      g,
      { kind: 'cancel', response },
      spending,
    );
  return null;
}
function commitAuctionContinuation(g: Game, quote: AuctionContinuationQuote) {
  for (const step of quote.steps) {
    if (step.kind === 'clearIxAlly') g.pendingIxAlly = null;
    else {
      const seller = getPlayer(g, step.player);
      seller.spice = step.balance;
      log(
        g,
        `${seller.name} collected ${step.amount} spice from the ${quote.sale.origin === 'cache' ? 'Richese cache' : 'Black Market'} sale.`,
        { faction: 'richese', name: 'Auction income' },
      );
    }
  }
  const next = quote.next;
  if (next.kind === 'response') g.response = next.response;
  else if (next.kind === 'richeseEnd') finishRicheseLot(g);
  else {
    g.currentAuctionSale = null;
    if (next.kind === 'normalEnd') {
      g.deck = [...next.returned, ...g.deck];
      g.auction = null;
      finishNormalBidding(g);
    } else {
      g.auction = next.auction;
      g.active = next.active;
      if (next.offer?.kind === 'ixTechnology') g.decision = next.offer;
      else if (next.offer) g.response = next.offer;
    }
  }
}
function continueAuctionSale(g: Game, free: boolean) {
  commitAuctionContinuation(
    g,
    currentAuctionContinuationQuote(g, { kind: 'sale', free }),
  );
}
function auctionBonus(g: Game) {
  commitAuctionContinuation(
    g,
    currentAuctionContinuationQuote(g, { kind: 'bonus' }),
  );
}
function nextAuction(g: Game) {
  commitAuctionContinuation(
    g,
    currentAuctionContinuationQuote(g, { kind: 'next' }),
  );
}
/** Physical custody only: promise feasibility remains conservatively checked at commit. */
function karamaSpendingBlock(g: Game, p: Player, card: Card): string | null {
  if (g.battle?.lateDefense?.[p.id] === card.id)
    return 'This Portable Snooper is already played and reserved for battle cleanup.';
  if (giftReserved(g, p.id, card.id))
    return 'This card is reserved for the pending Richese gift.';
  if (
    !p.hand.some((held) => held.id === card.id) ||
    !canUseAsKarama(g.advanced, p.faction, card)
  )
    return 'Choose a Karama in your hand.';
  if (retentionReservesCard(g, p.id, card.id))
    return 'A card awaiting Moritani alliance battle cleanup cannot be spent as Karama.';
  const plan = g.battle?.plans[p.id];
  if (plan && [plan.weapon, plan.defense, plan.leader].includes(card.id))
    return 'A sealed battle card cannot be spent as Karama.';
  if (g.battle && committedPlanElements(g.battle, p.id).some(element => element.value === card.id))
    return 'The card committed to prescience must remain available.';
  if (card.kind === 'worthless' && g.pendingKarama)
    return 'A Worthless conversion is already pending.';
  return null;
}
function karamaCard(g: Game, p: Player, id?: unknown) {
  // Explicit selections retain the specific custody error from spendKarama.
  const available = p.hand.filter(
    (c) =>
      canUseAsKarama(g.advanced, p.faction, c) &&
      (id === undefined ? !karamaSpendingBlock(g, p, c) : c.id === id),
  );
  return available.find((c) => c.effect === 'karama') ?? available[0];
}
function responseCancelCards(
  g: Game,
  p: Player,
  response: ResponseWindow,
): string[] {
  if (p.id === response.owner) return [];
  // Do not simulate cancellation here: it can execute RNG and continuations.
  // A physically spendable card whose Truthtrance feasibility is not proven
  // remains a possible choice; the authoritative action still checks promises.
  return p.hand
    .filter((card) => !karamaSpendingBlock(g, p, card))
    .map((card) => card.id);
}
/** The same conversion can be suspended by an independent private interaction. */
function savedKaramaContexts(g: Game) {
  const continuation = g.pendingTreacheryDiscard?.continuation;
  return [
    {
      pendingKarama: g.pendingKarama,
      response: g.pendingExchange?.response ?? g.response,
    },
    g.pendingRicheseGift?.resume,
    g.pendingNullentropy?.resume,
    g.pendingRichesePurchaseIncome?.resume,
    g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null,
  ].flatMap((context) =>
    context?.pendingKarama
      ? [
          {
            pending: context.pendingKarama,
            response: context.response ?? g.pendingExchange?.response,
          },
        ]
      : [],
  );
}
function savedKaramaConversions(g: Game) {
  return savedKaramaContexts(g).map((context) => context.pending);
}
function karamaCanceledSource(g: Game, response: ResponseWindow) {
  try {
    return canceledResponseSource(g, response);
  } catch (error) {
    if (error instanceof KaramaContextError) throw new RuleError(error.message);
    throw error;
  }
}
/** Locate a conversion behind the controls saved before a summoned worm.
 * Only explicit parent links count; unrelated live overlays are not parents. */
function controlsContainKarama(
  g: Game,
  controls:
    | Pick<Game, 'response' | 'decision' | 'pendingKarama'>
    | null
    | undefined,
  pending: NonNullable<Game['pendingKarama']>,
  seen = new Set<object>(),
): boolean {
  if (!controls || seen.has(controls)) return false;
  seen.add(controls);
  if (controls.pendingKarama === pending) return true;
  const parent =
    controls.response?.kind === 'richeseGift'
      ? g.pendingRicheseGift?.resume
      : controls.response?.kind === 'richesePurchaseIncome'
        ? g.pendingRichesePurchaseIncome?.resume
        : controls.decision?.kind === 'nullentropy'
          ? g.pendingNullentropy?.resume
          : controls.decision?.kind === 'handExchange'
            ? g.pendingExchange
            : null;
  return controlsContainKarama(g, parent, pending, seen);
}
function karamaSourceGame(
  g: Game,
  pending: NonNullable<Game['pendingKarama']>,
) {
  const worm = g.summonedWorm;
  return worm && controlsContainKarama(g, worm.resume, pending)
    ? { ...g, ...worm.resume, summonedWorm: null }
    : g;
}
/** Bind the original opportunity, not hands, balances, response passes or seat control. */
function karamaOpportunitySignature(
  g: Game,
  pending: NonNullable<Game['pendingKarama']>,
) {
  g = karamaSourceGame(g, pending);
  const use = pending.use;
  requireRule(
    use &&
      ['cancel', 'shipment', 'purchase', 'auctionPayment'].includes(use.kind),
    'The saved Karama conversion does not match its original opportunity.',
  );
  const opportunity =
    use.kind === 'cancel'
      ? karamaCanceledSource(g, use.response)
      : use.kind === 'shipment'
        ? {
            active: g.active,
            recipient: use.recipient,
            shipped: getPlayer(g, use.recipient).shipped,
            rate: g.karamaShipping ?? null,
            movementRemaining: g.movementRemaining ?? null,
          }
        : {
            auction: g.auction,
            order: g.order,
            richeseAuction: g.richeseAuction ?? null,
            sale: g.currentAuctionSale ?? null,
          };
  return JSON.stringify({
    owner: pending.owner,
    use,
    status: g.status,
    advanced: g.advanced,
    turn: g.turn,
    phase: g.phase,
    opportunity,
  });
}
function karamaConversionIntegrity(g: Game) {
  for (const { pending, response } of savedKaramaContexts(g)) {
    if (pending.opportunity === undefined) continue;
    requireRule(
      pending.opportunity &&
        pending.opportunity.kind ===
          (pending.use?.kind === 'cancel'
            ? 'cancel'
            : pending.use?.kind === 'shipment'
              ? 'shipment'
              : 'auction') &&
        typeof pending.opportunity.signature === 'string' &&
        response?.kind === 'worthlessKarama' &&
        response.owner === pending.owner &&
        g.advanced &&
        getPlayer(g, pending.owner).faction === 'beneGesserit' &&
        pending.opportunity.signature ===
          karamaOpportunitySignature(g, pending),
      'The saved Karama conversion no longer matches its original opportunity.',
    );
    if (pending.opportunity.kind === 'auction')
      normalKaramaAuction(
        g,
        getPlayer(g, pending.owner),
        pending.use.kind === 'auctionPayment',
      );
  }
}
/** Only live ownership zones; knowledge receipts and old auction prefixes are aliases. */
function physicalTreacheryCards(g: Game) {
  return [
    ...g.players.flatMap((player) => player.hand),
    ...g.deck,
    ...g.discard,
    ...(g.richeseCache ?? []),
    ...(g.richeseRemoved ?? []),
    ...(g.ixSetupCards ?? []),
    ...(g.ixAuction?.cards ?? []),
    ...(g.ornithopter ? [g.ornithopter.card] : []),
    ...(g.auction?.cards.slice(g.auction.index) ?? []),
  ];
}
/** Pure normal-lot prerequisites; free payment deliberately does not require spice. */
function normalKaramaAuction(
  g: Game,
  p: Player,
  payment: boolean,
  spendingCard = false,
) {
  const a = g.auction;
  const seated = (id: string) => g.players.some((player) => player.id === id);
  requireRule(
    g.status === 'playing' &&
      g.phase === 3 &&
      a &&
      !g.richeseAuction &&
      !g.currentAuctionSale &&
      Array.isArray(a.cards) &&
      Number.isSafeInteger(a.index) &&
      a.index >= 0 &&
      a.index < a.cards.length &&
      a.cards[a.index]?.id &&
      Number.isSafeInteger(a.bid) &&
      a.bid >= 0 &&
      (a.bidder === null || seated(a.bidder)) &&
      seated(a.active) &&
      g.order.length > 0 &&
      new Set(g.order).size === g.order.length &&
      g.order.every(seated) &&
      Number.isSafeInteger(a.opener) &&
      a.opener >= 0 &&
      a.opener < g.order.length,
    'This Karama purchase needs its original unresolved normal auction lot.',
  );
  requireRule(
    !payment || a.bidder === p.id,
    'Only the original winning bidder may choose the auction payment.',
  );
  requireRule(
    p.hand.length - Number(payment && spendingCard) < handLimit(p),
    'Leave room for the committed Karama auction purchase.',
  );
  const card = a.cards[a.index];
  const zones = physicalTreacheryCards(g);
  requireRule(
    zones.filter((candidate) => candidate.id === card.id).length === 1,
    'The reserved normal auction card has conflicting physical custody.',
  );
}
/** Preflight known pre-effect rejection paths without executing a response or drawing. */
function revivalCancellationQuote(g: Game, response: ResponseWindow) {
  if (
    ![
      'choamRevival',
      'revivalLimit',
      'revivalDiscount',
      'earlyRevival',
      'foreignGhola',
    ].includes(response.kind)
  )
    return null;
  try {
    return quoteRevivalCancellation(g, response);
  } catch (error) {
    if (error instanceof RevivalCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function movementCancellationQuote(g: Game, response: ResponseWindow) {
  try {
    return quoteMovementCancellation(g, response);
  } catch (error) {
    if (error instanceof MovementCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function currentIxAuctionDrawQuote(
  g: Game,
  response: ResponseWindow,
  canceled: boolean,
  spendingCard?: Card,
) {
  try {
    return quoteIxAuctionDraw(
      { ...g, physicalCards: physicalTreacheryCards(g) },
      response,
      canceled,
      spendingCard,
    );
  } catch (error) {
    if (error instanceof IxAuctionDrawError) throw new RuleError(error.message);
    throw error;
  }
}
function ixSubstitutionCancellationQuote(
  g: Game,
  response: ResponseWindow,
  spending?: { player: string; card: string },
) {
  if (response.kind !== 'ixSubstitution') return null;
  try {
    homeworldSubstitutionIntegrity(g);
  homeworldDefenseIntegrity(g);
  homeworldShipmentIntegrity(g);
    const quote = quoteIxSubstitutionCancellation(
      {
        ...g,
        combatLocations: combatLocations(g),
        territories: gameTerritories(g),
        physicalCards: physicalTreacheryCards(g),
      },
      response,
    )!;
    if (!quote.decision) currentBattleAftermathQuote(g, undefined, spending);
    return quote;
  } catch (error) {
    if (error instanceof IxSubstitutionCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function choamSaleCancellationQuote(g: Game, response: ResponseWindow) {
  try {
    return quoteChoamSaleCancellation(g, response);
  } catch (error) {
    if (error instanceof ChoamSaleCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function noFieldCancellationQuote(g: Game, response: ResponseWindow) {
  if (response.kind !== 'richeseNoField') return null;
  try {
    return quoteNoFieldCancellation(g, response);
  } catch (error) {
    if (error instanceof NoFieldCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function terminalCancellationQuote(g: Game, response: ResponseWindow) {
  try {
    return validateTerminalCancellation(g, response);
  } catch (error) {
    if (error instanceof TerminalCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function disasterPreflight(run: () => void) {
  try {
    run();
  } catch (error) {
    if (error instanceof DisasterPreflightError)
      throw new RuleError(error.message);
    throw error;
  }
}
function validateDisasterCancellation(g: Game, response: ResponseWindow) {
  if (response.kind === 'stormProtection') {
    disasterPreflight(() => validateStormCancellation(g, response));
    if (response.resume === 'storm') normalizedPlayerPositions(g);
  } else if (
    ['wormPlacement', 'wormAllyProtection', 'wormSurvival'].includes(
      response.kind,
    )
  )
    disasterPreflight(() => validateWormCancellation(g, response));
}
function validateKaramaUse(
  g: Game,
  p: Player,
  use: KaramaUse,
  spendingCard?: Card,
) {
  if (use.kind === 'cancel') {
    requireRule(
      use.response && use.response.owner !== p.id,
      'Karama cancels another faction’s power.',
    );
    karamaCanceledSource(g, use.response);
    validateAuctionContinuationCancellation(
      g,
      use.response,
      spendingCard ? { player: p.id, card: spendingCard.id } : undefined,
    );
    currentRicheseCancellationQuote(g, use.response);
    auctionTechnologyQuote(() =>
      quoteIxTechnologyCancellation(g, use.response),
    );
    if (use.response.kind === 'ixAuction')
      currentIxAuctionDrawQuote(g, use.response, true, spendingCard);
    moritaniAllianceCancellationQuote(g, use.response);
    if (use.response.kind === 'nexusPrescience') validateNexusInspectionResponse(g, use.response);
    if (use.response.kind === 'nexusAdvisorFlip') validateNexusAdvisorResponse(g, use.response);
    if (use.response.kind === 'nexusSardaukar') validateNexusSardaukarResponse(g, use.response);
    if (isCombatResponseKind(use.response.kind))
      currentCombatResponseQuote(g, {
        kind: 'response',
        response: { kind: use.response.kind, owner: use.response.owner },
        canceled: true,
      });
    requireRule(
      use.response.kind !== 'richeseAuction',
      'The canceled Richese auction count is awaiting an official ruling or an explicit table interpretation.',
    );
    if (
      use.response.kind === 'richeseBlackMarket' ||
      (use.response.kind === 'atreidesAuction' && g.richeseAuction)
    ) {
      const lot = g.richeseAuction,
        round = g.richeseBidding;
      requireRule(
        g.phase === 3 &&
          lot &&
          round &&
          round.turn === g.turn &&
          round.stage === 'lot' &&
          round.owner === lot.owner &&
          (use.response.kind === 'richeseBlackMarket'
            ? lot.source === 'blackMarket' && lot.owner === use.response.owner
            : getPlayer(g, use.response.owner).faction === 'atreides'),
        'This canceled power needs its original Richese auction opportunity.',
      );
      const target =
        use.response.kind === 'richeseBlackMarket'
          ? { ...lot, outcome: { kind: 'unbid' as const } }
          : lot;
      const quote = richeseSettlementQuote(
        g,
        target,
        spendingCard ? p.id : undefined,
      );
      if (lot.source === 'blackMarket' && quote.kind !== 'open')
        richeseDeclarationCache(g);
    }
    validateDisasterCancellation(g, use.response);
    revivalCancellationQuote(g, use.response);
    movementCancellationQuote(g, use.response);
    choamSaleCancellationQuote(g, use.response);
    noFieldCancellationQuote(g, use.response);
    terminalCancellationQuote(g, use.response);
    ixSubstitutionCancellationQuote(
      g,
      use.response,
      spendingCard ? { player: p.id, card: spendingCard.id } : undefined,
    );
    if (use.response.kind === 'harkonnenTraitor') {
      const b = g.battle,
        owner = getPlayer(g, use.response.owner);
      requireRule(
        g.phase === 6 &&
          b?.revealed &&
          owner.faction === 'harkonnen' &&
          ![b.attacker, b.defender].includes(owner.id) &&
          traitorVoters(g, b).includes(owner.id) &&
          b.traitorCalls[owner.id] === true,
        'The canceled allied traitor call needs its original revealed battle.',
      );
      if (traitorVoters(g, b).every((id) => b.traitorCalls[id] !== undefined))
        currentBattleResolutionQuote(g, owner.id);
    }
    if (use.response.kind === 'moritaniRetention')
      validateMoritaniCancellation(g, use.response.owner);
    validateAftermathCancellation(
      g,
      use.response,
      spendingCard ? { player: p.id, card: spendingCard.id } : undefined,
    );
    currentChoamWorthlessCancellationQuote(g, use.response);
    currentPlacementCancellationQuote(g, use.response);
    if (use.response.kind === 'ecazCollection')
      currentEcazCollectionQuote(g, use.response, true);
    // Canceling a Worthless conversion restores its old use; it does not execute
    // that use. In particular, a legacy unsupported count attempt is cancelable.
  } else if (use.kind === 'shipment') {
    const recipient = getPlayer(g, use.recipient);
    requireRule(
      g.status === 'playing' &&
        g.phase === 5 &&
        g.active === recipient.id &&
        !recipient.shipped &&
        !g.karamaShipping,
      'Choose the active player before their unused Karama shipment.',
    );
  } else
    normalKaramaAuction(g, p, use.kind === 'auctionPayment', !!spendingCard);
}
/** Owner-promise proof only. A false result means this suffix remains outside
 * this bounded preview and must retain its existing atomic action boundary. */
function assertKaramaPromiseFeasibility(
  g: Game,
  p: Player,
  use: KaramaUse,
  costCard?: Card,
): boolean {
  const battlePromises =
    g.battle && !g.battle.revealed && !g.battle.plans[p.id]
      ? (g.battle.truthPromises ?? []).filter(
          (promise) => promise.player === p.id && !promise.released,
        )
      : [];
  const shipmentPromises = liveShipmentPromises(
    g.shipmentPromises ?? [],
    p.id,
    g.turn,
  );
  if (!battlePromises.length && !shipmentPromises.length) return true;
  const projected = structuredClone(g),
    owner = getPlayer(projected, p.id);
  if (costCard)
    owner.hand = owner.hand.filter((card) => card.id !== costCard.id);
  if (use.kind === 'shipment') {
    projected.karamaShipping = {
      player: use.recipient,
      owner: p.id,
      card: costCard?.id ?? use.card,
    };
  } else if (use.kind === 'cancel') {
    const b = projected.battle;
    switch (use.response.kind) {
      case 'voice':
        if (!b) return false;
        delete b.voice;
        break;
      case 'prescience':
        if (!b) return false;
        delete b.prescience;
        delete b.preparation;
        break;
      case 'nexusPrescience':
        if (!b?.nexusInspection) return false;
        b.nexusInspection = cancelNexusInspection(battleInspectionContext(projected), b.nexusInspection);
        delete b.preparation;
        break;
      case 'nexusSardaukar':
        if (!b || !currentNexusSardaukar(projected)) return false;
        finishNexusSardaukar(projected,true);
        break;
      case 'eliteStrength':
        if (!b) return false;
        (b.eliteBlocked ??= []).push(use.response.owner);
        break;
      case 'fremenSupport':
        if (!b) return false;
        b.fremenSupportBlocked = true;
        break;
      case 'kwisatz':
        if (!b) return false;
        b.kwisatzBlocked = true;
        break;
      case 'choamBattleAid':
        if (!b) return false;
        b.choamAidBlocked = true;
        break;
      case 'emperorGift':
        // Cancellation transfers no spice and changes no owner's plan inputs.
        break;
      default:
        return false;
    }
  } else return false;
  // The intended result is after this response, not a replay of its suffix.
  projected.response = null;
  projected.pendingKarama = null;
  if (battlePromises.length)
    requireRule(
      !!findReachableBattlePlan(projected, owner, { promises: battlePromises }),
      'You cannot voluntarily make your Truthtrance battle promise impossible.',
    );
  if (shipmentPromises.length)
    requireRule(
      !!findShipmentCompletion(projected, owner, shipmentPromises),
      'You cannot voluntarily make your Truthtrance shipment answer impossible.',
    );
  return true;
}
function spendKarama(g: Game, p: Player, card: Card, use: KaramaUse) {
  const blocked = karamaSpendingBlock(g, p, card);
  requireRule(!blocked, blocked ?? 'This card cannot be spent as Karama.');
  validateKaramaUse(g, p, use, card);
  assertKaramaPromiseFeasibility(g, p, use, card);
  discard(g, p, card.id);
  if (use.kind === 'shipment') use = { ...use, card: card.id };
  if (card.kind === 'worthless') {
    requireRule(!g.pendingKarama, 'A Worthless conversion is already pending.');
    g.pendingKarama = { owner: p.id, use };
    g.pendingKarama.opportunity = {
      kind:
        use.kind === 'cancel'
          ? 'cancel'
          : use.kind === 'shipment'
            ? 'shipment'
            : 'auction',
      signature: karamaOpportunitySignature(g, g.pendingKarama),
    };
    g.response = {
      kind: 'worthlessKarama',
      owner: p.id,
      passed: [],
      intent:
        use.kind === 'cancel'
          ? `Cancel a power used by ${getPlayer(g, use.response.owner).name}.`
          : use.kind === 'shipment'
            ? `Give ${getPlayer(g, use.recipient).name} Guild shipment rates paid to the bank.`
            : use.kind === 'purchase'
              ? 'Take the current auction card without paying spice.'
              : 'Pay the winning auction bid without spending spice.',
    };
    log(
      g,
      `${p.name} used ${card.name} as Karama; the faction power awaits responses.`,
    );
  } else completeKarama(g, p, use);
}
function completeKarama(g: Game, p: Player, use: KaramaUse) {
  validateKaramaUse(g, p, use);
  if (use.kind === 'cancel') {
    g.response = use.response;
    finishResponse(g, true);
    log(g, `${p.name} used Karama to cancel ${use.response.kind}.`);
  } else if (use.kind === 'shipment') {
    g.karamaShipping = { player: use.recipient, owner: p.id, card: use.card };
    log(
      g,
      `${p.name} used Karama for ${getPlayer(g, use.recipient).name}’s shipment at Guild rates, paid to the bank.`,
    );
  } else {
    if (use.kind === 'purchase') g.auction!.bidder = p.id;
    settleAuction(g, true);
  }
}
function auctionSpicePaymentFunded(g: Game, p: Player) {
  const a = g.auction;
  if (!a || a.bidder !== p.id) return false;
  const allyPayment = a.allyPayment ?? 0;
  return (
    Number.isInteger(a.bid) &&
    a.bid >= 0 &&
    Number.isInteger(allyPayment) &&
    allyPayment >= 0 &&
    allyPayment <= a.bid &&
    p.spice >= a.bid - allyPayment &&
    (!allyPayment || (aidFor(g, p)?.amount ?? 0) >= allyPayment)
  );
}
function recordFullPlanInspection(g: Game, owner: string) {
  const p = getPlayer(g, owner);
  log(
    g,
    `${p.name} can now inspect the committed battle plan privately. The plan remains available until both plans are revealed.`,
    { faction: p.faction, name: 'Full plan inspection' },
  );
}
function finishAutomaticDecision(g: Game): boolean {
  if (g.biddingEnd && biddingEndQuiet(g)) return finishBiddingEnd(g);
  if (advanceHomeworldReveal(g)) return true;
  const decision = g.decision;
  if (homeworldShipmentAutomatic(g)) {
    const shipment = g.pendingHomeworldShipment!;
    g.decision = null;
    commitHomeworldShipment(g, shipment);
    return true;
  }
  const market = g.choamMarket;
  if (
    decision?.kind === 'ecazAmbassador' &&
    g.pendingAmbassador?.stage === 'ship' &&
    g.pendingAmbassador.effect === 'guild' &&
    decision.player === g.pendingAmbassador.beneficiary &&
    !g.response &&
    !g.pendingKarama &&
    !g.pendingRicheseGift &&
    !g.pendingExchange &&
    !g.summonedWorm
  ) {
    const { beneficiary } = currentGuildAmbassador(g);
    const choices = guildAmbassadorRule(() =>
      guildAmbassadorShipments(g, beneficiary.id),
    );
    if (!choices.maximum || !choices.destinations.length) {
      g.decision = null;
      log(
        g,
        `${beneficiary.name} has no available physical Guild Ambassador shipment. The committed trigger finishes automatically.`,
      );
      finishAmbassador(g);
      return true;
    }
  }
  if (
    decision?.kind === 'ecazAmbassador' &&
    g.pendingAmbassador?.stage === 'move' &&
    g.pendingAmbassador.effect === 'fremen' &&
    decision.player === g.pendingAmbassador.beneficiary &&
    !g.response &&
    !g.pendingKarama &&
    !g.pendingRicheseGift &&
    !g.pendingExchange &&
    !g.summonedWorm &&
    !fremenAmbassadorMovement(g, decision.player).sources.length
  ) {
    currentFremenAmbassador(g);
    g.decision = null;
    offerAmbassadorRelocation(g);
    return true;
  }
  if (
    decision?.kind === 'choamMarket' &&
    market?.owner === decision.player &&
    g.status === 'playing' &&
    g.phase === 3 &&
    !g.response &&
    !g.truthtrance &&
    !g.phaseOpening &&
    !g.pendingNullentropy &&
    !g.pendingRicheseGift &&
    !g.pendingKarama &&
    !market.sale &&
    !market.trade &&
    getPlayer(g, market.owner).hand.length === 0 &&
    g.players.every(
      (p) =>
        p.id === market.owner ||
        (p.hand.length < 2 &&
          !(
            p.faction === 'richese' &&
            p.ally === market.owner &&
            getPlayer(g, market.owner).ally === p.id &&
            p.hand.length > 0
          )),
    )
  ) {
    // Hand counts are public only in Bidding. Nonempty hands may prepare sales, while another
    // two-card hand could use Distrans or a Richese ally could give one card.
    log(
      g,
      `${getPlayer(g, market.owner).name} has no cards and no incoming card exchange is available. The end-of-phase market finishes automatically.`,
      { faction: 'choam', name: 'Market complete' },
    );
    finishChoamMarket(g);
    return true;
  }
  if (decision?.kind === 'choamAudit' && currentAuditCount(g) === 0) {
    finishAuditor(g, 'empty');
    return true;
  }
  if (
    decision?.kind === 'choamAuditPayment' &&
    (currentAuditCount(g) === 0 ||
      getPlayer(g, decision.player).spice < currentAuditCount(g))
  ) {
    finishAuditor(g, 'inspect');
    return true;
  }
  const lot = g.richeseAuction;
  const richese = byFaction(g, 'richese');
  if (
    !decision &&
    richese &&
    !noFieldAllyOfferBlock(g, richese) &&
    !(
      g.richeseAllyOpportunity?.turn === g.turn &&
      g.richeseAllyOpportunity.recipient === richese.ally
    )
  ) {
    g.richeseAllyOpportunity = { turn: g.turn, recipient: richese.ally! };
    g.decision = {
      kind: 'richeseAllyOpportunity',
      player: richese.id,
      recipient: richese.ally!,
    };
    log(
      g,
      `${richese.name} may offer a No-Field before their ally’s shipment. The ally’s turn is held for this choice.`,
    );
    return true;
  }
  if (g.phase === 3 && !decision && lot && !lot.outcome) {
    const full =
      lot.method === 'silent'
        ? lot.eligible.find(
            (id) =>
              !Object.hasOwn(lot.sealed, id) &&
              getPlayer(g, id).hand.length >= handLimit(getPlayer(g, id)),
          )
        : lot.active &&
            getPlayer(g, lot.active).hand.length >=
              handLimit(getPlayer(g, lot.active))
          ? lot.active
          : null;
    if (full) {
      g.richeseAuction = submitRicheseBid(
        lot,
        {
          event: lot.event,
          actor: full,
          amount: lot.method === 'silent' ? 0 : null,
        },
        0,
      );
      if (lot.method === 'silent')
        (g.richeseFunding ??= {})[full] = {
          amount: 0,
          allyPayment: 0,
          donor: null,
        };
      g.active = g.richeseAuction.active;
      const player = getPlayer(g, full);
      log(
        g,
        `${player.name} automatically ${lot.method === 'silent' ? 'submitted zero' : 'passed'} because their hand became full before bidding.`,
        { faction: player.faction, name: 'Full hand: no bid' },
      );
      if (lot.method === 'silent' && g.richeseAuction.outcome)
        log(
          g,
          `Silent bids revealed together: ${g.richeseAuction.tieOrder.map((id) => `${getPlayer(g, id).name} ${g.richeseAuction!.sealed[id]}`).join('; ')}. Ties are resolved in storm order.`,
        );
      settleRicheseLot(g);
      return true;
    }
  }
  if (
    g.phase === 3 &&
    decision?.kind === 'richeseUnbid' &&
    lot?.source === 'cache' &&
    lot.outcome?.kind === 'unbid' &&
    getPlayer(g, lot.owner).hand.length >= handLimit(getPlayer(g, lot.owner))
  ) {
    g.decision = null;
    settleRicheseLot(g);
    return true;
  }
  if (decision?.kind === 'fullPlanRead') {
    const b = g.battle;
    requireRule(
      b &&
        !b.revealed &&
        b.fullPlan?.owner === decision.player &&
        b.fullPlan.target === decision.target &&
        b.plans[decision.target],
      'The saved inspection does not match a committed battle plan.',
    );
    g.decision = null;
    recordFullPlanInspection(g, decision.player);
    return true;
  }
  if (
    decision?.kind === 'auctionPayment' &&
    g.status === 'playing' &&
    g.phase === 3
  ) {
    const p = getPlayer(g, decision.player);
    // The ally split was committed with the bid. Never silently select a new
    // split or consume a card on behalf of a player, including a BG conversion.
    if (
      auctionSpicePaymentFunded(g, p) &&
      !p.hand.some((card) => !karamaSpendingBlock(g, p, card))
    ) {
      g.decision = null;
      settleAuction(g, false, true);
      return true;
    }
  }
  return false;
}
function recoverAuctionPayment(g: Game, p: Player) {
  const a = g.auction!;
  if (a.bid <= p.spice + (aidFor(g, p)?.amount ?? 0) || karamaCard(g, p)) {
    g.decision = { kind: 'auctionPayment', player: p.id };
    return;
  }
  // Provisional recovery for an unfunded canceled payment; primary-source
  // confirmation is still required before advanced tables are enabled.
  g.decision = null;
  a.bid = 0;
  a.bidder = null;
  a.allyPayment = 0;
  a.passed = [];
  while (
    getPlayer(g, g.order[a.opener]).hand.length >=
    handLimit(getPlayer(g, g.order[a.opener]))
  )
    a.opener = (a.opener + 1) % g.order.length;
  a.active = g.order[a.opener];
  g.active = a.active;
  log(
    g,
    'The winning bid is no longer funded. Bidding restarts for the same unrevealed card.',
  );
}
function occupancyRule<T>(quote: () => T): T {
  try {
    return quote();
  } catch (error) {
    throw new RuleError(
      error instanceof Error ? error.message : 'Invalid territory occupancy.',
    );
  }
}
function sharesEcazOccupation(g: Game, p: Player, to: string) {
  return (
    !!p.ally &&
    occupancyRule(
      () =>
        ecazOccupancyRelation(g.players, p.id, p.ally!, {
          kind: 'territory',
          id: to,
        }) === 'ecazAlliance',
    )
  );
}
function allowedEntry(
  g: Game,
  p: Player,
  t: string,
  s: number,
  stormShipment = false,
  advisors = false,
) {
  requireRule(
    t !== MOBILE_STRONGHOLD || g.mobileStronghold?.location,
    'The mobile stronghold has not been placed.',
  );
  requireRule(
    validLocation(t, s),
    'Choose a sector belonging to this territory.',
  );
  requireRule(
    s === 0 || s !== g.storm || stormShipment,
    'That sector is in storm.',
  );
  const blocked = occupancyRule(() =>
    territoryEntryBlock(g.players, p.id, t, advisors),
  );
  requireRule(!blocked, blocked ?? 'This territory cannot be entered.');
}
function eliteChoice(
  total: number,
  available: number,
  eliteAvailable: number,
  value: unknown,
) {
  const minimum = Math.max(0, total - (available - eliteAvailable));
  return integer(
    value ?? minimum,
    minimum,
    Math.min(total, eliteAvailable),
    'Elite forces',
  );
}
function forceGroup(p: Player, action: Action) {
  let entries: [string, unknown][];
  if (action.forces !== undefined) {
    requireRule(
      action.forces &&
        typeof action.forces === 'object' &&
        !Array.isArray(action.forces),
      'Choose a force group from one territory.',
    );
    entries = Object.entries(action.forces);
  } else entries = [[stringField(action.from), action.amount]];
  const group: [string, number][] = [];
  const eliteGroup: Record<string, number> = {};
  let origin: string | undefined;
  let noField: { tokenId: string; event: string; from: string } | undefined;
  if (action.noField !== undefined) {
    const marker = p.noField?.deployed;
    requireRule(
      p.faction === 'richese' &&
        marker &&
        marker.tokenId === action.noField &&
        p.noFieldEvent === action.event,
      'This concealed No-Field movement selection is stale.',
    );
    origin = marker.location.territory;
    noField = {
      tokenId: marker.tokenId,
      event: p.noFieldEvent!,
      from: location(marker.location.territory, marker.location.sector),
    };
  }
  for (const [key, value] of entries) {
    const src = splitLocation(key);
    requireRule(
      validLocation(src.territory, src.sector),
      'Invalid source sector.',
    );
    const n = integer(value, 0, p.forces[key] ?? 0, 'Forces');
    if (!n) continue;
    requireRule(
      !origin || origin === src.territory,
      'A force group must come from one territory.',
    );
    origin = src.territory;
    group.push([key, n]);
    const selectedElite =
      action.forces !== undefined
        ? (action.eliteForces as Record<string, unknown> | undefined)?.[key]
        : action.elite;
    eliteGroup[key] = eliteChoice(
      n,
      p.forces[key],
      p.elites?.forces[key] ?? 0,
      selectedElite,
    );
  }
  requireRule(
    group.length > 0 || noField,
    'Choose at least one force or the deployed No-Field.',
  );
  return {
    group,
    eliteGroup,
    elite: Object.values(eliteGroup).reduce((a, b) => a + b, 0),
    origin: origin!,
    total: group.reduce((n, [, count]) => n + count, 0) + (noField ? 1 : 0),
    noField,
    sourceKeys: [
      ...group.map(([key]) => key),
      ...(noField ? [noField.from] : []),
    ],
  };
}
function movesAllowed(g: Game, p: Player) {
  const flight = g.ornithopter;
  return flight?.player === p.id && flight.turn === g.turn
    ? flight.startingMove + (flight.mode === 'twoGroups' ? 2 : 1)
    : g.hajr.includes(p.id)
      ? 2
      : 1;
}
function emperorHomeworldMoveBlock(g: Game, p: Player): string | null {
  if (!g.homeworlds?.custody || !g.advanced || p.faction !== 'emperor')
    return 'Moving between Kaitain and Salusa requires the Advanced Emperor Homeworlds.';
  if (
    g.status !== 'playing' ||
    g.phase !== 5 ||
    g.active !== p.id ||
    p.moved >= movesAllowed(g, p)
  )
    return 'Use an available movement during your own Shipment and Movement turn.';
  if (
    g.truthtrance ||
    g.response ||
    g.decision ||
    g.phaseOpening ||
    g.pendingNullentropy ||
    g.pendingTreacheryDiscard ||
    g.pendingShipment ||
    g.battle
  )
    return 'Finish the current interaction before moving between Homeworlds.';
  if (g.ornithopter)
    return 'Homeworld transfers during an active Ornithopter card await their movement-group integration.';
  const richese = byFaction(g, 'richese');
  if (
    richese &&
    !noFieldAllyOfferBlock(g, richese) &&
    !(
      g.richeseAllyOpportunity?.turn === g.turn &&
      g.richeseAllyOpportunity.recipient === p.id
    )
  )
    return 'Wait for Richese to offer or pass its allied shipment opportunity.';
  if (!p.shipped) {
    try {
      checkShipmentPromises(g, p, null);
    } catch (error) {
      if (error instanceof RuleError) return error.message;
      throw error;
    }
  }
  return null;
}
function emperorHomeworldMoveEvent(g: Game, p: Player) {
  return JSON.stringify([
    g.turn,
    g.phase,
    g.active,
    p.moved,
    p.shipped,
    homeworldContext(g),
    g.homeworlds?.custody,
  ]);
}
function ornithopterBlock(
  g: Game,
  p: Player,
  mode: OrnithopterMode,
): string | null {
  if (g.status !== 'playing' || g.phase !== 5 || g.active !== p.id)
    return 'Use Ornithopter during your own Shipment and Movement turn.';
  if (g.truthtrance || g.response || g.decision || g.phaseOpening)
    return 'Resolve the current interaction before declaring a movement.';
  if (g.ornithopter)
    return 'Finish the already played Ornithopter movement first.';
  if (p.moved || g.hajr.includes(p.id))
    return 'Ornithopter combined with prior moves or Hajr awaits its timing ruling.';
  if (
    mode === 'range3' &&
    p.faction === 'choam' &&
    g.choamMovement?.turn === g.turn &&
    g.choamMovement.bonus
  )
    return 'Kulon combined with the fixed three-territory card range awaits a ruling.';
  return null;
}
function ornithopterIntegrity(g: Game) {
  const flight = g.ornithopter;
  if (!flight) return;
  const owner = getPlayer(g, flight.player);
  requireRule(
    g.status === 'playing' &&
      g.phase === 5 &&
      g.active === owner.id &&
      flight.turn === g.turn &&
      ['range3', 'twoGroups'].includes(flight.mode) &&
      Number.isSafeInteger(flight.completed) &&
      flight.completed >= 0 &&
      flight.completed < (flight.mode === 'twoGroups' ? 2 : 1) &&
      owner.moved === flight.startingMove + flight.completed &&
      richeseCardDefinition(flight.card)?.card.effect === 'ornithopter' &&
      ![
        ...g.players.flatMap((p) => p.hand),
        ...g.deck,
        ...g.discard,
        ...(g.richeseCache ?? []),
      ].some((c) => c.id === flight.card.id),
    'The played Ornithopter custody or movement event is inconsistent; restore the saved movement before continuing.',
  );
  if (flight.mode === 'twoGroups' && flight.completed === 1) {
    requireRule(
      flight.cohort,
      'The original unmoved Ornithopter cohort is missing; restore the saved movement before continuing.',
    );
    noFieldRule(() =>
      validateCohortSelection(
        flight.cohort!,
        owner.forces,
        owner.elites?.forces ?? {},
        {},
        {},
      ),
    );
  }
}
function finishOrnithopter(
  g: Game,
  source: 'move' | 'end',
  movement: CompletedMovement | null = null,
) {
  const flight = g.ornithopter;
  if (!flight) return;
  requireRule(
    !g.pendingNullentropy,
    'Finish the paid search before completing the movement card.',
  );
  g.discard.push(flight.card);
  g.ornithopter = null;
  log(
    g,
    `${getPlayer(g, flight.player).name} finished Ornithopter after ${flight.completed} group move${flight.completed === 1 ? '' : 's'} and discarded the played card.`,
    { faction: getPlayer(g, flight.player).faction, name: 'Ornithopter' },
  );
  // completeMove validated arrival with a pure quote before moving any forces.
  // The completed discard resumes that arrival without speculative effect replay.
  const resume = {
    response: g.response,
    decision: g.decision,
    pendingKarama: g.pendingKarama,
    phaseOpening: g.phaseOpening,
  };
  g.response = null;
  g.decision = null;
  g.pendingKarama = null;
  g.phaseOpening = null;
  const continuation: Extract<
    NonNullable<Game['pendingTreacheryDiscard']>['continuation'],
    { kind: 'ornithopterDiscard' }
  > = {
    kind: 'ornithopterDiscard',
    source,
    flight,
    movement,
    resume,
    stateSignature: '',
  };
  continuation.stateSignature = ornithopterDiscardSignature(g, continuation);
  stageTreacheryDiscard(
    g,
    `ornithopter:${source}`,
    [{ card: flight.card, discardedBy: flight.player, publicFace: true }],
    continuation,
  );
}
function ornithopterView(g: Game, p: Player) {
  const flight = g.ornithopter?.player === p.id ? g.ornithopter : null;
  const card =
    flight?.card ??
    p.hand.find((c) => richeseCardDefinition(c)?.card.effect === 'ornithopter');
  if (!card) return null;
  const modes = (['range3', 'twoGroups'] as const).map((mode) => ({
    mode,
    blocked: ornithopterBlock(g, p, mode) ?? transferCardBlock(g, p, card),
  }));
  return {
    card,
    blocked: flight
      ? null
      : modes.every((m) => m.blocked)
        ? modes[0].blocked
        : null,
    modes,
    active: flight
      ? {
          event: flight.event,
          mode: flight.mode,
          completed: flight.completed,
          remaining: (flight.mode === 'twoGroups' ? 2 : 1) - flight.completed,
          cohort: flight.cohort,
        }
      : null,
  };
}
function movementOrderRange(g: Game, p: Player, move: MovementOrder) {
  return move.ornithopterRange ? 3 : movementRange(g, p, move.elite);
}
function validateFlightSelection(g: Game, p: Player, move: MovementOrder) {
  const flight = g.ornithopter;
  requireRule(
    !flight || flight.player !== p.id || move.ornithopterEvent === flight.event,
    'Use the current Ornithopter movement event.',
  );
  if (!move.ornithopterEvent) return;
  requireRule(
    flight?.player === p.id &&
      flight.event === move.ornithopterEvent &&
      move.ornithopterRange === (flight.mode === 'range3'),
    'This Ornithopter movement event is stale.',
  );
  if (flight.completed && flight.cohort)
    noFieldRule(() =>
      validateCohortSelection(
        flight.cohort!,
        p.forces,
        p.elites?.forces ?? {},
        Object.fromEntries(move.group),
        move.eliteGroup,
        move.noField,
      ),
    );
}
function movementRange(g: Game, p: Player, elite: number) {
  const base =
    fighterCount(p, 'arrakeen') || fighterCount(p, 'carthag')
      ? 3
      : (p.faction === 'fremen' &&
            !(
              p.fremenMovementBlocked?.turn === g.turn &&
              p.fremenMovementBlocked.move === p.moved
            )) ||
          (p.faction === 'ixians' &&
            elite > 0 &&
            !(
              p.ixMovementBlocked?.turn === g.turn &&
              p.ixMovementBlocked.move === p.moved
            ))
        ? 2
        : 1;
  return (
    base +
    (p.faction === 'choam' && g.choamMovement?.turn === g.turn
      ? g.choamMovement.bonus
      : 0)
  );
}
function balisetPrevents(g: Game, player: string, origin: string, to: string) {
  const choam = byFaction(g, 'choam');
  return (
    g.phase === 5 &&
    origin !== to &&
    !!choam &&
    at(choam, to) > 0 &&
    !!g.choamBaliset?.some(
      (b) => b.turn === g.turn && b.player === player && b.territory === to,
    )
  );
}
function offerChoamMovement(g: Game, move: MovementOrder) {
  const choam = byFaction(g, 'choam');
  if (
    g.phase === 5 &&
    choam &&
    move.player !== choam.id &&
    move.origin !== move.to &&
    at(choam, move.to) > 0
  ) {
    g.pendingChoamMove = move;
    g.decision = {
      kind: 'choamMovement',
      player: choam.id,
      mover: move.player,
      territory: move.to,
      sector: move.sector,
      amount: move.total,
    };
  } else if (move.source === 'ambassador') commitAmbassadorRelocation(g, move);
  else completeMove(g, move);
}
function validateMovementOrder(g: Game, p: Player, move: MovementOrder) {
  if (move.noField) {
    const blocked = homeworldRule(() => homeworldNoFieldMovementBlock(g, p.id));
    requireRule(!blocked, blocked ?? 'The No-Field cannot move.');
  }
  if (move.source === 'ambassador') {
    const { beneficiary } = currentFremenAmbassador(g, move.ambassadorEvent);
    requireRule(
      beneficiary.id === p.id && move.player === p.id && move.ambassadorEvent,
      'The Ambassador move belongs to another beneficiary.',
    );
    const current = quoteAmbassadorRelocation(g, {
      type: 'decision',
      event: move.ambassadorEvent,
      forces: Object.fromEntries(move.group),
      eliteForces: move.eliteGroup,
      territory: move.to,
      sector: move.sector,
      fighters: move.wantsFighters,
      ...(move.noField
        ? {
            noField: {
              tokenId: move.noField.tokenId,
              event: move.noField.event,
            },
          }
        : {}),
    });
    const { source: _source, ambassadorEvent: _event, ...declared } = move;
    requireRule(
      JSON.stringify(current) === JSON.stringify(declared),
      'The declared Ambassador relocation no longer matches its current forces and stance.',
    );
    return;
  }
  requireRule(
    g.phase === 5 && g.active === p.id && p.moved < movesAllowed(g, p),
    'The movement is no longer available.',
  );
  validateFlightSelection(g, p, move);
  const selected = forceGroup(p, {
    type: 'move',
    forces: Object.fromEntries(move.group),
    eliteForces: move.eliteGroup,
    ...(move.noField
      ? { noField: move.noField.tokenId, event: move.noField.event }
      : {}),
  });
  requireRule(
    selected.origin === move.origin &&
      selected.total === move.total &&
      selected.elite === move.elite &&
      selected.group.length === move.group.length,
    'The declared force group no longer matches its movement.',
  );
  requireRule(
    !balisetPrevents(g, p.id, move.origin, move.to),
    'Baliset prevents that movement.',
  );
  allowedEntry(
    g,
    p,
    move.to,
    move.sector,
    false,
    move.advisors && !move.wantsFighters,
  );
  requireRule(
    [
      ...move.group.map(([key]) => key),
      ...(move.noField ? [move.noField.from] : []),
    ].every(
      (key) =>
        gameDistance(g, key, location(move.to, move.sector), (k) =>
          pathBlocked(g, p, k, isAdvisor(p, move.origin)),
        ) <= movementOrderRange(g, p, move),
    ),
    'The movement route is no longer available.',
  );
}
function pendingFremenMovement(g: Game, response: ResponseWindow) {
  const pending = g.pendingFremenMove;
  requireRule(
    pending &&
      response.kind === 'fremenMovement' &&
      pending.order.player === response.owner &&
      pending.turn === g.turn,
    'This Fremen movement response is no longer current.',
  );
  const p = getPlayer(g, pending.order.player);
  requireRule(
    p.faction === 'fremen' &&
      pending.move === p.moved &&
      response.location === location(pending.order.to, pending.order.sector) &&
      response.amount === pending.order.total,
    'This Fremen movement declaration is no longer current.',
  );
  validateMovementOrder(g, p, pending.order);
  return pending;
}
function resumeChoamMovement(g: Game) {
  const move = g.pendingChoamMove!;
  if (move.source === 'ambassador')
    currentFremenAmbassador(g, move.ambassadorEvent);
  g.pendingChoamMove = null;
  const p = getPlayer(g, move.player);
  try {
    validateMovementOrder(g, p, move);
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    log(
      g,
      `${p.name}'s declared movement is no longer legal. No movement was spent.`,
    );
    if (move.source === 'ambassador') offerAmbassadorRelocation(g);
    return;
  }
  if (move.source === 'ambassador') commitAmbassadorRelocation(g, move);
  else completeMove(g, move);
}
function validateMovementArrival(
  g: Game,
  move: MovementOrder,
  cancelingChoam = false,
) {
  try {
    return quoteCompletedMovementArrival({
      advanced: g.advanced,
      players: g.players,
      order: move,
      ambassadors: g.ecazAmbassadors?.tokens ?? [],
      terror: homeworldTerrorEntryBlock(g, move.total)
        ? [] : (g.moritaniTerror?.tokens ?? []),
      flight: g.ornithopter,
      controls: {
        response: !cancelingChoam && !!g.response,
        decision: !!g.decision,
        pendingTerror: !!g.pendingTerrorEntry,
        pendingAmbassador: !!g.pendingAmbassador,
        paidBox: !!g.pendingNullentropy,
      },
    });
  } catch (error) {
    if (error instanceof MovementArrivalError)
      throw new RuleError(error.message);
    throw error;
  }
}
function completeMove(g: Game, move: MovementOrder) {
  if (move.noField) {
    const blocked = homeworldRule(() => homeworldNoFieldMovementBlock(g, move.player));
    requireRule(!blocked, blocked ?? 'The No-Field cannot move.');
  }
  const {
    group,
    eliteGroup,
    elite,
    origin,
    total: n,
    to,
    sector: s,
    advisors,
    wantsFighters,
    lockedTurn,
    player: id,
  } = move;
  const p = getPlayer(g, id);
  validateFlightSelection(g, p, move);
  validateMovementArrival(g, move);
  const flight = g.ornithopter;
  if (
    flight?.player === id &&
    flight.mode === 'twoGroups' &&
    flight.completed === 0
  ) {
    const marker = p.noField?.deployed;
    flight.cohort = noFieldRule(() =>
      createRemainingCohort(
        p.forces,
        p.elites?.forces ?? {},
        Object.fromEntries(group),
        eliteGroup,
        marker && p.noFieldEvent
          ? {
              tokenId: marker.tokenId,
              event: p.noFieldEvent,
              from: location(marker.location.territory, marker.location.sector),
            }
          : undefined,
        move.noField,
      ),
    );
  }
  if (move.noField) {
    requireRule(
      p.noField && p.noFieldEvent === move.noField.event,
      'This No-Field movement is no longer current.',
    );
    p.noField = noFieldRule(() =>
      moveRicheseNoField(p.noField!, move.noField!.tokenId, {
        territory: to,
        sector: s,
      }),
    );
    p.noFieldEvent = crypto.randomUUID();
  }
  removeGroup(p, group, eliteGroup);
  if (n > (move.noField ? 1 : 0))
    place(p, to, s, n - (move.noField ? 1 : 0), elite);
  if (advisors)
    (p.advisors ??= {})[to] = {
      lockedTurn:
        Math.max(lockedTurn ?? 0, p.advisors?.[to]?.lockedTurn ?? 0) ||
        undefined,
    };
  else if (p.advisors) delete p.advisors[to];
  if (wantsFighters)
    g.response = {
      kind: 'advisorFlip',
      owner: id,
      location: to,
      advisors: false,
      passed: [],
    };
  finishShipmentPromises(g, p, null);
  p.shipped = true;
  p.moved++;
  const completed: CompletedMovement = {
    player: id,
    origin,
    total: n,
    to,
    sector: s,
    elite,
    noField: !!move.noField,
  };
  if (flight?.player === id) {
    flight.completed++;
    if (flight.completed === (flight.mode === 'twoGroups' ? 2 : 1)) {
      finishOrnithopter(g, 'move', completed);
      return;
    }
  }
  finishMovedGroup(g, completed);
}
/** Forces and movement counters are already committed; only arrival remains. */
function finishMovedGroup(g: Game, move: CompletedMovement) {
  const { player: id, origin, total: n, to, sector: s, elite } = move;
  const p = getPlayer(g, id);
  g.karamaShipping = null;
  log(
    g,
    move.noField
      ? `${p.name} moved a concealed No-Field${n > 1 ? ` with ${n - 1} physical forces` : ''} from ${territory(origin).name} to ${territory(to).name}. Its value remains concealed.`
      : `${p.name} moved ${n} forces from ${territory(origin).name} to ${territory(to).name}.`,
  );
  intrusion(g, p, to);
  if (origin !== to) openTerritoryEntry(g, p, to, s, n, elite, 'movement');
}
/** A played movement card is already retired before queue advancement. */
function finishMovementTurn(g: Game, id: string) {
  const p = getPlayer(g, id);
  g.karamaShipping = null;
  g.movementRemaining ??= g.order.slice(g.order.indexOf(id));
  const shared = p.ally
    ? gameTerritories(g).filter(
        (terr) =>
          terr.type !== 'polar' &&
          at(p, terr.id) &&
          at(getPlayer(g, p.ally!), terr.id) &&
          sharesEcazOccupation(g, p, terr.id),
      )
    : [];
  if (shared.length)
    log(
      g,
      `${p.name} and ${getPlayer(g, p.ally!).name} remain together in ${shared.map((t) => t.name).join(', ')} under Ecaz Occupy. No allied separation losses apply.`,
      { faction: 'ecaz', name: 'Occupy' },
    );
  if (p.ally)
    for (const terr of gameTerritories(g))
      if (
        terr.type !== 'polar' &&
        at(p, terr.id) &&
        at(getPlayer(g, p.ally), terr.id) &&
        !sharesEcazOccupation(g, p, terr.id) &&
        !g.movementRemaining.includes(p.ally) &&
        !(
          p.allySinceTurn === g.turn &&
          getPlayer(g, p.ally).allySinceTurn === g.turn
        )
      )
        killTerritory(g, p, terr.id);
  g.movementRemaining = g.movementRemaining.filter((other) => other !== id);
  if (g.saphoMovementLast?.player === id) g.saphoMovementLast = null;
  movementTurn(g);
}

const implementedAmbassadorEffects: readonly AmbassadorEffect[] = [
  'ecaz',
  'atreides',
  'harkonnen',
  'emperor',
  'choam',
  'ixians',
  'beneGesserit',
  'richese',
  'fremen',
  'guild',
];
function returnAmbassadorsIn(g: Game, to: string, reason: string) {
  for (const token of g.ecazAmbassadors?.tokens.filter(
    (t) => t.zone === 'placed' && t.location === to,
  ) ?? []) {
    g.ecazAmbassadors = destroyAmbassador(g.ecazAmbassadors!, token.id);
    log(
      g,
      `The ${faction(token.effect).name} Ambassador returned from ${territory(to).name} to Ecaz’s supply because ${reason}. This was destruction, not a triggered effect, and does not advance the five-token cycle.`,
    );
  }
}
function ambassadorDiscardBlock(g: Game, p: Player, card: Card, effect?: AmbassadorEffect) {
  if (g.pendingWinnerDiscards?.player === p.id &&
    [...g.pendingWinnerDiscards.cards, ...g.pendingWinnerDiscards.optional].includes(card.id))
    return 'This played card is reserved until the winner’s casualties and card cleanup.';
  if (g.battle?.lateDefense?.[p.id] === card.id)
    return 'This Portable Snooper is already played and reserved for battle cleanup.';
  if (giftReserved(g, p.id, card.id))
    return 'This card is reserved for the pending Richese gift.';
  if (
    g.truthtrance?.queue.some(
      (entry) => entry.player === p.id && entry.card === card.id,
    )
  )
    return 'This card is already committed to Truthtrance.';
  if (retentionReservesCard(g, p.id, card.id))
    return 'This card is reserved for Moritani battle cleanup.';
  const plan = g.battle?.plans[p.id];
  if (plan && [plan.weapon, plan.defense, plan.leader].includes(card.id))
    return 'This card is committed to a sealed battle plan.';
  if (g.battle && committedPlanElements(g.battle, p.id).some(element => element.value === card.id))
    return 'This card is committed to prescience.';
  if (effect === 'choam')
    return homeworldRule(() => homeworldWorthlessSaleBlock(g, p.id, card));
  return null;
}
function ambassadorEffectBlock(
  g: Game,
  effect: AmbassadorEffect,
  beneficiary: Player,
  entrant: Player,
): string | null {
  if (!implementedAmbassadorEffects.includes(effect))
    return 'This Ambassador effect is still being implemented.';
  if (effect === 'ecaz') {
    const owner = byFaction(g, 'ecaz');
    if (!owner || beneficiary.id !== owner.id)
      return 'Assigning the Ecaz Ambassador effect to an ally is still being implemented.';
    if (g.players.some((p) => p.leaders.some((l) => l.id === DUKE_VIDAL_ID)))
      return 'Duke Vidal is unavailable for this acquisition.';
    return ecazDukeAcquisitionBlock(g, owner.id);
  }
  if (
    effect === 'ixians' &&
    !beneficiary.hand.some(
      (card) => !ambassadorDiscardBlock(g, beneficiary, card),
    )
  )
    return 'The beneficiary needs a card they can discard.';
  if (
    effect === 'harkonnen' &&
    !(entrant.faction === 'tleilaxu'
      ? entrant.faceDancers?.length
      : entrant.traitors.length)
  )
    return 'The entrant has no held Traitor Card to inspect.';
  return null;
}
/** The original entry is committed once. Competing arrival ordering remains gated. */
function openTerritoryEntry(
  g: Game,
  entrant: Player,
  to: string,
  sector: number,
  amount: number,
  elite: number,
  cause: NonNullable<Game['pendingTerrorEntry']>['cause'],
  resume: 'none' | 'wormRide' = 'none',
) {
  const owner = byFaction(g, 'ecaz');
  const token = g.ecazAmbassadors?.tokens.find(
    (t) => t.zone === 'placed' && t.location === to,
  );
  if (
    !owner ||
    !token ||
    !canTriggerAmbassador({
      owner: owner.id,
      ally: owner.ally,
      entrant: entrant.id,
      entrantFaction: entrant.faction,
      advisors: isAdvisor(entrant, to),
      effect: token.effect,
    })
  )
    return openTerrorEntry(
      g,
      entrant,
      to,
      sector,
      amount,
      elite,
      cause,
      resume,
    );
  const moritani = byFaction(g, 'moritani');
  const terror =
    moritani &&
    entrant.id !== moritani.id &&
    entrant.id !== moritani.ally &&
    !homeworldTerrorEntryBlock(g, amount) &&
    g.moritaniTerror?.tokens.some(
      (t) => t.status === 'placed' && t.location === to,
    );
  requireRule(
    !g.response &&
      !g.decision &&
      !g.pendingTerrorEntry &&
      !g.pendingAmbassador &&
      !terror,
    'Ambassadors combined with another arrival reaction are still being implemented. This entry has not been committed.',
  );
  g.pendingAmbassador = {
    event: `ambassador:${g.turn}:${g.phase}:${(g.log.at(-1)?.seq ?? 0) + 1}`,
    owner: owner.id,
    entrant: entrant.id,
    token: token.id,
    territory: to,
    sector,
    turn: g.turn,
    phase: g.phase,
    stage: 'offer',
    resume,
    ...(resume === 'wormRide' ? { wormRider: entrant.id } : {}),
    copyChoices:
      token.effect === 'beneGesserit'
        ? copiedAmbassadorEffects(g.ecazAmbassadors!)
        : [],
  };
  g.decision = { kind: 'ecazAmbassador', player: owner.id };
  log(
    g,
    `${owner.name} may trigger the ${faction(token.effect).name} Ambassador because ${entrant.name} entered ${territory(to).name}. The entrant’s remaining actions wait for this opportunity.`,
  );
  return true;
}
function finishAmbassador(g: Game, deferResume = false) {
  const pending = g.pendingAmbassador!;
  if (pending.revivalEvent !== undefined || pending.victoryEvent !== undefined) {
    const arrival = pending.revivalEvent !== undefined ? g.homeworldRevivalReturn : g.homeworldVictoryReinforcement;
    requireRule(arrival && ambassadorPhaseAllowed(g),
      'This Ambassador has lost its original Homeworld arrival completion.');
    completeHomeworldArrivalAmbassador(arrival, pending.event);
  }
  if (
    pending.beneficiary &&
    pending.effect !== 'ecaz' &&
    g.ecazAmbassadors!.cohort.every((id) =>
      g.ecazAmbassadors!.tokens.some(
        (t) => t.id === id && (t.zone === 'used' || t.zone === 'removed'),
      ),
    )
  ) {
    g.ecazAmbassadors = replenishAmbassadors(g.ecazAmbassadors!, random);
    log(
      g,
      'All five random Ambassadors have been triggered. Ecaz drew a new supply of five; the removed Bene Gesserit token stays out of the game.',
    );
  }
  g.pendingAmbassador = null;
  if (!deferResume && pending.resume === 'wormRide') nextWormRide(g);
}
function currentFremenAmbassador(g: Game, event?: string, completed = false) {
  const entry = g.pendingAmbassador;
  const owner = entry && g.players.find((p) => p.id === entry.owner);
  const beneficiary =
    entry && g.players.find((p) => p.id === entry.beneficiary);
  const token = g.ecazAmbassadors?.tokens.find((t) => t.id === entry?.token);
  requireRule(
    entry &&
      owner?.faction === 'ecaz' &&
      beneficiary &&
      entry.effect === 'fremen' &&
      entry.turn === g.turn &&
      entry.phase === g.phase &&
      ambassadorPhaseAllowed(g) &&
      (event === undefined || entry.event === event) &&
      (completed
        ? entry.stage === 'arrival' && entry.relocation
        : entry.stage === 'move') &&
      (completed ||
        beneficiary.id === owner.id ||
        (owner.ally === beneficiary.id && beneficiary.ally === owner.id)) &&
      token &&
      ((token.effect === 'fremen' && token.zone === 'used') ||
        (token.effect === 'beneGesserit' &&
          token.zone === 'removed' &&
          entry.copyChoices.includes('fremen'))),
    'This Fremen Ambassador relocation is no longer current.',
  );
  return { entry, beneficiary };
}
/** Check historical arrival receipts without replaying movement or inspecting concealed values. */
function ambassadorRelocationIntegrity(g: Game) {
  const entry = g.pendingAmbassador;
  if (entry && (entry.revivalEvent !== undefined || entry.victoryEvent !== undefined ||
      g.homeworldRevivalReturn?.ambassadors?.some((record) => record.event === entry.event) ||
      g.homeworldVictoryReinforcement?.ambassadors?.some((record) => record.event === entry.event)))
    requireRule(ambassadorPhaseAllowed(g),
      'This Ambassador has lost its original Homeworld revival arrival.');
  if (entry)
    requireRule(
      validAmbassadorResume(g, entry),
      'This Ambassador has lost its original arrival continuation.',
    );
  if (g.pendingShipment?.source === 'ambassador')
    requireRule(
      entry?.effect === 'guild' && entry.stage === 'ship',
      'This pending shipment has no matching Guild Ambassador.',
    );
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const contexts = [
    g,
    g.pendingExchange,
    g.pendingNullentropy?.resume,
    g.pendingRicheseGift?.resume,
    g.pendingRichesePurchaseIncome?.resume,
    g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null,
  ];
  const responses = contexts.flatMap((context) =>
    context?.response ? [context.response] : [],
  );
  for (const { pending } of savedKaramaContexts(g))
    if (pending.use.kind === 'cancel') responses.push(pending.use.response);
  const decisions = contexts.flatMap((context) =>
    context?.decision ? [context.decision] : [],
  );
  const terror =
    g.pendingTerrorEntry ??
    (continuation?.kind === 'terrorDiscard' ? continuation.entry : null);
  const relatedResponses = responses.filter(
    (response) =>
      response.advisorResume === 'ambassador' ||
      response.advisorAmbassadorEvent !== undefined,
  );
  const relatedDecisions = decisions.filter(
    (decision) =>
      decision.kind === 'intrusion' && decision.ambassadorEvent !== undefined,
  );
  const advisorDecisions = decisions.filter(
    (decision) =>
      decision.kind === 'advisor' && decision.ambassadorEvent !== undefined,
  );
  const relatedTerror =
    terror?.cause === 'ambassador' ||
    terror?.resume === 'ambassador' ||
    terror?.ambassadorEvent !== undefined;
  if (entry?.effect === 'guild' && entry.stage === 'arrival') {
    const next = entry.shipmentReceipt?.next;
    requireRule(
      next === 'terror' ||
        next === 'accompany' ||
        next === 'advisor' ||
        next === 'finish',
      'The saved Guild Ambassador arrival has an invalid continuation stage.',
    );
    const { order } = guildAmbassadorArrival(g, entry.event, next);
    for (const response of relatedResponses) {
      requireRule(
        response.advisorResume === 'ambassador' &&
          response.advisorAmbassadorEvent === entry.event,
        'The saved advisor reaction has a different Guild Ambassador parent.',
      );
      try {
        if (response.kind === 'advisorFlip')
          quoteMovementCancellation(g, response);
        else if (response.kind === 'advisor')
          validateTerminalCancellation(g, response);
        else
          throw new RuleError(
            'The saved Guild Ambassador advisor response is invalid.',
          );
      } catch (error) {
        if (
          error instanceof MovementCancellationError ||
          error instanceof TerminalCancellationError
        )
          throw new RuleError(error.message);
        throw error;
      }
    }
    for (const decision of relatedDecisions)
      requireRule(
        decision.kind === 'intrusion' &&
          next === 'terror' &&
          decision.ambassadorEvent === entry.event &&
          decision.territory === order.territory &&
          getPlayer(g, decision.player).faction === 'beneGesserit' &&
          decision.player !== order.player &&
          !decision.followup &&
          !decision.wormRide,
        'This saved Intrusion does not match its Guild Ambassador arrival.',
      );
    for (const decision of advisorDecisions)
      requireRule(
        decision.kind === 'advisor' &&
          next === 'advisor' &&
          decision.ambassadorEvent === entry.event &&
          decision.shipment === order.player &&
          decision.destination === location(order.territory, order.sector) &&
          getPlayer(g, decision.player).faction === 'beneGesserit' &&
          decision.player !== order.player &&
          getPlayer(g, order.player).faction !== 'fremen',
        'This saved accompaniment does not match its Guild Ambassador shipment.',
      );
    if (relatedTerror)
      requireRule(
        terror && ambassadorTerrorEntryMatches(g, terror),
        'This saved Terror does not match its Guild Ambassador arrival.',
      );
    requireRule(
      next === 'accompany' || next === 'finish'
        ? relatedTerror
        : relatedResponses.length +
            relatedDecisions.length +
            advisorDecisions.length >
            0,
      'The saved Guild Ambassador shipment has lost its pending arrival reaction.',
    );
    return;
  }
  if (entry?.stage !== 'arrival') {
    requireRule(
      !relatedResponses.length &&
        !relatedDecisions.length &&
        !advisorDecisions.length &&
        !relatedTerror,
      'This saved arrival reaction has no completed Ambassador relocation.',
    );
    if (entry?.stage === 'move') currentFremenAmbassador(g);
    if (entry?.stage === 'ship') {
      const { beneficiary } = currentGuildAmbassador(g);
      const selections = decisions.filter(
        (decision) => decision.kind === 'ecazAmbassador',
      );
      const stops = decisions.filter(
        (decision) => decision.kind === 'guildShipment',
      );
      if (g.pendingShipment) {
        requireRule(
          g.pendingShipment.source === 'ambassador' &&
            g.phase === 5 &&
            !selections.length &&
            stops.length > 0,
          'The pending Guild Ambassador shipment has lost its shipment decision.',
        );
        for (const stop of stops) validateGuildShipmentDecision(g, stop);
      } else
        requireRule(
          !stops.length &&
            selections.length > 0 &&
            selections.every((decision) => decision.player === beneficiary.id),
          'The Guild Ambassador has lost its beneficiary shipment selection.',
        );
    }
    return;
  }
  requireRule(
    !advisorDecisions.length,
    'This Ambassador relocation cannot own an accompaniment decision.',
  );
  const next = entry.relocation?.next;
  requireRule(
    next === 'intrusion' || next === 'terror' || next === 'finish',
    'The saved Ambassador arrival has an invalid continuation stage.',
  );
  try {
    const order = validateAmbassadorRelocationContext(g, entry.event, next);
    for (const response of relatedResponses) {
      requireRule(
        response.kind === 'advisorFlip' &&
          response.advisorResume === 'ambassador',
        'This saved Ambassador advisor reaction is invalid.',
      );
      quoteMovementCancellation(g, response);
    }
    for (const decision of relatedDecisions) {
      requireRule(
        decision.kind === 'intrusion' &&
          next === 'terror' &&
          decision.ambassadorEvent === entry.event &&
          decision.territory === order.to &&
          order.origin !== order.to &&
          decision.player !== order.player &&
          getPlayer(g, decision.player).faction === 'beneGesserit' &&
          !decision.wormRide &&
          !decision.followup,
        'This saved Intrusion does not match its Ambassador arrival.',
      );
    }
    if (relatedTerror)
      requireRule(
        terror &&
          next === 'finish' &&
          terror.cause === 'ambassador' &&
          terror.resume === 'ambassador' &&
          terror.ambassadorEvent === entry.event &&
          terror.entrant === order.player &&
          terror.turn === g.turn &&
          terror.phase === g.phase &&
          terror.territory === order.to &&
          terror.sector === order.sector &&
          terror.amount === order.total &&
          terror.elite === order.elite &&
          order.origin !== order.to,
        'This saved Terror does not match its Ambassador arrival.',
      );
    requireRule(
      next === 'finish'
        ? relatedTerror
        : relatedResponses.length + relatedDecisions.length > 0,
      'The saved Ambassador arrival has lost its pending reaction.',
    );
  } catch (error) {
    if (error instanceof MovementCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function guildAmbassadorArrival(
  g: Game,
  event: string,
  next: NonNullable<
    NonNullable<Game['pendingAmbassador']>['shipmentReceipt']
  >['next'],
) {
  try {
    return validateGuildAmbassadorArrivalContext(g, event, next);
  } catch (error) {
    if (error instanceof GuildAmbassadorContinuationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function ambassadorTerrorEntryMatches(
  g: Game,
  child: NonNullable<Game['pendingTerrorEntry']>,
) {
  const parent = g.pendingAmbassador;
  if (
    !parent ||
    parent.stage !== 'arrival' ||
    child.resume !== 'ambassador' ||
    child.cause !== 'ambassador' ||
    child.ambassadorEvent !== parent.event ||
    child.turn !== g.turn ||
    child.phase !== g.phase
  )
    return false;
  if (parent.effect === 'guild') {
    const receipt = parent.shipmentReceipt;
    const order =
      receipt?.next === 'accompany'
        ? receipt.order
        : receipt?.next === 'finish'
          ? receipt.advisorArrival
          : null;
    return (
      !!order &&
      child.entrant === order.player &&
      child.territory === order.territory &&
      child.sector === order.sector &&
      child.amount === order.amount &&
      child.elite === order.elite
    );
  }
  const receipt = parent.relocation,
    order = receipt?.order;
  return (
    parent.effect === 'fremen' &&
    receipt?.next === 'finish' &&
    !!order &&
    child.entrant === order.player &&
    child.territory === order.to &&
    child.sector === order.sector &&
    child.amount === order.total &&
    child.elite === order.elite
  );
}
function currentGuildAmbassador(g: Game, event?: string) {
  const entry = g.pendingAmbassador;
  const owner = entry && g.players.find((p) => p.id === entry.owner);
  const beneficiary =
    entry && g.players.find((p) => p.id === entry.beneficiary);
  const token = g.ecazAmbassadors?.tokens.find(
    (token) => token.id === entry?.token,
  );
  const entrant = entry && g.players.find((p) => p.id === entry.entrant);
  requireRule(g.ecazAmbassadors, 'This shipment has no Ambassador inventory.');
  try {
    validateAmbassadors(g.ecazAmbassadors);
  } catch {
    throw new RuleError('This shipment has invalid Ambassador custody.');
  }
  requireRule(
    g.status === 'playing' &&
      entry &&
      owner?.faction === 'ecaz' &&
      beneficiary &&
      entrant &&
      entrant.id !== owner.id &&
      entrant.id !== beneficiary.id &&
      validLocation(entry.territory, entry.sector) &&
      territory(entry.territory).type === 'stronghold' &&
      validAmbassadorResume(g, entry) &&
      entry.relocation === undefined &&
      entry.shipmentReceipt === undefined &&
      entry.purchaseReceipt === undefined &&
      token?.effect !== entrant.faction &&
      entry.effect === 'guild' &&
      entry.stage === 'ship' &&
      entry.turn === g.turn &&
      entry.phase === g.phase &&
      ambassadorPhaseAllowed(g) &&
      (event === undefined || event === entry.event) &&
      (beneficiary.id === owner.id ||
        (owner.ally === beneficiary.id && beneficiary.ally === owner.id)) &&
      token &&
      ((token.effect === 'guild' && token.zone === 'used') ||
        (token.effect === 'beneGesserit' &&
          token.zone === 'removed' &&
          entry.copyChoices.includes('guild') &&
          !g.ecazAmbassadors.cohort.some((id) =>
            g.ecazAmbassadors!.tokens.some(
              (t) => t.id === id && t.effect === 'guild',
            ),
          ))),
    'This Guild Ambassador shipment is no longer current.',
  );
  return { entry, beneficiary };
}
function guildAmbassadorRule<T>(calculate: () => T): T {
  try {
    return calculate();
  } catch (error) {
    if (error instanceof GuildAmbassadorShipmentError)
      throw new RuleError(error.message);
    throw error;
  }
}
function quoteAmbassadorShipment(g: Game, action: Action) {
  const { beneficiary } = currentGuildAmbassador(g, stringField(action.event));
  return guildAmbassadorRule(() =>
    quoteGuildAmbassadorShipment(g, beneficiary.id, action),
  );
}
function offerAmbassadorShipment(g: Game) {
  const entry = g.pendingAmbassador!;
  entry.stage = 'ship';
  const { beneficiary } = currentGuildAmbassador(g);
  const choices = guildAmbassadorRule(() =>
    guildAmbassadorShipments(g, beneficiary.id),
  );
  if (choices.maximum && choices.destinations.length)
    g.decision = { kind: 'ecazAmbassador', player: beneficiary.id };
  else {
    log(
      g,
      `${beneficiary.name} has no legal reserve shipment through the Guild Ambassador. No forces or ordinary shipment allowance changed; the trigger remains committed.`,
    );
    finishAmbassador(g);
  }
}
function validateAmbassadorShipmentArrival(
  g: Game,
  order: GuildAmbassadorShipment,
) {
  const blocked = ambassadorRelocationArrivalBlock(
    g,
    order.player,
    'reserves',
    order.territory,
    order.amount,
  );
  requireRule(!blocked, blocked ?? 'This shipment arrival is unavailable.');
}
function validateAmbassadorShipmentOrder(g: Game, shipment: PendingShipment) {
  const { entry, beneficiary } = currentGuildAmbassador(
    g,
    shipment.ambassadorEvent,
  );
  requireRule(
    shipment.source === 'ambassador' &&
      shipment.ambassadorEvent === entry.event &&
      shipment.turn === g.turn &&
      shipment.player === beneficiary.id &&
      !shipment.noField &&
      !shipment.alliedNoField,
    'This declaration does not match its independent Guild Ambassador shipment.',
  );
  const order = quoteAmbassadorShipment(g, {
    type: 'decision',
    event: entry.event,
    amount: shipment.amount,
    elite: shipment.elite,
    territory: shipment.territory,
    sector: shipment.sector,
  });
  requireRule(
    shipment.cost === 0 &&
      shipment.allyPayment === 0 &&
      shipment.advisors === order.advisors,
    'The free shipment declaration has an invalid price or arrival stance.',
  );
  validateAmbassadorShipmentArrival(g, order);
  return order;
}
function commitAmbassadorShipment(g: Game, shipment: PendingShipment) {
  const order = validateAmbassadorShipmentOrder(g, shipment);
  const { entry, beneficiary: p } = currentGuildAmbassador(
    g,
    shipment.ambassadorEvent,
  );
  p.reserves -= order.amount;
  if (p.elites) p.elites.reserves -= order.elite;
  place(p, order.territory, order.sector, order.amount, order.elite);
  observeOccupation(g);
  if (order.advisors) (p.advisors ??= {})[order.territory] ??= {};
  if (p.faction !== 'fremen') techIncome(g, 'heighliners', p);
  entry.stage = 'arrival';
  entry.shipmentReceipt = { order, next: 'intrusion' };
  log(
    g,
    `${p.name} shipped ${order.amount} physical forces from reserves to ${territory(order.territory).name}, sector ${order.sector}, for free through the Guild Ambassador. Their ordinary shipment and movement allowances are unchanged.`,
    { faction: p.faction, name: 'Guild Ambassador shipment' },
  );
  continueGuildAmbassadorShipment(g, entry.event);
}
function continueAmbassadorArrival(g: Game, event: string) {
  if (g.pendingAmbassador?.effect === 'guild')
    continueGuildAmbassadorShipment(g, event);
  else continueAmbassadorRelocation(g, event);
}
function continueGuildAmbassadorShipment(g: Game, event: string) {
  const entry = g.pendingAmbassador;
  requireRule(
    entry?.event === event &&
      entry.stage === 'arrival' &&
      entry.effect === 'guild' &&
      entry.shipmentReceipt &&
      entry.turn === g.turn &&
      entry.phase === g.phase,
    'This Guild Ambassador arrival is no longer current.',
  );
  const receipt = entry.shipmentReceipt;
  const { order } = guildAmbassadorArrival(g, event, receipt.next);
  const p = getPlayer(g, order.player);
  if (receipt.next === 'intrusion') {
    receipt.next = 'terror';
    if (intrusion(g, p, order.territory, { ambassadorEvent: event })) return;
  }
  if (receipt.next === 'terror') {
    receipt.next = 'accompany';
    if (
      openTerrorEntry(
        g,
        p,
        order.territory,
        order.sector,
        order.amount,
        order.elite,
        'ambassador',
        'ambassador',
        event,
      )
    )
      return;
  }
  if (receipt.next === 'accompany') {
    receipt.next = 'advisor';
    const bg = byFaction(g, 'beneGesserit');
    if (p.faction !== 'fremen' && bg && bg.id !== p.id && spiritualAdvisorMaximum(g, bg.id) > 0) {
      g.decision = {
        kind: 'advisor',
        player: bg.id,
        shipment: p.id,
        destination: location(order.territory, order.sector),
        ambassadorEvent: event,
      };
      return;
    }
  }
  finishAmbassador(g);
}
function guildAdvisorAmbassador(
  g: Game,
  quote: ReturnType<typeof quoteGuildAmbassadorAdvisor>,
) {
  const owner = byFaction(g, 'ecaz');
  const token = g.ecazAmbassadors?.tokens.find(
    (token) => token.zone === 'placed' && token.location === quote.territory,
  );
  const bg = getPlayer(g, quote.player);
  return (
    !!owner &&
    !!token &&
    canTriggerAmbassador({
      owner: owner.id,
      ally: owner.ally,
      entrant: bg.id,
      entrantFaction: bg.faction,
      advisors: quote.advisors,
      effect: token.effect,
    })
  );
}
function validateGuildAdvisorEntry(
  g: Game,
  quote: ReturnType<typeof quoteGuildAmbassadorAdvisor>,
) {
  if (!guildAdvisorAmbassador(g, quote)) return;
  const moritani = byFaction(g, 'moritani'),
    bg = getPlayer(g, quote.player);
  const terror =
    moritani &&
    moritani.id !== bg.id &&
    moritani.ally !== bg.id &&
    !homeworldTerrorEntryBlock(g, quote.amount) &&
    g.moritaniTerror?.tokens.some(
      (t) => t.status === 'placed' && t.location === quote.territory,
    );
  requireRule(
    !terror,
    'Ambassadors combined with Terror on the same arrival are still being implemented. Choose another accompaniment destination or decline.',
  );
}
function guildAdvisorChoices(g: Game, player: string) {
  const decision = g.decision;
  if (
    decision?.kind !== 'advisor' ||
    decision.player !== player ||
    !decision.ambassadorEvent
  )
    return null;
  const { order } = guildAmbassadorArrival(
    g,
    decision.ambassadorEvent,
    'advisor',
  );
  const candidates = [
    ...(g.advanced
      ? territory(order.territory).sectors.map((sector) => ({
          accompany: true,
          territory: order.territory,
          sector,
          amount: 1,
        }))
      : []),
    ...Array.from({length: Math.max(1, spiritualAdvisorMaximum(g, player))}, (_, index) =>
      ({accompany: false, territory: 'polar_sink', sector: 0, amount: index + 1})),
  ];
  return {
    choices: candidates.map((choice) => {
      try {
        const quoted = guildAmbassadorRule(() =>
          quoteGuildAmbassadorAdvisor(g, player, order, {
            type: 'decision',
            ...choice,
          }),
        );
        validateGuildAdvisorEntry(g, quoted);
        return { ...choice, blocked: null as string | null };
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        return { ...choice, blocked: error.message };
      }
    }),
  };
}
function finishGuildAmbassadorAdvisor(
  g: Game,
  response: ResponseWindow,
  canceled: boolean,
) {
  const event = response.advisorAmbassadorEvent;
  requireRule(
    typeof event === 'string',
    'The accompanying advisor has lost its shipment event.',
  );
  const { order } = guildAmbassadorArrival(g, event, 'advisor');
  // Cancellation checks the committed source, not resources or destinations that
  // can change during a reaction to the declared faction power.
  try {
    validateTerminalCancellation(g, response);
  } catch (error) {
    if (error instanceof TerminalCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
  if (canceled) {
    log(
      g,
      'Karama prevented Bene Gesserit accompaniment to the Guild Ambassador shipment. The original shipment remains committed.',
    );
    finishAmbassador(g);
    return;
  }
  const at = splitLocation(response.location!);
  const quote = guildAmbassadorRule(() =>
    quoteGuildAmbassadorAdvisor(g, response.owner, order, {
      type: 'decision',
      accompany: at.territory !== 'polar_sink',
      sector: at.sector,
      territory: at.territory,
      amount: response.amount ?? 1,
    }),
  );
  validateGuildAdvisorEntry(g, quote);
  const bg = getPlayer(g, quote.player);
  withdrawNativeReserves(g, bg, quote.amount, 0);
  place(bg, quote.territory, quote.sector, quote.amount);
  techIncome(g, 'heighliners', bg);
  if (quote.advisors)
    (bg.advisors ??= {})[quote.territory] = { lockedTurn: g.turn };
  const receipt = g.pendingAmbassador!.shipmentReceipt!;
  receipt.next = 'finish';
  receipt.advisorArrival = {
    player: bg.id,
    territory: quote.territory,
    sector: quote.sector,
    amount: quote.amount,
    elite: 0,
  };
  log(
    g,
    `${bg.name} sent ${quote.amount} free reserve ${quote.amount === 1 ? 'force' : 'forces'} to ${territory(quote.territory).name}, sector ${quote.sector}, after the Guild Ambassador shipment${quote.amount === 2 ? ' using high-population Wallach IX' : ''}.`,
    { faction: bg.faction, name: 'Spiritual Advisors' },
  );
  if (guildAdvisorAmbassador(g, quote)) {
    const parent = g.pendingAmbassador!;
    const arrivalTag = parent.revivalEvent !== undefined ? 'revivalEvent' :
      parent.victoryEvent !== undefined ? 'victoryEvent' : undefined;
    const arrival = arrivalTag === 'revivalEvent' ? g.homeworldRevivalReturn :
      arrivalTag === 'victoryEvent' ? g.homeworldVictoryReinforcement : undefined;
    if (arrivalTag !== undefined)
      requireRule(arrival && ambassadorPhaseAllowed(g),
        'This Ambassador accompaniment has lost its original Homeworld arrival.');
    const resume = parent.resume;
    const wormRider =
      parent.wormRider ?? (resume === 'wormRide' ? parent.entrant : undefined);
    // Accompaniment is the final suffix: transfer its outer continuation rather
    // than replaying or retaining the completed Guild shipment.
    finishAmbassador(g, true);
    requireRule(
      openTerritoryEntry(
        g,
        bg,
        quote.territory,
        quote.sector,
        quote.amount,
        0,
        'advisor',
        resume,
      ),
      'The accompanying fighter has lost its Ambassador opportunity.',
    );
    g.pendingAmbassador!.wormRider = wormRider;
    g.pendingAmbassador!.guildAdvisorOrigin = {
      event,
      player: order.player,
      territory: order.territory,
      sector: order.sector,
    };
    if (arrival && arrivalTag) {
      requireRule(validAmbassadorResume(g, g.pendingAmbassador!),
        'The accompanying Ambassador has lost its completed Guild shipment.');
      g.pendingAmbassador![arrivalTag] = arrival.event;
      appendHomeworldArrivalAmbassador(arrival, g.pendingAmbassador!, parent.event);
    }
  } else if (
    !openTerrorEntry(
      g,
      bg,
      quote.territory,
      quote.sector,
      quote.amount,
      0,
      'ambassador',
      'ambassador',
      event,
    )
  )
    finishAmbassador(g);
}
function quoteAmbassadorRelocation(g: Game, action: Action) {
  const { beneficiary } = currentFremenAmbassador(g, stringField(action.event));
  try {
    return quoteFremenAmbassadorMove(g, beneficiary.id, action);
  } catch (error) {
    if (error instanceof FremenAmbassadorMoveError)
      throw new RuleError(error.message);
    throw error;
  }
}
function offerAmbassadorRelocation(g: Game) {
  const entry = g.pendingAmbassador!;
  entry.stage = 'move';
  const { beneficiary } = currentFremenAmbassador(g);
  if (fremenAmbassadorMovement(g, beneficiary.id).sources.length) {
    g.decision = { kind: 'ecazAmbassador', player: beneficiary.id };
  } else {
    log(
      g,
      `${beneficiary.name} has no legal Fremen Ambassador relocation. No forces or ordinary movement allowances changed; the trigger remains committed.`,
    );
    finishAmbassador(g);
  }
}
function ambassadorRelocationArrivalBlock(
  g: Game,
  player: string,
  origin: string,
  to: string,
  entering: number,
): string | null {
  const mover = getPlayer(g, player);
  if (origin === to) return null;
  const bg = byFaction(g, 'beneGesserit');
  const moritani = byFaction(g, 'moritani');
  const intrudes =
    g.advanced && bg && bg.id !== mover.id && fighterCount(bg, to) > 0;
  const terror =
    moritani &&
    mover.id !== moritani.id &&
    mover.id !== moritani.ally &&
    !homeworldTerrorEntryBlock(g, entering) &&
    g.moritaniTerror?.tokens.some(
      (token) => token.status === 'placed' && token.location === to,
    );
  return intrudes && terror
    ? 'The order of simultaneous Intrusion and Terror is awaiting a table interpretation. This relocation has not been committed.'
    : null;
}
function validateAmbassadorRelocationArrival(
  g: Game,
  move: FremenAmbassadorMove,
) {
  const blocked = ambassadorRelocationArrivalBlock(
    g,
    move.player,
    move.origin,
    move.to,
    move.total,
  );
  requireRule(!blocked, blocked ?? 'This arrival is unavailable.');
}
function ambassadorArrivalChoices(g: Game, player: string, origin: string, to: string) {
  const blocked = ambassadorRelocationArrivalBlock(g, player, origin, to, 1);
  const largerBlocked = ambassadorRelocationArrivalBlock(g, player, origin, to, 3);
  return { blocked, maximum: !blocked && largerBlocked ? 2 : null };
}
function ambassadorRelocationMovement(g: Game, player: string) {
  return {
    sources: fremenAmbassadorMovement(g, player).sources.map((source) => ({
      ...source,
      destinations: source.destinations.map((destination) => ({
        ...destination,
        ...ambassadorArrivalChoices(
          g,
          player,
          source.territory,
          destination.territory,
        ),
      })),
    })),
  };
}
function commitAmbassadorRelocation(g: Game, move: FremenAmbassadorMove) {
  const { entry, beneficiary: p } = currentFremenAmbassador(g);
  validateAmbassadorRelocationArrival(g, move);
  if (move.noField) {
    requireRule(
      p.noField && p.noFieldEvent === move.noField.event,
      'The concealed marker selection is no longer current.',
    );
    p.noField = noFieldRule(() =>
      moveRicheseNoField(p.noField!, move.noField!.tokenId, {
        territory: move.to,
        sector: move.sector,
      }),
    );
    p.noFieldEvent = crypto.randomUUID();
  }
  removeGroup(p, move.group, move.eliteGroup);
  const physical = move.total - (move.noField ? 1 : 0);
  if (physical) place(p, move.to, move.sector, physical, move.elite);
  if (move.advisors)
    (p.advisors ??= {})[move.to] = {
      lockedTurn:
        Math.max(
          move.lockedTurn ?? 0,
          p.advisors?.[move.to]?.lockedTurn ?? 0,
        ) || undefined,
    };
  else if (p.advisors) delete p.advisors[move.to];
  entry.stage = 'arrival';
  entry.relocation = { order: move, next: 'flip' };
  log(
    g,
    `${p.name} relocated ${physical} physical forces${move.noField ? ' and a concealed No-Field' : ''} from ${territory(move.origin).name} to ${territory(move.to).name}, sector ${move.sector}, through the Fremen Ambassador. Their ordinary shipment and movement allowances are unchanged.`,
    { faction: p.faction, name: 'Fremen Ambassador relocation' },
  );
  continueAmbassadorRelocation(g, entry.event);
}
function continueAmbassadorRelocation(g: Game, event: string) {
  const { entry, beneficiary: p } = currentFremenAmbassador(g, event, true);
  const receipt = entry.relocation!,
    move = receipt.order;
  if (receipt.next !== 'flip') {
    try {
      validateAmbassadorRelocationContext(g, event, receipt.next);
    } catch (error) {
      if (error instanceof MovementCancellationError)
        throw new RuleError(error.message);
      throw error;
    }
  }
  if (receipt.next === 'flip') {
    receipt.next = 'intrusion';
    if (move.wantsFighters) {
      g.response = {
        kind: 'advisorFlip',
        owner: p.id,
        location: move.to,
        advisors: false,
        passed: [],
        advisorResume: 'ambassador',
        advisorAmbassadorEvent: event,
      };
      return;
    }
  }
  if (receipt.next === 'intrusion') {
    receipt.next = 'terror';
    if (
      move.origin !== move.to &&
      intrusion(g, p, move.to, { ambassadorEvent: event })
    )
      return;
  }
  if (receipt.next === 'terror') {
    receipt.next = 'finish';
    if (
      move.origin !== move.to &&
      openTerrorEntry(
        g,
        p,
        move.to,
        move.sector,
        move.total,
        move.elite,
        'ambassador',
        'ambassador',
        event,
      )
    )
      return;
  }
  finishAmbassador(g);
}
/** These are consequences of a completed purchase, never an auction lot. */
function validateAmbassadorPurchaseResponse(g: Game, response: ResponseWindow) {
  const entry = g.pendingAmbassador;
  const receipt = entry?.purchaseReceipt;
  const token = g.ecazAmbassadors?.tokens.find((t) => t.id === entry?.token);
  requireRule(
    response.source === 'ambassador' &&
      (response.kind === 'emperorIncome' ||
        response.kind === 'harkonnenBonus') &&
      g.status === 'playing' &&
      entry &&
      receipt &&
      entry.turn === g.turn &&
      entry.phase === g.phase &&
      ambassadorPhaseAllowed(g) &&
      response.intent === entry.event &&
      entry.effect === 'richese' &&
      entry.beneficiary === receipt.buyer &&
      receipt.amount === 3 &&
      typeof receipt.card === 'string' &&
      !!receipt.card &&
      entry.stage === receipt.stage &&
      byFaction(g, 'ecaz')?.id === entry.owner &&
      g.players.some((p) => p.id === entry.entrant) &&
      token &&
      ((token.effect === 'richese' && token.zone === 'used') ||
        (token.effect === 'beneGesserit' &&
          token.zone === 'removed' &&
          entry.copyChoices.includes('richese'))),
    'This Ambassador purchase continuation is no longer current.',
  );
  const buyer = getPlayer(g, receipt.buyer);
  const emperor = byFaction(g, 'emperor');
  requireRule(
    receipt.emperor ===
      (emperor && emperor.id !== buyer.id ? emperor.id : null),
    'This Ambassador purchase has an invalid income recipient.',
  );
  requireRule(
    response.kind === 'emperorIncome'
      ? entry.stage === 'income' &&
          response.owner === receipt.emperor &&
          response.amount === 3
      : entry.stage === 'bonus' &&
          response.owner === buyer.id &&
          buyer.faction === 'harkonnen',
    'This faction benefit does not belong to the current Ambassador purchase.',
  );
  return { entry, receipt, buyer };
}
function ambassadorPurchaseBonus(g: Game) {
  const entry = g.pendingAmbassador!;
  const receipt = entry.purchaseReceipt!;
  const buyer = getPlayer(g, receipt.buyer);
  if (buyer.faction === 'harkonnen' && buyer.hand.length < handLimit(buyer)) {
    entry.stage = receipt.stage = 'bonus';
    g.response = {
      kind: 'harkonnenBonus',
      source: 'ambassador',
      intent: entry.event,
      owner: buyer.id,
      passed: [],
    };
  } else finishAmbassador(g);
}
/** The payer has already paid. Only credit the eligible faction share once. */
function creditFactionPayment(g: Game, ownerId: string, kind: 'shipment' | 'treachery', gross: number) {
  const payment = homeworldRule(() => quoteHomeworldPaymentIncome(g, ownerId, kind, gross));
  const owner = getPlayer(g, ownerId);
  requireRule(Number.isSafeInteger(owner.spice + payment.income), 'The faction payment would overflow its spice balance.');
  owner.spice += payment.income;
  return payment;
}
function currentFactionPayment(g: Game) {
  const response = g.response;
  if (!g.homeworlds?.custody || !response) return null;
  const kind = response.kind === 'guildIncome' ? 'shipment' :
    ['emperorIncome', 'richesePurchaseIncome'].includes(response.kind) ? 'treachery' : null;
  if (!kind) return null;
  if (response.kind === 'emperorIncome' && response.source === 'ambassador')
    validateAmbassadorPurchaseResponse(g, response);
  if (response.kind === 'richesePurchaseIncome') {
    const pending = g.pendingRichesePurchaseIncome;
    requireRule(pending && pending.owner === response.owner && pending.turn === g.turn &&
      pending.phase === g.phase && response.amount === 3,
      'This Richese purchase income is no longer current.');
  }
  const gross = response.kind === 'emperorIncome'
    ? response.source === 'ambassador' ? response.amount! : g.currentAuctionSale?.amount ?? g.auction?.bid
    : response.amount;
  requireRule(gross !== undefined, 'The faction payment is missing its original amount.');
  if (kind === 'shipment' &&
    (Object.hasOwn(response, 'guildContributions') || Object.hasOwn(response, 'guildPaymentProof'))) {
    requireRule(Array.isArray(response.guildContributions) &&
      response.guildPaymentProof === guildPaymentSignature(g, response.owner, gross, response.guildContributions),
      'The saved Guild payment no longer matches its original contributor receipt.');
    validateGuildPaymentRounding(g, response.owner, gross, response.guildContributions);
  }
  return { owner: response.owner, kind,
    ...homeworldRule(() => quoteHomeworldPaymentIncome(g, response.owner, kind, gross)) };
}
function validateGuildPaymentRounding(g: Game, owner: string, gross: number, contributions: number[]) {
  if (!g.homeworlds?.custody) return;
  const rounding = homeworldRule(() => quoteGuildPaymentRounding(gross, contributions));
  const payment = homeworldRule(() => quoteHomeworldPaymentIncome(g, owner, 'shipment', gross));
  requireRule(!payment.low || rounding.unambiguous,
    'Low Junction rounding for two odd allied contributions awaits a ruling. Choose a different payment split.');
}
function shipmentIncomeContributions(g: Game, p: Player, cost: number, allyPayment: number) {
  const guild = byFaction(g, 'guild');
  if (!guild || g.karamaShipping?.player === p.id) return [];
  return [p.id === guild.id ? 0 : cost - allyPayment,
    p.ally === guild.id ? 0 : allyPayment].filter(amount => amount > 0);
}
function checkShipmentIncomeRounding(g: Game, p: Player, cost: number, allyPayment: number) {
  const guild = byFaction(g, 'guild');
  if (!guild) return;
  const amounts = shipmentIncomeContributions(g, p, cost, allyPayment);
  validateGuildPaymentRounding(g, guild.id, amounts.reduce((sum, amount) => sum + amount, 0), amounts);
}
function guildPaymentResponse(g: Game, owner: string, amounts: number[]): ResponseWindow {
  const contributions = amounts.filter(amount => amount > 0);
  const amount = contributions.reduce((sum, value) => sum + value, 0);
  validateGuildPaymentRounding(g, owner, amount, contributions);
  return { kind: 'guildIncome', owner, amount, passed: [],
    ...(g.homeworlds?.custody ? { guildContributions: contributions,
      guildPaymentProof: guildPaymentSignature(g, owner, amount, contributions) } : {}) };
}
function guildPaymentSignature(g: Game, owner: string, amount: number, contributions: number[]) {
  return JSON.stringify({ turn: g.turn, phase: g.phase, owner, amount, contributions });
}
function finishAmbassadorPurchaseResponse(
  g: Game,
  response: ResponseWindow,
  canceled: boolean,
) {
  const { receipt, buyer } = validateAmbassadorPurchaseResponse(g, response);
  if (response.kind === 'emperorIncome') {
    const payment = !canceled ? creditFactionPayment(g, response.owner, 'treachery', receipt.amount) : null;
    log(
      g,
      canceled
        ? 'Karama prevented Emperor income from the Richese Ambassador purchase. The three-spice payment stays in the bank; the buyer keeps the card.'
        : `${getPlayer(g, response.owner).name} collected ${payment!.income} spice from the three-spice Richese Ambassador purchase payment.${payment!.bank ? ` Low-population Kaitain leaves ${payment!.bank} spice in the bank.` : ''}`,
      {
        faction: 'emperor',
        name: canceled ? 'Purchase income prevented' : 'Card purchase income',
      },
    );
    ambassadorPurchaseBonus(g);
  } else {
    const bonus =
      !canceled && buyer.hand.length < handLimit(buyer) ? draw(g) : undefined;
    if (bonus) buyer.hand.push(bonus);
    log(
      g,
      canceled
        ? 'Karama prevented the Harkonnen bonus card from the Richese Ambassador purchase. The paid card remains with its buyer.'
        : bonus
          ? `${buyer.name} drew a private Harkonnen bonus Treachery Card after the Richese Ambassador purchase.`
          : `${buyer.name} received no Harkonnen bonus card because their hand has no room or the deck has no available card.`,
      {
        faction: 'harkonnen',
        name: canceled ? 'Bonus card prevented' : 'Bonus treachery card',
      },
    );
    finishAmbassador(g);
  }
}
function resolveAmbassadorEffect(g: Game) {
  const entry = g.pendingAmbassador!;
  const p = getPlayer(g, entry.beneficiary!);
  const entrant = getPlayer(g, entry.entrant);
  const effect = entry.effect!;
  requireRule(
    effect !== 'ecaz',
    'Choose the Ecaz Ambassador’s direct Duke acquisition from its current offer.',
  );
  const blocked = ambassadorEffectBlock(g, effect, p, entrant);
  requireRule(!blocked, blocked ?? 'This Ambassador effect is unavailable.');
  if (effect === 'beneGesserit') {
    entry.stage = 'copy';
    g.decision = { kind: 'ecazAmbassador', player: p.id };
    return;
  }
  if (effect === 'guild') {
    offerAmbassadorShipment(g);
    return;
  }
  if (effect === 'fremen') {
    offerAmbassadorRelocation(g);
    return;
  }
  if (effect === 'richese') {
    // Resolve after commitment so Ecaz cannot probe its ally's private funds.
    if (
      p.spice < 3 ||
      p.hand.length >= handLimit(p) ||
      (!g.deck.length && !g.discard.length)
    ) {
      log(
        g,
        `${p.name} received no card through the Richese Ambassador. No spice was charged; the trigger remains committed.`,
      );
      finishAmbassador(g);
      return;
    }
    const card = draw(g);
    requireRule(
      card,
      'No Treachery Card is available for the Ambassador purchase.',
    );
    p.spice -= 3;
    p.hand.push(card);
    const emperor = byFaction(g, 'emperor');
    entry.purchaseReceipt = {
      buyer: p.id,
      card: card.id,
      amount: 3,
      emperor: emperor && emperor.id !== p.id ? emperor.id : null,
      stage: 'income',
    };
    log(
      g,
      `${p.name} paid 3 spice and drew the top Treachery Card through the Richese Ambassador. Its identity remains private.`,
      { faction: p.faction, name: 'Richese Ambassador purchase' },
    );
    if (entry.purchaseReceipt.emperor) {
      entry.stage = 'income';
      g.response = {
        kind: 'emperorIncome',
        source: 'ambassador',
        intent: entry.event,
        owner: entry.purchaseReceipt.emperor,
        amount: 3,
        passed: [],
      };
    } else ambassadorPurchaseBonus(g);
    return;
  }
  if (
    effect === 'ixians' ||
    (effect === 'choam' && p.hand.some((c) => !ambassadorDiscardBlock(g, p, c, effect)))
  ) {
    entry.stage = 'cards';
    g.decision = { kind: 'ecazAmbassador', player: p.id };
    return;
  }
  if (effect === 'emperor') {
    p.spice += 5;
    log(
      g,
      `${p.name} gained 5 spice from the Spice Bank through the Emperor Ambassador.`,
      { faction: p.faction, name: 'Emperor Ambassador' },
    );
  } else if (effect === 'atreides' || effect === 'harkonnen') {
    const held =
      entrant.faction === 'tleilaxu'
        ? (entrant.faceDancers ?? []).map((c) => c.leader)
        : entrant.traitors;
    (g.ambassadorInsights ??= []).push({
      event: entry.event,
      viewer: p.id,
      target: entrant.id,
      turn: g.turn,
      effect,
      cards: effect === 'atreides' ? structuredClone(entrant.hand) : [],
      traitor:
        effect === 'harkonnen'
          ? held[Math.floor(random() * held.length)]
          : null,
    });
    log(
      g,
      `${p.name} privately inspected ${effect === 'atreides' ? `${entrant.name}’s current Treachery hand` : `one random Traitor Card held by ${entrant.name}`} through the ${faction(effect).name} Ambassador. This records only what was held at this moment.`,
      { faction: p.faction, name: `${faction(effect).name} Ambassador` },
    );
  } else if (effect === 'choam') {
    log(
      g,
      `${p.name} had no available Treachery cards to discard through the CHOAM Ambassador and gained no spice.`,
    );
  }
  finishAmbassador(g);
}
function ecazAllianceQuote(g: Game, owner: string, entrant: string) {
  const blocked = homeworldAllianceReason(g, owner, entrant);
  requireRule(!blocked, blocked ?? 'This alliance is unavailable.');
  try {
    return quoteEcazAlliance(g, owner, entrant);
  } catch (error) {
    if (error instanceof EcazAllianceError) throw new RuleError(error.message);
    throw error;
  }
}
function ecazAllianceIntegrity(g: Game) {
  const entry = g.pendingAmbassador;
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const controls = [
    g,
    g.pendingExchange,
    g.pendingRicheseGift?.resume,
    g.pendingNullentropy?.resume,
    g.pendingRichesePurchaseIncome?.resume,
    g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null,
  ];
  if (!entry) {
    requireRule(
      !controls.some((control) => control?.decision?.kind === 'ecazAmbassador'),
      'The Ambassador decision has lost its entry event.',
    );
    return;
  }
  if (entry.stage !== 'allianceReply') return;
  const token = g.ecazAmbassadors?.tokens.find((t) => t.id === entry.token);
  requireRule(
    g.status === 'playing' &&
      entry.turn === g.turn &&
      entry.phase === g.phase &&
      ambassadorPhaseAllowed(g) &&
      typeof entry.event === 'string' &&
      entry.event.length > 0 &&
      entry.effect === 'ecaz' &&
      entry.beneficiary === entry.entrant &&
      token?.effect === 'ecaz' &&
      token.zone === 'supply' &&
      token.location === null &&
      controls.some(
        (control) =>
          control?.decision?.kind === 'ecazAmbassador' &&
          control.decision.player === entry.entrant,
      ),
    'The Ecaz alliance reply has lost its original Ambassador or decision owner.',
  );
  ecazAllianceQuote(g, entry.owner, entry.entrant);
}
function decideAmbassador(g: Game, p: Player, action: Action) {
  const entry = g.pendingAmbassador;
  requireRule(
    entry &&
      entry.turn === g.turn &&
      entry.phase === g.phase &&
      action.event === entry.event,
    'This Ambassador opportunity is no longer current.',
  );
  const owner = getPlayer(g, entry.owner),
    entrant = getPlayer(g, entry.entrant);
  requireRule(
    p.id === (entry.stage === 'offer' ? owner.id : entry.beneficiary),
    'The Ambassador choice belongs to another player.',
  );
  if (entry.stage === 'allianceReply') {
    requireRule(
      typeof action.accept === 'boolean',
      'Accept or refuse the Ecaz alliance offer.',
    );
    const quote = ecazAllianceQuote(g, owner.id, entrant.id);
    if (action.accept) {
      for (const member of quote.players) {
        if (member.id !== owner.id && member.id !== entrant.id) continue;
        const target = getPlayer(g, member.id);
        target.ally = member.ally;
        target.allySinceTurn = member.allySinceTurn;
      }
      g.allianceOffers = quote.allianceOffers;
      discardAllianceNexusCards(g, owner, entrant);
      g.ready = [];
      log(
        g,
        `${owner.name} and ${entrant.name} formed an alliance through the Ecaz Ambassador. Both were unallied and ${entrant.name} accepted. Their alliance abilities apply immediately; the entrant’s remaining actions resume.`,
        { faction: 'ecaz', name: 'Ambassador alliance' },
      );
    } else
      log(
        g,
        `${entrant.name} refused the Ecaz Ambassador alliance. No alliance or Duke transfer occurred; the triggered token remains in Ecaz’s supply and the entrant’s remaining actions resume.`,
      );
    finishAmbassador(g);
    return;
  }
  if (entry.stage === 'offer') {
    const token = g.ecazAmbassadors?.tokens.find((t) => t.id === entry.token);
    requireRule(
      token?.zone === 'placed' && token.location === entry.territory,
      'The Ambassador is no longer in that stronghold.',
    );
    if (action.decline === true) {
      log(
        g,
        `${owner.name} left the ${faction(token.effect).name} Ambassador in ${territory(entry.territory).name} without triggering it.`,
      );
      finishAmbassador(g);
      return;
    }
    requireRule(
      action.trigger === true,
      'Trigger the Ambassador or leave it in place.',
    );
    if (token.effect === 'ecaz' && action.choice === 'alliance') {
      requireRule(
        action.beneficiary === owner.id,
        'Ecaz must offer its own Ambassador alliance.',
      );
      ecazAllianceQuote(g, owner.id, entrant.id);
      requireRule(
        canTriggerAmbassador({
          owner: owner.id,
          ally: owner.ally,
          entrant: entrant.id,
          entrantFaction: entrant.faction,
          advisors: isAdvisor(entrant, entry.territory),
          effect: token.effect,
        }),
        'This entrant cannot trigger the Ecaz Ambassador.',
      );
      entry.effect = 'ecaz';
      entry.beneficiary = entrant.id;
      entry.stage = 'allianceReply';
      g.ecazAmbassadors = triggerAmbassador(g.ecazAmbassadors!, token.id);
      g.decision = { kind: 'ecazAmbassador', player: entrant.id };
      log(
        g,
        `${owner.name} offered an alliance to ${entrant.name} through the Ecaz Ambassador. The reusable token returned to supply; the five random Ambassadors are unchanged. Only the entrant can accept or refuse. Duke Vidal has not changed hands.`,
      );
      return;
    }
    const beneficiary = getPlayer(g, stringField(action.beneficiary));
    requireRule(
      beneficiary.id === owner.id ||
        (beneficiary.id === owner.ally && beneficiary.ally === owner.id),
      'Choose Ecaz or its current ally as beneficiary.',
    );
    const blocked = ambassadorEffectBlock(
      g,
      token.effect,
      beneficiary,
      entrant,
    );
    requireRule(!blocked, blocked ?? 'This effect is unavailable.');
    if (token.effect === 'beneGesserit')
      requireRule(
        entry.copyChoices.some(
          (effect) => !ambassadorEffectBlock(g, effect, beneficiary, entrant),
        ),
        'No copied effect is currently available.',
      );
    let acquiredDuke: DukeState | null = null;
    if (token.effect === 'ecaz') {
      requireRule(
        action.choice === 'duke' && beneficiary.id === owner.id,
        'Choose the Ecaz Ambassador’s direct acquisition of Duke Vidal for Ecaz.',
      );
      requireRule(
        canTriggerAmbassador({
          owner: owner.id,
          ally: owner.ally,
          entrant: entrant.id,
          entrantFaction: entrant.faction,
          advisors: isAdvisor(entrant, entry.territory),
          effect: token.effect,
        }),
        'This entrant cannot trigger the Ecaz Ambassador.',
      );
      try {
        acquiredDuke = quoteEcazDukeAcquisition(g, owner.id);
      } catch (error) {
        if (error instanceof EcazDukeAcquisitionError)
          throw new RuleError(error.message);
        throw error;
      }
    }
    entry.beneficiary = beneficiary.id;
    entry.effect = token.effect;
    g.ecazAmbassadors = triggerAmbassador(g.ecazAmbassadors!, token.id);
    log(
      g,
      `${owner.name} triggered the ${faction(token.effect).name} Ambassador for ${beneficiary.name}. ${token.effect === 'ecaz' ? 'The reusable Ecaz token returned to supply; the five random Ambassadors are unchanged.' : token.effect === 'beneGesserit' ? 'The Bene Gesserit token was permanently removed.' : 'The token was set aside until the five random Ambassadors have all been triggered.'}`,
    );
    if (acquiredDuke) {
      const previous = g.dukeVidal!.controller;
      g.dukeVidal = acquiredDuke;
      log(
        g,
        `${owner.name} acquired Duke Prad Vidal${previous ? ` from ${getPlayer(g, previous).name}` : ''} through the Ecaz Ambassador. Ecaz keeps the shared Duke until battle use or Moritani acquisition; the entrant’s remaining actions resume.`,
        { faction: owner.faction, name: 'Ecaz Ambassador — Duke Vidal' },
      );
      finishAmbassador(g);
    } else resolveAmbassadorEffect(g);
  } else if (entry.stage === 'copy') {
    const effect = stringField(action.effect) as AmbassadorEffect;
    requireRule(
      entry.copyChoices.includes(effect),
      'Copy an Ambassador outside the original supply for this cycle.',
    );
    entry.effect = effect;
    resolveAmbassadorEffect(g);
  } else if (entry.stage === 'ship') {
    currentGuildAmbassador(g, stringField(action.event));
    if (action.amount === 0) {
      requireRule(
        action.noField === undefined && action.alliedNoField === undefined,
        'Choose physical reserve forces for this shipment.',
      );
      log(
        g,
        `${p.name} chose to send no reserve forces through the Guild Ambassador. The trigger remains committed and their ordinary shipment is unchanged.`,
      );
      finishAmbassador(g);
    } else {
      const order = quoteAmbassadorShipment(g, action);
      validateAmbassadorShipmentArrival(g, order);
      offerShipment(g, {
        ...order,
        turn: g.turn,
        source: 'ambassador',
        ambassadorEvent: entry.event,
      });
    }
  } else if (entry.stage === 'move') {
    const move = quoteAmbassadorRelocation(g, action);
    validateAmbassadorRelocationArrival(g, move);
    offerChoamMovement(g, {
      ...move,
      source: 'ambassador',
      ambassadorEvent: entry.event,
    });
  } else {
    requireRule(
      entry.effect === 'choam' || entry.effect === 'ixians',
      'This Ambassador has no card selection.',
    );
    requireRule(
      Array.isArray(action.cards) &&
        action.cards.every((id) => typeof id === 'string') &&
        new Set(action.cards).size === action.cards.length,
      'Choose distinct owned Treachery cards.',
    );
    const ids = action.cards as string[];
    requireRule(
      entry.effect !== 'ixians' || ids.length === 1,
      'Discard exactly one card for the Ixian Ambassador.',
    );
    for (const id of ids) {
      const card = p.hand.find((c) => c.id === id);
      requireRule(card, 'Choose a card in your own hand.');
      const blocked = ambassadorDiscardBlock(g, p, card, entry.effect);
      requireRule(!blocked, blocked ?? 'This card cannot be discarded.');
    }
    const entries = ids.map((id) => ({
      card: discard(g, p, id),
      discardedBy: p.id,
      publicFace: false,
    }));
    if (entry.effect === 'choam') {
      p.spice += ids.length * 3;
      log(
        g,
        `${p.name} discarded ${ids.length} Treachery cards and gained ${ids.length * 3} bank spice through the CHOAM Ambassador.`,
        ids.length
          ? { faction: p.faction, name: 'CHOAM Ambassador' }
          : undefined,
      );
    }
    if (!entries.length) finishAmbassador(g);
    else {
      g.pendingAmbassador = null;
      stageTreacheryDiscard(g, `ambassador:${entry.effect}`, entries, {
        kind: 'ambassador',
        entry,
      });
    }
  }
}

/** Card interruptions keep the live entry; fresh discard owns its one suspended copy. */
function terrorEntryIntegrity(g: Game) {
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const entries = [g.pendingTerrorEntry,
    continuation?.kind === 'terrorDiscard' ? continuation.entry : null];
  for (const entry of entries) {
    if (!entry) continue;
    homeworldRule(() => validateTerrorEntrySignature(entry));
    if (entry.entrySignature === undefined) continue;
    requireRule(entry.turn === g.turn && entry.phase === g.phase &&
      g.players.some((p) => p.id === entry.entrant && p.faction !== 'moritani') &&
      g.players.filter((p) => p.faction === 'moritani').length === 1,
      'The saved Terror entry has lost its original turn or seated participants.');
    if (entry.candidates) {
      const committedDiscard = continuation?.kind === 'terrorDiscard' && entry === continuation.entry;
      const reserved = entry.candidates.filter((id) => id !== entry.token ||
        (!committedDiscard && ['select', 'offer', 'allianceResponse', 'allianceReply'].includes(entry.stage)));
      requireRule(reserved.every((id) => g.moritaniTerror?.tokens.filter((token) =>
        token.id === id && token.status === 'placed' && token.location === entry.territory).length === 1),
        'The stacked Terror choice has lost an original reserved token.');
      if (committedDiscard)
        requireRule(g.moritaniTerror?.tokens.some((token) => token.id === entry.token && token.status === 'removed'),
          'The stacked Terror discard has lost its consumed token.');
    }
  }
}
/** Public original batch size; concealed No-Field markers count as one. */
function homeworldTerrorEntryBlock(g: Game, entering: number): string | null {
  const owner = byFaction(g, 'moritani');
  return owner
    ? homeworldRule(() => lowGrummanRevealBlock(g, owner.id, entering))
    : null;
}
/** Entry is already paid and committed; a reaction must never replay its original action. */
function openTerrorEntry(
  g: Game,
  entrant: Player,
  to: string,
  sector: number,
  amount: number,
  elite: number,
  cause: NonNullable<Game['pendingTerrorEntry']>['cause'],
  resume: 'none' | 'wormRide' | 'ambassador' = 'none',
  ambassadorEvent?: string,
) {
  const moritani = byFaction(g, 'moritani');
  const tokens = g.moritaniTerror?.tokens.filter(
    (t) => t.status === 'placed' && t.location === to,
  ) ?? [];
  const token = tokens[0];
  if (
    !moritani ||
    !token ||
    entrant.id === moritani.id ||
    entrant.id === moritani.ally ||
    homeworldTerrorEntryBlock(g, amount)
  )
    return false;
  requireRule(!g.pendingTerrorEntry, 'Resolve the pending Terror entry first.');
  requireRule(
    !g.response && !g.decision,
    'Terror combined with another arrival reaction is still being implemented. This entry has not been committed.',
  );
  g.pendingTerrorEntry = {
    token: token.id,
    ...(tokens.length > 1 ? { candidates: tokens.map((t) => t.id) } : {}),
    entrant: entrant.id,
    territory: to,
    sector,
    amount,
    elite,
    cause,
    turn: g.turn,
    phase: g.phase,
    stage: tokens.length > 1 ? 'select' : 'offer',
    resume,
    ...(ambassadorEvent ? { ambassadorEvent } : {}),
  };
  g.pendingTerrorEntry.entrySignature = terrorEntrySignature(g.pendingTerrorEntry);
  g.decision = {
    kind: 'moritaniTerror',
    player: moritani.id,
    entrant: entrant.id,
    territory: to,
  };
  log(
    g,
    `${moritani.name} may reveal a Terror token after ${entrant.name} entered ${territory(to).name}.`,
  );
  return true;
}
function finishTerrorEntry(g: Game) {
  const pending = g.pendingTerrorEntry!;
  g.pendingTerrorEntry = null;
  if (pending.resume === 'wormRide') nextWormRide(g);
  else if (pending.resume === 'ambassador')
    continueAmbassadorArrival(g, pending.ambassadorEvent!);
}
/** The token, random victim/draw, discard and arrival have already committed. */
function continueTerrorDiscard(
  g: Game,
  source: 'sabotage' | 'robberyOverflow',
) {
  const entry = g.pendingTerrorEntry!;
  const owner = byFaction(g, 'moritani')!;
  const needsChoice =
    source === 'sabotage'
      ? owner.hand.length > 0
      : owner.hand.length > handLimit(owner);
  if (needsChoice) {
    entry.stage = source === 'sabotage' ? 'gift' : 'discard';
    g.decision = {
      kind: 'moritaniTerror',
      player: owner.id,
      entrant: entry.entrant,
      territory: entry.territory,
    };
  } else finishTerrorEntry(g);
}
/** Keep unsupported custody out of the random draw, without leaking concealed captures. */
function terrorRevealBlocked(
  g: Game,
  entry: NonNullable<Game['pendingTerrorEntry']>,
  kind: TerrorKind,
): string | null {
  const homeworldBlock = homeworldTerrorEntryBlock(g, entry.amount);
  if (homeworldBlock) return homeworldBlock;
  if (kind === 'robbery' || kind === 'sabotage' || kind === 'sneakAttack')
    return null;
  if (kind !== 'assassination')
    return 'This Terror effect is still being implemented.';
  if (g.advanced && byFaction(g, 'harkonnen'))
    return 'Assassination with advanced Harkonnen capture is still being implemented.';
  const entrant = getPlayer(g, entry.entrant);
  if (g.dukeVidal?.controller === entrant.id)
    return 'Assassination with Duke Vidal in the leader pool is still being implemented.';
  const catalog = leaders(entrant.faction);
  if (
    catalog.length !== 5 ||
    entrant.leaders.length !== catalog.length ||
    new Set(entrant.leaders.map((leader) => leader.id)).size !==
      catalog.length ||
    entrant.leaders.some(
      (leader) =>
        !catalog.some(
          (native) =>
            native.id === leader.id &&
            native.faction === leader.faction &&
            native.strength === leader.strength,
        ),
    )
  )
    return 'Assassination requires a verified ordinary leader pool; this pool is still being implemented.';
  if (
    entrant.leaders.some((leader) => leader.capturedBy || leader.gholaBy) ||
    g.players.some(
      (other) =>
        other.id !== entrant.id &&
        other.leaders.some((leader) => controlsLeader(entrant, leader)),
    )
  )
    return 'Assassination with captured or foreign ghola leaders is still being implemented.';
  if (!entrant.leaders.some((leader) => !leader.dead))
    return 'Assassination with an empty living leader pool needs a verified ruling.';
  return null;
}
function sneakAttackOptions(
  g: Game,
  entry: NonNullable<Game['pendingTerrorEntry']>,
) {
  const owner = byFaction(g, 'moritani')!;
  const maximum = Math.min(5, owner.reserves);
  let blocked: string | null = null;
  try {
    allowedEntry(g, owner, entry.territory, entry.sector);
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    blocked = error.message;
  }
  const bg = byFaction(g, 'beneGesserit');
  if (
    !blocked &&
    bg &&
    (bg.reserves > 0 || (g.advanced && fighterCount(bg, entry.territory) > 0))
  )
    blocked =
      'Sneak Attack combined with Bene Gesserit arrival reactions is still being implemented.';
  if (!blocked && g.phase === 5 && g.techTokens)
    blocked =
      'Sneak Attack combined with Heighliners technology is still being implemented.';
  return { maximum, blocked };
}
function terrorAllianceBlocked(
  g: Game,
  entry: NonNullable<Game['pendingTerrorEntry']>,
  kind: TerrorKind,
): string | null {
  if (entry.allianceBlocked)
    return 'Karama prevented this alliance opportunity; you may still reveal the token or leave it hidden.';
  const entrant = getPlayer(g, entry.entrant);
  const owner = byFaction(g, 'moritani')!;
  const homeworldBlock = homeworldAllianceReason(g, owner.id, entrant.id);
  if (homeworldBlock) return homeworldBlock;
  if (entrant.faction === 'ecaz')
    return 'Enemy of My Enemy cannot be offered to Ecaz.';
  if (entrant.id === owner.id || entrant.id === owner.ally)
    return 'Enemy of My Enemy requires an opposing entrant.';
  if (terrorRevealBlocked(g, entry, kind))
    return 'This offer is not yet available because its mandatory effect on refusal is still being implemented.';
  return null;
}
/** Return only unspent escrow for the pairs this special alliance breaks. */
function formTerrorAlliance(g: Game, owner: Player, entrant: Player) {
  const blocked = homeworldAllianceReason(g, owner.id, entrant.id);
  requireRule(!blocked, blocked ?? 'This alliance is unavailable.');
  const changed = new Set([owner.id, entrant.id]);
  for (const member of [owner, entrant]) {
    if (member.ally) getPlayer(g, member.ally).ally = null;
    member.ally = null;
  }
  for (const [donor, credit] of Object.entries(g.aid)) {
    if (changed.has(donor) || changed.has(credit.recipient)) {
      getPlayer(g, donor).spice += credit.amount;
      delete g.aid[donor];
    }
  }
  for (const [from, to] of Object.entries(g.allianceOffers))
    if (changed.has(from) || changed.has(to)) delete g.allianceOffers[from];
  owner.ally = entrant.id;
  entrant.ally = owner.id;
  owner.allySinceTurn = entrant.allySinceTurn = g.turn;
  discardAllianceNexusCards(g, owner, entrant);
  g.ready = [];
}
function decideTerror(g: Game, p: Player, action: Action) {
  const entry = g.pendingTerrorEntry;
  requireRule(
    entry &&
      entry.turn === g.turn &&
      entry.phase === g.phase &&
      (entry.stage === 'allianceReply'
        ? p.id === entry.entrant
        : p.faction === 'moritani'),
    'This Terror entry opportunity is no longer current.',
  );
  if (entry.stage === 'select') {
    if (action.decline === true) {
      requireRule(action.token === undefined, 'Declining leaves every stacked token hidden.');
      log(g, `${p.name} left all Terror tokens hidden after this entry.`);
      finishTerrorEntry(g);
      return;
    }
    requireRule(typeof action.token === 'string' && entry.candidates?.includes(action.token),
      'Choose one of the original stacked Terror tokens.');
    requireRule(action.reveal === undefined && action.alliance === undefined,
      'Choose the token before deciding whether to reveal it or offer an alliance.');
    entry.token = action.token;
    entry.stage = 'offer';
    entry.selectionSignature = terrorSelectionSignature(entry);
    entry.entrySignature = terrorEntrySignature(entry);
    g.decision = { kind: 'moritaniTerror', player: p.id, entrant: entry.entrant, territory: entry.territory };
    return;
  }
  const token = g.moritaniTerror?.tokens.find((t) => t.id === entry.token);
  requireRule(token, 'The entry’s Terror token is unavailable.');
  const entrant = getPlayer(g, entry.entrant);
  const owner = byFaction(g, 'moritani')!;
  const reopen = () => {
    g.decision = {
      kind: 'moritaniTerror',
      player: owner.id,
      entrant: entrant.id,
      territory: entry.territory,
    };
  };
  if (entry.stage === 'allianceReply') {
    requireRule(
      token.status === 'placed' && token.location === entry.territory,
      'The offered alliance no longer has a hidden Terror token.',
    );
    requireRule(
      typeof action.accept === 'boolean',
      'Accept or refuse the alliance offer.',
    );
    if (action.accept) {
      const blocked = terrorAllianceBlocked(g, entry, token.kind);
      requireRule(!blocked, blocked ?? 'This alliance is unavailable.');
      formTerrorAlliance(g, owner, entrant);
      g.moritaniTerror = returnTerror(g.moritaniTerror!, token.id, random);
      log(
        g,
        `${owner.name} and ${entrant.name} formed an alliance through Enemy of My Enemy; their former alliances ended and the Terror token returned hidden to supply.`,
      );
      finishTerrorEntry(g);
    } else {
      log(
        g,
        `${entrant.name} refused Enemy of My Enemy; the Terror token must be revealed.`,
      );
      entry.stage = 'offer';
      decideTerror(g, owner, { type: 'decision', reveal: true });
    }
    return;
  }
  if (entry.stage === 'offer') {
    requireRule(
      token.status === 'placed' && token.location === entry.territory,
      'The hidden Terror token is no longer in that stronghold.',
    );
    if (action.alliance === true) {
      const blocked = terrorAllianceBlocked(g, entry, token.kind);
      requireRule(!blocked, blocked ?? 'This alliance offer is unavailable.');
      entry.stage = 'allianceResponse';
      g.response = { kind: 'moritaniAlliance', owner: owner.id, passed: [] };
      log(
        g,
        `${owner.name} declared Enemy of My Enemy toward ${entrant.name}.`,
      );
      return;
    }
    if (action.decline === true) {
      log(g, `${p.name} left the Terror token hidden.`);
      finishTerrorEntry(g);
      return;
    }
    requireRule(
      action.reveal === true,
      'Reveal the Terror token or leave it hidden.',
    );
    const blocked = terrorRevealBlocked(g, entry, token.kind);
    requireRule(!blocked, blocked ?? 'This Terror effect is unavailable.');
    g.moritaniTerror = revealTerror(g.moritaniTerror!, token.id);
    log(
      g,
      `${p.name} revealed ${TERROR_DEFINITIONS[token.kind].name} in ${territory(entry.territory).name}.`,
    );
    if (token.kind === 'robbery') {
      entry.stage = 'robbery';
      reopen();
    } else if (token.kind === 'assassination') {
      const victim = shuffle(
        entrant.leaders.filter((leader) => !leader.dead),
      )[0];
      victim.dead = true;
      victim.deaths++;
      delete victim.usedAt;
      p.spice += victim.strength;
      log(
        g,
        `${victim.name} was assassinated; ${p.name} received ${victim.strength} spice.`,
      );
      finishTerrorEntry(g);
    } else if (token.kind === 'sneakAttack') {
      entry.stage = 'sneakAttack';
      reopen();
    } else {
      const victimCard = shuffle(entrant.hand)[0];
      if (victimCard) {
        const discardedHandSize = entrant.hand.length;
        const card = discard(g, entrant, victimCard.id);
        log(
          g,
          `${entrant.name} discarded a random Treachery card to Sabotage.`,
        );
        g.pendingTerrorEntry = null;
        stageTreacheryDiscard(
          g,
          'terror:sabotage',
          [{ card, discardedBy: entrant.id, publicFace: false }],
          {
            kind: 'terrorDiscard',
            source: 'sabotage',
            owner: owner.id,
            entry,
            discardedHandSize,
          },
        );
      } else {
        continueTerrorDiscard(g, 'sabotage');
      }
    }
    return;
  }
  requireRule(
    token.status === 'removed',
    'Reveal the Terror token before resolving its effect.',
  );
  if (entry.stage === 'sneakAttack') {
    requireRule(
      token.kind === 'sneakAttack',
      'This is not a Sneak Attack opportunity.',
    );
    const options = sneakAttackOptions(g, entry);
    const amount = integer(
      action.amount,
      0,
      options.maximum,
      'Sneak Attack forces',
    );
    requireRule(
      action.sector === undefined || action.sector === entry.sector,
      'Sneak Attack must enter the recorded sector.',
    );
    if (amount > 0) {
      requireRule(
        !options.blocked,
        options.blocked ?? 'This arrival is unavailable.',
      );
      p.reserves -= amount;
      place(p, entry.territory, entry.sector, amount);
      observeOccupation(g);
      log(
        g,
        `${p.name} sent ${amount} reserves into ${territory(entry.territory).name} through Sneak Attack.`,
      );
    } else log(g, `${p.name} sent no forces through Sneak Attack.`);
    finishTerrorEntry(g);
  } else if (entry.stage === 'robbery') {
    requireRule(
      token.kind === 'robbery' &&
        (action.choice === 'spice' || action.choice === 'card'),
      'Choose stolen spice or the top Treachery card.',
    );
    if (action.choice === 'spice') {
      const amount = Math.ceil(entrant.spice / 2);
      entrant.spice -= amount;
      p.spice += amount;
      log(
        g,
        `${p.name} stole half of ${entrant.name}’s available spice, rounded up.`,
      );
    } else {
      const card = draw(g);
      if (card) p.hand.push(card);
      log(
        g,
        card
          ? `${p.name} drew a Treachery card through Robbery.`
          : 'No Treachery card remained for Robbery.',
      );
      if (p.hand.length > handLimit(p)) {
        entry.stage = 'discard';
        reopen();
        return;
      }
    }
    finishTerrorEntry(g);
  } else if (entry.stage === 'discard') {
    requireRule(
      token.kind === 'robbery' && p.hand.length > handLimit(p),
      'There is no excess Robbery card to discard.',
    );
    const discardedHandSize = p.hand.length;
    const card = discard(g, p, stringField(action.card));
    log(g, `${p.name} discarded a card after the Robbery draw.`);
    g.pendingTerrorEntry = null;
    stageTreacheryDiscard(
      g,
      'terror:robberyOverflow',
      [{ card, discardedBy: p.id, publicFace: false }],
      {
        kind: 'terrorDiscard',
        source: 'robberyOverflow',
        owner: owner.id,
        entry,
        discardedHandSize,
      },
    );
  } else {
    requireRule(
      token.kind === 'sabotage',
      'This is not a Sabotage gift opportunity.',
    );
    if (action.decline !== true) {
      const card = p.hand.find((c) => c.id === action.card);
      requireRule(card, 'Choose a card from your own hand to give.');
      requireRule(
        entrant.hand.length < handLimit(entrant),
        'This recipient’s exceptional hand overflow is still being implemented. You may decline the gift.',
      );
      p.hand = p.hand.filter((c) => c.id !== card.id);
      entrant.hand.push(card);
      log(g, `${p.name} gave ${entrant.name} a Treachery card after Sabotage.`);
    } else log(g, `${p.name} declined the optional Sabotage gift.`);
    finishTerrorEntry(g);
  }
}
function removeGroup(
  p: Player,
  group: [string, number][],
  eliteGroup: Record<string, number> = {},
) {
  for (const [key, n] of group) {
    if (p.elites) {
      p.elites.forces[key] =
        (p.elites.forces[key] ?? 0) - (eliteGroup[key] ?? 0);
      if (!p.elites.forces[key]) delete p.elites.forces[key];
    }
    p.forces[key] -= n;
    if (!p.forces[key]) delete p.forces[key];
  }
}
function pathBlocked(g: Game, p: Player, key: string, advisors = false) {
  const l = splitLocation(key);
  if (l.sector && l.sector === g.storm) return true;
  return occupancyRule(() =>
    strongholdPathBlocked(g.players, p.id, l.territory, advisors),
  );
}
function boardResolution<T>(quote: () => T): T {
  try {
    return quote();
  } catch (error) {
    if (error instanceof BoardResolutionError)
      throw new RuleError(error.message);
    throw error;
  }
}
function applyAdvisorReleases(g: Game, released: AdvisorRelease[]) {
  for (const entry of released)
    delete getPlayer(g, entry.player).advisors?.[entry.territory];
}
export function battles(g: Game) {
  const quote = boardResolution(() => quoteCombatBoard(g));
  applyAdvisorReleases(g, quote.released);
  return quote.battles;
}
/** Evaluate only at the committed end of movement, using the normal battle geometry. */
function offerMoritaniDuke(g: Game) {
  const owner = byFaction(g, 'moritani');
  if (!owner || g.dukeAcquisitionTurn === g.turn) return false;
  g.dukeAcquisitionTurn = g.turn;
  g.dukeVidal ??= createDukeVidal();
  const duke = g.dukeVidal;
  if (duke.leader.dead || duke.controller === owner.id) return false;
  if (
    duke.leader.capturedBy ||
    duke.leader.gholaBy ||
    (g.advanced && byFaction(g, 'harkonnen'))
  ) {
    log(
      g,
      'Duke Vidal acquisition with exceptional capture or ghola custody is still being implemented.',
    );
    return false;
  }
  const strongholds = new Set(
    battles(g)
      .filter(
        (battle) =>
          [battle.attacker, battle.defender].includes(owner.id) &&
          !battle.territory.startsWith('homeworld:') &&
          territory(battle.territory).type === 'stronghold' &&
          getPlayer(
            g,
            battle.attacker === owner.id ? battle.defender : battle.attacker,
          ).faction !== 'ecaz',
      )
      .map((battle) => battle.territory),
  );
  if (strongholds.size < 2) return false;
  g.response = { kind: 'moritaniDuke', owner: owner.id, passed: [] };
  log(
    g,
    `${owner.name} qualifies to acquire Duke Vidal through battles in ${strongholds.size} strongholds.`,
  );
  return true;
}
type SaphoOption = {
  scope: 'onceAround' | 'movement';
  event: string;
  mode: 'first' | 'last';
};
function saphoMovementIntegrity(g: Game) {
  const last = g.saphoMovementLast;
  if (last === undefined || last === null) return;
  requireRule(
    typeof last === 'object' &&
      !Array.isArray(last) &&
      g.status === 'playing' &&
      g.phase === 5 &&
      last.turn === g.turn &&
      last.event === `movement:${g.turn}` &&
      typeof last.player === 'string' &&
      g.order.includes(last.player),
    'The saved Juice of Sapho movement scope is invalid.',
  );
  const remaining = g.movementRemaining;
  requireRule(remaining, 'The saved Juice of Sapho movement queue is missing.');
  validateOrderedOpportunity({
    event: last.event,
    eligible: g.order,
    completed: g.order.filter((id) => !remaining.includes(id)),
    remaining,
    current: remaining[0] ?? null,
    currentStarted: false,
    protectedLast: last.player,
  });
}
function saphoCleanWindow(g: Game) {
  return (
    g.status === 'playing' &&
    !g.truthtrance &&
    !g.phaseOpening &&
    !g.response &&
    !g.decision &&
    !g.pendingNullentropy &&
    !g.pendingRicheseGift &&
    !g.pendingExchange &&
    !g.pendingKarama &&
    !g.pendingShipment &&
    !g.pendingAmbassador &&
    !g.pendingTerrorEntry &&
    !g.pendingFremenMove &&
    !g.pendingIxMove &&
    !g.pendingChoamMove &&
    !g.richeseAllyOffer &&
    !g.currentAuctionSale
  );
}
function saphoMovementQueue(g: Game): OrderedOpportunity | null {
  let remaining = g.movementRemaining;
  if (
    g.phase !== 5 ||
    !remaining?.length ||
    !g.active ||
    !remaining.includes(g.active)
  )
    return null;
  const active = getPlayer(g, g.active);
  // The Guild can already have claimed the next entire turn without rewriting
  // the physical queue. Preserve that granted current turn in this local scope.
  if (g.active !== remaining[0]) {
    if (!g.advanced || active.faction !== 'guild' || !g.guildTimingGranted)
      return null;
    remaining = [g.active, ...remaining.filter((id) => id !== g.active)];
  }
  // A paid/reserved movement preparation also starts the combined turn.
  const started =
    active.shipped ||
    active.moved > 0 ||
    g.hajr.includes(active.id) ||
    !!g.karamaShipping ||
    !!g.ornithopter ||
    (g.choamMovement?.turn === g.turn && active.faction === 'choam');
  const state: OrderedOpportunity = {
    event: `movement:${g.turn}`,
    eligible: g.order,
    completed: g.order.filter((id) => !remaining.includes(id)),
    remaining,
    current: g.active,
    currentStarted: !!started,
    protectedLast: g.saphoMovementLast?.player ?? null,
  };
  validateOrderedOpportunity(state);
  return state;
}
/** Own custody and public finite scopes only; no opponent hand scan. */
function saphoOptions(g: Game, p: Player): SaphoOption[] {
  if (!saphoCleanWindow(g)) return [];
  const card = p.hand.find((c) => c.id === 'richese-juice-of-sapho');
  if (
    !card ||
    card.effect !== 'juiceOfSapho' ||
    !richeseCardDefinition(card) ||
    p.hand.filter((c) => c.id === card.id).length !== 1 ||
    transferCardBlock(g, p, card) ||
    giftReserved(g, p.id, card.id)
  )
    return [];
  const options: SaphoOption[] = [];
  const lot = g.richeseAuction;
  if (
    g.phase === 3 &&
    lot?.method === 'onceAround' &&
    !lot.outcome &&
    g.order.includes(p.id) &&
    p.hand.length <= handLimit(p) &&
    !lot.acted.includes(p.id)
  ) {
    const remaining = lot.order.filter((id) => !lot.acted.includes(id));
    if (!lot.acted.length && remaining[0] !== p.id)
      options.push({ scope: 'onceAround', event: lot.event, mode: 'first' });
    if (remaining.at(-1) !== p.id)
      options.push({ scope: 'onceAround', event: lot.event, mode: 'last' });
  }
  const queue = saphoMovementQueue(g);
  if (
    queue &&
    !queue.currentStarted &&
    queue.remaining.includes(p.id) &&
    !g.saphoMovementLast
  ) {
    if (
      !queue.completed.length &&
      !g.players.some((other) => other.shipped || other.moved > 0) &&
      !(g.advanced && byFaction(g, 'guild')) &&
      queue.current !== p.id
    )
      options.push({ scope: 'movement', event: queue.event, mode: 'first' });
    if (queue.remaining.at(-1) !== p.id)
      options.push({ scope: 'movement', event: queue.event, mode: 'last' });
  }
  return options;
}
function playSapho(g: Game, p: Player, action: Action) {
  requireRule(
    Object.keys(action).every((key) =>
      ['type', 'card', 'scope', 'event', 'mode'].includes(key),
    ),
    'Choose only Juice of Sapho, one supported scope, its event and first or last.',
  );
  const option = saphoOptions(g, p).find(
    (choice) =>
      choice.event === action.event &&
      choice.scope === action.scope &&
      choice.mode === action.mode,
  );
  requireRule(
    option,
    'This Juice of Sapho opportunity is unavailable, already completed or expired.',
  );
  if (option.scope === 'onceAround') {
    const lot = g.richeseAuction!;
    // Discarding this card frees a slot even when a full hand excluded its holder
    // at opening. Only this still-open finite lot gains that unacted bidder.
    if (!lot.eligible.includes(p.id)) {
      lot.eligible.push(p.id);
      lot.order.push(p.id);
      lot.tieOrder = g.order.filter((id) => lot.eligible.includes(id));
    }
    g.richeseAuction = reorderRicheseBidder(
      lot,
      option.event,
      p.id,
      option.mode,
    );
    g.active = g.richeseAuction.active;
    discard(g, p, 'richese-juice-of-sapho');
    log(
      g,
      `${p.name} discarded Juice of Sapho to bid ${option.mode} in this Once Around auction. Completed bids and their funding remain committed; no bidder receives another bid.`,
      { faction: p.faction, name: 'Juice of Sapho' },
    );
    settleRicheseLot(g);
  } else {
    const queue = saphoMovementQueue(g)!;
    const next =
      option.mode === 'last'
        ? protectOrderedOpportunityLast(queue, {
            event: option.event,
            player: p.id,
          })
        : reorderOrderedOpportunity(queue, {
            event: option.event,
            player: p.id,
            position: 'first',
          });
    g.movementRemaining = [...next.remaining];
    if (option.mode === 'last')
      g.saphoMovementLast = { event: option.event, turn: g.turn, player: p.id };
    discard(g, p, 'richese-juice-of-sapho');
    log(
      g,
      `${p.name} discarded Juice of Sapho to take the ${option.mode} remaining combined shipment and movement turn${option.mode === 'last' ? ', including after the Spacing Guild' : ''}. Completed turns and physical storm order are unchanged.`,
      { faction: p.faction, name: 'Juice of Sapho' },
    );
    // Preserve the Guild decision already settled for an unchanged current actor.
    if (g.active !== g.movementRemaining[0]) movementTurn(g);
  }
}

function movementTurn(g: Game) {
  const remaining = g.movementRemaining!;
  if (!remaining.length) {
    if (offerMoritaniDuke(g)) return;
    nextPhase(g);
    return;
  }
  const guild = byFaction(g, 'guild');
  if (
    g.advanced &&
    guild &&
    !g.guildTimingLocked &&
    remaining.includes(guild.id) &&
    guild.id !== g.saphoMovementLast?.player &&
    remaining.some(
      (id) => id !== guild.id && id !== g.saphoMovementLast?.player,
    )
  ) {
    g.active = null;
    g.decision = {
      kind: 'guildTiming',
      player: guild.id,
      next: remaining[0],
      following: remaining.find((id) => id !== guild.id)!,
    };
  } else g.active = remaining[0];
}
function chooseGuildTiming(g: Game, take: boolean) {
  const guild = byFaction(g, 'guild')!;
  if (take) g.active = guild.id;
  else {
    const rest = g.movementRemaining!.filter((id) => id !== guild.id);
    const protectedLast = g.saphoMovementLast?.player;
    rest.splice(
      protectedLast ? rest.indexOf(protectedLast) : rest.length,
      0,
      guild.id,
    );
    g.movementRemaining = rest;
    g.active = g.movementRemaining[0];
  }
}
function movementPhaseQuote<T>(calculate: () => T): T {
  try {
    return calculate();
  } catch (error) {
    if (error instanceof MovementPhaseQuoteError)
      throw new RuleError(error.message);
    throw error;
  }
}
function advisorBattleOptions(g: Game) {
  const quote = movementPhaseQuote(() => quoteAdvisorBattleOffer(g));
  applyAdvisorReleases(g, quote.released);
  return quote.territories;
}
function commitMovementPhaseStart(g: Game, quote: MovementPhaseQuote) {
  if (quote.kind === 'opening') {
    g.phaseOpening = quote.phaseOpening;
    return;
  }
  g.movementRemaining = quote.remaining;
  g.saphoMovementLast = null;
  g.guildTimingGranted = false;
  g.guildTimingLocked = false;
  g.spicePeekKnown = false;
  if (quote.spice.owner) {
    if (quote.spice.refill) refillSpice(g);
    if (quote.spice.hasCards)
      g.response = {
        kind: 'atreidesSpice',
        owner: quote.spice.owner,
        passed: [],
      };
  }
  for (const p of g.players) {
    p.shipped = false;
    p.moved = 0;
  }
  applyAdvisorReleases(g, quote.released);
  g.decision = quote.decision;
  g.active = quote.active;
}
function beginAdvisorBattle(g: Game, remaining = advisorBattleOptions(g)) {
  const bg = byFaction(g, 'beneGesserit');
  if (bg && remaining.length)
    g.decision = {
      kind: 'advisorBattle',
      player: bg.id,
      territories: remaining,
    };
  else movementTurn(g);
}
function finishAdvisorReaction(
  g: Game,
  details: {
    advisorResume?: 'wormRide' | 'declaration' | 'ambassador';
    advisorAmbassadorEvent?: string;
    advisorRemaining?: string[];
    advisorFollowup?: { shipment: string; destination: string };
  },
) {
  const bg = byFaction(g, 'beneGesserit')!;
  if (details.advisorFollowup && spiritualAdvisorMaximum(g, bg.id) > 0)
    g.decision = { kind: 'advisor', player: bg.id, ...details.advisorFollowup };
  else if (details.advisorResume === 'wormRide') nextWormRide(g);
  else if (details.advisorResume === 'declaration')
    beginAdvisorBattle(g, details.advisorRemaining ?? []);
  else if (details.advisorResume === 'ambassador')
    continueAmbassadorArrival(g, details.advisorAmbassadorEvent!);
}
function intrusion(
  g: Game,
  mover: Player,
  t: string,
  options: {
    wormRide?: boolean;
    ambassadorEvent?: string;
    followup?: { shipment: string; destination: string };
  } = {},
) {
  const bg = byFaction(g, 'beneGesserit');
  if (g.advanced && bg && bg.id !== mover.id && fighterCount(bg, t)) {
    g.decision = { kind: 'intrusion', player: bg.id, territory: t, ...options };
    return true;
  }
  return false;
}
function assignRemainingTech(g: Game) {
  if (!g.techTokens) return;
  const unassigned = shuffle(
    TECH_TOKENS.filter((t) => !g.techTokens![t.id].owner),
  );
  const recipients = g.order.filter(
    (id) => !ownedTech(g.techTokens, id).length,
  );
  for (const token of unassigned) {
    const id = recipients.shift();
    if (!id) break;
    g.techTokens[token.id].owner = id;
    log(
      g,
      `${getPlayer(g, id).name} received ${token.name} after the first storm.`,
    );
  }
}
function techIncome(g: Game, id: TechId, actor: Player) {
  if (!g.techTokens) return;
  const rule = TECH_TOKENS.find((t) => t.id === id)!;
  const token = g.techTokens[id];
  if (
    g.phase !== rule.phase ||
    actor.faction === rule.except ||
    !token.owner ||
    token.triggeredTurn === g.turn
  )
    return;
  token.triggeredTurn = g.turn;
  token.spice = ownedTech(g.techTokens, token.owner).length;
  log(
    g,
    `${rule.name} accrued ${token.spice} spice for ${getPlayer(g, token.owner).name}, payable at phase end.`,
  );
}
function currentPhaseResources(g: Game) {
  try {
    return quotePhaseResources(g);
  } catch (error) {
    if (error instanceof PhaseResourceError) throw new RuleError(error.message);
    throw error;
  }
}
function commitPhaseResources(g: Game, quote: PhaseResourceQuote) {
  for (const credit of quote.credits) {
    const owner = getPlayer(g, credit.player);
    owner.spice = credit.balance;
    if (credit.kind === 'tech')
      log(
        g,
        `${owner.name} collected ${credit.amount} spice from ${TECH_TOKENS.find((t) => t.id === credit.token)!.name}.`,
      );
  }
  for (const id of quote.tokenResets) g.techTokens![id].spice = 0;
  if (quote.clearAid) g.aid = {};
}
function transferTech(g: Game, id: TechId, winner: string) {
  g.techTokens![id].owner = winner;
  log(
    g,
    `${getPlayer(g, winner).name} took ${TECH_TOKENS.find((t) => t.id === id)!.name} after winning the battle.`,
  );
}
function decideChoamMarket(g: Game, decision: Extract<Decision, {kind: 'choamMarket' | 'choamTradeReply' | 'choamTradeConfirm'}>, action: Action) {
      const market = g.choamMarket!;
      const owner = getPlayer(g, market.owner);
      if (decision.kind === 'choamMarket') {
        if (action.done === true) {
          finishChoamMarket(g);
        } else if (action.mode === 'sell') {
          const sale = quoteSale(
            owner.hand,
            action.card,
            action.witness,
            market.blocked,
          );
          requireRule(
            sale,
            'Choose an available Worthless card or surplus exact duplicate.',
          );
          const card = owner.hand.find((c) => c.id === sale.card)!;
          const blocked = homeworldRule(() => homeworldWorthlessSaleBlock(g, owner.id, card));
          requireRule(!blocked, blocked ?? 'This card sale is unavailable.');
          market.sale = sale;
          log(
            g,
            `${owner.name} revealed ${sale.witness ? 'two copies of ' : ''}${card.name} and offered one for ${sale.price} spice.`,
          );
          g.response = { kind: 'choamSale', owner: owner.id, passed: [] };
        } else {
          requireRule(
            action.mode === 'trade',
            'Sell a card, offer a trade or finish the phase.',
          );
          requireRule(
            g.choamTradeTurn !== g.turn,
            'CHOAM may exchange one card with its ally only once per turn.',
          );
          const ally = g.players.find(
            (p) => p.id === owner.ally && p.ally === owner.id,
          );
          requireRule(ally, 'You need an ally for a two-way trade.');
          requireRule(
            owner.hand.some((c) => c.id === action.card),
            'Offer a card from your own hand.',
          );
          market.trade = { ally: ally.id, offered: stringField(action.card) };
          market.tradeAttempted = true;
          g.decision = { kind: 'choamTradeReply', player: ally.id };
        }
      } else {
        const trade = market.trade!;
        const ally = getPlayer(g, trade.ally);
        if (action.decline === true) {
          delete market.trade;
          resumeChoamMarket(g);
        } else if (decision.kind === 'choamTradeReply') {
          requireRule(
            ally.hand.some((c) => c.id === action.card),
            'Choose one of your cards to return, or decline.',
          );
          trade.returned = stringField(action.card);
          g.decision = { kind: 'choamTradeConfirm', player: owner.id };
        } else {
          requireRule(
            action.accept === true,
            'Confirm the two-way exchange or decline.',
          );
          const offered = owner.hand.find((c) => c.id === trade.offered);
          const returned = ally.hand.find((c) => c.id === trade.returned);
          if (
            offered &&
            returned &&
            owner.ally === ally.id &&
            ally.ally === owner.id &&
            g.choamTradeTurn !== g.turn
          ) {
            owner.hand = owner.hand.filter((c) => c.id !== offered.id);
            ally.hand = ally.hand.filter((c) => c.id !== returned.id);
            owner.hand.push(returned);
            ally.hand.push(offered);
            g.choamTradeTurn = g.turn;
            log(
              g,
              `${owner.name} and ${ally.name} exchanged one treachery card each.`,
            );
          } else
            log(
              g,
              'The proposed card exchange is no longer possible; both hands remain unchanged.',
            );
          delete market.trade;
          resumeChoamMarket(g);
        }
      }
}
function openChoamMarket(g: Game, resume: ChoamMarket['resume']) {
  const choam = byFaction(g, 'choam');
  if (g.status !== 'playing' || !choam) return false;
  g.choamMarket = { owner: choam.id, resume, blocked: [] };
  g.decision = { kind: 'choamMarket', player: choam.id };
  return true;
}
function resumeChoamMarket(g: Game) {
  g.decision = g.biddingEnd ? null : { kind: 'choamMarket', player: g.choamMarket!.owner };
}
function finishChoamMarket(g: Game) {
  if (g.biddingEnd || openBiddingEnd(g)) {
    const owner = g.choamMarket!.owner;
    if (!g.biddingEnd!.ready.includes(owner)) g.biddingEnd!.ready.push(owner);
    g.decision = null;
    return;
  }
  const resume = g.choamMarket!.resume;
  g.choamMarket = null;
  g.decision = null;
  if (resume === 'storm') advanceAfterStorm(g);
  else advancePhase(g);
}
function nextPhase(g: Game) {
  if (openBiddingEnd(g)) return;
  if (!openChoamMarket(g, 'phase')) advancePhase(g);
}
function openBiddingEnd(g: Game): boolean {
  const emperor = byFaction(g, 'emperor');
  if (g.status !== 'playing' || g.phase !== 3 || !g.homeworlds?.custody || !emperor) return false;
  if (g.biddingEnd) return true;
  const choam = byFaction(g, 'choam');
  g.biddingEnd = { event: crypto.randomUUID(), turn: g.turn,
    owners: [emperor.id, ...(choam ? [choam.id] : [])], ready: [] };
  if (choam) g.choamMarket ??= { owner: choam.id, resume: 'phase', blocked: [] };
  g.decision = null;
  g.active = null;
  log(g, 'Bidding is complete. Kaitain disposal and any CHOAM market actions share this closing opportunity; the owners may act in either order.');
  return true;
}
function finishBiddingEnd(g: Game): boolean {
  if (!biddingEndQuiet(g)) return false;
  let changed = false;
  const end = g.biddingEnd!;
  for (const id of end.owners) {
    if (end.ready.includes(id) || !biddingEndPubliclyEmpty(g, id)) continue;
    end.ready.push(id);
    changed = true;
    log(g, `${getPlayer(g, id).name} has no cards and no incoming exchange is available. Their end-of-Bidding opportunity finishes automatically.`);
  }
  if (end.owners.every((id) => end.ready.includes(id))) {
    g.biddingEnd = null;
    g.choamMarket = null;
    advancePhase(g);
    return true;
  }
  return changed;
}
function decideBiddingEnd(g: Game, p: Player, action: Action) {
  const end = g.biddingEnd;
  requireRule(end && action.event === end.event && end.owners.includes(p.id),
    'Choose the current end-of-Bidding opportunity for your faction.');
  requireRule(biddingEndQuiet(g), 'Finish the pending interaction before an end-of-Bidding action.');
  if (action.mode === 'ready') {
    requireRule(!end.ready.includes(p.id), 'You are already ready to finish Bidding.');
    end.ready.push(p.id);
    log(g, `${p.name} is ready to finish Bidding. They may still act if another closing opportunity remains.`);
  } else if (action.mode === 'discard') {
    const quote = homeworldRule(() => quoteKaitainDiscards(g, p.id, action.cards));
    requireRule(quote.cards.length > 0, 'Choose cards to discard, or finish your opportunity.');
    for (const card of quote.cards) {
      const blocked = ambassadorDiscardBlock(g, p, card);
      requireRule(!blocked, blocked ?? 'This card is committed to another effect.');
    }
    p.spice -= quote.cost;
    const entries = quote.cards.map((card) => ({ card: discard(g, p, card.id),
      discardedBy: p.id, publicFace: false }));
    log(g, `${p.name} paid ${quote.cost} spice to the bank and discarded ${entries.length} Treachery Card${entries.length === 1 ? '' : 's'} through high-population Kaitain. No new auction begins.`,
      { faction: p.faction, name: 'Kaitain disposal' });
    stageTreacheryDiscard(g, 'kaitain', entries, { kind: 'kaitainDiscard',
      owner: p.id, event: end.event, cost: quote.cost, spiceAfter: p.spice });
  } else {
    requireRule(p.faction === 'choam' && g.choamMarket?.owner === p.id &&
      (action.mode === 'sell' || action.mode === 'trade'),
      'Choose Kaitain disposal, a CHOAM market action or finish your opportunity.');
    decideChoamMarket(g, { kind: 'choamMarket', player: p.id }, action);
  }
}
function advancePhase(g: Game) {
  if (g.phase === 6) boardResolution(() => quoteBattlePhaseAdvance(g));
  commitPhaseResources(g, currentPhaseResources(g));
  g.ready = [];
  g.active = null;
  const choam = byFaction(g, 'choam');
  if (g.phase === 8 && choam) {
    g.choamMentatPending = true;
    g.decision = { kind: 'choamMentat', player: choam.id };
    return;
  }
  const ecaz = byFaction(g, 'ecaz');
  if (g.phase === 4 && ecaz && g.ecazPlacementTurn !== g.turn) {
    g.ecazAmbassadors ??= createAmbassadors(random);
    g.decision = { kind: 'ecazPlacement', player: ecaz.id };
    return;
  }
  completePhase(g);
}
function ambassadorPlacementQuote(
  g: Game,
  owner: Player,
  token: string,
  to: string,
) {
  const destination = TERRITORIES.find((t) => t.id === to);
  requireRule(g.ecazAmbassadors, 'No Ambassador supply is available.');
  try {
    return placeAmbassador(g.ecazAmbassadors, token, {
      turn: g.turn,
      availableSpice: owner.spice,
      destination: {
        id: to,
        stronghold: destination?.type === 'stronghold',
        allowed: !!destination,
        inStorm: !destination || destination.sectors.includes(g.storm),
      },
    });
  } catch (error) {
    throw new RuleError(
      error instanceof Error ? error.message : 'Invalid Ambassador placement.',
    );
  }
}
function finishEcazPlacement(g: Game) {
  g.ecazPlacementTurn = g.turn;
  g.pendingEcazPlacement = null;
  g.decision = null;
  completePhase(g);
}
function completePhase(g: Game) {
  if (closeNexusCards(g)) return;
  if (g.phase === 7 && g.grummanCollection?.turn === g.turn && g.grummanCollection.stage === 'waiting') {
    g.grummanCollection.stage = 'complete';
    g.grummanCollection.outcome = 'expired';
    g.grummanCollection.signature = grummanCollectionSignature(g.grummanCollection);
  }
  if (g.phase === 8) settleStrongholdOwnership(g);
  g.phase++;
  if (g.phase === 9) {
    if (g.dukeVidal) g.dukeVidal = expireDuke(g.dukeVidal, g.turn);
    observeOccupation(g, 'turnEnd');
    g.turn++;
    g.phase = 0;
    observeOccupation(g, 'turnStart');
  }
  openPhase(g);
}
/** Open the same public window for every Ix table, independently of who holds Amal. */
function openPhase(g: Game, initialize = true) {
  if (g.phase === 1 && g.nexusCards && g.nexusCards.phase?.turn !== g.turn)
    g.nexusCards.phase = createNexusCardPhase(g.turn);
  if (initialize && g.phase === 4 && g.homeworlds) {
    g.homeworldRevival = homeworldRule(() => snapshotHomeworldRevival(g));
    if (g.homeworldRevival?.tleilaxu.low)
      log(g, 'Tleilax began Revival at low population. Tleilaxu will receive no bank reward for other factions’ Free Revival this phase, even if Tleilax later returns to high population. Paid revival and Ghola income are unchanged.', { faction: 'tleilaxu', name: 'Tleilax low population' });
  }
  if (g.expansions.includes('ix')) g.phaseOpening = { passed: [], initialize };
  else if (initialize) beginPhase(g);
}
function beginPhase(g: Game) {
  if (g.phase === 0) g.auditorInsight = null;
  if (g.phase === 2 && g.choamCharity?.turn !== g.turn) {
    const choam = byFaction(g, 'choam');
    if (choam && charityMultiplier(g) === 0) {
      g.choamCharity = { turn: g.turn, canceled: false };
      log(
        g,
        'Inflation cancels all charity this turn, including CHOAM income.',
      );
    } else if (choam) {
      g.response = { kind: 'choamCharity', owner: choam.id, passed: [] };
      return;
    }
  }
  if (g.phase === 4) {
    g.revivalRules = newRevivalRules();
    g.revivalRequests = {};
    g.freeRevival = [];
    g.emperorExtra = {};
    for (const p of g.players) {
      p.revived = 0;
      p.freeForcesRevived = 0;
      p.leaderRevived = false;
    }
  }
  if (g.phase === 3) setAuction(g);
  if (g.phase === 5) {
    commitMovementPhaseStart(
      g,
      movementPhaseQuote(() => quoteMovementPhaseStart(g)),
    );
  }
  if (g.phase === 6) {
    const b = battles(g);
    if (b.length) g.active = b[0].attacker;
    else {
      nextPhase(g);
      return;
    }
  }
  if (g.phase === 7) {
    collect(g);
  }
  if (g.phase === 8) {
    if (g.inflation && g.inflation.updatedTurn < g.turn) {
      if (g.inflation.flipped) {
        g.inflation = null;
        log(g, 'The Inflation token was removed from the game.');
      } else {
        g.inflation.side = g.inflation.side === 'double' ? 'cancel' : 'double';
        g.inflation.flipped = true;
        g.inflation.updatedTurn = g.turn;
        log(
          g,
          `Inflation flipped to ${g.inflation.side} for next turn’s charity.`,
        );
      }
    }
    for (const p of g.players) {
      p.spice += p.bribes;
      p.bribes = 0;
    }
    const moritani = byFaction(g, 'moritani');
    if (
      moritani &&
      g.moritaniTerror &&
      g.moritaniTerror.placementTurn !== g.turn
    ) {
      g.decision = { kind: 'moritaniPlacement', player: moritani.id };
    } else if (!byFaction(g, 'choam')) victory(g);
  }
  if (g.phase === 0 && g.turn > 1) {
    const ixians = byFaction(g, 'ixians');
    if (
      g.mobileStronghold?.location &&
      ixians &&
      !homeworldMobileStrongholdMovementBlock(g, ixians.id) &&
      at(ixians, MOBILE_STRONGHOLD)
    ) {
      g.decision = {
        kind: 'mobileStronghold',
        player: ixians.id,
        placement: false,
      };
      return;
    }
    beginStormTurn(g);
  }
}
/** Transfer actual charity only after its applicable power response. */
function payCharity(g: Game, player: Player, amount: number, homeworld = 0) {
  if (g.homeworlds) {
    const eligible = charityQuote(g, player);
    requireRule(
      eligible.total > 0 &&
        amount === eligible.total &&
        homeworld === eligible.homeworld,
      'The saved Homeworld charity claim does not match its eligible ordinary and bank amounts.',
    );
  }
  requireRule(
    Number.isSafeInteger(homeworld) && homeworld >= 0 && homeworld <= amount,
    'The Homeworld charity payment is invalid.',
  );
  const ordinary = amount - homeworld;
  const payer = charityPayer(g);
  // The published charity rule does not specify insolvency after intervening
  // spending. Fail atomically while this edge case remains under audit; never
  // mint a bank subsidy or create a negative spice balance silently.
  requireRule(
    !payer || payer.spice >= ordinary,
    'CHOAM cannot fund this charity claim.',
  );
  if (payer) payer.spice -= ordinary;
  player.spice += amount;
  if (homeworld)
    log(
      g,
      `${player.name} received ${ordinary} ordinary charity spice ${payer ? `from ${payer.name}` : 'from the Spice Bank'} and ${homeworld} additional bank spice for low Homeworld population.`,
      { faction: player.faction, name: 'Homeworld charity' },
    );
  techIncome(g, 'production', player);
}
function beginStormTurn(g: Game) {
  if (g.dukeVidal) delete g.dukeVidal.leader.usedAt;
  for (const p of g.players) if (p.elites) p.elites.revived = 0;
  g.stormDialers = g.lastBattle;
  if (g.advanced && byFaction(g, 'fremen')) {
    g.stormDialers = [];
    g.stormPending = g.stormCard ?? shuffle([1, 2, 3, 4, 5, 6])[0];
    g.stormCard = null;
    g.stormCardKnown = false;
    log(g, `Storm card revealed: ${g.stormPending} sectors.`);
  }
  for (const p of g.players) {
    for (const l of p.leaders) {
      delete l.usedAt;
      if (l.concealed) delete l.concealed.usedAt;
    }
    if (p.kwisatz) delete p.kwisatz.usedAt;
  }

  g.hajr = [];
  g.nexus = false;
  log(g, `Turn ${g.turn} begins.`);
}
/** Board identity excludes private balances and cards, which independent effects may change. */
function collectionBoardSignature(g: Game) {
  return JSON.stringify({
    advanced: g.advanced,
    storm: g.storm,
    order: g.order,
    mobile: g.mobileStronghold ?? null,
    players: g.players.map((p) => ({
      id: p.id,
      faction: p.faction,
      ally: p.ally,
      forces: p.forces,
      advisors: p.advisors ?? null,
      elites: p.elites?.forces ?? null,
      marker: p.noField?.deployed?.location ?? null,
    })),
  });
}
function collectionAllocation<T>(work: () => T): T {
  try {
    return work();
  } catch (error) {
    if (error instanceof SpiceAllocationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function ecazCollectionIntegrity(g: Game) {
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const controls: (
    | {
        response?: ResponseWindow | null;
        decision?: Decision | null;
        pendingKarama?: Game['pendingKarama'];
      }
    | null
    | undefined
  )[] = [
    g,
    g.pendingExchange,
    g.pendingRicheseGift?.resume,
    g.pendingNullentropy?.resume,
    g.pendingRichesePurchaseIncome?.resume,
    g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null,
  ].filter(Boolean);
  const hasCollectionControl = controls.some((control) => {
    const karama = control!.pendingKarama;
    const response =
      control!.response?.kind === 'worthlessKarama' &&
      karama?.use.kind === 'cancel'
        ? karama.use.response
        : control!.response;
    return (
      control!.decision?.kind === 'ecazSpice' ||
      response?.kind === 'ecazCollection'
    );
  });
  const pending = g.ecazCollection;
  if (!pending) {
    requireRule(
      !hasCollectionControl,
      'The shared collection decision has lost its collection event.',
    );
    return;
  }
  requireRule(
    Number.isSafeInteger(pending.turn) &&
      pending.turn >= 1 &&
      pending.turn <= g.turn &&
      typeof pending.event === 'string' &&
      pending.event.length > 0 &&
      typeof pending.canceled === 'boolean' &&
      Array.isArray(pending.settled),
    'The saved collection event is invalid.',
  );
  if (pending.stage === 'complete') {
    requireRule(
      pending.allocation === null && !hasCollectionControl,
      'Completed collection cannot retain unresolved shared spice.',
    );
    return;
  }
  requireRule(
    g.status === 'playing' &&
      g.phase === 7 &&
      pending.turn === g.turn &&
      typeof pending.event === 'string' &&
      pending.event.length > 0 &&
      typeof pending.canceled === 'boolean' &&
      ['response', 'allocation'].includes(pending.stage) &&
      pending.boardSignature === collectionBoardSignature(g),
    'Shared collection must retain its original turn and collecting forces.',
  );
  const quote = boardResolution(() =>
    quoteSpiceCollection(
      {
        ...g,
        players: g.players.map((p) => ({ ...p, spice: 0 })),
        spice: pending.sourceSpice,
      },
      pending.canceled,
    ),
  );
  if (pending.stage === 'response') {
    requireRule(
      !pending.canceled &&
        pending.settled.length === 0 &&
        pending.allocation === null &&
        quote.collectionBonus &&
        JSON.stringify(g.spice) === JSON.stringify(pending.sourceSpice),
      'Ecaz Collection needs its original uncollected stronghold-income opportunity.',
    );
    requireRule(
      controls.some((control) => {
        const karama = control!.pendingKarama;
        const response =
          control!.response?.kind === 'worthlessKarama' &&
          karama?.use.kind === 'cancel'
            ? karama.use.response
            : control!.response;
        return (
          response?.kind === 'ecazCollection' &&
          response.owner === quote.collectionBonus!.owner
        );
      }),
      'The saved Ecaz Collection response has lost its decision owner.',
    );
  } else {
    const allocation = pending.allocation;
    requireRule(
      allocation &&
        JSON.stringify(allocation.lots) === JSON.stringify(quote.shared) &&
        JSON.stringify(g.spice) === JSON.stringify(quote.spice),
      'Shared collection escrow no longer matches its original desert deposits.',
    );
    requireRule(
      controls.some(
        (control) =>
          control!.decision?.kind === 'ecazSpice' &&
          control!.decision.player === allocation.player,
      ),
      'The saved shared-spice allocation has lost its decision owner.',
    );
    requireRule(
      pending.settled.length === allocation.index &&
        pending.settled.every((receipt, index) => {
          const lot = allocation.lots[index];
          return (
            receipt &&
            lot &&
            receipt.territory === lot.territory &&
            receipt.ecaz === lot.ecaz &&
            receipt.ally === lot.ally &&
            ['agreement', 'equal'].includes(receipt.method) &&
            Number.isSafeInteger(receipt.ecazAmount) &&
            receipt.ecazAmount >= 0 &&
            Number.isSafeInteger(receipt.allyAmount) &&
            receipt.allyAmount >= 0 &&
            receipt.ecazAmount + receipt.allyAmount === lot.amount &&
            (receipt.method !== 'equal' ||
              receipt.ecazAmount === Math.floor(lot.amount / 2))
          );
        }),
      'Shared collection receipts do not match the remaining allocation.',
    );
    collectionAllocation(() =>
      quoteSpiceAllocation(allocation, allocation.player, { kind: 'equal' }),
    );
  }
}
function currentEcazCollectionQuote(
  g: Game,
  response: ResponseWindow,
  canceled: boolean,
) {
  ecazCollectionIntegrity({ ...g, response, pendingKarama: null });
  const pending = g.ecazCollection;
  requireRule(
    response.kind === 'ecazCollection' &&
      pending?.stage === 'response' &&
      pending.turn === g.turn,
    'This Ecaz Collection response is no longer pending.',
  );
  const quote = boardResolution(() => quoteSpiceCollection(g, canceled));
  requireRule(
    quote.collectionBonus?.owner === response.owner,
    'Ecaz Collection requires the original allied stronghold occupation.',
  );
  return quote;
}
function creditGiediCollection(g: Game, player: string, desert: number) {
  if (!g.homeworlds?.custody || getPlayer(g, player).faction !== 'harkonnen') return;
  const quote = homeworldRule(() => quoteGiediCollectionReceipt(
    g, g.turn, player, [{ kind: 'desert', amount: desert }], g.giediCollection,
  ));
  const p = getPlayer(g, player);
  requireRule(Number.isSafeInteger(p.spice + quote.amount),
    'Giedi Prime collection would overflow the spice balance.');
  p.spice += quote.amount;
  g.giediCollection = quote.receipt;
  if (quote.amount)
    log(g, 'Harkonnen received 2 spice from the bank: high-population Giedi Prime rewards positive desert collection once this phase.',
      { faction: 'harkonnen', name: 'Giedi Prime collection' });
}
/** Qualification history records facts only; disputed expiry and benefits remain separate. */
function observeOccupation(g: Game, cause: 'change' | 'turnStart' | 'turnEnd' = 'change') {
  if (g.homeworlds?.historyVersion !== 1 || !g.homeworldOccupationHistory) return;
  g.homeworldOccupationHistory = homeworldRule(() => observeHomeworldOccupation(
    g.homeworldOccupationHistory!, homeworldContext(g), g.homeworlds!.custody!, g.turn, cause,
    cause === 'change'
      ? `homeworld-change-${g.homeworldOccupationHistory!.sources[0].event}-${g.homeworldOccupationHistory!.sources.length}`
      : `homeworld-turn-${g.turn}-${cause}`));
}
function homeworldHistoryIntegrity(g: Game) {
  const initialized = g.homeworlds?.historyVersion === 1;
  requireRule(initialized === (g.homeworldOccupationHistory !== undefined),
    'The Homeworld qualification history has lost its initialized record.');
  if (initialized) {
    homeworldRule(() => validateHomeworldOccupationHistory(g.homeworldOccupationHistory!, homeworldContext(g), g.turn));
    const choam = byFaction(g, 'choam');
    requireRule(!!choam === (g.tupileIntelligence !== undefined), 'The original Tupile intelligence ledger is missing.');
    if (g.tupileIntelligence) homeworldRule(() => validateTupileIntelligenceState(g.tupileIntelligence!, g.players, g.turn));
  } else requireRule(g.tupileIntelligence === undefined, 'Tupile intelligence requires its original Homeworld history.');
}
function tupileIntelligenceBlock(g: Game): string | null {
  if (!g.homeworlds?.custody || !g.tupileIntelligence || !g.homeworldOccupationHistory)
    return 'This saved game lacks the original occupation and intelligence history required for Tupile.';
  if (g.status !== 'playing') return 'Tupile intelligence is available during play.';
  if (g.phaseOpening || g.response || g.decision || g.truthtrance || g.pendingKarama ||
      g.pendingTreacheryDiscard || g.pendingNullentropy || g.pendingExchange ||
      g.pendingRicheseGift || g.pendingRichesePurchaseIncome || g.battle?.revealed)
    return 'Finish the current response or committed action before requesting Tupile intelligence.';
  return null;
}
function projectedTupileIntelligence(g: Game, id: string) {
  const owner = byFaction(g, 'choam');
  if (!owner || owner.id !== id || !g.homeworlds?.custody) return null;
  const state = g.tupileIntelligence;
  const targets = homeworldRule(() => tupileIntelligenceTargets(homeworldContext(g), g.homeworlds!.custody!, id,
    state?.receipts.map((receipt) => receipt.faction) ?? [],
    tupileOccupationStatus(g.homeworldOccupationHistory, homeworldContext(g))));
  return {owner: id, blocked: tupileIntelligenceBlock(g), targets,
    receipts: (state?.receipts ?? []).map(({event, target, faction, category, spice, count, turn, phase}) =>
      ({event, target, faction, category, spice, count, turn, phase}))};
}
function requestTupileIntelligence(g: Game, p: Player, action: Action) {
  const blocked = tupileIntelligenceBlock(g);
  requireRule(!blocked, blocked ?? 'Tupile intelligence is unavailable.');
  requireRule(p.faction === 'choam' && g.tupileIntelligence!.owner === p.id, 'Only CHOAM may request its private Tupile intelligence.');
  requireRule(Object.keys(action).every((key) => ['type', 'target', 'category'].includes(key)) &&
    typeof action.target === 'string' && (action.category === 'weapons' || action.category === 'defenses'),
    'Choose one opposing faction and either weapons or defenses.');
  const request = homeworldRule(() => quoteTupileIntelligenceRequest(homeworldContext(g), g.homeworlds!.custody!, p.id,
    g.tupileIntelligence!.receipts.map((receipt) => receipt.faction),
    tupileOccupationStatus(g.homeworldOccupationHistory, homeworldContext(g)), action.target as string,
    action.category as TupileIntelligenceCategory));
  const target = getPlayer(g, request.target);
  const answer = homeworldRule(() => quoteTupileIntelligenceAnswer(target.hand, target.spice, request.category));
  g.tupileIntelligence = homeworldRule(() => appendTupileIntelligenceObservation(g.tupileIntelligence!, {
    event: crypto.randomUUID(), ...request, ...answer, turn: g.turn, phase: g.phase}));
  log(g, `${p.name} used Tupile intelligence against ${faction(target.faction).name}. The spice balance and chosen card count were recorded privately; this faction cannot be questioned again.`,
    {faction: 'choam', name: 'Tupile intelligence'});
}
function grummanCollectionIntegrity(g: Game) {
  homeworldRule(() => validateGrummanCollection(g));
  const frame = g.grummanCollection;
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const contexts = [g, g.pendingExchange, g.pendingNullentropy?.resume,
    g.pendingRicheseGift?.resume, g.pendingRichesePurchaseIncome?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null];
  const decisions = contexts.flatMap((context) => context?.decision?.kind === 'grummanCollection' ? [context.decision] : []);
  requireRule(decisions.every((decision) => frame?.stage === 'choice' && decision.player === frame.player && decision.event === frame.event) &&
    (frame?.stage !== 'choice' || decisions.length > 0),
    'The Grumman Collection choice has lost its original phase opportunity.');
}
function stageGrummanCollection(g: Game) {
  const owner = byFaction(g, 'moritani');
  if (!owner || !g.homeworlds?.custody || g.grummanCollection?.turn === g.turn) return;
  const frame: GrummanCollection = { event: crypto.randomUUID(), turn: g.turn,
    player: owner.id, stage: 'waiting', signature: '' };
  frame.signature = grummanCollectionSignature(frame);
  g.grummanCollection = frame;
}
function grummanCollectionAutomatic(g: Game): boolean {
  const frame = g.grummanCollection;
  return !!(frame?.stage === 'waiting' && frame.turn === g.turn && g.phase === 7 &&
    !g.phaseOpening && !g.decision && !g.response && !g.truthtrance && !g.pendingTreacheryDiscard &&
    !g.pendingNullentropy && !g.pendingExchange && !g.pendingRicheseGift && !g.pendingKarama &&
    (!g.ecazCollection || g.ecazCollection.stage === 'complete') &&
    homeworldRule(() => quoteGrummanCollection(g, frame.player)).high);
}
function resumeGrummanCollection(g: Game) {
  if (!grummanCollectionAutomatic(g)) return;
  const frame = g.grummanCollection!;
  frame.stage = 'choice';
  frame.signature = grummanCollectionSignature(frame);
  g.decision = { kind: 'grummanCollection', player: frame.player, event: frame.event };
}
function decideGrummanCollection(g: Game, p: Player, action: Action) {
  const frame = g.grummanCollection;
  requireRule(frame?.stage === 'choice' && frame.player === p.id && frame.event === action.event,
    'Choose the current Grumman Collection opportunity.');
  if (action.decline === true) {
    requireRule(action.token === undefined && action.territory === undefined && action.mode === undefined,
      'Declining Grumman does not move a token or collect spice.');
    frame.outcome = 'decline';
    log(g, `${p.name} declined Grumman’s optional Terror change; no bank spice was collected.`);
  } else {
    requireRule(action.mode === 'add' || action.mode === 'remove', 'Choose a Grumman token operation.');
    requireRule(typeof action.token === 'string', 'Choose a physical Terror token.');
    const destination = typeof action.territory === 'string' ? action.territory : '';
    requireRule(action.mode !== 'add' || !!destination, 'Choose a stronghold for the added token.');
    const intent = action.mode === 'remove'
      ? { mode: 'remove' as const, token: action.token }
      : { mode: 'add' as const, token: action.token, destination };
    const quote = homeworldRule(() => quoteGrummanCollectionAction(g, p.id, intent));
    requireRule(Number.isSafeInteger(p.spice + quote.amount), 'Grumman income would overflow the spice balance.');
    g.moritaniTerror = quote.state;
    p.spice += quote.amount;
    frame.outcome = 'add'; frame.token = action.token; frame.territory = destination;
    log(g, `${p.name} added one hidden Terror token to ${territory(frame.territory).name}, which already held Terror, and received 4 spice from the bank. The separate Mentat placement remains available according to its own usage.`,
      { faction: p.faction, name: 'Grumman Collection' });
  }
  frame.stage = 'complete';
  frame.signature = grummanCollectionSignature(frame);
}
function projectedGrummanCollection(g: Game, player: string) {
  const frame = g.grummanCollection;
  if (frame?.stage !== 'choice') return null;
  const quote = homeworldRule(() => quoteGrummanCollection(g, frame.player));
  return { event: frame.event, player: frame.player, blocked: quote.blocked, removeBlocked: quote.removeBlocked,
    tokens: player === frame.player ? quote.tokens.map((token) => ({ id: token.id, kind: token.kind })) : [],
    destinations: player === frame.player ? quote.destinations.map((id) => ({ id, name: territory(id).name })) : [] };
}
function commitCollection(
  g: Game,
  quote: ReturnType<typeof quoteSpiceCollection>,
  canceled = false,
) {
  const sourceSpice = { ...g.spice };
  applyAdvisorReleases(g, quote.released);
  g.spice = quote.spice;
  for (const receipt of quote.receipts) {
    const p = getPlayer(g, receipt.player);
    p.spice = receipt.balance;
    if (receipt.strongholds)
      log(
        g,
        `${faction(p.faction).name} received ${receipt.strongholds} spice from strongholds.`,
      );
    if (receipt.collected)
      log(
        g,
        `${faction(p.faction).name} collected ${receipt.collected} spice.`,
      );
  }
  const allocation = collectionAllocation(() =>
    createSpiceAllocation(quote.shared),
  );
  if (
    quote.collectionBonus ||
    allocation ||
    g.ecazCollection?.turn === g.turn
  ) {
    g.ecazCollection = {
      turn: g.turn,
      event:
        g.ecazCollection?.turn === g.turn
          ? g.ecazCollection.event
          : crypto.randomUUID(),
      stage: allocation ? 'allocation' : 'complete',
      canceled,
      allocation,
      settled: [],
      sourceSpice,
      boardSignature: collectionBoardSignature(g),
    };
  }
  if (quote.collectionBonus && !canceled)
    log(
      g,
      `Ecaz Collection paid both allies their full income in ${quote.collectionBonus.strongholds.map((id) => territory(id).name).join(', ')}.`,
      { faction: 'ecaz', name: 'Collection' },
    );
  if (allocation) {
    g.decision = { kind: 'ecazSpice', player: allocation.player };
    log(
      g,
      `Ecaz and its ally collected ${quote.shared.reduce((sum, lot) => sum + lot.amount, 0)} shared desert spice. Allocate each territory by agreement, or split it equally with any odd spice going to the ally.`,
    );
  }
  for (const receipt of quote.receipts)
    creditGiediCollection(g, receipt.player, receipt.desert);
  stageGrummanCollection(g);
}
function collect(g: Game) {
  if (g.grummanCollection?.turn === g.turn) {
    grummanCollectionIntegrity(g);
    return;
  }
  if (g.ecazCollection?.turn === g.turn) {
    ecazCollectionIntegrity(g);
    return;
  }
  if (g.giediCollection?.turn === g.turn) {
    homeworldRule(() => validateGiediCollection(g, g.turn, g.giediCollection));
    return;
  }
  const quote = boardResolution(() => quoteSpiceCollection(g));
  if (quote.collectionBonus) {
    applyAdvisorReleases(g, quote.released);
    g.ecazCollection = {
      turn: g.turn,
      event: crypto.randomUUID(),
      stage: 'response',
      canceled: false,
      allocation: null,
      settled: [],
      sourceSpice: { ...g.spice },
      boardSignature: collectionBoardSignature(g),
    };
    g.response = {
      kind: 'ecazCollection',
      owner: quote.collectionBonus.owner,
      passed: [],
    };
    return;
  }
  commitCollection(g, quote);
}
function decideSharedSpice(g: Game, id: string, action: Action) {
  ecazCollectionIntegrity(g);
  const pending = g.ecazCollection;
  requireRule(
    pending?.stage === 'allocation' &&
      pending.allocation &&
      action.event === pending.event,
    'Choose the current shared-spice allocation.',
  );
  const result = collectionAllocation(() =>
    quoteSpiceAllocation(
      pending.allocation!,
      id,
      action.allocation as SpiceAllocationAction,
    ),
  );
  const receipt = result.receipt;
  if (receipt) {
    for (const [owner, amount] of [
      [receipt.ecaz, receipt.ecazAmount],
      [receipt.ally, receipt.allyAmount],
    ] as const) {
      const p = getPlayer(g, owner);
      requireRule(
        Number.isSafeInteger(p.spice) &&
          p.spice >= 0 &&
          Number.isSafeInteger(p.spice + amount) &&
          p.spice + amount >= 0,
        'Shared collection would overflow the spice balance.',
      );
    }
    pending.settled.push(receipt);
    getPlayer(g, receipt.ecaz).spice += receipt.ecazAmount;
    getPlayer(g, receipt.ally).spice += receipt.allyAmount;
    creditGiediCollection(g, receipt.ecaz, receipt.ecazAmount);
    creditGiediCollection(g, receipt.ally, receipt.allyAmount);
    log(
      g,
      `${territory(receipt.territory).name} shared collection: Ecaz received ${receipt.ecazAmount} spice and ${faction(getPlayer(g, receipt.ally).faction).name} received ${receipt.allyAmount}, ${receipt.method === 'agreement' ? 'by agreement' : 'using the equal split with any odd spice going to the ally'}.`,
      { faction: 'ecaz', name: 'Shared collection' },
    );
  } else
    log(
      g,
      `${getPlayer(g, id).name} proposed a split of the shared spice in ${territory(pending.allocation.lots[pending.allocation.index].territory).name}. The other ally may accept, counter or use the equal split.`,
    );
  if (result.next) {
    pending.allocation = result.next;
    g.decision = { kind: 'ecazSpice', player: result.next.player };
  } else {
    pending.stage = 'complete';
    pending.allocation = null;
    g.decision = null;
  }
}

function victory(g: Game, quote: VictoryQuote = currentVictoryQuote(g)) {
  applyAdvisorReleases(g, quote.released);
  g.winner = quote.winner;
  g.status = quote.status;
  if (g.winner.length) {
    g.status = 'finished';
    const occupy = strongholdProgress(g).progress.find(
      (row) =>
        row.occupyTarget !== null &&
        row.jointlyOccupied.length >= row.occupyTarget &&
        row.members.length === g.winner.length &&
        row.members.every((id) => g.winner.includes(id)),
    );
    log(
      g,
      `${g.winner.map((id) => faction(getPlayer(g, id).faction).name).join(' and ')} won the game.${occupy ? ` Ecaz Occupy: both allies occupy ${occupy.jointlyOccupied.map((id) => territory(id).name).join(', ')} without opposing fighters, meeting the three-stronghold alliance target.` : ''}`,
    );
  } else if (g.status === 'finished')
    log(g, 'The tenth turn ended without a winner.');
  if (quote.strongholds) settleStrongholdOwnership(g, quote.strongholds);
}
function cardOf(p: Player, id: string | null) {
  return p.hand.find((c) => c.id === id);
}
function validateResidualPoison(
  g: Game,
  p: Player,
  cardId: string,
  targetId: string,
  event: string,
) {
  const b = g.battle;
  requireRule(
    g.status === 'playing' &&
      g.phase === 6 &&
      b &&
      !b.revealed &&
      [b.attacker, b.defender].includes(p.id),
    'Use Residual Poison against your opponent in the current battle.',
  );
  requireRule(
    b.event && b.event === event,
    'This battle opportunity is stale or predates the saved card timing.',
  );
  requireRule(
    targetId === (b.attacker === p.id ? b.defender : b.attacker),
    'Residual Poison targets your actual opposing combatant.',
  );
  requireRule(
    !Object.keys(b.plans).length &&
      ![b.attacker, b.defender].some(owner => committedPlanElements(b, owner).some(element => element.field === 'leader')),
    'Residual Poison must be played before either combatant commits a leader.',
  );
  requireRule(!(b.nexusInspection?.mode === 'cunning' && b.nexusInspection.stage === 'answered'),
    'Residual Poison after two inspected elements awaits the ruling for incompatible surviving commitments.');
  requireRule(
    !g.truthtrance && !g.response && !g.decision && !g.phaseOpening,
    'Resolve the current interaction before playing Residual Poison.',
  );
  const card = p.hand.find((c) => c.id === cardId);
  requireRule(
    card && richeseCardDefinition(card)?.card.effect === 'residualPoison',
    'Choose the canonical Residual Poison in your hand.',
  );
  const reserved = transferCardBlock(g, p, card);
  requireRule(!reserved, reserved ?? 'The card is committed.');
  // Guard on public configuration, never on whether a particular hidden captive exists.
  requireRule(
    !(g.advanced && byFaction(g, 'harkonnen')),
    'Residual Poison with advanced Harkonnen capture awaits the secret-captive disclosure ruling.',
  );
  const target = getPlayer(g, targetId),
    controlled = controlledLeaders(g, target);
  requireRule(
    !controlled.some(
      (l) =>
        l.concealed ||
        (l.capturedBy && l.gholaBy) ||
        (l.id === DUKE_VIDAL_ID && (l.capturedBy || l.gholaBy)),
    ),
    'This exceptional leader custody is not yet supported for Residual Poison.',
  );
  const candidates = noFieldRule(() =>
    residualPoisonCandidates(controlled, b.territory),
  );
  requireRule(
    candidates.length > 0,
    'The opposing combatant has no available physical leader for this card.',
  );
  for (const candidate of candidates)
    noFieldRule(() => residualPoisonDeath(candidate));
  const hand = p.hand.filter((c) => c.id !== card.id);
  validateTransferCompletion(g, p, p, hand, hand, {
    type: 'card',
    card: card.id,
  });
  return { b, card, target, candidates };
}
function playResidualPoison(
  g: Game,
  p: Player,
  cardId: string,
  targetId: string,
  event: string,
) {
  const { b, card, target, candidates } = validateResidualPoison(
    g,
    p,
    cardId,
    targetId,
    event,
  );
  const selected = shuffle(candidates)[0];
  const victim = controlledLeaders(g, target).find(
    (l) => l.id === selected.id,
  )!;
  const dead = residualPoisonDeath(victim);
  Object.assign(victim, dead);
  delete victim.usedAt;
  if (victim.capturedBy) {
    delete victim.capturedBy;
    delete victim.concealed;
  }
  if (victim.id === DUKE_VIDAL_ID && g.dukeVidal)
    g.dukeVidal = consumeDuke(g.dukeVidal);
  const harkonnen = byFaction(g, 'harkonnen');
  if (harkonnen) returnCaptives(g, harkonnen);
  discard(g, p, card.id);
  log(
    g,
    `${p.name} played Residual Poison against ${target.name}. ${victim.name} was randomly selected from the available leaders and sent to the Tanks. No spice is awarded, no forces are lost, and battle preparation continues.`,
    { faction: p.faction, name: 'Residual Poison' },
  );
  reconcileChangedBattleInspections(g, 'the leader death');
  if (b.preLeader && !b.preLeader.closed)
    b.preLeader.ready = b.preLeader.ready.filter((id) => id !== p.id);
}
function reconcileChangedBattleInspections(g: Game, cause: string) {
  const b = g.battle!;
  // Retire an inspection made impossible by the opposing effect. Testing on
  // a private copy without Truthtrance avoids releasing a still-feasible truth
  // answer solely because an obsolete inspection was left in the trial.
  const insight = b.prescience;
  if (insight && 'value' in insight && insight.field !== 'leader') {
    const trial = structuredClone(g);
    trial.battle!.truthPromises = [];
    // A different impossible disclosure must not falsely retire this one.
    // The real extra answer is tested afterward against any retained native
    // commitment; the trial keeps its signed first-answer relationship.
    if (trial.battle!.nexusInspection?.mode === 'cunning' && trial.battle!.nexusInspection.stage === 'answered' && trial.battle!.nexusInspection.field !== 'leader')
      trial.battle!.nexusInspection = nexusRule(() => reopenNexusInspection(battleInspectionContext(trial),trial.battle!.nexusInspection!));
    const answering = getPlayer(
      trial,
      insight.player === b.attacker ? b.defender : b.attacker,
    );
    if (!feasiblePrescience(trial, answering, insight.field, insight.value)) {
      if (b.nexusInspection?.mode === 'cunning')
        b.nexusInspection = nexusRule(() => reopenNexusNative(battleInspectionContext(g), b.nexusInspection!));
      delete insight.value;
      b.preparation = {
        kind: 'prescienceAnswer',
        owner: answering.id,
        beneficiary: insight.player,
      };
      log(
        g,
        `The prior inspected element no longer permits a legal battle plan after ${cause}. Its owner must answer that same element again; the earlier private value is not revealed.`,
      );
    }
  }
  const nexus = b.nexusInspection;
  if (nexus?.stage === 'answered' && nexus.field !== 'leader') {
    const trial = structuredClone(g);
    trial.battle!.truthPromises = [];
    if (!findReachableBattlePlan(trial, getPlayer(trial, nexus.target))) {
      b.nexusInspection = nexusRule(() => reopenNexusInspection(battleInspectionContext(g), nexus));
      finishInspectionAnswers(g);
      log(g, `After ${cause}, the inspected element became impossible. Its owner must answer the same element again; the earlier private observation is retained.`);
    }
  }
  reconcileBattlePromises(g);
}
function residualPoisonView(g: Game, p: Player) {
  const card = p.hand.find(
    (c) => richeseCardDefinition(c)?.card.effect === 'residualPoison',
  );
  if (!card) return null;
  const b = g.battle,
    target =
      b && [b.attacker, b.defender].includes(p.id)
        ? b.attacker === p.id
          ? b.defender
          : b.attacker
        : null;
  let blocked: string | null = null;
  try {
    validateResidualPoison(g, p, card.id, target ?? '', b?.event ?? '');
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    blocked = error.message;
  }
  return { card, event: b?.event ?? null, target, blocked };
}
function controlledLeaders(g: Game, p: Player) {
  const native = g.players.flatMap((owner) =>
    owner.leaders.filter((l) => controlsLeader(p, l)),
  );
  const duke = g.dukeVidal;
  if (
    duke &&
    duke.controller === p.id &&
    !duke.leader.capturedBy &&
    !duke.leader.gholaBy &&
    !(g.advanced && byFaction(g, 'harkonnen'))
  )
    native.push(duke.leader);
  return native;
}
function returnCaptives(g: Game, captor: Player) {
  if (captor.leaders.some((l) => !l.dead)) return;
  let returned = 0;
  for (const owner of g.players)
    for (const l of owner.leaders)
      if (l.capturedBy === captor.id) {
        delete l.capturedBy;
        delete l.concealed;
        returned++;
      }
  if (returned)
    log(
      g,
      `${captor.name} returned ${returned} captive leaders because all native leaders are dead.`,
    );
}
function captureCandidates(g: Game, loser: string, t: string) {
  return controlledLeaders(g, getPlayer(g, loser)).filter(
    (l) => !isAuditorLeader(l) && !l.dead && (!l.usedAt || l.usedAt === t),
  );
}
function projectLeader(g: Game, l: Leader, viewer: string): Leader {
  const { concealed, capturedBy, ...visible } = l;
  const owner = g.players.find((p) => p.faction === l.faction);
  if (
    concealed &&
    ![concealed.controller ?? owner?.id, concealed.captor].includes(viewer) &&
    !(getPlayer(g, viewer).faction === 'tleilaxu' && l.dead && !l.capturedBy)
  ) {
    const result = {
      ...visible,
      dead: concealed.dead,
      deaths: concealed.deaths,
    };
    delete result.usedAt;
    if (concealed.usedAt) result.usedAt = concealed.usedAt;
    return result;
  }
  return { ...visible, ...(capturedBy ? { capturedBy } : {}) };
}
/** Public alternatives deliberately never read a foreign No-Field token value. */
function stonePublicPools(
  g: Game,
  p: Player,
  opponent: Player,
): CombatForces[] {
  const t = g.battle!.territory;
  const hiddenMarker = p.noField?.deployed?.location.territory === t;
  const pool = combatForces(
    g,
    hiddenMarker ? { ...p, noField: undefined } : p,
    t,
    opponent,
  );
  return hiddenMarker
    ? Array.from({ length: 6 }, (_, n) => ({
        ...pool,
        normal: pool.normal + n,
      }))
    : [pool];
}
function stoneTimingBlock(g: Game): string | null {
  return g.expansions.includes('ix')
    ? 'Stone Burner with the Ix expansion is awaiting a ruling on its simultaneous revealed choice with Poison Tooth. This implementation boundary applies before either hidden plan is submitted.'
    : null;
}
function stonePlanBlock(
  g: Game,
  p: Player,
  dial: number,
  support: number,
): string | null {
  const b = g.battle!;
  const opponent = getPlayer(g, b.attacker === p.id ? b.defender : b.attacker);
  return (
    stoneTimingBlock(g) ??
    stonePublicPools(g, opponent, p)
      .map((pool) =>
        stoneBurnerPlanBlock(
          combatForces(g, p, b.territory, opponent),
          dial,
          support,
          pool,
          b.attacker === p.id ? 'attacker' : 'defender',
          battleTieWinner(g) === b.attacker ? 'attacker' : 'defender',
        ),
      )
      .find(Boolean) ??
    null
  );
}
function stoneCompulsionBlock(g: Game, target: Player): string | null {
  const b = g.battle!;
  const other = getPlayer(
    g,
    b.attacker === target.id ? b.defender : b.attacker,
  );
  const timing = stoneTimingBlock(g);
  if (timing) return timing;
  const opponents = stonePublicPools(g, other, target);
  for (const own of stonePublicPools(g, target, other)) {
    const supported = Array.from(
      { length: maxCombatDial(own) * 2 + 1 },
      (_, n) => n / 2,
    ).some(
      (dial) =>
        casualtyOptions(own, dial, 0).length &&
        opponents.every(
          (opponent) =>
            !stoneBurnerPlanBlock(
              own,
              dial,
              0,
              opponent,
              b.attacker === target.id ? 'attacker' : 'defender',
              battleTieWinner(g) === b.attacker ? 'attacker' : 'defender',
            ),
        ),
    );
    if (!supported)
      return 'Compelling Stone Burner cannot guarantee a supported zero-spice plan across the public force possibilities; the combined allocation timing is unresolved.';
  }
  return null;
}
function validatePlan(
  g: Game,
  p: Player,
  input: Record<string, unknown>,
  promises = g.battle?.truthPromises ?? [],
): Plan {
  const b = g.battle!;
  const opponent = getPlayer(g, b.attacker === p.id ? b.defender : b.attacker);
  const forces = combatForces(g, p, b.territory, opponent);
  const typedForces = g.advanced || p.faction === 'ixians';
  const dial = typedForces
    ? Number(input.dial)
    : integer(input.dial, 0, forces.normal + forces.elite, 'Forces dialed');
  const support = g.advanced
    ? integer(input.support ?? 0, 0, battleSupportBudget(g, p), 'Spice support')
    : 0;
  requireRule(
    !typedForces ||
      (typeof input.dial === 'number' &&
        casualtyOptions(forces, dial, support).length > 0),
    'Dial and spice must match a legal force commitment.',
  );
  const allyPayment = integer(
    input.allyPayment ??
      Math.max(0, battleSupportCost(g, p, support) - p.spice),
    Math.max(0, battleSupportCost(g, p, support) - p.spice),
    Math.min(battleSupportCost(g, p, support), battleAidFor(g, p)?.amount ?? 0),
    'Battle ally payment',
  );
  const plan: Plan = {
    ...(allyPayment ? { allyPayment } : {}),
    dial,
    leader:
      typeof input.leader === 'string' && input.leader ? input.leader : null,
    weapon:
      typeof input.weapon === 'string' && input.weapon ? input.weapon : null,
    defense:
      typeof input.defense === 'string' && input.defense ? input.defense : null,
    support,
  };
  requireRule(
    input.kwisatz === undefined || typeof input.kwisatz === 'boolean',
    'Choose whether to use the Kwisatz Haderach.',
  );
  if (input.kwisatz) {
    requireRule(
      g.advanced &&
        p.faction === 'atreides' &&
        p.battleLosses >= 7 &&
        !p.kwisatz?.dead &&
        (!p.kwisatz?.usedAt || p.kwisatz.usedAt === b.territory) &&
        !b.kwisatzBlocked,
      'Kwisatz Haderach is not available in this battle.',
    );
    requireRule(
      plan.leader,
      'Kwisatz Haderach must accompany a leader or Cheap Hero.',
    );
    plan.kwisatz = true;
  }
  const available = controlledLeaders(g, p).filter(
    (l) => !l.dead && (!l.usedAt || l.usedAt === b.territory),
  );
  const l = available.find((l) => l.id === plan.leader);
  const hero = cardOf(p, plan.leader)?.kind === 'hero';
  requireRule(
    !plan.leader || l || hero,
    'That leader is not available for this battle.',
  );
  requireRule(
    plan.leader ||
      (!available.length &&
        (!p.hand.some((c) => c.kind === 'hero') ||
          (b.voice?.target === p.id &&
            !b.voice.must &&
            b.voice.kind === 'hero'))),
    'You must use an available leader or cheap hero.',
  );
  const w = cardOf(p, plan.weapon),
    d = cardOf(p, plan.defense);
  requireRule(
    !plan.weapon || (w && isWeaponCard(w)),
    'Choose a weapon or worthless card.',
  );
  requireRule(
    !plan.defense || (d && isDefenseCard(d)),
    'Choose a defense or worthless card.',
  );
  requireRule(
    !plan.weapon || plan.weapon !== plan.defense,
    'One card cannot fill both slots.',
  );
  requireRule(
    plan.leader || (!plan.weapon && !plan.defense),
    'Without a leader, no battle cards can be played.',
  );
  requireRule(
    validBattleCardPair(w, d),
    'Chemistry as a weapon needs another defense; Weirding Way as a defense needs another weapon.',
  );
  if (isStoneBurner(w)) {
    const blocked = stonePlanBlock(g, p, dial, support);
    requireRule(
      !blocked,
      blocked ?? 'Stone Burner cannot resolve this commitment.',
    );
  }
  if (b.voice?.target === p.id) {
    const v = b.voice;
    const canPlayCards =
      available.length > 0 || p.hand.some((c) => c.kind === 'hero');
    const has =
      canPlayCards && p.hand.some((c) => defaultVoiceMatch(c, v.kind));
    const used =
      playedVoiceMatch(cardOf(p, plan.leader), 'leader', v.kind) ||
      playedVoiceMatch(w, 'weapon', v.kind) ||
      playedVoiceMatch(d, 'defense', v.kind);
    requireRule(
      v.must ? !has || used : !used,
      'Your battle plan must comply with the Voice.',
    );
  }
  for (const element of committedPlanElements(b, p.id))
    requireRule(
      plan[element.field] === element.value,
      'Every element revealed by a battle inspection must remain unchanged.',
    );
  requireRule(
    respectsBattlePromises(
      promises,
      p.id,
      { ...plan, kwisatz: !!plan.kwisatz },
      p.hand,
    ),
    'Your battle plan must honor your Truthtrance answers.',
  );
  return plan;
}
function currentCombatResponseQuote(
  g: Game,
  operation: CombatResponseOperation,
) {
  try {
    return quoteCombatResponse(
      {
        status: g.status,
        phase: g.phase,
        advanced: g.advanced,
        territoryIds: combatLocations(g).map((t) => t.id),
        players: g.players.map((p) => ({
          id: p.id,
          faction: p.faction,
          ally: p.ally,
          specialKaramaUsed: p.specialKaramaUsed,
        })),
        battle: g.battle,
      },
      operation,
    );
  } catch (error) {
    if (error instanceof CombatResponseQuoteError)
      throw new RuleError(error.message);
    throw error;
  }
}
function commitCombatResponseQuote(g: Game, quote: CombatResponseQuote) {
  const b = g.battle!;
  if (quote.powerChecks !== undefined) b.powerChecks = quote.powerChecks;
  const patch = quote.patches;
  if (patch.eliteBlocked !== undefined) b.eliteBlocked = patch.eliteBlocked;
  if (patch.fremenSupportBlocked !== undefined)
    b.fremenSupportBlocked = patch.fremenSupportBlocked;
  if (patch.kwisatzBlocked !== undefined)
    b.kwisatzBlocked = patch.kwisatzBlocked;
  if (patch.choamAidBlocked !== undefined)
    b.choamAidBlocked = patch.choamAidBlocked;
  if (patch.deleteVoice) delete b.voice;
  if (patch.deletePrescience) delete b.prescience;
  if (patch.deletePreparation) delete b.preparation;
  if (patch.fullPlanOffered) b.fullPlanOffered = true;
  if (quote.response) g.response = quote.response;
  if (quote.decision) g.decision = quote.decision;
}
function nextCombatResponse(g: Game) {
  commitCombatResponseQuote(g, currentCombatResponseQuote(g, { kind: 'next' }));
}
function combatResponses(g: Game) {
  const b = g.battle!;
  b.powerChecks = [];
  for (const id of [b.attacker, b.defender]) {
    const p = getPlayer(g, id),
      other = getPlayer(g, id === b.attacker ? b.defender : b.attacker);
    if (g.advanced && p.faction === 'atreides')
      b.powerChecks.push({ kind: 'kwisatz', owner: id });
    if (
      ((g.advanced && ['emperor', 'fremen'].includes(p.faction)) ||
        (!g.advanced && p.faction === 'ixians')) &&
      !(p.faction === 'emperor' && other.faction === 'fremen') &&
      combatForces(g, p, b.territory, other).elite > 0
    )
      b.powerChecks.push({ kind: 'eliteStrength', owner: id });
    if (g.advanced && p.faction === 'fremen')
      b.powerChecks.push({ kind: 'fremenSupport', owner: id });
  }
  const choam = byFaction(g, 'choam');
  if (
    g.advanced &&
    choam?.ally &&
    [b.attacker, b.defender].includes(choam.ally) &&
    getPlayer(g, choam.ally).ally === choam.id
  )
    b.powerChecks.push({ kind: 'choamBattleAid', owner: choam.id });
  nextCombatResponse(g);
}
function finishBattlePreparation(g: Game) {
  commitCombatResponseQuote(
    g,
    currentCombatResponseQuote(g, { kind: 'finishPreparation' }),
  );
}
function battlePreparation(g: Game, kind: 'voice' | 'prescience') {
  const b = g.battle!;
  const owner = byFaction(g, kind === 'voice' ? 'beneGesserit' : 'atreides');
  const combatants = [b.attacker, b.defender];
  const beneficiary =
    owner &&
    (combatants.includes(owner.id)
      ? owner.id
      : owner.ally && combatants.includes(owner.ally)
        ? owner.ally
        : null);
  if (owner && beneficiary)
    b.preparation = { kind, owner: owner.id, beneficiary };
  else if (kind === 'voice') battlePreparation(g, 'prescience');
  else finishBattlePreparation(g);
}
function normalizeBattle(g: Game) {
  const b = g.battle;
  if (!b || b.prepared || b.revealed) return;
  b.prepared = true;
  if (b.prescience && !('value' in b.prescience)) {
    const target = b.prescience.player === b.attacker ? b.defender : b.attacker;
    const priorPlan = b.plans[target];
    if (priorPlan) b.prescience.value = priorPlan[b.prescience.field];
    else
      b.preparation = {
        kind: 'prescienceAnswer',
        owner: target,
        beneficiary: b.prescience.player,
      };
  } else if (!Object.keys(b.plans).length)
    battlePreparation(g, b.voice ? 'prescience' : 'voice');
}
/** Ghola follows current control for ordinary leaders, but Duke's printed
 * revival right belongs exclusively to Ecaz, regardless of temporary custody. */
function gholaLeaders(g: Game, p: Player) {
  return controlledLeaders(g, p).filter(
    (l) =>
      l.dead &&
      !l.capturedBy &&
      (l.id !== DUKE_VIDAL_ID ||
        (p.faction === 'ecaz' && !ecazDukeRevivalBlock(g, p.id))),
  );
}
function gholaOptions(g: Game, p: Player) {
  const cards = p.hand
    .filter(
      (c) =>
        c.effect === 'ghola' &&
        !(
          g.richeseAuction?.source === 'blackMarket' &&
          !g.currentAuctionSale &&
          g.richeseAuction.owner === p.id &&
          g.richeseAuction.cardId === c.id
        ),
    )
    .map((c) => c.id);
  const card = p.hand.find((c) => cards.includes(c.id));
  const timing = card
    ? ordinaryCardAvailability(
        {
          ...g,
          me: p.id,
          players: [p],
        },
        card.id,
      )
    : null;
  const leaders = gholaLeaders(g, p).map(({ id, name, strength }) => ({
    id,
    name,
    strength,
  }));
  const kwisatz = !!(g.advanced && p.faction === 'atreides' && p.kwisatz?.dead);
  const eliteBlock = homeworldSardaukarGholaBlock(g, p.id);
  const eliteRemaining = eliteBlock ? 0 : Math.min(
    p.elites?.tanks ?? 0,
    eliteRevivalRemaining(p, g.advanced),
  );
  const maxForces = Math.min(
    5,
    p.tanks - (p.elites?.tanks ?? 0) + eliteRemaining,
  );
  const reason = !card
    ? 'No Ghola card is available in your hand.'
    : g.pendingTreacheryDiscard
      ? 'Finish the current card disposal first.'
      : g.pendingNullentropy
        ? 'Finish the paid Nullentropy Box search first.'
        : timing && !timing.available
          ? timing.reason
          : !leaders.length && !kwisatz && maxForces <= 0
            ? 'No eligible leader or force is available in your Tanks.'
            : null;
  return {
    cards,
    leaders,
    kwisatz,
    maxForces,
    eliteRemaining,
    eliteBlock,
    available: reason === null,
    reason,
  };
}
function marketGholaIntegrity(g: Game) {
  nexusCardsIntegrity(g);
  nexusTraitorIntegrity(g);
  nexusFaceDancerIntegrity(g);
  nexusSuboidIntegrity(g);
  nexusAdvisorIntegrity(g);
  nexusSardaukarIntegrity(g);
  nexusChoamIntegrity(g);
  traitorDeclarationIntegrity(g);
  nexusInspectionIntegrity(g);
  homeworldHistoryIntegrity(g);
  grummanCollectionIntegrity(g);
  homeworldVictoryReturnIntegrity(g);
  homeworldRevivalReturnIntegrity(g);
  terrorEntryIntegrity(g);
  homeworldRule(() => validateGiediCollection(g, g.turn, g.giediCollection));
  currentFactionPayment(g);
  battleCardRolesIntegrity(g);
  winnerDiscardsIntegrity(g);
  const endError = biddingEndError(g);
  requireRule(!endError, endError ?? 'Invalid end-of-Bidding opportunity.');
  const error = choamMarketGholaError(g);
  requireRule(!error, error ?? 'Invalid Ghola market interruption.');
}
function resumeMarketGhola(g: Game) {
  if (g.homeworldRevivalReturn && g.homeworldRevivalReturn.stage !== 'complete') return;
  const pending = g.pendingChoamMarketGhola;
  if (!pending || pending.stage !== 'complete' || g.pendingTreacheryDiscard || g.pendingNullentropy ||
      g.response || g.decision || g.pendingKarama || g.truthtrance ||
      g.phaseOpening || g.pendingRicheseGift || g.pendingExchange) return;
  marketGholaIntegrity(g);
  g.response = structuredClone(pending.response);
  g.pendingChoamMarketGhola = null;
}
function playMarketGhola(g: Game, p: Player, action: Action) {
  requireRule(choamSaleGholaTiming(g) && !g.pendingChoamMarketGhola,
    'Finish the current Ghola interruption first.');
  const card = p.hand.find((c) => c.id === action.card && c.effect === 'ghola');
  requireRule(card && !action.mode, 'Choose an owned Ghola card.');
  const options = gholaOptions(g, p);
  requireRule(options.available, options.reason ?? 'Ghola is unavailable.');
  requireRule(!g.pendingKarama && !g.pendingRicheseGift && !g.pendingExchange,
    'Finish the nested exchange before playing Ghola.');
  const reserved = ambassadorDiscardBlock(g, p, card);
  requireRule(!reserved, reserved ?? 'This Ghola is already committed.');
  choamSaleCancellationQuote(g, g.response!);
  g.pendingChoamMarketGhola = {
    turn: g.turn, phase: g.phase, player: p.id, card: card.id,
    discardSequence: (g.treacheryDiscardSequence ?? 0) + 1,
    event: '', stage: 'discard',
    response: structuredClone(g.response!), market: structuredClone(g.choamMarket!),
  };
  g.pendingChoamMarketGhola.event = choamGholaEvent(g.pendingChoamMarketGhola);
  g.response = null;
  applyGholaEffect(g, p, action, card.id);
  if (g.response) (g.response as ResponseWindow).intent = g.pendingChoamMarketGhola.event;
  const used = discard(g, p, card.id);
  log(g, `${p.name} played ${card.name}. The declared CHOAM sale waits for this revival and its income to finish.`,
    { faction: p.faction, name: 'Ghola revival' });
  stageOrdinaryCardDiscard(g, p, used);
}
function applyGholaEffect(g: Game, p: Player, action: Action, cardId?: string) {
  if (action.leader === 'kwisatz') {
    requireRule(
      g.advanced && p.faction === 'atreides' && p.kwisatz?.dead,
      'Kwisatz Haderach is not in the tanks.',
    );
    p.kwisatz.dead = false;
    delete p.kwisatz.usedAt;
    p.kwisatz.revivalCycle =
      Math.max(p.revivalCycle, p.kwisatz.revivalCycle ?? 1) + 1;
    log(
      g,
      `${p.name} revived Kwisatz Haderach with Ghola for use again this turn. No spice or normal leader-revival allowance was spent.`,
    );
  } else if (action.leader) {
    requireRule(
      action.leader !== DUKE_VIDAL_ID || p.faction === 'ecaz',
      'Only Ecaz may revive Duke Vidal, including with Ghola.',
    );
    const l = gholaLeaders(g, p).find((l) => l.id === action.leader);
    requireRule(l?.dead && !l.capturedBy, 'Choose a dead leader in your pool.');
    l.dead = false;
    delete l.concealed;
    // GF9 November 2020 FAQ p.9 permits a Ghola return in another battle
    // this turn. Death history remains; the earlier battle location does not.
    delete l.usedAt;
    log(
      g,
      `${p.name} revived ${l.name} with Ghola. The leader may fight again this turn; no spice or normal leader-revival allowance was spent.`,
    );
  } else {
    const n = integer(
      action.amount ?? Math.min(5, p.tanks),
      1,
      Math.min(5, p.tanks),
      'Forces',
    );
    const elite = eliteChoice(n, p.tanks, p.elites?.tanks ?? 0, action.elite);
    const eliteBlock = elite > 0 ? homeworldSardaukarGholaBlock(g, p.id) : null;
    requireRule(!eliteBlock, eliteBlock ?? 'Choose an eligible Ghola return.');
    requireRule(
      elite <= eliteRevivalRemaining(p, g.advanced),
      'Only one elite force may be revived per turn.',
    );
    const group = { amount: n, elite, free: 0 };
    const grant = requireHomeworldRevivalGrant(g, p, 'ghola', group);
    addRevivedReserves(g, p, n, elite);
    p.tanks -= n;
    if (p.elites) {
      p.elites.tanks -= elite;
      p.elites.revived += elite;
    }
    log(
      g,
      `${p.name} revived ${n} forces${elite ? `, including ${elite} elite force${elite === 1 ? '' : 's'}` : ''} with Ghola. They returned to reserves for free without using the normal force-revival allowance.`,
    );
    if (cardId) stageHomeworldRevivalReturn(g, p, 'ghola', group, grant, cardId);
  }
  techIncome(g, 'axlotl', p);
  collectRevivalIncome(g, p, 0, false, true);
}
/** Search complete legal plans without learning or consulting the opponent's sealed choices. */
function findLegalBattlePlan(
  g: Game,
  p: Player,
  options: {
    promises?: BattlePromise[];
    prescience?: { field: PlanField; value: unknown };
  } = {},
): Plan | null {
  const b = g.battle!;
  const promises = options.promises ?? b.truthPromises ?? [];
  const fixed = options.prescience;
  const commitments = committedPlanElements(b, p.id);
  const accepts = (plan: Partial<Plan>) =>
    commitments.every(element =>
      plan[element.field] === undefined || plan[element.field] === element.value) &&
    respectsBattlePromises(promises, p.id, plan, p.hand) &&
    (!fixed ||
      plan[fixed.field] === undefined ||
      plan[fixed.field] === fixed.value);
  if (b.plans[p.id]) {
    const sealed = { ...b.plans[p.id], kwisatz: !!b.plans[p.id].kwisatz };
    return accepts(sealed) ? sealed : null;
  }
  const opponent = getPlayer(g, b.attacker === p.id ? b.defender : b.attacker);
  const forces = combatForces(g, p, b.territory, opponent);
  const typed = g.advanced || p.faction === 'ixians';
  const maxDial = typed ? maxCombatDial(forces) : forces.normal + forces.elite;
  const numerical: { dial: number; support: number }[] = [];
  for (let dial = 0; dial <= maxDial; dial += typed ? 0.5 : 1)
    for (
      let support = 0;
      support <=
      (g.advanced && !forces.freeSupport
        ? Math.min(battleSupportBudget(g, p), maxCombatSupport(forces))
        : 0);
      support++
    ) {
      const n = { dial, support };
      if (
        accepts(n) &&
        (!typed || casualtyOptions(forces, dial, support).length)
      )
        numerical.push(n);
    }
  if (!numerical.length) return null;
  const leaderIds = [
    null,
    ...controlledLeaders(g, p)
      .filter((l) => !l.dead && (!l.usedAt || l.usedAt === b.territory))
      .map((l) => l.id),
    ...p.hand.filter((c) => c.kind === 'hero').map((c) => c.id),
  ];
  const weapons = [null, ...p.hand.filter(isWeaponCard).map((c) => c.id)];
  const defenses = [
    null,
    ...p.hand.filter((c) => isDefenseCard(c)).map((c) => c.id),
  ];
  for (const leader of leaderIds) {
    if (!accepts({ leader })) continue;
    for (const weapon of weapons) {
      if (!accepts({ leader, weapon })) continue;
      for (const defense of defenses) {
        if (
          !accepts({ leader, weapon, defense }) ||
          !validBattleCardPair(cardOf(p, weapon), cardOf(p, defense))
        )
          continue;
        for (const kwisatz of [false, true]) {
          const partial = { leader, weapon, defense, kwisatz };
          if (!accepts(partial)) continue;
          for (const n of numerical) {
            const candidate = { ...partial, ...n };
            if (!accepts(candidate)) continue;
            try {
              return validatePlan(g, p, candidate, promises);
            } catch (error) {
              if (!(error instanceof RuleError)) throw error;
            }
          }
        }
      }
    }
  }
  return null;
}
type BattleCompletion = {
  plan: Plan;
  actions: Action[];
  waitingForIncome: boolean;
};
function gholaPreparationActions(g: Game, p: Player): Action[] {
  const card = p.hand.find((c) => c.effect === 'ghola');
  if (!card) return [];
  const actions: Action[] = gholaLeaders(g, p)
    .sort((a, b) => b.strength - a.strength)
    .map((l) => ({ type: 'card', card: card.id, leader: l.id }));
  if (g.advanced && p.faction === 'atreides' && p.kwisatz?.dead)
    actions.push({ type: 'card', card: card.id, leader: 'kwisatz' });
  for (let amount = 1; amount <= Math.min(5, p.tanks); amount++)
    for (
      let elite = Math.max(0, amount - (p.tanks - (p.elites?.tanks ?? 0)));
      elite <=
      Math.min(
        amount,
        p.elites?.tanks ?? 0,
        eliteRevivalRemaining(p, g.advanced),
      );
      elite++
    )
      actions.push({ type: 'card', card: card.id, amount, elite });
  return actions;
}
function cashInPreparationActions(g: Game, p: Player): Action[] {
  if (p.faction !== 'choam' || !g.advanced || p.specialKaramaUsed) return [];
  const available = cashInCards(g, p);
  const actions: Action[] = [];
  for (const card of available.filter((c) => c.effect === 'karama')) {
    const others = available.filter((c) => c.id !== card.id);
    for (let mask = 1; mask < 2 ** others.length; mask++)
      actions.push({
        type: 'card',
        mode: 'special',
        card: card.id,
        cards: others.filter((_, i) => mask & (2 ** i)).map((c) => c.id),
      });
  }
  return actions;
}
/** Pending income can still be allowed; it is never counted as already paid. */
function pendingBattleRevivalIncome(g: Game, p: Player): number {
  const r =
    g.response?.kind === 'revivalIncome'
      ? g.response
      : g.pendingKarama?.use.kind === 'cancel'
        ? g.pendingKarama.use.response
        : null;
  return r?.kind === 'revivalIncome' && r.owner === p.id ? (r.amount ?? 0) : 0;
}
function findReachableBattlePlan(
  g: Game,
  p: Player,
  options: Parameters<typeof findLegalBattlePlan>[2] = {},
): BattleCompletion | null {
  const immediate = findLegalBattlePlan(g, p, options);
  if (immediate)
    return { plan: immediate, actions: [], waitingForIncome: false };
  if (g.battle!.revealed || g.battle!.plans[p.id]) return null;
  const initial = structuredClone(g);
  const player = getPlayer(initial, p.id);
  const pending = pendingBattleRevivalIncome(initial, player);
  if (pending) player.spice += pending;
  // The real table must finish its current window before it can execute a preparation action.
  if (initial.battle?.nexusInspection?.stage === 'response')
    initial.battle.nexusInspection = allowNexusInspection(battleInspectionContext(initial), initial.battle.nexusInspection);
  if (currentNexusSardaukar(initial)?.stage === 'pending') finishNexusSardaukar(initial,false);
  initial.response = null;
  initial.pendingKarama = null;
  // Search after Truthtrance resolves, retaining every existing or proposed
  // battle promise. This does not release a promise on the real table.
  initial.truthtrance = null;
  const queue: { state: Game; actions: Action[] }[] = [
    { state: initial, actions: [] },
  ];
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index],
      actor = getPlayer(node.state, p.id);
    if (node.actions.length || pending) {
      const plan = findLegalBattlePlan(node.state, actor, options);
      if (plan)
        return { plan, actions: node.actions, waitingForIncome: pending > 0 };
    }
    for (const action of [
      ...(node.state.status === 'playing' && node.state.phase === 6 && actor.faction === 'ixians' &&
        !actor.ally && node.state.nexusCards?.cards?.hands[actor.id] === 'ixians' &&
        node.state.nexusCards.phase?.stage !== 'drawing' && !node.state.pendingNullentropy &&
        !node.state.pendingTreacheryDiscard && !pendingNexusTraitors(node.state) &&
        !nexusSuboidsActive(node.state, node.state.nexusSuboidHistory, actor.id)
        ? [{ type: 'nexusSuboids', event: JSON.stringify(['nexusSuboids', node.state.turn, node.state.battle!.event, actor.id]) } as Action]
        : []),
      ...(actor.faction === 'emperor' && !nexusSardaukarEligibility(node.state,actor) &&
        node.state.nexusCards?.phase?.stage !== 'drawing' && !node.state.pendingNullentropy &&
        !node.state.pendingTreacheryDiscard && !pendingNexusTraitors(node.state)
        ? [{type:'nexusSardaukar',event:JSON.stringify(['nexusSardaukar',node.state.turn,node.state.battle!.event,actor.id])} as Action]
        : []),
      ...gholaPreparationActions(node.state, actor),
      ...cashInPreparationActions(node.state, actor),
    ]) {
      const trial = structuredClone(node.state),
        target = getPlayer(trial, p.id);
      try {
        if (action.type === 'nexusSuboids') commitNexusSuboids(trial, target);
        else if (action.type === 'nexusSardaukar') commitNexusSardaukar(trial,target,'active');
        else if (action.mode === 'special') specialKarama(trial, target, action);
        else {
          applyGholaEffect(trial, target, action);
          discard(trial, target, action.card as string);
        }
        // Cancellation remains a real response later; a possible allowed branch proves reachability.
        target.spice += pendingBattleRevivalIncome(trial, target);
        trial.response = null;
        trial.pendingKarama = null;
        queue.push({ state: trial, actions: [...node.actions, action] });
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
      }
    }
  }
  return null;
}
function shipmentPromiseIntegrity(g: Game) {
  try {
    validateSavedShipmentQuestion(g);
  } catch (error) {
    if (error instanceof TruthError) throw new RuleError(error.message);
    throw error;
  }
  const promises = g.shipmentPromises;
  requireRule(
    promises === undefined || Array.isArray(promises),
    'The saved shipment promises are invalid.',
  );
  for (const promise of promises ?? []) {
    requireRule(
      promise &&
        typeof promise === 'object' &&
        Number.isSafeInteger(promise.turn) &&
        promise.turn >= 1 &&
        promise.turn <= g.turn &&
        g.players.some((p) => p.id === promise.player) &&
        g.players.some(
          (p) => p.id === promise.asker && p.id !== promise.player,
        ) &&
        TERRITORIES.some((t) => t.id === promise.territory) &&
        Number.isSafeInteger(promise.minimum) &&
        promise.minimum >= 1 &&
        promise.minimum <= 20 &&
        typeof promise.answer === 'boolean' &&
        (promise.released === undefined ||
          typeof promise.released === 'boolean') &&
        (promise.fulfilled === undefined ||
          typeof promise.fulfilled === 'boolean') &&
        !(promise.released && promise.fulfilled),
      'The saved shipment promise is invalid; restore its table state before continuing.',
    );
    if (promise.turn === g.turn && !promise.released && !promise.fulfilled)
      requireRule(
        !g.advanced &&
          !g.expansions.length &&
          g.status === 'playing' &&
          g.phase === 5 &&
          g.active === promise.player &&
          !getPlayer(g, promise.player).shipped,
        'The saved shipment promise does not belong to this unused Basic shipment opportunity.',
      );
  }
}
/** Search owned preparation and canonical shipment quotes, never the AI's scored shortlist. */
function findShipmentCompletion(
  state: Game,
  owner: Player,
  promises = liveShipmentPromises(
    state.shipmentPromises ?? [],
    owner.id,
    state.turn,
  ),
): { actions: Action[] } | null {
  if (
    state.status !== 'playing' ||
    state.phase !== 5 ||
    state.active !== owner.id ||
    owner.shipped
  )
    return null;
  if (!promises.some((p) => p.answer))
    return { actions: [{ type: 'endMovement' }] };
  const initial = structuredClone(state);
  initial.truthtrance = null;
  // Test choices after the interrupt, while leaving the real continuation intact.
  // Every actual action still revalidates its timing, quote and physical custody.
  initial.response = null;
  initial.decision = null;
  initial.phaseOpening = null;
  initial.shipmentPromises = [];
  const queue: { game: Game; actions: Action[] }[] = [
    { game: initial, actions: [] },
  ];
  const visited = new Set<string>();
  for (let index = 0; index < queue.length; index++) {
    const { game: g, actions } = queue[index];
    const p = getPlayer(g, owner.id);
    const signature = JSON.stringify([
      p.spice,
      p.reserves,
      p.tanks,
      p.elites,
      g.homeworlds,
      p.hand.map((c) => c.id),
      g.aid,
      g.karamaShipping,
    ]);
    if (visited.has(signature)) continue;
    visited.add(signature);
    const destination = promises.find((p) => p.answer)!.territory;
    for (let amount = 1; amount <= p.reserves; amount++) {
      if (
        !promises.every(
          (p) =>
            matchesShipment(p, { territory: destination, amount }) === p.answer,
        )
      )
        continue;
      for (const sector of territory(destination).sectors) {
        const cost = reserveShipmentCost(
          {
            faction: p.faction,
            halfRate:
              p.faction === 'guild' ||
              byFaction(g, 'guild')?.id === p.ally ||
              g.karamaShipping?.player === p.id,
          },
          territory(destination).type,
          amount,
        );
        try {
          const allyPayment = contribution(g, p, cost);
          const elite = eliteChoice(
            amount,
            p.reserves,
            p.elites?.reserves ?? 0,
            undefined,
          );
          const sources = g.homeworlds?.custody
            ? nativeReserveSources(
                homeworldContext(g),
                g.homeworlds.custody,
                p.id,
                { normal: amount - elite, elite },
              )
            : null;
          const nativeSources = sources ? { homeworldSources: sources } : {};
          validatePhysicalShipment(g, {
            ...nativeSources,
            turn: g.turn,
            player: p.id,
            territory: destination,
            sector,
            amount,
            elite,
            cost,
            allyPayment,
            advisors: arrivalAsAdvisor(g, p, destination),
          });
          return {
            actions: [
              ...actions,
              {
                type: 'ship',
                territory: destination,
                sector,
                amount,
                elite,
                allyPayment,
                ...nativeSources,
              },
            ],
          };
        } catch (error) {
          if (!(error instanceof RuleError)) throw error;
        }
        if (p.faction === 'fremen' && byFaction(g, 'guild')?.id === p.ally) {
          const action: Action = {
            type: 'guildShip',
            from: 'reserves',
            territory: destination,
            sector,
            amount,
          };
          try {
            applyActionInner(g, p.id, action);
            return { actions: [...actions, action] };
          } catch (error) {
            if (!(error instanceof RuleError)) throw error;
          }
        }
      }
    }
    // These Basic preparations are deterministic and use only the respondent's
    // own cards and recoverable escrow. More reserves/lower cost cannot remove
    // a previously available choice of physical shipment count.
    const preparations: Action[] = [];
    if (g.aid[p.id]?.amount > 0)
      preparations.push({ type: 'pledgeAid', amount: 0 });
    const karama = p.hand.find((c) => canUseAsKarama(g.advanced, p.faction, c));
    if (karama && !g.karamaShipping)
      preparations.push({
        type: 'card',
        card: karama.id,
        mode: 'shipment',
        target: p.id,
      });
    const ghola = p.hand.find((c) => c.effect === 'ghola');
    if (ghola && p.tanks > 0)
      preparations.push({
        type: 'card',
        card: ghola.id,
        amount: Math.min(5, p.tanks),
      });
    for (const action of preparations) {
      try {
        const next = applyActionInner(g, p.id, action, 'shipmentPreparation');
        queue.push({ game: next, actions: [...actions, action] });
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
      }
    }
  }
  return null;
}
function shipmentTruthAnswers(
  g: Game,
  p: Player,
  claim: ShipmentClaim,
): TruthAnswer[] {
  const prior = liveShipmentPromises(g.shipmentPromises ?? [], p.id, g.turn);
  const answers: TruthAnswer[] = [];
  for (const answer of [true, false]) {
    const promises = [
      ...prior,
      { ...claim, turn: g.turn, player: p.id, asker: '', answer },
    ];
    if (findShipmentCompletion(g, p, promises))
      answers.push(answer ? 'yes' : 'no');
  }
  return answers.length ? answers : ['unknown'];
}
function bindShipmentTruth(
  g: Game,
  p: Player,
  claim: ShipmentClaim,
  answer: boolean,
  asker: string,
) {
  (g.shipmentPromises ??= []).push({
    turn: g.turn,
    player: p.id,
    asker,
    territory: claim.territory,
    minimum: claim.minimum,
    answer,
  });
}
function checkShipmentPromises(
  g: Game,
  p: Player,
  shipment: { territory: string; amount: number } | null,
) {
  requireRule(
    liveShipmentPromises(g.shipmentPromises ?? [], p.id, g.turn).every(
      (promise) => matchesShipment(promise, shipment) === promise.answer,
    ),
    'Honor your Truthtrance shipment answer before using this shipment opportunity.',
  );
}
function finishShipmentPromises(
  g: Game,
  p: Player,
  shipment: { territory: string; amount: number } | null,
) {
  checkShipmentPromises(g, p, shipment);
  for (const promise of liveShipmentPromises(
    g.shipmentPromises ?? [],
    p.id,
    g.turn,
  ))
    promise.fulfilled = true;
}
function reconcileShipmentPromises(
  g: Game,
  voluntary?: { actor: string; action: Action },
) {
  const kept: ShipmentPromise[] = [];
  for (const promise of g.shipmentPromises ?? []) {
    if (promise.turn !== g.turn || promise.released || promise.fulfilled)
      continue;
    const p = getPlayer(g, promise.player);
    if (
      findShipmentCompletion(g, p, [
        ...kept.filter((old) => old.player === p.id),
        promise,
      ])
    )
      kept.push(promise);
    else {
      requireRule(
        !voluntary ||
          voluntary.actor !== p.id ||
          !['card', 'bribe', 'pledgeAid'].includes(voluntary.action.type),
        'You cannot voluntarily make your Truthtrance shipment answer impossible.',
      );
      promise.released = true;
      log(
        g,
        `${p.name} can no longer fulfill a Truthtrance shipment answer; that answer is no longer binding.`,
      );
    }
  }
}
function battleTruthAnswers(
  g: Game,
  p: Player,
  claim: PlanClaim,
): TruthAnswer[] {
  const promises = g.battle?.truthPromises ?? [];
  const answers: TruthAnswer[] = [];
  for (const answer of [true, false])
    if (
      findReachableBattlePlan(g, p, {
        promises: [...promises, { player: p.id, asker: '', claim, answer }],
      })
    )
      answers.push(answer ? 'yes' : 'no');
  return answers.length ? answers : ['unknown'];
}
function bindBattleTruth(
  g: Game,
  p: Player,
  claim: PlanClaim,
  answer: boolean,
  asker: string,
) {
  if (g.battle && !g.battle.revealed && !g.battle.plans[p.id])
    (g.battle.truthPromises ??= []).push({
      player: p.id,
      asker,
      claim,
      answer,
    });
}
function reconcileBattlePromises(
  g: Game,
  voluntary?: { actor: string; action: Action },
) {
  const b = g.battle;
  if (
    !b ||
    b.revealed ||
    !b.truthPromises?.length ||
    g.response?.kind === 'voice'
  )
    return;
  const kept: BattlePromise[] = [];
  for (const promise of b.truthPromises) {
    if (promise.released || b.plans[promise.player]) {
      kept.push(promise);
      continue;
    }
    const p = getPlayer(g, promise.player);
    if (findReachableBattlePlan(g, p, { promises: [...kept, promise] }))
      kept.push(promise);
    else {
      requireRule(
        !voluntary ||
          p.id !== voluntary.actor ||
          !['card', 'bribe', 'pledgeAid', 'richeseGift'].includes(
            voluntary.action.type,
          ),
        'You cannot voluntarily make your Truthtrance battle promise impossible.',
      );
      promise.released = true;
      log(
        g,
        `${p.name} can no longer fulfill a Truthtrance battle answer; that answer is no longer binding.`,
      );
    }
  }
}
function feasiblePrescience(
  g: Game,
  p: Player,
  field: PlanField,
  value: unknown,
) {
  if (
    g.battle?.truthPromises?.some(
      (promise) => !promise.released && promise.player === p.id,
    )
  )
    return !!findReachableBattlePlan(g, p, { prescience: { field, value } });
  // Validate the revealed element without committing any other plan components.
  // A legal completion must exist, including compliance with the preceding Voice.
  const b = g.battle!;
  const leaderIds: (string | null)[] = [
    null,
    ...controlledLeaders(g, p)
      .filter((l) => !l.dead && (!l.usedAt || l.usedAt === b.territory))
      .map((l) => l.id),
    ...p.hand.filter((c) => c.kind === 'hero').map((c) => c.id),
  ];
  const weapons: (string | null)[] = [
    null,
    ...p.hand.filter(isWeaponCard).map((c) => c.id),
  ];
  const defenses: (string | null)[] = [
    null,
    ...p.hand.filter((c) => isDefenseCard(c)).map((c) => c.id),
  ];
  for (const leader of field === 'leader' ? [value] : leaderIds)
    for (const weapon of field === 'weapon' ? [value] : weapons)
      for (const defense of field === 'defense' ? [value] : defenses) {
        const maxSupport =
          g.advanced && field === 'dial'
            ? Math.min(battleSupportBudget(g, p), (combatArmy(g, p.id, b.territory).normal + combatArmy(g, p.id, b.territory).elite))
            : 0;
        for (let support = 0; support <= maxSupport; support++) {
          try {
            const plan = validatePlan(g, p, {
              leader,
              weapon,
              defense,
              support,
              dial: field === 'dial' ? value : 0,
            });
            if (plan[field] === value) return true;
          } catch (error) {
            if (!(error instanceof RuleError)) throw error;
          }
        }
      }
  return !!findReachableBattlePlan(g, p, { prescience: { field, value } });
}
function lateDefenseIntegrity(g: Game) {
  const b = g.battle;
  if (!b?.lateDefense) return;
  requireRule(
    g.phase === 6 &&
      b.revealed &&
      !!b.event &&
      !Array.isArray(b.lateDefense) &&
      typeof b.lateDefense === 'object',
    'The saved late-defense battle context is invalid.',
  );
  for (const [id, cardId] of Object.entries(b.lateDefense)) {
    requireRule(
      [b.attacker, b.defender].includes(id) &&
        typeof cardId === 'string' &&
        !!b.plans[id],
      'The saved late defense has an invalid combatant.',
    );
    const owner = getPlayer(g, id),
      card = owner.hand.find((c) => c.id === cardId);
    requireRule(
      card &&
        isPortableSnooper(card) &&
        owner.hand.filter((c) => c.id === cardId).length === 1,
      'The played Portable Snooper is missing from its reserved hand.',
    );
    requireRule(
      !g.players.some(
        (p) => p.id !== id && p.hand.some((c) => c.id === cardId),
      ) &&
        ![...g.deck, ...g.discard, ...(g.richeseCache ?? [])].some(
          (c) => c.id === cardId,
        ),
      'The played Portable Snooper has conflicting physical custody.',
    );
    const blocked = portableSnooperPlanBlock(
      b.plans[id],
      owner.hand,
      card,
      b.voice?.target === id ? b.voice : undefined,
    );
    requireRule(
      !blocked,
      blocked ?? 'The saved late defense does not fit the revealed plan.',
    );
  }
}
function validatePortableSnooper(
  g: Game,
  owner: Player,
  cardId: string,
  event: string,
) {
  const b = g.battle;
  requireRule(
    g.status === 'playing' &&
      g.phase === 6 &&
      b?.revealed &&
      [b.attacker, b.defender].includes(owner.id),
    'Late Portable Snooper is available after both battle plans are revealed.',
  );
  requireRule(
    !!b.event && b.event === event,
    'Use the current revealed battle event; legacy battles without one are not reopened.',
  );
  requireRule(
    b.traitorCalls[owner.id] === undefined && !b.homeworldDefensePassed?.includes(owner.id),
    'Your battle decisions are already submitted; the late-defense opportunity has closed.',
  );
  requireRule(
    !g.truthtrance &&
      !g.decision &&
      !g.response &&
      !g.phaseOpening &&
      !g.pendingNullentropy,
    'Finish the current interaction before adding a late defense.',
  );
  requireRule(
    !b.lateDefense?.[owner.id],
    'You have already added Portable Snooper to this battle.',
  );
  const card = owner.hand.find((c) => c.id === cardId);
  requireRule(
    card && isPortableSnooper(card),
    'Choose the canonical Portable Snooper in your hand.',
  );
  const reserved = transferCardBlock(g, owner, card);
  requireRule(!reserved, reserved ?? 'The card is already committed.');
  const blocked = portableSnooperPlanBlock(
    b.plans[owner.id],
    owner.hand,
    card,
    b.voice?.target === owner.id ? b.voice : undefined,
  );
  requireRule(
    !blocked,
    blocked ?? 'Portable Snooper cannot be added to this plan.',
  );
  const trial = structuredClone(g);
  (trial.battle!.lateDefense ??= {})[owner.id] = card.id;
  lateDefenseIntegrity(trial);
  return { b, card };
}
function portableSnooperView(g: Game, owner: Player) {
  const card = owner.hand.find(isPortableSnooper);
  if (!card) return null;
  let blocked: string | null = null;
  try {
    validatePortableSnooper(g, owner, card.id, g.battle?.event ?? '');
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    blocked = error.message;
  }
  return { card, event: g.battle?.event ?? null, blocked };
}
function stoneBurnerIntegrity(g: Game) {
  const b = g.battle;
  if (!b) return;
  if (b.stoneBurner !== undefined) {
    requireRule(
      g.phase === 6 &&
        b.revealed &&
        !!b.event &&
        !!b.stoneBurner &&
        typeof b.stoneBurner === 'object' &&
        !Array.isArray(b.stoneBurner),
      'The saved Stone Burner choice context is invalid.',
    );
    for (const [id, mode] of Object.entries(b.stoneBurner))
      requireRule(
        [b.attacker, b.defender].includes(id) &&
          ['kill', 'ignore'].includes(mode) &&
          isStoneBurner(cardOf(getPlayer(g, id), b.plans[id]?.weapon)),
        'The saved Stone Burner choice has an invalid owner, mode, or missing canonical weapon.',
      );
  }
  for (const id of [b.attacker, b.defender]) {
    if (b.plans[id]?.weapon !== 'richese-stone-burner') continue;
    const owner = getPlayer(g, id),
      card = cardOf(owner, b.plans[id].weapon);
    requireRule(
      isStoneBurner(card),
      'The committed canonical Stone Burner weapon is missing from its reserved hand.',
    );
    requireRule(
      g.players.reduce(
        (n, p) => n + p.hand.filter((c) => c.id === card!.id).length,
        0,
      ) === 1 &&
        ![
          ...g.deck,
          ...g.discard,
          ...(g.richeseCache ?? []),
          ...(g.auction?.cards ?? []),
          ...(g.ixSetupCards ?? []),
        ].some((c) => c.id === card!.id),
      'The committed Stone Burner physical card is duplicated.',
    );
  }
}
function nextRevealedDecision(g: Game) {
  const b = g.battle!;
  const stoneOwner = [b.attacker, b.defender].find(
    (id) =>
      isStoneBurner(cardOf(getPlayer(g, id), b.plans[id].weapon)) &&
      !b.stoneBurner?.[id],
  );
  if (stoneOwner) {
    requireRule(!!b.event, 'The Stone Burner battle event is missing.');
    g.decision = { kind: 'stoneBurner', player: stoneOwner, event: b.event };
    return;
  }
  const player = g.order.find(
    (id) =>
      [b.attacker, b.defender].includes(id) &&
      cardOf(getPlayer(g, id), b.plans[id].weapon)?.kind === 'poisonTooth' &&
      b.poisonTooth?.[id] === undefined,
  );
  if (player) g.decision = { kind: 'poisonTooth', player };
}
/** Homeworld invaders have no traitor vote to hold their late-defense window.
 * Offer only a real held legal defense; empty windows resolve automatically. */
function homeworldRevealPending(g: Game): boolean {
  const b = g.battle;
  if (g.status !== 'playing' || g.phase !== 6 || !b?.revealed || !b.territory.startsWith('homeworld:') || g.decision || g.response ||
    g.truthtrance || g.phaseOpening || g.pendingNullentropy || g.pendingTreacheryDiscard ||
    g.pendingRicheseGift || g.pendingExchange || g.pendingKarama || g.summonedWorm) return false;
  return traitorVoters(g, b).every((id) => b.traitorCalls[id] !== undefined);
}
function advanceHomeworldReveal(g: Game): boolean {
  if (!homeworldRevealPending(g)) return false;
  const b = g.battle!;
  const voters = traitorVoters(g, b);
  const owner = g.order.find((id) => [b.attacker, b.defender].includes(id) && !voters.includes(id) &&
    !b.homeworldDefensePassed?.includes(id) && (() => { const offer = portableSnooperView(g, getPlayer(g, id)); return offer && !offer.blocked; })());
  if (owner) {
    requireRule(b.event, 'The Homeworld defense opportunity needs its battle event.');
    g.decision = {kind: 'homeworldDefense', player: owner, event: b.event};
  } else resolveBattle(g);
  return true;
}
function traitorVoters(g: Game, b: Battle) {
  const home = homeworldBattleLocation(g, b.territory);
  if (home) return [b.attacker, b.defender].filter((id) => id === home.native);
  const voters = [b.attacker, b.defender];
  const harkonnen = byFaction(g, 'harkonnen');
  if (
    harkonnen?.ally &&
    voters.includes(harkonnen.ally) &&
    !voters.includes(harkonnen.id)
  )
    voters.push(harkonnen.id);
  return voters;
}
function traitorBeneficiary(g: Game, b: Battle, id: string) {
  return [b.attacker, b.defender].includes(id) ? id : getPlayer(g, id).ally;
}
/** Prepare current server-only inputs once; the pure module cannot inspect Game or mutate it. */
function currentBattleResolutionQuote(g: Game, canceledVoter?: string) {
  const b = g.battle!;
  const combatant = (id: string, opponentId: string): ResolutionCombatant => {
    const p = getPlayer(g, id),
      opponent = getPlayer(g, opponentId);
    const plan = b.plans[id],
      aid = aidFor(g, p);
    return {
      id: p.id,
      faction: p.faction,
      ally: p.ally,
      spice: p.spice,
      hand: p.hand,
      plan,
      leader: controlledLeaders(g, p).find((l) => l.id === plan.leader),
      forces: combatForces(g, p, b.territory, opponent),
      stronghold: strongholdEffect(g, p.id),
      lateDefense: b.lateDefense?.[p.id],
      poisonTooth: b.poisonTooth?.[p.id],
      stoneMode: b.stoneBurner?.[p.id],
      ...(aid ? { aid: { donor: p.ally!, amount: aid.amount } } : {}),
    };
  };
  try {
    const quote = quoteBattleResolution({
      advanced: g.advanced,
      typedCasualties: !!g.homeworlds,
      ...(homeworldBattleLocation(g, b.territory) ? { homeworld: currentHomeworldBattleRules(g, b.territory)! } : {}),
      turn: g.turn,
      territory: b.territory,
      attacker: combatant(b.attacker, b.defender),
      defender: combatant(b.defender, b.attacker),
      voters: traitorVoters(g, b).map((id) => ({
        id,
        beneficiary: traitorBeneficiary(g, b, id)!,
        called: id === canceledVoter ? false : b.traitorCalls[id],
        traitors: b.traitorDeclarations?.[id] ? [b.traitorDeclarations[id].identity] : getPlayer(g, id).traitors,
      })),
      participants: g.players.map((p) => ({
        id: p.id,
        faction: p.faction,
        ally: p.ally,
        noFieldAtTerritory:
          p.noField?.deployed?.location.territory === b.territory,
      })),
      physicalCards: physicalTreacheryCards(g),
      pendingAuditorPresent: !!g.pendingAuditor,
      pendingRetentionPresent: !!g.moritaniRetention,
    });
    for (const id of quote.destroyedArmies)
      if (b.territory.startsWith('homeworld:')) quoteHomeworldLoss(g, id, b.territory, combatArmy(g, id, b.territory));
      else validateBattleForceLoss(getPlayer(g, id), b.territory, Infinity);
    if (quote.winner && quote.result === 'normal' && b.territory.startsWith('homeworld:'))
      for (const losses of quote.casualties!.options) quoteHomeworldLoss(g, quote.winner, b.territory, { normal: losses.normal, elite: losses.elite });
    else if (quote.winner && quote.result === 'normal')
      validateBattleForceLoss(
        getPlayer(g, quote.winner),
        b.territory,
        quote.basicWinnerLosses ??
          Math.max(...quote.casualties!.options.map((c) => c.normal + c.elite)),
      );
    if (quote.homeworldExplosion)
      for (const losses of quote.homeworldExplosion.options) quoteHomeworldLoss(g, quote.homeworldExplosion.player, b.territory, losses);
    return quote;
  } catch (error) {
    if (
      error instanceof BattleResolutionQuoteError ||
      error instanceof ForceLossPreflightError
    )
      throw new RuleError(error.message);
    throw error;
  }
}
function resolveBattle(g: Game) {
  const b = g.battle!;
  const quote = currentBattleResolutionQuote(g);
  const a = getPlayer(g, b.attacker),
    d = getPlayer(g, b.defender),
    ap = b.plans[a.id],
    dp = b.plans[d.id];
  const al = controlledLeaders(g, a).find((l) => l.id === ap.leader),
    dl = controlledLeaders(g, d).find((l) => l.id === dp.leader);
  const aw = cardOf(a, ap.weapon);
  const stoneResult = quote.stone;
  const ac = quote.attackerTraitor,
    dc = quote.defenderTraitor;
  for (const revelation of quote.revelations) {
    const holder = getPlayer(g, revelation.player),
      identity = revelation.identity;
    holder.revealedTraitors = [
      ...new Set([...(holder.revealedTraitors ?? []), identity]),
    ];
    const name =
      identity === CHEAP_HERO_TRAITOR
        ? 'Cheap Hero / Heroine'
        : (g.players.flatMap((p) => p.leaders).find((l) => l.id === identity)
            ?.name ?? identity);
    log(g, `${holder.name} revealed ${name} as a traitor.`);
  }
  const dead = (l: Leader | undefined) => {
    if (l) {
      l.dead = true;
      l.deaths++;
      delete l.usedAt;
    }
  };
  const winner = quote.winner ? getPlayer(g, quote.winner) : undefined;
  const casualtyCommitment = quote.casualties ?? undefined;
  const sardaukar = currentNexusSardaukar(g);
  if (sardaukar?.stage === 'active' && casualtyCommitment && winner?.id === sardaukar.receipt.owner) {
    sardaukar.casualties = {...structuredClone(casualtyCommitment),outcome:'pending'};
    sardaukar.signature = nexusSardaukarSignature(sardaukar);
  }
  for (const payment of quote.payments) {
    const player = getPlayer(g, payment.player);
    player.spice -= payment.ownPayment;
    if (payment.allyPayment) aidFor(g, player)!.amount -= payment.allyPayment;
    if (payment.bankSupport)
      log(
        g,
        `${player.name}'s Stronghold Card paid ${payment.bankSupport} spice from the bank toward force support.`,
        { faction: player.faction, name: 'Stronghold support' },
      );
  }
  if (quote.choamIncome) g.pendingChoamBattleIncome = { ...quote.choamIncome };
  const explosion = quote.explosion;
  if (ac && dc) {
    dead(al);
    dead(dl);
    killTerritory(g, a, b.territory, Infinity, true);
    killTerritory(g, d, b.territory, Infinity, true);
    observeOccupation(g);
    log(g, 'Both leaders were traitors. Both armies were destroyed.');
  } else if (ac || dc) {
    const loser = ac ? d : a;
    const l = ac ? dl : al;
    dead(l);
    winner!.spice += quote.bounty!.amount;
    killTerritory(g, loser, b.territory, Infinity, true);
    observeOccupation(g);
    log(
      g,
      `${faction(winner!.faction).name} revealed a traitor and won without losses.`,
    );
  } else if (explosion) {
    returnAmbassadorsIn(
      g,
      b.territory,
      'a Lasgun–shield explosion destroyed it',
    );
    for (const player of quote.destroyedArmies) killTerritory(g, getPlayer(g, player), b.territory, Infinity, true);
    observeOccupation(g);
    dead(al);
    dead(dl);
    for (const [p, plan] of [
      [a, ap],
      [d, dp],
    ] as [Player, Plan][])
      if (plan.kwisatz) {
        p.kwisatz ??= { dead: false };
        p.kwisatz.dead = true;
        p.kwisatz.revivalCycle ??= 1;
      }
    for (const k of Object.keys(g.spice))
      if (splitLocation(k).territory === b.territory) delete g.spice[k];
    log(
      g,
      quote.homeworldExplosion
        ? `Lasgun and shield exploded. Invading armies were destroyed; the native faction loses ${quote.homeworldExplosion.amount} physical forces, limited by its Homeworld’s printed battle strength.`
        : 'Lasgun and shield exploded. All forces and spice in the territory were destroyed.',
    );
  } else {
    const ak = quote.leaderDeaths.attacker,
      dk = quote.leaderDeaths.defender;
    if (ak) dead(al);
    if (dk) dead(dl);
    const av = quote.scores!.attacker,
      dv = quote.scores!.defender;
    const loser = winner === a ? d : a;
    if (quote.bounty) winner!.spice += quote.bounty.amount;
    killTerritory(g, loser, b.territory, Infinity, true);
    observeOccupation(g);
    if (quote.basicWinnerLosses !== null)
      killTerritory(g, winner!, b.territory, quote.basicWinnerLosses, true);
    observeOccupation(g);
    log(
      g,
      stoneResult
        ? `${faction(winner!.faction).name} won in ${combatLocationName(g, b.territory)} by Stone Burner’s undialed physical tokens (aggressor ${stoneResult.attacker.join(' or ')}, defender ${stoneResult.defender.join(' or ')}; ${strongholdEffect(g, battleTieWinner(g)) === 'habbanya_ridge_sietch' ? 'Habbanya Stronghold advantage wins ties' : 'aggressor wins ties'}). Leader strength and Kwisatz Haderach’s bonus do not affect this comparison; the winner loses its dialed forces normally.`
        : `${faction(winner!.faction).name} won in ${combatLocationName(g, b.territory)} (${av}–${dv}${av === dv ? (strongholdEffect(g, winner!.id) === 'habbanya_ridge_sietch' ? ', Habbanya Stronghold advantage wins ties' : ', aggressor wins ties') : ''}).`,
      stoneResult
        ? { faction: (isStoneBurner(aw) ? a : d).faction, name: 'Stone Burner' }
        : undefined,
    );
  }
  for (const income of quote.strongholdIncome) {
    const player = getPlayer(g, income.player);
    player.spice += income.amount;
    log(
      g,
      `${player.name} collected ${income.amount} spice from the bank for their ${strongholdEffect(g, player.id) === 'sietch_tabr' ? 'Sietch Tabr victory' : 'Worthless battle cards at Tuek’s Sietch'}.`,
      { faction: player.faction, name: 'Stronghold income' },
    );
  }
  const tleilaxu = byFaction(g, 'tleilaxu');
  if (winner && tleilaxu && winner.id !== tleilaxu.id &&
    (!b.territory.startsWith('homeworld:') || homeworldBattleLocation(g, b.territory)!.native === tleilaxu.id)) {
    const winningPlan = winner.id === a.id ? ap : dp;
    g.pendingFaceDance = {
      player: tleilaxu.id,
      winner: winner.id,
      leader: winningPlan.leader,
      identity:
        cardOf(winner, winningPlan.leader)?.kind === 'hero'
          ? CHEAP_HERO_TRAITOR
          : winningPlan.leader,
      territory: b.territory,
    };
  }
  if (quote.auditor)
    g.pendingAuditor = {
      ...quote.auditor,
      event: b.event ?? crypto.randomUUID(),
    };
  if (quote.retention) g.moritaniRetention = structuredClone(quote.retention);
  const playedCardRoles = g.homeworlds?.custody && byFaction(g, 'ecaz')
    ? battleDiscardRoles(g, b) : undefined;
  const winningDiscards = quote.discarded.filter((entry) => entry.player === winner?.id).map((entry) => entry.card);
  const discarded: { card: Card; discardedBy: string; publicFace: boolean }[] =
    [];
  for (const [p, plan, l] of [
    [a, ap, al],
    [d, dp, dl],
  ] as [Player, Plan, Leader | undefined][]) {
    if (l && !l.dead) l.usedAt = b.territory;
    if (l?.capturedBy === p.id) {
      delete l.capturedBy;
      delete l.concealed;
    }
    if (plan.kwisatz) {
      p.kwisatz ??= { dead: false };
      p.kwisatz.usedAt = b.territory;
    }
    for (const entry of quote.discarded.filter(
      (entry) => entry.player === p.id && entry.player !== winner?.id,
    ))
      discarded.push({
        card: discard(g, p, entry.card, playedCardRoles?.[p.id]?.[entry.card]),
        discardedBy: p.id,
        publicFace: true,
      });
  }
  const harkonnen = byFaction(g, 'harkonnen');
  if (harkonnen) returnCaptives(g, harkonnen);
  if (g.advanced && winner?.faction === 'harkonnen') {
    const loser = winner.id === a.id ? d : a;
    if (captureCandidates(g, loser.id, b.territory).length)
      g.pendingCapture = {
        player: winner.id,
        loser: loser.id,
        territory: b.territory,
      };
  }
  if (winner) {
    const loser = winner.id === a.id ? d : a;
    const choices = ownedTech(g.techTokens, loser.id);
    if (choices.length)
      g.pendingTech = { player: winner.id, loser: loser.id, choices };
  }
  if (g.dukeVidal && [ap.leader, dp.leader].includes(DUKE_VIDAL_ID))
    g.dukeVidal = consumeDuke(g.dukeVidal);
  g.lastBattle = [a.id, d.id];
  g.lastBattleContext = {
    event: b.event ?? g.pendingAuditor?.event ?? crypto.randomUUID(),
    turn: g.turn,
    territory: b.territory,
    combatants: [...g.lastBattle],
    winner: winner?.id ?? null,
    result: quote.result,
    ...(playedCardRoles ? { cardRoles: playedCardRoles } : {}),
    ...(sardaukar?.casualties ? {nexusSardaukarCasualties:sardaukar.receipt.event} : {}),
  };
  if (g.homeworlds?.custody && winner?.faction === 'atreides' &&
      (quote.result === 'normal' || quote.result === 'traitor')) {
    requireRule(!g.homeworldVictoryReinforcement || g.homeworldVictoryReinforcement.stage === 'complete',
      'Finish the previous Caladan reinforcement before resolving another battle.');
    g.homeworldVictoryReinforcement = makeHomeworldVictoryReturn({
      event: g.lastBattleContext.event, turn: g.turn, player: winner.id,
      territory: b.territory, result: quote.result,
    });
    g.lastBattleContext.caladanReinforcement = {
      event: g.lastBattleContext.event, completed: false, stage: 'waiting',
      signature: homeworldVictoryObligationSignature(g.lastBattleContext, false, 'waiting'),
    };
  }
  if (playedCardRoles)
    g.lastBattleContext.cardRolesSignature = battleCardRolesSignature(g.lastBattleContext);
  if (winner && winningDiscards.length)
    g.pendingWinnerDiscards = { event: g.lastBattleContext.event, turn: g.turn,
      territory: b.territory, player: winner.id, cards: winningDiscards,
      optional: [...quote.winnerCards], signature: '' };
  if (g.pendingWinnerDiscards)
    g.pendingWinnerDiscards.signature = winnerDiscardSignature(g.pendingWinnerDiscards);
  if (g.pendingWinnerDiscards) {
    g.lastBattleContext.winnerDiscards = { cards: [...winningDiscards], completed: false, signature: '' };
    g.lastBattleContext.winnerDiscards.signature = winnerDiscardObligationSignature(g.lastBattleContext);
  }
  if (b.territory.startsWith('homeworld:') && (casualtyCommitment || quote.homeworldExplosion)) {
    const owner = quote.homeworldExplosion?.player ?? winner!.id;
    g.homeworldBattleLoss = {
      event: g.lastBattleContext.event, territory: b.territory, player: owner,
      kind: quote.homeworldExplosion ? 'explosion' : 'winner',
      pool: combatArmy(g, owner, b.territory),
      options: (quote.homeworldExplosion?.options ?? casualtyCommitment!.options).map(({normal, elite}) => ({normal, elite})),
      ...(casualtyCommitment ? { commitment: { forces: {...casualtyCommitment.forces}, dial: casualtyCommitment.dial, support: casualtyCommitment.support } } : {}),
    };
  }
  g.battle = null;
  const cards = [...quote.winnerCards];
  const continuation: Extract<
    NonNullable<Game['pendingTreacheryDiscard']>['continuation'],
    { kind: 'battleResolved' }
  > = {
    kind: 'battleResolved',
    event: g.lastBattleContext.event,
    result: quote.result,
    combatants: [...g.lastBattle],
    territory: b.territory,
    winner: winner?.id ?? null,
    cards,
    ...(casualtyCommitment ? { casualties: casualtyCommitment } : {}),
  };
  if (discarded.length)
    stageTreacheryDiscard(g, 'battle:mandatory', discarded, continuation);
  else continueResolvedBattle(g, continuation);
}
function continueResolvedBattle(
  g: Game,
  continuation: Extract<
    NonNullable<Game['pendingTreacheryDiscard']>['continuation'],
    { kind: 'battleResolved' }
  >,
) {
  const { cards, territory: to } = continuation;
  const winner = continuation.winner ? getPlayer(g, continuation.winner) : null;
  const losses = continuation.casualties?.options;
  const native = g.homeworldBattleLoss;
  if (native?.kind === 'explosion') {
    homeworldBattleLossIntegrity(g);
  homeworldSubstitutionIntegrity(g);
  homeworldDefenseIntegrity(g);
  homeworldShipmentIntegrity(g);
    if (native.options.length === 1) settleHomeworldExplosion(g, native.options[0], true);
    else g.decision = { kind: 'homeworldExplosion', event: native.event, player: native.player, territory: native.territory, options: native.options.map((p) => ({...p})), pool: {...native.pool} };
    return;
  }
  if (winner && losses?.length === 1) {
    settleWinnerCasualties(g, winner, to, cards, losses[0], true);
  } else if (winner && losses)
    g.decision = {
      kind: 'battleLosses',
      player: winner.id,
      territory: to,
      options: losses,
      cards,
    };
  else if (winner) finishWinner(g, winner, to, cards);
  else finishBattle(g);
}
function settleWinnerCasualties(
  g: Game,
  p: Player,
  to: string,
  cards: string[],
  choice: Casualties,
  automatic = false,
) {
  if (to.startsWith('homeworld:')) homeworldBattleLossIntegrity(g);
  const sardaukar = g.nexusSardaukarHistory?.find(record => record.receipt.battle === g.lastBattleContext?.event && record.receipt.owner === p.id);
  if (sardaukar?.casualties) requireRule(sardaukar.casualties.outcome === 'pending' &&
    sardaukar.casualties.options.some(option => JSON.stringify(option) === JSON.stringify(choice)),
    'Choose an original Nexus Sardaukar casualty allocation.');
  const losses = takeBattleLosses(g, p, to, choice);
  if (sardaukar?.casualties) {
    sardaukar.casualties.outcome = 'complete';
    sardaukar.signature = nexusSardaukarSignature(sardaukar);
  }
  observeOccupation(g);
  if (to.startsWith('homeworld:')) g.homeworldBattleLoss = null;
  log(
    g,
    `${p.name} sent ${choice.normal} normal and ${choice.elite} elite forces from ${combatLocationName(g, to)} to the Tanks. ${automatic ? 'This was the only legal casualty allocation for the revealed battle plan, so it was applied automatically.' : 'This applies the selected casualty allocation for the revealed battle plan.'}`,
    automatic ? { faction: p.faction, name: 'Battle casualties' } : undefined,
  );
  const survivingSuboids = to.startsWith('homeworld:') ? combatArmy(g, p.id, to).normal : Object.entries(p.forces)
    .filter(([key]) => splitLocation(key).territory === to)
    .reduce(
      (sum, [key, count]) => sum + count - (p.elites?.forces[key] ?? 0),
      0,
    );
  if (p.faction === 'ixians' && choice.elite > 0 && survivingSuboids > 0) {
    g.pendingIxSubstitution = { player: p.id, territory: to, losses, cards,
      ...(to.startsWith('homeworld:') ? { homeworld: {
        pool: combatArmy(g, p.id, to), cyborgsLost: choice.elite,
        eliteTanks: p.elites!.tanks, normalTanks: p.tanks - p.elites!.tanks, battleLosses: p.battleLosses,
      } } : {}),
    };
    g.decision = {
      kind: 'ixSubstitution',
      player: p.id,
      territory: to,
      losses,
    };
  } else finishWinner(g, p, to, cards);
}
function winnerDiscardSignature(pending: NonNullable<Game['pendingWinnerDiscards']>) {
  const { event, turn, territory, player, cards, optional } = pending;
  return JSON.stringify({ event, turn, territory, player, cards, optional });
}
function winnerDiscardObligationSignature(context: NonNullable<Game['lastBattleContext']>) {
  return JSON.stringify({ event: context.event, turn: context.turn, territory: context.territory,
    player: context.winner, cards: context.winnerDiscards?.cards,
    completed: context.winnerDiscards?.completed });
}
function winnerDiscardsIntegrity(g: Game) {
  const pending = g.pendingWinnerDiscards;
  const context = g.lastBattleContext;
  const obligation = context?.winnerDiscards;
  if (obligation) {
    requireRule(obligation.signature === winnerDiscardObligationSignature(context!) &&
      Array.isArray(obligation.cards) && obligation.cards.length > 0 &&
      new Set(obligation.cards).size === obligation.cards.length &&
      typeof obligation.completed === 'boolean' &&
      (obligation.completed ? !pending : !!pending &&
        JSON.stringify(pending.cards) === JSON.stringify(obligation.cards)),
      'The saved mandatory winner discard obligation lost its original queue or completion.');
  }
  if (!pending) return;
  const owner = g.players.find((p) => p.id === pending.player);
  requireRule(g.status === 'playing' && g.phase === 6 && pending.turn === g.turn &&
    obligation && !obligation.completed &&
    pending.signature === winnerDiscardSignature(pending) &&
    context?.event === pending.event && context.turn === g.turn &&
    context.territory === pending.territory && context.winner === pending.player && owner &&
    Array.isArray(pending.cards) && pending.cards.length > 0 && Array.isArray(pending.optional) &&
    new Set([...pending.cards, ...pending.optional]).size === pending.cards.length + pending.optional.length &&
    [...pending.cards, ...pending.optional].every((id) => typeof id === 'string' && owner.hand.some((card) => card.id === id)),
    'The saved mandatory winner discards no longer match their battle or physical cards.');
}
function finishWinner(g: Game, winner: Player, t: string, cards: string[]) {
  if (g.pendingWinnerDiscards) {
    winnerDiscardsIntegrity(g);
    const pending = g.pendingWinnerDiscards;
    requireRule(pending.player === winner.id && pending.territory === t &&
      JSON.stringify(pending.optional) === JSON.stringify(cards),
      'The mandatory winner discard must resume its original cleanup.');
    const entries = pending.cards.map((id) => ({ card: discard(g, winner, id,
      cleanupDiscardRole(g, winner, id)), discardedBy: winner.id, publicFace: true }));
    g.pendingWinnerDiscards = null;
    if (g.lastBattleContext?.winnerDiscards) {
      g.lastBattleContext.winnerDiscards.completed = true;
      g.lastBattleContext.winnerDiscards.signature = winnerDiscardObligationSignature(g.lastBattleContext);
    }
    stageTreacheryDiscard(g, 'battle:winnerMandatory', entries, {
      kind: 'winnerMandatoryDiscard', event: pending.event, player: winner.id,
      territory: t, optional: [...cards], commitment: structuredClone(pending) });
    return;
  }
  if (cards.length)
    g.decision = {
      kind: 'battleCards',
      player: winner.id,
      territory: t,
      cards,
    };
  else finishBattle(g);
}
/** Pure current compulsory aftermath; no board or phase initialization is executed here. */
function currentBattleAftermathQuote(
  g: Game,
  cancel?: AftermathCancellation,
  spending?: { player: string; card: string },
) {
  try {
    const quote = quoteBattleAftermath(
      {
        status: g.status,
        phase: g.phase,
        turn: g.turn,
        advanced: g.advanced,
        battlePresent: !!g.battle,
        lastBattle: g.lastBattle,
        territoryIds: combatLocations(g).map((t) => t.id),
        context: g.lastBattleContext,
        players: g.players.map((p) => ({
          id: p.id,
          faction: p.faction,
          hand: p.hand,
          leaders: p.leaders,
        })),
        leaderIds: [
          ...new Set([
            ...g.players.flatMap((p) => p.leaders.map((l) => l.id)),
            ...(g.dukeVidal ? [g.dukeVidal.leader.id] : []),
          ]),
        ],
        physicalCards: physicalTreacheryCards(g),
        techTokens: g.techTokens,
        pending: {
          retention: g.moritaniRetention,
          income: g.pendingChoamBattleIncome,
          tech: g.pendingTech,
          capture: g.pendingCapture,
          auditor: g.pendingAuditor,
          faceDance: g.pendingFaceDance,
        },
        cancel,
      },
      spending,
    );
    if (quote.next.kind === 'board')
      boardResolution(() => quoteCombatBoardContinuation(g));
    return quote;
  } catch (error) {
    if (error instanceof BattleAftermathQuoteError)
      throw new RuleError(error.message);
    throw error;
  }
}
function validateAftermathCancellation(
  g: Game,
  response: ResponseWindow,
  spending?: { player: string; card: string },
) {
  if (
    response.kind === 'capture' ||
    response.kind === 'choamAudit' ||
    response.kind === 'choamBattleIncome'
  )
    return currentBattleAftermathQuote(
      g,
      {
        kind: response.kind,
        owner: response.owner,
        intent: response.intent,
      },
      spending,
    );
}
function homeworldVictoryWitness(frame: HomeworldVictoryReturn) {
  return { event: frame.event, turn: frame.turn, player: frame.player,
    territory: frame.territory, result: frame.result };
}
function homeworldVictoryReturnIntegrity(g: Game) {
  homeworldRule(() => validateHomeworldVictoryReturn(g));
  const frame = g.homeworldVictoryReinforcement;
  if (frame?.stage === 'arrival' || frame?.stage === 'complete')
    homeworldRule(() => validateHomeworldArrival(g, frame, 'victoryEvent'));
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const contexts = [g, g.pendingExchange, g.pendingNullentropy?.resume,
    g.pendingRicheseGift?.resume, g.pendingRichesePurchaseIncome?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null];
  const decisions = contexts.flatMap((context) => context?.decision?.kind === 'caladanReinforcement' ? [context.decision] : []);
  requireRule(decisions.every((decision) => frame?.stage === 'choice' && decision.player === frame.player && decision.event === frame.event),
    'The Caladan choice has lost its original victory.');
  if (frame?.stage === 'choice')
    requireRule(decisions.length > 0, 'The Caladan victory has lost its reinforcement choice.');
  if (frame?.stage === 'waiting')
    requireRule(!!g.pendingTreacheryDiscard || !!g.pendingNullentropy ||
      !!g.truthtrance || !!g.pendingKarama ||
      contexts.some((context) => !!context?.decision || !!context?.response),
      'The Caladan victory has lost its preceding battle cleanup choice.');
}
function completeHomeworldVictoryReturn(g: Game) {
  const frame = g.homeworldVictoryReinforcement!;
  frame.stage = 'complete';
  const context = g.lastBattleContext!;
  requireRule(context.caladanReinforcement?.event === frame.event,
    'The Caladan reinforcement has lost its battle completion.');
  context.caladanReinforcement.completed = true;
  context.caladanReinforcement.stage = 'complete';
  context.caladanReinforcement.signature = homeworldVictoryObligationSignature(context, true, 'complete');
}
function stampHomeworldVictoryStage(g: Game) {
  const frame = g.homeworldVictoryReinforcement!;
  const context = g.lastBattleContext!;
  requireRule(context.caladanReinforcement?.event === frame.event,
    'The Caladan reinforcement has lost its original stage obligation.');
  context.caladanReinforcement.stage = frame.stage;
  context.caladanReinforcement.signature = homeworldVictoryObligationSignature(context,
    context.caladanReinforcement.completed, frame.stage);
}
function openHomeworldVictoryReturn(g: Game, faceDancePending: boolean) {
  const frame = g.homeworldVictoryReinforcement;
  if (!frame || frame.stage === 'complete' || frame.event !== g.lastBattleContext?.event) return false;
  requireRule(frame.stage === 'waiting', 'Finish the Caladan reinforcement before resuming battle cleanup.');
  const quote = homeworldRule(() => quoteHomeworldVictoryReinforcement(g, homeworldVictoryWitness(frame)));
  if (quote.amount === 0) {
    frame.destination = 'decline'; frame.ambassadors = [];
    frame.arrivalSignature = homeworldArrivalSignature(frame);
    completeHomeworldVictoryReturn(g);
    if (quote.blocked)
      log(g, `${getPlayer(g, frame.player).name} received no Caladan victory reinforcement: ${quote.blocked}`);
    return false;
  }
  const blocked = faceDancePending
    ? 'Caladan reinforcement and Face Dancer replacement await an ordering ruling. You may leave the reserve force at home.'
    : quote.blocked;
  const offer = { population: quote.population, survivors: quote.survivors, blocked };
  frame.offer = { ...offer, signature: homeworldVictoryOfferSignature(frame, offer) };
  frame.stage = 'choice';
  stampHomeworldVictoryStage(g);
  g.decision = { kind: 'caladanReinforcement', player: frame.player, event: frame.event };
  return true;
}
function decideHomeworldVictoryReturn(g: Game, p: Player, action: Action) {
  const frame = g.homeworldVictoryReinforcement;
  requireRule(frame?.stage === 'choice' && frame.player === p.id && frame.event === action.event,
    'Choose the current Caladan victory reinforcement.');
  if (action.decline === true) {
    requireRule(action.amount === undefined && action.destination === undefined,
      'Leaving the reserve force at home does not select a quantity or destination.');
    frame.destination = 'decline'; frame.ambassadors = [];
    frame.arrivalSignature = homeworldArrivalSignature(frame);
    completeHomeworldVictoryReturn(g);
    log(g, `${p.name} left the optional Caladan victory reinforcement in reserves.`);
    finishBattle(g);
    return;
  }
  requireRule(!frame.offer?.blocked, frame.offer?.blocked ?? 'This reinforcement needs its ordering ruling.');
  requireRule((action.amount === undefined || action.amount === 1) && typeof action.destination === 'string',
    'Caladan adds exactly one reserve force to the battle location.');
  const quote = homeworldRule(() => quoteHomeworldVictoryReinforcementDestination(g,
    homeworldVictoryWitness(frame), action.destination as string));
  const seat = quote.transfer.players.find((seat) => seat.id === p.id)!;
  p.reserves = seat.reserves;
  g.homeworlds!.custody = quote.transfer.state;
  observeOccupation(g);
  frame.destination = quote.selected.id; frame.stage = 'arrival'; frame.ambassadors = [];
  frame.arrivalSignature = homeworldArrivalSignature(frame);
  stampHomeworldVictoryStage(g);
  if (quote.selected.territory) {
    place(p, quote.selected.territory, quote.selected.sector!, 1);
    openTerritoryEntry(g, p, quote.selected.territory, quote.selected.sector!, 1, 0, 'caladanReinforcement');
    if (g.pendingAmbassador) {
      g.pendingAmbassador.victoryEvent = frame.event;
      appendHomeworldArrivalAmbassador(frame, g.pendingAmbassador);
    }
  }
  log(g, `${p.name} added one force from Caladan reserves to ${quote.selected.name} after winning the battle. The force joins an existing surviving army; no spice or shipment allowance was spent.`,
    { faction: p.faction, name: 'Caladan victory reinforcement' });
}
function resumeHomeworldVictoryReturn(g: Game) {
  const frame = g.homeworldVictoryReinforcement;
  if (frame?.stage !== 'arrival' || g.pendingTreacheryDiscard || g.pendingNullentropy ||
    g.truthtrance || g.pendingExchange || g.pendingRicheseGift || g.pendingAmbassador ||
    g.pendingTerrorEntry || g.pendingKarama || g.decision || g.response) return;
  completeHomeworldVictoryReturn(g);
  finishBattle(g);
}
function projectedHomeworldVictoryReturn(g: Game, player: string) {
  const frame = g.homeworldVictoryReinforcement;
  if (frame?.stage !== 'choice') return null;
  const quote = homeworldRule(() => quoteHomeworldVictoryReinforcement(g, homeworldVictoryWitness(frame)));
  return { event: frame.event, player: frame.player, territory: frame.territory, amount: 1 as const,
    blocked: frame.offer?.blocked ?? quote.blocked,
    destinations: player === frame.player ? quote.destinations : [],
  };
}
function finishBattle(g: Game) {
  const quote = currentBattleAftermathQuote(g);
  for (const step of quote.steps) {
    if (step.kind === 'transferTech') {
      transferTech(g, step.id, step.to);
      g.pendingTech = null;
    } else if (step.kind === 'emptyAuditor') {
      log(
        g,
        'The Auditor has no eligible opposing hand cards to inspect. Cards used in this battle are excluded.',
        { faction: 'choam', name: 'Auditor: no eligible cards' },
      );
      g.pendingAuditor = null;
    }
  }
  const next = quote.next;
  if ((next.kind === 'faceDance' || next.kind === 'board') &&
      openHomeworldVictoryReturn(g, next.kind === 'faceDance')) return;
  if (next.kind === 'choamBattleIncome') {
    g.response = { ...next, passed: [] };
  } else if (next.kind === 'choamAudit') {
    g.decision = { kind: next.kind, player: next.player, event: next.event };
  } else if (next.kind !== 'board') {
    g.decision = { ...next };
  } else {
    const remaining = battles(g);
    if (remaining.length) g.active = remaining[0].attacker;
    else nextPhase(g);
  }
}
function currentAuditCount(g: Game) {
  const pending = g.pendingAuditor;
  return pending
    ? auditCount(
        getPlayer(g, pending.opponent).hand,
        pending.usedCards,
        pending.survived,
      )
    : 0;
}
function finishAuditor(
  g: Game,
  outcome: 'inspect' | 'pay' | 'decline' | 'cancel' | 'empty',
) {
  const pending = g.pendingAuditor;
  requireRule(pending, 'This Auditor opportunity has already ended.');
  const owner = getPlayer(g, pending.owner),
    opponent = getPlayer(g, pending.opponent);
  const count = currentAuditCount(g);
  if (outcome === 'pay') {
    requireRule(
      count > 0 && opponent.spice >= count,
      'Pay the full current audit cost or allow the inspection.',
    );
    opponent.spice -= count;
    owner.spice += count;
    log(
      g,
      `${opponent.name} paid ${count} spice directly to ${owner.name} to cancel the entire Auditor inspection.`,
    );
  } else if (outcome === 'inspect' && count) {
    const cards = sampleAuditCards(
      opponent.hand,
      pending.usedCards,
      pending.survived,
      random,
    );
    g.auditorInsight = {
      event: pending.event,
      viewer: owner.id,
      target: opponent.id,
      turn: g.turn,
      cards,
    };
    log(
      g,
      `${owner.name}'s ${pending.survived ? 'surviving' : 'killed'} Auditor privately inspected ${cards.length} random opposing hand card${cards.length === 1 ? '' : 's'}. Cards used in this battle were excluded; no cards changed hands.`,
      { faction: 'choam', name: 'Auditor inspection' },
    );
  } else {
    log(
      g,
      outcome === 'decline'
        ? `${owner.name} declined the Auditor inspection.`
        : outcome === 'cancel'
          ? 'Karama canceled the Auditor inspection; no cancellation payment was charged.'
          : 'The Auditor has no eligible opposing hand cards to inspect.',
      {
        faction: 'choam',
        name: outcome === 'cancel' ? 'Auditor canceled' : 'Auditor',
      },
    );
  }
  g.pendingAuditor = null;
  g.decision = null;
  finishBattle(g);
}
function auditorIntegrity(g: Game) {
  const pending = g.pendingAuditor;
  if (!pending) {
    requireRule(
      !['choamAudit', 'choamAuditPayment'].includes(g.decision?.kind ?? '') &&
        g.response?.kind !== 'choamAudit',
      'The Auditor continuation is missing.',
    );
    return;
  }
  requireRule(
    g.advanced &&
      g.status === 'playing' &&
      g.phase === 6 &&
      !g.battle &&
      pending.turn === g.turn &&
      typeof pending.event === 'string' &&
      !!pending.event &&
      pending.owner !== pending.opponent &&
      g.lastBattle.length === 2 &&
      g.lastBattle.includes(pending.owner) &&
      g.lastBattle.includes(pending.opponent) &&
      combatLocations(g).some((t) => t.id === pending.territory) &&
      g.players.some(
        (p) =>
          p.id === pending.owner &&
          p.faction === 'choam' &&
          p.leaders.some(isAuditorLeader),
      ) &&
      g.players.some((p) => p.id === pending.opponent) &&
      typeof pending.survived === 'boolean' &&
      ['offer', 'response', 'payment'].includes(pending.stage) &&
      Array.isArray(pending.usedCards) &&
      pending.usedCards.every((id) => typeof id === 'string') &&
      new Set(pending.usedCards).size === pending.usedCards.length,
    'The saved Auditor opportunity does not match this resolved battle.',
  );
  // Modern saves retain an independent receipt of the resolved battle. Legacy
  // opportunities without that receipt still use the controls checked below.
  if (g.lastBattleContext)
    requireRule(
      g.lastBattleContext.event === pending.event &&
        g.lastBattleContext.turn === pending.turn &&
        g.lastBattleContext.territory === pending.territory &&
        JSON.stringify(g.lastBattleContext.combatants) ===
          JSON.stringify(g.lastBattle),
      'The saved Auditor opportunity differs from its completed battle receipt.',
    );
  // These overlays preserve the exact parent decision/response instead of ending it.
  const contexts = [
    g,
    g.pendingNullentropy?.resume,
    g.pendingTreacheryDiscard?.continuation.kind === 'nullentropyDiscard' ||
    g.pendingTreacheryDiscard?.continuation.kind === 'truthtranceDiscard'
      ? g.pendingTreacheryDiscard.continuation.resume
      : undefined,
    g.pendingRicheseGift?.resume,
  ].filter((c) => !!c);
  const decisions = contexts.flatMap((c) => (c.decision ? [c.decision] : []));
  const responses = contexts.flatMap((c) => [
    ...(c.response ? [c.response] : []),
    ...(c.pendingKarama?.use.kind === 'cancel'
      ? [c.pendingKarama.use.response]
      : []),
  ]);
  for (const decision of decisions.filter(
    (d) => d.kind === 'choamAudit' || d.kind === 'choamAuditPayment',
  )) {
    const offer = decision.kind === 'choamAudit';
    requireRule(
      decision.event === pending.event &&
        decision.player === (offer ? pending.owner : pending.opponent) &&
        pending.stage === (offer ? 'offer' : 'payment'),
      'This Auditor decision is stale.',
    );
  }
  for (const response of responses.filter((r) => r.kind === 'choamAudit'))
    requireRule(
      response.owner === pending.owner &&
        response.intent === pending.event &&
        pending.stage === 'response',
      'This Auditor cancellation window is stale.',
    );
  requireRule(
    pending.stage === 'offer' ||
      (pending.stage === 'response' &&
        responses.some((r) => r.kind === 'choamAudit')) ||
      (pending.stage === 'payment' &&
        decisions.some((d) => d.kind === 'choamAuditPayment')),
    'The saved Auditor response or payment continuation is missing.',
  );
}
/** Older saved cleanup decisions predate the resolved battle receipt. Their
 * authenticated parent supplies the territory/winner; no battle is replayed. */
function battleCleanupInput(g: Game) {
  return {
    phase: g.phase,
    turn: g.turn,
    battlePresent: !!g.battle,
    lastBattle: g.lastBattle,
    playerIds: g.players.map((p) => p.id),
    territoryIds: combatLocations(g).map((t) => t.id),
    context: g.lastBattleContext,
  };
}
function battlePreflight<T>(quote: () => T): T {
  try {
    return quote();
  } catch (error) {
    if (error instanceof KaramaBattlePreflightError)
      throw new RuleError(error.message);
    throw error;
  }
}
function validateMoritaniCancellation(g: Game, responseOwner: string) {
  const pending = g.moritaniRetention;
  return battlePreflight(() =>
    preflightMoritaniRetentionCancellation({
      ...battleCleanupInput(g),
      responseOwner,
      pending,
      hand: g.players.find((p) => p.id === pending?.player)?.hand ?? [],
      physicalCards: physicalTreacheryCards(g),
    }),
  );
}
function cleanupBattleContext(g: Game, to: string, winner: string | null) {
  const quote = battlePreflight(() =>
    validateBattleCleanupContext({
      ...battleCleanupInput(g),
      territory: to,
      winner,
    }),
  );
  if (quote.kind === 'legacy')
    g.lastBattleContext = {
      ...quote.seed,
      event: g.pendingAuditor?.event ?? crypto.randomUUID(),
    };
  return g.lastBattleContext!;
}
function finishMoritaniRetention(g: Game, keep: string | null) {
  const pending = g.moritaniRetention;
  if (keep === null && pending?.stage === 'response')
    validateMoritaniCancellation(g, pending.owner);
  requireRule(
    pending && pending.turn === g.turn && g.phase === 6,
    'This alliance card cleanup is no longer current.',
  );
  const player = getPlayer(g, pending.player);
  requireRule(
    keep === null || pending.eligible.includes(keep),
    'Choose one eligible card from your played battle cards.',
  );
  requireRule(
    pending.played.every((id) => player.hand.some((c) => c.id === id)),
    'Cards committed to alliance cleanup must remain available.',
  );
  const discarded = pending.played
    .filter((id) => id !== keep)
    .map((id) => ({
      card: discard(g, player, id, cleanupDiscardRole(g, player, id)),
      discardedBy: player.id,
      publicFace: true,
    }));
  log(
    g,
    keep
      ? `${player.name} retained ${cardOf(player, keep)!.name} through the Moritani alliance.`
      : `${player.name} retained no battle card through the Moritani alliance.`,
  );
  g.moritaniRetention = null;
  const context = discarded.length
    ? cleanupBattleContext(
        g,
        pending.territory,
        g.lastBattle.find((id) => id !== player.id) ?? null,
      )
    : null;
  if (discarded.length)
    stageTreacheryDiscard(g, 'battle:moritani', discarded, {
      kind: 'battleCleanup',
      event: context!.event,
      combatants: [...g.lastBattle],
      territory: pending.territory,
      player: player.id,
      source: 'moritani',
      kept: keep ? [keep] : [],
      played: [...pending.played],
      retention: pending,
    });
  else finishBattle(g);
}
function currentHomeworldRevivalGrant(
  g: Game, p: Player, source: HomeworldRevivalDeploymentSource,
  group: HomeworldRevivalDeploymentGroup,
) {
  if (!g.homeworlds?.custody || !['fremen', 'tleilaxu'].includes(p.faction)) return null;
  const deposit = homeworldRule(() => quoteNativeRevivalDeposit(
    homeworldContext(g), g.homeworlds!.custody!, p.id,
    { normal: group.amount - group.elite, elite: group.elite },
  ));
  const seat = deposit.players.find((seat) => seat.id === p.id)!;
  const after = {
    advanced: g.advanced,
    homeworlds: { custody: deposit.state },
    players: g.players.map((other) => other.id !== p.id ? other : {
      ...p, reserves: seat.reserves,
      ...(p.elites ? { elites: { ...p.elites, reserves: seat.eliteReserves } } : {}),
    }),
  };
  return homeworldRule(() => quoteHomeworldRevivalDeployment(g, after, p.id, source, group));
}
function requireHomeworldRevivalGrant(
  g: Game, p: Player, source: HomeworldRevivalDeploymentSource,
  group: HomeworldRevivalDeploymentGroup,
) {
  requireRule(!g.homeworldRevivalReturn || g.homeworldRevivalReturn.stage === 'complete',
    'Finish the previous revived group’s placement before another revival.');
  const grant = currentHomeworldRevivalGrant(g, p, source, group);
  requireRule(!grant?.blocked, grant?.blocked ?? 'This revival placement needs its timing ruling.');
  return grant;
}
function stageHomeworldRevivalReturn(
  g: Game, p: Player, source: HomeworldRevivalDeploymentSource,
  group: HomeworldRevivalDeploymentGroup,
  grant: ReturnType<typeof currentHomeworldRevivalGrant>, card?: string,
) {
  if (!grant) return;
  g.homeworldRevivalReturn = homeworldRule(() => makeHomeworldRevivalReturn({
    event: crypto.randomUUID(), turn: g.turn, phase: g.phase, player: p.id,
    source, group, quote: grant, ...(card ? { card } : {}),
  }));
  stampHomeworldRevivalProgress(g);
}
function stampHomeworldRevivalProgress(g: Game) {
  const frame = g.homeworldRevivalReturn!;
  if (frame.progressVersion === 1)
    g.homeworldRevivalProgress = makeHomeworldRevivalProgress(frame);
}
function homeworldRevivalReturnIntegrity(g: Game) {
  const frame = g.homeworldRevivalReturn;
  homeworldRule(() => validateHomeworldRevivalReturn(g, frame));
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const contexts = [g, g.pendingExchange, g.pendingNullentropy?.resume,
    g.pendingRicheseGift?.resume, g.pendingRichesePurchaseIncome?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null];
  const decisions = contexts.flatMap((context) => context?.decision?.kind === 'homeworldRevivalDeployment' ? [context.decision] : []);
  requireRule(decisions.every((decision) => frame?.stage === 'choice' &&
    decision.player === frame.player && decision.event === frame.event),
    'The revival placement decision has lost its original returned group.');
  if (frame?.stage === 'choice')
    requireRule(decisions.length > 0, 'The returned group has lost its owned placement choice.');
}
function completeHomeworldRevivalReturn(g: Game) {
  const frame = g.homeworldRevivalReturn!;
  requireRule(!frame.ambassadors?.some((entry) => !entry.completed),
    'Finish the revived group’s Ambassador opportunity before its original revival income.');
  frame.stage = 'complete';
  stampHomeworldRevivalProgress(g);
  g.response = structuredClone(frame.resumeResponse ?? null);
}
function resumeHomeworldRevivalReturn(g: Game) {
  const frame = g.homeworldRevivalReturn;
  if (!frame || frame.stage === 'complete' || frame.stage === 'choice' ||
      g.pendingTreacheryDiscard || g.pendingNullentropy || g.truthtrance ||
      g.pendingExchange || g.pendingRicheseGift || g.pendingAmbassador ||
      g.pendingTerrorEntry || g.pendingKarama || g.decision) return;
  if (frame.stage === 'arrival') {
    if (!g.response) completeHomeworldRevivalReturn(g);
    return;
  }
  // The original revival/card has committed. Hold its independent income until
  // the optional physical placement and any Ambassador children are complete.
  requireRule(!g.response || g.response.kind === 'revivalIncome',
    'Finish the original revival continuation before placement.');
  frame.resumeResponse = structuredClone(g.response);
  frame.resumeSignature = homeworldRevivalResumeSignature(frame.resumeResponse);
  g.response = null;
  frame.stage = 'choice';
  stampHomeworldRevivalProgress(g);
  const destinations = homeworldRule(() => homeworldRevivalDestinations(g, frame.player, frame.quote));
  if (!destinations.length || destinations.every((d) => d.blocked && !d.blocked.includes('await'))) {
    frame.destination = 'decline';
    frame.ambassadors = [];
    frame.arrivalSignature = homeworldRevivalArrivalSignature(frame);
    completeHomeworldRevivalReturn(g);
    log(g, `${getPlayer(g, frame.player).name} left the revived group in reserves because no placement destination is available.`);
    return;
  }
  g.decision = { kind: 'homeworldRevivalDeployment', player: frame.player, event: frame.event };
}
function decideHomeworldRevivalReturn(g: Game, p: Player, action: Action) {
  const frame = g.homeworldRevivalReturn;
  requireRule(frame?.stage === 'choice' && frame.player === p.id && action.event === frame.event,
    'Choose the current returned group’s placement.');
  if (action.decline === true) {
    requireRule(action.destination === undefined && action.amount === undefined,
      'Leaving the group in reserves does not select a destination or quantity.');
    frame.destination = 'decline';
    frame.ambassadors = [];
    frame.arrivalSignature = homeworldRevivalArrivalSignature(frame);
    completeHomeworldRevivalReturn(g);
    log(g, `${p.name} left the newly revived group in reserves.`);
    return;
  }
  const amount = frame.quote.normal + frame.quote.elite;
  requireRule((action.amount === undefined || action.amount === amount) && typeof action.destination === 'string',
    'Place the entire eligible revived group in one destination.');
  const quote = homeworldRule(() => quoteHomeworldRevivalDestination(g, p.id, frame.quote, action.destination as string));
  const seat = quote.transfer.players.find((seat) => seat.id === p.id)!;
  p.reserves = seat.reserves;
  if (p.elites) p.elites.reserves = seat.eliteReserves;
  g.homeworlds!.custody = quote.transfer.state;
  observeOccupation(g);
  frame.destination = quote.selected.id;
  frame.stage = 'arrival';
  stampHomeworldRevivalProgress(g);
  frame.ambassadors = [];
  frame.arrivalSignature = homeworldRevivalArrivalSignature(frame);
  if (quote.selected.territory) {
    place(p, quote.selected.territory, quote.selected.sector!, amount, frame.quote.elite);
    openTerritoryEntry(g, p, quote.selected.territory, quote.selected.sector!, amount, frame.quote.elite, 'homeworldRevival');
    if (g.pendingAmbassador) {
      g.pendingAmbassador.revivalEvent = frame.event;
      appendHomeworldRevivalAmbassador(frame, g.pendingAmbassador);
    }
  }
  log(g, `${p.name} placed ${amount} newly revived ${frame.quote.kind === 'fedaykin' ? 'Fedaykin' : 'free forces'} in ${quote.selected.name}. No additional revival payment or shipment allowance was used.`,
    { faction: p.faction, name: frame.quote.kind === 'fedaykin' ? 'Southern Hemisphere revival' : 'Tleilax free revival' });
}
function projectedHomeworldRevivalReturn(g: Game, player: string) {
  const frame = g.homeworldRevivalReturn;
  if (frame?.stage !== 'choice') return null;
  return { event: frame.event, player: frame.player, kind: frame.quote.kind,
    normal: frame.quote.normal, elite: frame.quote.elite, blocked: frame.quote.blocked,
    destinations: player === frame.player
      ? homeworldRule(() => homeworldRevivalDestinations(g, player, frame.quote)) : [],
  };
}
function homeworldRevivalChoiceBlocks(g: Game, p: Player) {
  const blocks: { source: 'normal' | 'ghola'; amount: number; elite: number; reason: string }[] = [];
  if (!g.homeworlds?.custody || !['fremen', 'tleilaxu'].includes(p.faction)) return blocks;
  for (const source of ['normal', 'ghola'] as const) {
    const maximum = source === 'normal' ? forceRevivalRemaining(g, p) : Math.min(5, p.tanks);
    for (let amount = 1; amount <= maximum; amount++)
      for (let elite = Math.max(0, amount - (p.tanks - (p.elites?.tanks ?? 0)));
        elite <= Math.min(amount, eliteRevivalRemaining(p, g.advanced)); elite++) {
        const free = source === 'normal' ? forceRevivalQuote(g, p, amount, elite).free : 0;
        const grant = currentHomeworldRevivalGrant(g, p, source, { amount, elite, free });
        if (grant?.blocked) blocks.push({ source, amount, elite, reason: grant.blocked });
      }
  }
  return blocks;
}
function collectRevivalIncome(
  g: Game,
  actor: Player,
  paid: number,
  free = false,
  ghola = false,
) {
  const tleilaxu = byFaction(g, 'tleilaxu');
  if (!tleilaxu) return;
  g.revivalFreeIncome ??= {};
  const reward =
    ghola ||
    (free &&
      g.revivalFreeIncome[actor.id] !== g.turn &&
      !(
        actor.id !== tleilaxu.id &&
        homeworldRule(() => tleilaxuHomeworldFreeIncomeBlocked(g))
      ));
  if (free && !ghola) g.revivalFreeIncome[actor.id] = g.turn;
  const amount = (actor.id === tleilaxu.id ? 0 : paid) + (reward ? 1 : 0);
  if (amount)
    g.response = {
      kind: 'revivalIncome',
      owner: tleilaxu.id,
      recipient: actor.id,
      amount,
      passed: [],
    };
}
function currentRevivalResumeQuote(g: Game, stage: 'stop' | 'finish') {
  try {
    return quoteRevivalResume(g, stage);
  } catch (error) {
    if (error instanceof RevivalResumeError) throw new RuleError(error.message);
    throw error;
  }
}
function finishRevival(
  g: Game,
  quote: RevivalResumeQuote = currentRevivalResumeQuote(g, 'finish'),
) {
  const revival = quote.pending;
  g.pendingRevival = revival;
  const p = getPlayer(g, revival.player);
  if (quote.outcome === 'response') {
    revival.checks.shift();
    g.response = quote.nextResponse!;
    return;
  }
  const payer = revival.payer ? getPlayer(g, revival.payer) : p;
  if (quote.outcome === 'fremenLimit') {
    g.pendingRevival = null;
    log(
      g,
      `${p.name}'s normal revival was not completed: the request exceeds their current force-revival allowance. No forces or spice changed.`,
    );
    return;
  }
  if (quote.outcome === 'unfunded') {
    g.pendingRevival = null;
    log(
      g,
      `${p.name}'s revival was not completed because its current price cannot be paid.`,
    );
    return;
  }
  const deploymentGrant = revival.kind === 'forces'
    ? requireHomeworldRevivalGrant(g, p, revival.emperorExtra ? 'emperorExtra' : 'normal', {
        amount: revival.amount!, elite: revival.elite ?? 0, free: revival.free,
      })
    : null;
  payer.spice -= revival.cost;
  if (revival.kind === 'forces') {
    const n = revival.amount!,
      elite = revival.elite ?? 0;
    const source = revival.emperorExtra ? 'emperorExtra' : 'normal';
    const group = { amount: n, elite, free: revival.free };
    addRevivedReserves(g, p, n, elite);
    p.tanks -= n;
    if (revival.emperorExtra)
      g.emperorExtra[p.id] = (g.emperorExtra[p.id] ?? 0) + n;
    else {
      // Preserve unknown legacy usage instead of guessing how earlier paid returns were priced.
      if (p.freeForcesRevived !== undefined || p.revived === 0)
        p.freeForcesRevived = (p.freeForcesRevived ?? 0) + revival.free;
      p.revived += n;
    }
    if (p.elites) {
      p.elites.tanks -= elite;
      p.elites.revived += elite;
    }
    if (quote.techIncome) {
      const income = quote.techIncome;
      const token = g.techTokens![income.id];
      token.triggeredTurn = income.triggeredTurn;
      token.spice = income.spice;
      const rule = TECH_TOKENS.find((t) => t.id === income.id)!;
      log(
        g,
        `${rule.name} accrued ${token.spice} spice for ${getPlayer(g, income.owner).name}, payable at phase end.`,
      );
    }
    log(g, `${p.name} revived ${n} forces.${g.homeworlds ? ` ${revival.free} were free; ${n - revival.free} were paid. ${payer.name} paid ${revival.cost} spice. Future revival requests use the resulting Homeworld population.` : ''}`);
    stageHomeworldRevivalReturn(g, p, source, group, deploymentGrant);
  } else {
    if (revival.kind === 'kwisatz') {
      p.kwisatz!.dead = false;
      p.kwisatz!.revivalCycle =
        Math.max(p.revivalCycle, p.kwisatz!.revivalCycle ?? 1) + 1;
      log(g, `${p.name} revived Kwisatz Haderach.`);
    } else {
      const leader = g.players
        .flatMap((owner) => owner.leaders)
        .find((l) => l.id === revival.leader)!;
      if (revival.kind === 'foreignGhola') leader.gholaBy = p.id;
      else delete leader.gholaBy;
      leader.dead = false;
      delete leader.concealed;
      log(
        g,
        `${p.name} revived ${leader.name}${revival.kind === 'foreignGhola' ? ' as a ghola' : ''}.`,
      );
    }
    p.leaderRevived = true;
    if (g.revivalRequests) delete g.revivalRequests[p.id];
  }
  g.pendingRevival = null;
  if (quote.freeIncome) {
    g.revivalFreeIncome ??= {};
    g.revivalFreeIncome[quote.freeIncome.player] = quote.freeIncome.turn;
  }
  if (quote.nextResponse) g.response = quote.nextResponse;
}
function beginRevival(g: Game, revival: PendingRevival) {
  requireRule(
    !revivalPrevented(g, revival.player),
    'Tleilaxu prevented this faction’s normal revivals for this turn.',
  );
  if (revival.kind === 'forces')
    requireHomeworldRevivalGrant(g, getPlayer(g, revival.player), revival.emperorExtra ? 'emperorExtra' : 'normal',
      { amount: revival.amount!, elite: revival.elite ?? 0, free: revival.free });
  g.pendingRevival = revival;
  const choam = byFaction(g, 'choam');
  if (
    choam &&
    choam.id !== revival.player &&
    revival.free > 0 &&
    !revival.emperorExtra
  ) {
    g.decision = {
      kind: 'choamFreeRevival',
      player: choam.id,
      recipient: revival.player,
    };
    return;
  }
  offerRevivalStop(g);
}
function offerRevivalStop(
  g: Game,
  quote: RevivalResumeQuote = currentRevivalResumeQuote(g, 'stop'),
) {
  if (quote.outcome === 'decision') {
    g.pendingRevival = quote.pending;
    g.decision = quote.nextDecision!;
  } else finishRevival(g, quote);
}
function currentChoamWorthlessCancellationQuote(
  g: Game,
  response: ResponseWindow,
) {
  try {
    const declaration = quoteChoamWorthlessCancellation(g, response);
    if (!declaration) return null;
    const storm =
      declaration.resume.kind === 'storm' ? currentChoamStormQuote(g) : null;
    const revival =
      declaration.resume.kind === 'revival'
        ? currentRevivalResumeQuote(g, 'stop')
        : null;
    if (declaration.resume.kind === 'movement') {
      const move = g.pendingChoamMove!;
      if (move.source === 'ambassador')
        currentFremenAmbassador(g, move.ambassadorEvent);
      let valid = true;
      try {
        validateMovementOrder(g, getPlayer(g, move.player), move);
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        valid = false;
      }
      if (valid) {
        if (move.source === 'ambassador')
          validateAmbassadorRelocationArrival(g, move);
        else validateMovementArrival(g, move, true);
      }
    }
    return { declaration, storm, revival };
  } catch (error) {
    if (error instanceof ChoamWorthlessCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function moritaniAllianceCancellationQuote(g: Game, response: ResponseWindow) {
  try {
    return quoteMoritaniAllianceCancellation(g, response);
  } catch (error) {
    if (error instanceof MoritaniAllianceCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function currentRicheseCancellationQuote(g: Game, response: ResponseWindow) {
  try {
    const quote = quoteRicheseCancellation(g, response);
    if (!quote) return null;
    // Only restore the controls saved by this producer; all other pending
    // records remain live. No normalization, response resolution or RNG.
    const shadow: Game = { ...g, ...quote.resume };
    if (quote.kind === 'richeseGift') shadow.pendingRicheseGift = null;
    else shadow.pendingRichesePurchaseIncome = null;
    const controls = {
      response: shadow.response,
      decision: shadow.decision,
      pendingKarama: shadow.pendingKarama,
      phaseOpening: shadow.phaseOpening,
    };
    suspendedControlsIntegrity(shadow, controls);
    if (shadow.response) {
      karamaCanceledSource(shadow, shadow.response);
      // These pure contracts validate the declared parent; their canceled
      // outcomes are not applied and no future response is answered here.
      terminalCancellationQuote(shadow, shadow.response);
      if (isCombatResponseKind(shadow.response.kind))
        currentCombatResponseQuote(shadow, {
          kind: 'response',
          response: {
            kind: shadow.response.kind,
            owner: shadow.response.owner,
          },
          canceled: false,
        });
    }
    return quote;
  } catch (error) {
    if (error instanceof RicheseCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function currentVictoryQuote(g: Game) {
  try {
    return quoteVictory(g);
  } catch (error) {
    if (error instanceof VictoryQuoteError) throw new RuleError(error.message);
    throw error;
  }
}
function currentPlacementCancellationQuote(g: Game, response: ResponseWindow) {
  try {
    const receipt = quotePlacementCancellation(g, response);
    if (!receipt) return null;
    let finalVictory: VictoryQuote | null = null;
    if (receipt.kind === 'ecazPlacement') {
      // Revival settlement preceded the placement opportunity. Only phase5
      // initialization remains; a real Ix opening defers its future effects.
      movementPhaseQuote(() =>
        quoteMovementPhaseStart(
          { ...g, phase: 5 },
          g.expansions.includes('ix'),
        ),
      );
    } else if (receipt.kind === 'moritaniPlacement') {
      // Mentat opening income is already settled. CHOAM retains its own later
      // market/Mentat choice; otherwise this receipt reaches victory now.
      if (!byFaction(g, 'choam')) finalVictory = currentVictoryQuote(g);
    } else if (!byFaction(g, 'choam')) {
      const resources = currentPhaseResources(g);
      if (!g.expansions.includes('ix')) {
        const board = boardResolution(() => quoteCombatBoard(g));
        if (!board.battles.length) {
          // No combat: the actual Battle initializer departs again to
          // collection. Project only settled public balances and empty aid.
          boardResolution(() =>
            quoteBattlePhaseAdvance({
              advanced: g.advanced,
              storm: g.storm,
              order: g.order,
              mobileStronghold: g.mobileStronghold,
              spice: g.spice,
              expansions: g.expansions,
              aid: {},
              players: g.players.map((p) => ({
                id: p.id,
                faction: p.faction,
                ally: p.ally,
                advisors: p.advisors,
                forces: p.forces,
                elites: p.elites,
                noField: p.noField,
                spice: resources.balances[p.id],
              })),
            }),
          );
        }
      }
    }
    return { receipt, finalVictory };
  } catch (error) {
    if (error instanceof PlacementCancellationError)
      throw new RuleError(error.message);
    throw error;
  }
}
function finishResponse(g: Game, canceled: boolean) {
  karamaConversionIntegrity(g);
  currentFactionPayment(g);
  const response = g.response!;
  if (response.kind === 'nexusPrescience') validateNexusInspectionResponse(g, response);
  if (response.kind === 'nexusAdvisorFlip') validateNexusAdvisorResponse(g, response);
  if (response.kind === 'nexusSardaukar') validateNexusSardaukarResponse(g, response);
  if (response.kind === 'moritaniPlacement') {
    // Both outcomes need the same physical inventory and declared source.
    // This detached denial quote is only validation here; allowance still
    // executes placeTerror and checks current placement feasibility below.
    try {
      quotePlacementCancellation(g, response);
    } catch (error) {
      if (error instanceof PlacementCancellationError) throw new RuleError(error.message);
      throw error;
    }
  }
  const ecazCollectionQuote =
    response.kind === 'ecazCollection'
      ? currentEcazCollectionQuote(g, response, canceled)
      : null;
  if (response.source === 'ambassador')
    validateAmbassadorPurchaseResponse(g, response);
  const placementCancellation = canceled
    ? currentPlacementCancellationQuote(g, response)
    : null;
  const choamCancellation = canceled
    ? currentChoamWorthlessCancellationQuote(g, response)
    : null;
  const auctionCancellation = canceled
    ? validateAuctionContinuationCancellation(g, response)
    : null;
  const technologyCancellation = canceled
    ? auctionTechnologyQuote(() => quoteIxTechnologyCancellation(g, response))
    : null;
  const richeseCancellation = canceled
    ? currentRicheseCancellationQuote(g, response)
    : null;
  if (canceled) validateDisasterCancellation(g, response);
  if (canceled) validateAftermathCancellation(g, response);
  const terminal = canceled ? terminalCancellationQuote(g, response) : null;
  const allianceCancellation = canceled
    ? moritaniAllianceCancellationQuote(g, response)
    : null;
  g.response = null;
  if (response.kind === 'nexusAdvisorFlip') {
    finishNexusAdvisors(g, canceled);
    return;
  }
  if (response.kind === 'nexusSardaukar') {
    finishNexusSardaukar(g,canceled);
    return;
  }
  if (ecazCollectionQuote) {
    if (canceled)
      log(
        g,
        'Karama prevented Ecaz’s co-occupied stronghold income. Its ally collects normally; shared desert spice is unaffected.',
      );
    commitCollection(g, ecazCollectionQuote, canceled);
    return;
  }
  if (response.source === 'ambassador') {
    finishAmbassadorPurchaseResponse(g, response, canceled);
    return;
  }
  if (choamCancellation) {
    const { declaration, storm, revival } = choamCancellation;
    finishNexusChoam(g,g.pendingChoamWorthless!,'canceled');
    g.pendingChoamWorthless = declaration.pendingChoamWorthless;
    g.choamWorthlessBlocked = declaration.blocked;
    log(g, 'CHOAM’s Worthless card effect was prevented for this phase. The declared Treachery card is retained. Any Nexus card spent on the declaration remains spent.');
    if (storm) commitChoamStormOffer(g, storm);
    else if (revival) offerRevivalStop(g, revival);
    else if (declaration.resume.kind === 'movement') resumeChoamMovement(g);
    else if (declaration.resume.kind === 'mentat')
      g.decision = declaration.resume.decision;
    return;
  }
  if (auctionCancellation) {
    if (response.kind === 'harkonnenBonus')
      log(g, 'Karama prevented the Harkonnen bonus treachery card.');
    commitAuctionContinuation(g, auctionCancellation);
    return;
  }
  if (response.kind === 'richeseGift') {
    const pending = g.pendingRicheseGift;
    requireRule(
      pending &&
        pending.intent.owner === response.owner &&
        pending.turn === g.turn &&
        pending.phase === g.phase,
      'This Richese gift response is no longer current.',
    );
    let transfer: ReturnType<typeof validateRicheseGift> | null = null;
    if (!canceled) {
      const context = richeseGiftContext(g);
      try {
        const candidate = validateRicheseGift(
          context,
          getPlayer(context, pending.intent.owner),
          pending.intent.cardId,
        );
        requireRule(
          candidate.intent.owner === pending.intent.owner &&
            candidate.intent.recipient === pending.intent.recipient &&
            candidate.intent.cardId === pending.intent.cardId,
          'The original gift recipient is no longer your current ally.',
        );
        transfer = candidate;
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        log(
          g,
          'The Richese gift became unavailable before transfer. No card moved; the interrupted decision resumes.',
        );
      }
    }
    if (canceled) {
      requireRule(
        richeseCancellation?.kind === 'richeseGift',
        'Missing canceled Richese gift.',
      );
      g.richeseGiftBlocked = richeseCancellation.blocked;
      log(
        g,
        'Karama prevented this Richese gift. The card remains in its owner’s hand; the interrupted decision resumes.',
      );
    } else if (transfer) {
      getPlayer(g, pending.intent.owner).hand = transfer.resulting.ownerHand;
      getPlayer(g, pending.intent.recipient).hand =
        transfer.resulting.recipientHand;
      log(
        g,
        `${getPlayer(g, pending.intent.owner).name} gave their ally one Richese Treachery Card. The exact card is private, and this gift creates no auction income, bonus draw or replacement.`,
        { faction: 'richese', name: 'Allied card gift' },
      );
    }
    const resume =
      richeseCancellation?.kind === 'richeseGift'
        ? richeseCancellation.resume
        : pending.resume;
    g.pendingRicheseGift = null;
    g.response = resume.response;
    g.decision = resume.decision;
    g.pendingKarama = resume.pendingKarama;
    g.phaseOpening = resume.phaseOpening;
  } else if (response.kind === 'richeseNoField') {
    const quote = canceled ? noFieldCancellationQuote(g, response) : null;
    const shipment = g.pendingShipment;
    requireRule(
      shipment &&
        ((shipment.noField && shipment.player === response.owner) ||
          shipment.alliedNoField?.owner === response.owner),
      'No current No-Field shipment is awaiting this response.',
    );
    g.pendingShipment = null;
    if (canceled) {
      requireRule(quote, 'Missing canceled No-Field declaration.');
      if (quote.kind === 'allied') g.richeseAllyBlocked = quote.blocked;
      else getPlayer(g, quote.player).noFieldBlockedTurn = quote.blockedTurn;
      log(
        g,
        'Karama prevented No-Field use for this shipment opportunity. No spice, reserves or token history changed; normal shipment remains available.',
      );
    } else offerShipment(g, shipment);
  } else if (response.kind === 'moritaniRetention') {
    const pending = g.moritaniRetention;
    requireRule(
      pending?.stage === 'response' &&
        pending.owner === response.owner &&
        pending.keep,
      'No Moritani alliance retention is awaiting this response.',
    );
    if (canceled)
      log(g, 'Karama prevented Moritani’s ally from retaining a battle card.');
    finishMoritaniRetention(g, canceled ? null : pending.keep);
  } else if (response.kind === 'moritaniDuke') {
    requireRule(
      g.phase === 5 && g.dukeAcquisitionTurn === g.turn && g.dukeVidal,
      'This Duke Vidal acquisition is no longer current.',
    );
    if (!canceled) {
      g.dukeVidal = acquireDuke(
        g.dukeVidal,
        response.owner,
        g.turn,
        'moritani',
      );
      log(
        g,
        `${getPlayer(g, response.owner).name} acquired Duke Vidal for one battle this turn.`,
      );
    } else
      log(g, 'Karama prevented Moritani from acquiring Duke Vidal this turn.');
    nextPhase(g);
  } else if (response.kind === 'moritaniAlliance') {
    const entry = g.pendingTerrorEntry;
    requireRule(
      entry &&
        entry.stage === 'allianceResponse' &&
        entry.turn === g.turn &&
        entry.phase === g.phase,
      'This Enemy of My Enemy opportunity is no longer current.',
    );
    if (canceled) {
      requireRule(allianceCancellation, 'Missing canceled Moritani alliance.');
      g.pendingTerrorEntry = allianceCancellation.entry;
      g.decision = allianceCancellation.decision;
    } else {
      entry.stage = 'allianceReply';
      g.decision = {
        kind: 'moritaniTerror',
        player: entry.entrant,
        entrant: entry.entrant,
        territory: entry.territory,
      };
    }
    log(
      g,
      canceled
        ? 'Karama prevented Enemy of My Enemy; Moritani may still reveal the token.'
        : `${getPlayer(g, entry.entrant).name} may accept or refuse Moritani’s alliance offer.`,
    );
  } else if (response.kind === 'ecazPlacement') {
    const pending = g.pendingEcazPlacement;
    requireRule(
      pending &&
        pending.turn === g.turn &&
        g.phase === 4 &&
        getPlayer(g, response.owner).faction === 'ecaz' &&
        g.ecazPlacementTurn !== g.turn,
      'No Ambassador placement is pending for this turn.',
    );
    const owner = getPlayer(g, response.owner);
    if (canceled) {
      requireRule(
        placementCancellation?.receipt.kind === 'ecazPlacement',
        'Missing Ambassador denial receipt.',
      );
      g.ecazAmbassadors = placementCancellation.receipt.ambassadors;
      log(
        g,
        `${owner.name}'s remaining Ambassador placements were canceled for this turn.`,
      );
      finishEcazPlacement(g);
    } else {
      const quote = ambassadorPlacementQuote(
        g,
        owner,
        pending.token,
        pending.territory,
      );
      requireRule(
        quote.cost === pending.cost,
        'The Ambassador placement price changed.',
      );
      owner.spice -= quote.cost;
      g.ecazAmbassadors = quote.state;
      g.pendingEcazPlacement = null;
      log(
        g,
        `${owner.name} placed the ${faction(quote.state.tokens.find((t) => t.id === pending.token)!.effect).name} Ambassador in ${territory(pending.territory).name} for ${quote.cost} spice. The next Ambassador placed this turn will cost ${quote.cost + 1} spice.`,
        { faction: owner.faction, name: 'Ambassador placement' },
      );
      g.decision = { kind: 'ecazPlacement', player: owner.id };
    }
  } else if (response.kind === 'moritaniPlacement') {
    const pending = g.pendingMoritaniPlacement;
    requireRule(
      g.phase === 8 && pending?.turn === g.turn && g.moritaniTerror,
      'The Terror placement opportunity is no longer current.',
    );
    if (canceled) {
      requireRule(
        placementCancellation?.receipt.kind === 'moritaniPlacement',
        'Missing Terror denial receipt.',
      );
      g.moritaniTerror = placementCancellation.receipt.terror;
      log(
        g,
        'Moritani’s Terror placement or relocation was prevented for this turn.',
      );
    } else {
      try {
        g.moritaniTerror = placeTerror(
          g.moritaniTerror,
          pending.token,
          pending.territory,
          g.turn,
        );
      } catch (error) {
        throw new RuleError(
          error instanceof Error ? error.message : 'Invalid Terror placement.',
        );
      }
      log(
        g,
        `Moritani placed a hidden Terror token in ${territory(pending.territory).name}.`,
      );
    }
    g.pendingMoritaniPlacement = null;
    if (placementCancellation?.finalVictory)
      victory(g, placementCancellation.finalVictory);
    else finishMoritaniPlacement(g);
  } else if (response.kind === 'choamWorthless') {
    const pending = g.pendingChoamWorthless!;
    g.pendingChoamWorthless = null;
    const choam = getPlayer(g, pending.owner);
    if (
      choam.hand.some((c) => c.id === pending.card) &&
      (pending.effect !== 'gamont' ||
        gamontAvailable(
          g,
          pending.target!,
          pending.location!,
          pending.elite!,
          pending.noFieldEvent,
        )) &&
      (pending.effect !== 'baliset' || at(choam, pending.location!) > 0) &&
      (pending.effect !== 'jubba' ||
        choamStormOptions(g).some((t) => t.territory === pending.location))
    ) {
      discard(g, choam, pending.card);
      finishNexusChoam(g,pending,'complete');
      if (pending.effect === 'kulon') {
        g.choamMovement = {
          turn: g.turn,
          bonus:
            (g.choamMovement?.turn === g.turn ? g.choamMovement.bonus : 0) + 1,
        };
        log(
          g,
          `${choam.name} used Kulon to move one extra territory this turn.`,
        );
      } else if (pending.effect === 'jubba') {
        (g.stormResolution!.choamProtected ??= []).push(pending.location!);
        log(
          g,
          `${choam.name} protected its own forces in ${territory(pending.location!).name} for this storm movement with Jubba Cloak.`,
        );
      } else if (pending.effect === 'baliset') {
        (g.choamBaliset ??= []).push({
          turn: g.turn,
          player: pending.target!,
          territory: pending.location!,
        });
        log(
          g,
          `${getPlayer(g, pending.target!).name} cannot move into CHOAM's ${territory(pending.location!).name} this phase; shipment remains possible.`,
        );
        if (pending.movement) {
          const ambassador = g.pendingChoamMove?.source === 'ambassador';
          if (ambassador)
            currentFremenAmbassador(g, g.pendingChoamMove!.ambassadorEvent);
          g.pendingChoamMove = null;
          log(
            g,
            'The declared move was prevented without moving forces or spending a movement.',
          );
          if (ambassador) offerAmbassadorRelocation(g);
        }
      } else if (pending.effect === 'gamont') {
        const target = getPlayer(g, pending.target!);
        if (pending.noFieldEvent) revealPlayerNoField(g, target, 'gamont');
        const returned = (target.forces[pending.location!] ?? 0) > 0;
        if (returned) {
          removeGroup(target, [[pending.location!, 1]], {
            [pending.location!]: pending.elite!,
          });
          target.reserves++;
          if (target.elites) target.elites.reserves += pending.elite!;
        }
        observeOccupation(g);
        settleAdvisors(g);
        log(
          g,
          returned
            ? `${choam.name} sent one of ${target.name}’s forces to reserves with Trip to Gamont.`
            : `${choam.name} used Trip to Gamont to reveal ${target.name}’s No-Field. No force was present to return; the card is still used.`,
        );
      } else {
        g.revivalRules ??= newRevivalRules();
        (g.revivalRules.freeBlocked ??= []).push(pending.target!);
        log(
          g,
          `${getPlayer(g, pending.target!).name} cannot take free force revival this phase.`,
        );
        if (pending.revival) {
          g.pendingRevival = null;
          log(
            g,
            'The free revival request was stopped without moving forces or paying spice. Choose a paid revival if desired.',
          );
        }
      }
    } else {
      finishNexusChoam(g,pending,'fizzled');
      log(
        g,
        'The declared card or force is no longer available; no Worthless effect occurs.',
      );
    }
    if (pending.storm && g.stormResolution) offerChoamStorm(g);
    if (pending.revival && g.pendingRevival) offerRevivalStop(g);
    if (pending.movement && g.pendingChoamMove) resumeChoamMovement(g);
    if (pending.mentat) g.decision = { kind: 'choamMentat', player: choam.id };
  } else if (response.kind === 'richeseAuction') {
    requireRule(
      !canceled,
      'The canceled Richese auction count is awaiting an official ruling or an explicit table interpretation.',
    );
    if (g.richeseBidding!.position === 'first') offerRicheseCache(g);
    else prepareRicheseNormal(g);
  } else if (response.kind === 'richeseBlackMarket') {
    if (canceled) {
      g.richeseAuction!.outcome = { kind: 'unbid' };
      settleRicheseLot(g);
    } else {
      const atreides = byFaction(g, 'atreides');
      if (atreides)
        g.response = {
          kind: 'atreidesAuction',
          owner: atreides.id,
          passed: [],
        };
      else settleRicheseLot(g);
    }
  } else if (response.kind === 'ixAuction') {
    const request = currentIxAuctionDrawQuote(g, response, canceled)!;
    const pending = g.ixAuction!;
    const cards: Card[] = [];
    for (let i = 0; i < request.drawCount; i++) {
      const card = draw(g);
      if (card) cards.push(card);
    }
    if (!canceled && cards.length > 1) {
      pending.cards = cards;
      g.decision = { kind: 'ixAuction', player: response.owner };
    } else {
      g.ixAuction = null;
      setAuction(g, cards);
    }
  } else if (response.kind === 'ixTechnology') {
    if (technologyCancellation) {
      g.pendingIxTechnology = technologyCancellation.pendingIxTechnology;
      g.auction!.peekKnown = technologyCancellation.peek.peekKnown;
      g.response = technologyCancellation.peek.response;
      log(g, 'Ixian auction substitution did not occur.');
      return;
    }
    const pending = g.pendingIxTechnology!;
    const ixians = getPlayer(g, response.owner);
    const replacement = ixians.hand.find((c) => c.id === pending.card);
    if (!canceled && replacement) {
      const a = g.auction!,
        taken = a.cards[a.index];
      ixians.hand = ixians.hand.filter((c) => c.id !== replacement.id);
      ixians.hand.push(taken);
      a.cards[a.index] = replacement;
      if (g.ixAuctionKnown?.turn === g.turn)
        g.ixAuctionKnown.cards = [
          ...g.ixAuctionKnown.cards.filter(
            (c) => c.id !== taken.id && c.id !== replacement.id,
          ),
          replacement,
        ];
      log(
        g,
        `${ixians.name} exchanged a hand card for the upcoming auction card.`,
      );
    } else log(g, 'Ixian auction substitution did not occur.');
    g.pendingIxTechnology = null;
    offerAuctionPeek(g);
  } else if (response.kind === 'ixAllyCard') {
    const pending = g.pendingIxAlly!;
    const buyer = getPlayer(g, pending.player);
    if (!canceled && buyer.hand.some((c) => c.id === pending.card)) {
      const sale = g.currentAuctionSale;
      requireRule(
        sale,
        'The paid auction must remain available for its replacement.',
      );
      const card = discard(g, buyer, pending.card);
      g.pendingIxAlly = null;
      stageTreacheryDiscard(
        g,
        'ixAllyCard',
        [
          {
            card,
            discardedBy: buyer.id,
            publicFace: sale.origin === 'cache',
          },
        ],
        {
          kind: 'ixAllyCard',
          ...pending,
          sale,
          auctionIndex: g.auction?.index ?? null,
          auctionEvent: g.richeseAuction?.event ?? null,
        },
      );
      return;
    }
    g.pendingIxAlly = null;
    continueAuctionSale(g, pending.free);
  } else if (response.kind === 'mobileStronghold') {
    if (canceled) movementCancellationQuote(g, response);
    const pending = g.pendingMobileMove!;
    g.pendingMobileMove = null;
    if (!canceled) relocateMobileStronghold(g, pending);
    else
      log(g, 'Mobile stronghold movement and spice collection were canceled.');
    beginStormTurn(g);
  } else if (response.kind === 'fremenMovement') {
    const pending = pendingFremenMovement(g, response);
    const quote = canceled ? movementCancellationQuote(g, response) : null;
    const player = getPlayer(g, pending.order.player);
    g.pendingFremenMove = null;
    if (canceled) {
      requireRule(
        quote?.kind === 'fremenMovement',
        'Missing canceled Fremen movement.',
      );
      player.fremenMovementBlocked = { turn: quote.turn, move: quote.move };
      log(
        g,
        `${player.name}'s two-territory movement advantage was canceled for this move. The forces remain in place and no movement was spent. Choose a one-territory move; available ornithopters still apply.`,
      );
    } else {
      log(
        g,
        `${player.name}'s two-territory movement advantage was allowed. The declared movement continues.`,
        { faction: 'fremen', name: 'Fremen movement' },
      );
      offerChoamMovement(g, pending.order);
    }
  } else if (response.kind === 'ixMovement') {
    const quote = canceled ? movementCancellationQuote(g, response) : null;
    const move = g.pendingIxMove!;
    g.pendingIxMove = null;
    if (canceled) {
      const player = getPlayer(g, move.player);
      requireRule(
        quote?.kind === 'ixMovement',
        'Missing canceled Ixian movement.',
      );
      player.ixMovementBlocked = { turn: quote.turn, move: quote.move };
      log(
        g,
        `${player.name}'s cyborg movement advantage was canceled. A one-territory move remains available.`,
      );
    } else offerChoamMovement(g, move);
  } else if (response.kind === 'ixSubstitution') {
    const quote = canceled
      ? ixSubstitutionCancellationQuote(g, response)!
      : null;
    const pending = g.pendingIxSubstitution!;
    const player = getPlayer(g, pending.player);
    if (!canceled && pending.homeworld) {
      homeworldSubstitutionIntegrity(g);
  homeworldDefenseIntegrity(g);
  homeworldShipmentIntegrity(g);
      const amount = Object.values(pending.sources!).reduce((a, b) => a + b, 0);
      const quote = quoteHomeworldSubstitution(homeworldLossContext(g), g.homeworlds!.custody!, {
        location: pending.territory, player: player.id, amount, cyborgsLost: pending.homeworld.cyborgsLost,
      });
      commitHomeworldResources(g, quote);
      log(g, `${player.name} exchanged ${amount} surviving Suboids for the same number of Cyborgs lost at ${combatLocationName(g, pending.territory)}.`);
    } else if (!canceled) {
      for (const [key, count] of Object.entries(pending.sources!))
        kill(g, player, key, count, true, 0);
      for (const [key, count] of Object.entries(pending.recover!)) {
        player.tanks -= count;
        player.elites!.tanks -= count;
        player.battleLosses -= count;
        const loc = splitLocation(key);
        place(player, loc.territory, loc.sector, count, count);
      }
      log(
        g,
        `${player.name} substituted surviving suboids for cyborgs lost in this battle.`,
      );
    }
    observeOccupation(g);
    g.pendingIxSubstitution = null;
    if (quote) {
      log(
        g,
        'Karama prevented Ixian substitution. Original cyborg casualties remain in the Tanks; no surviving suboids were exchanged.',
      );
      if (quote.decision) g.decision = quote.decision;
      else finishBattle(g);
    } else finishWinner(g, player, pending.territory, pending.cards);
  } else if (
    [
      'choamRevival',
      'revivalLimit',
      'revivalDiscount',
      'earlyRevival',
      'foreignGhola',
    ].includes(response.kind)
  ) {
    if (canceled) {
      const quote = revivalCancellationQuote(g, response)!;
      const player = getPlayer(g, g.pendingRevival!.player);
      g.revivalRules = quote.rules;
      g.pendingRevival = quote.pending;
      if (quote.block?.kind === 'foreignGhola') {
        player.gholaBlocked ??= {};
        player.gholaBlocked[quote.block.leader] = g.turn;
      }
      if (response.kind === 'choamRevival') {
        log(g, 'CHOAM revival advantage was canceled for this phase.');
        if (quote.outcome === 'abandoned')
          log(
            g,
            `${player.name} must choose a revival within the remaining allowance. No forces or spice changed.`,
          );
      } else log(g, `${player.name}'s revival benefit was canceled.`);
    } else if (response.kind !== 'choamRevival')
      g.revivalRules ??= newRevivalRules();
    if (g.pendingRevival) finishRevival(g);
  } else if (response.kind === 'revivalIncome') {
    if (!canceled) getPlayer(g, response.owner).spice += response.amount!;
    if (g.pendingChoamMarketGhola && g.pendingChoamMarketGhola.event === response.intent)
      g.pendingChoamMarketGhola.stage = 'complete';
  } else if (response.kind === 'faceDancerReplacement') {
    const owner = getPlayer(g, response.owner);
    const index = owner.faceDancers!.findIndex(
      (c) => c.leader === response.intent && !c.revealed,
    );
    if (!canceled && index >= 0) {
      g.traitorReserve = shuffle([
        ...(g.traitorReserve ?? []),
        owner.faceDancers![index].leader,
      ]);
      owner.faceDancers![index] = {
        leader: g.traitorReserve.shift()!,
        revealed: false,
      };
      log(g, `${owner.name} replaced one unrevealed Face Dancer.`);
    }
  } else if (response.kind === 'worthlessKarama') {
    const pending = g.pendingKarama!;
    g.pendingKarama = null;
    const owner = getPlayer(g, pending.owner);
    if (!canceled) completeKarama(g, owner, pending.use);
    else if (pending.use.kind === 'cancel') g.response = pending.use.response;
    else if (pending.use.kind === 'auctionPayment')
      recoverAuctionPayment(g, owner);
  } else if (response.kind === 'choamSale') {
    const market = g.choamMarket!;
    const owner = getPlayer(g, market.owner);
    const sale = market.sale!;
    if (canceled) {
      const quote = choamSaleCancellationQuote(g, response)!;
      g.choamMarket = quote.market;
      resumeChoamMarket(g);
      log(
        g,
        'The declared CHOAM card sale was canceled; the card stays in hand.',
      );
      return;
    }
    const saleCard = owner.hand.find((card) => card.id === sale.card);
    const saleBlock = saleCard
      ? homeworldRule(() => homeworldWorthlessSaleBlock(g, owner.id, saleCard))
      : null;
    if (quoteSale(owner.hand, sale.card, sale.witness) && !saleBlock) {
      discard(g, owner, sale.card);
      owner.spice += sale.price;
      log(g, `${owner.name} received ${sale.price} spice from the card sale.`);
    } else
      log(
        g,
        saleBlock
          ? 'Tupile is now high population, so the declared Worthless sale cannot finish. The card stays in hand and no spice is paid.'
          : 'The declared card sale is no longer possible; no spice was paid.',
      );
    delete market.sale;
    resumeChoamMarket(g);
  } else if (response.kind === 'choamInflation') {
    if (!canceled) {
      g.inflation = {
        side: response.intent as Inflation['side'],
        placedTurn: g.turn,
        updatedTurn: g.turn,
        flipped: false,
      };
      g.inflationUsed = true;
      log(
        g,
        `CHOAM placed Inflation: ${g.inflation.side} next turn’s charity.`,
      );
    } else log(g, 'Inflation placement was canceled for this Mentat Pause.');
  } else if (response.kind === 'choamCharity') {
    g.choamCharity =
      terminal?.kind === 'choamCharity'
        ? terminal.receipt
        : { turn: g.turn, canceled };
    if (!canceled) {
      const choam = getPlayer(g, response.owner);
      requireRule(
        homeworldLowBonus(g, choam.id) === 0,
        'Low-population CHOAM opening income awaits its Homeworld charity ruling.',
      );
      const amount = 2 * g.players.length * charityMultiplier(g);
      choam.spice += amount;
      log(g, `${choam.name} collected ${amount} spice before charity claims.`);
    } else
      log(
        g,
        'CHOAM income was canceled. Charity is paid by the Spice Bank this turn.',
      );
  } else if (response.kind === 'bgCharity') {
    if (!canceled)
      payCharity(
        g,
        getPlayer(g, response.owner),
        response.amount ?? 2,
        response.charityHomeworld ?? 0,
      );
  } else if (response.kind === 'advisorFlip') {
    if (canceled) movementCancellationQuote(g, response);
    const bg = getPlayer(g, response.owner),
      to = response.location!;
    if (!canceled) {
      bg.advisors ??= {};
      if (response.advisors) bg.advisors[to] = {};
      else delete bg.advisors[to];
      log(
        g,
        `${bg.name} changed all forces in ${territory(to).name} to ${response.advisors ? 'advisors' : 'fighters'}.`,
      );
    }
    finishAdvisorReaction(g, response);
  } else if (response.kind === 'capture') {
    const capture = g.pendingCapture!;
    g.pendingCapture = null;
    if (canceled) finishBattle(g);
    else {
      const candidates = captureCandidates(g, capture.loser, capture.territory);
      const l = shuffle(candidates)[0];
      if (!l) {
        finishBattle(g);
        return;
      }
      const owner = g.players.find((p) => p.leaders.includes(l))!;
      l.concealed = {
        captor: capture.player,
        controller: capture.loser,
        dead: l.dead,
        deaths: l.deaths,
        usedAt: l.usedAt,
      };
      l.capturedBy = capture.player;
      g.decision = {
        kind: 'capturedLeader',
        player: capture.player,
        owner: owner.id,
        leader: l.id,
        controller: capture.loser,
      };
      log(
        g,
        `${getPlayer(g, capture.player).name} captured a leader from ${getPlayer(g, capture.loser).name}.`,
      );
    }
  } else if (response.kind === 'choamAudit') {
    const pending = g.pendingAuditor;
    requireRule(
      pending &&
        pending.stage === 'response' &&
        response.intent === pending.event &&
        response.owner === pending.owner,
      'This Auditor cancellation window is stale.',
    );
    if (canceled) finishAuditor(g, 'cancel');
    else if (
      !currentAuditCount(g) ||
      getPlayer(g, pending.opponent).spice < currentAuditCount(g)
    )
      finishAuditor(g, 'inspect');
    else {
      pending.stage = 'payment';
      g.decision = {
        kind: 'choamAuditPayment',
        player: pending.opponent,
        event: pending.event,
      };
    }
  } else if (response.kind === 'choamBattleIncome') {
    const pending = g.pendingChoamBattleIncome!;
    g.pendingChoamBattleIncome = null;
    if (!canceled) {
      const choam = getPlayer(g, pending.owner);
      choam.spice += pending.amount;
      log(
        g,
        `${choam.name} received ${pending.amount} spice from battle force payments.`,
      );
    } else log(g, 'CHOAM battle force payments went to the bank.');
    finishBattle(g);
  } else if (response.kind === 'nexusPrescience') {
    settleNexusInspectionResponse(g, response, canceled);
  } else if (isCombatResponseKind(response.kind)) {
    commitCombatResponseQuote(
      g,
      currentCombatResponseQuote(g, {
        kind: 'response',
        response: { kind: response.kind, owner: response.owner },
        canceled,
      }),
    );
  } else if (response.kind === 'guildTiming') {
    if (canceled) {
      const quote = movementCancellationQuote(g, response);
      requireRule(
        quote?.kind === 'guildTiming',
        'Missing canceled Guild timing.',
      );
      g.guildTimingLocked = true;
      g.active = quote.active;
    } else {
      g.guildTimingGranted = true;
      chooseGuildTiming(g, response.take!);
    }
  } else if (response.kind === 'atreidesAuction') {
    if (g.richeseAuction) {
      g.richesePeekKnown = !canceled;
      settleRicheseLot(g);
    } else
      g.auction!.peekKnown =
        terminal?.kind === 'atreidesAuction' ? terminal.known : !canceled;
  } else if (response.kind === 'atreidesSpice') {
    const blocked = homeworldRule(() => homeworldMovementForesightBlock(g, response.owner));
    requireRule(!blocked, blocked ?? 'Caladan prevents this foresight.');
    g.spicePeekKnown =
      terminal?.kind === 'atreidesSpice' ? terminal.known : !canceled;
  } else if (response.kind === 'wormPlacement') {
    if (canceled) {
      g.wormPlacementCanceledTurn = g.turn;
      continueSpice(g);
    } else beginWorm(g, response.location!);
  } else if (response.kind === 'wormAllyProtection') {
    wormSurvival(
      g,
      response.location!,
      canceled ? undefined : response.recipient,
    );
  } else if (response.kind === 'wormSurvival') {
    devour(g, response.location!, response.recipient, !canceled);
    afterWorm(g);
  } else if (response.kind === 'stormProtection') {
    if (response.resume === 'storm') {
      g.stormResolution!.protected = !canceled;
      continueStorm(g);
    } else {
      const p = getPlayer(g, response.owner);
      if (canceled)
        kill(
          g,
          p,
          response.location!,
          response.amount!,
          false,
          response.elite ?? 0,
        );
      else
        stormCasualties(
          g,
          p,
          response.location!,
          response.amount!,
          response.elite ?? 0,
          'shipment',
        );
    }
  } else if (response.kind === 'stormPeek') {
    g.stormCardKnown =
      terminal?.kind === 'stormPeek' ? terminal.known : !canceled;
  } else if (
    response.kind === 'emperorGift' ||
    response.kind === 'emperorRevival'
  ) {
    if (!canceled) {
      const emperor = getPlayer(g, response.owner),
        recipient = getPlayer(g, response.recipient!);
      const amount = response.amount!;
      if (response.kind === 'emperorGift') {
        emperor.spice -= amount;
        recipient.spice += amount;
      } else {
        beginRevival(g, {
          player: recipient.id,
          payer: emperor.id,
          emperorExtra: true,
          kind: 'forces',
          amount,
          elite: response.elite ?? 0,
          cost: paidForceRevivalCost(recipient, amount, response.elite ?? 0),
          normalCost: paidForceRevivalCost(
            recipient,
            amount,
            response.elite ?? 0,
          ),
          free: 0,
          checks: [],
        });
      }
      log(
        g,
        `${emperor.name} ${response.kind === 'emperorGift' ? 'shared spice with' : `offered ${amount} extra force revivals to`} ${recipient.name}.`,
      );
    }
  } else if (response.kind === 'guildIncome') {
    const payment = !canceled ? creditFactionPayment(g, response.owner, 'shipment', response.amount!) : null;
    log(
      g,
      canceled
        ? `Karama sent the ${response.amount} spice of Guild shipment income to the bank. The shipment and its price remain unchanged.`
        : `${getPlayer(g, response.owner).name} collected ${payment!.income} spice paid by other factions for shipment.${payment!.bank ? ` Low-population Junction leaves ${payment!.bank} spice in the bank.` : ''} Spice contributed by the Guild itself goes to the bank.`,
      {
        faction: 'guild',
        name: canceled ? 'Shipment income prevented' : 'Shipment income',
      },
    );
  } else if (response.kind === 'harkonnenTraitor') {
    const b = g.battle!;
    if (canceled) b.traitorCalls[response.owner] = false;
    if (
      traitorVoters(g, b).every((voter) => b.traitorCalls[voter] !== undefined)
    )
      resolveBattle(g);
  } else if (response.kind === 'richesePurchaseIncome') {
    const pending = g.pendingRichesePurchaseIncome;
    requireRule(
      pending &&
        pending.owner === response.owner &&
        pending.turn === g.turn &&
        pending.phase === g.phase &&
        response.amount === 3,
      'This Richese purchase income is no longer current.',
    );
    const payment = !canceled ? creditFactionPayment(g, response.owner, 'treachery', 3) : null;
    log(
      g,
      canceled
        ? 'Karama prevented the Emperor from collecting the 3-spice Richese purchase payment. The purchase remains completed and the payment goes to the bank.'
        : `${getPlayer(g, response.owner).name} collected ${payment!.income} spice from another faction’s Treachery Card purchase payment.${payment!.bank ? ` Low-population Kaitain leaves ${payment!.bank} spice in the bank.` : ''}`,
      {
        faction: 'emperor',
        name: canceled ? 'Purchase income prevented' : 'Card purchase income',
      },
    );
    const resume =
      richeseCancellation?.kind === 'richesePurchaseIncome'
        ? richeseCancellation.resume
        : pending.resume;
    g.pendingRichesePurchaseIncome = null;
    g.response = resume.response;
    g.decision = resume.decision;
    g.pendingKarama = resume.pendingKarama;
  } else if (response.kind === 'emperorIncome') {
    if (!canceled) {
      const owner = getPlayer(g, response.owner);
      const amount = g.currentAuctionSale?.amount ?? g.auction!.bid;
      const payment = creditFactionPayment(g, owner.id, 'treachery', amount);
      log(
        g,
        `${owner.name} received ${payment.income} spice from another faction’s ${amount}-spice paid auction bid.${payment.bank ? ` Low-population Kaitain leaves ${payment.bank} spice in the bank.` : ''}`,
        { faction: owner.faction, name: 'Auction income' },
      );
    }
    auctionBonus(g);
  } else if (response.kind === 'harkonnenBonus') {
    if (!canceled) {
      const owner = getPlayer(g, response.owner);
      const room = owner.hand.length < handLimit(owner);
      const bonus = room ? draw(g) : undefined;
      if (bonus) {
        owner.hand.push(bonus);
        log(
          g,
          `${owner.name} drew one bonus treachery card because Harkonnen receives an extra card after winning an auction while below its eight-card limit. Its identity remains private.`,
          { faction: owner.faction, name: 'Bonus treachery card' },
        );
      } else
        log(
          g,
          room
            ? `${owner.name} received no Harkonnen bonus card because no treachery card was available to draw.`
            : `${owner.name} received no Harkonnen bonus because their hand reached its eight-card limit before the draw.`,
        );
    } else log(g, 'Karama prevented the Harkonnen bonus treachery card.');
    nextAuction(g);
  } else if (response.kind === 'advisor') {
    if (response.advisorResume === 'ambassador') {
      finishGuildAmbassadorAdvisor(g, response, canceled);
      return;
    }
    if (canceled) return;
    const owner = getPlayer(g, response.owner);
    const target = splitLocation(response.location ?? 'polar_sink:0');
    const amount = integer(response.amount === undefined ? 1 : response.amount, 1, spiritualAdvisorMaximum(g, owner.id, target.territory), 'Spiritual Advisor forces');
    const advisors = arrivalAsAdvisor(
      g,
      owner,
      target.territory,
      undefined,
      target.territory !== 'polar_sink',
    );
    allowedEntry(g, owner, target.territory, target.sector, false, advisors);
    withdrawNativeReserves(g, owner, amount, 0);
    place(owner, target.territory, target.sector, amount);
    techIncome(g, 'heighliners', owner);
    if (advisors) {
      owner.advisors ??= {};
      owner.advisors[target.territory] = { lockedTurn: g.turn };
    }
    log(
      g,
      `${owner.name} sent ${amount} free ${amount === 1 ? 'force' : 'forces'} to ${territory(target.territory).name}${amount === 2 ? ' using high-population Wallach IX' : ''}.`,
      {faction: owner.faction, name: 'Spiritual Advisors'},
    );
    openTerritoryEntry(
      g,
      owner,
      target.territory,
      target.sector,
      amount,
      0,
      'advisor',
    );
  } else throw new RuleError('Unknown faction response.');
}
function homeworldAllianceReason(g: Game, first: string, second: string) {
  return g.homeworlds?.custody
    ? homeworldRule(() => homeworldAllianceBlock(homeworldContext(g), g.homeworlds!.custody!, first, second)) : null;
}
function homeworldShipmentAutomatic(g: Game): boolean {
  const decision = g.decision;
  if (decision?.kind !== 'homeworldShipmentGuild' || g.response || g.truthtrance ||
      g.phaseOpening || g.pendingNullentropy || g.pendingTreacheryDiscard ||
      g.pendingKarama || g.pendingExchange || g.pendingRicheseGift || g.summonedWorm)
    return false;
  homeworldShipmentIntegrity(g);
  const guild = getPlayer(g, decision.player);
  return !guild.hand.some((card) => {
    if (card.effect !== 'karama') return false;
    try { prepareSpecialKaramaIntent(g, guild.id, {type: 'card', mode: 'special', card: card.id}); return true; }
    catch (error) { if (error instanceof RuleError) return false; throw error; }
  });
}
function homeworldShipmentEvent(g: Game, p: Player, route?: 'arrakis'): string {
  if (route === 'arrakis') return JSON.stringify([homeworldShipmentEvent(g, p), route,
    g.storm, p.forces, p.elites?.forces ?? {}, g.mobileStronghold?.location ?? null]);
  return JSON.stringify([g.turn, g.phase, g.active, p.id, p.shipped,
    homeworldContext(g), g.homeworlds?.custody,
    g.players.map((seat) => [seat.id, seat.ally])]);
}
function homeworldShipmentBlock(g: Game, p: Player, checkPromises = true): string | null {
  if (!g.homeworlds?.custody) return 'Homeworld shipment requires the Homeworld module.';
  if (g.status !== 'playing' || g.phase !== 5 || g.active !== p.id || p.shipped)
    return 'Use your unused shipment during your own Shipment and Movement turn.';
  if (g.truthtrance || g.response || g.decision || g.phaseOpening ||
      g.pendingNullentropy || g.pendingTreacheryDiscard || g.pendingShipment ||
      g.pendingHomeworldShipment || g.pendingExchange || g.pendingRicheseGift || g.battle)
    return 'Finish the current interaction before another Homeworld shipment.';
  if (g.karamaShipping?.player === p.id)
    return 'Homeworld shipment using a purchased Karama rate awaits its card-scope integration.';
  const richese = byFaction(g, 'richese');
  if (richese && !noFieldAllyOfferBlock(g, richese) &&
      !(g.richeseAllyOpportunity?.turn === g.turn && g.richeseAllyOpportunity.recipient === p.id))
    return 'Wait for Richese to offer or pass its allied shipment opportunity.';
  try { if (checkPromises) checkShipmentPromises(g, p, null); }
  catch (error) { if (error instanceof RuleError) return error.message; throw error; }
  return null;
}
function guildHomeworldShipmentBlock(g: Game, p: Player): string | null {
  if (p.faction !== 'guild') return 'Only Guild has this Arrakis-to-Homeworld shipment permission.';
  return homeworldShipmentBlock(g, p);
}
function junctionTransportWindow(g: Game) {
  const owner = homeworldRule(() => junctionSponsor(g));
  const recipient = g.players.find((seat) => seat.id === g.active);
  if (!owner || !recipient || owner === recipient.id || g.phase !== 5 ||
      g.status !== 'playing' || recipient.shipped) return null;
  const offer = currentJunctionOffer(g);
  const blocked = homeworldShipmentBlock(g, recipient, false);
  return {owner, recipient: recipient.id, offer, blocked,
    canOffer: !blocked, offerEvent: junctionOfferEvent(g),
    event: JSON.stringify([homeworldShipmentEvent(g, recipient, 'arrakis'), offer])};
}
function performJunctionTransport(g: Game, p: Player, action: Action) {
  const option = junctionTransportWindow(g);
  requireRule(option && option.recipient === p.id && !option.blocked && option.offer,
    option?.blocked ?? 'Wait for Guild to offer Junction transport during your unused shipment.');
  requireRule(action.event === option.event && action.offer === option.offer.event,
    'This Junction offer or physical source selection has changed.');
  requireRule(Object.keys(action).every((key) =>
    ['type', 'event', 'offer', 'destination', 'sources', 'allyPayment'].includes(key)),
    'Use the offered tariff and explicit physical forces without concealed tokens.');
  const destination = stringField(action.destination);
  const context = {...homeworldContext(g), storm: g.storm,
    players: homeworldContext(g).players.map((seat) => ({...seat, ally: getPlayer(g, seat.id).ally})),
    mobileStronghold: g.mobileStronghold?.location ?? null,
    board: {[p.id]: {forces: p.forces, eliteForces: p.elites?.forces ?? {}, advisors: p.advisors}}};
  const quote = homeworldRule(() => quoteJunctionTransport(context, g.homeworlds!.custody!,
    {player: p.id, sponsor: option.owner, rate: option.offer!.rate, destination,
      sources: action.sources as HomeworldShipmentIntent['sources']}));
  const arrival = quote.destinationKind === 'arrakis' ? splitLocation(destination) : null;
  const nativeDeparture = quote.originKind === 'homeworld' && quote.sources.every((source) =>
    source.key === `homeworld:${p.faction}` || (p.faction === 'emperor' && source.key === 'homeworld:emperor:salusa'));
  const promise = nativeDeparture && arrival ? {territory: arrival.territory, amount: quote.amount} : null;
  checkShipmentPromises(g, p, promise);
  const sourceLock = quote.originKind === 'arrakis' ? p.advisors?.[quote.origin]?.lockedTurn : undefined;
  const advisors = arrival ? arrivalAsAdvisor(g, p, arrival.territory,
    quote.originKind === 'arrakis' ? quote.origin : undefined) : false;
  if (arrival) {
    requireRule(arrival.territory !== MOBILE_STRONGHOLD || p.faction === 'ixians',
      'Only Ixians may ship directly into the mobile stronghold.');
    requireRule(advisors || sourceLock !== g.turn ||
      !g.players.some((other) => other.id !== p.id && at(other, arrival.territory)),
      'New advisors cannot become fighters this turn.');
    allowedEntry(g, p, arrival.territory, arrival.sector, false, advisors);
  }
  const allyPayment = contribution(g, p, quote.cost, action.allyPayment);
  // Junction permission and tariff are Homeworld effects and resist Karama.
  // All validation precedes this atomic settlement; there is no special-stop frame.
  payWithAlly(g, p, quote.cost, allyPayment);
  g.homeworlds!.custody = quote.state;
  p.forces = quote.boardForces;
  if (p.elites) p.elites.forces = quote.boardEliteForces;
  for (const seat of quote.players) {
    const owner = getPlayer(g, seat.id);
    owner.reserves = seat.reserves;
    if (owner.elites) owner.elites.reserves = seat.eliteReserves;
  }
  observeOccupation(g);
  if (arrival) {
    place(p, arrival.territory, arrival.sector, quote.amount, quote.elite);
    if (advisors) (p.advisors ??= {})[arrival.territory] = {
      lockedTurn: Math.max(sourceLock ?? 0, p.advisors?.[arrival.territory]?.lockedTurn ?? 0) || undefined};
    else if (p.advisors) delete p.advisors[arrival.territory];
  }
  p.shipped = true;
  g.junctionOffer = null;
  finishShipmentPromises(g, p, promise);
  // Native Fremen reinforcement is on Arrakis; all other world departures
  // are off-planet. Homeworld destinations independently trigger E3 technology.
  const offPlanet = quote.originKind === 'homeworld' && !(nativeDeparture && p.faction === 'fremen');
  if (!arrival || offPlanet) techIncome(g, 'heighliners', p);
  const ordinaryIncome = !!arrival && nativeDeparture && p.faction !== 'fremen';
  const income = (ordinaryIncome ? quote.cost - allyPayment : 0) +
    (p.ally === option.owner ? 0 : allyPayment);
  if (income > 0) g.response = guildPaymentResponse(g, option.owner,
    [ordinaryIncome ? quote.cost - allyPayment : 0, p.ally === option.owner ? 0 : allyPayment]);
  const sourceName = quote.originKind === 'arrakis' ? territory(quote.origin).name :
    quote.sources.map((s) => combatLocationName(g, s.key)).join(' and ');
  log(g, `${p.name} accepted ${getPlayer(g, option.owner).name}’s Junction ${option.offer.rate}-price offer and transported ${quote.amount} physical forces (${quote.elite} special) from ${sourceName} to ${arrival ? `${territory(arrival.territory).name}, sector ${arrival.sector}` : combatLocationName(g, destination)} for ${quote.cost} spice (${quote.cost - allyPayment} own, ${allyPayment} pledged). The shipment is used; movement remains available.`,
    {faction: 'guild', name: 'Junction transport'});
  if (arrival) {
    const bg = byFaction(g, 'beneGesserit');
    const followup = offPlanet && bg && bg.id !== p.id && spiritualAdvisorMaximum(g, bg.id) > 0
      ? {shipment: p.id, destination} : undefined;
    if (!intrusion(g, p, arrival.territory, {followup}) && followup)
      g.decision = {kind: 'advisor', player: bg!.id, ...followup};
    openTerritoryEntry(g, p, arrival.territory, arrival.sector, quote.amount, quote.elite, 'shipment');
  }
}
function homeworldShipmentQuote(g: Game, intent: HomeworldShipmentIntent & {route?: 'arrakis'}) {
  requireRule(g.homeworlds?.custody, 'Homeworld shipment requires saved physical custody.');
  const context = {
    ...homeworldContext(g),
    players: homeworldContext(g).players.map((seat) => ({...seat, ally: getPlayer(g, seat.id).ally})),
  };
  const order = {player: intent.player, destination: intent.destination, sources: intent.sources};
  if (intent.route === 'arrakis') {
    const quote = homeworldRule(() => quoteGuildHomeworldShipment({...context, storm: g.storm,
      mobileStronghold: g.mobileStronghold?.location ?? null,
      board: Object.fromEntries(g.players.map((p) => [p.id, {forces: p.forces, eliteForces: p.elites?.forces ?? {}}])),
    }, g.homeworlds!.custody!, order));
    return {...quote, sources: quote.boardSources, sourceNames: [territory(quote.origin).name]};
  }
  const quote = homeworldRule(() => quoteHomeworldShipment(context, g.homeworlds!.custody!, order));
  return {...quote, boardForces: undefined, boardEliteForces: undefined,
    sourceNames: quote.sources.map((s) => combatLocationName(g, s.homeworld))};
}
function validateHomeworldShipment(g: Game, shipment: PendingHomeworldShipment) {
  const p = getPlayer(g, shipment.player);
  requireRule(g.status === 'playing' && g.phase === 5 && g.active === p.id && !p.shipped &&
    shipment.turn === g.turn && (shipment.route === undefined || shipment.route === 'arrakis') &&
    shipment.event === homeworldShipmentEvent(g, p, shipment.route),
    'This Homeworld declaration no longer matches its unused shipment and physical custody.');
  requireRule(g.karamaShipping?.player !== p.id,
    'Homeworld shipment using a purchased Karama rate awaits its card-scope integration.');
  const quote = homeworldShipmentQuote(g, shipment);
  requireRule(shipment.amount === quote.amount && shipment.elite === quote.elite &&
    shipment.cost === quote.cost && JSON.stringify(shipment.pools) === JSON.stringify(quote.sources),
    'The saved Homeworld shipment price or typed source pools changed.');
  integer(shipment.allyPayment, 0, quote.cost, 'Shipment ally payment');
  contribution(g, p, quote.cost, shipment.allyPayment);
  checkShipmentPromises(g, p, null);
  return quote;
}
function homeworldShipmentIntegrity(g: Game) {
  homeworldMobilityIntegrity(g);
  homeworldRule(() => junctionOfferIntegrity(g));
  const decisions = homeworldSavedDecisions(g).filter((d) => d.kind === 'homeworldShipmentGuild');
  const shipment = g.pendingHomeworldShipment;
  if (!shipment && !decisions.length) return;
  requireRule(shipment && decisions.length > 0 && !g.pendingShipment,
    'The saved Homeworld shipment needs its original Guild decision.');
  validateHomeworldShipment(g, shipment);
  const guild = byFaction(g, 'guild');
  requireRule(g.advanced && guild && !guild.specialKaramaUsed,
    'This Homeworld shipment has no available Guild interception.');
  for (const d of decisions) requireRule(d.player === guild.id &&
    d.shipper === shipment.player && d.destination === shipment.destination &&
    d.amount === shipment.amount && d.event === shipment.event,
    'The saved Guild decision differs from its Homeworld declaration.');
}
function commitHomeworldShipment(g: Game, shipment: PendingHomeworldShipment) {
  const quote = validateHomeworldShipment(g, shipment);
  const p = getPlayer(g, shipment.player);
  payWithAlly(g, p, quote.cost, shipment.allyPayment);
  g.homeworlds!.custody = quote.state;
  if (shipment.route === 'arrakis') {
    p.forces = quote.boardForces!;
    if (p.elites) p.elites.forces = quote.boardEliteForces!;
  }
  for (const seat of quote.players) {
    const owner = getPlayer(g, seat.id);
    owner.reserves = seat.reserves;
    if (owner.elites) owner.elites.reserves = seat.eliteReserves;
  }
  observeOccupation(g);
  p.shipped = true;
  g.pendingHomeworldShipment = null;
  // The E3 FAQ explicitly includes Homeworld shipment, including Fremen.
  techIncome(g, 'heighliners', p);
  // Off-planet destinations do not create the Guild's ordinary onto-Dune income.
  // November FAQ contributor routing remains independent of that trigger.
  const guild = byFaction(g, 'guild');
  const income = guild && p.ally !== guild.id ? shipment.allyPayment : 0;
  if (guild && income > 0)
    g.response = guildPaymentResponse(g, guild.id, [income]);
  finishShipmentPromises(g, p, null);
  log(g, `${p.name} shipped ${quote.amount} physical forces (${quote.elite} special) from ${quote.sourceNames.join(' and ')} to ${combatLocationName(g, shipment.destination)} for ${quote.cost} spice (${quote.cost - shipment.allyPayment} own, ${shipment.allyPayment} pledged). This uses their shipment; movement remains available.`,
    {faction: p.faction, name: 'Homeworld shipment'});
}
function declareHomeworldShipment(g: Game, p: Player, intent: HomeworldShipmentIntent & {route?: 'arrakis'}, allyPayment?: unknown) {
  const quote = homeworldShipmentQuote(g, intent);
  const shipment: PendingHomeworldShipment = {...intent, sources: structuredClone(intent.sources),
    event: homeworldShipmentEvent(g, p, intent.route), turn: g.turn, amount: quote.amount, elite: quote.elite,
    cost: quote.cost, allyPayment: contribution(g, p, quote.cost, allyPayment), pools: quote.sources};
  const guild = byFaction(g, 'guild');
  if (g.advanced && guild && !guild.specialKaramaUsed) {
    g.pendingHomeworldShipment = shipment;
    g.decision = {kind: 'homeworldShipmentGuild', player: guild.id, shipper: p.id,
      destination: intent.destination, amount: quote.amount, event: shipment.event};
    log(g, `${p.name} declared ${quote.amount} physical forces for ${combatLocationName(g, intent.destination)}. Payment and departure await the Guild interception decision.`);
  } else commitHomeworldShipment(g, shipment);
}
function validatePhysicalShipment(g: Game, shipment: PendingShipment) {
  requireRule(
    !(shipment.noField || shipment.alliedNoField) ||
      shipment.homeworldSources === undefined,
    'A No-Field shipment uses its own physical source allocation.',
  );
  if (shipment.source === 'ambassador') {
    validateAmbassadorShipmentOrder(g, shipment);
    return;
  }
  // Concealed and allied No-Fields retain their separate custody/quote contracts.
  if (shipment.noField || shipment.alliedNoField) return;
  const p = getPlayer(g, shipment.player);
  requireRule(
    g.status === 'playing' &&
      g.phase === 5 &&
      g.active === p.id &&
      !p.shipped &&
      (shipment.turn === undefined || shipment.turn === g.turn),
    'This shipment no longer belongs to the current unused shipment opportunity.',
  );
  const n = integer(shipment.amount, 1, p.reserves, 'Shipment forces');
  integer(shipment.sector, 0, 18, 'Shipment sector');
  eliteChoice(n, p.reserves, p.elites?.reserves ?? 0, shipment.elite);
  if (g.homeworlds?.custody)
    homeworldRule(() =>
      quoteNativeReserveWithdrawal(
        homeworldContext(g),
        g.homeworlds!.custody!,
        p.id,
        { normal: n - shipment.elite, elite: shipment.elite },
        shipment.homeworldSources,
      ),
    );
  else
    requireRule(
      shipment.homeworldSources === undefined,
      'Homeworld source selection requires the Homeworld module.',
    );
  requireRule(
    typeof shipment.elite === 'number' &&
      shipment.advisors === arrivalAsAdvisor(g, p, shipment.territory),
    'The declared force allocation or arrival stance is no longer current.',
  );
  requireRule(
    shipment.territory !== MOBILE_STRONGHOLD || p.faction === 'ixians',
    'Only Ixians may ship directly into the mobile stronghold.',
  );
  allowedEntry(
    g,
    p,
    shipment.territory,
    shipment.sector,
    g.advanced && p.faction === 'fremen',
    shipment.advisors,
  );
  if (p.faction === 'fremen')
    requireRule(
      territory('the_great_flat').sectors.some((from) =>
        territory(shipment.territory).sectors.some(
          (to) =>
            distance(
              location('the_great_flat', from),
              location(shipment.territory, to),
            ) <= 2,
        ),
      ),
      'Fremen reinforcements must arrive within two territories of the Great Flat.',
    );
  const cost = reserveShipmentCost(
    {
      faction: p.faction,
      halfRate:
        p.faction === 'guild' ||
        byFaction(g, 'guild')?.id === p.ally ||
        g.karamaShipping?.player === p.id,
    },
    territory(shipment.territory).type,
    n,
  );
  requireRule(
    Number.isSafeInteger(shipment.cost) && shipment.cost === cost,
    'The declared shipment price is no longer current.',
  );
  integer(p.spice, 0, Number.MAX_SAFE_INTEGER, 'Current shipment spice');
  integer(shipment.allyPayment, 0, cost, 'Shipment ally payment');
  const credit = aidFor(g, p);
  if (credit)
    integer(credit.amount, 0, Number.MAX_SAFE_INTEGER, 'Current ally pledge');
  if (shipment.allyPayment > 0)
    requireRule(
      p.ally && getPlayer(g, p.ally).ally === p.id,
      'The declared shipment contributor is no longer your mutual ally.',
    );
  contribution(g, p, cost, shipment.allyPayment);
}
function validateGuildShipmentDecision(
  g: Game,
  decision: Extract<Decision, { kind: 'guildShipment' }>,
) {
  const shipment = g.pendingShipment;
  const guild = byFaction(g, 'guild');
  requireRule(
    shipment &&
      g.advanced &&
      guild?.id === decision.player &&
      !guild.specialKaramaUsed &&
      decision.shipper === shipment.player &&
      getPlayer(g, shipment.player).faction !== 'fremen' &&
      decision.territory === shipment.territory &&
      decision.sector === shipment.sector &&
      decision.amount === (shipment.alliedNoField ? 1 : shipment.amount),
    'The Guild decision does not match the pending shipment.',
  );
  validatePhysicalShipment(g, shipment);
  return shipment;
}
function offerShipment(g: Game, shipment: PendingShipment) {
  validatePhysicalShipment(g, shipment);
  checkShipmentIncomeRounding(g, getPlayer(g, shipment.player), shipment.cost, shipment.allyPayment);
  const p = getPlayer(g, shipment.player),
    id = p.id;
  const { territory: to, sector: s } = shipment;
  const n = shipment.alliedNoField ? 1 : shipment.amount;
  const guild = byFaction(g, 'guild');
  if (
    g.advanced &&
    g.phase === 5 &&
    guild &&
    !guild.specialKaramaUsed &&
    p.faction !== 'fremen'
  ) {
    // Offer independently of the Guild's hidden hand. No payment or arrival
    // effects occur until this decision has resolved.
    g.pendingShipment = shipment;
    g.decision = {
      kind: 'guildShipment',
      player: guild.id,
      shipper: id,
      territory: to,
      sector: s,
      amount: n,
    };
    log(
      g,
      `${p.name} declared a shipment of ${n} forces to ${territory(to).name}, sector ${s}.`,
    );
  } else commitShipment(g, shipment);
}
function commitShipment(g: Game, shipment: PendingShipment) {
  if (shipment.source === 'ambassador') {
    commitAmbassadorShipment(g, shipment);
    return;
  }
  validatePhysicalShipment(g, shipment);
  finishShipmentPromises(
    g,
    getPlayer(g, shipment.player),
    shipment.noField || shipment.alliedNoField ? null : shipment,
  );
  const {
    territory: to,
    sector: s,
    amount: n,
    elite,
    cost,
    allyPayment,
    advisors,
  } = shipment;
  const p = getPlayer(g, shipment.player);
  if (shipment.noField) {
    requireRule(
      p.faction === 'richese' &&
        p.noField &&
        p.noFieldEvent === shipment.noField.event,
      'This No-Field shipment is no longer current.',
    );
    p.noField = noFieldRule(() =>
      deployRicheseNoField(p.noField!, {
        tokenId: shipment.noField!.tokenId,
        controller: p.id,
        location: { territory: to, sector: s },
      }),
    );
    p.noFieldEvent = crypto.randomUUID();
  }
  if (shipment.alliedNoField) {
    const offer = shipment.alliedNoField;
    let quote: ReturnType<typeof alliedNoFieldQuote>;
    try {
      quote = alliedNoFieldQuote(g, offer);
      requireRule(
        quote.amount === n &&
          quote.cost === cost &&
          elite >= quote.eliteMin &&
          elite <= quote.eliteMax,
        'The offered reserve allocation changed before shipment.',
      );
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      g.pendingShipment = null;
      log(
        g,
        'The allied No-Field declaration became unavailable before commitment. No shipment, payment or token reveal occurred; the recipient may ship normally.',
      );
      return;
    }
    const owner = getPlayer(g, offer.owner);
    if (owner.noField!.deployed) revealPlayerNoField(g, owner, 'beforeAlly');
    const result = noFieldRule(() =>
      shipAlliedRicheseNoField(
        owner.noField!,
        {
          tokenId: offer.tokenId,
          controller: p.id,
          location: { territory: to, sector: s },
        },
        p.reserves,
      ),
    );
    owner.noField = result.state;
    owner.noFieldEvent = crypto.randomUUID();
    owner.spice -= quote.ownerPayment;
    p.spice -= quote.recipientPayment;
  } else payWithAlly(g, p, cost, allyPayment);
  let homeworldOrigins = '';
  if (!shipment.noField) {
    const receipts = withdrawNativeReserves(
      g,
      p,
      n,
      elite,
      shipment.homeworldSources,
    );
    homeworldOrigins = receipts
      .map((receipt) => {
        const card = HOMEWORLD_CARDS.find((c) =>
          receipt.homeworld === 'homeworld:emperor:salusa'
            ? c.id === 'salusa_secundus'
            : c.faction === p.faction && c.id !== 'salusa_secundus',
        )!;
        return `${receipt.before.normal - receipt.after.normal} normal and ${receipt.before.elite - receipt.after.elite} special forces from ${card.name}`;
      })
      .join('; ');
    if (n > 0) place(p, to, s, n, elite);
  }
  if (advisors && n > 0) (p.advisors ??= {})[to] ??= {};
  p.shipped = true;
  if (p.faction !== 'fremen') techIncome(g, 'heighliners', p);
  const guild = byFaction(g, 'guild');
  const guildPayment = guildShipmentIncome({
    guild: guild?.id,
    shipper: p.id,
    ally: p.ally,
    cost,
    allyPayment,
    bankOnly: g.karamaShipping?.player === p.id,
  });
  if (guild && guildPayment > 0)
    g.response = guildPaymentResponse(g, guild.id, shipmentIncomeContributions(g, p, cost, allyPayment));
  g.karamaShipping = null;
  log(
    g,
    shipment.alliedNoField
      ? `${getPlayer(g, shipment.alliedNoField.owner).name} shipped ${p.name} with No-Field ${quoteAlliedTokenValue(g, shipment.alliedNoField)}, immediately placing ${n} physical forces (${elite} elite) in ${territory(to).name}, sector ${s}. ${shipment.alliedNoField.payer === 'both' ? 'Each ally paid 1 spice' : `${getPlayer(g, shipment.alliedNoField.payer).name} paid ${cost} spice`}.`
      : shipment.noField
        ? `${p.name} shipped one concealed No-Field to ${territory(to).name}, sector ${s}, for ${cost} spice. It counts as one force; physical reserves remain unchanged until reveal.`
        : `${p.name} shipped ${n} forces to ${territory(to).name}, sector ${s}.${homeworldOrigins ? ` Homeworld sources: ${homeworldOrigins}. Total shipment cost: ${cost} spice.` : ''}`,
    shipment.noField || shipment.alliedNoField
      ? { faction: 'richese', name: 'No-Field shipment' }
      : undefined,
  );
  const bg = byFaction(g, 'beneGesserit');
  const followup =
    p.faction !== 'fremen' && bg && bg.id !== p.id && spiritualAdvisorMaximum(g, bg.id) > 0
      ? { shipment: p.id, destination: location(to, s) }
      : undefined;
  if (!intrusion(g, p, to, { followup }) && followup)
    g.decision = { kind: 'advisor', player: bg!.id, ...followup };
  if (g.advanced && p.faction === 'fremen' && s === g.storm)
    g.response = {
      kind: 'stormProtection',
      owner: p.id,
      passed: [],
      resume: 'shipment',
      location: location(to, s),
      amount: n,
      elite,
    };
  openTerritoryEntry(
    g,
    p,
    to,
    s,
    shipment.alliedNoField ? Math.max(1, n) : n,
    elite,
    'shipment',
  );
}
function quoteAlliedTokenValue(g: Game, offer: RicheseAllyOffer) {
  return getPlayer(g, offer.owner).noField!.tokens.find(
    (t) => t.id === offer.tokenId,
  )!.value;
}
function validateMobileMove(g: Game, p: Player, input: unknown, max: number) {
  const blocked = homeworldRule(() => homeworldMobileStrongholdMovementBlock(g, p.id));
  requireRule(!blocked, blocked ?? 'The mobile stronghold cannot move.');
  requireRule(
    p.faction === 'ixians' &&
      g.mobileStronghold?.location &&
      at(p, MOBILE_STRONGHOLD) > 0,
    'Ixian forces must occupy the mobile stronghold to move it.',
  );
  requireRule(
    Array.isArray(input) && input.every((key) => typeof key === 'string'),
    'Declare a route of board sectors.',
  );
  const route = input as string[];
  requireRule(
    route.every((key) => splitLocation(key).sector !== g.storm),
    'The mobile stronghold cannot move into, out of or through the storm.',
  );
  requireRule(
    route.length > 1 &&
      route[0] === g.mobileStronghold.location &&
      mobileRouteDistance(route) <= max,
    `Choose a connected route of at most ${max} territories, starting at the stronghold.`,
  );
  requireRule(
    territory(splitLocation(route.at(-1)!).territory).type !== 'stronghold',
    'The mobile stronghold must finish in a non-stronghold territory.',
  );
  return route;
}
function relocateMobileStronghold(
  g: Game,
  move: { player: string; route: string[]; collect: boolean },
) {
  const p = getPlayer(g, move.player);
  const blocked = homeworldRule(() => homeworldMobileStrongholdMovementBlock(g, p.id));
  requireRule(!blocked, blocked ?? 'The mobile stronghold cannot move.');
  let collected = 0;
  if (move.collect)
    for (const key of move.route) {
      const amount = Math.min(g.spice[key] ?? 0, at(p, MOBILE_STRONGHOLD) * 2);
      if (amount) {
        g.spice[key] -= amount;
        p.spice += amount;
        collected += amount;
      }
    }
  g.mobileStronghold!.location = move.route.at(-1)!;
  const loc = splitLocation(g.mobileStronghold!.location);
  log(
    g,
    `${p.name} moved the Hidden Mobile Stronghold to ${territory(loc.territory).name}, sector ${loc.sector}, collecting ${collected} spice.`,
  );
}
function choamWorthlessBlocked(g: Game, card: string) {
  return (
    g.choamWorthlessBlocked?.turn === g.turn &&
    g.choamWorthlessBlocked.phase === g.phase &&
    g.choamWorthlessBlocked.cards.includes(card)
  );
}
function nexusChoamSignature(record: NonNullable<Game['nexusChoamHistory']>[number]) {
  return JSON.stringify([record.receipt.signature, record.stage, record.frame, record.parent]);
}
function nexusChoamParent(g: Game, pending: NonNullable<Game['pendingChoamWorthless']>) {
  return JSON.stringify({
    movement: pending.movement ? g.pendingChoamMove : undefined,
    revival: pending.revival ? g.pendingRevival : undefined,
    storm: pending.storm ? g.stormResolution : undefined,
    mentat: pending.mentat ? g.choamMentatPending : undefined,
  });
}
function nexusChoamIntegrity(g: Game) {
  const pending = g.pendingChoamWorthless;
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const contexts = [g, g.pendingExchange, g.pendingNullentropy?.resume, g.pendingRicheseGift?.resume,
    g.pendingRichesePurchaseIncome?.resume, g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null];
  const responses = contexts.flatMap(context => {
    const karama = context && 'pendingKarama' in context ? context.pendingKarama as Game['pendingKarama'] : null;
    return [context?.response, karama?.use.kind === 'cancel' ? karama.use.response : null];
  }).filter(response => response?.kind === 'choamWorthless');
  const history = g.nexusChoamHistory;
  if (history === undefined) {
    requireRule(!g.nexusChoamLast && !pending?.nexusEvent, 'CHOAM Cunning has lost its original saved history.');
    return;
  }
  requireRule(g.nexusCards?.cards && Array.isArray(history) && history.length > 0,
    'CHOAM Cunning history requires its original Nexus module.');
  const events = new Set<string>();
  for (const [index, record] of history.entries()) {
    requireRule(record && typeof record === 'object' &&
      Object.keys(record).sort().join(',') === 'frame,parent,receipt,signature,stage' &&
      ['pending','canceled','complete','fizzled'].includes(record.stage) && typeof record.frame === 'string' && typeof record.parent === 'string' &&
      record.signature === nexusChoamSignature(record) && !events.has(record.receipt?.event) &&
      (record.stage !== 'pending' || index === history.length - 1),
      'CHOAM Cunning has a changed or duplicated outcome record.');
    nexusRule(() => validateNexusChoam(g,record.receipt));
    events.add(record.receipt.event);
  }
  const last = history.at(-1)!;
  requireRule(JSON.stringify(g.nexusChoamLast) === JSON.stringify({event:last.receipt.event,stage:last.stage}),
    'CHOAM Cunning has lost its latest completed or pending outcome.');
  requireRule((last.stage === 'pending') === !!pending?.nexusEvent,
    'CHOAM Cunning has lost or reopened its declared effect.');
  if (last.stage === 'pending') {
    requireRule(pending && pending.nexusEvent === last.receipt.event &&
      pending.owner === last.receipt.owner && pending.card === last.receipt.card && pending.effect === last.receipt.effect &&
      g.turn === last.receipt.turn && g.phase === last.receipt.phase &&
      JSON.stringify(pending) === last.frame && nexusChoamParent(g,pending) === last.parent && responses.length > 0 && g.nexusCards.cards.discard.includes('choam'),
      'CHOAM Cunning no longer matches its original card, selected effect or response.');
    for (const response of responses) {
      try { quoteChoamWorthlessCancellation(g,response!); }
      catch(error) {
        if (error instanceof ChoamWorthlessCancellationError) throw new RuleError(error.message);
        throw error;
      }
    }
  }
}
function recordNexusChoam(g: Game, p: Player, card: Card, effect: NexusChoamEffect) {
  const receipt = nexusRule(() => createNexusChoam(g,p.id,g.phase,card.id,effect));
  const record = {receipt,stage:'pending' as const,frame:JSON.stringify(g.pendingChoamWorthless),parent:nexusChoamParent(g,g.pendingChoamWorthless!),signature:''};
  record.signature = nexusChoamSignature(record);
  g.nexusCards!.cards = nexusRule(() => discardNexusCard(g.nexusCards!.cards!,p.id,g.players));
  (g.nexusChoamHistory ??= []).push(record);
  g.nexusChoamLast = {event:receipt.event,stage:record.stage};
}
function finishNexusChoam(g: Game, pending: NonNullable<Game['pendingChoamWorthless']>, stage: 'canceled' | 'complete' | 'fizzled') {
  if (!pending.nexusEvent) return;
  const record = g.nexusChoamHistory?.find(record => record.receipt.event === pending.nexusEvent);
  requireRule(record?.stage === 'pending' && record.frame === JSON.stringify(pending) && record.parent === nexusChoamParent(g,pending),
    'CHOAM Cunning has lost its original declared effect.');
  record.stage = stage; record.signature = nexusChoamSignature(record);
  g.nexusChoamLast = {event:record.receipt.event,stage};
}
function choamPowerPlays(g: Game, p: Player) {
  const printed = p.hand.filter(card => card.kind === 'worthless' &&
    Object.values(CHOAM_NEXUS_EFFECTS).includes(card.name as typeof CHOAM_NEXUS_EFFECTS[NexusChoamEffect]) && !choamWorthlessBlocked(g,card.id))
    .map(card => ({source:'printed' as const,card,effect:Object.entries(CHOAM_NEXUS_EFFECTS).find(([,name]) => name === card.name)![0] as NexusChoamEffect,
      blocked:card.name === 'Kull Wahad' ? 'Kull Wahad’s reaction and discard sequence is still being implemented.' : null}));
  if (p.faction !== 'choam' || p.ally || g.nexusCards?.cards?.hands[p.id] !== 'choam') return printed;
  return [...printed, ...p.hand.flatMap(card => (Object.keys(CHOAM_NEXUS_EFFECTS) as NexusChoamEffect[]).map(effect => {
    let blocked: string | null = null;
    if (effect === 'kull') blocked = 'Kull Wahad’s reaction and discard sequence is still being implemented.';
    else if (g.status !== 'playing' || g.truthtrance || g.response || g.phaseOpening || g.pendingKarama || g.pendingNullentropy || g.pendingTreacheryDiscard || g.choamMarket)
      blocked = 'Finish the current interaction before declaring CHOAM Cunning.';
    else if (choamWorthlessBlocked(g,card.id)) blocked = 'This card’s special-effect use is blocked for this phase.';
    else if (giftReserved(g,p.id,card.id)) blocked = 'This physical card is reserved for a pending gift.';
    else if (({kulon:5,laLaLa:4,gamont:8,baliset:5,jubba:0} as const)[effect] !== g.phase)
      blocked = 'Use this special effect in its normal phase.';
    else if (g.decision && !(g.decision.player === p.id && ['choamStorm','choamFreeRevival','choamMovement','choamMentat'].includes(g.decision.kind)))
      blocked = 'Finish the current decision before declaring this effect.';
    else if (effect === 'kulon' && (g.active !== p.id || p.moved >= movesAllowed(g,p))) blocked = 'Use Kulon before an available move on your own turn.';
    else if (effect === 'kulon' && g.ornithopter?.mode === 'range3' && g.ornithopter.player === p.id) blocked = 'Kulon combined with fixed Ornithopter range awaits a ruling.';
    else if (effect === 'jubba' && !(g.decision?.kind === 'choamStorm' && g.decision.player === p.id)) blocked = 'Use Jubba Cloak in your moving-storm response.';
    return {source:'nexus' as const,card,effect,event:JSON.stringify(['nexusChoam',g.turn,g.phase,p.id,card.id,effect]),blocked};
  }))];
}
function gamontAvailable(
  g: Game,
  target: string,
  key: string,
  elite: number,
  noFieldEvent?: string,
) {
  const p = g.players.find((p) => p.id === target);
  if (!p || !key) return false;
  if (noFieldEvent) {
    const marker = p.noField?.deployed;
    return (
      !!marker &&
      p.noFieldEvent === noFieldEvent &&
      location(marker.location.territory, marker.location.sector) === key &&
      elite === 0
    );
  }
  if (
    p.noField?.deployed &&
    location(
      p.noField.deployed.location.territory,
      p.noField.deployed.location.sector,
    ) === key
  )
    return false;
  const n = p.forces[key] ?? 0,
    e = p.elites?.forces[key] ?? 0;
  return elite === 1 ? e > 0 : elite === 0 && n > e;
}
function playChoamWorthless(g: Game, p: Player, action: Action) {
  const storming =
    g.decision?.kind === 'choamStorm' && g.decision.player === p.id;
  const reactive =
    g.decision?.kind === 'choamFreeRevival' && g.decision.player === p.id;
  const moving =
    g.decision?.kind === 'choamMovement' && g.decision.player === p.id;
  const mentat =
    g.decision?.kind === 'choamMentat' && g.decision.player === p.id;
  requireRule(
    g.status === 'playing' &&
      p.faction === 'choam' &&
      !g.response &&
      !g.choamMarket &&
      (!g.decision || reactive || mentat || moving || storming) &&
      (!g.pendingRevival || reactive),
    'CHOAM must finish the current decision before playing this Worthless effect.',
  );
  const nexus = action.nexus !== undefined;
  const card = p.hand.find((c) => c.id === action.card && (nexus || c.kind === 'worthless'));
  requireRule(
    card && !choamWorthlessBlocked(g, card.id),
    'Choose an owned Worthless card whose effect is not blocked this phase.',
  );
  let effectName = card.name;
  if (nexus) {
    requireRule(Object.keys(action).every(key => ['type','mode','card','nexus','effect','target','territory','amount','from','elite'].includes(key)),
      'Choose one physical card, special effect and its current target.');
    const play = choamPowerPlays(g,p).find(play => play.source === 'nexus' && play.card.id === card.id &&
      play.effect === action.effect && 'event' in play && play.event === action.nexus);
    requireRule(play && !play.blocked, play?.blocked ?? 'Choose your current CHOAM Nexus Cunning effect.');
    effectName = CHOAM_NEXUS_EFFECTS[play.effect];
  }
  requireRule(!giftReserved(g,p.id,card.id), 'This physical card is reserved for a pending gift.');
  let effect: 'kulon' | 'laLaLa' | 'gamont' | 'baliset' | 'jubba';
  let target: string | undefined;
  let key: string | undefined;
  let elite: number | undefined;
  let noFieldEvent: string | undefined;
  if (effectName === 'Kulon') {
    requireRule(
      g.ornithopter?.mode !== 'range3' || g.ornithopter.player !== p.id,
      'Kulon combined with fixed Ornithopter range awaits a ruling.',
    );
    requireRule(
      g.phase === 5 && g.active === p.id && p.moved < movesAllowed(g, p),
      'Use Kulon on your movement turn before an available move.',
    );
    effect = 'kulon';
  } else if (effectName === 'Jubba Cloak') {
    requireRule(
      g.phase === 0 && storming && g.stormResolution,
      'Use Jubba Cloak when CHOAM responds to the moving storm.',
    );
    key = stringField(action.territory);
    requireRule(
      choamStormOptions(g).some((t) => t.territory === key),
      'Choose an unprotected territory where the moving storm threatens CHOAM forces.',
    );
    requireRule(
      action.target === undefined || action.target === p.id,
      'Jubba Cloak protects only CHOAM forces.',
    );
    target = p.id;
    effect = 'jubba';
  } else if (effectName === 'Baliset') {
    requireRule(
      g.phase === 5,
      'Baliset is played during Shipment and Movement.',
    );
    target =
      moving && g.decision?.kind === 'choamMovement'
        ? g.decision.mover
        : stringField(action.target);
    key =
      moving && g.decision?.kind === 'choamMovement'
        ? g.decision.territory
        : stringField(action.territory);
    requireRule(
      target !== p.id && g.players.some((other) => other.id === target),
      'Choose another player.',
    );
    requireRule(
      gameTerritories(g).some((t) => t.id === key) && at(p, key) > 0,
      'Choose a territory CHOAM occupies.',
    );
    requireRule(
      !g.choamBaliset?.some(
        (b) => b.turn === g.turn && b.player === target && b.territory === key,
      ),
      'That player and territory are already restricted.',
    );
    effect = 'baliset';
  } else if (effectName === 'Trip to Gamont') {
    requireRule(
      g.phase === 8 && (action.amount === undefined || action.amount === 1),
      'Trip to Gamont returns exactly one force during Mentat Pause.',
    );
    target = stringField(action.target);
    const other = getPlayer(g, target);
    requireRule(
      other.id !== p.id,
      'Choose a force belonging to another player.',
    );
    key = stringField(action.from);
    const loc = splitLocation(key);
    const marker = other.noField?.deployed;
    const concealed =
      !!marker &&
      location(marker.location.territory, marker.location.sector) === key;
    requireRule(
      validLocation(loc.territory, loc.sector) &&
        ((other.forces[key] ?? 0) > 0 || concealed),
      'Choose an occupied board sector.',
    );
    if (concealed) {
      requireRule(
        other.faction === 'richese' &&
          !!other.noFieldEvent &&
          (action.elite === undefined || action.elite === 0),
        'Choose the Richese No-Field sector and ordinary force type.',
      );
      noFieldEvent = other.noFieldEvent;
      elite = 0;
    } else
      elite = eliteChoice(
        1,
        other.forces[key],
        other.elites?.forces[key] ?? 0,
        action.elite,
      );
    effect = 'gamont';
  } else {
    requireRule(
      effectName === 'La La La' && g.phase === 4,
      'This Worthless effect is not available in this phase.',
    );
    effect = 'laLaLa';
    target =
      reactive && g.decision?.kind === 'choamFreeRevival'
        ? g.decision.recipient
        : stringField(action.target);
    getPlayer(g, target);
    requireRule(
      !g.revivalRules?.freeBlocked?.includes(target),
      'That player is already prevented from free revival.',
    );
  }
  g.pendingChoamWorthless = {
    owner: p.id,
    card: card.id,
    effect,
    target,
    revival: reactive,
    movement: moving,
    storm: storming,
    location: key,
    elite,
    mentat,
    ...(noFieldEvent ? { noFieldEvent } : {}),
    ...(nexus ? {nexusEvent:action.nexus as string} : {}),
  };
  if (nexus) recordNexusChoam(g,p,card,effect);
  if (reactive || mentat || moving || storming) g.decision = null;
  g.ready = [];
  g.response = {
    kind: 'choamWorthless',
    owner: p.id,
    ...(target ? { recipient: target } : {}),
    ...(key
      ? {
          location:
            effect === 'jubba'
              ? location(
                  key,
                  choamStormOptions(g).find((t) => t.territory === key)!
                    .sectors[0],
                )
              : effect === 'baliset'
                ? location(
                    key,
                    g.pendingChoamMove?.sector ?? territory(key).sectors[0],
                  )
                : key,
          ...(elite !== undefined ? { elite } : {}),
        }
      : {}),
    intent: effectName,
    passed: [],
  };
  log(g, nexus
    ? `${p.name} spent CHOAM Nexus Cunning and declared ${effectName}. Its chosen Treachery card stays private and is discarded only if the effect occurs; Karama may prevent this native advantage.`
    : `${p.name} declared ${effectName} for its special effect.`);
}
/** Internal normalized command; never accept this object directly from a route. */
export type SpecialKaramaIntent = {
  owner: string;
  card: string;
  turn: number;
  phase: number;
} & (
  | { kind: 'choam'; cards: string[] }
  | { kind: 'richese'; acquire: string }
  | { kind: 'ixians'; route: string[]; collect: boolean }
  | { kind: 'tleilaxu'; target: string; revival: PendingRevival }
  | { kind: 'fremen'; territory: string }
  | {
      kind: 'atreides';
      target: string;
      battle: Pick<Battle, 'territory' | 'attacker' | 'defender'>;
    }
  | { kind: 'guild'; target: string; shipment: PendingShipment }
  | { kind: 'guildHomeworld'; target: string; shipment: PendingHomeworldShipment }
  | { kind: 'emperorForces'; amount: number; elite: number }
  | { kind: 'emperorLeader'; leader: string }
  | { kind: 'harkonnen'; target: string; amount: number }
);

/** Validates and copies a selection without spending resources, continuing play, or drawing RNG. */
export function prepareSpecialKaramaIntent(
  g: Game,
  playerId: string,
  action: Action,
): SpecialKaramaIntent {
  const p = getPlayer(g, playerId);
  // Delayed execution must respect the same enclosing windows as dispatch.
  // CHOAM's early cash-in bypasses the later gates, but never Truthtrance.
  requireRule(!g.truthtrance, 'Resolve the current Truthtrance first.');
  if (p.faction !== 'choam') {
    requireRule(
      !g.phaseOpening,
      'Play Amal or pass the phase opening before taking other actions.',
    );
    requireRule(
      !g.choamMarket,
      'Finish the end-of-phase exchange before another special power.',
    );
    requireRule(
      !g.pendingRevival ||
        (p.faction === 'tleilaxu' && g.decision?.kind === 'revivalStop'),
      'Resolve the pending revival first.',
    );
  }
  requireRule(
    g.status === 'playing' && g.advanced,
    'Special Karama powers require the advanced game.',
  );
  requireRule(
    !p.specialKaramaUsed,
    'Your special Karama power has already been used this game.',
  );
  const card = p.hand.find(
    (c) => c.id === action.card && c.effect === 'karama',
  );
  requireRule(card, 'Choose a Karama card in your hand.');
  const base = { owner: p.id, card: card.id, turn: g.turn, phase: g.phase };
  if (p.faction === 'richese') {
    const blocked = karamaSpendingBlock(g, p, card);
    requireRule(!blocked, blocked ?? 'This Karama is committed elsewhere.');
    requireRule(
      !(
        g.richeseAuction?.source === 'blackMarket' &&
        !g.currentAuctionSale &&
        g.richeseAuction.owner === p.id &&
        g.richeseAuction.cardId === card.id
      ),
      'The Karama reserved for Black Market cannot activate another effect.',
    );
    requireRule(
      p.hand.length < handLimit(p),
      'Special Richese Karama with a full hand awaits a ruling on acquisition and discard order.',
    );
    requireRule(
      uncommittedSpice(g, p) >= 3,
      'This purchase needs 3 uncommitted spice.',
    );
    requireRule(
      !g.pendingRichesePurchaseIncome,
      'Resolve the previous purchase income first.',
    );
    const acquire = stringField(action.acquire);
    const chosen = g.richeseCache?.find((c) => c.id === acquire);
    requireRule(
      chosen && richeseCardDefinition(chosen),
      'Choose a verified card in your Richese cache.',
    );
    requireRule(
      g.richeseAuction?.source !== 'cache' ||
        g.currentAuctionSale ||
        g.richeseAuction.cardId !== acquire,
      'The card already offered for auction must remain in that auction.',
    );
    requireRule(
      g.richeseCache!.length > 1,
      'Buying the final cache card awaits the empty-cache Bidding rule implementation.',
    );
    return { ...base, kind: 'richese', acquire };
  } else if (p.faction === 'choam') {
    requireRule(
      Array.isArray(action.cards) &&
        action.cards.length > 0 &&
        action.cards.every((id) => typeof id === 'string'),
      'Select cards to discard for spice.',
    );
    const selected = action.cards as string[];
    requireRule(
      new Set(selected).size === selected.length && !selected.includes(card.id),
      'Choose distinct cards; the activating Karama is spent separately.',
    );
    const available = cashInCards(g, p);
    requireRule(
      [card.id, ...selected].every((id) => available.some((c) => c.id === id)),
      'Choose your own uncommitted cards. Sealed and prescience cards must remain available.',
    );
    const removed = new Set([card.id, ...selected]);
    const credit = g.auction?.allyPayment ?? 0;
    requireRule(
      !g.auction ||
        g.auction.bidder !== p.id ||
        g.auction.bid <= p.spice + selected.length * 3 + credit ||
        p.hand.some((c) => c.effect === 'karama' && !removed.has(c.id)),
      'Retain enough spice or Karama to honor your current winning bid.',
    );
    return { ...base, kind: 'choam', cards: [...selected] };
  } else if (p.faction === 'ixians') {
    requireRule(
      g.phase === 5 && g.active === p.id && !g.response && !g.decision,
      'Move the stronghold with special Karama during your own Shipment and Movement turn.',
    );
    const route = validateMobileMove(g, p, action.route, 2);
    return {
      ...base,
      kind: 'ixians',
      route: [...route],
      collect: action.collect !== false,
    };
  } else if (p.faction === 'tleilaxu') {
    requireRule(
      g.phase === 4 &&
        !g.response &&
        g.decision?.kind === 'revivalStop' &&
        g.decision.player === p.id &&
        g.pendingRevival,
      'Wait for a normal revival declaration before preventing it.',
    );
    const target = g.pendingRevival.player;
    const homeworldBlock = homeworldRevivalKaramaBlock(g, target);
    requireRule(
      !homeworldBlock,
      homeworldBlock ?? '',
    );
    requireRule(
      action.target === undefined || action.target === target,
      'This decision applies to the faction currently reviving.',
    );
    return {
      ...base,
      kind: 'tleilaxu',
      target,
      revival: structuredClone(g.pendingRevival),
    };
  } else if (p.faction === 'fremen') {
    requireRule(
      g.phase === 1 && !g.summonedWorm,
      'Summon Shai-Hulud during Spice Blow and Nexus.',
    );
    const t = stringField(action.territory);
    requireRule(
      TERRITORIES.some((x) => x.id === t && x.type === 'sand'),
      'Summon Shai-Hulud in a sand territory.',
    );
    return { ...base, kind: 'fremen', territory: t };
  } else if (p.faction === 'atreides') {
    const b = g.battle;
    requireRule(
      g.phase === 6 &&
        !g.response &&
        g.decision?.kind === 'fullPlanOffer' &&
        g.decision.player === p.id &&
        b &&
        !b.revealed &&
        !b.preparation &&
        !Object.keys(b.plans).length,
      'Choose special prescience after battle preparation and before plans are sealed.',
    );
    const target = stringField(action.target);
    requireRule(
      [b.attacker, b.defender].includes(target),
      'Choose a player in this battle.',
    );
    requireRule(
      !b.noFieldPlayers?.includes(target),
      'Whole-plan special prescience against a No-Field awaits its disclosure ruling. Ordinary permitted elements remain available.',
    );
    return {
      ...base,
      kind: 'atreides',
      target,
      battle: {
        territory: b.territory,
        attacker: b.attacker,
        defender: b.defender,
      },
    };
  } else if (p.faction === 'guild') {
    if (g.decision?.kind === 'homeworldShipmentGuild') {
      requireRule(!g.response && g.decision.player === p.id,
        'Wait for your Homeworld shipment interception decision.');
      homeworldShipmentIntegrity(g);
      const shipment = g.pendingHomeworldShipment!;
      requireRule(action.target === undefined || action.target === shipment.player,
        'Stop the player who declared this Homeworld shipment.');
      return {...base, kind: 'guildHomeworld', target: shipment.player, shipment: structuredClone(shipment)};
    }
    requireRule(
      g.phase === 5 &&
        !g.response &&
        g.decision?.kind === 'guildShipment' &&
        g.decision.player === p.id &&
        g.pendingShipment,
      'Wait for an off-planet shipment declaration.',
    );
    validateGuildShipmentDecision(g, g.decision);
    const shipper = getPlayer(g, g.pendingShipment.player);
    return {
      ...base,
      kind: 'guild',
      target: shipper.id,
      shipment: { ...g.pendingShipment },
    };
  } else if (p.faction === 'emperor') {
    requireRule(
      action.target === undefined || action.target === p.id,
      'This revival power applies to the Emperor’s own forces or leaders.',
    );
    requireRule(
      g.phase === 4,
      'The Emperor special Karama is used during Revival.',
    );
    if (action.leader) {
      const l = p.leaders.find((l) => l.id === action.leader);
      requireRule(
        l?.dead && !l.capturedBy && !l.gholaBy,
        'Choose one of your dead leaders.',
      );
      requireRule(
        action.amount === undefined && action.elite === undefined,
        'Choose forces or one leader, not both.',
      );
      return { ...base, kind: 'emperorLeader', leader: l.id };
    }
    const n = integer(action.amount, 1, Math.min(3, p.tanks), 'Forces');
    const elite = eliteChoice(n, p.tanks, p.elites?.tanks ?? 0, action.elite);
    requireRule(
      elite <= eliteRevivalRemaining(p, g.advanced),
      'Only one elite force may be revived per turn.',
    );
    return { ...base, kind: 'emperorForces', amount: n, elite };
  } else if (p.faction === 'harkonnen') {
    requireRule(
      g.phase === 3 && !g.pendingExchange,
      'The Harkonnen special Karama is used during Bidding.',
    );
    const target = getPlayer(g, stringField(action.target));
    requireRule(target.id !== p.id, 'Choose another player’s hand.');
    requireRule(
      g.pendingRicheseGift?.intent.owner !== target.id,
      'Resolve the reserved Richese gift before randomly exchanging that hand.',
    );
    const count = integer(
      action.amount,
      1,
      Math.min(4, target.hand.length),
      'Cards to take',
    );
    requireRule(
      action.cards === undefined,
      'Cards are drawn unseen, not selected by identity.',
    );
    return { ...base, kind: 'harkonnen', target: target.id, amount: count };
  } else
    throw new RuleError(
      'This faction’s special Karama power is still being implemented.',
    );
}

// Convert only known normalized fields for revalidation. The original client Action
// is never retained, and omitted defaults cannot choose another card or elite mix.
function specialKaramaAction(intent: SpecialKaramaIntent): Action {
  const action = { type: 'card', mode: 'special', card: intent.card };
  switch (intent.kind) {
    case 'richese':
      return { ...action, acquire: intent.acquire };
    case 'choam':
      return { ...action, cards: [...intent.cards] };
    case 'ixians':
      return { ...action, route: [...intent.route], collect: intent.collect };
    case 'tleilaxu':
    case 'atreides':
    case 'guild':
    case 'guildHomeworld':
      return { ...action, target: intent.target };
    case 'fremen':
      return { ...action, territory: intent.territory };
    case 'emperorLeader':
      return { ...action, leader: intent.leader };
    case 'emperorForces':
      return { ...action, amount: intent.amount, elite: intent.elite };
    case 'harkonnen':
      return { ...action, target: intent.target, amount: intent.amount };
  }
}

/** Revalidates exact custody and the original window before any mutation.
 * A future paused-intent caller must restore its original decision/response first;
 * this executor does not open, pass, or recreate a reaction window.
 * Like other effect executors, it mutates a disposable working Game. The caller
 * must publish that clone only after success; applyAction provides this boundary.
 */
export function executeSpecialKaramaIntent(
  g: Game,
  intent: SpecialKaramaIntent,
): void {
  requireRule(
    g.turn === intent.turn && g.phase === intent.phase,
    'This special Karama declaration belongs to an earlier turn or phase.',
  );
  const prepared = prepareSpecialKaramaIntent(
    g,
    intent.owner,
    specialKaramaAction(intent),
  );
  requireRule(
    prepared.kind === intent.kind,
    'This special Karama declaration belongs to a different faction.',
  );
  // Pending declarations contain scalar fields and (for revival) an ordered checks
  // array. Compare field values independently of JSON object property order.
  const sameDeclaration = (before: object, now: object) => {
    const previous = before as Record<string, unknown>;
    const current = now as Record<string, unknown>;
    return [...new Set([...Object.keys(before), ...Object.keys(now)])].every(
      (key) => JSON.stringify(previous[key]) === JSON.stringify(current[key]),
    );
  };
  if (intent.kind === 'tleilaxu' && prepared.kind === 'tleilaxu')
    requireRule(
      intent.target === prepared.target &&
        sameDeclaration(intent.revival, prepared.revival),
      'The original revival declaration is no longer pending.',
    );
  if (intent.kind === 'guild' && prepared.kind === 'guild')
    requireRule(
      intent.target === prepared.target &&
        sameDeclaration(intent.shipment, prepared.shipment),
      'The original shipment declaration is no longer pending.',
    );
  if (intent.kind === 'guildHomeworld' && prepared.kind === 'guildHomeworld')
    requireRule(intent.target === prepared.target && sameDeclaration(intent.shipment, prepared.shipment),
      'The original Homeworld shipment declaration is no longer pending.');
  if (intent.kind === 'atreides' && prepared.kind === 'atreides')
    requireRule(
      sameDeclaration(intent.battle, prepared.battle),
      'The original battle is no longer awaiting special prescience.',
    );
  const p = getPlayer(g, intent.owner);
  const card = { id: intent.card };
  if (intent.kind === 'richese') {
    const selected = g.richeseCache!.findIndex((c) => c.id === intent.acquire);
    discard(g, p, card.id);
    p.spice -= 3;
    p.hand.push(...g.richeseCache!.splice(selected, 1));
    p.specialKaramaUsed = true;
    log(
      g,
      `${p.name} spent Karama and 3 spice to buy one secretly chosen card from the Richese cache. This once-per-game special power cannot be canceled.`,
      { faction: 'richese', name: 'Special Karama purchase' },
    );
    const emperor = byFaction(g, 'emperor');
    if (emperor) {
      g.pendingRichesePurchaseIncome = {
        owner: emperor.id,
        turn: g.turn,
        phase: g.phase,
        resume: {
          response: g.response,
          decision: g.decision,
          pendingKarama: g.pendingKarama ?? null,
        },
      };
      g.decision = null;
      g.pendingKarama = null;
      g.response = {
        kind: 'richesePurchaseIncome',
        owner: emperor.id,
        amount: 3,
        passed: [],
      };
    }
  } else if (intent.kind === 'choam') {
    const selected = intent.cards;
    discard(g, p, card.id);
    for (const id of selected) discard(g, p, id);
    p.spice += selected.length * 3;
    p.specialKaramaUsed = true;
    log(
      g,
      `${p.name} used special Karama to discard ${selected.length} cards and gain ${selected.length * 3} spice.`,
    );
  } else if (intent.kind === 'ixians') {
    const route = intent.route;
    discard(g, p, card.id);
    p.specialKaramaUsed = true;
    relocateMobileStronghold(g, {
      player: p.id,
      route,
      collect: intent.collect,
    });
  } else if (intent.kind === 'tleilaxu') {
    const target = intent.target;
    discard(g, p, card.id);
    p.specialKaramaUsed = true;
    g.revivalPrevention = { player: target, turn: g.turn };
    g.pendingRevival = null;
    g.decision = null;

    if (g.revivalRequests) delete g.revivalRequests[target];
    log(
      g,
      `${p.name} used special Karama to prevent ${getPlayer(g, target).name}’s normal force and leader revivals for this turn.`,
    );
  } else if (intent.kind === 'fremen') {
    const t = intent.territory;
    discard(g, p, card.id);
    p.specialKaramaUsed = true;
    g.summonedWorm = {
      territory: t,
      resume: {
        response: g.response,
        decision: g.decision,
        pendingKarama: g.pendingKarama,
        spiceWindow: g.spiceWindow,
        spiceResolution: g.spiceResolution,
        spiceSequence: g.spiceSequence,
        nexus: g.nexus,
        wormRides: g.wormRides,
        ready: g.ready,
      },
    };
    g.response = null;
    g.decision = null;
    g.pendingKarama = null;
    g.spiceWindow = null;
    g.spiceResolution = null;
    g.spiceSequence = null;
    g.wormRides = [];
    g.ready = [];
    g.nexus = true;
    log(
      g,
      `${p.name} used special Karama to summon Shai-Hulud in ${territory(t).name}.`,
    );
    beginWorm(g, t);
  } else if (intent.kind === 'atreides') {
    const b = g.battle!,
      target = intent.target;
    discard(g, p, card.id);
    p.specialKaramaUsed = true;
    b.fullPlan = { owner: p.id, target };
    g.decision = null;
    log(
      g,
      `${p.name} used special Karama to inspect ${getPlayer(g, target).name}’s entire battle plan.`,
    );
  } else if (intent.kind === 'guildHomeworld') {
    const shipper = getPlayer(g, intent.target);
    discard(g, p, card.id);
    p.specialKaramaUsed = true;
    shipper.shipped = true;
    g.pendingHomeworldShipment = null;
    g.decision = null;
    finishShipmentPromises(g, shipper, null);
    log(g, `${p.name} used special Karama to stop ${shipper.name}’s interplanetary shipment. No forces arrive or spice is paid; their shipment is used and movement remains available.`);
  } else if (intent.kind === 'guild') {
    const shipper = getPlayer(g, intent.target);
    discard(g, p, card.id);
    p.specialKaramaUsed = true;
    if (g.pendingShipment?.source === 'ambassador') {
      currentGuildAmbassador(g, g.pendingShipment.ambassadorEvent);
      g.pendingShipment = null;
      g.decision = null;
      log(
        g,
        `${p.name} used special Karama to stop ${shipper.name}’s Guild Ambassador shipment. No forces arrive; ordinary shipment and movement allowances are unchanged.`,
      );
      finishAmbassador(g);
      return;
    }
    shipper.shipped = true;
    // Provisional canceled-shipment settlement pending a primary-source
    // clarification: retain the attempted shipment's spice and rate card.
    const benefit = g.karamaShipping;
    if (benefit?.player === shipper.id && benefit.card) {
      const index = g.discard.findIndex((c) => c.id === benefit.card);
      if (index >= 0)
        getPlayer(g, benefit.owner).hand.push(...g.discard.splice(index, 1));
    }
    g.karamaShipping = null;
    g.pendingShipment = null;
    g.decision = null;
    log(
      g,
      `${p.name} used special Karama to stop ${shipper.name}’s shipment. No forces arrive or spice is paid; movement remains available.`,
    );
  } else if (
    intent.kind === 'emperorLeader' ||
    intent.kind === 'emperorForces'
  ) {
    if (intent.kind === 'emperorLeader') {
      const l = p.leaders.find((l) => l.id === intent.leader)!;
      l.dead = false;
      delete l.concealed;
      log(g, `${p.name} used special Karama to revive ${l.name} for free.`);
    } else {
      const n = intent.amount,
        elite = intent.elite;
      addRevivedReserves(g, p, n, elite);
      p.tanks -= n;
      if (p.elites) {
        p.elites.tanks -= elite;
        p.elites.revived += elite;
      }
      log(g, `${p.name} used special Karama to revive ${n} forces for free.`);
    }
    techIncome(g, 'axlotl', p);
    discard(g, p, card.id);
    p.specialKaramaUsed = true;
  } else if (intent.kind === 'harkonnen') {
    const target = getPlayer(g, intent.target),
      count = intent.amount;
    discard(g, p, card.id);
    p.specialKaramaUsed = true;
    const taken = shuffle(target.hand).slice(0, count);
    target.hand = target.hand.filter((c) => !taken.some((t) => t.id === c.id));
    p.hand.push(...taken);
    g.pendingExchange = { response: g.response, decision: g.decision };
    g.response = null;
    g.decision = {
      kind: 'handExchange',
      player: p.id,
      target: target.id,
      count,
    };
    log(
      g,
      `${p.name} used special Karama to take ${count} unseen cards from ${target.name}; an equal return is pending.`,
    );
  }
}
function specialKarama(g: Game, p: Player, action: Action) {
  executeSpecialKaramaIntent(g, prepareSpecialKaramaIntent(g, p.id, action));
}

/** Private, read-only choices; validation performs no draws or continuations. */
function richeseSpecialKaramaView(g: Game, p: Player) {
  if (
    g.status !== 'playing' ||
    !g.advanced ||
    p.faction !== 'richese' ||
    p.specialKaramaUsed
  )
    return null;
  const karamas = p.hand.filter(
    (c) =>
      c.effect === 'karama' &&
      !karamaSpendingBlock(g, p, c) &&
      !(
        g.richeseAuction?.source === 'blackMarket' &&
        !g.currentAuctionSale &&
        g.richeseAuction.owner === p.id &&
        g.richeseAuction.cardId === c.id
      ),
  );
  const cache = (g.richeseCache ?? []).filter((c) => richeseCardDefinition(c));
  const cards: Card[] = [];
  let blocked: string | null = !karamas.length
    ? 'A spendable Karama card is required.'
    : !cache.length
      ? 'There are no verified cards in your Richese cache.'
      : null;
  if (karamas.length)
    for (const candidate of cache) {
      try {
        prepareSpecialKaramaIntent(g, p.id, {
          type: 'card',
          mode: 'special',
          card: karamas[0].id,
          acquire: candidate.id,
        });
        cards.push(candidate);
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        blocked ??= error.message;
      }
    }
  return {
    cards,
    karamas,
    blocked: cards.length ? null : blocked,
    payee: byFaction(g, 'emperor')?.id ?? null,
  };
}

type CompletedMovement = Pick<
  MovementOrder,
  'player' | 'origin' | 'total' | 'to' | 'sector' | 'elite'
> & { noField: boolean };
type MovementOrder = {
  source?: 'ambassador';
  ambassadorEvent?: string;
  player: string;
  group: [string, number][];
  eliteGroup: Record<string, number>;
  elite: number;
  origin: string;
  total: number;
  to: string;
  sector: number;
  advisors: boolean;
  wantsFighters: boolean;
  lockedTurn?: number;
  noField?: { tokenId: string; event: string; from: string };
  ornithopterEvent?: string;
  ornithopterRange?: boolean;
};
export type Action = { type: string; [key: string]: unknown };
function normalizeCardNames(g: Game) {
  normalizeLegacyCardNames([
    ...g.deck,
    ...g.discard,
    ...(g.ornithopter ? [g.ornithopter.card] : []),
    ...g.players.flatMap((p) => p.hand),
    ...(g.auction?.cards ?? []),
    ...(g.ixSetupCards ?? []),
    ...(g.ixAuction?.cards ?? []),
    ...(g.ixAuctionKnown?.cards ?? []),
  ]);
}
export function applyAction(state: Game, id: string, action: Action): Game {
  marketGholaIntegrity(state);
  homeworldRule(() => homeworldGameIntegrity(state));
  homeworldBattleLossIntegrity(state);
  homeworldSubstitutionIntegrity(state);
  homeworldDefenseIntegrity(state);
  homeworldShipmentIntegrity(state);
  karamaConversionIntegrity(state);
  treacheryDiscardIntegrity(state);
  shipmentPromiseIntegrity(state);
  saphoMovementIntegrity(state);
  ambassadorRelocationIntegrity(state);
  ecazCollectionIntegrity(state);
  ecazAllianceIntegrity(state);
  // Seat control is independent of gameplay locks and must preserve their exact continuation.
  if (action?.type === 'setAutopilot') {
    requireRule(
      state.status === 'setup' || state.status === 'playing',
      'AI control is available after the game starts and before it ends.',
    );
    const player = getPlayer(state, id);
    requireRule(!player.bot, 'This is a permanent AI seat.');
    requireRule(
      Object.keys(action).every(
        (key) => key === 'type' || key === 'difficulty',
      ),
      'You may change AI control only for your own seat.',
    );
    requireRule(
      action.difficulty === null ||
        (typeof action.difficulty === 'string' &&
          ['Easy', 'Medium', 'Hard', 'Brutal'].includes(action.difficulty)),
      'Choose an AI difficulty or take back control.',
    );
    const g = structuredClone(state);
    const owner = getPlayer(g, id);
    if ((owner.autopilot ?? null) === action.difficulty) return g;
    if (action.difficulty === null) {
      delete owner.autopilot;
      log(g, `${owner.name} took back control from AI.`);
    } else {
      owner.autopilot = action.difficulty as NonNullable<Player['autopilot']>;
      log(
        g,
        `${owner.name} enabled ${owner.autopilot} AI control for their seat.`,
      );
    }
    return g;
  }
  if (state.pendingTreacheryDiscard) {
    getPlayer(state, id);
    requireRule(
      action?.type === 'advanceBots',
      'Finish the committed discard continuation before another game action.',
    );
    return normalizeAutomaticGame(state);
  }
  const g = applyActionInner(state, id, action);
  observeOccupation(g);
  homeworldRule(() => homeworldGameIntegrity(g));
  homeworldBattleLossIntegrity(g);
  homeworldSubstitutionIntegrity(g);
  homeworldDefenseIntegrity(g);
  homeworldShipmentIntegrity(g);
  karamaConversionIntegrity(g);
  ornithopterIntegrity(g);
  lateDefenseIntegrity(g);
  stoneBurnerIntegrity(g);
  strongholdIntegrity(g);
  auditorIntegrity(g);
  if (g.pendingNullentropy) {
    const invalid = nullentropyIntegrity(g);
    requireRule(!invalid, invalid ?? 'The search cannot continue.');
    return g;
  }
  if (
    g.pendingRicheseGift &&
    state.pendingRicheseGift?.event === g.pendingRicheseGift.event
  ) {
    const pending = g.pendingRicheseGift;
    requireRule(
      getPlayer(g, pending.intent.owner).hand.filter(
        (c) => c.id === pending.intent.cardId,
      ).length === 1,
      'The card reserved for a pending Richese gift must remain in its owner’s hand.',
    );
  }
  // An accepted exchange obliges its beneficiary to complete the discard.
  // Interrupting voluntary card plays must leave a legal completion available.
  const pending = g.pendingAmbassador;
  if (
    pending &&
    pending.event === state.pendingAmbassador?.event &&
    pending.beneficiary === id
  ) {
    const beneficiary = getPlayer(g, id),
      entrant = getPlayer(g, pending.entrant);
    if (pending.stage === 'cards' && pending.effect === 'ixians')
      requireRule(
        !ambassadorEffectBlock(g, 'ixians', beneficiary, entrant),
        'Complete the Ixian Ambassador exchange before spending your last available card.',
      );
    if (pending.stage === 'copy')
      requireRule(
        pending.copyChoices.some(
          (effect) => !ambassadorEffectBlock(g, effect, beneficiary, entrant),
        ),
        'Leave an available effect for the committed Bene Gesserit Ambassador.',
      );
  }
  const lot = g.richeseAuction;
  if (lot && !g.currentAuctionSale) {
    requireRule(
      lot.source !== 'blackMarket' ||
        !g.truthtrance?.queue.some(
          (entry) => entry.player === lot.owner && entry.card === lot.cardId,
        ),
      'The card reserved for this Black Market auction cannot also be queued for Truthtrance.',
    );
    requireRule(
      richeseLotCard(g),
      'The card reserved for this auction must remain available.',
    );
    for (const bidder of g.players) {
      requireRule(
        richeseOwnCommitment(lot, g.richeseFunding ?? {}, bidder.id) <=
          bidder.spice,
        'Spice committed to an auction cannot be spent again.',
      );
      requireRule(
        richeseAllyCommitment(lot, g.richeseFunding ?? {}, bidder.id) <=
          (g.aid[bidder.id]?.amount ?? 0),
        'Ally spice committed to an auction cannot be withdrawn.',
      );
      const hasWinningCommitment = lot.outcome
        ? lot.outcome.kind === 'sold' && lot.outcome.winner === bidder.id
        : lot.method === 'silent'
          ? (lot.sealed[bidder.id] ?? 0) > 0
          : lot.bidder === bidder.id;
      if (hasWinningCommitment)
        requireRule(
          bidder.hand.length < handLimit(bidder),
          'Leave room for the card in your committed auction.',
        );
    }
  }
  finishActionContinuations(g);
  reconcileBattlePromises(g, { actor: id, action });
  reconcileShipmentPromises(g, { actor: id, action });
  settleAutomaticContinuations(g);
  observeOccupation(g);
  marketGholaIntegrity(g);
  homeworldRule(() => homeworldGameIntegrity(g));
  homeworldBattleLossIntegrity(g);
  homeworldSubstitutionIntegrity(g);
  homeworldDefenseIntegrity(g);
  homeworldShipmentIntegrity(g);
  return g;
}
function finishActionContinuations(g: Game) {
  if (g.pendingNullentropy) return;
  // Losing cleanup may finish casualties and produce the winner's mandatory
  // discard. Retire that next physical batch before exposing optional choices.
  for (let i = 0; g.pendingTreacheryDiscard && i < 16; i++) finishTreacheryDiscard(g);
  requireRule(!g.pendingTreacheryDiscard, 'The automatic discard chain did not finish.');
  if (pendingNexusTraitors(g)) return;
  observeOccupation(g);
  resumeHomeworldRevivalReturn(g);
  resumeHomeworldVictoryReturn(g);
  resumeMarketGhola(g);
  resumeGrummanCollection(g);
  if (!g.truthtrance && !g.decision && !g.response) advanceSetup(g);
  if (
    !g.truthtrance &&
    g.pendingTerrorEntry?.stage === 'discard' &&
    g.decision?.kind === 'moritaniTerror'
  ) {
    const moritani = getPlayer(g, g.decision.player);
    if (moritani.hand.length <= handLimit(moritani)) {
      g.decision = null;
      finishTerrorEntry(g);
    }
  }
  if (
    g.status === 'setup' &&
    !g.truthtrance &&
    !g.decision &&
    !g.response &&
    otherSetupComplete(g)
  ) {
    const moritani = byFaction(g, 'moritani');
    if (moritani?.reserves === 20) {
      g.moritaniTerror ??= createTerrorState(random);
      g.decision = { kind: 'moritaniSetup', player: moritani.id };
    }
  }
  if (
    g.status === 'setup' &&
    !g.truthtrance &&
    !g.response &&
    !g.decision &&
    setupComplete(g)
  )
    finishSetup(g);
  settleAdvisors(g);
}
function settleAutomaticContinuations(g: Game) {
  if (pendingNexusTraitors(g)) return;
  if (g.pendingNullentropy) return;
  for (let iteration = 0; iteration < 128; iteration++) {
    if (g.truthtrance || g.phaseOpening || g.status === 'finished') return;
    const response = g.response;
    const before = JSON.stringify(g);
    if (response) {
      if (
        !(
          response.kind === 'harkonnenBonus' &&
          getPlayer(g, response.owner).hand.length >=
            handLimit(getPlayer(g, response.owner))
        ) &&
        g.players.some(
          (p) =>
            !response.passed.includes(p.id) &&
            responseCancelCards(g, p, response).length > 0,
        )
      )
        return;
      finishResponse(g, false);
    } else if (!finishAutomaticDecision(g)) return;
    finishActionContinuations(g);
    // Opposing/automatic consequences can release a now-impossible promise;
    // they are not the original actor voluntarily spending a promised resource.
    reconcileBattlePromises(g);
    reconcileShipmentPromises(g);
    requireRule(
      JSON.stringify(g) !== before,
      'Automatic response continuation made no progress.',
    );
  }
  throw new RuleError(
    'Automatic response continuation exceeded its bounded limit.',
  );
}
/** Internal authoritative continuation. Callers must persist with their usual CAS fence. */
export function normalizeAutomaticGame(state: Game): Game {
  marketGholaIntegrity(state);
  homeworldRule(() => homeworldGameIntegrity(state));
  homeworldBattleLossIntegrity(state);
  homeworldSubstitutionIntegrity(state);
  homeworldDefenseIntegrity(state);
  homeworldShipmentIntegrity(state);
  karamaConversionIntegrity(state);
  treacheryDiscardIntegrity(state);
  shipmentPromiseIntegrity(state);
  saphoMovementIntegrity(state);
  ambassadorRelocationIntegrity(state);
  ecazCollectionIntegrity(state);
  ecazAllianceIntegrity(state);
  const g = structuredClone(state);
  ornithopterIntegrity(g);
  lateDefenseIntegrity(g);
  stoneBurnerIntegrity(g);
  strongholdIntegrity(g);
  auditorIntegrity(g);
  if (g.pendingNullentropy) return g;
  normalizeCardNames(g);
  normalizeBattle(g);
  finishActionContinuations(g);
  reconcileBattlePromises(g);
  reconcileShipmentPromises(g);
  settleAutomaticContinuations(g);
  observeOccupation(g);
  marketGholaIntegrity(g);
  homeworldRule(() => homeworldGameIntegrity(g));
  homeworldBattleLossIntegrity(g);
  homeworldSubstitutionIntegrity(g);
  homeworldDefenseIntegrity(g);
  homeworldShipmentIntegrity(g);
  return g;
}

function applyActionInner(
  state: Game,
  id: string,
  action: Action,
  execution: 'live' | 'shipmentPreparation' = 'live',
): Game {
  const g = structuredClone(state);
  if (g.biddingEnd && action.type !== 'advanceBots' &&
      !(action.type === 'biddingEnd' && action.mode === 'ready'))
    g.biddingEnd.ready = [];
  ornithopterIntegrity(g);
  lateDefenseIntegrity(g);
  stoneBurnerIntegrity(g);
  strongholdIntegrity(g);
  auditorIntegrity(g);
  if (g.pendingNullentropy && !['nexusTraitorDraw', 'nexusTraitorReturn', 'nexusFaceDancers'].includes(action?.type)) {
    if (action?.type === 'advanceBots') return g;
    requireRule(!pendingNexusTraitors(g), 'Finish the private Nexus card return before continuing the paid search.');
    requireRule(
      action?.type === 'decision',
      'Finish the paid Nullentropy Box search before another game action.',
    );
    finishNullentropy(
      g,
      id,
      stringField(action.event),
      stringField(action.card),
    );
    return g;
  }
  if (!g.playerPositions) {
    g.playerPositions = normalizedPlayerPositions(g);
    if (g.status === 'lobby') g.storm = STORM_START_SECTOR;
    if (g.status !== 'lobby')
      log(
        g,
        'Assigned printed player circles in original seating order. Current turn order and storm choices are unchanged; the next completed storm uses these circles.',
      );
  }
  normalizeCardNames(g);
  // Older persisted rooms predate decision windows.
  g.decision ??= null;
  g.pendingCapture ??= null;
  g.response ??= null;
  g.stormPending ??= null;
  g.stormCard ??= null;
  g.stormCardKnown ??= false;
  g.stormResolution ??= null;
  g.karamaShipping ??= null;
  g.wormRides ??= [];
  g.wormPlacementCanceledTurn ??= 0;
  g.spiceResolution ??= null;
  g.spiceSequence ??= null;
  g.spiceWindow ??= null;
  g.spicePeekKnown ??= false;
  g.freeRevival ??= [];
  g.emperorExtra ??= {};
  g.aid ??= {};
  g.movementRemaining ??= null;
  g.guildTimingGranted ??= false;
  g.guildTimingLocked ??= false;
  normalizeBattle(g);
  const p = getPlayer(g, id);
  requireRule(
    action && typeof action.type === 'string',
    'Action type is required.',
  );
  requireRule(g.status !== 'finished', 'This game has ended.');
  const t = action.type;
  if (t === 'advanceBots') return g;
  if (t === 'nexusCardChoice') { decideNexusCard(g, p, action); return g; }
  requireRule(g.nexusCards?.phase?.stage !== 'drawing', 'Finish the closing Nexus card choices first.');
  if (t === 'nexusTraitorDraw') { playNexusTraitorDraw(g, p, action); return g; }
  if (t === 'nexusFaceDancers') { playNexusFaceDancers(g, p, action); return g; }
  if (t === 'nexusSuboids') { playNexusSuboids(g, p, action); return g; }
  if (t === 'nexusAdvisors') { playNexusAdvisors(g, p, action); return g; }
  if (t === 'nexusSardaukar') { playNexusSardaukar(g,p,action); return g; }
  if (t === 'nexusTraitorReturn') {
    requireRule(!g.truthtrance, 'Finish the active Truthtrance before returning Nexus cards.');
    finishNexusTraitorReturn(g, p, action); return g;
  }
  if (t === 'nexusAtreides') { playNexusAtreides(g, p, action); return g; }
  requireRule(
    !(
      t === 'card' &&
      g.richeseAuction?.source === 'blackMarket' &&
      !g.currentAuctionSale &&
      g.richeseAuction.owner === p.id &&
      action.card === g.richeseAuction.cardId
    ),
    'The card reserved for this Black Market auction cannot be played or queued for another effect.',
  );
  try {
    if (
      resolveTruthAction(g, p, action, {
        completeDefiniteAnswer: finishTruthtranceAnswer,
        log,
        shipmentAnswers: shipmentTruthAnswers,
        bindShipment: bindShipmentTruth,
        battleAnswers: battleTruthAnswers,
        bindBattle: bindBattleTruth,
      })
    )
      return g;
  } catch (error) {
    if (error instanceof TruthError || error instanceof PlanClaimError)
      throw new RuleError(error.message);
    throw error;
  }
  requireRule(!pendingNexusTraitors(g), 'Finish the private Nexus card return before continuing play.');
  if (t === 'card' && action.card === 'richese-juice-of-sapho') {
    playSapho(g, p, action);
    return g;
  }
  if (t === 'tupileIntelligence') {
    requestTupileIntelligence(g, p, action);
    return g;
  }
  if (t === 'portableSnooper') {
    requireRule(
      Object.keys(action).every((key) =>
        ['type', 'card', 'event'].includes(key),
      ),
      'Choose only the held Portable Snooper and current battle event.',
    );
    const { b, card } = validatePortableSnooper(
      g,
      p,
      stringField(action.card),
      stringField(action.event),
    );
    (b.lateDefense ??= {})[id] = card.id;
    log(
      g,
      `${p.name} played Portable Snooper after revealing their battle plan. It protects against ordinary poison without changing the original plan. Battle and traitor decisions continue.`,
      { faction: p.faction, name: 'Portable Snooper' },
    );
    return g;
  }
  if (t === 'battlePreparationReady') {
    const b = g.battle,
      opportunity = b?.preLeader;
    requireRule(
      g.phase === 6 &&
        b &&
        opportunity &&
        !opportunity.closed &&
        !b.revealed &&
        [b.attacker, b.defender].includes(id),
      'No shared pre-leader opportunity is waiting for you.',
    );
    requireRule(
      action.event === opportunity.event && !opportunity.ready.includes(id),
      'This preparation declaration is stale or already recorded.',
    );
    requireRule(
      !g.truthtrance && !g.response && !g.decision && !g.phaseOpening,
      'Finish the current interaction before leaving preparation.',
    );
    opportunity.ready.push(id);
    opportunity.closed = [b.attacker, b.defender].every((player) =>
      opportunity.ready.includes(player),
    );
    log(
      g,
      `${p.name} is ready to continue battle preparation${opportunity.closed ? '; both combatants have finished their shared pre-leader opportunity' : ''}.`,
    );
    return g;
  }
  if (
    t === 'card' &&
    p.hand.some((c) => c.id === action.card && c.effect === 'residualPoison')
  ) {
    requireRule(
      Object.keys(action).every((key) =>
        ['type', 'card', 'target', 'event'].includes(key),
      ),
      'Residual Poison chooses the victim on the server; do not submit a leader or random selection.',
    );
    playResidualPoison(
      g,
      p,
      stringField(action.card),
      stringField(action.target),
      stringField(action.event),
    );
    return g;
  }
  if (
    t === 'card' &&
    p.hand.some((c) => c.id === action.card && c.effect === 'nullentropyBox')
  ) {
    requireRule(
      Object.keys(action).every((key) => key === 'type' || key === 'card'),
      'Begin the private Box search before selecting any discard card.',
    );
    beginNullentropy(g, p, stringField(action.card));
    return g;
  }
  if (
    t === 'card' &&
    p.hand.some((c) => c.id === action.card && c.effect === 'distrans')
  ) {
    requireRule(!action.mode, 'Use Distrans as its printed card effect.');
    const { recipient, result } = validateDistrans(
      g,
      p,
      stringField(action.card),
      stringField(action.target),
      stringField(action.give),
    );
    p.hand = result.ownerHand;
    recipient.hand = result.recipientHand;
    g.discard.push(result.discarded);
    log(
      g,
      `${p.name} played Distrans to give ${recipient.name} one private Treachery Card, then discarded Distrans. No spice, purchase bonus or recipient confirmation is required.`,
      { faction: p.faction, name: 'Distrans' },
    );
    return g;
  }
  if (t === 'richeseGift') {
    const { intent } = validateRicheseGift(g, p, stringField(action.card));
    g.pendingRicheseGift = {
      event: crypto.randomUUID(),
      intent,
      turn: g.turn,
      phase: g.phase,
      resume: {
        response: g.response,
        decision: g.decision,
        pendingKarama: g.pendingKarama,
        phaseOpening: g.phaseOpening,
      },
    };
    g.response = {
      kind: 'richeseGift',
      owner: id,
      recipient: intent.recipient,
      passed: [],
    };
    g.decision = null;
    g.pendingKarama = null;
    g.phaseOpening = null;
    log(
      g,
      `${p.name} offered their ally one Richese Treachery Card from hand. Its identity stays private; resolve the alliance power before transferring it.`,
    );
    return g;
  }
  if (t === 'card' && action.mode === 'special' && p.faction === 'choam') {
    specialKarama(g, p, action);
    return g;
  }
  if (t === 'card' && choamSaleGholaTiming(g) &&
      p.hand.some((card) => card.id === action.card && card.effect === 'ghola')) {
    playMarketGhola(g, p, action);
    return g;
  }
  if (t === 'biddingEnd') {
    decideBiddingEnd(g, p, action);
    return g;
  }
  if (g.phaseOpening) {
    requireRule(
      g.status === 'playing',
      'Phase opening requires an active game.',
    );
    requireRule(
      !g.phaseOpening.passed.includes(id),
      'You have already passed the phase opening.',
    );
    if (t === 'ready') {
      g.phaseOpening.passed.push(id);
      if (g.phaseOpening.passed.length === g.players.length) {
        const initialize = g.phaseOpening.initialize;
        g.phaseOpening = null;
        if (initialize) beginPhase(g);
      }
    } else {
      const card = p.hand.find(
        (c) => c.id === action.card && c.effect === 'amal',
      );
      requireRule(
        t === 'card' && card && !action.mode,
        'Play Amal or pass the phase opening before taking other actions.',
      );
      discard(g, p, card.id);
      for (const player of g.players)
        player.spice = Math.floor(player.spice / 2);
      g.phaseOpening.passed = [];
      log(
        g,
        `${p.name} played Amal. Each faction returned half its available spice to the bank, rounded up.`,
      );
    }
    return g;
  }
  if (t === 'card' && action.mode === 'choam') {
    playChoamWorthless(g, p, action);
    return g;
  }
  if (t === 'card' && action.mode === 'special') {
    requireRule(
      !g.choamMarket,
      'Finish the end-of-phase exchange before another special power.',
    );
    requireRule(
      !g.pendingRevival ||
        (p.faction === 'tleilaxu' && g.decision?.kind === 'revivalStop'),
      'Resolve the pending revival first.',
    );
    specialKarama(g, p, action);
    return g;
  }
  if (g.response) {
    const response = g.response;
    if (response.kind === 'fremenMovement') pendingFremenMovement(g, response);
    if (t === 'passResponse') {
      requireRule(
        !response.passed.includes(id),
        'You have already passed this response window.',
      );
      response.passed.push(id);
    } else {
      requireRule(
        t === 'card' && action.mode === 'cancel',
        'Resolve the Karama response window first.',
      );
      requireRule(
        id !== response.owner,
        'Karama cancels another faction’s power.',
      );
      const card = karamaCard(g, p, action.card);
      requireRule(card, 'Choose a Karama in your hand.');
      spendKarama(g, p, card, { kind: 'cancel', response });
    }
    return g;
  }
  if (
    t === 'offerRicheseNoField' &&
    g.decision?.kind === 'richeseAllyOpportunity' &&
    g.decision.player === id
  )
    g.decision = null;
  if (g.decision) {
    const decision = g.decision;
    requireRule(
      t === 'decision' && decision.player === id,
      'Waiting for the player with the pending decision.',
    );
    g.decision = null;
    if (decision.kind === 'homeworldRevivalDeployment') {
      decideHomeworldRevivalReturn(g, p, action);
      return g;
    }
    if (decision.kind === 'caladanReinforcement') {
      decideHomeworldVictoryReturn(g, p, action);
      return g;
    }
    if (decision.kind === 'ecazSpice') {
      g.decision = decision;
      decideSharedSpice(g, id, action);
      return g;
    }
    if (
      decision.kind === 'richeseBlackMarket' ||
      decision.kind === 'richeseDeclaration' ||
      decision.kind === 'richeseCache' ||
      decision.kind === 'richeseUnbid'
    ) {
      decideRichese(g, p, decision, action);
      return g;
    }
    if (decision.kind === 'ecazAmbassador') {
      decideAmbassador(g, p, action);
      return g;
    }
    if (decision.kind === 'ecazPlacement') {
      requireRule(
        g.status === 'playing' &&
          g.phase === 4 &&
          p.faction === 'ecaz' &&
          g.ecazAmbassadors &&
          g.ecazPlacementTurn !== g.turn,
        'Place Ambassadors during your end-of-Revival opportunity.',
      );
      if (action.decline === true) {
        log(g, `${p.name} finished Ambassador placement.`);
        finishEcazPlacement(g);
      } else {
        const token = stringField(action.token),
          to = stringField(action.territory);
        const quote = ambassadorPlacementQuote(g, p, token, to);
        g.pendingEcazPlacement = {
          token,
          territory: to,
          turn: g.turn,
          cost: quote.cost,
        };
        g.response = {
          kind: 'ecazPlacement',
          owner: id,
          passed: [],
          intent: `Place the ${faction(g.ecazAmbassadors.tokens.find((t) => t.id === token)!.effect).name} Ambassador in ${territory(to).name} for ${quote.cost} spice.`,
        };
        log(
          g,
          `${p.name} declared an Ambassador placement. No spice has been paid yet.`,
        );
      }
      return g;
    }
    if (decision.kind === 'moritaniRetention') {
      const pending = g.moritaniRetention;
      requireRule(
        pending?.stage === 'choose' &&
          pending.player === id &&
          pending.turn === g.turn &&
          g.phase === 6,
        'No alliance battle-card choice is pending for you.',
      );
      requireRule(
        action.keep === null ||
          (typeof action.keep === 'string' &&
            pending.eligible.includes(action.keep) &&
            p.hand.some((c) => c.id === action.keep)),
        'Keep one eligible played card, or explicitly keep none.',
      );
      if (action.keep === null) finishMoritaniRetention(g, null);
      else {
        pending.keep = action.keep as string;
        pending.stage = 'response';
        g.response = {
          kind: 'moritaniRetention',
          owner: pending.owner,
          passed: [],
        };
      }
      return g;
    }
    if (decision.kind === 'grummanCollection') {
      decideGrummanCollection(g, p, action);
      return g;
    }
    if (decision.kind === 'moritaniTerror') {
      decideTerror(g, p, action);
      return g;
    }
    if (decision.kind === 'moritaniSetup') {
      requireRule(
        g.status === 'setup' &&
          p.faction === 'moritani' &&
          p.reserves === 20 &&
          otherSetupComplete(g),
        'Moritani places its starting forces after the other factions finish setup.',
      );
      const to = stringField(action.territory);
      const sector = integer(action.sector, 0, 18, 'Sector');
      requireRule(
        TERRITORIES.some((t) => t.id === to) &&
          to !== MOBILE_STRONGHOLD &&
          validLocation(to, sector),
        'Choose a printed territory and sector.',
      );
      requireRule(
        g.players.every((player) => at(player, to) === 0),
        'Moritani must start in an unoccupied territory, including no advisors.',
      );
      place(p, to, sector, 6);
      p.reserves -= 6;
      log(
        g,
        `${p.name} placed six starting forces in ${territory(to).name}, sector ${sector}.`,
      );
      return g;
    }
    if (decision.kind === 'richeseAllyOpportunity') {
      requireRule(
        action.decline === true,
        'Offer a No-Field shipment or let your ally ship normally.',
      );
      log(
        g,
        `${p.name} passed the allied No-Field offer opportunity. Their ally may ship normally.`,
      );
      return g;
    }
    if (decision.kind === 'richeseAllyShipment') {
      const offer = g.richeseAllyOffer;
      requireRule(
        offer &&
          offer.recipient === id &&
          offer.owner === decision.owner &&
          action.event === offer.event,
        'This allied No-Field offer is no longer current.',
      );
      if (action.decline === true) {
        g.richeseAllyOffer = null;
        g.richeseAllyDeclined = { turn: g.turn, recipient: id };
        log(
          g,
          `${p.name} declined the allied No-Field offer. Shipment and token custody remain unchanged.`,
        );
      } else {
        requireRule(action.accept === true, 'Accept this offer or decline it.');
        const quote = alliedNoFieldQuote(g, offer);
        const elite = integer(
          action.elite ?? quote.eliteMin,
          quote.eliteMin,
          quote.eliteMax,
          'Elite forces',
        );
        g.pendingShipment = {
          turn: g.turn,
          player: id,
          territory: offer.territory,
          sector: offer.sector,
          amount: quote.amount,
          elite,
          cost: quote.cost,
          allyPayment: 0,
          advisors: quote.advisors,
          alliedNoField: offer,
        };
        // Verify the entire arrival continuation before the recipient commits.
        // Unsupported simultaneous reactions leave this offer declineable.
        const trial = structuredClone(g);
        commitShipment(trial, trial.pendingShipment!);
        g.richeseAllyOffer = null;
        g.response = { kind: 'richeseNoField', owner: offer.owner, passed: [] };
        log(
          g,
          `${p.name} accepted an allied No-Field shipment. Resolve the Richese power before payment, token reveal or arrival.`,
        );
      }
      return g;
    }
    if (decision.kind === 'moritaniPlacement') {
      requireRule(
        g.status === 'playing' &&
          g.phase === 8 &&
          p.faction === 'moritani' &&
          g.moritaniTerror &&
          g.moritaniTerror.placementTurn !== g.turn,
        'Place or relocate one Terror token during your Mentat opportunity.',
      );
      if (action.decline === true) {
        g.moritaniTerror.placementTurn = g.turn;
        log(g, `${p.name} passed the Terror placement opportunity.`);
        finishMoritaniPlacement(g);
      } else {
        const token = stringField(action.token);
        const to = stringField(action.territory);
        try {
          placeTerror(g.moritaniTerror, token, to, g.turn);
        } catch (error) {
          throw new RuleError(
            error instanceof Error
              ? error.message
              : 'Invalid Terror placement.',
          );
        }
        g.pendingMoritaniPlacement = { token, territory: to, turn: g.turn };
        g.response = { kind: 'moritaniPlacement', owner: id, passed: [] };
        log(g, `${p.name} declared a hidden Terror placement or relocation.`);
      }
      return g;
    }
    if (decision.kind === 'choamStorm') {
      requireRule(
        action.decline === true && g.stormResolution,
        'Continue the storm or declare Jubba Cloak.',
      );
      beginStormProtection(g);
      return g;
    }
    if (decision.kind === 'choamMovement') {
      requireRule(
        action.decline === true,
        'Allow the movement or declare Baliset.',
      );
      resumeChoamMovement(g);
      return g;
    }
    if (
      decision.kind === 'choamAudit' ||
      decision.kind === 'choamAuditPayment'
    ) {
      const pending = g.pendingAuditor;
      requireRule(
        pending &&
          action.event === pending.event &&
          action.event === decision.event,
        'This Auditor decision is stale or already completed.',
      );
      requireRule(
        Object.keys(action).every((key) =>
          ['type', 'event', 'audit', 'pay', 'count'].includes(key),
        ),
        'Choose only whether to audit or pay the current cancellation cost.',
      );
      if (decision.kind === 'choamAudit') {
        requireRule(
          typeof action.audit === 'boolean' &&
            action.pay === undefined &&
            action.count === undefined,
          'Choose whether to use the Auditor.',
        );
        if (!action.audit) finishAuditor(g, 'decline');
        else {
          pending.stage = 'response';
          g.response = {
            kind: 'choamAudit',
            owner: id,
            intent: pending.event,
            passed: [],
          };
          log(
            g,
            `${p.name} declared an Auditor inspection. Opposing Karama cancellation resolves before any inspection payment.`,
          );
        }
      } else {
        requireRule(
          typeof action.pay === 'boolean' && action.audit === undefined,
          'Pay the full cancellation cost or allow the audit.',
        );
        if (action.pay)
          requireRule(
            action.count === currentAuditCount(g),
            'The eligible-card count changed. Review the current full cancellation cost.',
          );
        else
          requireRule(
            action.count === undefined,
            'Allowing an audit does not submit a payment.',
          );
        finishAuditor(g, action.pay ? 'pay' : 'inspect');
      }
      return g;
    }
    if (decision.kind === 'strongholdCopy') {
      const b = g.battle;
      requireRule(
        b?.event === decision.event &&
          action.event === decision.event &&
          b.territory === MOBILE_STRONGHOLD &&
          !Object.keys(b.plans).length &&
          !b.strongholdCopy &&
          g.strongholdCards?.owners.hidden_mobile_stronghold === id,
        'Choose a copied Stronghold advantage for this exact battle before plans.',
      );
      const choices = strongholdCopyChoices(g, id);
      requireRule(
        typeof action.stronghold === 'string' &&
          decision.choices.includes(action.stronghold as StrongholdId) &&
          choices.includes(action.stronghold as StrongholdId),
        'Choose another stronghold you currently control.',
      );
      b.strongholdCopy = action.stronghold as StrongholdId;
      log(
        g,
        `${p.name} declared ${STRONGHOLD_CARDS.find((card) => card.id === b.strongholdCopy)!.name} as their copied mobile Stronghold advantage.`,
        { faction: p.faction, name: 'Stronghold advantage' },
      );
      beginBattlePowers(g);
      return g;
    }
    if (decision.kind === 'choamMentat') {
      requireRule(
        action.done === true && g.choamMentatPending && g.phase === 8,
        'Finish CHOAM’s Mentat opportunity before checking victory.',
      );
      g.choamMentatPending = false;
      victory(g);
      if (g.status === 'playing') completePhase(g);
      return g;
    }
    if (decision.kind === 'choamFreeRevival') {
      requireRule(
        action.decline === true,
        'Allow the free revival or play La La La.',
      );
      offerRevivalStop(g);
      return g;
    }
    if (decision.kind === 'choamBattleFunding') {
      requireRule(
        p.faction === 'choam' && g.advanced && g.phase === 6 && g.battle,
        'CHOAM battle funding is unavailable.',
      );
      pledgeAid(g, p, action.amount);
      battlePreparation(g, 'voice');
      combatResponses(g);
      return g;
    }
    if (
      decision.kind === 'choamMarket' ||
      decision.kind === 'choamTradeReply' ||
      decision.kind === 'choamTradeConfirm'
    ) {
      decideChoamMarket(g, decision, action);
    } else if (decision.kind === 'ixSetup') {
      requireRule(
        g.status === 'setup' && p.faction === 'ixians' && g.ixSetupCards,
        'Ixian starting-card selection is not available.',
      );
      const card = g.ixSetupCards.find((c) => c.id === action.card);
      requireRule(card, 'Choose one of the starting cards.');
      p.hand.push(card);
      const remainder = shuffle(g.ixSetupCards.filter((c) => c.id !== card.id));
      for (const other of g.players.filter((other) => other.id !== p.id)) {
        const dealt = remainder.shift();
        if (dealt) other.hand.push(dealt);
      }
      const harkonnen = byFaction(g, 'harkonnen');
      if (harkonnen) {
        const bonus = draw(g);
        if (bonus) harkonnen.hand.push(bonus);
      }
      g.ixSetupCards = null;
      log(
        g,
        `${p.name} selected a starting card. The other starting cards were shuffled and dealt privately.`,
      );
    } else if (decision.kind === 'ixAuction') {
      requireRule(
        g.ixAuction && p.faction === 'ixians',
        'The auction pool is not available.',
      );
      const card = g.ixAuction.cards.find((c) => c.id === action.card);
      requireRule(card, 'Choose a card from the auction pool.');
      requireRule(
        action.position === 'top' || action.position === 'bottom',
        'Return the card to the top or bottom of the deck.',
      );
      if (action.position === 'top') g.deck.unshift(card);
      else g.deck.push(card);
      const rest = g.ixAuction.cards.filter((c) => c.id !== card.id);
      g.ixAuctionKnown = { turn: g.turn, cards: [...rest] };
      g.ixAuction = null;
      setAuction(g, shuffle(rest));
      log(
        g,
        `${p.name} returned one card face down to the ${action.position} of the deck and shuffled the auction pool.`,
      );
    } else if (decision.kind === 'ixTechnology') {
      requireRule(
        g.advanced &&
          p.faction === 'ixians' &&
          g.auction &&
          g.ixTechnologyTurn !== g.turn,
        'Ixian auction substitution is not available.',
      );
      if (action.decline === true) offerAuctionPeek(g);
      else {
        const card = p.hand.find((c) => c.id === action.card);
        requireRule(
          card,
          'Choose one of your hand cards to offer for exchange.',
        );
        g.ixTechnologyTurn = g.turn;
        g.pendingIxTechnology = { card: card.id };
        g.response = { kind: 'ixTechnology', owner: p.id, passed: [] };
      }
    } else if (decision.kind === 'ixAllyCard') {
      const pending = g.pendingIxAlly;
      requireRule(
        pending && pending.player === p.id,
        'This purchased-card choice is not available.',
      );
      requireRule(
        typeof action.accept === 'boolean',
        'Keep or replace the purchased card.',
      );
      if (action.accept) {
        const ixians = byFaction(g, 'ixians');
        requireRule(
          ixians &&
            p.ally === ixians.id &&
            p.hand.some((c) => c.id === pending.card),
          'The purchased card and Ixian alliance must remain available.',
        );
        g.response = {
          kind: 'ixAllyCard',
          owner: ixians.id,
          recipient: p.id,
          passed: [],
        };
      } else {
        g.pendingIxAlly = null;
        continueAuctionSale(g, pending.free);
      }
    } else if (decision.kind === 'mobileStronghold') {
      requireRule(
        p.faction === 'ixians' && g.mobileStronghold,
        'Only Ixians place or move their stronghold.',
      );
      if (decision.placement) {
        const dest = stringField(action.location);
        const loc = splitLocation(dest);
        requireRule(
          TERRITORIES.some(
            (t) =>
              t.id === loc.territory &&
              t.sectors.includes(loc.sector) &&
              t.type !== 'stronghold',
          ) && location(loc.territory, loc.sector) === dest,
          'Point the stronghold at a sector in a non-stronghold territory.',
        );
        g.mobileStronghold.location = dest;
        log(
          g,
          `${p.name} placed the Hidden Mobile Stronghold at ${territory(loc.territory).name}, sector ${loc.sector}.`,
        );
        finishStorm(g);
      } else if (action.decline === true) beginStormTurn(g);
      else {
        const route = validateMobileMove(g, p, action.route, 3);
        g.pendingMobileMove = {
          player: p.id,
          route,
          collect: action.collect !== false,
        };
        g.response = {
          kind: 'mobileStronghold',
          owner: p.id,
          location: route.at(-1),
          passed: [],
        };
      }
    } else if (decision.kind === 'ixSubstitution') {
      const pending = g.pendingIxSubstitution!;
      if (action.decline === true) {
        g.pendingIxSubstitution = null;
        finishWinner(g, p, pending.territory, pending.cards);
      } else {
        const parse = (input: unknown, available: Record<string, number>) => {
          requireRule(
            input && typeof input === 'object' && !Array.isArray(input),
            'Choose sector counts for the substitution.',
          );
          return Object.fromEntries(
            Object.entries(input as Record<string, unknown>)
              .map(([key, value]) => {
                requireRule(
                  Object.hasOwn(available, key),
                  'Choose a sector in this battle.',
                );
                return [key, integer(value, 0, available[key], 'Forces')];
              })
              .filter(([, count]) => Number(count) > 0),
          ) as Record<string, number>;
        };
        const sources = pending.territory.startsWith('homeworld:')
          ? { [pending.territory]: combatArmy(g, p.id, pending.territory).normal }
          : Object.fromEntries(
          Object.entries(p.forces)
            .filter(
              ([key]) => splitLocation(key).territory === pending.territory,
            )
            .map(([key, count]) => [key, count - (p.elites?.forces[key] ?? 0)]),
        );
        pending.sources = parse(action.sources, sources);
        pending.recover = parse(action.recover, pending.losses);
        const sum = (counts: Record<string, number>) =>
          Object.values(counts).reduce((a, b) => a + b, 0);
        requireRule(
          sum(pending.sources) > 0 &&
            sum(pending.sources) === sum(pending.recover),
          'Exchange one surviving suboid for each cyborg lost in this battle.',
        );
        g.response = { kind: 'ixSubstitution', owner: id, passed: [] };
      }
    } else if (decision.kind === 'revivalStop') {
      requireRule(
        action.decline === true,
        'Allow the revival, or spend special Karama to prevent it.',
      );
      finishRevival(g);
    } else if (decision.kind === 'faceDance') {
      requireRule(
        typeof action.reveal === 'boolean',
        'Reveal a Face Dancer or decline.',
      );
      if (action.reveal) {
        const dancer = p.faceDancers?.find(
          (c) => !c.revealed && c.leader === decision.identity,
        );
        requireRule(
          dancer,
          'You do not have an unrevealed Face Dancer for that leader.',
        );
        const winner = getPlayer(g, decision.winner);
        const blocked = faceDanceReturnBlock(g, winner.id);
        requireRule(!blocked, blocked ?? 'This Face Dance return is unavailable.');
        const home = homeworldBattleLocation(g, decision.territory);
        requireRule(!home || home.native === p.id, 'Only the native faction may call a Face Dancer on a Homeworld.');
        const army = combatArmy(g, winner.id, decision.territory);
        const maximum = home ? army.normal + army.elite : at(winner, decision.territory);
        const sources = action.sources;
        requireRule(
          sources && typeof sources === 'object' && !Array.isArray(sources),
          'Choose reserves or board forces to replace the winner.',
        );
        const selected = Object.entries(sources).map(([key, value]) => {
          requireRule(
            key === 'reserves' || key in p.forces,
            'Choose your own reserves or occupied sectors.',
          );
          return {
            key,
            count: integer(
              value,
              0,
              key === 'reserves' ? p.reserves : p.forces[key],
              'Forces',
            ),
          };
        });
        const total = selected.reduce((sum, source) => sum + source.count, 0);
        requireRule(
          total <= maximum,
          'You cannot replace more forces than the winner has remaining.',
        );
        const sector = home ? 0 : integer(action.sector, 0, 18, 'Sector');
        requireRule(home || validLocation(decision.territory, sector), 'Choose a sector in the battle territory.');
        // This is replacement, not shipment or movement: no transport cost or worm/storm transit.
        for (const source of selected) {
          if (source.key === 'reserves') { if (!home) p.reserves -= source.count; }
          else {
            p.forces[source.key] -= source.count;
            if (!p.forces[source.key]) delete p.forces[source.key];
          }
        }
        if (home) {
          const destination = `homeworld:${winner.faction}`;
          const external = selected.filter((source) => source.key !== 'reserves').reduce((n, source) => n + source.count, 0);
          const quote = quoteHomeworldCustody(homeworldContext(g), g.homeworlds!.custody!, [
            { homeworld: home.id, player: winner.id, withdraw: army, deposit: {normal: 0, elite: 0} },
            { homeworld: destination, player: winner.id, withdraw: {normal: 0, elite: 0}, deposit: army },
            { homeworld: home.id, player: p.id, withdraw: {normal: 0, elite: 0}, deposit: {normal: external, elite: 0} },
          ]);
          g.homeworlds!.custody = quote.state;
          for (const update of quote.players) {
            const owner = getPlayer(g, update.id);
            owner.reserves = update.reserves;
            if (owner.elites) owner.elites.reserves = update.eliteReserves;
          }
        } else {
        for (const key of Object.keys(winner.forces).filter(
          (key) => splitLocation(key).territory === decision.territory,
        )) {
          winner.reserves += winner.forces[key];
          if (winner.elites) {
            winner.elites.reserves += winner.elites.forces[key] ?? 0;
            delete winner.elites.forces[key];
          }
          delete winner.forces[key];
        }
        }
        const leader = g.players
          .flatMap((player) => player.leaders)
          .find((l) => l.id === decision.leader);
        if (leader && !leader.dead) {
          leader.dead = true;
          leader.deaths++;
          delete leader.usedAt;
          delete leader.capturedBy;
          delete leader.concealed;
        }
        if (total && !home) place(p, decision.territory, sector, total);
        observeOccupation(g);
        dancer.revealed = true;
        log(
          g,
          `${p.name} revealed a Face Dancer and replaced ${total} forces in ${combatLocationName(g, decision.territory)}.`,
        );
        if (p.faceDancers!.every((c) => c.revealed)) {
          g.traitorReserve = shuffle([
            ...(g.traitorReserve ?? []),
            ...p.faceDancers!.map((c) => c.leader),
          ]);
          p.faceDancers = g.traitorReserve
            .splice(0, 3)
            .map((leader) => ({ leader, revealed: false }));
          log(g, `${p.name} drew three new Face Dancers.`);
        }
      }
      g.pendingFaceDance = null;
      const harkonnen = byFaction(g, 'harkonnen');
      if (harkonnen) returnCaptives(g, harkonnen);
      settleAdvisors(g);
      finishBattle(g);
    } else if (decision.kind === 'stoneBurner') {
      requireRule(
        Object.keys(action).every((key) =>
          ['type', 'event', 'mode'].includes(key),
        ),
        'Stone Burner needs only this battle event and a mode.',
      );
      requireRule(
        g.battle?.revealed &&
          action.event === decision.event &&
          action.event === g.battle.event,
        'Choose Stone Burner’s mode for this exact revealed battle.',
      );
      requireRule(
        action.mode === 'kill' || action.mode === 'ignore',
        'Choose to kill both leaders or ignore surviving leader strength.',
      );
      requireRule(
        isStoneBurner(cardOf(p, g.battle.plans[id]?.weapon)) &&
          !g.battle.stoneBurner?.[id],
        'Stone Burner’s mode is already chosen or its weapon is missing.',
      );
      (g.battle.stoneBurner ??= {})[id] = action.mode;
      log(
        g,
        `${p.name} chose Stone Burner: ${action.mode === 'kill' ? 'both participating leaders will be killed' : 'surviving leaders add no strength; other weapon attacks still apply'}. Undialed physical force tokens decide the ordinary battle; traitors and explosions retain precedence.`,
      );
      nextRevealedDecision(g);
    } else if (decision.kind === 'poisonTooth') {
      requireRule(
        g.battle?.revealed && typeof action.activate === 'boolean',
        'Choose whether to activate Poison Tooth.',
      );
      g.battle.poisonTooth ??= {};
      g.battle.poisonTooth[id] = action.activate;
      log(
        g,
        `${p.name} ${action.activate ? 'activated' : 'declined to activate'} Poison Tooth.`,
      );
      nextRevealedDecision(g);
    } else if (decision.kind === 'techToken') {
      requireRule(
        decision.choices.includes(action.token as TechId) &&
          g.techTokens?.[action.token as TechId]?.owner === decision.loser,
        'Choose one tech token controlled by the defeated faction.',
      );
      transferTech(g, action.token as TechId, id);
      g.pendingTech = null;
      finishBattle(g);
    } else if (decision.kind === 'fullPlanOffer') {
      requireRule(
        action.decline === true,
        'Decline the inspection, or spend the Atreides special Karama.',
      );
    } else if (decision.kind === 'fullPlanRead') {
      requireRule(
        action.continue === true,
        'Confirm that you have inspected the battle plan.',
      );
    } else if (decision.kind === 'homeworldShipmentGuild') {
      requireRule(action.allow === true && action.event === decision.event,
        'Allow this exact Homeworld declaration, or use the Guild special Karama.');
      const shipment = g.pendingHomeworldShipment;
      requireRule(shipment && decision.player === byFaction(g, 'guild')?.id &&
        decision.event === shipment.event && decision.shipper === shipment.player &&
        decision.destination === shipment.destination && decision.amount === shipment.amount,
        'The Guild decision no longer matches this Homeworld shipment.');
      commitHomeworldShipment(g, shipment);
    } else if (decision.kind === 'guildShipment') {
      requireRule(
        action.allow === true,
        'Allow the shipment, or play the Guild special Karama.',
      );
      const shipment = validateGuildShipmentDecision(g, decision);
      g.pendingShipment = null;
      commitShipment(g, shipment);
    } else if (decision.kind === 'nullentropy') {
      throw new RuleError(
        'No matching paid search was saved; restore the saved search before continuing.',
      );
    } else if (decision.kind === 'handExchange') {
      requireRule(
        Array.isArray(action.returnCards) &&
          action.returnCards.length === decision.count &&
          new Set(action.returnCards).size === decision.count &&
          action.returnCards.every(
            (id) => typeof id === 'string' && p.hand.some((c) => c.id === id),
          ),
        'Return exactly the required number of distinct cards from your hand.',
      );
      const target = getPlayer(g, decision.target);
      const returnIds = action.returnCards as string[];
      const returned = p.hand.filter((c) => returnIds.includes(c.id));
      p.hand = p.hand.filter((c) => !returnIds.includes(c.id));
      target.hand.push(...returned);
      requireRule(
        p.hand.length <= handLimit(p) &&
          target.hand.length <= handLimit(target),
        'The completed exchange must respect hand limits.',
      );
      const pending = g.pendingExchange!;
      g.pendingExchange = null;
      g.response = pending.response;
      g.decision = pending.decision;
      if (!g.response && g.decision?.kind === 'auctionPayment')
        recoverAuctionPayment(g, getPlayer(g, g.decision.player));
      log(g, `${p.name} returned ${decision.count} cards to ${target.name}.`);
    } else if (decision.kind === 'captureOffer') {
      requireRule(
        typeof action.accept === 'boolean',
        'Choose whether to capture a leader.',
      );
      if (action.accept)
        g.response = { kind: 'capture', owner: id, passed: [] };
      else {
        g.pendingCapture = null;
        finishBattle(g);
      }
    } else if (decision.kind === 'capturedLeader') {
      requireRule(
        action.mode === 'keep' || action.mode === 'execute',
        'Choose keep or execute for the captured leader.',
      );
      const owner = getPlayer(g, decision.owner),
        l = owner.leaders.find((l) => l.id === decision.leader)!;
      if (action.mode === 'execute') {
        l.dead = true;
        l.deaths = Math.max(2, l.deaths + 1);
        delete l.usedAt;
        delete l.capturedBy;
        p.spice += 2;
        log(g, `${p.name} executed a captive for 2 spice.`);
      } else {
        returnCaptives(g, p);
        log(
          g,
          `${p.name} ${l.capturedBy === id ? 'retained' : 'released'} the captive.`,
        );
      }
      finishBattle(g);
    } else if (decision.kind === 'guildTiming') {
      requireRule(
        typeof action.take === 'boolean',
        'Choose whether to ship and move now or wait.',
      );
      const inOrder = decision.next === id;
      if (action.take === inOrder) g.active = action.take ? id : decision.next;
      else if (g.guildTimingGranted) chooseGuildTiming(g, action.take);
      else
        g.response = {
          kind: 'guildTiming',
          owner: id,
          passed: [],
          take: action.take,
        };
    } else if (decision.kind === 'stormLosses') {
      const elite = integer(
        action.elite ?? decision.minElite,
        decision.minElite,
        decision.maxElite,
        'Elite casualties',
      );
      kill(g, p, decision.key, decision.amount, false, elite);
      if (decision.resume === 'storm') continueStorm(g);
    } else if (decision.kind === 'homeworldDefense') {
      const b = g.battle;
      requireRule(b?.revealed && b.territory.startsWith('homeworld:') && b.event === decision.event && action.event === decision.event &&
        [b.attacker, b.defender].includes(id) && !traitorVoters(g, b).includes(id) && !b.homeworldDefensePassed?.includes(id),
        'This Homeworld late-defense choice is no longer current.');
      requireRule(typeof action.use === 'boolean', 'Use Portable Snooper or decline its late-defense opportunity.');
      if (action.use) {
        const card = p.hand.find(isPortableSnooper);
        requireRule(card, 'The late defense needs your held Portable Snooper.');
        validatePortableSnooper(g, p, card.id, decision.event);
        (b.lateDefense ??= {})[id] = card.id;
        log(g, `${p.name} added Portable Snooper after the Homeworld battle plans were revealed.`, {faction: p.faction, name: 'Portable Snooper'});
      }
      (b.homeworldDefensePassed ??= []).push(id);
      advanceHomeworldReveal(g);
    } else if (decision.kind === 'homeworldExplosion') {
      homeworldBattleLossIntegrity(g);
  homeworldSubstitutionIntegrity(g);
  homeworldDefenseIntegrity(g);
  homeworldShipmentIntegrity(g);
      requireRule(action.event === decision.event, 'This Homeworld casualty choice belongs to a different battle.');
      const choice = decision.options[integer(action.choice, 0, decision.options.length - 1, 'Casualty choice')];
      settleHomeworldExplosion(g, choice, false);
    } else if (decision.kind === 'battleLosses') {
      const choice =
        decision.options[
          integer(
            action.choice,
            0,
            decision.options.length - 1,
            'Casualty choice',
          )
        ];
      settleWinnerCasualties(g, p, decision.territory, decision.cards, choice);
    } else if (decision.kind === 'auctionPayment') {
      normalKaramaAuction(g, p, true, action.karama === true);
      requireRule(
        typeof action.karama === 'boolean',
        'Choose spice payment or Karama.',
      );
      if (action.karama) {
        const card = karamaCard(g, p, action.card);
        requireRule(card, 'You do not hold a Karama card.');
        spendKarama(g, p, card, { kind: 'auctionPayment' });
      } else settleAuction(g, false);
    } else if (decision.kind === 'intrusion') {
      requireRule(
        typeof action.accept === 'boolean',
        'Choose whether to become advisors.',
      );
      const details = {
        advisorFollowup: decision.followup,
        advisorResume: decision.ambassadorEvent
          ? ('ambassador' as const)
          : decision.wormRide
            ? ('wormRide' as const)
            : undefined,
        advisorAmbassadorEvent: decision.ambassadorEvent,
      };
      if (action.accept)
        g.response = {
          kind: 'advisorFlip',
          owner: id,
          location: decision.territory,
          advisors: true,
          passed: [],
          ...details,
        };
      else finishAdvisorReaction(g, details);
    } else if (decision.kind === 'advisorBattle') {
      requireRule(
        typeof action.accept === 'boolean',
        'Choose whether to prepare advisors for battle.',
      );
      if (action.accept) {
        const to = stringField(action.territory);
        requireRule(
          decision.territories.includes(to) &&
            advisorBattleOptions(g).includes(to),
          'These advisors cannot prepare for battle.',
        );
        g.response = {
          kind: 'advisorFlip',
          owner: id,
          location: to,
          advisors: false,
          passed: [],
          advisorResume: 'declaration',
          advisorRemaining: decision.territories.filter((t) => t !== to),
        };
      } else movementTurn(g);
    } else if (decision.kind === 'advisor') {
      requireRule(
        typeof action.accept === 'boolean',
        'Choose whether to ship an advisor.',
      );
      if (decision.ambassadorEvent !== undefined) {
        const { order } = guildAmbassadorArrival(
          g,
          decision.ambassadorEvent,
          'advisor',
        );
        requireRule(
          decision.shipment === order.player &&
            p.faction === 'beneGesserit' &&
            p.id !== order.player,
          'This accompaniment does not belong to its Guild Ambassador shipment.',
        );
        if (action.accept) {
          const quote = guildAmbassadorRule(() =>
            quoteGuildAmbassadorAdvisor(g, p.id, order, action),
          );
          validateGuildAdvisorEntry(g, quote);
          g.response = {
            kind: 'advisor',
            owner: id,
            passed: [],
            location: location(quote.territory, quote.sector),
            amount: quote.amount,
            advisorResume: 'ambassador',
            advisorAmbassadorEvent: decision.ambassadorEvent,
          };
        } else {
          log(
            g,
            `${p.name} declined the free accompaniment to the Guild Ambassador shipment.`,
          );
          finishAmbassador(g);
        }
      } else if (action.accept) {
        const target =
          action.accompany === true && g.advanced
            ? decision.destination
            : 'polar_sink:0';
        requireRule(target, 'This shipment has no accompanying destination.');
        const dest = splitLocation(target);
        const amount = integer(action.amount === undefined ? 1 : action.amount, 1, spiritualAdvisorMaximum(g, p.id, dest.territory), 'Spiritual Advisor forces');
        if (
          g.advanced &&
          action.accompany === true &&
          action.sector !== undefined
        )
          dest.sector = integer(action.sector, 0, 18, 'Sector');
        const advisors = arrivalAsAdvisor(
          g,
          p,
          dest.territory,
          undefined,
          action.accompany === true,
        );
        allowedEntry(g, p, dest.territory, dest.sector, false, advisors);
        g.response = {
          kind: 'advisor',
          owner: id,
          passed: [],
          location: location(dest.territory, dest.sector),
          amount,
        };
      } else log(g, `${p.name} declined the free shipment.`);
    } else if (decision.kind === 'wormPlacement') {
      requireRule(
        typeof action.accept === 'boolean',
        'Choose whether to place the additional worm.',
      );
      if (action.accept) {
        const t = stringField(action.territory);
        requireRule(
          TERRITORIES.some((x) => x.id === t && x.type === 'sand'),
          'Additional worms must be placed in sand territory.',
        );
        g.response = {
          kind: 'wormPlacement',
          owner: id,
          location: t,
          passed: [],
        };
      } else continueSpice(g);
    } else if (decision.kind === 'wormProtection') {
      requireRule(
        typeof action.accept === 'boolean',
        'Choose whether to protect your ally.',
      );
      if (action.accept) {
        g.response = {
          kind: 'wormAllyProtection',
          owner: id,
          location: decision.territory,
          recipient: decision.ally,
          passed: [],
        };
      } else wormSurvival(g, decision.territory);
    } else if (decision.kind === 'wormRide') {
      requireRule(
        typeof action.accept === 'boolean',
        'Choose whether to ride Shai-Hulud.',
      );
      if (action.accept) {
        const to = stringField(action.territory);
        const sector = integer(action.sector, 0, 18, 'Sector');
        requireRule(
          to !== decision.territory,
          'Choose another destination territory.',
        );
        allowedEntry(g, p, to, sector);
        requireRule(
          action.forces &&
            typeof action.forces === 'object' &&
            !Array.isArray(action.forces),
          'Choose forces from the worm territory.',
        );
        let total = 0,
          totalElite = 0;
        for (const [key, value] of Object.entries(action.forces)) {
          const source = splitLocation(key);
          requireRule(
            source.territory === decision.territory &&
              validLocation(source.territory, source.sector),
            'Ride only from the territory where the worm appeared.',
          );
          const n = integer(value, 0, p.forces[key] ?? 0, 'Forces');
          if (!n) continue;
          requireRule(
            source.sector !== g.storm,
            'Forces cannot leave a sector in storm.',
          );
          const elite = eliteChoice(
            n,
            p.forces[key],
            p.elites?.forces[key] ?? 0,
            (action.eliteForces as Record<string, unknown> | undefined)?.[key],
          );
          removeGroup(p, [[key, n]], { [key]: elite });
          totalElite += elite;
          total += n;
        }
        requireRule(total > 0, 'Choose at least one force to ride.');
        place(p, to, sector, total, totalElite);
        log(
          g,
          `${p.name} rode Shai-Hulud with ${total} forces to ${territory(to).name}.`,
        );
        const intruded = intrusion(g, p, to, { wormRide: true });
        if (
          openTerritoryEntry(
            g,
            p,
            to,
            sector,
            total,
            totalElite,
            'wormRide',
            'wormRide',
          ) ||
          intruded
        )
          return g;
      } else log(g, `${p.name} declined the sandworm ride.`);
      nextWormRide(g);
    } else {
      requireRule(
        Array.isArray(action.discard) &&
          action.discard.every(
            (card) => typeof card === 'string' && decision.cards.includes(card),
          ),
        'You may discard only cards played in this battle.',
      );
      const selected = new Set<string>(action.discard);
      const context = selected.size
        ? cleanupBattleContext(g, decision.territory, p.id)
        : null;
      const discarded = [...selected].map((id) => ({
        card: discard(g, p, id, cleanupDiscardRole(g, p, id)),
        discardedBy: p.id,
        publicFace: true,
      }));
      log(
        g,
        `${p.name} discarded ${selected.size} of their played battle cards.`,
      );
      if (discarded.length)
        stageTreacheryDiscard(g, 'battle:winner', discarded, {
          kind: 'battleCleanup',
          event: context!.event,
          combatants: [...g.lastBattle],
          territory: decision.territory,
          player: p.id,
          source: 'winner',
          kept: decision.cards.filter((id) => !selected.has(id)),
          played: [...decision.cards],
        });
      else finishBattle(g);
    }
    return g;
  }
  if (g.status === 'lobby') {
    if (t === 'seatPosition') {
      requireRule(
        action.target === undefined || action.target === id,
        'You may choose only your own player circle.',
      );
      const position = integer(action.position, 1, 6, 'Player circle');
      const positions = normalizedPlayerPositions(g);
      requireRule(
        !g.players.some(
          (other) => other.id !== id && positions[other.id] === position,
        ),
        'That player circle is occupied.',
      );
      requireRule(
        positions[id] !== position,
        'You already occupy that player circle.',
      );
      positions[id] = position;
      g.playerPositions = positions;
      g.players.forEach((player) => (player.ready = !!player.bot));
      log(g, `${p.name} chose player circle ${position}.`);
      return g;
    }
    if (t === 'techTokens') {
      requireRule(id === g.host, 'Only the host can change optional rules.');
      requireRule(
        typeof action.enabled === 'boolean',
        'Choose whether to use tech tokens.',
      );
      g.techTokens = action.enabled ? createTechTokens() : null;
      g.players.forEach((p) => (p.ready = !!p.bot));
      return g;
    }
    if (t === 'homeworlds') {
      requireRule(id === g.host, 'Only the host can change optional rules.');
      requireRule(
        typeof action.enabled === 'boolean',
        'Choose whether to use Homeworlds.',
      );
      g.homeworlds = action.enabled ? { custody: null } : null;
      g.players.forEach((player) => (player.ready = !!player.bot));
      return g;
    }
    if (t === 'strongholdCards') {
      requireRule(id === g.host, 'Only the host can change optional rules.');
      requireRule(
        typeof action.enabled === 'boolean' && (!action.enabled || g.advanced),
        'Stronghold Cards require Advanced rules.',
      );
      g.strongholdCards = action.enabled ? createStrongholdCards() : null;
      g.players.forEach((player) => (player.ready = !!player.bot));
      return g;
    }
    if (t === 'addBot' || t === 'removeBot') {
      requireRule(id === g.host, 'Only the host can manage AI seats.');
      if (t === 'addBot') {
        const difficulty = stringField(action.difficulty);
        requireRule(
          ['Easy', 'Medium', 'Hard', 'Brutal'].includes(difficulty),
          'Choose an AI difficulty.',
        );
        const f = stringField(action.faction) as FactionId;
        requireRule(
          FACTIONS.some((x) => x.id === f),
          'Unknown faction.',
        );
        const bot = newPlayer(crypto.randomUUID(), `${faction(f).name} AI`, f);
        bot.bot = difficulty as NonNullable<Player['bot']>;
        joinGame(g, bot);
      } else {
        const target = getPlayer(g, stringField(action.target));
        requireRule(target.bot, 'Only an AI seat can be removed here.');
        g.players = g.players.filter((p) => p.id !== target.id);
        if (g.playerPositions) delete g.playerPositions[target.id];
        g.players.forEach((p) => (p.ready = false));
      }
      g.players.filter((p) => p.bot).forEach((p) => (p.ready = true));
      return g;
    }
    if (t === 'ready') {
      p.ready = !p.ready;
      return g;
    }
    if (t === 'start') {
      requireRule(id === g.host, 'Only the host can start the game.');
      start(g);
      return g;
    }
    if (t === 'faction') {
      const f = action.faction as FactionId;
      requireRule(
        FACTIONS.some((x) => x.id === f),
        'Unknown faction.',
      );
      requireRule(
        !g.players.some((x) => x.id !== id && x.faction === f),
        'That faction is taken.',
      );
      requireRule(
        faction(f).expansion === 'base' ||
          g.expansions.includes(faction(f).expansion),
        'That expansion is disabled.',
      );
      p.faction = f;
      p.elites =
        f === 'ixians'
          ? { reserves: 7, tanks: 0, forces: {}, revived: 0 }
          : undefined;
      p.leaders = leaders(f);
      g.players.forEach((x) => (x.ready = false));
      return g;
    }
    throw new RuleError('That action is not available in the lobby.');
  }
  if (g.status === 'setup') {
    if (g.setupStage) {
      const expected =
        g.setupStage === 'prediction'
          ? ['predict']
          : g.setupStage === 'traitors'
            ? ['traitor']
            : ['fremenSetup', 'advisorSetup'];
      requireRule(
        expected.includes(t) && setupPending(g).includes(id),
        `Wait for the current setup step: ${g.setupStage}.`,
      );
    }
    if (t === 'advisorSetup') {
      requireRule(
        g.advanced && p.faction === 'beneGesserit' && !p.advisorSetup,
        'Advisor setup is not available.',
      );
      requireRule(
        !byFaction(g, 'fremen') || byFaction(g, 'fremen')!.reserves === 10,
        'Wait for Fremen placement.',
      );
      const to = stringField(action.territory);
      const sector = integer(action.sector, 0, 18, 'Sector');
      requireRule(
        to !== MOBILE_STRONGHOLD && validLocation(to, sector),
        'Choose a printed board sector; the mobile stronghold is not yet placed.',
      );
      requireRule(
        p.reserves === 20,
        'Advisor setup requires the unplaced starting force.',
      );
      p.reserves--;
      place(p, to, sector, 1);
      p.advisors = { [to]: {} };
      p.advisorSetup = true;
      settleAdvisors(g);
    } else if (t === 'traitor') {
      requireRule(
        p.traitorChoices.includes(String(action.leader)),
        'Choose one of your dealt traitors.',
      );
      if (g.setupStage === 'traitors')
        (g.traitorReserve ??= []).push(
          ...p.traitorChoices.filter(
            (leader) => leader !== String(action.leader),
          ),
        );
      p.traitors = [String(action.leader)];
      p.traitorChoices = [];
    } else if (t === 'fremenSetup') {
      requireRule(
        p.faction === 'fremen' && p.reserves === 20,
        'Fremen setup is already complete.',
      );
      requireRule(
        action.placements &&
          typeof action.placements === 'object' &&
          !Array.isArray(action.placements),
        'Choose starting force placements.',
      );
      const placements = Object.entries(action.placements).map(
        ([key, value]) => {
          const loc = key.includes(':')
            ? splitLocation(key)
            : {
                territory: key,
                sector: FREMEN_START.includes(key)
                  ? territory(key).sectors[0]
                  : -1,
              };
          requireRule(
            FREMEN_START.includes(loc.territory) &&
              validLocation(loc.territory, loc.sector),
            'Starting forces belong in sectors of Sietch Tabr, False Wall South or False Wall West.',
          );
          return { ...loc, amount: integer(value, 0, 10, 'Starting forces') };
        },
      );
      requireRule(
        placements.reduce((sum, p) => sum + p.amount, 0) === 10,
        'Place exactly ten starting forces.',
      );
      let totalElite = 0;
      for (const loc of placements) {
        const key = location(loc.territory, loc.sector);
        const elite = integer(
          (action.elitePlacements as Record<string, unknown> | undefined)?.[
            key
          ] ?? 0,
          0,
          Math.min(loc.amount, p.elites?.reserves ?? 0),
          'Elite forces',
        );
        totalElite += elite;
        if (loc.amount) place(p, loc.territory, loc.sector, loc.amount, elite);
      }
      requireRule(
        totalElite <= (p.elites?.reserves ?? 0),
        'Too many elite forces in starting placements.',
      );
      if (p.elites) p.elites.reserves -= totalElite;
      p.reserves = 10;
    } else if (t === 'predict') {
      requireRule(
        p.faction === 'beneGesserit' && !p.prediction,
        'Prediction is already locked.',
      );
      requireRule(
        g.players.some((x) => x.faction === action.faction && x.id !== id),
        'Predict another faction in this game.',
      );
      p.prediction = {
        faction: action.faction as FactionId,
        turn: integer(action.turn, 1, 10, 'Turn'),
      };
    } else throw new RuleError('Complete the starting choices.');
    return g;
  }
  if (t === 'replaceFaceDancer') {
    requireRule(
      g.phase === 8 && p.faction === 'tleilaxu',
      'Replace a Face Dancer during Mentat Pause.',
    );
    requireRule(
      p.faceDancerReplacedTurn !== g.turn,
      'Only one Face Dancer replacement is permitted per turn.',
    );
    const dancer = p.faceDancers?.find(
      (c) => !c.revealed && c.leader === action.leader,
    );
    requireRule(dancer, 'Choose one of your unrevealed Face Dancers.');
    p.faceDancerReplacedTurn = g.turn;
    g.response = {
      kind: 'faceDancerReplacement',
      owner: id,
      passed: [],
      intent: dancer.leader,
    };
    return g;
  }
  if (t === 'choamInflation') {
    requireRule(
      g.phase === 8 && p.faction === 'choam',
      'CHOAM places Inflation during Mentat Pause.',
    );
    requireRule(
      !g.inflationUsed && !g.inflation,
      'The Inflation token is unavailable or already used.',
    );
    requireRule(
      g.inflationAttemptTurn !== g.turn,
      'Inflation placement was already attempted this Mentat Pause.',
    );
    requireRule(
      action.side === 'double' || action.side === 'cancel',
      'Choose Double or Cancel for next turn’s charity.',
    );
    g.inflationAttemptTurn = g.turn;
    g.response = {
      kind: 'choamInflation',
      owner: id,
      intent: action.side,
      passed: [],
    };
    g.ready = [];
    return g;
  }
  if (t === 'bribe') {
    requireRule(
      g.inflation?.side !== 'double',
      'Bribes are prohibited while Inflation shows Double.',
    );
    requireRule(
      g.phase !== 8,
      'Bribes cannot be made during the Mentat pause.',
    );
    const target = getPlayer(g, stringField(action.target));
    requireRule(
      target.id !== id && target.id !== p.ally,
      'Bribes are between different, non-allied factions.',
    );
    const n = integer(action.amount, 1, uncommittedSpice(g, p), 'Spice');
    p.spice -= n;
    target.bribes += n;
    log(
      g,
      `${p.name} promised ${n} spice to ${target.name}; collect it at the Mentat pause.`,
    );
    return g;
  }
  if (t === 'stormDial') {
    requireRule(
      g.phase === 0 && g.stormPending === null && g.stormDialers.includes(id),
      'You are not dialing the storm.',
    );
    requireRule(
      g.stormDials[id] === undefined,
      'Your storm dial is already locked.',
    );
    g.stormDials[id] = integer(
      action.amount,
      g.turn === 1 ? 0 : 1,
      g.turn === 1 ? 20 : 3,
      'Storm dial',
    );
    if (g.stormDialers.every((x) => g.stormDials[x] !== undefined)) {
      g.stormPending = Object.values(g.stormDials).reduce((a, b) => a + b, 0);
      g.ready = [];
      log(
        g,
        `Storm distance revealed: ${g.stormPending} sectors. Resolve storm cards before moving.`,
      );
    }
    return g;
  }
  if (t === 'alliance') {
    requireRule(
      g.phase === 1 && g.nexus && !g.spiceWindow && !g.spiceResolution,
      'Alliances change only during a Nexus.',
    );
    if (!action.target) {
      if (p.ally) getPlayer(g, p.ally).ally = null;
      p.ally = null;
      delete g.allianceOffers[id];
      log(g, `${p.name} is unallied.`);
    } else {
      const other = getPlayer(g, stringField(action.target));
      requireRule(other.id !== id, 'Choose another player.');
      const blocked = homeworldAllianceReason(g, id, other.id);
      requireRule(!blocked, blocked ?? 'This alliance is unavailable.');
      requireRule(
        !p.ally && !other.ally,
        'Break existing alliances before forming a new one.',
      );
      g.allianceOffers[id] = other.id;
      if (g.allianceOffers[other.id] === id) {
        p.ally = other.id;
        other.ally = id;
        p.allySinceTurn = other.allySinceTurn = g.turn;
        discardAllianceNexusCards(g, p, other);
        delete g.allianceOffers[id];
        delete g.allianceOffers[other.id];
        log(g, `${p.name} and ${other.name} formed an alliance.`);
      }
    }
    g.ready = [];
    return g;
  }
  if (t === 'charity') {
    const advancedBG = g.advanced && p.faction === 'beneGesserit';
    const quote = charityQuote(g, p);
    const amount = quote.total;
    requireRule(
      g.phase === 2 && amount > 0,
      'Charity is available here when you have fewer than two spice.',
    );
    requireRule(
      !byFaction(g, 'choam') || g.choamCharity?.turn === g.turn,
      'Resolve CHOAM income before claiming charity.',
    );
    requireRule(
      p.charityTurn !== g.turn,
      'Charity may be claimed only once per turn.',
    );
    p.charityTurn = g.turn;
    if (advancedBG && p.spice >= 2)
      g.response = {
        kind: 'bgCharity',
        owner: id,
        passed: [],
        amount,
        ...(g.homeworlds ? { charityHomeworld: quote.homeworld } : {}),
      };
    else payCharity(g, p, amount, quote.homeworld);
    log(g, `${p.name} claimed CHOAM charity.`);
    return g;
  }
  if (t === 'pledgeAid') {
    requireRule(
      ([3, 5].includes(g.phase) ||
        (g.phase === 6 && g.advanced && p.faction === 'choam')) &&
        p.ally,
      'You may fund an ally during bidding/shipment, or as advanced CHOAM during Battle.',
    );
    pledgeAid(g, p, action.amount);
    return g;
  }
  if (t === 'richeseBid') {
    const lot = g.richeseAuction;
    requireRule(
      g.phase === 3 && lot && !lot.outcome,
      'There is no open Richese auction.',
    );
    requireRule(p.hand.length < handLimit(p), 'Your hand is full.');
    requireRule(
      lot.source !== 'blackMarket' ||
        p.id !== lot.owner ||
        action.amount === null ||
        action.amount === 0,
      'A positive Black Market self-bid is awaiting a ruling on payment and sale counting.',
    );
    const amount =
      action.amount === null
        ? null
        : integer(action.amount, 0, Number.MAX_SAFE_INTEGER, 'Bid');
    const ownAvailable =
      uncommittedSpice(g, p) +
      richeseOwnCommitment(lot, g.richeseFunding ?? {}, p.id);
    const allyAvailable = aidFor(g, p)?.amount ?? 0;
    const allyPayment =
      amount === null
        ? 0
        : integer(
            action.allyPayment ?? Math.max(0, amount - ownAvailable),
            0,
            Math.min(amount, allyAvailable),
            'Ally payment',
          );
    if (amount !== null)
      validateRicheseFunding(amount, allyPayment, ownAvailable, allyAvailable);
    g.richeseAuction = submitRicheseBid(
      lot,
      { event: stringField(action.event), actor: p.id, amount },
      ownAvailable + allyAvailable,
    );
    if (amount !== null)
      (g.richeseFunding ??= {})[p.id] = {
        amount,
        allyPayment,
        donor: allyPayment ? p.ally : null,
      };
    g.active = g.richeseAuction.active;
    log(
      g,
      lot.method === 'silent'
        ? `${p.name} submitted a sealed bid; its amount remains concealed until every eligible bidder submits.`
        : `${p.name} ${amount === null ? 'passed' : `bid ${amount} spice`} in the ${lot.method === 'onceAround' ? 'Once Around' : 'Black Market'} auction.`,
    );
    if (lot.method === 'silent' && g.richeseAuction.outcome)
      log(
        g,
        `Silent bids revealed together: ${g.richeseAuction.tieOrder.map((id) => `${getPlayer(g, id).name} ${g.richeseAuction!.sealed[id]}`).join('; ')}. Ties are resolved in storm order.`,
      );
    settleRicheseLot(g);
    return g;
  }
  if (t === 'bid' || t === 'passBid') {
    requireRule(
      g.phase === 3 && g.auction?.active === id,
      'Wait for your bid.',
    );
    const a = g.auction;
    if (t === 'bid') {
      a.bid = integer(
        action.amount,
        a.bid + 1,
        karamaCard(g, p)
          ? Number.MAX_SAFE_INTEGER
          : p.spice + (aidFor(g, p)?.amount ?? 0),
        'Bid',
      );
      a.allyPayment =
        a.bid <= p.spice + (aidFor(g, p)?.amount ?? 0)
          ? contribution(g, p, a.bid, action.allyPayment)
          : 0;
      a.bidder = id;
      a.passed = [];
    } else if (!a.passed.includes(id)) a.passed.push(id);
    auctionNext(g);
    return g;
  }
  if (t === 'emperorGift' || t === 'emperorRevival') {
    requireRule(
      p.faction === 'emperor' && p.ally,
      'Only the Emperor may use this power for an ally.',
    );
    const recipient = getPlayer(g, p.ally);
    if (t === 'emperorRevival') {
      requireRule(
        !revivalPrevented(g, recipient.id),
        'Tleilaxu prevented this faction’s normal revivals for this turn.',
      );
      requireRule(
        g.phase === 4,
        'Extra revivals are available during Revival.',
      );
    }
    const maximum =
      t === 'emperorGift'
        ? uncommittedSpice(g, p)
        : Math.min(
            3 - (g.emperorExtra[recipient.id] ?? 0),
            recipient.tanks,
            Math.floor(uncommittedSpice(g, p) / 2),
          );
    const amount = integer(
      action.amount,
      1,
      maximum,
      t === 'emperorGift' ? 'Spice' : 'Forces',
    );
    const elite =
      t === 'emperorRevival'
        ? eliteChoice(
            amount,
            recipient.tanks,
            recipient.elites?.tanks ?? 0,
            action.elite,
          )
        : 0;
    requireRule(
      elite <= eliteRevivalRemaining(recipient, g.advanced),
      'Only one elite force may be revived per turn.',
    );
    if (t === 'emperorRevival')
      requireRule(
        p.spice >= paidForceRevivalCost(recipient, amount, elite),
        'Not enough spice for these extra revivals.',
      );
    g.response = {
      kind: t,
      elite,
      owner: id,
      recipient: recipient.id,
      amount,
      passed: [],
    };
    return g;
  }
  if (t === 'grantRevival') {
    requireRule(
      g.phase === 4 && p.faction === 'fremen' && p.ally,
      'Only Fremen may grant their ally free revival during revival.',
    );
    requireRule(
      !g.freeRevival.includes(p.ally),
      'Free revival has already been granted.',
    );
    g.freeRevival.push(p.ally);
    log(
      g,
      `${p.name} granted their ally up to three free force revivals this phase.`,
    );
    return g;
  }
  if (t === 'tleilaxuRevivalLimit' || t === 'tleilaxuAllyDiscount') {
    requireRule(
      g.phase === 4 && p.faction === 'tleilaxu',
      'Only Tleilaxu may grant revival benefits during Revival.',
    );
    g.revivalRules ??= newRevivalRules();
    if (t === 'tleilaxuRevivalLimit') {
      const target = getPlayer(g, stringField(action.target));
      requireRule(
        target.id !== id && !g.revivalRules.limitBlocked,
        'The expanded revival limit is unavailable.',
      );
      requireRule(
        !g.revivalRules.expanded.includes(target.id),
        'That faction already has permission to revive five forces.',
      );
      g.revivalRules.expanded.push(target.id);
      log(
        g,
        `${p.name} allowed ${target.name} to revive up to five forces this phase.`,
      );
    } else {
      requireRule(
        p.ally &&
          !g.revivalRules.discountBlocked &&
          g.revivalRules.allyDiscount !== p.ally,
        'The allied revival discount is unavailable or already granted.',
      );
      g.revivalRules.allyDiscount = p.ally;
      log(g, `${p.name} offered their ally half-price revival this phase.`);
    }
    return g;
  }
  if (
    t === 'requestLeaderRevival' ||
    t === 'quoteLeaderRevival' ||
    t === 'declineLeaderRevival' ||
    t === 'cancelLeaderRequest' ||
    t === 'acceptLeaderRevival'
  ) {
    const tleilaxu = byFaction(g, 'tleilaxu');
    requireRule(
      g.phase === 4 && tleilaxu,
      'Tleilaxu leader negotiations require the Revival phase.',
    );
    g.revivalRequests ??= {};
    if (t === 'cancelLeaderRequest') {
      delete g.revivalRequests[id];
      return g;
    }
    if (t === 'quoteLeaderRevival' || t === 'declineLeaderRevival') {
      requireRule(
        p.id === tleilaxu.id,
        'Only Tleilaxu may quote a revival price.',
      );
      const recipient = getPlayer(g, stringField(action.target)).id;
      const request = g.revivalRequests[recipient];
      requireRule(request, 'Wait for that faction to request a leader.');
      if (t === 'declineLeaderRevival') request.declined = true;
      else {
        request.price = integer(action.amount, 0, 1000000, 'Price');
        delete request.declined;
      }
      return g;
    }
    requireRule(
      p.id !== tleilaxu.id && !p.leaderRevived,
      'Only one negotiated leader revival is permitted per faction per phase.',
    );
    const requested =
      t === 'requestLeaderRevival'
        ? stringField(action.leader)
        : g.revivalRequests[id]?.leader;
    requireRule(requested, 'Request a leader first.');
    requireRule(
      !revivalPrevented(g, p.id),
      'Tleilaxu prevented this faction’s normal revivals for this turn.',
    );
    const buyback = p.leaders.some(
      (l) => l.id === requested && l.gholaBy === tleilaxu.id,
    );
    requireRule(
      buyback || p.leaders.some(nativeAvailable),
      'When all native leaders are unavailable, use ordinary revival rules.',
    );
    if (requested === 'kwisatz')
      requireRule(
        g.advanced && p.faction === 'atreides' && p.kwisatz?.dead,
        'Kwisatz Haderach is not in the tanks.',
      );
    else
      requireRule(
        p.leaders.some((l) => l.id === requested && l.dead && !l.capturedBy),
        'Choose one of your dead native leaders.',
      );
    requireRule(
      !g.revivalRules?.earlyBlocked.includes(`${p.id}:${requested}`),
      'Early revival of that leader was canceled this phase.',
    );
    if (t === 'requestLeaderRevival')
      g.revivalRequests[id] = { leader: requested, price: null };
    else {
      const price = g.revivalRequests[id]?.price;
      requireRule(
        !g.revivalRequests[id]?.declined,
        'That request was declined.',
      );
      requireRule(
        typeof price === 'number',
        'Wait for Tleilaxu to quote a price.',
      );
      requireRule(p.spice >= price, 'Not enough spice for the agreed revival.');
      beginRevival(g, {
        player: id,
        kind: requested === 'kwisatz' ? 'kwisatz' : 'leader',
        leader: requested,
        normalCost: price,
        cost: price,
        free: 0,
        checks: ['earlyRevival'],
      });
    }
    return g;
  }
  if (t === 'reviveForeignGhola') {
    requireRule(
      g.advanced && g.phase === 4 && p.faction === 'tleilaxu',
      'Foreign gholas require advanced Tleilaxu during Revival.',
    );
    const leader = g.players
      .flatMap((owner) => owner.leaders)
      .find((l) => l.id === action.leader);
    requireRule(
      leader &&
        leader.faction !== p.faction &&
        leader.dead &&
        !leader.capturedBy,
      'Choose a dead leader of another faction.',
    );
    requireRule(
      !isAuditorLeader(leader),
      'The Auditor cannot be acquired as a Tleilaxu foreign ghola.',
    );
    requireRule(
      controlledLeaders(g, p).filter((l) => !l.dead).length < 5,
      'Foreign gholas may fill your active leader pool only up to five.',
    );
    requireRule(
      p.gholaBlocked?.[leader.id] !== g.turn,
      'Reviving that foreign ghola was canceled this turn.',
    );
    const normalCost = leader.strength;
    const cost = revivalDiscount(g, p) ? Math.ceil(normalCost / 2) : normalCost;
    requireRule(p.spice >= cost, 'Not enough spice for this ghola.');
    beginRevival(g, {
      player: id,
      kind: 'foreignGhola',
      leader: leader.id,
      normalCost,
      cost,
      free: 0,
      checks:
        cost < normalCost
          ? ['foreignGhola', 'revivalDiscount']
          : ['foreignGhola'],
    });
    return g;
  }
  if (t === 'revive') {
    requireRule(g.phase === 4, 'Revival is not the current phase.');
    const n = integer(action.amount, 1, forceRevivalRemaining(g, p), 'Forces');
    const elite = eliteChoice(n, p.tanks, p.elites?.tanks ?? 0, action.elite);
    requireRule(
      elite <= eliteRevivalRemaining(p, g.advanced),
      'Only one elite force may be revived per turn.',
    );
    const availableFree = forceRevivalQuote(g, p, n).free;
    const freeElite =
      p.faction === 'ixians'
        ? integer(
            action.freeElite ?? Math.min(availableFree, elite),
            Math.max(0, availableFree - (n - elite)),
            Math.min(availableFree, elite),
            'Free cyborg revivals',
          )
        : 0;
    const quote = forceRevivalQuote(g, p, n, elite, freeElite);
    requireRule(quote.cost <= p.spice, 'Not enough spice for revival.');
    const checks: PendingRevival['checks'] = [];
    const choamBenefit = p.faction === 'choam' && !g.revivalRules?.choamBlocked;
    const uncancelableLimit = Math.max(3, freeRevivalRate(g, p));
    if (choamBenefit && (n > quote.free || p.revived + n > uncancelableLimit))
      checks.push('choamRevival');
    if (!choamBenefit && p.revived + n > uncancelableLimit)
      checks.push('revivalLimit');
    const factionCost = choamBenefit ? n - quote.free : quote.normalCost;
    if (quote.cost < factionCost) checks.push('revivalDiscount');
    beginRevival(g, {
      player: id,
      kind: 'forces',
      amount: n,
      elite,
      ...quote,
      checks,
    });
    return g;
  }
  if (t === 'reviveKwisatz' || t === 'reviveLeader') {
    requireRule(
      g.phase === 4 && (!p.leaderRevived || p.faction === 'tleilaxu'),
      'Only one leader revival is permitted this phase.',
    );
    requireRule(
      !revivalPrevented(g, p.id),
      'Tleilaxu prevented this faction’s normal revivals for this turn.',
    );
    const options = leaderRevivalOptions(g, p);
    p.revivalCycle = options.cycle;
    const l =
      t === 'reviveLeader'
        ? p.leaders.find((l) => l.id === action.leader)
        : undefined;
    if (t === 'reviveKwisatz')
      requireRule(
        g.advanced && p.faction === 'atreides' && p.kwisatz?.dead,
        'Kwisatz Haderach is not in the tanks.',
      );
    else
      requireRule(
        l?.dead && !l.capturedBy && !l.gholaBy,
        'Choose a dead leader.',
      );
    const option = options.leaders.find((option) => option.id === l?.id);
    const normal =
      t === 'reviveKwisatz' ? !!options.kwisatz : !!option && !option.early;
    requireRule(
      normal || p.faction === 'tleilaxu',
      'All leaders must die before a new revival cycle can begin.',
    );
    const checks: PendingRevival['checks'] = [];
    if (!normal) {
      requireRule(
        !g.revivalRules?.earlyBlocked.includes(`${id}:${l!.id}`),
        'Early revival of that leader was canceled this phase.',
      );
      checks.push('earlyRevival');
    }
    requireRule(
      t === 'reviveKwisatz' ? !!options.kwisatz : !!option,
      'That leader is unavailable for revival this phase.',
    );
    const normalCost = l?.strength ?? 2;
    const cost = revivalDiscount(g, p) ? Math.ceil(normalCost / 2) : normalCost;
    requireRule(p.spice >= cost, 'Not enough spice.');
    if (cost < normalCost) checks.push('revivalDiscount');
    beginRevival(g, {
      player: id,
      kind: t === 'reviveKwisatz' ? 'kwisatz' : 'leader',
      leader: l?.id,
      normalCost,
      cost,
      free: 0,
      checks,
    });
    return g;
  }
  if (t === 'revealNoField') {
    requireRule(
      p.faction === 'richese',
      'Only Richese controls the concealed token.',
    );
    const blocked = noFieldRevealBlock(g, p);
    requireRule(!blocked, blocked ?? 'Voluntary reveal is unavailable.');
    requireRule(
      action.event === p.noFieldEvent &&
        action.token === p.noField?.deployed?.tokenId,
      'This No-Field reveal selection is stale.',
    );
    revealPlayerNoField(g, p, 'voluntary');
    return g;
  }
  if (
    [
      'ship',
      'homeworldShip',
      'guildHomeworldShip',
      'junctionShip',
      'move',
      'emperorHomeworldMove',
      'endMovement',
      'guildShip',
    ].includes(t)
  ) {
    const richese = byFaction(g, 'richese');
    requireRule(
      !richese ||
        noFieldAllyOfferBlock(g, richese) ||
        (g.richeseAllyOpportunity?.turn === g.turn &&
          g.richeseAllyOpportunity.recipient === id),
      'Wait for Richese to offer or pass its allied shipment opportunity.',
    );
  }
  if (t === 'offerRicheseNoField') {
    const blocked = noFieldAllyOfferBlock(g, p);
    requireRule(
      !blocked,
      blocked ?? 'Allied No-Field shipment is unavailable.',
    );
    requireRule(
      action.event === p.noFieldEvent,
      'This No-Field token selection is stale.',
    );
    const offer: RicheseAllyOffer = {
      event: crypto.randomUUID(),
      owner: id,
      recipient: p.ally!,
      tokenId: stringField(action.token),
      tokenEvent: p.noFieldEvent!,
      territory: stringField(action.territory),
      sector: integer(action.sector, 0, 18, 'Sector'),
      payer: stringField(action.payer),
    };
    alliedNoFieldQuote(g, offer, offer.recipient === id);
    g.richeseAllyOffer = offer;
    g.richeseAllyOpportunity = { turn: g.turn, recipient: offer.recipient };
    g.decision = {
      kind: 'richeseAllyShipment',
      player: offer.recipient,
      owner: id,
    };
    g.ready = [];
    log(
      g,
      `${p.name} offered their ally a No-Field shipment. Its proposed token and destination remain private until shipment is declared.`,
    );
    return g;
  }
  if (t === 'offerJunctionTransport') {
    const option = junctionTransportWindow(g);
    requireRule(option && option.owner === id && option.canOffer,
      option?.blocked ?? 'Only high-population Junction can offer transport during another faction’s unused shipment.');
    requireRule(action.event === option.offerEvent && (action.rate === 'half' || action.rate === 'full') &&
      Object.keys(action).every((key) => ['type', 'event', 'rate'].includes(key)),
      'Choose half or full price for the current Junction opportunity.');
    g.junctionOffer = {event: crypto.randomUUID(), turn: g.turn, owner: id,
      recipient: option.recipient, rate: action.rate};
    log(g, `${p.name} offered ${getPlayer(g, option.recipient).name} ${action.rate}-price Junction transport for their current shipment. They may use the offer or choose their ordinary actions.`);
    return g;
  }
  if (t === 'junctionShip') {
    performJunctionTransport(g, p, action);
    return g;
  }
  if (t === 'homeworldShip' || t === 'guildHomeworldShip') {
    const route = t === 'guildHomeworldShip' ? 'arrakis' as const : undefined;
    const blocked = route ? guildHomeworldShipmentBlock(g, p) : homeworldShipmentBlock(g, p);
    requireRule(!blocked, blocked ?? 'Homeworld shipment is unavailable.');
    requireRule(Object.keys(action).every((key) => ['type', 'event', 'destination', 'sources', 'allyPayment'].includes(key)),
      'Choose explicit typed source groups and a Homeworld destination without concealed tokens.');
    requireRule(action.event === homeworldShipmentEvent(g, p, route), 'This Homeworld source selection is stale.');
    declareHomeworldShipment(g, p, {player: id, destination: stringField(action.destination),
      sources: action.sources as HomeworldShipmentIntent['sources'], ...(route ? {route} : {})}, action.allyPayment);
    return g;
  }
  if (t === 'ship') {
    requireRule(
      g.phase === 5 && g.active === id && !p.shipped,
      'You may ship once, before your movement.',
    );
    checkShipmentPromises(g, p, {
      territory: String(action.territory),
      amount: Number(action.amount),
    });
    const to = String(action.territory),
      s = integer(action.sector, 0, 18, 'Sector');
    const advisors = arrivalAsAdvisor(g, p, to);
    requireRule(
      to !== MOBILE_STRONGHOLD || p.faction === 'ixians',
      'Only Ixians may ship directly into the mobile stronghold.',
    );
    allowedEntry(g, p, to, s, g.advanced && p.faction === 'fremen', advisors);
    let noField: PendingShipment['noField'];
    if (action.noField !== undefined) {
      requireRule(
        p.faction === 'richese',
        'Only Richese may declare its own concealed No-Field shipment.',
      );
      const blocked = noFieldShipBlock(g, p);
      requireRule(!blocked, blocked ?? 'No-Field shipment is unavailable.');
      requireRule(
        action.event === p.noFieldEvent,
        'This No-Field selection is stale.',
      );
      const tokenId = stringField(action.noField);
      noFieldRule(() =>
        deployRicheseNoField(p.noField!, {
          tokenId,
          controller: id,
          location: { territory: to, sector: s },
        }),
      );
      requireRule(
        action.amount === undefined || action.amount === 1,
        'The shipment price is for one No-Field, not a chosen number of physical forces.',
      );
      requireRule(
        action.elite === undefined || action.elite === 0,
        'A concealed No-Field is not an elite force.',
      );
      noField = { tokenId, event: p.noFieldEvent! };
    }
    const n = noField ? 1 : integer(action.amount, 1, p.reserves, 'Forces');
    const elite = noField
      ? 0
      : eliteChoice(n, p.reserves, p.elites?.reserves ?? 0, action.elite);
    const cost = reserveShipmentCost(
      {
        faction: p.faction,
        halfRate:
          p.faction === 'guild' ||
          byFaction(g, 'guild')?.id === p.ally ||
          g.karamaShipping?.player === id,
      },
      territory(to).type,
      n,
    );
    if (p.faction === 'fremen') {
      requireRule(
        territory('the_great_flat').sectors.some((fs) =>
          territory(to).sectors.some(
            (ts) =>
              distance(location('the_great_flat', fs), location(to, ts)) <= 2,
          ),
        ),
        'Fremen reinforcements must arrive within two territories of the Great Flat.',
      );
    }
    requireRule(
      cost <= p.spice + (aidFor(g, p)?.amount ?? 0),
      'Not enough spice to ship those forces.',
    );
    const allyPayment = contribution(g, p, cost, action.allyPayment);
    const shipment: PendingShipment = {
      turn: g.turn,
      player: id,
      territory: to,
      sector: s,
      amount: n,
      elite,
      cost,
      allyPayment,
      advisors,
      ...(action.homeworldSources === undefined
        ? {}
        : {
            homeworldSources:
              action.homeworldSources as NativeReserveSelections,
          }),
      ...(noField ? { noField } : {}),
    };
    if (shipment.noField) {
      checkShipmentIncomeRounding(g, p, cost, allyPayment);
      g.pendingShipment = shipment;
      g.response = { kind: 'richeseNoField', owner: p.id, passed: [] };
      log(
        g,
        `${p.name} declared a concealed No-Field shipment to ${territory(to).name}, sector ${s}.`,
      );
    } else offerShipment(g, shipment);
    return g;
  }
  if (t === 'guildShip') {
    const homeworldTarget = action.territory ?? 'reserves';
    if (g.homeworlds?.custody && p.faction === 'guild' &&
        (homeworldTarget === 'reserves' || (typeof homeworldTarget === 'string' && homeworldTarget.startsWith('homeworld:')))) {
      const blocked = guildHomeworldShipmentBlock(g, p);
      requireRule(!blocked, blocked ?? 'Guild Homeworld shipment is unavailable.');
      requireRule(action.noField === undefined && (action.sector === undefined || action.sector === 0),
        'A Homeworld arrival has no planet sector or concealed token.');
      const group = forceGroup(p, action);
      const sources = Object.fromEntries(group.group.map(([key, amount]) => [key,
        {normal: amount - (group.eliteGroup[key] ?? 0), elite: group.eliteGroup[key] ?? 0}]));
      declareHomeworldShipment(g, p, {route: 'arrakis', player: id,
        destination: homeworldTarget === 'reserves' ? 'homeworld:guild' : homeworldTarget as string,
        sources}, action.allyPayment);
      return g;
    }
    checkShipmentPromises(
      g,
      p,
      action.from === 'reserves'
        ? { territory: String(action.territory), amount: Number(action.amount) }
        : null,
    );
    requireRule(
      action.noField === undefined,
      'Guild transport of a concealed No-Field awaits its specific return and custody rules.',
    );
    requireRule(
      g.phase === 5 &&
        g.active === id &&
        !p.shipped &&
        (p.faction === 'guild' || byFaction(g, 'guild')?.id === p.ally),
      'Guild shipment is not available.',
    );
    const fromReserves = action.from === 'reserves';
    requireRule(
      !fromReserves || p.faction === 'fremen',
      'Only allied Fremen may cross-ship from their southern reserves.',
    );
    const {
      group,
      eliteGroup,
      elite,
      origin,
      total: n,
    } = fromReserves
      ? {
          origin: 'reserves',
          group: [] as [string, number][],
          eliteGroup: {} as Record<string, number>,
          elite: eliteChoice(
            Number(action.amount),
            p.reserves,
            p.elites?.reserves ?? 0,
            action.elite,
          ),
          total: integer(action.amount, 1, p.reserves, 'Forces'),
        }
      : forceGroup(p, action);
    requireRule(
      group.every(([key]) => splitLocation(key).sector !== g.storm),
      'The source is in storm.',
    );
    const to = stringField(action.territory ?? 'reserves');
    const sector = integer(action.sector ?? 0, 0, 18);
    requireRule(
      to !== 'reserves' || p.faction === 'guild',
      'Only the Guild may ship forces back to reserves.',
    );
    const advisors = to !== 'reserves' && arrivalAsAdvisor(g, p, to);
    const sourceLock = p.advisors?.[origin]?.lockedTurn;
    requireRule(
      to === 'reserves' ||
        advisors ||
        sourceLock !== g.turn ||
        !g.players.some((other) => other.id !== id && at(other, to)),
      'New advisors cannot become fighters this turn.',
    );
    requireRule(
      to !== MOBILE_STRONGHOLD || p.faction === 'ixians',
      'Only Ixians may ship directly into the mobile stronghold.',
    );
    if (to !== 'reserves') allowedEntry(g, p, to, sector, false, advisors);
    const cost = guildShipmentCost(
      to === 'reserves' ? 'reserves' : territory(to).type,
      n,
    );
    requireRule(
      p.spice + (aidFor(g, p)?.amount ?? 0) >= cost,
      'Not enough spice.',
    );
    const allyPayment = contribution(g, p, cost, action.allyPayment);
    checkShipmentIncomeRounding(g, p, cost, allyPayment);
    payWithAlly(g, p, cost, allyPayment);
    const guild = byFaction(g, 'guild');
    const guildPayment = guildShipmentIncome({
      guild: guild?.id,
      shipper: id,
      ally: p.ally,
      cost,
      allyPayment,
      bankOnly: g.karamaShipping?.player === id,
    });
    if (guild && guildPayment > 0)
      g.response = guildPaymentResponse(g, guild.id, shipmentIncomeContributions(g, p, cost, allyPayment));
    if (fromReserves) {
      p.reserves -= n;
      if (p.elites) p.elites.reserves -= elite;
    } else removeGroup(p, group, eliteGroup);
    if (to === 'reserves') {
      p.reserves += n;
      if (p.elites) p.elites.reserves += elite;
    } else {
      place(p, to, sector, n, elite);
      if (advisors)
        (p.advisors ??= {})[to] = {
          lockedTurn:
            Math.max(sourceLock ?? 0, p.advisors?.[to]?.lockedTurn ?? 0) ||
            undefined,
        };
      else if (p.advisors) delete p.advisors[to];
    }
    observeOccupation(g);
    finishShipmentPromises(
      g,
      p,
      fromReserves ? { territory: to, amount: n } : null,
    );
    p.shipped = true;
    g.karamaShipping = null;
    log(g, `${p.name} used Guild transport for ${n} forces.`);
    if (to !== 'reserves') {
      intrusion(g, p, to);
      if (origin !== to)
        openTerritoryEntry(g, p, to, sector, n, elite, 'guildTransport');
    }
    return g;
  }
  if (t === 'emperorHomeworldMove') {
    const blocked = emperorHomeworldMoveBlock(g, p);
    requireRule(!blocked, blocked ?? 'Homeworld movement is unavailable.');
    requireRule(
      Object.keys(action).every((key) =>
        ['type', 'event', 'origin', 'normal', 'elite'].includes(key),
      ),
      'Choose only the source Homeworld and physical force types.',
    );
    requireRule(
      action.event === emperorHomeworldMoveEvent(g, p),
      'This Homeworld movement selection is stale.',
    );
    const quote = homeworldRule(() =>
      quoteEmperorHomeworldMove(
        {
          ...homeworldContext(g),
          status: g.status,
          phase: g.phase,
          currentPlayer: g.active,
          movesLeft: movesAllowed(g, p) - p.moved,
        },
        g.homeworlds!.custody!,
        id,
        {
          origin: stringField(action.origin) as EmperorHomeworld,
          forces: {
            normal: integer(action.normal, 0, 20, 'Normal forces'),
            elite: integer(action.elite, 0, 5, 'Sardaukar'),
          },
        },
      ),
    );
    g.homeworlds!.custody = quote.state;
    observeOccupation(g);
    finishShipmentPromises(g, p, null);
    p.shipped = true;
    p.moved++;
    const name = (world: string) =>
      world === 'homeworld:emperor' ? 'Kaitain' : 'Salusa Secundus';
    const shifts = quote.populations.after
      .filter((world) => world.native === id)
      .map(
        (world) =>
          `${name(world.location)} now has ${world.population} ${world.card === 'salusa_secundus' ? 'Sardaukar' : 'native reserves'} (${world.side} population)`,
      )
      .join('; ');
    log(
      g,
      `${p.name} moved ${quote.forces.normal} normal forces and ${quote.forces.elite} Sardaukar from ${name(quote.origin)} to ${name(quote.destination)}. This spends one movement and no spice; total reserves are unchanged. ${shifts}.`,
    );
    return g;
  }
  if (t === 'move') {
    if (action.noField !== undefined) {
      const blocked = homeworldRule(() => homeworldNoFieldMovementBlock(g, id));
      requireRule(!blocked, blocked ?? 'The No-Field cannot move.');
    }
    if (!p.shipped) checkShipmentPromises(g, p, null);
    requireRule(
      g.phase === 5 && g.active === id && p.moved < movesAllowed(g, p),
      'Your movement is not available.',
    );
    const {
      group,
      eliteGroup,
      elite,
      origin,
      total: n,
      noField,
      sourceKeys,
    } = forceGroup(p, action);
    const to = stringField(action.territory),
      s = integer(action.sector, 0, 18, 'Sector');
    const advisors = arrivalAsAdvisor(g, p, to, origin);
    const lockedTurn = p.advisors?.[origin]?.lockedTurn;
    requireRule(
      advisors ||
        lockedTurn !== g.turn ||
        !g.players.some((other) => other.id !== id && at(other, to)),
      'New advisors cannot become fighters this turn.',
    );
    const wantsFighters = advisors && action.fighters === true;
    requireRule(
      !wantsFighters ||
        (lockedTurn !== g.turn &&
          !at(p, to) &&
          (!(p.ally && at(getPlayer(g, p.ally), to)) ||
            sharesEcazOccupation(g, p, to))),
      'These advisors cannot flip to fighters on arrival.',
    );
    requireRule(
      !balisetPrevents(g, id, origin, to),
      'Baliset prevents movement into this CHOAM territory; shipment remains possible.',
    );
    allowedEntry(g, p, to, s, false, advisors && !wantsFighters);
    requireRule(
      sourceKeys.every((key) => key !== location(to, s)),
      'Choose a different destination.',
    );
    let flight = g.ornithopter?.player === id ? g.ornithopter : null;
    if (action.movementCard !== undefined) {
      const mode = action.ornithopter;
      requireRule(
        mode === 'range3' || mode === 'twoGroups',
        'Choose an Ornithopter movement mode.',
      );
      const blocked = ornithopterBlock(g, p, mode);
      requireRule(!blocked, blocked ?? 'Ornithopter cannot be played.');
      const card = p.hand.find((c) => c.id === action.movementCard);
      requireRule(
        card && richeseCardDefinition(card)?.card.effect === 'ornithopter',
        'Choose the canonical Ornithopter in your hand.',
      );
      const reserved = transferCardBlock(g, p, card);
      requireRule(!reserved, reserved ?? 'The card is committed.');
      requireRule(
        action.ornithopterEvent === undefined,
        'A new card movement cannot name an old event.',
      );
      flight = {
        event: crypto.randomUUID(),
        player: id,
        card,
        turn: g.turn,
        mode,
        startingMove: p.moved,
        completed: 0,
      };
      g.ornithopter = flight;
      p.hand = p.hand.filter((c) => c.id !== card.id);
      log(
        g,
        `${p.name} played Ornithopter: ${mode === 'range3' ? 'one group with a maximum three-territory route' : 'two different groups using normal movement'}. The card remains on the table until its use finishes.`,
      );
    } else if (flight)
      requireRule(
        action.ornithopterEvent === flight.event,
        'Use the current Ornithopter movement event.',
      );
    else
      requireRule(
        action.ornithopterEvent === undefined &&
          action.ornithopter === undefined,
        'No matching Ornithopter movement is active.',
      );
    requireRule(
      !flight || !isAdvisor(p, origin),
      'Advanced advisor use of the Ornithopter card awaits its ruling.',
    );
    const speed = flight?.mode === 'range3' ? 3 : movementRange(g, p, elite);
    requireRule(
      sourceKeys.every(
        (key) =>
          gameDistance(g, key, location(to, s), (k) =>
            pathBlocked(g, p, k, isAdvisor(p, origin)),
          ) <= speed,
      ),
      `That destination is blocked or more than ${speed} territories away.`,
    );
    const move: MovementOrder = {
      player: id,
      group,
      eliteGroup,
      elite,
      origin,
      total: n,
      to,
      sector: s,
      advisors,
      wantsFighters,
      lockedTurn,
      ...(noField ? { noField } : {}),
      ...(flight
        ? {
            ornithopterEvent: flight.event,
            ornithopterRange: flight.mode === 'range3',
          }
        : {}),
    };
    validateFlightSelection(g, p, move);
    if (
      !move.ornithopterRange &&
      p.faction === 'ixians' &&
      elite > 0 &&
      speed === 2 &&
      group.some(
        ([key]) =>
          gameDistance(g, key, location(to, s), (k) =>
            pathBlocked(g, p, k, isAdvisor(p, origin)),
          ) > 1,
      )
    ) {
      g.pendingIxMove = move;
      g.response = {
        kind: 'ixMovement',
        owner: id,
        location: location(to, s),
        amount: n,
        elite,
        passed: [],
      };
    } else if (
      !move.ornithopterRange &&
      p.faction === 'fremen' &&
      speed === 2 &&
      group.some(
        ([key]) =>
          gameDistance(g, key, location(to, s), (k) =>
            pathBlocked(g, p, k, isAdvisor(p, origin)),
          ) > 1,
      )
    ) {
      g.pendingFremenMove = { turn: g.turn, move: p.moved, order: move };
      g.response = {
        kind: 'fremenMovement',
        owner: id,
        location: location(to, s),
        amount: n,
        passed: [],
      };
    } else offerChoamMovement(g, move);
    return g;
  }
  if (t === 'endMovement') {
    finishShipmentPromises(g, p, null);
    requireRule(
      g.phase === 5 && g.active === id,
      'Wait for your movement turn.',
    );
    if (g.ornithopter?.player === id) finishOrnithopter(g, 'end');
    else finishMovementTurn(g, id);
    return g;
  }
  if (t === 'chooseBattle') {
    requireRule(
      g.phase === 6 && g.active === id && !g.battle,
      'Wait for your battle choice.',
    );
    const choice = battles(g).find(
      (b) =>
        b.attacker === id &&
        b.territory === action.territory &&
        b.defender === action.target,
    );
    requireRule(choice, 'Choose one of your unresolved battles.');
    g.auditorInsight = null;
    const noFieldPlayers = [choice.attacker, choice.defender].filter(
      (playerId) =>
        getPlayer(g, playerId).noField?.deployed?.location.territory ===
        choice.territory,
    );
    for (const playerId of noFieldPlayers)
      requireRule(
        Object.entries(getPlayer(g, playerId).forces).every(
          ([key, n]) => !n || splitLocation(key).territory !== choice.territory,
        ),
        'Mixed ordinary-force and No-Field battle dialing awaits a ruling. Reveal voluntarily before Battle while that option is available.',
      );
    const battleEvent = crypto.randomUUID();
    g.battle = {
      ...choice,
      event: battleEvent,
      ...(byFaction(g, 'richese')
        ? { preLeader: { event: battleEvent, ready: [], closed: false } }
        : {}),
      ...(noFieldPlayers.length ? { noFieldPlayers } : {}),
      prepared: true,
      plans: {},
      revealed: false,
      traitorCalls: {},
    };
    beginStrongholdBattle(g);
    log(
      g,
      `${p.name} attacks ${getPlayer(g, choice.defender).name} in ${combatLocationName(g, choice.territory)}.`,
    );
    return g;
  }
  if (t === 'declineBattlePower') {
    const b = g.battle;
    requireRule(
      b?.preparation?.owner === id && !['prescienceAnswer', 'nexusPrescienceAnswer'].includes(b.preparation.kind),
      'You do not own this battle power decision.',
    );
    const kind = b.preparation.kind;
    if (kind === 'voice') battlePreparation(g, 'prescience');
    else finishBattlePreparation(g);
    log(
      g,
      `${p.name} declined ${kind === 'voice' ? 'the Voice' : 'battle prescience'}.`,
    );
    return g;
  }
  if (t === 'prescience') {
    const b = g.battle;
    requireRule(
      b?.preparation?.kind === 'prescience' && b.preparation.owner === id,
      'Prescience is not available. The Voice decision must finish first.',
    );
    requireRule(
      ['leader', 'weapon', 'defense', 'dial'].includes(String(action.field)),
      'Choose a battle-plan element.',
    );
    const beneficiary = b.preparation.beneficiary;
    const target = beneficiary === b.attacker ? b.defender : b.attacker;
    requireRule(
      action.field !== 'dial' || !b.noFieldPlayers?.includes(target),
      'Atreides may not inspect the number dialed in a No-Field battle.',
    );
    b.prescience = { player: beneficiary, field: action.field as PlanField };
    b.preparation = {
      kind: 'prescienceAnswer',
      owner: beneficiary === b.attacker ? b.defender : b.attacker,
      beneficiary,
    };
    g.response = { kind: 'prescience', owner: id, passed: [] };
    return g;
  }
  if (t === 'nexusPrescienceAnswer') {
    const b = g.battle, record = b?.nexusInspection;
    requireRule(b?.preparation?.kind === 'nexusPrescienceAnswer' &&
      b.preparation.owner === id && record?.stage === 'answer' && record.target === id &&
      action.event === record.event && Object.keys(action).sort().join(',') === 'event,type,value',
    'This Nexus answer does not match your current inspection.');
    requireRule(record.mode !== 'cunning' || record.field !== 'dial' || !b.noFieldPlayers?.includes(id),
      'Atreides may not inspect the number dialed in a No-Field battle.');
    const value = record.field === 'dial'
      ? typeof action.value === 'number' ? action.value : NaN
      : action.value === null || action.value === '' ? null : stringField(action.value);
    answerCurrentNexusInspection(g, value);
    return g;
  }
  if (t === 'prescienceAnswer') {
    const b = g.battle;
    requireRule(
      b?.preparation?.kind === 'prescienceAnswer' &&
        b.preparation.owner === id &&
        b.prescience,
      'You are not revealing a prescience element.',
    );
    requireRule(
      b.prescience.field !== 'leader' || !b.preLeader || b.preLeader.closed,
      'Both combatants must finish their shared preparation before leaders are committed.',
    );
    const field = b.prescience.field;
    requireRule(
      field !== 'dial' || !b.noFieldPlayers?.includes(id),
      'Atreides may not inspect the number dialed in a No-Field battle.',
    );
    const value =
      field === 'dial'
        ? g.advanced || p.faction === 'ixians'
          ? typeof action.value === 'number'
            ? action.value
            : NaN
          : integer(action.value, 0, (combatArmy(g, p.id, b.territory).normal + combatArmy(g, p.id, b.territory).elite), 'Forces dialed')
        : action.value === null || action.value === ''
          ? null
          : stringField(action.value);
    requireRule(
      feasiblePrescience(g, p, field, value),
      'Choose an element that permits a legal battle plan and obeys the Voice.',
    );
    if (b.nexusInspection?.mode === 'cunning')
      b.nexusInspection = nexusRule(() => answerNexusNative(battleInspectionContext(g), b.nexusInspection!, value));
    b.prescience.value = value;
    finishInspectionAnswers(g);
    return g;
  }
  if (t === 'voice') {
    const b = g.battle;
    requireRule(
      b?.preparation?.kind === 'voice' && b.preparation.owner === id,
      'Voice must be chosen by Bene Gesserit before prescience and battle plans.',
    );
    requireRule(
      VOICE_KINDS.includes(String(action.kind)),
      'Choose a card type.',
    );
    requireRule(typeof action.must === 'boolean', 'Choose require or forbid.');
    if (action.kind === 'stoneBurner' && action.must) {
      const target = getPlayer(
        g,
        b.attacker === b.preparation.beneficiary ? b.defender : b.attacker,
      );
      const blocked = stoneCompulsionBlock(g, target);
      requireRule(
        !blocked,
        blocked ?? 'Stone Burner cannot be compelled in this battle.',
      );
    }
    b.voice = {
      target:
        b.attacker === b.preparation.beneficiary ? b.defender : b.attacker,
      kind: action.kind as NonNullable<Battle['voice']>['kind'],
      must: action.must,
    };
    battlePreparation(g, 'prescience');
    g.response = { kind: 'voice', owner: id, passed: [] };
    return g;
  }
  if (t === 'battlePlan') {
    const b = g.battle;
    requireRule(
      !b?.preLeader || b.preLeader.closed,
      'Both combatants must finish their shared preparation before leaders are committed.',
    );
    requireRule(
      b &&
        !b.preparation &&
        !b.revealed &&
        [b.attacker, b.defender].includes(id) &&
        !b.plans[id],
      'Your battle plan is not available.',
    );
    requireRule(
      !b.fullPlan || b.plans[b.fullPlan.target] || id === b.fullPlan.target,
      'Wait for the plan requested by special prescience.',
    );
    b.plans[id] = validatePlan(g, p, action);
    if (b.fullPlan?.target === id) {
      recordFullPlanInspection(g, b.fullPlan.owner);
      return g;
    }
    if (b.plans[b.attacker] && b.plans[b.defender]) {
      for (const playerId of b.noFieldPlayers ?? []) {
        const owner = getPlayer(g, playerId);
        if (owner.noField?.deployed?.location.territory === b.territory)
          revealPlayerNoField(g, owner, 'battle');
      }
      b.revealed = true;
      for (const plan of Object.values(b.plans)) {
        const l = g.players
          .flatMap((p) => p.leaders)
          .find((l) => l.id === plan.leader);
        if (l?.capturedBy) delete l.concealed;
      }
      log(g, 'Both battle plans are revealed.');
      nextRevealedDecision(g);
    }
    return g;
  }
  if (t === 'traitorCall') {
    const b = g.battle;
    requireRule(
      b?.revealed &&
        traitorVoters(g, b).includes(id) &&
        b.traitorCalls[id] === undefined,
      'Traitor decision is not available.',
    );
    requireRule(typeof action.call === 'boolean', 'Choose reveal or decline.');
    if (g.nexusCards?.cards) ensureTraitorDeclarations(g);
    if (action.call) {
      const other =
        b.attacker === traitorBeneficiary(g, b, id) ? b.defender : b.attacker;
      requireRule(
        !b.plans[other].kwisatz,
        'Kwisatz Haderach prevents this leader from turning traitor.',
      );
      requireRule(
        matchingTraitor(
          p.traitors,
          b.plans[other].leader,
          cardOf(getPlayer(g, other), b.plans[other].leader),
        ),
        'You do not hold that leader as a traitor.',
      );
    }
    if (action.call && b.traitorDeclarationVersion)
      b.traitorDeclarations![id] = nexusRule(() => createTraitorDeclaration(traitorDeclarationContext(g), id));
    b.traitorCalls[id] = action.call;
    if (
      action.call &&
      p.faction === 'harkonnen' &&
      ![b.attacker, b.defender].includes(id)
    ) {
      g.response = { kind: 'harkonnenTraitor', owner: id, passed: [] };
      return g;
    }

    if (
      traitorVoters(g, b).every((voter) => b.traitorCalls[voter] !== undefined)
    )
      if (!b.territory.startsWith('homeworld:')) resolveBattle(g);
      else advanceHomeworldReveal(g);
    return g;
  }
  if (t === 'card') {
    const c = p.hand.find((c) => c.id === action.card);
    requireRule(
      c && (c.kind === 'special' || canUseAsKarama(g.advanced, p.faction, c)),
      'Select a special card in your hand.',
    );
    if (
      canUseAsKarama(g.advanced, p.faction, c) &&
      action.mode === 'shipment'
    ) {
      const recipient = getPlayer(g, stringField(action.target ?? id));
      requireRule(
        g.phase === 5 && g.active === recipient.id && !recipient.shipped,
        'Choose the active player before their shipment.',
      );
      requireRule(
        !g.karamaShipping,
        'A Karama shipment benefit is already available.',
      );
      spendKarama(g, p, c, { kind: 'shipment', recipient: recipient.id });
      return g;
    }
    if (
      canUseAsKarama(g.advanced, p.faction, c) &&
      action.mode === 'purchase'
    ) {
      requireRule(
        g.phase === 3 && g.auction && p.hand.length < handLimit(p),
        'You may take the current auction card only when eligible to bid.',
      );
      spendKarama(g, p, c, { kind: 'purchase' });
      return g;
    }
    if (c.effect === 'thumper') {
      requireRule(
        g.phase === 1 &&
          !g.spiceSequence &&
          !g.spiceResolution &&
          !g.spiceWindow &&
          !g.nexus,
        'Use Thumper at the beginning of Spice Blow, before the first draw.',
      );
      discard(g, p, c.id);
      log(
        g,
        `${p.name} played Thumper in place of the next spice-card reveal.`,
      );
      blowSpice(g, true);
      return g;
    }
    const availability = ordinaryCardAvailability(
      {
        status: g.status,
        phase: g.phase,
        active: g.active,
        me: id,
        truthtrance: g.truthtrance,
        phaseOpening: g.phaseOpening,
        response: g.response,
        decision: g.decision,
        shieldWallDestroyed: g.shieldWallDestroyed,
        spiceWindow: g.spiceWindow,
        players: [
          {
            id: p.id,
            faction: p.faction,
            forces: p.forces,
            advisors: p.advisors,
            hand: p.hand,
            movesAllowed: movesAllowed(g, p),
          },
        ],
      },
      c.id,
      { amount: action.amount },
    );
    if (availability && !availability.available)
      throw new RuleError(availability.reason);
    if (c.effect === 'hajr') {
      requireRule(
        g.ornithopter?.player !== id,
        'Hajr combined with Ornithopter awaits its timing ruling.',
      );
      g.hajr.push(id);
    } else if (c.effect === 'ghola') {
      applyGholaEffect(g, p, action, c.id);
    } else if (c.effect === 'harvester') {
      const blow = g.spiceWindow!;
      if (blow.sector !== g.storm) {
        const key = location(blow.territory, blow.sector);
        g.spice[key] = (g.spice[key] ?? 0) + blow.amount;
      }
      blow.amount *= 2;
      blow.harvested = true;
      blow.harvesters = (blow.harvesters ?? 0) + 1;
      g.ready = [];
    } else if (c.effect === 'weather') {
      // The shared availability check validated this exact numeric selection.
      g.stormPending = action.amount as number;
      g.ready = [];
    } else if (c.effect === 'atomics') {
      g.shieldWallDestroyed = true;
      for (const other of g.players) killTerritory(g, other, 'shield_wall');
      g.ready = [];
    } else
      throw new RuleError(
        'This card’s timing and effect are still being implemented.',
      );
    const used = discard(g, p, c.id);
    log(
      g,
      `${p.name} played ${c.name}.`,
      c.effect === 'ghola'
        ? { faction: p.faction, name: 'Ghola revival' }
        : undefined,
    );
    // Shipment feasibility executes deterministic preparations on private clones.
    // Its internal mode never comes from the submitted action or player state.
    if (execution === 'live') stageOrdinaryCardDiscard(g, p, used);
    return g;
  }
  if (t === 'ready') {
    requireRule(
      [1, 2, 4, 7, 8].includes(g.phase) ||
        (g.phase === 0 && g.stormPending !== null),
      'Complete the current phase action first.',
    );
    requireRule(!g.ready.includes(id), 'You are already ready.');
    g.ready.push(id);
    if (g.ready.length === g.players.length) {
      if (g.phase === 0) moveStorm(g, g.stormPending!);
      else if (g.phase === 1 && g.spiceWindow) finishSpiceWindow(g);
      else if (g.phase === 1 && (!g.nexus || g.summonedBeforeBlow))
        blowSpice(g);
      else if (g.phase === 1) nextWormRide(g);
      else nextPhase(g);
    }
    return g;
  }
  throw new RuleError('That action is not available.');
}
export function viewGame(state: Game, id: string) {
  marketGholaIntegrity(state);
  homeworldRule(() => homeworldGameIntegrity(state));
  homeworldBattleLossIntegrity(state);
  homeworldSubstitutionIntegrity(state);
  homeworldDefenseIntegrity(state);
  homeworldShipmentIntegrity(state);
  karamaConversionIntegrity(state);
  treacheryDiscardIntegrity(state);
  shipmentPromiseIntegrity(state);
  saphoMovementIntegrity(state);
  ambassadorRelocationIntegrity(state);
  ecazCollectionIntegrity(state);
  ecazAllianceIntegrity(state);
  const g = structuredClone(state);
  normalizeCardNames(g);
  settleAdvisors(g);
  normalizeBattle(g);
  const me = getPlayer(g, id);
  let victoryProgress: StrongholdProgress[] = [];
  if (g.status === 'playing' || g.status === 'finished') {
    try {
      victoryProgress = strongholdProgress(state).progress;
    } catch (error) {
      // A malformed restored board has no reliable preview. Authoritative
      // victory still rejects it through its strict quote.
      if (!(error instanceof VictoryProgressError)) throw error;
    }
  }
  const leaderRevivals = leaderRevivalOptions(g, me);
  const b = g.battle;
  const completion =
    !g.pendingTreacheryDiscard &&
    b &&
    !b.revealed &&
    !b.plans[id] &&
    [b.attacker, b.defender].includes(id) &&
    (b.truthPromises?.some(
      (promise) => promise.player === id && !promise.released,
    ) ||
      committedPlanElements(b, id).length > 0)
      ? findReachableBattlePlan(g, me)
      : null;
  return {
    ecazPoisonIncome: (g.ecazPoisonIncome ?? []).filter((income) => income.player === id)
      .map(({turn, phase, amount, count}) => ({turn, phase, amount, count})),
    biddingEnd: g.biddingEnd ? { event: g.biddingEnd.event,
      owners: [...g.biddingEnd.owners], ready: [...g.biddingEnd.ready],
      canAct: biddingEndQuiet(g) && g.biddingEnd.owners.includes(id), kaitain: { owner: byFaction(g, 'emperor')!.id,
        eligible: homeworldRule(() => highKaitainDiscardsAvailable(g, byFaction(g, 'emperor')!.id)) } } : null,
    combatLocations: combatLocations(g),
    battleChoices: g.status === 'playing' && g.phase === 6 ? quoteCombatBoard(g).battles : [],
    guildAmbassadorAdvisorChoices: guildAdvisorChoices(g, id),
    truthShipmentAnswers:
      g.truthtrance?.stage === 'answer' &&
      g.truthtrance.question?.target === id &&
      g.truthtrance.question.kind === 'shipment'
        ? shipmentTruthAnswers(g, me, g.truthtrance.question)
        : null,
    shipmentPromises: g.shipmentPromises ?? [],
    shipmentCompletion:
      !g.pendingTreacheryDiscard &&
      liveShipmentPromises(g.shipmentPromises ?? [], id, g.turn).some(
        (p) => p.answer,
      )
        ? findShipmentCompletion(g, me)
        : null,
    truthBattleAnswers:
      g.truthtrance?.stage === 'answer' &&
      g.truthtrance.question?.target === id &&
      g.truthtrance.question.kind === 'battlePlan'
        ? battleTruthAnswers(g, me, g.truthtrance.question.claim)
        : null,
    truthtrance: g.truthtrance ?? null,
    truthHistory: g.truthHistory ?? [],
    truthAnswer:
      g.truthtrance?.stage === 'answer' &&
      g.truthtrance.question?.target === id &&
      g.truthtrance.question.kind === 'fact'
        ? truthFactAnswer(me, g.truthtrance.question.fact)
        : null,
    schema: g.schema,
    botsPending: g.botsPending ?? false,
    automaticContinuationPending: !!g.pendingTreacheryDiscard || homeworldRevealPending(g) || homeworldShipmentAutomatic(g) || grummanCollectionAutomatic(g),
    botNextActionAt: g.botNextActionAt ?? null,
    code: g.code,
    version: g.version,
    host: g.host,
    status: g.status,
    setupStage: g.status === 'setup' ? (g.setupStage ?? null) : null,
    setupPending: setupPending(g),
    advanced: g.advanced,
    dukeVidal: g.dukeVidal
      ? { ...g.dukeVidal, leader: projectLeader(g, g.dukeVidal.leader, id) }
      : null,
    moritaniTerror: g.moritaniTerror
      ? projectTerror(g.moritaniTerror, me.faction === 'moritani')
      : null,
    moritaniPendingPlacement:
      me.faction === 'moritani' ? (g.pendingMoritaniPlacement ?? null) : null,
    grummanCollection: projectedGrummanCollection(g, id),
    tupileIntelligence: projectedTupileIntelligence(g, id),
    terrorEntry: g.pendingTerrorEntry
      ? (() => {
          const entry = g.pendingTerrorEntry!;
          const token = g.moritaniTerror?.tokens.find(
            (t) => t.id === entry.token,
          );
          return {
            entrant: entry.entrant,
            territory: entry.territory,
            sector: entry.sector,
            cause: entry.cause,
            stage: entry.stage,
            ...(me.faction === 'moritani' && entry.stage === 'select'
              ? { candidates: entry.candidates!.map((id) => {
                const candidate = g.moritaniTerror!.tokens.find((t) => t.id === id)!;
                return { token: id, kind: candidate.kind, canReveal: !terrorRevealBlocked(g, entry, candidate.kind),
                  canOfferAlliance: !terrorAllianceBlocked(g, entry, candidate.kind),
                  revealBlocked: terrorRevealBlocked(g, entry, candidate.kind) ?? undefined };
              }) } : {}),
            ...(me.faction === 'moritani' && token && entry.stage !== 'select'
              ? {
                  kind: token.kind as TerrorKind,
                  canOfferAlliance: !terrorAllianceBlocked(
                    g,
                    entry,
                    token.kind,
                  ),
                  allianceBlockedReason:
                    terrorAllianceBlocked(g, entry, token.kind) ?? undefined,
                  canReveal: !terrorRevealBlocked(g, entry, token.kind),
                  revealBlocked:
                    terrorRevealBlocked(g, entry, token.kind) ?? undefined,
                  ...(token.kind === 'sneakAttack'
                    ? { sneakAttack: sneakAttackOptions(g, entry) }
                    : {}),
                }
              : {}),
          };
        })()
      : null,
    ixTechnology:
      me.faction === 'ixians'
        ? {
            setup: g.ixSetupCards ?? null,
            pool: g.ixAuction?.cards.length
              ? [...g.ixAuction.cards].sort((a, b) => a.id.localeCompare(b.id))
              : null,
            known:
              g.ixAuctionKnown?.turn === g.turn
                ? [...g.ixAuctionKnown.cards].sort((a, b) =>
                    a.id.localeCompare(b.id),
                  )
                : [],
            used: g.ixTechnologyTurn === g.turn,
          }
        : null,
    ixPurchased:
      g.pendingIxAlly?.player === id
        ? (me.hand.find((c) => c.id === g.pendingIxAlly!.card) ?? null)
        : null,
    ambassadors: g.ecazAmbassadors
      ? {
          tokens: g.ecazAmbassadors.tokens.map((token) => ({ ...token })),
          nextCost:
            (g.ecazAmbassadors.placement?.turn === g.turn
              ? g.ecazAmbassadors.placement.count
              : 0) + 1,
          blocked:
            g.ecazAmbassadors.placement?.turn === g.turn &&
            g.ecazAmbassadors.placement.blocked,
          completedTurn: g.ecazPlacementTurn ?? null,
        }
      : null,
    ambassadorEntry: g.pendingAmbassador
      ? (() => {
          const entry = g.pendingAmbassador!;
          const owner = getPlayer(g, entry.owner);
          const entrant = getPlayer(g, entry.entrant);
          const token = g.ecazAmbassadors!.tokens.find(
            (t) => t.id === entry.token,
          )!;
          return {
            event: entry.event,
            owner: entry.owner,
            entrant: entry.entrant,
            territory: entry.territory,
            stage: entry.stage,
            effect: entry.effect ?? token.effect,
            beneficiary: entry.beneficiary ?? null,
            shipment:
              entry.stage === 'ship' && id === entry.beneficiary
                ? (() => {
                    const choices = guildAmbassadorRule(() =>
                      guildAmbassadorShipments(g, id),
                    );
                    return {
                      ...choices,
                      destinations: choices.destinations.map((destination) => ({
                        ...destination,
                        ...ambassadorArrivalChoices(
                          g,
                          id,
                          'reserves',
                          destination.territory,
                        ),
                      })),
                    };
                  })()
                : null,
            movement:
              entry.stage === 'move' && id === entry.beneficiary
                ? ambassadorRelocationMovement(g, id)
                : null,
            allianceOffer:
              entry.stage === 'offer' &&
              token.effect === 'ecaz' &&
              id === owner.id
                ? { blocked: homeworldAllianceReason(g, owner.id, entrant.id) ?? ecazAllianceBlock(g, owner.id, entrant.id) }
                : null,
            dukeAcquisition:
              entry.stage === 'offer' &&
              token.effect === 'ecaz' &&
              id === owner.id
                ? { blocked: ambassadorEffectBlock(g, 'ecaz', owner, entrant) }
                : null,
            beneficiaries:
              entry.stage === 'offer' && id === owner.id
                ? g.players
                    .filter(
                      (p) =>
                        p.id === owner.id ||
                        (p.id === owner.ally && p.ally === owner.id),
                    )
                    .map((p) => ({
                      player: p.id,
                      blocked:
                        ambassadorEffectBlock(g, token.effect, p, entrant) ??
                        (token.effect === 'beneGesserit' &&
                        !entry.copyChoices.some(
                          (effect) =>
                            !ambassadorEffectBlock(g, effect, p, entrant),
                        )
                          ? 'No copied effect is currently available.'
                          : null),
                    }))
                : [],
            copies:
              entry.stage === 'copy' && id === entry.beneficiary
                ? entry.copyChoices.map((effect) => ({
                    effect,
                    blocked: ambassadorEffectBlock(g, effect, me, entrant),
                  }))
                : [],
            cards:
              entry.stage === 'cards' && id === entry.beneficiary
                ? me.hand.map((card) => ({
                    card: card.id,
                    blocked: ambassadorDiscardBlock(g, me, card, entry.effect),
                  }))
                : [],
          };
        })()
      : null,
    ambassadorInsights: (g.ambassadorInsights ?? []).filter(
      (entry) => entry.viewer === id,
    ),
    auditor: g.pendingAuditor
      ? {
          event: g.pendingAuditor.event,
          owner: g.pendingAuditor.owner,
          opponent: g.pendingAuditor.opponent,
          survived: g.pendingAuditor.survived,
          count: currentAuditCount(g),
        }
      : null,
    auditorInsight:
      g.auditorInsight?.viewer === id
        ? structuredClone(g.auditorInsight)
        : null,
    mobileStronghold: g.mobileStronghold ?? null,
    mobileRoute: g.pendingMobileMove
      ? {
          route: g.pendingMobileMove.route,
          collect: g.pendingMobileMove.collect,
        }
      : null,
    techTokens: g.techTokens ?? null,
    strongholdCards: g.strongholdCards ?? null,
    nexusCards: projectedNexusCards(g, id),
    nexusTraitors: projectedNexusTraitors(g, id),
    nexusTleilaxu: projectedNexusTleilaxu(g, id),
    nexusSuboids: projectedNexusSuboids(g, id),
    nexusAdvisors: projectedNexusAdvisors(g, id),
    nexusSardaukar: projectedNexusSardaukar(g,id),
    nexusAtreides: nexusAtreidesOffer(g, id),
    homeworldRevivalDeployment: projectedHomeworldRevivalReturn(g, id),
    caladanReinforcement: projectedHomeworldVictoryReturn(g, id),
    homeworldRevivalBlocks: homeworldRevivalChoiceBlocks(g, me),
    homeworlds: g.homeworlds
      ? { worlds: homeworldRule(() => homeworldTable(g)) }
      : null,
    homeworldMove:
      g.homeworlds?.custody && g.advanced && me.faction === 'emperor'
        ? {
            event: emperorHomeworldMoveEvent(g, me),
            blocked: emperorHomeworldMoveBlock(g, me),
            remaining: Math.max(0, movesAllowed(g, me) - me.moved),
          }
        : null,
    homeworldShipment: g.homeworlds?.custody
      ? {event: homeworldShipmentEvent(g, me), blocked: homeworldShipmentBlock(g, me)}
      : null,
    guildHomeworldShipment: g.homeworlds?.custody && me.faction === 'guild'
      ? {event: homeworldShipmentEvent(g, me, 'arrakis'), blocked: guildHomeworldShipmentBlock(g, me)}
      : null,
    junctionTransport: junctionTransportWindow(g),
    homeworldMobility: {
      foresightBlocked: homeworldRule(() => homeworldMovementForesightBlock(g, me.id)),
      mobileStrongholdBlocked: homeworldRule(() => homeworldMobileStrongholdMovementBlock(g, me.id)),
      noFieldMovementBlocked: homeworldRule(() => homeworldNoFieldMovementBlock(g, me.id)),
      advisorSinkMaximum: spiritualAdvisorMaximum(g, me.id),
      advisorAccompanyMaximum: spiritualAdvisorMaximum(g, me.id, 'arrakeen'),
    },
    expansions: g.expansions,
    turn: g.turn,
    phase: g.phase,
    phaseOpening: g.phaseOpening ? { passed: g.phaseOpening.passed } : null,
    storm: g.status === 'lobby' ? STORM_START_SECTOR : g.storm,
    playerPositions: normalizedPlayerPositions(g),
    order: g.order,
    active: g.active,
    movementRemaining: g.movementRemaining ?? null,
    guildTimingLocked: g.guildTimingLocked ?? false,
    ready: g.ready,
    spice: g.spice,
    log: g.log,
    nexus: g.nexus,
    summonedWorm: g.summonedWorm
      ? { territory: g.summonedWorm.territory }
      : null,
    sandtrout: g.sandtrout ?? false,
    spiceWindow: g.spiceWindow ?? null,
    spicePile: g.spiceSequence?.pile ?? 0,
    beforeSpiceDraw:
      g.phase === 1 &&
      g.nexusCards?.phase?.stage !== 'drawing' &&
      !g.spiceSequence &&
      !g.spiceResolution &&
      !g.spiceWindow &&
      !g.nexus,
    spiceDiscardTop: g.spiceDiscard.map((pile) => pile.at(-1) ?? null),
    allianceOffers: g.allianceOffers,
    homeworldAllianceBlocks: Object.fromEntries(g.players.filter((p) => p.id !== id)
      .flatMap((p) => { const reason = homeworldAllianceReason(g, id, p.id); return reason ? [[p.id, reason]] : []; })),
    ecazSpice:
      g.ecazCollection?.stage === 'allocation' && g.ecazCollection.allocation
        ? {
            event: g.ecazCollection.event,
            allocation: [
              g.ecazCollection.allocation.lots[0].ecaz,
              g.ecazCollection.allocation.lots[0].ally,
            ].includes(id)
              ? g.ecazCollection.allocation
              : null,
            player: g.ecazCollection.allocation.player,
            territory:
              g.ecazCollection.allocation.lots[
                g.ecazCollection.allocation.index
              ].territory,
          }
        : null,
    winner: g.winner,
    victoryProgress,
    shieldWallDestroyed: g.shieldWallDestroyed,
    stormDialers: g.stormDialers,
    stormSubmitted: Object.keys(g.stormDials),
    karamaShipping: g.karamaShipping
      ? { player: g.karamaShipping.player, owner: g.karamaShipping.owner }
      : null,
    stormPending: g.stormPending ?? null,
    stormForecast:
      me.faction === 'fremen' && g.stormCardKnown ? g.stormCard : null,
    stormRevealed:
      g.phase === 0 &&
      g.stormDialers.length > 0 &&
      g.stormDialers.every((id) => g.stormDials[id] !== undefined)
        ? g.stormDials
        : null,
    me: id,
    choamWorthless:
      me.faction === 'choam'
        ? {
            pending:
              g.pendingChoamWorthless?.owner === id
                ? g.pendingChoamWorthless.card
                : null,
            baliset: gameTerritories(g)
              .filter((t) => at(me, t.id) > 0)
              .map((t) => t.id),
            gamont: g.players
              .filter((p) => p.id !== id)
              .flatMap((p) =>
                Object.entries(presenceByLocation(p)).flatMap(
                  ([key, count]) => {
                    const elites = p.elites?.forces[key] ?? 0;
                    const marker = p.noField?.deployed;
                    const noField =
                      !!marker &&
                      location(
                        marker.location.territory,
                        marker.location.sector,
                      ) === key;
                    return [
                      ...(count > elites
                        ? [{ target: p.id, key, elite: 0, noField }]
                        : []),
                      ...(elites > 0
                        ? [{ target: p.id, key, elite: 1, noField: false }]
                        : []),
                    ];
                  },
                ),
              ),
            targets: g.players
              .filter((p) => !g.revivalRules?.freeBlocked?.includes(p.id))
              .map((p) => p.id),
            cards: me.hand.filter(
              (c) =>
                c.kind === 'worthless' &&
                [
                  'Baliset',
                  'Kulon',
                  'La La La',
                  'Trip to Gamont',
                  'Jubba Cloak',
                ].includes(c.name) &&
                !choamWorthlessBlocked(g, c.id),
            ),
            plays: choamPowerPlays(g,me),
          }
        : null,
    balisetRestrictions:
      g.phase === 5
        ? (g.choamBaliset ?? []).filter((b) => b.turn === g.turn)
        : [],
    mentatVictoryPending:
      g.phase === 8 &&
      g.status === 'playing' &&
      (!!byFaction(g, 'choam') ||
        g.decision?.kind === 'moritaniPlacement' ||
        g.response?.kind === 'moritaniPlacement'),
    choamMovementBonus:
      g.choamMovement?.turn === g.turn ? g.choamMovement.bonus : 0,
    choamCashIn:
      g.status === 'playing' &&
      me.faction === 'choam' &&
      g.advanced &&
      !me.specialKaramaUsed
        ? {
            cards: cashInCards(g, me),
            karamas: cashInCards(g, me).filter((c) => c.effect === 'karama'),
          }
        : null,
    choamMarket: g.choamMarket
      ? {
          owner: g.choamMarket.owner,
          ...(g.choamMarket.owner === id
            ? {
                sales: saleOptions(me.hand, g.choamMarket.blocked).filter((sale) =>
                  !homeworldRule(() => homeworldWorthlessSaleBlock(
                    g, me.id, me.hand.find((card) => card.id === sale.card)!,
                  )),
                ),
                worthlessSaleBlocked: homeworldRule(() =>
                  homeworldWorthlessSaleBlock(g, me.id, { kind: 'worthless' }),
                ),
                canTrade: !!me.ally && g.choamTradeTurn !== g.turn,
                tradeAttempted: !!g.choamMarket.tradeAttempted,
              }
            : {}),
          ...(g.choamMarket.trade &&
          [g.choamMarket.owner, g.choamMarket.trade.ally].includes(id)
            ? {
                offered: getPlayer(g, g.choamMarket.owner).hand.find(
                  (c) => c.id === g.choamMarket!.trade!.offered,
                ),
                returned: getPlayer(g, g.choamMarket.trade.ally).hand.find(
                  (c) => c.id === g.choamMarket!.trade!.returned,
                ),
              }
            : {}),
        }
      : null,
    inflation: g.inflation ?? null,
    inflationUsed: g.inflationUsed ?? false,
    inflationAttempted: g.inflationAttemptTurn === g.turn,
    charity: {
      ...charityQuote(g, me),
      multiplier: charityMultiplier(g),
      amount: charityAmount(g, me),
      payer: charityPayer(g)?.id ?? null,
      incomePending: !!byFaction(g, 'choam') && g.choamCharity?.turn !== g.turn,
      incomeCanceled:
        g.choamCharity?.turn === g.turn && g.choamCharity.canceled,
    },
    moritaniRetention: g.moritaniRetention ?? null,
    moritaniRetentionCard: g.moritaniRetention?.keep
      ? (cardOf(
          getPlayer(g, g.moritaniRetention.player),
          g.moritaniRetention.keep,
        ) ?? null)
      : null,
    decision:
      g.decision?.kind === 'capturedLeader' &&
      ![g.decision.player, g.decision.controller ?? g.decision.owner].includes(
        id,
      )
        ? { ...g.decision, leader: '', owner: '' }
        : g.decision?.kind === 'faceDance'
          ? { ...g.decision, ...(faceDanceReturnBlock(g, g.decision.winner) ? {blocked: faceDanceReturnBlock(g, g.decision.winner)!} : {}) }
          : (g.decision ?? null),
    response: g.response
      ? {
          ...g.response,
          ...(g.response.guildContributions ? { guildContributions: undefined } : {}),
          ...(g.response.guildPaymentProof ? { guildPaymentProof: undefined } : {}),
          passed: g.response.passed.includes(id) ? [id] : [],
          ...(g.response.kind === 'revivalIncome' &&
          ![g.response.owner, g.response.recipient].includes(id)
            ? { amount: undefined }
            : {}),
          ...(g.response.kind === 'faceDancerReplacement' &&
          g.response.owner !== id
            ? { intent: undefined }
            : {}),
          ...(g.response.kind === 'emperorGift' &&
          ![g.response.owner, g.response.recipient].includes(id)
            ? { amount: undefined }
            : {}),
        }
      : null,
    paymentIncome: currentFactionPayment(g),
    responseControls: g.response
      ? {
          cancelCards: responseCancelCards(g, me, g.response),
          hasPassed: g.response.passed.includes(id),
        }
      : undefined,
    revivalPrevention:
      g.revivalPrevention?.turn === g.turn ? g.revivalPrevention : null,
    emperorExtra: g.emperorExtra ?? {},
    freeRevival: g.freeRevival ?? [],
    revivalRules: {
      ...(g.revivalRules ?? newRevivalRules()),
      earlyBlocked: (g.revivalRules?.earlyBlocked ?? []).filter(
        (key) => me.faction === 'tleilaxu' || key.startsWith(`${id}:`),
      ),
    },
    revivalRequests: Object.fromEntries(
      Object.entries(g.revivalRequests ?? {}).filter(
        ([player]) => player === id || me.faction === 'tleilaxu',
      ),
    ),
    revival: {
      pending: !!g.pendingRevival,
      specialKaramaBlock:
        g.decision?.kind === 'revivalStop'
          ? homeworldRevivalKaramaBlock(g, g.decision.recipient)
          : null,
      leaders: leaderRevivals.leaders,
      kwisatz: leaderRevivals.kwisatz,
      prevented: revivalPrevented(g, me.id),
      eliteRemaining: eliteRevivalRemaining(me, g.advanced),
      limit: normalForceRevivalLimit(g, me),
      forcesRemaining: forceRevivalRemaining(g, me),
      discount: revivalDiscount(g, me),
      choamBlocked: !!g.revivalRules?.choamBlocked,
      freeRemaining: freeRevivalRemaining(g, me),
      homeworldBonus: homeworldLowBonus(g, me.id),
      tleilaxuHomeworldIncomeBlocked: homeworldRule(() =>
        tleilaxuHomeworldFreeIncomeBlocked(g),
      ),
      freeBlocked: g.revivalRules?.freeBlocked?.includes(id) ?? false,
    },
    ghola: gholaOptions(g, me),
    aid: {
      pledged: g.aid?.[id]?.amount ?? 0,
      available:
        g.phase === 6
          ? (battleAidFor(g, me)?.amount ?? 0)
          : me.ally && g.aid?.[me.ally]?.recipient === id
            ? g.aid[me.ally].amount
            : 0,
    },
    players: g.players.map((p) => ({
      ...(p.noField
        ? { noField: projectRicheseNoField(p.noField, false) }
        : {}),
      id: p.id,
      name: p.name,
      bot: p.bot,
      autopilot: p.autopilot,
      faction: p.faction,
      handLimit: handLimit(p),
      ready: p.ready,
      reserves: p.reserves,
      tanks: p.tanks,
      forces: p.forces,
      elites: p.elites,
      advisors: p.advisors,
      advisorSetup: p.advisorSetup,
      specialKaramaUsed: p.specialKaramaUsed ?? false,
      fremenMovementBlocked:
        p.fremenMovementBlocked?.turn === g.turn &&
        p.fremenMovementBlocked.move === p.moved,
      ixMovementBlocked:
        p.ixMovementBlocked?.turn === g.turn &&
        p.ixMovementBlocked.move === p.moved,
      revealedTraitors: p.revealedTraitors ?? [],
      revealedFaceDancers: (p.faceDancers ?? [])
        .filter((c) => c.revealed)
        .map((c) => c.leader),
      leaders: [
        ...(g.dukeVidal?.controller === p.id &&
        !g.dukeVidal.leader.capturedBy &&
        !g.dukeVidal.leader.gholaBy &&
        !(g.advanced && byFaction(g, 'harkonnen'))
          ? [{ ...g.dukeVidal.leader, controller: p.id }]
          : []),
        ...p.leaders.map((l) => projectLeader(g, l, id)),
        ...g.players
          .filter((owner) => owner.id !== p.id)
          .flatMap((owner) =>
            owner.leaders
              .filter(
                (l) =>
                  l.gholaBy === p.id || (p.id === id && l.capturedBy === p.id),
              )
              .map((l) => projectLeader(g, l, id)),
          ),
      ],
      ally: p.ally,
      allySinceTurn: p.allySinceTurn,
      ...(p.id === id
        ? {
            spice: p.spice,
            charityClaimed: p.charityTurn === g.turn,
            ...(g.advanced && p.faction === 'atreides'
              ? {
                  kwisatz: {
                    active: p.battleLosses >= 7,
                    dead: p.kwisatz?.dead ?? false,
                    usedAt: p.kwisatz?.usedAt,
                    losses: p.battleLosses,
                  },
                }
              : {}),
            hand: p.hand,
            traitors: p.traitors,
            faceDancers: p.faceDancers,
            faceDancerReplaced: p.faceDancerReplacedTurn === g.turn,
            traitorChoices: p.traitorChoices,
            prediction: p.prediction,
            bribes: p.bribes,
            shipped: p.shipped,
            moved: p.moved,
            movesAllowed: movesAllowed(g, p),
            revived: p.revived,
            leaderRevived: p.leaderRevived,
            gholaBlocked: Object.entries(p.gholaBlocked ?? {})
              .filter(([, turn]) => turn === g.turn)
              .map(([leader]) => leader),
          }
        : {}),
      ...(g.phase === 3 || p.id === id ? { handCount: p.hand.length } : {}),
    })),
    richeseNoField: (() => {
      const owner = byFaction(g, 'richese');
      if (!owner?.noField || !owner.noFieldEvent) return null;
      const mine = owner.id === me.id;
      const shipBlock = mine
        ? noFieldShipBlock(g, owner)
        : 'Only Richese controls this token inventory.';
      const revealBlock = mine
        ? noFieldRevealBlock(g, owner)
        : 'Only Richese controls this concealed token.';
      return {
        owner: owner.id,
        event: owner.noFieldEvent,
        public: projectRicheseNoField(owner.noField, false),
        private: mine
          ? projectRicheseNoField(owner.noField, true).private
          : null,
        canShip: !shipBlock,
        shipBlock,
        canReveal: !revealBlock,
        revealBlock,
        canOfferAlly: mine && !noFieldAllyOfferBlock(g, owner),
        allyOfferBlock: mine
          ? noFieldAllyOfferBlock(g, owner)
          : 'Only Richese may offer these tokens.',
        allyDeclined:
          g.richeseAllyDeclined?.turn === g.turn &&
          g.richeseAllyDeclined.recipient === owner.ally,
        allyOffer: (() => {
          const offer = g.richeseAllyOffer;
          if (!offer || ![offer.owner, offer.recipient].includes(id))
            return null;
          const { event, owner, recipient, territory, sector, payer } = offer;
          try {
            const {
              cost,
              ownerPayment,
              recipientPayment,
              amount,
              value,
              eliteMin,
              eliteMax,
            } = alliedNoFieldQuote(g, offer, offer.recipient === id);
            return {
              event,
              owner,
              recipient,
              territory,
              sector,
              payer,
              cost,
              ownerPayment,
              recipientPayment,
              amount,
              value,
              eliteMin,
              eliteMax,
              blocked: null as string | null,
            };
          } catch (error) {
            if (!(error instanceof RuleError)) throw error;
            return {
              event,
              owner,
              recipient,
              territory,
              sector,
              payer,
              cost: 0,
              ownerPayment: 0,
              recipientPayment: 0,
              amount: 0,
              value: 0 as const,
              eliteMin: 0,
              eliteMax: 0,
              blocked: error.message,
            };
          }
        })(),
      };
    })(),
    richeseGift: richeseGiftView(g, me),
    distrans: distransView(g, me),
    nullentropy: nullentropyView(g, me),
    ornithopter: ornithopterView(g, me),
    residualPoison: residualPoisonView(g, me),
    portableSnooper: portableSnooperView(g, me),
    saphoOptions: saphoOptions(g, me),
    saphoMovementLast: g.saphoMovementLast
      ? {
          event: g.saphoMovementLast.event,
          turn: g.saphoMovementLast.turn,
          player: g.saphoMovementLast.player,
        }
      : null,
    playedOrnithopter: g.ornithopter
      ? {
          player: g.ornithopter.player,
          card: g.ornithopter.card,
          mode: g.ornithopter.mode,
          completed: g.ornithopter.completed,
        }
      : null,
    richeseSpecialKarama: richeseSpecialKaramaView(g, me),
    richeseBidding:
      g.richeseBidding?.turn === g.turn
        ? {
            owner: g.richeseBidding.owner,
            event: g.richeseBidding.event,
            stage: g.richeseBidding.stage,
            position: g.richeseBidding.position,
            normalCount: g.richeseBidding.normalCount,
            offerBlocked: richeseOfferBlock(g),
            cache:
              g.richeseBidding.owner === id ? (g.richeseCache ?? []) : null,
          }
        : null,
    richeseAuction: g.richeseAuction
      ? {
          ...projectRicheseAuction(g.richeseAuction, id),
          card:
            g.richeseAuction.source === 'cache' ||
            g.richeseAuction.owner === id ||
            (me.faction === 'atreides' && g.richesePeekKnown)
              ? (g.richeseOfferedCard ?? richeseLotCard(g) ?? null)
              : null,
          claim: g.richeseClaim ?? null,
          ownAllyPayment: g.richeseFunding?.[id]?.allyPayment ?? 0,
          ownAvailable:
            uncommittedSpice(g, me) +
            richeseOwnCommitment(g.richeseAuction, g.richeseFunding ?? {}, id),
          allyAvailable: aidFor(g, me)?.amount ?? 0,
          peekKnown: !!g.richesePeekKnown,
        }
      : null,
    auction: g.auction
      ? {
          bid: g.auction.bid,
          bidder: g.auction.bidder,
          active: g.auction.active,
          ...(g.auction.bidder === id
            ? { allyPayment: g.auction.allyPayment ?? 0 }
            : {}),
          remaining: g.auction.cards.length - g.auction.index,
          card:
            me.faction === 'atreides' && g.auction.peekKnown
              ? g.auction.cards[g.auction.index]
              : null,
        }
      : null,
    battle: b
      ? {
          locationName: combatLocationName(g, b.territory),
          native: homeworldBattleLocation(g, b.territory)?.native ?? null,
          nativeBattleStrength: homeworldBattleLocation(g, b.territory)?.nativeBattleStrength ?? 0,
          opponentForces: [b.attacker, b.defender].includes(id) &&
            !getPlayer(g, b.attacker === id ? b.defender : b.attacker).noField?.deployed
            ? combatForces(g, getPlayer(g, b.attacker === id ? b.defender : b.attacker), b.territory, me)
            : null,
          strongholdCopy: b.strongholdCopy ?? null,
          strongholdEffects: Object.fromEntries(
            [b.attacker, b.defender].map((player) => [
              player,
              strongholdEffect(g, player),
            ]),
          ) as Record<string, StrongholdId | null>,
          tieWinner: battleTieWinner(g),
          noFieldPlayers: b.noFieldPlayers ?? [],
          ownForces: [b.attacker, b.defender].includes(id)
            ? combatForces(
                g,
                me,
                b.territory,
                getPlayer(g, b.attacker === id ? b.defender : b.attacker),
              )
            : null,
          truthPromises: b.truthPromises ?? [],
          compliantPlan:
            completion &&
            !completion.actions.length &&
            !completion.waitingForIncome
              ? completion.plan
              : null,
          compliantPreparation:
            completion &&
            (completion.actions.length || completion.waitingForIncome)
              ? completion
              : null,
          poisonTooth: b.revealed ? (b.poisonTooth ?? {}) : {},
          stoneBurner: b.revealed ? (b.stoneBurner ?? {}) : {},
          stoneBurnerContext: [b.attacker, b.defender].includes(id)
            ? {
                blocked: stoneTimingBlock(g),
                opponentPools: stonePublicPools(
                  g,
                  getPlayer(g, b.attacker === id ? b.defender : b.attacker),
                  me,
                ),
              }
            : null,
          lateDefense: b.revealed ? (b.lateDefense ?? {}) : {},
          fullPlan: b.fullPlan ?? null,
          fullPlanInsight:
            b.fullPlan?.owner === id &&
            b.plans[b.fullPlan.target] &&
            !b.revealed
              ? {
                  target: b.fullPlan.target,
                  plan: b.plans[b.fullPlan.target],
                  cards: getPlayer(g, b.fullPlan.target).hand.filter((c) => {
                    const plan = b.plans[b.fullPlan!.target];
                    return [plan.leader, plan.weapon, plan.defense].includes(
                      c.id,
                    );
                  }),
                }
              : null,
          event: b.event ?? null,
          preLeader: b.preLeader ?? null,
          territory: b.territory,
          attacker: b.attacker,
          defender: b.defender,
          revealed: b.revealed,
          kwisatzBlocked: b.kwisatzBlocked ?? false,
          eliteBlocked: b.eliteBlocked ?? [],
          fremenSupportBlocked: b.fremenSupportBlocked ?? false,
          choamAidBlocked: b.choamAidBlocked ?? false,
          cards: b.revealed
            ? [b.attacker, b.defender].flatMap((playerId) => {
                const plan = b.plans[playerId];
                return getPlayer(g, playerId).hand.filter((c) =>
                  [
                    plan.leader,
                    plan.weapon,
                    plan.defense,
                    b.lateDefense?.[playerId],
                  ].includes(c.id),
                );
              })
            : [],
          submitted: Object.keys(b.plans),
          plans: b.revealed
            ? b.plans
            : b.plans[id]
              ? { [id]: b.plans[id] }
              : {},
          traitorSubmitted: Object.keys(b.traitorCalls),
          traitorVoters: traitorVoters(g, b),
          preparation: b.preparation ?? null,
          nexusInspection: b.nexusInspection ? {
            event: b.nexusInspection.event, mode: b.nexusInspection.mode,
            owner: b.nexusInspection.owner, target: b.nexusInspection.target,
            field: b.nexusInspection.field, stage: b.nexusInspection.stage,
          } : null,
          nexusInsights: projectedNexusInsights(g, id),
          ownCommitments: committedPlanElements(b, id),
          prescience: b.prescience
            ? {
                player: b.prescience.player,
                field: b.prescience.field,
                answered: 'value' in b.prescience,
              }
            : undefined,
          voice: b.voice,
          insight:
            b.prescience &&
            'value' in b.prescience &&
            (b.prescience.player === id ||
              [b.attacker, b.defender].includes(id))
              ? {
                  field: b.prescience.field,
                  value: b.prescience.value,
                  label:
                    g.players
                      .flatMap((p) => [...p.leaders, ...p.hand])
                      .concat(g.dukeVidal ? [g.dukeVidal.leader] : [])
                      .find((item) => item.id === b.prescience!.value)?.name ??
                    String(b.prescience.value ?? 'None'),
                }
              : null,
        }
      : null,
    spicePeek:
      g.phase === 5 && me.faction === 'atreides' && g.spicePeekKnown
        ? (g.spiceDeck[0] ?? null)
        : null,
    allLeaders: [
      ...g.players.flatMap((p) => p.leaders),
      ...(g.dukeVidal ? [g.dukeVidal.leader] : []),
    ].map((l) => ({
      id: l.id,
      name: l.name,
      faction: l.faction,
      strength: l.strength,
    })),
  };
}
export type GameView = ReturnType<typeof viewGame>;
