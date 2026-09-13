# Smuggler and Richese No-Field prototype

13 September 2026. **Prototyped**, with **Partial** rules coverage. This connects
one owned Richese No-Field shipment with Leader Skills in the CHOAM & Richese
development setup. Public expansion/module starts and publication remain gated.

## Source and physical contract

The [publisher CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf),
page 12, explicitly allows Richese to accompany its No-Field with the free
Smuggler force when entering an empty territory. This resolves the combination
without a new user ruling. The local source archive preserves the publisher PDF;
the original URL returned HTTP 403 during this follow-up.

The marker remains a shipment of one at its ordinary price. One separate actual
reserve force arrives alongside it for free. The hidden token keeps its value
of zero, three or five. Revealing it later adds at most that many of the reserves
then available; it does not withdraw or recreate the companion again. A zero
token can therefore accompany one real force. Without a reserve force, ordinary
No-Field shipping remains available but the Smuggler option does not.

As in [ordinary Smuggler shipping](SMUGGLER_SHIPMENT.md), eligibility requires a
living native face-up trainer and a wholly empty destination territory before
arrival. Existing friendly/enemy forces, advisors and No-Field presence count.
The checkbox is optional and starts unchecked. Omission or false preserves the
ordinary concealed-marker shipment. Guild pricing, recipient income and ally
funding use the unchanged one-marker cost.

## Connected paths

A shared public-custody quote drives validation, the private No-Field panel and
all four AI profiles. Public views display the real companion and concealed
marker separately; neither the token identity nor the internal saved proof is
disclosed to opponents. Bots can reveal a zero-valued marker before moving when
their real force is alongside it, using the existing voluntary reveal action.

New owned No-Field declarations in Leader Skills games bind the chosen token,
event, optional companion and payment to exactly one initial cancellation window
or later Advanced Guild decision, including saved card interruptions. JSON/SQLite
continuation revalidates that original declaration before action or projection.
Initial Karama cancellation preserves reserves, payment, marker history and the
ordinary shipment opportunity. The later Guild stop likewise transfers no
companion; it retains the existing consumed-opportunity behavior. Malformed or
stale declarations reject without mutating their input.

Genuine development setup now accepts the single CHOAM & Richese expansion with
Leader Skills. Page 4 adds Poison Tooth and Artillery Strike when Ix is absent,
or replaces those two when Ix is included. Deck assembly reuses their existing
physical IDs and implemented updated effects, and retains two Karama cards.
This deck prerequisite does not certify every CHOAM/Richese skill interaction.
Other audit initializers retain their existing CHOAM combination gate.

## Evidence and remaining work

Focused tests cover all token values, scarce reserves, prices, optional decline,
private projections, both pending stages, initial cancellation, saved corruption,
all four bots and physical conservation. Independent recovery review and broad
checkpoint evidence are recorded with the commit. Browser acceptance uses a
fresh genuine setup and an explicitly staged shipment boundary; other saved
games remain untouched. Targeted scenarios establish this effect, not complete
expansion acceptance or calibrated AI strategy.

Two genuine four-profile Basic/Advanced samples finished with 77/116 accepted
actions, 3/4 JSON restorations and no rejected candidates. The Advanced sample
used one companion shipment and later revealed its token; the Basic sample did
not use the new effect. Physical force and skill-card custody remained valid.

A new browser room assigned the genuinely offered Smuggler to Ein Calimar.
After a documented shipment-boundary fixture, the human chose token five and
enabled the unchecked companion option. One spice paid for a marker and one
real force; refresh restored nineteen reserves. Voluntary reveal produced six
real forces and fourteen reserves. Four spice, Crysknife and the Soo-Soo Sook
traitor remained unchanged through the final refresh.

Allied No-Field Smuggler composition, Homeworlds, Nexus, Discoveries, Stronghold
Cards, Tech Tokens and other combined modes remain outside this prototype.
Smuggler battle collection still needs its recorded reveal/survival settlement.
The existing [Leader Skills material questions](LEADER_SKILLS_RULES.md#material-boundaries-not-settled-by-the-sources)
remain pending.
