import { territory } from '@/game/board';
import type { GameView } from '@/game/engine';

/** Public map markers never inspect the face of a placed Terror token. */
export function TerrorBoardMarkers({ tokens, atomics }: {
  tokens: readonly { status: string; location: string | null }[];
  atomics?: GameView['moritaniAtomics'];
}) {
  const groups = new Map<string, number>();
  for (const token of tokens)
    if (token.status === 'placed' && token.location)
      groups.set(token.location, (groups.get(token.location) ?? 0) + 1);
  const aftermath = atomics && territory(atomics.territory);
  const handLimitLabel = atomics?.allyAtActivation
    ? 'Moritani and the ally at activation have hand limits reduced by one'
    : 'Moritani has a hand limit reduced by one';
  return (
    <>
      {[...groups].map(([id, count]) => {
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
      })}
      {aftermath && (
        <g transform={`translate(${aftermath.center[0] - 42},${aftermath.center[1] - 22})`}
          pointerEvents="none" aria-label={`Atomics Aftermath in ${aftermath.name}: permanent shipment ban; ${handLimitLabel}`}>
          <title>{`Atomics Aftermath in ${aftermath.name}: no shipments, including Fremen reinforcements; ordinary movement and Sneak Attack remain legal. ${handLimitLabel}.`}</title>
          <circle r="15" fill="#543929" stroke="#f5bc79" strokeWidth="2" />
          <text y="5" textAnchor="middle" fill="#fff1d4" fontSize="15" fontWeight="700">A</text>
        </g>
      )}
    </>
  );
}
