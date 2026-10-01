# Storm Card inspection

21 September 2026. Prototyped component inspection; Advanced and expansion gates
remain unchanged. Six numeric Storm Card faces can be enlarged from the internal
reference. An entitled Fremen player can inspect the existing private forecast,
and every viewer can inspect a card after its public reveal in the chronicle.

## Authorized Advanced Storm default — 1 October 2026

The user authorized `UNOFFICIAL_Revised_Dune_Rulebook_v.2.3_web.pdf`,
including marked unofficial rulings. **Storm Movement, physical PDF page 6**
uses a random Storm Deck card after the first turn, expressly even without
native Fremen; the last revealed card returns before the next determination.
The source has 44 physical pages and SHA-256
`7077aa87a973221d86d4bd2da945b40c4dec3d371caa6a68cb209758ddf1e516`.
Its metadata says v.2.3, while the visible editorial heading on physical
page 3 says Version 2.2. This is authorized unofficial provenance, not a
publisher simplification. The local PDF is not republished or linked in-app.

Every new Advanced opening after the first uses the existing six faces 1–6
and structured source, rather than a new saved deck array. First Storm
nearby-player 0–20 dials and Basic dials remain unchanged. A saved current
dial/card opening finishes as recorded without a reroll; the next new
Advanced turn uses the Deck. Native Fremen alone retains its actual private
next-card forecast and separate peek cancellation. Without Fremen there is
no forecast grant, canceled foresight power or extra private confirmation.
Public reveals use the existing inspector in either roster; recorded card
faces stay distinct from Weather Control or Testing Station movement.

**Verification of the new default: Partial development verified.** The
selected source-wave native/SQLite/control/bot checks pass 339/339 across
seventeen files; full types/lint, 6,169 offline cases and build pass.
A captured real prior-revision Advanced dial opening finishes
its original sum, then the next native no-Fremen opening draws a canonical
card. Actual new authenticated preview `PTSMVMDY`, privately backed up
before native preparation, reveals five sectors at turn two. Its
390-pixel inspector shows that public face, explains the roster-independent
Deck and native-only forecast, then human confirmation advances Storm
from one to six; refresh continues Spice Blow without a reroll.
Saved native inventory and original seats remain intact after isolated
build reloads. Local built-worker HTTP is 51/55, four POST 503s, not green
or deployed acceptance. Older inspection evidence below covers its stated
boundary. Public/faction/module gates and full-mode certification remain
unchanged; inspection alone did not change rules, this cutover does.

## Existing inspection contract

`game/storm-cards.ts` is a face catalog, not a new deck or source of a live draw.
The inspector accepts one already-authorized value and no game, deck or seat.
The rules gallery shows all possibilities without selecting a live card.
The existing `stormForecast` projection remains the sole private authorization.

At the real `beginStormTurn` reveal, the existing public log entry receives an
optional `{kind:'stormCard', distance}` component. Neither drawing the next card,
allowing/canceling Fremen foresight, basic dials nor Weather Control creates that
receipt. The existing saved log preserves it through JSON and the usual
250-entry history limit. Earlier text-only entries remain valid; no face is
guessed from old text or current movement. The inspector rejects unknown kinds,
extra fields and values outside the six faces.

Weather Control replaces movement and Ecological Testing Station adjusts it;
neither edits the original revealed receipt. The card inspector therefore keeps
the printed value distinct from the effective distance. No rules calculations,
AI strategies, save schema migration or network authority change.

Authority: the [classic GF9 rulebook](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf),
component inventory p.5 and Fremen sheet p.16. Publisher-indexed text retrieved
21 September confirms the six-card deck and the private forecast/public reveal,
return and shuffle sequence. The six values already used by the production engine
are represented as readable numeric faces with original explanatory prose.
This does not certify every detail of the manufactured artwork or printed face;
that remains part of final component verification. No source link enters the app.

Focused tests cover authorization, reveal metadata, legacy saves, continuation,
modified movement and invalid metadata. Independent review, browser controls,
required check/build/HTTP results, preservation and Git delivery belong to the
source-bound private checkpoint. Screenshot limitations are recorded separately;
DOM bounds do not establish complete visual acceptance.
