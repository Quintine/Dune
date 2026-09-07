# Terror Assassination and Sneak Attack: source boundary

Reviewed 2026-09-06. Bounded follow-up to `MORITANI_TERROR_RULES.md` and `MORITANI_ENTRY_TIMING.md`. The research phase made no runtime edits; this note distinguishes printed instructions from compositional interpretations.

## Direct Terror instructions

Assassination selects a random leader from the entrant, kills that leader and awards spice; Zoal expressly awards 3. It supplies no exceptional-custody pool definition. The p. 14 captured-leader answer concerns the separate advanced **Assassinate Leaders** ability, not this token. [GF9 Ecaz & Moritani, pp. 5, 14](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf)

Sneak Attack sends up to five Moritani reserve forces into the triggered territory, free, obeying storm and occupancy restrictions despite Aftermath. Moritani's starting reserves are expressly off-planet. The effect does not say it spends the ordinary shipment or movement allowance. Its operative verb is “Send”, without a separate rule expressly classifying this entry for other powers. [GF9 Ecaz & Moritani, pp. 5–6](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=6)

The proposed core behavior—bounded reserve transfer, no spice charge, no ordinary action consumption, restricted entry, specific Aftermath exemption—is consistent with that text. Zero performs no force arrival; it should not create an extra advisor/income trigger merely because a token was spent. This is ordinary composition of the quantity bound, not a retrieved zero-force FAQ.

## Sneak Attack and other arrival powers

| Interaction                     | Applicable primary rule                                                                                                                                                                                                                                                                                                                                                                   | Conclusion                                                                                                                                                                                                                                |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Spiritual advisor accompaniment | BG may make a free reserve shipment when another faction ships from off-planet. Advanced advisors may accompany into the same territory. [Base rulebook, p. 18](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=18)                                                                                                                                           | Positive Sneak Attack transfers explicitly off-planet reserves onto the board. Calling that a shipment is a supported interpretation; no direct Sneak Attack/accompaniment ruling was retrieved. Free cost by itself is not an exclusion. |
| Intrusion                       | BG fighters may become advisors when another faction ships or moves into their territory; the FAQ requires that choice immediately and also includes worm rides. [Base rulebook, p. 18](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=18), [November 2020 FAQ, p. 4](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=4) | The same shipment interpretation supports Intrusion. No explicit Sneak Attack exclusion or paired ruling was found. Exact ordering still inherits the unresolved arrival-timing boundary.                                                 |
| Heighliners                     | Income triggers for off-planet shipment except when only Guild ships. The printed token limits its working phase; payment is not required. Income accrues once and is collected at phase end. [Ixians & Tleilaxu, p. 5](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=5)                                                                 | If classified as shipment, positive Sneak Attack in Shipment & Movement can trigger this income; do not grant another payout if already triggered. A Spice Blow worm-ride reaction is outside that token's working phase.                 |

Therefore neither “Sneak Attack definitely bypasses all shipment reactions” nor “a specific FAQ explicitly orders all these reactions” is supported. An implementation may adopt the shipment composition explicitly, or gate affected combinations pending a ruling. It should not accidentally adopt one by calling or omitting a generic shipment helper.

## Assassination pool: safe ordinary support

Ordinary live native discs held by the entrant are the straightforward pool. Killing a disc already in the Tanks again, or awarding its strength again, is not supported. Do not award Moritani a player-chosen victim. Zoal's explicit payout must survive any generic strength calculation.

Battle availability and physical custody are different facts. The base Harkonnen capture power expressly excludes leaders previously used elsewhere that turn; that is a restriction on **capture**, not a generic definition of all random-leader effects. Importing `captureCandidates` wholesale would add a condition absent from Terror. Ordinary leader rules restrict repeated battle use, not all other effects on that disc. [Base rulebook, pp. 10–11, 17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

No targeted primary clarification was found for these pools:

- An entrant's native leader held by another faction after capture.
- Captured foreign leaders controlled by the entrant.
- Foreign Gholas or native leaders currently controlled as another faction's Gholas.
- Duke Vidal under his separate custody lifecycle.
- An empty eligible pool when all relevant leaders are dead or unavailable.

For a limited implementation, reject an unresolved exceptional pool **before** revealing or consuming RNG, while retaining the decline option. Silently filtering special discs out changes selection probabilities and effectively grants immunity; it is not equivalent to leaving their support unimplemented. The check must consider actual ownership/control across the game, not merely the entrant's native leader array. An ordinary native leader revived normally remains an ordinary living disc; a death history alone is not foreign-Ghola custody.

## Verification and limits

Read the relevant printed pp. 5–6 and 14–16 in `/tmp/dune-rules/ecaz-audit.txt`, the corresponding publisher-indexed expansion passages, base rules, and the Heighliners passage in `/tmp/dune-rules/ix-official-mirror.txt`. Targeted GF9/Future Pastimes searches used Sneak Attack with shipment/advisors/Intrusion, and Assassination with captured/Ghola/Duke. The [designer's expansion page](https://futurepastimes.com/dune-ecaz-moritani) yielded no additional written pool or entry-classification clarification. No community answer or rule for a different Dune game was substituted. Lack of a retrieved ruling is a documented research limit, not proof that none exists.

## Integrated runtime checkpoint

The parent integrated ordinary Assassination and bounded Sneak Attack with the above unresolved cases gated. The native catalog, uniqueness and custody checks run before revelation/RNG. Advanced Harkonnen games use a uniform configuration guard to avoid leaking hidden capture state. Empty living pools retain the hidden token and permit decline. Used living discs remain eligible; Zoal pays three.

Sneak Attack's owner projection supplies reserve maximum and any blocking reason at the offer and resolution stages. Thus the player can preserve the hidden token before an unsupported positive entry; deliberate zero-force revelation remains possible. AI declines blocked or empty offers. No ordinary action counter or spice payment is consumed. BG followup/Intrusion and phase-five technology combinations remain unsupported pending interpretation/integration; no blanket bypass was inferred.

Validation: fifteen focused force/leader tests; integrated 858-unit and 45-persisted/API suites; typecheck, lint and build. Expansion starts remain gated.
