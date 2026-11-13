import { supabase } from "./supabase.js";

/**
 * Log an activity event for the feed.
 * Fire-and-forget — never blocks gameplay.
 *
 * @param {Object} opts
 * @param {string} opts.groupId  - group UUID
 * @param {string} [opts.userId] - user UUID (null for system events)
 * @param {string} opts.eventType - one of the CHECK-constrained values
 * @param {Object} [opts.payload] - arbitrary JSON context
 */
export async function logActivity({ groupId, userId, eventType, payload = {} }) {
    try {
        await supabase.from("activity_log").insert({
            group_id: groupId,
            user_id: userId || null,
            event_type: eventType,
            payload,
        });
    } catch (err) {
        // Never let logging break anything
        console.error("Activity log error:", err.message);
    }
}

/**
 * Increment a numeric stat for a player.
 * Creates the row if it doesn't exist (upsert).
 *
 * @param {string} userId - Supabase user UUID
 * @param {Object} increments - e.g. { games_played: 1, bluffs_successful: 1 }
 */
export async function incrementStats(userId, increments = {}) {
    if (!userId) return;
    try {
        // Try to get existing row
        const { data: existing } = await supabase
            .from("player_stats")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (existing) {
            const updates = { updated_at: new Date().toISOString() };
            for (const [key, val] of Object.entries(increments)) {
                updates[key] = (existing[key] || 0) + val;
            }
            await supabase.from("player_stats").update(updates).eq("user_id", userId);
        } else {
            await supabase.from("player_stats").insert({
                user_id: userId,
                ...increments,
            });
        }
    } catch (err) {
        console.error("Stats increment error:", err.message);
    }
}

/** Reputation badges derived from stats */
export function computeBadges(stats) {
    if (!stats) return [];
    const badges = [];

    if (stats.games_played >= 10) badges.push({ emoji: "🎮", label: "Regular" });
    if (stats.games_played >= 50) badges.push({ emoji: "🔥", label: "Hardcore" });

    if (stats.bluffs_successful >= 5) badges.push({ emoji: "🎭", label: "Serial Bluffer" });
    if (stats.times_survived_as_impostor >= 3) badges.push({ emoji: "🕵️", label: "Shadow Agent" });
    if (stats.times_caught_as_impostor >= 5) badges.push({ emoji: "🎯", label: "Everyone's Target" });

    if (stats.streak_best >= 5) badges.push({ emoji: "⚡", label: "Speed Demon" });
    if (stats.most_likely_to_wins >= 5) badges.push({ emoji: "👑", label: "Fan Favorite" });

    const totalGames = stats.games_played || 1;
    const winRate = stats.games_won / totalGames;
    if (winRate >= 0.6 && totalGames >= 5) badges.push({ emoji: "🏆", label: "Winner" });
    if (winRate <= 0.2 && totalGames >= 5) badges.push({ emoji: "💀", label: "Lovable Loser" });

    return badges;
}
