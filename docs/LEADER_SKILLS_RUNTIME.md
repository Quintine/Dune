# Leader Skills first functional prototype

13 September 2026. This is **Prototyped**, with **Partial** rules coverage.
Normal mode starts and publication remain gated. The [source contract](LEADER_SKILLS_RULES.md)
contains all fourteen physical cards; the [capture interpretation](LEADER_SKILLS_CAPTURE.md)
records the fresh publisher/designer search requested by the user.

## Connected boundary

Genuine Basic or Advanced setup supports two through six base factions. Starting
Treachery Cards, including Harkonnen's extra card, precede simultaneous private
two-card skill offers. Every faction selects one physical skill and an eligible
own leader, returns the other card to the shuffled deck, and publicly assigns
the selected card before traitor choices. No reduced or duplicate skill deck is
substituted. Expansion rosters and other optional modules remain separate work.

Human controls show each permitted card's normal and battle text, select its
leader, choose battle posture, and handle an optional own-leader revival draw.
An undrawn revival offer shows no preview; drawing obliges a selection. All four
AI profiles follow the same private offers and legal actions, prioritizing the
five battle disciplines during skill selection and hiding the assigned leader for battle. This
simple policy is not calibrated skill strategy.

Warmaster, Master of Assassins, Swordmaster of Ginaz, Killer Medic and
Prana-Bindu Adept apply +1 to another selected leader from a face-up native
trainer, or +3 to the surviving assigned leader. They use the physical card's
actual weapon or defense role, including a legally supplied Portable Snooper.
They do not grant +4 or change printed strength, leader bounty or Zoal's source
value. Existing traitor, explosion and Stone Burner precedence is preserved.
Cheap Hero receives the normal +1 through ordinary leader substitution; this
is a general-rule inference, without a separately located explicit skill FAQ.

A face-up assigned disc cannot enter a plan. Concealing it while selecting
another leader gives no skill bonus. Later Voice or card use can remove the
last alternative: the mandatory remaining skilled disc then moves behind the
shield automatically, without replaying battle powers. A surviving assignment
returns face up after battle. Death returns its physical card exactly once.
An own Ghola revival during unfinished battle preparation retains that stage
through the new private draw and public posture choice.

Harkonnen capture keeps the card attached to its original leader and publicly
shows the current captor. Only the captive's lower battle effect can apply;
neither faction receives its normal effect while captured. A surviving used
captive returns with the same card. Execution returns the card to the deck;
that unique formerly public card makes this skilled leader's identity inferable.
Other captures retain the existing privacy behavior. This narrow publicity
interpretation follows the physical component procedure, not an express
publisher instruction to announce a name.

## Missing and guarded work

[Battle-effects follow-up](LEADER_BATTLE_EFFECTS.md) connects both Rihani bands
and the lower Mentat, Bureaucrat and Sandmaster effects. Their normal questioning,
payments and movement collection remain missing, along with Spice Banker normal
income, Diplomat effects and Smuggler battle collection. [Banker battle spending](SPICE_BANKER_RUNTIME.md)
now connects its lower band with separate sealed funds and survivor strength. [Smuggler shipping](SMUGGLER_SHIPMENT.md)
connects its optional normal reserve bonus. Planetologist and Suk Graduate have the connected
prototypes described below.

Captured-card replacement entitlement remains unresolved. The prototype rejects
own-leader revival while its original skill is captured, before beginning a
paid revival or consuming the Ghola/special-Karama action. This is an explicit
unsupported boundary, not a ruling that the physical game forbids that revival.
Foreign gholas, expansion rosters and combined optional modules remain gated.
Before enabling them, add response-driven automatic revival continuation
coverage; the current before/after revival observer does not certify deferred
Tleilaxu response chains. The other source-contract timing questions also remain
open. Planetologist now has bounded movement and battle controls as described below.
Remaining normal-band payments, questions, collection and the remaining
skill bands still need connected effects.

## Planetologist follow-up

[Planetologist](PLANETOLOGIST_RULES.md) connects the explicit capped range bonus,
two-origin movement to one destination, Fremen cancellation/replacement and a
surviving skilled leader's +2 green-Special substitution with mandatory discard.
The movement panel and weapon selector expose those choices; all four AI profiles
can use the same physical action paths. Pending movement receipts survive JSON
continuation and revalidate source custody before a response is spent.

Six base factions remain the supported roster. Mixed BG origins are supported
where ordinary rules determine the destination stance. Enemy-only mixed arrival
still needs a combined flip response. Expansion faction/card/module combinations
and full integrated acceptance remain unfinished. The remaining bands and skill families are
listed above; this is partial prototype coverage.

## Suk Graduate follow-up

[Suk Graduate](SUK_GRADUATE_RULES.md) connects the mandatory one-counter
normal rescue and the surviving selected leader’s optional rescue of up to three
physical casualties. Normal and elite identity, original sector, paid support,
private hands and captured-leader return survive the saved continuation. Human
controls and all four AI profiles use the same server-projected legal choices.
Advanced Atreides awaits the loss-count ruling; expansion factions and combined
optional modules remain guarded.

## Local prototype entry and evidence

Create a new base-faction local lobby, select its seats and mark them ready.
Keep its browser cookie. Use the existing backup and atomic version-check tool:

```sh
node --import tsx tools/start-prototype.ts --profile leader-skills \
  --db PATH_TO_LOCAL_D1_SQLITE --room EIGHT_CHARACTER_CODE \
  --version CURRENT_LOBBY_VERSION --out /private/new-prototype-checkpoint
```

Only that fresh named lobby is initialized; every other room and all seats stay
intact. Refresh to continue through ordinary authenticated actions. No HTTP
endpoint dispatches the initializer; do not restart or reset the database.

Focused tests cover physical inventory, setup ordering, private views, all five
bonuses, Voice legality, capture and return, death, revival and JSON restoration.
SQLite tests use production room actions across restarted stores and concurrent
selection: one choice commits, the selected card has one owner, the rejected
card returns once, and private offers remain owner-only. The local prototype
writer is separately checked for stale/redeal rejection and preserved seats.

Two seeded four-player simulations (20260913 Basic; 20260914 Advanced) completed
through genuine setup in 265 and 211 accepted actions with no rejected bot
candidates. They used Easy, Medium, Hard and Brutal, checked physical skills and
forces, and restored JSON views at fourteen sampled boundaries in total.
These were first-batch runs before the later capture and Voice review fixes;
their private report fingerprints the exact files exercised. They do not prove
all fourteen effects, Harkonnen capture or every interaction was played.

A later Advanced run including Harkonnen (seed 20260915) completed in 360
accepted actions, four turns and ten sampled JSON restores, with no rejected
bot candidates. It exercised the current controller/Voice integration. Exact
captured-card outcomes are proved by the focused capture scenarios, rather
than inferred from this sample game's completion.

Browser room `REF6YHN7` was created normally with a human Atreides and Medium
Harkonnen, then initialized through the backed-up local tool. The human inspected
both effect bands, assigned Master of Assassins to Thufir Hawat, selected a
private traitor and reached Storm. Refresh retained that assignment, the AI's
Swordmaster on Feyd-Rautha, the same Snooper hand and the pending Storm dial.
Visual inspection caught two squeezed columns in the table sidebar; single-column
cards restore readable text. This was a focused desktop setup/recovery journey,
not a complete human game or mobile acceptance.

The second reported power outage stopped the development server. All 292 rooms
were present with a clean SQLite integrity/foreign-key check; the 291 opening
rooms matched their hashes. A new online backup preceded the necessary server
start. The same browser seat then restored both skills, Snooper, private Thufir
traitor, ten spice and its pending Storm decision. No database reset or old
game restoration was performed.

Checkpoint-wide check/build/HTTP results and the final source fingerprint are
recorded in the commit and private verification report. Full module and combined
game acceptance remain unfinished.

The [Sandmaster ground-movement follow-up](SANDMASTER_MOVEMENT.md) adds explicit
routes, optional collection, human/AI controls and saved cancellation. Special
relocation and combined modules remain unfinished.
