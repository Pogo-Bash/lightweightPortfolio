import type { WebSocket } from "ws";

export interface Peer {
  id: string;
  nickname: string;
  ws: WebSocket;
}

export interface Room {
  id: string;
  peers: Map<string, Peer>;
  createdAt: number;
}

const rooms = new Map<string, Room>();

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function createRoom(roomId: string): Room {
  const room: Room = { id: roomId, peers: new Map(), createdAt: Date.now() };
  rooms.set(roomId, room);
  return room;
}

export function ensureRoom(roomId: string): Room {
  return rooms.get(roomId) ?? createRoom(roomId);
}

export function addPeer(room: Room, peer: Peer): void {
  room.peers.set(peer.id, peer);
}

export function removePeer(room: Room, peerId: string): void {
  room.peers.delete(peerId);
  if (room.peers.size === 0) {
    rooms.delete(room.id);
  }
}

export function broadcast(room: Room, message: object, excludeId?: string): void {
  const data = JSON.stringify(message);
  for (const [id, peer] of room.peers) {
    if (id !== excludeId && peer.ws.readyState === peer.ws.OPEN) {
      peer.ws.send(data);
    }
  }
}

export function sendTo(room: Room, peerId: string, message: object): void {
  const peer = room.peers.get(peerId);
  if (peer && peer.ws.readyState === peer.ws.OPEN) {
    peer.ws.send(JSON.stringify(message));
  }
}

export function roomCount(): number {
  return rooms.size;
}

export function peerCount(): number {
  let count = 0;
  for (const room of rooms.values()) count += room.peers.size;
  return count;
}
