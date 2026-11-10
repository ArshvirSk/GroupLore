import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import feedRoutes from "./routes/feed.js";
import gameRoutes from "./routes/games.js";
import groupRoutes from "./routes/groups.js";
import memberRoutes from "./routes/members.js";
import userRoutes from "./routes/users.js";
import { initSocketHandlers } from "./sockets/index.js";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(clerkMiddleware());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/users", userRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/feed", feedRoutes);

// Socket.io
initSocketHandlers(io);

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`🚀 GroupLore server running on port ${PORT}`);
});

export { io };

