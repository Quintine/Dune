# Storm Card inspection

21 September 2026. Prototyped component inspection; Advanced and expansion gates
remain unchanged. Six numeric Storm Card faces can be enlarged from the internal
reference. An entitled Fremen player can inspect the existing private forecast,
and every viewer can inspect a card after its public reveal in the chronicle.

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
