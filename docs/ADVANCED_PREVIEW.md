# Advanced preview

The user explicitly authorized a clearly labeled unfinished Advanced mode on
21 September 2026. This changes access to the existing development game, not
the rules-completion or publication criteria.

## Select and start

1. On the home page, choose **Rules → Advanced preview**, then **Create a room**.
2. Choose the desired expansion families, then invite players or add AI seats.
   Games support two through six players from the selected families and classics.
3. Optionally choose **Leader Skills**, **Ecaz Treachery Cards**, **Nexus Cards**,
   **Discoveries**, **Homeworlds**, **Tech Tokens** (three or more players) or
   **Stronghold Cards**. Supported module/roster combinations use their existing
   setup; unsupported selections reject at start with a reason.
   With native CHOAM, classic factions and exactly the CHOAM and Ix decks, the
   host may instead select the unfinished printed-Kull preview without other
   optional modules. Its effect-specific duration and combination limits are
   shown in the lobby and remain provisional.
4. Each human chooses **Ready for Advanced preview**. The host chooses
   **Begin Advanced preview**.

The host can also change **Rules** in an existing lobby. Changing modes or module
selections clears human readiness; native AI seats remain ready. Switching to
Basic removes unused Stronghold Cards and keeps Tech Tokens. Rules cannot change
after setup starts. Joining a room uses that room's existing rules.

The warning remains visible throughout Advanced play, including older Advanced
development saves. Games use the existing room save, reconnect and private seat
system. Basic remains the default.

## Simultaneous victories

When multiple unallied players qualify for ordinary victory, Advanced compares
their stronghold counts and awards the higher count before checking a Bene
Gesserit prediction. Equal highest counts provisionally share the win; a set of
all three Tech Tokens counts as one additional stronghold in this comparison.
Qualifying alliances and the separate Ecaz Homeworld victory retain their
existing shared-winner treatment. Basic keeps its shared-win ranking.

The publisher FAQ for Basic and the authorized revised rules for Advanced also
permit qualifying players or alliances to agree to play another full turn and
optionally raise the stronghold target. The provisional agreement is offered
when at least two distinct sides qualify in Basic, or when equal highest solo
qualifiers or other distinct sides qualify in Advanced. Every member of those
sides responds in storm order. The first may finish or propose another turn
with a whole-number target increase from zero through 20; each later member
accepts that exact proposal or finishes. Voter scope, ordered controls and the
input cap are online conventions. Finishing resolves the original result and
any correct private prediction; unanimous acceptance continues without revealing
that prediction.

The increase adds to the ordinary solo and alliance stronghold targets, while
independent Ecaz joint-occupation and Homeworld special-victory conditions stay
separate under the provisional interpretation. The original Mentat phase
continues unless CHOAM's completed end-of-Mentat opportunity was the source,
in which case the next turn begins. The final turn defaults to ten; an agreement
at the current final turn provisionally extends it by one, including a turn-ten
agreement. The Fremen and Guild final-victory checks move to the agreed final
turn under this interpretation, even though the supplied Fremen sheet names the
end of turn ten. Repeated extensions can move the final turn further. Broader
special-victory cases and full natural extended-turn verification remain open.
[Source and interpretation](RULE_DECISIONS.md#advanced-simultaneous-solo-stronghold-victories--27-october-2026).

## Admission and saved behavior

Normal room creation already stores `advanced: boolean`; the same request format
and exact tab retry are retained. The host-only lobby action
`{type: 'rules', advanced: boolean}` changes the mode. The ordinary start action
must contain `advancedPreview: true` for Advanced; a bare start remains rejected.
Core Advanced starts record `Game.advancedPreview: true`, projected as a boolean.
Expansion/module starts retain their own setup markers instead: some module
profiles deliberately exclude the core-only marker. The explicit Advanced
opt-in remains required for every Advanced start.

Start calls the genuine shared setup pipeline, including prediction, Traitors,
starting forces, advisors, elites and the starting Treachery deal at their normal
stages. Public starts now call the same genuine setup entries as development
tools; this is not permission to dispatch arbitrary initializer/profile names.
Fresh-lobby and unused-module checks still prevent accidental redealing. Restored
core preview markers must match their mode and roster. Mode changes and ordinary
continuation retain the existing version/CAS fence and private views.

The 17 October lobby-access pass opens expansion factions and supported optional
modules as previews; it does not remove their existing composition guards.
Skills and the independent Ecaz cards use lobby-only selections consumed during
start; the other modules retain their existing undealt lobby shape. Every
selected module must be honoured or the start rejected. Ecaz selections must
also support their mandatory allied Arrakis Occupy battle; fresh Ecaz/classic
Homeworlds now compose that path, with or without the supported Skills entry.
Special development profiles remain separate. No pending rules ruling or
complete-mode/publication gate is resolved by opening these controls; see the
[decision index](RULE_DECISIONS.md).

## Evidence and limits

- `advanced-preview.test.ts`: normal explicit starts, strict authority/admission,
  readiness, Basic fallback, genuine setup for all 57 base rosters with each of
  four existing legal AI profiles, card/force custody, JSON and private views.
- `advanced-preview-controls.test.ts`: visible mode/warning/host controls and
  exact Advanced create-request restoration.
- `advanced-preview-recovery.test.ts`: production room SQL, fresh module reload,
  both private seats, unchanged rejected requests and start/rules CAS races.
- `advanced-preview-http.test.ts`: normal authenticated endpoints, explicit
  opt-in, origin/authority checks, readiness, duplicate start and refresh.

An Advanced six-seat sample exposed an Intrusion save boundary: a shipment
without an accompanying-advisor offer stored `followup: undefined`, which JSON
removed and changed the restored private views. Ordinary and Junction shipment
calls now omit that field when no follow-up exists. Focused regressions cover
both routes and every seat across JSON restoration. The same genuine six-seat
seed then completed at turn 10 after 1,531 actions and 41 restores. A separate
ten-game Basic/Advanced base-roster matrix (two through six seats) completed
with no rejected actions; these samples do not certify all Advanced interactions.

The private checkpoint directory records final check/build/HTTP results, ordinary
preview-start complete-game samples, browser checks and saved-game preservation.
These are development samples, not AI calibration or complete interaction coverage.
Advanced base powers and timing audits remain unfinished, including the recorded
Guild/special-Karama boundaries and advisor interactions. Stronghold Cards and
Tech Tokens retain their existing implementation limits. Full visual acceptance,
complete rules compliance and publication remain open.
