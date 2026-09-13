# Deferred movement and arrival validation

13 September 2026. This work repairs a development-game deadlock without
assigning an unverified order to simultaneous expansion reactions.

## Reproduced failure and source boundary

The all-three-expansion Advanced sample from checkpoint `cab2f1c` stopped on
turn three after 614 accepted actions. Tleilaxu declared three forces moving
to Carthag, where CHOAM had one force. That opened CHOAM's Baliset opportunity.
Carthag also held Ecaz's Fremen Ambassador and a concealed Moritani Terror
token. After CHOAM declined, the unchanged arrival guard rejected the
Ambassador/Terror overlap, trapping the already accepted declaration.

CHOAM's Baliset prevents movement into an occupied territory; it does not
prevent shipment. Therefore its prevention window precedes actual entry.
Successful prevention creates no arrival. Decline or cancellation allows the
original move to be revalidated before any entry occurs. The latter is a
composition of the printed effects, not a separate combined FAQ.
[GF9 CHOAM & Richese, p. 7](https://www.gf9games.com/dune/wp-content/uploads/2021/11/CHOAM-Rulebook-low-res.pdf#page=7)

Ambassadors and Terror both offer optional effects after qualifying entry.
The Ambassador FAQ interrupts the entrant's remaining work, but neither it
nor the Terror rules establishes priority between the two. A targeted
publisher/designer search found no additional priority ruling. Their order
is material: a Fremen Ambassador can relocate forces, while Atomics kills
forces in the marked territory. The current gate remains; no storm-order
policy or lost-opportunity rule is inferred from tests.
[GF9 Ecaz & Moritani, pp. 5, 7 and 15](https://www.gf9games.com/dune/wp-content/uploads/EcazMoritani-Rulebook-LOWRES.pdf#page=5)

The user has been asked whether this overlap should stay gated pending an
official ruling or use clearly labeled provisional storm order. No answer
has been applied. The broader [Ambassador](ECAZ_AMBASSADORS_RULES.md) and
[Terror](MORITANI_TERROR_RULES.md) contracts retain other arrival-order gaps,
including Bene Gesserit reactions and child arrivals. An unavailable reaction
combination is unfinished implementation, not a rule forbidding that move in
the physical game.

## Continuation contract

Fresh ordinary movement checks its arrival through the existing shared quote
before opening native Ixian, Fremen or CHOAM prevention windows. An unsupported
destination rejects the original action without saving a pending response or
committing forces, costs or movement use. Supported single-reaction arrivals
keep their existing controls and outcomes. Ambassador-generated relocation
continues to use its own validated source and return path.

For an already saved CHOAM movement declaration, an explicit decline can return
an uncommitted move to its original mover if the typed arrival validation
rejects it. The chronicle explains the reason; the mover can choose another
action without spending its movement. This recovery does not trigger an
Ambassador or Terror effect, remove their tokens, or invent an arrival order.
Any previously reserved Ornithopter stays in escrow for a replacement move;
that exact card retires once when its use ends. No additional resources are
spent by the return itself. Unrelated failures are not swallowed. Karama cancellation retains its existing
preflight before any cancellation cost is spent.

Focused regressions and saved-state review cover both new declarations and
legacy pending choices. The checkpoint report records final verification and
sample results. This repairs continuation safety; complete simultaneous
arrival handling, expansion acceptance and public starts remain unfinished.

## Integrated sample evidence

The reusable harness repeated the six genuine-setup scenarios with base seed
20260926. All completed; the first five retain their previous action/restore
counts. Combined Advanced now finishes on turn six with CHOAM winning, after
1,303 accepted actions and 35 JSON restorations. Its 46 rejected candidates
(eight moves and 38 shipments) still encounter the explicit Ambassador overlap
guard before using a legal alternative. This is not full combination acceptance.

Separately, the exact prior failed snapshot resumes through the saved CHOAM
decline and finishes after 691 additional actions and 18 restorations, also on
turn six. Its continuation uses a new seeded stream, not reconstructed earlier
random state. It records 39 guarded candidates (seven moves, 32 shipments).
The input snapshot SHA-256 and private traces are retained in the report.
Both source-bound runs passed; subsequent result documentation changes do not
change their gameplay source. The checkpoint verifies that source correspondence.

Existing browser rooms restored the same Ecaz Storm-opening choice and Ixian
Richese auction, private cards and spice after reload. This checks outage recovery;
the new movement-return path is covered by engine and SQLite tests, not a staged
browser claim. All 632 opening saved games and original seat records matched the
backup, and the healthy development server was reused.
