# Completed-action feedback

The existing optional house-colored notice now covers ordinary completed
shipments, ground movement, force and leader revival, spice collection, battle
results, native Guild transport and Hidden Mobile Stronghold relocation. Existing
card-specific and faction-specific labels remain where they give more context.
These notices describe committed results. Declaring a shipment or waiting for a
response does not announce that the shipment has already happened.

The server adds only a public faction and short action name to the existing
chronicle entry. No private card identity, plan, force denomination or balance
is added to the notice. Rules, choices, payments, force custody and server AI
pacing are unchanged. The optional sound system already consumes these tags;
its separate mute and volume settings still apply.

## Bursts, refresh and controls

Each notice stays visible until the player chooses **Continue** or switches
notices off. Continue dismisses only this local message; it does not submit a
game action, delay AI progress or pause a saved decision. Notices do not move
keyboard focus or open a modal. Only the notice itself intercepts pointer input;
the rest of the table remains usable. Regular text is at least 14 pixels, with
a 44-pixel minimum button height and scrolling for a short viewport.

The queue holds at most three notices including the visible one. When more
actions arrive, older pending notices merge into a count beside the most recent
action in that group; their individual details remain in the table chronicle.
A new burst never replaces the currently displayed notice. Continue displays
the next queued notice, if any, until that notice is also dismissed.

Initial and restored snapshots establish a silent baseline. Already-seen events
do not replay. Events received while notices are off or the page is hidden are
consumed silently. Hiding the page clears pending notices while preserving the
unread notice already displayed, so it is still there when the player returns. The
**Automatic action notices** toggle remains cosmetic; it cannot submit a game
action or change a saved decision. Notices have no timed fade or dismissal.

## Verification boundary

`tests/action-notice-queue.test.tsx` checks small updates, a full 250-entry burst,
successive bursts during an active notice, exact represented counts and the
initial nonblocking output, plus stale/duplicate sequence handling and silent
consumption without replay. The local presentation tests exercise Continue,
unread text across bursts/backgrounding, mute and no replay; the rendered notice
test checks readable content and its connected Continue control without focus
or modal behavior. These tests do not mount a browser DOM.
`tests/completed-action-events.test.ts` exercises
committed results and pending/canceled paths. Private checkpoint evidence records
the browser checks and final source-bound verification.

Earlier browser QA, before the persistent Continue control, used genuine Basic
Atreides/Harkonnen/Emperor setup. Private batches
advanced only that QA room through real engine actions, preserving card/force
custody and seat controllers. A seven-event burst displayed the Emperor's
**Revival** with four earlier completed actions, then drained. The chronicle
remained usable and the notice had no pointer interception. A disabled notice
control stayed empty as new chronicle entries arrived; re-enabling and refreshing
left it empty. Refresh retained the exact saved game row. At a 390-pixel viewport,
the notice container was 343 pixels within a 375-pixel document without horizontal
overflow; transient mobile text was not captured. The viewport was reset afterward.

That provider reported background tabs as visible, so an actual background-page
transition was not exercised. The cursor tests and handler review cover that
branch. That earlier timed-notice evidence does not verify the persistent
control; current browser acceptance belongs to the new checkpoint report.
Existing screenshot capture failures leave full visual acceptance open.

This extends functional feedback; complete animation design, every successful
power tag and full visual/device acceptance remain unfinished. It does not
remove any additional player decision or resolve pending rules interpretations.
