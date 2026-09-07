# Ghola lifecycle, controls and AI

Integrated 7 September 2026. All four AI difficulties now make useful ordinary Ghola choices in open play windows, using authoritative private target options. Human controls use the same eligible leader, Kwisatz, force and elite choices. Ghola now clears Kwisatz Haderach's earlier battle location when reviving it, allowing a later territory's battle in the same turn. A shared-Duke identity guard rejects revival by non-Ecaz factions without spending their card.

## Source and actual defect

The publisher says Ghola can return a leader for another battle in the same turn. Kwisatz Haderach's faction rule says it is revived like another leader. Applying those rules together permits the revived Kwisatz in the later battle. This is a composition of those published rules, not a separately retrieved Kwisatz-specific Ghola FAQ example. [GF9 November 2020 FAQ, p.9](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=9), [GF9 base rules, Atreides faction sheet and p.22](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

The actual explosion path marks Kwisatz dead and then records its battle location. Previously `applyGholaEffect` made it alive while retaining that location; `validatePlan` consequently rejected its use in another territory. Ghola now removes this old `usedAt` value. Its revival cycle advances once as before; the accompanying native leader remains dead, and ordinary leader/force revival allowances and spice do not change.

**Correction to the initial investigation:** ordinary leader battle death already deleted `usedAt`. The genuine two-opponent Arrakeen prefix confirmed that fact. The corresponding new ordinary-leader test verifies compatible revival and subsequent Carthag use; it does not demonstrate a previously reachable ordinary-leader defect. Clearing `usedAt` directly during ordinary Ghola is also useful for a retained old saved marker, but that case is explicitly synthetic in the AI fixtures. The Kwisatz test produces its dead state through a real Lasgun–shield battle and demonstrates the changed behavior directly.

## Shared Duke boundary

`game/ecaz-duke-revival.ts` supplies a pure resolver for the existing canonical dead shared disc, detached identity/history receipt and printed normal price five. The optional price quote takes the caller's existing discount result and calculates three or five; it does not grant an entitlement, pay spice, revive a disc or choose a future controller. It checks one seated Ecaz, unique physical identity outside native rosters, valid death/custody history and unresolved exceptional custody. Its Advanced-Harkonnen restriction is the existing uniform development boundary, not a printed blanket rule.

The engine's actual Ghola handler, private options and finite battle-preparation candidates share the same eligible leader filter. Non-Ecaz actors cannot revive Duke even when a copied old save retains foreign temporary control. Captured, ghola, concealed, missing or duplicated Duke records never become usable by simply clearing their markers. All eleven other factions are tested. Existing admitted Ecaz-controlled dead saves retain their previous outcome; this release does not invent a new acquisition or post-revival destination.

Dead set-aside Duke remains unavailable for an actual Ghola or paid revival. The user interpretation question about post-revival active Ecaz versus set-aside custody is pending. The six-disc normal-cycle question also remains unresolved. [Production readiness](ECAZ_DUKE_REVIVAL_READINESS.md), [recovery contract](DUKE_REVIVAL_RECOVERY_READINESS.md) and [source interpretation audit](ECAZ_REVIVAL_RULES.md) record the remaining integration. No Advanced or expansion start gate was opened.

## Controls, privacy and policy

The owner-relative `ghola` projection exposes only eligible card IDs from that player's hand, eligible controlled leaders' ID/name/strength, the own Kwisatz choice, physical force and elite maxima, and a timing/availability explanation. A Ghola reserved in the owner's pending Black Market auction is excluded. Other players' hands, spice and traitors do not influence these choices. Exceptional Duke states are uniformly omitted rather than exposing private custody reasons.

The hand form uses those targets and rejects invalid quantities, unavailable leaders and impossible elite compositions before submission; the authoritative action remains the final validator. The Ghola card face now explains its full primary choice, free return to reserves and disposal, while the enlarged internal guide explains same-turn use, separate leader/Kwisatz returns, preparation commitments and recovery. Each actual Ghola logs its chosen return and unchanged normal allowance, plus one configurable automatic notice. The notice uses the existing 1.5-second queue; its transient visual duration was not separately measured in this slice.

The AI chooses a useful strong dead leader when its living pool is scarce or weaker, otherwise useful Kwisatz or a needed force group. It respects the projected elite allowance, including Ixian multiple-cyborg returns. Existing specific actions, ordinary revival actions, actual response/decision windows, active battles/auctions and positive shipment-preparation witnesses retain priority. Normal revival prevention alone does not block the independent card. All four profiles use only their own view; difficulty thresholds differ, but this change does not certify the overall AI strength ladder. Duke is explicitly excluded from foreign-ghola and negotiated early-revival candidate lists.

## Validation

**2,517 rules/client/component and 226 multiplayer tests pass: 2,743 total.** This slice adds nine shared-Duke identity/price tests, eight lifecycle/projection tests, 26 AI tests and two SQL recovery tests. Root reviewed all contributed code and tests. Independent review found no actionable timing, privacy or UI issue and passed 66 focused checks. The unrelated-card availability regression now uses Karama because Ghola has joined the shared timing validator.

Full logs: `/tmp/dune-ghola-rules-final.log` (69.71 seconds), `/tmp/dune-ghola-multiplayer-final.log` (31.08 seconds). Final typecheck, lint and production build pass in `/tmp/dune-ghola-{type,lint,build}-final.log`, including the final small reconnect map-focus fix.

The actual ordinary-leader journey begins from a conserved three-faction board, wins in Arrakeen to establish prior use, dies against a second opponent there, plays Ghola, then selects the same leader in Carthag. SQL runs this prefix through fresh production room modules and authenticated seats. Two concurrent Ghola submissions commit exactly once, with one physical discard, one notice and unchanged resources/death history/normal usage. Fresh views preserve private hands and the next sealed battle plan. A synthetic foreign-controlled dead Duke is rejected with zero SQL writes. The two new SQL fixtures use in-memory SQLite with production migrations and room code; they do not modify live browser rooms.

The actual Kwisatz journey starts from a conserved two-territory Advanced board with its prior activation threshold already met. A real Lasgun–shield battle kills it; actual Ghola clears its location and leaves its accompanying leader dead; a subsequent real Carthag plan accepts another living leader accompanied by Kwisatz. This is direct interaction coverage, not a complete Advanced game.

## Complete Basic games

The unchanged public-start Basic runner completed **20/20 games** across counts two through six and all four homogeneous difficulty levels, seed 20261018. It accepted **12,304 actions**, rejected none, had no stalls/exceptions/checked invariant failures, and exercised 550 JSON round trips. Recorded duration: 115.21 seconds. Its action trace includes **18 actual Ghola plays: 12 leader and six force returns**, distributed Easy one, Medium five, Hard six, Brutal six. This provides natural card-play coverage in addition to the focused tests; it does not establish full expansion support or relative AI strength.

Results: `/tmp/dune-ghola-fullgames-final.json`. All 90 measured source files were unchanged during and after the run; fingerprint `cf81e4a9ce3b2addcbf2ef091ebd22ace775a1dd2d35608ea308d6092e6104d2`, retained in `/tmp/dune-ghola-final-hashes.json`. The later component-only initial map selection does not alter the measured game sources.

## Browser and maintenance

The controlled 09:50 UTC maintenance backed up all 2,377 rooms and verified every version/state hash unchanged after restart. HTTP returned 200 and the existing isolated QA seat reconnected at v94 with its prior Ecaz result intact. The known human room remained idle at v14. The removed automation was not recreated.

The isolated QA room `8S3MRDEK` was then backed up and reused with the same two authenticated seat IDs. A conserved Advanced Atreides/Guild board and prior seven battle losses were staged; actual battle/preparation/traitor actions produced the Lasgun–shield death at v95. Browser controls displayed distinct dead-leader and Kwisatz choices and the complete Ghola face. Selecting Kwisatz and playing the card reached v96: no Ghola remains in hand, Kwisatz is alive with cycle two and no old location, the native leader remains dead, and spice/forces are unchanged.

A controlled actual Carthag battle selection/preparation reached v97. The browser chose Lady Jessica, checked the revived Kwisatz and sealed the plan at v98. Refresh preserves that sealed plan. Reconnecting during battle now initially focuses the actual battle territory on the map. These controlled setup/other-action steps are explicit; this is a focused desktop playtest, not a complete browser game or mobile acceptance. Broader component inspection and mobile journeys remain required.

Scripts: `/tmp/dune-stage-ghola-qa.ts` and `/tmp/dune-ghola-next-battle-qa.ts`. Private before/staged/revived/next-battle/sealed snapshots `/tmp/dune-ghola-qa-*.json` are mode 0600. At final preservation check, all 2,376 older non-QA room versions/hashes still matched the maintenance backup, with 2,407 total rooms after test fixtures and QA at v98. Development session 58467 remains running; the next hourly maintenance is due about 10:51 UTC during active development, subject to human-play safety.

The complete goal remains active: paid/set-aside Duke revival, native Ecaz cycles, remaining faction/module interactions, full component inventory, complete mode acceptance and AI calibration are unfinished.
