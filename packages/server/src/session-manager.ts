import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { PtySession } from "./pty.js";

export interface SessionInfo {
  id: string;
  name: string;
  status: "running" | "exited";
  createdAt: number;
  exitCode?: number;
}

interface Session {
  info: SessionInfo;
  pty: PtySession | null;
  buffer: Buffer[];
  bufferSize: number;
  clients: Set<WebSocket>;
}

const MAX_BUFFER_SIZE = 256 * 1024; // 256KB ring buffer for replay

export class SessionManager {
  private sessions = new Map<string, Session>();

  list(): SessionInfo[] {
    return [...this.sessions.values()].map((s) => s.info);
  }

  create(cwd?: string): SessionInfo {
    const id = randomUUID();
    const name = this.nextName();

    const pty = new PtySession({ cols: 80, rows: 24, cwd });

    const session: Session = {
      info: { id, name, status: "running", createdAt: Date.now() },
      pty,
      buffer: [],
      bufferSize: 0,
      clients: new Set(),
    };

    pty.onData((data) => {
      this.appendToBuffer(session, Buffer.from(data, "utf-8"));
      for (const client of session.clients) {
        if (client.readyState === client.OPEN) {
          client.send(data, { binary: true });
        }
      }
    });

    pty.onExit(({ exitCode }) => {
      session.info.status = "exited";
      session.info.exitCode = exitCode;
      session.pty = null;
      this.broadcastControl(session, { type: "exit", exitCode });
    });

    this.sessions.set(id, session);
    return session.info;
  }

  remove(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.pty?.kill();
    for (const client of session.clients) {
      client.close(1000, "Session removed");
    }
    this.sessions.delete(id);
    return true;
  }

  get(id: string): SessionInfo | undefined {
    return this.sessions.get(id)?.info;
  }

  /** Attach a WebSocket client: replay buffered output, then live stream. */
  attach(id: string, ws: WebSocket): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;

    session.clients.add(ws);

    // Replay scrollback so the terminal restores its screen
    for (const chunk of session.buffer) {
      ws.send(chunk, { binary: true });
    }

    if (session.info.status === "exited") {
      ws.send(JSON.stringify({ type: "exit", exitCode: session.info.exitCode }));
    }
    return true;
  }

  detach(id: string, ws: WebSocket) {
    this.sessions.get(id)?.clients.delete(ws);
  }

  writeInput(id: string, data: Buffer) {
    const session = this.sessions.get(id);
    if (session?.pty && session.info.status === "running") {
      session.pty.write(data.toString("utf-8"));
    }
  }

  resize(id: string, cols: number, rows: number) {
    const session = this.sessions.get(id);
    session?.pty?.resize(cols, rows);
  }

  private appendToBuffer(session: Session, chunk: Buffer) {
    session.buffer.push(chunk);
    session.bufferSize += chunk.length;
    while (session.bufferSize > MAX_BUFFER_SIZE && session.buffer.length > 1) {
      const removed = session.buffer.shift()!;
      session.bufferSize -= removed.length;
    }
  }

  private broadcastControl(session: Session, msg: Record<string, unknown>) {
    const frame = JSON.stringify(msg);
    for (const client of session.clients) {
      if (client.readyState === client.OPEN) {
        client.send(frame);
      }
    }
  }

  private nextName(): string {
    const used = new Set([...this.sessions.values()].map((s) => s.info.name));
    let n = 1;
    while (used.has(`session-${n}`)) n++;
    return `session-${n}`;
  }
}
