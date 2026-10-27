'use client';

import { FACTIONS } from '@/game/catalog';
import type { Action, GameView } from '@/game/engine';
import { Button } from '@/components/ui/button';

/** Lobby allocation uses public seat identities only. The engine owns the
 * randomized order and validates every pick again at commitment. */
export function FactionAllocation({ game, send, busy }: {
  game: GameView;
  send: (action: Action) => Promise<void>;
  busy: boolean;
}) {
  if (game.status !== 'lobby') return null;
  const draft = game.factionDraft;
  const isHost = game.host === game.me;
  const seatName = (id: string) => {
    const player = game.players.find((candidate) => candidate.id === id);
    return player ? `${player.name}${player.bot ? ' (AI)' : ''}` : 'Unknown player';
  };
  if (!draft) return <section className="notice" aria-label="Faction allocation">
    <h2>Choose factions</h2>
    <p>Players can choose their own factions. The host can also randomly deal factions or start a prediction-card draft.</p>
    {isHost && <>
      <p className="fine">Random dealing changes the current choices immediately. Draft choices replace the current factions only after everyone has picked. Either option clears human readiness.</p>
      {game.players.length < 2 && <p className="fine">At least two faction seats are needed to allocate factions.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy || game.players.length < 2} onClick={() => void send({ type: 'factionAllocation', mode: 'random' })}>
          Deal random factions
        </Button>
        <Button type="button" variant="outline" disabled={busy || game.players.length < 2} onClick={() => void send({ type: 'factionAllocation', mode: 'draft' })}>
          Draft factions by prediction card
        </Button>
      </div>
    </>}
  </section>;

  const next = draft.order[draft.picks.length];
  const picked = new Map(draft.picks.map((pick) => [pick.player, pick.faction]));
  const used = new Set(draft.picks.map((pick) => pick.faction));
  const available = FACTIONS.filter((faction) =>
    (faction.expansion === 'base' || game.expansions.includes(faction.expansion)) && !used.has(faction.id));
  const isTurn = next?.player === game.me;
  return <section className="notice" aria-label="Faction draft">
    <h2>Prediction-card faction draft</h2>
    <p>Highest prediction card chooses first. Existing factions remain in place until every seat has picked; other lobby changes wait for the draft to finish.</p>
    <ol>
      {draft.order.map((entry) => {
        const choice = picked.get(entry.player);
        const faction = FACTIONS.find((item) => item.id === choice);
        return <li key={entry.player}>
          {seatName(entry.player)} · prediction {entry.card}: {faction ? faction.name : next?.player === entry.player ? 'choosing now' : 'waiting'}
        </li>;
      })}
    </ol>
    {isTurn ? <>
      <h3>Choose your faction</h3>
      <p className="fine">Choose one of the remaining factions. Each faction can be chosen only once.</p>
      <div className="flex flex-wrap gap-2">
        {available.map((faction) => <Button key={faction.id} type="button" variant="outline" disabled={busy}
          onClick={() => void send({ type: 'factionDraftPick', event: draft.event, faction: faction.id })}>
          {faction.name}
        </Button>)}
      </div>
    </> : next && <p>Waiting for {seatName(next.player)} to choose a faction{game.players.find((player) => player.id === next.player)?.bot ? '; the AI will choose automatically' : ''}.</p>}
    {isHost && <Button type="button" variant="outline" disabled={busy} onClick={() => void send({ type: 'factionDraftCancel', event: draft.event })}>
      Cancel faction draft
    </Button>}
  </section>;
}
