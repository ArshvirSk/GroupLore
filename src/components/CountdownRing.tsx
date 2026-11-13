"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface CountdownRingProps {
  seconds: number;
  running: boolean;
  size?: number;
  onComplete?: () => void;
}

export default function CountdownRing({
  seconds,
  running,
  size = 120,
  onComplete,
}: CountdownRingProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [running, onComplete]);

  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds > 0 ? remaining / seconds : 0;
  const dashOffset = circumference * (1 - progress);

  const getColor = () => {
    if (remaining <= 2) return "#ef4444";
    if (remaining <= Math.ceil(seconds / 2)) return "#f59e0b";
    return "#2563eb";
  };

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="3"
        />
        {/* Progress ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${getColor()}40)` }}
        />
      </svg>

      {/* Number */}
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        key={remaining}
        initial={{ scale: 1.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <span
          className="font-mono font-bold text-text-primary"
          style={{ fontSize: size * 0.3 }}
        >
          {remaining}
        </span>
      </motion.div>
    </div>
  );
}
