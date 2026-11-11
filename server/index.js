import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { GameEngine } from "./engine/engine.js";
import { createIdentityResolver } from "./engine/auth.js";
import { createSupabasePersistence } from "./engine/persistence.js";
import { incrementStats, logActivity } from "./lib/activity.js";
import { guestsAllowed } from "./lib/guestAccess.js";
import { authorizePlayer } from "./lib/membership.js";
import { supabase } from "./lib/supabase.js";
import authRoutes from "./routes/auth.js";
import feedRoutes from "./routes/feed.js";
import gameRoutes from "./routes/games.js";
import groupRoutes from "./routes/groups.js";
import inviteRoutes from "./routes/invites.js";
import memberRoutes from "./routes/members.js";
import userRoutes from "./routes/users.js";

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const allowedOrigins = [...new Set([CLIENT_URL, "http://localhost:3000"])];
const allowGuests = guestsAllowed();

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
});

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "64kb" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/invites", inviteRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/feed", feedRoutes);

const engine = new GameEngine({
  io,
  resolveIdentity: createIdentityResolver({
    allowGuests,
    verifyAccessToken: async (token) => {
      const { data, error } = await supabase.auth.getUser(token);
      if (error) return null;
      return data?.user || null;
    },
  }),
  authorize: ({ identity, groupId }) =>
    authorizePlayer({ identity, groupId, allowGuests }),
  loadSession: async (sessionId) => {
    const { data } = await supabase
      .from("game_sessions")
      .select("id, group_id, status, game_type")
      .eq("id", sessionId)
      .maybeSingle();
    return data || null;
  },
  persistence: createSupabasePersistence({
    supabase,
    logActivity,
    incrementStats,
  }),
});

engine.attach();

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    engine: { rooms: engine.rooms.size },
    guests: allowGuests,
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 GroupLore server running on port ${PORT}`);
});

function shutdown(signal) {
  console.log(`\n${signal} received — closing rooms`);
  engine.close();
  io.close();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

export { engine, io };
