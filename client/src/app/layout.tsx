import AuthProvider from "@/components/AuthProvider";
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
    <html lang="en">
      <body className="cosmic-bg min-h-screen">
        <AuthProvider>
          <div className="relative z-10">{children}</div>
        </AuthProvider>
      </body>
    </html>
  );
}
