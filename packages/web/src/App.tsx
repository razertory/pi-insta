import React, { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Terminal } from "./components/Terminal";
import { listSessions, createSession, deleteSession, type SessionInfo } from "./api";

export const App: React.FC = () => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listSessions();
      setSessions(list);
      return list;
    } catch {
      return [];
    }
  }, []);

  // Initial load + create first session if none exist
  useEffect(() => {
    (async () => {
      const list = await refresh();
      if (list.length === 0) {
        try {
          const created = await createSession();
          setSessions([created]);
          setActiveId(created.id);
        } catch (err) {
          console.error("Failed to create initial session:", err);
        }
      } else {
        setActiveId((prev) => prev ?? list[0].id);
      }
    })();
  }, [refresh]);

  // Poll session list for status updates (running/exited)
  useEffect(() => {
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleCreate = async () => {
    try {
      const created = await createSession();
      setSessions((prev) => [...prev, created]);
      setActiveId(created.id);
    } catch (err) {
      console.error("Failed to create session:", err);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSession(id);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#090d16",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          height: "40px",
          minHeight: "40px",
          backgroundColor: "#0f172a",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: "8px",
          fontSize: "14px",
          color: "#94a3b8",
        }}
      >
        <span style={{ fontWeight: 600, color: "#f8fafc" }}>Pi Agent</span>
        <span
          style={{
            fontSize: "12px",
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: "#334155",
            color: "#cbd5e1",
          }}
        >
          Web TUI
        </span>
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Sidebar
          sessions={sessions}
          activeId={activeId}
          onSelect={setActiveId}
          onCreate={handleCreate}
          onDelete={handleDelete}
        />
        <main style={{ flex: 1, overflow: "hidden" }}>
          {activeId ? (
            <Terminal key={activeId} sessionId={activeId} onExit={() => refresh()} />
          ) : (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#475569",
                fontSize: "14px",
              }}
            >
              No active session. Create one from the sidebar.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
