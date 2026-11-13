import type { NextRequest } from "next/server";
import { requireUser } from "@/server/api/auth";
import { apiJson, handleApi } from "@/server/api/http";
import { listGames } from "@/server/games/index.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GameModule = {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  accent?: string;
  minPlayers: number;
  maxPlayers: number;
  modes: Record<string, { label?: string; description?: string }>;
};

export async function GET(request: NextRequest) {
  return handleApi(async () => {
    await requireUser(request);
    return apiJson(
      listGames().map((game: GameModule) => ({
        id: game.id,
        name: game.name,
        description: game.description,
        emoji: game.emoji || "🎮",
        accent: game.accent || "grape",
        minPlayers: game.minPlayers,
        maxPlayers: game.maxPlayers,
        modes: Object.entries(game.modes).map(([id, config]) => ({
          id,
          label: config.label || id,
          description: config.description || "",
        })),
      })),
    );
  }, "Failed to fetch the game catalog");
}
