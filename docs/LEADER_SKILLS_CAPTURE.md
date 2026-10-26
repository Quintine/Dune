# Leader Skills and Harkonnen capture

Original source interpretation, 13 September 2026. This note resolves the public-state boundary for a
skilled leader captured by Harkonnen. It records a source interpretation for
implementation; it does not claim the Leader Skills module is complete.

## Native E3 Advanced capture entry — 27 October 2026

**Prototyped / Partial.** Fresh bare Leader Skills setups may now include
Advanced Harkonnen with Ecaz and/or Moritani and classic factions. Select the
E3 deck alone, two through six distinct registered seats and all14 Skills.
No new capture permission, optional-module flag or rule interpretation is
introduced. The existing photographed card/expansion capture procedure and
13 October assignment ruling below apply equally to these native leaders.

This first entry contains no Homeworlds, Nexus, Discoveries, independent cards,
Tech, Strongholds or Semuta. Their separate module gates remain unchanged.
The ordinary mandatory Banker ledger and actual native Moritani assassination
state are parts of the original Skills/native setup, not additional modules.
Selecting an unused E3 deck never invents a native faction or power.

A successful native capture still opens its ordinary cancellation before the
actual random disc. The known trainer/card then accompanies that one captive
publicly; other captured leaders retain their existing procedure. Keep/execute
remains a real Harkonnen choice. An unavailable normal/top skill is not lent to
the captor or retained by the captive's original faction. Use the actual captive
in one later native battle to receive only its lower effect. A survivor returns
with the same original assignment; a killed or executed trainer returns its
physical skill once through existing death handling. No replacement assignment
is fabricated while it remains alive in captivity.

Native Moritani's existing post-loss assassination opportunity and winner
cleanup retain their actual order before original Harkonnen capture. The Ecaz
Duke remains separate and cannot train. Admission does not authorize hidden
target substitution or grant a power from a selected but unseated faction.

Focused paths: [bare profile](../game/leader-skill-profile.ts),
[profile cases](../tests/e3-harkonnen-skills-profile.test.ts),
[fresh source](../tests/fixture-e3-harkonnen-capture.ts),
[native cases](../tests/e3-harkonnen-capture-runtime.test.ts).
Fresh bare Advanced E3/all14 setups now connect Harkonnen with actual Ecaz
and/or Moritani and classics. The known trainer/card follows native capture;
only its selected lower effect applies, a survivor returns the same assignment,
and death/execution returns one physical Skill. Canonical Banker/native
Moritani state remains. Other optional-module entry gates stay unchanged.

Frozen **15 affected files, 110/110**, types/lint/build and six fresh native
programmes pass: four later captive battles and two executions, using Ecaz and
Moritani sources. Actual preview initialization, original skill/card deals,
training, first Storm1+0, Guild Wait, paid shipments2/1 and original Carthag
movement earn the first battle/candidate lottery. No played hand, army, purse,
clock, capture or continuation is installed. No public-start claim is made.

Runtime includes 36 GameTable SSR renders, 6 actual Capture callbacks,
4 Retain callbacks and 2 Execute callbacks. 8 later Battle Plan packets
use native actions with leader-selector SSR; stateful select/seal callbacks
were not operated. Recorded arrays supply aggregate source/capture/later-battle
counts 336/30/34, not unique cross-programme actions.

Twelve new native cases cover both trainers, exact Warmaster lower3 without
its normal1, same-assignment survival, original poison death, execution2,
actual dealt Karama cancellation/decline and four legal policies. Five profile
cases cover fresh/live native stamps, two–six distinct seats, the paired native
roster and retained overlay gates; these are not full-game proofs for every
roster. Early feedback fixes the new source's first-Storm/printed Battle order
through real dials. A related older foreign-ghola source now finishes preceding
Advanced Revival turns through native controls before its own request.

The existing local server returned HTTP200 without restart. No HTTP/storage
boundary, saved-game/database or deployed operation changes. Local native/SSR/
callback evidence does not certify browser hydration, full modes, broader
combinations or final rules/recovery/privacy/deployed acceptance.

Proof: `/home/quintine/.local/share/dune/checkpoints/20261027-e3-harkonnen-capture-proof-v2/`;
journeys/HTML: adjacent `20261027-e3-harkonnen-capture-runtime/run/`.


## Strongest source-supported answer

A Harkonnen capture is not universally secret in the published base rules.
The explicit face-down procedure applies to the branch where Harkonnen kills
the randomly selected leader for 2 spice: the leader is placed “face down into
the Tleilaxu Tanks.” The alternative branch says Harkonnen keeps the leader for
one later battle, but does not instruct players to turn that retained leader
face down or conceal its identity. [GF9 base rulebook, p. 17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf)

The official FAQ's restricted-view answer is likewise framed around the
leader Harkonnen chose to kill and place face down in the Tanks. It authorizes
Harkonnen, the leader's original owner and Tleilaxu to inspect that dead disc;
it does not establish a general secrecy rule for every retained captive.
[GF9 FAQ, p. 6](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf)

Leader Skills adds a later, component-specific rule. A faction's one chosen
skill and its assigned leader begin face up together, and “If a skilled leader
is captured, the skill goes with them.” The expansion Q&A then says Harkonnen
may use only that leader's battle skill, and only by using the captured leader
in battle. [GF9 *CHOAM & Richese* rulebook, pp. 9, 12](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf)

The rules never literally instruct Harkonnen to announce the captured skilled
leader's name. The physical procedure nevertheless makes that identity public
or necessarily inferable. The assignment was already public, the unique skill
card must travel with the captured leader, and the card must leave play and be
shuffled into the Leader Skill deck if that leader dies. Concealing the leader
while exposing truthful custody of its unique public card is impossible without
adding a proxy or decoy component that the rules do not provide.

The source-supported implementation boundary is therefore:

- capturing the skilled leader publicly transfers that leader's attached skill
  to Harkonnen custody, which identifies that one captured leader;
- Harkonnen loses the normal/top effect and may use only the battle/lower effect
  when actually using that captured leader in a battle;
- an unskilled retained captive keeps the ordinary base-game privacy treatment;
- a captive killed for 2 spice still follows the FAQ's face-down Tanks access
  rule, although killing the skilled captive also returns its unique public
  skill card to the deck and therefore makes that particular identity
  inferable; and
- if a used skilled captive survives, the leader and attached skill return to
  the original faction together.

This is a necessary inference from the published component movements, rather
than an express publisher sentence saying “reveal the captured skilled
leader.” It is narrower than a rule that all Harkonnen captures are public.

## Source record

The [Future Pastimes expansion page](https://futurepastimes.com/dune-choam-richese)
links the GF9 expansion rules and identifies the official design/publisher
lineage. A fresh search of that designer site, the GF9 rulebook and FAQ, and
Jack Reda's official Leader Skills walkthrough found no contrary instruction
that the attached skill should be concealed or detached during capture.

The persistent local source archive is
`/home/quintine/.local/share/dune/sources`:

- `dune-rulebook-gf9-mirror.pdf` and its `.txt` extraction preserve the
  publisher-authored 2019 base rulebook. SHA-256:
  `02660bcce906d13dde65e0eb7599b49543af4d76e8cf6c7617bc19117887933c`.
  The readable mirror was retrieved from
  [1jour-1jeu's document archive](https://cdn.1j1ju.com/medias/37/57/71-dune-rulebook.pdf).
- `choam-richese-rulebook-en.pdf` and its `.txt` extraction preserve the
  publisher-authored expansion rules.
- `leader-skills-designer-video-auto-transcript.txt` preserves Jack Reda's
  card walkthrough. The walkthrough explains the skill bands but does not add
  a capture-privacy exception.

The GF9 URLs now redirect or reject some direct clients, but their indexed
publisher text and the byte-stable local copies agree on the quoted rules.

## User ruling — 13 October 2026

The original faction retains its existing Skill assignment while its trained
leader is captured. Reviving a different eligible own leader is legal, but
does not offer or draw a replacement Skill while that original assignment exists.
This is the user's selected interpretation of the authorized supplied Advanced
physical p21 condition "if you have no Leader Skill Card"; it is not a new
publisher ruling. The physical card still accompanies its captive, and the
normal band remains unavailable to both factions until the captive returns.
The existing lower battle-band and death-return mechanics remain unchanged.

The engine's earlier replacement-question guard wrongly suppressed the whole
ordinary/Ghola revival, not merely a replacement offer. The ruled implementation
removes that revival veto while retaining the existing one-assignment-per-owner
offer check. No second assignment, forced draw or replacement card is introduced.

