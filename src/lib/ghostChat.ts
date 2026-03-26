// ghost-chat: E2E encrypted ephemeral chat via WebRTC
// No framework deps — vanilla TS for Astro inline use

import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  encryptMessage,
  decryptMessage,
  encryptBuffer,
  decryptBuffer,
  type KeyPair,
} from "./e2eCrypto";

export interface GhostPeer {
  id: string;
  nickname: string;
  connection?: RTCPeerConnection;
  dataChannel?: RTCDataChannel;
  stream?: MediaStream;
  sharedKey?: CryptoKey;
  pendingPublicKey?: JsonWebKey; // buffered until we have a connection
}

export interface ChatMessage {
  from: string;
  nickname: string;
  text: string;
  timestamp: number;
}

export interface FileOffer {
  from: string;
  nickname: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileId: string;
  text: string;
  groupId: string;
  groupIndex: number;
  groupTotal: number;
}

type EventMap = {
  joined: (peerId: string, peers: { id: string; nickname: string }[]) => void;
  "peer-joined": (peerId: string, nickname: string) => void;
  "peer-left": (peerId: string) => void;
  message: (msg: ChatMessage) => void;
  "file-start": (offer: FileOffer) => void;
  "file-progress": (fileId: string, received: number, total: number) => void;
  "file-complete": (
    fileId: string,
    data: Blob,
    fileName: string,
    fileType: string,
    nickname: string,
    text: string,
    groupId: string,
    groupIndex: number,
    groupTotal: number
  ) => void;
  "remote-stream": (peerId: string, stream: MediaStream, trackKind: string) => void;
  "stream-ended": (peerId: string) => void;
  error: (msg: string) => void;
  disconnected: () => void;
};

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: [
      "turn:turn.swapdoesbioandis-a.dev:3478?transport=udp",
      "turn:turn.swapdoesbioandis-a.dev:3478?transport=tcp",
      "turns:turn.swapdoesbioandis-a.dev:443?transport=tcp",
    ],
    username: "ghostchat",
    credential: "gh0stch4t2024",
  },
];

const CHUNK_SIZE = 16384; // 16KB — safe for all browsers
const BUFFER_THRESHOLD = 65536; // 64KB — pause sending when buffered amount exceeds this
const KEEPALIVE_INTERVAL = 25_000; // 25s — send ping before server's 30s timeout
const ICE_TIMEOUT_MS = 8_000; // 8s — if ICE doesn't connect, fall back to relay-only

interface IncomingFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  totalChunks: number;
  receivedChunks: number;
  chunks: ArrayBuffer[];
  nickname: string;
  text: string;
  groupId: string;
  groupIndex: number;
  groupTotal: number;
}

/** Detect mobile browsers where ICE direct connections often fail */
function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(
    navigator.userAgent
  );
}

export class GhostChat {
  private ws: WebSocket | null = null;
  private peers = new Map<string, GhostPeer>();
  private myPeerId = "";
  private myNickname = "";
  private roomId = "";
  private listeners = new Map<string, Set<Function>>();
  private localStream: MediaStream | null = null;
  private incomingFiles = new Map<string, IncomingFile>();
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;

  // E2E key pair for this session
  private keyPair: KeyPair | null = null;
  private publicKeyJwk: JsonWebKey | null = null;
  private mobile = false;

  on<K extends keyof EventMap>(event: K, fn: EventMap[K]): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
  }

  off<K extends keyof EventMap>(event: K, fn: EventMap[K]): void {
    this.listeners.get(event)?.delete(fn);
  }

  private emit<K extends keyof EventMap>(event: K, ...args: Parameters<EventMap[K]>): void {
    const fns = this.listeners.get(event);
    if (fns) for (const fn of fns) (fn as Function)(...args);
  }

  get peerId(): string {
    return this.myPeerId;
  }
  get nickname(): string {
    return this.myNickname;
  }
  get currentRoomId(): string {
    return this.roomId;
  }
  get connectedPeers(): GhostPeer[] {
    return Array.from(this.peers.values());
  }
  get stream(): MediaStream | null {
    return this.localStream;
  }

  async connect(signalingUrl: string, roomId: string, inviteCode: string, nickname: string): Promise<void> {
    this.roomId = roomId;
    this.myNickname = nickname;
    this.mobile = isMobile();

    // Generate E2E key pair before connecting
    this.keyPair = await generateKeyPair();
    this.publicKeyJwk = await exportPublicKey(this.keyPair.publicKey);

    this.ws = new WebSocket(signalingUrl);

    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: "join", roomId, inviteCode, nickname }));
      this.startKeepalive();
    };

    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "pong") return; // keepalive response
      this.handleSignal(msg);
    };

    this.ws.onclose = () => {
      this.stopKeepalive();
      this.emit("disconnected");
    };

    this.ws.onerror = () => {
      this.emit("error", "WebSocket connection failed");
    };
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, KEEPALIVE_INTERVAL);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  /** Send our public key to a specific peer via signaling */
  private sendPublicKey(targetPeerId: string): void {
    if (!this.publicKeyJwk) return;
    this.sendSignal({
      type: "key-exchange",
      targetPeerId,
      publicKey: this.publicKeyJwk,
    });
  }

  /** Handle receiving a peer's public key and derive shared secret */
  private async handleKeyExchange(fromPeerId: string, peerPublicKeyJwk: JsonWebKey): Promise<void> {
    if (!this.keyPair) return;

    const peer = this.peers.get(fromPeerId);
    if (!peer) {
      // Peer not yet created — buffer the key for later
      // This can happen if key-exchange arrives before peer-joined
      return;
    }

    try {
      const peerPublicKey = await importPublicKey(peerPublicKeyJwk);
      peer.sharedKey = await deriveSharedKey(this.keyPair.privateKey, peerPublicKey);
    } catch (e) {
      this.emit("error", "E2E key exchange failed");
    }
  }

  private async handleSignal(msg: any): Promise<void> {
    switch (msg.type) {
      case "joined":
        this.myPeerId = msg.peerId;
        this.emit("joined", msg.peerId, msg.peers);
        for (const p of msg.peers) {
          await this.createPeerConnection(p.id, p.nickname, true);
          // Send our public key to each existing peer
          this.sendPublicKey(p.id);
        }
        break;

      case "peer-joined":
        this.peers.set(msg.peerId, { id: msg.peerId, nickname: msg.nickname });
        this.emit("peer-joined", msg.peerId, msg.nickname);
        // Send our public key to the new peer
        this.sendPublicKey(msg.peerId);
        break;

      case "peer-left":
        this.cleanupPeer(msg.peerId);
        this.emit("peer-left", msg.peerId);
        break;

      case "key-exchange":
        await this.handleKeyExchange(msg.fromPeerId, msg.publicKey);
        break;

      case "offer": {
        const existingPeer = this.peers.get(msg.fromPeerId);
        let pc: RTCPeerConnection;

        if (existingPeer?.connection) {
          // Renegotiation: reuse the existing connection (e.g. adding media tracks)
          pc = existingPeer.connection;
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          if (this.localStream) {
            const senders = pc.getSenders();
            for (const track of this.localStream.getTracks()) {
              if (!senders.some((s) => s.track === track)) {
                pc.addTrack(track, this.localStream);
              }
            }
          }
        } else {
          // First offer from this peer: create a new connection
          const peer = existingPeer ?? {
            id: msg.fromPeerId,
            nickname: msg.nickname ?? "anon",
          };
          await this.createPeerConnection(peer.id, peer.nickname, false);
          pc = this.peers.get(msg.fromPeerId)!.connection!;
          await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          if (this.localStream) {
            for (const track of this.localStream.getTracks()) {
              pc.addTrack(track, this.localStream);
            }
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal({
          type: "answer",
          targetPeerId: msg.fromPeerId,
          sdp: pc.localDescription,
        });
        break;
      }

      case "answer": {
        const pc = this.peers.get(msg.fromPeerId)?.connection;
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        break;
      }

      case "ice-candidate": {
        const pc = this.peers.get(msg.fromPeerId)?.connection;
        if (pc && msg.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
        break;
      }

      case "chat-relay":
        // E2E encrypted message relayed through signaling server
        await this.handleEncryptedRelay(msg);
        break;

      case "file-relay-start": {
        // File metadata is encrypted
        await this.handleEncryptedFileRelayStart(msg);
        break;
      }

      case "file-relay-chunk": {
        await this.handleEncryptedFileRelayChunk(msg);
        break;
      }

      case "file-relay-end": {
        const file = this.incomingFiles.get(msg.fileId);
        if (file) {
          const blob = new Blob(file.chunks, { type: file.fileType });
          this.incomingFiles.delete(msg.fileId);
          this.emit(
            "file-complete",
            msg.fileId,
            blob,
            file.fileName,
            file.fileType,
            file.nickname,
            file.text,
            file.groupId,
            file.groupIndex,
            file.groupTotal
          );
        }
        break;
      }

      case "error":
        this.emit("error", msg.message);
        break;
    }
  }

  /** Decrypt a chat-relay message */
  private async handleEncryptedRelay(msg: any): Promise<void> {
    const peer = this.peers.get(msg.fromPeerId);
    const key = peer?.sharedKey;

    if (key && msg.encrypted) {
      try {
        const plaintext = await decryptMessage(key, msg.encrypted);
        const parsed = JSON.parse(plaintext);
        this.emit("message", {
          from: msg.fromPeerId,
          nickname: parsed.nickname,
          text: parsed.text,
          timestamp: parsed.timestamp,
        });
        return;
      } catch {
        this.emit("error", "Failed to decrypt message");
        return;
      }
    }

    // Fallback: unencrypted (shouldn't happen in normal flow, but handle gracefully)
    if (msg.text !== undefined) {
      this.emit("message", {
        from: msg.fromPeerId,
        nickname: msg.nickname,
        text: msg.text,
        timestamp: msg.timestamp,
      });
    }
  }

  /** Decrypt file-relay-start metadata */
  private async handleEncryptedFileRelayStart(msg: any): Promise<void> {
    let fileName = msg.fileName;
    let fileType = msg.fileType;
    let fileSize = msg.fileSize;
    let nickname = msg.nickname;
    let text = msg.text;
    let groupId = msg.groupId;
    let groupIndex = msg.groupIndex;
    let groupTotal = msg.groupTotal;

    const peer = this.peers.get(msg.fromPeerId);
    const key = peer?.sharedKey;

    if (key && msg.encryptedMeta) {
      try {
        const plaintext = await decryptMessage(key, msg.encryptedMeta);
        const meta = JSON.parse(plaintext);
        fileName = meta.fileName;
        fileType = meta.fileType;
        fileSize = meta.fileSize;
        nickname = meta.nickname;
        text = meta.text;
        groupId = meta.groupId;
        groupIndex = meta.groupIndex;
        groupTotal = meta.groupTotal;
      } catch {
        this.emit("error", "Failed to decrypt file metadata");
        return;
      }
    }

    const totalChunks = Math.ceil(fileSize / 16384);
    this.incomingFiles.set(msg.fileId, {
      fileName,
      fileType,
      fileSize,
      totalChunks,
      receivedChunks: 0,
      chunks: [],
      nickname,
      text,
      groupId,
      groupIndex,
      groupTotal,
    });
    this.emit("file-start", {
      from: msg.fromPeerId,
      nickname,
      fileName,
      fileSize,
      fileType,
      fileId: msg.fileId,
      text,
      groupId,
      groupIndex,
      groupTotal,
    });
  }

  /** Decrypt file-relay-chunk data */
  private async handleEncryptedFileRelayChunk(msg: any): Promise<void> {
    const file = this.incomingFiles.get(msg.fileId);
    if (!file) return;

    const peer = this.peers.get(msg.fromPeerId);
    const key = peer?.sharedKey;

    if (key && msg.encryptedData) {
      try {
        // Decode base64 encrypted data, then decrypt
        const binary = atob(msg.encryptedData);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const decrypted = await decryptBuffer(key, bytes.buffer);
        file.chunks.push(decrypted);
      } catch {
        this.emit("error", "Failed to decrypt file chunk");
        return;
      }
    } else if (msg.data) {
      // Unencrypted fallback
      const binary = atob(msg.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      file.chunks.push(bytes.buffer);
    }

    file.receivedChunks++;
    this.emit("file-progress", msg.fileId, file.receivedChunks, file.totalChunks);
  }

  private async createPeerConnection(
    peerId: string,
    nickname: string,
    isOfferer: boolean
  ): Promise<void> {
    const rtcConfig: RTCConfiguration = {
      iceServers: ICE_SERVERS,
    };

    // On mobile, force TURN relay — direct P2P via STUN rarely works on cellular
    // (symmetric NAT, carrier-grade NAT, frequent IP changes)
    if (this.mobile) {
      rtcConfig.iceTransportPolicy = "relay";
    }

    const pc = new RTCPeerConnection(rtcConfig);

    const peer: GhostPeer = { id: peerId, nickname, connection: pc };

    // Preserve existing shared key if we already did key exchange
    const existingPeer = this.peers.get(peerId);
    if (existingPeer?.sharedKey) {
      peer.sharedKey = existingPeer.sharedKey;
    }

    this.peers.set(peerId, peer);

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        this.sendSignal({
          type: "ice-candidate",
          targetPeerId: peerId,
          candidate: ev.candidate,
        });
      }
    };

    pc.ontrack = (ev) => {
      // Some mobile browsers deliver tracks without an associated stream
      const stream = ev.streams[0] ?? peer.stream ?? new MediaStream();
      if (!ev.streams[0]) stream.addTrack(ev.track);
      peer.stream = stream;
      this.emit("remote-stream", peerId, stream, ev.track.kind);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        this.emit("stream-ended", peerId);
      }
    };

    // Mobile ICE timeout: if ICE gathering takes too long, the relay fallback
    // is already forced via iceTransportPolicy, but we also set a timeout
    // to detect complete ICE failure and notify the user
    if (this.mobile) {
      const iceTimeout = setTimeout(() => {
        if (
          pc.iceConnectionState !== "connected" &&
          pc.iceConnectionState !== "completed"
        ) {
          // On mobile, DataChannel may not connect — relay will handle messaging.
          // This is expected behavior, not an error.
        }
      }, ICE_TIMEOUT_MS);

      pc.oniceconnectionstatechange = () => {
        if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          clearTimeout(iceTimeout);
        }
      };
    }

    if (isOfferer) {
      const dc = pc.createDataChannel("chat", { ordered: true });
      this.setupDataChannel(dc, peerId);
      peer.dataChannel = dc;

      if (this.localStream) {
        for (const track of this.localStream.getTracks()) {
          pc.addTrack(track, this.localStream);
        }
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal({
        type: "offer",
        targetPeerId: peerId,
        sdp: pc.localDescription,
        nickname: this.myNickname,
      });
    } else {
      pc.ondatachannel = (ev) => {
        this.setupDataChannel(ev.channel, peerId);
        peer.dataChannel = ev.channel;
      };
    }
  }

  private setupDataChannel(dc: RTCDataChannel, peerId: string): void {
    dc.binaryType = "arraybuffer";
    let activeFileId: string | null = null;

    dc.onmessage = async (ev) => {
      const peer = this.peers.get(peerId);
      const key = peer?.sharedKey;

      if (typeof ev.data === "string") {
        let msg: any;

        // Try to decrypt E2E encrypted DataChannel messages
        if (key) {
          try {
            const decrypted = await decryptMessage(key, ev.data);
            msg = JSON.parse(decrypted);
          } catch {
            // If decryption fails, try parsing as plain JSON (during key exchange window)
            try {
              msg = JSON.parse(ev.data);
            } catch {
              return;
            }
          }
        } else {
          try {
            msg = JSON.parse(ev.data);
          } catch {
            return;
          }
        }

        if (msg.type === "chat") {
          this.emit("message", {
            from: peerId,
            nickname: msg.nickname,
            text: msg.text,
            timestamp: msg.timestamp,
          });
        } else if (msg.type === "file-start") {
          const totalChunks = Math.ceil(msg.fileSize / CHUNK_SIZE);
          this.incomingFiles.set(msg.fileId, {
            fileName: msg.fileName,
            fileType: msg.fileType,
            fileSize: msg.fileSize,
            totalChunks,
            receivedChunks: 0,
            chunks: [],
            nickname: msg.nickname,
            text: msg.text,
            groupId: msg.groupId,
            groupIndex: msg.groupIndex,
            groupTotal: msg.groupTotal,
          });
          activeFileId = msg.fileId;
          this.emit("file-start", {
            from: peerId,
            nickname: msg.nickname,
            fileName: msg.fileName,
            fileSize: msg.fileSize,
            fileType: msg.fileType,
            fileId: msg.fileId,
            text: msg.text,
            groupId: msg.groupId,
            groupIndex: msg.groupIndex,
            groupTotal: msg.groupTotal,
          });
        } else if (msg.type === "file-end") {
          const file = this.incomingFiles.get(msg.fileId);
          if (file) {
            const blob = new Blob(file.chunks, { type: file.fileType });
            this.incomingFiles.delete(msg.fileId);
            activeFileId = null;
            this.emit(
              "file-complete",
              msg.fileId,
              blob,
              file.fileName,
              file.fileType,
              file.nickname,
              file.text,
              file.groupId,
              file.groupIndex,
              file.groupTotal
            );
          }
        }
      } else {
        // Binary data — file chunk
        if (activeFileId) {
          const file = this.incomingFiles.get(activeFileId);
          if (file) {
            let chunkData = ev.data as ArrayBuffer;
            // Decrypt file chunk if we have a shared key
            if (key) {
              try {
                chunkData = await decryptBuffer(key, chunkData);
              } catch {
                // If decryption fails, use raw data (during key exchange window)
              }
            }
            file.chunks.push(chunkData);
            file.receivedChunks++;
            this.emit("file-progress", activeFileId, file.receivedChunks, file.totalChunks);
          }
        }
      }
    };
  }

  /** Get the shared E2E key for a peer, or null if key exchange hasn't completed */
  private getPeerKey(peerId: string): CryptoKey | undefined {
    return this.peers.get(peerId)?.sharedKey;
  }

  async sendMessage(text: string): Promise<void> {
    const timestamp = Date.now();
    const payload = JSON.stringify({
      type: "chat",
      nickname: this.myNickname,
      text,
      timestamp,
    });

    let sentViaDC = false;
    for (const peer of this.peers.values()) {
      if (peer.dataChannel?.readyState === "open") {
        if (peer.sharedKey) {
          const encrypted = await encryptMessage(peer.sharedKey, payload);
          peer.dataChannel.send(encrypted);
        } else {
          peer.dataChannel.send(payload);
        }
        sentViaDC = true;
      }
    }

    // Fallback: E2E encrypted relay through signaling server
    if (!sentViaDC && this.ws?.readyState === WebSocket.OPEN) {
      // Encrypt for each peer and send via relay
      // For relay, we encrypt the message content so the server can't read it
      const relayPayload = JSON.stringify({
        nickname: this.myNickname,
        text,
        timestamp,
      });

      // Find any peer with a shared key to encrypt with
      let encrypted: string | null = null;
      for (const peer of this.peers.values()) {
        if (peer.sharedKey) {
          encrypted = await encryptMessage(peer.sharedKey, relayPayload);
          break;
        }
      }

      if (encrypted) {
        this.ws.send(JSON.stringify({
          type: "chat-relay",
          encrypted,
        }));
      } else {
        // No shared key yet — send unencrypted (only during initial key exchange)
        this.ws.send(JSON.stringify({
          type: "chat-relay",
          nickname: this.myNickname,
          text,
          timestamp,
        }));
      }
    }
  }

  /** Send multiple files as a group. Text is attached to the group, not each file. */
  sendFiles(files: File[], text: string = ""): string {
    const groupId = crypto.randomUUID();
    for (let i = 0; i < files.length; i++) {
      this.sendFile(files[i], i === 0 ? text : "", groupId, i, files.length);
    }
    return groupId;
  }

  /** Check if any peer has an open data channel */
  private hasOpenDataChannel(): boolean {
    for (const peer of this.peers.values()) {
      if (peer.dataChannel?.readyState === "open") return true;
    }
    return false;
  }

  private sendFile(
    file: File,
    text: string,
    groupId: string,
    groupIndex: number,
    groupTotal: number
  ): void {
    const fileId = crypto.randomUUID();
    const reader = new FileReader();

    reader.onload = async () => {
      const data = reader.result as ArrayBuffer;

      const startPayload = JSON.stringify({
        type: "file-start",
        nickname: this.myNickname,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
        fileId,
        text,
        groupId,
        groupIndex,
        groupTotal,
      });

      const endPayload = JSON.stringify({
        type: "file-end",
        fileId,
      });

      if (this.hasOpenDataChannel()) {
        // Send via WebRTC data channels with E2E encryption
        for (const peer of this.peers.values()) {
          if (peer.dataChannel?.readyState === "open") {
            const dc = peer.dataChannel;
            const key = peer.sharedKey;

            // Send encrypted start payload
            if (key) {
              dc.send(await encryptMessage(key, startPayload));
            } else {
              dc.send(startPayload);
            }

            let offset = 0;
            const sendNextChunks = async () => {
              while (offset < data.byteLength) {
                if (dc.bufferedAmount > BUFFER_THRESHOLD) {
                  dc.onbufferedamountlow = () => {
                    dc.onbufferedamountlow = null;
                    sendNextChunks();
                  };
                  return;
                }
                const end = Math.min(offset + CHUNK_SIZE, data.byteLength);
                const chunk = data.slice(offset, end);
                if (key) {
                  dc.send(await encryptBuffer(key, chunk));
                } else {
                  dc.send(chunk);
                }
                offset = end;
              }
              // Send encrypted end payload
              if (key) {
                dc.send(await encryptMessage(key, endPayload));
              } else {
                dc.send(endPayload);
              }
            };

            await sendNextChunks();
          }
        }
      } else if (this.ws?.readyState === WebSocket.OPEN) {
        // Fallback: E2E encrypted relay through signaling server
        // Find a peer key for encryption
        let key: CryptoKey | undefined;
        for (const peer of this.peers.values()) {
          if (peer.sharedKey) {
            key = peer.sharedKey;
            break;
          }
        }

        if (key) {
          // Encrypt file metadata
          const metaPayload = JSON.stringify({
            nickname: this.myNickname,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || "application/octet-stream",
            text,
            groupId,
            groupIndex,
            groupTotal,
          });
          const encryptedMeta = await encryptMessage(key, metaPayload);

          this.ws.send(JSON.stringify({
            type: "file-relay-start",
            fileId,
            fileSize: file.size, // needed for progress calculation (not sensitive)
            encryptedMeta,
          }));

          const RELAY_CHUNK_SIZE = 16384;
          let offset = 0;
          while (offset < data.byteLength) {
            const end = Math.min(offset + RELAY_CHUNK_SIZE, data.byteLength);
            const chunk = data.slice(offset, end);
            const encryptedChunk = await encryptBuffer(key, chunk);
            // Convert encrypted chunk to base64
            const encBytes = new Uint8Array(encryptedChunk);
            let binary = "";
            for (let i = 0; i < encBytes.length; i++) binary += String.fromCharCode(encBytes[i]);
            const b64 = btoa(binary);
            this.ws!.send(JSON.stringify({
              type: "file-relay-chunk",
              fileId,
              encryptedData: b64,
            }));
            offset = end;
          }
          this.ws!.send(JSON.stringify({
            type: "file-relay-end",
            fileId,
          }));
        } else {
          // No shared key — unencrypted relay (only during initial key exchange window)
          this.ws.send(JSON.stringify({
            type: "file-relay-start",
            nickname: this.myNickname,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || "application/octet-stream",
            fileId,
            text,
            groupId,
            groupIndex,
            groupTotal,
          }));

          const RELAY_CHUNK_SIZE = 16384;
          let offset = 0;
          while (offset < data.byteLength) {
            const end = Math.min(offset + RELAY_CHUNK_SIZE, data.byteLength);
            const chunk = new Uint8Array(data.slice(offset, end));
            let binary = "";
            for (let i = 0; i < chunk.length; i++) binary += String.fromCharCode(chunk[i]);
            const b64 = btoa(binary);
            this.ws!.send(JSON.stringify({
              type: "file-relay-chunk",
              fileId,
              data: b64,
            }));
            offset = end;
          }
          this.ws!.send(JSON.stringify({
            type: "file-relay-end",
            fileId,
          }));
        }
      }
    };

    reader.readAsArrayBuffer(file);
  }

  async startCall(video: boolean): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video,
    });

    for (const peer of this.peers.values()) {
      if (peer.connection) {
        for (const track of this.localStream.getTracks()) {
          peer.connection.addTrack(track, this.localStream);
        }
        const offer = await peer.connection.createOffer();
        await peer.connection.setLocalDescription(offer);
        this.sendSignal({
          type: "offer",
          targetPeerId: peer.id,
          sdp: peer.connection.localDescription,
          nickname: this.myNickname,
        });
      }
    }

    return this.localStream;
  }

  toggleMute(muted: boolean): void {
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = !muted;
      }
    }
  }

  async toggleCamera(off: boolean): Promise<void> {
    if (!this.localStream) return;

    if (off) {
      // Actually stop the video track so the camera hardware turns off
      for (const track of this.localStream.getVideoTracks()) {
        track.stop();
        this.localStream.removeTrack(track);
      }
    } else {
      // Re-acquire camera and replace the track on all peer connections
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const newTrack = camStream.getVideoTracks()[0];
      this.localStream.addTrack(newTrack);

      for (const peer of this.peers.values()) {
        if (peer.connection) {
          const senders = peer.connection.getSenders();
          const videoSender = senders.find((s) => s.track?.kind === "video" || (!s.track && s.transport));
          if (videoSender) {
            await videoSender.replaceTrack(newTrack);
          } else {
            peer.connection.addTrack(newTrack, this.localStream);
          }
        }
      }
    }
  }

  endCall(): void {
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }
  }

  private cleanupPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.dataChannel?.close();
      peer.connection?.close();
      this.peers.delete(peerId);
    }
  }

  private sendSignal(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect(): void {
    this.stopKeepalive();
    this.endCall();
    for (const peerId of this.peers.keys()) {
      this.cleanupPeer(peerId);
    }
    this.ws?.close();
    this.ws = null;
    this.myPeerId = "";
    this.roomId = "";
    this.keyPair = null;
    this.publicKeyJwk = null;
  }
}
