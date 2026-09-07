'use client';

import { useState, type ReactNode } from 'react';
import Image from 'next/image';
import { leaderArt } from '@/game/leader-art';
import { specialLeaderArt } from '@/game/special-leader-art';

/** Supply only an identity already authorized for this viewer. No game/deck lookup. */
export function LeaderPortrait({
  identityId,
  name,
  fallback,
  className = 'size-20',
  sizes = '80px',
  badge,
}: {
  identityId?: string;
  name: string;
  fallback: ReactNode;
  className?: string;
  sizes?: string;
  badge?: ReactNode;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const art = leaderArt(identityId, name) ?? specialLeaderArt(identityId, name);
  if (!art || failedSource === art.src) return fallback;
  return (
    <span className={`relative block shrink-0 ${className}`}>
      <span className="absolute inset-0 overflow-hidden rounded-full border-2 border-[#c5a66d] bg-[#1b201b] shadow-[inset_0_0_0_4px_#151a15,0_5px_15px_#0005]">
        <Image
          src={art.src}
          alt=""
          width={1024}
          height={1024}
          sizes={sizes}
          loading="lazy"
          decoding="async"
          onError={() => setFailedSource(art.src)}
          className="h-full w-full object-cover"
          style={{ objectPosition: art.objectPosition }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-1 rounded-full border border-[#e6ce99]/40"
        />
      </span>
      {badge !== undefined && (
        <span className="absolute -right-1 -bottom-1 flex min-h-8 min-w-8 items-center justify-center rounded-full border border-[#dfc283] bg-[#171b17] px-1.5 font-serif text-lg leading-none text-[#fff0c5] shadow-md">
          {badge}
        </span>
      )}
    </span>
  );
}
