# Advanced Stronghold Cards

Implemented development module, 7 September 2026. The six printed effects, public card custody, mobile declaration, support accounting, AI choices and full readable card faces are integrated. Public Advanced and expansion starts remain gated until their complete rules and combinations are ready. This checkpoint does not certify all optional-module combinations.

## Authority and inventory

The original CHOAM & Richese module contains **six separate Stronghold Cards, one of each**. They never enter the Treachery deck, hands, discard, bidding pool or hand limit. The publisher rulebook requires Advanced play; neither CHOAM nor Richese needs to be a participating faction. The mobile card remains set aside when no placed mobile stronghold exists.

Sources, in precedence order:

1. Publisher [CHOAM & Richese rulebook](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf), printed pp4, 6, 9–12: inventory, Advanced prerequisite, end-turn custody, CHOAM bank-funded support income and advisor timing. Readable publisher-authored mirror SHA-256 `b628cef05b167953c2f192c8acfdefea92aee8f5497eea779edacf7be25e6299`.
2. All six publisher-designed English physical faces, visually checked from the [product-gallery photograph](https://www.tabletopfinder.eu/en/boardgame/32692/dune-choam-richese). [Image](https://cdn.anyfinder.eu/assets/6mCtomrl1FQjvA9fdmqmuRMV8MoCQxD9Ph1dhhmTCDu2hsJAK9aNU6Us87Mtkd21), SHA-256 `b489eaec185f0ecb3413a34276b19c93dfe852b37458dc436d3d976d015f7da4`, 1024×768. This is a third-party photograph of the printed components; photographer, date and printing are unverified. It is research evidence, not a bundled asset.
3. Publisher [Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf), printed p8: Ecaz controls a stronghold occupied only by itself and its ally.
4. [Classic base rules](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf), pp10–11 and13; [November2020 FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf), pp2 and8: battle outcomes, support, dial meaning, Tooth and defenses. Later direct rulings take precedence over general older text. No tournament-rewritten Stronghold effects were adopted.

| Printed identity | Canonical board ID | Complete effect in original language |
| --- | --- | --- |
| Arrakeen | `arrakeen` | The bank contributes two spice toward actual force-support payment in battles there. |
| Carthag | `carthag` | Without a poison weapon in your plan, your played non-poison defense also functions as a Snooper. |
| Habbanya Sietch | `habbanya_ridge_sietch` | Win battle ties there regardless of storm order or Juice of Sapho. |
| Sietch Tabr | `sietch_tabr` | A win earns bank spice equal to the opposing dial rounded down. |
| Tuek’s Sietch | `tueks_sietch` | Each Worthless card played in the battle earns two bank spice; the face imposes no win condition. |
| Ixian Hidden Mobile Stronghold | `hidden_mobile_stronghold` | Copy an advantage of another controlled stronghold and declare it before Battle Plans. |

No card has a printed once-per-turn limit. Benefits apply to their holder in that location, not globally. The copied benefit applies to the battle inside the mobile stronghold.

## Custody and decisions

`game/stronghold-cards.ts` owns the canonical definitions, control query, costs and income arithmetic. Setup leaves every owner null. At final end-Mentat settlement, after eligible board changes and advisor normalization, each card transfers to its controller or is set aside. Cards remain with their recorded holder throughout the next turn, even after leaving, losing a battle or becoming advisors. `claimedTurn` prevents duplicate settlement. Normal turn completion and terminal victory both use the same ownership checkpoint.

Fighter presence across a territory counts; advisors do not. A concealed No-Field contributes one public presence without reading its private denomination. Ordinary allied armies do not pool control. Exactly Ecaz plus its reciprocal ally selects Ecaz, as the explicit faction exception. A mobile interior is distinct from its pointing territory.

Before mobile battle powers and plans, the card holder receives a public choice if multiple other strongholds are currently controlled. One eligible advantage is announced automatically; zero proceeds without a copied advantage. The persisted choice is bound to the battle event, owner, phase and exact eligible pool. An accepted copy remains fixed for this battle. Public views expose ownership, declared copy and each combatant’s effective advantage; sealed plans and foreign hands retain their existing privacy.

## Composed-rule interpretations

These are recorded textual interpretations, not claims of dedicated publisher FAQ answers:

- **Mobile control versus card custody:** the face says controlled stronghold, whereas the general module separately permits retaining a departed location’s card. Therefore use current physical control, without requiring custody of that other card. A newly occupied location can qualify; an abandoned card alone cannot. No tournament end-of-Bidding timing or replacement copy pool is used.
- **Arrakeen low costs:** bank support is `min(2, actual support)`. Unspent allowance never becomes personal cash, and free Fremen support cannot mint income. Normal and allied personal charges use the remaining cost. CHOAM’s published income includes the bank portion, excludes CHOAM’s own donor share, and follows the existing no-income-on-traitor rule.
- **Carthag roles:** defensive Weirding Way is projectile defense and can gain Snooper; defensive Chemistry already is poison defense. Worthless and empty slots cannot gain protection. A poison-role weapon, including Chemistry or Tooth in the weapon role, prevents this advantage. The added property does not replace physical identity: Shields still cause Lasgun explosions and Snooper protection does not stop Tooth. The defense actually used after any permitted late replacement supplies the property.
- **Habbanya and Stone Burner:** the general battle-tie advantage also decides a tied undialed-token comparison. It does not override a traitor victory or create a winner after mutual destruction. Sapho remains an unfinished card effect; this implementation does not certify its future ordering.
- **Tabr:** use the opposing declared dial, not leader strength, support cost or token count. A single traitor caller wins and qualifies. Explosion and double traitor have no winner and do not qualify.
- **Tuek:** ordinary defeat and single-traitor outcomes do not erase played Worthless cards. An explosion can still qualify. For double traitor, the base rule that neither player receives spice takes precedence, so neither receives this payout. CHOAM’s out-of-plan Worthless discard powers and BG Karama conversions are different uses and do not qualify.
- **Ecaz ally battle:** card custody belongs to Ecaz. No general transfer or automatic sharing of a held card’s benefit was inferred. Complete combined-force Ecaz combat and its dial representation remain outside this checkpoint.

## Player experience and AI

The table has public ownership labels, a six-card gallery, an enlarged inspector, and a decision panel for mobile copies. Support controls include Arrakeen’s two bank spice and separate the actual bank contribution from player/ally payment. Successful automatic support, copy, ownership and income events use the existing house-colored notices without an acknowledgement.

The internal reference has searchable complete original effect prose, related phase/faction links, an example and five-part implementation checklist. It contains no external source links. Each illustration is original built-in image generation, saved locally under `public/art/strongholds/*-v1.png`; exact prompts, original paths, hashes and visual inspection notes are in `STRONGHOLD_ART_GENERATION.json`. Normal and enlarged faces retain crisp interface text independent of the artwork.

All four policies consume their entitled public copy/effect and private hand/support data. Arrakeen adds affordable supported half-step dial candidates so a large army does not overlook free support when its ideal dial is unaffordable. Carthag and Habbanya enter combat evaluation. Mobile choice heuristics consider funding, defense, defender priority and Worthless holdings. This is policy support, not proof of calibrated relative strength.

## Verification

- 12 pure inventory/control/cost/income cases.
- 9 actual engine lifecycle and six-effect cases, including CHOAM donations, defender Stone tie, losing Worthless cards and stale mobile answers.
- 4 all-profile AI cases, including 4/6/10/20-force Arrakeen armies and hidden-state noninterference.
- 3 additional combat-role and mutual-effect matrix cases.
- 4 production-room SQLite tests: fresh module instances, real private-seat recovery, sealed-plan views, duplicate/crossed copy CAS, exactly-once subsidies/income, and eight corrupted saved-choice bindings. The room scheduler does not answer a pending human choice; direct engine normalization and actions reject invalid bindings without writing.
- Independent actual-action matrix: 17 Arrakeen/CHOAM support-share combinations, all paid once with the expected balances.
- 40 complete sampled base-faction Advanced games with the optional module: all player counts 2–6 × all four homogeneous profiles × two roster/seed replicates, nine distinct rosters. 19,665 accepted actions, zero rejected candidates/stalls/invariant failures, 224 setup actions and 912 continued JSON round trips. Observed 330 custody, 21 support and 7 income notices. Source hashes were stable during the 105.603-second run.

The game study uses the unchanged strict base audit initializer, then adds only empty Stronghold module configuration immediately before the first setup action. It does not change cards, resources, starting forces or the public start gate. Runner `/tmp/dune-stronghold-fullgames.ts`, full results `/tmp/dune-stronghold-fullgames.json` (SHA-256 `d6f924aca8ed714df0a92008b4d6eda5b54d1e0192f4eda1a937dd98adbcf3e8`), summary `/tmp/dune-stronghold-fullgames-summary.json`. This base-roster study does not exercise an Ixian interior or CHOAM full game; focused tests cover their bounded interactions.

The registered suites pass **1,528 rules/client/component tests and 133 persistence/API tests**. Logs: `/tmp/dune-stronghold-full.log` and `/tmp/dune-stronghold-multiplayer.log`. Desktop normal and enlarged faces, plus all six enlarged phone-width faces at 390×844, were visually inspected with complete readable text and working close controls. Final live-control and build verification are recorded in the implementation status checkpoint.
