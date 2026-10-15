# Ecaz Nexus source contract

Audited 10 September 2026. This is a source and integration audit, not an implementation or release claim. The immediate scope is Secret Ally; the other two printed effects remain separate. See [common Nexus rules](NEXUS_CARD_RULES.md).

## Primary evidence

The Ecaz panel was freshly inspected in the [photograph of the original GF9 components](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani), cached at `/tmp/dune-nexus-cards.jpg`. Secret Ally selects one player and requires a yes/no disclosure of whether that player holds any of the user's leaders as Traitors. It expressly withholds which leaders. It has no printed phase, battle, location, payment, live-leader or opponent-only condition. The face does not specify that this answer is secret or addressed only to the user. Its Cunning takes Duke Vidal for a turn despite capture, Tanks or Ghola custody; Betrayal concerns Ecaz's ally returning co-located forces before Shipment and Movement. Those are not Secret Ally prerequisites.

The [GF9 E3 rulebook, pp.11 and 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=11) provides common mode eligibility, consumption and the Nexus FAQ. Secret Ally requires Ecaz absent from the seated faction roster and does not create a real alliance. The holder cannot retain the card through joining an alliance. Use consumes the physical Nexus card. There is no Ecaz-specific FAQ answer. The cached publisher-authored text at `/tmp/dune-e3-nexus-rules.txt` was inspected; fresh official-domain indexed excerpts confirm the two Nexus FAQ entries. A [publisher-authored mirror](https://gamers-hq.de/media/pdf/0f/7a/86/Dune_EcazMoritani_Rulebook_EN.pdf) supplied the previously cached PDF.

## Leader identity and custody

**Certain:** Duke Vidal cannot make the answer positive. E3 expressly gives him no Traitor Card, despite changes of controller. Its Moritani FAQ permits an ordinary traitor call against a native Moritani leader captured by Harkonnen, so capture does not erase that leader's printed identity. [E3, pp.3, 8 and 14](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=14)

**Certain:** a leader's death does not remove an already held Traitor Card or make that identity cease to be a traitor. Revival preserves it. The effect supplies no alive-only filter. The later FAQ also distinguishes Tleilaxu's native leaders from foreign Ghola leaders and permits foreign Gholas to return through the Tanks. [GF9 FAQ, April 2020 p.1](https://www.gf9games.com/dune/wp-content/uploads/2020/04/Dune-FAQ.pdf#page=1), [GF9 FAQ, November 2020 p.6](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=6)

**Not authoritatively settled by the inspected sources:** whether this card's possessive means native faction identity, the current controlled leader pool, or native leaders plus acquired foreign leaders. The [E1 Ghola advantage, p.7](https://www.gf9.com/Portals/0/Documents/GF9/IxianAndTleilaxuRulebook.pdf#page=7) explicitly adds foreign leaders to the Tleilaxu leader pool. It does not redefine the Ecaz card, which was published later. It is therefore unsafe to label either a native-only or current-control interpretation an explicit GF9 ruling.

The ordinary uncontested case is an owner's native faction leader identities, including dead leaders, against a target's actual held traitors. Canonical faction matching avoids accidental dependence on whether a captured disc remains in its original owner's array. For a full implementation, keep the ownership scope explicit and resolve the exceptional scope before claiming captive/Ghola coverage. Do not silently use only currently battle-available leaders: that adds an unsupported live/used-at constraint. A native-only choice would include native leaders currently captured elsewhere; a current-control choice would instead include held foreign captives/Gholas. Those can produce opposite answers.

The ordinary Cheap Hero/Heroine Treachery Cards are not faction leader discs and share a separate physical traitor identity. They must not silently become part of every faction's native leader set. Advanced CHOAM's Auditor is a real native leader with its own component identity; use the initialized canonical inventory rather than a hard-coded count of five. These are component/model observations, not a retrieved Ecaz-specific ruling about a controlled-pool interpretation.

## Face Dancers and targets

E1 makes Tleilaxu's drawn identities Face Dancers instead of ordinary selected traitors. The E3 Harkonnen Secret Ally FAQ expressly preserves that classification when Tleilaxu obtains another such card. [GF9 E1, pp.6–7](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=6), [GF9 E3, p.16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=16)

A literal **traitors-only composition** therefore reads the target's ordinary traitors and answers false for Tleilaxu; it does not disclose either revealed or unrevealed Face Dancers. This is a defensible composition of the distinct card roles, not an explicit Ecaz-versus-Tleilaxu FAQ. Do not merge `faceDancers` into `traitors` merely because they share the physical Traitor Deck. Extending the question to Face Dancers would reveal additional information and needs an explicit selected interpretation.

The card does not restrict the target to a combat opponent, an unallied player, a faction with a matching traitor, or a faction whose cards are still secret. Target availability must not depend on the answer. An allied target remains a player; the user's own alliance status is constrained by common Nexus custody. The wording does not explicitly exclude selecting oneself, although it reveals no new information to the user. Do not claim a self-target exclusion comes from the face.

## Disclosure and transaction timing

The phrase on the face is a disclosure requirement without an explicit audience qualifier. **The inspected GF9 sources do not settle private-only versus table-wide disclosure.** Atreides' nearby Cunning explicitly describes showing its user a plan element; this Ecaz effect does not. Existing private inspection code is an implementation precedent, not evidence that this different effect has the same audience. Preserve only the yes/no fact under whichever audience is selected, never a count, identity, faction breakdown, concealed captive status, or whole target hand. Do not use a tournament's added “publicly announce” wording as if printed on the GF9 component.

There is no prescribed separate answer delay. An atomic accepted play can spend Nexus and record the current answer without asking the target to confirm a server-known fact. That avoids an avoidable interval in which a hand exchange changes what is being answered. This is an implementation sequencing recommendation, not an extra printed phase restriction.

Read the target's completed current hand. Finish an already pending Harkonnen draw/return or Face Dancer replacement before a new inquiry: those operations expose an augmented intermediate pool and already have game-wide action locks. A later legal exchange can change the target's hand but must not rewrite the historical answer. Neither declared traitor-call history nor discarded/replaced identities substitute for what the player currently has. The answer cannot retroactively change an earlier battle call.

## Current integration map and proposed boundary

- `game/leader-control.ts` separates original faction identity from `capturedBy`, `gholaBy` and temporary `controller`; `engine.ts` keeps native leader records in their original seat arrays. Its `controlledLeaders` helper is a different query from native faction identity.
- `projectLeader` hides appropriate capture/Tanks details. A new offer must not enumerate actual hidden foreign captives or vary availability with their presence. Any exceptional-custody gate must follow public configuration, not a secret `capturedBy` test.
- `game/nexus-traitor-exchange.ts` validates the exact global physical census and requires Tleilaxu's ordinary `traitors` array to be empty. Pending exchanges are locked through `pendingNexusTraitors`; completed history deliberately survives later custody changes.
- `game/traitors.ts` maps real leader identities and the separate Cheap Hero identity for battle use. It does not answer who owns a leader for this effect.
- `game/tupile-intelligence-state.ts` is the closest stored-observation precedent: retain a signed, dated answer and validate its intrinsic receipt without recomputing against future hidden hands. `game/battle-inspections.ts` concerns commitments to a plan and its answer/reopen history; Ecaz's past fact should not become an ongoing commitment.

Implement the common, source-clear contract as a pure boolean intersection of **explicitly supplied queried leader IDs** with an ordinary held-traitor snapshot. Let the engine select the agreed leader scope and audience. Bind the accepted event, original seats/factions, turn/phase, chosen target, scope and boolean in a completed receipt; keep private source evidence server-side if retained. Discard the one real Ecaz Nexus card in the same accepted transaction. Validate current global custody separately from historical answers. Public offers can be built entirely from roster, timing/continuation state and the owner's card, without reading target secrets.

Meaningful regressions should cover positive and negative answers with equal public hand sizes; dead/revived native leaders; native captive versus foreign captive/Ghola cases for the explicitly selected scope; Duke and Hero identities; Tleilaxu role separation; Harkonnen exchange before/after inquiry; stale/replayed/concurrent play; JSON/SQL historical persistence; and exact audience projection without counts or matching identities. Until scope and audience are selected, those unresolved branches must not be presented as fully source-verified behavior.

## Bounded Betrayal runtime

The printed Betrayal is a **separate panel** from the Secret Ally inquiry above.
With Ecaz seated, an unallied holder of the one physical Ecaz Nexus card may
choose one printed Arrakis territory occupied by both Ecaz and its reciprocal
ally. The ally returns its **entire** normal/starred group from every sector of
that territory to reserves; Ecaz's forces and the ally's other territories stay.
This is not a shipment, movement, combat loss or revival. The holder's private
offer contains only public positions and typed public force counts; rivals do
not see the held card. Acceptance spends the card once and opens a public
Karama response. Allowance returns the quoted group; cancellation leaves all
board forces unchanged and the Nexus card spent. This response classification
is an explicit **provisional composition**, not a GF9 ruling granting Karama
blanket jurisdiction over Nexus effects.

The first implementation window is deliberately narrow: phase 5 while its
first active player is still current, the original movement queue is intact,
no pending decision/response and no shipment or movement has been used. It does
not assert that this is the only possible reading of “before Shipment and
Movement.” The physical Ecaz alliance and co-occupation must be current.
An automated eligible holder is scheduled before an earlier-seated movement
bot closes this opening; a human holder must declare before that first turn
advances. The game does not pause all seats to reveal a hidden card.
Only the classic factions plus Ecaz/Moritani and the Nexus module are
admitted; advisors, hidden No-Fields, Homeworlds, Discoveries, Leader Skills,
Tech, Stronghold Cards and other combined modules remain gated. A saved
pending snapshot binds the card's discard position, ally and exact typed board
group through the Karama window, even if another Nexus card is discarded
during that response. The ally's reserve counters are validated before any
board return. Saved receipts reject replay but are not cryptographic proof of
historical save authenticity. The bounded Duke Cunning path below is separate;
Secret Ally's exceptional leader scope and audience remain unsettled beyond
the bounded runtime below.

## Original quiet-phase Cunning timing — 14 October 2026

Printed Cunning says to take Duke **for this turn**, without a Battle-only
restriction. The original supported profiles now permit the private action
at a quiet boundary in any phase. This removes the artificial phase-six
fence; it does not open new rosters, modules, shared training, foreign-Ghola
revival or an interrupt inside a committed parent.

The existing shared no-phase Nexus guard still blocks original auctions,
Battle, responses, Ambassador placement/arrival, revival, pending physical
returns and other in-flight interactions. A new public pause is not created.
The current chooser, phase, payment, force counters and native continuation
remain unchanged by Cunning. One battle or unused **current-turn** expiry
still sets Duke aside, without restoring an old captor.

New physical plays use strict **version3**, with ordinary/captured custody
and the actual phase in their private event/history. A command carried
across phases is stale. Earlier unversioned ordinary and version2 captured
records keep their exact Battle-only grammar and signature, rather than
being reinterpreted as earlier-phase permission. Existing actual native QA
receipts in both historical formats remain accepted. Future-phase history,
invalid custody and invalid physical sources still reject.

The original Revival rejection was reproduced, then the real same-disc
Revival → Shipment → Battle/use path passes. The frozen affected nineteen-file
union passes **189/189**, with types/lint/build. **Thirty-one native API scenarios**
pass: captured/returned-Tanks Cunning in actual Storm, Charity, Revival,
Shipment, Collection and Mentat windows; all four minimal legal profiles
in Revival/Shipment; both native turn expiries; and original battle release.
Actual production GameTable at **390px**, using the canonical stylesheet
pipeline, spends Cunning in Revival and during another faction's Shipment,
and returns a truly executed Duke from Tanks before Battle. Real Ambassador
placement and Guild timing remain blocking until their own controls resolve.
Wallet10→10, ordinary leader slot and Harkonnen's shipment turn remain;
native battle release and unused expiry follow. No overflow/browser errors
were observed in those working surfaces.
The final production build retains existing module-deprecation, chunk-size
and route-classification warnings. Shared-Duke, capture and Ambassador
internal guidance now identifies this bounded support rather than a blanket
capture exclusion.

Obsolete phase-only and blanket Advanced-Harkonnen rejection pins, SSR
wording and an incidental retained-hand assumption are deleted, not re-pinned.
An ordinary legal AI may now spend the card earlier; that is not a printed
requirement to retain it until Battle. No saved/deployed room is touched.
This is not broader recovery, combination or complete-mode acceptance.
[Actual timing regressions](../tests/nexus-duke-timing-runtime.test.ts).
Older quiet-Battle timing below is historical and superseded by this section;
the captured-return and Ecaz-only revival policies themselves are unchanged.

## Original captured Duke and Ecaz Ghola composition — 14 October 2026

The existing standalone Ecaz/classic, no-Skills Nexus envelope now connects
Advanced Harkonnen's actual postbattle lottery to the one shared Duke. This
does not open paired Moritani/Harkonnen or shared-Duke training. The original
Ecaz Ambassador can first acquire an available living Duke in that envelope;
it still cannot take a captive or Ghola.

The lottery includes an eligible unused Duke and a surviving Duke just used
in the losing battle. A validated battle witness preserves that candidate
across the original one-battle release. **This ordering is provisional
composition**, not a publisher-specific priority ruling. Keeping the captive
overlays its prior tenure rather than duplicating a disc or native roster.
Execution pays the original two spice and returns the dead disc to Ecaz's
Tanks with at least two deaths. Original secret capture/execution visibility
remains; the retained underlay snapshot is server-only, not a projected field
or a private-offer token leak.

At the existing quiet Battle boundary, actual Cunning liberates a captured
living Duke or revives the returned Tanked disc. The physical Nexus is spent
once, without spice, forces or an ordinary leader-revival allowance. The
**provisional return policy** clears captivity permanently: one battle or
unused turn expiry sets Nexus custody aside, never back to the captor.
Original captive use likewise releases the disc; when all native Harkonnen
leaders die, an unused, still-valid prior tenure is restored, otherwise it
is set aside. A living already-used disc gains no fresh same-turn use.

Only Ecaz may revive Duke, including with the actual Ghola Treachery Card.
The native Ghola returns that same disc alive and set aside, retaining deaths
and clearing prior use; a separate actual Cunning may then acquire it.
**No foreign-Ghola Duke is produced or admitted.** This legal composition does
not claim implementation of a forbidden Tleilaxu-owned Ghola source.

The frozen thirteen-file related union passes **127/127**, with types, lint
and production build. Actual production GameTable controls at **390px** retain
the captive, spend Cunning, select Duke6, resolve a real battle and release
once into Collection; a separate used-captive execution pays two spice.
Actual Ghola controls return the dead Duke before a separate Nexus spend.
No horizontal overflow or browser errors were observed. These are isolated
in-memory paths, not saved-room, deployed, full-combination or recovery
acceptance. Existing build warnings remain; broad assurance stays deferred.
Thirteen additional actual native API scenarios pass: unused/just-used
Keep and Execute, Cunning after each, liberated battle use, unused turn
expiry, captive use, all-five-native-dead return and actual Ecaz Ghola
then separate Cunning. They verify original action costs separately from
later Collection, one identity, no native/Traitor duplication and actual
returned-dead privacy. Proof JSON remains outside Git.
See [native scenario regressions](../tests/nexus-duke-capture-runtime.test.ts),
[custody transitions](../tests/duke-captured-custody.test.ts) and
[receipt/privacy boundaries](../tests/nexus-ecaz-duke-captured.test.ts).
The older checkpoints below retain their historical scope; their capture
and standalone no-Skills Advanced-Harkonnen exclusions are superseded here.

## Bounded native Cunning: Duke Vidal

When Ecaz and Moritani are both seated in a three-to-six-player Basic or
Advanced game using only their expansion and Nexus cards (other seats may be
classic factions), an unallied Ecaz holder may spend the physical Ecaz Nexus
card at a quiet Battle phase boundary to take the **existing** uncaptured,
non-Ghola Duke Vidal, living or set aside in the Tanks. This transfers the one
shared disc even if Moritani controls the living Duke; a Tanked acquisition
revives that same disc and preserves its death count. It does not add a leader
or Traitor Card to a native roster. The owner's private offer reports the
current public controller and availability. Other seats see no
held-card-dependent offer or pause.

Acceptance binds the original controller, source, alive/dead status, turn,
seated factions and event to a signed saved receipt, discards the single card,
changes Duke custody and retains independent replay markers. Receipt keys and
signature field order are unchanged: older completed living receipts remain
valid, with no invented historical death count. The actual shared disc retains
its death history. The ordinary battle leader path may then select Duke, and
battle use sets him aside through its existing lifecycle.
Unused **Nexus** custody ends at turn end. This distinct temporary source does
not shorten the ordinary Ecaz Ambassador tenure, which lasts until battle use
or a later Moritani acquisition. JSON restoration and saved-room replay retain
the completed play without recomputing historical custody from a later turn.

The printed Cunning explicitly reaches Duke in capture, Tanks or Ghola custody.
The **bounded prototype now includes set-aside Tanks custody**, but not capture
or Ghola acquisition. Those return destinations and exceptional priority
interactions still need a coherent physical-custody contract before they are
enabled. The face does not print a Battle-only timing restriction; the
quiet phase-six window is a product implementation boundary, **not** a GF9
ruling. Advanced Harkonnen tables are also excluded: the existing shared
leader battle path cannot select Duke there, so the card must not be spent
for an unusable disc. At that initial checkpoint other expansion factions,
Homeworlds, Discoveries, Leader Skills and combined optional modules remained
gated. This was not full Ecaz, Moritani or Nexus module acceptance.

### Tanks Cunning composition — 8 October 2026

The printed Ecaz Cunning supplies the Tanks allowance. Only its native,
unallied Ecaz holder may spend the actual Ecaz Nexus card to perform this
acquisition at the existing quiet Battle boundary. The pure custody transition
permits a dead disc only for `ecazNexus`, with controller, acquisition turn and
source all null before acquisition. It revives the existing disc and assigns
Ecaz's current-turn Nexus custody. Moritani, ordinary Ecaz Ambassador and ally
acquisitions still reject a dead Duke; capture/Ghola and Advanced Harkonnen
gates are unchanged.

Clearing the old battle-use stamp on this independent resurrection permits
one new use under the normal shared-Duke lifecycle. That allowance/use
composition is **provisional**, not an inspected GF9 FAQ ruling. A living,
already-used Duke remains unavailable; taking a living disc does not clear
its stamp. There is no separate paid revival charge or native revival slot
for this Nexus action. This does not broaden the exact user ruling that only
Ecaz revives Duke, including when using the Ghola Treachery Card, into support
for Cunning's exceptional Ghola custody or return destinations.

Focused cases are authored in [the quote/source tests](../tests/nexus-ecaz-duke-quote.test.ts):
source-specific dead-disc rejection, same-disc revival with preserved death
history and cleared prior use, real Basic/Advanced setup and physical Nexus
spending by all four bot profiles, living-used rejection, set-aside custody,
and the unchanged historical receipt shape. These additions are not a claim
of executed checks or live-control proof.

Parent native Basic/Advanced smokes now spend one original Nexus, acquire
the same Tanked Duke with deaths2 retained and old use cleared, then seal
him in a real new battle and release once after survival. No spice is
charged for the Nexus action. The live owned control in Chromium reaches
the same acquisition, death history and card disposal against the native
engine. This is isolated rule/control proof, not HTTP, recovery or deployed
acceptance; no broad suite was run.

### Standalone skill/Nexus follow-up — 5 October 2026

The fresh standalone Ecaz/classic ecaz33/all14/all12 entry now composes the
same quiet living/unclaimed Duke Cunning with ordinary native disciplines
and selected original Tech/Advanced Strongholds. Moritani need not be seated.
Five ordinary training discs remain; the shared Duke receives no assignment.
Human YZLNTNEZ uses Duke6 with face-up normal Warmaster/Worthless and a held
Shield against actual poison, wins7–5, releases Duke before cleanup and keeps
the original winner reward/city income. At that checkpoint Advanced Harkonnen,
dead/captured/Ghola recovery, shared-Duke training and unrelated overlays
remained guarded; the Tanks-only Cunning change above supersedes its dead-disc
gate, not its capture/Ghola boundaries.
See [the exact standalone profile and evidence](NEXUS_CARD_RULES.md#standalone-e3-nexus-skills-and-original-components--5-october-2026).


The following describes the initial living-only checkpoint, not verification
of the Tanks follow-up:

[The focused Duke tests](../tests/nexus-ecaz-duke-engine.test.ts) exercise
genuine Ecaz/Moritani setup, physical draw/spend, Basic and Advanced transfer,
ordinary leader projection, actual end-turn expiry, blocked custody,
Advanced-Harkonnen rejection, stale commands and historical integrity.
The historical [in-memory SQLite recovery](../tests/nexus-ecaz-duke-recovery.test.ts)
records restart and competing-write coverage. The old SSR wording/action-copy
control test has been removed, not re-pinned; current custody controls are
proved through the actual GameTable and native engine paths above.
A local read-only browser fixture displayed the owner action and no rival
offer; no room was written. The final offline suite passed 5,623 tests across
712 files; scoped lint, isolated type diagnostics outside the concurrent
Fremen draft and production build passed. The repository-wide `npm run check`
remains blocked by that separately owned draft, not by this Duke path.

## Bounded Secret Ally traitor inquiry runtime

When Ecaz is absent, an unallied holder may spend its physical Nexus card at
a quiet play boundary to ask about any seated player, including themself. The
owner-only offer lists public names and never consults a target's hidden hand
to determine availability. Acceptance atomically reads the target's currently
held ordinary Traitor Cards, records one yes/no answer, and consumes the Nexus
card. The target and public chronicle learn that an inquiry occurred, but only
the holder sees the historical answer. Later exchanges or leader deaths do not
rewrite it. No generic Karama response to this borrowed panel is invented.

For this first playable interpretation, “your leaders” means the holder's
native faction leader identities, including dead and captured native discs,
but not foreign captives/Gholas, Duke Vidal or Cheap Hero. Face Dancers are
not ordinary Traitor Cards. This identity scope and the holder-only audience
are **product interpretations**, not explicit publisher rulings. A fresh
online search found no authenticated clarification beyond the previously
inspected primary component and rulebook linked above. The
exceptional controlled-pool and table-wide disclosure alternatives remain
visible release boundaries; this prototype does not certify them.

The completed, signed receipt binds the accepted event, original seats and
factions, turn/phase, native scope and answer without storing or projecting a
matching identity. The owner's private history survives JSON restoration and
later Nexus discard recycling. Focused Basic/Advanced, four-profile AI,
rejection, spectator projection and concurrent saved-room cases are in
[the inquiry tests](../tests/nexus-ecaz-inquiry.test.ts). Full Nexus and
combined-mode acceptance remain gated.
