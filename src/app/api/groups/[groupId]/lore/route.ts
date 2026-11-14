import type { NextRequest } from "next/server";
import {
  requireGroupMember,
  requireGroupOwner,
  requireNonGuest,
  requireUser,
} from "@/server/api/auth";
import { ApiFailure, apiJson, handleApi, readJson } from "@/server/api/http";
import { buildLorePack } from "@/server/lib/lore.js";
import { supabase } from "@/server/lib/supabase.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadGroup(groupId: string) {
  const { data, error } = await supabase
    .from("groups")
    .select("id, name, lore_opt_in")
    .eq("id", groupId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ApiFailure(404, "not_found", "Group not found");
  return data;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return handleApi(async () => {
    const { groupId } = await params;
    const user = requireNonGuest(await requireUser(request));
    await requireGroupMember(user.id, groupId);
    const group = await loadGroup(groupId);
    const { data: packs, error } = await supabase
      .from("lore_packs")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return apiJson({ optIn: Boolean(group.lore_opt_in), packs: packs || [] });
  }, "Failed to fetch group lore");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return handleApi(async () => {
    const { groupId } = await params;
    const user = requireNonGuest(await requireUser(request));
    await requireGroupOwner(user.id, groupId);
    const body = await readJson(request);
    const { error } = await supabase
      .from("groups")
      .update({ lore_opt_in: Boolean(body?.optIn) })
      .eq("id", groupId);
    if (error) throw error;
    return apiJson({ optIn: Boolean(body?.optIn) });
  }, "Failed to update lore consent");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  return handleApi(async () => {
    const { groupId } = await params;
    const user = requireNonGuest(await requireUser(request));
    await requireGroupOwner(user.id, groupId);
    const group = await loadGroup(groupId);
    if (!group.lore_opt_in) {
      throw new ApiFailure(
        403,
        "lore_opt_in_required",
        "The group owner must opt in before generating a lore pack",
      );
    }

    const { data: profileRows } = await supabase
      .from("member_profiles")
      .select(
        "display_name, traits, habits, iconic_moments, catchphrases, most_likely_to",
      )
      .eq("group_id", groupId);
    const { data: historyRows } = await supabase
      .from("activity_log")
      .select("payload")
      .eq("group_id", groupId)
      .eq("event_type", "game_finished")
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: existing } = await supabase
      .from("lore_packs")
      .select("version")
      .eq("group_id", groupId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    type LoreProfile = {
      display_name: string;
      traits?: string[];
      habits?: string[];
      iconic_moments?: string[];
      catchphrases?: string[];
      most_likely_to?: string[];
    };
    const profiles = (profileRows || []) as LoreProfile[];
    const history = (historyRows || []) as Array<{
      payload?: { winners?: string[]; winner?: string; gameType?: string };
    }>;

    const generated = buildLorePack({
      groupName: group.name,
      profiles,
      history,
    });
    if (generated.prompts.length < 5) {
      throw new ApiFailure(
        400,
        "not_enough_lore",
        "Add more member profiles or finish a few games first",
      );
    }

    const { data, error } = await supabase
      .from("lore_packs")
      .insert({
        group_id: groupId,
        status: "draft",
        version: Number(existing?.version || 0) + 1,
        prompts: generated.prompts,
        answers: generated.answers,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return apiJson(data, 201);
  }, "Failed to generate the lore pack");
}
