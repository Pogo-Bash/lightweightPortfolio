import { createHmac, randomBytes } from "node:crypto";

const secret = process.env.INVITE_SECRET ?? "dev-secret";
const defaultTtlHours = parseInt(process.env.INVITE_TTL_HOURS ?? "168", 10);

export function createInviteCode(roomId: string, ttlHours?: number): string {
  const hours = ttlHours ?? defaultTtlHours;
  const expiry = Date.now() + hours * 3600_000;
  const payload = `${roomId}:${expiry}`;
  const hmac = createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function validateInviteCode(
  code: string,
  roomId: string
): { valid: true } | { valid: false; reason: string } {
  try {
    const decoded = Buffer.from(code, "base64url").toString();
    const parts = decoded.split(":");
    if (parts.length !== 3) return { valid: false, reason: "malformed code" };

    const [codeRoomId, expiryStr, providedHmac] = parts;
    const expiry = parseInt(expiryStr, 10);

    if (codeRoomId !== roomId) return { valid: false, reason: "room mismatch" };
    if (Date.now() > expiry) return { valid: false, reason: "expired" };

    const expectedHmac = createHmac("sha256", secret)
      .update(`${codeRoomId}:${expiryStr}`)
      .digest("base64url");

    if (providedHmac !== expectedHmac) return { valid: false, reason: "invalid signature" };

    return { valid: true };
  } catch {
    return { valid: false, reason: "malformed code" };
  }
}

export function generateRoomId(): string {
  return randomBytes(6).toString("hex");
}
