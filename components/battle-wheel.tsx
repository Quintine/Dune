'use client';

import { useId } from 'react';
import styles from './battle-wheel.module.css';

export type BattleWheelProps = {
  value: number;
  onChange: (value: number) => void;
  max: number;
  step: number;
  disabled?: boolean;
  id?: string;
};

const point = (angle: number, radius: number) => ({
  x: 100 + Math.sin((angle * Math.PI) / 180) * radius,
  y: 100 - Math.cos((angle * Math.PI) / 180) * radius,
});

/** The parent supplies the dial limits and labels the numeric input by its ID. */
export function BattleWheel({
  value,
  onChange,
  max,
  step,
  disabled = false,
  id = 'forces-dialed',
}: BattleWheelProps) {
  const graphicId = useId();
  const rimId = `${graphicId}-rim`;
  const faceId = `${graphicId}-face`;
  const fraction = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const angle = -135 + fraction * 270;
  // This caps decorative detail only; the native controls keep the supplied step.
  const divisions = Math.min(80, Math.max(1, Math.ceil(max / step)));
  const labels = [
    ...new Set(
      [0, 0.25, 0.5, 0.75, 1].map((position) =>
        Math.min(max, Math.round((max * position) / step) * step),
      ),
    ),
  ];

  return (
    <div className={styles.root} data-disabled={disabled || undefined}>
      <svg
        className={styles.wheel}
        viewBox="0 0 200 200"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient id={rimId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e3c68a" />
            <stop offset="0.35" stopColor="#756344" />
            <stop offset="0.65" stopColor="#302d24" />
            <stop offset="1" stopColor="#b29966" />
          </linearGradient>
          <radialGradient id={faceId} cx="40%" cy="28%" r="75%">
            <stop offset="0" stopColor="#30362b" />
            <stop offset="1" stopColor="#131810" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="102" r="96" fill="#080b07" opacity="0.6" />
        <circle cx="100" cy="100" r="95" fill={`url(#${rimId})`} />
        <circle cx="100" cy="100" r="91" fill="#181d15" />
        <circle
          cx="100"
          cy="100"
          r="87"
          fill="none"
          stroke="#736344"
          strokeWidth="0.6"
        />
        {Array.from({ length: divisions + 1 }, (_, index) => {
          const position = index / divisions;
          const tickAngle = -135 + position * 270;
          const major = index % Math.max(1, Math.round(divisions / 4)) === 0;
          const outer = point(tickAngle, 83);
          const inner = point(tickAngle, major ? 73 : 78);
          return (
            <line
              key={index}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke={position <= fraction ? '#e3c68a' : '#777762'}
              strokeWidth={major ? 1.7 : 0.8}
            />
          );
        })}
        {labels.map((mark) => {
          const label = point(-135 + (max > 0 ? mark / max : 0) * 270, 62);
          return (
            <text
              key={mark}
              x={label.x}
              y={label.y}
              fill="#d1c4a4"
              fontSize="12"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {Number(mark.toFixed(2))}
            </text>
          );
        })}
        <circle
          cx="100"
          cy="100"
          r="44"
          fill={`url(#${faceId})`}
          stroke="#89764d"
          strokeWidth="1"
        />
        <circle
          cx="100"
          cy="100"
          r="40"
          fill="none"
          stroke="#c6ad76"
          strokeOpacity="0.15"
        />
        <path
          d="M 96 29 L 100 18 L 104 29 Z"
          fill="#f2d79b"
          stroke="#171b12"
          strokeWidth="0.8"
          transform={`rotate(${angle} 100 100)`}
        />
        <text
          x="100"
          y="101"
          textAnchor="middle"
          dominantBaseline="central"
          className={styles.chosen}
        >
          {value}
        </text>
        <text
          x="100"
          y="124"
          textAnchor="middle"
          fill="#c0b290"
          fontSize="9"
          letterSpacing="1.6"
        >
          DIALED
        </text>
        <path d="M 85 173 H 115" stroke="#a28b5e" strokeWidth="1" />
        <circle cx="100" cy="180" r="1.5" fill="#a28b5e" />
      </svg>
      <div className={styles.controls}>
        <div className={styles.slider}>
          <input
            className={styles.range}
            type="range"
            min={0}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            aria-label="Forces dialed slider"
            onChange={(event) => onChange(Number(event.target.value))}
          />
          <div className={styles.bounds} aria-hidden="true">
            <span>0</span>
            <span>{max}</span>
          </div>
        </div>
        <input
          className={styles.number}
          id={id}
          type="number"
          min={0}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
    </div>
  );
}
