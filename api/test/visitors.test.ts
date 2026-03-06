import { describe, it, expect, beforeEach } from "vitest";

/**
 * Unit tests for the visitor counter logic.
 * These test the core counting/deduplication without needing bun:sqlite.
 */

// In-memory visitor store that mirrors the DB logic
class VisitorStore {
  private visitors = new Map<string, { firstSeen: Date; lastSeen: Date }>();

  record(ipHash: string): { uniqueVisitors: number; isNew: boolean } {
    const existing = this.visitors.get(ipHash);
    let isNew = false;

    if (existing) {
      existing.lastSeen = new Date();
    } else {
      this.visitors.set(ipHash, {
        firstSeen: new Date(),
        lastSeen: new Date(),
      });
      isNew = true;
    }

    return { uniqueVisitors: this.visitors.size, isNew };
  }

  getCount(): number {
    return this.visitors.size;
  }

  reset(): void {
    this.visitors.clear();
  }
}

// Test IP hashing (pure function, no bun dependency)
async function hashIp(ip: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("Visitor Counter", () => {
  let store: VisitorStore;

  beforeEach(() => {
    store = new VisitorStore();
  });

  it("should start with zero visitors", () => {
    expect(store.getCount()).toBe(0);
  });

  it("should count a new unique visitor", () => {
    const result = store.record("hash-abc");
    expect(result.uniqueVisitors).toBe(1);
    expect(result.isNew).toBe(true);
  });

  it("should not double-count the same visitor", () => {
    store.record("hash-abc");
    const result = store.record("hash-abc");
    expect(result.uniqueVisitors).toBe(1);
    expect(result.isNew).toBe(false);
  });

  it("should count multiple unique visitors", () => {
    store.record("hash-aaa");
    store.record("hash-bbb");
    const result = store.record("hash-ccc");
    expect(result.uniqueVisitors).toBe(3);
    expect(result.isNew).toBe(true);
  });

  it("should handle mixed new and returning visitors", () => {
    store.record("hash-aaa");
    store.record("hash-bbb");
    store.record("hash-aaa"); // returning
    const result = store.record("hash-ccc"); // new
    expect(result.uniqueVisitors).toBe(3);
    expect(result.isNew).toBe(true);
  });
});

describe("IP Hashing", () => {
  it("should produce consistent hashes for same input", async () => {
    const hash1 = await hashIp("192.168.1.1", "salt");
    const hash2 = await hashIp("192.168.1.1", "salt");
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different IPs", async () => {
    const hash1 = await hashIp("192.168.1.1", "salt");
    const hash2 = await hashIp("192.168.1.2", "salt");
    expect(hash1).not.toBe(hash2);
  });

  it("should produce different hashes with different salts", async () => {
    const hash1 = await hashIp("192.168.1.1", "salt-a");
    const hash2 = await hashIp("192.168.1.1", "salt-b");
    expect(hash1).not.toBe(hash2);
  });

  it("should produce a 64-character hex string", async () => {
    const hash = await hashIp("10.0.0.1", "test");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
