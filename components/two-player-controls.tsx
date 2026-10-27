'use client';

import { useState } from 'react';
import { FACTIONS } from '@/game/catalog';
import { DIFFICULTIES, type Difficulty } from '@/game/bot-profiles';
import type { GameView } from '@/game/engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function TwoPlayerControls({
  game, disabled, pendingEntry, entryRoom, entryProblem, retryDisabled,
  onModeChange, onSwitch, onAdd, onRetry, onAddBot, onAddControlledBot,
}: {
  game: GameView;
  disabled: boolean;
  pendingEntry: boolean;
  entryRoom?: string;
  entryProblem: string;
  retryDisabled: boolean;
  onModeChange: (enabled: boolean) => void;
  onSwitch: (seat: string) => void;
  onAdd: (name: string, faction: string) => void;
  onRetry: () => void;
  onAddBot: (faction: string, difficulty: Difficulty) => void;
  onAddControlledBot: (controllerId: string, faction: string, difficulty: Difficulty) => void;
}) {
  const [name, setName] = useState(() => game.players.find((player) => player.id === game.me)?.name ?? '');
  const [choice, setChoice] = useState('');
  const [botChoice, setBotChoice] = useState('');
  const [botDifficulty, setBotDifficulty] = useState<Difficulty>('Medium');
  const mode = game.twoPlayerControllers;
  const controlled = game.controlledFactionSeats ?? [];
  const modeLocked = !!mode?.controllers.some((controller) => controller.seats.length > 1);
  const botController = mode?.controllers.find((controller) =>
    controller.seats.length === 1 && game.players.some((player) =>
      player.id === controller.id && !!player.bot));
  const canAddBotController = !!mode && mode.controllers.length < 2;
  const showBotForm = game.status === 'lobby' && game.host === game.me &&
    !!mode && (canAddBotController || !!botController);
  const available = FACTIONS.filter((item) =>
    (item.expansion === 'base' || game.expansions.includes(item.expansion)) &&
    !game.players.some((player) => player.faction === item.id),
  );
  if (game.status !== 'lobby' && !mode && !pendingEntry && !entryProblem) return null;
  return (
    <section className="notice" aria-label="Two-player faction controls">
      {game.status === 'lobby' && game.host === game.me && (
        <label className="checkbox-row">
          <input type="checkbox" checked={!!mode} disabled={disabled || modeLocked} onChange={(event) => onModeChange(event.target.checked)} />
          Two players, two factions each
        </label>
      )}
      {game.status === 'lobby' && game.host === game.me && modeLocked && <p className="fine">This mode cannot be turned off while a player controls two factions.</p>}
      {mode && <>
        <h2>Two-player factions</h2>
        <p>Each player controls two separate factions. They act independently and are not automatically allied; this interpretation is provisional. Switch between your faction seats to make their decisions and mark each one ready.</p>
        {game.status === 'lobby' && <ul>
          {mode.controllers.map((controller, index) => <li key={controller.id}>
            Player {index + 1}{game.players.some((player) => player.id === controller.id && !!player.bot) ? ' (AI)' : ''}: {controller.seats.map((id) => {
              const player = game.players.find((item) => item.id === id);
              return player ? `${FACTIONS.find((item) => item.id === player.faction)?.name ?? player.faction}${player.ready ? ' (ready)' : ' (not ready)'}` : 'unknown faction';
            }).join(', ')}{controller.seats.length < 2 ? ' — needs a second faction' : ''}
          </li>)}
        </ul>}
        {controlled.length > 1 && <label>
          Active faction
          <select value={game.me} disabled={disabled} onChange={(event) => onSwitch(event.target.value)}>
            {controlled.map((seat) => <option key={seat.id} value={seat.id}>
              {FACTIONS.find((item) => item.id === seat.faction)?.name ?? seat.faction} ({seat.name})
            </option>)}
          </select>
        </label>}
        {game.status === 'lobby' && controlled.length === 1 && <form onSubmit={(event) => {
          event.preventDefault();
          if (choice && name.trim() && available.some((item) => item.id === choice)) onAdd(name.trim(), choice);
        }}>
          <h3>Add your second faction</h3>
          <label htmlFor="second-faction-seat-name">Seat name</label>
          <Input id="second-faction-seat-name" value={name} maxLength={32} disabled={disabled} onChange={(event) => setName(event.target.value)} />
          <label>Faction <select value={choice} disabled={disabled} onChange={(event) => setChoice(event.target.value)}>
            <option value="">Choose a faction</option>
            {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <Button type="submit" disabled={disabled || !name.trim() || !available.some((item) => item.id === choice)}>Add second faction</Button>
        </form>}
        {showBotForm && <form onSubmit={(event) => {
          event.preventDefault();
          if (disabled || !available.some((item) => item.id === botChoice)) return;
          if (botController) onAddControlledBot(botController.id, botChoice, botDifficulty);
          else if (canAddBotController) onAddBot(botChoice, botDifficulty);
        }}>
          <h3>{botController ? 'Add the AI player’s second faction' : 'Add an AI player'}</h3>
          <p className="fine">The AI plays each faction independently. Choose a difficulty for this faction; its settings can be changed in the lobby.</p>
          <label>AI faction <select value={botChoice} disabled={disabled} onChange={(event) => setBotChoice(event.target.value)}>
            <option value="">Choose a faction</option>
            {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label>AI difficulty <select value={botDifficulty} disabled={disabled} onChange={(event) => setBotDifficulty(event.target.value as Difficulty)}>
            {DIFFICULTIES.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
          </select></label>
          <Button type="submit" disabled={disabled || !available.some((item) => item.id === botChoice)}>{botController ? 'Add AI second faction' : 'Add AI player'}</Button>
        </form>}
      </>}
      {pendingEntry && <div>
        <output>A second-faction request for room {entryRoom} is saved in this tab. Retry the same request to confirm its result; it is never retried automatically.</output>
        <Button variant="outline" disabled={retryDisabled} onClick={onRetry}>Retry saved second-faction request</Button>
        {entryRoom !== game.code && <p>Open that room to retry this request.</p>}
      </div>}
      {entryProblem && <p role="alert">{entryProblem}</p>}
    </section>
  );
}
