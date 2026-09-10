import { nexusCardBotActions } from './nexus-card-options';
import { nexusTraitorBotActions } from './nexus-traitor-options';
import { tupileIntelligenceActions } from './tupile-intelligence-options';
import { biddingEndActions, choamMarketPolicy } from './bidding-end-options';
import { homeworldRevivalActionBlock, homeworldRevivalDeploymentActions } from './homeworld-revival-deployment-options';
import { caladanReinforcementActions } from './caladan-reinforcement-options';
import { grummanCollectionActions } from './grumman-collection-options';
import { botHomeworldShipmentPaymentAllowed } from './homeworld-payment-options';
import { guildHomeworldShipmentActions } from './guild-homeworld-shipment-options';
import { choamSaleGholaTiming } from './choam-market-ghola';
import { junctionTransportActions } from './junction-transport-options';
import { currentJunctionOffer, junctionSponsor } from './junction-offer';
import { homeworldShipmentActions } from './homeworld-shipment-options';
import {
  emperorHomeworldMoveActions,
  withNativeShipmentSources,
} from './homeworld-options';
import { matchesPlanClaim, respectsBattlePromises } from './battle-promises';
import { ecazOccupancyRelation } from './ecaz-occupy';
import { territoryEntryBlock, strongholdPathBlocked } from './occupancy';
import { strongholdBattleEffects } from './stronghold-battle';
import {
  eliteRevivalRemaining,
  forceRevivalPrice,
  paidForceRevivalCost,
} from './revival';
import { controlsLeader, nativeAvailable } from './leader-control';
import { CHEAP_HERO_TRAITOR, matchingTraitor } from './traitors';
import {
  treacheryDeck,
  battleLeaderStrength,
  harvesterAvailable,
} from './cards';
import {
  isWeaponCard,
  isStoneBurner,
  isDefenseCard,
  validBattleCardPair,
  defaultVoiceMatch,
  playedVoiceMatch,
  weaponKills,
  battleWeaponsExplode,
  isShield,
} from './battle-cards';
import { ownedTech } from './tech-tokens';
import type { StrongholdProgress } from './victory-progress';
import { canUseAsKarama } from './karama';
import { reserveShipmentCost } from './shipment-price';
import { liveShipmentPromises, matchesShipment } from './shipment-promises';
import {
  botEntryAllowed,
  botGroundMoveAllowed,
  fremenReserveEntry,
  guildTransportCost,
} from './bot-mobility';
import { richeseCardDefinition } from './richese-cards';
import { presenceAt } from './force-presence';
import { validateCohortSelection, type OrnithopterMode } from './ornithopter';
import { fighterCount, isAdvisor } from './advisors';
import { casualtyOptions, type CombatForces } from './combat';
import { stoneBurnerPlanBlock, stoneBurnerComparison } from './stone-burner';
import {
  applyAction,
  normalizeAutomaticGame,
  RuleError,
  viewGame,
  type Action,
  type Game,
  type GameView,
  type Plan,
} from './engine';
import {
  TERRITORIES,
  gameTerritories,
  gameDistance,
  MOBILE_LOCATION,
  MOBILE_STRONGHOLD,
  mobileRoutes,
  splitLocation,
  location,
  territory,
} from './board';

import { DIFFICULTIES } from './bot-profiles';
import { botBattleChoices } from './bot-battle-choices';
const countAt = (p: GameView['players'][number], t: string) =>
  Object.entries(p.forces)
    .filter(([key]) => splitLocation(key).territory === t)
    .reduce((n, [, count]) => n + count, 0);
const rank = (g: GameView) => {
  const me = g.players.find((p) => p.id === g.me)!;
  return DIFFICULTIES.indexOf(me.bot ?? me.autopilot ?? 'Medium');
};
const variation = (g: GameView, salt: string) => {
  let n = 2166136261;
  for (const c of `${g.code}-${g.me}-${g.turn}-${g.phase}-${salt}`)
    n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0) / 4294967296;
};
function alliedNoFieldOffer(g: GameView): Action | null {
  const me = g.players.find((p) => p.id === g.me)!;
  const level = rank(g);
  const alliedNoField = g.richeseNoField;
  if (
    alliedNoField?.owner === me.id &&
    alliedNoField.canOfferAlly &&
    !alliedNoField.allyDeclined &&
    alliedNoField.private
  ) {
    const inventory = alliedNoField.private;
    const oldMarker = inventory.deployed;
    const oldValue =
      inventory.tokens.find((token) => token.id === oldMarker?.tokenId)
        ?.value ?? 0;
    // Do not spend an ally's unprojected spice or erase an empty bluff to offer aid.
    if (!oldMarker || Math.min(oldValue, me.reserves) > 0) {
      const preferred = level === 0 ? 3 : 5;
      const token = [...inventory.tokens]
        .filter(
          (token) => token.value > 0 && token.id !== inventory.lastShipped,
        )
        .sort(
          (a, b) =>
            Math.abs(a.value - preferred) - Math.abs(b.value - preferred),
        )[0];
      const targets = TERRITORIES.flatMap((t) =>
        t.sectors
          .filter((sector) => sector !== g.storm)
          .map((sector) => ({
            t,
            sector,
            score:
              (t.type === 'stronghold' ? 20 : 0) +
              (g.spice[location(t.id, sector)] ?? 0) +
              (level === 0 ? variation(g, location(t.id, sector)) : 0),
          })),
      )
        .filter(
          ({ t }) =>
            g.players.every((p) => presenceAt(p, t.id) === 0) &&
            !g.moritaniTerror?.tokens.some(
              (token) => token.status === 'placed' && token.location === t.id,
            ) &&
            !g.ambassadors?.tokens.some(
              (token) => token.zone === 'placed' && token.location === t.id,
            ),
        )
        .sort((a, b) => b.score - a.score);
      if (token) {
        const target = targets.find(
          ({ t }) => (t.type === 'stronghold' ? 1 : 2) <= (me.spice ?? 0),
        );
        if (target)
          return {
            type: 'offerRicheseNoField',
            token: token.id,
            event: alliedNoField.event,
            territory: target.t.id,
            sector: target.sector,
            payer: me.id,
          };
      }
    }
  }
  return null;
}

function technologyCardValue(
  g: GameView,
  card: { id: string; kind: string; effect?: string },
): number {
  if (rank(g) === 0) return variation(g, card.id);
  if (card.kind === 'worthless') return 0;
  if (card.effect === 'karama') return 10;
  if (['shield', 'snooper', 'shieldSnooper'].includes(card.kind)) return 8;
  if (
    ['projectile', 'poison', 'poisonBlade', 'lasgun', 'poisonTooth'].includes(
      card.kind,
    )
  )
    return 7;
  if (card.kind === 'hero') return 2;
  return 5;
}
function closeToStrongholdVictory(row: StrongholdProgress | undefined) {
  return (
    !!row &&
    (row.strongholds.length + Number(row.techStronghold) >= row.target - 1 ||
      (row.occupyTarget !== null &&
        row.jointlyOccupied.length >= row.occupyTarget - 1))
  );
}
function destinations(g: GameView, allowStorm = false) {
  const me = g.players.find((p) => p.id === g.me)!;
  const level = rank(g);
  const rivals = g.players.filter((p) => p.id !== me.id && p.id !== me.ally);
  const ownProgress = g.victoryProgress?.find((row) => row.player === me.id);
  return gameTerritories(g)
    .flatMap((t) =>
      t.sectors
        .filter((s) => s === 0 || s !== g.storm || allowStorm)
        .map((s) => {
          const key = location(t.id, s);
          const enemy = rivals.reduce((n, p) => n + fighterCount(p, t.id), 0);
          const enemyOwner = rivals.find((p) => fighterCount(p, t.id));
          const enemyThreat = closeToStrongholdVictory(
            g.victoryProgress?.find((row) => row.player === enemyOwner?.id),
          );
          const joinsEcazAlly =
            ownProgress?.occupyTarget !== null &&
            ownProgress?.occupyTarget !== undefined &&
            t.type === 'stronghold' &&
            !fighterCount(me, t.id) &&
            g.players.some((p) => p.id === me.ally && fighterCount(p, t.id));
          const allyBlocked =
            me.ally &&
            g.players.some((p) => p.id === me.ally && presenceAt(p, t.id)) &&
            ecazOccupancyRelation(g.players, me.id, me.ally, {
              kind: 'territory',
              id: t.id,
            }) !== 'ecazAlliance';
          const score =
            level === 0
              ? variation(g, key) * 15
              : (t.type === 'stronghold' ? 18 : 0) +
                (g.spice[key] ?? 0) * ((me.spice ?? 0) < 5 ? 2 : 0.7) -
                enemy * (level === 1 ? 2 : 1) +
                (enemyOwner && ownedTech(g.techTokens, enemyOwner.id).length
                  ? ownedTech(g.techTokens, me.id).length === 2
                    ? 14
                    : 4
                  : 0) -
                (presenceAt(me, t.id) ? 10 : 0) +
                (level === 3 && enemyThreat && t.type === 'stronghold'
                  ? 22
                  : 0) +
                (level >= 2 && joinsEcazAlly
                  ? ownProgress!.jointlyOccupied.length >= 2
                    ? 30
                    : 14
                  : 0) -
                (t.type === 'polar' ? 15 : 0);
          return {
            t: t.id,
            s,
            key,
            enemy,
            score: allyBlocked && t.type !== 'polar' ? -1000 : score,
          };
        }),
    )
    .sort((a, b) => b.score - a.score);
}
function guildAmbassadorShipments(g: GameView): Action[] {
  const entry = g.ambassadorEntry;
  if (entry?.stage !== 'ship' || !entry.shipment || entry.beneficiary !== g.me)
    return [];
  const me = g.players.find((p) => p.id === g.me)!;
  const descriptor = entry.shipment;
  const level = rank(g);
  const available = Math.min(descriptor.maximum, me.reserves);
  const destinations = descriptor.destinations.filter((d) => !d.blocked);
  if (available < 1 || !destinations.length)
    return [{ type: 'decision', event: entry.event, amount: 0 }];
  const score = (d: (typeof destinations)[number]) => {
    const key = location(d.territory, d.sector);
    if (level === 0) return variation(g, key);
    const enemy = g.players
      .filter((p) => p.id !== me.id && p.id !== me.ally)
      .reduce((n, p) => n + fighterCount(p, d.territory), 0);
    return (
      (territory(d.territory).type === 'stronghold' ? 20 : 0) +
      (g.spice[key] ?? 0) -
      enemy * 2 -
      (presenceAt(me, d.territory) ? 8 : 0) -
      (d.advisors ? 3 : 0)
    );
  };
  destinations.sort((a, b) => score(b) - score(a));
  const destination = destinations[0];
  const amount = Math.min(available, destination.maximum ?? available);
  const minimum = Math.max(0, amount - (me.reserves - descriptor.eliteReserves));
  const elite = level === 0 ? minimum : Math.min(amount, descriptor.eliteReserves);
  return [
    {
      type: 'decision',
      event: entry.event,
      amount,
      elite,
      territory: destination.territory,
      sector: destination.sector,
    },
  ];
}
function fremenAmbassadorMoves(g: GameView): Action[] {
  const entry = g.ambassadorEntry;
  if (entry?.stage !== 'move' || !entry.movement || entry.beneficiary !== g.me)
    return [];
  const me = g.players.find((p) => p.id === g.me)!;
  const level = rank(g);
  const candidates: { action: Action; score: number }[] = [];
  for (const source of entry.movement.sources) {
    for (const destination of source.destinations.filter((d) => !d.blocked)) {
      const target = location(destination.territory, destination.sector);
      const sectors = source.sectors.filter((s) => s.key !== target);
      const physical = sectors.reduce((n, s) => n + s.forces, 0);
      const marker =
        !physical &&
        source.marker &&
        location(source.territory, source.marker.sector) !== target
          ? source.marker
          : null;
      if (!physical && !marker) continue;
      const keepsSource =
        source.territory !== destination.territory &&
        territory(source.territory).type === 'stronghold' &&
        physical > 1 &&
        presenceAt(me, source.territory) === physical;
      let remaining = Math.min(
        physical - (keepsSource ? 1 : 0),
        destination.maximum ?? physical,
      );
      const forces: Record<string, number> = {};
      const eliteForces: Record<string, number> = {};
      for (const s of sectors) {
        const n = Math.min(remaining, s.forces);
        if (!n) continue;
        remaining -= n;
        forces[s.key] = n;
        eliteForces[s.key] =
          level === 0
            ? Math.max(0, n - (s.forces - s.elites))
            : Math.min(n, s.elites);
      }
      const amount =
        Object.values(forces).reduce((n, value) => n + value, 0) +
        Number(!!marker);
      const enemy = g.players
        .filter((p) => p.id !== me.id && p.id !== me.ally)
        .reduce((n, p) => n + fighterCount(p, destination.territory), 0);
      const abandons =
        source.territory !== destination.territory &&
        territory(source.territory).type === 'stronghold' &&
        presenceAt(me, source.territory) === amount;
      const score =
        level === 0
          ? variation(g, `${source.territory}:${target}`)
          : (territory(destination.territory).type === 'stronghold' ? 20 : 0) +
            (g.spice[target] ?? 0) -
            enemy * 2 +
            Math.min(amount - enemy, 4) -
            (presenceAt(me, destination.territory) ? 8 : 0) -
            (abandons ? 25 : 0) -
            (destination.advisors ? 3 : 0);
      candidates.push({
        score,
        action: {
          type: 'decision',
          event: entry.event,
          forces,
          eliteForces,
          territory: destination.territory,
          sector: destination.sector,
          ...(marker
            ? { noField: { tokenId: marker.tokenId, event: marker.event } }
            : {}),
        },
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length ? [candidates[0].action] : [];
}
function ornithopterMoves(g: GameView): Action[] {
  const flight = g.ornithopter;
  if (!flight || flight.blocked) return [];
  const me = g.players.find((p) => p.id === g.me)!;
  const level = rank(g),
    active = flight.active,
    cohort = active?.cohort;
  const noField = g.richeseNoField?.owner === me.id ? g.richeseNoField : null;
  const marker = noField?.private?.deployed;
  const markerSource = marker
    ? location(marker.location.territory, marker.location.sector)
    : null;
  const permittedMarker =
    marker &&
    !g.homeworldMobility?.noFieldMovementBlocked &&
    (!cohort ||
      (cohort.noField?.tokenId === marker.tokenId &&
        cohort.noField.event === noField?.event &&
        cohort.noField.from === markerSource));
  const sources = Object.entries(me.forces)
    .map(([from, n]) => {
      const currentElite = me.elites?.forces[from] ?? 0;
      const elite = Math.min(
        currentElite,
        cohort ? (cohort.elites[from] ?? 0) : currentElite,
      );
      const normal = Math.min(
        n - currentElite,
        cohort
          ? (cohort.forces[from] ?? 0) - (cohort.elites[from] ?? 0)
          : n - currentElite,
      );
      return { from, normal, elite };
    })
    .filter((source) => source.normal + source.elite > 0);
  const total =
    sources.reduce((n, s) => n + s.normal + s.elite, 0) +
    (permittedMarker ? 1 : 0);
  const modes: OrnithopterMode[] = active
    ? [active.mode]
    : level === 0
      ? ['range3', 'twoGroups']
      : ['twoGroups', 'range3'];
  const result: Action[] = [];
  const pathsBlocked = (key: string) => {
    const loc = splitLocation(key);
    return (
      loc.sector === g.storm ||
      strongholdPathBlocked(g.players, me.id, loc.territory)
    );
  };
  const targets = destinations(g).filter(
    (to) =>
      to.t !== MOBILE_STRONGHOLD &&
      to.score > -1000 &&
      to.t !== marker?.location.territory,
  );
  for (const mode of modes) {
    if (
      !active &&
      (flight.modes.find((option) => option.mode === mode)?.blocked ||
        (mode === 'twoGroups' && total < 2))
    )
      continue;
    const candidates = [
      ...sources.map((source) => ({ ...source, marker: false })),
      ...(permittedMarker && markerSource
        ? [{ from: markerSource, normal: 0, elite: 0, marker: true }]
        : []),
    ];
    for (const to of targets)
      for (const source of candidates) {
        const origin = splitLocation(source.from);
        if (
          source.from === to.key ||
          origin.sector === g.storm ||
          isAdvisor(me, origin.territory) ||
          (origin.territory !== to.t &&
            g.balisetRestrictions.some(
              (b) => b.player === me.id && b.territory === to.t,
            ) &&
            g.players.some(
              (p) => p.faction === 'choam' && countAt(p, to.t) > 0,
            ))
        )
          continue;
        if (source.marker && (to.enemy > 0 || countAt(me, to.t) > 0)) continue;
        let amount = source.normal + source.elite;
        if (!active && mode === 'twoGroups' && amount === total)
          amount = Math.ceil(amount / 2);
        const elite = Math.min(
          source.elite,
          level === 0 ? Math.max(0, amount - source.normal) : amount,
        );
        const normalRange =
          (fighterCount(me, 'arrakeen') || fighterCount(me, 'carthag')
            ? 3
            : (me.faction === 'fremen' && !me.fremenMovementBlocked) ||
                (me.faction === 'ixians' && elite > 0 && !me.ixMovementBlocked)
              ? 2
              : 1) + (me.faction === 'choam' ? g.choamMovementBonus : 0);
        const distance = gameDistance(g, source.from, to.key, pathsBlocked);
        if (
          distance > (mode === 'range3' ? 3 : normalRange) ||
          (!active && mode === 'range3' && distance <= normalRange)
        )
          continue;
        const action: Action = source.marker
          ? {
              type: 'move',
              forces: {},
              noField: marker!.tokenId,
              event: noField!.event,
              territory: to.t,
              sector: to.s,
            }
          : {
              type: 'move',
              from: source.from,
              amount,
              elite,
              territory: to.t,
              sector: to.s,
            };
        if (cohort) {
          try {
            validateCohortSelection(
              cohort,
              me.forces,
              me.elites?.forces ?? {},
              source.marker ? {} : { [source.from]: amount },
              source.marker ? {} : { [source.from]: elite },
              source.marker
                ? {
                    tokenId: marker!.tokenId,
                    event: noField!.event,
                    from: source.from,
                  }
                : undefined,
            );
          } catch {
            continue;
          }
        }
        result.push({
          ...action,
          ...(active
            ? { ornithopterEvent: active.event }
            : { movementCard: flight.card.id, ornithopter: mode }),
        });
      }
  }
  return result;
}
function candidatePlan(a: Action): Plan {
  return {
    dial: Number(a.dial),
    support: Number(a.support ?? 0),
    leader: typeof a.leader === 'string' ? a.leader : null,
    weapon: typeof a.weapon === 'string' ? a.weapon : null,
    defense: typeof a.defense === 'string' ? a.defense : null,
    kwisatz: a.kwisatz === true,
  };
}
function plans(g: GameView): Action[] {
  const me = g.players.find((p) => p.id === g.me)!;
  const b = g.battle!;
  const other = g.players.find(
    (p) => p.id === (b.attacker === me.id ? b.defender : b.attacker),
  )!;
  const level = rank(g);
  const actual = countAt(me, b.territory);
  const elite = Object.entries(me.elites?.forces ?? {})
    .filter(([key]) => splitLocation(key).territory === b.territory)
    .reduce((sum, [, n]) => sum + n, 0);
  const forces: CombatForces = b.ownForces ?? {
    normal: actual - elite,
    normalFixedHalf: me.faction === 'ixians',
    elite,
    eliteStrength:
      (!g.advanced && me.faction !== 'ixians') ||
      (b.eliteBlocked.includes(me.id) &&
        !(g.advanced && me.faction === 'ixians')) ||
      (me.faction === 'emperor' && other.faction === 'fremen')
        ? 1
        : 2,
    freeSupport:
      !g.advanced || (me.faction === 'fremen' && !b.fremenSupportBlocked),
  };
  const own = forces.normal + forces.elite;
  const typedForces = g.advanced || me.faction === 'ixians';
  const ownStrength = typedForces
    ? forces.normal * (forces.normalFixedHalf ? 0.5 : 1) +
      forces.elite * forces.eliteStrength
    : own;
  const supportCache = new Map<
    number,
    { support: number; cost: number } | null
  >();
  const supporting = (dial: number) => {
    if (supportCache.has(dial)) return supportCache.get(dial)!;
    const choices = Array.from(
      {
        length:
          (g.advanced
            ? Math.min(
                own,
                (me.spice ?? 0) +
                  g.aid.available +
                  (b.strongholdEffects[me.id] === 'arrakeen' ? 2 : 0),
              )
            : 0) + 1,
      },
      (_, support) =>
        casualtyOptions(forces, dial, support).map((loss) => ({
          support,
          cost:
            Math.max(
              0,
              support - (b.strongholdEffects[me.id] === 'arrakeen' ? 2 : 0),
            ) *
              (level === 0 ? 3 : 0.7) +
            loss.normal +
            loss.elite * 2.5,
        })),
    )
      .flat()
      .sort((a, b) => a.cost - b.cost);
    const result = choices[0] ?? null;
    supportCache.set(dial, result);
    return result;
  };
  // Include affordable bank-supported dials even when the estimated winning
  // dial exceeds the budget; otherwise a large army can miss its free support.
  const bankSupportedDials =
    g.advanced && b.strongholdEffects[me.id] === 'arrakeen'
      ? Array.from(
          { length: Math.floor(ownStrength * 2) + 1 },
          (_, i) => i / 2,
        ).filter((dial) => (supporting(dial)?.support ?? 0) > 0)
      : [];
  const freeEliteDials = forces.eliteFreeSupport
    ? Array.from(
        { length: Math.floor(ownStrength * 2) + 1 },
        (_, i) => i / 2,
      ).filter((dial) => casualtyOptions(forces, dial, 0).length > 0)
    : [];
  const enemies = b.opponentForces
    ? b.opponentForces.normal + b.opponentForces.elite
    : presenceAt(other, b.territory);
  const ownNativeBonus = b.native === me.id ? b.nativeBattleStrength : 0;
  const enemyNativeBonus = b.native === other.id ? b.nativeBattleStrength : 0;
  const enemyCapacity = b.opponentForces
    ? b.opponentForces.normal * (b.opponentForces.normalFixedHalf ? 0.5 : 1) +
      b.opponentForces.elite * b.opponentForces.eliteStrength
    : enemies;
  const insights = [
    ...(b.insight && b.prescience?.player === me.id ? [b.insight] : []),
    ...(b.nexusInspection?.owner === me.id
      ? b.nexusInsights.filter((insight) => insight.active)
      : []),
  ];
  const known = (field: string) =>
    insights.find((insight) => insight.field === field);
  const knownCards = treacheryDeck(['ix']);
  const revealedWeapon = knownCards.find((c) => c.id === known('weapon')?.value);
  const revealedDefense = knownCards.find((c) => c.id === known('defense')?.value);
  const inspected =
    b.fullPlanInsight?.target === other.id ? b.fullPlanInsight : null;
  const enemyWeapon = inspected?.cards.find(
    (c) => c.id === inspected.plan.weapon,
  );
  const enemyDefense = inspected?.cards.find(
    (c) => c.id === inspected.plan.defense,
  );
  const commitments = b.ownCommitments.filter(
    (element) => element.target === me.id,
  );
  const fixed = (field: string, value: string | number | null) =>
    commitments.every(
      (element) => element.field !== field || element.value === value,
    );
  const weapons = [
    null,
    ...(me.hand ?? []).filter(isWeaponCard).map((c) => c.id),
  ].filter((id) => fixed('weapon', id));
  const defenses = [
    null,
    ...(me.hand ?? []).filter(isDefenseCard).map((c) => c.id),
  ].filter((id) => fixed('defense', id));
  const availableLeaders = me.leaders.filter(
    (l) =>
      !l.dead &&
      controlsLeader(me, l) &&
      (!l.usedAt || l.usedAt === b.territory),
  );
  const heroes = (me.hand ?? []).filter((c) => c.kind === 'hero');
  const voice = b.voice?.target === me.id ? b.voice : null;
  const mayOmitLeader =
    !availableLeaders.length &&
    (!heroes.length || (voice?.kind === 'hero' && !voice.must));
  const leaders = [
    ...(mayOmitLeader ? [null] : []),
    ...availableLeaders.map((l) => l.id),
    ...heroes.map((c) => c.id),
  ].filter((id) => fixed('leader', id));
  const voiceApplies =
    !!voice &&
    (availableLeaders.length > 0 || heroes.length > 0) &&
    (me.hand ?? []).some((c) => defaultVoiceMatch(c, voice.kind));
  const knownEnemyLeader = g.allLeaders.find((l) => l.id === known('leader')?.value);
  const expectedLeader = inspected
    ? (g.allLeaders.find((l) => l.id === inspected.plan.leader)?.strength ??
        0) + (inspected.plan.kwisatz ? 2 : 0)
    : (knownEnemyLeader?.strength ??
      (level >= 2
        ? Math.max(
            0,
            ...other.leaders
              .filter((l) => !l.dead && controlsLeader(other, l))
              .map((l) => l.strength),
          )
        : 3));
  const expectedDial = inspected
    ? inspected.plan.dial
    : known('dial')
      ? Number(known('dial')!.value)
      : Math.ceil(enemyCapacity * [0.25, 0.4, 0.6, 0.75][level]);
  const options: { action: Action; score: number }[] = [];
  for (const leader of leaders)
    for (const weapon of weapons)
      for (const defense of defenses) {
        const kwisatz =
          !!leader &&
          !!me.kwisatz?.active &&
          !me.kwisatz.dead &&
          !b.kwisatzBlocked &&
          (!me.kwisatz.usedAt || me.kwisatz.usedAt === b.territory);
        const myLeader = me.leaders.find((l) => l.id === leader);
        const enemyDisc = inspected
          ? g.allLeaders.find((l) => l.id === inspected.plan.leader)
          : knownEnemyLeader;
        const expectedEnemyStrength =
          inspected || knownEnemyLeader
            ? battleLeaderStrength(enemyDisc, myLeader) +
              (inspected?.plan.kwisatz ? 2 : 0)
            : level >= 2 &&
                other.leaders.some(
                  (l) =>
                    l.id === 'tleilaxu-0' &&
                    !l.dead &&
                    controlsLeader(other, l),
                )
              ? Math.max(expectedLeader, myLeader?.strength ?? 0)
              : expectedLeader;
        const strength =
          battleLeaderStrength(
            me.leaders.find((l) => l.id === leader),
            inspected
              ? g.allLeaders.find((l) => l.id === inspected.plan.leader)
              : { strength: expectedLeader },
          ) + (kwisatz ? 2 : 0);
        const w = me.hand?.find((c) => c.id === weapon);
        const d = me.hand?.find((c) => c.id === defense);
        const stoneBattle =
          isStoneBurner(w) || (inspected && isStoneBurner(enemyWeapon));
        if ((!leader && (weapon || defense)) || !validBattleCardPair(w, d))
          continue;
        if (voice) {
          const used =
            playedVoiceMatch(
              me.hand?.find((c) => c.id === leader),
              'leader',
              voice.kind,
            ) ||
            playedVoiceMatch(w, 'weapon', voice.kind) ||
            playedVoiceMatch(d, 'defense', voice.kind);
          if (voice.must ? voiceApplies && !used : used) continue;
        }
        const safeLeader =
          kwisatz ||
          !!matchingTraitor(
            me.traitors ?? [],
            leader,
            me.hand?.find((c) => c.id === leader),
          );
        const traitorHolders = [
          other,
          ...g.players.filter(
            (p) => p.faction === 'harkonnen' && p.ally === other.id,
          ),
        ].filter((holder) => !b.native || holder.id === b.native);
        const exposedLeader =
          !kwisatz &&
          traitorHolders.some((p) =>
            matchingTraitor(
              p.revealedTraitors,
              leader,
              me.hand?.find((c) => c.id === leader),
            ),
          );
        const effects = strongholdBattleEffects(
          w,
          d,
          inspected ? enemyWeapon : undefined,
          inspected ? enemyDefense : undefined,
          true,
          true,
          b.strongholdEffects[me.id],
          b.strongholdEffects[other.id],
        );
        const ownSurvivingStrength =
          effects.stunned || effects.attackerDead ? 0 : strength;
        const enemySurvivingStrength =
          effects.stunned || (inspected && effects.defenderDead)
            ? 0
            : expectedEnemyStrength;
        const ideal = stoneBattle
          ? 0
          : level === 0
            ? Math.floor(variation(g, `${leader}-${weapon}`) * (own + 1))
            : Math.min(
                ownStrength,
                Math.max(
                  0,
                  enemySurvivingStrength +
                    expectedDial -
                    ownSurvivingStrength +
                    enemyNativeBonus -
                    ownNativeBonus +
                    (b.tieWinner === me.id ? 0 : typedForces ? 0.5 : 1),
                ),
              );
        for (const dial of new Set([
          ideal,
          ...bankSupportedDials,
          ...freeEliteDials,
          0,
          ...(typedForces ? [0.5] : []),
          Math.max(0, ownStrength - 1),
          ownStrength,
        ])) {
          const action: Action = {
            type: 'battlePlan',
            kwisatz,
            dial,
            leader,
            weapon,
            defense,
          };
          const committedDial = commitments.find(
            (element) => element.field === 'dial',
          );
          if (committedDial) action.dial = committedDial.value;
          if (!fixed('dial', Number(action.dial))) continue;
          const commitment = typedForces
            ? supporting(Number(action.dial))
            : null;
          if (typedForces && !commitment) continue;
          if (commitment) action.support = commitment.support;
          const stonePlan = isStoneBurner(
            me.hand?.find((c) => c.id === action.weapon),
          );
          if (stonePlan && !action.leader) continue;
          if (
            stonePlan &&
            (!b.stoneBurnerContext ||
              b.stoneBurnerContext.blocked ||
              !b.stoneBurnerContext.opponentPools.length ||
              b.stoneBurnerContext.opponentPools.some((pool) =>
                stoneBurnerPlanBlock(
                  forces,
                  Number(action.dial),
                  Number(action.support ?? 0),
                  pool,
                  b.attacker === me.id ? 'attacker' : 'defender',
                  b.tieWinner === b.attacker ? 'attacker' : 'defender',
                ),
              ))
          )
            continue;
          const effectiveWeapon = w && w.kind !== 'worthless' ? 6 : 0;
          const effectiveDefense = d && d.kind !== 'worthless' ? 4 : 0;
          const selfExplosion = battleWeaponsExplode(w, d);
          const correctDefense = inspected
            ? weaponKills(enemyWeapon) && !weaponKills(enemyWeapon, d)
            : !!revealedWeapon &&
              weaponKills(revealedWeapon) &&
              !weaponKills(revealedWeapon, d);
          const explosionRisk = inspected
            ? battleWeaponsExplode(w, d, enemyWeapon, enemyDefense)
            : (isShield(revealedDefense) && w?.kind === 'lasgun') ||
              (revealedWeapon?.kind === 'lasgun' && isShield(d));
          const undialed = stoneBattle
            ? Math.min(
                ...casualtyOptions(
                  forces,
                  Number(action.dial),
                  Number(action.support ?? 0),
                ).map((loss) => own - loss.normal - loss.elite),
              )
            : 0;
          const enemyUndialed = stoneBattle
            ? Math.max(
                0,
                ...(b.stoneBurnerContext?.opponentPools ?? []).flatMap(
                  (pool) =>
                    inspected
                      ? casualtyOptions(
                          pool,
                          inspected.plan.dial,
                          inspected.plan.support,
                        ).map(
                          (loss) =>
                            pool.normal + pool.elite - loss.normal - loss.elite,
                        )
                      : [pool.normal + pool.elite],
                ),
              )
            : 0;
          const score = stoneBattle
            ? (undialed - enemyUndialed) * 6 +
              undialed * 2 +
              (undialed > enemyUndialed ||
              (undialed === enemyUndialed && b.tieWinner === me.id)
                ? 30
                : -30) -
              Number(action.dial) * 2 +
              (stonePlan ? 6 : 0) +
              (effectiveDefense ? 2 : 0)
            : level === 0
              ? variation(g, `${leader}-${weapon}-${defense}-${dial}`) * 100
              : ownSurvivingStrength * 2 +
                (inspected && enemySurvivingStrength === 0 ? 10 : 0) +
                effectiveWeapon +
                effectiveDefense +
                (safeLeader && level >= 2 ? 5 : 0) -
                Math.abs(Number(action.dial) - ideal) * 2 +
                (correctDefense ? 10 : 0) -
                (selfExplosion || explosionRisk ? 80 : 0) -
                (exposedLeader ? 100 : 0);
          options.push({
            action,
            score: score - (commitment?.cost ?? 0) * 0.2,
          });
        }
      }
  const ranked = options
    .sort((a, b) => b.score - a.score)
    .map((x) => x.action)
    .filter((a) =>
      respectsBattlePromises(
        b.truthPromises,
        me.id,
        candidatePlan(a),
        me.hand ?? [],
      ),
    );
  if (b.compliantPlan && commitments.every(
    (element) => b.compliantPlan![element.field] === element.value,
  )) ranked.push({ type: 'battlePlan', ...b.compliantPlan });
  return ranked;
}

// This policy receives a personalized view, never the authoritative decks or rival hands.
function gamontAction(g: GameView): Action | undefined {
  const me = g.players.find((p) => p.id === g.me)!;
  const card = g.choamWorthless?.cards.find((c) => c.name === 'Trip to Gamont');
  if (!card || g.phase !== 8) return;
  const options = g
    .choamWorthless!.gamont.filter((o) => o.target !== me.ally)
    .map((o) => {
      const owner = g.players.find((p) => p.id === o.target)!;
      const t = gameTerritories(g).find(
        (t) => t.id === splitLocation(o.key).territory,
      )!;
      const count = countAt(owner, t.id);
      const threatenedWin = closeToStrongholdVictory(
        g.victoryProgress?.find((row) => row.player === owner.id),
      );
      const score =
        rank(g) === 0
          ? variation(g, o.key + o.target) * 10
          : (t.type === 'stronghold' && count === 1
              ? 30 + (threatenedWin ? 30 : 0)
              : 0) +
            o.elite * 8 +
            (fighterCount(owner, t.id) ? 2 : 0);
      return { ...o, score };
    })
    .sort((a, b) => b.score - a.score);
  const choice = options[0];
  if (choice)
    return {
      type: 'card',
      mode: 'choam',
      card: card.id,
      target: choice.target,
      from: choice.key,
      elite: choice.elite,
    };
}
/** Supported, server-derived timing only; no rival hand or sealed bid is inspected. */
function saphoAction(g: GameView): Action | null {
  const me = g.players.find((p) => p.id === g.me)!;
  const card = me.hand?.find(
    (c) => richeseCardDefinition(c)?.card.effect === 'juiceOfSapho',
  );
  const options = g.saphoOptions;
  if (!card || !options?.length) return null;
  const earlySpice =
    me.reserves >= 3 &&
    (me.faction === 'fremen' || (me.spice ?? 0) >= 3) &&
    Object.values(g.spice).some((amount) => amount >= 6);
  const preferred =
    options[0].scope === 'movement' && earlySpice ? 'first' : 'last';
  const option =
    options.find((candidate) => candidate.mode === preferred) ?? options[0];
  return { type: 'card', card: card.id, ...option };
}
function policyActions(g: GameView): Action[] {
  const me = g.players.find((p) => p.id === g.me)!;
  const level = rank(g);
  if (!(me.bot ?? me.autopilot) || g.status === 'finished') return [];
  if (g.status === 'lobby') return me.ready ? [] : [{ type: 'ready' }];
  if (g.decision?.kind === 'nullentropy') {
    if (g.decision.player !== me.id) return [];
    const search = g.nullentropy?.search;
    if (!search) return [];
    const ordered = [...search.cards].sort((a, b) => {
      const score = (card: typeof a) => {
        const richese = richeseCardDefinition(card);
        const unfinished =
          richese &&
          ![
            'karama',
            'distrans',
            'ornithopter',
            'residualPoison',
            'portableSnooper',
            'stoneBurner',
            'juiceOfSapho',
          ].includes(richese.card.effect);
        return unfinished ? -100 : technologyCardValue(g, card);
      };
      return score(b) - score(a);
    });
    return ordered[0]
      ? [{ type: 'decision', event: search.event, card: ordered[0].id }]
      : [];
  }
  if (g.truthtrance) {
    const w = g.truthtrance;
    if (w.stage === 'priority')
      return w.passed.includes(me.id) ? [] : [{ type: 'truthPass' }];
    if (w.stage === 'answer') {
      if (w.question?.target !== me.id) return [];
      if (w.question.kind === 'shipment') {
        const question = w.question;
        const choices = g.truthShipmentAnswers ?? [];
        const target = gameTerritories(g).find(
          (t) => t.id === question.territory,
        );
        const spice = Object.entries(g.spice)
          .filter(
            ([key]) => splitLocation(key).territory === question.territory,
          )
          .reduce((sum, [, amount]) => sum + amount, 0);
        // Destination value and own reserve commitment guide strategy. The
        // server's complete answer set, never sampled moves, decides feasibility.
        const preferYes =
          (target?.type === 'stronghold' || spice >= question.minimum) &&
          question.minimum <= Math.max(0, me.reserves - [0, 1, 2, 3][level]);
        const preferred = preferYes ? 'yes' : 'no';
        const answer = choices.includes(preferred)
          ? preferred
          : (choices.find((choice) => choice === 'yes' || choice === 'no') ??
            choices[0] ??
            'unknown');
        return [{ type: 'truthAnswer', answer }];
      }
      if (w.question.kind === 'battlePlan') {
        const choices = g.truthBattleAnswers ?? ['unknown'];
        const claim = w.question.claim;
        const preferred = plans(g)
          .map((plan) =>
            matchesPlanClaim(claim, candidatePlan(plan), me.hand ?? [])
              ? 'yes'
              : 'no',
          )
          .find((answer) => choices.includes(answer));
        return [{ type: 'truthAnswer', answer: preferred ?? choices[0] }];
      }
      return [{ type: 'truthAnswer', answer: g.truthAnswer ?? 'unknown' }];
    }
    if (w.queue[0]?.player !== me.id) return [];
    if (w.stage === 'unknown') return [{ type: 'truthSave' }];
    const other =
      g.players.find(
        (p) =>
          p.id !== me.id &&
          (p.id === g.battle?.attacker || p.id === g.battle?.defender),
      ) ?? g.players.find((p) => p.id !== me.id)!;
    const leader = [...me.leaders]
      .filter((l) => !l.dead)
      .sort((a, b) => b.strength - a.strength)[0];
    return [
      {
        type: 'truthAsk',
        question: {
          kind: 'fact',
          target: other.id,
          fact: leader
            ? { kind: 'traitor', leader: leader.id }
            : { kind: 'hand', name: 'Shield' },
        },
      },
    ];
  }
  if (g.status === 'setup' && !g.decision) {
    const choosingTraitors = !g.setupStage || g.setupStage === 'traitors';
    const placingForces = !g.setupStage || g.setupStage === 'forces';
    const makingPrediction = !g.setupStage || g.setupStage === 'prediction';
    if (choosingTraitors && me.traitorChoices?.length) {
      const choices = [...me.traitorChoices].sort((a, b) => {
        const score = (id: string) => {
          if (id === CHEAP_HERO_TRAITOR)
            return level === 0 ? variation(g, id) : 4;
          const l = g.allLeaders.find((l) => l.id === id)!;
          return level === 0
            ? variation(g, id)
            : l.strength + (l.faction === me.faction ? -5 : 0);
        };
        return score(b) - score(a);
      });
      return [{ type: 'traitor', leader: choices[0] }];
    }
    if (placingForces && me.faction === 'fremen' && me.reserves === 20)
      return [
        {
          type: 'fremenSetup',
          placements: {
            sietch_tabr: level === 0 ? 10 : 7,
            false_wall_south: level === 0 ? 0 : 3,
            false_wall_west: 0,
          },
        },
      ];
    if (
      placingForces &&
      g.advanced &&
      me.faction === 'beneGesserit' &&
      !me.advisorSetup &&
      me.reserves === 20 &&
      g.players.every((p) => p.faction !== 'fremen' || p.reserves === 10)
    )
      return destinations(g, true)
        .filter((to) => to.t !== MOBILE_STRONGHOLD)
        .map((to) => ({
          type: 'advisorSetup',
          territory: to.t,
          sector: to.s,
        }));
    if (makingPrediction && me.faction === 'beneGesserit' && !me.prediction)
      return [
        {
          type: 'predict',
          faction: g.players.find((p) => p.id !== me.id)!.faction,
          turn: 3 + Math.floor(variation(g, 'prediction') * 5),
        },
      ];
    return [];
  }
  if (
    !g.battle &&
    g.choamCashIn?.karamas.length &&
    (me.spice ?? 0) < (level === 0 ? 2 : 5)
  ) {
    const card = g.choamCashIn.karamas[0];
    const preserve =
      g.choamWorthless?.pending ??
      (g.decision?.kind === 'choamMovement'
        ? g.choamWorthless?.cards.find((c) => c.name === 'Baliset')?.id
        : g.decision?.kind === 'choamStorm'
          ? g.choamWorthless?.cards.find((c) => c.name === 'Jubba Cloak')?.id
          : gamontAction(g)?.card);
    const selected = g.choamCashIn.cards.filter(
      (c) => c.kind === 'worthless' && c.id !== card.id && c.id !== preserve,
    );
    if (
      selected.length &&
      (!g.auction ||
        g.auction.bidder !== me.id ||
        g.auction.bid <=
          (me.spice ?? 0) + selected.length * 3 + (g.auction.allyPayment ?? 0))
    )
      return [
        {
          type: 'card',
          mode: 'special',
          card: card.id,
          cards: selected.map((c) => c.id),
        },
      ];
  }
  if (g.phaseOpening) {
    if (g.phaseOpening.passed.includes(me.id)) return [];
    const amal = me.hand?.find((c) => c.effect === 'amal');
    // Rival spice is private. Low own losses inform this choice.
    if (
      amal &&
      g.turn > 1 &&
      (me.spice ?? 0) <= (level === 0 ? 4 : 2) &&
      (level > 0 || variation(g, 'amal') > 0.4)
    )
      return [{ type: 'card', card: amal.id }];
    return [{ type: 'ready' }];
  }
  const sapho = saphoAction(g);
  if (sapho) return [sapho];
  const specialCard =
    !g.choamMarket &&
    (!g.revival.pending ||
      (me.faction === 'tleilaxu' && g.decision?.kind === 'revivalStop')) &&
    g.advanced &&
    !me.specialKaramaUsed &&
    me.hand?.find((c) => c.effect === 'karama');
  if (
    specialCard &&
    me.faction === 'ixians' &&
    g.phase === 5 &&
    g.active === me.id &&
    !g.response &&
    !g.decision &&
    g.mobileStronghold?.location &&
    !g.homeworldMobility?.mobileStrongholdBlocked &&
    (me.forces[MOBILE_LOCATION] ?? 0) > 0
  ) {
    const capacity = (me.forces[MOBILE_LOCATION] ?? 0) * 2;
    const route = mobileRoutes(g, 2)
      .map((route) => ({
        route,
        value: route.reduce(
          (sum, key) => sum + Math.min(g.spice[key] ?? 0, capacity),
          0,
        ),
      }))
      .sort((a, b) => b.value - a.value)[0];
    if (route && route.value >= [4, 5, 6, 6][level])
      return [
        {
          type: 'card',
          mode: 'special',
          card: specialCard.id,
          route: route.route,
        },
      ];
  }
  if (
    specialCard &&
    me.faction === 'fremen' &&
    g.phase === 1 &&
    !g.summonedWorm
  ) {
    const targets = TERRITORIES.filter((t) => t.type === 'sand')
      .map((t) => ({
        territory: t.id,
        enemy: g.players
          .filter((p) => p.id !== me.id && p.id !== me.ally)
          .reduce((sum, p) => sum + countAt(p, t.id), 0),
        own: countAt(me, t.id),
      }))
      .sort((a, b) => b.enemy * 3 + b.own - (a.enemy * 3 + a.own));
    const choice = targets[0];
    if (
      choice &&
      (choice.enemy >= (level === 0 ? 1 : 3) ||
        (choice.own >= 5 && g.turn >= 3))
    )
      return [
        {
          type: 'card',
          mode: 'special',
          card: specialCard.id,
          territory: choice.territory,
        },
      ];
  }
  if (specialCard && me.faction === 'harkonnen' && g.phase === 3) {
    const victim = g.players
      .filter((p) => p.id !== me.id && (p.handCount ?? 0) > 0)
      .sort(
        (a, b) =>
          (b.ally === me.id ? -10 : 0) +
          (b.handCount ?? 0) -
          ((a.ally === me.id ? -10 : 0) + (a.handCount ?? 0)),
      )[0];
    if (victim)
      return [
        {
          type: 'card',
          mode: 'special',
          card: specialCard.id,
          target: victim.id,
          amount: Math.min(level === 0 ? 1 : 4, victim.handCount!),
        },
      ];
  }
  if (specialCard && me.faction === 'emperor' && g.phase === 4) {
    const dead = me.leaders
      .filter((l) => l.dead && !l.capturedBy && !l.gholaBy)
      .sort((a, b) => b.strength - a.strength)[0];
    if (dead && (level === 0 || dead.strength >= 4))
      return [
        {
          type: 'card',
          mode: 'special',
          card: specialCard.id,
          leader: dead.id,
        },
      ];
    const elite = Math.min(
      me.elites?.tanks ?? 0,
      eliteRevivalRemaining(me, g.advanced),
    );
    const amount = Math.min(3, me.tanks - (me.elites?.tanks ?? 0) + elite);
    if (amount === 3 || (level === 0 && amount > 0))
      return [
        { type: 'card', mode: 'special', card: specialCard.id, amount, elite },
      ];
  }
  if (g.response) {
    const benefitEnemy =
      g.response.owner !== me.id && g.response.owner !== me.ally;
    const combatant =
      !!g.battle && [g.battle.attacker, g.battle.defender].includes(me.id);
    const targeted =
      combatant &&
      ((g.response.kind === 'voice' && g.battle!.voice?.target === me.id) ||
        (g.response.kind === 'prescience' &&
          g.battle!.prescience?.player !== me.id) ||
        (g.response.kind === 'nexusPrescience' &&
          g.battle!.nexusInspection?.target === me.id) ||
        g.response.kind === 'harkonnenTraitor' ||
        g.response.kind === 'eliteStrength' ||
        g.response.kind === 'fremenSupport' ||
        g.response.kind === 'choamBattleAid');
    const auditThreat =
      g.response.kind === 'choamAudit' &&
      g.auditor?.opponent === me.id &&
      (g.auditor.count ?? 0) > 0;
    const movementThreat =
      g.response.kind === 'fremenMovement' &&
      !!g.response.location &&
      fighterCount(me, splitLocation(g.response.location).territory) > 0;
    const card = me.hand?.find((c) =>
      g.responseControls?.cancelCards.includes(c.id),
    );
    if (
      card &&
      benefitEnemy &&
      ((level >= 2 && (targeted || movementThreat || auditThreat)) ||
        (level === 3 &&
          ([
            'harkonnenBonus',
            'choamCharity',
            'choamBattleIncome',
            'ecazCollection',
          ].includes(g.response.kind) ||
            (g.response.kind === 'choamInflation' &&
              g.response.intent === 'double'))))
    )
      return [{ type: 'card', card: card.id, mode: 'cancel' }];
    return !g.responseControls?.cancelCards.length ||
      g.responseControls.hasPassed
      ? []
      : [{ type: 'passResponse' }];
  }
  if (g.biddingEnd && !g.decision)
    return biddingEndActions(
      g, level, (card) => technologyCardValue(g, card), gamontAction(g)?.card,
    );
  if (g.decision) {
    if (g.decision.player !== me.id) return [];
    const d = g.decision;
    if (d.kind === 'choamAudit')
      return [{ type: 'decision', event: d.event, audit: true }];
    if (d.kind === 'choamAuditPayment') {
      const count = g.auditor?.count ?? 0;
      // Only the AI's own hand and public spice inform the value of secrecy.
      const valuable =
        me.hand?.filter((c) => c.kind !== 'worthless').length ?? 0;
      const pay =
        count > 0 &&
        (me.spice ?? 0) >= count &&
        level > 0 &&
        valuable > 0 &&
        (me.spice ?? 0) >= count + (level === 1 ? 6 : 3);
      return [
        { type: 'decision', event: d.event, pay, ...(pay ? { count } : {}) },
      ];
    }
    if (d.kind === 'strongholdCopy') {
      const score = (id: string) =>
        id === 'arrakeen'
          ? (me.spice ?? 0) < 3
            ? 12
            : 7
          : id === 'carthag'
            ? me.hand?.some(
                (c) => c.kind === 'shield' || c.kind === 'weirdingWay',
              )
              ? 9
              : 2
            : id === 'habbanya_ridge_sietch'
              ? g.battle?.defender === me.id
                ? 8
                : 1
              : id === 'sietch_tabr'
                ? 6
                : (me.hand?.filter((c) => c.kind === 'worthless').length ?? 0) *
                  4;
      const choices = [...d.choices].sort((a, b) =>
        level === 0 ? variation(g, a) - variation(g, b) : score(b) - score(a),
      );
      return choices.map((stronghold) => ({
        type: 'decision',
        event: d.event,
        stronghold,
      }));
    }
    if (d.kind === 'richeseAllyOpportunity') {
      const offer = alliedNoFieldOffer(g);
      return offer
        ? [offer, { type: 'decision', decline: true }]
        : [{ type: 'decision', decline: true }];
    }
    if (d.kind === 'richeseAllyShipment') {
      const offer = g.richeseNoField?.allyOffer;
      if (!offer || offer.recipient !== me.id) return [];
      if (
        offer.blocked ||
        offer.amount <= 0 ||
        (offer.payer === me.id && (me.spice ?? 0) < offer.cost)
      )
        return [{ type: 'decision', event: offer.event, decline: true }];
      return [
        {
          type: 'decision',
          event: offer.event,
          accept: true,
          elite: level === 0 ? offer.eliteMin : offer.eliteMax,
        },
        // A supported-looking offer can fail its authoritative arrival preflight.
        // Keep a legal exit without deriving private balances or token data.
        { type: 'decision', event: offer.event, decline: true },
      ];
    }
    if (d.kind === 'ecazSpice') {
      if (!g.ecazSpice?.allocation) return [];
      const allocation = g.ecazSpice.allocation;
      const lot = allocation.lots[allocation.index];
      const offer = allocation.offer;
      const ownShare = offer
        ? me.id === lot.ecaz
          ? offer.ecazShare
          : lot.amount - offer.ecazShare
        : 0;
      const fairShare =
        me.id === lot.ecaz
          ? Math.floor(lot.amount / 2)
          : Math.ceil(lot.amount / 2);
      return [
        {
          type: 'decision',
          event: g.ecazSpice.event,
          allocation:
            offer && ownShare >= fairShare
              ? { kind: 'accept' }
              : { kind: 'equal' },
        },
      ];
    }
    if (d.kind === 'ecazPlacement') {
      const ambassadors = g.ambassadors;
      if (
        ambassadors &&
        !ambassadors.blocked &&
        ambassadors.nextCost <= (me.spice ?? 0)
      ) {
        const token = ambassadors.tokens.find((t) => t.zone === 'supply');
        const target = gameTerritories(g).find(
          (t) =>
            t.type === 'stronghold' &&
            t.id !== MOBILE_STRONGHOLD &&
            !t.sectors.includes(g.storm) &&
            !ambassadors.tokens.some(
              (a) => a.zone === 'placed' && a.location === t.id,
            ),
        );
        if (token && target)
          return [{ type: 'decision', token: token.id, territory: target.id }];
      }
      return [{ type: 'decision', decline: true }];
    }
    if (d.kind === 'moritaniRetention') {
      const candidates = (me.hand ?? [])
        .filter((card) => d.cards.includes(card.id))
        .sort((a, b) => technologyCardValue(g, b) - technologyCardValue(g, a));
      return [{ type: 'decision', keep: candidates[0]?.id ?? null }];
    }
    if (d.kind === 'moritaniTerror') {
      const entry = g.terrorEntry;
      if (!entry) return [];
      if (entry.stage === 'select') {
        const candidate = entry.candidates?.find((candidate) => candidate.canReveal || candidate.canOfferAlliance);
        return [candidate ? { type: 'decision', token: candidate.token } : { type: 'decision', decline: true }];
      }
      if (entry.stage === 'allianceReply') {
        const moritani = g.players.find(
          (player) => player.faction === 'moritani',
        )!;
        const previous = me.ally
          ? g.players.find((player) => player.id === me.ally)
          : undefined;
        const strength = (player: typeof me) =>
          Object.values(player.forces).reduce((sum, count) => sum + count, 0);
        return [
          {
            type: 'decision',
            accept:
              level > 0 &&
              (!previous || strength(moritani) >= strength(previous)),
          },
        ];
      }
      if (
        entry.stage === 'offer' &&
        entry.canOfferAlliance &&
        !(
          entry.kind === 'sneakAttack' &&
          (entry.sneakAttack?.blocked || entry.sneakAttack?.maximum === 0)
        ) &&
        level > 0 &&
        !me.ally &&
        g.players.find((player) => player.id === entry.entrant)?.ally === null
      )
        return [{ type: 'decision', alliance: true }];
      if (entry.stage === 'offer')
        return [
          {
            type: 'decision',
            ...(entry.canReveal &&
            !(
              entry.kind === 'sneakAttack' &&
              (entry.sneakAttack?.blocked || entry.sneakAttack?.maximum === 0)
            )
              ? { reveal: true }
              : { decline: true }),
          },
        ];
      if (entry.stage === 'sneakAttack')
        return [
          {
            type: 'decision',
            amount: entry.sneakAttack?.blocked
              ? 0
              : (entry.sneakAttack?.maximum ?? 0),
          },
        ];
      if (entry.stage === 'robbery')
        return [
          {
            type: 'decision',
            choice: (me.hand?.length ?? 0) < me.handLimit ? 'card' : 'spice',
          },
        ];
      if (entry.stage === 'gift') return [{ type: 'decision', decline: true }];
      const cards = [...(me.hand ?? [])];
      const card = cards.find((c) => c.kind === 'worthless') ?? cards[0];
      return card ? [{ type: 'decision', card: card.id }] : [];
    }
    if (d.kind === 'richeseBlackMarket')
      return [
        { type: 'decision', event: g.richeseBidding!.event, decline: true },
      ];
    if (d.kind === 'richeseDeclaration')
      return [
        {
          type: 'decision',
          event: g.richeseBidding!.event,
          position: level >= 2 ? 'last' : 'first',
        },
      ];
    if (d.kind === 'richeseCache') {
      const cards = [...(g.richeseBidding?.cache ?? [])].sort(
        (a, b) => technologyCardValue(g, a) - technologyCardValue(g, b),
      );
      return cards.length
        ? [
            {
              type: 'decision',
              event: g.richeseBidding!.event,
              card: cards[0].id,
              method: level === 0 ? 'silent' : 'onceAround',
              direction: 'clockwise',
            },
          ]
        : [];
    }
    if (d.kind === 'richeseUnbid')
      return [
        {
          type: 'decision',
          event: g.richeseBidding!.event,
          keep: (me.hand?.length ?? 0) < me.handLimit,
        },
      ];
    if (d.kind === 'ecazAmbassador') {
      const entry = g.ambassadorEntry;
      if (!entry) return [];
      const action = { type: 'decision' as const, event: entry.event };
      const canBuyRichese =
        (me.spice ?? 0) >= 3 &&
        (me.hand?.length ?? me.handLimit) < me.handLimit;
      const hasFremenGroup =
        Object.entries(me.forces).some(
          ([key, count]) =>
            count > 0 &&
            (splitLocation(key).sector === 0 ||
              splitLocation(key).sector !== g.storm),
        ) ||
        !!(
          me.noField?.deployed &&
          (me.noField.deployed.location.sector === 0 ||
            me.noField.deployed.location.sector !== g.storm)
        );
      if (entry.stage === 'allianceReply') return [{ ...action, accept: true }];
      if (entry.stage === 'offer') {
        if (entry.effect === 'ecaz')
          return [
            entry.allianceOffer && !entry.allianceOffer.blocked
              ? {
                  ...action,
                  trigger: true,
                  beneficiary: entry.owner,
                  choice: 'alliance',
                }
              : entry.dukeAcquisition && !entry.dukeAcquisition.blocked
                ? {
                    ...action,
                    trigger: true,
                    beneficiary: entry.owner,
                    choice: 'duke',
                  }
                : { ...action, decline: true },
          ];
        const available = entry.beneficiaries.filter(
          (option) =>
            !option.blocked &&
            (entry.effect !== 'richese' ||
              option.player !== me.id ||
              canBuyRichese) &&
            (entry.effect !== 'fremen' ||
              option.player !== me.id ||
              hasFremenGroup) &&
            (entry.effect !== 'guild' ||
              option.player !== me.id ||
              me.reserves > 0),
        );
        const beneficiary =
          available.find((option) => option.player === me.id) ?? available[0];
        return [
          beneficiary
            ? { ...action, trigger: true, beneficiary: beneficiary.player }
            : { ...action, decline: true },
        ];
      }
      if (entry.stage === 'copy') {
        const available = entry.copies.filter((option) => !option.blocked);
        const useful = available.filter(
          (option) =>
            (option.effect !== 'richese' || canBuyRichese) &&
            (option.effect !== 'fremen' || hasFremenGroup) &&
            (option.effect !== 'guild' || me.reserves > 0),
        );
        const choices = useful.length ? useful : available;
        const order = [
          'emperor',
          ...(me.hand?.some((card) => card.kind === 'worthless')
            ? ['choam']
            : []),
          'atreides',
          'harkonnen',
          'ixians',
          'fremen',
          'guild',
          'richese',
          'choam',
        ];
        choices.sort((a, b) =>
          level === 0
            ? variation(g, a.effect) - variation(g, b.effect)
            : order.indexOf(a.effect) - order.indexOf(b.effect),
        );
        return choices.length ? [{ ...action, effect: choices[0].effect }] : [];
      }
      if (entry.stage === 'move') return fremenAmbassadorMoves(g);
      if (entry.stage === 'ship') return guildAmbassadorShipments(g);
      if (entry.stage !== 'cards') return [];
      const cards = (me.hand ?? []).filter((card) =>
        entry.cards.some(
          (option) => option.card === card.id && !option.blocked,
        ),
      );
      if (entry.effect === 'choam')
        return [
          {
            ...action,
            cards: cards
              .filter(
                (card) =>
                  card.kind === 'worthless' ||
                  (level > 0 && card.kind === 'hero' && (me.spice ?? 0) < 5),
              )
              .map((card) => card.id),
          },
        ];
      cards.sort(
        (a, b) => technologyCardValue(g, a) - technologyCardValue(g, b),
      );
      return cards.length ? [{ ...action, cards: [cards[0].id] }] : [];
    }
    if (d.kind === 'moritaniSetup') {
      const choices = TERRITORIES.filter((t) =>
        g.players.every((p) => countAt(p, t.id) === 0),
      );
      const target =
        (level > 0
          ? choices.find((t) => t.type === 'stronghold')
          : undefined) ?? choices[0];
      return target
        ? [
            {
              type: 'decision',
              territory: target.id,
              sector: target.sectors[0],
            },
          ]
        : [];
    }
    if (d.kind === 'moritaniPlacement') {
      const tokens = g.moritaniTerror?.tokens ?? [];
      const destinations = TERRITORIES.filter(
        (t) =>
          t.type === 'stronghold' &&
          !tokens.some(
            (token) => token.status === 'placed' && token.location === t.id,
          ),
      );
      const token =
        tokens.find(
          (token) => token.status === 'available' && 'kind' in token,
        ) ??
        tokens.find((token) => token.status === 'placed' && 'kind' in token);
      const target =
        (level > 0
          ? destinations.find((t) =>
              g.players.some(
                (p) =>
                  p.id !== me.id && p.id !== me.ally && countAt(p, t.id) > 0,
              ),
            )
          : undefined) ?? destinations[0];
      return token && target
        ? [{ type: 'decision', token: token.id, territory: target.id }]
        : [{ type: 'decision', decline: true }];
    }
    if (d.kind === 'choamStorm') {
      const card = g.choamWorthless?.cards.find(
        (c) => c.name === 'Jubba Cloak',
      );
      const target = [...d.territories].sort(
        (a, b) => b.amount - a.amount || a.territory.localeCompare(b.territory),
      )[0];
      return [
        card && target
          ? {
              type: 'card',
              mode: 'choam',
              card: card.id,
              territory: target.territory,
            }
          : { type: 'decision', decline: true },
      ];
    }
    if (d.kind === 'choamMovement') {
      const card = g.choamWorthless?.cards.find((c) => c.name === 'Baliset');
      return [
        card && d.mover !== me.ally
          ? { type: 'card', mode: 'choam', card: card.id }
          : { type: 'decision', decline: true },
      ];
    }
    if (d.kind === 'choamMentat')
      return [gamontAction(g) ?? { type: 'decision', done: true }];
    if (d.kind === 'choamFreeRevival') {
      const card = g.choamWorthless?.cards.find((c) => c.name === 'La La La');
      if (card && d.recipient !== me.ally && level > 0)
        return [{ type: 'card', mode: 'choam', card: card.id }];
      return [{ type: 'decision', decline: true }];
    }
    if (d.kind === 'choamBattleFunding') {
      const ally = g.players.find((p) => p.id === me.ally)!;
      const pool = g.combatLocations?.find(
        (place) => place.id === g.battle!.territory,
      )?.forces?.[ally.id];
      const forces = pool
        ? pool.normal + pool.elite
        : countAt(ally, g.battle!.territory);
      const total = (me.spice ?? 0) + g.aid.pledged;
      const amount = Math.max(
        g.aid.pledged,
        Math.min(forces, Math.max(0, total - (level === 0 ? 4 : 2))),
      );
      return [{ type: 'decision', amount }];
    }
    if (d.kind === 'choamMarket')
      return [choamMarketPolicy(
        g, (card) => technologyCardValue(g, card), gamontAction(g)?.card,
      )];
    if (d.kind === 'choamTradeReply') {
      const returned = [...(me.hand ?? [])].sort(
        (a, b) => technologyCardValue(g, a) - technologyCardValue(g, b),
      )[0];
      return returned && g.choamMarket?.offered
        ? [{ type: 'decision', card: returned.id }]
        : [{ type: 'decision', decline: true }];
    }
    if (d.kind === 'choamTradeConfirm') {
      const market = g.choamMarket!;
      return market.offered &&
        market.returned &&
        (level === 0 ||
          technologyCardValue(g, market.returned) >=
            technologyCardValue(g, market.offered))
        ? [{ type: 'decision', accept: true }]
        : [{ type: 'decision', decline: true }];
    }
    if (d.kind === 'ixSetup' || d.kind === 'ixAuction') {
      const cards =
        d.kind === 'ixSetup' ? g.ixTechnology?.setup : g.ixTechnology?.pool;
      const sorted = [...(cards ?? [])].sort(
        (a, b) => technologyCardValue(g, b) - technologyCardValue(g, a),
      );
      if (!sorted.length) return [];
      return [
        {
          type: 'decision',
          card: (d.kind === 'ixSetup' ? sorted[0] : sorted.at(-1)!).id,
          position: 'bottom',
        },
      ];
    }
    if (d.kind === 'ixTechnology') {
      const offered = [...(me.hand ?? [])].sort(
        (a, b) => technologyCardValue(g, a) - technologyCardValue(g, b),
      )[0];
      const known = g.ixTechnology?.known ?? [];
      const expected = known.length
        ? known.reduce((sum, c) => sum + technologyCardValue(g, c), 0) /
          known.length
        : 5;
      return offered &&
        technologyCardValue(g, offered) < expected - (level === 0 ? 0 : 1)
        ? [{ type: 'decision', card: offered.id }]
        : [{ type: 'decision', decline: true }];
    }
    if (d.kind === 'ixAllyCard')
      return [
        {
          type: 'decision',
          accept:
            !!g.ixPurchased &&
            technologyCardValue(g, g.ixPurchased) < (level === 0 ? 0.5 : 4),
        },
      ];
    if (d.kind === 'mobileStronghold') {
      if (!d.placement && g.homeworldMobility?.mobileStrongholdBlocked)
        return [{type: 'decision', decline: true}];
      if (d.placement)
        return TERRITORIES.filter((t) => t.type !== 'stronghold')
          .flatMap((t) =>
            t.sectors.map((s) => ({
              type: 'decision',
              location: location(t.id, s),
            })),
          )
          .sort(
            (a, b) =>
              (splitLocation(a.location).sector === g.storm ? 1 : 0) -
                (splitLocation(b.location).sector === g.storm ? 1 : 0) ||
              variation(g, b.location) - variation(g, a.location),
          );
      const capacity = (me.forces[MOBILE_LOCATION] ?? 0) * 2;
      const routes = mobileRoutes(g, 3)
        .map((route) => ({
          route,
          score: route.reduce(
            (sum, key) => sum + Math.min(g.spice[key] ?? 0, capacity),
            0,
          ),
        }))
        .sort((a, b) => b.score - a.score);
      return [
        ...routes
          .filter((r) => r.score > 0)
          .map((r) => ({ type: 'decision', route: r.route })),
        { type: 'decision', decline: true },
      ];
    }
    if (d.kind === 'ixSubstitution') {
      const world = g.combatLocations?.find(
        (place) => place.id === d.territory && place.kind === 'homeworld',
      );
      const sourceEntries = world
        ? [[world.id, world.forces?.[me.id]?.normal ?? 0] as const]
        : Object.entries(me.forces)
            .filter(([key]) => splitLocation(key).territory === d.territory)
            .map(
              ([key, n]) => [key, n - (me.elites?.forces[key] ?? 0)] as const,
            );
      const max = Math.min(
        Object.values(d.losses).reduce((a, b) => a + b, 0),
        sourceEntries.reduce((sum, [, n]) => sum + n, 0),
      );
      const count = level === 0 ? Math.min(1, max) : max;
      if (!count) return [{ type: 'decision', decline: true }];
      const take = (
        entries: [string, number][] | (readonly [string, number])[],
      ) => {
        let remaining = count;
        const result: Record<string, number> = {};
        for (const [key, n] of entries) {
          const selected = Math.min(n, remaining);
          if (selected) result[key] = selected;
          remaining -= selected;
        }
        return result;
      };
      return [
        {
          type: 'decision',
          sources: take(sourceEntries),
          recover: take(Object.entries(d.losses)),
        },
      ];
    }
    if (d.kind === 'revivalStop') {
      const target = g.players.find((p) => p.id === d.recipient)!;
      const noLeader = !target.leaders.some(
        (l) => !l.dead && controlsLeader(target, l),
      );
      const shouldStop =
        target.id !== me.ally &&
        (target.tanks >= [12, 8, 5, 3][level] ||
          (level > 0 && d.revival === 'leader' && noLeader));
      if (specialCard && shouldStop && !g.revival.specialKaramaBlock)
        return [
          {
            type: 'card',
            mode: 'special',
            card: specialCard.id,
            target: target.id,
          },
        ];
      return [{ type: 'decision', decline: true }];
    }
    if (d.kind === 'faceDance') {
      if (
        d.blocked ||
        !me.faceDancers?.some((c) => !c.revealed && c.leader === d.identity) ||
        me.ally === d.winner
      )
        return [{ type: 'decision', reveal: false }];
      const winner = g.players.find((p) => p.id === d.winner)!;
      const world = g.combatLocations?.find(
        (place) => place.id === d.territory && place.kind === 'homeworld',
      );
      const pool = world?.forces?.[winner.id];
      let needed = world
        ? (pool?.normal ?? 0) + (pool?.elite ?? 0)
        : countAt(winner, d.territory);
      const sources: Record<string, number> = world
        ? {}
        : {
            reserves: Math.min(me.reserves, needed),
          };
      needed -= sources.reserves ?? 0;
      for (const [key, amount] of Object.entries(me.forces).sort(
        ([a], [b]) =>
          (territory(splitLocation(a).territory).type === 'stronghold'
            ? 1
            : 0) -
          (territory(splitLocation(b).territory).type === 'stronghold' ? 1 : 0),
      )) {
        const take = Math.min(
          needed,
          Math.max(
            0,
            amount -
              (territory(splitLocation(key).territory).type === 'stronghold'
                ? 1
                : 0),
          ),
        );
        if (take) sources[key] = take;
        needed -= take;
      }
      return [
        {
          type: 'decision',
          reveal: true,
          sources,
          ...(world
            ? {}
            : {
                sector:
                  territory(d.territory).sectors.find((s) => s !== g.storm) ??
                  territory(d.territory).sectors[0],
              }),
        },
      ];
    }
    if (d.kind === 'homeworldDefense') {
      const b = g.battle!;
      const own = b.plans[me.id];
      const opponentId = b.attacker === me.id ? b.defender : b.attacker;
      const opponent = b.plans[opponentId];
      const snooper = me.hand?.find(
        (card) =>
          richeseCardDefinition(card)?.card.effect === 'portableSnooper',
      );
      const card = (id: string | null) =>
        b.cards.find((held) => held.id === id);
      const dead = (late: boolean) =>
        strongholdBattleEffects(
          card(own.weapon),
          late ? snooper : card(b.lateDefense[me.id] ?? own.defense),
          card(opponent.weapon),
          card(b.lateDefense[opponentId] ?? opponent.defense),
          b.poisonTooth[me.id] ?? true,
          b.poisonTooth[opponentId] ?? true,
          b.strongholdEffects[me.id],
          b.strongholdEffects[opponentId],
        ).attackerDead;
      const hasLeader =
        g.allLeaders.some((leader) => leader.id === own.leader) ||
        (!!own.kwisatz && card(own.leader)?.kind === 'hero');
      return [
        {
          type: 'decision',
          event: d.event,
          use: !!snooper && hasLeader && dead(false) && !dead(true),
        },
      ];
    }
    if (d.kind === 'homeworldExplosion') {
      const choices = d.options
        .map((loss, choice) => ({
          choice,
          cost:
            level === 0
              ? variation(g, `homeworld-explosion-${choice}`)
              : loss.normal + loss.elite * 2.5,
        }))
        .sort((a, b) => a.cost - b.cost);
      return choices.length
        ? [{ type: 'decision', event: d.event, choice: choices[0].choice }]
        : [];
    }
    if (d.kind === 'techToken') {
      const token = [...d.choices].sort((a, b) =>
        level === 0
          ? variation(g, a) - variation(g, b)
          : ['heighliners', 'production', 'axlotl'].indexOf(a) -
            ['heighliners', 'production', 'axlotl'].indexOf(b),
      )[0];
      return [{ type: 'decision', token }];
    }
    if (d.kind === 'stoneBurner') {
      const b = g.battle!,
        own = b.plans[me.id];
      const enemy = me.id === b.attacker ? b.defender : b.attacker;
      const other = b.plans[enemy];
      const card = (id: string | null) => b.cards.find((c) => c.id === id);
      const ownDisc = g.allLeaders.find((l) => l.id === own.leader);
      const otherDisc = g.allLeaders.find((l) => l.id === other.leader);
      const alreadyWinsByTraitor =
        b.traitorVoters.includes(me.id) &&
        !other.kwisatz &&
        !!matchingTraitor(me.traitors ?? [], other.leader, card(other.leader));
      const side = me.id === b.attacker ? 'attacker' : 'defender';
      const pools = b.stoneBurnerContext?.opponentPools ?? [];
      const winners = b.ownForces
        ? pools.map((pool) =>
            side === 'attacker'
              ? stoneBurnerComparison(
                  b.ownForces!,
                  own.dial,
                  own.support,
                  pool,
                  other.dial,
                  other.support,
                  b.tieWinner === b.attacker ? 'attacker' : 'defender',
                ).winner
              : stoneBurnerComparison(
                  pool,
                  other.dial,
                  other.support,
                  b.ownForces!,
                  own.dial,
                  own.support,
                  b.tieWinner === b.attacker ? 'attacker' : 'defender',
                ).winner,
          )
        : [];
      const winning =
        winners.length > 0 && winners.every((winner) => winner === side);
      const effects = strongholdBattleEffects(
        card(own.weapon),
        card(b.lateDefense[me.id] ?? own.defense),
        card(other.weapon),
        card(b.lateDefense[enemy] ?? other.defense),
        b.poisonTooth[me.id] ?? true,
        b.poisonTooth[enemy] ?? true,
        b.strongholdEffects[me.id],
        b.strongholdEffects[enemy],
      );
      const ownValue = battleLeaderStrength(ownDisc, otherDisc);
      const otherValue = battleLeaderStrength(otherDisc, ownDisc);
      const ownAdditional = effects.attackerDead ? 0 : ownValue;
      const otherAdditional = effects.defenderDead ? 0 : otherValue;
      const bounty = effects.noBounty ? 0 : ownAdditional + otherAdditional;
      const explosion = battleWeaponsExplode(
        card(own.weapon),
        card(b.lateDefense[me.id] ?? own.defense),
        card(other.weapon),
        card(b.lateDefense[enemy] ?? other.defense),
      );
      const benefit =
        otherAdditional -
        ownAdditional * [1.25, 1.5, 2, 2.5][level] +
        (winning ? bounty : -bounty) * 0.5;
      return [
        {
          type: 'decision',
          event: d.event,
          mode:
            !alreadyWinsByTraitor && !explosion && benefit > 0
              ? 'kill'
              : 'ignore',
        },
      ];
    }
    if (d.kind === 'poisonTooth') {
      const b = g.battle!;
      const a = b.plans[b.attacker],
        opponent = b.plans[b.defender];
      const c = (id: string | null) => b.cards.find((card) => card.id === id);
      const score = (activate: boolean) => {
        const effects = strongholdBattleEffects(
          c(a.weapon),
          c(b.lateDefense[b.attacker] ?? a.defense),
          c(opponent.weapon),
          c(b.lateDefense[b.defender] ?? opponent.defense),
          me.id === b.attacker ? activate : (b.poisonTooth[b.attacker] ?? true),
          me.id === b.defender ? activate : (b.poisonTooth[b.defender] ?? true),
          b.strongholdEffects[b.attacker],
          b.strongholdEffects[b.defender],
        );
        const strength = (id: string, dead: boolean) =>
          dead || effects.stunned
            ? 0
            : battleLeaderStrength(
                g.allLeaders.find((l) => l.id === b.plans[id].leader),
                g.allLeaders.find(
                  (l) =>
                    l.id ===
                    b.plans[id === b.attacker ? b.defender : b.attacker].leader,
                ),
              ) + (b.plans[id].kwisatz ? 2 : 0);
        const av =
            a.dial +
            strength(b.attacker, effects.attackerDead) +
            (b.native === b.attacker ? b.nativeBattleStrength : 0),
          dv =
            opponent.dial +
            strength(b.defender, effects.defenderDead) +
            (b.native === b.defender ? b.nativeBattleStrength : 0);
        const winsA = av > dv || (av === dv && b.tieWinner === b.attacker);
        const wins = winsA === (me.id === b.attacker);
        const ownDead =
          me.id === b.attacker ? effects.attackerDead : effects.defenderDead;
        const enemyDead =
          me.id === b.attacker ? effects.defenderDead : effects.attackerDead;
        return (
          (wins ? 100 : 0) +
          (ownDead ? 0 : 15) +
          (enemyDead ? 3 : 0) -
          (activate ? 2 : 0)
        );
      };
      return [
        {
          type: 'decision',
          activate:
            level === 0
              ? variation(g, 'tooth') > 0.5
              : score(true) > score(false),
        },
      ];
    }
    if (d.kind === 'fullPlanOffer') {
      const b = g.battle!;
      const beneficiary = [b.attacker, b.defender].includes(me.id)
        ? me.id
        : me.ally;
      if (
        specialCard &&
        beneficiary &&
        [b.attacker, b.defender].includes(beneficiary)
      )
        return [
          {
            type: 'card',
            mode: 'special',
            card: specialCard.id,
            target: b.attacker === beneficiary ? b.defender : b.attacker,
          },
        ];
      return [{ type: 'decision', decline: true }];
    }
    // A legacy inspection gate is cleared by authoritative normalization.
    if (d.kind === 'fullPlanRead') return [];
    if (d.kind === 'homeworldShipmentGuild') {
      const world = g.homeworlds?.worlds?.find((home) => home.id === d.destination);
      const enemy = d.shipper !== me.id && d.shipper !== me.ally;
      const threatened = world?.native === me.id || !!world?.forces[me.id];
      if (specialCard && enemy && (level === 0 || threatened || (level >= 2 && d.amount >= 5)))
        return [{ type: 'card', mode: 'special', card: specialCard.id }];
      return [{ type: 'decision', event: d.event, allow: true }];
    }
    if (d.kind === 'guildShipment') {
      const enemy = d.shipper !== me.id && d.shipper !== me.ally;
      const threatened = fighterCount(me, d.territory) > 0;
      const stronghold = territory(d.territory).type === 'stronghold';
      if (
        specialCard &&
        enemy &&
        (level === 0 ||
          threatened ||
          (level >= 2 && stronghold && d.amount >= 3))
      )
        return [{ type: 'card', mode: 'special', card: specialCard.id }];
      return [{ type: 'decision', allow: true }];
    }
    if (d.kind === 'handExchange') {
      const value = (c: NonNullable<typeof me.hand>[number]) =>
        level === 0
          ? variation(g, c.id)
          : c.kind === 'worthless'
            ? 0
            : c.kind === 'hero'
              ? 2
              : c.effect === 'karama'
                ? 8
                : ['shield', 'snooper'].includes(c.kind)
                  ? 7
                  : 6;
      const returnCards = [...(me.hand ?? [])]
        .sort((a, b) => value(a) - value(b))
        .slice(0, d.count)
        .map((c) => c.id);
      return [{ type: 'decision', returnCards }];
    }
    if (d.kind === 'captureOffer') return [{ type: 'decision', accept: true }];
    if (d.kind === 'capturedLeader') {
      const captive = me.leaders.find((l) => l.id === d.leader);
      const ownLiving = me.leaders.some(
        (l) => l.faction === me.faction && !l.dead,
      );
      return [
        {
          type: 'decision',
          mode:
            ownLiving && level > 0 && (captive?.strength ?? 0) >= 3
              ? 'keep'
              : 'execute',
        },
      ];
    }
    if (d.kind === 'guildTiming') {
      const urgent = g.players.some(
        (p) =>
          p.id !== me.id &&
          p.id !== me.ally &&
          closeToStrongholdVictory(
            g.victoryProgress?.find((row) => row.player === p.id),
          ),
      );
      return [
        {
          type: 'decision',
          take:
            level === 0 ||
            (level === 1
              ? d.next === me.id
              : level === 3 && urgent && (me.spice ?? 0) >= 3),
        },
      ];
    }
    if (d.kind === 'intrusion') {
      const enemies = g.players
        .filter((p) => p.id !== me.id && p.id !== me.ally)
        .reduce((n, p) => n + fighterCount(p, d.territory), 0);
      return [
        {
          type: 'decision',
          accept: level === 0 || enemies >= countAt(me, d.territory),
        },
      ];
    }
    if (d.kind === 'advisorBattle') {
      const targets = d.territories.filter(
        (t) =>
          level > 0 &&
          g.players
            .filter((p) => p.id !== me.id && p.id !== me.ally)
            .every((p) => fighterCount(p, t) < countAt(me, t)),
      );
      return [
        ...targets.map((territory) => ({
          type: 'decision',
          accept: true,
          territory,
        })),
        { type: 'decision', accept: false },
      ];
    }
    if (d.kind === 'advisor' && g.guildAmbassadorAdvisorChoices) {
      const choices = g.guildAmbassadorAdvisorChoices.choices.filter(
        (choice) => !choice.blocked,
      );
      return [
        ...choices.map((choice) => ({
          type: 'decision',
          accept: true,
          accompany: choice.accompany,
          territory: choice.territory,
          sector: choice.sector,
          amount: choice.amount,
        })),
        { type: 'decision', accept: false },
      ];
    }
    if (d.kind === 'advisor')
      return [
        ...(g.advanced && d.destination && (g.homeworldMobility?.advisorAccompanyMaximum ?? 1) > 0
          ? [{ type: 'decision', accept: true, accompany: true }]
          : []),
        ...((g.homeworldMobility?.advisorSinkMaximum ?? 1) > 0
          ? [{ type: 'decision', accept: true, amount: level === 0 ? 1 : (g.homeworldMobility?.advisorSinkMaximum ?? 1) }] : []),
        { type: 'decision', accept: false },
      ];
    if (d.kind === 'wormProtection')
      return [{ type: 'decision', accept: true }];
    if (d.kind === 'stormLosses')
      return [
        { type: 'decision', elite: level === 0 ? d.maxElite : d.minElite },
      ];
    if (d.kind === 'wormPlacement') {
      const targets = TERRITORIES.filter((t) => t.type === 'sand')
        .map((t) => ({
          t: t.id,
          score:
            g.players
              .filter((p) => p.id !== me.id && p.id !== me.ally)
              .reduce((sum, p) => sum + countAt(p, t.id) * 3, 0) +
            Object.entries(g.spice)
              .filter(([key]) => splitLocation(key).territory === t.id)
              .reduce((sum, [, n]) => sum + n, 0),
        }))
        .sort((a, b) => b.score - a.score);
      return [
        { type: 'decision', accept: true, territory: targets[0].t },
        { type: 'decision', accept: false },
      ];
    }
    if (d.kind === 'battleLosses') {
      const choices = d.options
        .map((o, choice) => ({
          choice,
          score: o.normal + o.elite * (level > 0 ? 2.5 : 1),
        }))
        .sort((a, b) => a.score - b.score);
      return choices.map(({ choice }) => ({ type: 'decision', choice }));
    }
    if (d.kind === 'auctionPayment') {
      const karama = me.hand?.find((c) =>
        canUseAsKarama(g.advanced, me.faction, c),
      );
      const use =
        !!karama &&
        ((g.auction?.bid ?? 0) > (me.spice ?? 0) + g.aid.available ||
          (level >= 1 && (g.auction?.bid ?? 0) >= 4));
      return [
        { type: 'decision', karama: use },
        { type: 'decision', karama: !!karama },
      ];
    }
    if (d.kind === 'homeworldRevivalDeployment')
      return homeworldRevivalDeploymentActions(g);
    if (d.kind === 'caladanReinforcement')
      return caladanReinforcementActions(g);
    if (d.kind === 'grummanCollection')
      return grummanCollectionActions(g);
    if (d.kind === 'battleCards')
      return [
        {
          type: 'decision',
          discard: d.cards.filter(
            (id) => me.hand?.find((c) => c.id === id)?.kind === 'worthless',
          ),
        },
      ];
    return [
      ...destinations(g)
        .filter(
          (to) =>
            to.t !== d.territory && botEntryAllowed(g, me, to.t, to.s, 'move'),
        )
        .slice(0, 16)
        .map(
          (to): Action => ({
            type: 'decision',
            accept: true,
            territory: to.t,
            sector: to.s,
            forces: Object.fromEntries(
              Object.entries(me.forces).filter(
                ([key]) =>
                  splitLocation(key).territory === d.territory &&
                  splitLocation(key).sector !== g.storm,
              ),
            ),
          }),
        ),
      { type: 'decision', accept: false },
    ];
  }
  const box = g.nullentropy;
  if (
    box &&
    !box.blocked &&
    !box.search &&
    (me.spice ?? 0) >= [5, 6, 7, 8][level]
  )
    return [{ type: 'card', card: box.card.id }];
  const distrans = g.distrans;
  if (distrans && !distrans.blocked) {
    const ally = g.players.find((player) => player.id === me.ally);
    const choice = distrans.choices.find(
      (candidate) => candidate.recipient === ally?.id && !candidate.blocked,
    );
    if (ally && choice) {
      let given =
        !['beneGesserit', 'choam'].includes(me.faction) &&
        ['beneGesserit', 'choam'].includes(ally.faction)
          ? choice.cards.find((card) => card.kind === 'worthless')
          : undefined;
      if (!given && (me.hand?.length ?? 0) >= me.handLimit) {
        given = choice.cards.find((card) => {
          const ordinary = [
            'projectile',
            'poison',
            'shield',
            'snooper',
          ].includes(card.kind);
          const karama =
            card.effect === 'karama' &&
            canUseAsKarama(g.advanced, me.faction, card);
          return (
            (ordinary || karama) &&
            me.hand?.some(
              (other) =>
                other.id !== card.id &&
                other.id !== distrans.card.id &&
                (ordinary
                  ? other.kind === card.kind
                  : other.effect === 'karama' &&
                    canUseAsKarama(g.advanced, me.faction, other)),
            )
          );
        });
      }
      if (given)
        return [
          {
            type: 'card',
            card: distrans.card.id,
            target: ally.id,
            give: given.id,
          },
        ];
    }
  }
  const gift = g.richeseGift;
  if (
    gift?.owner === me.id &&
    !gift.blocked &&
    !gift.pending &&
    g.phase === 3
  ) {
    const ally = g.players.find(
      (player) => player.id === gift.recipient && player.id === me.ally,
    );
    const ownCount = me.hand?.length ?? 0;
    // Other hands' contents stay private. Only Bidding projects their card counts;
    // make space in a full hand, rather than assume an ally needs our sole Karama.
    if (
      ally?.handCount !== undefined &&
      ownCount >= me.handLimit &&
      ally.handCount < ownCount &&
      ally.handCount < ally.handLimit
    ) {
      const card = gift.cards.find(
        (candidate) =>
          richeseCardDefinition(candidate)?.card.effect === 'karama',
      );
      if (card) return [{ type: 'richeseGift', card: card.id }];
    }
  }
  const richesePurchase = g.richeseSpecialKarama;
  if (
    richesePurchase &&
    !richesePurchase.blocked &&
    richesePurchase.karamas.length &&
    (me.spice ?? 0) >= [6, 7, 8, 8][level]
  ) {
    // Until the other cache effects are enabled, acquire only the usable
    // canonical Karama. Keep a spice reserve and never inspect a hidden cache.
    const choice = richesePurchase.cards.find(
      (card) => richeseCardDefinition(card)?.card.effect === 'karama',
    );
    if (choice)
      return [
        {
          type: 'card',
          mode: 'special',
          card: richesePurchase.karamas[0].id,
          acquire: choice.id,
        },
      ];
  }
  if (g.phase === 0) {
    if (g.stormPending !== null)
      return g.ready.includes(me.id) ? [] : [{ type: 'ready' }];
    if (g.stormDialers.includes(me.id) && !g.stormSubmitted.includes(me.id))
      return [
        {
          type: 'stormDial',
          amount:
            g.turn === 1
              ? Math.floor(variation(g, 'storm') * 21)
              : 1 + Math.floor(variation(g, 'storm') * 3),
        },
      ];
    return [];
  }
  if (g.phase === 1) {
    const thumper = me.hand?.find((c) => c.effect === 'thumper');
    const prior = g.spiceDiscardTop[0];
    if (
      thumper &&
      g.beforeSpiceDraw &&
      g.turn > 1 &&
      prior &&
      'territory' in prior
    ) {
      const exposed = (p: GameView['players'][number]) =>
        p.faction === 'fremen' ? 0 : countAt(p, prior.territory);
      const enemy = g.players
        .filter((p) => p.id !== me.id && p.id !== me.ally)
        .reduce((n, p) => n + exposed(p), 0);
      const friends =
        exposed(me) +
        (me.ally ? exposed(g.players.find((p) => p.id === me.ally)!) : 0);
      if (
        !g.sandtrout &&
        (level === 0 ? variation(g, 'thumper') > 0.5 : enemy > friends)
      )
        return [{ type: 'card', card: thumper.id }];
    }
    if (
      g.spiceWindow &&
      harvesterAvailable(g.spiceWindow) &&
      countAt(me, g.spiceWindow.territory)
    ) {
      const card = me.hand?.find((c) => c.effect === 'harvester');
      if (card) return [{ type: 'card', card: card.id }];
    }
    if (g.nexus && !g.spiceWindow && !me.ally) {
      const offer = Object.entries(g.allianceOffers).find(
        ([id, target]) => id !== me.id && target === me.id && !g.homeworldAllianceBlocks?.[id],
      );
      if (offer && level > 0) return [{ type: 'alliance', target: offer[0] }];
    }
    return g.ready.includes(me.id) ? [] : [{ type: 'ready' }];
  }
  if (
    g.phase === 2 &&
    !me.charityClaimed &&
    !g.charity.incomePending &&
    g.charity.amount > 0
  )
    return [{ type: 'charity' }];
  if (g.phase === 3) {
    const lot = g.richeseAuction;
    if (lot) {
      if (
        lot.outcome ||
        !lot.eligible.includes(me.id) ||
        (lot.method === 'silent'
          ? lot.submitted.includes(me.id)
          : lot.active !== me.id)
      )
        return [];
      const pass: Action = {
        type: 'richeseBid',
        event: lot.event,
        amount: lot.method === 'silent' ? 0 : null,
        allyPayment: 0,
      };
      if (lot.source === 'blackMarket' && lot.owner === me.id) return [pass];
      const value = lot.card ? technologyCardValue(g, lot.card) : 5;
      const budget = Math.min(
        lot.ownAvailable + lot.allyAvailable,
        [1, 3, 5, 7][level] + ((me.hand?.length ?? 0) === 0 ? 2 : 0),
        level === 0 ? 3 : Math.max(0, Math.floor(value)),
      );
      const amount = lot.method === 'silent' ? budget : lot.bid + 1;
      if (amount <= 0 || amount > budget) return [pass];
      return [
        {
          type: 'richeseBid',
          event: lot.event,
          amount,
          allyPayment: Math.max(0, amount - lot.ownAvailable),
        },
        ...(lot.method === 'silent' ? [] : [pass]),
      ];
    }
    if (g.auction?.active !== me.id) return [];
    const budget = Math.min(
      (me.spice ?? 0) + g.aid.available,
      [1, 3, 5, 7][level] + ((me.hand?.length ?? 0) === 0 ? 2 : 0),
    );
    return g.auction.bid < budget
      ? [{ type: 'bid', amount: g.auction.bid + 1 }, { type: 'passBid' }]
      : [{ type: 'passBid' }];
  }
  if (g.phase === 4) {
    if (g.revival.prevented)
      return g.ready.includes(me.id) ? [] : [{ type: 'ready' }];
    const actions: Action[] = [];
    const tleilaxu = g.players.find((p) => p.faction === 'tleilaxu');
    const ordinaryLeaderAvailable = g.revival.leaders.some((l) => !l.early);
    if (me.faction === 'tleilaxu') {
      if (
        g.advanced &&
        me.leaders.filter((l) => !l.dead && controlsLeader(me, l)).length < 5
      ) {
        const candidates = g.players
          .filter((p) => p.id !== me.id)
          .flatMap((p) => p.leaders)
          .filter(
            (l) =>
              l.faction !== me.faction &&
              l.dead &&
              !l.capturedBy &&
              l.id !== 'duke-vidal' &&
              l.id !== 'choam-auditor' &&
              !me.gholaBlocked?.includes(l.id),
          )
          .sort((a, b) => b.strength - a.strength);
        for (const leader of candidates)
          if (
            (g.revival.discount
              ? Math.ceil(leader.strength / 2)
              : leader.strength) <=
            (me.spice ?? 0) - [5, 3, 2, 1][level]
          )
            actions.push({ type: 'reviveForeignGhola', leader: leader.id });
      }
      for (const [player, request] of Object.entries(g.revivalRequests)) {
        if (request.price === null && !request.declined) {
          const value =
            g.allLeaders.find((l) => l.id === request.leader)?.strength ?? 2;
          actions.push({
            type: 'quoteLeaderRevival',
            target: player,
            amount: me.ally === player ? 0 : value,
          });
        }
      }
      if (
        me.ally &&
        !g.revivalRules.discountBlocked &&
        g.revivalRules.allyDiscount !== me.ally
      )
        actions.push({ type: 'tleilaxuAllyDiscount' });
      if (!g.revivalRules.limitBlocked)
        for (const player of g.players)
          if (
            player.id !== me.id &&
            player.tanks > 3 &&
            !g.revivalRules.expanded.includes(player.id)
          )
            actions.push({ type: 'tleilaxuRevivalLimit', target: player.id });
    } else if (tleilaxu && !me.leaderRevived) {
      const request = g.revivalRequests[me.id];
      if (
        request &&
        !request.declined &&
        request.price !== null &&
        request.price <= (me.spice ?? 0)
      )
        actions.push({ type: 'acceptLeaderRevival' });
      if (
        !request &&
        me.leaders.filter((l) => l.faction === me.faction && nativeAvailable(l))
          .length <= 2 &&
        (me.leaders.some(
          (l) => l.faction === me.faction && nativeAvailable(l),
        ) ||
          me.leaders.some((l) => l.dead && l.gholaBy))
      ) {
        const dead = me.leaders
          .filter(
            (l) =>
              l.dead &&
              l.id !== 'duke-vidal' &&
              l.faction === me.faction &&
              !l.capturedBy &&
              (l.gholaBy ||
                (!ordinaryLeaderAvailable &&
                  me.leaders.some(
                    (leader) =>
                      leader.faction === me.faction && nativeAvailable(leader),
                  ))) &&
              !g.revivalRules.earlyBlocked.includes(`${me.id}:${l.id}`),
          )
          .sort((a, b) => b.strength - a.strength)[0];
        if (dead && (me.spice ?? 0) >= dead.strength)
          actions.push({ type: 'requestLeaderRevival', leader: dead.id });
      }
    }
    if (me.faction === 'fremen' && me.ally && !g.freeRevival.includes(me.ally))
      actions.push({ type: 'grantRevival' });
    if (me.faction === 'emperor' && me.ally && level > 0) {
      const ally = g.players.find((p) => p.id === me.ally)!;
      const extra =
        g.revivalPrevention?.player === ally.id
          ? 0
          : Math.min(
              ally.tanks -
                (ally.elites?.tanks ?? 0) +
                Math.min(
                  ally.elites?.tanks ?? 0,
                  eliteRevivalRemaining(ally, g.advanced),
                ),
              3 - (g.emperorExtra[ally.id] ?? 0),
              Math.floor(Math.max(0, (me.spice ?? 0) - 3) / 2),
            );
      for (let amount = extra; amount > 0; amount--) {
        const minimumElite = Math.max(
          0,
          amount - (ally.tanks - (ally.elites?.tanks ?? 0)),
        );
        for (const elite of new Set([
          Math.min(amount, eliteRevivalRemaining(ally, g.advanced)),
          minimumElite,
        ]))
          if (paidForceRevivalCost(ally, amount, elite) <= (me.spice ?? 0) - 3)
            actions.push({ type: 'emperorRevival', amount, elite });
      }
    }
    const freeRemaining = g.revival.freeRemaining;
    const eliteAllowance = Math.min(
      me.elites?.tanks ?? 0,
      eliteRevivalRemaining(me, g.advanced),
    );
    const maximum = Math.min(
      me.tanks - (me.elites?.tanks ?? 0) + eliteAllowance,
      g.revival.forcesRemaining,
    );
    for (let amount = maximum; amount > 0; amount--) {
      const minimumElite = Math.max(
        0,
        amount - (me.tanks - (me.elites?.tanks ?? 0)),
      );
      const preferredElite =
        level > 0 ? Math.min(amount, eliteAllowance) : minimumElite;
      for (const elite of new Set([preferredElite, minimumElite])) {
        const quote = forceRevivalPrice(
          me.faction,
          amount,
          elite,
          Math.min(amount, freeRemaining),
          g.revival.discount,
          undefined,
          g.revival.choamBlocked,
        );
        if (
          quote.cost === 0 ||
          quote.cost <= (me.spice ?? 0) - [5, 3, 2, 1][level]
        )
          actions.push({ type: 'revive', amount, elite });
      }
    }
    if (g.revival.kwisatz?.affordable) actions.push({ type: 'reviveKwisatz' });
    for (const leader of g.revival.leaders.filter((l) => l.affordable))
      actions.push({ type: 'reviveLeader', leader: leader.id });
    if (
      !g.ready.includes(me.id) &&
      !(
        g.revivalRequests[me.id]?.price === null &&
        !g.revivalRequests[me.id]?.declined
      )
    )
      actions.push({ type: 'ready' });
    return actions;
  }
  if (g.phase === 5) {
    const kulon = g.choamWorthless?.cards.find((c) => c.name === 'Kulon');
    if (
      kulon &&
      g.active === me.id &&
      Object.keys(me.forces).length &&
      (me.moved ?? 0) < (me.movesAllowed ?? 1)
    )
      return [{ type: 'card', mode: 'choam', card: kulon.id }];
    if (g.active !== me.id) return [];
    const cardMoves = ornithopterMoves(g);
    if (
      cardMoves.length &&
      (g.ornithopter?.active || me.shipped || me.reserves === 0)
    )
      return cardMoves;
    if (g.ornithopter?.active && me.shipped) return [{ type: 'endMovement' }];
    const actions: Action[] = [...guildHomeworldShipmentActions(g, level), ...homeworldShipmentActions(g, level)];
    const targets = destinations(g);
    const halfRate =
      me.faction === 'guild' ||
      g.players.some((p) => p.faction === 'guild' && p.id === me.ally) ||
      g.karamaShipping?.player === me.id;
    const shipmentBudget = (me.spice ?? 0) + g.aid.available;
    const noField = g.richeseNoField;
    const ownNoField = noField?.owner === me.id ? noField.private : null;
    const marker = ownNoField?.deployed;
    const deployedToken = ownNoField?.tokens.find(
      (token) => token.id === marker?.tokenId,
    );
    const materialized = Math.min(deployedToken?.value ?? 0, me.reserves);
    const reveal =
      noField?.canReveal && marker && materialized > 0
        ? { type: 'revealNoField', token: marker.tokenId, event: noField.event }
        : null;
    if (reveal && (!me.shipped || (me.moved ?? 0) >= (me.movesAllowed ?? 1)))
      return [reveal];
    const markerTargets = targets.filter(
      (to) =>
        to.t !== MOBILE_STRONGHOLD &&
        countAt(me, to.t) === 0 &&
        !territoryEntryBlock(g.players, me.id, to.t),
    );
    if (noField?.canShip && ownNoField && !marker && !me.shipped) {
      const tokens = ownNoField.tokens.filter(
        (token) => token.id !== ownNoField.lastShipped,
      );
      const preferred = me.reserves === 0 ? 0 : level === 0 ? 3 : 5;
      const selected = [...tokens].sort(
        (a, b) =>
          Math.abs(a.value - preferred) - Math.abs(b.value - preferred) ||
          b.value - a.value,
      )[0];
      if (selected)
        for (const to of markerTargets.slice(0, 24)) {
          if (Math.min(selected.value, me.reserves) === 0 && to.enemy > 0)
            continue;
          const cost = reserveShipmentCost(
            { faction: me.faction, halfRate },
            territory(to.t).type,
            1,
          );
          if (cost > shipmentBudget) continue;
          actions.push({
            type: 'ship',
            noField: selected.id,
            event: noField.event,
            territory: to.t,
            sector: to.s,
            allyPayment: Math.max(0, cost - (me.spice ?? 0)),
          });
        }
    }
    if (marker && noField && !g.homeworldMobility?.noFieldMovementBlocked && (me.moved ?? 0) < (me.movesAllowed ?? 1)) {
      const from = location(marker.location.territory, marker.location.sector);
      const range =
        fighterCount(me, 'arrakeen') || fighterCount(me, 'carthag') ? 3 : 1;
      if (marker.location.sector !== g.storm)
        for (const to of markerTargets.slice(0, 24)) {
          if (from === to.key || (materialized === 0 && to.enemy > 0)) continue;
          if (
            g.balisetRestrictions.some(
              (b) => b.player === me.id && b.territory === to.t,
            ) &&
            marker.location.territory !== to.t
          )
            continue;
          if (
            gameDistance(g, from, to.key, (key) => {
              const loc = splitLocation(key);
              return (
                loc.sector === g.storm ||
                strongholdPathBlocked(g.players, me.id, loc.territory)
              );
            }) > range
          )
            continue;
          actions.push({
            type: 'move',
            forces: {},
            noField: marker.tokenId,
            event: noField.event,
            territory: to.t,
            sector: to.s,
          });
        }
    }
    if (!me.shipped && me.reserves > 0)
      for (const to of destinations(g, g.advanced && me.faction === 'fremen')
        .filter(
          (to) =>
            botEntryAllowed(g, me, to.t, to.s, 'ship') &&
            (me.faction !== 'fremen' || fremenReserveEntry(to.t)),
        )
        .slice(0, 24)) {
        if (marker?.location.territory === to.t) continue;
        const desired = Math.min(
          me.reserves,
          level === 0 ? 1 : Math.max([1, 3, 4, 5][level], to.enemy + 2),
        );
        for (const amount of new Set([desired, Math.min(desired, 3), 1])) {
          if (
            reserveShipmentCost(
              { faction: me.faction, halfRate },
              territory(to.t).type,
              amount,
            ) > shipmentBudget
          )
            continue;
          actions.push({
            type: 'ship',
            territory: to.t,
            sector: to.s,
            amount,
            ...(level > 0
              ? { elite: Math.min(amount, me.elites?.reserves ?? 0) }
              : {}),
          });
        }
      }
    const guildTransport =
      me.faction === 'guild' ||
      g.players.some((p) => p.faction === 'guild' && p.id === me.ally);
    if (!me.shipped && guildTransport)
      for (const to of targets
        .filter((to) => botEntryAllowed(g, me, to.t, to.s, 'guildShip'))
        .slice(0, 16)) {
        if (marker?.location.territory === to.t) continue;
        if (
          me.faction === 'fremen' &&
          me.reserves > 0 &&
          guildTransportCost(
            to.t,
            Math.min(me.reserves, level === 0 ? 1 : 4),
          ) <= shipmentBudget
        )
          actions.push({
            type: 'guildShip',
            from: 'reserves',
            territory: to.t,
            sector: to.s,
            amount: Math.min(me.reserves, level === 0 ? 1 : 4),
          });
        for (const [from, n] of Object.entries(me.forces)) {
          const origin = gameTerritories(g).find(
            (t) => t.id === splitLocation(from).territory,
          )!;
          const amount =
            n -
            (level > 0 &&
            origin.type === 'stronghold' &&
            !isAdvisor(me, origin.id)
              ? 1
              : 0);
          if (
            amount > 0 &&
            origin.id !== to.t &&
            splitLocation(from).sector !== g.storm &&
            botEntryAllowed(g, me, to.t, to.s, 'guildShip', origin.id) &&
            guildTransportCost(to.t, amount) <= shipmentBudget &&
            gameDistance(g, from, to.key) > 3
          )
            actions.push({
              type: 'guildShip',
              from,
              territory: to.t,
              sector: to.s,
              amount,
            });
        }
      }
    const movingSources = Object.entries(me.forces)
      .map(([from, n]) => {
        const origin = splitLocation(from).territory;
        const retained =
          level > 0 &&
          territory(origin).type === 'stronghold' &&
          !isAdvisor(me, origin)
            ? 1
            : 0;
        const amount = n - retained;
        const availableElite = me.elites?.forces[from] ?? 0;
        const elite =
          level > 0
            ? Math.min(amount, availableElite)
            : Math.max(0, amount - (n - availableElite));
        return { from, amount, elite };
      })
      .filter((source) => source.amount > 0);
    if ((me.moved ?? 0) < (me.movesAllowed ?? 1))
      for (const to of targets
        .filter(
          (to) =>
            marker?.location.territory !== to.t &&
            movingSources.some((source) =>
              botGroundMoveAllowed(g, me, source.from, to.key, source.elite),
            ),
        )
        .slice(0, 24))
        for (const { from, amount, elite } of movingSources) {
          if (botGroundMoveAllowed(g, me, from, to.key, elite))
            actions.push({
              type: 'move',
              from,
              territory: to.t,
              sector: to.s,
              amount,
              elite,
            });
        }
    if (reveal && !actions.length) actions.push(reveal);
    if (me.shipped || !actions.some((action) => action.type === 'ship' || action.type === 'homeworldShip'))
      actions.unshift(...emperorHomeworldMoveActions(g));
    actions.push({ type: 'endMovement' });
    return g.ornithopter?.active
      ? actions.filter((action) => action.type !== 'move')
      : actions;
  }
  if (g.phase === 6) {
    const b = g.battle;
    const poison = g.residualPoison;
    const opponent =
      b?.attacker === me.id
        ? b.defender
        : b?.defender === me.id
          ? b.attacker
          : null;
    if (
      poison &&
      !poison.blocked &&
      poison.event === b?.event &&
      poison.target === opponent &&
      opponent
    )
      return [
        {
          type: 'card',
          card: poison.card.id,
          target: opponent,
          event: poison.event,
        },
      ];
    if (b?.preLeader && !b.preLeader.closed) {
      if (!opponent || b.preLeader.ready.includes(me.id)) return [];
      return [{ type: 'battlePreparationReady', event: b.preLeader.event }];
    }
    const preparation = b?.compliantPreparation?.actions[0];
    if (preparation) return [preparation];
    if (!b) return botBattleChoices(g);
    if (b.preparation) {
      if (b.preparation.owner !== me.id) return [];
      if (b.preparation.kind === 'voice')
        return level === 0
          ? [{ type: 'declineBattlePower' }]
          : [
              {
                type: 'voice',
                kind: variation(g, 'voice') > 0.5 ? 'shield' : 'snooper',
                must: false,
              },
            ];
      if (b.preparation.kind === 'prescience') {
        const target =
          b.preparation.beneficiary === b.attacker ? b.defender : b.attacker;
        return [
          {
            type: 'prescience',
            field:
              level >= 2 || b.noFieldPlayers.includes(target)
                ? 'weapon'
                : 'dial',
          },
        ];
      }
      const nexus = b.preparation.kind === 'nexusPrescienceAnswer'
        ? b.nexusInspection
        : null;
      if (
        b.preparation.kind === 'nexusPrescienceAnswer' &&
        (!nexus || nexus.target !== me.id || nexus.event !== b.event || nexus.stage !== 'answer')
      ) return [];
      const field = nexus ? nexus.field : b.prescience!.field;
      // Candidate completions are legal-checked by the server; no rival secrets enter this choice.
      return plans(g).map((p) => ({
        type: nexus ? 'nexusPrescienceAnswer' : 'prescienceAnswer',
        ...(nexus ? { event: nexus.event } : {}),
        value: p[field],
      }));
    }
    if (b.revealed) {
      const ownsTraitorDecision =
        b.traitorVoters.includes(me.id) && !b.traitorSubmitted.includes(me.id);
      const beneficiary = [b.attacker, b.defender].includes(me.id)
        ? me.id
        : me.ally;
      const enemy = b.attacker === beneficiary ? b.defender : b.attacker;
      const call =
        ownsTraitorDecision &&
        !b.plans[enemy].kwisatz &&
        !!matchingTraitor(
          me.traitors ?? [],
          b.plans[enemy].leader,
          b.cards.find((c) => c.id === b.plans[enemy].leader),
        );
      const portable = g.portableSnooper;
      if (
        !call &&
        portable &&
        !portable.blocked &&
        portable.event === b.event &&
        [b.attacker, b.defender].includes(me.id)
      ) {
        const card = (id: string | null) => b.cards.find((c) => c.id === id);
        const ownPlan = b.plans[me.id];
        const ownLeader = g.allLeaders.find((l) => l.id === ownPlan.leader);
        const protectsKwisatzHero =
          !!ownPlan.kwisatz && card(ownPlan.leader)?.kind === 'hero';
        const protection = (late: boolean) => {
          const defense = (id: string) =>
            late && id === me.id
              ? portable.card
              : card(b.lateDefense[id] ?? b.plans[id].defense);
          const effects = strongholdBattleEffects(
            card(b.plans[b.attacker].weapon),
            defense(b.attacker),
            card(b.plans[b.defender].weapon),
            defense(b.defender),
            b.poisonTooth[b.attacker] ?? true,
            b.poisonTooth[b.defender] ?? true,
            b.strongholdEffects[b.attacker],
            b.strongholdEffects[b.defender],
          );
          return me.id === b.attacker
            ? effects.attackerDead
            : effects.defenderDead;
        };
        if (
          (ownLeader || protectsKwisatzHero) &&
          protection(false) &&
          !protection(true)
        )
          return [
            {
              type: 'portableSnooper',
              card: portable.card.id,
              event: portable.event,
            },
          ];
      }
      if (!ownsTraitorDecision) return [];
      return [
        {
          type: 'traitorCall',
          call,
        },
      ];
    }
    if (
      b.fullPlan &&
      !b.submitted.includes(b.fullPlan.target) &&
      b.fullPlan.target !== me.id
    )
      return [];
    return [b.attacker, b.defender].includes(me.id) &&
      !b.submitted.includes(me.id)
      ? plans(g)
      : [];
  }
  if (g.phase === 8) {
    const gamont = gamontAction(g);
    if (gamont) return [gamont];
  }
  if (
    g.phase === 8 &&
    me.faction === 'choam' &&
    !g.inflationUsed &&
    !g.inflationAttempted
  ) {
    const doubleFirst =
      level === 0
        ? variation(g, 'inflation') > 0.5
        : (me.spice ?? 0) < 12 || me.tanks > me.reserves;
    return [
      { type: 'choamInflation', side: doubleFirst ? 'double' : 'cancel' },
    ];
  }
  if (g.phase === 8 && me.faction === 'tleilaxu' && !me.faceDancerReplaced) {
    const candidate = me.faceDancers?.find(
      (c) =>
        !c.revealed &&
        g.players.flatMap((p) => p.leaders).find((l) => l.id === c.leader)
          ?.dead,
    );
    if (candidate)
      return [{ type: 'replaceFaceDancer', leader: candidate.leader }];
  }
  return g.ready.includes(me.id) ? [] : [{ type: 'ready' }];
}

/** A voluntary recovery before ordinary passing or movement. Specific decisions,
 * free/paid revival actions and authoritative preparation witnesses keep priority. */
function standaloneGholaAction(g: GameView, ordinary: Action[]): Action | null {
  const me = g.players.find((p) => p.id === g.me)!;
  const options = g.ghola;
  const duringSale = choamSaleGholaTiming(g);
  if (
    !(me.bot ?? me.autopilot) ||
    g.status !== 'playing' ||
    !options?.available ||
    g.battle ||
    (g.response && !duringSale) ||
    g.decision ||
    g.truthtrance ||
    g.phaseOpening ||
    g.automaticContinuationPending ||
    g.auction ||
    g.richeseAuction ||
    g.phase <= 1 ||
    (g.ready.includes(me.id) && !duringSale) ||
    ([5, 6].includes(g.phase) && g.active !== me.id && !duringSale) ||
    g.shipmentCompletion?.actions.length ||
    (!duringSale && ordinary[0] &&
      ![
        'ready',
        'ship',
        'guildShip',
        'homeworldShip',
        'guildHomeworldShip',
        'junctionShip',
        'move',
        'endMovement',
        'chooseBattle',
        'passBid',
      ].includes(ordinary[0].type))
  )
    return null;
  const card = me.hand?.find(
    (candidate) =>
      candidate.effect === 'ghola' && options.cards.includes(candidate.id),
  );
  if (!card) return null;
  const level = rank(g);
  const living = me.leaders.filter(
    (leader) => !leader.dead && controlsLeader(me, leader),
  );
  const leader = [...options.leaders].sort(
    (a, b) => b.strength - a.strength || a.id.localeCompare(b.id),
  )[0];
  const bestLiving = Math.max(
    0,
    ...living.map((candidate) => candidate.strength),
  );
  if (
    leader &&
    (living.length <= [1, 2, 2, 2][level] ||
      (level > 0 && leader.strength > bestLiving))
  )
    return { type: 'card', card: card.id, leader: leader.id };
  if (options.kwisatz && living.length)
    return { type: 'card', card: card.id, leader: 'kwisatz' };
  const amount = options.maxForces;
  if (
    amount > 0 &&
    (amount >= [3, 4, 4, 5][level] || me.reserves === 0) &&
    me.reserves <= [5, 7, 9, 10][level]
  ) {
    const minimumElite = Math.max(
      0,
      amount - (me.tanks - (me.elites?.tanks ?? 0)),
    );
    const elite =
      level === 0 ? minimumElite : Math.min(amount, options.eliteRemaining);
    if (elite >= minimumElite)
      return { type: 'card', card: card.id, amount, elite };
  }
  return null;
}

/** Obligations apply across policy branches, including choosing to move first. */
export function botActions(g: GameView): Action[] {
  if (g.nexusTraitors?.pending)
    return g.truthtrance
      ? policyActions({ ...g, decision: null })
      : nexusTraitorBotActions(g);
  if (g.automaticContinuationPending) return [];
  if (g.nexusCards?.waiting.length) return nexusCardBotActions(g);
  const traitorExchange = nexusTraitorBotActions(g);
  if (traitorExchange.length) return traitorExchange;
  const nexus = g.nexusAtreides;
  if (
    g.status === 'playing' && g.phase === 6 && nexus && !nexus.blocked &&
    g.nexusCards?.card === 'atreides' && nexus.event === g.battle?.event &&
    !g.truthtrance && !g.phaseOpening && !g.decision &&
    (nexus.mode === 'betrayal' || !g.response)
  ) {
    if (nexus.mode === 'betrayal')
      return [{ type: 'nexusAtreides', event: nexus.event, mode: nexus.mode }];
    const preferences = nexus.mode === 'cunning' || rank(g) >= 2
      ? ['weapon', 'defense', 'leader', 'dial'] as const
      : ['dial', 'weapon', 'defense', 'leader'] as const;
    const field = preferences.find((field) => nexus.fields.includes(field));
    if (field)
      return [{ type: 'nexusAtreides', event: nexus.event, mode: nexus.mode, field }];
  }
  const intelligence = tupileIntelligenceActions(g);
  if (intelligence.length) return intelligence;
  const actions = [...junctionTransportActions(g, rank(g)), ...policyActions(g)].flatMap((action) => {
    const sourced = withNativeShipmentSources(g, action);
    return sourced && botHomeworldShipmentPaymentAllowed(g, sourced) && !homeworldRevivalActionBlock(g, sourced) ? [sourced] : [];
  });
  const me = g.players.find((p) => p.id === g.me)!;
  const ghola = standaloneGholaAction(g, actions);
  if (ghola && !homeworldRevivalActionBlock(g, ghola)) return [ghola];
  if (
    g.phase !== 5 ||
    g.active !== me.id ||
    me.shipped ||
    g.truthtrance ||
    g.response ||
    g.decision ||
    g.phaseOpening
  )
    return actions;
  const promises = liveShipmentPromises(
    g.shipmentPromises ?? [],
    me.id,
    g.turn,
  );
  if (!promises.length) return actions;
  const filtered = actions.filter((action) => {
    if (
      ![
        'ship',
        'guildShip',
        'homeworldShip',
        'guildHomeworldShip',
        'junctionShip',
        'move',
        'emperorHomeworldMove',
        'endMovement',
      ].includes(action.type)
    )
      return true;
    const junctionNative = action.type === 'junctionShip' &&
      typeof action.destination === 'string' && !action.destination.startsWith('homeworld:') &&
      !!action.sources && Object.keys(action.sources as object).every((source) =>
        g.homeworlds?.worlds?.some((world) => world.id === source && world.native === me.id));
    const fromReserves =
      action.type === 'ship' ||
      (action.type === 'guildShip' && action.from === 'reserves');
    const shipment = junctionNative
      ? {territory: splitLocation(String(action.destination)).territory,
          amount: Object.values(action.sources as Record<string, {normal: number; elite: number}>).reduce((n, source) => n + source.normal + source.elite, 0)}
      : fromReserves
      ? { territory: String(action.territory), amount: Number(action.amount) }
      : null;
    return promises.every(
      (promise) => matchesShipment(promise, shipment) === promise.answer,
    );
  });
  const witness = g.shipmentCompletion?.actions[0];
  if (promises.some((promise) => promise.answer) && witness) {
    // A completion is a sequence, not interchangeable alternatives. Reproject
    // after its first preparation before offering the later funded shipment.
    return [
      witness,
      ...filtered.filter(
        (action) => JSON.stringify(action) !== JSON.stringify(witness),
      ),
    ];
  }
  return filtered.length || promises.some((promise) => promise.answer)
    ? filtered
    : [{ type: 'endMovement' }];
}

export function runBots(state: Game, limit = 96): Game {
  const supplier = state.players.find((p) => p.faction === 'richese');
  const unopenedAllyWindow =
    state.phase === 5 &&
    supplier?.noField &&
    supplier.ally === state.active &&
    !(
      state.richeseAllyOpportunity?.turn === state.turn &&
      state.richeseAllyOpportunity.recipient === supplier.ally
    );
  let g =
    state.pendingTreacheryDiscard || state.response || unopenedAllyWindow
      ? normalizeAutomaticGame(state)
      : structuredClone(state);
  for (let step = 0; step < limit; step++) {
    let next: Game | undefined;
    const actors = g.players.filter((p) => p.bot ?? p.autopilot);
    // Give an automated optional supplier a chance before a seated-earlier
    // recipient spends the shipment. Humans retain their ordinary actions.
    if (g.phase === 5 && junctionSponsor(g) && !currentJunctionOffer(g))
      actors.sort((a, b) => Number(b.faction === 'guild') - Number(a.faction === 'guild'));
    for (const p of actors) {
      for (const action of botActions(viewGame(g, p.id))) {
        try {
          next = applyAction(g, p.id, action);
          break;
        } catch (error) {
          if (!(error instanceof RuleError)) throw error;
        }
      }
      if (next) break;
    }
    if (!next) {
      g.botsPending = false;
      return g;
    }
    g = next;
    if (g.status === 'finished') {
      g.botsPending = false;
      return g;
    }
  }
  g.botsPending = true;
  return g;
}
