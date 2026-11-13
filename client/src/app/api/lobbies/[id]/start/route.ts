import type { NextRequest } from "next/server";
import { requireHost, requireUser } from "@/server/api/auth";
import { ApiFailure, apiJson, handleApi, readJson } from "@/server/api/http";
import { getGame } from "@/server/games/index.js";
import { setLobbyStatus } from "@/server/lib/lobby.js";
import { loadLobby } from "@/server/lib/membership.js";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handleApi(async () => {
    const { id } = await params;
    const user = await requireUser(request);
    const lobby = await requireHost(user.id, id);

    if (lobby.status !== "open") {
      throw new ApiFailure(
        409,
        "lobby_not_open",
        "This lobby has already started",
      );
    }

    const body = await readJson(request);
    const game = getGame(String(body?.gameId || ""));
    if (!game) {
      throw new ApiFailure(404, "not_found", "That game does not exist");
    }

    const mode = String(body?.mode || "classic");
    if (!game.modes[mode]) {
      throw new ApiFailure(400, "unknown_mode", "Unknown mode");
    }

    const connected = (lobby.lobby_players || []).filter(
      (player: { connected: boolean }) => player.connected,
    );
    if (connected.length < game.minPlayers) {
      throw new ApiFailure(
        409,
        "not_enough_players",
        `${game.name} needs at least ${game.minPlayers} connected players`,
      );
    }
    if (connected.length > game.maxPlayers) {
      throw new ApiFailure(
        409,
        "too_many_players",
        `${game.name} allows at most ${game.maxPlayers} connected players`,
      );
    }

    const { data: session, error } = await supabase
      .from("game_sessions")
      .insert({
        lobby_id: lobby.id,
        game_type: game.id,
        status: "lobby",
        current_round: 0,
        round_data: {},
        scores: {},
      })
      .select("*")
      .single();
    if (error) throw error;

    await setLobbyStatus(lobby.id, "in_game");
    return apiJson(
      {
        sessionId: session.id,
        lobby: await loadLobby(lobby.id),
      },
      201,
    );
  }, "Failed to start the game");
}
