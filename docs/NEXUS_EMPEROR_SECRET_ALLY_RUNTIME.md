# Emperor Nexus Secret Ally revival and bank-auction purchase

27 September 2026. **Prototyped**, with **Partial** rules coverage. These
separate Secret Ally alternatives connect in Basic and Advanced classic-faction
games with Nexus alone. Public module starts and publication remain gated.

## Rules and connected behavior

The printed Emperor Nexus has an alternative Secret Ally grant during Revival:
three additional forces return free, beyond ordinary revival limits. Emperor
must be absent and the holder unallied. The grant does not revive leaders, spend
spice, or consume ordinary force/free-revival allowances. It can precede or follow
ordinary returns while Revival remains open. Submitting the interface's ready
action does not itself end that phase or invent a new card deadline.
[Printed cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani),
[source audit](NEXUS_EMPEROR_RULES.md#secret-ally-three-additional-free-revivals)

The ordinary Advanced one-per-turn special-force revival cap remains in force.
For this roster, that means Fedaykin. The holder chooses among legal normal/elite
groups totaling exactly three; one printed counter cannot become two forces.
Fewer than three eligible counters remains a recorded source gap, not an implicit
up-to-three option. Recruits, Tleilaxu income/prevention, CHOAM suppression,
Homeworld deployment and other combined-module producers remain outside this
batch. A different player's ordinary Fremen ally grant does not block the holder.
[November FAQ, p. 2](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=2)

The engine consumes the physical Nexus and moves the exact force group in one
action. A private receipt records the original pools, mode and conserved delta;
independent event markers reject missing, duplicated or reordered history.
Historical pools are not compared with all later current pools: ordinary revivals,
Ghola and later battles can legitimately change them. The current card and event
must still authorize a fresh use. Saved views never expose that receipt or rival
hands/spice. The private offer creates no table-wide decision or forced pass.

All four AI profiles use the same projected legal choices. The UI supplies a
physical elite selector only when it offers a real choice, shows unavailability
reasons, and disables submission while busy. The existing Nexus inspector retains
all three printed panels. This is legal functional support, not calibrated strategy.

## Bank-auction purchase alternative

The printed purchase option preserves the actual buyer's spice after proving
the final price is held. An unallied holder, with Emperor absent, can spend the
physical Nexus at the winner-payment decision of an ordinary bank auction.
The winner must have the full positive bid in their own spendable spice and
cannot use ally contribution. One actual Treachery lot enters their hand,
their spice remains unchanged, and normal auction/card follow-ups continue.
The public log announces the price/proof/use without revealing excess spice or
the Treachery card face. A private signed receipt records the lot, price and
unchanged balance; independent use markers and physical custody survive JSON
and in-memory SQLite CAS/restart. Rival seat views omit the offer and receipt.

**Timing is a provisional privacy choice, not a user or publisher ruling.**
Every winner in this bounded public auction context receives the same payment
confirmation, including a player with only spice and no Nexus card. Otherwise
the holder-only pause would disclose hidden ownership. The existing ordinary
spice/Karama payment choices stay available; bots use a legal purchase when
owned and otherwise use the ordinary decision. The previously asked
confirmation-versus-gate question remains pending; this prototype does not
settle it for release.

Seller-paid Richese/CHOAM transactions, allied split, expansions, other
purchase sources and the forced Emperor-payment Betrayal alternative remain
gated. The [source contract](NEXUS_EMPEROR_RULES.md#secret-ally-retain-the-actual-purchase-price)
records those payment boundaries.

## Prototype entry and evidence

A fresh ready local lobby can use the existing reusable writer:

```sh
node --import tsx tools/start-prototype.ts --profile nexus \
  --db PATH_TO_LOCAL_D1_SQLITE --room EIGHT_CHARACTER_CODE \
  --version CURRENT_LOBBY_VERSION --out /private/new-prototype-checkpoint
```

It enables the real twelve-card Nexus setup, backs up saved games, compares the
original room/version atomically, preserves seats and other rooms, and rejects
redealing a started game. The Nexus is drawn through the ordinary closing-phase
opportunity; the writer does not deal a chosen card directly to a player.

Focused tests exercise ordinary-first and Nexus-first returns, zero-spice use,
Fedaykin caps, later Ghola, native/Betrayal exclusion, private controls and bots,
JSON recovery, corruption, SQLite restart, lost-response replay and competing
normal/elite choices. The fixture executes the real setup, alliance and Nexus
draw actions but controls starting hands, deck order and the later loss topology.
It is a targeted scenario, not an untouched complete game.

Independent source/privacy review and 17 focused effect tests pass; four prototype
writer tests also pass. Two genuine-start samples with all four AI profiles finish:
Basic 715 actions/19 periodic JSON restores and Advanced 263/7, both with zero
rejected candidates and no Emperor use. Two explicitly staged continuations finish
in 18 Basic and 17 Advanced actions, with one normal-force Nexus return each and no
rejections. All samples preserve exact Treachery, force, elite and Nexus custody;
all 14 final seat views also survive restoration. These are bounded continuation
checks, not natural full-game acceptance of the Emperor effect or AI calibration.

A separate staged Advanced Fremen browser game spends the Nexus on three forces,
including one Fedaykin, then revives three ordinary normal forces. Reserves rise
from three to nine, Tanks fall from seven to one, spice remains three and the
ordinary free allowance is used only by the second return. One Fedaykin remains
in Tanks under the shared elite cap; the card is discarded exactly once. The full
inspector is readable, the action notice appears, and pending/resolved states
restore through refresh. Private projections and unchanged physical totals pass.

After the power outage, all 733 opening rooms and original seat/recovery records
match the private backup; database integrity and foreign keys pass. The healthy
server is reused without restart. A separate pre-verification snapshot protects
all 734 rooms, including the new QA game. Required broad results, final
preservation totals, source fingerprint and push confirmation are recorded in the
checkpoint commit and private report.
