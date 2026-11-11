import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
);

const DEMO_EMAIL = "demo@grouplore.app";
const DEMO_PASSWORD = "grouplore-demo";

async function demoAuthUser() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: "Demo Host" },
  });
  if (!error && data.user) return data.user;

  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  return list?.users?.find((user) => user.email === DEMO_EMAIL) || null;
}

async function seed() {
  console.log("🌱 Seeding GroupLore demo data...\n");

  const authUser = await demoAuthUser();
  if (!authUser) {
    console.error("Could not create or find the demo auth user");
    return;
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .upsert(
      {
        id: authUser.id,
        display_name: "Demo Host",
        is_guest: false,
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  if (profileErr) {
    console.error("Profile creation failed:", profileErr);
    return;
  }

  // Legacy bridge row for member_profiles (kept intentionally).
  const { data: legacyUser } = await supabase
    .from("users")
    .upsert(
      {
        auth_user_id: authUser.id,
        name: profile.display_name,
        email: DEMO_EMAIL,
      },
      { onConflict: "auth_user_id" },
    )
    .select("id")
    .single();

  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .insert({ name: "The Chaos Crew 🔥", owner_id: authUser.id })
    .select()
    .single();
  if (groupErr) {
    console.error("Group creation failed:", groupErr);
    return;
  }
  console.log("✅ Group created:", group.name);

  await supabase.from("group_members").insert({
    group_id: group.id,
    user_id: authUser.id,
    role: "owner",
  });

  const { data: lobby } = await supabase
    .from("lobbies")
    .insert({
      code: "CHAOS1",
      group_id: group.id,
      host_id: authUser.id,
      status: "open",
    })
    .select("id, code")
    .single();
  if (lobby) {
    await supabase.from("lobby_players").insert({
      lobby_id: lobby.id,
      user_id: authUser.id,
      display_name: "Demo Host",
      is_guest: false,
      connected: true,
    });
    console.log("✅ Lobby created:", lobby.code);
  }

  // Create member profiles
  const members = [
    {
      display_name: "Alex",
      nickname: "The Planner",
      traits: ["organized", "always early", "spreadsheet lover"],
      habits: [
        "checking the weather app 10x/day",
        "color-coding everything",
        "bringing snacks for everyone",
      ],
      iconic_moments: [
        "made a PowerPoint for vacation planning",
        "alphabetized the fridge",
      ],
      catchphrases: [
        "Let me check my calendar",
        "I have a spreadsheet for that",
      ],
      most_likely_to: [
        "plan a trip 6 months in advance",
        "be the designated driver",
        "have a backup plan for the backup plan",
      ],
    },
    {
      display_name: "Jordan",
      nickname: "The Drama Queen",
      traits: ["dramatic", "main character energy", "always late"],
      habits: [
        "telling stories with hand gestures",
        "gasping at everything",
        "showing up 30 minutes late",
      ],
      iconic_moments: [
        "cried during a pizza commercial",
        'said "this is the worst day ever" when Wi-Fi went out',
      ],
      catchphrases: [
        "You won't BELIEVE what happened",
        "I literally can't even",
        "This is MY moment",
      ],
      most_likely_to: [
        "start a rumor accidentally",
        "win an Oscar for daily life",
        "ghost the group chat for 3 days",
      ],
    },
    {
      display_name: "Sam",
      nickname: "The Sleepy One",
      traits: ["chill", "always tired", "has seen every Netflix show"],
      habits: [
        "napping anywhere",
        "drinking 4 coffees a day",
        "falling asleep during movies",
      ],
      iconic_moments: [
        "fell asleep standing up at a concert",
        'took a 4-hour "power nap"',
      ],
      catchphrases: [
        "5 more minutes",
        "I'm not sleeping, I'm resting my eyes",
        "What time is it?",
      ],
      most_likely_to: [
        "sleep through an earthquake",
        "be the last one awake at a party (ironically)",
        "fall asleep mid-sentence",
      ],
    },
    {
      display_name: "Morgan",
      nickname: "The Foodie",
      traits: [
        "always hungry",
        "food photographer",
        "strong opinions about restaurants",
      ],
      habits: [
        "taking photos of food before eating",
        'saying "we should try that place"',
        "having snacks in every bag",
      ],
      iconic_moments: [
        "drove 2 hours for a specific ramen shop",
        "cried when a restaurant closed",
      ],
      catchphrases: [
        "Are you gonna finish that?",
        "This restaurant has 4.7 stars",
        "Let me take a pic first!",
      ],
      most_likely_to: [
        "plan the entire trip around restaurants",
        "know the menu before arriving",
        "start a food blog",
      ],
    },
    {
      display_name: "Riley",
      nickname: "The Meme Lord",
      traits: ["funny", "cursed meme knowledge", "chaotic energy"],
      habits: [
        "sending memes at 3am",
        "responding only with GIFs",
        "laughing at own jokes",
      ],
      iconic_moments: [
        "got kicked from a group chat for too many memes",
        "referenced a meme in a job interview",
      ],
      catchphrases: [
        "Bro that's so based",
        "Respectfully, no",
        "It's giving...",
      ],
      most_likely_to: [
        "make everyone laugh at a funeral",
        "have the perfect meme for any situation",
        "go viral on accident",
      ],
    },
    {
      display_name: "Casey",
      nickname: "The Overachiever",
      traits: ["competitive", "athletic", "always has energy"],
      habits: [
        "waking up at 5am to exercise",
        "turning everything into a competition",
        'saying "let\'s go!" too much',
      ],
      iconic_moments: [
        'ran a marathon and asked "what\'s next?"',
        "challenged a stranger to a push-up contest",
      ],
      catchphrases: [
        "Let's GOOO!",
        "Second place is the first loser",
        "I'm built different",
      ],
      most_likely_to: [
        "win any competition",
        "make a workout out of everyday tasks",
        "challenge someone in public",
      ],
    },
  ];

  for (const m of members) {
    const { error: mErr } = await supabase.from("member_profiles").insert({
      group_id: group.id,
      user_id: legacyUser?.id || null,
      display_name: m.display_name,
      nickname: m.nickname,
      traits: m.traits,
      habits: m.habits,
      iconic_moments: m.iconic_moments,
      catchphrases: m.catchphrases,
      most_likely_to: m.most_likely_to,
    });

    if (mErr)
      console.error(`  ❌ Failed to add ${m.display_name}:`, mErr.message);
    else console.log(`  ✅ Added: ${m.display_name} (${m.nickname})`);
  }

  console.log(
    `\n🎉 Seed complete! Sign in as ${DEMO_EMAIL} / ${DEMO_PASSWORD} or join room CHAOS1.`,
  );
}

seed().catch(console.error);
