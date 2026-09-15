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
    <div className="flex flex-col items-center gap-3">
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
            stroke="#ECEAE5"
            strokeWidth={strokeWidth}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={progress >= 1 ? "#1F9D6B" : "#17161A"}
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
          <span className="text-3xl font-semibold text-[#17161A] tracking-tight">
            {formatNumber(current)}
          </span>
          <span className="text-[11px] text-[#A6A5AB] font-mono tracking-wider mt-0.5">
            из {formatNumber(goal)}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[11px] font-mono tracking-wider text-[#6E6D73] uppercase">
          {label}
        </p>
        <p className="text-sm font-semibold text-[#17161A] mt-0.5">
          {Math.round(progress * 100)}%
        </p>
      </div>
    </div>
  );
}
