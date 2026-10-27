'use client';
import { useId } from 'react';
import { Input } from '@/components/ui/input';
export function EliteCount({
  value,
  onChange,
  max,
  min = 0,
  label = 'Elite forces included',
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  min?: number;
  label?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id}>
      {label}
      <Input
        id={id}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
