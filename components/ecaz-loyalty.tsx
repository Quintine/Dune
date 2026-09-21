import Link from 'next/link';
import { leaders } from '@/game/cards';
import type { GameView } from '@/game/engine';
import { LeaderInspector } from './leader-inspector';
import { LeaderPortrait } from './leader-portrait';

/** The server supplies only the permanently public, set-aside card identity. */
export function EcazLoyaltyCard({ loyalty }: { loyalty: GameView['ecazLoyalty'] }) {
  if (!loyalty) return null;
  const leader = leaders('ecaz').find(candidate => candidate.id === loyalty.card);
  if (!leader) return null;
  return <section aria-label="Ecaz Loyalty card" className="m-4 flex min-w-0 flex-wrap items-center gap-4 rounded-xl border border-[#90aa73] bg-[#20271f] p-4 text-[#f2e8d3]">
    <LeaderPortrait identityId={leader.id} name={leader.name} className="size-24 shrink-0" fallback={<span>Ecaz</span>} />
    <div className="min-w-0 flex-1 basis-56">
      <h3 className="m-0 font-serif text-xl">Loyalty · {leader.name}</h3>
      <p className="text-base! leading-7!">This Ecaz Traitor Card was randomly set aside face up before dealing. It stays outside the deck for this game and cannot be drawn as a Traitor or Face Dancer. Its leader remains in play under the normal leader rules.</p>
      <div className="flex flex-wrap items-center gap-3">
        <LeaderInspector kind="loyalty" identity={{ id: leader.id, name: leader.name, factionName: 'Ecaz', strength: leader.strength }} />
        <Link className="py-3 text-base underline" href="/rules?topic=ecaz-loyalty#ecaz-loyalty">Loyalty rules</Link>
      </div>
    </div>
  </section>;
}
