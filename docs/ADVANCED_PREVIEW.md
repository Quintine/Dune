# Advanced preview

The user explicitly authorized a clearly labeled unfinished Advanced mode on
21 September 2026. This changes access to the existing development game, not
the rules-completion or publication criteria.

## Select and start

1. On the home page, choose **Rules → Advanced preview**, then **Create a room**.
2. Invite players or add AI seats. The preview supports two through six of the
   six classic factions: Atreides, Harkonnen, Fremen, Emperor, Guild and Bene Gesserit.
3. Optionally enable **Tech Tokens** with at least three players, or
   **Stronghold Cards** in the lobby.
4. Each human chooses **Ready for Advanced preview**. The host chooses
   **Begin Advanced preview**.

The host can also change **Rules** in an existing base-game lobby. Changing modes
clears human readiness; native AI seats remain ready. Switching to Basic removes
unused Stronghold Cards and keeps Tech Tokens. Rules cannot change after setup
starts. Selecting Advanced on the home page clears expansion selections, which
are outside this preview. Joining a room uses that room's existing rules.

The warning remains visible throughout Advanced play, including older Advanced
development saves. Games use the existing room save, reconnect and private seat
system. Basic remains the default.

## Admission and saved behavior

Normal room creation already stores `advanced: boolean`; the same request format
and exact tab retry are retained. The host-only lobby action
`{type: 'rules', advanced: boolean}` changes the mode. The ordinary start action
must contain `advancedPreview: true` for Advanced; a bare start remains rejected.
Only a successful explicit start writes `Game.advancedPreview: true`.
`GameView.advancedPreview` projects the marker as a boolean.

Start calls the genuine shared setup pipeline, including prediction, Traitors,
starting forces, advisors, elites and the starting Treachery deal at their normal
stages. The live API never dispatches a test/audit initializer. Fresh-lobby and
unused-module checks prevent accidental redealing. Restored preview markers must
still match their supported mode and roster. Mode changes, starts and ordinary
continuation retain the existing version/CAS fence and private views.

Expansion factions/decks, Homeworlds, Nexus, Discoveries, Leader Skills, the Ecaz
Treachery variant and separate audit profiles remain rejected by normal starts.
Enabling Advanced cannot bypass those gates. For compatibility with exact older
create retries, the create API still accepts the pre-existing expansion lobby
format; those unsupported lobbies cannot start and have no expansion-removal
control yet. The preview creation UI prevents that combination. No pending ruling is resolved by
this access change; see the [decision index](RULE_DECISIONS.md).

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

The private checkpoint directory records final check/build/HTTP results, ordinary
preview-start complete-game samples, browser checks and saved-game preservation.
These are development samples, not AI calibration or complete interaction coverage.
Advanced base powers and timing audits remain unfinished, including the recorded
Guild/special-Karama boundaries and advisor interactions. Stronghold Cards and
Tech Tokens retain their existing implementation limits. Full visual acceptance,
complete rules compliance and publication remain open.
