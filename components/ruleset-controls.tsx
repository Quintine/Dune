'use client';

export function AdvancedPreviewNotice({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <p className="development-note advanced-preview-note">
      <strong>Advanced preview</strong> · Rules and card interactions are still
      being completed.{' '}
      {compact
        ? 'Some play may need fixes.'
        : 'Use the six classic factions; expansion games are not available. Tech Tokens and Stronghold Cards can be enabled in the lobby.'}
    </p>
  );
}

export function RulesetControls({
  advanced,
  disabled = false,
  lobby = false,
  host = true,
  onChange,
}: {
  advanced: boolean;
  disabled?: boolean;
  lobby?: boolean;
  host?: boolean;
  onChange: (advanced: boolean) => void;
}) {
  return (
    <div>
      <label>
        Rules
        <select
          value={advanced ? 'advanced' : 'basic'}
          disabled={disabled || !host}
          onChange={(event) => onChange(event.target.value === 'advanced')}
        >
          <option value="basic">Basic</option>
          <option value="advanced">Advanced preview</option>
        </select>
      </label>
      {advanced && <AdvancedPreviewNotice />}
      {lobby && (
        <p className="fine">
          {host
            ? 'Changing rules clears player readiness. Switching to Basic removes Stronghold Cards.'
            : 'The host chooses the rules. A change clears player readiness.'}
        </p>
      )}
    </div>
  );
}
