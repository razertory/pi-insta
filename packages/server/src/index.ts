import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "node:http";
import { SessionManager } from "./session-manager.js";

const app = new Hono();
const port = Number(process.env.PORT) || 3000;
const sessionManager = new SessionManager();

// --- Session REST API ---

app.get("/api/sessions", (c) => c.json(sessionManager.list()));

app.post("/api/sessions", (c) => {
  try {
    const info = sessionManager.create(process.cwd());
    return c.json(info, 201);
  } catch (err) {
    console.error("[Session] Failed to create:", err);
    return c.json({ error: "Failed to spawn session" }, 500);
  }
});

app.delete("/api/sessions/:id", (c) => {
  const ok = sessionManager.remove(c.req.param("id"));
  return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404);
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

// --- Static frontend ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const webDistPath = join(__dirname, "../../web/dist");

app.use("/*", serveStatic({ root: webDistPath }));
app.get("*", serveStatic({ path: join(webDistPath, "index.html") }));

// --- HTTP server ---

const server = serve(
  { fetch: app.fetch, port },
  (info) => console.log(`[Server] Running on http://localhost:${info.port}`)
);

// --- WebSocket: attach to session ---

const wss = new WebSocketServer({ server: server as any, path: "/ws" });

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const sessionId = url.searchParams.get("session");

  if (!sessionId || !sessionManager.get(sessionId)) {
    ws.close(1008, "Unknown session");
    return;
  }

  console.log(`[WS] Client attached to ${sessionId}`);
  sessionManager.attach(sessionId, ws);

  ws.on("message", (data: Buffer, isBinary: boolean) => {
    if (isBinary) {
      // Raw terminal input
      sessionManager.writeInput(sessionId, data);
      return;
    }
    // Text frame: control message (JSON)
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "resize" && msg.cols > 0 && msg.rows > 0) {
        sessionManager.resize(sessionId, msg.cols, msg.rows);
      }
    } catch {
      // Ignore malformed control frames
    }
  });

  const onClose = () => {
    console.log(`[WS] Client detached from ${sessionId}`);
    sessionManager.detach(sessionId, ws);
  };
  ws.on("close", onClose);
  ws.on("error", onClose);
});
