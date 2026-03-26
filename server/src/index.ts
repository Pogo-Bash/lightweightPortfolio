import Fastify from "fastify";
import { WebSocketServer, WebSocket } from "ws";
import { randomBytes } from "node:crypto";
import { createInviteCode, validateInviteCode, generateRoomId } from "./invite.js";
import {
  ensureRoom,
  addPeer,
  removePeer,
  broadcast,
  sendTo,
  getRoom,
  roomCount,
  peerCount,
} from "./room.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

const fastify = Fastify({ logger: false });

// --- HTTP routes ---

fastify.get("/api/health", async () => ({
  status: "ok",
  rooms: roomCount(),
  peers: peerCount(),
  uptime: process.uptime(),
}));

fastify.post<{ Body: { ttlHours?: number } }>("/api/rooms", async (req, reply) => {
  const roomId = generateRoomId();
  const ttlHours = req.body?.ttlHours;
  const inviteCode = createInviteCode(roomId, ttlHours);
  reply.code(201);
  return { roomId, inviteCode };
});

// --- WebSocket server ---

const wss = new WebSocketServer({ noServer: true });

// Keepalive: ping all clients every 30s, kill if no pong within 10s
const PING_INTERVAL = 30_000;
const aliveClients = new WeakSet<WebSocket>();

const pingTimer = setInterval(() => {
  for (const ws of wss.clients) {
    if (!aliveClients.has(ws)) {
      ws.terminate();
      continue;
    }
    aliveClients.delete(ws);
    ws.ping();
  }
}, PING_INTERVAL);

wss.on("close", () => clearInterval(pingTimer));

wss.on("connection", (ws: WebSocket) => {
  let peerId: string | null = null;
  let currentRoomId: string | null = null;

  aliveClients.add(ws);
  ws.on("pong", () => aliveClients.add(ws));

  ws.on("message", (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "invalid json" }));
      return;
    }

    // Client-side keepalive ping
    if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
      return;
    }

    switch (msg.type) {
      case "join": {
        const { roomId, inviteCode, nickname } = msg;
        if (!roomId || !inviteCode || !nickname) {
          ws.send(JSON.stringify({ type: "error", message: "missing fields" }));
          return;
        }

        const validation = validateInviteCode(inviteCode, roomId);
        if (!validation.valid) {
          ws.send(JSON.stringify({ type: "error", message: validation.reason }));
          return;
        }

        peerId = randomBytes(8).toString("hex");
        currentRoomId = roomId;

        const room = ensureRoom(roomId);

        // Send existing peers to the new joiner
        const existingPeers = Array.from(room.peers.values()).map((p) => ({
          id: p.id,
          nickname: p.nickname,
        }));

        addPeer(room, { id: peerId, nickname, ws });

        ws.send(
          JSON.stringify({
            type: "joined",
            peerId,
            peers: existingPeers,
          })
        );

        // Notify others
        broadcast(room, { type: "peer-joined", peerId, nickname }, peerId);
        break;
      }

      case "chat-relay": {
        // Fallback: relay chat messages through the server when WebRTC data channel isn't open
        if (!peerId || !currentRoomId) {
          ws.send(JSON.stringify({ type: "error", message: "not joined" }));
          return;
        }
        const relayRoom = getRoom(currentRoomId);
        if (!relayRoom) return;
        broadcast(relayRoom, {
          type: "chat-relay",
          fromPeerId: peerId,
          nickname: msg.nickname,
          text: msg.text,
          timestamp: msg.timestamp,
        }, peerId);
        break;
      }

      case "file-relay-start":
      case "file-relay-chunk":
      case "file-relay-end": {
        // Fallback: relay file data through the server when WebRTC data channel isn't open
        if (!peerId || !currentRoomId) {
          ws.send(JSON.stringify({ type: "error", message: "not joined" }));
          return;
        }
        const fileRelayRoom = getRoom(currentRoomId);
        if (!fileRelayRoom) return;
        broadcast(fileRelayRoom, { ...msg, fromPeerId: peerId }, peerId);
        break;
      }

      case "key-exchange":
      case "offer":
      case "answer":
      case "ice-candidate": {
        if (!peerId || !currentRoomId) {
          ws.send(JSON.stringify({ type: "error", message: "not joined" }));
          return;
        }
        const room = getRoom(currentRoomId);
        if (!room) return;

        const { targetPeerId, ...payload } = msg;
        if (!targetPeerId) return;

        sendTo(room, targetPeerId, { ...payload, fromPeerId: peerId });
        break;
      }

      default:
        ws.send(JSON.stringify({ type: "error", message: "unknown message type" }));
    }
  });

  ws.on("close", () => {
    if (peerId && currentRoomId) {
      const room = getRoom(currentRoomId);
      if (room) {
        removePeer(room, peerId);
        broadcast(room, { type: "peer-left", peerId });
      }
    }
  });
});

// --- Start server ---

const start = async () => {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });

  const server = fastify.server;
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
    if (url.pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  console.log(`ghost-chat signaling server listening on :${PORT}`);
};

start();
