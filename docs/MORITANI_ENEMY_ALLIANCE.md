# Moritani: Enemy of My Enemy

Bounded primary-source review, 2026-09-06. This document covers the alliance branch of an existing Terror entry, not certification of all Terror effects or simultaneous arrival timing.

## Confirmed rules

Before revealing a triggered token, Moritani may offer the entrant an alliance, except when that entrant is Ecaz. Acceptance immediately allies them, breaks either participant’s existing alliance, and returns the token to supply without revealing it. Refusal requires revelation; the optional decline of an ordinary Terror trigger is no longer available. The Moritani Karama table prevents alliance formation while leaving revelation available. It does not identify a separate acceptance/reaction sequence. [GF9 Ecaz & Moritani, printed pp. 6, 16](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

Thus prior partners do not veto acceptance, and ordinary Nexus timing does not restrict this express special power. An existing Moritani ally does not trigger Terror in the first place. Homeworld-enabled games have an additional explicit restriction: a faction cannot ally with a faction occupying its homeworld. That module remains gated. [GF9 Ecaz & Moritani, printed pp. 5, 10](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

Alliances are public, mutual pairs. Allies cannot subsequently enter an ally-occupied territory except Polar Sink. However, the base rule expressly gives factions that became allies in the previous turn and still share territory until the next Shipment and Movement phase to separate. If the earlier mover stays, the later mover must leave or lose its forces there. There is no immediate eviction or battle on formation. This is a base rule, not an advanced-only rule. [GF9 base rulebook, printed p. 12](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

Sandtrout cancels alliances existing when drawn and suppresses the next Shai-Hulud Nexus. Its FAQ states no continuing ban on new alliances. Enemy of My Enemy therefore remains available while Sandtrout awaits that worm; accepting neither clears Sandtrout nor creates a Nexus. This is composition of the two rules, not a retrieved paired FAQ. [GF9 Ixians & Tleilaxu, printed p. 11](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf)

## Karama timing boundary

No retrieved official FAQ or written designer clarification specifies whether players must cancel before the entrant answers or may wait for acceptance. The publisher’s p. 16 table establishes the canceled result, but not that information boundary. A standard declaration → Karama response → entrant answer sequence is compatible with stopping a declared power before execution; it must be described as an implementation ordering choice, not a quoted specialized ruling. A cancellation before any answer should not be misrepresented as the entrant refusing. Reopening the same canceled offer indefinitely would defeat cancellation; retaining a per-entry blocked marker is an implementation safeguard.

If the product promises complete compliance for this precise timing, keep that verification limitation explicit until an authoritative clarification or user-approved interpretation resolves it. This review does not assign priority among Terror and other simultaneous arrival reactions.

## Concrete engine integration findings

- `applyAction`’s ordinary `alliance` branch requires a Nexus and both participants to be unallied. Enemy needs its own atomic transition: clear both old reciprocal links, set the new pair, remove stale ordinary offers, and refund only unspent aid attached to broken pairs. Already paid shipment costs and already settled arrival effects must not be replayed or refunded.
- `endMovement` previously destroyed co-occupying allied forces when the ally had already finished moving, which would be wrong for a new phase-5 alliance. The integration now records `allySinceTurn` on both partners and exempts a mutual pair only when both stamps match this turn. The next turn and missing legacy stamps retain departure enforcement. Subsequent ally-entry validation remains active.
- Acceptance must move this exact pending token from its placed location to hidden supply once, then run the existing entry continuation once. Do not reveal its kind in the response, public log, former-partner views, or errors.
- Refusal must atomically enter the existing reveal/effect path; there must be no second optional reveal decision or random selection before refusal commits. Preserve owner choices within Robbery/Sabotage/Sneak Attack after mandatory revelation.
- While some forced effects remain unsupported, reject an offer before announcing it when refusal could not resolve. This is a temporary implementation gate, not an additional board-game restriction. Check exceptional leader pools and other existing effect guards too. Keep the public opportunity independent of the hidden token face.
- Persist the suspended entry, responder and cancellation state through JSON reloads and nested Worthless-Karama conversion. Ordinary alliance actions must not bypass that pending reply. Acceptance while a worm ride is suspended must resume its existing Nexus/ride continuation, not manufacture a new one.

## Evidence limits and validation

Compared local publisher-authored extracts `/tmp/dune-rules/ecaz-audit.txt`, `base.txt` and `ix-official-mirror.txt` against indexed official GF9 passages for the relevant pages. Targeted official and designer searches found no additional Enemy-specific timing answer; this is a retrieval limit, not proof none exists. Direct PDF access has previously returned 403, and crawler publication estimates are not revision dates. Inspected current alliance, aid, Sandtrout, entry validation and end-movement code read-only. No runtime tests or live-room mutations were performed for this document.

## Landed integration review

Read-only review of the new `terrorAllianceBlocked`, `formTerrorAlliance`, alliance stages in `decideTerror`, `moritaniAlliance` response completion, and owner-only projection found no further material defect. Existing former partners are detached symmetrically, only affected unspent aid is refunded, and stale offers involving either new partner are removed. Acceptance calls the pure token-return helper, which rotates available-token identities and privately shuffles supply; other placed tokens retain their identities. Refusal invokes the existing effect path within the same cloned action. The pre-reply Karama window is recorded above as general declaration/power-window composition, not a dedicated publisher FAQ. Aggregate behavioral tests are owned by the parent and other test agent.

## Integrated verification

Fifteen named tests cover response/reply ownership, differing-secret public-view equivalence, both old alliances and escrow refunds, mandatory refusal effects, real/nested Worthless Karama cancellation, exact return custody, worm continuation, stale metadata, same-turn grace and next-turn co-occupation losses. All four AI profiles complete five representative stages through JSON reloads using their private projections. Aggregate873-unit suite,45 persisted/API suite, typecheck, lint and build pass.

A user clarification for the exact pre-reply Karama ordering is pending. The current flow remains an isolated tested draft behind the existing full-expansion start gate, not a claim that this timing has a specialized official ruling.
