"use client";

import { useEffect, useState } from "react";

interface ProgressRingProps {
  current: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export default function ProgressRing({
  current,
  goal,
  size = 220,
  strokeWidth = 10,
  label = "Monthly Listeners",
}: ProgressRingProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(current / goal, 1);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedProgress(progress), 100);
    return () => clearTimeout(timer);
  }, [progress]);

  const dashOffset = circumference * (1 - animatedProgress);

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return n.toString();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#415A77"
            strokeWidth={strokeWidth}
            opacity={0.4}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#D4AF37"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-brass tracking-tight">
            {formatNumber(current)}
          </span>
          <span className="text-xs text-alabaster-dim tracking-widest uppercase mt-1">
            / {formatNumber(goal)}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[9px] tracking-[0.25em] uppercase text-alabaster-dim">
          {label}
        </p>
        <p className="text-base font-semibold text-alabaster mt-1">
          {Math.round(progress * 100)}%
        </p>
      </div>

    </div>
  );
}
