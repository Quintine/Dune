# Diplomat copied-defense prototype

Updated 17 October 2026. **Prototyped**, with **Partial** rules coverage. The
normal band copies canonical defenses actually used: Shield, Snooper, Shield
Snooper, defensive Weirding Way/Chemistry and sealed or actually late-played
Portable Snooper. Current battles compose original Homeworld/held-card contexts
without inheriting the opponent's modifiers. The lower
[retreat prototype](LEADER_SKILLS_RULES.md#bounded-diplomat-retreat-interpretation)
remains separate. Public starts, full modes and publication remain gated.

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

The copied role is the role the opponent actually used as a defense, and
each printed distinction survives: a Shield Snooper protects against both
projectile and poison weapons and still counts as a Shield for the lasgun
explosion; a defensive Weirding Way stops a projectile weapon but is **not** a
Shield and triggers no explosion; Chemistry stops Poison Tooth, which a Snooper
copy does not; a sealed or actually played late Portable Snooper copies only
its poison-defense role. The shared battle-card role helpers supply these
distinctions rather than a binary Shield/Snooper substitution.

**First-version interpretation.** Copying the opponent's already-used defensive
role does not copy its activation, its late-play opportunity or its own-slot
prerequisite. Two consequences are explicit implementation inferences. A
defensive Weirding Way keeps its printed requirement that another weapon or
Worthless card occupy the weapon slot of the plan it was played in, so the
opponent's real plan weapon is validated before any copy is offered; our own
plan needs no weapon to receive that copied role. A copied Portable Snooper
does not gain the original card's after-reveal activation: the opponent must
actually play its card before a late-source offer exists. The copied role protects exactly like that
defense without changing the Worthless card's identity or either revealed plan,
and the copied defense is resolved first so that the common surviving-trainer
rule is evaluated afterwards. If the copied type does not stop the weapon,
removing the dead trainer's skill does not change that outcome.

Timing and cleanup remain explicit implementation interpretations. Sealed
sources offer the public choice after reveal and before traitor calls as before.
An actually played late source may offer it before the unresolved outcome,
including after false traitor choices. Those submitted choices are not reopened.
A successful traitor declaration prevents a fresh late-source offer. The selected
Worthless always discards after resolution, including when a later successful
traitor preempts ordinary weapon effects; this is not a publisher priority FAQ.
The [November 2020 GF9 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf),
page 8, supplies the general winner-retention rule, which the chosen card's
specific discard instruction overrides in this prototype.

## Connected behavior

New supported battles carry capability3 and an independent event-bound receipt.
They admit canonical used sources, including actually played late Portable,
within their original World/Stronghold skill profile. Capabilities1/2 retain
their old base/printed-only source windows; unversioned battles are not reopened.
The frame binds original plans, trainer and opposing used physical source.
It does not confuse an unrelated later own defense with a historical decline.
Choosing a committed Worthless records its copied kind; declining ends that
opportunity without discarding it. Both preserve plans and cards until outcome.
A copied defense bars a second actual defense through the late slot; a declined
copy may still use an independently legal own Portable Snooper.

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
settle a publisher priority ruling. Current used-defense copying coexists with
original World strength and held-card effects; it never imports the opponent's
virtual/numeric protection, activation or late-play right. Own earned Carthag
may independently add its original Snooper to a copied Shield when its conditions
hold. Carthag does not invent a defense for a physical Worthless with no copied
source. Mirror/numeric inheritance and other exceptional interpretations remain
separate; existing module envelopes and public gates are not widened.

## Used-defense contexts — 17 October 2026

Capability3 binds the role only after a real late defense is played. Prior false
traitor decisions stay submitted; a native Homeworld vote may already be closed
before the invader uses the original late-defense choice. Copy or decline then
resumes that same original battle, never a replayed vote or re-sealed plan.
A true declaration prevents a fresh opportunity; an earlier selected copy keeps
its existing mandatory-discard contract. The same used-role quote supplies
shared weapon survival, while original World/Stronghold modifiers remain local.

The normal controlled reproduction had a real late Portable recorded after a
false vote but no capability2 copy offer. Capability3 now offers its canonical
poison role. Controlled boundaries also cover historical decline followed by
own late defense, unchanged rejection of a second defense after copying, true
traitor precedence and original printed-only legacy continuation.

Genuine source-bound programmes use paid shipments/movement, native all14
training and actual END Mentat ownership. Unopened deck/physical-card staging
is disclosed; World/held-card scalar entropy is controlled, not claimed random.
No live armies, wallets, clocks, initiative, owners or receipts are assigned.
Five genuine programme branches reach original Collection: paid Arrakis copy
and decline after a preserved false vote, native-only World late-copy timing,
actual earned Carthag protection layered on a copied Shield, and the no-source
negative. Kaitain15 normals and Salusa5 Sardaukar stay native while three real
Guild visitors become casualties. Selected Worthless/source custody and original
winner retention remain separate from the copy.

Four390px control journeys/25 actions and twelve four-policy programmes/40
actions exercise those paths. The held-Carthag policies legally decline; full
context strategy is deferred, not claimed. Frozen related12-file union86/86
and final10 used-defense cases pass after nullable lookup/state-narrowing fixes.
Types/lint/build pass with existing warnings. New evidence:
`tests/diplomat-used-defense.test.ts`,
`tests/diplomat-late-journey.test.ts`,
`tests/fixture-diplomat-late-journey.ts`,
`tests/diplomat-context-journey.test.ts` and
`tests/fixture-diplomat-context-journey.ts`.
No HTTP/database, comprehensive assurance, full-mode or deployed proof is claimed.

