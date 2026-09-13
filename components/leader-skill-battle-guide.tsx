import type { GameView } from '@/game/engine';
import { usesSurvivingSkilledLeader } from '@/game/leader-skill-combat';
import { leaderSkillStrongholdCount } from '@/game/leader-skill-battle-board';

/** Guidance uses only the viewer's selected disc and public board occupation. */
export function LeaderSkillBattleGuide({ game, leader }: { game: GameView; leader: string }) {
  const battle = game.battle;
  if (!battle || ![battle.attacker, battle.defender].includes(game.me)) return null;
  const assignments = game.leaderSkills?.assignments.filter((a) => a.controller === game.me) ?? [];
  const opponent = game.players.find((p) => p.id === (battle.attacker === game.me ? battle.defender : battle.attacker))!;
  const mentat = usesSurvivingSkilledLeader(assignments, 'mentat', leader, true);
  const bureaucrat = usesSurvivingSkilledLeader(assignments, 'bureaucrat', leader, true);
  const sandmaster = usesSurvivingSkilledLeader(assignments, 'sandmaster', leader, true);
  const rihani = usesSurvivingSkilledLeader(assignments, 'rihani-decipherer', leader, true);
  if (!mentat && !bureaucrat && !sandmaster && !rihani) return null;
  return <div className="notice" aria-label="Leader Skill battle effect">
    {mentat && <p>Mentat adds 2 to this leader’s battle strength if the leader survives.</p>}
    {bureaucrat && <p>Bureaucrat subtracts {leaderSkillStrongholdCount(game, opponent)} from your opponent’s battle total if your leader survives. Count each occupied stronghold once, including contested strongholds. Advisors do not count.</p>}
    {sandmaster && <p>If this Sandmaster survives and wins, add 3 spice to the territory’s existing spice pile automatically. No spice is added when the territory has no spice.</p>}
    {rihani && <p>If this Rihani Decipherer survives and wins, you may draw two Traitors and exchange an unused old card for one of them. A native Rihani also privately inspects two deck cards first.</p>}
    {(mentat || bureaucrat) && <p className="fine">These score effects resolve automatically. They do not change the leader’s printed value or spice bounty.</p>}
  </div>;
}
