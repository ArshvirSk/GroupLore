import { loadLobby } from "./membership.js";
import { supabase } from "./supabase.js";

export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function isValidCode(value) {
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(value);
}

export function randomCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function codeIsOpen(code) {
  const { data } = await supabase
    .from("lobbies")
    .select("id")
    .eq("code", code)
    .eq("status", "open")
    .maybeSingle();
  return Boolean(data);
}

export async function generateCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomCode();
    if (!(await codeIsOpen(code))) return code;
  }
  throw new Error("Could not allocate a room code");
}

export async function addLobbyPlayer(lobbyId, user) {
  const { error } = await supabase.from("lobby_players").upsert(
    {
      lobby_id: lobbyId,
      user_id: user.id,
      display_name: user.displayName || "Player",
      is_guest: Boolean(user.isGuest),
      connected: true,
    },
    { onConflict: "lobby_id,user_id" },
  );
  if (error) throw error;
}

export async function openGroupLobby({ groupId, user }) {
  const { data: existing } = await supabase
    .from("lobbies")
    .select("id")
    .eq("group_id", groupId)
    .eq("status", "open")
    .maybeSingle();
  if (existing) {
    await addLobbyPlayer(existing.id, user);
    return { lobby: await loadLobby(existing.id), created: false };
  }

  const code = await generateCode();
  const { data, error } = await supabase
    .from("lobbies")
    .insert({
      code,
      group_id: groupId,
      host_id: user.id,
      status: "open",
    })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") {
      return openGroupLobby({ groupId, user });
    }
    throw error;
  }

  await addLobbyPlayer(data.id, user);
  return { lobby: await loadLobby(data.id), created: true };
}

export async function createQuickLobby({ user }) {
  const code = await generateCode();
  const { data, error } = await supabase
    .from("lobbies")
    .insert({
      code,
      group_id: null,
      host_id: user.id,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;
  await addLobbyPlayer(data.id, user);
  return loadLobby(data.id);
}

export async function findLobbyByCode(code) {
  const { data } = await supabase
    .from("lobbies")
    .select("id, status")
    .eq("code", code)
    .maybeSingle();
  return data || null;
}

export async function joinLobbyByCode({ code, user }) {
  const found = await findLobbyByCode(code);
  if (!found || found.status !== "open") return null;
  await addLobbyPlayer(found.id, user);
  return loadLobby(found.id);
}

function nextHost(players, leavingUserId) {
  const remaining = players.filter((player) => player.user_id !== leavingUserId);
  if (remaining.length === 0) return null;
  const connected = remaining
    .filter((player) => player.connected)
    .sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));
  return connected[0]?.user_id || remaining[0].user_id;
}

export async function leaveLobby({ lobby, userId }) {
  await supabase
    .from("lobby_players")
    .delete()
    .eq("lobby_id", lobby.id)
    .eq("user_id", userId);

  const players = lobby.lobby_players || [];
  const remaining = players.filter((player) => player.user_id !== userId);

  if (remaining.length === 0) {
    await closeLobby(lobby.id);
    return { closed: true, hostId: null };
  }

  let hostId = lobby.host_id;
  if (hostId === userId) {
    hostId = nextHost(players, userId);
    await supabase.from("lobbies").update({ host_id: hostId }).eq("id", lobby.id);
  }
  return { closed: false, hostId };
}

export async function kickLobbyPlayer({ lobby, userId }) {
  await supabase
    .from("lobby_players")
    .delete()
    .eq("lobby_id", lobby.id)
    .eq("user_id", userId);
  const players = lobby.lobby_players || [];
  const remaining = players.filter((player) => player.user_id !== userId);
  if (remaining.length === 0) {
    await closeLobby(lobby.id);
  }
}

export async function closeLobby(lobbyId) {
  await supabase
    .from("lobbies")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", lobbyId)
    .neq("status", "closed");
}

export async function setLobbyStatus(lobbyId, status) {
  const patch =
    status === "closed"
      ? { status, closed_at: new Date().toISOString() }
      : { status };
  await supabase.from("lobbies").update(patch).eq("id", lobbyId);
}

export async function setPlayerConnected(lobbyId, userId, connected) {
  await supabase
    .from("lobby_players")
    .update({ connected })
    .eq("lobby_id", lobbyId)
    .eq("user_id", userId);
}

export async function findOpenSessionForUser(userId) {
  if (!userId) return null;
  const { data: memberships } = await supabase
    .from("lobby_players")
    .select("lobby_id, lobbies!inner(status)")
    .eq("user_id", userId)
    .eq("lobbies.status", "in_game");
  const lobbyIds = (memberships || []).map((entry) => entry.lobby_id);
  if (lobbyIds.length === 0) return null;

  const { data: session } = await supabase
    .from("game_sessions")
    .select("id")
    .in("lobby_id", lobbyIds)
    .neq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return session?.id || null;
}
