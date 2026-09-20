# Kwisatz Haderach component inspection

21 September 2026. Prototyped component presentation; Advanced and expansion
release gates remain closed. Original artwork and crisp interface text present
the Atreides companion separately from ordinary leader and Traitor identities.
The inspector explains its conditional strength, protection, losses, territorial
limit, death and separate revival. It does not submit or alter a battle plan.

## Connected surfaces and privacy

- The owning Advanced Atreides panel and battle composer use only `me.kwisatz`:
  exact cumulative battle losses, activation, death and this-turn usage. A capped
  seven-loss progress bar accompanies the exact count. The inspector explains
  an unavailable, dead, canceled or already-used-in-another-territory state.
- Public revealed plans and permitted Atreides full-plan inspection pass only
  the existing inclusion boolean. They never pass an owner's loss count or live
  availability. The existing reveal and inspection-owner guards remain intact.
- The reference shows a static component with no live game state. Its topic is
  linked from Advanced combat and the implementation checklist.

The unchanged `viewGame` projection authorizes owner data, including after JSON
restoration. Allies do not receive it. `KwisatzInspector` accepts no game, seat,
action or authoritative deck. The display helper explains already-projected
state; normal engine validation remains authoritative. Normal revival price,
cycle and eligibility are still provided by the existing revival controls.
No save schema, migration, network behavior or AI strategy changes.

## Authority and remaining work

Existing source records are the [classic GF9 rulebook, p.17](https://www.gf9games.com/dunegame/wp-content/uploads/Dune-Rulebook.pdf#page=17),
the [November 2020 FAQ, p.9](https://www.gf9games.com/dune/wp-content/uploads/2020/11/Dune-FAQ-Nov-2020.pdf#page=9)
and the [Ghola lifecycle ruling](GHOLA_LIFECYCLE_AND_AI.md).
The base PDF refresh returned HTTP 403 on 21 September; this checkpoint uses
the previously recorded source contract and existing tested engine behavior,
not a claim of a newly retrieved printed face. Rules prose is an original
paraphrase. The companion face and progress bar are an interface adaptation;
exact manufactured layout and every printed detail still require final review.

The portrait was generated once with the built-in image tool, inspected and
bundled locally. Provenance and dimensions are recorded in
`public/art/leaders/kwisatz-generation.json`. The character has blue irises, not
fully blue sclera; final art refinement remains open. It is not an ordinary
leader, Traitor or Face Dancer identity and is not added to those catalogs.

Recorded Suk Graduate, Reinforcements and Smuggler combinations remain governed
by [pending rule decisions](RULE_DECISIONS.md). The inspector does not resolve
them, enable modules or certify the Advanced game.

Focused tests exercise real sealed/revealed engine projections, opponent/ally
privacy, basic-mode absence, JSON restoration, display states and the bundled
asset. The full-plan rendering test uses an explicitly constructed authorized
view and separately verifies its existing owner/reveal guard; it does not prove
every source timing window. Required broad checks, independent review, browser
controls and saved-game preservation are recorded in the private checkpoint.
