'use client';
import { controlsLeader } from '@/game/leader-control';
import { leaderStrengthLabel } from '@/game/cards';
import {
  battleCardLabel,
  isWeaponCard,
  isStoneBurner,
  isDefenseCard,
  VOICE_KINDS,
} from '@/game/battle-cards';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Action, GameView, PlanField } from '@/game/engine';
import type { CommittedPlanElement } from '@/game/battle-inspections';

/** Read only the recipient's projected commitments, including an explicit null. */
export function battlePlanCommitments(game: GameView): Partial<Record<PlanField, CommittedPlanElement>> {
  const battle = game.battle;
  if (!battle) return {};
  const commitments = battle.ownCommitments ?? (
    battle.insight && battle.prescience && battle.prescience.player !== game.me &&
    [battle.attacker, battle.defender].includes(game.me)
      ? [{ source: 'native' as const, beneficiary: battle.prescience.player, target: game.me,
        field: battle.insight.field, value: battle.insight.value }]
      : []
  );
  return Object.fromEntries(commitments.filter((item) => item.target === game.me).map((item) => [item.field, item]));
}

export function bindBattlePlanCommitments(game: GameView, plan: Action): Action {
  if (plan.type !== 'battlePlan') return plan;
  return { ...plan, ...Object.fromEntries(Object.values(battlePlanCommitments(game)).map((item) => [item.field, item.value])) };
}

export function battlePreparationField(game: GameView): PlanField | null {
  const battle = game.battle;
  if (battle?.preparation?.kind === 'nexusPrescienceAnswer') {
    const inspection = battle.nexusInspection;
    return inspection?.stage === 'answer' && inspection.event === battle.event &&
      inspection.target === battle.preparation.owner && inspection.owner === battle.preparation.beneficiary
      ? inspection.field : null;
  }
  return battle?.preparation?.kind === 'prescienceAnswer' ? battle.prescience?.field ?? null : null;
}

export function battleInspectionAnswerAction(game: GameView, value: string): Action | null {
  const battle = game.battle;
  const field = battlePreparationField(game);
  if (game.status !== 'playing' || game.phase !== 6 || !battle || battle.revealed ||
    battle.preparation?.owner !== game.me || !field) return null;
  const answer = field === 'dial' ? Number(value) : value || null;
  if (field === 'dial' && (value.trim() === '' || !Number.isFinite(answer) || Number(answer) < 0 || !Number.isSafeInteger(Number(answer) * 2))) return null;
  return battle.preparation.kind === 'nexusPrescienceAnswer'
    ? { type: 'nexusPrescienceAnswer', event: battle.nexusInspection!.event, value: answer }
    : { type: 'prescienceAnswer', value: answer };
}

export function NexusInspectionHistory({ game }: { game: GameView }) {
  const battle = game.battle;
  if (!battle?.nexusInspection || ![battle.nexusInspection.owner, battle.nexusInspection.target].includes(game.me) || !battle.nexusInsights?.length) return null;
  return <section aria-label="Private Nexus inspection history" className="space-y-2">
    <h4>Nexus inspection</h4>
    {battle.nexusInsights.map((insight, index) => <p className="notice" key={`${index}-${insight.field}`}>
      {insight.active ? (battle.nexusInspection!.target === game.me ? 'Your committed element' : 'Current answer') : 'Previous answer'}: {insight.field} = {insight.label}
      {!insight.active && <span className="fine"> · No longer binding</span>}
    </p>)}
  </section>;
}

export function BattlePreparation({
  game,
  send,
  busy,
}: {
  game: GameView;
  send: (action: Action) => Promise<void>;
  busy: boolean;
}) {
  const b = game.battle!;
  const preparation = b.preparation!;
  const me = game.players.find((p) => p.id === game.me)!;
  const [kind, setKind] = useState('poison');
  const [must, setMust] = useState(false);
  const [value, setValue] = useState('');
  const act = (action: Action) => void send(action);
  const beneficiary = game.players.find(
    (p) => p.id === preparation.beneficiary,
  )!;
  if (preparation.owner !== game.me)
    return (
      <p className="notice">
        Waiting for {game.players.find((p) => p.id === preparation.owner)?.name}
        {preparation.kind === 'voice'
          ? ' to choose or decline the Voice.'
          : preparation.kind === 'prescience'
            ? ' to choose or decline prescience.'
            : ' to reveal the requested battle-plan element.'}
      </p>
    );
  if (preparation.kind === 'voice')
    return (
      <>
        <h3>The Voice</h3>
        <p className="muted">
          {beneficiary.id === me.id
            ? 'Command your opponent'
            : `Assist ${beneficiary.name}`}{' '}
          before Atreides chooses prescience and the combatants seal their
          plans.
        </p>
        <label htmlFor="voice-kind">
          Card type
          <select
            id="voice-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {VOICE_KINDS.map((k) => (
              <option key={k} value={k}>
                {battleCardLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="decision-checkbox">
          <input
            type="checkbox"
            checked={must}
            onChange={(e) => setMust(e.target.checked)}
          />
          Require this type (unchecked: forbid)
        </label>
        <Button
          className="game-action"
          disabled={busy}
          onClick={() => act({ type: 'voice', kind, must })}
        >
          Use the Voice
        </Button>
        <Button
          className="game-action"
          disabled={busy}
          onClick={() => act({ type: 'declineBattlePower' })}
        >
          Decline the Voice
        </Button>
      </>
    );
  const prescienceTarget =
    beneficiary.id === b.attacker ? b.defender : b.attacker;
  const noFieldTarget = b.noFieldPlayers.includes(prescienceTarget);
  if (preparation.kind === 'prescience')
    return (
      <>
        <h3>Battle prescience</h3>
        <p className="muted">
          Choose one element of{' '}
          {beneficiary.id === me.id ? 'your' : `${beneficiary.name}’s`}{' '}
          opponent’s plan. Only that element becomes fixed.
        </p>
        {noFieldTarget && (
          <p className="fine">
            A No-Field battle keeps the number dialed hidden from Atreides. You
            can inspect the leader, weapon, or defense.
          </p>
        )}
        {[
          'leader',
          'weapon',
          'defense',
          ...(noFieldTarget ? [] : ['dial']),
        ].map((field) => (
          <Button
            className="game-action"
            key={field}
            disabled={busy}
            onClick={() => act({ type: 'prescience', field })}
          >
            Reveal {field}
          </Button>
        ))}
        <Button
          className="game-action"
          disabled={busy}
          onClick={() => act({ type: 'declineBattlePower' })}
        >
          Decline prescience
        </Button>
      </>
    );
  const field = battlePreparationField(game);
  if (!field) return <p className="notice">This inspection is no longer awaiting an answer.</p>;
  const answerAction = battleInspectionAnswerAction(game, value);
  const stoneReason =
    field === 'weapon' && isStoneBurner(me.hand?.find((c) => c.id === value))
      ? b.stoneBurnerContext?.blocked
      : null;
  const choices =
    field === 'leader'
      ? [
          ...me.leaders
            .filter(
              (l) =>
                !l.dead &&
                controlsLeader(me, l) &&
                (!l.usedAt || l.usedAt === b.territory),
            )
            .map((l) => ({
              id: l.id,
              name: `${l.name} · ${leaderStrengthLabel(l)}`,
            })),
          ...(me.hand?.filter((c) => c.kind === 'hero') ?? []),
        ]
      : (me.hand?.filter((c) =>
          field === 'weapon' ? isWeaponCard(c) : isDefenseCard(c),
        ) ?? []);
  return (
    <>
      <h3>Reveal your {field}</h3>
      <p className="muted">
        {beneficiary.name} will see this element. You may still change the rest
        of your plan before sealing it.
      </p>
      {b.voice && (
        <p className="notice">
          Voice: {b.voice.must ? 'must play' : 'cannot play'}{' '}
          {battleCardLabel(b.voice.kind)}.
        </p>
      )}
      <label htmlFor="prescience-answer">
        {field === 'dial' ? 'Forces dialed' : field}
      </label>
        {field === 'dial' ? (
          <Input
            id="prescience-answer"
            type="number"
            min={0}
            max={game.advanced || me.faction === 'ixians' ? 40 : 20}
            step={game.advanced || me.faction === 'ixians' ? 0.5 : 1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        ) : (
          <select
            id="prescience-answer"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">None</option>
            {choices.map((choice) => (
              <option key={choice.id} value={choice.id}>
                {choice.name}
              </option>
            ))}
          </select>
        )}
      {stoneReason && <p className="notice">{stoneReason}</p>}
      <Button
        className="game-action"
        disabled={busy || !!stoneReason || !answerAction}
        onClick={() => { if (!busy && !stoneReason && answerAction) act(answerAction); }}
      >
        Commit this element
      </Button>
    </>
  );
}
