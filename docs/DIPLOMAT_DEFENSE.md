# Diplomat copied-defense prototype

13 September 2026. **Prototyped**, with **Partial** rules coverage. This connects
the Diplomat's normal band for the canonical printed defenses that the opponent
actually used: Shield, Snooper, Shield Snooper, defensive Weirding Way,
defensive Chemistry and Portable Snooper sealed in the defense slot. The lower
[retreat prototype](LEADER_SKILLS_RULES.md#bounded-diplomat-retreat-interpretation)
is now connected separately; combined modules and other defense sources remain
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

The connected interpretation therefore accepts one actual Worthless card
from either plan slot, or offers a choice when both slots contain Worthless
cards. An actual defense makes the skill unavailable. The opponent must have
played one of the canonical printed defenses; an empty, unsupported or forged
face supplies nothing to copy. Canonical identity is matched by physical ID with
printed kind, name and effect, so a tampered card cannot inherit a role by
claiming a printed name.

The copied role is the role the opponent actually used in the defense slot, and
each printed distinction survives: a Shield Snooper protects against both
projectile and poison weapons and still counts as a Shield for the lasgun
explosion; a defensive Weirding Way stops a projectile weapon but is **not** a
Shield and triggers no explosion; Chemistry stops Poison Tooth, which a Snooper
copy does not; a Portable Snooper sealed in the defense slot copies only its
poison-defense role. The shared battle-card role helpers supply
these distinctions rather than a binary Shield/Snooper substitution.

**First-version interpretation.** Copying the opponent's already-used defensive
role does not copy its activation, its late-play opportunity or its own-slot
prerequisite. Two consequences are explicit implementation inferences. A
defensive Weirding Way keeps its printed requirement that another weapon or
Worthless card occupy the weapon slot of the plan it was played in, so the
opponent's real plan weapon is validated before any copy is offered; our own
plan needs no weapon to receive that copied role. A copied Portable Snooper does
not gain the original card's after-reveal play, which the prototype already
excludes for every late defense. The copied role protects exactly like that
defense without changing the Worthless card's identity or either revealed plan,
and the copied defense is resolved first so that the common surviving-trainer
rule is evaluated afterwards. If the copied type does not stop the weapon,
removing the dead trainer's skill does not change that outcome.

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
receipt. The marker also records which copied sources that battle admits: a
newly stamped battle admits every canonical printed defense above, while an
already-open older battle keeps its original canonical base Shield and Snooper
sources only, so widening the quote cannot invent a retroactive choice for a
pending plan that never had one. After reveal, the server derives the eligible
physical Worthless IDs,
opposing defense and live native assignment from current custody. Choosing one
records its copied kind; declining records that choice. Either result preserves
the original plans and leaves every card in its hand until battle resolution.
Legacy battles without the new marker keep their existing continuation and do
not gain a retroactive Diplomat opportunity.

The copied printed role feeds ordinary weapon survival and existing Poison or
Projectile Defense skill checks through the shared battle-card role helpers.
The physical Worthless identity remains
available to checks such as Warmaster. Only the chosen Worthless receives the
mandatory skill discard; a second played Worthless follows ordinary winner or
loser cleanup. The receipt is revalidated before views, normalization and
actions against battle identity, turn, territory, plans, public skill posture,
card faces and unique physical custody.

The decision and its already-revealed card IDs are public. Internal frame,
signature and binding fields are not projected. Before joint reveal, ordinary
sealed-plan and hand privacy remain unchanged. Human controls name the opposing
card, the actual copied role and each eligible Worthless card, allow an explicit
decline, and state the first-version interpretation above when the copied role
is a hybrid or otherwise not a plain Shield or Snooper. All
four AI profiles use the public revealed cards and shared legality; no opposing
hand or pre-reveal plan is inspected.

## Evidence and remaining scope

8 October native Ix/Richese skill-battle smokes prove hybrid protection
against Poison Blade, Weirding against projectile and non-exploding lasgun,
Chemistry against activated Tooth, additional Ix Snooper and sealed Portable.
Each selected physical Worthless is discarded once. A capability1 battle
finishes without a retroactive hybrid offer or missing-receipt rejection;
new battles receive capability2. In Chromium, the live owned hybrid control
reaches native leader survival and one disposal after actual traitor actions.
This is isolated native engine/control proof, not deployed acceptance.

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

The bounded [lower retreat](LEADER_SKILLS_RULES.md#bounded-diplomat-retreat-interpretation)
now follows a documented conservative strength and outcome order; this does not
settle a publisher priority ruling. Carthag-added protection, mirror and
numeric or Stronghold strength modifiers, late Portable Snooper play, and any
future copied or modified defense still need a separate contract for whether
generic roles or named exceptions are inherited; the copied role never imports
a modifier, an activation or a late-play window. Canonical additional Ix Shield
and Snooper faces use those same printed roles in new battles. Homeworlds, Nexus,
Discoveries, Stronghold Cards, Tech Tokens and other combined modules remain
guarded. These limits preserve the existing public gates.
