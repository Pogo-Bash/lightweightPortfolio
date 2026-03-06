import { Hono } from "hono";
import { cors } from "hono/cors";
import { hashIp, recordVisitor, getVisitorCount } from "./db";

const app = new Hono();

// CORS for frontend
app.use(
  "/api/*",
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    allowMethods: ["GET", "POST"],
  })
);

// Rate limiting: 1 request per second per IP
const rateLimit = new Map<string, number>();
app.use("/api/*", async (c, next) => {
  const ip = getClientIp(c);
  const now = Date.now();
  const last = rateLimit.get(ip) || 0;
  if (now - last < 1000) return c.json({ error: "rate limited" }, 429);
  rateLimit.set(ip, now);
  await next();
});

// Extract client IP from headers (supports proxies like Cloudflare, nginx)
function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-real-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// POST /api/visit - Record a visit and return unique visitor count
app.post("/api/visit", async (c) => {
  const ip = getClientIp(c);
  const ipHash = await hashIp(ip);
  const result = recordVisitor(ipHash);

  return c.json({
    uniqueVisitors: result.uniqueVisitors,
    isNew: result.isNew,
  });
});

// GET /api/visitors - Get current unique visitor count
app.get("/api/visitors", (c) => {
  const count = getVisitorCount();
  return c.json({ uniqueVisitors: count });
});

// Health check
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

const port = parseInt(process.env.PORT || "3000", 10);

export default {
  port,
  fetch: app.fetch,
};

console.log(`Swap API running on port ${port}`);
