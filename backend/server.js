const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const { RoomManager } = require("./src/RoomManager");
const { registerSocketHandlers } = require("./src/socketHandlers");

const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173").split(",");

const app = express();
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ["GET", "POST"] },
});

const roomManager = new RoomManager(io);

app.get("/", (_req, res) => {
  res.json({ status: "ok", service: "watch-party-backend" });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", ...roomManager.stats() });
});

app.get("/api/rooms/:roomId/exists", (req, res) => {
  const room = roomManager.getRoom(req.params.roomId.toUpperCase());
  res.json({ exists: Boolean(room) });
});

io.on("connection", (socket) => {
  registerSocketHandlers(io, socket, roomManager);
});

server.listen(PORT, () => {
  console.log(`Watch Party backend listening on port ${PORT}`);
});
