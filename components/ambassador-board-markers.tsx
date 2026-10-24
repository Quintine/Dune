import { MOBILE_STRONGHOLD, territory } from '@/game/board';
import { faction } from '@/game/catalog';
import type { AmbassadorToken } from '@/game/ecaz-ambassadors';

/** Placed Ambassador faces are public. Unplaced custody never appears on the map. */
export function AmbassadorBoardMarkers({
  tokens,
}: {
  tokens: readonly AmbassadorToken[];
}) {
  return (
    <>
      {tokens.flatMap((token) => {
        if (token.zone !== 'placed' || !token.location) return [];
        const place = territory(token.location);
        const identity = faction(token.effect);
        const label = `${identity.name} Ambassador in ${place.name}`;
        // Separate Ambassadors from the force row, spice and hidden Terror markers.
        // The HMS has its own wide box, with room beside its native force row.
        const offset = token.location === MOBILE_STRONGHOLD ? [65, 24] : [-22, -59];
        return [
          <g
            key={token.id}
            transform={`translate(${place.center[0] + offset[0]},${place.center[1] + offset[1]})`}
            pointerEvents="none"
            aria-label={label}
          >
            <title>{label}</title>
            <rect x="10" y="-10" width="37" height="20" rx="5" fill="#182725" stroke={identity.color} />
            <circle r="15" fill="#182725" stroke={identity.color} strokeWidth="2" />
            <text y="5" textAnchor="middle" fill={identity.color} fontSize="15" fontWeight="700">
              {identity.sigil}
            </text>
            <text x="30" y="4" textAnchor="middle" fill="#f2dfb9" fontSize="10" fontWeight="700">
              Amb
            </text>
          </g>,
        ];
      })}
    </>
  );
}
