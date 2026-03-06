import { Database } from "bun:sqlite";
import { join } from "path";

const DB_PATH = process.env.DB_PATH || join(import.meta.dir, "../data/visitors.db");

let db: Database;

export function getDb(): Database {
  if (!db) {
    // Ensure data directory exists
    const dir = DB_PATH.substring(0, DB_PATH.lastIndexOf("/"));
    try {
      Bun.spawnSync(["mkdir", "-p", dir]);
    } catch {
      // directory may already exist
    }

    db = new Database(DB_PATH, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = NORMAL");

    db.exec(`
      CREATE TABLE IF NOT EXISTS visitors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_hash TEXT NOT NULL UNIQUE,
        first_seen TEXT NOT NULL DEFAULT (datetime('now')),
        last_seen TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_visitors_ip_hash ON visitors(ip_hash)
    `);
  }
  return db;
}

/** Hash IP for privacy - we don't store raw IPs */
export async function hashIp(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + (process.env.IP_SALT || "swap-portfolio-salt"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function recordVisitor(ipHash: string): { uniqueVisitors: number; isNew: boolean } {
  const database = getDb();

  const existing = database
    .query("SELECT id FROM visitors WHERE ip_hash = ?")
    .get(ipHash) as { id: number } | null;

  let isNew = false;

  if (existing) {
    database
      .query("UPDATE visitors SET last_seen = datetime('now') WHERE ip_hash = ?")
      .run(ipHash);
  } else {
    database
      .query("INSERT INTO visitors (ip_hash) VALUES (?)")
      .run(ipHash);
    isNew = true;
  }

  const result = database
    .query("SELECT COUNT(*) as count FROM visitors")
    .get() as { count: number };

  return { uniqueVisitors: result.count, isNew };
}

export function getVisitorCount(): number {
  const database = getDb();
  const result = database
    .query("SELECT COUNT(*) as count FROM visitors")
    .get() as { count: number };
  return result.count;
}
