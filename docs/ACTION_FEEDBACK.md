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

Each notice lasts 1.5 seconds and does not intercept pointer or keyboard input.
The queue holds at most three notices including the visible one. When more
actions arrive, older pending notices merge into a count beside the most recent
action in that group; their individual details remain in the table chronicle.
A new burst never replaces the currently displayed notice. After arrivals stop,
the visible notice and pending queue finish within 4.5 seconds, rather than
retaining minutes of old events.

Initial and restored snapshots establish a silent baseline. Already-seen events
do not replay. Events received while notices are off or the page is hidden are
consumed silently. Hiding the page clears any visible or queued notice. The
**Automatic action notices** toggle remains cosmetic; it cannot submit a game
action or change a saved decision. Reduced motion removes the fade.

## Verification boundary

`tests/action-notice-queue.test.tsx` checks small updates, a full 250-entry burst,
successive bursts during an active notice, exact represented counts and the
initial nonblocking output, plus stale/duplicate sequence handling and silent
consumption without replay. `tests/completed-action-events.test.ts` exercises
committed results and pending/canceled paths. Private checkpoint evidence records
the browser checks and final source-bound verification.

Browser QA used genuine Basic Atreides/Harkonnen/Emperor setup. Private batches
advanced only that QA room through real engine actions, preserving card/force
custody and seat controllers. A seven-event burst displayed the Emperor's
**Revival** with four earlier completed actions, then drained. The chronicle
remained usable and the notice had no pointer interception. A disabled notice
control stayed empty as new chronicle entries arrived; re-enabling and refreshing
left it empty. Refresh retained the exact saved game row. At a 390-pixel viewport,
the notice container was 343 pixels within a 375-pixel document without horizontal
overflow; transient mobile text was not captured. The viewport was reset afterward.

The provider reports background tabs as visible, so an actual background-page
transition was not exercised. The cursor tests and handler review cover that
branch; the automated component test does not mount timers. Existing screenshot
capture failures leave full visual acceptance open.

This extends functional feedback; complete animation design, every successful
power tag and full visual/device acceptance remain unfinished. It does not
remove any additional player decision or resolve pending rules interpretations.
