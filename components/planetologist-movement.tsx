'use client';

import { useId, useState } from 'react';
import type { Action, GameView } from '@/game/engine';
import {
  planetologistLeader,
  type PlanetologistMoveMode,
} from '@/game/planetologist-movement';
import {
  gameTerritories,
  location,
  splitLocation,
  territory,
} from '@/game/board';
import { planetologistFlightSelection, type PlanetologistFlight } from '@/game/planetologist-flight';
import {
  PlanetologistMovementAction,
  planetologistMoveDraft,
  planetologistMovementBlocked,
  planetologistNoFieldMarker,
} from './planetologist-movement-action';
import { Input } from './ui/input';

export { planetologistMoveDraft } from './planetologist-movement-action';

type Counts = Record<string, number>;

type Props = {
  game: GameView;
  act: (action: Action) => void;
  busy: boolean;
  destination: string;
  sector: number;
  unavailableReason?: string | null;
};

export function PlanetologistMovement(props: Props) {
  const marker = planetologistNoFieldMarker(props.game);
  const me = props.game.players.find(player => player.id === props.game.me);
  return <PlanetologistMovementDraft
    key={JSON.stringify([props.game.me, props.game.turn, me?.moved, marker?.tokenId, marker?.event, marker?.location,
      props.game.ornithopter?.card?.id, props.game.ornithopter?.active?.event,
      props.game.ornithopter?.active?.completed, props.game.discoveryOrnithopter?.token])}
    {...props}
  />;
}

function PlanetologistMovementDraft({
  game,
  act,
  busy,
  destination,
  sector,
  unavailableReason,
}: Props) {
  const id = useId();
  const [mode, setMode] = useState<PlanetologistMoveMode>('range');
  const [forces, setForces] = useState<Counts>({});
  const [elites, setElites] = useState<Counts>({});
  const [includeNoField, setIncludeNoField] = useState(false);
  const [flight, setFlight] = useState<PlanetologistFlight>(game.ornithopter?.active?.mode ?? 'ordinary');
  const me = game.players.find((player) => player.id === game.me);
  const leader = me && planetologistLeader(game, me.id);
  if (!me || !leader) return null;
  const transport = planetologistFlightSelection(game, flight);
  const sources = Object.entries(me.forces).map(([from, count]) => {
    if (!transport.cohort) return [from, count] as const;
    const currentElite = me.elites?.forces[from] ?? 0;
    const cohortElite = transport.cohort.elites[from] ?? 0;
    const normal = Math.min(count - currentElite, (transport.cohort.forces[from] ?? 0) - cohortElite);
    return [from, normal + Math.min(currentElite, cohortElite)] as const;
  }).filter(([, count]) => count > 0);
  const marker = planetologistNoFieldMarker(game);
  const markerAvailable = !transport.cohort || !!(marker && transport.cohort.noField &&
    marker.tokenId === transport.cohort.noField.tokenId && marker.event === transport.cohort.noField.event &&
    location(marker.location.territory, marker.location.sector) === transport.cohort.noField.from);
  const draft = planetologistMoveDraft(
    game,
    mode,
    destination,
    sector,
    forces,
    elites,
    includeNoField,
    flight,
  );
  const blocked = planetologistMovementBlocked(game, draft, unavailableReason, flight);
  const leaderName =
    game.allLeaders.find((candidate) => candidate.id === leader)?.name ??
    leader;
  return (
    <section
      className="my-4 flex min-w-0 flex-col gap-3"
      aria-labelledby={`${id}-heading`}
    >
      <h3 id={`${id}-heading`}>Planetologist movement</h3>
      <p>
        {leaderName} may add one territory to one movement, up to three, or
        gather forces from exactly two territories into the selected
        destination.
      </p>
      {game.advanced&&me.faction==='beneGesserit'&&mode==='gather'&&(
        <p className="notice">When joining your residents, each incoming origin that changes type has its own matching response. Both groups wait for every required allowance. Prevention leaves the movement unused and keeps both groups in place.</p>
      )}
      <label htmlFor={`${id}-mode`}>Movement mode</label>
      <select
        id={`${id}-mode`}
        value={mode}
        disabled={busy}
        onChange={(event) => setMode(event.target.value as PlanetologistMoveMode)}
      >
        <option value="range">One territory farther, maximum three</option>
        <option value="gather">Gather from two territories</option>
      </select>
      {(game.ornithopter || game.discoveryOrnithopter) && (
        <>
          <label htmlFor={`${id}-flight`}>Movement transport</label>
          <select
            id={`${id}-flight`}
            value={flight}
            disabled={busy || !!game.ornithopter?.active}
            onChange={event => setFlight(event.target.value as PlanetologistFlight)}
          >
            {(['ordinary', 'range3', 'twoGroups', 'discovery'] as const).map(choice => {
              const option = planetologistFlightSelection(game, choice);
              const label = choice === 'ordinary' ? 'Ordinary movement' : choice === 'range3'
                ? 'Ornithopter card: fixed range three' : choice === 'twoGroups'
                  ? 'Ornithopter card: two different movements' : 'Carried Discovery Ornithopter';
              return <option key={choice} value={choice} disabled={!!option.blocked}>
                {label}{option.blocked ? ' — unavailable' : ''}
              </option>;
            })}
          </select>
          <p className="fine" aria-label="Provisional Planetologist flight composition">
            Provisional flight composition: fixed-range Ornithopter and Discovery
            flight stay at three territories for either skill choice, including
            each origin of a gather. Two-group card flight uses extra range up to
            three, or gathers two origins using each origin’s normal range. A
            gather counts as one card movement; the next movement must use
            different original forces. Only one flight source is used per movement.
          </p>
          {game.ornithopter?.active && !transport.blocked && (
            <p className="notice">
              {game.ornithopter.active.completed} card movements completed ·{' '}
              {game.ornithopter.active.remaining} remaining. Select original unmoved
              forces below for the next movement.
            </p>
          )}
        </>
      )}
      <p className="fine">
        Destination: {territory(destination).name}, sector {sector}. Select the
        physical forces to move below.
      </p>
      {marker && (
        <>
          <label className="flex min-h-11 items-center gap-3" htmlFor={`${id}-no-field`}>
            <input
              id={`${id}-no-field`}
              type="checkbox"
              checked={includeNoField}
              disabled={busy || !markerAvailable || !!game.homeworldMobility?.noFieldMovementBlocked}
              onChange={(event) => setIncludeNoField(event.target.checked)}
            />
            Include your concealed No-Field from {territory(marker.location.territory).name}, sector {marker.location.sector}
          </label>
          <p className="fine" aria-label="Provisional Planetologist No-Field range">
            Provisional range composition: the concealed marker moves as one
            force with Planetologist’s extra range, up to three territories.
            Move it alone or with physical forces from its own territory; its
            value stays concealed. No direct joint FAQ settles this combination.
          </p>
          <p className="fine" aria-label="Provisional Planetologist No-Field gather">
            Provisional gather composition: the concealed marker supplies one of
            exactly two origin territories, alone or with physical forces there.
            Select physical forces from one other territory.{' '}
            {transport.rangeOverride
              ? 'Every origin uses the selected flight’s fixed range of three.'
              : 'Every origin uses its normal range; gather adds no extra range.'}{' '}
            Its value stays concealed.
          </p>
          {!markerAvailable && <p className="fine">This marker is outside the original unmoved card cohort.</p>}
          {game.homeworldMobility?.noFieldMovementBlocked && (
            <p className="notice">{game.homeworldMobility.noFieldMovementBlocked}</p>
          )}
        </>
      )}
      {draft.action?.fighters === true && (
        <p className="notice">
          Provisional mixed-gather policy: both groups arrive as fighters. The
          advisor flip is declared before either group moves. If canceled, both
          groups stay in place and no movement is spent; flipping remains blocked
          for that movement opportunity.
        </p>
      )}
      {me.faction === 'ixians' && (
        <p className="fine">
          Each origin uses its own selected cyborgs for movement range. Cyborgs
          from one territory cannot carry suboids from the other territory farther.
        </p>
      )}
      {sources.length ? (
        sources.map(([from, owned]) => {
          const source = splitLocation(from);
          const sourceName =
            gameTerritories(game).find(
              (candidate) => candidate.id === source.territory,
            )?.name ?? source.territory;
          const selected = forces[from] ?? 0;
          const ownedElite = transport.cohort
            ? Math.min(me.elites?.forces[from] ?? 0, transport.cohort.elites[from] ?? 0)
            : me.elites?.forces[from] ?? 0;
          const minimumElite = Math.max(0, selected - (owned - ownedElite));
          return (
            <div className="grid gap-2" key={from}>
              <label htmlFor={`${id}-${from}-forces`}>
                {sourceName}, sector {source.sector} · {owned} forces
                <Input
                  id={`${id}-${from}-forces`}
                  type="number"
                  min={0}
                  max={owned}
                  value={selected}
                  disabled={busy || source.sector === game.storm}
                  onChange={(event) =>
                    setForces({ ...forces, [from]: Number(event.target.value) })
                  }
                />
              </label>
              {me.elites && (
                <label htmlFor={`${id}-${from}-elites`}>
                  Elite from this group · {ownedElite} available
                  <Input
                    id={`${id}-${from}-elites`}
                    type="number"
                    min={minimumElite}
                    max={Math.min(selected, ownedElite)}
                    value={elites[from] ?? 0}
                    disabled={busy || selected === 0}
                    onChange={(event) =>
                      setElites({
                        ...elites,
                        [from]: Number(event.target.value),
                      })
                    }
                  />
                </label>
              )}
            </div>
          );
        })
      ) : (
        <p className="fine">No physical board forces are available to move.</p>
      )}
      {blocked && (
        <output className="notice" id={`${id}-reason`}>
          {blocked}
        </output>
      )}
      <PlanetologistMovementAction
        game={game} mode={mode} destination={destination} sector={sector}
        forces={forces} elites={elites} includeNoField={includeNoField} flight={flight}
        busy={busy} unavailableReason={unavailableReason} reasonId={`${id}-reason`} act={act}
      />
      <p className="fine">
        Only one flight source may be used for each movement.
        Normal movement and arrival rules still apply.
      </p>
    </section>
  );
}
