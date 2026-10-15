import {
  harassWithdrawNeedsAllocation,
  quoteHarassWithdraw,
  type HarassWithdrawPreview,
} from '@/game/harass-withdraw';

export function harassWithdrawControlState(
  preview: HarassWithdrawPreview | null | undefined,
  selected: boolean,
  dial: number,
  support: number,
) {
  if (!selected) return { blocked: null, returned: null };
  if (!preview)
    return {
      blocked: 'Harass & Withdraw is not available in this battle.',
      returned: null,
    };
  try {
    if (
      preview.allowAllocation &&
      harassWithdrawNeedsAllocation(preview, dial, support)
    )
      return { blocked: null, returned: null };
    return {
      blocked: null,
      returned: quoteHarassWithdraw(preview, dial, support).returned,
    };
  } catch (error) {
    return {
      blocked:
        error instanceof Error
          ? error.message
          : 'Choose a supported force commitment.',
      returned: null,
    };
  }
}

export function HarassWithdrawGuide({
  preview,
  state,
}: {
  preview: HarassWithdrawPreview | null | undefined;
  state: ReturnType<typeof harassWithdrawControlState>;
}) {
  if (!preview) return null;
  return (
    <section
      aria-label="Harass and Withdraw battle guidance"
      className="notice space-y-2"
    >
      <h4>Harass &amp; Withdraw</h4>
      {preview.noField && <p>
        Provisional materialization-first timing: your No-Field stays concealed
        until both plans are sealed. Its native
        reveal materializes {preview.noField.materializes} ordinary forces at
        the marker’s sector, leaving {preview.noField.reservesAfterReveal} own
        reserves before card effects. Harass returns only actual undialed
        counters after that reveal; it never returns a concealed marker or
        resets its used-token history.
      </p>}
      {preview.occupy && <p>
        Occupy returns only the card user’s own undialed fighters, not their
        ally’s army. {preview.occupy.cardUser === preview.occupy.ecaz && !preview.occupy.canceled
          ? `The original ${preview.occupy.fixedEcazDial} fixed Ecaz fighters remain committed at free full strength; allied variable support is separate.`
          : !preview.occupy.canceled
            ? `Your physical commitment uses the variable dial after subtracting ${preview.occupy.fixedEcazDial} fixed Ecaz strength.`
            : 'With Occupy canceled, use only your selected lead’s own native army.'}
      </p>}
      {preview.blocked || state.blocked ? (
        <output className="block">{preview.blocked ?? state.blocked}</output>
      ) : state.returned ? (
        <p>
          Return {state.returned.normal} ordinary and {state.returned.elite}{' '}
          elite undialed forces to reserves when plans resolve.
        </p>
      ) : preview.allowAllocation ? (
        <p>
          After plans are revealed, choose exactly which undialed ordinary and
          elite forces return to reserves.
        </p>
      ) : (
        <p>
          Select this card in either battle-card slot. Your undialed forces
          return to reserves.
        </p>
      )}
      <p>
        Your leader can still die. An opponent’s successful traitor call cancels
        the withdrawal. Discard this card after use.
      </p>
      <p className="fine">
        Provisional Stone Burner timing: compare undialed forces remaining after
        a successful withdrawal, not the forces already returned to reserves.
        In Occupy, the other ally’s undialed forces still count.
      </p>
    </section>
  );
}
