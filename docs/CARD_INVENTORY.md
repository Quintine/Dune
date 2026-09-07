# Treachery inventory audit

The engine currently assembles the 33-card classic deck and the 14-card Ixians & Tleilaxu expansion. `treacheryDeck(['ix'])` produces 47 unique physical identities. CHOAM/Richese and Ecaz/Moritani deck requests explicitly fail until implemented. Expansion starts remain gated; inventory assembly does not certify all card interactions.

## Ixians & Tleilaxu

| Card             | Stable identity   | Rule implementation                                                 |
| ---------------- | ----------------- | ------------------------------------------------------------------- |
| Amal             | ix-amal           | Phase-opening spice loss                                            |
| Artillery Strike | ix-artillery      | Battle weapon, shield protection, leader stun and mandatory discard |
| Basilia Weapon   | ix-basilia-weapon | Ordinary poison weapon                                              |
| Chemistry        | ix-chemistry      | Poison defense or conditional poison weapon                         |
| Harvester        | ix-harvester      | Fresh-blow doubling                                                 |
| Hunter Seeker    | ix-hunter-seeker  | Ordinary projectile weapon                                          |
| Kull Wahad       | ix-kull-wahad     | Worthless card                                                      |
| Poison Blade     | ix-poison-blade   | Combined projectile/poison weapon                                   |
| Poison Tooth     | ix-poison-tooth   | Optional post-reveal activation, leader attacks and discard         |
| Shield           | ix-shield         | Ordinary projectile defense; participates in lasgun explosions      |
| Shield Snooper   | ix-shield-snooper | Combined defense; participates in lasgun explosions                 |
| Snooper          | ix-snooper        | Ordinary poison defense                                             |
| Thumper          | ix-thumper        | Virtual worm encounter before the spice draw                        |
| Weirding Way     | ix-weirding-way   | Projectile weapon or conditional projectile defense                 |

Matching names do not share an identity: the extra Shield, Snooper and Harvester are separate pieces. Existing IDs for the eight previously implemented Ix cards are preserved.

## Base correction and combined counts

`treachery-7` is Ellaca Drug, an ordinary base poison weapon. It was previously mislabeled Basilia Weapon. New decks use the corrected name; projections and subsequent actions normalize that exact legacy base ID without changing its rule type or the expansion's Basilia Weapon. Input states remain immutable. Historical logs are not rewritten.

With Ix enabled there are five ordinary projectile weapons, five ordinary poison weapons, five ordinary Shields, five ordinary Snoopers, six Worthless cards and two Harvesters. Those categories exclude the special combined/conditional weapons and defenses above.

## Evidence and remaining audits

- Publisher Ix rulebook p4 establishes fourteen expansion treachery cards and instructs shuffling them into the base deck: https://www.gf9.com/Portals/0/Documents/GF9/IxianAndTleilaxuRulebook.pdf . The genuine mirror and extracted text are recorded in `IMPLEMENTATION_STATUS.md`.
- The named fourteen-card inventory is corroborated by the unamended inventory entries in https://www.landsraad-vegas.com/rules/gencon and the two component-sheet descriptions at https://ludopedia.com.br/jogo/dune-ixians-tleilaxu/arquivos . These are secondary inventory evidence. No tournament amendments or that site's erroneous Ellaca defense wording were imported.
- Designer Jack Reda's primary overview identifies the fourteen-card expansion: https://www.youtube.com/watch?v=3DDCi67Bb-o . Its page was retrieved, but automatic captions were empty and the transcript endpoint returned a precondition failure. The video was not independently transcribed; do not claim its card-by-card content was verified.
- A retailer's component photo was located but returned HTTP 403. No card-face verification is claimed from that unavailable image, and no publisher/retailer art was copied into the app.
- The current multiple-Harvester interpretation permits each physical copy to double the current fresh-blow amount while the window remains open. Older spice is unaffected. Worm destruction closes the window, and storm prevents spice placement. Exact multiple-copy timing/multiplier wording remains under primary card-face audit. Legacy windows whose old `harvested` flag cannot distinguish doubling from destruction stay closed conservatively; previously shipped base rooms contain only one Harvester.
- Revised Tooth/Artillery effects, alternate-role cards, Thumper/Amal timing and the other unresolved interactions remain subject to the broader audits in `IMPLEMENTATION_STATUS.md`.

Player-facing explanations live in the internal searchable rules reference. This audit file is development evidence, not a declaration of complete rules compliance.

## Ecaz & Moritani treachery components (isolated inventory)

`game/ecaz-cards.ts` now defines `ecaz-recruits`, `ecaz-reinforcements` and `ecaz-harass-withdraw`, one physical copy each. Manual composition with the33base and14Ix cards yields50 unique identities. Source evidence and unresolved interactions are recorded in `ECAZ_TREACHERY_RULES.md` and `RECRUITS_RULES.md`.

Each definition supplies an original full gameplay guide to the enlarged inspector, separate from audit metadata. Battle-slot occupancy is metadata only; neither battle special is classified as a weapon or defense. These definitions do not change `treacheryDeck`, activate the independent variant, or certify runtime effects. Recruits arithmetic is isolated pending its timing/accounting policy; battle effects remain unimplemented. Eight focused inventory/presentation tests pass.
