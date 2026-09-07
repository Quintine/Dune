'use client';
import { CircleHelp } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { HELP } from '@/game/reference';

export function HelpTip({ topic }: { topic: keyof typeof HELP }) {
  return (
    <Popover>
      <PopoverTrigger
        className="help-tip"
        aria-label={`Help: ${topic}`}
        openOnHover
        delay={200}
      >
        <CircleHelp size={14} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        className="game-help-tooltip motion-reduce:animate-none"
        aria-label={`Help: ${topic}`}
        side="top"
      >
        {HELP[topic]}
      </PopoverContent>
    </Popover>
  );
}
