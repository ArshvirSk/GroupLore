export function nextEloRating({ rating = 1000, opponentRating = 1000, won = false, k = 24 }) {
  const expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
  return Math.round(rating + k * ((won ? 1 : 0) - expected));
}

export function rivalryPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

export function achievementRows({ groupId, userId, rating, gamesPlayed, wins }) {
  const rows = [];
  const add = (key, label) =>
    rows.push({ group_id: groupId, user_id: userId, key, label });
  if (wins >= 1) add("first_win", "First win");
  if (wins >= 5) add("five_wins", "Five-time champion");
  if (gamesPlayed >= 10) add("ten_games", "Ten games deep");
  if (rating >= 1100) add("rating_1100", "Rising rival");
  if (rating >= 1200) add("rating_1200", "Group legend");
  return rows;
}

/**
 * Update per-game Elo, pairwise rivalries and milestone achievements after a
 * finished group game. Best-effort: a failure must not affect the game result.
 */
export async function recordProgression({
  supabase,
  groupId,
  gameId,
  ranking,
  players,
}) {
  if (!groupId || !gameId || ranking.length < 2) return;
  const rankingByPlayer = new Map(
    ranking.map((entry) => [entry.playerId, entry]),
  );
  const participants = [...players.values()]
    .filter((player) => player.userId)
    .map((player) => ({
      userId: player.userId,
      result: rankingByPlayer.get(player.id),
    }))
    .filter((entry) => entry.result);

  if (participants.length < 2) return;

  const userIds = participants.map((entry) => entry.userId);
  const { data: existingRows } = await supabase
    .from("player_game_ratings")
    .select("*")
    .eq("group_id", groupId)
    .eq("game_type", gameId)
    .in("user_id", userIds);
  const existing = new Map(
    (existingRows || []).map((row) => [row.user_id, row]),
  );
  const winnerIds = new Set(
    ranking[0]?.score > 0
      ? ranking
          .filter((entry) => entry.score === ranking[0].score)
          .map((entry) => entry.playerId)
      : [],
  );

  const ratings = new Map();
  const ratingRows = [];
  for (const entry of participants) {
    const row = existing.get(entry.userId) || {
      rating: 1000,
      games_played: 0,
      wins: 0,
    };
    const opponents = participants.filter(
      (candidate) => candidate.userId !== entry.userId,
    );
    const opponentRating =
      opponents.reduce(
        (sum, candidate) => sum + (existing.get(candidate.userId)?.rating || 1000),
        0,
      ) / Math.max(opponents.length, 1);
    const won = winnerIds.has(entry.result.playerId);
    const rating = nextEloRating({
      rating: row.rating,
      opponentRating,
      won,
    });
    const next = {
      group_id: groupId,
      user_id: entry.userId,
      game_type: gameId,
      rating,
      games_played: Number(row.games_played || 0) + 1,
      wins: Number(row.wins || 0) + (won ? 1 : 0),
      updated_at: new Date().toISOString(),
    };
    ratings.set(entry.userId, next);
    ratingRows.push(next);
  }
  await supabase
    .from("player_game_ratings")
    .upsert(ratingRows, { onConflict: "group_id,user_id,game_type" });

  const { data: rivalryRows } = await supabase
    .from("player_rivalries")
    .select("*")
    .eq("group_id", groupId)
    .in("user_a", userIds)
    .in("user_b", userIds);
  const rivalryMap = new Map(
    (rivalryRows || []).map((row) => [`${row.user_a}:${row.user_b}`, row]),
  );

  const rivalryUpdates = [];
  for (let i = 0; i < participants.length; i += 1) {
    for (let j = i + 1; j < participants.length; j += 1) {
      const [a, b] = rivalryPair(participants[i].userId, participants[j].userId);
      const current = rivalryMap.get(`${a}:${b}`) || {
        games: 0,
        a_wins: 0,
        b_wins: 0,
        draws: 0,
      };
      const aPlayerId =
        a === participants[i].userId
          ? participants[i].result.playerId
          : participants[j].result.playerId;
      const bPlayerId =
        aPlayerId === participants[i].result.playerId
          ? participants[j].result.playerId
          : participants[i].result.playerId;
      const aWon = winnerIds.has(aPlayerId);
      const bWon = winnerIds.has(bPlayerId);
      rivalryUpdates.push({
        group_id: groupId,
        user_a: a,
        user_b: b,
        games: Number(current.games || 0) + 1,
        a_wins: Number(current.a_wins || 0) + (aWon ? 1 : 0),
        b_wins: Number(current.b_wins || 0) + (bWon ? 1 : 0),
        draws: Number(current.draws || 0) + (!aWon && !bWon ? 1 : 0),
        updated_at: new Date().toISOString(),
      });
    }
  }
  if (rivalryUpdates.length) {
    await supabase
      .from("player_rivalries")
      .upsert(rivalryUpdates, { onConflict: "group_id,user_a,user_b" });
  }

  for (const entry of participants) {
    const row = ratings.get(entry.userId);
    const achievements = achievementRows({
      groupId,
      userId: entry.userId,
      rating: row.rating,
      gamesPlayed: row.games_played,
      wins: row.wins,
    });
    if (achievements.length) {
      await supabase
        .from("group_achievements")
        .upsert(achievements, {
          onConflict: "group_id,user_id,key",
          ignoreDuplicates: true,
        });
    }
  }
}
