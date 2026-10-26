# Truthtrance ordinary bid commitments

## Current-lot prototype — 26 October 2026

**Prototyped / Partial.** The question binds one
future ordinary bid declaration of at least a chosen positive whole amount in
the current lot. Registered native Basic/Advanced tables use their selected
decks and ordinary auctions. Optional modules, independent cards, Semuta/Kull,
native special auctions, phase-wide/grouped bidding claims and force-revival
promises remain required work. This does not change game-start permissions.

## Authority and selected interpretation

The [GF9 November 2020 FAQ, printed p8](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=8)
permits game-related yes/no questions and current-turn action commitments,
requires compliance while possible, and releases a later impossible answer.
Its worked example concerns shipment; it does not prescribe a bidding-specific
packet or online auction boundary. The official-domain indexed text was checked
for this slice. The previous [general source audit](TRUTHTRANCE_NONBATTLE_READINESS_20260907.md)
remains applicable.

Under the standing 14 October choose-recommended instruction, use a single
accepted bid in this exact ordinary lot. Only a still-eligible active or waiting
bidder can answer; current-highest, already-passed and full-hand players have no
new opportunity for this question. An earlier bid does not fulfill it. Yes
requires a qualifying declaration at the player's next available opportunity
while possible; a smaller bid or pass cannot rely on a future rival raise.
No forbids every later qualifying bid through the close of the lot. These are
explicit provisional software interpretations, not a dedicated publisher FAQ.

Fulfillment records the declaration, even if someone else wins. The original
winning invoice and Karama payment remain separate and binding. Legal native
Karama overbidding is retained; the question creates no spice, discount or free
purchase. Existing current cash, prepaid allied aid, capacity and normal quote
checks remain authoritative. Unknown purchases and future rival income are not
assumed. Earlier shipment/movement funding obligations constrain the bid quote.

## State, actions and continuation

`game/bid-promises.ts` validates positive safe-integer `turn`, one-based `lot`
and `minimum`. The new question is `{kind:'bid',target,turn,lot,minimum}`.
It uses the original card declaration, priority, Ask, public Yes/No, physical
discard and interrupted-auction continuation. It adds no automatic human reply.

The engine privately binds the original physical lot, turn, respondent and
asker with a distinct event. Public history contains the stated lot/minimum and
answer; the unrevealed card binding is never projected. Only the respondent
receives feasible answers and its own sanitized commitment/guide. The guide
waits for the real active seat and original pending windows, and its event
rejects stale guided callbacks. Ordinary manual bid packets retain their shape.

The native bid quote is shared with ordinary bidding. Yes requirements form a
lower bound; No requirements cap the permitted amount. Several original
Truthtrances must remain jointly satisfiable. A real accepted bid fulfills each
matching Yes; No persists. Native settlement, custody and income then continue
normally. A paid purchase is not another bid.

Own voluntary spending or closure cannot erase a remaining Yes. A completed
opposing raise can price out the respondent and release only impossible Yes
answers in accepted order; feasible answers and No constraints remain. Finished
lots fulfill No and release any forced impossible remainder. Records may stay
in history, but never bind another lot or turn. Recovery/privacy/custody
certification is deferred with the rest of the full-rules review.

## Connected controls and evidence

The original Truthtrance selector offers **Bind a bid in this ordinary lot**,
with fixed public lot/turn, editable validated minimum and an explicit preview.
Only feasible respondent answers are shown. `components/bid-promises.tsx`
keeps the owner's obligation and fulfilled/released status visible; its guarded
button submits the authoritative bid/pass packet without duplicating prices.
No transient notice is required. All four existing policies use the same legal
answer/next-action guidance; strategy and strength tuning remain deferred.

Pure cases: `tests/bid-promises.test.ts`. Native source and engine cases:
`tests/fixture-truth-bid.ts`, `tests/truth-bid-runtime.test.ts`. Controlled and
source-earned callbacks: `tests/truth-bid-controls.test.tsx`. Original H/A/E
starts genuinely deal Harkonnen both physical Truthtrances and the other native
hands. Only unopened deal/lot/Spice positions and scalar lotteries are selected;
no played card, purse, force, auction, question or promise is installed.

Frozen integration passes **14 files,175/175**, types/lint/build and four native
runtime paths with17 GameTable SSR renders and two actual guide callbacks.
Ten pure cases, fourteen native engine cases and six controlled/source-earned
UI cases cover the new contract. Related original auction, Banker/Bureaucrat,
funding and Truthtrance cases remain passing after the native quote extraction.

Public H/A/E Basic/Advanced active sources use22/25 actions plus8 each. Actual
declaration/priority/Ask/answer precede the authoritative bid callback; Yes4
fulfills before cash changes, then the original winner pays4. Four existing
minimal policies each submit a legal guide action per source. Waiting sources
use20+12 actions for No4/lower3/lot expiry/new-lot4, or20+9 for an actual A10
opposing bid, E10's released Yes8 and original A payment/native E income10.

Other native cases bind both original cards as No6 plus Yes4, lose after a
fulfilled declaration, spend an original Karama after the promised11 bid and
reject stale/foreign packets and voluntary loss of required funding. An earlier
shipment Yes9 disallows later bid Yes4; a paid1 card leaves the actual9 for a
native nine-force shipment. All33 original cards remain physical. SSR confirms
the original authoring option, respondent answers, persistent guide and final
statuses; actual hook-free callbacks execute the original native bid packet.
This is not DOM/hydration or browser evidence.

Report/source manifest:
`/home/quintine/.local/share/dune/checkpoints/20261026-truth-bid-proof-v1/`;
journeys/HTML: adjacent `20261026-truth-bid-runtime/`.
No saved-room/D1/server, reset/restart, deployment or separate assurance campaign.
Full Truthtrance, module/native-special composition, browser/mobile/deployed
acceptance and final assurance remain open.
