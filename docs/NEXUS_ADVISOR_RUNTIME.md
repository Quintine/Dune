# Bene Gesserit Nexus advisor conversion

10 September 2026. This checkpoint implements the native **Cunning** stance conversion described in [NEXUS_BENE_GESSERIT_RULES.md](NEXUS_BENE_GESSERIT_RULES.md). It extends the [Nexus lifecycle](NEXUS_CARD_RUNTIME.md); it does not implement borrowed Voice or Betrayal, settle the outstanding source questions, or open incomplete mode and expansion starts.

## Selection and physical result

During its own active Shipment and Movement action in Advanced play, an unallied Bene Gesserit holder can select a nonempty set of eligible advisor territories. Every advisor in each selected territory becomes a fighter together, across all sectors. Positions, physical counts, spice, shipment usage and movement usage stay unchanged. The choice cannot target individual counters or leave mixed stances within a territory.

The private server quote supplies each territory's total count and blocked reason. The controls begin with no selection, offer individual checkboxes and **Select all available**, and require one explicit submission. A blocked group cannot be included through the shared options helper. Fresh accompanied advisors and storm-related conversions retain explicit pending-ruling explanations; these guards are not presented as independently verified printed prohibitions. Stronghold capacity, allied presence, public No-Field presence and existing territorial restrictions remain in force. Homeworlds are not advisor territories.

## One cancellation window

Declaring the set spends the single physical Nexus card and opens the ordinary Karama response for this native advantage. The territory set is now public. Allowing the response converts the complete set; cancellation leaves every selected group as advisors while the Nexus card remains spent. No individual territory gets a separate play or cancellation window.

The event-bound record retains original groups, turn, owner, the active Shipment and Movement action and pending/completed/canceled outcome. Validation binds the original response, including nested cancellation/discard continuations, before settlement. Refreshing or retrying does not spend another card or replay the flip. Canonical signatures detect inconsistent saved fields; they are not cryptographic authentication against a fully rewritten save.

Other responses, owned decisions, Truthtrance, phase opening, closing Nexus draws and unfinished card transactions must finish before declaration. The table names the response and shows the declared territory names, with standard **Allow this power** and **Cancel with Karama** controls. The internal event is not printed as a player instruction.

## Bots, privacy and evidence

All four profiles use the same authorized choices. The policy selects legal groups whose advisor count exceeds the total public opposing fighter presence, preserving peaceful or apparently unfavorable groups. It does not read opposing hands, spice, traitors or concealed No-Field values. Hard and Brutal opponents use their existing Karama policy against a declared conversion threatening their fighters; Easy and Medium retain the ordinary pass policy. This is bounded legal-policy integration, not new strategy calibration.

The focused consumer suites contain **eight** cases, including actual all-profile declaration/settlement, exact unchanged force/cost/usage checks, private pending projections, a public No-Field getter trap and the actual table's standard response actions. The final selection, including reference tests and the existing Ixian table controls, passed **23/23** with no title warnings. The table regression also exposed an existing SVG player-circle title formed from multiple React children; its title now uses one complete string so the accessible name renders correctly. Final verification passed types, lint, all **3,971 offline tests**, the production build and **40 HTTP/session tests**. This checkpoint adds **35** cases: ten pure quotes, eleven engine cases, eight consumer cases, three production SQLite recovery cases and three Nullentropy interruption cases.

Implementation: [source quote](../game/nexus-advisors.ts), [shared options](../game/nexus-advisor-options.ts), [controls](../components/nexus-advisors.tsx), [engine](../game/engine.ts), [bots](../game/bots.ts). Consumer evidence: [controls](../tests/nexus-advisor-controls.test.ts), [bot actions](../tests/nexus-advisor-bots.test.ts). Structural server rendering does not substitute for browser acceptance.

Fresh-advisor and storm permissions remain pending the existing user question. Borrowed Voice remains gated on its separate cancellation/timing interpretation, and Betrayal retains the existing private reaction-policy gate. Complete Bene Gesserit Nexus effects, complete module games and full expansion compliance remain unfinished.

## Integrated acceptance

Independent reviews found no additional runtime defect after the tested implementation. Actual Truthtrance and Harkonnen draw/return interruptions preserve the pending batch. Paid Nullentropy keeps its fee, restores the original advisor response after the private selection, and still allows either conversion or Karama cancellation. Missing or edited parent records reject reads, automatic continuation and actions without mutating the source. The SQLite cases exercise competing writes, lost responses, recreated room-store instances, private seat restoration and corruption rejection through production room code and migrations.

Two isolated three-seat browser rooms exercised the controls with actual server requests: `M2QGRHGS` completed Arrakeen and multi-sector Pasty Mesa conversion; `YT2ENZUP` canceled the same two-territory batch with Karama. Both finished at version 4. Desktop and 390-pixel phone selection, the explicit fresh-advisor block, public pending response, all six private seat refreshes and final restoration passed without browser errors or horizontal overflow. Visual inspection prompted the checkbox spacing and stale Nexus guidance fixes. No existing room was staged or repurposed.

The final database comparison preserved all **3,389** opening room versions and state hashes. The database now contains **3,421** rooms, adding only two named browser rooms and thirty isolated HTTP-test rooms. The running development server was reused; the previous controlled restart was about 00:45 UTC, so no hourly restart was due for this checkpoint. Saved games and the removed-automation preference remain preserved.

The native conversion has focused acceptance only. Full module games, placed Terror/Ambassador token combinations and the unresolved printed-rule interactions retain their separate completion requirements. The [Emperor source audit](NEXUS_EMPEROR_RULES.md) prepares the next effect family without claiming runtime support.
