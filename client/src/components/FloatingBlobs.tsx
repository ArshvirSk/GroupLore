"use client";

import { motion } from "framer-motion";

/**
 * Sculptural 3D abstract shapes floating in the background.
 * Glossy spheres and geometric forms for luxury dark-mode aesthetic.
 */
export default function FloatingBlobs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Large glossy sphere - top right */}
      <motion.div
        className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(37, 99, 235, 0.12), rgba(37, 99, 235, 0.02) 60%, transparent 80%)",
          filter: "blur(1px)",
        }}
        animate={{ y: [0, -30, 0], rotate: [0, 5, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Medium sphere - left */}
      <motion.div
        className="absolute top-1/3 -left-16 w-[250px] h-[250px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 40% 35%, rgba(124, 58, 237, 0.1), transparent 70%)",
          border: "1px solid rgba(255, 255, 255, 0.03)",
        }}
        animate={{ y: [0, 20, 0], x: [0, 10, 0] }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      {/* Small accent sphere - bottom */}
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[120px] h-[120px] rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, rgba(37, 99, 235, 0.15), transparent 65%)",
          border: "1px solid rgba(37, 99, 235, 0.08)",
        }}
        animate={{ y: [0, -15, 0], scale: [1, 1.05, 1] }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 4,
        }}
      />

      {/* Geometric ring */}
      <motion.div
        className="absolute top-1/2 right-10 w-[80px] h-[80px] rounded-full"
        style={{
          border: "1px solid rgba(255, 255, 255, 0.06)",
        }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      />

      {/* Tiny dot cluster */}
      <motion.div
        className="absolute bottom-1/3 left-1/3 w-2 h-2 rounded-full bg-accent/30"
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-1/3 left-[35%] w-1.5 h-1.5 rounded-full bg-white/10"
        animate={{ opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 3, repeat: Infinity, delay: 1 }}
      />
    </div>
  );
}
