# Emperor Nexus Secret Ally revival and bank-auction purchase

Updated 14 October 2026. **Prototyped**, with **Partial** rules coverage.
Revival now uses the independent extra source through original native pending
continuations and supported Nexus module envelopes. Bank-auction purchase keeps
its distinct classic-only boundary. Public starts and publication remain gated.

## Rules and connected behavior

The printed Emperor Nexus has an alternative Secret Ally grant during Revival:
three additional forces return free, beyond ordinary revival limits. Emperor
must be absent and the holder unallied. The grant does not revive leaders, spend
spice, or consume ordinary force/free-revival allowances. It can precede or follow
ordinary returns while Revival remains open. Submitting the interface's ready
action does not itself end that phase or invent a new card deadline.
[Printed cards](https://boardgamegeek.com/image/7767032/dune-ecaz-and-moritani),
[source audit](NEXUS_EMPEROR_RULES.md#secret-ally-three-additional-free-revivals)

The Advanced one-per-turn Fedaykin cap remains; native Ix Cyborgs use their
separate physical count cap. Select actual normal/elite groups totaling exactly
three. Fewer than three remains unavailable, not an implicit up-to grant.
Recruits changes the ordinary rate/limit, not this fixed extra count.
[Independent-source interpretation and changed-path proof](NEXUS_EMPEROR_RULES.md#recommended-independent-extra-return--14-october-2026).

The card is consumed at declaration, before original pending revival.
Version-two receipts track requested (no forces yet), returned or denied.
Native Tleilaxu Allow/Prevent, actual typed reserves, once-only free income,
Axlotl activity and original Homeworld handling settle the same physical group.
Prevention remains a visibly provisional composition; ordinary LaLaLa/free
rates do not reprice this independent extra source. No ordinary force/free or
native Emperor allied-extra usage grows, and no leader/payer/refund is invented.
Denial retains both spent cards and returns no forces/income/Tech. Original
Southern Hemisphere can place the actual returned Fedaykin; Tleilax's ordinary
Free Revival deployment is not extended to an independently free producer.
Strict old completed physical receipts stay readable without replay.
Historical snapshots do not require later pools/wallets to remain unchanged.

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

Seller-paid Richese/CHOAM transactions, allied split, expansions and other
Secret Ally purchase sources remain gated. The separate normal-auction forced
Emperor-payment Betrayal now has a connected
[provisional full-price funding path](NEXUS_EMPEROR_RULES.md#recommended-original-full-price-funding--14-october-2026).
The [Secret Ally source contract](NEXUS_EMPEROR_RULES.md#secret-ally-retain-the-actual-purchase-price)
retains its distinct seller-payment boundary.

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
