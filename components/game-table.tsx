'use client';
import {
  matchesShipment,
  liveShipmentPromises,
} from '@/game/shipment-promises';
import { ShipmentPromises } from './shipment-promises';
import { HomeworldShipment } from './homeworld-shipment';
import { HomeworldRevivalDeployment } from './homeworld-revival-deployment';
import { CaladanReinforcement } from './caladan-reinforcement';
import { GrummanCollection } from './grumman-collection';
import { TupileIntelligence } from './tupile-intelligence';
import { NexusCards } from './nexus-cards';
import { NexusTraitors } from './nexus-traitors';
import { NexusTleilaxu } from './nexus-tleilaxu';
import { NexusSuboids } from './nexus-suboids';
import { NexusAdvisors } from './nexus-advisors';
import { NexusSardaukar } from './nexus-sardaukar';
import { TerrorBoardMarkers } from './terror-board-markers';
import { homeworldRevivalActionBlock } from '@/game/homeworld-revival-deployment-options';
import { GuildHomeworldShipment } from './guild-homeworld-shipment';
import { JunctionTransport } from './junction-transport';
import { BiddingEnd } from './bidding-end';
import { homeworldShipmentPaymentBlock } from '@/game/homeworld-payment-options';
import {
  HomeworldTable,
  NativeShipmentChoice,
  EmperorHomeworldMovement,
} from './homeworld-table';
import { nativeShipmentSources } from '@/game/homeworld-options';
import { botBattleChoices } from '@/game/bot-battle-choices';
import { specialForceName, maxCombatDial, maxCombatSupport } from '@/game/combat';
import type { NativeReserveSelections } from '@/game/homeworld-native-reserves';
import {
  StrongholdCardGallery,
  StrongholdCopyChoice,
} from './stronghold-cards';
import { EcazPlacement, AmbassadorSupply } from './ecaz-ambassadors';
import { EcazEntry, AmbassadorInsights } from './ecaz-entry';
import { RicheseAuctionDecision, RicheseAuctionLot } from './richese-auctions';
import { RicheseSpecialKarama } from './richese-special-karama';
import { RicheseGift } from './richese-gift';
import { Distrans } from './distrans';
import { JuiceOfSapho } from './juice-of-sapho';
import { NullentropyBox, NullentropySearch } from './nullentropy-box';
import { OrnithopterMovement } from './ornithopter-movement';
import { ResidualPoison, BattleLeaderOpportunity } from './residual-poison';
import { PortableSnooper } from './portable-snooper';
import {
  RicheseNoFieldControls,
  NoFieldBoardMarkers,
} from './richese-no-field';
import {
  RicheseAlliedNoFieldControls,
  RicheseAlliedNoFieldDecision,
} from './richese-allied-no-field';
import { presenceByLocation } from '@/game/force-presence';
import { AutomaticActionNotice } from './automatic-action-notice';
import { EcazSpice } from './ecaz-spice';
import { VictoryProgress } from './victory-progress';
import { tableActionOwner } from '@/game/table-turn';
import { DukeVidal } from './duke-vidal';
import { CardInspector, CardRules } from './card-inspector';
import { ordinaryCardAvailability } from '@/game/card-availability';
import {
  cardPresentation,
  richeseCardActionBlock,
} from '@/game/card-presentation';
import { richeseCardDefinition } from '@/game/richese-cards';
import { SpiceCardInspector, spiceCardTitle } from './spice-card-inspector';
import { BattleWheel } from './battle-wheel';
import {
  LeaderInspector,
  type LeaderDisplayIdentity,
  type LeaderInspectorProps,
} from './leader-inspector';
import { ChoamStorm } from './choam-storm';
import { ChoamBaliset } from './choam-baliset';
import { ChoamGamont } from './choam-gamont';
import { ChoamWorthless } from './choam-worthless';
import { ChoamBattleFunding } from './choam-battle-funding';
import { AuditorDecision, AuditorInsight } from './choam-auditor';
import { ChoamCashIn } from './choam-cash-in';
import { ChoamMarket } from './choam-market';
import { BattlePromises } from './battle-promises';
import { Truthtrance, TruthHistory } from './truthtrance';
import {
  forceRevivalPrice,
  eliteRevivalRemaining,
  paidForceRevivalCost,
} from '@/game/revival';
import { IxTechnology } from './ix-technology';
import { MobileStronghold } from './mobile-stronghold';
import { IxSubstitution } from './ix-substitution';
import { controlsLeader } from '@/game/leader-control';
import { leaderStrengthLabel, harvesterAvailable } from '@/game/cards';
import { RevivalCommerce } from './revival-commerce';
import { FaceDanceDecision } from './face-dance-decision';
import { CHEAP_HERO_TRAITOR, matchingTraitor } from '@/game/traitors';
import {
  battleCardLabel,
  isWeaponCard,
  isStoneBurner,
  isDefenseCard,
} from '@/game/battle-cards';
import { stoneBurnerPlanBlock } from '@/game/stone-burner';
import { TECH_TOKENS, ownedTech } from '@/game/tech-tokens';
import Link from 'next/link';
import { canUseAsKarama } from '@/game/karama';
import { LeaderPortrait } from './leader-portrait';
import { ShipmentQuote } from './shipment-quote';
import { reserveShipmentCost } from '@/game/shipment-price';
import { nexusRicheseAction, nexusRicheseQuote } from '@/game/nexus-richese-options';
import { guildTransportQuote } from '@/game/transport-quote';
import { fremenReserveEntry, botGroundMoveAllowed } from '@/game/bot-mobility';
import { location as boardLocation } from '@/game/board';
import { fighterCount, isAdvisor } from '@/game/advisors';
import { useState } from 'react';
import {
  ArrowRight,
  Wind,
  Coins,
  Copy,
  Check,
  Swords,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BattlePreparation, battlePlanCommitments, bindBattlePlanCommitments, NexusInspectionHistory } from './battle-preparation';
import { PrivateBattlePlan } from './private-battle-plan';
import { RevealedBattle } from './revealed-battle';
import { EliteCount } from './elite-count';
import { HelpTip } from './help-tip';
import { PHASE_HELP, phaseRuleId } from '@/game/reference';
import {
  DIFFICULTIES,
  BOT_DESCRIPTIONS,
  type Difficulty,
} from '@/game/bot-profiles';
import { FACTIONS, PHASES, faction } from '@/game/catalog';
import {
  FREMEN_START_LOCATIONS,
  TERRITORIES,
  gameTerritories,
  MOBILE_STRONGHOLD,
  territory,
  splitLocation,
} from '@/game/board';
import type { Action, GameView } from '@/game/engine';
import { PLAYER_CIRCLE_SECTORS } from '@/game/player-positions';
import { SeatAutopilot } from './seat-autopilot';
import {
  MoritaniEntry,
  MoritaniPlacement,
  MoritaniTerrorSupply,
} from './moritani-terror';
import { TERROR_DEFINITIONS } from '@/game/moritani-terror';
import { MoritaniRetention } from './moritani-retention';
export function GameTable({
  game: g,
  send,
  busy: transportBusy,
  onExit,
}: {
  game: GameView;
  send: (a: Action) => Promise<void>;
  busy: boolean;
  onExit: () => void;
}) {
  const me = g.players.find((p) => p.id === g.me)!;
  const combatName = (id: string) =>
    g.combatLocations?.find((place) => place.id === id)?.name ??
    gameTerritories(g).find((place) => place.id === id)?.name ??
    id;
  const turnOwner = tableActionOwner(g);
  const turnOwnerName = g.players.find((p) => p.id === turnOwner)?.name;
  const setupStage = g.setupStage;
  const setupFremen = g.players.find((p) => p.faction === 'fremen');
  const setupSisterhood = g.players.find((p) => p.faction === 'beneGesserit');
  const setupPendingNames = (g.setupPending ?? [])
    .filter((id) => id !== me.id)
    .map((id) => g.players.find((p) => p.id === id)?.name)
    .filter(Boolean)
    .join(', ');
  const waitingForFremen = !!setupFremen && setupFremen.reserves !== 10;
  const setupStatus =
    setupStage === 'prediction'
      ? setupSisterhood?.id === me.id
        ? 'Seal your secret prediction before traitors or treachery cards are dealt.'
        : `Waiting for ${setupSisterhood?.name ?? 'Bene Gesserit'} to seal the secret prediction.`
      : setupStage === 'traitors'
        ? me.traitorChoices?.length
          ? 'Choose one of your dealt traitors. Every player completes this step before starting forces are placed.'
          : setupPendingNames
            ? `Your traitors are settled. Waiting for ${setupPendingNames} to choose.`
            : 'Your traitors are settled. The remaining selections are finishing.'
        : setupStage === 'forces'
          ? waitingForFremen
            ? setupFremen.id === me.id
              ? g.advanced && setupSisterhood
                ? 'Place your ten starting forces. Bene Gesserit places its advisor afterward.'
                : 'Place your ten starting forces. Starting cards are dealt automatically after placement.'
              : `Waiting for ${setupFremen.name} to place the Fremen starting forces.`
            : g.advanced && setupSisterhood && !setupSisterhood.advisorSetup
              ? setupSisterhood.id === me.id
                ? 'Choose a printed board territory and sector for your starting advisor.'
                : `Waiting for ${setupSisterhood.name} to place the starting advisor.`
              : 'Starting placements are finishing. Cards are dealt and the Storm phase opens automatically.'
          : 'Complete your starting choices. Play begins when everyone is ready.';
  const automaticEvents = g.log.flatMap((entry) =>
    entry.automatic
      ? [
          {
            id: `${g.code}:${entry.seq}`,
            seq: entry.seq,
            faction: entry.automatic.faction,
            name: entry.automatic.name,
          },
        ]
      : [],
  );
  const busy =
    transportBusy || !!me.autopilot || g.automaticContinuationPending;
  const traitorBattle = g.battle;
  const traitorBeneficiary =
    traitorBattle &&
    [traitorBattle.attacker, traitorBattle.defender].includes(me.id)
      ? me.id
      : me.ally;
  const traitorPlan = traitorBattle?.revealed
    ? traitorBattle.plans[
        traitorBattle.attacker === traitorBeneficiary
          ? traitorBattle.defender
          : traitorBattle.attacker
      ]
    : undefined;
  const canRevealTraitor = !!(
    traitorBattle?.traitorVoters.includes(me.id) &&
    traitorPlan &&
    !traitorPlan.kwisatz &&
    matchingTraitor(
      me.traitors ?? [],
      traitorPlan.leader,
      traitorBattle.cards.find((card) => card.id === traitorPlan.leader),
    )
  );
  const noTraitorReason = traitorPlan?.kwisatz
    ? 'Kwisatz Haderach prevents this leader from turning traitor.'
    : 'You do not hold the opposing leader as a traitor.';
  const guildTransport =
    me.faction === 'guild' ||
    g.players.some((p) => p.faction === 'guild' && p.id === me.ally);
  const [botFaction, setBotFaction] = useState('');
  const [botDifficulty, setBotDifficulty] = useState<Difficulty>('Medium');
  const availableBotFactions = FACTIONS.filter(
    (f) =>
      (f.expansion === 'base' || g.expansions.includes(f.expansion)) &&
      !g.players.some((p) => p.faction === f.id),
  );
  const nextBotFaction = availableBotFactions.some((f) => f.id === botFaction)
    ? botFaction
    : (availableBotFactions[0]?.id ?? '');
  const [selectedId, setSelected] = useState(() =>
    gameTerritories(g).some((location) => location.id === g.battle?.territory)
      ? g.battle!.territory
      : 'arrakeen',
  );
  const selected = gameTerritories(g).some((location) => location.id === selectedId)
    ? selectedId
    : 'arrakeen';
  const [sector, setSector] = useState(10);
  const [amount, setAmount] = useState(1);
  const [richeseShipmentEvent, setRicheseShipmentEvent] = useState('');
  const useRicheseShipment = !!g.nexusRichese && richeseShipmentEvent === g.nexusRichese.event;
  const [bidDraft, setBidDraft] = useState({ auction: '', value: 1 });
  const auctionKey = `${g.code}/${g.turn}/${g.auction?.remaining ?? 0}`;
  const minimumBid = (g.auction?.bid ?? 0) + 1;
  const bidAmount = Math.max(
    minimumBid,
    bidDraft.auction === auctionKey ? bidDraft.value : minimumBid,
  );
  const maximumBid = me.hand?.some((c) =>
    canUseAsKarama(g.advanced, me.faction, c),
  )
    ? Number.MAX_SAFE_INTEGER
    : (me.spice ?? 0) + g.aid.available;
  const [eliteAmount, setEliteAmount] = useState(0);
  const [homeworldDraft, setHomeworldDraft] = useState<{
    key: string;
    sources: NativeReserveSelections;
  } | null>(null);
  const homeworldSourceKey = JSON.stringify([
    g.code,
    g.turn,
    g.phase,
    g.active,
    g.homeworlds,
    amount,
    eliteAmount,
  ]);
  const homeworldSources =
    homeworldDraft?.key === homeworldSourceKey
      ? homeworldDraft.sources
      : nativeShipmentSources(g, amount, eliteAmount);
  const [freeCyborgFirst, setFreeCyborgFirst] = useState(true);
  const [allyEliteAmount, setAllyEliteAmount] = useState(0);
  const [eliteForces, setEliteForces] = useState<Record<string, number>>({});
  const [eliteSetup, setEliteSetup] = useState<Record<string, number>>({});
  const [moveAsFighters, setMoveAsFighters] = useState(false);
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [leader, setLeader] = useState('');
  const [weapon, setWeapon] = useState('');
  const [defense, setDefense] = useState('');
  const [dial, setDial] = useState(0);
  const [stormDial, setStormDial] = useState(0);
  const stormDialValue = Math.max(
    g.turn === 1 ? 0 : 1,
    Math.min(
      g.turn === 1 ? 20 : 3,
      Number.isFinite(stormDial) ? Math.trunc(stormDial) : 0,
    ),
  );
  const ownBattleForces = g.battle?.ownForces;
  const battleForces = ownBattleForces
    ? ownBattleForces.normal + ownBattleForces.elite
    : g.battle
      ? fighterCount(me, g.battle.territory)
      : 0;
  const battleDialMaximum = ownBattleForces
    ? maxCombatDial(ownBattleForces)
    : g.advanced || me.faction === 'ixians'
      ? 40
      : battleForces;
  const battleDialStep = g.advanced || me.faction === 'ixians' ? 0.5 : 1;
  // A draft carried from a previous battle must show and submit the same bounded value.
  const battleDial = Number.isFinite(dial)
    ? Math.max(
        0,
        Math.min(
          Math.round(dial / battleDialStep) * battleDialStep,
          battleDialMaximum,
        ),
      )
    : 0;
  const [support, setSupport] = useState(0);
  const strongholdBankSupport =
    g.battle?.strongholdEffects[me.id] === 'arrakeen' ? 2 : 0;
  const battleSupportMaximum = Math.min(
    (me.spice ?? 0) + g.aid.available + strongholdBankSupport,
    ownBattleForces
      ? maxCombatSupport(ownBattleForces)
      : Number.POSITIVE_INFINITY,
  );
  const battleSupport = Number.isFinite(support)
    ? Math.max(0, Math.min(Math.trunc(support), battleSupportMaximum))
    : 0;
  const [kwisatz, setKwisatz] = useState(false);
  const [weatherDistance, setWeatherDistance] = useState(0);
  const [turn, setTurn] = useState(1);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [panel, setPanel] = useState<'hand' | 'leaders' | 'log' | 'rules'>(
    'hand',
  );
  const [fremen, setFremen] = useState<Record<string, number>>({
    [FREMEN_START_LOCATIONS[0]]: 10,
  });
  const [aidAmount, setAidAmount] = useState(0);
  const [allyPayment, setAllyPayment] = useState('');
  const [combineSectors, setCombineSectors] = useState(false);
  const [moveNoField, setMoveNoField] = useState(false);
  const [moveForces, setMoveForces] = useState<Record<string, number>>({});
  const [rideForces, setRideForces] = useState<Record<string, number>>({});
  const [exchangeCards, setExchangeCards] = useState<Record<string, boolean>>(
    {},
  );
  const [discardCards, setDiscardCards] = useState<Record<string, boolean>>({});
  const stormLosses = g.decision?.kind === 'stormLosses' ? g.decision : null;
  const committed = battlePlanCommitments(g);
  const selectedStone = me.hand?.find(
    (c) =>
      c.id === (committed.weapon ? committed.weapon.value : weapon) &&
      isStoneBurner(c),
  );
  const stoneContext = g.battle?.stoneBurnerContext;
  const stonePlanReason = !selectedStone
    ? null
    : (stoneContext?.blocked ??
      (!ownBattleForces || !stoneContext?.opponentPools.length
        ? 'Stone Burner needs a supported physical force pool.'
        : (stoneContext.opponentPools
            .map((pool) =>
              stoneBurnerPlanBlock(
                ownBattleForces,
                committed.dial
                  ? Number(committed.dial?.value)
                  : battleDial,
                battleSupport,
                pool,
                g.battle!.attacker === me.id ? 'attacker' : 'defender',
                g.battle!.tieWinner === g.battle!.attacker
                  ? 'attacker'
                  : 'defender',
              ),
            )
            .find((reason) => reason !== null) ?? null)));
  const payment =
    !me.ally || allyPayment === '' ? {} : { allyPayment: Number(allyPayment) };
  const shipmentProblems: string[] = [];
  if (useRicheseShipment && g.nexusRichese?.blocked) shipmentProblems.push(g.nexusRichese.blocked);
  const shipmentMaximum = useRicheseShipment ? Math.min(me.reserves, 5, g.nexusRichese!.maxForces) : me.reserves;
  if (homeworldSources) {
    const homes = g.homeworlds!.worlds!.filter((w) => w.native === me.id);
    if (
      homes.some((home) =>
        (['normal', 'elite'] as const).some((kind) => {
          const n = homeworldSources[home.id]?.[kind];
          return (
            !Number.isSafeInteger(n) || n < 0 || n > home.forces[me.id][kind]
          );
        }),
      )
    )
      shipmentProblems.push(
        'Choose available whole numbers of normal forces and Sardaukar from each Homeworld.',
      );
  }
  if (
    liveShipmentPromises(g.shipmentPromises, me.id, g.turn).some(
      (p) => matchesShipment(p, { territory: selected, amount }) !== p.answer,
    )
  )
    shipmentProblems.push(
      'This shipment conflicts with your Truthtrance answer. Choose a count and destination that honor your shipment promises.',
    );
  const selectedDestinationInStorm = sector !== 0 && sector === g.storm;
  if (selectedDestinationInStorm && !(g.advanced && me.faction === 'fremen'))
    shipmentProblems.push(
      `Sector ${sector} of ${territory(selected).name} is in the storm. Choose a different sector or territory.`,
    );
  if (me.faction === 'fremen' && !fremenReserveEntry(selected))
    shipmentProblems.push(
      `${territory(selected).name} is beyond the Fremen reinforcement area. Choose the Great Flat or a territory within two territories of it.`,
    );
  const validShipmentAmount =
    Number.isInteger(amount) && amount > 0 && amount <= shipmentMaximum;
  if (!validShipmentAmount)
    shipmentProblems.push(
      `Choose a whole number from 1 to ${shipmentMaximum} available reserves.`,
    );
  if (me.elites && validShipmentAmount) {
    const minimum = Math.max(0, amount - (me.reserves - me.elites.reserves));
    const maximum = Math.min(amount, me.elites.reserves);
    if (
      !Number.isInteger(eliteAmount) ||
      eliteAmount < minimum ||
      eliteAmount > maximum
    )
      shipmentProblems.push(
        `Choose ${minimum} to ${maximum} elite forces from reserves.`,
      );
  }
  const shipmentRate = {
    faction: me.faction,
    halfRate:
      me.faction === 'guild' ||
      g.players.some((p) => p.faction === 'guild' && p.id === me.ally) ||
      g.karamaShipping?.player === me.id,
  };
  const shipmentCost = validShipmentAmount
    ? useRicheseShipment
      ? (nexusRicheseQuote(g, selected, amount)?.cost ?? null)
      : reserveShipmentCost(shipmentRate, territory(selected).type, amount)
    : null;
  if (useRicheseShipment && shipmentCost === null && !g.nexusRichese?.blocked)
    shipmentProblems.push('Choose a current Richese Secret Ally shipment of up to five physical forces.');
  const selectedAllyPayment =
    shipmentCost === null
      ? 0
      : !me.ally || allyPayment === ''
        ? Math.max(0, shipmentCost - (me.spice ?? 0))
        : Number(allyPayment);
  const validShipmentShare =
    shipmentCost !== null &&
    Number.isInteger(selectedAllyPayment) &&
    selectedAllyPayment >= 0 &&
    selectedAllyPayment <= shipmentCost;
  if (shipmentCost !== null) {
    if (validShipmentShare) {
      const blocked = homeworldShipmentPaymentBlock(g, shipmentCost, selectedAllyPayment);
      if (blocked) shipmentProblems.push(blocked);
    }
    if (!validShipmentShare)
      shipmentProblems.push(
        `Ally payment must be a whole number from 0 to ${shipmentCost}.`,
      );
    else {
      if (selectedAllyPayment > g.aid.available)
        shipmentProblems.push(
          `Only ${g.aid.available} pledged ally spice is available.`,
        );
      if (shipmentCost - selectedAllyPayment > (me.spice ?? 0))
        shipmentProblems.push(
          'Your spice does not cover your selected share. Adjust the ally payment or ship fewer forces.',
        );
    }
  }
  const shipmentQuote = validShipmentShare
    ? {
        cost: shipmentCost!,
        normalCost: reserveShipmentCost(
          { ...shipmentRate, halfRate: false },
          territory(selected).type,
          amount,
        ),
        ownPayment: shipmentCost! - selectedAllyPayment,
        pledgedPayment: selectedAllyPayment,
      }
    : null;
  const physicalMovementGroup = combineSectors
    ? {
        eliteForces,
        forces: Object.fromEntries(
          Object.entries(moveForces).filter(
            ([key]) =>
              splitLocation(key).territory === splitLocation(source).territory,
          ),
        ),
      }
    : { from: source, amount, elite: eliteAmount };
  const ownNoField =
    g.richeseNoField?.owner === me.id
      ? g.richeseNoField.private?.deployed
      : null;
  const markerAtSource =
    !!ownNoField &&
    !!source &&
    ownNoField.location.territory === splitLocation(source).territory;
  const includesNoField = moveNoField && markerAtSource && !g.homeworldMobility?.noFieldMovementBlocked;
  const physicalDraftEntries = combineSectors
    ? Object.entries(moveForces).filter(
        ([key]) =>
          splitLocation(key).territory === splitLocation(source).territory,
      )
    : source
      ? [[source, amount] as const]
      : [];
  const validMarkerGroup = physicalDraftEntries.every(
    ([key, count]) =>
      Number.isSafeInteger(count) &&
      count >= 0 &&
      count <= (me.forces[key] ?? 0),
  );
  const selectedPhysicalForces = Object.fromEntries(
    physicalDraftEntries.filter(([, count]) => count > 0),
  );
  const markerPhysicalTotal = Object.values(selectedPhysicalForces).reduce(
    (total, count) => total + count,
    0,
  );
  const movementGroup =
    includesNoField && ownNoField
      ? {
          forces: selectedPhysicalForces,
          ...(me.elites ? { eliteForces } : {}),
          noField: ownNoField.tokenId,
          event: g.richeseNoField!.event,
        }
      : physicalMovementGroup;
  const transportAction: Action = {
    type: 'guildShip',
    ...payment,
    ...movementGroup,
    territory: selected,
    sector,
    amount,
  };
  const southernTransportAction: Action = {
    type: 'guildShip',
    from: 'reserves',
    elite: eliteAmount,
    territory: selected,
    sector,
    amount,
    ...payment,
  };
  const returnTransportAction: Action = {
    type: 'guildShip',
    ...payment,
    ...movementGroup,
    territory: 'reserves',
    amount,
  };
  const transportPreview =
    guildTransport && !me.shipped
      ? guildTransportQuote(g, transportAction)
      : null;
  const southernTransportPreview =
    guildTransport && !me.shipped && me.faction === 'fremen'
      ? guildTransportQuote(g, southernTransportAction)
      : null;
  const returnTransportPreview =
    guildTransport && !me.shipped && me.faction === 'guild'
      ? guildTransportQuote(g, returnTransportAction)
      : null;
  const canceledFremenRouteBlocked =
    me.fremenMovementBlocked &&
    physicalDraftEntries.some(
      ([key, count]) =>
        count > 0 &&
        !botGroundMoveAllowed(g, me, key, boardLocation(selected, sector), 0),
    );
  const act = (a: Action) => void send(a);
  const choose = (id: string) => {
    const location = gameTerritories(g).find((candidate) => candidate.id === id);
    if (!location) return;
    setSelected(id);
    setSector(location.sectors[0]);
  };
  const leaderName = (id: string) =>
    id === CHEAP_HERO_TRAITOR
      ? 'Cheap Hero / Heroine'
      : (g.allLeaders.find((l) => l.id === id)?.name ?? id);
  const identityFor = (id: string): LeaderDisplayIdentity | undefined => {
    if (id === CHEAP_HERO_TRAITOR)
      return {
        name: 'Cheap Hero / Heroine',
        factionName: 'Any faction',
        strength: 0,
        cheapHero: true,
      };
    const known = g.allLeaders.find((l) => l.id === id);
    return known
      ? {
          id: known.id,
          name: known.name,
          factionName: faction(known.faction).name,
          strength: leaderStrengthLabel(known),
        }
      : undefined;
  };
  const inspectIdentity = (id: string, kind: LeaderInspectorProps['kind']) => {
    const identity = identityFor(id);
    return identity ? (
      <LeaderInspector kind={kind} identity={identity} />
    ) : null;
  };
  const actionButton = (
    text: string,
    a: Action,
    disabled = false,
    describedBy?: string,
  ) => {
    const promises = liveShipmentPromises(g.shipmentPromises, me.id, g.turn);
    const shipmentBlocked =
      g.phase === 5 &&
      !me.shipped &&
      ['ship', 'guildShip', 'move', 'endMovement'].includes(a.type) &&
      promises.some(
        (p) =>
          matchesShipment(
            p,
            a.type === 'ship' ||
              (a.type === 'guildShip' && a.from === 'reserves')
              ? { territory: String(a.territory), amount: Number(a.amount) }
              : null,
          ) !== p.answer,
      );
    return (
      <Button
        className="game-action"
        aria-describedby={
          [
            describedBy,
            shipmentBlocked ? 'shipment-promise-guidance' : undefined,
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
        disabled={busy || !!g.truthtrance || !!g.nexusTraitors?.pending || disabled || shipmentBlocked}
        onClick={() => act(a)}
      >
        {text}
        <ArrowRight size={15} />
      </Button>
    );
  };
  const destination = (
    <>
      <label>
        Destination
        <select value={selected} onChange={(e) => choose(e.target.value)}>
          {gameTerritories(g).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="destination-sector">
        Sector <HelpTip topic="sector" />
        <select
          id="destination-sector"
          value={sector}
          onChange={(e) => setSector(Number(e.target.value))}
        >
          {territory(selected).sectors.map((s) => (
            <option key={s} value={s}>
              {s === 0
                ? selected === MOBILE_STRONGHOLD
                  ? 'Inside stronghold'
                  : 'Polar sink'
                : s}
              {s === g.storm ? ' · Storm' : ''}
            </option>
          ))}
        </select>
      </label>
    </>
  );
  const amountInput = (
    <>
      <label htmlFor="forces">
        {includesNoField ? 'Physical forces accompanying No-Field' : 'Forces'}
        <Input
          id="forces"
          type="number"
          min={includesNoField ? 0 : 1}
          max={useRicheseShipment && !me.shipped ? shipmentMaximum : 20}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
      </label>
      {me.elites && (
        <EliteCount
          value={eliteAmount}
          onChange={setEliteAmount}
          max={Math.min(amount, me.faction === 'ixians' ? 7 : 5)}
          label={me.faction === 'ixians' ? 'Cyborgs' : 'Elite forces'}
        />
      )}
    </>
  );
  const sourceInput = (
    <label>
      From
      <select
        value={source}
        onChange={(e) => {
          const next = e.target.value;
          setSource(next);
          const markerOnly =
            !!ownNoField &&
            `${ownNoField.location.territory}:${ownNoField.location.sector}` ===
              next &&
            !(me.forces[next] > 0);
          setMoveNoField(markerOnly);
          if (markerOnly) setAmount(0);
          else if (amount === 0) setAmount(1);
        }}
      >
        <option value="">Select your forces or No-Field</option>
        {Object.entries(presenceByLocation(me))
          .filter(([, n]) => n > 0)
          .map(([k, n]) => (
            <option key={k} value={k}>
              {territory(splitLocation(k).territory).name} ·{' '}
              {splitLocation(k).sector} ({me.forces[k] ?? 0} physical forces
              {n > (me.forces[k] ?? 0) ? ' + concealed No-Field' : ''})
            </option>
          ))}
      </select>
    </label>
  );
  return (
    <main className="table-shell live-table">
      <header className="masthead">
        <button
          className="wordmark wordmark-button"
          onClick={onExit}
          aria-label="Return to lobby"
        >
          DUNE<span>ARRAKIS TABLE</span>
        </button>
        <div className="masthead-right">
          <AutomaticActionNotice key={g.code} events={automaticEvents} />
          <span className="status-dot" />
          {g.status === 'lobby' ? 'Gathering players' : `Turn ${g.turn} / 10`}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  `${window.location.origin}/?room=${g.code}`,
                );
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />} {g.code}
          </Button>
        </div>
      </header>
      <div className="game-banner">
        <span className="eyebrow">
          {g.status === 'lobby'
            ? 'WAR COUNCIL'
            : g.status === 'setup'
              ? 'PREPARING THE TABLE'
              : g.status === 'finished'
                ? 'THE FATE OF ARRAKIS'
                : PHASES[g.phase]?.toUpperCase()}
        </span>
        <span>
          {g.status === 'lobby'
            ? `${g.players.length} / 6 seats filled`
            : g.status === 'finished'
              ? g.winner
                  .map(
                    (id) =>
                      faction(g.players.find((p) => p.id === id)!.faction).name,
                  )
                  .join(' + ') || 'No winner'
              : g.automaticContinuationPending
                ? 'Completing the card action'
                : g.truthtrance
                  ? 'Truthtrance in progress'
                  : g.phaseOpening
                    ? 'Phase-opening decisions'
                    : g.response
                      ? 'Karama response in progress'
                      : g.status === 'setup'
                        ? setupStatus
                        : turnOwnerName
                          ? `${turnOwnerName} to act`
                          : 'Simultaneous decisions'}
        </span>
      </div>
      {g.status !== 'lobby' && (
        <nav className="phase-track" aria-label="Turn phases">
          {PHASES.map((p, i) => (
            <span
              key={p}
              className={i === g.phase ? 'current' : i < g.phase ? 'done' : ''}
            >
              <b>{i + 1}</b>
              {p}
            </span>
          ))}
        </nav>
      )}
      {g.sandtrout && (
        <p className="notice">
          Sandtrout is waiting: the next Shai-Hulud card will be suppressed. An
          immediate territory replacement receives double spice.
        </p>
      )}
      {g.spicePeek && (
        <section
          className="private-spice-preview"
          aria-label="Your private spice foresight"
        >
          <div>
            <span className="eyebrow">Private foresight · Atreides</span>
            <h3>{spiceCardTitle(g.spicePeek)}</h3>
            <p className="fine">Only you can see this upcoming card.</p>
          </div>
          <SpiceCardInspector card={g.spicePeek} context="Private foresight" />
        </section>
      )}
      <SeatAutopilot game={g} act={act} busy={transportBusy} />
      <DukeVidal game={g} />
      <MoritaniTerrorSupply game={g} />
      <AmbassadorSupply game={g} />
      <AmbassadorInsights key={`${g.code}-${g.me}`} game={g} />
      <AuditorInsight game={g} />
      <div className="play-grid">
        <aside className="players-panel">
          <div className="eyebrow">THE GREAT HOUSES</div>
          {g.players.map((p) => (
            <div
              key={p.id}
              className={`player-card ${p.id === turnOwner ? 'active-player' : ''}`}
              style={
                {
                  '--faction-color': faction(p.faction).color,
                } as React.CSSProperties
              }
            >
              <div className="player-heading">
                <span className="sigil">{faction(p.faction).sigil}</span>
                <span>
                  <strong>{faction(p.faction).name}</strong>
                  <small>
                    {p.name}
                    {p.id === g.me ? ' · You' : ''}
                    {p.bot ? ` · ${p.bot}` : ''}
                    {p.autopilot ? ` · ${p.autopilot} autopilot` : ''}
                  </small>
                </span>
                {p.ready && g.status === 'lobby' && <Check size={16} />}
              </div>
              <p className="fine">
                Player circle {g.playerPositions[p.id]} · Sector{' '}
                {PLAYER_CIRCLE_SECTORS[g.playerPositions[p.id] - 1]}
              </p>
              {p.id === me.id && g.status === 'lobby' && (
                <div className="player-circle-choice">
                  <label htmlFor="player-circle">Your player circle</label>
                  <select
                    id="player-circle"
                    aria-describedby="player-circle-help"
                    value={g.playerPositions[p.id]}
                    disabled={busy}
                    onChange={(event) =>
                      act({
                        type: 'seatPosition',
                        position: Number(event.target.value),
                      })
                    }
                  >
                    {PLAYER_CIRCLE_SECTORS.map((circleSector, index) => {
                      const occupant = g.players.find(
                        (player) =>
                          player.id !== me.id &&
                          g.playerPositions[player.id] === index + 1,
                      );
                      return (
                        <option
                          key={circleSector}
                          value={index + 1}
                          disabled={!!occupant}
                        >
                          Circle {index + 1} · Sector {circleSector}
                          {occupant ? ` · ${occupant.name}` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <span className="fine" id="player-circle-help">
                    Circles determine storm order. Changing yours resets
                    readiness.
                  </span>
                </div>
              )}
              {p.bot && g.status === 'lobby' && g.host === me.id && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  aria-label={`Remove ${p.name}`}
                  onClick={() => act({ type: 'removeBot', target: p.id })}
                >
                  Remove AI
                </Button>
              )}
              <div className="player-stats">
                <span>{p.reserves} reserves</span>
                <span>{p.tanks} tanks</span>
                {p.noField?.lastUsed !== undefined &&
                  p.noField.lastUsed !== null && (
                    <span>No-Field {p.noField.lastUsed} · last used</span>
                  )}
                {p.elites && (
                  <span>
                    {Object.values(p.elites.forces).reduce((a, b) => a + b, 0)}{' '}
                    elite on Dune
                  </span>
                )}
              </div>
              {p.revealedTraitors.length > 0 && (
                <p className="fine">
                  Revealed traitors:{' '}
                  {p.revealedTraitors.map(leaderName).join(', ')}
                </p>
              )}
              {!!p.revealedFaceDancers.length && (
                <p className="fine">
                  Revealed Face Dancers:{' '}
                  {p.revealedFaceDancers.map(leaderName).join(', ')}
                </p>
              )}
              {g.techTokens &&
                ownedTech(g.techTokens, p.id).map((id) => (
                  <div className="fine" key={id}>
                    {TECH_TOKENS.find((t) => t.id === id)!.name}
                    {g.techTokens![id].spice > 0 &&
                      ` · ${g.techTokens![id].spice} spice at phase end`}
                  </div>
                ))}
              {p.ally && (
                <div className="fine">
                  Allied with{' '}
                  {
                    faction(g.players.find((x) => x.id === p.ally)!.faction)
                      .name
                  }
                </div>
              )}
            </div>
          ))}
          {g.status === 'lobby' &&
            g.host === me.id &&
            g.players.length < 6 &&
            availableBotFactions.length > 0 && (
              <section className="bot-controls" aria-label="Add an AI player">
                <h3>Add an AI player</h3>
                <label>
                  Faction
                  <select
                    value={nextBotFaction}
                    onChange={(e) => setBotFaction(e.target.value)}
                  >
                    {availableBotFactions.map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Difficulty
                  <select
                    value={botDifficulty}
                    onChange={(e) =>
                      setBotDifficulty(e.target.value as Difficulty)
                    }
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <p className="fine">{BOT_DESCRIPTIONS[botDifficulty]}</p>
                {actionButton('Add AI player', {
                  type: 'addBot',
                  faction: nextBotFaction,
                  difficulty: botDifficulty,
                })}
              </section>
            )}
          {me.leaders.some((l) => l.capturedBy) && (
            <p className="fine">
              {me.leaders
                .filter((l) => l.capturedBy)
                .map(
                  (l) =>
                    `${l.name}: ${l.capturedBy === me.id ? 'your captive' : 'captured by Harkonnen'}`,
                )
                .join(' · ')}
            </p>
          )}
          {me.leaders.some((l) => l.gholaBy) && (
            <p className="fine">
              Gholas:{' '}
              {me.leaders
                .filter((l) => l.gholaBy)
                .map(
                  (l) =>
                    `${l.name} · ${l.gholaBy === me.id ? 'your leader pool' : 'Tleilaxu leader pool'}${l.dead ? ' · in the tanks' : ''}`,
                )
                .join(' / ')}
            </p>
          )}
          {me.kwisatz && (
            <p className="fine">
              Kwisatz Haderach:{' '}
              {me.kwisatz.dead
                ? 'awaiting revival'
                : me.kwisatz.active
                  ? 'awakened'
                  : `${me.kwisatz.losses} of 7 battle losses`}
              {me.kwisatz.usedAt
                ? ` · used in ${combatName(me.kwisatz.usedAt)} this turn`
                : ''}
            </p>
          )}
          {g.stormForecast !== null && (
            <p className="fine">
              Your storm forecast: {g.stormForecast} sectors next turn.
            </p>
          )}
          <div className="resource-readout">
            <Coins size={18} />
            <strong>{me.spice ?? 0}</strong>
            <span>
              Your spice <HelpTip topic="spice" />
            </span>
          </div>
          <div className="fine">
            Private hands and spice are visible only to their owner.
          </div>
        </aside>
        <section className="board-column">
          <div className="board-toolbar">
            <span>
              <Wind size={15} />
              Storm · Sector {g.storm}
            </span>
            <div>
              <Button
                variant="ghost"
                aria-label="Zoom out"
                onClick={() => setZoom(Math.max(1, zoom - 0.25))}
              >
                <ZoomOut size={16} />
              </Button>
              <Button
                variant="ghost"
                aria-label="Zoom in"
                onClick={() => setZoom(Math.min(2.5, zoom + 0.25))}
              >
                <ZoomIn size={16} />
              </Button>
            </div>
          </div>
          <div className="board-viewport">
            <svg
              className="game-board"
              style={{ width: `${zoom * 100}%`, maxWidth: 'none' }}
              viewBox="-7 -13 1200 1200"
              role="img"
              aria-label="Arrakis territory map"
            >
              <defs>
                <pattern
                  id="terrain"
                  width="1095"
                  height="1095"
                  patternUnits="userSpaceOnUse"
                >
                  <image
                    href="/art/arrakis-terrain.png"
                    x="45"
                    y="40"
                    width="1095"
                    height="1095"
                    opacity="0.36"
                  />
                </pattern>
                <radialGradient id="sand">
                  <stop offset="0%" stopColor="#66593b" />
                  <stop offset="100%" stopColor="#353b2b" />
                </radialGradient>
              </defs>
              <circle cx="593" cy="587" r="535" fill="url(#sand)" />
              <circle cx="593" cy="587" r="535" fill="url(#terrain)" />
              {PLAYER_CIRCLE_SECTORS.map((circleSector, index) => {
                const angle = ((110 - (circleSector - 1) * 20) * Math.PI) / 180;
                const player = g.players.find(
                  (p) => g.playerPositions[p.id] === index + 1,
                );
                return (
                  <g
                    key={`player-circle-${index}`}
                    className="board-player-circle"
                    transform={`translate(${593 + Math.cos(angle) * 562},${587 + Math.sin(angle) * 562})`}
                  >
                    <title>{`Player circle ${index + 1}, sector ${circleSector}: ${player
                      ? `${player.name} · ${faction(player.faction).name}`
                      : 'Empty'}`}</title>
                    <circle
                      r="21"
                      fill={player ? faction(player.faction).color : '#171b17'}
                      stroke={player?.id === me.id ? '#fff3d6' : '#aa9162'}
                      strokeWidth={player?.id === me.id ? 3 : 1.5}
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#fff3d6"
                      fontSize="17"
                      fontWeight="700"
                    >
                      {index + 1}
                    </text>
                  </g>
                );
              })}
              {g.mobileStronghold?.location && (
                <line
                  x1="1045"
                  y1="150"
                  x2={
                    territory(
                      splitLocation(g.mobileStronghold.location).territory,
                    ).center[0]
                  }
                  y2={
                    territory(
                      splitLocation(g.mobileStronghold.location).territory,
                    ).center[1]
                  }
                  stroke="#a3c8c8"
                  strokeDasharray="7 7"
                  opacity="0.65"
                  pointerEvents="none"
                />
              )}
              {gameTerritories(g).map((t) => (
                <g
                  key={t.id}
                  className={`territory ${t.type} ${selected === t.id ? 'selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${t.name}`}
                  onClick={() => choose(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      choose(t.id);
                    }
                  }}
                >
                  <polygon
                    points={t.points.map((p) => p.join(',')).join(' ')}
                  />
                  <text x={t.center[0]} y={t.center[1]} textAnchor="middle">
                    {t.name}
                  </text>
                </g>
              ))}
              {Array.from({ length: 18 }, (_, i) => {
                const a = (Math.PI / 180) * (120 - i * 20);
                return (
                  <g key={i}>
                    <line
                      x1={593}
                      y1={587}
                      x2={593 + Math.cos(a) * 535}
                      y2={587 + Math.sin(a) * 535}
                      stroke="#dccb9666"
                      strokeDasharray="3 8"
                      pointerEvents="none"
                    />
                    <text
                      x={593 + Math.cos(a - Math.PI / 18) * 516}
                      y={587 + Math.sin(a - Math.PI / 18) * 516}
                      className="sector-label"
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
              <g
                className="storm-overlay"
                style={{
                  transform: `rotate(${-(g.storm - 1) * 20}deg)`,
                  transformOrigin: '593px 587px',
                }}
                pointerEvents="none"
              >
                <path
                  d="M593 587 L325.5 1050.3 A535 535 0 0 0 500.1 1113.9 Z"
                  fill="#d3a24655"
                  stroke="#d7b066"
                  strokeWidth="2"
                />
              </g>
              {gameTerritories(g).flatMap((t) => {
                const present = g.players.filter((p) =>
                  Object.keys(p.forces).some(
                    (k) => splitLocation(k).territory === t.id && p.forces[k],
                  ),
                );
                return present.map((p, i) => (
                  <g
                    key={`${t.id}-${p.id}`}
                    pointerEvents="none"
                    className={`force-token${isAdvisor(p, t.id) ? ' advisor-token' : ''}`}
                    aria-label={`${p.name}: ${isAdvisor(p, t.id) ? 'advisors' : 'fighters'}`}
                    transform={`translate(${t.center[0] + (i - (present.length - 1) / 2) * 27},${t.center[1] + 23})`}
                  >
                    <circle r="13" fill={faction(p.faction).color} />
                    {isAdvisor(p, t.id) && (
                      <circle
                        r="16"
                        fill="none"
                        stroke="#eee8d6"
                        strokeDasharray="3 3"
                        strokeWidth="2"
                      />
                    )}
                    <text textAnchor="middle" y="5">
                      {Object.entries(p.forces)
                        .filter(([k]) => splitLocation(k).territory === t.id)
                        .reduce((n, [, v]) => n + v, 0)}
                    </text>
                  </g>
                ));
              })}
              <NoFieldBoardMarkers players={g.players} />
              <TerrorBoardMarkers tokens={g.moritaniTerror?.tokens ?? []} />
              {Object.entries(g.spice)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => {
                  const t = territory(splitLocation(k).territory);
                  return (
                    <g
                      key={battleCardLabel(k)}
                      pointerEvents="none"
                      transform={`translate(${t.center[0]},${t.center[1] - 25})`}
                    >
                      <rect
                        x="-17"
                        y="-12"
                        width="34"
                        height="20"
                        rx="4"
                        fill="#d3a94e"
                      />
                      <text textAnchor="middle" y="3" className="spice-amount">
                        ◆ {n}
                      </text>
                    </g>
                  );
                })}
            </svg>
          </div>
          <HomeworldTable game={g} />
          <div className="territory-detail">
            <div>
              <span className="eyebrow">
                {territory(selected).type.toUpperCase()}
              </span>
              <h3>{territory(selected).name}</h3>
            </div>
            <span className="fine">
              {selected === MOBILE_STRONGHOLD && g.mobileStronghold?.location
                ? `Points at ${territory(splitLocation(g.mobileStronghold.location).territory).name}, sector ${splitLocation(g.mobileStronghold.location).sector}`
                : `Sectors ${territory(selected).sectors.join(' · ')}`}
            </span>
          </div>
          <div className="territory-units">
            {g.players.flatMap((p) =>
              Object.entries(p.forces)
                .filter(([k]) => splitLocation(k).territory === selected)
                .map(([k, n]) => (
                  <span
                    key={`${p.id}-${k}`}
                    style={{ color: faction(p.faction).color }}
                  >
                    {faction(p.faction).name}: {n}{' '}
                    {isAdvisor(p, selected) ? 'advisors' : 'forces'} in sector{' '}
                    {splitLocation(k).sector}
                  </span>
                )),
            )}
            {g.players
              .filter(
                (p) => p.noField?.deployed?.location.territory === selected,
              )
              .map((p) => (
                <span
                  key={`no-field-detail-${p.id}`}
                  style={{ color: faction(p.faction).color }}
                >
                  {faction(p.faction).name}: concealed No-Field in sector{' '}
                  {p.noField!.deployed!.location.sector} · counts as one force
                </span>
              ))}
          </div>
          {g.status !== 'lobby' && (
            <section
              className="spice-card-table"
              aria-label="Visible spice cards"
            >
              {g.playedOrnithopter && (
                <article className="notice" aria-label="Played movement card">
                  <h3>Ornithopter in play</h3>
                  <p>
                    {
                      g.players.find(
                        (p) => p.id === g.playedOrnithopter!.player,
                      )?.name
                    }{' '}
                    ·{' '}
                    {g.playedOrnithopter.mode === 'range3'
                      ? 'Three-territory group'
                      : 'Two different groups'}{' '}
                    · {g.playedOrnithopter.completed} completed
                  </p>
                  <CardInspector card={g.playedOrnithopter.card} />
                </article>
              )}
              <h3>Spice cards on the table</h3>
              <div className="spice-card-fronts">
                {g.spiceDiscardTop
                  .slice(0, g.advanced ? 2 : 1)
                  .map((card, index) => (
                    <article key={index} className="spice-card-front">
                      <span className="eyebrow">
                        {g.advanced ? `Spice pile ${index + 1}` : 'Spice pile'}{' '}
                        · top card
                      </span>
                      {card ? (
                        <>
                          <strong>{spiceCardTitle(card)}</strong>
                          <SpiceCardInspector
                            card={card}
                            context={`Public spice pile ${index + 1}`}
                          />
                        </>
                      ) : (
                        <p className="fine">No face-up card yet.</p>
                      )}
                    </article>
                  ))}
              </div>
            </section>
          )}
        </section>
        <aside className="action-panel">
          <div className="eyebrow">
            {g.status === 'finished' ? 'FINAL OUTCOME' : 'YOUR NEXT DECISION'}
          </div>
          <PrivateBattlePlan game={g} />
          <NexusCards game={g} act={act} busy={busy} />
          <NexusTraitors game={g} act={act} busy={transportBusy || !!me.autopilot} />
          <NexusTleilaxu game={g} act={act} busy={transportBusy || !!me.autopilot} />
          <NexusSuboids game={g} act={act} busy={transportBusy || !!me.autopilot} />
          <NexusAdvisors game={g} act={act} busy={busy} />
          <NexusSardaukar game={g} act={act} busy={busy} />
          {!g.nexusCards?.waiting.length && <TupileIntelligence game={g} act={act} busy={busy} />}
          {g.biddingEnd && <BiddingEnd game={g} act={act} busy={busy} />}
          {g.junctionTransport && [g.junctionTransport.owner, g.junctionTransport.recipient].includes(me.id) && (
            <JunctionTransport key={me.id === g.junctionTransport.owner ? g.junctionTransport.offerEvent : g.junctionTransport.event} game={g} act={act} busy={busy} />
          )}
          <RicheseNoFieldControls
            game={g}
            act={act}
            busy={busy}
            destination={selected}
            sector={sector}
            allyPayment={allyPayment}
          />
          <RicheseAlliedNoFieldControls
            game={g}
            act={act}
            busy={busy}
            destination={selected}
            sector={sector}
            onSectorChange={setSector}
          />
          {g.nexusCards?.waiting.length ? (
            <p className="muted">The next phase begins when the remaining Nexus card choices are finished.</p>
          ) : g.truthtrance ? (
            <Truthtrance
              key={`${g.truthtrance.queue[0]?.card}-${g.truthtrance.stage}`}
              game={g}
              act={act}
              busy={busy}
            />
          ) : g.status === 'lobby' ? (
            <>
              <h2>Assemble the houses</h2>
              <p className="muted">
                Share the invite above. Every player chooses a faction and
                confirms they are ready.
              </p>
              <label>
                Your faction
                <select
                  value={me.faction}
                  onChange={(e) =>
                    act({ type: 'faction', faction: e.target.value })
                  }
                >
                  {FACTIONS.filter(
                    (f) =>
                      f.expansion === 'base' ||
                      g.expansions.includes(f.expansion),
                  ).map((f) => (
                    <option
                      disabled={g.players.some(
                        (p) => p.id !== me.id && p.faction === f.id,
                      )}
                      value={f.id}
                      key={f.id}
                    >
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!g.techTokens}
                  disabled={busy || g.host !== me.id}
                  onChange={(e) =>
                    act({ type: 'techTokens', enabled: e.target.checked })
                  }
                />
                Tech tokens · optional, 3+ players{' '}
                <HelpTip topic="techTokens" />
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={!!g.strongholdCards}
                  disabled={busy || g.host !== me.id || !g.advanced}
                  onChange={(e) =>
                    act({ type: 'strongholdCards', enabled: e.target.checked })
                  }
                />
                Stronghold Cards · Advanced rules required
              </label>
              {actionButton(me.ready ? 'Not ready' : 'Ready to play', {
                type: 'ready',
              })}
              {g.host === me.id &&
                actionButton(
                  'Begin game',
                  { type: 'start' },
                  g.players.length < (g.techTokens ? 3 : 2) ||
                    !g.players.every((p) => p.ready),
                )}
              <p className="development-note">
                Playable core under development. Advanced rules and expansion
                games are not yet available.
              </p>
            </>
          ) : g.status === 'setup' && !g.decision ? (
            <>
              <h2>
                {setupStage === 'prediction'
                  ? 'Seal the prediction'
                  : setupStage === 'traitors'
                    ? 'Choose your traitor'
                    : setupStage === 'forces'
                      ? 'Place starting forces'
                      : 'Secrets & allegiances'}
              </h2>
              <p className="muted" role="status">
                {setupStatus}
              </p>
              {setupStage && (
                <p className="fine">
                  Setup order: prediction, traitors, starting forces, then the
                  automatic treachery-card deal and Storm phase.
                </p>
              )}
              {(!setupStage || setupStage === 'forces') &&
                g.advanced &&
                me.faction === 'beneGesserit' &&
                !me.advisorSetup && (
                  <>
                    <p className="muted">
                      After Fremen placement, choose a territory and sector on
                      the map for your starting advisor. It becomes a fighter if
                      alone.
                    </p>
                    {destination}
                    {waitingForFremen && (
                      <p className="fine" id="advisor-setup-wait">
                        {setupFremen.name} must finish placing the Fremen forces
                        before you place an advisor.
                      </p>
                    )}
                    {selected === MOBILE_STRONGHOLD && (
                      <p className="fine">
                        Choose a territory on the printed board for your
                        starting advisor.
                      </p>
                    )}
                    {actionButton(
                      'Place starting advisor',
                      { type: 'advisorSetup', territory: selected, sector },
                      waitingForFremen ||
                        me.reserves !== 20 ||
                        selected === MOBILE_STRONGHOLD,
                      waitingForFremen ? 'advisor-setup-wait' : undefined,
                    )}
                  </>
                )}
              {(!setupStage || setupStage === 'traitors') &&
                !!me.traitorChoices?.length && (
                  <>
                    <p className="muted">
                      Keep one traitor. Your selection remains secret.
                    </p>
                    <div className="setup-traitor-choices">
                      {me.traitorChoices.map((id) => (
                        <div key={id} className="traitor-choice">
                          <strong>{leaderName(id)}</strong>
                          {inspectIdentity(id, 'traitor')}
                          {actionButton(`Keep ${leaderName(id)}`, {
                            type: 'traitor',
                            leader: id,
                          })}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              {(!setupStage || setupStage === 'forces') &&
                me.faction === 'fremen' &&
                me.reserves === 20 && (
                  <>
                    <p>Distribute ten forces.</p>
                    {FREMEN_START_LOCATIONS.map((key) => {
                      const loc = splitLocation(key);
                      return (
                        <label key={key} htmlFor={`fremen-${key}`}>
                          {territory(loc.territory).name} · Sector {loc.sector}
                          <Input
                            type="number"
                            min={0}
                            max={10}
                            id={`fremen-${key}`}
                            value={fremen[key] ?? 0}
                            onChange={(e) =>
                              setFremen({
                                ...fremen,
                                [key]: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      );
                    })}
                    {me.elites &&
                      FREMEN_START_LOCATIONS.map((key) => (
                        <EliteCount
                          key={key}
                          label={`Fedaykin in ${territory(splitLocation(key).territory).name}, sector ${splitLocation(key).sector}`}
                          max={Math.min(3, fremen[key] ?? 0)}
                          value={eliteSetup[key] ?? 0}
                          onChange={(n) =>
                            setEliteSetup({ ...eliteSetup, [key]: n })
                          }
                        />
                      ))}
                    <p className="fine">
                      {Object.values(fremen).reduce((a, b) => a + b, 0)} / 10
                      forces assigned
                    </p>
                    {actionButton(
                      'Place forces',
                      {
                        type: 'fremenSetup',
                        placements: fremen,
                        elitePlacements: eliteSetup,
                      },
                      Object.values(fremen).reduce((a, b) => a + b, 0) !== 10,
                    )}
                  </>
                )}
              {(!setupStage || setupStage === 'prediction') &&
                me.faction === 'beneGesserit' &&
                !me.prediction && (
                  <>
                    <label>
                      Predicted victor
                      <select
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                      >
                        <option value="">Choose a faction</option>
                        {g.players
                          .filter((p) => p.id !== me.id)
                          .map((p) => (
                            <option key={p.id} value={p.faction}>
                              {faction(p.faction).name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label htmlFor="predicted-turn">
                      Predicted turn
                      <Input
                        id="predicted-turn"
                        type="number"
                        min={1}
                        max={10}
                        value={turn}
                        onChange={(e) => setTurn(Number(e.target.value))}
                      />
                    </label>
                    {actionButton(
                      'Seal prediction',
                      { type: 'predict', faction: target, turn },
                      !g.players.some(
                        (p) => p.id !== me.id && p.faction === target,
                      ) ||
                        !Number.isInteger(turn) ||
                        turn < 1 ||
                        turn > 10,
                    )}
                  </>
                )}
              {!setupStage && (
                <p className="fine">
                  Play begins when everyone has completed their starting
                  choices.
                </p>
              )}
            </>
          ) : g.status === 'finished' ? (
            <>
              <h2>
                {g.winner.includes(me.id)
                  ? 'Arrakis is yours.'
                  : 'The struggle is over.'}
              </h2>
              <p className="notice">
                {g.winner
                  .map(
                    (id) =>
                      faction(g.players.find((p) => p.id === id)!.faction).name,
                  )
                  .join(' and ')}{' '}
                won on turn {g.turn}.
              </p>
              <p className="muted">
                The battle record remains available below.
              </p>
            </>
          ) : g.phaseOpening ? (
            <>
              <span className="eyebrow">Phase opening</span>
              <h2>Before {PHASES[g.phase]}</h2>
              <p>
                Play Amal now, or pass to begin this phase. Phase effects wait
                until everyone has passed.
              </p>
              {me.hand
                ?.filter((c) => c.effect === 'amal')
                .map((c) => (
                  <div key={c.id}>
                    <p>
                      Amal returns half of every faction’s available spice to
                      the bank, rounded up. Your loss:{' '}
                      {Math.ceil((me.spice ?? 0) / 2)} spice.
                    </p>
                    {actionButton(
                      'Play Amal',
                      { type: 'card', card: c.id },
                      g.phaseOpening!.passed.includes(me.id),
                    )}
                  </div>
                ))}
              {actionButton(
                'Pass phase opening',
                { type: 'ready' },
                g.phaseOpening.passed.includes(me.id),
              )}
              <p className="fine">
                {g.phaseOpening.passed.length} / {g.players.length} passed.
                Playing Amal asks everyone to confirm again.
              </p>
            </>
          ) : g.response ? (
            <>
              <span className="eyebrow">Power response</span>
              <h2>
                {
                  {
                    moritaniAlliance: 'Moritani · Enemy of My Enemy',
                    moritaniRetention: 'Moritani · allied card retention',
                    moritaniDuke: 'Moritani · Duke Vidal acquisition',
                    ecazPlacement: 'Ecaz Ambassador placement',
                    ecazCollection: 'Ecaz stronghold collection',
                    moritaniPlacement:
                      'Moritani Terror placement or relocation',
                    choamRevival: 'CHOAM force revival',
                    revivalLimit: 'Expanded force revival',
                    revivalDiscount: 'Half-price revival',
                    earlyRevival: 'Early leader revival',
                    revivalIncome: 'Tleilaxu revival payment',
                    foreignGhola: 'Tleilaxu foreign ghola revival',
                    ixSubstitution: 'Suboid casualty substitution',
                    ixMovement: 'Cyborg movement',
                    fremenMovement: 'Fremen movement',
                    ixAuction: 'Ixian auction inspection',
                    richeseAuction: 'Richese cache auction',
                    richeseBlackMarket: 'Richese Black Market offer',
                    richesePurchaseIncome: 'Emperor card-purchase income',
                    richeseGift: 'Richese allied card gift',
                    ixTechnology: 'Ixian auction substitution',
                    ixAllyCard: 'Ixian allied purchase replacement',
                    mobileStronghold: 'Mobile stronghold relocation',
                    faceDancerReplacement: 'Replace an unrevealed Face Dancer',
                    voice: 'The Voice',
                    prescience: 'Prescience',
                    nexusPrescience: 'Atreides Nexus Cunning',
                    emperorIncome:
                      g.response.source === 'ambassador'
                        ? 'Emperor card-purchase income'
                        : 'Emperor auction income',
                    harkonnenBonus: 'Harkonnen bonus card',
                    harkonnenTraitor: 'Harkonnen ally traitor',
                    guildIncome: 'Guild shipment income',
                    richeseNoField: 'Richese No-Field shipment',
                    advisor: 'Spiritual advisor',
                    emperorGift: 'Emperor spice gift',
                    emperorRevival: 'Emperor extra revival',
                    bgCharity: 'Bene Gesserit charity',
                    choamCharity: 'CHOAM charity income',
                    choamInflation: 'CHOAM Inflation placement',
                    choamSale: 'CHOAM card sale',
                    choamWorthless: 'CHOAM Worthless card effect',
                    choamBattleIncome: 'CHOAM battle force income',
                    choamAudit: 'CHOAM Auditor inspection',
                    choamBattleAid: 'CHOAM allied combat funding',
                    worthlessKarama: 'Worthless card as Karama',
                    advisorFlip: 'Bene Gesserit token flip',
                    nexusAdvisorFlip: 'Bene Gesserit Nexus advisor conversion',
                    nexusSardaukar: 'Emperor Nexus temporary Sardaukar',
                    eliteStrength: 'Elite battle strength',
                    fremenSupport: 'Fremen full strength without spice',
                    capture: 'Harkonnen leader capture',
                    kwisatz: 'Kwisatz Haderach battle protection',
                    guildTiming: 'Guild shipment and movement timing',
                    atreidesAuction: 'Atreides auction foresight',
                    atreidesSpice: 'Atreides spice foresight',
                    stormPeek: 'Fremen storm foresight',
                    stormProtection: 'Fremen storm survival',
                    wormPlacement: 'Fremen additional worm placement',
                    wormSurvival: 'Fremen worm survival',
                    wormAllyProtection: 'Fremen allied worm protection',
                  }[g.response.kind]
                }
              </h2>
              {g.paymentIncome?.low && (
                <p className="notice">
                  Of the {g.paymentIncome.gross} spice payment,{' '}
                  {g.players.find((player) => player.id === g.paymentIncome?.owner)?.name}
                  {' '}receives {g.paymentIncome.income}. Low-population{' '}
                  {g.paymentIncome.kind === 'shipment' ? 'Junction' : 'Kaitain'}
                  {' '}leaves {g.paymentIncome.bank} spice in the bank. The payer’s cost stays the same.
                </p>
              )}
              {g.response.kind === 'advisor' && (
                <p className="notice">
                  {g.players.find((player) => player.id === g.response?.owner)?.name} declared {g.response.amount ?? 1} free {(g.response.amount ?? 1) === 1 ? 'force' : 'forces'} to {territory(splitLocation(g.response.location ?? 'polar_sink:0').territory).name}.
                  {' '}Allow the arrival or cancel Spiritual Advisors. Canceling prevents the whole declared group.
                </p>
              )}
              {g.response.kind === 'moritaniRetention' &&
                g.moritaniRetentionCard && (
                  <div className="notice">
                    <p>
                      {
                        g.players.find(
                          (player) => player.id === g.moritaniRetention?.player,
                        )?.name
                      }{' '}
                      has declared {g.moritaniRetentionCard.name} to retain
                      after losing the battle. Canceling this power discards all
                      of that player’s played cards.
                    </p>
                    <CardInspector card={g.moritaniRetentionCard} />
                  </div>
                )}
              {g.response.kind === 'moritaniPlacement' &&
                g.moritaniPendingPlacement && (
                  <p className="notice">
                    Your private declaration:{' '}
                    {(() => {
                      const token = g.moritaniTerror?.tokens.find(
                        (t) => t.id === g.moritaniPendingPlacement!.token,
                      );
                      return token && 'kind' in token
                        ? TERROR_DEFINITIONS[token.kind].name
                        : 'Terror token';
                    })()}{' '}
                    into {territory(g.moritaniPendingPlacement.territory).name}.
                    The token has not moved yet.
                  </p>
                )}
              {g.response.kind === 'choamInflation' && (
                <p className="muted">
                  CHOAM will{' '}
                  {g.response.intent === 'double' ? 'double' : 'cancel'} next
                  turn’s charity. The following turn uses the opposite effect.
                  Karama can stop this placement; the later flip and removal are
                  mandatory.
                </p>
              )}
              {g.response.kind === 'choamWorthless' && (
                <p className="notice">
                  CHOAM declared {g.response.intent}.{' '}
                  {g.response.location &&
                    (g.response.intent === 'Jubba Cloak'
                      ? `Protect CHOAM’s forces in ${territory(splitLocation(g.response.location).territory).name} during this storm movement. `
                      : g.response.intent === 'Baliset'
                        ? `Prevent ${g.players.find((p) => p.id === g.response?.recipient)?.name} from moving into ${territory(splitLocation(g.response.location).territory).name}. `
                        : `Selected: ${g.players.find((p) => p.id === g.response?.recipient)?.name}, ${territory(splitLocation(g.response.location).territory).name}, sector ${splitLocation(g.response.location).sector}, ${g.response.elite ? 'elite' : 'ordinary'} force. `)}
                  Karama prevents this card’s effect for this phase and leaves
                  the card in hand.
                </p>
              )}
              {g.response.kind === 'choamBattleIncome' && (
                <p className="notice">
                  CHOAM is due {g.response.amount} spice from other players’
                  force payments. Karama sends this battle’s income to the bank.
                </p>
              )}
              {g.response.kind === 'choamBattleAid' && (
                <p className="notice">
                  Karama can prevent CHOAM funding its ally’s forces for this
                  battle. The ally will then plan using its own spice.
                </p>
              )}
              {g.response.kind === 'choamRevival' && (
                <p className="muted">
                  CHOAM revives paid forces for one spice each with no normal
                  quantity limit. Karama restores the three-force limit and
                  two-spice price for this phase. Tleilaxu permission can still
                  allow five forces.
                </p>
              )}
              {g.response.kind === 'choamCharity' && (
                <p className="muted">
                  CHOAM receives {2 * g.players.length * g.charity.multiplier}{' '}
                  spice before anyone claims charity. Karama cancels this income
                  and sends this turn’s charity payments to the Spice Bank.
                </p>
              )}
              {g.response.kind === 'mobileStronghold' && g.mobileRoute && (
                <>
                  <p>
                    The Ixians declared this route before the storm. Karama
                    cancels both the relocation and its spice collection.
                  </p>
                  <ol>
                    {g.mobileRoute.route.map((key) => {
                      const loc = splitLocation(key);
                      return (
                        <li key={key}>
                          {territory(loc.territory).name} · sector {loc.sector}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="fine">
                    Spice collection{' '}
                    {g.mobileRoute.collect ? 'requested' : 'declined'}.
                  </p>
                </>
              )}
              {g.response.kind === 'fremenMovement' && g.response.location && (
                <p className="notice">
                  {g.response.amount} Fremen forces will move to{' '}
                  {territory(splitLocation(g.response.location).territory).name}
                  , sector {splitLocation(g.response.location).sector}, using
                  their two-territory movement advantage. If canceled, the
                  forces remain in place and Fremen may choose a one-territory
                  move.
                </p>
              )}
              {g.response.kind === 'ixMovement' && g.response.location && (
                <p className="notice">
                  {g.response.amount} forces, including {g.response.elite}{' '}
                  cyborgs, moving to{' '}
                  {territory(splitLocation(g.response.location).territory).name}
                  , sector {splitLocation(g.response.location).sector}.
                </p>
              )}
              <p className="muted">
                {g.players.find((p) => p.id === g.response?.owner)?.name} is
                using this power. Another faction may play Karama to cancel this
                use.
              </p>
              {g.response.kind === 'revivalIncome' &&
                g.response.amount !== undefined && (
                  <p className="notice">
                    {g.response.amount} spice is payable to Tleilaxu after this
                    response.
                  </p>
                )}
              {g.response.source === 'ambassador' && (
                <p className="notice">
                  The Richese Ambassador purchase is already paid and its card
                  has been drawn. Canceling this benefit leaves that purchase
                  unchanged.
                </p>
              )}
              {g.response.intent &&
                g.response.source !== 'ambassador' &&
                g.response.kind !== 'nexusAdvisorFlip' &&
                g.response.kind !== 'nexusSardaukar' &&
                g.response.kind !== 'faceDancerReplacement' && (
                  <p className="notice">{g.response.intent}</p>
                )}
              {me.hand
                ?.filter((c) => g.responseControls?.cancelCards.includes(c.id))
                .map((c) => (
                  <Button
                    key={c.id}
                    className="game-action"
                    disabled={busy}
                    onClick={() =>
                      act({ type: 'card', card: c.id, mode: 'cancel' })
                    }
                  >
                    {c.kind === 'worthless'
                      ? `Use ${c.name} as Karama`
                      : 'Cancel with Karama'}
                  </Button>
                ))}
              {g.responseControls?.cancelCards.length &&
              !g.responseControls.hasPassed ? (
                actionButton('Allow this power', { type: 'passResponse' })
              ) : (
                <p className="muted">
                  {g.responseControls?.hasPassed
                    ? 'You have allowed this power. Waiting for the response to finish.'
                    : 'Waiting for the response to finish.'}
                </p>
              )}
            </>
          ) : g.decision ? (
            <>
              <span className="eyebrow">Player decision</span>
              <h2>
                {g.decision.kind === 'caladanReinforcement'
                  ? 'Caladan victory reinforcement'
                  : g.decision.kind === 'grummanCollection'
                  ? 'Grumman Collection'
                  : g.decision.kind === 'homeworldRevivalDeployment'
                  ? 'Revival deployment'
                  : g.decision.kind === 'ecazSpice'
                  ? 'Shared spice collection'
                  : g.decision.kind === 'stoneBurner'
                    ? 'Stone Burner'
                    : g.decision.kind === 'nullentropy'
                      ? 'Private Nullentropy Box search'
                      : g.decision.kind === 'richeseAllyOpportunity'
                        ? 'Offer allied No-Field shipment'
                        : g.decision.kind === 'richeseAllyShipment'
                          ? 'Allied No-Field shipment'
                          : [
                                'richeseBlackMarket',
                                'richeseDeclaration',
                                'richeseCache',
                                'richeseUnbid',
                              ].includes(g.decision.kind)
                            ? 'Richese auction decision'
                            : g.decision.kind === 'ecazAmbassador'
                              ? 'Ecaz · Ambassador entry effect'
                              : g.decision.kind === 'ecazPlacement'
                                ? 'Ecaz · Ambassador placement'
                                : g.decision.kind === 'moritaniRetention'
                                  ? 'Moritani · allied card retention'
                                  : g.decision.kind === 'moritaniTerror'
                                    ? 'Moritani · Terror entry reaction'
                                    : g.decision.kind === 'moritaniSetup'
                                      ? 'Moritani · final deployment'
                                      : g.decision.kind === 'moritaniPlacement'
                                        ? 'Moritani · hidden Terror placement'
                                        : g.decision.kind === 'choamStorm'
                                          ? 'CHOAM storm protection'
                                          : g.decision.kind === 'choamMovement'
                                            ? 'CHOAM movement response'
                                            : g.decision.kind === 'choamMentat'
                                              ? 'CHOAM’s final Mentat opportunity'
                                              : g.decision.kind ===
                                                  'choamFreeRevival'
                                                ? 'CHOAM free revival response'
                                                : g.decision.kind ===
                                                    'choamBattleFunding'
                                                  ? 'CHOAM battle funding'
                                                  : g.decision.kind ===
                                                      'choamMarket'
                                                    ? 'CHOAM · end of phase'
                                                    : g.decision.kind ===
                                                          'choamTradeReply' ||
                                                        g.decision.kind ===
                                                          'choamTradeConfirm'
                                                      ? 'Allied card exchange'
                                                      : g.decision.kind ===
                                                          'ixSetup'
                                                        ? 'Choose your starting technology'
                                                        : g.decision.kind ===
                                                            'ixAuction'
                                                          ? 'Prepare the auction'
                                                          : g.decision.kind ===
                                                              'ixTechnology'
                                                            ? 'Substitute an auction card'
                                                            : g.decision
                                                                  .kind ===
                                                                'ixAllyCard'
                                                              ? 'Keep or replace your purchase'
                                                              : g.decision
                                                                    .kind ===
                                                                  'mobileStronghold'
                                                                ? g.decision
                                                                    .placement
                                                                  ? 'Place your stronghold'
                                                                  : 'Relocate before the storm'
                                                                : g.decision
                                                                      .kind ===
                                                                    'ixSubstitution'
                                                                  ? 'Retain lost cyborgs'
                                                                  : g.decision
                                                                        .kind ===
                                                                      'revivalStop'
                                                                    ? 'A revival awaits clearance'
                                                                    : g.decision
                                                                          .kind ===
                                                                        'faceDance'
                                                                      ? 'A hidden allegiance'
                                                                      : g
                                                                            .decision
                                                                            .kind ===
                                                                          'poisonTooth'
                                                                        ? 'Activate Poison Tooth?'
                                                                        : g
                                                                              .decision
                                                                              .kind ===
                                                                            'techToken'
                                                                          ? 'Claim a tech token'
                                                                          : g
                                                                                .decision
                                                                                .kind ===
                                                                              'fullPlanOffer'
                                                                            ? 'See the entire battle plan'
                                                                            : g
                                                                                  .decision
                                                                                  .kind ===
                                                                                'guildShipment' || g.decision.kind === 'homeworldShipmentGuild'
                                                                              ? 'A shipment awaits clearance'
                                                                              : g
                                                                                    .decision
                                                                                    .kind ===
                                                                                  'handExchange'
                                                                                ? 'Choose cards to return'
                                                                                : g
                                                                                      .decision
                                                                                      .kind ===
                                                                                      'captureOffer' ||
                                                                                    g
                                                                                      .decision
                                                                                      .kind ===
                                                                                      'capturedLeader'
                                                                                  ? 'A captive leader'
                                                                                  : g
                                                                                        .decision
                                                                                        .kind ===
                                                                                      'guildTiming'
                                                                                    ? 'Choose when to act'
                                                                                    : g
                                                                                          .decision
                                                                                          .kind ===
                                                                                        'stormLosses'
                                                                                      ? 'Survive the storm'
                                                                                      : g
                                                                                            .decision
                                                                                            .kind ===
                                                                                          'wormPlacement'
                                                                                        ? 'Place an additional worm'
                                                                                        : g
                                                                                              .decision
                                                                                              .kind ===
                                                                                            'battleLosses'
                                                                                          ? 'Choose your casualties'
                                                                                          : g
                                                                                                .decision
                                                                                                .kind ===
                                                                                              'auctionPayment'
                                                                                            ? 'Settle your bid'
                                                                                            : [
                                                                                                  'advisor',
                                                                                                  'intrusion',
                                                                                                  'advisorBattle',
                                                                                                ].includes(
                                                                                                  g
                                                                                                    .decision
                                                                                                    .kind,
                                                                                                )
                                                                                              ? 'Advisors & fighters'
                                                                                              : g
                                                                                                    .decision
                                                                                                    .kind ===
                                                                                                  'wormProtection'
                                                                                                ? 'Protection of Shai-Hulud'
                                                                                                : g
                                                                                                      .decision
                                                                                                      .kind ===
                                                                                                    'wormRide'
                                                                                                  ? 'Ride the sandworm'
                                                                                                  : 'Spoils of battle'}
              </h2>
              {g.decision.kind === 'capturedLeader' &&
                (g.decision.controller ?? g.decision.owner) === me.id && (
                  <p className="notice">
                    Your leader {leaderName(g.decision.leader)} was captured.
                  </p>
                )}
              {g.decision.kind === 'choamMovement' &&
                g.decision.player !== me.id && (
                  <p className="notice">
                    {
                      g.players.find(
                        (p) =>
                          p.id ===
                          (g.decision?.kind === 'choamMovement'
                            ? g.decision.mover
                            : ''),
                      )?.name
                    }{' '}
                    has declared a move of {g.decision.amount} forces into{' '}
                    {combatName(g.decision.territory)}, sector{' '}
                    {g.decision.sector}. CHOAM must allow the move or respond
                    with Baliset; no forces have moved yet.
                  </p>
                )}
              {g.decision.kind === 'choamStorm' &&
                g.decision.player !== me.id && (
                  <p className="notice">
                    The storm is waiting for CHOAM to choose protection.
                    Threatened forces:{' '}
                    {g.decision.territories
                      .map(
                        (t) => `${territory(t.territory).name} (${t.amount})`,
                      )
                      .join(', ')}
                    . No storm casualties have been applied.
                  </p>
                )}
              {g.decision.player !== me.id ? (
                <p className="muted">
                  Waiting for{' '}
                  {g.players.find((p) => p.id === g.decision?.player)?.name} to
                  complete this decision.
                </p>
              ) : g.decision.kind === 'nullentropy' ? (
                <NullentropySearch game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'richeseAllyOpportunity' ? (
                <>
                  <p className="fine">
                    Your ally’s shipment is waiting for your optional No-Field
                    offer. Choose the private token, destination and payer in
                    the controls above, or let your ally ship normally.
                  </p>
                  {actionButton('Let ally ship normally', {
                    type: 'decision',
                    decline: true,
                  })}
                </>
              ) : g.decision.kind === 'richeseAllyShipment' ? (
                <RicheseAlliedNoFieldDecision
                  key={g.richeseNoField?.allyOffer?.event}
                  game={g}
                  act={act}
                  busy={busy}
                />
              ) : g.decision.kind === 'richeseBlackMarket' ||
                g.decision.kind === 'richeseDeclaration' ||
                g.decision.kind === 'richeseCache' ||
                g.decision.kind === 'richeseUnbid' ? (
                <RicheseAuctionDecision
                  key={`${g.richeseBidding?.event}-${g.decision.kind}-${g.me}`}
                  game={g}
                  act={act}
                  busy={busy}
                />
              ) : g.decision.kind === 'moritaniRetention' ? (
                <MoritaniRetention game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'moritaniTerror' ? (
                <MoritaniEntry game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'moritaniSetup' ? (
                <>
                  <p>
                    Place six starting forces in one unoccupied territory.
                    Select a territory and sector on the map. Fourteen forces
                    remain in reserves.
                  </p>
                  <p className="muted">
                    Advisors also occupy a territory. The Hidden Mobile
                    Stronghold cannot be chosen.
                  </p>
                  {actionButton(
                    'Place six starting forces',
                    { type: 'decision', territory: selected, sector },
                    !TERRITORIES.some(
                      (t) => t.id === selected && t.sectors.includes(sector),
                    ) ||
                      g.players.some((p) =>
                        Object.entries(p.forces).some(
                          ([key, n]) =>
                            n > 0 && splitLocation(key).territory === selected,
                        ),
                      ),
                  )}
                </>
              ) : g.decision.kind === 'ecazAmbassador' ? (
                <EcazEntry
                  key={`${g.ambassadorEntry?.event}-${g.ambassadorEntry?.stage}-${g.me}`}
                  game={g}
                  act={act}
                  busy={busy}
                />
              ) : g.decision.kind === 'homeworldRevivalDeployment' ? (
                <HomeworldRevivalDeployment game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'caladanReinforcement' ? (
                <CaladanReinforcement game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'grummanCollection' ? (
                <GrummanCollection game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'ecazSpice' ? (
                g.ecazSpice?.allocation ? (
                  <EcazSpice
                    key={`${g.ecazSpice.event}-${g.ecazSpice.allocation.index}-${g.ecazSpice.allocation.player}`}
                    event={g.ecazSpice.event}
                    allocation={g.ecazSpice.allocation}
                    me={me.id}
                    players={g.players}
                    send={send}
                    busy={busy}
                  />
                ) : (
                  <p>Waiting for the current spice allocation.</p>
                )
              ) : g.decision.kind === 'ecazPlacement' ? (
                <EcazPlacement game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'moritaniPlacement' ? (
                <MoritaniPlacement game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'choamStorm' ? (
                <ChoamStorm game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'choamMovement' ? (
                <ChoamBaliset game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'choamMentat' ? (
                <ChoamGamont game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'choamFreeRevival' ? (
                <ChoamWorthless game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'choamBattleFunding' ? (
                <ChoamBattleFunding game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'choamMarket' ||
                g.decision.kind === 'choamTradeReply' ||
                g.decision.kind === 'choamTradeConfirm' ? (
                <ChoamMarket game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'ixSetup' ||
                g.decision.kind === 'ixAuction' ||
                g.decision.kind === 'ixTechnology' ||
                g.decision.kind === 'ixAllyCard' ? (
                <IxTechnology
                  key={`${g.turn}-${g.decision.kind}`}
                  game={g}
                  act={act}
                  busy={busy}
                />
              ) : g.decision.kind === 'mobileStronghold' ? (
                <MobileStronghold
                  key={`${g.turn}-${g.mobileStronghold?.location}`}
                  game={g}
                  act={act}
                  busy={busy}
                />
              ) : g.decision.kind === 'ixSubstitution' ? (
                <IxSubstitution game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'revivalStop' ? (
                <>
                  <p>
                    {
                      g.players.find(
                        (p) =>
                          g.decision?.kind === 'revivalStop' &&
                          p.id === g.decision.recipient,
                      )?.name
                    }{' '}
                    declared a{' '}
                    {g.decision.revival === 'forces' ? 'force' : 'leader'}{' '}
                    revival. Allow it or use your once-per-game special Karama
                    to prevent their normal force and leader revivals for this
                    turn.
                  </p>
                  <HelpTip topic="tleilaxuSpecial" />
                  {g.revival.specialKaramaBlock && (
                    <p role="status">{g.revival.specialKaramaBlock}</p>
                  )}
                  {me.hand
                    ?.filter((c) => c.effect === 'karama')
                    .map((c) => (
                      <div key={c.id}>
                        {actionButton(
                          'Spend special Karama · prevent revival',
                          { type: 'card', card: c.id, mode: 'special' },
                          !!g.revival.specialKaramaBlock,
                        )}
                      </div>
                    ))}
                  {actionButton('Allow this revival', {
                    type: 'decision',
                    decline: true,
                  })}
                </>
              ) : g.decision.kind === 'choamAudit' ||
                g.decision.kind === 'choamAuditPayment' ? (
                <AuditorDecision game={g} act={act} busy={busy} />
              ) : g.decision.kind === 'strongholdCopy' ? (
                <StrongholdCopyChoice
                  event={g.decision.event}
                  choices={g.decision.choices}
                  act={act}
                  busy={busy}
                />
              ) : g.decision.kind === 'stoneBurner' ? (
                <>
                  <RevealedBattle game={g} />
                  <h3>Choose Stone Burner’s effect</h3>
                  <p className="muted">
                    Choose whether both leaders die or surviving leaders
                    contribute no strength. Both choices compare undialed
                    physical force tokens; the choice does not change that
                    comparison. Other weapon effects and traitor precedence
                    still apply.
                  </p>
                  <Link href="/rules?topic=stone-burner">
                    Read Stone Burner rules
                  </Link>
                  {actionButton('Kill both leaders', {
                    type: 'decision',
                    event: g.decision.event,
                    mode: 'kill',
                  })}
                  {actionButton('Ignore surviving leader strength', {
                    type: 'decision',
                    event: g.decision.event,
                    mode: 'ignore',
                  })}
                </>
              ) : g.decision.kind === 'poisonTooth' ? (
                <>
                  <RevealedBattle game={g} />
                  <p className="muted">
                    Choose after reviewing both plans. Activating attacks both
                    leaders, including yours. Chemistry as a defense protects;
                    Snoopers do not. Traitor decisions follow.
                  </p>
                  {actionButton('Activate Poison Tooth', {
                    type: 'decision',
                    activate: true,
                  })}
                  {actionButton('Leave it unused', {
                    type: 'decision',
                    activate: false,
                  })}
                </>
              ) : g.decision.kind === 'faceDance' ? (
                <FaceDanceDecision
                  key={`${g.turn}-${g.decision.territory}-${g.decision.winner}-${g.decision.leader}`}
                  game={g}
                  act={act}
                  busy={busy}
                />
              ) : g.decision.kind === 'techToken' ? (
                <>
                  <p className="muted">
                    Take one tech token from the defeated faction. Holding all
                    three counts as one stronghold for victory.
                  </p>
                  <HelpTip topic="techTokens" />
                  {g.decision.choices.map((token) => (
                    <div key={token}>
                      {actionButton(
                        `Take ${TECH_TOKENS.find((t) => t.id === token)!.name}`,
                        { type: 'decision', token },
                      )}
                    </div>
                  ))}
                </>
              ) : g.decision.kind === 'fullPlanOffer' ? (
                <>
                  <p className="muted">
                    You may spend your once-per-game special Karama to inspect
                    either combatant’s full plan. The chosen player commits
                    first, then only you receive the inspection.
                  </p>
                  <HelpTip topic="fullPlan" />
                  {me.hand
                    ?.filter((c) => c.effect === 'karama')
                    .flatMap((c) =>
                      [g.battle!.attacker, g.battle!.defender].map((id) => (
                        <div key={`${c.id}-${id}`}>
                          {actionButton(
                            `Spend Karama · inspect ${g.players.find((p) => p.id === id)?.name}`,
                            {
                              type: 'card',
                              mode: 'special',
                              card: c.id,
                              target: id,
                            },
                          )}
                        </div>
                      )),
                    )}
                  {actionButton('Keep special power for later', {
                    type: 'decision',
                    decline: true,
                  })}
                </>
              ) : g.decision.kind === 'fullPlanRead' ? (
                <p className="muted">
                  Restoring the saved battle continuation. Your inspection
                  remains available above; no confirmation is needed.
                </p>
              ) : g.decision.kind === 'homeworldShipmentGuild' ? (
                <>
                  <p className="muted">
                    {g.players.find((p) => p.id === (g.decision?.kind === 'homeworldShipmentGuild' ? g.decision.shipper : ''))?.name} declares {g.decision.amount} forces to {combatName(g.decision.destination)}. Allow this shipment or spend your once-per-game special Karama to stop it.
                  </p>
                  <HelpTip topic="guildShipment" />
                  {actionButton('Allow Homeworld shipment', { type: 'decision', event: g.decision.event, allow: true })}
                  {me.hand?.filter((c) => c.effect === 'karama').map((c) => (
                    <div key={c.id}>{actionButton('Spend Karama · stop shipment', { type: 'card', mode: 'special', card: c.id })}</div>
                  ))}
                </>
              ) : g.decision.kind === 'guildShipment' ? (
                <>
                  <p className="muted">
                    {
                      g.players.find(
                        (p) =>
                          p.id ===
                          (g.decision?.kind === 'guildShipment'
                            ? g.decision.shipper
                            : ''),
                      )?.name
                    }{' '}
                    declares {g.decision.amount} forces to{' '}
                    {combatName(g.decision.territory)}, sector{' '}
                    {g.decision.sector}. Allow this shipment or spend your
                    once-per-game special Karama to stop it.
                  </p>
                  <HelpTip topic="guildShipment" />
                  {actionButton('Allow shipment', {
                    type: 'decision',
                    allow: true,
                  })}
                  {me.hand
                    ?.filter((c) => c.effect === 'karama')
                    .map((c) => (
                      <div key={c.id}>
                        {actionButton('Spend Karama · stop shipment', {
                          type: 'card',
                          mode: 'special',
                          card: c.id,
                        })}
                      </div>
                    ))}
                </>
              ) : g.decision.kind === 'handExchange' ? (
                <>
                  <p className="muted">
                    Inspect your combined hand, then return exactly{' '}
                    {g.decision.count} cards to{' '}
                    {
                      g.players.find(
                        (p) =>
                          p.id ===
                          (g.decision?.kind === 'handExchange'
                            ? g.decision.target
                            : ''),
                      )?.name
                    }
                    . You may return cards you just took.
                  </p>
                  <HelpTip topic="handExchange" />
                  {me.hand?.map((c) => (
                    <label className="checkbox-row" key={c.id}>
                      <input
                        type="checkbox"
                        checked={!!exchangeCards[c.id]}
                        onChange={(e) =>
                          setExchangeCards({
                            ...exchangeCards,
                            [c.id]: e.target.checked,
                          })
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                  {actionButton(
                    'Return selected cards',
                    {
                      type: 'decision',
                      returnCards:
                        me.hand
                          ?.filter((c) => exchangeCards[c.id])
                          .map((c) => c.id) ?? [],
                    },
                    me.hand?.filter((c) => exchangeCards[c.id]).length !==
                      g.decision.count,
                  )}
                </>
              ) : g.decision.kind === 'intrusion' ? (
                <>
                  <p className="muted">
                    Another faction entered {combatName(g.decision.territory)}.
                    You may turn every fighter there into an advisor. A Karama
                    response resolves before the flip.
                  </p>
                  {actionButton('Become advisors', {
                    type: 'decision',
                    accept: true,
                  })}
                  {actionButton('Remain fighters', {
                    type: 'decision',
                    accept: false,
                  })}
                </>
              ) : g.decision.kind === 'advisorBattle' ? (
                <>
                  <p className="muted">
                    Before anyone ships, choose where your advisors will fight.
                    Each territory has its own Karama response.
                  </p>
                  {g.decision.territories.map((t) => (
                    <div key={t}>
                      {actionButton(`Prepare in ${territory(t).name}`, {
                        type: 'decision',
                        accept: true,
                        territory: t,
                      })}
                    </div>
                  ))}
                  {actionButton('Keep remaining advisors peaceful', {
                    type: 'decision',
                    accept: false,
                  })}
                </>
              ) : g.decision.kind === 'captureOffer' ? (
                <>
                  <p className="muted">
                    You may capture a random eligible surviving leader from the
                    defeated faction. Inspect the captive before choosing
                    whether to retain or execute them.
                  </p>
                  {actionButton('Capture a leader', {
                    type: 'decision',
                    accept: true,
                  })}
                  {actionButton('Decline capture', {
                    type: 'decision',
                    accept: false,
                  })}
                </>
              ) : g.decision.kind === 'capturedLeader' ? (
                <>
                  <p className="notice">
                    {leaderName(g.decision.leader)} · strength{' '}
                    {
                      me.leaders.find(
                        (l) =>
                          l.id ===
                          (g.decision?.kind === 'capturedLeader'
                            ? g.decision.leader
                            : ''),
                      )?.strength
                    }
                  </p>
                  <p className="muted">
                    Retain this leader for one battle, or execute them for two
                    spice. A survivor returns to their faction after use. If all
                    your own leaders are dead, a retained captive returns
                    immediately.
                  </p>
                  {actionButton('Retain captive', {
                    type: 'decision',
                    mode: 'keep',
                  })}
                  {actionButton('Execute · gain 2 spice', {
                    type: 'decision',
                    mode: 'execute',
                  })}
                </>
              ) : g.decision.kind === 'guildTiming' ? (
                <>
                  <p className="muted">
                    Take your complete shipment and movement now, or let{' '}
                    {
                      g.players.find(
                        (p) =>
                          p.id ===
                          (g.decision?.kind === 'guildTiming'
                            ? g.decision.following
                            : ''),
                      )?.name
                    }{' '}
                    act first. You can decide again before the next player
                    starts.
                  </p>
                  {actionButton('Ship and move now', {
                    type: 'decision',
                    take: true,
                  })}
                  {actionButton('Wait', { type: 'decision', take: false })}
                </>
              ) : g.decision.kind === 'stormLosses' ? (
                <>
                  <p className="muted">
                    Lose {g.decision.amount} forces in{' '}
                    {territory(splitLocation(g.decision.key).territory).name},
                    sector {splitLocation(g.decision.key).sector}. Choose how
                    many Fedaykin are among the losses.
                  </p>
                  {Array.from(
                    {
                      length: stormLosses!.maxElite - stormLosses!.minElite + 1,
                    },
                    (_, i) => stormLosses!.minElite + i,
                  ).map((elite) => (
                    <div key={elite}>
                      {actionButton(
                        `Lose ${elite} Fedaykin + ${stormLosses!.amount - elite} ordinary`,
                        { type: 'decision', elite },
                      )}
                    </div>
                  ))}
                </>
              ) : g.decision.kind === 'wormPlacement' ? (
                <>
                  <p className="muted">
                    An additional worm appeared in this spice blow. Choose a
                    sand territory for its attack.
                  </p>
                  <label>
                    Sand territory
                    <select
                      value={
                        territory(selected).type === 'sand' ? selected : ''
                      }
                      onChange={(e) => choose(e.target.value)}
                    >
                      <option value="" disabled>
                        Choose sand territory
                      </option>
                      {TERRITORIES.filter((t) => t.type === 'sand').map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {actionButton(
                    'Place worm',
                    { type: 'decision', accept: true, territory: selected },
                    territory(selected).type !== 'sand',
                  )}
                  {actionButton('Do not place this worm', {
                    type: 'decision',
                    accept: false,
                  })}
                </>
              ) : g.decision.kind === 'homeworldDefense' ? (
                <>
                  <RevealedBattle game={g} />
                  <h3>Late poison defense</h3>
                  <p className="muted">
                    The Traitor window is complete. You may add Portable Snooper
                    before this Homeworld battle resolves. It protects against
                    ordinary poison, not Poison Tooth.
                  </p>
                  {me.hand
                    ?.filter(
                      (card) =>
                        richeseCardDefinition(card)?.card.effect ===
                        'portableSnooper',
                    )
                    .map((card) => (
                      <div key={card.id}>
                        <CardRules card={card} />
                        <CardInspector card={card} />
                      </div>
                    ))}
                  {actionButton('Use Portable Snooper', {
                    type: 'decision',
                    event: g.decision.event,
                    use: true,
                  })}
                  {actionButton('Keep current defense', {
                    type: 'decision',
                    event: g.decision.event,
                    use: false,
                  })}
                </>
              ) : g.decision.kind === 'homeworldExplosion' ? (
                <>
                  <h3>Native explosion casualties</h3>
                  <p className="muted">
                    The Lasgun–shield explosion limits your native losses at{' '}
                    {combatName(g.decision.territory)} to the Homeworld’s
                    printed battle strength. Choose the physical counters sent
                    to the Tanks; your other native forces remain here.
                  </p>
                  <p className="fine">
                    Available: {g.decision.pool.normal}{' '}
                    {me.faction === 'ixians' ? 'Suboid' : 'ordinary'} and{' '}
                    {g.decision.pool.elite} {specialForceName(me.faction)}{' '}
                    counters.
                  </p>
                  {g.decision.options.map((option, choice) => (
                    <div key={choice}>
                      {actionButton(
                        `Lose ${option.normal} ${me.faction === 'ixians' ? 'Suboid' : 'ordinary'} + ${option.elite} ${specialForceName(me.faction)} counters`,
                        {
                          type: 'decision',
                          event:
                            g.decision?.kind === 'homeworldExplosion'
                              ? g.decision.event
                              : undefined,
                          choice,
                        },
                      )}
                    </div>
                  ))}
                </>
              ) : g.decision.kind === 'battleLosses' ? (
                <>
                  <p className="muted">
                    At {combatName(g.decision.territory)}, choose forces to lose
                    that match your revealed strength and spice support.
                  </p>
                  {g.decision.options.map((option, choice) => (
                    <div key={choice}>
                      {actionButton(
                        `Lose ${option.normal} ${me.faction === 'ixians' ? 'suboids' : 'ordinary'} + ${option.elite} ${me.faction === 'ixians' ? 'cyborgs' : 'elite'}`,
                        { type: 'decision', choice },
                      )}
                    </div>
                  ))}
                </>
              ) : g.decision.kind === 'auctionPayment' ? (
                <>
                  <p className="muted">
                    You won the auction for {g.auction?.bid} spice. Pay the bid
                    or spend a Karama to take the card without paying spice.
                  </p>
                  {actionButton(
                    'Pay with spice',
                    { type: 'decision', karama: false },
                    (g.auction?.bid ?? 0) > (me.spice ?? 0) + g.aid.available,
                  )}
                  {me.hand
                    ?.filter((c) => canUseAsKarama(g.advanced, me.faction, c))
                    .map((c) => (
                      <div key={c.id}>
                        {actionButton(
                          `Spend ${c.name}${c.kind === 'worthless' ? ' as Karama' : ''}`,
                          { type: 'decision', karama: true, card: c.id },
                        )}
                      </div>
                    ))}
                </>
              ) : g.decision.kind === 'advisor' ? (
                <>
                  <p className="muted">
                    Another faction has shipped from off-planet. You may send
                    up to {g.homeworldMobility?.advisorSinkMaximum ?? 1} reserve forces to the Polar Sink for free.
                  </p>
                  {g.guildAmbassadorAdvisorChoices ? (
                    g.guildAmbassadorAdvisorChoices.choices.map((choice) => {
                      const reasonId = `guild-advisor-${choice.accompany}-${choice.territory}-${choice.sector}-${choice.amount}`;
                      return (
                        <div key={reasonId}>
                          {actionButton(
                            choice.accompany
                              ? `Accompany · ${territory(choice.territory).name} · sector ${choice.sector}`
                              : `Send ${choice.amount} to Polar Sink`,
                            {
                              type: 'decision',
                              accept: true,
                              accompany: choice.accompany,
                              territory: choice.territory,
                              sector: choice.sector,
                              amount: choice.amount,
                            },
                            !!choice.blocked,
                            choice.blocked ? reasonId : undefined,
                          )}
                          {choice.blocked && (
                            <p id={reasonId} className="muted">
                              {choice.blocked}
                            </p>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <>
                      {g.advanced &&
                        g.decision.destination &&
                        territory(
                          splitLocation(g.decision.destination).territory,
                        ).sectors.map((s) => (
                          <div key={s}>
                            {actionButton(
                              `Accompany · sector ${s}`,
                              {
                                type: 'decision',
                                accept: true,
                                accompany: true,
                                sector: s,
                              },
                              s !== 0 && s === g.storm,
                            )}
                          </div>
                        ))}
                      {Array.from({length: g.homeworldMobility?.advisorSinkMaximum ?? 1}, (_, index) => (
                        <div key={index}>{actionButton(`Send ${index + 1} to Polar Sink`, {
                          type: 'decision', accept: true, amount: index + 1,
                        })}</div>
                      ))}
                    </>
                  )}
                  {actionButton('Decline shipment', {
                    type: 'decision',
                    accept: false,
                  })}
                </>
              ) : g.decision.kind === 'wormProtection' ? (
                <>
                  <p className="muted">
                    Shai-Hulud has appeared in{' '}
                    {combatName(g.decision.territory)}. You may protect your
                    ally’s forces from being devoured.
                  </p>
                  {actionButton('Protect my ally', {
                    type: 'decision',
                    accept: true,
                  })}
                  {actionButton('Do not protect', {
                    type: 'decision',
                    accept: false,
                  })}
                </>
              ) : g.decision.kind === 'wormRide' ? (
                <>
                  <p className="muted">
                    The Nexus has concluded. Move some or all of your forces
                    from {combatName(g.decision.territory)} to a legal
                    territory. This does not use your normal movement.
                  </p>
                  {Object.entries(me.forces)
                    .filter(
                      ([key, n]) =>
                        n > 0 &&
                        splitLocation(key).territory ===
                          (g.decision as { territory: string }).territory,
                    )
                    .map(([key, n]) => (
                      <label key={key}>
                        From sector {splitLocation(key).sector} · {n} forces
                        <Input
                          type="number"
                          min={0}
                          max={n}
                          disabled={splitLocation(key).sector === g.storm}
                          value={rideForces[key] ?? 0}
                          onChange={(e) =>
                            setRideForces({
                              ...rideForces,
                              [key]: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    ))}
                  {destination}
                  {me.elites &&
                    Object.entries(rideForces)
                      .filter(
                        ([key]) =>
                          splitLocation(key).territory ===
                          (g.decision as { territory: string }).territory,
                      )
                      .map(([key, n]) => (
                        <EliteCount
                          key={key}
                          label={`Fedaykin from sector ${splitLocation(key).sector}`}
                          max={Math.min(n, me.elites!.forces[key] ?? 0)}
                          value={eliteForces[key] ?? 0}
                          onChange={(n) =>
                            setEliteForces({ ...eliteForces, [key]: n })
                          }
                        />
                      ))}
                  {actionButton('Ride Shai-Hulud', {
                    type: 'decision',
                    eliteForces,
                    accept: true,
                    territory: selected,
                    sector,
                    forces: Object.fromEntries(
                      Object.entries(rideForces).filter(
                        ([key]) =>
                          splitLocation(key).territory ===
                          (g.decision as { territory: string }).territory,
                      ),
                    ),
                  })}
                  {actionButton('Stay in this territory', {
                    type: 'decision',
                    accept: false,
                  })}
                </>
              ) : (
                <>
                  <p className="muted">
                    You may keep or discard each card played in this battle.
                    Select the cards you want to discard.
                  </p>
                  <div className="visible-component-list">
                    {g.decision.cards.map((id) => {
                      const card = me.hand?.find((c) => c.id === id);
                      return (
                        <div key={id}>
                          <label className="decision-checkbox">
                            <input
                              type="checkbox"
                              checked={discardCards[id] ?? false}
                              onChange={(e) =>
                                setDiscardCards({
                                  ...discardCards,
                                  [id]: e.target.checked,
                                })
                              }
                            />
                            Discard {card?.name ?? id}
                          </label>
                          {card && <CardInspector card={card} />}
                        </div>
                      );
                    })}
                  </div>
                  {actionButton('Confirm card choices', {
                    type: 'decision',
                    discard: g.decision.cards.filter((id) => discardCards[id]),
                  })}
                </>
              )}
            </>
          ) : (
            <>
              <h2>{PHASES[g.phase]}</h2>
              {g.mentatVictoryPending && (
                <p className="notice">
                  Victory will be checked after Mentat actions, the closing
                  market and CHOAM’s final Trip to Gamont opportunity.
                </p>
              )}
              <details className="phase-guidance">
                <summary>What happens in this phase?</summary>
                <p>{PHASE_HELP[g.phase]}</p>
                <Link
                  href={`/rules#${phaseRuleId(g.phase)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open phase guide ↗
                </Link>
              </details>
              <ChoamBaliset game={g} act={act} busy={busy} />
              <ChoamGamont game={g} act={act} busy={busy} />
              <ChoamWorthless game={g} act={act} busy={busy} />
              <ChoamBattleFunding game={g} act={act} busy={busy} />
              {me.ally && [3, 5].includes(g.phase) && (
                <details className="alliance-funding">
                  <summary>
                    Alliance funding · {g.aid.available} spice available
                  </summary>
                  <p className="muted">
                    Set aside spice for your ally’s purchases this phase.
                    Unspent spice returns when the phase ends. Your current
                    pledge is {g.aid.pledged}.
                  </p>
                  <label htmlFor="ally-pledge">
                    New unspent pledge
                    <Input
                      id="ally-pledge"
                      type="number"
                      min={0}
                      max={(me.spice ?? 0) + g.aid.pledged}
                      value={aidAmount}
                      onChange={(e) => setAidAmount(Number(e.target.value))}
                    />
                  </label>
                  {actionButton('Set ally funding', {
                    type: 'pledgeAid',
                    amount: aidAmount,
                  })}
                  <label htmlFor="ally-payment">
                    Ally’s share of your next payment
                    <Input
                      id="ally-payment"
                      type="number"
                      min={0}
                      max={g.aid.available}
                      value={allyPayment}
                      placeholder="Automatic: cover any shortfall"
                      onChange={(e) => setAllyPayment(e.target.value)}
                    />
                  </label>
                  <p className="fine">
                    Leave blank to use your own spice first.
                  </p>
                </details>
              )}
              {g.phase === 0 && g.stormPending !== null && (
                <>
                  <p className="notice">
                    The storm is set to move {g.stormPending} sectors. Play
                    Weather Control or Family Atomics before confirming.
                  </p>
                  {g.stormRevealed && (
                    <p className="fine">
                      Revealed dials:{' '}
                      {Object.values(g.stormRevealed).join(' + ')}
                    </p>
                  )}
                  {actionButton(
                    g.ready.includes(me.id)
                      ? 'Waiting for the table'
                      : 'Confirm storm movement',
                    { type: 'ready' },
                    g.ready.includes(me.id),
                  )}
                </>
              )}
              {g.phase === 0 && g.stormPending === null && (
                <>
                  <p className="muted">
                    The two storm dialers choose secretly. Their sum moves the
                    storm.
                  </p>
                  {g.stormDialers.includes(me.id) &&
                  !g.stormSubmitted.includes(me.id) ? (
                    <>
                      <label htmlFor="storm-dial">
                        Storm dial
                        <Input
                          id="storm-dial"
                          type="number"
                          min={g.turn === 1 ? 0 : 1}
                          max={g.turn === 1 ? 20 : 3}
                          value={stormDialValue}
                          onChange={(e) => setStormDial(Number(e.target.value))}
                        />
                      </label>
                      {actionButton('Lock storm dial', {
                        type: 'stormDial',
                        amount: stormDialValue,
                      })}
                    </>
                  ) : (
                    <p className="fine">Waiting for secret storm dials.</p>
                  )}
                </>
              )}
              {g.phase === 1 && g.spiceWindow && (
                <p className="notice">
                  {g.spiceWindow.amount} spice revealed in{' '}
                  {territory(g.spiceWindow.territory).name}, sector{' '}
                  {g.spiceWindow.sector}.
                  {g.spiceWindow.sector === g.storm
                    ? ' The storm destroys this blow.'
                    : ''}
                  {g.spiceWindow.harvesters
                    ? ` Harvester has been played ${g.spiceWindow.harvesters} time(s).`
                    : ''}
                  {harvesterAvailable(g.spiceWindow)
                    ? ' You may play Harvester before accepting the blow.'
                    : ' This blow is closed to Harvester.'}
                </p>
              )}
              {g.phase === 1 && g.nexus && !g.spiceWindow && (
                <>
                  <p className="muted">
                    A sandworm has opened a Nexus. Alliances may change now.
                  </p>
                  <label>
                    Alliance partner
                    <select
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                    >
                      <option value="">Choose a player</option>
                      {g.players
                        .filter((p) => p.id !== me.id)
                        .map((p) => (
                          <option value={p.id} key={p.id} disabled={!!g.homeworldAllianceBlocks?.[p.id]}>
                            {p.name}
                            {g.homeworldAllianceBlocks?.[p.id] ? ` · ${g.homeworldAllianceBlocks[p.id]}` : ''}
                            {g.allianceOffers[p.id] === me.id
                              ? ' · Invited you'
                              : ''}
                          </option>
                        ))}
                    </select>
                  </label>
                  {g.homeworldAllianceBlocks?.[target] && <p className="notice">{g.homeworldAllianceBlocks[target]}</p>}
                  {actionButton('Propose / accept alliance', {
                    type: 'alliance',
                    target,
                  }, !target || !!g.homeworldAllianceBlocks?.[target])}
                  {me.ally &&
                    actionButton('Break alliance', { type: 'alliance' })}
                </>
              )}
              {g.phase === 1 && !g.nexus && !g.spiceWindow && (
                <p className="muted">
                  Ready the table to reveal the next spice blow.
                </p>
              )}
              {g.phase === 2 && (
                <>
                  <p className="muted">
                    {g.charity.multiplier === 0
                      ? 'Inflation cancels charity for every faction this turn.'
                      : g.charity.multiplier === 2
                        ? 'Inflation doubles the amount of charity you receive. Ordinary eligibility still requires fewer than two spice; advanced Bene Gesserit receives four regardless of wealth.'
                        : g.advanced && me.faction === 'beneGesserit'
                          ? 'Receive two spice once per turn. If you already hold two or more, opponents may cancel the faction benefit with Karama.'
                          : 'If you have fewer than two spice, claim charity once to reach two.'}
                  </p>
                  <p className="fine">
                    {g.charity.payer
                      ? `The ordinary ${g.charity.ordinary} spice is paid from ${g.players.find((p) => p.id === g.charity.payer)?.name}’s spice.`
                      : 'Charity is paid by the Spice Bank.'}
                    {g.charity.homeworld > 0 &&
                      ` Low Homeworld population adds ${g.charity.homeworld} spice directly from the bank${g.charity.multiplier === 2 ? ' after Inflation doubles the bonus' : ''}.`}
                  </p>
                  {actionButton(
                    g.charity.amount > 0
                      ? `Claim ${g.charity.amount} charity spice`
                      : 'Claim charity',
                    { type: 'charity' },
                    me.charityClaimed ||
                      g.charity.incomePending ||
                      g.charity.amount === 0,
                  )}
                </>
              )}
              {g.phase === 3 && g.richeseAuction && (
                <RicheseAuctionLot
                  key={`${g.richeseAuction.event}-${g.me}`}
                  game={g}
                  act={act}
                  busy={busy}
                />
              )}
              {g.phase === 3 && !g.richeseAuction && g.auction && (
                <>
                  <div className="auction-card">
                    <span className="eyebrow">
                      {g.auction.remaining} CARDS REMAIN
                    </span>
                    <h3>{g.auction.card?.name ?? 'Unknown treachery'}</h3>
                    {g.auction.card && <CardInspector card={g.auction.card} />}
                    {!!g.ixTechnology?.known.length && (
                      <details>
                        <summary>Your inspected pool · order unknown</summary>
                        <ul className="visible-component-list">
                          {g.ixTechnology.known.map((c) => (
                            <li key={c.id}>
                              <span>{c.name}</span>
                              <CardInspector card={c} />
                            </li>
                          ))}
                        </ul>
                        <p className="fine">
                          This records the pool you inspected, including cards
                          already auctioned; it does not reveal the next card or
                          other hands.
                        </p>
                      </details>
                    )}
                    <strong>
                      {g.auction.bid} <small>spice</small>
                    </strong>
                  </div>
                  {g.auction.active === me.id ? (
                    <>
                      <label htmlFor="your-bid">
                        Your bid
                        <Input
                          id="your-bid"
                          type="number"
                          min={minimumBid}
                          max={maximumBid}
                          value={bidAmount}
                          onChange={(e) =>
                            setBidDraft({
                              auction: auctionKey,
                              value: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      <p className="fine">
                        Minimum bid: {minimumBid} spice.
                        {maximumBid < minimumBid &&
                          ' You cannot afford a higher bid; pass this card.'}
                      </p>
                      {actionButton(
                        'Raise bid',
                        {
                          type: 'bid',
                          amount: bidAmount,
                          ...payment,
                        },
                        !Number.isSafeInteger(bidAmount) ||
                          bidAmount > maximumBid,
                      )}
                      {actionButton('Pass this bid', { type: 'passBid' })}
                    </>
                  ) : (
                    <p className="muted">
                      Waiting for{' '}
                      {g.players.find((p) => p.id === g.auction!.active)?.name}.
                    </p>
                  )}
                </>
              )}
              {me.faction === 'emperor' && me.ally && (
                <details className="phase-guide">
                  <summary>Share wealth with your ally</summary>
                  <p className="fine">
                    Spice becomes available immediately after the Karama
                    response.
                  </p>
                  <label htmlFor="emperor-gift">
                    Spice
                    <Input
                      id="emperor-gift"
                      type="number"
                      min={1}
                      max={me.spice ?? 0}
                      value={aidAmount}
                      onChange={(e) => setAidAmount(Number(e.target.value))}
                    />
                  </label>
                  {actionButton(
                    'Share spice',
                    { type: 'emperorGift', amount: aidAmount },
                    aidAmount < 1,
                  )}
                </details>
              )}
              {g.phase === 4 && (
                <>
                  {g.revival.prevented && (
                    <p className="notice">
                      Tleilaxu prevented your normal force and leader revivals
                      this turn. Ghola treachery and the Emperor’s special
                      Karama remain separate.
                    </p>
                  )}
                  <RevivalCommerce game={g} act={act} busy={busy} />
                  {g.revival.homeworldBonus > 0 && (
                    <p className="notice">
                      Low Homeworld population adds one to your free revival
                      rate. The next request uses your population after this
                      group returns.
                      {g.revival.freeBlocked
                        ? ' La La La currently prevents taking any free revivals.'
                        : ''}
                    </p>
                  )}
                  {g.revival.tleilaxuHomeworldIncomeBlocked && (
                    <p className="notice">
                      Tleilax started Revival at low population. Tleilaxu
                      receives no bank reward for other factions’ free revivals
                      this phase; paid revival and Ghola income remain separate.
                    </p>
                  )}
                  {g.revival.freeBlocked && (
                    <p className="notice">
                      La La La prevents your free force revivals for this phase.
                      {me.faction === 'fremen' &&
                      !g.players.some((p) => p.faction === 'tleilaxu')
                        ? ' Fremen cannot purchase normal force revivals without Tleilaxu in the game.'
                        : ' Normal paid revivals remain available.'}
                    </p>
                  )}
                  <p className="fine">
                    {g.revival.limit === 20
                      ? 'No normal force revival limit'
                      : `Up to ${g.revival.limit} force revivals`}{' '}
                    · {g.revival.freeRemaining} free remaining ·{' '}
                    {me.faction === 'fremen' &&
                    !g.players.some((p) => p.faction === 'tleilaxu')
                      ? 'Fremen force revival is free only without Tleilaxu'
                      : me.faction === 'choam' && !g.revival.choamBlocked
                        ? 'One spice per paid force'
                        : 'Standard force prices'}
                    {g.revival.discount
                      ? ' · Tleilaxu half-price discount'
                      : ''}
                  </p>
                  {me.faction === 'fremen' &&
                    me.ally &&
                    !g.freeRevival.includes(me.ally) &&
                    actionButton('Grant ally three free revivals', {
                      type: 'grantRevival',
                    })}
                  {g.freeRevival.includes(me.id) && !g.revival.freeBlocked && (
                    <p className="muted">
                      Fremen allow you up to three free force revivals this
                      phase.
                    </p>
                  )}
                  {amountInput}
                  {me.faction === 'ixians' && (
                    <label>
                      Use free revival for
                      <select
                        value={freeCyborgFirst ? 'cyborg' : 'suboid'}
                        onChange={(e) =>
                          setFreeCyborgFirst(e.target.value === 'cyborg')
                        }
                      >
                        <option value="cyborg">Cyborgs first</option>
                        <option value="suboid">Suboids first</option>
                      </select>
                      <span className="fine">
                        Paid cyborgs cost three spice; suboids cost two. Cyborgs
                        do not share the one-per-turn Sardaukar/Fedaykin limit.
                      </span>
                    </label>
                  )}
                  {me.faction === 'emperor' &&
                    me.ally &&
                    (() => {
                      const ally = g.players.find((p) => p.id === me.ally)!;
                      const cost = paidForceRevivalCost(
                        ally,
                        amount,
                        ally.elites ? allyEliteAmount : 0,
                      );
                      return (
                        <div className="notice">
                          <h3>Extra revivals for {ally.name}</h3>
                          {ally.elites && (
                            <EliteCount
                              label={
                                ally.faction === 'ixians'
                                  ? 'Ally cyborgs'
                                  : 'Ally elite forces'
                              }
                              value={allyEliteAmount}
                              onChange={setAllyEliteAmount}
                              max={Math.min(
                                amount,
                                eliteRevivalRemaining(ally, g.advanced),
                              )}
                            />
                          )}
                          <p className="fine">
                            You pay {cost} spice. These forces use your ally’s
                            separate extra-revival allowance.
                          </p>
                          {actionButton(
                            'Pay for extra ally revivals',
                            {
                              type: 'emperorRevival',
                              amount,
                              elite: ally.elites ? allyEliteAmount : 0,
                            },
                            cost > (me.spice ?? 0) ||
                              amount > 3 - (g.emperorExtra[ally.id] ?? 0),
                          )}
                        </div>
                      );
                    })()}
                  {g.revival.kwisatz &&
                    actionButton(
                      `Revive Kwisatz Haderach · ${g.revival.kwisatz.cost} spice`,
                      {
                        type: 'reviveKwisatz',
                      },
                      !g.revival.kwisatz.affordable,
                    )}
                  {(g.emperorExtra[me.id] ?? 0) > 0 && (
                    <p className="fine">
                      The Emperor revived {g.emperorExtra[me.id]} extra forces
                      for you. Your normal revival allowance is separate.
                    </p>
                  )}
                  {actionButton(
                    'Revive forces',
                    {
                      type: 'revive',
                      amount,
                      elite: eliteAmount,
                      freeElite:
                        me.faction === 'ixians' && !freeCyborgFirst
                          ? Math.max(
                              0,
                              Math.min(amount, g.revival.freeRemaining) -
                                (amount - eliteAmount),
                            )
                          : undefined,
                    },
                    g.revival.prevented ||
                      !me.tanks ||
                      amount > g.revival.forcesRemaining ||
                      !!homeworldRevivalActionBlock(g, { type: 'revive', amount, elite: eliteAmount }),
                  )}
                  {homeworldRevivalActionBlock(g, { type: 'revive', amount, elite: eliteAmount }) && (
                    <p className="fine" aria-live="polite">
                      {homeworldRevivalActionBlock(g, { type: 'revive', amount, elite: eliteAmount })}
                    </p>
                  )}
                  {me.faction === 'fremen' &&
                  amount > g.revival.forcesRemaining ? (
                    <p className="fine">
                      Choose no more than {g.revival.forcesRemaining} available
                      free force revivals. Emperor-funded extras and card
                      effects are separate.
                    </p>
                  ) : (
                    <p className="fine">
                      Selected force revival costs{' '}
                      {
                        forceRevivalPrice(
                          me.faction,
                          amount,
                          eliteAmount,
                          Math.min(amount, g.revival.freeRemaining),
                          g.revival.discount,
                          me.faction === 'ixians' && !freeCyborgFirst
                            ? Math.max(
                                0,
                                Math.min(amount, g.revival.freeRemaining) -
                                  (amount - eliteAmount),
                              )
                            : undefined,
                          g.revival.choamBlocked,
                        ).cost
                      }{' '}
                      spice.
                    </p>
                  )}
                  {g.revival.leaders.length > 0
                    ? (() => {
                        const selectedRevival = g.revival.leaders.find(
                          (choice) => choice.id === leader,
                        );
                        return (
                          <>
                            <label htmlFor="normal-revival-leader">
                              Leader
                              <select
                                id="normal-revival-leader"
                                value={selectedRevival?.id ?? ''}
                                onChange={(e) => setLeader(e.target.value)}
                              >
                                <option value="">
                                  Choose an eligible leader
                                </option>
                                {g.revival.leaders.map((choice) => (
                                  <option value={choice.id} key={choice.id}>
                                    {choice.name} · {choice.cost} spice
                                    {choice.early ? ' · early revival' : ''}
                                    {!choice.affordable
                                      ? ' · insufficient spice'
                                      : ''}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {actionButton(
                              'Revive leader',
                              {
                                type: 'reviveLeader',
                                leader: selectedRevival?.id ?? '',
                              },
                              !selectedRevival?.affordable,
                            )}
                          </>
                        );
                      })()
                    : me.leaders.some(
                        (l) => l.dead && l.faction === me.faction,
                      ) && (
                        <p className="fine">
                          {me.leaderRevived && me.faction !== 'tleilaxu'
                            ? 'You have used your one leader revival for this phase.'
                            : 'No native leader is currently eligible for normal revival.'}
                        </p>
                      )}
                </>
              )}
              {g.phase === 5 && (
                <ShipmentPromises game={g} act={act} busy={busy} />
              )}
              {g.phase === 5 && g.active === me.id && g.homeworldShipment && !me.shipped && (
                <HomeworldShipment key={g.homeworldShipment.event} game={g} act={act} busy={busy} />
              )}
              {g.phase === 5 && g.active === me.id && g.guildHomeworldShipment && !me.shipped && (
                <GuildHomeworldShipment key={g.guildHomeworldShipment.event} game={g} act={act} busy={busy} />
              )}
              {g.phase === 5 && g.homeworldMove && (
                <EmperorHomeworldMovement
                  key={g.homeworldMove.event}
                  game={g}
                  act={act}
                  busy={busy}
                />
              )}
              {g.phase === 5 &&
                me.faction === 'choam' &&
                g.choamMovementBonus > 0 && (
                  <p className="notice">
                    Kulon: +{g.choamMovementBonus} territory of movement range
                    this turn. Storm and entry rules still apply.
                  </p>
                )}
              {g.phase === 5 &&
                g.balisetRestrictions
                  .filter((b) => b.player === me.id)
                  .map((b) => (
                    <p className="notice" key={b.territory}>
                      Baliset: movement into{' '}
                      {
                        gameTerritories(g).find((t) => t.id === b.territory)
                          ?.name
                      }{' '}
                      is blocked while CHOAM occupies it. Shipment remains
                      possible.
                    </p>
                  ))}
              {g.phase === 5 &&
                me.faction === 'fremen' &&
                me.fremenMovementBlocked && (
                  <p className="notice">
                    Karama limited this move to one territory. Your forces have
                    not moved yet. Available ornithopters still allow their
                    normal range; a later extra move can use your two-territory
                    advantage again.
                  </p>
                )}
              {g.phase === 5 && me.faction === 'ixians' && (
                <p className="fine">
                  Select a cyborg to take accompanying suboids two territories.{' '}
                  <HelpTip topic="ixTransport" />
                  {me.ixMovementBlocked &&
                    ' Cyborg speed was canceled for this move; use one territory or available ornithopters.'}
                </p>
              )}
              {g.phase === 5 &&
                (g.active === me.id ? (
                  <>
                    {g.advanced &&
                      me.faction === 'ixians' &&
                      !me.specialKaramaUsed &&
                      g.mobileStronghold?.location &&
                      (me.forces['hidden_mobile_stronghold:0'] ?? 0) > 0 &&
                      me.hand
                        ?.filter((c) => c.effect === 'karama')
                        .slice(0, 1)
                        .map((c) => (
                          <details key={c.id}>
                            <summary>
                              Special Karama: relocate stronghold
                            </summary>
                            <MobileStronghold
                              key={`${g.turn}-${g.mobileStronghold?.location}-${c.id}`}
                              game={g}
                              act={act}
                              busy={busy}
                              card={c.id}
                            />
                          </details>
                        ))}
                    {!me.shipped && g.nexusRichese && (
                      <div className="notice">
                        <label className="decision-checkbox min-h-11">
                          <input type="checkbox" checked={useRicheseShipment}
                            disabled={busy || !!g.nexusRichese.blocked}
                            onChange={(event) => setRicheseShipmentEvent(event.target.checked ? g.nexusRichese!.event : '')} />
                          Use Richese Nexus Secret Ally
                        </label>
                        <p>Spend the Nexus to ship up to five physical forces from reserves at the price of one. This uses your ordinary shipment; movement remains available.</p>
                        {g.nexusRichese.blocked && <p>{g.nexusRichese.blocked}</p>}
                        {useRicheseShipment && <p>Physical forces selected: {amount}. Forces charged: 1. Ordinary destination and faction restrictions still apply.</p>}
                      </div>
                    )}
                    {destination}
                    {amountInput}
                    {g.karamaShipping?.player === me.id && (
                      <p className="fine">
                        Karama shipment: pay Guild rates to the bank. Choose
                        your shipment below.
                      </p>
                    )}
                    {!me.shipped && (
                      <>
                        <NativeShipmentChoice
                          game={g}
                          amount={amount}
                          elite={eliteAmount}
                          sources={homeworldSources}
                          busy={busy}
                          onChange={(sources) =>
                            setHomeworldDraft({
                              key: homeworldSourceKey,
                              sources,
                            })
                          }
                        />
                        <ShipmentQuote
                          id="reserve-shipment-quote"
                          physicalForces={useRicheseShipment ? amount : undefined}
                          quote={shipmentQuote}
                          funding={{
                            ownSpice: me.spice ?? 0,
                            pledgedSpice: g.aid.available,
                          }}
                          unavailableReasons={shipmentProblems}
                        />
                        <Button
                          className="game-action"
                          aria-describedby="reserve-shipment-quote"
                          disabled={
                            busy ||
                            !!g.truthtrance ||
                            shipmentProblems.length > 0
                          }
                          onClick={() => {
                            const shipment: Action = {
                              type: 'ship', elite: eliteAmount, ...payment,
                              territory: selected, sector, amount,
                              ...(homeworldSources ? { homeworldSources } : {}),
                            };
                            const action = useRicheseShipment
                              ? nexusRicheseAction(g, richeseShipmentEvent, shipment) : shipment;
                            if (action) act(action);
                          }}
                        >
                          Ship from reserves <ArrowRight size={15} />
                        </Button>
                      </>
                    )}
                    {sourceInput}
                    {markerAtSource && ownNoField && (
                      <label className="decision-checkbox">
                        <input
                          type="checkbox"
                          checked={includesNoField}
                          disabled={busy || !!g.homeworldMobility?.noFieldMovementBlocked}
                          onChange={(event) =>
                            setMoveNoField(event.target.checked)
                          }
                        />
                        Include concealed No-Field from sector{' '}
                        {ownNoField.location.sector}
                      </label>
                    )}
                    {includesNoField && (
                      <p className="fine">
                        Moving {markerPhysicalTotal} physical forces and one
                        concealed No-Field. Choose zero physical forces to move
                        only the marker. Its hidden value stays unchanged.
                      </p>
                    )}
                    {markerAtSource && g.homeworldMobility?.noFieldMovementBlocked && (
                      <p className="fine">{g.homeworldMobility.noFieldMovementBlocked} Physical forces may still move without the token.</p>
                    )}
                    <label className="decision-checkbox">
                      <input
                        type="checkbox"
                        checked={combineSectors}
                        onChange={(e) => setCombineSectors(e.target.checked)}
                      />
                      Combine forces from this territory’s sectors
                    </label>
                    {combineSectors &&
                      source &&
                      Object.entries(me.forces)
                        .filter(
                          ([key, n]) =>
                            n > 0 &&
                            splitLocation(key).territory ===
                              splitLocation(source).territory,
                        )
                        .map(([key, n]) => (
                          <label key={key}>
                            Sector {splitLocation(key).sector} · {n} forces
                            <Input
                              type="number"
                              min={0}
                              max={n}
                              value={moveForces[key] ?? 0}
                              disabled={splitLocation(key).sector === g.storm}
                              onChange={(e) =>
                                setMoveForces({
                                  ...moveForces,
                                  [key]: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                        ))}
                    {combineSectors &&
                      me.elites &&
                      Object.entries(me.forces)
                        .filter(
                          ([key]) =>
                            splitLocation(key).territory ===
                            splitLocation(source).territory,
                        )
                        .map(([key]) => (
                          <EliteCount
                            key={key}
                            label={`Elite from sector ${splitLocation(key).sector}`}
                            max={Math.min(
                              moveForces[key] ?? 0,
                              me.elites!.forces[key] ?? 0,
                            )}
                            value={eliteForces[key] ?? 0}
                            onChange={(n) =>
                              setEliteForces({ ...eliteForces, [key]: n })
                            }
                          />
                        ))}
                    {g.advanced &&
                      isAdvisor(me, splitLocation(source).territory) && (
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={moveAsFighters}
                            onChange={(e) =>
                              setMoveAsFighters(e.target.checked)
                            }
                          />
                          Request a flip to fighters after entering an occupied
                          territory
                        </label>
                      )}
                    {!g.ornithopter?.active && (
                      <>
                        {actionButton(
                          includesNoField
                            ? 'Move selected forces and No-Field'
                            : 'Move forces',
                          {
                            type: 'move',
                            fighters:
                              moveAsFighters &&
                              isAdvisor(me, splitLocation(source).territory),
                            ...movementGroup,
                            territory: selected,
                            sector,
                            ...(includesNoField ? {} : { amount }),
                          },
                          !source ||
                            canceledFremenRouteBlocked ||
                            selectedDestinationInStorm ||
                            (me.moved ?? 0) >= (me.movesAllowed ?? 1) ||
                            (includesNoField
                              ? !validMarkerGroup
                              : (me.forces[source] ?? 0) === 0),
                          selectedDestinationInStorm
                            ? 'movement-storm-unavailable'
                            : canceledFremenRouteBlocked
                              ? 'movement-range-unavailable'
                              : undefined,
                        )}
                        {canceledFremenRouteBlocked &&
                          !selectedDestinationInStorm && (
                            <p
                              id="movement-range-unavailable"
                              className="fine"
                              role="status"
                            >
                              This route is blocked or beyond your available
                              range. Choose a reachable destination within one
                              territory, or use available ornithopters.
                            </p>
                          )}
                        {selectedDestinationInStorm && (
                          <p
                            id="movement-storm-unavailable"
                            className="fine"
                            role="status"
                          >
                            Movement unavailable: sector {sector} of{' '}
                            {territory(selected).name} is in the storm. Choose a
                            different sector or territory.
                          </p>
                        )}
                      </>
                    )}
                    <OrnithopterMovement
                      game={g}
                      act={act}
                      busy={busy}
                      move={
                        !source ||
                        (me.moved ?? 0) >= (me.movesAllowed ?? 1) ||
                        (includesNoField
                          ? !validMarkerGroup
                          : (me.forces[source] ?? 0) === 0)
                          ? null
                          : {
                              type: 'move',
                              fighters:
                                moveAsFighters &&
                                isAdvisor(me, splitLocation(source).territory),
                              ...movementGroup,
                              territory: selected,
                              sector,
                              ...(includesNoField ? {} : { amount }),
                            }
                      }
                    />
                    <p className="fine">
                      {(me.moved ?? 0) < (me.movesAllowed ?? 1)
                        ? `${(me.movesAllowed ?? 1) - (me.moved ?? 0)} movement remaining.`
                        : 'Movement complete. Finish your turn when your shipment is also settled.'}
                    </p>
                    {transportPreview && (
                      <>
                        <ShipmentQuote
                          id="guild-transport-quote"
                          label={`Guild transport to ${territory(selected).name}`}
                          {...transportPreview}
                        />
                        {actionButton(
                          'Guild transport',
                          transportAction,
                          transportPreview.unavailableReasons.length > 0,
                          'guild-transport-quote',
                        )}
                        {southernTransportPreview && (
                          <>
                            <ShipmentQuote
                              id="southern-transport-quote"
                              label={`Southern reserves to ${territory(selected).name}`}
                              {...southernTransportPreview}
                            />
                            {actionButton(
                              'Cross-ship southern reserves',
                              southernTransportAction,
                              southernTransportPreview.unavailableReasons
                                .length > 0,
                              'southern-transport-quote',
                            )}
                          </>
                        )}
                        {returnTransportPreview && (
                          <>
                            <ShipmentQuote
                              id="return-transport-quote"
                              label="Return to reserves"
                              {...returnTransportPreview}
                            />
                            {actionButton(
                              'Return to reserves',
                              returnTransportAction,
                              returnTransportPreview.unavailableReasons.length >
                                0,
                              'return-transport-quote',
                            )}
                          </>
                        )}
                      </>
                    )}
                    {actionButton('Finish shipment & movement', {
                      type: 'endMovement',
                    })}
                  </>
                ) : (
                  <p className="muted">
                    Waiting for {g.players.find((p) => p.id === g.active)?.name}{' '}
                    to ship and move.
                  </p>
                ))}
              {g.phase === 6 && !g.battle && g.active === me.id && (
                <>
                  <p className="muted">
                    Choose one of your unresolved battles.
                  </p>
                  {botBattleChoices(g).map((battle) => (
                    <div
                      key={`${String(battle.territory)}-${String(battle.target)}`}
                    >
                      {actionButton(
                        `Fight ${g.players.find((p) => p.id === battle.target)?.name} · ${combatName(String(battle.territory))}`,
                        battle,
                      )}
                    </div>
                  ))}
                </>
              )}
              {g.phase === 8 && me.faction === 'choam' && (
                <>
                  <h3>Inflation</h3>
                  {g.inflationUsed ? (
                    <p className="muted">Your Inflation token has been used.</p>
                  ) : g.inflationAttempted ? (
                    <p className="muted">
                      Placement was canceled. You may try again at a later
                      Mentat Pause.
                    </p>
                  ) : (
                    <>
                      <p className="muted">
                        Set next turn’s charity. The token flips at the next
                        Mentat Pause, then leaves the game at the following one.
                        You may save it by marking ready.
                      </p>
                      {actionButton('Double, then cancel', {
                        type: 'choamInflation',
                        side: 'double',
                      })}
                      {actionButton('Cancel, then double', {
                        type: 'choamInflation',
                        side: 'cancel',
                      })}
                    </>
                  )}
                </>
              )}
              {g.battle && (
                <>
                  <p className="battle-location">
                    <Swords size={17} />
                    {g.battle.locationName ?? combatName(g.battle.territory)}
                  </p>
                  {!!g.battle.native && (
                    <p className="notice">
                      Only the native faction may reveal Traitors or Face
                      Dancers here.
                      {[g.battle.attacker, g.battle.defender].includes(
                        g.battle.native,
                      ) && (
                        <>
                          {' '}
                          {
                            g.players.find((p) => p.id === g.battle?.native)
                              ?.name
                          }{' '}
                          adds +{g.battle.nativeBattleStrength} native strength
                          in ordinary strength comparisons, separately from the
                          dial.
                        </>
                      )}
                    </p>
                  )}
                  {g.battle.eliteBlocked.length > 0 && (
                    <p className="notice">
                      Karama:{' '}
                      {g.battle.eliteBlocked
                        .map((id) => g.players.find((p) => p.id === id)?.name)
                        .join(', ')}{' '}
                      counts elite tokens as ordinary forces in this battle.
                    </p>
                  )}
                  {g.battle.fremenSupportBlocked && (
                    <p className="notice">
                      Karama: Fremen must support tokens with spice for full
                      strength in this battle.
                    </p>
                  )}
                  {g.battle.revealed && <RevealedBattle game={g} />}
                  <NexusInspectionHistory game={g} />
                  {(!g.battle.preLeader || g.battle.preLeader.closed) && (
                    <BattlePromises
                      act={act}
                      game={g}
                      busy={busy}
                      fill={(plan) => {
                        setDial(plan.dial);
                        setSupport(plan.support);
                        setAllyPayment(
                          plan.allyPayment === undefined
                            ? ''
                            : String(plan.allyPayment),
                        );
                        setLeader(plan.leader ?? '');
                        setWeapon(plan.weapon ?? '');
                        setDefense(plan.defense ?? '');
                        setKwisatz(!!plan.kwisatz);
                      }}
                    />
                  )}
                  {g.battle.preLeader && !g.battle.preLeader.closed ? (
                    <BattleLeaderOpportunity game={g} act={act} busy={busy} />
                  ) : g.battle.preparation ? (
                    <BattlePreparation
                      key={`${g.battle.event}-${g.battle.preparation.kind}-${g.battle.preparation.kind === 'nexusPrescienceAnswer' ? g.battle.nexusInspection?.field : g.battle.prescience?.field ?? ''}`}
                      game={g}
                      send={send}
                      busy={busy}
                    />
                  ) : g.battle.fullPlan &&
                    !g.battle.submitted.includes(g.battle.fullPlan.target) &&
                    g.battle.fullPlan.target !== me.id ? (
                    <p className="notice">
                      Waiting for{' '}
                      {
                        g.players.find(
                          (p) => p.id === g.battle!.fullPlan!.target,
                        )?.name
                      }{' '}
                      to commit the plan requested by Atreides.
                    </p>
                  ) : [g.battle.attacker, g.battle.defender].includes(me.id) ? (
                    g.battle.revealed ? (
                      <>
                        {!g.battle.traitorSubmitted.includes(me.id) && (
                          <>
                            {actionButton(
                              'Reveal traitor',
                              {
                                type: 'traitorCall',
                                call: true,
                              },
                              !canRevealTraitor,
                            )}
                            {!canRevealTraitor && (
                              <p className="fine">{noTraitorReason}</p>
                            )}
                            {actionButton('No traitor — resolve', {
                              type: 'traitorCall',
                              call: false,
                            })}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {g.battle.insight && (
                          <p className="notice">
                            {committed[g.battle.insight.field]
                              ? 'Your committed element'
                              : 'Prescience'}
                            : {g.battle.insight.field} ={' '}
                            {g.battle.insight.label}
                          </p>
                        )}
                        {g.battle.voice && (
                          <p className="notice">
                            Voice:{' '}
                            {g.battle.voice.must ? 'must play' : 'cannot play'}{' '}
                            {battleCardLabel(g.battle.voice.kind)}.
                          </p>
                        )}
                        {!g.battle.submitted.includes(me.id) ? (
                          <>
                            <label htmlFor="forces-dialed">
                              Forces dialed <HelpTip topic="dial" />
                              {me.faction === 'ixians' && (
                                <HelpTip topic="ixForces" />
                              )}
                            </label>
                            <BattleWheel
                              id="forces-dialed"
                              max={battleDialMaximum}
                              step={battleDialStep}
                              value={
                                committed.dial
                                  ? Number(committed.dial?.value)
                                  : battleDial
                              }
                              disabled={busy || !!committed.dial}
                              onChange={setDial}
                            />
                            <p className="fine">
                              {ownNoField &&
                              g.battle.noFieldPlayers.includes(me.id)
                                ? `Your concealed No-Field can reveal ${battleForces} physical forces from your current reserves. This estimate is private.`
                                : `You have ${battleForces} fighting forces here.`}
                            </p>
                            {!!ownBattleForces?.temporaryElite && (
                              <p className="notice">
                                {ownBattleForces.temporaryElite} ordinary counters count as Sardaukar for this battle. Their losses are ordinary counters, not starred Sardaukar.
                              </p>
                            )}
                            {ownBattleForces?.normalFreeSupport && (
                              <p className="notice">
                                Your Suboids fight at full strength without spice support this turn. Spice support here applies only to Cyborgs.
                              </p>
                            )}
                            {ownBattleForces?.eliteFreeSupport && (
                              <p className="notice">
                                Salusa Secundus is at high population. Your
                                Sardaukar fight at their full current strength
                                without spice support; normal forces still
                                require support.
                              </p>
                            )}
                            {g.advanced &&
                              (me.faction !== 'fremen' ||
                                g.battle.fremenSupportBlocked) && (
                                <label htmlFor="battle-spice">
                                  Spice support
                                  {strongholdBankSupport > 0 && (
                                    <span className="fine">
                                      {' '}
                                      · Bank pays{' '}
                                      {Math.min(
                                        battleSupport,
                                        strongholdBankSupport,
                                      )}
                                      ; personal and allied payment{' '}
                                      {Math.max(
                                        0,
                                        battleSupport - strongholdBankSupport,
                                      )}
                                    </span>
                                  )}
                                  <Input
                                    id="battle-spice"
                                    type="number"
                                    min={0}
                                    max={battleSupportMaximum}
                                    value={battleSupport}
                                    onChange={(e) =>
                                      setSupport(Number(e.target.value))
                                    }
                                  />
                                </label>
                              )}
                            {g.advanced && g.aid.available > 0 && (
                              <>
                                <p className="fine">
                                  CHOAM has reserved {g.aid.available} spice for
                                  your support. Leave its share blank to cover
                                  only your shortfall.
                                </p>
                                <label htmlFor="battle-ally-payment">
                                  CHOAM’s share of this support payment
                                  <Input
                                    id="battle-ally-payment"
                                    type="number"
                                    min={0}
                                    max={Math.min(
                                      battleSupport,
                                      g.aid.available,
                                    )}
                                    value={allyPayment}
                                    onChange={(e) =>
                                      setAllyPayment(e.target.value)
                                    }
                                  />
                                </label>
                              </>
                            )}
                            <label htmlFor="battle-leader">
                              Leader <HelpTip topic="leader" />
                              <select
                                id="battle-leader"
                                value={
                                  committed.leader
                                    ? String(committed.leader?.value ?? '')
                                    : leader
                                }
                                disabled={!!committed.leader}
                                onChange={(e) => setLeader(e.target.value)}
                              >
                                <option value="">No leader</option>
                                {me.leaders
                                  .filter(
                                    (l) =>
                                      !l.dead &&
                                      controlsLeader(me, l) &&
                                      (!l.usedAt ||
                                        l.usedAt === g.battle?.territory),
                                  )
                                  .map((l) => (
                                    <option key={l.id} value={l.id}>
                                      {l.name} · {leaderStrengthLabel(l)}
                                    </option>
                                  ))}
                                {me.hand
                                  ?.filter((c) => c.kind === 'hero')
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} · 0
                                    </option>
                                  ))}
                              </select>
                            </label>
                            {[
                              ['Weapon', weapon, setWeapon],
                              ['Defense', defense, setDefense],
                            ].map(([name, v, fn]) => (
                              <label
                                key={String(name)}
                                htmlFor={`battle-${String(name).toLowerCase()}`}
                              >
                                {String(name)}{' '}
                                <HelpTip
                                  topic={
                                    name === 'Weapon' ? 'weapon' : 'defense'
                                  }
                                />
                                <select
                                  id={`battle-${String(name).toLowerCase()}`}
                                  value={
                                    committed[name === 'Weapon' ? 'weapon' : 'defense']
                                      ? String(committed[name === 'Weapon' ? 'weapon' : 'defense']!.value ?? '')
                                      : (v as string)
                                  }
                                  disabled={
                                    !!committed[name === 'Weapon' ? 'weapon' : 'defense']
                                  }
                                  onChange={(e) =>
                                    (fn as (s: string) => void)(e.target.value)
                                  }
                                >
                                  <option value="">None</option>
                                  {me.hand
                                    ?.filter((c) =>
                                      name === 'Defense'
                                        ? isDefenseCard(c)
                                        : isWeaponCard(c),
                                    )
                                    .map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                </select>
                              </label>
                            ))}
                            {selectedStone && (
                              <div className="my-3 flex flex-col gap-3">
                                <p>
                                  Stone Burner compares undialed physical
                                  tokens, not dialed strength. Its leader effect
                                  is chosen after both plans are revealed.
                                </p>
                                <CardInspector card={selectedStone} />
                                {stonePlanReason && (
                                  <p className="notice" role="status">
                                    {stonePlanReason}
                                  </p>
                                )}
                              </div>
                            )}
                            {me.leaders.some((l) => l.capturedBy) && (
                              <p className="fine">
                                {me.leaders
                                  .filter((l) => l.capturedBy)
                                  .map(
                                    (l) =>
                                      `${l.name}: ${l.capturedBy === me.id ? 'your captive' : 'captured by Harkonnen'}`,
                                  )
                                  .join(' · ')}
                              </p>
                            )}
                            {me.kwisatz && (
                              <label>
                                <input
                                  type="checkbox"
                                  checked={kwisatz}
                                  onChange={(e) => setKwisatz(e.target.checked)}
                                  disabled={
                                    !me.kwisatz.active ||
                                    me.kwisatz.dead ||
                                    g.battle.kwisatzBlocked ||
                                    (!!me.kwisatz.usedAt &&
                                      me.kwisatz.usedAt !== g.battle.territory)
                                  }
                                />
                                Use Kwisatz Haderach (+2; prevents traitors)
                              </label>
                            )}
                            {g.battle.fullPlan?.target === me.id && (
                              <p className="notice">
                                This commits your complete plan for Atreides’
                                private inspection. Your opponent’s plan stays
                                hidden until the public reveal.
                              </p>
                            )}
                            {actionButton(
                              g.battle.fullPlan?.target === me.id
                                ? 'Commit plan for inspection'
                                : 'Seal battle plan',
                              bindBattlePlanCommitments(g, {
                                type: 'battlePlan',
                                ...(g.aid.available > 0 && allyPayment !== ''
                                  ? { allyPayment: Number(allyPayment) }
                                  : {}),
                                support:
                                  me.faction === 'fremen' &&
                                  !g.battle.fremenSupportBlocked
                                    ? 0
                                    : battleSupport,
                                kwisatz:
                                  kwisatz &&
                                  !!me.kwisatz?.active &&
                                  !me.kwisatz.dead &&
                                  !g.battle.kwisatzBlocked &&
                                  (!me.kwisatz.usedAt ||
                                    me.kwisatz.usedAt === g.battle.territory),
                                dial: battleDial,
                                leader,
                                weapon,
                                defense,
                              }),
                              !!stonePlanReason,
                            )}
                          </>
                        ) : (
                          <p className="muted">
                            Your plan is sealed. Waiting for your opponent.
                          </p>
                        )}
                      </>
                    )
                  ) : g.battle.revealed &&
                    g.battle.traitorVoters.includes(me.id) ? (
                    <>
                      <p className="muted">
                        Your ally is fighting. You may reveal a traitor against
                        their opponent.
                      </p>
                      {!g.battle.traitorSubmitted.includes(me.id) ? (
                        <>
                          {actionButton(
                            'Reveal ally’s opponent as traitor',
                            {
                              type: 'traitorCall',
                              call: true,
                            },
                            !canRevealTraitor,
                          )}
                          {!canRevealTraitor && (
                            <p className="fine">{noTraitorReason}</p>
                          )}
                          {actionButton('Decline traitor support', {
                            type: 'traitorCall',
                            call: false,
                          })}
                        </>
                      ) : (
                        <p className="muted">
                          Waiting for the other traitor decisions.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="muted">
                      {g.battle.revealed
                        ? 'The table is completing traitor decisions.'
                        : 'The combatants are preparing their plans.'}
                    </p>
                  )}
                </>
              )}
              {[1, 2, 4, 7, 8].includes(g.phase) &&
                actionButton(
                  g.ready.includes(me.id)
                    ? 'Waiting for the table'
                    : g.spiceWindow
                      ? 'Accept spice blow'
                      : 'Ready for next phase',
                  { type: 'ready' },
                  g.ready.includes(me.id),
                )}
            </>
          )}
        </aside>
      </div>
      {g.inflation && (
        <p className="notice" role="status">
          Inflation · {g.inflation.side === 'double' ? 'DOUBLE' : 'CANCEL'} ·{' '}
          {g.phase === 8 && g.inflation.updatedTurn === g.turn
            ? 'Next turn’s charity'
            : 'This turn’s charity'}
          {g.inflation.side === 'double' ? ' · Bribes prohibited' : ''}
          {g.inflation.flipped
            ? ' · Removed at the next Mentat Pause'
            : ' · Flips at the next Mentat Pause'}
        </p>
      )}
      <TruthHistory game={g} />
      <section className="player-console">
        <nav className="console-tabs">
          {(['hand', 'leaders', 'log', 'rules'] as const).map((p) => (
            <button
              aria-pressed={panel === p}
              className={panel === p ? 'selected' : ''}
              onClick={() => setPanel(p)}
              key={p}
            >
              {p === 'hand'
                ? `Your private hand · ${me.hand?.length ?? 0} / ${me.handLimit}`
                : p === 'leaders'
                  ? 'Your leaders'
                  : p === 'log'
                    ? 'Table chronicle'
                    : 'Rules coverage'}
            </button>
          ))}
        </nav>
        {panel === 'hand' ? (
          <>
            <ChoamCashIn game={g} act={act} busy={busy} />
            <RicheseSpecialKarama game={g} act={act} busy={busy} />
            <RicheseGift game={g} act={act} busy={busy} />
            <Distrans game={g} act={act} busy={busy} />
            <JuiceOfSapho game={g} act={act} busy={busy} />
            <NullentropyBox game={g} act={act} busy={busy} />
            <ResidualPoison game={g} act={act} busy={busy} />
            <PortableSnooper game={g} act={act} busy={busy} />
            <div className="hand-grid">
              {me.hand?.map((c) => {
                const richese = richeseCardDefinition(c);
                const presentation = cardPresentation(c);
                const block =
                  (richese?.card.effect === 'distrans'
                    ? 'Use the Distrans transfer panel above to choose a recipient and another card.'
                    : richese?.card.effect === 'nullentropyBox'
                      ? 'Use the Nullentropy Box panel above to begin the paid search.'
                      : richeseCardActionBlock(c)) ??
                  (canUseAsKarama(g.advanced, me.faction, c)
                    ? g.response
                      ? !g.responseControls?.cancelCards.includes(c.id)
                        ? 'This card cannot cancel the current power.'
                        : null
                      : g.decision
                        ? 'Finish the pending decision before taking an auction card.'
                        : g.phase !== 3 || !g.auction || g.richeseAuction
                          ? 'The Karama purchase option needs an ordinary auction in progress.'
                          : (me.hand?.length ?? 0) >= me.handLimit
                            ? 'Your hand must have room before a Karama auction purchase.'
                            : null
                    : null);
                const gholaBlock =
                  c.effect !== 'ghola'
                    ? null
                    : !g.ghola.available
                      ? g.ghola.reason
                      : !g.ghola.cards.includes(c.id)
                        ? 'This card is reserved for the Black Market auction.'
                        : leader
                          ? (
                              leader === 'kwisatz'
                                ? g.ghola.kwisatz
                                : g.ghola.leaders.some((l) => l.id === leader)
                            )
                            ? null
                            : 'Choose a currently eligible leader.'
                          : !Number.isSafeInteger(amount) ||
                              amount < 1 ||
                              amount > g.ghola.maxForces
                            ? `Choose between 1 and ${g.ghola.maxForces} eligible forces.`
                            : !Number.isSafeInteger(eliteAmount) ||
                                eliteAmount <
                                  Math.max(
                                    0,
                                    amount -
                                      (me.tanks - (me.elites?.tanks ?? 0)),
                                  ) ||
                                eliteAmount >
                                  Math.min(amount, g.ghola.eliteRemaining)
                              ? 'Choose an eligible number of elite forces.'
                              : null;
                const availability =
                  block || gholaBlock
                    ? {
                        available: false as const,
                        reason: block || gholaBlock!,
                      }
                    : ordinaryCardAvailability(
                        g,
                        c.id,
                        c.effect === 'weather'
                          ? { amount: weatherDistance }
                          : undefined,
                      );
                return (
                  <article
                    className={`treachery-card card-${richese ? presentation.role : c.kind}`}
                    key={c.id}
                  >
                    <span className="eyebrow">
                      {richese
                        ? presentation.category
                        : battleCardLabel(c.kind)}
                    </span>
                    <h3>{c.name}</h3>
                    <CardRules card={c} />
                    <CardInspector card={c} />
                    {availability && !availability.available && (
                      <p
                        className="card-unavailable"
                        id={`card-unavailable-${c.id}`}
                      >
                        {availability.reason}
                      </p>
                    )}
                    {!availability &&
                      g.status === 'setup' &&
                      !g.response &&
                      c.effect !== 'truthtrance' && (
                        <p className="fine">
                          Finish setup before using this card.
                        </p>
                      )}
                    <span className="card-mark">
                      {richese
                        ? presentation.role === 'weapon'
                          ? '†'
                          : presentation.role === 'defense'
                            ? '◇'
                            : '✧'
                        : c.kind === 'special'
                          ? '✧'
                          : c.kind === 'shield' || c.kind === 'snooper'
                            ? '◇'
                            : '†'}
                    </span>
                    {c.effect === 'truthtrance' && (
                      <>
                        <p className="fine">
                          Ask another player a public yes/no question, including
                          during another player’s decision. Competing plays
                          follow storm order.
                        </p>
                        <Button
                          variant="outline"
                          disabled={
                            busy ||
                            !!g.truthtrance ||
                            !['setup', 'playing'].includes(g.status)
                          }
                          onClick={() => act({ type: 'card', card: c.id })}
                        >
                          Declare Truthtrance
                        </Button>
                        {(me.hand?.filter(
                          (other) => other.effect === 'truthtrance',
                        ).length ?? 0) > 1 && (
                          <Button
                            variant="outline"
                            disabled={
                              busy ||
                              !!g.truthtrance ||
                              !['setup', 'playing'].includes(g.status)
                            }
                            onClick={() =>
                              act({
                                type: 'card',
                                card: c.id,
                                cards: me
                                  .hand!.filter(
                                    (other) =>
                                      other.effect === 'truthtrance' &&
                                      other.id !== c.id,
                                  )
                                  .map((other) => other.id),
                              })
                            }
                          >
                            Declare both Truthtrances
                          </Button>
                        )}
                      </>
                    )}
                    {c.effect === 'amal' && (
                      <p className="fine">
                        At a phase opening, every faction returns half its
                        available spice to the bank, rounded up. Play before
                        everyone passes.
                      </p>
                    )}
                    {c.effect === 'thumper' && (
                      <p className="fine">
                        Play before the first spice draw to resolve Shai-Hulud
                        without drawing a card. Fremen protection, rides, Nexus
                        and a waiting Sandtrout apply.
                      </p>
                    )}
                    {c.effect === 'ghola' && (
                      <>
                        {g.ghola.eliteBlock && (
                          <p className="fine">{g.ghola.eliteBlock}</p>
                        )}
                        {homeworldRevivalActionBlock(g, { type: 'card', card: c.id, amount, elite: eliteAmount, leader: leader || undefined }) && (
                          <p className="fine" aria-live="polite">
                            {homeworldRevivalActionBlock(g, { type: 'card', card: c.id, amount, elite: eliteAmount, leader: leader || undefined })}
                          </p>
                        )}
                        <label htmlFor={`ghola-${c.id}`}>
                          Forces to revive (or choose a leader)
                          <Input
                            id={`ghola-${c.id}`}
                            type="number"
                            min={1}
                            max={g.ghola.maxForces}
                            value={amount}
                            onChange={(e) => setAmount(Number(e.target.value))}
                          />
                        </label>
                        {me.elites && (
                          <EliteCount
                            label={
                              me.faction === 'ixians'
                                ? 'Cyborgs to revive'
                                : 'Elite forces to revive'
                            }
                            value={eliteAmount}
                            onChange={setEliteAmount}
                            max={Math.min(amount, g.ghola.eliteRemaining)}
                          />
                        )}
                        <label>
                          Revival target
                          <select
                            value={leader}
                            onChange={(e) => setLeader(e.target.value)}
                          >
                            <option value="">Forces</option>
                            {g.ghola.leaders.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                            {g.ghola.kwisatz && (
                              <option value="kwisatz">Kwisatz Haderach</option>
                            )}
                          </select>
                        </label>
                      </>
                    )}
                    {g.advanced &&
                      c.effect === 'karama' &&
                      !me.specialKaramaUsed &&
                      me.faction === 'harkonnen' &&
                      g.phase === 3 && (
                        <>
                          <p className="muted">
                            Once per game: take up to four unseen cards, inspect
                            them, then return the same number.
                          </p>
                          <label>
                            Choose a player
                            <select
                              value={target}
                              onChange={(e) => setTarget(e.target.value)}
                            >
                              <option value="">Choose hand</option>
                              {g.players
                                .filter(
                                  (p) =>
                                    p.id !== me.id && (p.handCount ?? 0) > 0,
                                )
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name} · {p.handCount} cards
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label htmlFor={`exchange-count-${c.id}`}>
                            Cards to take
                            <Input
                              id={`exchange-count-${c.id}`}
                              type="number"
                              min={1}
                              max={4}
                              value={amount}
                              onChange={(e) =>
                                setAmount(Number(e.target.value))
                              }
                            />
                          </label>
                          <HelpTip topic="specialKarama" />
                          {actionButton(
                            'Use special Karama · exchange',
                            {
                              type: 'card',
                              mode: 'special',
                              card: c.id,
                              target,
                              amount,
                            },
                            !target,
                          )}
                        </>
                      )}
                    {g.advanced &&
                      c.effect === 'karama' &&
                      !me.specialKaramaUsed &&
                      me.faction === 'fremen' &&
                      g.phase === 1 && (
                        <>
                          <p className="muted">
                            Once per game: summon Shai-Hulud in a sand
                            territory. Resolve protection now; Nexus and rides
                            follow the spice blow.
                          </p>
                          <label htmlFor={`summon-worm-${c.id}`}>
                            Sand territory
                            <select
                              id={`summon-worm-${c.id}`}
                              value={
                                TERRITORIES.some(
                                  (t) => t.id === selected && t.type === 'sand',
                                )
                                  ? selected
                                  : ''
                              }
                              onChange={(e) => {
                                if (e.target.value) choose(e.target.value);
                              }}
                            >
                              <option value="">Choose territory</option>
                              {TERRITORIES.filter((t) => t.type === 'sand').map(
                                (t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <HelpTip topic="summonedWorm" />
                          {actionButton(
                            'Spend Karama · summon Shai-Hulud',
                            {
                              type: 'card',
                              mode: 'special',
                              card: c.id,
                              territory: selected,
                            },
                            !TERRITORIES.some(
                              (t) => t.id === selected && t.type === 'sand',
                            ),
                          )}
                        </>
                      )}
                    {g.advanced &&
                      c.effect === 'karama' &&
                      !me.specialKaramaUsed &&
                      me.faction === 'emperor' &&
                      g.phase === 4 && (
                        <>
                          <p className="muted">
                            Once per game: revive up to three forces or one
                            leader for free.
                          </p>
                          <label htmlFor={`special-revive-${c.id}`}>
                            Forces to revive
                            <Input
                              id={`special-revive-${c.id}`}
                              type="number"
                              min={1}
                              max={Math.min(3, me.tanks)}
                              value={amount}
                              onChange={(e) =>
                                setAmount(Number(e.target.value))
                              }
                            />
                          </label>
                          {me.elites && (
                            <EliteCount
                              label="Sardaukar to revive"
                              value={eliteAmount}
                              max={Math.min(
                                1,
                                amount,
                                me.elites.tanks,
                                1 - me.elites.revived,
                              )}
                              onChange={setEliteAmount}
                            />
                          )}
                          <HelpTip topic="specialKarama" />
                          {actionButton(
                            'Use special Karama · forces',
                            {
                              type: 'card',
                              mode: 'special',
                              card: c.id,
                              amount,
                              elite: eliteAmount,
                            },
                            !me.tanks,
                          )}
                          {me.leaders
                            .filter(
                              (l) => l.dead && !l.capturedBy && !l.gholaBy,
                            )
                            .map((l) => (
                              <div key={l.id}>
                                {actionButton(
                                  `Revive ${l.name} with special Karama`,
                                  {
                                    type: 'card',
                                    mode: 'special',
                                    card: c.id,
                                    leader: l.id,
                                  },
                                )}
                              </div>
                            ))}
                        </>
                      )}
                    {c.effect === 'weather' && (
                      <label htmlFor="weather-distance">
                        Storm distance
                        <Input
                          id="weather-distance"
                          type="number"
                          min={0}
                          max={10}
                          value={weatherDistance}
                          onChange={(e) =>
                            setWeatherDistance(Number(e.target.value))
                          }
                        />
                      </label>
                    )}
                    {canUseAsKarama(g.advanced, me.faction, c) &&
                      g.phase === 5 &&
                      g.active &&
                      !g.players.find((p) => p.id === g.active)?.shipped && (
                        <Button
                          variant="outline"
                          disabled={
                            busy ||
                            !!g.truthtrance ||
                            !!g.karamaShipping ||
                            !!g.response ||
                            !!g.decision
                          }
                          onClick={() =>
                            act({
                              type: 'card',
                              card: c.id,
                              mode: 'shipment',
                              target: g.active,
                            })
                          }
                        >
                          Guild rates for{' '}
                          {g.players.find((p) => p.id === g.active)?.name}
                        </Button>
                      )}
                    {c.effect !== 'truthtrance' &&
                      (c.kind === 'special' ||
                        canUseAsKarama(g.advanced, me.faction, c)) && (
                        <Button
                          variant="outline"
                          aria-describedby={
                            availability && !availability.available
                              ? `card-unavailable-${c.id}`
                              : undefined
                          }
                          disabled={
                            busy ||
                            !!g.truthtrance ||
                            (!!availability && !availability.available) ||
                            !!homeworldRevivalActionBlock(g, { type: 'card', card: c.id, amount, elite: eliteAmount, leader: leader || undefined }) ||
                            (g.status !== 'playing' &&
                              !(
                                g.status === 'setup' &&
                                g.response &&
                                canUseAsKarama(g.advanced, me.faction, c)
                              )) ||
                            (!!g.phaseOpening &&
                              (c.effect !== 'amal' ||
                                g.phaseOpening.passed.includes(me.id))) ||
                            (c.effect === 'amal' && !g.phaseOpening) ||
                            (c.effect === 'thumper' &&
                              (!g.beforeSpiceDraw ||
                                !!g.response ||
                                !!g.decision))
                          }
                          onClick={() =>
                            act({
                              type: 'card',
                              elite: eliteAmount,
                              card: c.id,
                              mode: canUseAsKarama(g.advanced, me.faction, c)
                                ? g.response
                                  ? 'cancel'
                                  : 'purchase'
                                : undefined,
                              amount:
                                c.effect === 'weather'
                                  ? weatherDistance
                                  : c.effect === 'ghola'
                                    ? amount
                                    : dial,
                              leader: leader || undefined,
                            })
                          }
                        >
                          {canUseAsKarama(g.advanced, me.faction, c)
                            ? g.response
                              ? 'Cancel this power'
                              : 'Take current auction card'
                            : 'Play card'}
                        </Button>
                      )}
                  </article>
                );
              })}
              {!me.hand?.length && (
                <p className="muted">
                  {setupStage
                    ? 'Your starting Treachery cards remain undealt until all starting force placement is complete.'
                    : g.status === 'lobby'
                      ? 'Your opening cards are dealt after starting force placement.'
                      : 'Your Treachery hand is empty.'}
                </p>
              )}
            </div>
            {!!me.faceDancers?.length && (
              <div className="notice">
                <h3>Your Face Dancers</h3>
                {me.faceDancers.map((c) => (
                  <div key={c.leader} className="traitor-identity">
                    <span>
                      {leaderName(c.leader)} ·{' '}
                      {c.revealed ? 'Revealed' : 'Secret'}
                    </span>
                    {inspectIdentity(c.leader, 'faceDancer')}
                    {g.phase === 8 &&
                      !c.revealed &&
                      !me.faceDancerReplaced &&
                      actionButton(
                        'Replace this Face Dancer',
                        { type: 'replaceFaceDancer', leader: c.leader },
                        !!g.phaseOpening || !!g.response || !!g.decision,
                      )}
                  </div>
                ))}
              </div>
            )}
            {!!me.traitors?.length && (
              <div className="traitor-list">
                <span className="eyebrow">YOUR TRAITORS</span>
                {me.traitors.map((id) => (
                  <div key={id} className="traitor-identity">
                    <span>{leaderName(id)}</span>
                    {inspectIdentity(id, 'traitor')}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : panel === 'leaders' ? (
          <>
            <p className="fine">
              Inspect your leader identities here. Choose and commit a leader
              through the battle controls when making a plan.
            </p>
            <div className="leader-roster">
              {me.leaders.map((l) => (
                <article key={l.id} className="leader-identity">
                  <LeaderPortrait
                    identityId={l.id}
                    name={l.name}
                    className="mx-auto size-20"
                    badge={
                      <>
                        <span className="sr-only">Leader strength </span>
                        {leaderStrengthLabel(l)}
                      </>
                    }
                    fallback={
                      <div className="leader-strength-disc">
                        <span className="sr-only">Leader strength </span>
                        {leaderStrengthLabel(l)}
                      </div>
                    }
                  />
                  <p className="eyebrow">{faction(l.faction).name}</p>
                  <h3>{l.name}</h3>
                  <p>
                    {l.dead
                      ? 'In the tanks'
                      : !controlsLeader(me, l)
                        ? 'Controlled by another faction'
                        : l.usedAt
                          ? 'Used in a battle this turn'
                          : 'Ready'}
                  </p>
                  <LeaderInspector
                    identity={{
                      id: l.id,
                      name: l.name,
                      factionName: faction(l.faction).name,
                      strength: leaderStrengthLabel(l),
                    }}
                  />
                </article>
              ))}
            </div>
          </>
        ) : panel === 'log' ? (
          <ol className="game-log" aria-live="polite">
            {[...g.log].reverse().map((e) => (
              <li key={e.seq}>
                <span>{String(e.seq).padStart(3, '0')}</span>
                {e.text.replace(
                  /used Karama to cancel fremenMovement\.$/,
                  'used Karama to cancel Fremen movement.',
                )}
              </li>
            ))}
          </ol>
        ) : (
          <div className="coverage-copy">
            <h3>Rules verification in progress</h3>
            <p>
              This build implements a playable portion of the basic game. It is
              not yet a fully rules-compliant edition.
            </p>
            <p>
              Still in progress: expansion factions and modules, advanced rules,
              several special cards, optional faction reactions, ally support,
              auction deadlines, and a printed-board connectivity audit.
            </p>
            <Link href="/rules">
              Open the rules coverage ledger <ArrowRight size={14} />
            </Link>
          </div>
        )}
      </section>
      <VictoryProgress progress={g.victoryProgress} players={g.players} />
      {g.strongholdCards && (
        <details className="m-4 rounded-xl border border-[#a88b60] p-4">
          <summary className="cursor-pointer text-lg">
            Inspect Stronghold Cards
          </summary>
          <StrongholdCardGallery
            state={g.strongholdCards}
            players={g.players}
          />
        </details>
      )}
      <footer>
        <span>Unofficial fan implementation · Development build</span>
        <span>Board geometry: Truthsayer / MIT</span>
      </footer>
    </main>
  );
}
