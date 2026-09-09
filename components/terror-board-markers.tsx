import { territory } from '@/game/board';

/** The map shows public stack counts without reading any hidden token face. */
export function TerrorBoardMarkers({ tokens }: {
  tokens: readonly { status: string; location: string | null }[];
}) {
  const groups = new Map<string, number>();
  for (const token of tokens)
    if (token.status === 'placed' && token.location)
      groups.set(token.location, (groups.get(token.location) ?? 0) + 1);
  return [...groups].map(([id, count]) => {
    const place = territory(id);
    const label = `${count} hidden Terror token${count === 1 ? '' : 's'} in ${place.name}`;
    return (
      <g key={id} transform={`translate(${place.center[0] + 42},${place.center[1] - 22})`}
        pointerEvents="none" aria-label={label}>
        <title>{label}</title>
        {count > 1 && <circle cx="3" cy="-3" r="15" fill="#392b41" stroke="#d6b9dc" strokeWidth="2" />}
        <circle r="15" fill="#392b41" stroke="#d6b9dc" strokeWidth="2" />
        <text y="5" textAnchor="middle" fill="#f4e1f1" fontSize="15" fontWeight="700">
          {count === 1 ? 'T' : `T${count}`}
        </text>
      </g>
    );
  });
}
