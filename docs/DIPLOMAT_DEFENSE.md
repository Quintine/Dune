# Diplomat copied-defense prototype

13 September 2026. **Prototyped**, with **Partial** rules coverage. This connects
the Diplomat's normal band for canonical base Shield and Snooper defenses only.
The lower retreat band, combined modules and other defense cards remain
unfinished. Public Leader Skills starts and publication remain gated.

## Source and interpretation

The archived physical card says that, when its owner plays no defense, one
Worthless card in that Battle Plan may count as the defense the opponent used,
and directs that Worthless card to be discarded afterward. Jack Reda repeats
the effect in the [designer walkthrough at 14:11](https://www.youtube.com/watch?v=XT_azRVLq_0&t=851s).
The [GF9 CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf),
page 9, keeps a normal skill active while its native trainer and card are face
up. It also expressly keeps the first band available when that trained disc is
selected for battle, if applicable. Page 12 limits a captured skill to its
lower band. The archived component photograph and transcript are retained in
the local source archive described by [the common source contract](LEADER_SKILLS_RULES.md).

The connected base interpretation therefore accepts one actual Worthless card
from either plan slot, or offers a choice when both slots contain Worthless
cards. An actual defense makes the skill unavailable. The opponent must have
played a canonical base Shield or Snooper; an empty defense supplies nothing to
copy. The copied role protects exactly like that base defense without changing
the Worthless card's identity or either revealed plan. This lets the selected
native Diplomat protect itself: copied protection is resolved first, then the
common surviving-trainer rule is evaluated. If the copied type does not stop
the weapon, removing the dead trainer's skill does not change that outcome.

Two timing and cleanup rules are explicit implementation inferences. The
optional public choice occurs after both plans reveal and before traitor calls,
because the copied defense cannot be known when the Worthless card is sealed.
The chosen Worthless is always discarded after resolution, including when a
successful traitor call preempts ordinary weapon effects. This combines the
card's explicit discard instruction with the chosen scheduling point; the
publisher sources do not separately address Diplomat versus traitor timing.
The [November 2020 GF9 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf),
page 8, supplies the general winner-retention rule, which the chosen card's
specific discard instruction overrides in this prototype.

## Connected behavior

New supported battles carry a version marker and an independent event-bound
receipt. After reveal, the server derives the eligible physical Worthless IDs,
opposing defense and live native assignment from current custody. Choosing one
records its copied kind; declining records that choice. Either result preserves
the original plans and leaves every card in its hand until battle resolution.
Legacy battles without the new marker keep their existing continuation and do
not gain a retroactive Diplomat opportunity.

The copied base role feeds ordinary weapon survival and existing Poison or
Projectile Defense skill checks. The physical Worthless identity remains
available to checks such as Warmaster. Only the chosen Worthless receives the
mandatory skill discard; a second played Worthless follows ordinary winner or
loser cleanup. The receipt is revalidated before views, normalization and
actions against battle identity, turn, territory, plans, public skill posture,
card faces and unique physical custody.

The decision and its already-revealed card IDs are public. Internal frame,
signature and binding fields are not projected. Before joint reveal, ordinary
sealed-plan and hand privacy remain unchanged. Human controls name the copied
defense and each eligible Worthless card, and allow an explicit decline. All
four AI profiles use the public revealed cards and shared legality; no opposing
hand or pre-reveal plan is inspected.

## Evidence and remaining scope

Sixteen focused checks were observed before the broad checkpoint run. They
cover the pure base quote, Basic and Advanced battles, either Worthless slot,
two-card choice, same-disc survival, Shield explosion composition, captured
discipline strength, decline, controls, all four AI profiles, private/public
views, JSON/SQLite restart, concurrent choice, traitor cleanup, corruption and
legacy continuation. Independent rules, privacy and persistence review found no
blocker in this bounded path. A new isolated browser room used genuine skill
assignment before a conserved staged battle. The human sealed Hasimir Fenring,
Crysknife and Baliset, restored the pending copy choice, copied an opposing
Snooper and resolved. Hasimir survived poison; Baliset was discarded exactly
once. Keeping Crysknife and refreshing preserved that private card and traitor,
four board forces, fifteen reserves, one Tank and eight spice. This is a targeted
browser journey, not full-game acceptance.

Two genuine four-profile Basic/Advanced samples completed in 210/223 actions with
six/seven JSON restores and no rejected candidates. Neither encountered an
eligible copy; targeted tests and the browser establish the effect. Required
broad check results and final saved-game preservation are recorded in the
checkpoint commit and private source-bound report.

The lower Diplomat retreat remains pending with its recorded strength and
resolution-order questions. Shield Snooper, Chemistry, defensive Weirding Way,
Portable Snooper, Carthag-added protection and any future copied or modified
defense need a separate contract for whether generic roles or named exceptions
are inherited. Homeworlds, Nexus, Discoveries, Stronghold Cards, Tech Tokens and
other combined modules remain guarded. These limits preserve the existing
public gates.
