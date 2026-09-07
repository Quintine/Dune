# Semuta Drug source update and implementation boundary

7 September 2026. Read `docs/SEMUTA_DRUG_ENGINE_AUDIT.md` in full, inspected the physical card again, checked current capacity/recovery code, and freshly searched publisher sources. No project runtime edits.

## What is actually confirmed

The readable publisher card face at `/tmp/dune-rules/choam-semuta-reading.png` says to take a Treachery Card immediately after another player discards it, add it to hand, choose one when multiple cards are discarded together, and discard Semuta after use. Canonical card: `richese-semuta-drug`, Special. The [photographed component](https://cdn.anyfinder.eu/assets/QsUJtVktEC87xwK08oLlwnKyaozUWfuaLzG0LFEn67ENEEVgNrDGoITy3608Dqe7) and provenance limits are recorded in `docs/RICHESE_COMPONENTS.md`; this is visible publisher-authored text on an externally hosted photograph, not a newly located official FAQ or verified printing history.

Fresh official search retrieved [CHOAM/Richese p4](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf): discard contents are private, and inspection requires permission from an effect. Local publisher-authored mirror text agrees. Fresh official search also retrieved [base p8](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf): ordinary maximum four cards applies at any time, while hand counts are public during Bidding. Harkonnen's faction limit still applies normally to that faction; Semuta does not itself print a new limit.

Direct official CHOAM PDF and [November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf) opens returned HTTP 403. Indexed publisher search furnished the two passages above. Searches for Semuta, Semuta Drug, full-hand, discard and relevant FAQ terms found no Semuta-specific publisher answer. Some broad searches returned other GF9 games, including the separate movie Dune game; these were excluded. Local Ecaz/Ix text searches found no Semuta reference. I could not freshly retrieve the historical audit's Harkonnen-exchange FAQ passage, and do not promote that earlier citation into independently reverified Semuta evidence.

**No newly found primary source resolves full-hand take-before-discard.** The original audit's material capacity limitation remains. This is distinct from Sapho: Sapho is discarded before its holder later buys an auction card, whereas Semuta's face places acquisition before its disposal instruction.

## Target and effect contract

- Claim exactly one physical Treachery card from the fresh discard event. Ordinary, expansion, Worthless, Cheap Hero, used weapons, Karama and a newly discarded Box have no printed categorical exclusion. Leader discs, forces, tokens, Traitor/Face Dancer/Spice/Nexus cards are not Treachery cards.
- The discarded card must come from another player. For a forced discard, assigning `discardedBy` to the victim/former card controller rather than the HTTP actor is the natural composition of the rules; no new forced-discard-specific FAQ was found. Effect escrow such as an already played Ornithopter should retain its user's ownership metadata.
- For simultaneous multiple discards, choose one from that event, excluding the claimant's own contributions. Sequential discards do not become one batch merely because one server request produced them. Conversely iterating a simultaneous selected list does not create several independent claims.
- Taking the card does not undo the original effect: no refund of CHOAM sale earnings, reversal of battle losses, replay of a movement, un-cancellation of a power, or second purchase bonus. Keep original rewards and costs exactly once.
- Semuta is optional. Once legally used, transfer the selected exact discarded card to the holder, then discard Semuta. Keep other physical cards and their relative discard order. One singleton Semuta does not need a multiple-Semuta priority system.
- There is no printed phase limitation, alliance or consent requirement, spice cost, poison attack, or battle-only restriction. An unsupported producer is implementation coverage to finish, not a new prohibition on an entire phase.

These points follow the face and ordinary physical-card mechanics; they should not be labeled additional official FAQ answers.

## Timing and continuation requirements

Emit each semantic batch where the discard actually happens and before any subsequent draw/refill/removal can make it unavailable. Preserve exact card IDs, original owner IDs, permitted face visibility, event identity and a discriminated continuation. A discard-array diff at request completion is too late for discard-then-draw producers and misclassifies simultaneous versus successive events.

Battle cleanup must wait until retention decisions establish which cards were actually discarded. Winner-selected discards and later Moritani retention disposal can be separate fresh events; previously retained cards are not targets. A cached battle summary or old discard inspection is not a new opportunity. Used cards remaining physically reserved for another continuation are not yet freely claimable merely because a pointer also appears in `discard`.

The original effect's post-discard work must resume once after Semuta resolves or is declined, including empty-deck refills, paid Box completion, bonus draws, response cancellation and terminal phase transitions. A closure or full old `Game` snapshot is unsafe to replay because it can overwrite the newly claimed card or duplicate original rewards. An immutable event snapshot is evidence, not another physical copy. Refresh/retry/CAS must never reroll forced discard, re-pay, re-discard Semuta or award two targets.

“Immediately” requires a genuine opportunity before the continuation takes the card elsewhere. A nonblocking toast while the engine already draws/shuffles does not implement that timing. Conversely Semuta does not authorize suspending a transaction at an unrelated earlier stage or searching the entire pile.

## Privacy and automatic no-choice behavior

Before activation, show a neutral fresh-discard opportunity with only information already public about that event. The Semuta button and capacity explanation belong to its actual holder. Do not reveal hidden discarded faces, old discard contents, skipped player IDs, hand sizes outside existing rules, or a public label naming a secret holder. A holder must not receive repeated free previews of unknown fresh faces and then decline without using Semuta; commit first, then authorize only that batch's eligible faces. This is a privacy-preserving implementation of limited selection permission, not a claimed explicit FAQ about preview timing.

Once the card has been publicly committed, exactly one eligible candidate means automatic selection and completion. Multiple candidates are a real owner-only choice. An empty candidate set or stale/foreign card must reject before spending/inspection; corruption discovered after a persisted commitment must fail safely, not fabricate an alternative top-deck draw or silently erase the event.

**Pre-activation automatic absence is different.** If two otherwise identical public states differ only in who secretly holds Semuta or whether that hidden holder has space, making one pause and the other automatically advance discloses that hidden condition. Omitting a claimant name from the window does not fix this timing leak. Current `viewGame` exposes foreign hand count only in phase3; privately knowing the server's actual count does not authorize broadcasting eligibility by continuation timing.

Therefore:

1. Auto-close immediately only when impossibility is established by information public to all affected observers, or by explicit already-public activation/decline. Examples can include a module configuration where Semuta cannot exist or a verified public card-custody state establishing it is not in any hand; do not assume hidden cache/deck ownership is public.
2. Otherwise use the same neutral reaction-boundary lifecycle in paired hidden states, including automatic workers. Any timeout/continuation protocol must be driven by public event conditions and give a real opportunity to intervene. It must not wait only for a discovered holder or end early because that holder is ineligible.
3. Do not add a manual “confirm the only card” step after commitment. Do not claim an unrestricted hidden-hand-based auto-normalizer is privacy-neutral just because current Karama responses have existing automatic checks.

There is a genuine product/architecture tradeoff between guaranteeing an immediate reaction, having no public hand-dependent timing, and never presenting neutral waits when no hidden player can act. It cannot be solved by renaming a holder-dependent modal. This requires one consistent reaction protocol, not a rules question for every discard producer or a fabricated printed time limit.

Useful acceptance test: hold public state and clock/event progression fixed; replace the hidden Semuta with another hidden card, move it between hidden hands, and vary private free capacity. Until a real use is declared, unauthorized views and public auto-advance behavior must match. Test separately that a committed sole target finishes through normalizer/recovery with no owner acknowledgement.

## Smallest unresolved ruling set

**One Semuta-specific question remains:** may a holder already at their faction hand limit use Semuta as an exchange, or must a free slot exist before taking the card because Semuta is discarded afterward? Apply the eventual answer to normal and Harkonnen limits and separately retain capacity reserved for compulsory incoming exchanges. A temporary free-slot guard is defensible as an explicitly unfinished boundary; it must not be presented as wording printed on Semuta.

The existing unresolved **Guild-stopped shipping-Karama refund** also constrains claiming that exact provisionally refundable card. Do not ask it again as a new Semuta question. Fence its competing custody or resolve the existing underlying ruling; this does not prohibit every shipment-phase Semuta event. Current Box guard in `game/engine.ts` near `:1209` already identifies this composition.

Do not ask again about normal targets, forced-discard owner bookkeeping, simultaneous selection, zero fee, automatic singleton selection or semantic batch implementation. Do not repeat the three pending Sapho questions. No new authoritative capacity/priority ruling was obtained by this review.
