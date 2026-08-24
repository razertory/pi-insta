export interface SessionInfo {
  id: string;
  name: string;
  status: "running" | "exited";
  createdAt: number;
  exitCode?: number;
}

export async function listSessions(): Promise<SessionInfo[]> {
  const res = await fetch("/api/sessions");
  return res.json();
}

export async function createSession(): Promise<SessionInfo> {
  const res = await fetch("/api/sessions", { method: "POST" });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`/api/sessions/${id}`, { method: "DELETE" });
}
