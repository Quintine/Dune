# Smuggler battle collection

20 September 2026. **Prototyped, with Partial rules coverage.** New battles in
the base-faction Leader Skills preview connect the lower Smuggler effect in Basic
and Advanced games. Public module, mode and publication gates remain closed.

## Rule and timing contract

The [source follow-up](LEADER_SKILLS_RULES.md#20-september-smuggler-follow-up)
combines the printed reveal-time collection with the common requirement that the
selected skilled leader survive. The card does not require winning or retaining
forces. A captured skilled leader grants its lower effect to its controller.

At public plan reveal the server records the battle, controller, selected leader,
plans, skill posture and territory's existing spice. The amount is the smaller of
that single pile and the unmodified disc strength. This pending amount is not
personal spice and cannot fund a sealed plan or another payment. After survival
is known, the server transfers it once, including for a surviving loser, before
Sandmaster adds any after-victory spice. A pile drained to zero cannot receive
Sandmaster's addition. This deferred settlement and ordering remain explicit
timing inferences, not a newly discovered publisher ruling.

A weapon death, opposing or mutual Traitor, or Lasgun–Shield explosion voids the
collection. A successful sole own Traitor call can leave the Smuggler alive and
eligible. A void receipt changes no pile; it cannot restore spice destroyed by an
explosion. Capture return/death cleanup follows settlement without paying the
original owner. This board transfer is neither bank income nor another player's
payment, so it does not invoke Banker or Bureaucrat payment handling.

## Connected behavior

- A shared admission quote serves the server, player controls and four AI
  profiles. Public mode flags and the player's own chosen plan determine the
  guard; an opponent's concealed cards do not control eligibility.
- Guidance explains the pending amount, survival and spending restriction.
  Collection is automatic, with the existing faction-colored action notice and
  an explanatory chronicle entry; there is no confirmation step.
- AI candidates omit optional Kwisatz when selecting Smuggler and reject other
  unsupported modified plans. Native face-up skilled discs remain unavailable
  to battle selection; captives and existing mandatory concealment retain their
  legal paths. UI availability and the submitted Kwisatz value share one check.
- Versioned, signed reveal receipts survive private JSON/SQLite continuation.
  Reads/actions reject changed plans, receipts, pile or identity. Public views
  expose the selected leader, controller and pending amount only after reveal;
  the internal binding frame is never projected. Concurrent final votes use the
  existing versioned room write to prevent duplicate collection.
- Battles already saved without the new version keep their original behavior.
  Subsequent battles use the new flow. There is no database migration or reset.

## Boundaries and evidence

Kwisatz, separate trainer bonuses and Stunner still await the existing modifier
question; no user answer is assumed. Expansion rosters/cards, the independent
Ecaz card variant, other optional modules and multiple positive piles remain
guarded before the Smuggler plan seals. These development restrictions are not
rules that forbid those combinations in the physical game. Stone Burner and
other expansion combinations therefore have no connected acceptance claim here.

Focused engine tests cover winners/losers in both modes, empty/short piles,
zero surviving forces, death and Traitor outcomes, explosion, capture custody,
Sandmaster order, corruption, immutable rejection, legacy continuation and all
four bot profiles. SQLite tests cover authenticated restart, private projection,
concurrent final votes and replay rejection. Browser and full-game sample scope,
required check/build/HTTP results, preservation and verified Git delivery are
recorded in the private source-bound checkpoint and commit message. This does
not certify every Leader Skill or combined-module interaction.
