# Bene Gesserit Nexus advisor conversion

Original10 September2026 checkpoint with dated follow-ups below. Native **Cunning** stance conversion uses [the source contract](NEXUS_BENE_GESSERIT_RULES.md) and [Nexus lifecycle](NEXUS_CARD_RUNTIME.md). Borrowed Voice and native Betrayal have separate later bounded paths; none opens incomplete modes or expansion starts.

## Selection and physical result

During its own active Shipment and Movement action in Advanced play, an unallied Bene Gesserit holder can select a nonempty set of eligible advisor territories. Every advisor in each selected territory becomes a fighter together, across all sectors. Positions, physical counts, spice, shipment usage and movement usage stay unchanged. The choice cannot target individual counters or leave mixed stances within a territory.

The private server quote supplies each territory's count and authoritative capacity/alliance reason. Controls begin empty, offer individual checkboxes and **Select all available**, and require one submission. Under the explicit recommended card-exception prototype below, fresh accompanied and storm-related groups may convert in place. Ordinary flip, movement, casualties and battle rules remain; Homeworlds are not advisor territories.

## One cancellation window

Declaring the set spends the single physical Nexus card and opens the ordinary Karama response for this native advantage. The territory set is now public. Allowing the response converts the complete set; cancellation leaves every selected group as advisors while the Nexus card remains spent. No individual territory gets a separate play or cancellation window.

The event-bound record retains original groups, turn, owner, the active Shipment and Movement action and pending/completed/canceled outcome. Validation binds the original response, including nested cancellation/discard continuations, before settlement. Refreshing or retrying does not spend another card or replay the flip. Canonical signatures detect inconsistent saved fields; they are not cryptographic authentication against a fully rewritten save.

Other responses, owned decisions, Truthtrance, phase opening, closing Nexus draws and unfinished card transactions must finish before declaration. The table names the response and shows the declared territory names, with standard **Allow this power** and **Cancel with Karama** controls. The internal event is not printed as a player instruction.

## Bots, privacy and original checkpoint evidence

All four profiles use the same authorized choices. The policy selects legal groups whose advisor count exceeds the total public opposing fighter presence, preserving peaceful or apparently unfavorable groups. It does not read opposing hands, spice, traitors or concealed No-Field values. Hard and Brutal opponents use their existing Karama policy against a declared conversion threatening their fighters; Easy and Medium retain the ordinary pass policy. This is bounded legal-policy integration, not new strategy calibration.

The focused consumer suites contain **eight** cases, including actual all-profile declaration/settlement, exact unchanged force/cost/usage checks, private pending projections, a public No-Field getter trap and the actual table's standard response actions. The final selection, including reference tests and the existing Ixian table controls, passed **23/23** with no title warnings. The table regression also exposed an existing SVG player-circle title formed from multiple React children; its title now uses one complete string so the accessible name renders correctly. Final verification passed types, lint, all **3,971 offline tests**, the production build and **40 HTTP/session tests**. This checkpoint adds **35** cases: ten pure quotes, eleven engine cases, eight consumer cases, three production SQLite recovery cases and three Nullentropy interruption cases.

Implementation: [source quote](../game/nexus-advisors.ts), [shared options](../game/nexus-advisor-options.ts), [controls](../components/nexus-advisors.tsx), [engine](../game/engine.ts), [bots](../game/bots.ts). Consumer evidence: [controls](../tests/nexus-advisor-controls.test.ts), [bot actions](../tests/nexus-advisor-bots.test.ts). Structural server rendering does not substitute for browser acceptance.

The dated source/interpretation boundaries remain explicit. Fresh/storm card conversion and borrowed Voice now have recommended prototypes, not publisher answers; native Betrayal has its own uniform reaction. Complete BG Nexus effects, module games, full expansion and release acceptance remain unfinished.

## Integrated acceptance

Independent reviews found no additional runtime defect after the tested implementation. Actual Truthtrance and Harkonnen draw/return interruptions preserve the pending batch. Paid Nullentropy keeps its fee, restores the original advisor response after the private selection, and still allows either conversion or Karama cancellation. Missing or edited parent records reject reads, automatic continuation and actions without mutating the source. The SQLite cases exercise competing writes, lost responses, recreated room-store instances, private seat restoration and corruption rejection through production room code and migrations.

Two isolated three-seat browser rooms exercised the controls with actual server requests: `M2QGRHGS` completed Arrakeen and multi-sector Pasty Mesa conversion; `YT2ENZUP` canceled the same two-territory batch with Karama. Both finished at version 4. Desktop and 390-pixel phone selection, the explicit fresh-advisor block, public pending response, all six private seat refreshes and final restoration passed without browser errors or horizontal overflow. Visual inspection prompted the checkbox spacing and stale Nexus guidance fixes. No existing room was staged or repurposed.

The final database comparison preserved all **3,389** opening room versions and state hashes. The database now contains **3,421** rooms, adding only two named browser rooms and thirty isolated HTTP-test rooms. The running development server was reused; the previous controlled restart was about 00:45 UTC, so no hourly restart was due for this checkpoint. Saved games and the removed-automation preference remain preserved.

The native conversion has focused acceptance only. Full module games, placed Terror/Ambassador token combinations and the unresolved printed-rule interactions retain their separate completion requirements. The [Emperor source audit](NEXUS_EMPEROR_RULES.md) prepares the next effect family without claiming runtime support.

## Fresh and storm card-exception prototype — 14 October 2026

The [recommended source interpretation](NEXUS_BENE_GESSERIT_RULES.md#recommended-cunning-card-exceptions--14-october-2026)
removes only Cunning's earlier uncertainty gates. The now-dead storm-only
helper/imports are removed; counts use public presence without allocating
a receipt for each quote. Actual declarations retain exact original locations,
counts and locked stance. One original response still cancels the whole set.
No ordinary flip, arrival, movement, battle or casualty handler is changed.

Two disjoint native proof slices retain real setups, alliances and closing
card draws. Fresh Guild shipment plus free BG accompaniment/paid reinforcement
creates Shield Wall2 with lockedTurn2 on the actual BG turn. A real starting
Karama cancels selected old+new groups together. The same ordinary fighter
arrival rejected before Cunning works after allowed conversion.

Older native advisors survive the real Advanced storm-card producer, not
fabricated dials/phase/board state. Arrakeen2 is sheltered under storm10;
False Wall East5/9 rock groups remain separated by storm7. Native ordinary
flip and cross-storm movement stay blocked; original battle geometry remains
disconnected after the advisors become fighters. The fixture's setup-only
wrong Storm action was repaired by respecting playing status; native rules
and the Advanced card producer are unchanged.

Unresolved-guard, wording, action-copy and incidental phase/null tests were
deleted, not re-pinned. Existing actual rejection/custody tests remain; genuine
cases cover both interpretations, original batch cancellation, retry/actor/
event rejection, all four legal policies and native turn continuation.
The related10-file union65/65 passes.

Actual390px GameTable proofs: fresh selection→native allowance→one fighter
Shield Wall9→Imperial Basin9→Battle handover; storm-bound allowance keeps
Arrakeen2 in place; separated whole-batch Karama leaves both sectors advisors
and the Nexus spent. A real preexisting move-control defect was found: the
button offered Arrakeen10→Polar Sink during storm10, while authoritative
movement correctly rejected unchanged. Controls now share geometric route
distance/native range, including selected-origin elites and owned marker
routes; the blocked origin and cross-storm detour are disabled with an
accessible reason. No special Cunning or faction bypass is added.
Final compiler/lint/build pass. The native API observes fresh distance1/
range1, bound origin unreachable/range3 and separated distance2/range1;
ordinary geometry does not gain a storm battle. Owned QA service/scaffold
is removed and tabs are released/auto-closed. Receipts remain outside Git.
Three surfaces retain width/document390 and no browser errors. Wider
module/marker paths, saved assurance, calibrated AI and deployed acceptance
remain due.

