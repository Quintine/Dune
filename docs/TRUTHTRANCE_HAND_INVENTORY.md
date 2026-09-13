# Truthtrance hand inventory

13 September 2026. A bounded current-fact capability; public Advanced and unfinished
expansion starts remain gated. Freeform interpretation and broader commitments are
still incomplete.

## Contract and authority

The [GF9 November 2020 FAQ, p8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)
permits game-related Yes/No questions and AND/OR combinations, including a weapon
and defense example. Official-domain indexed page text was retrieved on this date.
This implementation supplies precise current-hand predicates, not a restriction on
the questions allowed by the published card.

`HandInventoryFact` compares physical cards currently held with a nonnegative safe
integer, using exactly, at least or at most. Categories are all cards, primary
weapons, primary defenses, Worthless, Cheap Hero/Heroine, and remaining Special
cards. Decks, discards, separate caches and on-table cards are outside the hand.
Reserved cards still held in hand count. This fact creates no obligation to keep
cards, acquire more, or use them in a particular slot.

Primary roles are an explicitly worded query definition. They reuse the existing
component presentation and canonical Richese definitions, not battle-slot legality:
Weirding Way is primarily a weapon, Chemistry a defense, and Worthless cards remain
separate even for BG/CHOAM. Stone Burner and Mirror Weapon are printed weapons;
Portable Snooper is a printed defense despite their persisted `special` kind.
See [Richese components](RICHESE_COMPONENTS.md) for that physical inventory audit.
No unfinished effect is enabled by counting its held card.

`game/card-category.ts` provides the shared classification. The focused inventory
module parses, compares and renders the predicate; the existing Truthtrance flow
handles priority, aggregate three-valued logic, truthful responses, physical card
disposal and resuming the interrupted decision. Only the respondent sees the
verified answer before publication. Exact Yes comparisons necessarily disclose
the selected count, but matching card identities and individual compound results
are not added to other views. All four bots use the same owner-only answer.

## Verification and limits

`tests/truthtrance-hand-inventory.test.ts` exercises physical copies, default and
alternate roles, input rejection, actual questions/answers, private views, four
profiles, JSON continuations and the absence of a retention promise. The existing
production-room SQLite suite `tests/truthtrance-spice-recovery.test.ts` now covers
total/category and compound inventory facts across module restarts, suspended
auction payment, unchanged private views and competing answers committing once.

Browser acceptance and final required check results are recorded in the milestone
checkpoint and its private verification report. These checks establish the stated
fact boundary; they do not certify every card interaction, arbitrary question,
AI question strategy, complete Advanced play or expansion readiness.

Browser room `LC3E55GY` was created through the lobby, backed up, then staged through
the genuine Basic initializer into an isolated phase-five question opportunity.
Its Medium Emperor held four physical cards: two Shields, Lasgun and Baliset.
The human asker submitted primary-weapon-at-least-one AND
primary-defense-at-least-two; the AI publicly answered Yes. A negative count
disabled submission and showed the correction. At 390px width the human then
submitted total-hand-exactly-four and refreshed during the answer wait. The room
restored both Yes records, an empty asker hand and the prior movement decision.
Phone screenshots showed readable controls and the public preview; the temporary
viewport was reset. Other saved rooms were not used as fixtures. This is targeted
question/recovery evidence, not a complete-game browser run.
