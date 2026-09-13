import { faction } from '@/game/catalog';
import { territory } from '@/game/board';
import type { StrongholdProgress } from '@/game/victory-progress';
import type { FremenVictoryProgress } from '@/game/fremen-victory';

export function VictoryProgress({
  progress,
  players,
  fremen,
}: {
  progress: readonly StrongholdProgress[];
  players: readonly { id: string; faction: string }[];
  fremen?: FremenVictoryProgress | null;
}) {
  if (!progress.length) return null;
  const rows = progress.filter((row) => row.player === row.members[0]);
  return (
    <details className="m-4 rounded-xl border border-[#a88b60] p-4">
      <summary className="cursor-pointer text-lg">
        Stronghold victory progress
      </summary>
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
