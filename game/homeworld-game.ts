import type { Game } from './engine';
import {
  homeworldForceGroups,
  HomeworldCustodyError,
} from './homeworld-custody';
import { homeworldAllianceBlock } from './homeworld-alliance';
import { homeworldPopulations } from './homeworld-population';
import { tleilaxuHomeworldFreeIncomeBlocked } from './homeworld-benefits';
import { charityQuote } from './charity';

export function homeworldContext(g: Pick<Game, 'advanced' | 'players'>) {
  return {
    advanced: g.advanced,
    players: g.players.map((p) => ({
      id: p.id,
      faction: p.faction,
      reserves: p.reserves,
      eliteReserves: p.elites?.reserves ?? 0,
    })),
  };
}

/** Native/visitor custody is physical state. Reading or normalizing never
 * reconstructs a missing Salusa allocation from present aggregate reserves. */
export function homeworldGameIntegrity(g: Game): void {
  const state = g.homeworlds;
  if (state === undefined || state === null) return;
  if (
    typeof state !== 'object' ||
    Array.isArray(state) ||
    Object.keys(state).length !== 1 ||
    !Object.hasOwn(state, 'custody')
  )
    throw new HomeworldCustodyError(
      'The saved Homeworld module record is invalid.',
    );
  const beforeForces =
    g.status === 'lobby' ||
    (g.status === 'setup' &&
      (g.setupStage === 'prediction' || g.setupStage === 'traitors'));
  if (beforeForces) {
    if (state.custody !== null)
      throw new HomeworldCustodyError(
        'Homeworld custody starts with force placement, after prediction and traitors.',
      );
    return;
  }
  if (!state.custody)
    throw new HomeworldCustodyError(
      'This game is missing its saved Homeworld force locations.',
    );
  if (g.status === 'playing' && g.phase === 4)
    tleilaxuHomeworldFreeIncomeBlocked(g);
  const continuation = g.pendingTreacheryDiscard?.continuation;
  const savedControls: (
    | { response?: Game['response']; pendingKarama?: Game['pendingKarama'] }
    | null
    | undefined
  )[] = [
    g,
    g.pendingExchange,
    g.pendingNullentropy?.resume,
    g.pendingRicheseGift?.resume,
    g.pendingRichesePurchaseIncome?.resume,
    g.summonedWorm?.resume,
    continuation && 'resume' in continuation ? continuation.resume : null,
  ];
  for (const controls of savedControls) {
    const conversion = controls?.pendingKarama;
    const response =
      controls?.response?.kind === 'worthlessKarama' &&
      conversion?.use.kind === 'cancel'
        ? conversion.use.response
        : controls?.response;
    if (response?.kind !== 'bgCharity') continue;
    const owner = g.players.find((p) => p.id === response.owner);
    const quote = owner ? charityQuote(g, owner) : null;
    if (
      !owner ||
      g.phase !== 2 ||
      !g.advanced ||
      owner.faction !== 'beneGesserit' ||
      owner.charityTurn !== g.turn ||
      !quote?.total ||
      response.amount !== quote.total ||
      response.charityHomeworld !== quote.homeworld
    )
      throw new HomeworldCustodyError(
        'The saved Homeworld charity claim does not match its eligible ordinary and bank amounts.',
      );
  }
  const groups = homeworldForceGroups(homeworldContext(g), state.custody);
  for (const p of g.players) {
    if (p.ally && g.players.some((other) => other.id === p.ally && other.ally === p.id)) {
      const blocked = homeworldAllianceBlock(homeworldContext(g), state.custody, p.id, p.ally);
      if (blocked) throw new HomeworldCustodyError(blocked);
    }
    let away = 0,
      awayElite = 0;
    for (const home of groups) {
      if (home.native === p.id || !Object.hasOwn(home.forces, p.id)) continue;
      const force = home.forces[p.id];
      away += force.normal + force.elite;
      awayElite += force.elite;
    }
    const counts = [p.reserves, p.tanks, ...Object.values(p.forces)];
    if (
      counts.some((n) => !Number.isSafeInteger(n) || n < 0) ||
      counts.reduce((a, b) => a + b, away) !== 20
    )
      throw new HomeworldCustodyError(
        'Forces on Arrakis, Homeworlds and in the Tanks must conserve twenty physical counters.',
      );
    const expected =
      p.faction === 'ixians'
        ? 7
        : p.faction === 'fremen'
          ? 3
          : p.faction === 'emperor'
            ? 5
            : 0;
    const special = p.elites;
    if (expected) {
      if (
        !special ||
        [
          special.reserves,
          special.tanks,
          ...Object.values(special.forces),
        ].some((n) => !Number.isSafeInteger(n) || n < 0) ||
        special.reserves +
          special.tanks +
          Object.values(special.forces).reduce((a, b) => a + b, awayElite) !==
          expected ||
        special.tanks > p.tanks ||
        Object.entries(special.forces).some(
          ([key, n]) => n > (p.forces[key] ?? 0),
        )
      )
        throw new HomeworldCustodyError(
          'Homeworld games preserve the faction’s complete physical special-counter inventory.',
        );
    } else if (special)
      throw new HomeworldCustodyError(
        'This faction has no physical special-force counters.',
      );
  }
}

export function homeworldTable(g: Game) {
  homeworldGameIntegrity(g);
  if (!g.homeworlds?.custody) return null;
  const context = homeworldContext(g);
  const populations = homeworldPopulations(context, g.homeworlds.custody);
  return homeworldForceGroups(context, g.homeworlds.custody).map((home) => ({
    ...home,
    ...populations.find((p) => p.location === home.id)!,
  }));
}
