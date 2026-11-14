import { containsProfanity, normalizeContent } from "./contentFilter.js";

function clean(value, limit = 180) {
  const text = normalizeContent(value).replace(/[\u0000-\u001f\u007f]/g, "");
  if (!text || text.length < 2 || text.length > limit) return null;
  return containsProfanity(text) ? null : text;
}

function gameName(type) {
  return String(type || "game")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Deterministic, local generation. No profile text leaves the server and no
 * model is called, so a pack can be generated without a third-party data path.
 * @param {{
 *   groupName: string,
 *   profiles?: Array<{display_name: string, traits?: string[], habits?: string[], iconic_moments?: string[], catchphrases?: string[], most_likely_to?: string[]}>,
 *   history?: Array<{payload?: {winners?: string[], winner?: string, gameType?: string}}>
 * }} input
 */
export function buildLorePack({ groupName, profiles = [], history = [] }) {
  const prompts = [];
  const answers = [];
  const seenPrompts = new Set();
  const seenAnswers = new Set();
  const addPrompt = (text) => {
    const value = clean(text);
    if (!value || seenPrompts.has(value.toLowerCase())) return;
    seenPrompts.add(value.toLowerCase());
    prompts.push({ id: `lore-prompt-${prompts.length + 1}`, text: value });
  };
  const addAnswer = (text, author) => {
    const value = clean(text);
    if (!value || seenAnswers.has(value.toLowerCase())) return;
    seenAnswers.add(value.toLowerCase());
    answers.push({
      id: `lore-answer-${answers.length + 1}`,
      text: value,
      author: clean(author, 60) || "Group member",
    });
  };

  for (const profile of profiles) {
    const name = clean(profile.display_name, 60);
    if (!name) continue;
    for (const item of profile.most_likely_to || []) {
      addPrompt(`Who in ${groupName} is most likely to ${item}?`);
    }
    for (const trait of profile.traits || []) {
      addPrompt(`Who in ${groupName} is the most ${trait}?`);
    }
    for (const habit of profile.habits || []) {
      addPrompt(`Who in ${groupName} always ${habit}?`);
    }
    for (const phrase of profile.catchphrases || []) {
      addPrompt(`Who in ${groupName} is known for saying “${phrase}”?`);
      addAnswer(phrase, name);
    }
    for (const moment of profile.iconic_moments || []) {
      addPrompt(`Who in ${groupName} will never live down ${moment}?`);
      addAnswer(moment, name);
    }
    for (const trait of profile.traits || []) addAnswer(trait, name);
  }

  for (const entry of history) {
    const winner = entry?.payload?.winners?.[0] || entry?.payload?.winner;
    const game = entry?.payload?.gameType;
    if (!winner || !game) continue;
    addPrompt(`Who will win another round of ${gameName(game)}?`);
    addAnswer(winner, winner);
  }

  return {
    prompts: prompts.slice(0, 16),
    answers: answers.slice(0, 32),
  };
}

export async function loadApprovedLorePack(supabase, groupId) {
  if (!groupId) return null;
  const { data } = await supabase
    .from("lore_packs")
    .select("id, version, prompts, answers")
    .eq("group_id", groupId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}
