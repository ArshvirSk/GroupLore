"use client";

import GameLibrary, { type LibraryGame } from "@/components/GameLibrary";
import { Card, Skeleton } from "@/components/ui";
import AppHeader from "@/components/ui/AppHeader";
import { api } from "@/lib/api";
import { useEffect, useState } from "react";

export default function LibraryPage() {
  const [games, setGames] = useState<LibraryGame[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getGameLibrary()
      .then((items: LibraryGame[]) => setGames(items))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Could not load the game library"),
      );
  }, []);

  return (
    <main className="min-h-screen">
      <AppHeader />
      {error ? (
        <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
          <Card className="p-6">
            <p role="alert" className="text-sm font-semibold text-danger">
              {error}
            </p>
          </Card>
        </div>
      ) : games ? (
        <GameLibrary games={games} />
      ) : (
        <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
          <Skeleton className="mb-6 h-28" />
          <Skeleton className="mb-4 h-20" />
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
