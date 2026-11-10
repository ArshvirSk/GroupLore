"use client";

import { motion } from "framer-motion";

interface ConfettiExplosionProps {
  trigger: boolean;
}

export default function ConfettiExplosion({ trigger }: ConfettiExplosionProps) {
  if (!trigger) return null;

  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 400,
    y: -(Math.random() * 300 + 100),
    rotation: Math.random() * 720,
    color: ["#2563eb", "#7c3aed", "#ffffff", "#a1a1a1", "#3b82f6"][i % 5],
    size: Math.random() * 4 + 2,
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
