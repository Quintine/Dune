import { faction } from '@/game/catalog';
import { territory } from '@/game/board';
import type { StrongholdProgress } from '@/game/victory-progress';

export function VictoryProgress({
  progress,
  players,
}: {
  progress: readonly StrongholdProgress[];
  players: readonly { id: string; faction: string }[];
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
    </details>
  );
}
