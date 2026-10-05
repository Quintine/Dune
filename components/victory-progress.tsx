import { faction } from '@/game/catalog';
import { territory } from '@/game/board';
import type { StrongholdProgress } from '@/game/victory-progress';
import type { FremenVictoryProgress } from '@/game/fremen-victory';
import type { GameView } from '@/game/engine';
import { homeworldCard } from '@/game/homeworld-cards';

export function VictoryProgress({
  progress,
  players,
  fremen,
  ecazHomeworld,
}: {
  progress: readonly StrongholdProgress[];
  players: readonly { id: string; faction: string }[];
  fremen?: FremenVictoryProgress | null;
  ecazHomeworld?: GameView['ecazHomeworldVictory'];
}) {
  if (!progress.length && !fremen && !ecazHomeworld) return null;
  const rows = progress.filter((row) => row.player === row.members[0]);
  const playerFactionName = (id: string) => {
    const player = players.find((candidate) => candidate.id === id);
    return player ? faction(player.faction).name : id;
  };
  return (
    <details className="m-4 rounded-xl border border-[#a88b60] p-4">
      <summary className="cursor-pointer text-lg">
        Victory progress
      </summary>
      <h3 className="mt-3">Stronghold victory progress</h3>
      <p className="muted mt-3">
        Current board, evaluated at the Mentat victory check. Battles and other
        effects may change these holdings. A correct Bene Gesserit prediction
        can replace a stronghold victory.
      </p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {rows.map((row) => (
          <li
            key={row.player}
            className="rounded-lg border border-[#a88b60]/40 p-3"
          >
            <h3>
              {row.members
                .map(
                  (id) =>
                    faction(players.find((p) => p.id === id)!.faction).name,
                )
                .join(' & ')}
            </h3>
            <p>
              {row.strongholds.length + Number(row.techStronghold)} /{' '}
              {row.target} strongholds
              {row.techStronghold
                ? ' · includes one complete Tech Token set'
                : ''}
            </p>
            <p className="fine">
              {row.strongholds.length
                ? row.strongholds.map((id) => territory(id).name).join(', ')
                : 'No uncontested strongholds.'}
            </p>
            {row.occupyTarget !== null && (
              <>
                <p>
                  Ecaz Occupy: {row.jointlyOccupied.length} / {row.occupyTarget}{' '}
                  jointly occupied
                </p>
                <p className="fine">
                  Both allies must have fighters in each of three uncontested
                  strongholds. Tech Tokens do not add a jointly occupied
                  location.
                </p>
              </>
            )}
            {row.qualifies && (
              <p className="notice">Stronghold target reached on this board.</p>
            )}
          </li>
        ))}
      </ul>
      {ecazHomeworld && (
        <section
          className="mt-4 space-y-2 break-words rounded-lg border border-[#a88b60]/40 p-3"
          aria-label="Ecaz Homeworld victory"
        >
          <h3>Ecaz High Homeworld victory</h3>
          <p>{ecazHomeworld.members.map(playerFactionName).join(' & ')}</p>
          <p>
            {playerFactionName(ecazHomeworld.owner)} native population:{' '}
            {ecazHomeworld.population} / {ecazHomeworld.minimum} for High
            {' · '}{ecazHomeworld.high ? 'High' : 'Low'}
          </p>
          <p className="fine">
            Source: printed Ecaz High Homeworld card. High requires at least{' '}
            {ecazHomeworld.minimum} native forces on Ecaz. The alliance must jointly
            occupy at least one actual stronghold and occupy the Homeworlds of two
            other native factions.
          </p>
          <p>
            Joint strongholds: {ecazHomeworld.jointStrongholds.length} / 1 required
          </p>
          <p className="fine">
            {ecazHomeworld.jointStrongholds.length
              ? ecazHomeworld.jointStrongholds.map((id) => territory(id).name).join(', ')
              : 'No jointly occupied stronghold.'}
          </p>
          <p>
            Other native factions:{' '}
            {ecazHomeworld.distinctNativeFactions.length} / 2 required
          </p>
          <p className="fine">
            {ecazHomeworld.distinctNativeFactions.length
              ? ecazHomeworld.distinctNativeFactions.map((id) => faction(id).name).join(', ')
              : 'No other native faction’s Homeworld occupied.'}
          </p>
          {ecazHomeworld.foreignHomeworlds.length > 0 && (
            <ul className="space-y-1 text-sm" aria-label="Occupied foreign Homeworlds">
              {ecazHomeworld.foreignHomeworlds.map((world) => (
                <li key={world.world}>
                  {homeworldCard(world.card)?.name ?? world.world}
                  {' · '}native {faction(world.faction).name}
                  {' · '}held by {playerFactionName(world.holder)}
                </li>
              ))}
            </ul>
          )}
          <p className="fine">
            Two physical Emperor Homeworlds count as one other native faction.
            Homeworlds add no ordinary stronghold points; a Tech Token set is not a
            joint stronghold.
          </p>
          {ecazHomeworld.blocked && (
            <output className="notice block">
              Source blocked: {ecazHomeworld.blocked}
            </output>
          )}
          <p className={ecazHomeworld.qualifies && !ecazHomeworld.blocked ? 'notice' : 'fine'}>
            {ecazHomeworld.blocked
              ? 'This source cannot resolve the Ecaz Homeworld victory check.'
              : ecazHomeworld.qualifies
                ? 'Ecaz Homeworld conditions are met on this board.'
                : 'Ecaz Homeworld conditions are not met on this board.'}
            {' '}Prospective progress only: victory is evaluated at the Mentat
            victory check, not awarded here.
          </p>
        </section>
      )}
      {fremen && (
        <section className="mt-4 space-y-2 rounded-lg border border-[#a88b60]/40 p-3" aria-label="Fremen final-turn victory">
          <h3>Fremen final-turn victory</h3>
          <p className="fine">At the end of turn ten, if nobody has a stronghold victory, these conditions let Fremen and its ally win before Guild. A Bene Gesserit prediction cannot replace this special victory.</p>
          <ul className="space-y-2">
            {fremen.sietches.map((site) => (
              <li key={site.territory}>
                {territory(site.territory).name}: {site.blockers.length
                  ? `blocked by ${site.blockers.map((id) => faction(players.find((p) => p.id === id)!.faction).name).join(', ')}`
                  : site.ecazCooccupation ? 'permitted allied Ecaz and Fremen co-occupation' : 'empty or Fremen only'}.
              </li>
            ))}
            <li>Tuek’s Sietch: {fremen.tueksBlockers.length
              ? `blocked by ${fremen.tueksBlockers.map((id) => faction(players.find((p) => p.id === id)!.faction).name).join(', ')}`
              : 'no prohibited faction present'}.</li>
          </ul>
          <p className={fremen.qualifies ? 'notice' : 'fine'}>{fremen.qualifies
            ? 'Fremen’s special conditions are met on this board. They award victory only at the final-turn check.'
            : 'Fremen’s special conditions are not met on this board.'}</p>
        </section>
      )}
    </details>
  );
}
