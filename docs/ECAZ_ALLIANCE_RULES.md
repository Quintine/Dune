# Ecaz Ambassador alliance and Duke control

Primary-source audit, 9 September 2026. Scope: the reusable Ecaz Ambassador’s alliance alternative and subsequent optional Duke transfer. No runtime changes. [Direct acquisition](ECAZ_DUKE_ACQUISITION.md) is already implemented; [Duke lifecycle](DUKE_VIDAL_RULES.md) records separate unresolved custody and revival combinations.

## Source contract

The publisher’s [E3 rulebook pp.7–9](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=7), checked against `/tmp/dune-rules/ecaz-audit.txt`, establishes:

- Ecaz chooses whether to trigger an eligible entry. Advisors, its existing ally and the matching faction cannot trigger the token.
- Direct Duke acquisition and alliance formation are alternatives. Alliance requires “if neither of you are allied and they agree to form an alliance”.
- After that alliance, Ecaz may give the new partner Duke control “for this turn”. This is optional and is not permission for arbitrary standing allied transfers.
- The reusable Ecaz token returns to available supply. It is not one of the five random tokens whose exhaustion replenishes the cohort.
- Ecaz’s acquired Duke lasts until battle use or Moritani takeover. Moritani has one-battle tenure and can qualify again on a later turn.

E3 p.6’s Moritani alliance power is different: it expressly breaks existing alliances. Do not import that permission into the Ecaz token. The Moritani power’s exclusion of Ecaz is also not a prohibition on an unallied Moritani accepting Ecaz’s offer.

## Entry, consent and token commitment

Recommended direct composition of the printed trigger and consent rules:

| Point                           | Authoritative result                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ecaz declines to trigger        | Leave the placed token and Duke unchanged; resume entry.                                                                                                       |
| Ecaz chooses direct acquisition | Apply that separately validated effect; no alliance offer follows automatically.                                                                               |
| Ecaz chooses alliance           | Commit this trigger and return the reusable token to supply; record the entrant-owned consent decision. Do not acquire Duke merely because the offer was made. |
| Entrant refuses                 | Neither alliance nor Duke control changes. Resume the original entry.                                                                                          |
| Entrant accepts                 | Establish the reciprocal alliance, then resolve Ecaz’s optional Duke-control choice if available, then resume entry.                                           |

The token-return sentence is not conditioned on successful consent. There is no retrieved refusal exception restoring the token to its former stronghold, reopening the direct-acquisition choice or refunding placement. Returning the token when the offer is declared follows the existing trigger/commit model; it must remain returned through a saved pending reply. This is a composition of the general trigger and specific return instructions, not a separate publisher worked example.

Consent is needed from the actual entering faction; Ecaz cannot answer for it. Both parties must still be unallied at commitment. This branch grants no new Nexus, phase transition or extra movement. Preserve the triggering movement, worm ride or nested arrival’s continuation. The alliance is immediate rather than deferred to the next Nexus; subsequent effects must consult the new relation without replaying the completed arrival.

**Duke availability is not an alliance prerequisite.** The alternative can form an alliance while Duke is dead, elsewhere, concealed or otherwise unavailable. Such states may remove the optional transfer choice, but must not expose private custody through the availability of the alliance itself. A successful alliance with no loan leaves the shared disc exactly where it was.

## Existing alliance rules that still apply

[Base p.12](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=12) requires public alliances, limits each player to one partner and grants only the stated shared advantages. Acceptance should announce both factions, update both links together and invalidate superseded offers. It does not transfer hands, expose private spice or change other players’ alliances. Ordinary breakup remains a Nexus action unless another specific power permits it. Ecaz Occupy subsequently handles legal co-occupation; formation does not merge physical force owners.

**Bene Gesserit:** a fighter can be the eligible entrant; an advisor cannot. An alliance does not flip its other advisors, unlock a current-turn stance restriction, reveal/reset prediction or transfer prediction ownership. Base p.18 keeps prediction secret and permits it to win against an allied faction too. Shared occupation and the new three-stronghold win must retain that existing prediction precedence. [Base p.18](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=18)

**Fremen:** an eligible worm-riding entrant can consent through the same interruption. No alliance-specific territorial exclusion is printed for this choice. Formation does not itself replay a worm, refund losses or create another ride. Keep established Fremen alliance protection and victory predicates separate; this task does not settle the previously identified Fremen victory combinations.

**No-Field and optional modules:** an unrevealed marker remains a force under [E2 p.10](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=10), so do not inspect its hidden value to determine faction consent. If the Nexus-card module is enabled, E3 p.10 requires a held Nexus card to be discarded before entering an alliance; that is a real future integration obligation, not permission to turn on the unfinished module. Homeworlds are not ordinary Ambassador destinations.

## Duke transfer: established limits and genuine gaps

The transfer must use the existing unique Ecaz-identity disc, preserving death history and `usedAt`. It does not manufacture a native sixth leader or a Traitor card. Dead Duke cannot be made playable through an alliance; revival remains separate. The printed grant is a time-limited control transfer, not a change of native faction.

Moritani’s p.6 acquisition can take Duke from a current controller when its own end-of-movement conditions are met. A normal living loan therefore cannot silently immunize Duke against that later power. A takeover must supersede the earlier loan receipt so its later expiry cannot steal Duke back from the new controller. Captured/concealed and ghola combinations retain the existing material custody boundary.

| Unresolved point                | Why it changes actual play                                                                                                                                                                                                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Origin of the optional transfer | The alliance sentence does not explicitly require prior Ecaz control, nor does it say the alliance alternative first acquires an available set-aside or Moritani-held Duke. Requiring prior control and permitting direct assignment produce different available choices. |
| Unused loan expiry              | The turn limit ends the ally’s permission, but the paragraph names neither Ecaz nor the set-aside pool as the destination. Returning to a previous controller is a third, distinct policy.                                                                                |
| Battle use during the loan      | Ecaz and Moritani have explicit battle-use tenure. The ally clause states a turn duration; it does not expressly settle whether loan use consumes Duke’s temporary tenure or only follows ordinary same-territory leader-use restrictions.                                |
| Alliance broken during the loan | Its permission is created by acceptance, but the text does not explicitly say whether a subsequent legal breakup terminates that permission immediately.                                                                                                                  |

These are the existing loan/custody questions, not newly asserted prohibitions. They should be resolved together as a coherent loan lifecycle before activating transfer. Preserve the previous unresolved revival and Harkonnen capture rulings; nothing about a consensual alliance decides them.

## Cancellation and implementation boundary

The E3 p.16 Ambassador row prevents placement for the turn; it does not list cancellation of an already triggered alliance effect. Its separate Moritani Enemy of My Enemy row is not an Ecaz response. Do not add a generic cancellation window merely because the new decision forms an alliance. Existing printed/BG conversion machinery remains relevant only to an actually specified cancelable opportunity.

The substantial implementable branch is the complete reusable-token consent lifecycle across genuine arrivals: owner choice, token return, entrant acceptance/refusal, immediate public reciprocal alliance, private-safe descriptors, saved continuation and all AI profiles. Preserve pending consent through disconnects and reject duplicate/stale replies before any token or alliance mutation. Tests should cover either participant already allied, a valid Moritani partner, BG fighter versus advisor, Fremen worm entry, unavailable Duke with successful no-loan alliance, refusal, and subsequent Occupy movement/collection/victory. Optional Duke control needs the explicit lifecycle ruling above; exposing it with an invented expiry would not complete the feature.

## Fresh clarification search and provenance limits

Official GF9 indexed p.9 was retrieved again and agrees with the local Duke paragraph. [Future Pastimes’ expansion page](https://futurepastimes.com/dune-ecaz-moritani) corroborates the faction’s alliance purpose but supplies no loan endpoint. Public metadata verifies Jack Reda – Future Pastimes Games as the author of [Alliance antics with Ecaz and Moritani](https://www.youtube.com/watch?v=jSiGgD2k3sI); the caption request returned no transcript, so this audit attributes no spoken ruling to it. The indexed [Duke Vidal recap](https://boardgamegeek.com/thread/3626139/duke-vidal-recap) returned only a title/loading shell. No retrievable, author-verified designer answer resolved the loan cases. Community summaries, search snippets without author boundaries and the known misattributed Occupy-rounding comment were not used as errata.
