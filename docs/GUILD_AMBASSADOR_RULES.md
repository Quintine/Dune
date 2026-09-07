# Guild Ambassador rules and implementation boundary

Primary-source review, 7 September 2026. This is a source contract, not an implementation or a claim of complete expansion compliance. Read alongside [runtime readiness](GUILD_AMBASSADOR_RUNTIME_READINESS.md).

## Authority and the independent grant

E3 pp.7–8 gives Ecaz the optional trigger and lets Ecaz assign its benefit to its ally. The benefit sends up to four beneficiary-owned reserve forces to a clear territory, free. The physical Guild marker excludes a Guild entrant; an entrant is not the beneficiary. The BG marker copies effects, so distinguish its physical identity from its chosen effect. E3 p.15 expressly classifies the Guild effect as an immediate shipment, interrupting the entrant before its movement. Occupy permits the Ecaz pair to co-occupy and counts that pair as one faction. E3 p.16's Ambassador Karama entry prevents placement, not an already-triggered effect. [Official E3](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

Implementation consequence: use an independent reserve-shipment intent. Preserve the original entrant's continuation and the beneficiary's ordinary shipment/movement allowances. Do not impersonate an ordinary active turn. Assigning the effect does not transfer ownership of reserves. A Guild beneficiary receives this bounded reserve shipment; its normal cross-shipment, return and timing advantages do not replace that grant.

## Costs, physical selection and destinations

Base pp.9,19 normally charge for shipment and direct other factions' payments to Guild; Guild gets its stated discounted transport. For this explicitly free grant, quote zero: no payer, ally pledge, Guild income or bank payment. Discounts cannot produce income, and a retained free-shipment card need not be consumed. The cap counts physical tokens, including selected elite tokens, rather than their battle strength. Keep each selected typed pool conserved. Base destination-sector and stronghold-capacity rules still apply, composed with Occupy. [Official base rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

E1 p.9 specifically prohibits other factions from shipping directly into the Ixian Hidden Mobile Stronghold. Thus only an Ixian beneficiary can use its own HMS as this shipment destination. The rule permitting entry from the pointing territory is movement permission, not shipment permission. HMS itself is sheltered; do not move its marker. [Official E1](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf)

E3 homeworlds are reserve locations but are explicitly not territories; this grant does not authorize a homeworld destination. Revealed Discovery locations, conversely, are expressly territories. Those optional modules require their actual component rules and board representation; do not treat an arbitrary off-board location as a destination. Moritani's Atomics aftermath forbids shipment into its territory. [Official E3, pp.5,9–10,12–13](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

## Fremen, storm and phase-dependent consequences

The November FAQ p.5 explicitly classifies classic Fremen reserves as one on-planet, off-board territory. The Ambassador's unrestricted destination grant therefore supports Fremen reserve entry outside its ordinary Great Flat radius; it does not turn those reserves into off-planet forces. Do not grant the ordinary Fremen storm-loss exception: this effect explicitly excludes storm. A clear sector remains usable in a partly covered territory. [November 2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)

The same FAQ p.3 restricts Guild's special Karama to Shipment and Movement. In that phase, an off-planet Ambassador shipment meets the base prevention description. A post-Nexus worm arrival can trigger this shipment in Spice Blow; it must not create an out-of-phase Guild special-power opportunity. Classic Fremen reserve entry is not off-planet in either phase. The optional Fremen Homeworld card was not retrieved as a readable official face: no source here establishes that enabling Homeworlds changes the Fremen classification. Preserve that module boundary. [November FAQ, pp.3,5](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)

## BG and technology

Base p.18 grants Spiritual Advisors when another faction ships from off-planet, without an ordinary-turn qualifier. Consequently the extra shipment can invite BG accompaniment, including in the worm-parent case; Fremen's on-planet entry cannot. A BG beneficiary does not accompany itself. E3 p.15 expressly preserves accompaniment and Intrusion between allied BG and Ecaz. [Base, p.18](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), [E3, p.15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

Use November's same-territory stance rule: direct shipment can join existing advisors; otherwise normal direct-shipment fighter rules apply. Accompaniment locks remain relevant. April's conflicting wording is superseded. [November FAQ, p.4](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)

E1 p.5 makes Heighliner income depend on off-planet shipment, not payment. In Shipment and Movement, a completed non-Guild off-planet shipment qualifies; a stopped intent does not. Apply the token's phase and once-per-phase limit, and collect its accrued income at phase end. Guild-only shipments do not qualify, but a separate successful BG accompaniment makes BG another shipper. Fremen entry and a phase-one shipment do not qualify. Preserve existing token ownership rather than immediately crediting the beneficiary. [Official E1, p.5](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf)

## No-Field and other boundaries

E2 p.6 allows a No-Field substitution for shipment, paying for one force. Its FAQ treats the unrevealed marker as one force even at value zero; allied use reveals immediately. The FAQ also requires allied shipment payment and confirms Heighliner activation except for a Guild beneficiary. These settle ordinary substitution, not its combination with this later free, four-force grant. Do not silently choose whether a value-five marker fits the cap or whether the allied fee survives. Physical reserve shipment is independently implementable while substitution remains explicit and gated. [Official E2, pp.6,10–11](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

CHOAM's Baliset prohibits movement into its forces, expressly allowing shipment normally; do not apply that movement restriction here. Other Worthless effects retain their own timing and effect, with no new payment generated by this free shipment. [Official E2, p.7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

Remaining material boundaries for the coordinator:

- **No-Field:** whether substitution is permitted, what the cap measures, and whether allied payment remains mandatory. No direct publisher combination ruling was found.
- **Optional Nexus cards/Homeworld modifiers:** a readable Guild Nexus face and applicable Homeworld faces were not established here. A Nexus event is not a Nexus card; do not invent a generic Nexus shipping modifier.
- **Arrival ordering:** retain the existing unresolved simultaneous Terror/foreign-BG-Intrusion boundary. Resolve supported child arrivals before resuming the original entrant, without replaying its shipment.
- **Zero/unavailable selection:** the wording supplies an upper bound but no explicit failure procedure. Reusing the documented unavailable-effect policy is an implementation interpretation, not a newly discovered FAQ. Do not invent a second purchase-style consent step.

## Verification limits

Official URLs were freshly searched. Direct PDF opening returned HTTP 403; indexed official extracts corroborated readable local publisher-authored mirrors under `/tmp/dune-rules/` (`ecaz-audit.txt`, `base.txt`, `ix-official-mirror.txt`, `choam-lelekan-mirror.txt`). No fan or tournament rule was used to settle a conflict. No runtime or tests were changed or executed for this research.
