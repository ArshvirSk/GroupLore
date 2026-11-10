import AuthProvider from "@/components/AuthProvider";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GroupLore — Personalized Party Games",
  description:
    "Real-time multiplayer mini-games personalized for your friend group. Inside jokes, traits, and chaos — all in one place.",
  keywords: [
    "party games",
    "multiplayer",
    "friend group",
    "real-time",
    "social games",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#2563eb",
          colorBackground: "#0a0a0a",
          colorInputBackground: "#111111",
          colorInputText: "#fafafa",
          colorText: "#fafafa",
          colorTextSecondary: "#a1a1a1",
          borderRadius: "0.75rem",
        },
        elements: {
          card: "bg-[#0a0a0a] border border-white/[0.08] shadow-xl",
          formButtonPrimary:
            "bg-[#2563eb] hover:bg-[#3b82f6] text-white font-semibold tracking-tight",
          formFieldInput:
            "bg-[#111111] border-white/[0.08] text-white placeholder:text-white/35",
          footerActionLink: "text-[#2563eb] hover:text-[#3b82f6]",
          headerTitle: "text-white font-black tracking-tighter uppercase",
          headerSubtitle: "text-[#a1a1a1]",
          socialButtonsBlockButton:
            "bg-[#111111] border-white/[0.08] text-white hover:bg-[#1a1a1a]",
          dividerLine: "bg-white/[0.08]",
          dividerText: "text-white/35",
        },
      }}
    >
      <html lang="en">
        <body className="cosmic-bg min-h-screen">
          <AuthProvider>
            <div className="relative z-10">{children}</div>
          </AuthProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
