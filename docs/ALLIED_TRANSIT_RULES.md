# Allied transit and separation: bounded primary-source audit

Audit: 7 September 2026. Read-only source and code audit, retained by the coordinating agent. Scope is classic GF9 base rules and the applicable November 2020 FAQ, not tournament or movie-game rules.

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

## Current implementation comparison

Line numbers refer to the saved engine read during this audit.

- `game/engine.ts:3421` `allowedEntry` rejects a non-Polar destination containing any allied presence whenever the entering group is not advisors. This prevents the permitted reserve-shipment-then-move-out sequence. It also prevents any separately submitted movement whose endpoint is temporarily allied.
- `:4628` `pathBlocked` considers storm and two-other-faction stronghold capacity, not allied presence. A legal multi-territory path can already transit allied territory while ending elsewhere. Preserve this behavior.
- `:11474` `endMovement` examines total presence, excludes Polar territory, waits until the ally is absent from `movementRemaining`, and skips destruction when both formation markers equal this turn. It then destroys the current player's forces in the shared territory. This is the existing pre-existing-alliance separation mechanism.
- `game/advisors.ts` distinguishes total presence from fighter count. Using total presence for allied separation matches the advisor FAQ. Using fighter count for stronghold capacity matches the base advisor exception. These are intentionally different questions.
- A blanket removal of the entry guard would be incomplete: the current formation-turn exemption is player-wide and the end-turn rule allows the first mover to leave shared forces for the second ally. Neither records whether a specific group entered voluntarily this turn or was present when the alliance formed.

## Implementable boundaries and material unanswered cases

The clearest supported new behavior is **ship into allied territory, then move the complete visiting group to a legal non-allied destination during the shipper's turn**. A movement path passing through an ally and ending elsewhere is also clear. Permit neither a third fighting faction in a stronghold nor storm traversal under this exception. Preserve Polar Sink's exception. Separate shared territories by their history rather than treating every alliance formed this turn as blanket permission to create new co-occupation.

The following are actual source limits, not established alternative rules:

1. **Voluntary entry cannot be followed by an exit.** The FAQ imposes departure but does not prescribe a software or tabletop remedy if an intervening Karama/entry effect makes departure impossible. Rejecting the original shipment prospectively, reverting/refunding it, automatically killing the entrant, or allowing it to wait for the ally are different outcomes. The p12 Tanks consequence is explicit for its existing-co-occupation case; applying it to every voluntary entrant would be an additional composition.
2. **Separate moves ending on an ally.** Passing through within one multi-territory move is explicit. A first Hajr or two-group Ornithopter action ending on an ally and a second action leaving is not separately addressed by the retrieved text. Do not silently treat those digital action boundaries as either one move or an extra permission. A narrow initial shipment-plus-normal-move implementation can avoid claiming this edge is settled.
3. **New voluntary entry during alliance formation turn.** Distinguish the FAQ departure requirement from the p12 delayed deadline for already shared forces. The precise treatment of mixed old/new cohorts in the same territory is not supplied as a token-level rule. Do not let a blanket `allySinceTurn` check silently waive the new entry's obligation.
4. **Other arrival mechanisms.** Advisor accompaniment has its explicit separation instruction; its timing can differ from BG's own turn. Worm rides, No-Field materialization, Enemy of My Enemy and competing expansion arrivals need their own composition. Homeworlds are outside this base transit permission.

Recommended bounded checks before changing the entry guard: ordinary path transit with a clean endpoint; paid shipment followed by complete legal exit; no legal exit available; temporary city access and remaining movement range; ally-plus-enemy stronghold capacity; Polar co-occupation; advisors versus fighters; old Nexus co-occupation in formation turn and following turn, both action orders; multiple shared territories; serialized continuation and duplicate requests. Bind the no-exit outcome only after its policy is source-supported or explicitly adjudicated. No runtime or tests were changed by this audit.
