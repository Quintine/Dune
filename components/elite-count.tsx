'use client';
import { useId } from 'react';
import { Input } from '@/components/ui/input';
export function EliteCount({
  value,
  onChange,
  max,
  label = 'Elite forces included',
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  label?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id}>
      {label}
      <Input
        id={id}
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
