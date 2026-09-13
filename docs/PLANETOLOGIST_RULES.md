# Planetologist rule contract

Updated 13 September 2026. This note audits the movement and battle effects of the
Planetologist Leader Skill against its physical card, the common Leader Skills
rules, the GF9 base battle rules and designer Jack Reda's walkthrough. The connected prototype is described below; other Leader Skill effects remain separate work.

## Printed effect and legal card role

The physical Planetologist card instructs its owner to reveal one green
Special card, other than a Cheap Hero, as part of the Battle Plan “in place of
a weapon.” It adds 2 to that skilled leader disc and says to discard the
Special after the battle. The card therefore creates a distinct legal role for
the physical Special card:

- it occupies the Battle Plan's weapon slot;
- it is revealed as a Special used in place of a weapon, rather than converted
  into a Weapon Treachery Card;
- it supplies no projectile, poison, lasgun or other attack and does not satisfy
  a skill or rule that requires an actual named Weapon type;
- its printed utility effect is not activated; and
- the exact physical card is committed to that plan and cannot also be spent
  for its ordinary effect, Karama, Truthtrance or another pending use.

The designer gives Hajr and Thumper as examples, then specifically describes
using Family Atomics for +2 without blowing the Shield Wall. This confirms
that Planetologist grants an alternate battle use despite the Special card's
ordinary phase or trigger. [Jack Reda walkthrough,
10:36–11:05](https://www.youtube.com/watch?v=XT_azRVLq_0&t=636s)

The substitution is available only when the assigned Planetologist leader is
the leader actually used in the Battle Plan. Moving the skilled leader and
skill card behind the shield as a bluff, then selecting another leader, turns
off both skill bands. The other leader cannot place a green Special in the
weapon slot through Planetologist. [GF9 *CHOAM & Richese* rulebook,
p. 9](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

## Current base-deck inventory

The current 33-card base deck contains these eligible printed green Special
cards:

| Printed card | Physical copies | Current identities |
|---|---:|---|
| Family Atomics | 1 | `effect: atomics` |
| Weather Control | 1 | `effect: weather` |
| Hajr | 1 | `effect: hajr` |
| Tleilaxu Ghola | 1 | `effect: ghola` |
| Harvester | 1 | `effect: harvester` |
| Karama | 2 | `effect: karama` |
| Truthtrance | 2 | `effect: truthtrance` |

All nine physical copies may take the Planetologist weapon-slot role. Their
ordinary timing does not need to be legal because that printed effect is not
being played. A pending or already committed physical card remains unavailable
because Planetologist does not create a second copy.

Cheap Hero and Cheap Heroine are printed green Special components but are
excluded. “Cheap Hero” is the rules' generic component class for both named
copies; each instead occupies the leader position with strength zero. The base
FAQ also says a Cheap Hero cannot substitute for a weapon or defense.
[GF9 base rulebook and Q&A, pp. 10,
23](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

For today's `baseDeck()`, `kind === 'special'` happens to select the nine
eligible non-Hero copies. That coincidence is not the printed rule. Eligibility
should be bound to a canonical printed-green-Special classification or explicit
physical identities, because the code's generic `special` kind is also used by
later expansion modules. The designer's Thumper example proves that expansion
cards can qualify, but it does not make every future card encoded as `special`
green or eligible.

## Survival and scoring

The common Leader Skills rule says a skill applies in the current battle unless
its assigned leader is killed in that battle. Planetologist adds 2 to the leader
disc, so the receipt is conditional on that exact leader surviving weapon,
traitor and explosion resolution. If the leader dies, neither its printed
strength nor the Planetologist +2 contributes to the battle total.
[GF9 *CHOAM & Richese* rulebook, p.
9](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

A captured skilled leader follows the expansion's general Harkonnen Q&A: the
captor has only the lower battle band and only while actually using that
captured leader. A surviving captured Planetologist may therefore use the same
green-Special substitution and +2; the original faction has no normal movement
band while the leader and skill are captured.

## Mandatory discard

The Special card's own final instruction is unconditional once it is revealed
through this substitution: discard it after the battle. This is more specific
than the base rule allowing an ordinary winner to keep cards played in its
plan. The physical outcome is:

| Battle outcome | Planetologist Special disposition |
|---|---|
| Ordinary win | Discard; the winner has no retention choice for this card. |
| Ordinary loss | Discard under both the base loser rule and the skill card. |
| Opponent reveals the Planetologist leader as a traitor | Discard with the traitored player's played cards; the leader dies and supplies no +2. |
| Both leaders are traitors | Discard with the played cards; the Planetologist leader dies and supplies no +2. |
| Lasgun–shield explosion | Discard after the battle; a killed Planetologist supplies no +2. |
| Planetologist owner reveals the opposing leader as a traitor | Discard under Planetologist's later, card-specific instruction even though the base traitor winner ordinarily loses nothing. |

The last row is a rules-specificity inference. No located publisher Q&A asks
about Planetologist versus a successful traitor call. The physical Leader Skill
plainly says to discard after the battle and prints no winner or traitor
exception, so retaining it would require adding an exception absent from the
later card. The [GF9 November 2020
FAQ](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)
confirms the general winner-retention rule, while the Planetologist card supplies
the narrower override.

“Unused bluff” needs a physical distinction. A green Special actually revealed
in the weapon slot through Planetologist has been used in that alternate role
and is discarded even when +2 cannot affect the result or the winner is decided
by a traitor. A Special merely carried behind the shield but omitted from the
Battle Plan remains in hand; no rule reveals or discards it. A plan using a
different leader cannot legally commit the Special in Planetologist's role.

## Persistent evidence

The source archive at `/home/quintine/.local/share/dune/sources` contains:

- `leader-skills-tabletopfinder-all-upscaled.png`, on which the complete
  Planetologist face is readable;
- `leader-skills-designer-video-auto-transcript.txt`, with the Planetologist
  explanation at transcript seconds 594–666;
- `choam-richese-rulebook-en.pdf` and its layout-preserving text extraction;
  and
- `dune-rulebook-gf9-mirror.pdf` and its extraction, preserving the common
  battle disposition and traitor rules.

The designer's [official expansion
page](https://futurepastimes.com/dune-choam-richese) links the GF9 rulebook.
The full local source hashes and retrieval URLs are recorded in
`leader-skills-source-provenance.txt`.

## Implementation boundary

A focused implementation can expose the nine base physical copies as weapon
slot choices only for the selected, concealed Planetologist leader. It should
record the selected physical identity and alternate role in the sealed plan,
apply +2 only after confirming that leader survives, suppress the card's native
effect, and force exactly one discard after every revealed outcome. Rejected or
canceled plan changes must release the reservation without discarding the card.

Expansion eligibility should be added from each component's printed category,
not inferred from the shared TypeScript `special` bucket. The traitor-winner
discard row should remain documented as the explicit later-card reading because
the sources contain no direct Q&A for that collision.

## Normal movement and supported prototype

The first band gives a choice for one movement: add one to normal range with a
maximum of three, or gather physical forces from exactly two different territories
to one shared destination using each group's ordinary range. These alternatives
do not stack. Moving multiple selected sectors of the same territory remains one
origin. Both groups retain normal storm, path, occupancy and force-selection rules;
the combined move spends one movement. Hajr can provide another normal movement.
See the [physical-card contract](LEADER_SKILLS_RULES.md) and the designer's
[example](https://www.youtube.com/watch?v=XT_azRVLq_0&t=1153s).

Fremen's native range and Planetologist are independent. With the range alternative,
a distance-two move needs only ordinary range one plus Planetologist. Distance
three without city ornithopters uses the Fremen advantage and opens its real
Karama response. Cancellation leaves forces and the movement opportunity in place;
the replacement may still use Planetologist. A gather using Fremen range two also
retains that response, with both origins saved and revalidated before continuation.
This applies the [existing cancellation contract](FREMEN_MOVEMENT_KARAMA_RULES.md),
not a new phase-wide restriction or an automatic shortened destination.

The [November 2020 FAQ, p. 4](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)
and [base rules, p. 18](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)
determine a common Bene Gesserit arrival stance when no other faction is present,
or when existing BG forces determine the stance. The prototype supports mixed
advisor/fighter origins in those cases, and uniform origins generally. Source
advisor locks carry forward. Mixed origins entering an enemy-only territory need
a combined advisor-flip/cancellation continuation and remain explicitly guarded;
this is an implementation gap, not a rule that forbids every mixed move. No source
was found granting a chosen group order that makes fighters arrive as advisors.

The current runtime supports only the six base factions and the nine base green
Special copies above. Expansion rosters, other optional modules, No-Field and
Discovery/Richese flight combinations remain gated. Before enabling Ix, calculate
range for each selected origin's own cyborgs and extend its cancellation trigger
for Planetologist's added range. Aggregate elite counts must not lend one group's
cyborg speed to a separate suboid-only origin. The expansion green-Special inventory
must also be audited before admitting those physical cards.

The movement control builds ordinary authoritative actions with an explicit range
or gather choice. Bots use the same range helper and submit physical source/elite
counts. Saved Fremen continuations bind the selected skill leader, choice and exact
two-origin list; stale custody or receipts reject before spending a response card.
The weapon selector exposes eligible Specials only for the selected skilled leader
and explains +2 and mandatory discard. Bot candidates use that same eligibility and
pair validation. This is a connected prototype with partial combination coverage,
not complete Leader Skills compliance or a publication gate.

## Verification evidence, 13 September 2026

The final focused union passes 84 cases, including the 24-case Planetologist
union and existing skills, Fremen cancellation and battle quote regressions.
Independent movement and battle review closed after the stale already-dead disc
reproducer was fixed. First-choice tests prove all four bot profiles actually use
both alternatives in suitable fixtures. Two source-bound full-game samples finish
with zero rejected actions and six saved restorations each; Basic executes both
movement choices, Advanced executes boosted range. These do not establish full
combination acceptance or calibrated difficulty ordering.

The browser journey verifies genuine setup, range availability, physical gather,
private refresh and the weapon selector's Special role. A separately staged battle
in that new QA room verifies traitor-loss cleanup, one Special discard, skill death
return and the unchanged Shield Wall. [The checkpoint record](IMPLEMENTATION_STATUS.md)
separates those fixtures from the complete-game samples. Required broad check
results, source fingerprints and saved-game comparisons are retained privately
outside the checkout and reported in the verified commit.
