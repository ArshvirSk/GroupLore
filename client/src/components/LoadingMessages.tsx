"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const messages = [
  "Generating chaos...",
  "Shuffling the deck...",
  "Loading memories...",
  "Assembling the crew...",
  "Calibrating chaos levels...",
  "Summoning inside jokes...",
  "Preparing awkward moments...",
  "Loading embarrassing data...",
];

export default function LoadingMessages() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      {/* Minimal spinner */}
      <div className="relative w-10 h-10">
        <motion.div className="absolute inset-0 border-2 border-border rounded-full" />
        <motion.div
          className="absolute inset-0 border-2 border-transparent border-t-accent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Message */}
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          className="text-text-secondary text-sm tracking-wide"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          {messages[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
