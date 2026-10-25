'use client';

import type { Card } from '@/game/cards';
import type { Action } from '@/game/engine';
import { Button } from './ui/button';

export interface DistransTransferActionProps {
  card: Pick<Card, 'id'>;
  recipient: { id: string; name?: string } | undefined;
  given: Pick<Card, 'id' | 'name'> | undefined;
  reason: string | null;
  reasonId: string;
  busy: boolean;
  act: (action: Action) => void;
}

export function DistransTransferAction({
  card,
  recipient,
  given,
  reason,
  reasonId,
  busy,
  act,
}: DistransTransferActionProps) {
  const disabled = busy || !!reason || !recipient || !given;
  return (
    <Button
      className="min-h-11 whitespace-normal motion-reduce:transition-none"
      data-testid="distrans-transfer"
      disabled={disabled}
      aria-describedby={reason ? reasonId : undefined}
      onClick={() => {
        if (!disabled && recipient && given)
          act({
            type: 'card',
            card: card.id,
            target: recipient.id,
            give: given.id,
          });
      }}
    >
      Give {given?.name ?? 'a card'} to {recipient?.name ?? 'the recipient'}{' '}
      and discard Distrans
    </Button>
  );
}
