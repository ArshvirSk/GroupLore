"use client";

import AppHeader from "@/components/ui/AppHeader";
import { Card } from "@/components/ui";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export default function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <main className="min-h-screen">
      <AppHeader />
      <div className="hero-tint flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="w-full max-w-[460px]"
        >
          <Card className="p-6 sm:p-8">
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-[-0.04em]">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
            <div className="mt-6">{children}</div>
          </Card>
          {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
        </motion.div>
      </div>
    </main>
  );
}
