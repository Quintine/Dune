# CHOAM and Richese printed leader audit

Audit date: 2026-09-06. **All ten ordinary name/strength pairs are now visually verified from the publisher-authored rulebook, printed page 3.** This closes the earlier retrieval gap in `RICHESE_LEADER_AUDIT.md`; it does not claim completed faction gameplay. Following the coordinator's independent visual confirmation and approval, the two ordinary rosters were added to `game/cards.ts`.

## Source and reproducible visual evidence

Primary publication: [GF9 CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf), printed pages 3–4 and 8. The [Future Pastimes expansion page](https://futurepastimes.com/dune-choam-richese) links this same publication through its Download Rules link. The official URL currently redirects to the publisher group's website; direct retrieval did not yield a usable PDF.

The newly retrieved [publisher-authored PDF mirror hosted by Lelekan](https://lelekan.com.ua/files/rules/2082/pravila-nastilnoyi-gri-dyuna-kooan-ta-richez-dune-choam-amp-amp-richese-dopovnennya-angl-anglijskoyu-movoyu.0.pdf#page=3) contains the GF9 rulebook, credits and printed component illustrations. It is a mirrored, compressed copy, not a retailer's rewritten inventory. Its text and page anchors agree with the indexed official publication. Byte identity with the inaccessible official original cannot be claimed.

- Downloaded file: `/tmp/dune-rules/choam-lelekan-mirror.pdf`.
- Extracted text: `/tmp/dune-rules/choam-lelekan-mirror.txt`.
- Visually inspected page: `/tmp/dune-rules/choam-leaders-p3.png`, complete page rendered at 1352×2600 and inspected at original resolution.
- File: 350,408 bytes, 12 pages, PDF 1.4, unencrypted. Metadata identifies Adobe InDesign 15.0 (Macintosh), iLovePDF producer, original creation 2021-10-26 and modification 2022-04-21 UTC. The mirror therefore should not be labeled a newly issued 2026 rules edition.
- SHA-256: `b628cef05b167953c2f192c8acfdefea92aee8f5497eea779edacf7be25e6299`.

The older local `choam-primary.pdf` and `choam-publisher-audit.pdf` are HTML error/redirect pages. They are not alternative rulebook editions or evidence contradicting this download.

## Verified ordinary discs

Names below preserve the printed wording, with normal title capitalization. Positions refer to each faction's small-disc group on printed page 3. Proposed software IDs follow the existing descending-strength roster convention; IDs are implementation choices, not printed component identifiers.

| Faction | Proposed ID | Printed name  | Strength | Figure position |
| ------- | ----------- | ------------- | -------: | --------------- |
| CHOAM   | `choam-0`   | Frankos Aru   |        4 | Upper left      |
| CHOAM   | `choam-1`   | Lady Jalma    |        4 | Upper right     |
| CHOAM   | `choam-2`   | Rajiv Londine |        3 | Middle left     |
| CHOAM   | `choam-3`   | Duke Verdun   |        3 | Middle center   |
| CHOAM   | `choam-4`   | Viscount Tull |        2 | Middle right    |
| Richese | `richese-0` | Ein Calimar   |        5 | Upper left      |
| Richese | `richese-1` | Lady Helena   |        4 | Upper right     |
| Richese | `richese-2` | Flinto Kinnis |        3 | Lower left      |
| Richese | `richese-3` | Haloa Rund    |        2 | Lower center    |
| Richese | `richese-4` | Talis Balt    |        2 | Lower right     |

Source for every row: [publisher-authored rulebook, printed p.3 figure](https://lelekan.com.ua/files/rules/2082/pravila-nastilnoyi-gri-dyuna-kooan-ta-richez-dune-choam-amp-amp-richese-dopovnennya-angl-anglijskoyu-movoyu.0.pdf#page=3). Page 4's component list specifies five ordinary discs per faction.

## Separate identities and aliases

The page 3 CHOAM lower extra disc reads **Auditor**, strength **2**. Its adjacent caption and page 8 place it in advanced play. The earlier suggested zero strength is rejected by this legible figure. Do not add it to the ordinary five-disc factory; a separate advanced setup path must handle its disc and traitor. Its actual traitor card face was not independently pictured/read in this audit.

The large portraits labeled **Ur-Director Malina Aru** and **Count Ilban Richese** have no printed combat strength and sit outside the small leader groups. They are faction portraits, not additional ordinary leaders. Do not infer leaders from the narrative introduction. [Printed p.3](https://lelekan.com.ua/files/rules/2082/pravila-nastilnoyi-gri-dyuna-kooan-ta-richez-dune-choam-amp-amp-richese-dopovnennya-angl-anglijskoyu-movoyu.0.pdf#page=3)

Targeted searches of GF9 and Future Pastimes for CHOAM/Richese leader errata, Auditor and Calimar found no official roster correction or alternate printed alias. This is a bounded retrieval result, not proof that no later printing exists. Use **Lady Helena** exactly rather than expanding it from lore, and preserve **Ein**, **Flinto**, **Haloa**, **Londine** and the printed titles. No lore wiki, fan implementation or tournament amendment supplies the names or values above.

## Approved implementation checkpoint

The two five-entry lists now use the displayed order in `game/cards.ts`, preserving the factory's native faction, alive state and death counter fields. The ordinary inventory is now 60 across twelve factions. Auditor remains outside that ordinary count; shared Duke Vidal also remains separate. Roster-based traitor construction was checked for the ten new ordinary identities without claiming independent printed traitor-face inspection. No engine or start-gate files changed.

`tests/choam-richese-leaders.test.ts` has five passing tests covering exact arrays and values, native/unused state, clone independence, traitor identity construction, sixty unique ordinary IDs, and special/faction-portrait exclusions. A before/after serialized comparison separately confirmed that the previous ten rosters are unchanged. This component checkpoint makes no runtime completeness or availability claim.

## Validation performed

Successful public PDF download, `pdfinfo`, `pdftotext -layout`, SHA-256, and complete page-3 visual inspection at original render resolution. The first sandbox download failed DNS resolution; the approved escalated public download succeeded. Rendering command:

```sh
pdftoppm -f 3 -l 3 -scale-to 2600 -png -singlefile /tmp/dune-rules/choam-lelekan-mirror.pdf /tmp/dune-rules/choam-leaders-p3
```

The publication's component figure fully verifies the ten ordinary name/value pairs and the Auditor's printed value; later-edition completeness and individual traitor faces remain outside that finding. Focused component tests ran after approved roster integration; this is not a full expansion acceptance test.

Post-integration validation: all 180 named tests across eleven `tests/choam-*.test.ts` files pass when executed individually with `node --import tsx`; targeted `oxlint` and full `tsc --noEmit --incremental false` pass. Existing CHOAM tests did not require empty-roster assumptions to be removed. The previous ten rosters were compared against a serialized pre-edit snapshot and remain byte-equivalent as JSON values.
