import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeaderSkillsPanel } from '../components/leader-skills';
import { LEADER_SKILL_CARDS } from '../game/leader-skill-cards';
import type { LeaderSkillsView } from '../game/leader-skills';

const leaders = [
  { id: 'duke-leto', name: 'Duke Leto Atreides' },
  { id: 'lady-jessica', name: 'Lady Jessica' },
  { id: 'thufir-hawat', name: 'Thufir Hawat' },
] as const;
const players = [
  { id: 'a', name: 'Atreides' },
  { id: 'e', name: 'Emperor' },
] as const;

function view(overrides: Partial<LeaderSkillsView> = {}): LeaderSkillsView {
  return {
    assignments: [],
    offer: null,
    eligibleLeaders: [],
    battleChoice: null,
    ...overrides,
  };
}

function markup(skills: LeaderSkillsView | null, busy = false): string {
  return renderToStaticMarkup(
    createElement(LeaderSkillsPanel, {
      skills,
      leaders,
      players,
      busy,
      act() {},
    }),
  );
}

function disabledControls(html: string): number {
  return (html.match(/<(?:button|input|select)\b[^>]*\sdisabled=""/g) ?? [])
    .length;
}

void test('renders nothing when the projected module is absent and never invents a private offer', () => {
  assert.equal(markup(null), '');

  const publicOnly = markup(
    view({
      assignments: [
        {
          owner: 'a',
          controller: 'a',
          captured: false,
          leader: 'duke-leto',
          skill: 'warmaster',
          faceUp: true,
        },
      ],
    }),
  );
  assert.match(publicOnly, /Public Leader Skill assignments/);
  assert.match(publicOnly, /Atreides · Duke Leto Atreides · Face up/);
  assert.doesNotMatch(
    publicOnly,
    /Your private offer|Choose one private skill/,
  );
  assert.deepEqual(
    [...publicOnly.matchAll(/aria-label="([^"]+) Leader Skill card"/g)].map((match) => match[1]),
    ['Warmaster'],
    'General guidance may name skills; only the public assignment gets a card face.',
  );
});

void test('every public assignment card exposes its complete canonical normal and battle text', () => {
  for (const card of LEADER_SKILL_CARDS) {
    const html = markup(
      view({
        assignments: [
          {
            owner: 'a',
            controller: 'a',
            captured: false,
            leader: 'duke-leto',
            skill: card.id,
            faceUp: false,
          },
        ],
      }),
    );
    assert.match(
      html,
      new RegExp(`aria-label="${card.name} Leader Skill card"`),
    );
    assert.match(html, new RegExp(`Inspect ${card.name}`));
    assert.match(html, /Atreides · Duke Leto Atreides · Behind shield/);
    assert.ok(html.includes(`aria-label="${card.name} normal effect"`));
    assert.ok(html.includes(`aria-label="${card.name} battle effect"`));
    for (const line of [...card.normal, ...card.battle])
      assert.ok(html.includes(line), `${card.name} omitted: ${line}`);
  }
});

void test('a private setup offer renders only its two physical cards and eligible leader selection', () => {
  const skills = view({
    offer: {
      event: 'setup-event',
      cards: ['bureaucrat', 'diplomat'],
      leader: null,
    },
    eligibleLeaders: [leaders[0], leaders[1]],
  });
  const html = markup(skills);

  assert.match(html, /aria-label="Choose a Leader Skill"/);
  assert.match(html, /Keep Bureaucrat/);
  assert.match(html, /Keep Diplomat/);
  assert.match(html, /Bureaucrat Leader Skill card/);
  assert.match(html, /Diplomat Leader Skill card/);
  assert.doesNotMatch(
    html,
    /Mentat Leader Skill card|Spice Banker Leader Skill card/,
  );
  assert.match(html, /aria-label="Eligible Leader Skill leader"/);
  assert.match(html, /Duke Leto Atreides/);
  assert.match(html, /Lady Jessica/);
  assert.match(html, /Assign selected skill/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
  assert.equal((html.match(/checked=""/g) ?? []).length, 1);

  const disabled = markup(skills, true);
  assert.equal(disabledControls(disabled), 4);
});

void test('an unavailable offered skill remains inspectable while the other card is selected', () => {
  const reason = 'Advanced Atreides awaits the Kwisatz Haderach loss-count ruling.';
  const html = markup(view({
    offer: { event: 'guarded-offer', cards: ['suk-graduate', 'warmaster'], leader: null },
    eligibleLeaders: [leaders[0]],
    unavailableSkills: { 'suk-graduate': reason },
  }));
  const blocked = html.match(/<input\b[^>]*value="suk-graduate"[^>]*>/)?.[0];
  const available = html.match(/<input\b[^>]*value="warmaster"[^>]*>/)?.[0];
  assert.ok(blocked && available);
  assert.match(blocked, /disabled=""/);
  assert.doesNotMatch(blocked, /checked=""/);
  assert.match(available, /checked=""/);
  assert.doesNotMatch(available, /disabled=""/);
  assert.ok(html.includes(reason));
  assert.match(html, /Inspect Suk Graduate/);
  assert.match(html, /Assign selected skill/);
  assert.equal(disabledControls(html), 1, 'the legal assignment remains usable');
});

void test('revival asks before preview and does not offer a decline after cards are drawn', () => {
  const undrawn = markup(
    view({
      offer: { event: 'revival-event', cards: [], leader: 'thufir-hawat' },
      eligibleLeaders: [leaders[2]],
    }),
  );
  assert.match(undrawn, /Skill for Thufir Hawat/);
  assert.match(undrawn, /before seeing either private card/);
  assert.match(undrawn, /Draw two skills/);
  assert.match(undrawn, /Continue without a skill/);
  assert.doesNotMatch(undrawn, /Leader Skill card"|Your private offer/);
  assert.equal(
    disabledControls(
      markup(
        view({
          offer: { event: 'revival-event', cards: [], leader: 'thufir-hawat' },
          eligibleLeaders: [leaders[2]],
        }),
        true,
      ),
    ),
    2,
  );

  const drawn = markup(
    view({
      offer: {
        event: 'revival-event',
        cards: ['bureaucrat', 'diplomat'],
        leader: 'thufir-hawat',
      },
      eligibleLeaders: [leaders[2]],
    }),
  );
  assert.match(drawn, /Assigned leader: <strong>Thufir Hawat<\/strong>/);
  assert.match(drawn, /choosing one is mandatory/);
  assert.match(drawn, /Assign selected skill/);
  assert.doesNotMatch(drawn, /Continue without a skill|Draw two skills/);
  assert.doesNotMatch(drawn, /aria-label="Eligible Leader Skill leader"/);
});

void test('battle visibility choice names the skilled leader and disables both actions while busy', () => {
  const skills = view({
    assignments: [
      {
        owner: 'a',
        controller: 'a',
        captured: false,
        leader: 'duke-leto',
        skill: 'master-of-assassins',
        faceUp: true,
      },
    ],
    battleChoice: {
      event: 'battle-event',
      leader: 'duke-leto',
      skill: 'master-of-assassins',
    },
  });
  const html = markup(skills);
  assert.match(html, /aria-label="Leader Skill battle visibility"/);
  assert.match(html, /Duke Leto Atreides in this battle/);
  assert.match(html, /Keep leader face up/);
  assert.match(html, /Move leader behind shield/);
  assert.equal((html.match(/disabled=""/g) ?? []).length, 0);
  assert.equal(disabledControls(markup(skills, true)), 2);
});

void test('the panel states the exact five connected role modifiers and unfinished boundary', () => {
  const html = markup(view());
  for (const name of [
    'Warmaster',
    'Master of Assassins',
    'Swordmaster of Ginaz',
    'Killer Medic',
    'Prana-Bindu Adept',
  ])
    assert.match(html, new RegExp(name));
  assert.match(html, /development-only module/);
  assert.match(html, /Other Leader Skill effects are unfinished/);
});
