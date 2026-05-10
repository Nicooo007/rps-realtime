import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import { setupSockets } from "./socket/socketHandler";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

setupSockets(io);

server.listen(3000, () => {
  console.log("Servidor corriendo en 3000");
});