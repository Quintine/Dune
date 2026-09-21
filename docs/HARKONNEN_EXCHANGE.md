# Harkonnen special-Karama inspection and forced returns

The existing Advanced development power draws one through four random, unseen
cards from another player during Bidding. Harkonnen spends its Karama and
once-per-game use, inspects the combined hand, and returns the same number of
cards. Newly drawn cards may be returned. Larger hands keep their real choice.

When the combined hand contains exactly the number owed, every held card must
return. The engine completes that return automatically and emits a house-colored
notice explaining the lack of a choice. A manual return also announces the
completed exchange. The table's existing cosmetic toggle,
reduced-motion behavior and short notice queue apply.

## Private saved observation

**Your Harkonnen inspection** below the board retains the actual randomly drawn
cards, including their readable rules and enlarged inspectors. It identifies the
target and turn and describes historical knowledge: the cards may have changed
hands since. Only Harkonnen's owning seat receives this record. Allies, the target
and other seats receive no inspection record or suspended private auction data.

The copied card descriptions are observations, outside physical card custody.
They persist through ordinary returns, later card movement and JSON recovery.
An internal integrity receipt binds the original card faces and provenance;
changed history is rejected before disclosure. The receipt is not projected.
Existing forced-return saves without a recorded draw retain a truthful snapshot
of the cards held before returning them; the interface does not claim these were
all originally drawn from the target. Legacy exchanges with a real choice keep
their selector without inventing prior knowledge.

Both manual and automatic returns use the same settlement, restore the suspended
decision/response and keep the existing auction funding recovery. Higher-priority
interruptions finish first. Restoring a completed exchange must never redraw,
repeat the return, spend a second Karama or consume the power twice.

## Authority and limits

This composes the existing contract recorded under **Emperor and Harkonnen
special Karama checkpoint** in [implementation history](IMPLEMENTATION_STATUS.md):
GF9 base rules page 14; November 2020 FAQ page 3 (phase and once-per-game limit)
and page 6 (blind draw, inspection, equal return and temporary hand limits).
Automatic resolution of a uniquely determined action follows the user's explicit
interface requirement. Persisting information already inspected does not reveal
the target's current hand.

The existing recovery when an exchange removes the only Karama backing an
unfunded auction bid remains provisional. This checkpoint does not resolve that
ruling or certify all timing and expansion combinations. Advanced and publication
gates remain closed.

## Verification scope

Focused engine tests cover forced and real choices, saved interruption priority,
legacy observations, private projection, rejected-action immutability, physical
custody and minimal legal AI continuation. An authenticated in-memory SQL test
races two real special-card actions, accepts one, reloads every seat and rejects
stale replay without changing the inspection or cards. It also races two restored
legacy continuations through the production recovery scheduler: one return is
saved with no new random draw. Genuine choices remain waiting without writes.
Component tests distinguish
drawn cards from legacy held-card history and exclude non-owner output.

Required checks and browser evidence are recorded in the private source-bound
checkpoint report. These checks establish bounded behavior, not full Advanced
acceptance or AI difficulty calibration.

Browser QA used genuine Advanced setup in a new isolated development room,
then conserved Bidding positions. Playing the real special-Karama control drew
and returned four cards with no return prompt; bidding stayed available. The
private history and enlarged Shield inspector survived refresh, which retained
the exact saved row hash. At a 390-pixel viewport, the 339-pixel history panel
fit within the 375-pixel document without horizontal overflow; each inspector
button was 44 pixels high. The viewport was reset. Screenshot capture timed out,
so these interaction and DOM checks do not establish full visual acceptance.
