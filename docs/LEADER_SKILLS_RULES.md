# Leader Skills source contract

Updated 13 September 2026. This is a primary-source contract for the optional
Leader Skills module from *CHOAM & Richese*. The later [first runtime prototype](LEADER_SKILLS_RUNTIME.md)
records connected behavior and remaining gaps. This contract does not enable
the module or certify its combinations.

## Sources and local evidence

The governing source is Gale Force Nine's twelve-page English *CHOAM &
Richese* rulebook, especially pages 8–9 and its Q&A on pages 11–12. The
[original GF9 URL](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)
now redirects or returns 403 in ordinary clients. A byte-stable copy of the
publisher-authored file was retrieved from a
[readable rulebook mirror](https://lelekan.com.ua/files/rules/2082/pravila-nastilnoyi-gri-dyuna-kooan-ta-richez-dune-choam-amp-amp-richese-dopovnennya-angl-anglijskoyu-movoyu.0.pdf).
The designers' [expansion page](https://futurepastimes.com/dune-choam-richese)
links the same GF9 rules.

Card names and face text were checked against a photograph of all fourteen
physical cards. The four clearest individual faces also appear on the
[Future Pastimes designer site](https://images.squarespace-cdn.com/content/v1/5627edd5e4b0e42d8c948a6a/1654192152741-787ZBZ91LZP6CG6SZU28/Leader%2Bskill%2BCards%2B3.jpg).
Designer Jack Reda's
[complete card walkthrough](https://www.youtube.com/watch?v=XT_azRVLq_0)
confirms every value and explains how the two effect bands interact.

The persistent archive is `/home/quintine/.local/share/dune/sources`:

- `choam-richese-rulebook-en.pdf` and its layout-preserving `.txt` extraction;
- `leader-skills-tabletopfinder-all.jpg`, the fourteen physical faces;
- `leader-skills-future-pastimes-4cards.jpg` and
  `choam-richese-future-pastimes-components.jpg`, designer-site images;
- `leader-skills-designer-video-page.html` and
  `leader-skills-designer-video-auto-transcript.txt`, the timestamped designer
  walkthrough evidence; and
- `leader-skills-source-provenance.txt`, with retrieval URLs and SHA-256
  hashes.

The transcript is auto-generated, so names and numbers below follow the card
faces when its speech recognition is imperfect. The effects are paraphrased
rather than reproduced as card text.

## Physical inventory and effects

Each card has a face-up effect above its illustration and a second effect for
the assigned leader when that leader is actually used in battle. “Normal”
below means the first effect, which is publicly available while the skilled
leader and card remain face up. “Skilled battle” means the lower effect. When
the skilled leader is used in battle, both the first effect (when applicable)
and the lower effect may apply, subject to the card's “other leader” wording
and the nonstacking exceptions below. The designer
walkthrough establishes that the +1 “other leader” effects and the skilled
leader's +3 effect do not add together; Suk Graduate's two rescue effects are
also alternatives rather than a cumulative four-force rescue
([designer explanation, 4:34–8:23](https://www.youtube.com/watch?v=XT_azRVLq_0&t=274s)).

| # | Card | Normal effect | Skilled battle effect |
|---:|---|---|---|
| 1 | **Bureaucrat** | Once in each phase, when another player pays at least 5 spice to a player other than this skill's owner, the owner may redirect 2 of that payment to the Spice Bank. | The opponent reduces their battle total by 1 for each stronghold that opponent occupies; Bene Gesserit advisors do not count as occupation for this penalty. |
| 2 | **Spice Banker** | Once in each phase, when another player pays at least 4 spice to the Spice Bank, place 1 spice in front of this faction's shield for collection in the Mentat Pause. | Commit 1–3 spice with the Battle Plan and add the same amount to this leader's strength. This payment is separate from spice used to make forces full strength. |
| 3 | **Diplomat** | A single Worthless card in the owner's Battle Plan may stand in for the defense used by the opponent in that battle, provided the owner played no defense; discard the Worthless card afterward. | If this faction loses, retreat up to this leader's strength in **undialed** forces to one empty adjacent territory that is not a stronghold. |
| 4 | **Mentat** | Before Battle Plans, name a specific weapon and ask whether the opponent holds it. They reveal that card if held; otherwise they reveal a different Treachery Card. Revealing the named weapon does not commit it to the plan. | Add 2 to this leader's strength. |
| 5 | **Suk Graduate** | After winning a battle in which the winner loses forces, return 1 such force to reserves instead of the Tleilaxu Tanks. | After winning and losing forces, prevent up to 3 from going to the Tanks: leave 1 in the battle territory and return the remainder to reserves. |
| 6 | **Rihani Decipherer** | After winning a battle, secretly inspect 2 random cards from the Traitor Deck, then reshuffle them into that deck. | After winning, draw 2 Traitor Cards. Keep 1 by revealing an unused Traitor Card already held, then shuffle that revealed card and the unkept drawn card into the deck. |
| 7 | **Sandmaster** | When moving any forces into or through a territory containing spice, the faction may immediately collect 1 spice there, once for each territory traversed. | After winning a battle in a territory that contains spice, add 3 spice to that territory. |
| 8 | **Smuggler** | When shipping forces from off-planet to an empty territory, one additional force may accompany that shipment for free. | When Battle Plans are revealed, collect spice from the battle territory equal to this leader's strength, limited by the spice present. The general survival rule still applies. |
| 9 | **Planetologist** | For a movement, either add 1 to movement range, capped at 3, or move forces from two different territories in the same movement when both groups have the same destination. | In the weapon slot, reveal a green Special card other than a Cheap Hero and add 2 to this leader's strength. Discard the Special card after the battle. The card is used in place of a weapon. |
| 10 | **Warmaster** | Other leaders gain 1 strength when their Battle Plan contains at least one Worthless card. | Add 3 to this leader's strength when its Battle Plan contains at least one Worthless card. |
| 11 | **Master of Assassins** | Other leaders gain 1 strength when using a Poison Weapon. | Add 3 to this leader's strength when using a Poison Weapon. |
| 12 | **Swordmaster of Ginaz** | Other leaders gain 1 strength when using a Projectile Weapon. | Add 3 to this leader's strength when using a Projectile Weapon. |
| 13 | **Killer Medic** | Other leaders gain 1 strength when using a Poison Defense. | Add 3 to this leader's strength when using a Poison Defense. |
| 14 | **Prana Bindu Adept** | Other leaders gain 1 strength when using a Projectile Defense. | Add 3 to this leader's strength when using a Projectile Defense. |

The designer explains Planetologist through Rihani at
[9:53–14:08](https://www.youtube.com/watch?v=XT_azRVLq_0&t=593s) and Diplomat
through Mentat at
[14:11–18:56](https://www.youtube.com/watch?v=XT_azRVLq_0&t=851s). Those
segments confirm the less legible photograph details: Diplomat says
“undialed,” Spice Banker spends 1–3, Rihani draws 2, and both Warmaster bands
require at least one Worthless card.

## Setup, visibility and lifecycle

Leader Skills is an optional variant. It may be included independently of the
two expansion factions and independently of Advanced Stronghold Cards.

The module changes setup order. After positions and Bene Gesserit prediction,
deal starting Treachery Cards, including the Ixian start-of-game draw. Deal two
Leader Skill Cards to every faction; each faction keeps one and shuffles the
other into the skill deck. The kept card is placed face up in front of the
shield, and one eligible leader disc is placed face up beside it. Setup then
continues from Traitor selection. The card and assigned leader are public, so
Traitor choices occur with that assignment known. The CHOAM Auditor is
explicitly ineligible for a skill. [GF9 rulebook, pp. 7–9](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

The skill remains available while the assigned leader is alive and both the
leader and card are face up. When choosing a battle leader, the owner may:

- leave the skilled leader and card face up, preserving the normal effect and
  publicly proving that leader is absent from the Battle Plan; or
- move both behind the shield. If the skilled leader is selected, put both its
  disc and skill card into the battle wheel; both effect bands remain
  available when applicable. If another leader is selected, neither part of
  the concealed skill is available in that battle.

After battle, a surviving skilled leader and its card return face up in front
of the shield. If the leader dies, its skill does not apply in that battle and
the skill card is shuffled back into the skill deck. Later, whenever a faction
revives one of its own leaders while it has no Leader Skill Card, it may draw
two skills, keep one, shuffle the other back, and assign the kept skill to that
newly revived leader. The rules give no voluntary reassignment between living
leaders. [GF9 rulebook, p. 9](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

Skills that mention a card type require the physical card in the Battle Plan
to be played in that role. A multi-role card does not qualify merely because
it could have had the named role: the rulebook's example requires Chemistry to
be committed as a Poison Weapon for Master of Assassins. Skill resolution
precedes faction abilities; the printed example orders Mentat before Atreides
Prescience.

## Capture and official clarifications

The user's requested fresh search resolves the skilled capture's public state
through its unique, publicly assigned card's required movement. See the
[capture interpretation and its precise limits](LEADER_SKILLS_CAPTURE.md).
Captured-card replacement entitlement remains a separate unresolved question.

When Harkonnen captures a skilled leader, the skill card travels with that
leader. The captor may use only the lower battle effect and only when using
that captured leader in battle. Thus a captured Spice Banker cannot collect
the normal payment trigger, but may spend 1–3 spice for its battle bonus; a
captured Mentat receives its +2 battle bonus but not the pre-plan question.
[GF9 Q&A, p. 12](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

The same official Q&A settles these boundaries:

- Mentat may ask its question and then move that same leader behind the shield
  for possible use in the battle.
- Zoal copies the leader disc's value, without skill or Kwisatz Haderach
  additions.
- Tleilaxu taking a foreign Ghola does not draw a new skill; the revival draw
  belongs only to a faction reviving its own leader.
- A Richese Smuggler still supplies its extra free force with a No-Field
  shipment if the destination is empty.
- Spice Banker triggers when another player pays at least 4 spice to the Bank
  during Revival.
- A Traitor obtained by Tleilaxu through Rihani counts as a Face Dancer and may
  replace only an unrevealed Face Dancer.

## Material boundaries not settled by the sources

These questions should remain explicit rather than be answered by a generic
card framework:

1. **Captured-card replacement:** the rules say a captured leader keeps the
   skill, while revival permits a draw when a faction “has no” skill card. They
   do not say whether the original faction still counts as having the captured
   card, or can create a second active assignment after reviving another
   leader.
2. **Spice Banker escrow:** the gained spice waits in front of the shield until
   Mentat Pause. The sources do not say where it goes if the skilled leader
   dies or is captured before collection, nor whether capture transfers that
   waiting spice.
3. **Smuggler timing:** the face says to collect when plans are revealed, while
   the common rule and designer explanation require the skilled leader to
   survive the battle. A digital implementation needs a pending receipt or an
   equivalent post-resolution settlement; the source does not describe
   rollback of already collected spice.
4. **Mentat empty-hand case:** an opponent lacking the named weapon must show a
   different Treachery Card, but no instruction covers a hand with no other
   card to reveal. Later death also cannot undo information already disclosed
   before plans.
5. **Diplomat strength and sequence:** the card does not specify whether its
   retreat cap uses printed disc value or all surviving modifiers, or place
   the retreat precisely among weapon resolution, leader death and ordinary
   loser force removal.
6. **Multiple timing opportunities:** once-per-phase economic triggers and
   skill-before-faction ordering are clear individually. The sources give no
   priority protocol for simultaneous optional skills, payments and faction
   reactions.

Planetologist retains ordinary movement legality. Its +1 branch alone states a
maximum of 3; the two-origin branch instead requires a shared destination. The
designer expressly presents the latter as useful to Fremen, but does not
publish a general stacking order for every expansion movement modifier
([designer example, 19:13](https://www.youtube.com/watch?v=XT_azRVLq_0&t=1153s)).

## 20 September Smuggler follow-up

A bounded renewed check of the GF9 CHOAM & Richese rules/Q&A, the
[core FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf),
Future Pastimes expansion page and Jack Reda walkthrough found no ruling defining
Smuggler's leader strength with Kwisatz, another face-up trainer or Stunner. The
walkthrough at 12:19–12:46 repeats reveal timing and survival with an unmodified
strength-five example. It does not settle those modifiers. A user question now
asks whether to keep those combinations gated, use printed/copied disc value,
or include leader bonuses with a stunned leader counted as zero. No answer is
assumed; this is not a publisher ruling.

The prior pending-receipt contract remains viable: bind the original battle,
controller, leader and spice pile at reveal, then transfer only after survival is
known. The printed card has no victory requirement; the designer's winning
example does not add one. A captive's lower effect belongs to its controller.
Resolving this reveal-time collection logically before Sandmaster's after-win
addition is an explicit timing inference. A drained pile leaves no existing spice
for Sandmaster to augment. Multiple-pile allocation remains unresolved. Pending
spice is not spendable personal custody; this provisional timing must remain
explicit when the collection function is connected. Runtime collection is still
missing; the independent introduction proceeded while the modifier answer waits.

## Implementation readiness contract

A bounded prototype can now use the exact fourteen-card inventory, modified
setup order, public assignment, battle conceal/reveal custody, death return,
own-leader revival draw, named card-role checks, eight direct strength modifiers,
the settled Q&A interactions and saved pending choices. Every human action
needs the same legal AI route, and private Mentat/Rihani information must remain
seat-scoped across save and recovery.

Keep the six unresolved boundaries above gated or represented as explicit
pending decisions. In particular, do not pay Smuggler spice irreversibly at
plan reveal, transfer Spice Banker escrow on capture, or issue a replacement
skill while the original card is captured without a recorded ruling. This
source contract supports the bounded [runtime prototype](LEADER_SKILLS_RUNTIME.md);
it is not evidence that the optional module can be enabled publicly.
