# Two players controlling two factions each

## Status and authority

**Missing; design contract only.** The [GF9 classic rulebook, printed p. 6](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=6)
offers a two-player setup in which each person plays two factions, with the
two-player four-stronghold victory requirement. The user-authorized revised
Advanced source, physical p. 4 (printed p. 2), offers the same choice and
threshold. The supplied PDF stays local; its identity and precedence are in
[the decision index](RULE_DECISIONS.md#authorized-source-amendment--1-october-2026).
The similarly titled movie game's double-faction rules are a different game
and are not authority for this mode.

Neither cited classic passage says whether the two factions controlled by one
person are automatically allied, how their holdings combine for victory, or
how controller identity affects every faction-counted ability. Do not silently
adopt the movie game's automatic alliances or blended inventories. A practical
first version can retain independent faction records, actual alliance choices,
and a four-stronghold target per eligible victory side as an explicitly
provisional policy. Resolve combined holdings and any conflicting interaction
from authoritative sources or document the chosen interpretation; this design
does not certify those answers.

## Model and setup

Keep four distinct `Player` faction records and their normal physical forces,
leaders, decks, private hands, turns and faction identities. Add an explicit,
lobby-validated association of those four distinct faction seats with exactly
two controllers, two seats per controller. A controller is not itself a
faction or a new recipient of faction income. Validate the complete mapping
before starting and reject ambiguous, duplicate, missing or stale assignments;
changing an assignment or faction clears readiness. Existing two-seat games,
already-started games, and saved positions without the new mode retain their
original interpretation and do not receive invented controller assignments.

Expose this as an explicit two-player setup option. Let each person create or
join their first seat and securely add/select their second faction before
readiness, with clear names and a persistent active-faction indicator. Avoid
claiming support for the mode until setup, both private faction views, legal
actions, turn continuation and victory all work together. The existing model
still permits ordinary two-seat play and separate one-faction controllers.

## Separate controllers from faction seats

The `players` array currently represents faction seats, not physical humans.
For this option `game/victory-progress.ts` must use the validated controller
count for the printed two-player threshold; `players.length === 2` alone is
incorrect for four faction seats. Apply any agreed threshold increase through
the same shared victory projection and quote, and retain explicit ordinary,
alliance, Ecaz and special victory ordering. Never infer controller count by
names, cookies, browser tabs, AI labels or faction alliances.

Audit each other count before changing it. Faction turn order, physical pieces,
dealt cards, faction-specific payments and action ownership can still depend on
the four faction seats. Optional-module eligibility and phase rules referring
to players must be checked against their specific source; for example, existing
Tech Token gates use `players.length >= 3` in `game/engine.ts` and
`game/faction-module-profile.ts`. A global substitution of controller count
would silently change unrelated rules. Record uncertain interpretations and
keep unsupported combinations visibly provisional rather than fabricating a
new setup or automatic alliance.

## Authentication and switching

Today `db/schema.ts` makes `seats.token_hash` the primary key;
`db/rooms.ts` authenticates a token to one `player_id` and `act` rechecks that
exact unrevoked room/player/token tuple before the versioned action. The normal
`joinRoom` path returns `alreadySeated` for an authenticated caller. Room API
routes currently use a single room-scoped HttpOnly cookie. Reusing one token
for two database rows, trusting a caller-supplied seat ID as authorization, or
projecting both seats' private information into one general view would break
those existing boundaries.

One workable implementation is an explicit authenticated add-second-seat
operation that atomically validates the lobby/controller assignment and creates
the second distinct seat credential. Provision separately random, room-scoped
HttpOnly credentials for both faction seats. A public active-seat selector may
choose which credential to present, but every API read, action, message,
control or recovery request must authenticate that selected credential and
verify its actual `player_id`; the selector itself grants no access. Apply the
same room-control, revocation, origin, retry, version and removal checks as
today. Preserve existing seat cookies and single-seat clients; use additive
schema or durable mapping changes if required, never reset the room database.
No secret token belongs in source, client-visible game state or logs.

On a faction switch, `app/page.tsx` should advance its existing request epoch,
discard stale cross-seat results and fetch the selected authorized view. Fence
in-flight actions and responses by room, selected seat and version so a delayed
response from the other faction cannot overwrite or act through the current
view. Explicitly handle refresh and recovery of both distinct credentials,
individual revocation, host assignment and relinquishment; a recovered or
revoked seat must not accidentally grant the other seat or an opponent. Keep
the UI explicit about which faction owns each pending decision. Existing
autopilot can operate a faction seat only under its existing authorization;
until full AI refinement, each offered decision needs a minimal legal bot path.

## Integration and evidence

- Implement one shared controller/seat contract through lobby creation,
  assignment, setup, the projected active seat, action dispatch and the
  shared stronghold progress and victory quote. Retain source-specific faction
  counts and provisional boundaries rather than just adding a selector or
  changing the victory number.
- Include focused engine tests for valid/invalid mappings, original and changed
  thresholds, faction-specific private state, controlled faction decisions,
  ties and the intended victory-side interpretation. Exercise a real setup and
  a meaningful sequence using both factions of each controller; include legal
  minimal bot participation and usable action controls.
- Test authenticated add/switch/read/action with distinct credentials, denied
  target seats, stale or concurrent switches and independent private views. Do
  not expose or reset unrelated rooms; use isolated dedicated test records.
- Broader recovery, revocation, privacy and custody assurance, valid module
  combinations, complete human/AI games, browser/mobile acceptance and deployed
  verification remain required after the rules-first prototype. A passing
  focused test or this document does not certify a complete mode or change the
  publication gates.
