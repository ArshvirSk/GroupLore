import { apiJson, handleApi } from "@/server/api/http";
import { listGames } from "@/server/games/index.js";
import { bankStatus, unavailableReason } from "@/server/games/bankStatus.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GameModule = {
  id: string;
  name: string;
  description: string;
  emoji?: string;
  minPlayers: number;
  maxPlayers: number;
  modes: Record<string, unknown>;
};

export async function GET() {
  return handleApi(
    async () =>
      apiJson(
        listGames()
          .map((game: GameModule) => ({
            id: game.id,
            name: game.name,
            description: game.description,
            emoji: game.emoji || "🎮",
            minPlayers: game.minPlayers,
            maxPlayers: game.maxPlayers,
            modeCount: Object.keys(game.modes || {}).length,
            available: bankStatus(game.id).playable,
            unavailableReason: unavailableReason(game.id),
          }))
          .sort((a: { name: string }, b: { name: string }) =>
            a.name.localeCompare(b.name),
          ),
      ),
    "Failed to fetch the game library",
  );
}
