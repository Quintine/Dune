# Richese leaders and CHOAM Auditor: printed-component audit

Audit date: 2026-09-06. **No new printed leader name/strength pair was verified.** This bounded official-source check leaves the roster gap open; it does not authorize placeholder leaders or enable faction starts.

## Verified evidence

| Component                | Exact verified data                                                                             | Missing data                                                         | Primary anchor                                                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Richese ordinary leaders | Five leader discs belong to the faction set.                                                    | Every printed name/strength pair; complete disc-to-traitor mapping.  | [GF9 CHOAM & Richese rulebook, printed p.4, component list](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf) |
| CHOAM advanced leader    | The rules name the **Auditor**, add its leader disc, and add its traitor during advanced setup. | Legible disc face and printed strength. **Zero remains unverified.** | [Same rulebook, printed p.8, advanced CHOAM advantages](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)     |
| Expansion traitors       | Eleven traitor cards are listed.                                                                | Individual printed identities and values have not been face-audited. | [Same rulebook, printed p.4](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)                                |

Count Ilban Richese appears in the rulebook's narrative, including printed p.10. A narrative mention does not establish a printed leader disc or its strength; it is not used to populate a roster. [GF9 rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

## Retrieval boundary

- Read the existing `COMPONENT_INVENTORY.md` and `CHOAM_REMAINING_RULES.md` gaps before searching.
- Targeted official-domain searches covered GF9's Dune site, GF9's product domain, and the publisher group's product domain. Searches for the expansion/component images, leader discs, Richese/Ilban, and Auditor/strength returned indexed rulebook passages but no readable official component face.
- Direct access to the publisher's Dune landing page, GF9 product site, and publisher-group Dune product path returned HTTP 403. An official-domain image search produced no usable component image. The rulebook's indexed text establishes the anchors above; no PDF page screenshot or printed disc was visually inspected in this pass.
- No retail listing, fan wiki, lore roster, tournament document, community implementation, or AI-generated component was accepted as evidence. Earlier failed PDF downloads and low-resolution designer photos were not reclassified as newly verified sources or repeatedly retried.

These are retrieval limits, not proof that the publisher has never released a suitable artifact.

## Artifact needed to close the gap

Obtain **one legible official component-sheet image/PDF showing the faces of all five Richese leader discs**, with every name and strength readable and its edition/product identifiable. Also obtain **a legible CHOAM Auditor disc face and matching traitor face**. Ideally the same official punchboard or print-proof package includes all corresponding Richese traitor faces, allowing spelling and identity cross-checks. A publisher-issued replacement-components sheet or named roster/strength correction would also establish the values.

A physical-copy scan would need recorded product/edition provenance and readable complete faces before being accepted in a broader component audit. It would be newly supplied evidence, not an official web asset found during this pass. No upload or publisher message was requested or sent.

## Current implementation and validation

`game/catalog.ts` contains Richese and CHOAM faction metadata. The actual leader factory remains empty for both:

```sh
node --import tsx --input-type=module - <<'JS'
import { leaders } from './game/cards.ts';
console.log(JSON.stringify({ richese: leaders('richese'), choam: leaders('choam') }));
JS
```

Observed output: `{"richese":[],"choam":[]}`. The printed-component gap remains separate from existing faction subsystem work. Only this audit document changed; no engine, card, leader, or availability data was modified.
