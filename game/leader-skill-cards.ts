/** Canonical summaries of the fourteen physical CHOAM & Richese Leader Skill
 * cards. This reference catalog does not enable the optional module or execute
 * its effects. Source and lifecycle contract: docs/LEADER_SKILLS_RULES.md. */
export const LEADER_SKILL_CARDS = [
  {
    id: 'bureaucrat',
    name: 'Bureaucrat',
    normal: [
      'Once per phase, when another player pays at least 5 spice to a player other than you, you may redirect 2 of that payment to the Spice Bank.',
    ],
    battle: [
      'Your opponent subtracts 1 from their battle total for each stronghold they occupy; Bene Gesserit advisors do not count as occupation for this penalty.',
    ],
  },
  {
    id: 'spice-banker',
    name: 'Spice Banker',
    normal: [
      'Once per phase, when another player pays at least 4 spice to the Spice Bank, place 1 spice in front of your shield and collect it during the Mentat Pause.',
    ],
    battle: [
      'Commit 1–3 spice with your Battle Plan and add the same amount to this leader’s strength.',
      'This payment is separate from spice paid to make forces fight at full strength.',
    ],
  },
  {
    id: 'diplomat',
    name: 'Diplomat',
    normal: [
      'When you play no defense, one Worthless card in your Battle Plan may count as the defense your opponent used in that battle; discard the Worthless card afterward.',
    ],
    battle: [
      'If you lose, retreat undialed forces up to this leader’s strength to one empty adjacent territory that is not a stronghold.',
    ],
  },
  {
    id: 'mentat',
    name: 'Mentat',
    normal: [
      'Before Battle Plans, name a specific weapon and ask whether your opponent holds it. They reveal that card if held, or a different Treachery Card otherwise.',
      'Revealing the named weapon does not require your opponent to use it.',
    ],
    battle: ['Add 2 to this leader’s strength.'],
  },
  {
    id: 'suk-graduate',
    name: 'Suk Graduate',
    normal: [
      'After you win a battle and lose forces, return 1 such force to reserves instead of the Tleilaxu Tanks.',
    ],
    battle: [
      'After you win and lose forces, save up to 3 of them from going to the Tleilaxu Tanks: leave 1 in the battle territory and return the rest to reserves.',
    ],
  },
  {
    id: 'rihani-decipherer',
    name: 'Rihani Decipherer',
    normal: [
      'After you win a battle, secretly inspect 2 random cards from the Traitor Deck, then reshuffle them into that deck.',
    ],
    battle: [
      'After you win, draw 2 Traitor Cards and keep 1 by revealing an unused Traitor Card you already hold.',
      'Shuffle the revealed card and the unkept drawn card into the Traitor Deck.',
    ],
  },
  {
    id: 'sandmaster',
    name: 'Sandmaster',
    normal: [
      'When moving forces into or through a territory containing spice, you may immediately collect 1 spice there, once per territory traversed.',
    ],
    battle: [
      'After winning a battle in a territory that contains spice, add 3 spice to that territory.',
    ],
  },
  {
    id: 'smuggler',
    name: 'Smuggler',
    normal: [
      'When shipping forces from off-planet to an empty territory, one additional force may accompany that shipment for free.',
    ],
    battle: [
      'When Battle Plans are revealed, collect spice from the battle territory equal to this leader’s strength, limited by the spice present and subject to the skilled leader surviving the battle.',
    ],
  },
  {
    id: 'planetologist',
    name: 'Planetologist',
    normal: [
      'For a movement, either add 1 to movement range, capped at 3, or move forces from two different territories when both groups share one destination.',
    ],
    battle: [
      'In place of a weapon, reveal a green Special card other than a Cheap Hero and add 2 to this leader’s strength.',
      'Discard that Special card after the battle.',
    ],
  },
  {
    id: 'warmaster',
    name: 'Warmaster',
    normal: [
      'Add 1 to your other leader discs when their Battle Plan contains at least one Worthless card.',
    ],
    battle: [
      'Add 3 to this leader’s strength when its Battle Plan contains at least one Worthless card.',
    ],
  },
  {
    id: 'master-of-assassins',
    name: 'Master of Assassins',
    normal: ['Add 1 to your other leader discs when they use a Poison Weapon.'],
    battle: ['Add 3 to this leader’s strength when it uses a Poison Weapon.'],
  },
  {
    id: 'swordmaster-of-ginaz',
    name: 'Swordmaster of Ginaz',
    normal: [
      'Add 1 to your other leader discs when they use a Projectile Weapon.',
    ],
    battle: [
      'Add 3 to this leader’s strength when it uses a Projectile Weapon.',
    ],
  },
  {
    id: 'killer-medic',
    name: 'Killer Medic',
    normal: [
      'Add 1 to your other leader discs when they use a Poison Defense.',
    ],
    battle: ['Add 3 to this leader’s strength when it uses a Poison Defense.'],
  },
  {
    id: 'prana-bindu-adept',
    name: 'Prana Bindu Adept',
    normal: [
      'Add 1 to your other leader discs when they use a Projectile Defense.',
    ],
    battle: [
      'Add 3 to this leader’s strength when it uses a Projectile Defense.',
    ],
  },
] as const;

export type LeaderSkillCard = (typeof LEADER_SKILL_CARDS)[number];
export type LeaderSkillId = LeaderSkillCard['id'];

export function leaderSkillCard(id: LeaderSkillId): LeaderSkillCard {
  const card = LEADER_SKILL_CARDS.find((candidate) => candidate.id === id);
  if (!card) throw new Error('Unknown Leader Skill Card.');
  return card;
}
