"use client";

import AppHeader from "@/components/ui/AppHeader";
import { Icon } from "@/components/ui/Icon";
import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
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
      <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden px-4 py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(94,77,59,.05)_.7px,transparent_.7px)] bg-[length:7px_7px]" />
        <div className="relative grid w-full max-w-[900px] overflow-hidden rounded-[24px] border border-border bg-surface shadow-soft lg:grid-cols-[.85fr_1fr]">
          <div className="relative hidden min-h-[560px] overflow-hidden bg-[linear-gradient(145deg,#fffdf8_0_44%,#c8aaf4_44%_78%,#fffdf8_78%)] p-8 lg:block">
            <Image className="relative z-10 w-[250px] -translate-x-2" src="/assets/grouplore/wordmark-transparent.png" alt="GroupLore" width={401} height={158} />
            <p className="relative z-10 mt-12 max-w-[240px] font-display text-4xl font-extrabold italic leading-[.94] tracking-[-0.07em]">A game night your group will remember.</p>
            <p className="relative z-10 mt-4 max-w-[220px] text-sm font-semibold text-ink/65">Real-time party games, personalized for your friend group.</p>
            <Image className="absolute -right-7 top-[36%] z-0 w-[190px] rotate-12 drop-shadow-[3px_5px_0_rgba(100,88,116,.35)]" src="/assets/grouplore/chrome-star-clean.png" alt="" aria-hidden width={249} height={216} />
            <Image className="absolute bottom-9 right-7 w-24 rotate-12" src="/assets/grouplore/library-checker.png" alt="" aria-hidden width={178} height={45} />
          </div>
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex w-full flex-col justify-center p-6 sm:p-9"
          >
            <p className="page-kicker"><Icon name="sparkles" className="h-3.5 w-3.5" /> {eyebrow}</p>
            <h1 className="font-display text-3xl font-bold tracking-[-0.05em] sm:text-4xl">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
            <div className="mt-6">{children}</div>
            {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}
          </motion.div>
        </div>
      </div>
    </main>
  );
}
