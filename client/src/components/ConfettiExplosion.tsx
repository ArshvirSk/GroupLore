"use client";

import { motion } from "framer-motion";

interface ConfettiExplosionProps {
  trigger: boolean;
}

export default function ConfettiExplosion({ trigger }: ConfettiExplosionProps) {
  if (!trigger) return null;

  // Deterministic jitter keeps the render pure while still looking scattered.
  const jitter = (index: number, salt: number) => {
    const value = Math.sin(index * 12.9898 + salt) * 43758.5453;
    return value - Math.floor(value);
  };

  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: (jitter(i, 1) - 0.5) * 400,
    y: -(jitter(i, 2) * 300 + 100),
    rotation: jitter(i, 3) * 720,
    color: ["#2563eb", "#7c3aed", "#ffffff", "#a1a1a1", "#3b82f6"][i % 5],
    size: jitter(i, 4) * 4 + 2,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            opacity: 0,
            rotate: p.rotation,
            scale: 0.5,
          }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
