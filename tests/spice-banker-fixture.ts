import { leaderSkillBattle } from './leader-skill-battle-fixture';

/** Genuine skill setup and the shared conserved battle position, before sealing either plan. */
export function spiceBankerGame(advanced = false, captured = false) {
  return leaderSkillBattle({
    skill: 'spice-banker',
    advanced,
    captured,
    unsealed: true,
    dial: 0,
  });
}
