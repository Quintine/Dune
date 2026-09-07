# Ecaz shared spice collection: source and implementation contract

Source audit, 7 September 2026. This document defines a collection slice; it does not resolve Occupy combat rounding or enable an expansion game.

## Publisher evidence

The current indexed [GF9 Ecaz & Moritani rulebook](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf) agrees with the locally extracted publisher-authored text at `/tmp/dune-rules/ecaz-audit.txt` on collection:

- **p.8, ordinary Occupy:** “If you are both collecting spice from a desert territory”, the allies choose an agreed division; failing agreement, divide equally with the remainder going to Ecaz’s ally. This is a Basic advantage and continues in Advanced play.
- **p.8, Advanced Collection:** both co-occupants receive the full normal bank income at Arrakeen, Carthag and Tuek’s Sietch. Ecaz’s controller status does not remove the ally’s entitlement.
- **p.15 FAQ:** shared occupation of Arrakeen gives both factions ornithopters and collection rate three. This is three spice per normal force, not a multiplier. No Ecaz collection-tripling power was found.
- **p.16 Karama table:** Collection cancellation denies Ecaz the income for co-occupying those strongholds; the ally keeps normal income. The separate Occupy cancellation is a before-plan battle effect, not a desert-allocation cancellation.

The adjacent combat-rounding source discrepancy does not change these matching collection passages. No designer-comment correction is being used here.

## Eligibility and carrying capacity

[Base p.11, Spice Collection](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=11) establishes two spice per force, or three when that faction occupies Arrakeen or Carthag. Base p.13’s Increased Spice Flow supplies Advanced bank income of two per occupied Arrakeen/Carthag and one for Tuek’s Sietch, assessed at collection. It does not pay Basic city income. Compute each faction’s rate from its own qualifying occupation; an alliance alone does not grant its partner’s city rate.

[November 2020 FAQ p.2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2) explicitly requires both the same territory and the same sector as the spice. Collecting forces remain on the board. Therefore capacity cannot reach another sector’s deposit, and collection is neither movement nor force expenditure. The storm removes exposed spice under base Storm rules; do not treat storm-covered groups as available collectors.

The relevant subtype composition is:

| Collector                     | Capacity / eligibility                                                    |
| ----------------------------- | ------------------------------------------------------------------------- |
| Normal forces, including Ecaz | Two each, or three with that owner’s qualifying city occupation.          |
| Fedaykin / Sardaukar          | Normal collection rate; their battle strength is not collection capacity. |
| Ixian Cyborg                  | Three per physical token.                                                 |
| Ixian Suboid                  | Normal collection rate, despite half battle strength.                     |
| BG advisor                    | Cannot collect; a fighter collects normally.                              |
| Unrevealed No-Field marker    | One normal collecting force, even if its hidden denomination is zero.     |

Cyborg/Suboid rules are explicit in [E1 p.9](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=9); the advisor exclusion is explicit in [base p.18](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=18). [E2 p.10](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=10) expressly confirms the No-Field collection and zero-token case. Its secret value must not affect eligibility, the public total, or a waiting-player indication.

## Recommended composition

The following algorithm is an implementation inference from the preceding sector and allocation rules, not a separately printed worked example:

1. Snapshot each partner’s eligible capacity against positive spice in clear sectors. Both must be eligible to collect somewhere in the same desert territory before applying shared allocation. Mere presence elsewhere in that territory is insufficient.
2. For each sector, take `min(deposit, Ecaz capacity + ally capacity)`. Remove that amount once. Sum these amounts by territory.
3. Divide that territory’s resulting total by agreement. Without agreement, assign `floor(total / 2)` to Ecaz and the remainder to the ally. Awarded shares need not match the individual carrying capacities; those constrain extraction, not the subsequent allocation.

Establish both partners’ eligibility before either extracts spice, so seat order cannot consume the pool and falsely turn off sharing. One collected territory receives one default division; do not repeatedly round each token or each contributing faction. A territory with only one eligible collector follows ordinary collection.

Examples: capacities two and three against five spice yield a five-spice pool and default shares two/three. The same capacities against nine spice leave four on the board. A partner whose forces stand only in a different, spice-free sector contributes nothing and does not turn the sole collector’s income into a shared pool.

## Agreement, cancellation and scope boundaries

The sources do not designate a proposer, communication channel or deadline. A software agreement must reflect both players’ assent; an explicit disagreement can select the printed fallback. Automatically applying the fallback before offering any opportunity to agree would omit a supported choice. This is an interaction-design requirement, not grounds to invent a timing rule or ask another rules question.

Keep desert allocations and bank-income receipts distinct. The cancellation response should bind the current Ecaz Collection opportunity before its bank credit; it must not change a negotiated desert share, the partner’s bank credit, or Ecaz’s ordinary income from a city occupied alone. Printed Karama and an allowed BG conversion have identical effect scope. November FAQ p.7 makes Karama a cancellation of one use, so a persisted receipt must not become a permanent advantage ban.

Retained Stronghold Cards are not present occupation: [E2 pp.9,12](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf) settles their custody at Mentat and permits retention until that checkpoint. They neither duplicate nor determine Collection income. [E1 p.9](https://www.gf9games.com/dunegame/wp-content/uploads/2020/09/IxianAndTleilaxuRulebook.pdf#page=9) makes HMS movement collection a separate immediate two-per-force event; forces inside it are not collectors in its pointed-at desert sector. Do not fold that event into this phase’s shared desert pool.

Homeworld income, Discovery effects and Leader Skills require their own actual face modifiers and event order. They are not supplied by ordinary Occupy. The bounded next slice is sector-capacity calculation, territory allocation with agreement/default, and an independently cancelable Ecaz Advanced bank-income receipt, preserving the existing phase continuation and private balances. No new material publisher ambiguity blocks that slice; the algorithm’s multi-sector aggregation and the UI agreement protocol remain explicitly documented compositions rather than claimed quotations.
