# Homeworld shipment runtime

9 September 2026. The [transport source update](HOMEWORLD_TRANSPORT_SOURCE_UPDATE.md) and [invasion audit](HOMEWORLD_INVASION_RULES.md) supply the source contract. Homeworld starts remain disabled pending complete transport, occupation, face effects and full-game acceptance.

## Connected behavior

World-to-world shipment now uses an actual engine action with explicit source pools and destination. Each ordinary faction pays one spice per physical counter, including Fremen; Guild pays half, rounding up. A shipment uses one source world, except Advanced Emperor may combine its native Kaitain and Salusa pools. Foreign garrisons stay separate from native reserves. Guild may return a foreign garrison to its own Homeworld through its explicit exception. Other ordinary own-world returns and allied destinations are rejected.

The action consumes ordinary shipment, preserves movement and checks Heighliners once, retaining the printed Guild exception. Homeworld arrivals have no planet sector, storm traversal, stronghold capacity, advisor accompaniment, Terror or Ambassador entry. Native and visiting armies feed the existing [Homeworld battle runtime](HOMEWORLD_BATTLE_RUNTIME.md), so actual invasion reaches battle discovery without staging foreign forces.

The shipper's invasion payment goes to the bank. November FAQ ally-contribution routing is separate: a non-Guild donor's share goes to Guild when present; Guild contributions go to the bank. Pledged and own funding are reserved during a pending declaration. Income is awarded only after payment and arrival, through the existing income response; it cannot fund the same shipment.

Advanced Guild special Karama can stop this interplanetary declaration, including a Fremen invasion. This is the documented source composition, not a new publisher worked example. No forces, payment or technology income move before resolution. The owned choice survives refresh and Box interruption. When Guild has no legal stop, allowance is automatic. The current stopped-shipment settlement retains the existing provisional no-payment interpretation; the previously recorded cancellation/refund questions remain unresolved.

Pending declarations bind the turn, actor, unused shipment, public custody, alliances, exact typed source receipts, price and pledge. Live and saved decision parents must match the event and destination. Rejected reads, actions and normalization preserve the input. Production room writes retain their existing compare-and-swap fence.

The prohibition on alliances with a faction occupying one's own Homeworld uses present foreign forces, independently of unresolved turn-benefit entitlements. Nexus, Ecaz Ambassador and Moritani alliance paths enforce it, and existing allied garrisons are rejected as invalid saved states. Controls and AI receive the same public restriction.

## Controls and AI

The table has typed native/foreign source selectors, combined Emperor selection, explicit costs, pledged contributions and a destination list. Guild gets actual allow/stop controls. All four AI profiles use the public quote, retain native defense, budget shipment and battle spice, select typed forces and consider reinforcement or native returns. They do not receive opponent hands or spice. These tactical policies do not certify relative AI strength or complete module games.

## Verification and limits

Forty new tests cover pure transport, actual engine actions, all-profile public policy, controls and production SQLite recovery. They include competing declarations, duplicate allowances, allowance versus special Karama, Box-suspended ownership, stale events, typed source corruption, conservation, all donor directions and actual invasion followed by battle discovery. Heighliner testing uses canonical staged token ownership after genuine faction setup because combined module setup remains gated.

Independent review found that a public automatic-continuation flag incorrectly disabled human controls while Guild could stop a shipment. A shared predicate now distinguishes that real choice from automatic allowance; three regressions cover it and detached recovery.

Final `npm run check` passes types, lint and **3,304 offline cases** (79.92 seconds for tests). Final production build passes. **40 HTTP cases** passed after engine/persistence integration and before the final UI label, heading and reference edits. `git diff --check` passes.

An isolated three-seat QA room used genuine Advanced Homeworld setup with a staged Shipment phase and a physically held Guild Karama. Actual desktop controls selected three normal forces from Kaitain plus two Sardaukar from Salusa for Caladan, quoting five spice. Before allowance, all forces and spice stayed at their original sources. An independent authenticated Guild seat on 390×844 phone had enabled Allow and Stop controls, survived refresh and allowed using the keyboard. The Emperor then had 12 normal counters on Kaitain, three Sardaukar on Salusa, the exact five-counter foreign army on Caladan and five spice remaining. Shipment was used, movement remained available, Guild retained its card and received no shipper income. Refresh preserved that result. No page errors or horizontal page overflow were observed. Visual inspection covered desktop source selection, phone Guild controls and the settled phone table; it exposed a generic battle heading on the shipment decision, now corrected. Explicit accessible select names were also added.

Read-only comparison after the browser and HTTP tests found all **2,740** pre-existing room versions/hashes unchanged; 2,771 rooms are stored including the new test rooms. The existing server was reused. This browser check verifies declaration/allowance and restoration, not a complete Homeworld game or every interception branch; those other focused branches have engine/SQLite evidence.

Remaining transport includes Arrakis-to-Homeworld routes, Junction offers and their payment composition, generic purchased Karama destination scope, unsponsored foreign departures to Arrakis, concealed No-Fields and ordinary Guild rate-cancellation timing. Occupation qualification/rewards, remaining Homeworld faces, victory and complete module games remain unfinished. This checkpoint does not open a start gate, publish the site or reinstall maintenance automation.
