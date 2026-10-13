# Leader Skills and Harkonnen capture

Updated 13 September 2026. This note resolves the public-state boundary for a
skilled leader captured by Harkonnen. It records a source interpretation for
implementation; it does not claim the Leader Skills module is complete.

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

