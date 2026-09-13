'use client';

import { useState } from 'react';
import type { Action } from '@/game/engine';
import { leaderSkillCard, type LeaderSkillId } from '@/game/leader-skill-cards';
import type { LeaderSkillsView } from '@/game/leader-skills';
import { Button } from '@/components/ui/button';

type NamedIdentity = Readonly<{ id: string; name: string }>;

export type LeaderSkillsPanelProps = {
  skills: LeaderSkillsView | null;
  leaders: readonly NamedIdentity[];
  players: readonly NamedIdentity[];
  act: (action: Action) => void;
  busy: boolean;
};

function LeaderSkillCard({
  skill,
  context,
}: {
  skill: LeaderSkillId;
  context?: string;
}) {
  const card = leaderSkillCard(skill);
  return (
    <article
      aria-label={`${card.name} Leader Skill card`}
      className="min-w-0 overflow-hidden rounded-xl border border-[#a88b60] bg-[#20271f] text-[#f2e8d3] shadow-lg"
    >
      <header className="border-b border-[#a88b60]/40 px-4 py-3">
        <p className="m-0 text-xs uppercase tracking-widest">Leader Skill</p>
        <h4 className="m-0 break-words font-serif text-xl">{card.name}</h4>
        {context && (
          <p className="m-0 mt-1 break-words text-sm text-[#edcc8c]">
            {context}
          </p>
        )}
      </header>
      <details className="group px-4 py-3">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">
          Inspect {card.name}
        </summary>
        <div className="space-y-4 pb-2">
          <section
            aria-label={`${card.name} normal effect`}
            className="space-y-2"
          >
            <h5 className="m-0 font-serif text-lg">Normal effect</h5>
            {card.normal.map((line) => (
              <p key={line} className="m-0 leading-7">
                {line}
              </p>
            ))}
          </section>
          <section
            aria-label={`${card.name} battle effect`}
            className="space-y-2"
          >
            <h5 className="m-0 font-serif text-lg">Skilled leader in battle</h5>
            {card.battle.map((line) => (
              <p key={line} className="m-0 leading-7">
                {line}
              </p>
            ))}
          </section>
        </div>
      </details>
    </article>
  );
}

export function LeaderSkillsPanel({
  skills,
  leaders,
  players,
  act,
  busy,
}: LeaderSkillsPanelProps) {
  const [selectedSkill, setSelectedSkill] = useState<LeaderSkillId | null>(
    null,
  );
  const [selectedLeader, setSelectedLeader] = useState<string | null>(null);
  if (!skills) return null;

  const offer = skills.offer;
  const availableSkills =
    offer?.cards.filter((skill) => !skills.unavailableSkills?.[skill]) ?? [];
  const activeSkill =
    availableSkills.find((skill) => skill === selectedSkill) ??
    availableSkills[0] ??
    null;
  const activeLeader =
    offer?.leader ??
    skills.eligibleLeaders.find((leader) => leader.id === selectedLeader)?.id ??
    skills.eligibleLeaders[0]?.id ??
    null;
  const leaderName = (id: string) =>
    leaders.find((leader) => leader.id === id)?.name ?? id;
  const playerName = (id: string) =>
    players.find((player) => player.id === id)?.name ?? id;

  return (
    <section
      aria-label="Leader Skills"
      className="space-y-4 rounded-lg border border-[#a88b60]/50 p-3"
    >
      <div className="space-y-2">
        <h3>Leader Skills</h3>
        <p className="fine">
          This development-only module currently connects the card-role strength
          modifiers for Warmaster, Master of Assassins, Swordmaster of Ginaz,
          Killer Medic and Prana-Bindu Adept, plus Planetologist movement and
          Special-card battle use, Suk Graduate force rescue, Mentat’s private
          weapon-question preview and battle bonus, Bureaucrat battle scores, Sandmaster ground-route collection and
          victory spice, Rihani inspections and exchanges, optional Smuggler
          reserve shipping, Spice Banker battle spending, and Diplomat copying
          an opposing base defense with a committed Worthless card after plans
          are revealed. Other Leader Skill effects are unfinished.
        </p>
      </div>

      {!!skills.assignments.length && (
        <div aria-label="Public Leader Skill assignments" className="space-y-3">
          <h4>Public assignments</h4>
          <div className="grid gap-3">
            {skills.assignments.map((assignment) => (
              <LeaderSkillCard
                key={`${assignment.owner}:${assignment.leader}`}
                skill={assignment.skill}
                context={`${playerName(assignment.controller)} · ${leaderName(assignment.leader)} · ${assignment.captured ? 'Captured · battle effect only' : assignment.faceUp ? 'Face up' : 'Behind shield'}`}
              />
            ))}
          </div>
        </div>
      )}

      {offer && offer.cards.length === 0 && offer.leader && (
        <section
          aria-label="Revived leader skill choice"
          className="notice space-y-3"
        >
          <div>
            <h4>Skill for {leaderName(offer.leader)}</h4>
            <p>
              Decide whether to draw before seeing either private card. Drawing
              two requires you to keep one.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="game-action min-h-11 whitespace-normal"
              disabled={busy}
              onClick={() =>
                act({ type: 'leaderSkill', event: offer.event, mode: 'draw' })
              }
            >
              Draw two skills
            </Button>
            <Button
              variant="outline"
              className="game-action min-h-11 whitespace-normal"
              disabled={busy}
              onClick={() =>
                act({
                  type: 'leaderSkill',
                  event: offer.event,
                  mode: 'decline',
                })
              }
            >
              Continue without a skill
            </Button>
          </div>
        </section>
      )}

      {offer && offer.cards.length > 0 && (
        <form
          aria-label="Choose a Leader Skill"
          className="notice space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && activeSkill && activeLeader)
              act({
                type: 'leaderSkill',
                event: offer.event,
                skill: activeSkill,
                leader: activeLeader,
              });
          }}
        >
          <div>
            <h4>Choose one private skill</h4>
            <p>
              Keep one physical card and return the other unseen card to the
              skill deck.
            </p>
          </div>
          <fieldset className="space-y-3">
            <legend className="font-semibold">Choose a skill card</legend>
            <div className="grid gap-3">
              {offer.cards.map((skill) => {
                const card = leaderSkillCard(skill);
                const unavailable = skills.unavailableSkills?.[skill];
                return (
                  <div key={skill} className="space-y-2">
                    <label className="flex min-h-11 items-center gap-2">
                      <input
                        type="radio"
                        name="leader-skill-card"
                        value={skill}
                        checked={activeSkill === skill}
                        disabled={busy || !!unavailable}
                        onChange={() => setSelectedSkill(skill)}
                      />
                      Keep {card.name}
                    </label>
                    {unavailable && <p className="fine">{unavailable}</p>}
                    <LeaderSkillCard
                      skill={skill}
                      context={unavailable ? 'Your private offer · Unavailable' : 'Your private offer'}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>

          {offer.leader ? (
            <p>
              Assigned leader: <strong>{leaderName(offer.leader)}</strong>
            </p>
          ) : (
            <label className="block max-w-xl space-y-1">
              <span>Assign to an eligible leader</span>
              <select
                aria-label="Eligible Leader Skill leader"
                className="min-h-11 w-full"
                value={activeLeader ?? ''}
                disabled={busy || !skills.eligibleLeaders.length}
                onChange={(event) => setSelectedLeader(event.target.value)}
              >
                {skills.eligibleLeaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <Button
            type="submit"
            className="game-action min-h-11 whitespace-normal"
            disabled={busy || !activeSkill || !activeLeader}
          >
            Assign selected skill
          </Button>
          <p className="fine">
            Once these cards are shown, choosing one is mandatory; there is no
            decline action.
          </p>
        </form>
      )}

      {skills.battleChoice && (
        <section
          aria-label="Leader Skill battle visibility"
          className="notice space-y-3"
        >
          <div>
            <h4>{leaderName(skills.battleChoice.leader)} in this battle</h4>
            <p>
              Choose publicly whether the skilled leader remains face up or
              moves behind your shield before selecting a Battle Plan leader.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="game-action min-h-11 whitespace-normal"
              disabled={busy}
              onClick={() =>
                act({
                  type: 'leaderSkillVisibility',
                  event: skills.battleChoice!.event,
                  hide: false,
                })
              }
            >
              Keep leader face up
            </Button>
            <Button
              className="game-action min-h-11 whitespace-normal"
              disabled={busy}
              onClick={() =>
                act({
                  type: 'leaderSkillVisibility',
                  event: skills.battleChoice!.event,
                  hide: true,
                })
              }
            >
              Move leader behind shield
            </Button>
          </div>
        </section>
      )}
    </section>
  );
}
