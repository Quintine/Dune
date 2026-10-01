# Allied transit and separation: bounded primary-source audit

Audit: 7 September 2026. Read-only source and code audit, retained by the coordinating agent. Scope is classic GF9 base rules and the applicable November 2020 FAQ, not tournament or movie-game rules.

## Authorized Advanced source cutover — 1 October 2026

The user-supplied root `UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf`
is now authorized for Advanced, including its marked unofficial departures.
It has 44 physical PDF pages and SHA-256
`7077aa87a973221d86d4bd2da945b40c4dec3d371caa6a68cb209758ddf1e516`;
metadata says v.2.3, but the visible editorial heading on physical page 3
says Version 2.2. The PDF remains user-owned and is not republished.

**Alliance Constraint, physical PDF page 15:** at the end of either
player's Shipment and Movement, its own forces in a territory shared with
its ally go to Tanks, except Polar Sink. Advisors do not trigger the
constraint. The footnote identifies both per-player timing and advisor
coexistence as intentional departures from the original rules and November
2020 FAQ. **Questions and Answers, physical page 40** explains the aim:
advisor occupation should not lock allies out, and the first acting player
should bear its own departure obligation.

Accordingly, normal Advanced ends no longer wait for the ally's later turn
or exempt an alliance formed this turn. Advisor exemption works in both
directions: sharing with advisors kills neither the advisors nor allied
fighters. BG fighters are not exempt. Native Ecaz peaceful coexistence and
its existing Karama conditions remain unchanged. Homeworlds are not Dune
territories and keep their native allied-entry prohibitions. Basic retains
the existing later-player and formation-turn conditions, including its
non-exempt advisor treatment.

This resolves the **Advanced** timing/advisor and end-turn consequence
questions below. It does not remove the current allied-entry guard, grant
new shipments or extra moves, alter alliance formation/breaking windows,
or settle every optional arrival composition. A forced end consequence
does not require a new loss confirmation; the existing `endMovement`
action remains legal even when no escape is available. The native force,
elite and No-Field custody paths remove the ending player's group once,
not its ally's group.

The own clean-turn warning uses the canonical engine quote via
`GameView.advancedAllySeparation: { territories: string[] } | null`.
It contains public territory names only, not force counts, concealed
values or raw source receipts. Pending response/decision controls retain
priority. Already completed turns are not reevaluated.

**Verification: Partial development verified.** The selected source-wave
checks pass 339/339 across seventeen files; full types/lint and 6,169
offline cases pass. Authenticated SQLite covers restart/CAS/privacy and
unchanged Basic behavior. Genuine unallied Basin groups separated by
Storm subsequently ally at a natural Nexus; native ending sends only the
actor's two physical forces, including one elite, to Tanks. Hajr and
advisor/Ecaz/Polar cases retain their own continuation. Actual 390-pixel
first/later human ending in backed-up `CA6FVKVD` and `U5335T2L` changes
Emperor Tanks from zero to two, leaves Atreides at zero and survives refresh.
Saved physical inventory and all original authenticated seats remain intact.
No allied-entry guard was removed to create the fixture. Basic and wider
public/faction/module gates remain unchanged. The September publisher audit
below is historical comparison, not the current Advanced authority.
The supplied revision is unofficial, not a later publisher FAQ.

## Publisher sources and established facts

**Base rulebook**, printed pp9–10,12,18,23: https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf . Read local publisher text `/tmp/dune-rules/base.txt`; official indexed p12 independently corroborates it.

- Shipment precedes that player's ordinary force movement. Each normal movement moves one group, with one or three territories of range as applicable. Storm and stronghold restrictions still apply.
- The alliance constraint expressly exempts Polar Sink. Allies never battle each other.
- The p12 NOTE addresses factions allied during the preceding turn which still share a territory at the next turn's beginning. One must leave during Shipment and Movement. If the first acting ally does not leave, the second must leave or lose its forces there to the Tanks. This supplies a delayed separation deadline for existing co-occupation, not an unconditional entry prohibition.
- Advisors do not prevent another faction's stronghold control or challenge. They remain vulnerable to the listed destruction effects. Their peaceful stance does not make them a different faction.

**November 2020 FAQ**, printed pp2,4: https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf . Official indexed full pages were retrieved. No new downloadable binary is claimed.

- Page2 clarifies that allies may be passed through and that shipment into an ally's territory is permitted, provided the entrant moves out to territory without that ally. Ornithopters are not a prerequisite for this permission. The purpose is to prevent ending movement together.
- Page2 separately forbids traversing or shipping into a stronghold containing two other factions; allied transit does not override capacity.
- Page4 expressly requires separation when BG advisors share territory with their ally, referring to the base Alliances NOTE. Advisors therefore are not a permanent allied co-occupation exception.
- Page4 forbids advisors flipping to fighters with an ally. Incoming BG tokens must match the territory's existing BG stance. Advisors becoming alone automatically become fighters.

Exact retrieval queries included the official PDF path plus `"ship into a territory" "ally"` and `"What is the difference between an advisor"`. Searches also checked allied territory, next-turn, Tanks, and advisor/alliance terms. The relevant later clarification is November, not the older April FAQ. Search results for the 2021 movie edition and non-rule forum content were excluded. No later relevant official clarification was located in these bounded searches; that is not proof none exists.

## Historical implementation comparison — 7 September 2026

Line numbers refer to the saved engine read during this audit.

- `game/engine.ts:3421` `allowedEntry` rejects a non-Polar destination containing any allied presence whenever the entering group is not advisors. This prevents the permitted reserve-shipment-then-move-out sequence. It also prevents any separately submitted movement whose endpoint is temporarily allied.
- `:4628` `pathBlocked` considers storm and two-other-faction stronghold capacity, not allied presence. A legal multi-territory path can already transit allied territory while ending elsewhere. Preserve this behavior.
- `:11474` `endMovement` examines total presence, excludes Polar territory, waits until the ally is absent from `movementRemaining`, and skips destruction when both formation markers equal this turn. It then destroys the current player's forces in the shared territory. This is the existing pre-existing-alliance separation mechanism.
- `game/advisors.ts` distinguishes total presence from fighter count. Using total presence for allied separation matches the advisor FAQ. Using fighter count for stronghold capacity matches the base advisor exception. These are intentionally different questions.
- A blanket removal of the entry guard would be incomplete: the current formation-turn exemption is player-wide and the end-turn rule allows the first mover to leave shared forces for the second ally. Neither records whether a specific group entered voluntarily this turn or was present when the alliance formed.

## Historical implementable boundaries and unanswered cases

The clearest supported new behavior is **ship into allied territory, then move the complete visiting group to a legal non-allied destination during the shipper's turn**. A movement path passing through an ally and ending elsewhere is also clear. Permit neither a third fighting faction in a stronghold nor storm traversal under this exception. Preserve Polar Sink's exception. Separate shared territories by their history rather than treating every alliance formed this turn as blanket permission to create new co-occupation.

The following are actual source limits, not established alternative rules:

1. **Voluntary entry cannot be followed by an exit.** The FAQ imposes departure but does not prescribe a software or tabletop remedy if an intervening Karama/entry effect makes departure impossible. Rejecting the original shipment prospectively, reverting/refunding it, automatically killing the entrant, or allowing it to wait for the ally are different outcomes. The p12 Tanks consequence is explicit for its existing-co-occupation case; applying it to every voluntary entrant would be an additional composition.
2. **Separate moves ending on an ally.** Passing through within one multi-territory move is explicit. A first Hajr or two-group Ornithopter action ending on an ally and a second action leaving is not separately addressed by the retrieved text. Do not silently treat those digital action boundaries as either one move or an extra permission. A narrow initial shipment-plus-normal-move implementation can avoid claiming this edge is settled.
3. **New voluntary entry during alliance formation turn.** Distinguish the FAQ departure requirement from the p12 delayed deadline for already shared forces. The precise treatment of mixed old/new cohorts in the same territory is not supplied as a token-level rule. Do not let a blanket `allySinceTurn` check silently waive the new entry's obligation.
4. **Other arrival mechanisms.** Advisor accompaniment has its explicit separation instruction; its timing can differ from BG's own turn. Worm rides, No-Field materialization, Enemy of My Enemy and competing expansion arrivals need their own composition. Homeworlds are outside this base transit permission.

Under the authorized Advanced cutover above, the ending player's shared
fighters are lost even if departure was prevented or the alliance formed
this turn; no old/new cohort exemption is inferred. Thus items 1 and 3 no
longer leave the ordinary **Advanced end-turn consequence** unresolved.
Their Basic-policy and prospective entry-permission questions remain.
Item 4's advisor separation premise is superseded in Advanced, while
independent arrival timing and unsupported combinations stay bounded.

Recommended bounded checks before changing the entry guard: ordinary path transit with a clean endpoint; paid shipment followed by complete legal exit; no legal exit available; temporary city access and remaining movement range; ally-plus-enemy stronghold capacity; Polar co-occupation; advisors versus fighters; old Nexus co-occupation in formation turn and following turn, both action orders; multiple shared territories; serialized continuation and duplicate requests. Bind the no-exit outcome only after its policy is source-supported or explicitly adjudicated. No runtime or tests were changed by this audit.
