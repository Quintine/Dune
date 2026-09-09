# Homeworld card economy runtime

9 September 2026. This records the integrated Tupile sale restriction, shared
Kaitain closing opportunity and Ecaz poison income. Source authority is in
[the card economy contract](HOMEWORLD_CARD_ECONOMY_RULES.md) and
[the Ecaz poison audit](ECAZ_POISON_INCOME_RULES.md). Complete Homeworld and expansion starts remain disabled; verification is
scoped to the integrated paths below.

## Implemented paths

- After the last auction and its income/bonus continuations finish, Homeworld
  tables with Emperor open one shared end-of-Bidding opportunity. Emperor can
  pay two spice per selected held Treachery Card while Kaitain is high. Payment
  precedes disposal; it creates no auction income and does not activate card
  effects. Any number of eligible cards can be selected, subject to current
  hand custody and funds.
- CHOAM's closing sales and allied trade share that opportunity. Neither faction
  has an imposed priority, so a traded card can subsequently be discarded through
  Kaitain. Ghola and incoming transfers use current population and hands. The
  saved event binds both owners, the turn and completed-auction state.
- Owners finish independently; another accepted card action clears readiness.
  Automatic closure uses only public hand counts and possible incoming
  exchanges, never private spice or card identities. Nested choices complete
  before another closing action. The table advances when all owners finish.
- `game/bidding-end-options.ts` supplies private controls and all four AI profiles
  with the same current opportunity. The bots preserve a spending reserve and
  prefer disposing of unwanted Worthless cards. Existing CHOAM market policy
  supplies their sale/trade choices.
- At eleven native forces, Tupile blocks Worthless cards from ordinary CHOAM
  two-spice sales and three-spice duplicate sales. The authoritative action,
  current private sale choices and final settlement use the same population
  predicate. Foreign visitors do not raise native population.
- The same restriction applies when native CHOAM receives the CHOAM Ambassador's
  three-spice-per-card effect. Each selected card is validated before any
  discard or payment. A choice with only unavailable cards completes
  automatically. Other beneficiaries and the Ixian discard-and-draw effect
  retain their separate rules.
- Non-Worthless duplicates, reciprocal allied trades and CHOAM's Advanced
  special Karama cash-in remain available under their existing prerequisites.
  The market explains the high-Tupile restriction and shows eligible sales.
  Other seats receive no private sale list or held-card information.
- Ghola can interrupt a declared CHOAM sale. The ordinary revival and physical
  discard complete before the original sale resumes. A Tleilaxu income response
  has its own allowance or cancellation, including saved-state restoration.
  If revival raises Tupile from ten to eleven, the original Worthless sale
  subsequently keeps its card and pays no spice. Canceling that original sale
  is still a valid separate action.
- The suspended sale stores its exact market, response, original actor/card,
  discard sequence and event. Explicit discard, income and completion stages
  bind the receipt to the actual live or suspended income response. Incoming
  state is checked before actions, normalization and private views. Completion
  restores the original response without replaying the declaration or revival.
- All four AI profiles use the filtered market choices. Their existing Ghola
  recovery policies can also use this sale interruption through the shared
  timing quote. Other ordinary-card response windows remain under their
  existing coverage limits.

## Ecaz income and battle cleanup

The central physical hand-to-discard operation quotes `game/ecaz-poison-income.ts`
and pays three bank spice per poison weapon while native Ecaz is at seven or
more reserves. It applies to any owner's qualifying discard, including Ecaz's
own cards, paid Kaitain disposal, battle cleanup and legal hand cash-in. Current
population is checked at disposal. Neither returning cards to the deck nor
resuming an already committed discard pays again.

Printed poison weapons, Poison Blade and Poison Tooth qualify. Chemistry
qualifies only from its actual weapon slot. Residual Poison and poison defenses
do not qualify. A conditional battle role is retained in a signature-bound
resolved-battle receipt, preserving delayed cleanup through JSON restoration.
The pure quote understands validated Mirror copy descriptors; this does not
enable currently guarded Mirror battle plans or settle its separate retention
question.

Losing cards are discarded before winner casualties. Mandatory winning cards,
including an activated winning Tooth, remain reserved until winner casualties
and any Ixian substitution finish. `pendingWinnerDiscards` binds the original
battle, owner, physical cards and optional cleanup suffix. An independent
resolved-battle obligation requires that queue until its physical disposal is
complete; missing queues and missing obligations reject on restoration. Both
mandatory and optional played cards remain reserved through the casualty pause.
`finishWinner` then
performs the actual compulsory disposal and stages its discard continuation
before offering optional winning-card cleanup. Thus a native Ecaz winner that
falls from seven reserves to six can receive losing-card income while still
high, but receives no income for its later winning-card disposals. The source
composition and revised-Tooth-face retrieval limit are recorded in the Ecaz audit.

Income is committed with the physical discard. An Ecaz-only ledger projects
amount, count, turn and phase to the owner's Homeworld panel; no public log or
event-sequence entry discloses a private discard's poison category. Other seats
receive no ledger or private spice balance.

## Verification scope

Final `npm run check` passes types, lint and **3,515 offline cases**. The
production build and **40 HTTP integration cases** also pass. Desktop and
390×844 browser seats completed paid poison disposal, private Ecaz income, an
allied CHOAM trade, a Worthless sale with a human Karama allowance, and independent
closing readiness. All three seats restored Revival and their exact private
balances after refresh. Screenshots were visually inspected; no page overflow or
browser errors occurred. QA setup uses the documented expansion faction seam.

All **2,894** pre-existing room versions and state hashes remain unchanged.
Three isolated browser rooms and thirty HTTP test rooms were added; no game was
reset. The earlier controlled server restart restored the existing private seat.

Focused entry points are `npm test -- bidding-end ecaz-poison-income`
and `npm test -- battle-discard`. The five new suites add 47 cases: twelve
Bidding engine cases, ten controls/AI cases, five production SQLite cases, eight
pure Ecaz quotes and twelve Ecaz engine cases. Existing battle-discard and SQL
recovery regressions now verify separate losing/winning batches, exactly-once
casualties, played-card reservations and missing-queue rejection.

The new pure, engine and in-memory production-room suites cover exact thresholds,
typed custody, opponent-secret getter traps, malformed selections, unchanged
rejections, both sale prices, separate legal exceptions, Ambassador selection,
Ghola revival, nested income cancellation, all four AI profiles, private JSON
restoration, corrupt receipts and competing duplicate settlements.

Fixtures explicitly isolate CHOAM's unavailable complete expansion setup.
Production recovery uses real supported setup before the documented CHOAM
faction seam. The currently implemented decks contain no duplicate Worthless
printed names, so duplicate-Worthless validation uses two real physical IDs with
a documented same-name fixture seam. Neither seam certifies the expansion deck.
No live saved game is modified by the in-memory suites.

## Remaining work

Occupation retention, Tupile's low/occupied powers, remaining Homeworld economy,
broader Ghola interruptions, complete module games and expansion setup remain
unfinished. The outstanding Mirror retention and other previously recorded
source questions are unchanged. No start or publication gate changes.
