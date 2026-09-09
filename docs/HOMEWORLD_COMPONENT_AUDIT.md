# Homeworld component audit

Verified 9 September 2026. All 13 physical cards, both faces, have now been visually inspected. The tables below preserve the gameplay facts in original wording; they are not a transcription or a claim that the Homeworld module is implemented. Global module rules and unresolved compositions belong to [HOMEWORLD_RULES.md](HOMEWORLD_RULES.md).

## Sources and completeness

- **Publisher inventory:** [GF9 E3 rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed p.4, lists **13 Homeworld cards and 13 matching tokens**. There are 12 factions: Emperor has Kaitain and the Advanced-only Salusa Secundus. Local page `/tmp/dune-rules/ecaz-p4.png` was visually checked; the count is not on printed p.3.
- **Independent physical photograph:** [Jaakko/zaksalo, BGG image 7767034](https://boardgamegeek.com/image/7767034/dune-ecaz-and-moritani), posted 2 October 2023, shows all 13 high faces and matching tokens. Public metadata API `/api/images/7767034` supplied the original 3024×4032 photograph. Local inspection file: `/tmp/dune-rules/homeworld-bgg-high.jpg`.
- **Complete front/back face sheets:** [C4ESIUM, “Every Homeworld cards”](https://www.reddit.com/r/DuneBoardGame/comments/16w27x0/every_homeworld_cards/), 30 September 2023. Its public RSS feed supplied four direct physical-face images; all were visually read. These are third-party-hosted depictions of the original components, not authority from comment replies. Their production provenance cannot be established from the post alone. The independent BGG photograph corroborates every high face. No fan interpretations are adopted.
- **Designer corroboration:** [Jack Reda, Homeworlds Revealed](https://www.youtube.com/watch?v=4KZKz13wf9c), linked by [Future Pastimes](https://futurepastimes.com/dune-ecaz-moritani). Public preview sheets `/tmp/dune-rules/homeworld-story-0.jpg` through `-14.jpg` show selected enlarged original faces. Particularly useful: Caladan high around 8:55; Kaitain low around 1:50 and 3:00; Tupile low around 2:15; Junction occupied around 4:00; Tupile occupied around 4:35. Only visible text was used; the captions request returned empty and no unverified spoken statement is credited.

The complete sheets are `/tmp/dune-rules/homeworld-reddit-face0.png` (seven base high faces), `face1.png` (their reverses), `face2.png` (six expansion high faces), and `face3.png` (their reverses). These research images are not application assets or redistribution permission.

## Canonical physical manifest

Each row is **one two-sided card plus one matching world token**. High and low ranges are printed inclusive ranges, not an inferred universal flip algorithm. Battle numbers are native faction additions to its dial in battles on that world. The card prints the same number as its native losses from a Lasgun/Shield explosion. Occupied icons are counted separately from the occupied text.

| Proposed card ID | Printed name | Runtime faction | High reserves | Low reserves | High battle / explosion losses | Low battle / explosion losses | Occupied spice icons |
|---|---|---|---|---|---|---|---|
| `caladan` | Caladan | `atreides` | 6–20 | 0–5 | 2 | 2 | 2 |
| `giedi_prime` | Giedi Prime | `harkonnen` | 7–20 | 0–6 | 2 | 2 | 2 |
| `southern_hemisphere` | Southern Hemisphere | `fremen` | 3–20 | 0–2 | 2 | 2 | 2 |
| `junction` | Junction | `guild` | 5–20 | 0–4 | 2 | 2 | 2 |
| `wallach_ix` | Wallach IX | `beneGesserit` | 11–20 | 0–10 | 3 | 2 | 1 |
| `kaitain` | Kaitain | `emperor` | 5–20 | 0–4 | 2 | 3 | 2 |
| `salusa_secundus` | Salusa Secundus | `emperor` | **2–5 Sardaukar** | **0–2 Sardaukar** | 3 | 2 | 0 |
| `ix` | Ix | `ixians` | 5–20 | 0–4 | 2 | 2 | 2 |
| `tleilax` | Tleilax | `tleilaxu` | 9–20 | 0–8 | 2 | 2 | 2 |
| `tupile` | Tupile | `choam` | 11–20 | 0–10 | 2 | 2 | 2 |
| `richese` | Richese | `richese` | 10–20 | 0–9 | 2 | 2 | 1 |
| `ecaz` | Ecaz | `ecaz` | 7–20 | 0–6 | 2 | 2 | 2 |
| `grumman` | Grumman | `moritani` | 8–20 | 0–7 | 2 | 2 | 2 |

All ranges except Salusa name the faction's reserves, not a special force type. Do not substitute Arrakis for the Fremen card's printed name, Junction for CHOAM, or the Tleilaxu faction name for the world Tleilax. Card IDs above are implementation proposals, not printed identifiers; engine custody zones can have distinct stable IDs.

## Verified high-side effects

| Card | Gameplay facts |
|---|---|
| Caladan | After winning a battle, Atreides may add one reserve force to its battle territory or homeworld, provided Atreides already has a force there. |
| Giedi Prime | Harkonnen receives 2 bank spice when it collects spice from any desert territories or homeworlds during that turn's Spice Collection. |
| Southern Hemisphere | A revived starred Fedaykin force may immediately be placed in any territory already containing Fremen forces. |
| Junction | Guild may offer another faction cross-planet shipment, at half or full price, as part of that faction's Shipping action. This includes travel to or from homeworlds, including the shipper's own. |
| Wallach IX | When accompaniment to another faction's shipment sends spiritual advisors to Polar Sink, BG may send two. |
| Kaitain | At the end of Bidding, Emperor may pay 2 spice for each Treachery Card it chooses to discard from its hand. |
| Salusa Secundus | Sardaukar do not require spice support to count at full strength. |
| Ix | Paying to revive a Cyborg also grants two free Suboid revivals. |
| Tleilax | On taking Free Revival, Tleilaxu may send those forces from reserves, without shipping cost, to one territory or homeworld; storm and occupancy restrictions still apply. |
| Tupile | CHOAM cannot exchange Worthless Cards for spice, except through its Advanced Karama. This high side is a penalty. |
| Richese | Reserve forces may accompany a No-Field token shipment. |
| Ecaz | Each poison-weapon discard yields 3 bank spice. Its alliance also has a victory route: jointly occupy at least one stronghold and occupy two other factions' homeworlds. |
| Grumman | During Spice Collection, Moritani may either add a Terror token to a stronghold already holding one, or remove a Terror token from the board; it then receives 4 bank spice. |

These are source scopes, not completed adapters. For example, Giedi Prime's collection award is not automatically repeated for every pool; Kaitain's discard is a paid choice, and Tupile's exception does not erase its high-side restriction.

## Verified low-side effects

Every low face **except Salusa Secundus** also explicitly grants **one extra Free Revival and one extra CHOAM Charity spice from the bank**. The extra Charity is not a payment from the CHOAM player. Salusa prints neither bonus, corroborated by E3 p.10.

| Card | Additional low-side gameplay |
|---|---|
| Caladan | Atreides cannot use its Movement advantage to inspect the next Spice Blow. |
| Giedi Prime | No additional penalty. |
| Southern Hemisphere | No additional penalty. |
| Junction | Guild receives only the rounded-up half of shipping payments. |
| Wallach IX | BG cannot send spiritual advisors. |
| Kaitain | Emperor receives only the rounded-up half of Treachery Card payments. |
| Salusa Secundus | Sardaukar cannot be revived for free. |
| Ix | The Hidden Mobile Stronghold cannot be moved. |
| Tleilax | If Tleilaxu starts the Revival phase low, it receives no spice for other factions' Free Revival that phase. The start-of-phase condition is printed and requires a timing snapshot. |
| Tupile | Once per faction, when CHOAM is on another homeworld or another faction is on Tupile, CHOAM can require that faction to disclose its spice and the number of weapons or defenses it holds. |
| Richese | A No-Field token cannot be moved. |
| Ecaz | When Ecaz and its ally are both present for a battle against another faction, the opponent chooses which allied faction fights. |
| Grumman | A Terror token can be revealed only if at least three forces enter its territory. |

## Verified occupied-side effects

The occupied block is on the reverse alongside the low block; it does not replace the still-active low penalty. Printed yellow spice symbols are distinct from the income/payment-sharing instructions below. E3 p.10 assigns occupied Homeworld income to Spice Collection and the bank, and the source reviewer independently confirms each symbol represents one additional bank spice, separate from the text-dependent payment splits.

| Card | Occupied text gameplay |
|---|---|
| Caladan | The occupier shares Atreides' Bidding advantage. |
| Giedi Prime | When Harkonnen buys Treachery Cards, the occupier or its ally receives Harkonnen's extra free card if the recipient has hand room. |
| Southern Hemisphere | The occupier receives the rounded-down half of all spice collected by Fremen during Spice Collection. |
| Junction | The occupier receives the rounded-down other half of shipping payments made by other players. |
| Wallach IX | The occupier and its ally are immune to Voice. |
| Kaitain | The occupier receives the rounded-down other half of Treachery Card payments received by Emperor. |
| Salusa Secundus | Sardaukar lose their Sardaukar advantage. |
| Ix | The occupier controls the Ixian Bidding advantage. |
| Tleilax | Tleilaxu cannot reveal Face Dancers against the occupier or the occupier's ally. |
| Tupile | The occupier and its ally each gain one hand slot; they discard to their ordinary limits once they cease occupying Tupile. CHOAM loses its low-side advantage. |
| Richese | The occupier chooses the Richese Treachery Card offered during bidding and receives the rounded-down half of the payment received by Richese. |
| Ecaz | The occupier or its ally gains Duke Vidal and may revive him from the Tanks; this overrides the Ecaz/Moritani Duke advantage. |
| Grumman | Terror cannot be revealed when the occupier or its ally enters a territory holding a Terror token. |

## Source discrepancies and catalog boundary

1. **Caladan:** both independent physical-image sets and the designer's visible close-up print battle bonus 2 and explosion losses 2. The E3 p.10 example says high Caladan loses 3, while the actual rule delegates the value to the card. The coordinator/source reviewer therefore adopts the explicit face value **2** and records the inconsistent example; no missing card fact remains here.
2. **Salusa ranges overlap:** high 2–5 and low 0–2 are verified on the actual faces. Do not encode one threshold number or silently change low to 0–1. A stateful return-to-high interpretation is discussed by third-party commenters but was not independently verified from designer speech in this audit. The coordinator adopts the rulebook’s operative minimum-high rule: **2 is high**, treating the overlapping low endpoint as inconsistent printed data. Both ranges remain in the catalog; it does not implement this transition itself.
3. **Salusa counted reserves:** both faces name Sardaukar. The rules also permit Emperor movement between its two worlds. A future threshold evaluator must resolve what happens to normal forces transferred to Salusa without pretending the printed label is generic.
4. **Tupile information scope:** the designer close-up confirms CHOAM must be **on another homeworld**, or another faction must be on Tupile. An initial audit reading omitted the small word “on”; this was corrected through independent visual review. No planet-moving effect is printed.
5. **Occupier timing/custody:** a catalog cannot decide when a persistent occupier's power ends, competing occupiers, Duke return, private answers, paid-card redirection, or interrupted discard/refill timing. These remain runtime work and any independently identified rulings in the global audit.

Proposed catalog contract: one immutable definition per row; faction and name; `reserveType: 'faction' | 'sardaukar'`; `high` and `low` each containing their own inclusive reserve range, native battle strength and readable gameplay; `occupied` containing readable gameplay and the verified icon count. The catalog is inspectable reference data, not permission to enable module starts or an executable payout/threshold engine.

## Research file checksums

| File | SHA-256 |
|---|---|
| BGG high photograph | `1200b1f3a12c963dc5e58d06fc19de879f5f9d2768557c178ce37237c8046295` |
| Base high sheet | `d3fbf506c2bb697d0f6b4c497c731d5e3138bb3be60d2363607b54ebab7c2c54` |
| Base reverse sheet | `10a2e53c5d6ee8e7ae67f9761a0c64d0f6d36abfec40d863b6b1119af0ad048d` |
| Expansion high sheet | `dfbbb9bb3776899633617a351c7921ed3d64bf25b6780d0722484afca9d1ebaf` |
| Expansion reverse sheet | `950e39c320b66b12749d1fc971489482b0053766358b9ac558c93333977e9523` |

No production files, game states, application artwork or databases were changed by this audit. No individual face remains missing.
