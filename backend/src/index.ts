import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { setupSockets } from "./socket/socketHandler";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL || "http://localhost:5173" }
});

setupSockets(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});